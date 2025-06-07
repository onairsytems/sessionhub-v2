/**
 * @actor system
 * @responsibility Manages instruction queue and real-time monitoring
 */

import { InstructionProtocol, ExecutionResult } from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';
import { EventEmitter } from 'events';

export interface QueuedInstruction {
  id: string;
  sessionId: string;
  instruction: InstructionProtocol;
  status: 'pending' | 'planning' | 'executing' | 'completed' | 'failed';
  priority: number;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ExecutionResult;
  error?: Error;
  retryCount: number;
  maxRetries: number;
}

export interface QueueMetrics {
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number;
}

export interface InstructionEvent {
  type: 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'retrying';
  instructionId: string;
  sessionId: string;
  timestamp: string;
  data?: any;
}

export class InstructionQueue extends EventEmitter {
  private readonly logger: Logger;
  private readonly queue: Map<string, QueuedInstruction> = new Map();
  private readonly completed: Map<string, QueuedInstruction> = new Map();
  private readonly maxQueueSize: number;
  private readonly maxCompletedHistory: number;
  
  constructor(logger: Logger, maxQueueSize = 100, maxCompletedHistory = 1000) {
    super();
    this.logger = logger;
    this.maxQueueSize = maxQueueSize;
    this.maxCompletedHistory = maxCompletedHistory;
  }

  /**
   * Add instruction to queue
   */
  async enqueue(
    instruction: InstructionProtocol,
    priority = 5,
    maxRetries = 3
  ): Promise<string> {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const queuedInstruction: QueuedInstruction = {
      id: instruction.metadata.id,
      sessionId: instruction.metadata.sessionId,
      instruction,
      status: 'pending',
      priority,
      addedAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries
    };

    this.queue.set(queuedInstruction.id, queuedInstruction);

    // Emit queued event
    this.emitEvent({
      type: 'queued',
      instructionId: queuedInstruction.id,
      sessionId: queuedInstruction.sessionId,
      timestamp: queuedInstruction.addedAt,
      data: { priority }
    });

    this.logger.info('Instruction queued', {
      instructionId: queuedInstruction.id,
      sessionId: queuedInstruction.sessionId,
      priority
    });

    return queuedInstruction.id;
  }

  /**
   * Get next instruction from queue
   */
  async dequeue(): Promise<QueuedInstruction | null> {
    const pending = Array.from(this.queue.values())
      .filter(i => i.status === 'pending')
      .sort((a, b) => {
        // Sort by priority first, then by time
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.addedAt.localeCompare(b.addedAt); // Earlier first
      });

    const next = pending[0];
    if (!next) {
      return null;
    }

    // Update status
    next.status = 'planning';
    next.startedAt = new Date().toISOString();

    // Emit started event
    this.emitEvent({
      type: 'started',
      instructionId: next.id,
      sessionId: next.sessionId,
      timestamp: next.startedAt
    });

    return next;
  }

  /**
   * Update instruction status
   */
  updateStatus(
    instructionId: string,
    status: QueuedInstruction['status'],
    result?: ExecutionResult,
    error?: Error
  ): void {
    const instruction = this.queue.get(instructionId);
    if (!instruction) {
      this.logger.warn('Instruction not found in queue', { instructionId });
      return;
    }

    instruction.status = status;

    if (status === 'completed' || status === 'failed') {
      instruction.completedAt = new Date().toISOString();
      instruction.result = result;
      instruction.error = error;

      // Move to completed history
      this.completed.set(instructionId, instruction);
      this.queue.delete(instructionId);

      // Maintain history size
      if (this.completed.size > this.maxCompletedHistory) {
        const oldestKey = this.completed.keys().next().value;
        this.completed.delete(oldestKey);
      }

      // Emit completed/failed event
      this.emitEvent({
        type: status === 'completed' ? 'completed' : 'failed',
        instructionId: instruction.id,
        sessionId: instruction.sessionId,
        timestamp: instruction.completedAt,
        data: status === 'completed' ? result : { error: error?.message }
      });
    } else {
      // Emit progress event
      this.emitEvent({
        type: 'progress',
        instructionId: instruction.id,
        sessionId: instruction.sessionId,
        timestamp: new Date().toISOString(),
        data: { status }
      });
    }

    this.logger.info('Instruction status updated', {
      instructionId,
      status,
      hasResult: !!result,
      hasError: !!error
    });
  }

