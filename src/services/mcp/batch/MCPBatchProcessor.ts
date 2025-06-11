import { EventEmitter } from 'events';
import Queue from 'bull';
import { MCPIntegrationService } from '../core/MCPIntegrationManager';
import { Logger } from '../../../lib/logging/Logger';

export interface BatchOperation {
  id: string;
  type: 'test' | 'deploy' | 'update' | 'validate' | 'execute';
  items: BatchItem[];
  config: BatchConfig;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: BatchProgress;
  results: BatchResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface BatchItem {
  id: string;
  integrationId: string;
  tool?: string;
  input?: any;
  metadata?: Record<string, any>;
}

export interface BatchConfig {
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  continueOnError: boolean;
  rollbackOnFailure: boolean;
  progressReportInterval: number;
  memoryLimit: number; // MB
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  estimatedTimeRemaining: number; // seconds
  currentItem?: string;
  throughput: number; // items per second
}

export interface BatchResult {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  output?: any;
  error?: string;
  timestamp: Date;
}

export interface BatchSnapshot {
  operationId: string;
  timestamp: Date;
  state: any;
  results: BatchResult[];
}

export class MCPBatchProcessor extends EventEmitter {
  private logger: Logger;
  private integrationService: MCPIntegrationService;
  private batchQueue: Queue.Queue;
  private activeOperations: Map<string, BatchOperation> = new Map();
  private snapshots: Map<string, BatchSnapshot[]> = new Map();
  private memoryMonitor: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.logger = new Logger('MCP');
    this.integrationService = new MCPIntegrationService();
    
        
    // Initialize batch queue with Redis for production use
    this.batchQueue = new Queue('mcp-batch-operations', {
      redis: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379'),
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupQueueHandlers();
    this.startMemoryMonitoring();
  }

  async createBatchOperation(
    type: BatchOperation['type'],
    items: BatchItem[],
    config?: Partial<BatchConfig>
  ): Promise<BatchOperation> {
    const operation: BatchOperation = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      items,
      config: {
        concurrency: config?.concurrency || 5,
        retryAttempts: config?.retryAttempts || 3,
        retryDelay: config?.retryDelay || 1000,
        timeout: config?.timeout || 30000,
        continueOnError: config?.continueOnError ?? true,
        rollbackOnFailure: config?.rollbackOnFailure ?? false,
        progressReportInterval: config?.progressReportInterval || 1000,
        memoryLimit: config?.memoryLimit || 1024, // 1GB default
        ...config,
      },
      status: 'pending',
      progress: {
        total: items.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
        estimatedTimeRemaining: 0,
        throughput: 0,
      },
      results: [],
      createdAt: new Date(),
    };

    // Validate memory requirements
    const estimatedMemory = this.estimateMemoryRequirement(items);
    if (estimatedMemory > operation.config.memoryLimit) {
      throw new Error(
        `Estimated memory usage (${estimatedMemory}MB) exceeds limit (${operation.config.memoryLimit}MB)`
      );
    }

    // Store operation
    this.activeOperations.set(operation.id, operation);

    // Create initial snapshot
    await this.createSnapshot(operation);

    // Queue the operation
    await this.batchQueue.add('process-batch', { operationId: operation.id });

    this.emit('batch-created', operation);
    return operation;
  }

  async processBatchOperation(operationId: string): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.status = 'processing';
    operation.startedAt = new Date();
    this.emit('batch-started', operation);

    // const startTime = Date.now(); // Unused
    const progressInterval = setInterval(() => {
      this.updateProgress(operation);
      this.emit('batch-progress', operation);
    }, operation.config.progressReportInterval);

    try {
      // Process items with concurrency control
      const results = await this.processItemsConcurrently(operation);
      
      operation.results = results;
      operation.status = 'completed';
      operation.completedAt = new Date();

      // Check if rollback is needed
      const failedCount = results.filter(r => r.status === 'failed').length;
      if (operation.config.rollbackOnFailure && failedCount > 0) {
        await this.rollbackOperation(operation);
      }

      this.emit('batch-completed', operation);

    } catch (error: any) {
      operation.status = 'failed';
      operation.error = error.message;
      operation.completedAt = new Date();

      if (operation.config.rollbackOnFailure) {
        await this.rollbackOperation(operation);
      }

      this.emit('batch-failed', operation);
      throw error;

    } finally {
      clearInterval(progressInterval);
      await this.createSnapshot(operation);
    }
  }

