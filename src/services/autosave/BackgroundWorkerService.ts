/**
 * @actor system
 * @responsibility Background worker processes for non-blocking backup operations
 */

import { Logger } from '@/src/lib/logging/Logger';
import { Worker } from 'worker_threads';
import * as os from 'os';

export interface WorkerTask {
  id: string;
  type: 'backup' | 'restore' | 'compress' | 'cleanup';
  priority: 'low' | 'medium' | 'high';
  data: any;
  timeout?: number;
  retries?: number;
  createdAt: Date;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  workerId: string;
}

export interface WorkerStatus {
  id: string;
  isActive: boolean;
  currentTask?: WorkerTask;
  tasksCompleted: number;
  tasksErrored: number;
  lastTaskTime?: Date;
  cpuUsage: number;
  memoryUsage: number;
}

export interface BackgroundWorkerConfig {
  maxWorkers: number;
  taskTimeout: number;
  maxRetries: number;
  queueMaxSize: number;
  enablePriorityQueue: boolean;
  cpuThrottling: boolean;
  memoryThreshold: number; // MB
}

export class BackgroundWorkerService {
  private readonly logger: Logger;
  private readonly config: BackgroundWorkerConfig;
  private workers: Map<string, Worker> = new Map();
  private taskQueue: WorkerTask[] = [];
  private activeTasks: Map<string, WorkerTask> = new Map();
  private workerStatus: Map<string, WorkerStatus> = new Map();
  private isRunning = false;
  private queueProcessor?: NodeJS.Timeout;
  private statusMonitor?: NodeJS.Timeout;

  constructor(logger: Logger, config?: Partial<BackgroundWorkerConfig>) {
    this.logger = logger;
    this.config = {
      maxWorkers: Math.max(1, os.cpus().length - 1), // Leave one CPU free
      taskTimeout: 300000, // 5 minutes
      maxRetries: 3,
      queueMaxSize: 1000,
      enablePriorityQueue: true,
      cpuThrottling: true,
      memoryThreshold: 500, // 500MB
      ...config
    };

    this.logger.info('BackgroundWorkerService initialized', {
      maxWorkers: this.config.maxWorkers,
      taskTimeout: this.config.taskTimeout
    });
  }

  /**
   * Start the background worker service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('BackgroundWorkerService already running');
      return;
    }

    this.isRunning = true;

    // Create initial workers
    for (let i = 0; i < this.config.maxWorkers; i++) {
      await this.createWorker();
    }

    // Start queue processor
    this.queueProcessor = setInterval(() => {
      this.processQueue();
    }, 1000);

    // Start status monitor
    this.statusMonitor = setInterval(() => {
      this.updateWorkerStatus();
    }, 5000);

    this.logger.info('BackgroundWorkerService started', {
      workerCount: this.workers.size
    });
  }

  /**
   * Stop the background worker service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear intervals
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }
    if (this.statusMonitor) {
      clearInterval(this.statusMonitor);
    }

    // Terminate all workers
    const terminationPromises: Promise<void>[] = [];
    
    for (const [workerId] of this.workers) {
      terminationPromises.push(this.terminateWorker(workerId));
    }

    await Promise.allSettled(terminationPromises);

    this.workers.clear();
    this.workerStatus.clear();
    this.activeTasks.clear();

    this.logger.info('BackgroundWorkerService stopped');
  }

  /**
   * Add task to queue
   */
  async queueTask(task: Omit<WorkerTask, 'id' | 'createdAt'>): Promise<string> {
    if (this.taskQueue.length >= this.config.queueMaxSize) {
      throw new Error('Task queue is full');
    }

    const fullTask: WorkerTask = {
      id: this.generateTaskId(),
      createdAt: new Date(),
      retries: this.config.maxRetries,
      timeout: this.config.taskTimeout,
      ...task
    };

    // Insert task based on priority if enabled
    if (this.config.enablePriorityQueue) {
      this.insertTaskByPriority(fullTask);
    } else {
      this.taskQueue.push(fullTask);
    }

    this.logger.debug('Task queued', {
      taskId: fullTask.id,
      type: fullTask.type,
      priority: fullTask.priority,
      queueSize: this.taskQueue.length
    });

    return fullTask.id;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): 'queued' | 'running' | 'completed' | 'failed' | 'not_found' {
    if (this.activeTasks.has(taskId)) {
      return 'running';
    }
    
    if (this.taskQueue.some(t => t.id === taskId)) {
      return 'queued';
    }

    // Would need to check completed/failed tasks from history
    return 'not_found';
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    // Remove from queue
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex >= 0) {
      this.taskQueue.splice(queueIndex, 1);
      this.logger.info('Task cancelled from queue', { taskId });
      return true;
    }

