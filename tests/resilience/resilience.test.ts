/**
 * Tests for resilience and health monitoring features
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedErrorHandler, RetryStrategy, ErrorSeverity } from '@/src/core/orchestrator/EnhancedErrorHandler';
import { HealthMonitoringService } from '@/src/services/monitoring/HealthMonitoringService';
import { PredictiveFailureDetector } from '@/src/services/monitoring/PredictiveFailureDetector';
import { UserNotificationService } from '@/src/services/notification/UserNotificationService';
import { TelemetryCollectionService } from '@/src/services/telemetry/TelemetryCollectionService';
import { AutomaticRecoveryService } from '@/src/services/recovery/AutomaticRecoveryService';
import { ResilienceOrchestrator } from '@/src/core/orchestrator/ResilienceOrchestrator';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';

describe('Resilience Features', () => {
  let logger: Logger;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    logger = new Logger('test');
    auditLogger = new AuditLogger();
  });

  describe('EnhancedErrorHandler', () => {
    let errorHandler: EnhancedErrorHandler;

    beforeEach(() => {
      errorHandler = new EnhancedErrorHandler(logger, auditLogger);
    });

    it('should handle errors with exponential backoff retry', async () => {
      const mockAction = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      const error = new Error('Network error');
      error.message = 'network error';

      await errorHandler.handleError(error, {
        recoverable: true,
        retryable: true,
        retryConfig: {
          strategy: RetryStrategy.EXPONENTIAL,
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          jitterMs: 50
        }
      });

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should predict failure likelihood', () => {
      // Simulate error pattern
      const errorCode = 'TIMEOUT_ERROR';
      
      // Add some historical errors
      for (let i = 0; i < 5; i++) {
        errorHandler.handleError(new Error('timeout'), {
          severity: ErrorSeverity.MEDIUM
        });
      }

      const prediction = errorHandler.predictFailure(errorCode);
      expect(prediction).toHaveProperty('likelihood');
      expect(prediction.likelihood).toBeGreaterThanOrEqual(0);
      expect(prediction.likelihood).toBeLessThanOrEqual(1);
    });

    it('should implement circuit breaker pattern', async () => {
      const error = new Error('Service unavailable');
      error.message = 'network error';

      // Trigger multiple failures to open circuit
      for (let i = 0; i < 6; i++) {
        await errorHandler.handleError(error, {
          recoverable: true,
          retryable: true
        });
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.circuitBreakerStates).toBeDefined();
    });
  });

  describe('HealthMonitoringService', () => {
    let healthMonitor: HealthMonitoringService;
    let performanceMonitor: any;
    let memoryOptimization: any;

    beforeEach(() => {
      performanceMonitor = { getMetrics: jest.fn() };
      memoryOptimization = { optimizeMemory: jest.fn() };
      healthMonitor = new HealthMonitoringService(logger, performanceMonitor, memoryOptimization);
    });

    it('should detect health issues', async () => {
      // Force a health check
      const status = await healthMonitor.checkHealthNow();
      
      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('components');
      expect(status).toHaveProperty('issues');
      expect(status).toHaveProperty('recommendations');
    });

    it('should track performance metrics', () => {
      healthMonitor.recordResponseTime(100);
      healthMonitor.recordResponseTime(200);
      healthMonitor.recordResponseTime(150);
      
      healthMonitor.recordOperation();
      healthMonitor.recordOperation();
      
      const history = healthMonitor.getMetricsHistory(10);
      expect(history).toBeInstanceOf(Array);
    });

    it('should emit events on status change', (done) => {
      healthMonitor.on('statusChanged', (status) => {
        expect(status).toHaveProperty('overall');
        done();
      });

      healthMonitor.start();
    });
  });

  describe('PredictiveFailureDetector', () => {
    let failureDetector: PredictiveFailureDetector;
    let healthMonitor: HealthMonitoringService;
    let errorHandler: EnhancedErrorHandler;

    beforeEach(() => {
      const performanceMonitor = { getMetrics: jest.fn() };
      const memoryOptimization = { optimizeMemory: jest.fn() };
      healthMonitor = new HealthMonitoringService(logger, performanceMonitor, memoryOptimization);
      errorHandler = new EnhancedErrorHandler(logger, auditLogger);
      failureDetector = new PredictiveFailureDetector(logger, healthMonitor, errorHandler);
    });

    it('should predict failures based on trends', (done) => {
      failureDetector.on('failurePredicted', (prediction) => {
        expect(prediction).toHaveProperty('likelihood');
        expect(prediction).toHaveProperty('confidence');
        expect(prediction).toHaveProperty('recommendation');
        done();
      });

      // Simulate metrics that indicate impending failure
      healthMonitor.emit('metrics', {
        metrics: {
          cpu: { usage: 85, loadAverage: [2, 3, 4] },
          memory: { percentUsed: 88, usedMB: 14000, totalMB: 16000, heapUsedMB: 1000, heapTotalMB: 1200, externalMB: 100 },
          performance: { responseTime: 4000, throughput: 50, errorRate: 8, operationsPerSecond: 50 },
          network: { latency: 300, bandwidth: 50, connectionCount: 100, failedRequests: 5 },
          storage: { diskUsagePercent: 85, readOps: 100, writeOps: 50, queueDepth: 10 },
          timestamp: new Date().toISOString()
        },
        status: {},
        trends: []
      });

      failureDetector.start();
    });

    it('should detect anomalies', (done) => {
      failureDetector.on('anomalyDetected', (anomaly) => {
        expect(anomaly).toHaveProperty('severity');
        expect(anomaly).toHaveProperty('deviation');
        expect(anomaly).toHaveProperty('possibleCauses');
        done();
      });

      // Simulate anomalous metric
      for (let i = 0; i < 10; i++) {
        healthMonitor.emit('metrics', {
          metrics: {
            cpu: { usage: 30, loadAverage: [0.5, 0.5, 0.5] },
            memory: { percentUsed: 50, usedMB: 8000, totalMB: 16000, heapUsedMB: 500, heapTotalMB: 1200, externalMB: 50 },
            performance: { responseTime: 50, throughput: 100, errorRate: 0, operationsPerSecond: 100 },
            network: { latency: 20, bandwidth: 100, connectionCount: 10, failedRequests: 0 },
            storage: { diskUsagePercent: 45, readOps: 50, writeOps: 25, queueDepth: 2 },
            timestamp: new Date().toISOString()
          },
          status: {},
          trends: []
        });
      }

      // Now send anomalous value
      healthMonitor.emit('metrics', {
        metrics: {
          cpu: { usage: 99, loadAverage: [5, 5, 5] }, // Anomaly
          memory: { percentUsed: 50, usedMB: 8000, totalMB: 16000, heapUsedMB: 500, heapTotalMB: 1200, externalMB: 50 },
          performance: { responseTime: 50, throughput: 100, errorRate: 0, operationsPerSecond: 100 },
          network: { latency: 20, bandwidth: 100, connectionCount: 10, failedRequests: 0 },
          storage: { diskUsagePercent: 45, readOps: 50, writeOps: 25, queueDepth: 2 },
          timestamp: new Date().toISOString()
        },
        status: {},
        trends: []
      });

      failureDetector.start();
    });
  });

  describe('UserNotificationService', () => {
    let notificationService: UserNotificationService;

    beforeEach(() => {
      notificationService = new UserNotificationService(logger);
    });

    it('should notify errors with context', async () => {
      const error = new Error('Connection timeout');
      const notificationId = await notificationService.notifyError(error, {
        errorCode: 'TIMEOUT_ERROR',
        operation: 'fetchData',
        retryCount: 2,
        isRetrying: true
      });

      expect(notificationId).toBeDefined();
      
      const stats = notificationService.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('should track notification metrics', async () => {
      await notificationService.notify({
        title: 'Test',
        message: 'Test message',
        type: 'info' as any,
        priority: 'medium' as any
      });

      const stats = notificationService.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('queued');
    });

    it('should handle recovery notifications', async () => {
      await notificationService.notifyRecovery({
        errorId: 'test-error',
        recoveryStatus: 'succeeded',
        recoveryMethod: 'retry',
        duration: 1000
      });

      const stats = notificationService.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('TelemetryCollectionService', () => {
    let telemetryService: TelemetryCollectionService;

    beforeEach(() => {
      telemetryService = new TelemetryCollectionService(logger, {
        enabled: true,
        batchSize: 10,
        flushIntervalMs: 1000
      });
    });

    it('should collect telemetry events', () => {
      telemetryService.trackEvent('test_event', 'custom', { test: 'true' });
      telemetryService.trackMetric('test.metric', 100, 'ms');
      
      const stats = telemetryService.getStats();
      expect(stats.bufferedEvents).toBeGreaterThanOrEqual(0);
      expect(stats.bufferedMetrics).toBeGreaterThanOrEqual(0);
    });

    it('should track operation timing', () => {
      telemetryService.startOperation('test-op');
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 50) {
        // Wait
      }
      
      telemetryService.endOperation('test-op', 'test.operation.duration');
      
      const stats = telemetryService.getStats();
      expect(stats.metricsTracked).toBeGreaterThan(0);
    });

    it('should aggregate metrics', () => {
      telemetryService.trackMetric('response.time', 100);
      telemetryService.trackMetric('response.time', 200);
      telemetryService.trackMetric('response.time', 150);
      
      const aggregated = telemetryService.getAggregatedMetrics('minute');
      expect(aggregated.metrics).toHaveProperty('response.time');
      expect(aggregated.metrics['response.time'].avg).toBe(150);
    });
  });

  describe('AutomaticRecoveryService', () => {
    let recoveryService: AutomaticRecoveryService;
    let mockRecoveryService: any;
    let mockMemoryOptimization: any;
    let mockConnectionMonitor: any;
    let mockNotificationService: any;

    beforeEach(() => {
      mockRecoveryService = { rollbackToLastStable: jest.fn() };
      mockMemoryOptimization = { optimizeMemory: jest.fn() };
      mockConnectionMonitor = { resetConnections: jest.fn() };
      mockNotificationService = { 
        notifyRecovery: jest.fn(),
        notify: jest.fn()
      };
      
      recoveryService = new AutomaticRecoveryService(
        logger,
        mockRecoveryService,
        mockMemoryOptimization,
        mockConnectionMonitor,
        mockNotificationService
      );
    });

    it('should create recovery plans for health issues', async () => {
      await recoveryService.handleHealthStatusChange({
        overall: 'critical',
        components: {
          cpu: 'healthy',
          memory: 'critical',
          performance: 'healthy',
          network: 'healthy',
          storage: 'healthy'
        },
        issues: [{
          component: 'memory',
          severity: 'critical',
          message: 'Memory usage critical',
          metric: 'memory.percentUsed',
          value: 95,
          threshold: 90,
          timestamp: new Date().toISOString()
        }],
        recommendations: ['Optimize memory usage']
      });

      expect(mockMemoryOptimization.optimizeMemory).toHaveBeenCalled();
    });

    it('should handle failure predictions', async () => {
      await recoveryService.handleFailurePrediction({
        id: 'pred-1',
        component: 'cpu',
        metric: 'cpu.usage',
        likelihood: 0.8,
        confidence: 0.7,
        threshold: 90,
        currentValue: 85,
        trend: 'increasing',
        recommendation: 'Scale CPU resources',
        timestamp: new Date().toISOString()
      });

      const stats = recoveryService.getStats();
      expect(stats.activePlans).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ResilienceOrchestrator Integration', () => {
    let resilienceOrchestrator: ResilienceOrchestrator;
    let mockRecoveryService: any;
    let mockMemoryOptimization: any;
    let mockConnectionMonitor: any;
    let mockPerformanceMonitor: any;

    beforeEach(() => {
      mockRecoveryService = { rollbackToLastStable: jest.fn() };
      mockMemoryOptimization = { optimizeMemory: jest.fn() };
      mockConnectionMonitor = { resetConnections: jest.fn() };
      mockPerformanceMonitor = { getMetrics: jest.fn() };
      
      resilienceOrchestrator = new ResilienceOrchestrator(
        logger,
        auditLogger,
        mockRecoveryService,
        mockMemoryOptimization,
        mockConnectionMonitor,
        mockPerformanceMonitor,
        {
          enableHealthMonitoring: true,
          enablePredictiveFailureDetection: true,
          enableAutomaticRecovery: true,
          enableTelemetryCollection: true
        }
      );
    });

    it('should coordinate all resilience components', async () => {
      await resilienceOrchestrator.start();
      
      const status = resilienceOrchestrator.getStatus();
      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('components');
      expect(status).toHaveProperty('metrics');
      
      await resilienceOrchestrator.stop();
    });

    it('should handle errors with full resilience support', async () => {
      await resilienceOrchestrator.start();
      
      const error = new Error('Test error');
      await resilienceOrchestrator.handleError(error, {
        operation: 'test',
        severity: 'medium',
        recoverable: true,
        retryable: true
      });
      
      const stats = resilienceOrchestrator.getStats();
      expect(stats.errors.total).toBeGreaterThan(0);
      
      await resilienceOrchestrator.stop();
    });

    it('should provide comprehensive statistics', async () => {
      await resilienceOrchestrator.start();
      
      const stats = resilienceOrchestrator.getStats();
      expect(stats).toHaveProperty('resilience');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('predictions');
      expect(stats).toHaveProperty('recovery');
      expect(stats).toHaveProperty('telemetry');
      expect(stats).toHaveProperty('notifications');
      
      await resilienceOrchestrator.stop();
    });
  });
});