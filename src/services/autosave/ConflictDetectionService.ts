/**
 * @actor system
 * @responsibility Conflict detection for overlapping backup operations
 */

import { Logger } from '@/src/lib/logging/Logger';
import { EventEmitter } from 'events';

export interface BackupOperation {
  id: string;
  sessionId: string;
  type: 'auto-save' | 'manual' | 'incremental' | 'full' | 'restoration';
  priority: 'low' | 'normal' | 'high' | 'critical';
  startTime: Date;
  estimatedDuration?: number;
  resourceLocks: string[]; // Resources this operation needs
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  conflictsWith?: string[]; // IDs of conflicting operations
}

export interface ConflictResolution {
  strategy: 'queue' | 'cancel' | 'merge' | 'priority' | 'retry';
  action: 'wait' | 'cancel_existing' | 'cancel_new' | 'merge_operations' | 'schedule_retry';
  reason: string;
  affectedOperations: string[];
}

export interface ResourceLock {
  resourceId: string;
  operationId: string;
  sessionId: string;
  lockType: 'read' | 'write' | 'exclusive';
  acquiredAt: Date;
  expiresAt?: Date;
}

export interface ConflictReport {
  conflictId: string;
  timestamp: Date;
  conflictingOperations: BackupOperation[];
  resolution: ConflictResolution;
  impact: 'low' | 'medium' | 'high';
  autoResolved: boolean;
}

