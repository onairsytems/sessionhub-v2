/**
 * Comprehensive Health Monitoring Service
 * Tracks system performance metrics, detects degradation, and provides insights
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { PerformanceMonitor } from '@/src/services/development/PerformanceMonitor';
import { MemoryOptimizationService } from '@/src/services/performance/MemoryOptimizationService';

export interface HealthMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    temperature?: number;
  };
  memory: {
    usedMB: number;
    totalMB: number;
    percentUsed: number;
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    gcCount?: number;
    gcDuration?: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    operationsPerSecond: number;
  };
  network: {
    latency: number;
    bandwidth: number;
    connectionCount: number;
    failedRequests: number;
  };
  storage: {
    diskUsagePercent: number;
    readOps: number;
    writeOps: number;
    queueDepth: number;
  };
  timestamp: string;
}

export interface HealthThresholds {
  cpu: {
    usage: { warning: number; critical: number };
    loadAverage: { warning: number; critical: number };
    temperature?: { warning: number; critical: number };
  };
  memory: {
    percentUsed: { warning: number; critical: number };
    heapUsed: { warning: number; critical: number };
    gcFrequency?: { warning: number; critical: number };
  };
  performance: {
    responseTime: { warning: number; critical: number };
    errorRate: { warning: number; critical: number };
  };
  network: {
    latency: { warning: number; critical: number };
    failedRequests: { warning: number; critical: number };
  };
  storage: {
    diskUsagePercent: { warning: number; critical: number };
    queueDepth: { warning: number; critical: number };
  };
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    cpu: 'healthy' | 'warning' | 'critical';
    memory: 'healthy' | 'warning' | 'critical';
    performance: 'healthy' | 'warning' | 'critical';
    network: 'healthy' | 'warning' | 'critical';
    storage: 'healthy' | 'warning' | 'critical';
  };
  issues: HealthIssue[];
  recommendations: string[];
}

export interface HealthIssue {
  component: string;
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface HealthTrend {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
  prediction: {
    willExceedThreshold: boolean;
    timeToThreshold?: number; // milliseconds
    predictedValue?: number;
  };
}

export class HealthMonitoringService extends EventEmitter {
  private readonly logger: Logger;
  private readonly memoryOptimization: MemoryOptimizationService;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: HealthMetrics[] = [];
  private readonly maxHistorySize = 1000;
  private readonly checkIntervalMs = 5000; // 5 seconds
  
  private thresholds: HealthThresholds;
  private lastHealthStatus: HealthStatus | null = null;
  
  // Performance tracking
  private responseTimeBuffer: number[] = [];
  private errorCountBuffer: number[] = [];
  private throughputBuffer: number[] = [];
  
  constructor(
    logger: Logger,
    _performanceMonitor: PerformanceMonitor,
    memoryOptimization: MemoryOptimizationService
  ) {
    super();
    this.logger = logger;
    this.memoryOptimization = memoryOptimization;
    
    this.thresholds = this.getDefaultThresholds();
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.logger.info('Starting health monitoring service');
    
    // Initial check
    this.performHealthCheck();
    
    // Schedule regular checks
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logger.info('Health monitoring service stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();
      this.addToHistory(metrics);
      
      const status = this.evaluateHealth(metrics);
      const trends = this.analyzeTrends();
      
      // Emit events for significant changes
      if (this.hasStatusChanged(status)) {
        this.emit('statusChanged', status);
        
        if (status.overall === 'critical') {
          this.emit('criticalHealth', status);
        } else if (status.overall === 'degraded') {
          this.emit('degradedHealth', status);
        }
      }
      
      // Emit metrics for external monitoring
      this.emit('metrics', { metrics, status, trends });
      
      // Log issues
      for (const issue of status.issues) {
        if (issue.severity === 'critical') {
          this.logger.error('Critical health issue detected', undefined, issue);
        } else {
          this.logger.warn('Health warning detected', issue);
        }
      }
      
      this.lastHealthStatus = status;
      
      // Perform automatic optimizations if needed
      if (status.components.memory === 'critical') {
        await this.performMemoryOptimization();
      }
      
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<HealthMetrics> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const performanceMetrics = this.getPerformanceMetrics();
    const networkMetrics = await this.getNetworkMetrics();
    const storageMetrics = await this.getStorageMetrics();
    
    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      performance: performanceMetrics,
      network: networkMetrics,
      storage: storageMetrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get CPU usage metrics
   */
  private async getCPUUsage(): Promise<HealthMetrics['cpu']> {
    // Note: In a real implementation, we'd use os.cpus() and calculate usage
    // For now, simulating with realistic values
    const usage = process.cpuUsage();
    const totalUsage = (usage.user + usage.system) / 1000000; // Convert to seconds
    
    return {
      usage: Math.min(100, totalUsage * 10), // Simplified calculation
      loadAverage: [0.5, 0.7, 0.8], // Would use os.loadavg() in real implementation
      temperature: undefined // Would require platform-specific implementation
    };
  }

  /**
   * Get memory usage metrics
   */
  private getMemoryUsage(): HealthMetrics['memory'] {
    const memUsage = process.memoryUsage();
    const totalMB = 16384; // Would get from os.totalmem() in real implementation
    
    return {
      usedMB: (memUsage.rss / 1024 / 1024),
      totalMB,
      percentUsed: (memUsage.rss / 1024 / 1024 / totalMB) * 100,
      heapUsedMB: (memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: (memUsage.heapTotal / 1024 / 1024),
      externalMB: (memUsage.external / 1024 / 1024),
      gcCount: (global as any).gc ? 1 : 0, // Would track actual GC events
      gcDuration: 0
    };
  }

  /**
   * Get performance metrics
   */
  private getPerformanceMetrics(): HealthMetrics['performance'] {
    // Calculate averages from buffers
    const avgResponseTime = this.responseTimeBuffer.length > 0
      ? this.responseTimeBuffer.reduce((a, b) => a + b, 0) / this.responseTimeBuffer.length
      : 50; // Default 50ms
      
    const errorCount = this.errorCountBuffer.reduce((a, b) => a + b, 0);
    const totalOps = this.throughputBuffer.reduce((a, b) => a + b, 0);
    const errorRate = totalOps > 0 ? (errorCount / totalOps) * 100 : 0;
    
    const throughput = this.throughputBuffer.length > 0
      ? this.throughputBuffer.reduce((a, b) => a + b, 0) / this.throughputBuffer.length
      : 100; // Default 100 ops/sec
    
    return {
      responseTime: avgResponseTime,
      throughput,
      errorRate,
      operationsPerSecond: throughput
    };
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<HealthMetrics['network']> {
    // In real implementation, would measure actual network metrics
    return {
      latency: 20, // ms
      bandwidth: 100, // Mbps
      connectionCount: 10,
      failedRequests: 0
    };
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics(): Promise<HealthMetrics['storage']> {
    // In real implementation, would use fs to check disk usage
    return {
      diskUsagePercent: 45,
      readOps: 100,
      writeOps: 50,
      queueDepth: 2
    };
  }

  /**
   * Evaluate health based on metrics
   */
  private evaluateHealth(metrics: HealthMetrics): HealthStatus {
    const issues: HealthIssue[] = [];
    const recommendations: string[] = [];
    const componentStatus: HealthStatus['components'] = {
      cpu: 'healthy',
      memory: 'healthy',
      performance: 'healthy',
      network: 'healthy',
      storage: 'healthy'
    };

    // Check CPU
    if (metrics.cpu.usage > this.thresholds.cpu.usage.critical) {
      componentStatus.cpu = 'critical';
      issues.push({
        component: 'cpu',
        severity: 'critical',
        message: 'CPU usage critically high',
        metric: 'cpu.usage',
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.usage.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('Consider scaling up compute resources or optimizing CPU-intensive operations');
    } else if (metrics.cpu.usage > this.thresholds.cpu.usage.warning) {
      componentStatus.cpu = 'warning';
      issues.push({
        component: 'cpu',
        severity: 'warning',
        message: 'CPU usage elevated',
        metric: 'cpu.usage',
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.usage.warning,
        timestamp: metrics.timestamp
      });
    }

    // Check Memory
    if (metrics.memory.percentUsed > this.thresholds.memory.percentUsed.critical) {
      componentStatus.memory = 'critical';
      issues.push({
        component: 'memory',
        severity: 'critical',
        message: 'Memory usage critically high',
        metric: 'memory.percentUsed',
        value: metrics.memory.percentUsed,
        threshold: this.thresholds.memory.percentUsed.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('Immediate memory optimization required. Consider increasing memory allocation');
    } else if (metrics.memory.percentUsed > this.thresholds.memory.percentUsed.warning) {
      componentStatus.memory = 'warning';
      issues.push({
        component: 'memory',
        severity: 'warning',
        message: 'Memory usage elevated',
        metric: 'memory.percentUsed',
        value: metrics.memory.percentUsed,
        threshold: this.thresholds.memory.percentUsed.warning,
        timestamp: metrics.timestamp
      });
      recommendations.push('Monitor memory usage closely. Consider optimizing memory-intensive operations');
    }

    // Check Performance
    if (metrics.performance.responseTime > this.thresholds.performance.responseTime.critical) {
      componentStatus.performance = 'critical';
      issues.push({
        component: 'performance',
        severity: 'critical',
        message: 'Response time critically high',
        metric: 'performance.responseTime',
        value: metrics.performance.responseTime,
        threshold: this.thresholds.performance.responseTime.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('Investigate slow operations. Consider implementing caching or optimization');
    }

    if (metrics.performance.errorRate > this.thresholds.performance.errorRate.critical) {
      componentStatus.performance = 'critical';
      issues.push({
        component: 'performance',
        severity: 'critical',
        message: 'Error rate critically high',
        metric: 'performance.errorRate',
        value: metrics.performance.errorRate,
        threshold: this.thresholds.performance.errorRate.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('High error rate detected. Check logs and implement error handling improvements');
    }

    // Check Network
    if (metrics.network.latency > this.thresholds.network.latency.critical) {
      componentStatus.network = 'critical';
      issues.push({
        component: 'network',
        severity: 'critical',
        message: 'Network latency critically high',
        metric: 'network.latency',
        value: metrics.network.latency,
        threshold: this.thresholds.network.latency.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('Network performance degraded. Check network connectivity and bandwidth');
    }

    // Check Storage
    if (metrics.storage.diskUsagePercent > this.thresholds.storage.diskUsagePercent.critical) {
      componentStatus.storage = 'critical';
      issues.push({
        component: 'storage',
        severity: 'critical',
        message: 'Disk usage critically high',
        metric: 'storage.diskUsagePercent',
        value: metrics.storage.diskUsagePercent,
        threshold: this.thresholds.storage.diskUsagePercent.critical,
        timestamp: metrics.timestamp
      });
      recommendations.push('Disk space critically low. Clean up unnecessary files or increase storage');
    }

    // Determine overall status
    const criticalCount = Object.values(componentStatus).filter(s => s === 'critical').length;
    const warningCount = Object.values(componentStatus).filter(s => s === 'warning').length;
    
    let overall: HealthStatus['overall'] = 'healthy';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (warningCount > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      components: componentStatus,
      issues,
      recommendations
    };
  }

  /**
   * Analyze trends in metrics
   */
  private analyzeTrends(): HealthTrend[] {
    const trends: HealthTrend[] = [];
    
    if (this.metricsHistory.length < 10) {
      return trends; // Not enough data for trends
    }

    // Analyze CPU usage trend
    const cpuTrend = this.analyzeMetricTrend(
      'cpu.usage',
      this.metricsHistory.map(m => m.cpu.usage),
      this.thresholds.cpu.usage.critical
    );
    if (cpuTrend) trends.push(cpuTrend);

    // Analyze memory usage trend
    const memoryTrend = this.analyzeMetricTrend(
      'memory.percentUsed',
      this.metricsHistory.map(m => m.memory.percentUsed),
      this.thresholds.memory.percentUsed.critical
    );
    if (memoryTrend) trends.push(memoryTrend);

    // Analyze response time trend
    const responseTrend = this.analyzeMetricTrend(
      'performance.responseTime',
      this.metricsHistory.map(m => m.performance.responseTime),
      this.thresholds.performance.responseTime.critical
    );
    if (responseTrend) trends.push(responseTrend);

    return trends;
  }

  /**
   * Analyze trend for a specific metric
   */
  private analyzeMetricTrend(
    metricName: string,
    values: number[],
    threshold: number
  ): HealthTrend | null {
    if (values.length < 10) return null;

    // Get recent values
    const recentValues = values.slice(-10);
    const olderValues = values.slice(-20, -10);
    
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const olderAvg = olderValues.length > 0
      ? olderValues.reduce((a, b) => a + b, 0) / olderValues.length
      : recentAvg;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    let trend: HealthTrend['trend'] = 'stable';
    if (changePercent > 10) {
      trend = 'degrading';
    } else if (changePercent < -10) {
      trend = 'improving';
    }

    // Simple linear prediction
    const lastValue = recentValues[recentValues.length - 1] ?? 0;
    const firstValue = recentValues[0] ?? 0;
    const slope = (lastValue - firstValue) / recentValues.length;
    const predictedValue = lastValue + (slope * 10); // Predict 10 intervals ahead
    
    const willExceedThreshold = predictedValue > threshold && recentAvg < threshold;
    const timeToThreshold = willExceedThreshold
      ? ((threshold - recentAvg) / slope) * this.checkIntervalMs
      : undefined;

    return {
      metric: metricName,
      trend,
      changePercent,
      prediction: {
        willExceedThreshold,
        timeToThreshold,
        predictedValue
      }
    };
  }

  /**
   * Check if health status has changed
   */
  private hasStatusChanged(newStatus: HealthStatus): boolean {
    if (!this.lastHealthStatus) return true;
    
    if (newStatus.overall !== this.lastHealthStatus.overall) return true;
    
    for (const [component, status] of Object.entries(newStatus.components)) {
      if (status !== this.lastHealthStatus.components[component as keyof typeof newStatus.components]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Add metrics to history
   */
  private addToHistory(metrics: HealthMetrics): void {
    this.metricsHistory.push(metrics);
    
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Perform automatic memory optimization
   */
  private async performMemoryOptimization(): Promise<void> {
    this.logger.info('Performing automatic memory optimization');
    
    try {
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Use memory optimization service
      await this.memoryOptimization.optimizeMemory();
      
      this.logger.info('Memory optimization completed');
    } catch (error) {
      this.logger.error('Memory optimization failed', error as Error);
    }
  }

  /**
   * Get default health thresholds
   */
  private getDefaultThresholds(): HealthThresholds {
    return {
      cpu: {
        usage: { warning: 70, critical: 90 },
        loadAverage: { warning: 2, critical: 4 },
        temperature: { warning: 70, critical: 85 }
      },
      memory: {
        percentUsed: { warning: 75, critical: 90 },
        heapUsed: { warning: 80, critical: 95 },
        gcFrequency: { warning: 10, critical: 20 }
      },
      performance: {
        responseTime: { warning: 1000, critical: 5000 }, // ms
        errorRate: { warning: 5, critical: 10 } // percent
      },
      network: {
        latency: { warning: 100, critical: 500 }, // ms
        failedRequests: { warning: 10, critical: 50 } // count per interval
      },
      storage: {
        diskUsagePercent: { warning: 80, critical: 95 },
        queueDepth: { warning: 10, critical: 50 }
      }
    };
  }

  /**
   * Update performance metrics (called by other services)
   */
  recordResponseTime(timeMs: number): void {
    this.responseTimeBuffer.push(timeMs);
    if (this.responseTimeBuffer.length > 100) {
      this.responseTimeBuffer.shift();
    }
  }

  recordError(): void {
    const currentErrors = this.errorCountBuffer[this.errorCountBuffer.length - 1] || 0;
    this.errorCountBuffer[this.errorCountBuffer.length - 1] = currentErrors + 1;
  }

  recordOperation(): void {
    const currentOps = this.throughputBuffer[this.throughputBuffer.length - 1] || 0;
    this.throughputBuffer[this.throughputBuffer.length - 1] = currentOps + 1;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): HealthMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * Update health thresholds
   */
  updateThresholds(newThresholds: Partial<HealthThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
    this.logger.info('Health thresholds updated', this.thresholds);
  }

  /**
   * Force immediate health check
   */
  async checkHealthNow(): Promise<HealthStatus> {
    await this.performHealthCheck();
    return this.lastHealthStatus!;
  }
}