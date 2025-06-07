
/**
 * @actor system
 * @responsibility Handles API failures and execution errors with retry logic
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ErrorContext {
  actor: 'planning' | 'execution' | 'system';
  operation: string;
  sessionId?: string;
  instructionId?: string;
  attemptNumber?: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByActor: Record<string, number>;
  retryAttempts: number;
  successfulRetries: number;
  failedRetries: number;
}

export class APIErrorHandler {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly retryConfig: RetryConfig;
  private readonly metrics: ErrorMetrics;
  private readonly circuitBreaker: Map<string, CircuitBreakerState> = new Map();

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.retryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        'NETWORK_ERROR',
        'TIMEOUT',
        'RATE_LIMIT',
        'SERVICE_UNAVAILABLE',
        'INTERNAL_SERVER_ERROR'
      ],
      ...retryConfig
    };
    
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByActor: {},
      retryAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0
    };
  }

  /**
   * Handle error with retry logic
   */
  async handleWithRetry<T>(
    operation: ($1) => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    const circuitBreakerId = `${context.actor}-${context.operation}`;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (this.isCircuitOpen(circuitBreakerId)) {
          throw new Error(`Circuit breaker open for ${circuitBreakerId}`);
        }
        
        // Execute operation
        const result = await operation();
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(circuitBreakerId);
        
        // Update metrics on retry success
        if (attempt > 1) {
          this.metrics.successfulRetries++;
          this.logger.info('Operation succeeded after retry', {
            ...context,
            attemptNumber: attempt
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Record error
        await this.recordError(error as Error, { ...context, attemptNumber: attempt });
        
        // Check if error is retryable
        if (!this.isRetryableError(error as Error) || attempt === this.retryConfig.maxRetries) {
          // Update circuit breaker
          this.recordCircuitBreakerFailure(circuitBreakerId);
          
          if (attempt > 1) {
            this.metrics.failedRetries++;
          }
          
          throw error;
        }
        
        // Calculate delay
        const delay = this.calculateRetryDelay(attempt);
        
        this.logger.warn('Retrying operation after error', {
          ...context,
          attemptNumber: attempt,
          nextAttemptIn: delay,
          error: (error as Error).message
        });
        
        // Update retry metrics
        this.metrics.retryAttempts++;
        
        // Wait before retry
        await this.delay(delay);
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorCode = this.extractErrorCode(error);
    
    // Check explicit retryable errors
    if (this.retryConfig.retryableErrors.includes(errorCode)) {
      return true;
    }
    
    // Check error patterns
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || 
        message.includes('econnrefused') || 
        message.includes('enotfound') ||
        message.includes('etimedout')) {
      return true;
    }
    
    // Rate limiting
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        message.includes('429')) {
      return true;
    }
    
    // Temporary failures
    if (message.includes('temporarily unavailable') ||
        message.includes('503') ||
        message.includes('502')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract error code from error
   */
  private extractErrorCode(error: Error): string {
    // Check for explicit error code
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    
    // Extract from message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('network')) return 'NETWORK_ERROR';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('rate limit') || message.includes('429')) return 'RATE_LIMIT';
    if (message.includes('503') || message.includes('unavailable')) return 'SERVICE_UNAVAILABLE';
    if (message.includes('500') || message.includes('internal')) return 'INTERNAL_SERVER_ERROR';
    if (message.includes('401') || message.includes('unauthorized')) return 'UNAUTHORIZED';
    if (message.includes('403') || message.includes('forbidden')) return 'FORBIDDEN';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptNumber: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attemptNumber - 1),
      this.retryConfig.maxDelay
    );
    
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);
    
    return Math.floor(delay + jitter);
  }

  /**
   * Record error for metrics and auditing
   */
  private async recordError(error: Error, context: ErrorContext): Promise<void> {
    const errorCode = this.extractErrorCode(error);
    
    // Update metrics
    this.metrics.totalErrors++;
    this.metrics.errorsByType[errorCode] = (this.metrics.errorsByType[errorCode] || 0) + 1;
    this.metrics.errorsByActor[context.actor] = (this.metrics.errorsByActor[context.actor] || 0) + 1;
    
    // Log error
    this.logger.error('API operation failed', error, context);
    
    // Audit log
    await this.auditLogger.logEvent({
      actor: {
        type: context.actor,
        id: `${context.actor}-1`
      },
      operation: {
        type: 'error',
        description: context.operation,
        input: context,
        output: {
          error: error.message,
          code: errorCode,
          stack: error.stack
        }
      },
      result: {
        status: 'failure',
        duration: 0
      },
      metadata: {
        sessionId: context.sessionId,
        instructionId: context.instructionId,
        correlationId: `error-${Date.now()}`
      }
    });
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.totalErrors = 0;
    this.metrics.errorsByType = {};
    this.metrics.errorsByActor = {};
    this.metrics.retryAttempts = 0;
    this.metrics.successfulRetries = 0;
    this.metrics.failedRetries = 0;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Circuit breaker implementation
  private isCircuitOpen(id: string): boolean {
    const state = this.circuitBreaker.get(id);
    if (!state) return false;
    
    if (state.state === 'open') {
      // Check if we should transition to half-open
      const now = Date.now();
      if (now - state.lastFailureTime > state.cooldownPeriod) {
        state.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false;
  }

  private recordCircuitBreakerFailure(id: string): void {
    let state = this.circuitBreaker.get(id);
    
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        cooldownPeriod: 60000 // 1 minute
      };
      this.circuitBreaker.set(id, state);
    }
    
    state.failureCount++;
    state.lastFailureTime = Date.now();
    
    // Open circuit after 5 consecutive failures
    if (state.failureCount >= 5) {
      state.state = 'open';
      this.logger.warn('Circuit breaker opened', { id });
    }
  }

  private resetCircuitBreaker(id: string): void {
    const state = this.circuitBreaker.get(id);
    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureTime = 0;
    }
  }
}

interface CircuitBreakerState {
  state: 'open' | 'closed' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  cooldownPeriod: number;
}