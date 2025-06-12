/**
 * Offline Operation Queue
 * Manages failed API requests and operations for retry when connectivity is restored
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { DatabaseService } from '@/src/database/DatabaseService';
import { v4 as uuidv4 } from 'uuid';

export interface QueuedOperation {
  id: string;
  type: 'api_call' | 'database_sync' | 'file_sync' | 'custom';
  operation: string;
  payload: any;
  metadata: {
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    timestamp: Date;
    retryCount: number;
    maxRetries: number;
    priority: 'high' | 'medium' | 'low';
    userId?: string;
    sessionId?: string;
  };
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
  result?: any;
}

export interface QueueStatistics {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  oldestOperation?: Date;
}

export class OfflineOperationQueue extends EventEmitter {
  private readonly logger: Logger;
  private readonly db: DatabaseService;
  private processingQueue: boolean = false;
  private readonly BATCH_SIZE = 10;
  private readonly RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // Exponential backoff
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(databaseService: DatabaseService) {
    super();
    this.logger = new Logger('OfflineOperationQueue');
    this.db = databaseService;
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS offline_queue (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          metadata TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          result TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          priority_score INTEGER DEFAULT 50
        )
      `);

      // Create indexes for efficient queries
      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_offline_queue_status 
        ON offline_queue(status, priority_score DESC)
      `);

      await this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_offline_queue_created 
        ON offline_queue(created_at)
      `);

      this.logger.info('Offline queue schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize schema', error as Error);
      throw error;
    }
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(operation: Omit<QueuedOperation, 'id'>): Promise<string> {
    const id = uuidv4();
    const priorityScore = this.calculatePriorityScore(operation.metadata.priority);

    try {
      await this.db.run(`
        INSERT INTO offline_queue (
          id, type, operation, payload, metadata, status, priority_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        operation.type,
        operation.operation,
        JSON.stringify(operation.payload),
        JSON.stringify(operation.metadata),
        operation.status || 'pending',
        priorityScore
      ]);

      this.logger.info('Operation queued', { 
        id, 
        type: operation.type, 
        operation: operation.operation 
      });

      this.emit('operationQueued', { id, ...operation });
      this.emit('queueUpdated', await this.getStatistics());

      return id;
    } catch (error) {
      this.logger.error('Failed to enqueue operation', error as Error);
      throw error;
    }
  }

  /**
   * Process the queue
   */
  async processQueue(
    executor: (operation: QueuedOperation) => Promise<any>
  ): Promise<void> {
    if (this.processingQueue) {
      this.logger.warn('Queue processing already in progress');
      return;
    }

    this.processingQueue = true;
    this.emit('processingStarted');

    try {
      while (true) {
        // Get batch of pending operations
        const operations = await this.getPendingOperations(this.BATCH_SIZE);
        
        if (operations.length === 0) {
          break;
        }

        // Process operations in parallel
        const promises = operations.map(op => this.processOperation(op, executor));
        await Promise.allSettled(promises);
      }
    } finally {
      this.processingQueue = false;
      this.emit('processingCompleted');
      this.emit('queueUpdated', await this.getStatistics());
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(
    operation: QueuedOperation,
    executor: (operation: QueuedOperation) => Promise<any>
  ): Promise<void> {
    try {
      // Update status to processing
      await this.updateOperationStatus(operation.id, 'processing');
      this.emit('operationStarted', operation);

      // Execute the operation
      const result = await executor(operation);

      // Mark as completed
      await this.updateOperationStatus(operation.id, 'completed', null, result);
      this.emit('operationCompleted', { ...operation, result });

      // Clear any retry timeouts
      const timeout = this.retryTimeouts.get(operation.id);
      if (timeout) {
        clearTimeout(timeout);
        this.retryTimeouts.delete(operation.id);
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      operation.metadata.retryCount = (operation.metadata.retryCount || 0) + 1;

      if (operation.metadata.retryCount < operation.metadata.maxRetries) {
        // Schedule retry with exponential backoff
        const delay = this.getRetryDelay(operation.metadata.retryCount);
        
        await this.updateOperationStatus(
          operation.id, 
          'pending', 
          errorMessage
        );

        this.logger.info('Scheduling operation retry', {
          id: operation.id,
          retryCount: operation.metadata.retryCount,
          delay
        });

        const timeout = setTimeout(() => {
          this.retryTimeouts.delete(operation.id);
          this.emit('retryRequired', operation);
        }, delay);

        this.retryTimeouts.set(operation.id, timeout);
        
        this.emit('operationRetryScheduled', {
          ...operation,
          nextRetry: new Date(Date.now() + delay)
        });
      } else {
        // Max retries exceeded
        await this.updateOperationStatus(operation.id, 'failed', errorMessage);
        this.emit('operationFailed', { ...operation, error: errorMessage });
      }
    }
  }

  /**
   * Get pending operations
   */
  private async getPendingOperations(limit: number): Promise<QueuedOperation[]> {
    const rows = (await this.db.query(`
      SELECT * FROM offline_queue 
      WHERE status = 'pending'
      ORDER BY priority_score DESC, created_at ASC
      LIMIT ?
    `, [limit])).rows;

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      operation: row.operation,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
      status: row.status,
      error: row.error,
      result: row.result ? JSON.parse(row.result) : undefined
    }));
  }

  /**
   * Update operation status
   */
  private async updateOperationStatus(
    id: string,
    status: QueuedOperation['status'],
    error?: string | null,
    result?: any
  ): Promise<void> {
    await this.db.run(`
      UPDATE offline_queue 
      SET status = ?, error = ?, result = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      status,
      error,
      result ? JSON.stringify(result) : null,
      id
    ]);
  }

  /**
   * Calculate priority score
   */
  private calculatePriorityScore(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 100;
      case 'medium': return 50;
      case 'low': return 10;
    }
  }

  /**
   * Get retry delay based on retry count
   */
  private getRetryDelay(retryCount: number): number {
    const index = Math.max(0, Math.min(retryCount - 1, this.RETRY_DELAYS.length - 1));
    return this.RETRY_DELAYS[index]!;
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<QueueStatistics> {
    const stats = (await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest
      FROM offline_queue
      GROUP BY status
    `)).rows;

    const priorityStats = (await this.db.query(`
      SELECT 
        CASE 
          WHEN priority_score >= 100 THEN 'high'
          WHEN priority_score >= 50 THEN 'medium'
          ELSE 'low'
        END as priority,
        COUNT(*) as count
      FROM offline_queue
      WHERE status = 'pending'
      GROUP BY priority
    `)).rows;

    const result: QueueStatistics = {
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      completed: 0,
      byPriority: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    // Process status stats
    for (const row of stats) {
      result.total += row.count;
      result[row.status as keyof QueueStatistics] = row.count;
      
      if (row.status === 'pending' && row.oldest) {
        result.oldestOperation = new Date(row.oldest);
      }
    }

    // Process priority stats
    for (const row of priorityStats) {
      result.byPriority[row.priority as keyof typeof result.byPriority] = row.count;
    }

    return result;
  }

  /**
   * Get operations by status
   */
  async getOperationsByStatus(
    status: QueuedOperation['status'],
    limit: number = 100
  ): Promise<QueuedOperation[]> {
    const rows = (await this.db.query(`
      SELECT * FROM offline_queue 
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [status, limit])).rows;

    return rows.map(row => ({
      id: row.id,
      type: row.type,
      operation: row.operation,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
      status: row.status,
      error: row.error,
      result: row.result ? JSON.parse(row.result) : undefined
    }));
  }

  /**
   * Clear completed operations older than specified age
   */
  async clearOldOperations(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAgeMs).toISOString();
    
    const result = await this.db.run(`
      DELETE FROM offline_queue 
      WHERE status = 'completed' 
      AND updated_at < ?
    `, [cutoffDate]);

    const deletedCount = result?.changes || 0;
    
    if (deletedCount > 0) {
      this.logger.info('Cleared old operations', { count: deletedCount });
      this.emit('queueCleaned', deletedCount);
    }

    return deletedCount;
  }

  /**
   * Retry failed operations
   */
  async retryFailedOperations(): Promise<void> {
    await this.db.run(`
      UPDATE offline_queue 
      SET status = 'pending', 
          error = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'failed'
    `);

    this.emit('failedOperationsReset');
    this.emit('queueUpdated', await this.getStatistics());
  }

  /**
   * Cancel operation
   */
  async cancelOperation(id: string): Promise<void> {
    // Clear any retry timeout
    const timeout = this.retryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(id);
    }

    await this.db.run(`
      DELETE FROM offline_queue WHERE id = ?
    `, [id]);

    this.emit('operationCancelled', id);
    this.emit('queueUpdated', await this.getStatistics());
  }

  /**
   * Clear all operations
   */
  async clearQueue(): Promise<void> {
    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();

    await this.db.run('DELETE FROM offline_queue');
    
    this.emit('queueCleared');
    this.emit('queueUpdated', await this.getStatistics());
  }

  /**
   * Export queue for debugging
   */
  async exportQueue(): Promise<QueuedOperation[]> {
    const rows = (await this.db.query('SELECT * FROM offline_queue ORDER BY created_at DESC')).rows;
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      operation: row.operation,
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
      status: row.status,
      error: row.error,
      result: row.result ? JSON.parse(row.result) : undefined
    }));
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all retry timeouts
    for (const timeout of this.retryTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.retryTimeouts.clear();
    
    this.removeAllListeners();
  }
}