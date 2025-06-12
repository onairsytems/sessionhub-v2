/**
 * Performance Telemetry Collection Service
 * Collects, aggregates, and exports system performance telemetry data
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { HealthMetrics } from '../monitoring/HealthMonitoringService';

export interface TelemetryEvent {
  id: string;
  timestamp: string;
  category: 'performance' | 'error' | 'usage' | 'system' | 'custom';
  name: string;
  value?: number;
  unit?: string;
  dimensions: Record<string, string>;
  properties?: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent' | 'custom';
  timestamp: string;
  tags: Record<string, string>;
}

export interface TelemetryBatch {
  id: string;
  events: TelemetryEvent[];
  metrics: PerformanceMetric[];
  startTime: string;
  endTime: string;
  systemInfo: SystemInfo;
}

export interface SystemInfo {
  sessionId: string;
  version: string;
  environment: string;
  platform: string;
  nodeVersion: string;
  electronVersion?: string;
  memoryTotal: number;
  cpuCores: number;
}

export interface TelemetryConfig {
  enabled: boolean;
  batchSize: number;
  flushIntervalMs: number;
  endpoint?: string;
  apiKey?: string;
  samplingRate: number; // 0-1
  includeSensitiveData: boolean;
  customDimensions?: Record<string, string>;
}

export interface AggregatedMetrics {
  period: string;
  metrics: {
    [key: string]: {
      count: number;
      sum: number;
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

export class TelemetryCollectionService extends EventEmitter {
  private readonly logger: Logger;
  private config: TelemetryConfig;
  private readonly eventBuffer: TelemetryEvent[] = [];
  private readonly metricBuffer: PerformanceMetric[] = [];
  private readonly systemInfo: SystemInfo;
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionStartTime: Date;
  
  // Performance tracking
  private readonly operationTimers: Map<string, number> = new Map();
  private readonly metricAggregates: Map<string, number[]> = new Map();
  
  // Sampling
  private sampleCounter = 0;

  constructor(logger: Logger, config?: Partial<TelemetryConfig>) {
    super();
    this.logger = logger;
    this.sessionStartTime = new Date();
    
    this.config = {
      enabled: true,
      batchSize: 100,
      flushIntervalMs: 60000, // 1 minute
      samplingRate: 1.0, // 100% by default
      includeSensitiveData: false,
      ...config
    };
    
    this.systemInfo = this.collectSystemInfo();
    
    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start telemetry collection
   */
  start(): void {
    if (this.flushTimer) {
      this.logger.warn('Telemetry collection already started');
      return;
    }

    this.logger.info('Starting telemetry collection', {
      config: this.config
    });
    
    // Schedule regular flushes
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
    
    // Track process metrics
    this.trackProcessMetrics();
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
      
      // Final flush
      this.flush();
      
      this.logger.info('Telemetry collection stopped');
    }
  }

  /**
   * Track a telemetry event
   */
  trackEvent(
    name: string,
    category: TelemetryEvent['category'],
    dimensions?: Record<string, string>,
    properties?: Record<string, any>
  ): void {
    if (!this.config.enabled || !this.shouldSample()) {
      return;
    }

    const event: TelemetryEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      category,
      name,
      dimensions: {
        ...this.config.customDimensions,
        ...dimensions
      },
      properties: this.sanitizeProperties(properties)
    };
    
    this.eventBuffer.push(event);
    
    // Check if we should flush
    if (this.eventBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track a performance metric
   */
  trackMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms',
    tags?: Record<string, string>
  ): void {
    if (!this.config.enabled || !this.shouldSample()) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags: {
        ...this.config.customDimensions,
        ...tags
      }
    };
    
    this.metricBuffer.push(metric);
    
    // Add to aggregates
    this.addToAggregates(name, value);
    
    // Check if we should flush
    if (this.metricBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Start timing an operation
   */
  startOperation(operationId: string): void {
    this.operationTimers.set(operationId, Date.now());
  }

  /**
   * End timing an operation and track the metric
   */
  endOperation(
    operationId: string,
    metricName: string,
    tags?: Record<string, string>
  ): void {
    const startTime = this.operationTimers.get(operationId);
    if (!startTime) {
      this.logger.warn('Operation timer not found', { operationId });
      return;
    }
    
    const duration = Date.now() - startTime;
    this.operationTimers.delete(operationId);
    
    this.trackMetric(metricName, duration, 'ms', {
      ...tags,
      operation: operationId
    });
  }

  /**
   * Track system health metrics
   */
  trackHealthMetrics(metrics: HealthMetrics): void {
    if (!this.config.enabled) return;

    // CPU metrics
    this.trackMetric('system.cpu.usage', metrics.cpu.usage, 'percent', { component: 'cpu' });
    
    // Memory metrics
    this.trackMetric('system.memory.used', metrics.memory.usedMB, 'bytes', { component: 'memory' });
    this.trackMetric('system.memory.heap', metrics.memory.heapUsedMB, 'bytes', { component: 'memory' });
    this.trackMetric('system.memory.percent', metrics.memory.percentUsed, 'percent', { component: 'memory' });
    
    // Performance metrics
    this.trackMetric('app.response_time', metrics.performance.responseTime, 'ms', { component: 'performance' });
    this.trackMetric('app.error_rate', metrics.performance.errorRate, 'percent', { component: 'performance' });
    this.trackMetric('app.throughput', metrics.performance.throughput, 'count', { component: 'performance' });
    
    // Network metrics
    this.trackMetric('network.latency', metrics.network.latency, 'ms', { component: 'network' });
    this.trackMetric('network.failed_requests', metrics.network.failedRequests, 'count', { component: 'network' });
    
    // Storage metrics
    this.trackMetric('storage.disk_usage', metrics.storage.diskUsagePercent, 'percent', { component: 'storage' });
  }

  /**
   * Track error occurrence
   */
  trackError(
    error: Error,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: Record<string, any>
  ): void {
    this.trackEvent('error_occurred', 'error', {
      severity,
      error_type: error.constructor.name,
      error_code: (error as any).code || 'UNKNOWN'
    }, {
      message: error.message,
      stack: error.stack,
      ...context
    });
    
    // Track error metric
    this.trackMetric(`errors.${severity}`, 1, 'count', {
      error_type: error.constructor.name
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    feature: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent('feature_usage', 'usage', {
      feature,
      action
    }, metadata);
    
    this.trackMetric(`features.${feature}.${action}`, 1, 'count');
  }

  /**
   * Track custom metric with aggregation
   */
  trackCustomMetric(
    name: string,
    value: number,
    aggregationType: 'sum' | 'avg' | 'min' | 'max' = 'avg',
    tags?: Record<string, string>
  ): void {
    const metricKey = `custom.${name}.${aggregationType}`;
    this.trackMetric(metricKey, value, 'custom', tags);
  }

  /**
   * Flush telemetry data
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0 && this.metricBuffer.length === 0) {
      return;
    }

    const batch: TelemetryBatch = {
      id: this.generateBatchId(),
      events: [...this.eventBuffer],
      metrics: [...this.metricBuffer],
      startTime: this.sessionStartTime.toISOString(),
      endTime: new Date().toISOString(),
      systemInfo: this.systemInfo
    };
    
    // Clear buffers
    this.eventBuffer.length = 0;
    this.metricBuffer.length = 0;
    
    try {
      // Export telemetry
      await this.exportTelemetry(batch);
      
      // Emit for local processing
      this.emit('telemetryBatch', batch);
      
      this.logger.debug('Telemetry batch flushed', {
        batchId: batch.id,
        eventCount: batch.events.length,
        metricCount: batch.metrics.length
      });
      
    } catch (error) {
      this.logger.error('Failed to flush telemetry', error as Error);
      
      // Re-add to buffers if export failed
      this.eventBuffer.push(...batch.events);
      this.metricBuffer.push(...batch.metrics);
    }
  }

  /**
   * Export telemetry to external service
   */
  private async exportTelemetry(batch: TelemetryBatch): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      // No export configured, just log
      this.logger.debug('Telemetry export not configured', {
        batchId: batch.id
      });
      return;
    }

    // In production, would send to telemetry service
    // For now, just simulate
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Track process metrics
   */
  private trackProcessMetrics(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.trackMetric('process.memory.rss', memUsage.rss, 'bytes');
      this.trackMetric('process.memory.heap_used', memUsage.heapUsed, 'bytes');
      this.trackMetric('process.memory.heap_total', memUsage.heapTotal, 'bytes');
      this.trackMetric('process.memory.external', memUsage.external, 'bytes');
      
      this.trackMetric('process.cpu.user', cpuUsage.user, 'ms');
      this.trackMetric('process.cpu.system', cpuUsage.system, 'ms');
      
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect system information
   */
  private collectSystemInfo(): SystemInfo {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: process.env['NEXT_PUBLIC_BUILD_VERSION'] || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      memoryTotal: 16384, // Would use os.totalmem() in real implementation
      cpuCores: 8 // Would use os.cpus().length in real implementation
    };
  }

  /**
   * Check if event should be sampled
   */
  private shouldSample(): boolean {
    if (this.config.samplingRate >= 1) return true;
    if (this.config.samplingRate <= 0) return false;
    
    this.sampleCounter++;
    return (this.sampleCounter % Math.floor(1 / this.config.samplingRate)) === 0;
  }

  /**
   * Sanitize properties to remove sensitive data
   */
  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> | undefined {
    if (!properties || this.config.includeSensitiveData) {
      return properties;
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];
    
    for (const [key, value] of Object.entries(properties)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeProperties(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Add value to aggregates for statistics
   */
  private addToAggregates(metricName: string, value: number): void {
    if (!this.metricAggregates.has(metricName)) {
      this.metricAggregates.set(metricName, []);
    }
    
    const values = this.metricAggregates.get(metricName)!;
    values.push(value);
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(period: 'minute' | 'hour' | 'day' = 'hour'): AggregatedMetrics {
    const aggregated: AggregatedMetrics = {
      period,
      metrics: {}
    };
    
    for (const [name, values] of this.metricAggregates) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      
      aggregated.metrics[name] = {
        count: values.length,
        sum,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        avg: sum / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0
      };
    }
    
    return aggregated;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update telemetry configuration
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    
    this.logger.info('Telemetry configuration updated', this.config);
    
    // Restart if needed
    if (this.config.enabled && !this.flushTimer) {
      this.start();
    } else if (!this.config.enabled && this.flushTimer) {
      this.stop();
    }
  }

  /**
   * Get telemetry statistics
   */
  getStats(): {
    eventsTracked: number;
    metricsTracked: number;
    bufferedEvents: number;
    bufferedMetrics: number;
    aggregatedMetrics: number;
    sessionDuration: number;
    samplingRate: number;
  } {
    return {
      eventsTracked: this.sampleCounter,
      metricsTracked: Array.from(this.metricAggregates.values())
        .reduce((sum, values) => sum + values.length, 0),
      bufferedEvents: this.eventBuffer.length,
      bufferedMetrics: this.metricBuffer.length,
      aggregatedMetrics: this.metricAggregates.size,
      sessionDuration: Date.now() - this.sessionStartTime.getTime(),
      samplingRate: this.config.samplingRate
    };
  }
}