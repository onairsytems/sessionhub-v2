/**
 * Enhanced Error Handler with Intelligent Retry System
 * Implements exponential backoff, circuit breaker pattern, and failure prediction
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RetryStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIBONACCI = 'fibonacci',
  CUSTOM = 'custom'
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
  retryCount?: number;
  lastRetryTimestamp?: string;
}

export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  multiplier?: number;
  customDelayFn?: (attempt: number) => number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeMs: number;
  halfOpenRequests: number;
}

export interface RecoveryStrategy {
  type: 'retry' | 'rollback' | 'compensate' | 'manual' | 'circuit-breaker';
  retryConfig?: RetryConfig;
  circuitBreakerConfig?: CircuitBreakerConfig;
  action?: () => Promise<void>;
  onRetryAttempt?: (attempt: number, delay: number) => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailure?: (finalError: Error) => void;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

interface RetryMetrics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryTime: number;
  retryDistribution: Record<string, number>;
}

export class EnhancedErrorHandler {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly errorHistory: SystemError[] = [];
  private readonly maxHistorySize: number = 10000;
  private readonly recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private readonly circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly retryMetrics: Map<string, RetryMetrics> = new Map();
  private readonly errorPatterns: Map<string, number[]> = new Map();

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.initializeRecoveryStrategies();
  }

  /**
   * Handle an error with intelligent retry and recovery
   */
  async handleError(
    error: Error,
    context: {
      actor?: string;
      operation?: string;
      severity?: ErrorSeverity;
      recoverable?: boolean;
      retryable?: boolean;
      retryConfig?: RetryConfig;
    }
  ): Promise<void> {
    const systemError = this.createSystemError(error, context);
    
    // Log the error
    this.logger.error(`Error in ${context.actor || 'system'}: ${error.message}`, error, {
      errorId: systemError.id,
      severity: systemError.severity
    });

    // Add to history and patterns
    this.addToHistory(systemError);
    this.updateErrorPatterns(systemError);

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

    // Check circuit breaker
    if (this.isCircuitOpen(systemError.code)) {
      this.logger.warn('Circuit breaker is open, skipping recovery', {
        errorCode: systemError.code
      });
      return;
    }

    // Attempt recovery
    if (systemError.recoverable) {
      const recovered = await this.attemptRecovery(systemError, context.retryConfig);
      if (recovered) {
        this.updateCircuitBreakerSuccess(systemError.code);
      } else {
        this.updateCircuitBreakerFailure(systemError.code);
      }
    }

    // Alert if critical
    if (systemError.severity === ErrorSeverity.CRITICAL) {
      this.alertCriticalError(systemError);
    }
  }

  /**
   * Attempt to recover from an error with intelligent retry
   */
  private async attemptRecovery(
    error: SystemError, 
    customRetryConfig?: RetryConfig
  ): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.code);
    
    if (!strategy) {
      this.logger.warn('No recovery strategy found for error', { code: error.code });
      return false;
    }

    // Use custom retry config if provided
    if (customRetryConfig && strategy.type === 'retry') {
      strategy.retryConfig = customRetryConfig;
    }

    this.logger.info('Attempting recovery', {
      errorId: error.id,
      strategy: strategy.type
    });

    try {
      switch (strategy.type) {
        case 'retry':
          return await this.retryWithIntelligentBackoff(error, strategy);
        
        case 'rollback':
          return await this.performRollback(error, strategy);
        
        case 'compensate':
          return await this.performCompensation(error, strategy);
        
        case 'circuit-breaker':
          return await this.handleWithCircuitBreaker(error, strategy);
        
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
      if (strategy.onRecoveryFailure) {
        strategy.onRecoveryFailure(recoveryError as Error);
      }
      return false;
    }
  }

  /**
   * Intelligent retry with various backoff strategies
   */
  private async retryWithIntelligentBackoff(
    error: SystemError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    const config = strategy.retryConfig || {
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      jitterMs: 100,
      multiplier: 2
    };

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const delay = this.calculateDelay(attempt, config);
      
      this.logger.info(`Retry attempt ${attempt}/${config.maxAttempts}`, {
        errorId: error.id,
        delay: `${delay}ms`,
        strategy: config.strategy
      });

      // Notify retry attempt
      if (strategy.onRetryAttempt) {
        strategy.onRetryAttempt(attempt, delay);
      }

      try {
        if (strategy.action) {
          await strategy.action();
          
          // Success - update metrics
          this.updateRetryMetrics(error.code, true, Date.now() - startTime);
          this.logger.info('Retry successful', { 
            errorId: error.id,
            attempt,
            totalTime: `${Date.now() - startTime}ms`
          });
          
          if (strategy.onRecoverySuccess) {
            strategy.onRecoverySuccess();
          }
          
          return true;
        }
      } catch (retryError) {
        lastError = retryError as Error;
        this.logger.warn(`Retry attempt ${attempt} failed`, {
          errorId: error.id,
          error: (retryError as Error).message
        });

        if (attempt < config.maxAttempts) {
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - update metrics
    this.updateRetryMetrics(error.code, false, Date.now() - startTime);
    
    if (strategy.onRecoveryFailure && lastError) {
      strategy.onRecoveryFailure(lastError);
    }

    return false;
  }

  /**
   * Calculate delay based on retry strategy
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let baseDelay: number;

    switch (config.strategy) {
      case RetryStrategy.EXPONENTIAL:
        baseDelay = Math.min(
          config.initialDelayMs * Math.pow(config.multiplier || 2, attempt - 1),
          config.maxDelayMs
        );
        break;

      case RetryStrategy.LINEAR:
        baseDelay = Math.min(
          config.initialDelayMs * attempt,
          config.maxDelayMs
        );
        break;

      case RetryStrategy.FIBONACCI:
        baseDelay = Math.min(
          this.fibonacci(attempt) * config.initialDelayMs,
          config.maxDelayMs
        );
        break;

      case RetryStrategy.CUSTOM:
        if (config.customDelayFn) {
          baseDelay = Math.min(
            config.customDelayFn(attempt),
            config.maxDelayMs
          );
        } else {
          baseDelay = config.initialDelayMs;
        }
        break;

      default:
        baseDelay = config.initialDelayMs;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * config.jitterMs * 2 - config.jitterMs;
    return Math.max(0, baseDelay + jitter);
  }

  /**
   * Fibonacci calculation for retry delays
   */
  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  /**
   * Handle with circuit breaker pattern
   */
  private async handleWithCircuitBreaker(
    error: SystemError,
    strategy: RecoveryStrategy
  ): Promise<boolean> {
    const state = this.getCircuitBreakerState(error.code);
    
    if (state.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - state.lastFailureTime > (strategy.circuitBreakerConfig?.resetTimeMs || 60000)) {
        state.state = 'half-open';
        state.successCount = 0;
      } else {
        return false;
      }
    }

    try {
      if (strategy.action) {
        await strategy.action();
        
        // Success
        if (state.state === 'half-open') {
          state.successCount++;
          if (state.successCount >= (strategy.circuitBreakerConfig?.halfOpenRequests || 3)) {
            state.state = 'closed';
            state.failureCount = 0;
            this.logger.info('Circuit breaker closed', { errorCode: error.code });
          }
        }
        
        return true;
      }
    } catch (cbError) {
      // Failure
      state.failureCount++;
      state.lastFailureTime = Date.now();
      
      if (state.failureCount >= (strategy.circuitBreakerConfig?.failureThreshold || 5)) {
        state.state = 'open';
        this.logger.warn('Circuit breaker opened', { errorCode: error.code });
      }
      
      throw cbError;
    }

    return false;
  }

  /**
   * Get or create circuit breaker state
   */
  private getCircuitBreakerState(errorCode: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(errorCode)) {
      this.circuitBreakers.set(errorCode, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0
      });
    }
    return this.circuitBreakers.get(errorCode)!;
  }

  /**
   * Check if circuit is open for error code
   */
  private isCircuitOpen(errorCode: string): boolean {
    const state = this.circuitBreakers.get(errorCode);
    return state?.state === 'open' || false;
  }

  /**
   * Update circuit breaker on success
   */
  private updateCircuitBreakerSuccess(errorCode: string): void {
    const state = this.circuitBreakers.get(errorCode);
    if (state) {
      if (state.state === 'half-open') {
        state.successCount++;
      }
      state.failureCount = Math.max(0, state.failureCount - 1);
    }
  }

  /**
   * Update circuit breaker on failure
   */
  private updateCircuitBreakerFailure(errorCode: string): void {
    const state = this.getCircuitBreakerState(errorCode);
    state.failureCount++;
    state.lastFailureTime = Date.now();
  }

  /**
   * Update retry metrics
   */
  private updateRetryMetrics(errorCode: string, success: boolean, duration: number): void {
    if (!this.retryMetrics.has(errorCode)) {
      this.retryMetrics.set(errorCode, {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryTime: 0,
        retryDistribution: {}
      });
    }

    const metrics = this.retryMetrics.get(errorCode)!;
    metrics.totalRetries++;
    
    if (success) {
      metrics.successfulRetries++;
    } else {
      metrics.failedRetries++;
    }

    // Update average retry time
    metrics.averageRetryTime = 
      (metrics.averageRetryTime * (metrics.totalRetries - 1) + duration) / metrics.totalRetries;

    // Update distribution
    const bucket = Math.floor(duration / 1000) + 's';
    metrics.retryDistribution[bucket] = (metrics.retryDistribution[bucket] || 0) + 1;
  }

  /**
   * Update error patterns for prediction
   */
  private updateErrorPatterns(error: SystemError): void {
    const pattern = this.errorPatterns.get(error.code) || [];
    pattern.push(Date.now());
    
    // Keep only last 100 occurrences
    if (pattern.length > 100) {
      pattern.shift();
    }
    
    this.errorPatterns.set(error.code, pattern);
  }

  /**
   * Predict if an error is likely to occur soon
   */
  predictFailure(errorCode: string): { likelihood: number; timeToFailure?: number } {
    const pattern = this.errorPatterns.get(errorCode);
    if (!pattern || pattern.length < 3) {
      return { likelihood: 0 };
    }

    // Calculate average time between errors
    const intervals: number[] = [];
    for (let i = 1; i < pattern.length; i++) {
      intervals.push(pattern[i]! - pattern[i - 1]!);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const lastError = pattern[pattern.length - 1]!;
    const timeSinceLastError = Date.now() - lastError;

    // Simple prediction based on average interval
    const likelihood = Math.min(1, timeSinceLastError / avgInterval);
    const timeToFailure = Math.max(0, avgInterval - timeSinceLastError);

    return { likelihood, timeToFailure };
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
        if (strategy.onRecoverySuccess) {
          strategy.onRecoverySuccess();
        }
        return true;
      }
    } catch (rollbackError) {
      this.logger.error('Rollback failed', rollbackError as Error, {
        originalError: error.id
      });
      if (strategy.onRecoveryFailure) {
        strategy.onRecoveryFailure(rollbackError as Error);
      }
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
        if (strategy.onRecoverySuccess) {
          strategy.onRecoverySuccess();
        }
        return true;
      }
    } catch (compensationError) {
      this.logger.error('Compensation failed', compensationError as Error, {
        originalError: error.id
      });
      if (strategy.onRecoveryFailure) {
        strategy.onRecoveryFailure(compensationError as Error);
      }
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
      recoverable: context.recoverable ?? this.isRecoverable(error),
      retryable: context.retryable ?? this.isRetryable(error),
      context,
      retryCount: 0
    };
  }

  private determineSeverity(error: Error): ErrorSeverity {
    // Enhanced severity determination
    if (error.message.includes('critical') || error.message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (error.message.includes('boundary violation') || error.message.includes('security')) {
      return ErrorSeverity.HIGH;
    }
    if (error.message.includes('validation') || error.message.includes('timeout')) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  private extractErrorCode(error: Error): string {
    // Enhanced error code extraction
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    
    // Generate code based on error type and message
    if (error.message.includes('boundary')) return 'BOUNDARY_VIOLATION';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_ERROR';
    if (error.message.includes('auth')) return 'AUTH_ERROR';
    if (error.message.includes('permission')) return 'PERMISSION_ERROR';
    if (error.message.includes('not found')) return 'NOT_FOUND_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  private isRecoverable(error: Error): boolean {
    // Determine if error is recoverable
    const recoverableCodes = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR',
      'NOT_FOUND_ERROR'
    ];
    
    const code = this.extractErrorCode(error);
    return recoverableCodes.includes(code);
  }

  private isRetryable(error: Error): boolean {
    // Determine if error is retryable
    const retryableCodes = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR'
    ];
    
    const code = this.extractErrorCode(error);
    return retryableCodes.includes(code);
  }

  private initializeRecoveryStrategies(): void {
    // Enhanced recovery strategies with intelligent retry
    this.recoveryStrategies.set('TIMEOUT_ERROR', {
      type: 'retry',
      retryConfig: {
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        jitterMs: 200,
        multiplier: 2
      }
    });

    this.recoveryStrategies.set('NETWORK_ERROR', {
      type: 'circuit-breaker',
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeMs: 60000,
        halfOpenRequests: 3
      },
      retryConfig: {
        strategy: RetryStrategy.EXPONENTIAL,
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        jitterMs: 500,
        multiplier: 2
      }
    });

    this.recoveryStrategies.set('RATE_LIMIT_ERROR', {
      type: 'retry',
      retryConfig: {
        strategy: RetryStrategy.LINEAR,
        maxAttempts: 3,
        initialDelayMs: 60000, // 1 minute
        maxDelayMs: 300000, // 5 minutes
        jitterMs: 1000
      }
    });

    this.recoveryStrategies.set('VALIDATION_ERROR', {
      type: 'manual'
    });

    this.recoveryStrategies.set('BOUNDARY_VIOLATION', {
      type: 'rollback'
    });

    this.recoveryStrategies.set('AUTH_ERROR', {
      type: 'retry',
      retryConfig: {
        strategy: RetryStrategy.FIBONACCI,
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        jitterMs: 100
      }
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
    // Enhanced alerting with multiple channels
    this.logger.error('CRITICAL ERROR ALERT', undefined, {
      errorId: error.id,
      message: error.message,
      actor: error.actor,
      severity: error.severity,
      timestamp: error.timestamp
    });

    // In production, this would:
    // - Send push notifications to mobile devices
    // - Trigger email alerts
    // - Post to Slack/Discord webhooks
    // - Create PagerDuty incidents
    // - Update status page
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get comprehensive error statistics
   */
  getErrorStats(): {
    total: number;
    lastHour: number;
    bySeverity: Record<ErrorSeverity, number>;
    byActor: Record<string, number>;
    recoveryRate: number;
    retryStats: Record<string, RetryMetrics>;
    circuitBreakerStates: Record<string, CircuitBreakerState>;
    predictions: Record<string, { likelihood: number; timeToFailure?: number }>;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors = this.errorHistory.filter(
      e => new Date(e.timestamp).getTime() > oneHourAgo
    );

    // Get predictions for common errors
    const predictions: Record<string, { likelihood: number; timeToFailure?: number }> = {};
    for (const [code] of this.errorPatterns) {
      predictions[code] = this.predictFailure(code);
    }

    return {
      total: this.errorHistory.length,
      lastHour: recentErrors.length,
      bySeverity: {
        [ErrorSeverity.CRITICAL]: recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length,
        [ErrorSeverity.HIGH]: recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length,
        [ErrorSeverity.MEDIUM]: recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length,
        [ErrorSeverity.LOW]: recentErrors.filter(e => e.severity === ErrorSeverity.LOW).length
      },
      byActor: this.groupByActor(recentErrors),
      recoveryRate: this.calculateRecoveryRate(),
      retryStats: Object.fromEntries(this.retryMetrics),
      circuitBreakerStates: Object.fromEntries(this.circuitBreakers),
      predictions
    };
  }

  private groupByActor(errors: SystemError[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      const actor = error.actor || 'system';
      acc[actor] = (acc[actor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateRecoveryRate(): number {
    let totalRecoverable = 0;
    let totalRecovered = 0;

    for (const [, metrics] of this.retryMetrics) {
      totalRecoverable += metrics.totalRetries;
      totalRecovered += metrics.successfulRetries;
    }

    if (totalRecoverable === 0) return 0;
    return totalRecovered / totalRecoverable;
  }
}