    // Cancel active task
    const activeTask = this.activeTasks.get(taskId);
    if (activeTask) {
      // Find worker handling this task
      for (const [workerId, status] of this.workerStatus) {
        if (status.currentTask?.id === taskId) {
          await this.terminateWorker(workerId);
          await this.createWorker(); // Replace terminated worker
          this.logger.info('Active task cancelled', { taskId, workerId });
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    queueSize: number;
    activeTasks: number;
    workerCount: number;
    totalTasksProcessed: number;
    totalErrors: number;
    averageTaskDuration: number;
    memoryUsage: number;
  } {
    const totalTasksProcessed = Array.from(this.workerStatus.values())
      .reduce((sum, status) => sum + status.tasksCompleted, 0);
    
    const totalErrors = Array.from(this.workerStatus.values())
      .reduce((sum, status) => sum + status.tasksErrored, 0);

    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    return {
      queueSize: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      workerCount: this.workers.size,
      totalTasksProcessed,
      totalErrors,
      averageTaskDuration: 0, // Would need to track this
      memoryUsage
    };
  }

  /**
   * Get worker status information
   */
  getWorkerStatus(): WorkerStatus[] {
    return Array.from(this.workerStatus.values());
  }

  /**
   * Create a new worker
   */
  private async createWorker(): Promise<string> {
    const workerId = this.generateWorkerId();
    
    // Create worker script inline
    
    const worker = new Worker(`
      const { parentPort } = require('worker_threads');
      
      parentPort.on('message', async (task) => {
        const startTime = Date.now();
        
        try {
          let result;
          
          switch (task.type) {
            case 'backup':
              result = await handleBackupTask(task.data);
              break;
            case 'restore':
              result = await handleRestoreTask(task.data);
              break;
            case 'compress':
              result = await handleCompressTask(task.data);
              break;
            case 'cleanup':
              result = await handleCleanupTask(task.data);
              break;
            default:
              throw new Error(\`Unknown task type: \${task.type}\`);
          }
          
          parentPort.postMessage({
            taskId: task.id,
            success: true,
            result,
            duration: Date.now() - startTime,
            workerId: '${workerId}'
          });
          
        } catch (error) {
          parentPort.postMessage({
            taskId: task.id,
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
            workerId: '${workerId}'
          });
        }
      });
      
      // Task handlers
      async function handleBackupTask(data) {
        // Simulate backup work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
        return { backupCreated: true, size: Math.floor(Math.random() * 1000000) };
      }
      
      async function handleRestoreTask(data) {
        // Simulate restore work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
        return { restored: true, sessionId: data.sessionId };
      }
      
      async function handleCompressTask(data) {
        // Simulate compression work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        return { compressed: true, ratio: Math.random() * 0.5 + 0.3 };
      }
      
      async function handleCleanupTask(data) {
        // Simulate cleanup work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
        return { cleaned: true, filesRemoved: Math.floor(Math.random() * 10) };
      }
    `, { eval: true });

    // Set up worker event handlers
    worker.on('message', (result: WorkerResult) => {
      this.handleWorkerResult(workerId, result);
    });

    worker.on('error', (error) => {
      this.logger.error('Worker error', error, { workerId });
      this.handleWorkerError(workerId, error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.logger.warn('Worker exited with error', { workerId, code });
      }
      this.handleWorkerExit(workerId);
    });

    this.workers.set(workerId, worker);
    this.workerStatus.set(workerId, {
      id: workerId,
      isActive: false,
      tasksCompleted: 0,
      tasksErrored: 0,
      cpuUsage: 0,
      memoryUsage: 0
    });

    this.logger.debug('Worker created', { workerId });
    return workerId;
  }

  /**
   * Terminate a worker
   */
  private async terminateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(workerId);
      this.workerStatus.delete(workerId);
      
      // Remove any active task for this worker
      const status = this.workerStatus.get(workerId);
      if (status?.currentTask) {
        this.activeTasks.delete(status.currentTask.id);
      }
      
      this.logger.debug('Worker terminated', { workerId });
    }
  }

