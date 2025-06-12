/**
 * Resilience Orchestrator
 * Integrates all resilience, monitoring, and recovery components
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { EnhancedErrorHandler, RetryConfig, ErrorSeverity } from './EnhancedErrorHandler';
import { HealthMonitoringService, HealthStatus } from '@/src/services/monitoring/HealthMonitoringService';
import { PredictiveFailureDetector, FailurePrediction } from '@/src/services/monitoring/PredictiveFailureDetector';
import { UserNotificationService, ErrorNotificationContext } from '@/src/services/notification/UserNotificationService';
import { TelemetryCollectionService } from '@/src/services/telemetry/TelemetryCollectionService';
import { AutomaticRecoveryService } from '@/src/services/recovery/AutomaticRecoveryService';
import { RecoveryService } from '@/src/services/RecoveryService';
import { MemoryOptimizationService } from '@/src/services/performance/MemoryOptimizationService';
import { ConnectionMonitor } from '@/src/services/monitoring/ConnectionMonitor';
import { PerformanceMonitor } from '@/src/services/development/PerformanceMonitor';

export interface ResilienceConfig {
  enableHealthMonitoring: boolean;
  enablePredictiveFailureDetection: boolean;
  enableAutomaticRecovery: boolean;
  enableTelemetryCollection: boolean;
  healthCheckIntervalMs: number;
  predictionCheckIntervalMs: number;
  telemetryConfig?: {
    endpoint?: string;
    apiKey?: string;
    samplingRate?: number;
  };
}

export interface ResilienceStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'recovering';
  components: {
    errorHandling: 'operational' | 'degraded';
    healthMonitoring: 'operational' | 'degraded';
    failurePrediction: 'operational' | 'degraded';
    automaticRecovery: 'operational' | 'degraded';
    telemetry: 'operational' | 'degraded';
  };
  metrics: {
    errorRate: number;
    recoverySuccessRate: number;
    systemUptime: number;
    predictedFailures: number;
    preventedFailures: number;
  };
  timestamp: string;
}

export class ResilienceOrchestrator extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  
  // Core components
  private readonly errorHandler: EnhancedErrorHandler;
  private readonly healthMonitor: HealthMonitoringService;
  private readonly failureDetector: PredictiveFailureDetector;
  private readonly notificationService: UserNotificationService;
  private readonly telemetryService: TelemetryCollectionService;
  private readonly recoveryService: AutomaticRecoveryService;
  
  
  private config: ResilienceConfig;
  private startTime: Date;
  private isRunning = false;
  
  // Metrics
  private totalErrors = 0;
  private recoveredErrors = 0;
  private predictedFailures = 0;
  private preventedFailures = 0;

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    recoveryService: RecoveryService,
    memoryOptimization: MemoryOptimizationService,
    connectionMonitor: ConnectionMonitor,
    performanceMonitor: PerformanceMonitor,
    config?: Partial<ResilienceConfig>
  ) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.startTime = new Date();
    
    this.config = {
      enableHealthMonitoring: true,
      enablePredictiveFailureDetection: true,
      enableAutomaticRecovery: true,
      enableTelemetryCollection: true,
      healthCheckIntervalMs: 30000, // 30 seconds
      predictionCheckIntervalMs: 60000, // 1 minute
      ...config
    };
    
    // Initialize components
    this.errorHandler = new EnhancedErrorHandler(logger, auditLogger);
    this.healthMonitor = new HealthMonitoringService(logger, performanceMonitor, memoryOptimization);
    this.failureDetector = new PredictiveFailureDetector(logger, this.healthMonitor, this.errorHandler);
    this.notificationService = new UserNotificationService(logger);
    this.telemetryService = new TelemetryCollectionService(logger, this.config.telemetryConfig);
    this.recoveryService = new AutomaticRecoveryService(
      logger,
      recoveryService,
      memoryOptimization,
      connectionMonitor,
      this.notificationService
    );
    
    this.setupEventHandlers();
  }

  /**
   * Start resilience orchestration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Resilience orchestrator already running');
      return;
    }

    this.logger.info('Starting resilience orchestrator', this.config);
    this.isRunning = true;
    
    try {
      // Start components based on configuration
      if (this.config.enableHealthMonitoring) {
        this.healthMonitor.start();
      }
      
      if (this.config.enablePredictiveFailureDetection) {
        this.failureDetector.start();
      }
      
      if (this.config.enableTelemetryCollection) {
        this.telemetryService.start();
      }
      
      // Initial health check
      await this.performHealthCheck();
      
      // Emit started event
      this.emit('started', this.getStatus());
      
      this.logger.info('Resilience orchestrator started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start resilience orchestrator', error as Error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop resilience orchestration
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping resilience orchestrator');
    
    // Stop components
    this.healthMonitor.stop();
    this.failureDetector.stop();
    this.telemetryService.stop();
    
    this.isRunning = false;
    
    // Final telemetry flush
    await this.telemetryService.flush();
    
    // Emit stopped event
    this.emit('stopped', this.getStatus());
    
    this.logger.info('Resilience orchestrator stopped');
  }

  /**
   * Handle an error with full resilience support
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
    this.totalErrors++;
    
    // Track error telemetry
    this.telemetryService.trackError(error, context.severity || ErrorSeverity.MEDIUM, context);
    
    // Create error notification context
    const errorContext: ErrorNotificationContext = {
      errorCode: this.extractErrorCode(error),
      operation: context.operation || 'unknown',
      isRetrying: false,
      willRetry: context.retryable || false
    };
    
    // Notify user about error
    const notificationId = await this.notificationService.notifyError(error, errorContext);
    
    // Handle error with enhanced handler
    await this.errorHandler.handleError(error, context);
    
    // Check if recovery was successful
    const errorStats = this.errorHandler.getErrorStats();
    if (errorStats.recoveryRate > 0) {
      this.recoveredErrors++;
      
      // Notify successful recovery
      await this.notificationService.notifyRecovery({
        errorId: notificationId,
        recoveryStatus: 'succeeded',
        recoveryMethod: 'automatic',
        details: 'Error resolved automatically'
      });
    }
    
    // Track metrics
    this.healthMonitor.recordError();
    
    // Audit log
    this.auditLogger.logEvent({
      actor: { type: context.actor as any || 'system', id: context.actor || 'system' },
      operation: { type: 'error', description: error.message },
      result: { status: 'failure', duration: 0, error: error.message },
      metadata: { correlationId: notificationId }
    });
  }

  /**
   * Setup event handlers for components
   */
  private setupEventHandlers(): void {
    // Health monitoring events
    this.healthMonitor.on('statusChanged', (status: HealthStatus) => {
      this.handleHealthStatusChange(status);
    });
    
    this.healthMonitor.on('criticalHealth', (status: HealthStatus) => {
      this.handleCriticalHealth(status);
    });
    
    this.healthMonitor.on('metrics', (data: any) => {
      this.telemetryService.trackHealthMetrics(data.metrics);
    });
    
    // Failure prediction events
    this.failureDetector.on('failurePredicted', (prediction: FailurePrediction) => {
      this.handleFailurePrediction(prediction);
    });
    
    this.failureDetector.on('anomalyDetected', (anomaly: any) => {
      this.handleAnomaly(anomaly);
    });
    
    // Recovery events
    this.recoveryService.on('recoveryCompleted', (result: any) => {
      this.handleRecoveryCompleted(result);
    });
    
    // Notification events
    this.notificationService.on('retryRequested', (data: any) => {
      this.handleRetryRequest(data);
    });
    
    // Telemetry events
    this.telemetryService.on('telemetryBatch', (batch: any) => {
      this.emit('telemetryBatch', batch);
    });
  }

  /**
   * Handle health status change
   */
  private async handleHealthStatusChange(status: HealthStatus): Promise<void> {
    this.logger.info('Health status changed', { overall: status.overall });
    
    // Track telemetry
    this.telemetryService.trackEvent(
      'health_status_change',
      'system',
      { overall: status.overall },
      { components: status.components, issueCount: status.issues.length }
    );
    
    // Notify user if degraded or critical
    if (status.overall !== 'healthy') {
      const details = status.issues
        .map(i => `${i.component}: ${i.message}`)
        .join('\n');
      
      await this.notificationService.notifySystemHealth(status.overall, details);
    }
    
    // Trigger automatic recovery if enabled
    if (this.config.enableAutomaticRecovery && status.overall !== 'healthy') {
      await this.recoveryService.handleHealthStatusChange(status);
    }
    
    // Emit status change
    this.emit('healthStatusChanged', status);
  }

  /**
   * Handle critical health
   */
  private async handleCriticalHealth(status: HealthStatus): Promise<void> {
    this.logger.error('Critical health detected', undefined, {
      issues: status.issues
    });
    
    // Track critical event
    this.telemetryService.trackEvent(
      'critical_health',
      'system',
      { components: Object.keys(status.components).filter(c => status.components[c as keyof typeof status.components] === 'critical').join(',') },
      { issues: status.issues }
    );
    
    // Send critical alert
    await this.notificationService.notify({
      title: 'Critical System Health',
      message: 'System is in critical state. Immediate attention required.',
      type: 'error' as any,
      priority: 'critical' as any,
      duration: -1,
      sound: true,
      vibrate: true
    });
    
    // Emit critical event
    this.emit('criticalHealth', status);
  }

  /**
   * Handle failure prediction
   */
  private async handleFailurePrediction(prediction: FailurePrediction): Promise<void> {
    this.predictedFailures++;
    
    this.logger.warn('Failure predicted', {
      component: prediction.component,
      metric: prediction.metric,
      likelihood: prediction.likelihood,
      timeToFailure: prediction.timeToFailure
    });
    
    // Track prediction
    this.telemetryService.trackEvent(
      'failure_predicted',
      'system',
      {
        component: prediction.component,
        metric: prediction.metric,
        likelihood: prediction.likelihood.toString()
      },
      prediction
    );
    
    // Notify user about prediction
    const timeStr = prediction.timeToFailure 
      ? `in approximately ${Math.round(prediction.timeToFailure / 60000)} minutes`
      : 'soon';
    
    await this.notificationService.notify({
      title: 'Potential Issue Detected',
      message: `${prediction.component} may experience issues ${timeStr}. ${prediction.recommendation}`,
      type: 'warning' as any,
      priority: prediction.likelihood > 0.9 ? 'high' as any : 'medium' as any,
      duration: 10000
    });
    
    // Trigger preventive recovery
    if (this.config.enableAutomaticRecovery) {
      await this.recoveryService.handleFailurePrediction(prediction);
      // Assume prevention was attempted
      this.preventedFailures++;
    }
    
    // Emit prediction
    this.emit('failurePredicted', prediction);
  }

  /**
   * Handle anomaly detection
   */
  private async handleAnomaly(anomaly: any): Promise<void> {
    this.logger.warn('Anomaly detected', anomaly);
    
    // Track anomaly
    this.telemetryService.trackEvent(
      'anomaly_detected',
      'system',
      {
        component: anomaly.component,
        metric: anomaly.metric,
        severity: anomaly.severity
      },
      anomaly
    );
    
    // Notify if high severity
    if (anomaly.severity === 'high') {
      await this.notificationService.notify({
        title: 'Anomaly Detected',
        message: `Unusual ${anomaly.metric} activity detected in ${anomaly.component}`,
        type: 'warning' as any,
        priority: 'medium' as any,
        duration: 8000
      });
    }
    
    // Emit anomaly
    this.emit('anomalyDetected', anomaly);
  }

  /**
   * Handle recovery completion
   */
  private async handleRecoveryCompleted(result: any): Promise<void> {
    this.logger.info('Recovery completed', {
      planId: result.planId,
      success: result.success,
      duration: result.duration
    });
    
    // Track recovery
    this.telemetryService.trackEvent(
      'recovery_completed',
      'system',
      {
        success: result.success.toString(),
        actionCount: result.actionsExecuted.length.toString()
      },
      result
    );
    
    // Update metrics
    this.telemetryService.trackMetric(
      'recovery.duration',
      result.duration,
      'ms',
      { success: result.success.toString() }
    );
    
    // Emit recovery completed
    this.emit('recoveryCompleted', result);
  }

  /**
   * Handle retry request from user
   */
  private async handleRetryRequest(data: any): Promise<void> {
    this.logger.info('User requested retry', { errorId: data.errorId });
    
    // Track user action
    this.telemetryService.trackEvent(
      'user_retry_request',
      'usage',
      { errorCode: data.context.errorCode }
    );
    
    // Re-execute the operation with retry config
    // This would need the original operation context
    this.emit('retryRequested', data);
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.config.enableHealthMonitoring) return;
    
    await this.healthMonitor.checkHealthNow();
    
    // Update resilience status based on health
    const status = this.getStatus();
    
    // Track overall status
    this.telemetryService.trackEvent(
      'resilience_status',
      'system',
      { overall: status.overall },
      status
    );
  }

  /**
   * Extract error code from error
   */
  private extractErrorCode(error: Error): string {
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    return error.constructor.name || 'UNKNOWN_ERROR';
  }

  /**
   * Get current resilience status
   */
  getStatus(): ResilienceStatus {
    const healthStatus = this.healthMonitor.getHealthStatus();
    const errorStats = this.errorHandler.getErrorStats();
    const recoveryStats = this.recoveryService.getStats();
    
    // Determine overall status
    let overall: ResilienceStatus['overall'] = 'healthy';
    if (recoveryStats.activePlans > 0) {
      overall = 'recovering';
    } else if (healthStatus?.overall === 'critical') {
      overall = 'critical';
    } else if (healthStatus?.overall === 'degraded' || errorStats.lastHour > 10) {
      overall = 'degraded';
    }
    
    // Component statuses
    const components: ResilienceStatus['components'] = {
      errorHandling: errorStats.lastHour > 50 ? 'degraded' : 'operational',
      healthMonitoring: this.config.enableHealthMonitoring ? 'operational' : 'degraded',
      failurePrediction: this.config.enablePredictiveFailureDetection ? 'operational' : 'degraded',
      automaticRecovery: this.config.enableAutomaticRecovery ? 'operational' : 'degraded',
      telemetry: this.config.enableTelemetryCollection ? 'operational' : 'degraded'
    };
    
    // Calculate metrics
    const uptime = Date.now() - this.startTime.getTime();
    const errorRate = this.totalErrors > 0 
      ? (errorStats.lastHour / (uptime / 3600000)) 
      : 0;
    const recoverySuccessRate = this.totalErrors > 0
      ? this.recoveredErrors / this.totalErrors
      : 1;
    
    return {
      overall,
      components,
      metrics: {
        errorRate,
        recoverySuccessRate,
        systemUptime: uptime,
        predictedFailures: this.predictedFailures,
        preventedFailures: this.preventedFailures
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    resilience: ResilienceStatus;
    errors: ReturnType<EnhancedErrorHandler['getErrorStats']>;
    health: HealthStatus | null;
    predictions: ReturnType<PredictiveFailureDetector['getStats']>;
    recovery: ReturnType<AutomaticRecoveryService['getStats']>;
    telemetry: ReturnType<TelemetryCollectionService['getStats']>;
    notifications: ReturnType<UserNotificationService['getStats']>;
  } {
    return {
      resilience: this.getStatus(),
      errors: this.errorHandler.getErrorStats(),
      health: this.healthMonitor.getHealthStatus(),
      predictions: this.failureDetector.getStats(),
      recovery: this.recoveryService.getStats(),
      telemetry: this.telemetryService.getStats(),
      notifications: this.notificationService.getStats()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ResilienceConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    this.logger.info('Resilience configuration updated', this.config);
    
    // Update telemetry config if changed
    if (config.telemetryConfig) {
      this.telemetryService.updateConfig(config.telemetryConfig);
    }
    
    // Restart components if needed
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Force immediate health check
   */
  async checkHealth(): Promise<HealthStatus> {
    return await this.healthMonitor.checkHealthNow();
  }

  /**
   * Get failure predictions
   */
  getPredictions(): FailurePrediction[] {
    return this.failureDetector.getPredictions();
  }

  /**
   * Manually trigger recovery
   */
  async triggerRecovery(component: string): Promise<void> {
    this.logger.info('Manual recovery triggered', { component });
    
    // Create artificial health issue to trigger recovery
    const artificialStatus: HealthStatus = {
      overall: 'degraded',
      components: {
        cpu: 'healthy',
        memory: 'healthy',
        performance: 'healthy',
        network: 'healthy',
        storage: 'healthy',
        [component]: 'critical' as any
      },
      issues: [{
        component,
        severity: 'critical',
        message: 'Manual recovery requested',
        metric: `${component}.manual`,
        value: 0,
        threshold: 0,
        timestamp: new Date().toISOString()
      }],
      recommendations: ['Manual recovery initiated by user']
    };
    
    await this.recoveryService.handleHealthStatusChange(artificialStatus);
  }
}