export class ConflictDetectionService extends EventEmitter {
  private readonly logger: Logger;
  private activeOperations: Map<string, BackupOperation> = new Map();
  private resourceLocks: Map<string, ResourceLock> = new Map();
  private conflictHistory: ConflictReport[] = [];
  private maxHistorySize = 1000;
  private lockTimeout = 300000; // 5 minutes default
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    
    // Start periodic cleanup of expired locks
    this.startCleanupInterval();
  }

  /**
   * Register a new backup operation
   */
  registerOperation(operation: Omit<BackupOperation, 'id' | 'startTime' | 'status'>): string {
    const fullOperation: BackupOperation = {
      id: this.generateOperationId(),
      startTime: new Date(),
      status: 'pending',
      conflictsWith: [],
      ...operation
    };

    // Check for conflicts before registering
    const conflicts = this.detectConflicts(fullOperation);
    
    if (conflicts.length > 0) {
      fullOperation.conflictsWith = conflicts.map(c => c.id);
      const resolution = this.resolveConflicts(fullOperation, conflicts);
      
      if (resolution.action === 'cancel_new') {
        this.logger.warn('Operation cancelled due to conflicts', {
          operationId: fullOperation.id,
          conflicts: conflicts.map(c => c.id),
          resolution
        });
        
        this.emit('operation:conflict', {
          operation: fullOperation,
          conflicts,
          resolution
        });
        
        throw new Error(`Operation cancelled: ${resolution.reason}`);
      }
      
      this.handleConflictResolution(fullOperation, conflicts, resolution);
    }

    this.activeOperations.set(fullOperation.id, fullOperation);
    
    this.logger.debug('Operation registered', {
      operationId: fullOperation.id,
      sessionId: fullOperation.sessionId,
      type: fullOperation.type,
      conflicts: fullOperation.conflictsWith
    });

    this.emit('operation:registered', fullOperation);
    return fullOperation.id;
  }

  /**
   * Start an operation (acquire resource locks)
   */
  async startOperation(operationId: string): Promise<boolean> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.error('Attempted to start non-existent operation', new Error('Non-existent operation'), { operationId });
      return false;
    }

    if (operation.status !== 'pending') {
      this.logger.warn('Attempted to start operation in wrong state', {
        operationId,
        status: operation.status
      });
      return false;
    }

    // Try to acquire all required resource locks
    const locksAcquired: string[] = [];
    
    try {
      for (const resourceId of operation.resourceLocks) {
        const lockAcquired = await this.acquireResourceLock(
          resourceId,
          operationId,
          operation.sessionId,
          this.determineLockType(operation.type)
        );
        
        if (lockAcquired) {
          locksAcquired.push(resourceId);
        } else {
          // Failed to acquire lock - release any locks we did acquire
          for (const acquiredResource of locksAcquired) {
            this.releaseResourceLock(acquiredResource, operationId);
          }
          
          this.logger.warn('Failed to acquire resource lock', {
            operationId,
            resourceId,
            sessionId: operation.sessionId
          });
          
          return false;
        }
      }

      operation.status = 'running';
      operation.startTime = new Date();

      this.logger.info('Operation started', {
        operationId,
        sessionId: operation.sessionId,
        locksAcquired: locksAcquired.length
      });

      this.emit('operation:started', operation);
      return true;

    } catch (error) {
      // Release any acquired locks on error
      for (const acquiredResource of locksAcquired) {
        this.releaseResourceLock(acquiredResource, operationId);
      }
      
      this.logger.error('Failed to start operation', error as Error, { operationId });
      return false;
    }
  }

  /**
   * Complete an operation (release resource locks)
   */
  completeOperation(operationId: string, status: 'completed' | 'failed' | 'cancelled'): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.logger.warn('Attempted to complete non-existent operation', { operationId });
      return;
    }

    // Release all resource locks
    for (const resourceId of operation.resourceLocks) {
      this.releaseResourceLock(resourceId, operationId);
    }

    operation.status = status;
    this.activeOperations.delete(operationId);

    this.logger.debug('Operation completed', {
      operationId,
      sessionId: operation.sessionId,
      status,
      duration: Date.now() - operation.startTime.getTime()
    });

    this.emit('operation:completed', operation);

    // Check if any pending operations can now proceed
    this.checkPendingOperations();
  }

  /**
   * Detect conflicts for a new operation
   */
  private detectConflicts(newOperation: BackupOperation): BackupOperation[] {
    const conflicts: BackupOperation[] = [];

    for (const [, existingOperation] of this.activeOperations) {
      if (this.hasConflict(newOperation, existingOperation)) {
        conflicts.push(existingOperation);
      }
    }

    return conflicts;
  }

  /**
   * Check if two operations conflict
   */
  private hasConflict(op1: BackupOperation, op2: BackupOperation): boolean {
    // Same session conflicts
    if (op1.sessionId === op2.sessionId) {
      // Multiple write operations on same session
      if (this.isWriteOperation(op1) && this.isWriteOperation(op2)) {
        return true;
      }
      
      // Restoration conflicts with any other operation
      if (op1.type === 'restoration' || op2.type === 'restoration') {
        return true;
      }
    }

    // Resource lock conflicts
    const sharedResources = op1.resourceLocks.filter(r => op2.resourceLocks.includes(r));
    if (sharedResources.length > 0) {
      // Check if lock types are compatible
      const op1LockType = this.determineLockType(op1.type);
      const op2LockType = this.determineLockType(op2.type);
      
      if (op1LockType === 'exclusive' || op2LockType === 'exclusive') {
        return true;
      }
      
      if (op1LockType === 'write' && op2LockType === 'write') {
        return true;
      }
    }

    // System resource conflicts (during high load)
    if (this.isResourceIntensive(op1) && this.isResourceIntensive(op2)) {
      return true;
    }

    return false;
  }

  /**
   * Resolve conflicts between operations
   */
  private resolveConflicts(
    newOperation: BackupOperation,
    conflicts: BackupOperation[]
  ): ConflictResolution {
    // Priority-based resolution
    const highestConflictPriority = Math.max(
      ...conflicts.map(c => this.getPriorityValue(c.priority))
    );
    const newOperationPriority = this.getPriorityValue(newOperation.priority);

    // Critical operations always win
    if (newOperation.priority === 'critical') {
      return {
        strategy: 'priority',
        action: 'cancel_existing',
        reason: 'Critical operation takes precedence',
        affectedOperations: conflicts.map(c => c.id)
      };
    }

    // If new operation has higher priority
    if (newOperationPriority > highestConflictPriority) {
      return {
        strategy: 'priority',
        action: 'cancel_existing',
        reason: 'Higher priority operation',
        affectedOperations: conflicts.map(c => c.id)
      };
    }

    // If conflicts have higher priority, queue new operation
    if (newOperationPriority < highestConflictPriority) {
      return {
        strategy: 'queue',
        action: 'wait',
        reason: 'Waiting for higher priority operations',
        affectedOperations: [newOperation.id]
      };
    }

    // Same priority - check operation types
    if (newOperation.type === 'auto-save' && conflicts.some(c => c.type === 'manual')) {
      return {
        strategy: 'priority',
        action: 'wait',
        reason: 'Manual operation takes precedence over auto-save',
        affectedOperations: [newOperation.id]
      };
    }

    // Check if operations can be merged
    if (this.canMergeOperations(newOperation, conflicts)) {
      return {
        strategy: 'merge',
        action: 'merge_operations',
        reason: 'Operations can be combined for efficiency',
        affectedOperations: [newOperation.id, ...conflicts.map(c => c.id)]
      };
    }

    // Default: queue the new operation
    return {
      strategy: 'queue',
      action: 'wait',
      reason: 'Queuing to avoid conflicts',
      affectedOperations: [newOperation.id]
    };
  }

  /**
   * Handle conflict resolution
   */
  private handleConflictResolution(
    newOperation: BackupOperation,
    conflicts: BackupOperation[],
    resolution: ConflictResolution
  ): void {
    const conflictReport: ConflictReport = {
      conflictId: this.generateConflictId(),
      timestamp: new Date(),
      conflictingOperations: [newOperation, ...conflicts],
      resolution,
      impact: this.calculateConflictImpact(conflicts),
      autoResolved: true
    };

    this.addToConflictHistory(conflictReport);

    switch (resolution.action) {
      case 'cancel_existing':
        for (const conflict of conflicts) {
          this.completeOperation(conflict.id, 'cancelled');
        }
        break;

      case 'cancel_new':
        // Will be handled by caller
        break;

      case 'wait':
        newOperation.status = 'pending';
        break;

      case 'merge_operations':
        this.mergeOperations(newOperation, conflicts);
        break;

      case 'schedule_retry':
        // Implementation for retry scheduling would go here
        break;
    }

    this.emit('conflict:resolved', conflictReport);
  }

  /**
   * Acquire resource lock
   */
  private async acquireResourceLock(
    resourceId: string,
    operationId: string,
    sessionId: string,
    lockType: 'read' | 'write' | 'exclusive'
  ): Promise<boolean> {
    const existingLock = this.resourceLocks.get(resourceId);
    
    if (existingLock) {
      // Check if lock is expired
      if (existingLock.expiresAt && existingLock.expiresAt < new Date()) {
        this.resourceLocks.delete(resourceId);
      } else {
        // Check compatibility
        if (!this.areLocksCompatible(existingLock.lockType, lockType)) {
          return false;
        }
      }
    }

    const lock: ResourceLock = {
      resourceId,
      operationId,
      sessionId,
      lockType,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + this.lockTimeout)
    };

    this.resourceLocks.set(resourceId, lock);
    
    this.logger.debug('Resource lock acquired', {
      resourceId,
      operationId,
      lockType
    });

    return true;
  }

  /**
   * Release resource lock
   */
  private releaseResourceLock(resourceId: string, operationId: string): boolean {
    const lock = this.resourceLocks.get(resourceId);
    
    if (lock && lock.operationId === operationId) {
      this.resourceLocks.delete(resourceId);
      
      this.logger.debug('Resource lock released', {
        resourceId,
        operationId
      });
      
      return true;
    }

    return false;
  }

  /**
   * Check if lock types are compatible
   */
  private areLocksCompatible(existing: string, requested: string): boolean {
    if (existing === 'exclusive' || requested === 'exclusive') {
      return false;
    }
    
    if (existing === 'write' || requested === 'write') {
      return existing === 'read' && requested === 'read';
    }
    
    return true; // Both are read locks
  }

  /**
   * Determine lock type for operation
   */
  private determineLockType(operationType: string): 'read' | 'write' | 'exclusive' {
    switch (operationType) {
      case 'restoration':
        return 'exclusive';
      case 'full':
      case 'manual':
        return 'write';
      case 'auto-save':
      case 'incremental':
        return 'write';
      default:
        return 'read';
    }
  }

  /**
   * Helper methods
   */
  private isWriteOperation(operation: BackupOperation): boolean {
    return ['full', 'incremental', 'auto-save', 'manual'].includes(operation.type);
  }

  private isResourceIntensive(operation: BackupOperation): boolean {
    return ['full', 'restoration'].includes(operation.type);
  }

  private getPriorityValue(priority: string): number {
    const values = { low: 1, normal: 2, high: 3, critical: 4 };
    return values[priority as keyof typeof values] || 2;
  }

  private canMergeOperations(
    newOperation: BackupOperation,
    conflicts: BackupOperation[]
  ): boolean {
    // Can merge multiple auto-save operations for the same session
    if (newOperation.type === 'auto-save') {
      return conflicts.every(c => 
        c.type === 'auto-save' && 
        c.sessionId === newOperation.sessionId
      );
    }

    return false;
  }

  private mergeOperations(
    newOperation: BackupOperation,
    conflicts: BackupOperation[]
  ): void {
    // Cancel existing operations and proceed with new one
    for (const conflict of conflicts) {
      this.completeOperation(conflict.id, 'cancelled');
    }
    
    this.logger.info('Operations merged', {
      newOperationId: newOperation.id,
      cancelledOperations: conflicts.map(c => c.id)
    });
  }

  private calculateConflictImpact(conflicts: BackupOperation[]): 'low' | 'medium' | 'high' {
    if (conflicts.some(c => c.priority === 'critical')) return 'high';
    if (conflicts.some(c => c.priority === 'high')) return 'medium';
    return 'low';
  }

  private checkPendingOperations(): void {
    const pendingOperations = Array.from(this.activeOperations.values())
      .filter(op => op.status === 'pending');

    for (const operation of pendingOperations) {
      const conflicts = this.detectConflicts(operation);
      if (conflicts.length === 0) {
        // No more conflicts, can start operation
        this.startOperation(operation.id);
      }
    }
  }

  private addToConflictHistory(report: ConflictReport): void {
    this.conflictHistory.unshift(report);
    
    if (this.conflictHistory.length > this.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(0, this.maxHistorySize);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, 60000); // Check every minute
  }

  private cleanupExpiredLocks(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [resourceId, lock] of this.resourceLocks) {
      if (lock.expiresAt && lock.expiresAt < now) {
        this.resourceLocks.delete(resourceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up expired locks', { count: cleaned });
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateConflictId(): string {
    return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Public methods for monitoring
   */
  getActiveOperations(): BackupOperation[] {
    return Array.from(this.activeOperations.values());
  }

  getResourceLocks(): ResourceLock[] {
    return Array.from(this.resourceLocks.values());
  }

  getConflictHistory(limit = 50): ConflictReport[] {
    return this.conflictHistory.slice(0, limit);
  }

  getStatistics(): {
    activeOperations: number;
    resourceLocks: number;
    totalConflicts: number;
    autoResolvedConflicts: number;
  } {
    return {
      activeOperations: this.activeOperations.size,
      resourceLocks: this.resourceLocks.size,
      totalConflicts: this.conflictHistory.length,
      autoResolvedConflicts: this.conflictHistory.filter(r => r.autoResolved).length
    };
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.resourceLocks.clear();
    this.activeOperations.clear();
  }
}