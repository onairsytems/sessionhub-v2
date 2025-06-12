/**
 * @actor system
 * @responsibility Progress indicators for backup operations
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';

export interface ProgressEvent {
  id: string;
  operation: string;
  phase: string;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: any;
}

export interface ProgressOptions {
  showInUI: boolean;
  priority: 'low' | 'normal' | 'high';
  category: 'backup' | 'restore' | 'cleanup' | 'rotation';
  estimatedDuration?: number;
  canCancel?: boolean;
}

export class ProgressIndicatorService extends EventEmitter {
  private readonly logger: Logger;
  private activeOperations: Map<string, ProgressEvent> = new Map();
  private completedOperations: ProgressEvent[] = [];
  private maxHistorySize = 100;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Start tracking progress for an operation
   */
  startProgress(
    operation: string,
    options: ProgressOptions = {
      showInUI: true,
      priority: 'normal',
      category: 'backup'
    }
  ): string {
    const id = this.generateProgressId();
    const progressEvent: ProgressEvent = {
      id,
      operation,
      phase: 'initializing',
      progress: 0,
      status: 'pending',
      startTime: new Date(),
      metadata: {
        ...options,
        estimatedDuration: options.estimatedDuration
      }
    };

    this.activeOperations.set(id, progressEvent);

    this.logger.debug('Progress tracking started', {
      id,
      operation,
      options
    });

    this.emit('progress:start', progressEvent);
    return id;
  }

  /**
   * Update progress for an operation
   */
  updateProgress(
    id: string,
    progress: number,
    phase?: string,
    message?: string
  ): void {
    const operation = this.activeOperations.get(id);
    if (!operation) {
      this.logger.warn('Attempted to update non-existent progress', { id });
      return;
    }

    operation.progress = Math.max(0, Math.min(100, progress));
    operation.status = 'running';
    
    if (phase) operation.phase = phase;
    if (message) operation.message = message;

    this.logger.debug('Progress updated', {
      id,
      progress: operation.progress,
      phase: operation.phase,
      message
    });

    this.emit('progress:update', operation);
  }

  /**
   * Mark operation as completed
   */
  completeProgress(id: string, message?: string): void {
    const operation = this.activeOperations.get(id);
    if (!operation) {
      this.logger.warn('Attempted to complete non-existent progress', { id });
      return;
    }

    operation.status = 'completed';
    operation.progress = 100;
    operation.endTime = new Date();
    operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
    
    if (message) operation.message = message;

    this.activeOperations.delete(id);
    this.addToHistory(operation);

    this.logger.debug('Progress completed', {
      id,
      duration: operation.duration,
      message
    });

    this.emit('progress:complete', operation);
  }

  /**
   * Mark operation as failed
   */
  failProgress(id: string, error: string): void {
    const operation = this.activeOperations.get(id);
    if (!operation) {
      this.logger.warn('Attempted to fail non-existent progress', { id });
      return;
    }

    operation.status = 'failed';
    operation.endTime = new Date();
    operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
    operation.message = error;

    this.activeOperations.delete(id);
    this.addToHistory(operation);

    this.logger.error('Progress failed', new Error(error), { id, duration: operation.duration });

    this.emit('progress:fail', operation);
  }

  /**
   * Cancel operation
   */
  cancelProgress(id: string, reason?: string): void {
    const operation = this.activeOperations.get(id);
    if (!operation) {
      this.logger.warn('Attempted to cancel non-existent progress', { id });
      return;
    }

    operation.status = 'cancelled';
    operation.endTime = new Date();
    operation.duration = operation.endTime.getTime() - operation.startTime.getTime();
    operation.message = reason || 'Operation cancelled';

    this.activeOperations.delete(id);
    this.addToHistory(operation);

    this.logger.info('Progress cancelled', { id, reason, duration: operation.duration });

    this.emit('progress:cancel', operation);
  }

  /**
   * Get active operations
   */
  getActiveOperations(): ProgressEvent[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get operation by ID
   */
  getOperation(id: string): ProgressEvent | null {
    return this.activeOperations.get(id) || 
           this.completedOperations.find(op => op.id === id) || 
           null;
  }

  /**
   * Get operations by category
   */
  getOperationsByCategory(category: string): ProgressEvent[] {
    const active = Array.from(this.activeOperations.values())
      .filter(op => op.metadata?.category === category);
    
    const completed = this.completedOperations
      .filter(op => op.metadata?.category === category);

    return [...active, ...completed];
  }

  /**
   * Get completed operations
   */
  getCompletedOperations(limit = 50): ProgressEvent[] {
    return this.completedOperations.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    activeCount: number;
    completedCount: number;
    failedCount: number;
    cancelledCount: number;
    averageDuration: number;
    byCategory: Record<string, number>;
  } {
    const completed = this.completedOperations;
    
    const stats = {
      activeCount: this.activeOperations.size,
      completedCount: completed.filter(op => op.status === 'completed').length,
      failedCount: completed.filter(op => op.status === 'failed').length,
      cancelledCount: completed.filter(op => op.status === 'cancelled').length,
      averageDuration: 0,
      byCategory: {} as Record<string, number>
    };

    // Calculate average duration
    const completedWithDuration = completed.filter(op => op.duration);
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, op) => sum + (op.duration || 0), 0);
      stats.averageDuration = totalDuration / completedWithDuration.length;
    }

    // Count by category
    const allOperations = [...Array.from(this.activeOperations.values()), ...completed];
    for (const operation of allOperations) {
      const category = operation.metadata?.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear completed operations history
   */
  clearHistory(): void {
    const count = this.completedOperations.length;
    this.completedOperations = [];
    
    this.logger.info('Progress history cleared', { count });
    this.emit('progress:history_cleared', { count });
  }

  /**
   * Auto-increment progress for long-running operations
   */
  createAutoIncrementProgress(
    operation: string,
    totalSteps: number,
    options?: ProgressOptions
  ): {
    id: string;
    increment: () => void;
    setStep: (step: number) => void;
    complete: (message?: string) => void;
    fail: (error: string) => void;
  } {
    const id = this.startProgress(operation, options);
    let currentStep = 0;

    return {
      id,
      increment: () => {
        currentStep = Math.min(currentStep + 1, totalSteps);
        const progress = (currentStep / totalSteps) * 100;
        this.updateProgress(id, progress, `Step ${currentStep} of ${totalSteps}`);
      },
      setStep: (step: number) => {
        currentStep = Math.max(0, Math.min(step, totalSteps));
        const progress = (currentStep / totalSteps) * 100;
        this.updateProgress(id, progress, `Step ${currentStep} of ${totalSteps}`);
      },
      complete: (message?: string) => {
        this.completeProgress(id, message);
      },
      fail: (error: string) => {
        this.failProgress(id, error);
      }
    };
  }

  /**
   * Create timed progress indicator
   */
  createTimedProgress(
    operation: string,
    durationMs: number,
    options?: ProgressOptions
  ): {
    id: string;
    cancel: () => void;
  } {
    const id = this.startProgress(operation, {
      showInUI: true,
      priority: 'normal',
      category: 'backup',
      ...options,
      estimatedDuration: durationMs
    });

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / durationMs) * 100, 99);
      
      this.updateProgress(id, progress, 'In progress...');
      
      if (elapsed >= durationMs) {
        clearInterval(interval);
        this.completeProgress(id);
      }
    }, 100);

    return {
      id,
      cancel: () => {
        clearInterval(interval);
        this.cancelProgress(id, 'Timer cancelled');
      }
    };
  }

  /**
   * Monitor file operation progress
   */
  monitorFileOperation(
    operation: string,
    totalFiles: number,
    options?: ProgressOptions
  ): {
    id: string;
    fileProcessed: (filename?: string) => void;
    complete: (message?: string) => void;
    fail: (error: string) => void;
  } {
    const id = this.startProgress(operation, options);
    let processedFiles = 0;

    return {
      id,
      fileProcessed: (filename?: string) => {
        processedFiles++;
        const progress = (processedFiles / totalFiles) * 100;
        const message = filename 
          ? `Processing ${filename} (${processedFiles}/${totalFiles})`
          : `Processed ${processedFiles} of ${totalFiles} files`;
        
        this.updateProgress(id, progress, 'Processing files', message);
      },
      complete: (message?: string) => {
        this.completeProgress(id, message || `Processed ${processedFiles} files`);
      },
      fail: (error: string) => {
        this.failProgress(id, error);
      }
    };
  }

  /**
   * Monitor backup operation with multiple phases
   */
  monitorBackupOperation(
    sessionId: string,
    phases: string[],
    options?: ProgressOptions
  ): {
    id: string;
    nextPhase: (message?: string) => void;
    updatePhaseProgress: (progress: number, message?: string) => void;
    complete: (message?: string) => void;
    fail: (error: string) => void;
  } {
    const id = this.startProgress(`Backup: ${sessionId}`, {
      showInUI: true,
      priority: 'normal',
      category: 'backup',
      ...options
    });
    
    let currentPhaseIndex = 0;
    let phaseProgress = 0;

    const updateOverallProgress = () => {
      const phaseWeight = 100 / phases.length;
      const overall = (currentPhaseIndex * phaseWeight) + (phaseProgress * phaseWeight / 100);
      
      const currentPhase = phases[currentPhaseIndex];
      this.updateProgress(id, overall, currentPhase);
    };

    return {
      id,
      nextPhase: (message?: string) => {
        if (currentPhaseIndex < phases.length - 1) {
          currentPhaseIndex++;
          phaseProgress = 0;
          updateOverallProgress();
          
          if (message) {
            const operation = this.activeOperations.get(id);
            if (operation) operation.message = message;
          }
        }
      },
      updatePhaseProgress: (progress: number, message?: string) => {
        phaseProgress = Math.max(0, Math.min(100, progress));
        updateOverallProgress();
        
        if (message) {
          const operation = this.activeOperations.get(id);
          if (operation) operation.message = message;
        }
      },
      complete: (message?: string) => {
        this.completeProgress(id, message);
      },
      fail: (error: string) => {
        this.failProgress(id, error);
      }
    };
  }

  /**
   * Add operation to history
   */
  private addToHistory(operation: ProgressEvent): void {
    this.completedOperations.unshift(operation);
    
    // Trim history if too large
    if (this.completedOperations.length > this.maxHistorySize) {
      this.completedOperations = this.completedOperations.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Generate unique progress ID
   */
  private generateProgressId(): string {
    return `prog_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(10, size);
    
    if (this.completedOperations.length > this.maxHistorySize) {
      this.completedOperations = this.completedOperations.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get operations that can be cancelled
   */
  getCancellableOperations(): ProgressEvent[] {
    return Array.from(this.activeOperations.values())
      .filter(op => op.metadata?.canCancel !== false);
  }

  /**
   * Cleanup stale operations (running for too long)
   */
  cleanupStaleOperations(maxAgeMs = 30 * 60 * 1000): number { // 30 minutes default
    const now = Date.now();
    let cleaned = 0;

    for (const [id, operation] of this.activeOperations) {
      const age = now - operation.startTime.getTime();
      if (age > maxAgeMs) {
        this.failProgress(id, 'Operation timed out');
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info('Cleaned up stale progress operations', { count: cleaned });
    }

    return cleaned;
  }
}