  private async processItemsConcurrently(operation: BatchOperation): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const { items, config } = operation;
    
    // Create chunks based on concurrency
    const chunks: BatchItem[][] = [];
    for (let i = 0; i < items.length; i += config.concurrency) {
      chunks.push(items.slice(i, i + config.concurrency));
    }

    // Process chunks sequentially, items within chunks concurrently
    for (const chunk of chunks) {
      // Check if operation was cancelled
      if (operation.status === 'cancelled') {
        break;
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memoryUsage > config.memoryLimit) {
        if (!config.continueOnError) {
          throw new Error(`Memory limit exceeded: ${memoryUsage.toFixed(2)}MB`);
        }
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const chunkPromises = chunk.map(item => this.processItem(item, operation));
      const chunkResults = await Promise.allSettled(chunkPromises) as PromiseSettledResult<BatchResult>[];

      for (let i = 0; i < chunkResults.length; i++) {
        if (!chunkResults[i] || !chunk[i]) continue;
        const result = chunkResults[i];
        const item = chunk[i];

        if (result && result.status === 'fulfilled') {
          results.push(result.value);
          operation.progress.completed++;
        } else if (result && result.status === 'rejected') {
          const errorResult: BatchResult = {
            itemId: item?.id || 'unknown',
            status: 'failed',
            duration: 0,
            error: result.reason?.message || 'Unknown error',
            timestamp: new Date(),
          };
          results.push(errorResult);
          operation.progress.failed++;

          if (!config.continueOnError) {
            throw new Error(`Item ${item?.id || 'unknown'} failed: ${result.reason?.message || 'Unknown error'}`);
          }
        }
      }

      // Update progress
      this.updateProgress(operation);
    }

    return results;
  }