  /**
   * Process task queue
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available workers
    const availableWorkers = Array.from(this.workerStatus.entries())
      .filter(([, status]) => !status.isActive)
      .map(([workerId]) => workerId);

    if (availableWorkers.length === 0) {
      return;
    }

    // Assign tasks to available workers
    const tasksToProcess = Math.min(availableWorkers.length, this.taskQueue.length);
    
    for (let i = 0; i < tasksToProcess; i++) {
      const task = this.taskQueue.shift();
      const workerId = availableWorkers[i];
      
      if (task && workerId) {
        await this.assignTaskToWorker(workerId, task);
      }
    }
  }

  /**
   * Assign task to worker
   */
  private async assignTaskToWorker(workerId: string, task: WorkerTask): Promise<void> {
    const worker = this.workers.get(workerId);
    const status = this.workerStatus.get(workerId);
    
    if (!worker || !status) {
      this.logger.error('Invalid worker assignment', new Error('Invalid worker assignment'), { workerId, taskId: task.id });
      return;
    }

    // Check memory threshold
    if (this.config.cpuThrottling && this.shouldThrottleTask()) {
      this.taskQueue.unshift(task); // Put task back at front of queue
      return;
    }

    status.isActive = true;
    status.currentTask = task;
    this.activeTasks.set(task.id, task);

    // Set task timeout
    setTimeout(() => {
      this.handleTaskTimeout(workerId, task.id);
    }, task.timeout || this.config.taskTimeout);

    worker.postMessage(task);

    this.logger.debug('Task assigned to worker', {
      workerId,
      taskId: task.id,
      type: task.type
    });
  }

  /**
   * Handle worker result
   */
  private handleWorkerResult(workerId: string, result: WorkerResult): void {
    const status = this.workerStatus.get(workerId);
    if (!status) {
      return;
    }

    if (result.success) {
      status.tasksCompleted++;
      this.logger.debug('Task completed successfully', {
        workerId,
        taskId: result.taskId,
        duration: result.duration
      });
    } else {
      status.tasksErrored++;
      this.logger.error('Task failed', new Error(result.error), {
        workerId,
        taskId: result.taskId
      });
      
      // Handle retry logic
      this.handleTaskRetry(result.taskId);
    }

    // Clean up task state
    status.isActive = false;
    status.currentTask = undefined;
    status.lastTaskTime = new Date();
    this.activeTasks.delete(result.taskId);
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(workerId: string, _error: Error): void {
    const status = this.workerStatus.get(workerId);
    if (status) {
      status.tasksErrored++;
      status.isActive = false;
      
      if (status.currentTask) {
        this.activeTasks.delete(status.currentTask.id);
        status.currentTask = undefined;
      }
    }

    // Restart worker
    this.restartWorker(workerId);
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(workerId: string): void {
    if (this.isRunning && this.workers.has(workerId)) {
      this.restartWorker(workerId);
    }
  }

  /**
   * Restart worker
   */
  private async restartWorker(workerId: string): Promise<void> {
    this.logger.info('Restarting worker', { workerId });
    
    await this.terminateWorker(workerId);
    await this.createWorker();
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(workerId: string, taskId: string): void {
    this.logger.warn('Task timed out', { workerId, taskId });
    
    const status = this.workerStatus.get(workerId);
    if (status && status.currentTask && status.currentTask.id === taskId) {
      this.restartWorker(workerId);
    }
  }

  /**
   * Handle task retry
   */
  private handleTaskRetry(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (task && task.retries && task.retries > 0) {
      task.retries--;
      this.taskQueue.unshift(task); // Add to front of queue for immediate retry
      
      this.logger.info('Task queued for retry', {
        taskId,
        retriesLeft: task.retries
      });
    }
  }

  /**
   * Check if should throttle task based on system resources
   */
  private shouldThrottleTask(): boolean {
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    return memoryUsage > this.config.memoryThreshold;
  }

  /**
   * Update worker status monitoring
   */
  private updateWorkerStatus(): void {
    for (const [, status] of this.workerStatus) {
      // Update CPU and memory usage (simplified)
      status.cpuUsage = Math.random() * 100; // Would use actual monitoring
      status.memoryUsage = Math.random() * 100; // Would use actual monitoring
    }
  }

  /**
   * Insert task by priority
   */
  private insertTaskByPriority(task: WorkerTask): void {
    const priorityValues = { high: 3, medium: 2, low: 1 };
    const taskPriority = priorityValues[task.priority];
    
    let insertIndex = this.taskQueue.length;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queueTask = this.taskQueue[i];
      if (queueTask) {
        const queueTaskPriority = priorityValues[queueTask.priority];
        if (taskPriority > queueTaskPriority) {
          insertIndex = i;
          break;
        }
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}