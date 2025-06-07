
/**
 * Performance Monitor for Self-Development
 * Validates that updates improve rather than degrade system performance
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { Logger } from '../../lib/logging/Logger';
import { DevelopmentConfig, getConfig } from '../../config/development.config';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  context: {
    version?: string;
    sessionId?: string;
    operation?: string;
    environment: 'development' | 'production';
  };
}

export interface PerformanceBaseline {
  metric: string;
  baseline: number;
  threshold: number;
  samples: number;
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface PerformanceReport {
  version: string;
  timestamp: Date;
  metrics: PerformanceMetric[];
  comparisons: {
    metric: string;
    current: number;
    baseline: number;
    change: number;
    changePercent: number;
    passed: boolean;
    trend: string;
  }[];
  overallScore: number;
  regressions: string[];
  improvements: string[];
  recommendations: string[];
}

export interface SystemResource {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

export class PerformanceMonitor {
  private logger: Logger;
  private config: DevelopmentConfig;
  private metricsPath: string;
  private baselinesPath: string;
  private resourceMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logger = new Logger('PerformanceMonitor');
    this.config = getConfig();
    this.metricsPath = join(this.expandPath(this.config.dataDirectory), 'performance-metrics.json');
    this.baselinesPath = join(this.expandPath(this.config.dataDirectory), 'performance-baselines.json');
  }

  /**
   * Initialize performance monitoring
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing performance monitor');

    // Ensure data directory exists
    const dataDir = join(this.expandPath(this.config.dataDirectory));
    await fs.mkdir(dataDir, { recursive: true });

    // Load existing baselines
    await this.loadBaselines();

    // Start resource monitoring
    await this.startResourceMonitoring();

    this.logger.info('Performance monitor initialized');
  }

  /**
   * Start continuous resource monitoring
   */
  async startResourceMonitoring(): Promise<void> {
    if (this.resourceMonitoring) {
      return;
    }

    this.resourceMonitoring = true;
    this.logger.info('Starting resource monitoring');

    const monitor = async () => {
      try {
        const resources = await this.getCurrentResources();
        
        await this.recordMetric({
          name: 'cpu_usage',
          value: resources.cpu.usage,
          unit: 'percent',
          timestamp: new Date(),
          context: { environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production' },
        });

        await this.recordMetric({
          name: 'memory_usage',
          value: resources.memory.usage,
          unit: 'percent',
          timestamp: new Date(),
          context: { environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production' },
        });

        await this.recordMetric({
          name: 'memory_absolute',
          value: resources.memory.used,
          unit: 'MB',
          timestamp: new Date(),
          context: { environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production' },
        });

        await this.recordMetric({
          name: 'disk_usage',
          value: resources.disk.usage,
          unit: 'percent',
          timestamp: new Date(),
          context: { environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production' },
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn('Resource monitoring error', { error: errorMessage });
      }
    };

    // Initial measurement
    await monitor();

    // Set up interval monitoring
    this.monitoringInterval = setInterval(monitor, 30000); // Every 30 seconds
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.resourceMonitoring = false;
    this.logger.info('Resource monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const metrics = await this.loadMetrics();
      metrics.push(metric);

      // Keep only last 10000 metrics to prevent file from growing too large
      if (metrics.length > 10000) {
        metrics.splice(0, metrics.length - 10000);
      }

      await fs.writeFile(this.metricsPath, JSON.stringify(metrics, null, 2));

      // Update baseline if needed
      await this.updateBaseline(metric);

    } catch (error) {
      this.logger.error('Failed to record metric', error as Error, { metric: metric.name });
    }
  }

  /**
   * Measure application startup time
   */
  async measureStartupTime(version?: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Simulate application startup operations
      await this.simulateStartupOperations();
      
      const duration = performance.now() - startTime;
      
      await this.recordMetric({
        name: 'startup_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { 
          version,
          environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production',
        },
      });

      return duration;
    } catch (error) {
      this.logger.error('Failed to measure startup time', error as Error);
      return -1;
    }
  }

  /**
   * Measure instruction generation performance
   */
  async measureInstructionGeneration(_instruction): Promise<number> {
    const startTime = performance.now();
    
    try {
      // The actual instruction generation would happen here
      // For now, we'll simulate the operation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
      
      const duration = performance.now() - startTime;
      
      await this.recordMetric({
        name: 'instruction_generation_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { 
          operation: 'generate_instruction',
          environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production',
        },
      });

      return duration;
    } catch (error) {
      this.logger.error('Failed to measure instruction generation', error as Error);
      return -1;
    }
  }

  /**
   * Measure session execution performance
   */
  async measureSessionExecution(sessionId: string, operation: ($1) => Promise<any>): Promise<{ duration: number; result: unknown }> {
    const startTime = performance.now();
    let result: unknown;

    try {
      result = await operation();
      const duration = performance.now() - startTime;
      
      await this.recordMetric({
        name: 'session_execution_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { 
          sessionId,
          operation: 'execute_session',
          environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production',
        },
      });

      return { duration, result };
    } catch (error) {
      const duration = performance.now() - startTime;
      
      await this.recordMetric({
        name: 'session_execution_time',
        value: duration,
        unit: 'ms',
        timestamp: new Date(),
        context: { 
          sessionId,
          operation: 'execute_session_failed',
          environment: this.config.instanceId === 'sessionhub-dev' ? 'development' : 'production',
        },
      });

      throw error;
    }
  }

  /**
   * Generate performance report for version validation
   */
  async generateReport(version: string): Promise<PerformanceReport> {
    this.logger.info('Generating performance report', { version });

    const metrics = await this.loadMetrics();
    const baselines = await this.loadBaselines();
    
    // Get recent metrics for this version
    const recentMetrics = metrics
      .filter(m => m.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .filter(m => !m.context.version || m.context.version === version);

    const comparisons = [];
    const regressions = [];
    const improvements = [];

    // Compare against baselines
    for (const baseline of baselines) {
      const relevantMetrics = recentMetrics.filter(m => m.name === baseline.metric);
      if (relevantMetrics.length === 0) continue;

      const avgValue = relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
      const change = avgValue - baseline.baseline;
      const changePercent = (change / baseline.baseline) * 100;
      const passed = Math.abs(change) <= baseline.threshold;

      const comparison = {
        metric: baseline.metric,
        current: avgValue,
        baseline: baseline.baseline,
        change,
        changePercent,
        passed,
        trend: baseline.trend,
      };

      comparisons.push(comparison);

      if (!passed && change > 0) {
        regressions.push(`${baseline.metric}: ${changePercent.toFixed(1)}% worse than baseline`);
      } else if (change < -baseline.threshold) {
        improvements.push(`${baseline.metric}: ${Math.abs(changePercent).toFixed(1)}% better than baseline`);
      }
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(comparisons);

    // Generate recommendations
    const recommendations = this.generateRecommendations(comparisons, regressions);

    const report: PerformanceReport = {
      version,
      timestamp: new Date(),
      metrics: recentMetrics,
      comparisons,
      overallScore,
      regressions,
      improvements,
      recommendations,
    };

    // Save report
    const reportPath = join(this.expandPath(this.config.dataDirectory), `performance-report-${version}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    this.logger.info('Performance report generated', {
      version,
      overallScore,
      regressions: regressions.length,
      improvements: improvements.length,
    });

    return report;
  }

  /**
   * Validate performance for deployment
   */
  async validateForDeployment(version: string): Promise<{ approved: boolean; reason: string; report: PerformanceReport }> {
    const report = await this.generateReport(version);
    
    let approved = true;
    let reason = 'Performance validation passed';

    // Check for critical regressions
    const criticalRegressions = report.comparisons.filter(c => 
      !c.passed && 
      (c.metric.includes('startup') || c.metric.includes('memory')) &&
      c.changePercent > 20
    );

    if (criticalRegressions.length > 0) {
      approved = false;
      reason = `Critical performance regressions detected: ${criticalRegressions.map(c => c.metric).join(', ')}`;
    }

    // Check overall score
    if (report.overallScore < 70) {
      approved = false;
      reason = `Overall performance score too low: ${report.overallScore}/100`;
    }

    // Check for too many regressions
    if (report.regressions.length > 3) {
      approved = false;
      reason = `Too many performance regressions: ${report.regressions.length}`;
    }

    this.logger.info('Performance validation result', {
      version,
      approved,
      reason,
      overallScore: report.overallScore,
    });

    return { approved, reason, report };
  }

  /**
   * Private helper methods
   */
  private async getCurrentResources(): Promise<SystemResource> {
    import os from 'os';
    // import process from 'process'; // Commented out for future use

    // Get CPU usage
    const cpus = os.cpus();
    const cpuUsage = await this.getCPUUsage();

    // Get memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get process memory
    // const processMemory = process.memoryUsage(); // Commented out for future use

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'unknown',
      },
      memory: {
        used: Math.round(usedMem / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        usage: Math.round((usedMem / totalMem) * 100),
      },
      disk: {
        used: 0, // Would need platform-specific implementation
        total: 0,
        usage: 0,
      },
      network: {
        bytesIn: 0, // Would need platform-specific implementation
        bytesOut: 0,
        connections: 0,
      },
    };
  }

  private async getCPUUsage(): Promise<number> {
    // import os from 'os'; // Commented out for future use
    
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        
        resolve(percentageCPU);
      }, 100);
    });
  }

  private cpuAverage(): { idle: number; total: number } {
    import os from 'os';
    let totalIdle = 0;
    let totalTick = 0;
    const cpus = os.cpus();

    for (let i = 0; i < cpus.length; i++) {
      for (const type in cpus[i].times) {
        totalTick += cpus[i].times[type];
      }
      totalIdle += cpus[i].times.idle;
    }

    return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
  }

  private async simulateStartupOperations(): Promise<void> {
    // Simulate typical startup operations
    await new Promise(resolve => setTimeout(resolve, 50)); // Config loading
    await new Promise(resolve => setTimeout(resolve, 30)); // Database connection
    await new Promise(resolve => setTimeout(resolve, 20)); // Service initialization
  }

  private async loadMetrics(): Promise<PerformanceMetric[]> {
    try {
      const content = await fs.readFile(this.metricsPath, 'utf-8');
      const metrics = JSON.parse(content);
      
      // Convert timestamp strings back to Date objects
      return metrics.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    } catch (error) {
      return [];
    }
  }

  private async loadBaselines(): Promise<PerformanceBaseline[]> {
    try {
      const content = await fs.readFile(this.baselinesPath, 'utf-8');
      const baselines = JSON.parse(content);
      
      return baselines.map((b) => ({
        ...b,
        lastUpdated: new Date(b.lastUpdated),
      }));
    } catch (error) {
      // Return default baselines
      return this.getDefaultBaselines();
    }
  }

  private getDefaultBaselines(): PerformanceBaseline[] {
    return [
      {
        metric: 'startup_time',
        baseline: 2000, // 2 seconds
        threshold: 500, // 500ms variance
        samples: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        metric: 'memory_usage',
        baseline: 60, // 60% memory usage
        threshold: 10, // 10% variance
        samples: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        metric: 'cpu_usage',
        baseline: 30, // 30% CPU usage
        threshold: 15, // 15% variance
        samples: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        metric: 'instruction_generation_time',
        baseline: 100, // 100ms
        threshold: 50, // 50ms variance
        samples: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      },
      {
        metric: 'session_execution_time',
        baseline: 5000, // 5 seconds
        threshold: 2000, // 2 second variance
        samples: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      },
    ];
  }

  private async updateBaseline(metric: PerformanceMetric): Promise<void> {
    const baselines = await this.loadBaselines();
    const baseline = baselines.find(b => b.metric === metric.name);

    if (baseline) {
      // Update baseline with exponential moving average
      const alpha = 0.1; // Smoothing factor
      baseline.baseline = baseline.baseline * (1 - alpha) + metric.value * alpha;
      baseline.samples++;
      baseline.lastUpdated = new Date();

      // Update trend
      if (metric.value < baseline.baseline * 0.95) {
        baseline.trend = 'improving';
      } else if (metric.value > baseline.baseline * 1.05) {
        baseline.trend = 'degrading';
      } else {
        baseline.trend = 'stable';
      }

      await fs.writeFile(this.baselinesPath, JSON.stringify(baselines, null, 2));
    }
  }

  private calculateOverallScore(comparisons: any[]): number {
    if (comparisons.length === 0) return 100;

    const weights = {
      startup_time: 0.25,
      memory_usage: 0.20,
      cpu_usage: 0.15,
      instruction_generation_time: 0.20,
      session_execution_time: 0.20,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const comparison of comparisons) {
      const weight = weights[comparison.metric as keyof typeof weights] || 0.1;
      const score = comparison.passed ? 100 : Math.max(0, 100 - Math.abs(comparison.changePercent));
      
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
  }

  private generateRecommendations(comparisons: any[], regressions: string[]): string[] {
    const recommendations: string[] = [];

    for (const comparison of comparisons) {
      if (!comparison.passed) {
        if (comparison.metric.includes('memory')) {
          recommendations.push('Consider optimizing memory usage - check for memory leaks or unnecessary allocations');
        } else if (comparison.metric.includes('startup')) {
          recommendations.push('Optimize startup time - review initialization procedures and lazy loading');
        } else if (comparison.metric.includes('cpu')) {
          recommendations.push('Reduce CPU usage - review algorithms and optimize performance-critical paths');
        }
      }
    }

    if (regressions.length > 2) {
      recommendations.push('Multiple performance regressions detected - consider reverting recent changes');
    }

    return recommendations;
  }

  private expandPath(path: string): string {
    return path.replace(/^~/, require('os').homedir());
  }
}