  private async processItem(item: BatchItem, operation: BatchOperation): Promise<BatchResult> {
    const startTime = Date.now();
    operation.progress.currentItem = item.id;

    try {
      let output: any;

      switch (operation.type) {
        case 'test':
          output = await this.testIntegration(item);
          break;
        case 'deploy':
          output = await this.deployIntegration(item);
          break;
        case 'update':
          output = await this.updateIntegration(item);
          break;
        case 'validate':
          output = await this.validateIntegration(item);
          break;
        case 'execute':
          output = await this.executeIntegrationTool(item);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      return {
        itemId: item.id,
        status: 'success',
        duration: Date.now() - startTime,
        output,
        timestamp: new Date(),
      };

    } catch (error: any) {
      // Retry logic
      let lastError = error;
      for (let attempt = 1; attempt <= operation.config.retryAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, operation.config.retryDelay * attempt));
        
        try {
          const output = await this.retryOperation(item, operation.type);
          return {
            itemId: item.id,
            status: 'success',
            duration: Date.now() - startTime,
            output,
            timestamp: new Date(),
          };
        } catch (retryError) {
          lastError = retryError;
        }
      }

      throw lastError;
    }
  }

  private async testIntegration(item: BatchItem): Promise<any> {
    const integration = await this.integrationService.getIntegration(item.integrationId);
    if (!integration) {
      throw new Error(`Integration ${item.integrationId} not found`);
    }

    // Run basic tests
    const testResults = [];
    for (const tool of integration.tools) {
      const result = await this.integrationService.executeTool(
        integration.id,
        tool.name,
        item.input || {}
      );
      testResults.push({ tool: tool.name, result });
    }

    return testResults;
  }

  private async deployIntegration(item: BatchItem): Promise<any> {
    // Deploy integration (implementation would depend on deployment target)
    return {
      deployed: true,
      integrationId: item.integrationId,
      timestamp: new Date(),
    };
  }

  private async updateIntegration(item: BatchItem): Promise<any> {
    // Update integration
    const updates = item.input || {};
    await this.integrationService.updateIntegration(item.integrationId, updates);
    return { updated: true, integrationId: item.integrationId };
  }

  private async validateIntegration(item: BatchItem): Promise<any> {
    const integration = await this.integrationService.getIntegration(item.integrationId);
    if (!integration) {
      throw new Error(`Integration ${item.integrationId} not found`);
    }

    // Validate integration
    const validationResults = {
      valid: true,
      issues: [] as string[],
    };

    // Check for required fields
    if (!integration.name) validationResults.issues.push('Missing name');
    if (!integration.description) validationResults.issues.push('Missing description');
    if (!integration.tools || integration.tools.length === 0) {
      validationResults.issues.push('No tools defined');
    }

    validationResults.valid = validationResults.issues.length === 0;
    return validationResults;
  }

  private async executeIntegrationTool(item: BatchItem): Promise<any> {
    if (!item.tool) {
      throw new Error('Tool name required for execute operation');
    }

    return await this.integrationService.executeTool(
      item.integrationId,
      item.tool,
      item.input || {}
    );
  }

  private async retryOperation(item: BatchItem, type: string): Promise<any> {
    switch (type) {
      case 'test':
        return await this.testIntegration(item);
      case 'deploy':
        return await this.deployIntegration(item);
      case 'update':
        return await this.updateIntegration(item);
      case 'validate':
        return await this.validateIntegration(item);
      case 'execute':
        return await this.executeIntegrationTool(item);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private updateProgress(operation: BatchOperation): void {
    const progress = operation.progress;
    const processed = progress.completed + progress.failed + progress.skipped;
    
    progress.percentage = (processed / progress.total) * 100;
    
    // Calculate throughput
    if (operation.startedAt) {
      const elapsedSeconds = (Date.now() - operation.startedAt.getTime()) / 1000;
      progress.throughput = processed / elapsedSeconds;
      
      // Estimate time remaining
      if (progress.throughput > 0) {
        const remaining = progress.total - processed;
        progress.estimatedTimeRemaining = remaining / progress.throughput;
      }
    }
  }

  async cancelBatchOperation(operationId: string): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    if (operation.status !== 'processing') {
      throw new Error(`Cannot cancel operation in ${operation.status} state`);
    }

    operation.status = 'cancelled';
    operation.completedAt = new Date();

    // Remove from queue if still pending
    const job = await this.batchQueue.getJob(operationId);
    if (job && ['waiting', 'delayed'].includes(await job.getState())) {
      await job.remove();
    }

    await this.createSnapshot(operation);
    this.emit('batch-cancelled', operation);
  }

  async rollbackOperation(operation: BatchOperation): Promise<void> {
    this.emit('batch-rollback-started', operation);

    try {
      // Get the last successful snapshot before the operation
      const snapshots = this.snapshots.get(operation.id) || [];
      const previousSnapshot = snapshots[snapshots.length - 2]; // -2 to get the one before current

      if (!previousSnapshot) {
        throw new Error('No previous snapshot available for rollback');
      }

      // Rollback each successful operation
      for (const result of operation.results) {
        if (result.status === 'success') {
          const item = operation.items.find(i => i.id === result.itemId);
          if (item) {
            try {
              await this.rollbackItem(item, operation.type, previousSnapshot);
            } catch (error: any) {
              this.logger.error(`Failed to rollback item ${item.id}:`, error);
            }
          }
        }
      }

      this.emit('batch-rollback-completed', operation);
    } catch (error: any) {
      this.emit('batch-rollback-failed', { operation, error });
      throw error;
    }
  }

  private async rollbackItem(item: BatchItem, type: string, snapshot: BatchSnapshot): Promise<void> {
    // Implement rollback logic based on operation type
    switch (type) {
      case 'deploy':
        // Undeploy the integration
        await this.undeployIntegration(item);
        break;
      case 'update':
        // Restore previous state from snapshot
        const previousState = snapshot.state[item.id];
        if (previousState) {
          await this.integrationService.updateIntegration(item.integrationId, previousState);
        }
        break;
      // Other types might not need rollback
    }
  }

  private async undeployIntegration(item: BatchItem): Promise<void> {
    // Implementation would depend on deployment mechanism
    this.logger.info(`Undeploying integration ${item.integrationId}`);
  }

  private async createSnapshot(operation: BatchOperation): Promise<void> {
    const snapshot: BatchSnapshot = {
      operationId: operation.id,
      timestamp: new Date(),
      state: {}, // Would capture current state of all affected integrations
      results: [...operation.results],
    };

    // Store current state of all integrations
    for (const item of operation.items) {
      try {
        const integration = await this.integrationService.getIntegration(item.integrationId);
        if (integration) {
          snapshot.state[item.id] = integration;
        }
      } catch (error: any) {
        this.logger.error(`Failed to snapshot integration ${item.integrationId}:`, error);
      }
    }

    const snapshots = this.snapshots.get(operation.id) || [];
    snapshots.push(snapshot);
    this.snapshots.set(operation.id, snapshots);
  }

  private estimateMemoryRequirement(items: BatchItem[]): number {
    // Estimate based on number of items and average item size
    const avgItemSize = 0.1; // MB per item (conservative estimate)
    const overhead = 50; // MB for framework overhead
    return items.length * avgItemSize + overhead;
  }

  private setupQueueHandlers(): void {
    this.batchQueue.process('process-batch', async (job: any) => {
      const { operationId } = job.data;
      await this.processBatchOperation(operationId);
    });

    this.batchQueue.on('completed', (job: any) => {
      this.logger.info(`Batch job ${job.id} completed`);
    });

    this.batchQueue.on('failed', (job: any, err: any) => {
      this.logger.error(`Batch job ${job.id} failed:`, err);
    });

    this.batchQueue.on('progress', (job: any, progress: any) => {
      this.emit('queue-progress', { jobId: job.id, progress });
    });
  }

  private startMemoryMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const rssMB = usage.rss / 1024 / 1024;

      if (heapUsedMB > 800) { // Warning at 800MB
        this.emit('memory-warning', {
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          rss: rssMB,
        });

        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  getBatchOperation(operationId: string): BatchOperation | undefined {
    return this.activeOperations.get(operationId);
  }

  getAllBatchOperations(): BatchOperation[] {
    return Array.from(this.activeOperations.values());
  }

  async getOperationResults(operationId: string): Promise<BatchResult[]> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }
    return operation.results;
  }

  async exportOperationReport(operationId: string): Promise<string> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const report = {
      operation: {
        id: operation.id,
        type: operation.type,
        status: operation.status,
        totalItems: operation.items.length,
        config: operation.config,
        progress: operation.progress,
        createdAt: operation.createdAt,
        startedAt: operation.startedAt,
        completedAt: operation.completedAt,
        duration: operation.completedAt && operation.startedAt
          ? operation.completedAt.getTime() - operation.startedAt.getTime()
          : null,
      },
      results: {
        successful: operation.results.filter(r => r.status === 'success').length,
        failed: operation.results.filter(r => r.status === 'failed').length,
        skipped: operation.results.filter(r => r.status === 'skipped').length,
        details: operation.results,
      },
      performance: {
        averageDuration: this.calculateAverageDuration(operation.results),
        throughput: operation.progress.throughput,
        peakMemoryUsage: 'N/A', // Would need to track this during execution
      },
      errors: operation.results
        .filter(r => r.status === 'failed')
        .map(r => ({ itemId: r.itemId, error: r.error })),
    };

    return JSON.stringify(report, null, 2);
  }

  private calculateAverageDuration(results: BatchResult[]): number {
    const durations = results.map(r => r.duration).filter(d => d > 0);
    return durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
  }

  async cleanup(): Promise<void> {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor as any);
      this.memoryMonitor = null;
    }

    await this.batchQueue.close();
    this.activeOperations.clear();
    this.snapshots.clear();
  }
}