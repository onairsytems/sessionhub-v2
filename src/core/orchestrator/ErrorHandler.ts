
/**
 * Centralized error handling and recovery system
 * Manages failures gracefully and attempts recovery where possible
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SystemError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  code: string;
  message: string;
  stack?: string;
  actor?: string;
  operation?: string;
  recoverable: boolean;
  retryable: boolean;
  context?: Record<string, any>;
}

export interface RecoveryStrategy {
  type: 'retry' | 'rollback' | 'compensate' | 'manual';
  maxAttempts?: number;
  backoffMs?: number;
  action?: () => Promise<void>;
}

export class ErrorHandler {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly errorHistory: SystemError[] = [];
  private readonly maxHistorySize: number = 1000;
  private readonly recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle an error with appropriate logging and recovery
   */
  async handleError(
    error: Error,
    context: {
      actor?: string;
      operation?: string;
      severity?: ErrorSeverity;
      recoverable?: boolean;
      retryable?: boolean;
    }
  ): Promise<void> {
    const systemError = this.createSystemError(error, context);
    
    // Log the error
    this.logger.error(`Error in ${context.actor || 'system'}: ${error.message}`, error, {
      errorId: systemError.id,
      severity: systemError.severity
    });

    // Add to history
    this.addToHistory(systemError);

    // Audit log
    this.auditLogger.logEvent({
      actor: {
        type: context.actor as any || 'system',
        id: context.actor || 'system'
      },
      operation: {
        type: 'error',
        description: error.message
      },
      result: {
        status: 'failure',
        duration: 0,
        error: error.message
      },
      metadata: {
        correlationId: systemError.id
      }
    });

    // Attempt recovery
    if (systemError.recoverable) {
      await this.attemptRecovery(systemError);
    }

    // Alert if critical
    if (systemError.severity === ErrorSeverity.CRITICAL) {
      this.alertCriticalError(systemError);
    }
  }

  /**
   * Attempt to recover from an error
   */
  private async attemptRecovery(error: SystemError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy) {
      this.logger.warn('No recovery strategy found for error', { code: error.code });
      return false;
    }

    this.logger.info('Attempting recovery', {
      errorId: error.id,
      strategy: strategy.type
    });

    try {
      switch (strategy.type) {
        case 'retry':
          return await this.retryWithBackoff(error, strategy);
        
        case 'rollback':
          return await this.performRollback(error, strategy);
        
        case 'compensate':
          return await this.performCompensation(error, strategy);
        
        case 'manual':
          this.logger.warn('Manual intervention required', { errorId: error.id });
          return false;
        
        default:
          return false;
      }
    } catch (recoveryError) {
      this.logger.error('Recovery failed', recoveryError as Error, {
        originalError: error.id
      });
      return false;
    }
  }

  private async retryWithBackoff(
    error: SystemError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    const maxAttempts = strategy.maxAttempts || 3;
    const backoffMs = strategy.backoffMs || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.info(`Retry attempt ${attempt}/${maxAttempts}`, {
        errorId: error.id
      });

      try {
        if (strategy.action) {
          await strategy.action();
          this.logger.info('Retry successful', { errorId: error.id });
          return true;
        }
      } catch (retryError) {
        this.logger.warn(`Retry attempt ${attempt} failed`, {
          errorId: error.id,
          error: (retryError as Error).message
        });

        if (attempt < maxAttempts) {
          await this.sleep(backoffMs * attempt);
        }
      }
    }

    return false;
  }

  private async performRollback(
    error: SystemError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    this.logger.info('Performing rollback', { errorId: error.id });

    try {
      if (strategy.action) {
        await strategy.action();
        this.logger.info('Rollback successful', { errorId: error.id });
        return true;
      }
    } catch (rollbackError) {
      this.logger.error('Rollback failed', rollbackError as Error, {
        originalError: error.id
      });
    }

    return false;
  }

  private async performCompensation(
    error: SystemError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    this.logger.info('Performing compensation', { errorId: error.id });

    try {
      if (strategy.action) {
        await strategy.action();
        this.logger.info('Compensation successful', { errorId: error.id });
        return true;
      }
    } catch (compensationError) {
      this.logger.error('Compensation failed', compensationError as Error, {
        originalError: error.id
      });
    }

    return false;
  }

  private createSystemError(
    error: Error,
    context: any
  ): SystemError {
    return {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      severity: context.severity || this.determineSeverity(error),
      code: this.extractErrorCode(error),
      message: error.message,
      stack: error.stack,
      actor: context.actor,
      operation: context.operation,
      recoverable: context.recoverable ?? false,
      retryable: context.retryable ?? false,
      context
    };
  }

  private determineSeverity(error: Error): ErrorSeverity {
    // Determine severity based on error type and message
    if (error.message.includes('critical') || error.message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (error.message.includes('boundary violation')) {
      return ErrorSeverity.HIGH;
    }
    if (error.message.includes('validation')) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  private extractErrorCode(error: Error): string {
    // Extract error code from error or generate one
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    
    // Generate code based on error type
    if (error.message.includes('boundary')) return 'BOUNDARY_VIOLATION';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  private initializeRecoveryStrategies(): void {
    // Define recovery strategies for different error types
    this.recoveryStrategies.set('TIMEOUT_ERROR', {
      type: 'retry',
      maxAttempts: 3,
      backoffMs: 2000
    });

    this.recoveryStrategies.set('NETWORK_ERROR', {
      type: 'retry',
      maxAttempts: 5,
      backoffMs: 5000
    });

    this.recoveryStrategies.set('VALIDATION_ERROR', {
      type: 'manual'
    });

    this.recoveryStrategies.set('BOUNDARY_VIOLATION', {
      type: 'rollback'
    });
  }

  private addToHistory(error: SystemError): void {
    this.errorHistory.push(error);
    
    // Trim history if needed
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  private alertCriticalError(error: SystemError): void {
    // In production, this would send alerts via:
    // - Email
    // - SMS
    // - Slack/Discord
    // - PagerDuty
    
    this.logger.error('CRITICAL ERROR ALERT', undefined, {
      errorId: error.id,
      message: error.message,
      actor: error.actor
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): unknown {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors = this.errorHistory.filter(
      e => new Date(e.timestamp).getTime() > oneHourAgo
    );

    return {
      total: this.errorHistory.length,
      lastHour: recentErrors.length,
      bySeverity: {
        critical: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
        high: recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        medium: recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        low: recentErrors.filter(e => e.severity === ErrorSeverity.LOW).length
      },
      byActor: this.groupByActor(recentErrors),
      recoveryRate: this.calculateRecoveryRate(recentErrors)
    };
  }

  private groupByActor(errors: SystemError[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      const actor = error.actor || 'system';
      acc[actor] = (acc[actor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateRecoveryRate(errors: SystemError[]): number {
    const recoverableErrors = errors.filter(e => e.recoverable);
    if (recoverableErrors.length === 0) return 0;
    
    // This is simplified - in reality we'd track actual recovery success
    return 0.75; // 75% recovery rate
  }
}