/**
 * @actor system
 * @responsibility Session error recovery and fault tolerance
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { SessionPersistenceService, SessionCheckpoint } from './SessionPersistenceService';
import { Session } from '@/src/core/orchestrator/SessionManager';

export interface RecoveryStrategy {
  type: 'retry' | 'rollback' | 'skip' | 'manual';
  maxAttempts?: number;
  backoffMs?: number;
  checkpointId?: string;
}

export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  attemptCount: number;
  recovered?: boolean;
  error?: string;
  newState?: any;
}

export interface ErrorContext {
  sessionId: string;
  phase: string;
  error: Error;
  timestamp: string;
  retryCount: number;
  lastCheckpoint?: SessionCheckpoint;
}

export class SessionRecoveryService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly persistence: SessionPersistenceService;
  private readonly errorHistory: Map<string, ErrorContext[]> = new Map();
  private readonly recoveryAttempts: Map<string, number> = new Map();
  private readonly maxRetryAttempts = 3;
  private readonly baseBackoffMs = 1000;

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    persistence: SessionPersistenceService
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.persistence = persistence;
  }

  /**
   * Handle session error with recovery
   */
  async handleError(
    session: Session,
    error: Error,
    phase: string
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    const errorContext: ErrorContext = {
      sessionId: session.id,
      phase,
      error,
      timestamp: new Date().toISOString(),
      retryCount: this.getRetryCount(session.id)
    };

    // Add to error history
    this.addErrorToHistory(session.id, errorContext);

    // Determine recovery strategy
    const strategy = await this.determineRecoveryStrategy(errorContext);

    this.logger.info('Attempting error recovery', {
      sessionId: session.id,
      phase,
      strategy: strategy.type,
      error: error.message
    });

    // Execute recovery strategy
    const result = await this.executeRecoveryStrategy(session, errorContext, strategy);
    
    const endTime = Date.now();

    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'SessionRecoveryService' },
      operation: {
        type: 'session.recover',
        description: 'Attempted session error recovery',
        input: { sessionId: session.id, phase, strategy },
        output: result
      },
      result: {
        status: result.success ? 'success' : 'failure',
        duration: endTime - startTime
      },
      metadata: { correlationId: this.generateCorrelationId() }
    });

    return result;
  }

  /**
   * Determine recovery strategy based on error context
   */
  private async determineRecoveryStrategy(
    context: ErrorContext
  ): Promise<RecoveryStrategy> {
    // Check if we've exceeded retry limit
    if (context.retryCount >= this.maxRetryAttempts) {
      return { type: 'manual' };
    }

    // Get available checkpoints
    const checkpoints = await this.persistence.getCheckpoints(context.sessionId);
    const hasCheckpoints = checkpoints.length > 0;

    // Analyze error type
    const errorType = this.classifyError(context.error);

    switch (errorType) {
      case 'network':
        // Network errors: retry with exponential backoff
        return {
          type: 'retry',
          maxAttempts: 3,
          backoffMs: this.calculateBackoff(context.retryCount)
        };

      case 'validation':
        // Validation errors: rollback to last checkpoint if available
        if (hasCheckpoints) {
          return {
            type: 'rollback',
            checkpointId: checkpoints[0]!.id
          };
        }
        return { type: 'skip' };

      case 'execution':
        // Execution errors: retry with smaller batch or different parameters
        return {
          type: 'retry',
          maxAttempts: 2,
          backoffMs: this.baseBackoffMs
        };

      case 'fatal':
        // Fatal errors: require manual intervention
        return { type: 'manual' };

      default:
        // Unknown errors: attempt retry once
        return {
          type: 'retry',
          maxAttempts: 1,
          backoffMs: this.baseBackoffMs
        };
    }
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(
    session: Session,
    context: ErrorContext,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult> {
    const attemptCount = this.incrementRetryCount(session.id);

    try {
      switch (strategy.type) {
        case 'retry':
          return await this.executeRetryStrategy(session, context, strategy);

        case 'rollback':
          return await this.executeRollbackStrategy(session, context, strategy);

        case 'skip':
          return await this.executeSkipStrategy(session, context);

        case 'manual':
          return this.executeManualStrategy(session, context);

        default:
          throw new Error(`Unknown recovery strategy: ${strategy.type}`);
      }
    } catch (error) {
      this.logger.error('Recovery strategy failed', error as Error, {
        sessionId: session.id,
        strategy: strategy.type
      });

      return {
        success: false,
        strategy,
        attemptCount,
        recovered: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Execute retry strategy
   */
  private async executeRetryStrategy(
    session: Session,
    context: ErrorContext,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult> {
    const maxAttempts = strategy.maxAttempts || 1;
    const backoffMs = strategy.backoffMs || this.baseBackoffMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.info('Retrying operation', {
        sessionId: session.id,
        phase: context.phase,
        attempt,
        maxAttempts
      });

      // Wait before retry
      await this.delay(backoffMs * attempt);

      // Create checkpoint before retry
      await this.persistence.createCheckpoint(
        session.id,
        `${context.phase}_retry_${attempt}`,
        session,
        true
      );

      // Attempt retry (this would be implemented based on phase)
      const retrySuccess = await this.retryOperation(session, context.phase);

      if (retrySuccess) {
        return {
          success: true,
          strategy,
          attemptCount: attempt,
          recovered: true
        };
      }
    }

    return {
      success: false,
      strategy,
      attemptCount: maxAttempts,
      recovered: false,
      error: 'Max retry attempts exceeded'
    };
  }

  /**
   * Execute rollback strategy
   */
  private async executeRollbackStrategy(
    session: Session,
    _context: ErrorContext,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult> {
    if (!strategy.checkpointId) {
      // Get the most recent checkpoint
      const checkpoints = await this.persistence.getCheckpoints(session.id);
      if (checkpoints.length === 0) {
        return {
          success: false,
          strategy,
          attemptCount: 1,
          recovered: false,
          error: 'No checkpoints available for rollback'
        };
      }
      strategy.checkpointId = checkpoints[0]!.id;
    }

    const checkpoint = await this.persistence.restoreFromCheckpoint(strategy.checkpointId);
    
    if (!checkpoint) {
      return {
        success: false,
        strategy,
        attemptCount: 1,
        recovered: false,
        error: 'Failed to restore from checkpoint'
      };
    }

    this.logger.info('Rolled back to checkpoint', {
      sessionId: session.id,
      checkpointId: checkpoint.id,
      phase: checkpoint.phase
    });

    return {
      success: true,
      strategy,
      attemptCount: 1,
      recovered: true,
      newState: checkpoint.state
    };
  }

  /**
   * Execute skip strategy
   */
  private async executeSkipStrategy(
    session: Session,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    this.logger.info('Skipping failed operation', {
      sessionId: session.id,
      phase: context.phase
    });

    // Create checkpoint marking the skip
    await this.persistence.createCheckpoint(
      session.id,
      `${context.phase}_skipped`,
      { ...session, skippedPhase: context.phase },
      true
    );

    return {
      success: true,
      strategy: { type: 'skip' },
      attemptCount: 1,
      recovered: false
    };
  }

  /**
   * Execute manual strategy
   */
  private executeManualStrategy(
    session: Session,
    context: ErrorContext
  ): RecoveryResult {
    this.logger.warn('Manual intervention required', {
      sessionId: session.id,
      phase: context.phase,
      error: context.error.message
    });

    return {
      success: false,
      strategy: { type: 'manual' },
      attemptCount: 0,
      recovered: false,
      error: 'Manual intervention required'
    };
  }

  /**
   * Retry operation (phase-specific implementation)
   */
  private async retryOperation(
    _session: Session,
    _phase: string
  ): Promise<boolean> {
    // This would be implemented with actual retry logic for each phase
    // For now, returning a mock success/failure
    await this.delay(500);
    return Math.random() > 0.5;
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'network';
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('constraint')) {
      return 'validation';
    }
    
    if (message.includes('execution') || message.includes('runtime') || message.includes('process')) {
      return 'execution';
    }
    
    if (message.includes('fatal') || message.includes('crash') || message.includes('out of memory')) {
      return 'fatal';
    }

    return 'unknown';
  }

  /**
   * Add error to history
   */
  private addErrorToHistory(sessionId: string, context: ErrorContext): void {
    if (!this.errorHistory.has(sessionId)) {
      this.errorHistory.set(sessionId, []);
    }
    
    const history = this.errorHistory.get(sessionId)!;
    history.push(context);
    
    // Keep only last 100 errors per session
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get retry count for session
   */
  private getRetryCount(sessionId: string): number {
    return this.recoveryAttempts.get(sessionId) || 0;
  }

  /**
   * Increment retry count
   */
  private incrementRetryCount(sessionId: string): number {
    const current = this.getRetryCount(sessionId);
    const newCount = current + 1;
    this.recoveryAttempts.set(sessionId, newCount);
    return newCount;
  }

  /**
   * Reset retry count
   */
  resetRetryCount(sessionId: string): void {
    this.recoveryAttempts.delete(sessionId);
  }

  /**
   * Calculate exponential backoff
   */
  private calculateBackoff(retryCount: number): number {
    return Math.min(
      this.baseBackoffMs * Math.pow(2, retryCount),
      30000 // Max 30 seconds
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error history for session
   */
  getErrorHistory(sessionId: string): ErrorContext[] {
    return this.errorHistory.get(sessionId) || [];
  }

  /**
   * Clear error history
   */
  clearErrorHistory(sessionId: string): void {
    this.errorHistory.delete(sessionId);
    this.recoveryAttempts.delete(sessionId);
  }

  /**
   * Get recovery statistics
   */
  getStatistics(): any {
    const stats = {
      totalSessions: this.errorHistory.size,
      totalErrors: 0,
      totalRecoveryAttempts: 0,
      errorTypes: {} as Record<string, number>,
      recoveryStrategies: {} as Record<string, number>
    };

    for (const [sessionId, history] of this.errorHistory) {
      stats.totalErrors += history.length;
      stats.totalRecoveryAttempts += this.getRetryCount(sessionId);
      
      for (const context of history) {
        const errorType = this.classifyError(context.error);
        stats.errorTypes[errorType] = (stats.errorTypes[errorType] || 0) + 1;
      }
    }

    return stats;
  }
}