  /**
   * Retry failed instruction
   */
  async retry(instructionId: string): Promise<boolean> {
    const completed = this.completed.get(instructionId);
    if (!completed || completed.status !== 'failed') {
      return false;
    }

    if (completed.retryCount >= completed.maxRetries) {
      this.logger.warn('Max retries exceeded', {
        instructionId,
        retryCount: completed.retryCount
      });
      return false;
    }

    // Move back to queue
    completed.status = 'pending';
    completed.retryCount++;
    completed.error = undefined;
    completed.result = undefined;
    completed.completedAt = undefined;

    this.queue.set(instructionId, completed);
    this.completed.delete(instructionId);

    // Emit retrying event
    this.emitEvent({
      type: 'retrying',
      instructionId: completed.id,
      sessionId: completed.sessionId,
      timestamp: new Date().toISOString(),
      data: { retryCount: completed.retryCount }
    });

    return true;
  }

  /**
   * Get queue metrics
   */
  getMetrics(): QueueMetrics {
    const now = Date.now();
    const allInstructions = [
      ...Array.from(this.queue.values()),
      ...Array.from(this.completed.values())
    ];

    const pending = allInstructions.filter(i => i.status === 'pending');
    const active = allInstructions.filter(i => 
      i.status === 'planning' || i.status === 'executing'
    );
    const completed = allInstructions.filter(i => i.status === 'completed');
    const failed = allInstructions.filter(i => i.status === 'failed');

    // Calculate average wait time (time from added to started)
    const waitTimes = allInstructions
      .filter(i => i.startedAt)
      .map(i => new Date(i.startedAt!).getTime() - new Date(i.addedAt).getTime());
    
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

    // Calculate average execution time (time from started to completed)
    const executionTimes = allInstructions
      .filter(i => i.startedAt && i.completedAt)
      .map(i => new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime());
    
    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

    // Calculate throughput (completed per hour in last hour)
    const oneHourAgo = now - 3600000;
    const completedLastHour = completed.filter(i => 
      new Date(i.completedAt!).getTime() > oneHourAgo
    ).length;

    return {
      pendingCount: pending.length,
      activeCount: active.length,
      completedCount: completed.length,
      failedCount: failed.length,
      averageWaitTime,
      averageExecutionTime,
      throughput: completedLastHour
    };
  }

  /**
   * Get instruction by ID
   */
  getInstruction(instructionId: string): QueuedInstruction | undefined {
    return this.queue.get(instructionId) || this.completed.get(instructionId);
  }

  /**
   * Get instructions by session
   */
  getSessionInstructions(sessionId: string): QueuedInstruction[] {
    const all = [
      ...Array.from(this.queue.values()),
      ...Array.from(this.completed.values())
    ];
    
    return all.filter(i => i.sessionId === sessionId)
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  }

  /**
   * Clear completed history
   */
  clearHistory(): void {
    this.completed.clear();
    this.logger.info('Completed history cleared');
  }

  /**
   * Get real-time event stream
   */
  getEventStream(): AsyncIterableIterator<InstructionEvent> {
    const events: InstructionEvent[] = [];
    let resolve: ((value: IteratorResult<InstructionEvent>) => void) | null = null;

    const listener = (event: InstructionEvent) => {
      if (resolve) {
        resolve({ value: event, done: false });
        resolve = null;
      } else {
        events.push(event);
      }
    };

    this.on('instruction-event', listener);

    return {
      async next(): Promise<IteratorResult<InstructionEvent>> {
        if (events.length > 0) {
          return { value: events.shift()!, done: false };
        }

        return new Promise<IteratorResult<InstructionEvent>>(res => {
          resolve = res;
        });
      },

      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }

  private emitEvent(event: InstructionEvent): void {
    this.emit('instruction-event', event);
  }
}