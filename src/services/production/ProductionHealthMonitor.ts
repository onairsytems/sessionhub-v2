/**
 * Production Health Monitoring Service
 * Real-time health monitoring and alerting for production deployment
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { performance } from 'perf_hooks';
import { MemoryOptimizationService } from '../performance/MemoryOptimizationService';
import { ScaleTestingService } from '../performance/ScaleTestingService';
import { SQLiteOptimizationService } from '../database/SQLiteOptimizationService';
import { AppleSiliconOptimization } from '../mac/AppleSiliconOptimization';
import { PRODUCTION_CONFIG } from '../../config/production.config';

interface HealthMetric {
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

interface HealthCheckResult {
  overall: 'healthy' | 'degraded' | 'critical';
  checks: {
    memory: HealthMetric;
    cpu: HealthMetric;
    disk: HealthMetric;
    database: HealthMetric;
    network: HealthMetric;
    energy: HealthMetric;
  };
  alerts: Alert[];
  timestamp: Date;
}

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
}

interface MonitoringConfig {
  checkInterval: number;
  alertThresholds: {
    cpu: { warning: number; critical: number };
    memory: { warning: number; critical: number };
    disk: { warning: number; critical: number };
    responseTime: { warning: number; critical: number };
  };
  endpoints: string[];
  telemetryEnabled: boolean;
  autoRecovery: boolean;
}

export class ProductionHealthMonitor extends EventEmitter {
  private static instance: ProductionHealthMonitor;
  private memoryService!: MemoryOptimizationService;
  private scaleService!: ScaleTestingService;
  private sqliteService!: SQLiteOptimizationService;
  private siliconService!: AppleSiliconOptimization;
  
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alerts: Map<string, Alert> = new Map();
  private metrics: HealthMetric[] = [];
  private config: MonitoringConfig;

  private readonly defaultConfig: MonitoringConfig = {
    checkInterval: 60000, // 1 minute
    alertThresholds: {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 75, critical: 85 },
      disk: { warning: 80, critical: 90 },
      responseTime: { warning: 1000, critical: 5000 }, // ms
    },
    endpoints: PRODUCTION_CONFIG.monitoring.healthChecks.endpoints,
    telemetryEnabled: PRODUCTION_CONFIG.monitoring.telemetry.enabled,
    autoRecovery: true,
  };

  private constructor() {
    super();
    this.config = this.defaultConfig;
    this.initializeServices();
  }

  static getInstance(): ProductionHealthMonitor {
    if (!ProductionHealthMonitor.instance) {
      ProductionHealthMonitor.instance = new ProductionHealthMonitor();
    }
    return ProductionHealthMonitor.instance;
  }

  private initializeServices(): void {
    this.memoryService = MemoryOptimizationService.getInstance();
    this.scaleService = ScaleTestingService.getInstance();
    this.sqliteService = SQLiteOptimizationService.getInstance();
    this.siliconService = AppleSiliconOptimization.getInstance();
  }

  async startMonitoring(config?: Partial<MonitoringConfig>): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.config = { ...this.defaultConfig, ...config };
    this.isMonitoring = true;

    // Start component monitoring
    this.memoryService.startMonitoring(10000);
    this.scaleService.startMonitoring(10000);
    this.sqliteService.startHealthMonitoring(300000); // 5 minutes
    await this.siliconService.startPowerMonitoring(30000);

    // Start health check loop
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkInterval);

    // Perform initial check
    await this.performHealthCheck();

    this.emit('monitoring-started', { config: this.config });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Stop component monitoring
    this.memoryService.stopMonitoring();
    this.scaleService.stopMonitoring();
    this.sqliteService.stopHealthMonitoring();
    this.siliconService.stopPowerMonitoring();

    this.emit('monitoring-stopped');
  }

  private async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checks = await Promise.all([
      this.checkMemoryHealth(),
      this.checkCPUHealth(),
      this.checkDiskHealth(),
      this.checkDatabaseHealth(),
      this.checkNetworkHealth(),
      this.checkEnergyEfficiency(),
    ]);

    const [memory, cpu, disk, database, network, energy] = checks;

    // Determine overall health
    const criticalCount = checks.filter(c => c.status === 'critical').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    let overall: 'healthy' | 'degraded' | 'critical';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (warningCount > 1) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const result: HealthCheckResult = {
      overall,
      checks: {
        memory,
        cpu,
        disk,
        database,
        network,
        energy,
      },
      alerts: Array.from(this.alerts.values()).filter(a => !a.resolved),
      timestamp: new Date(),
    };

    // Store metrics
    this.storeMetrics(checks);

    // Process alerts
    this.processAlerts(result);

    // Auto-recovery if enabled
    if (this.config.autoRecovery && overall === 'critical') {
      await this.attemptAutoRecovery(result);
    }

    // Send telemetry if enabled
    if (this.config.telemetryEnabled) {
      await this.sendTelemetry(result);
    }

    const checkDuration = performance.now() - startTime;
    this.emit('health-check-complete', { result, duration: checkDuration });

    return result;
  }

  private async checkMemoryHealth(): Promise<HealthMetric> {
    const memStats = this.memoryService.getMemoryStats();
    const heapUsedPercent = (memStats.current.heapUsed / memStats.heap.heapSizeLimit) * 100;

    let status: 'healthy' | 'warning' | 'critical';
    if (heapUsedPercent >= this.config.alertThresholds.memory.critical) {
      status = 'critical';
    } else if (heapUsedPercent >= this.config.alertThresholds.memory.warning) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name: 'memory',
      value: Math.round(heapUsedPercent),
      unit: '%',
      threshold: this.config.alertThresholds.memory.warning,
      status,
      timestamp: new Date(),
    };
  }

  private async checkCPUHealth(): Promise<HealthMetric> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - Math.floor(idle * 100 / total);

    let status: 'healthy' | 'warning' | 'critical';
    if (usage >= this.config.alertThresholds.cpu.critical) {
      status = 'critical';
    } else if (usage >= this.config.alertThresholds.cpu.warning) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name: 'cpu',
      value: usage,
      unit: '%',
      threshold: this.config.alertThresholds.cpu.warning,
      status,
      timestamp: new Date(),
    };
  }

  private async checkDiskHealth(): Promise<HealthMetric> {
    // Simplified disk check - in production use proper disk space APIs
    const homeDir = os.homedir();
    const sessionHubDir = path.join(homeDir, '.sessionhub');

    try {
      const stats = await fs.promises.statfs(sessionHubDir).catch(() => null);
      if (!stats) {
        return {
          name: 'disk',
          value: 0,
          unit: '%',
          threshold: this.config.alertThresholds.disk.warning,
          status: 'healthy',
          timestamp: new Date(),
        };
      }

      const used = stats.blocks - stats.bfree;
      const usagePercent = (used / stats.blocks) * 100;

      let status: 'healthy' | 'warning' | 'critical';
      if (usagePercent >= this.config.alertThresholds.disk.critical) {
        status = 'critical';
      } else if (usagePercent >= this.config.alertThresholds.disk.warning) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        name: 'disk',
        value: Math.round(usagePercent),
        unit: '%',
        threshold: this.config.alertThresholds.disk.warning,
        status,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'disk',
        value: 0,
        unit: '%',
        threshold: this.config.alertThresholds.disk.warning,
        status: 'healthy',
        timestamp: new Date(),
      };
    }
  }

  private async checkDatabaseHealth(): Promise<HealthMetric> {
    const dbHealth = await this.sqliteService.getDatabaseHealth();
    const fragmentationPercent = dbHealth.fragmentationRatio * 100;

    let status: 'healthy' | 'warning' | 'critical';
    if (fragmentationPercent > 50) {
      status = 'critical';
    } else if (fragmentationPercent > 20) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name: 'database',
      value: Math.round(fragmentationPercent),
      unit: '%',
      threshold: 20,
      status,
      timestamp: new Date(),
    };
  }

  private async checkNetworkHealth(): Promise<HealthMetric> {
    const results = await Promise.all(
      this.config.endpoints.map(endpoint => this.checkEndpoint(endpoint))
    );

    const avgResponseTime = results.reduce((sum, r) => sum + r, 0) / results.length;

    let status: 'healthy' | 'warning' | 'critical';
    if (avgResponseTime >= this.config.alertThresholds.responseTime.critical) {
      status = 'critical';
    } else if (avgResponseTime >= this.config.alertThresholds.responseTime.warning) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name: 'network',
      value: Math.round(avgResponseTime),
      unit: 'ms',
      threshold: this.config.alertThresholds.responseTime.warning,
      status,
      timestamp: new Date(),
    };
  }

  private async checkEndpoint(endpoint: string): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const timeout = setTimeout(() => {
        resolve(this.config.alertThresholds.responseTime.critical);
      }, 10000);

      https.get(endpoint, (res) => {
        clearTimeout(timeout);
        const responseTime = performance.now() - startTime;
        
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(responseTime);
        } else {
          resolve(this.config.alertThresholds.responseTime.critical);
        }
        
        // Consume response data
        res.on('data', () => {});
        res.on('end', () => {});
      }).on('error', () => {
        clearTimeout(timeout);
        resolve(this.config.alertThresholds.responseTime.critical);
      });
    });
  }

  private async checkEnergyEfficiency(): Promise<HealthMetric> {
    // This is platform-specific
    if (process.platform !== 'darwin') {
      return {
        name: 'energy',
        value: 0,
        unit: 'impact',
        threshold: 50,
        status: 'healthy',
        timestamp: new Date(),
      };
    }

    // For macOS, we would check energy impact
    // Simplified version - in production use proper APIs
    const cpuUsage = os.loadavg()[0];
    const energyImpact = (cpuUsage || 0) * 10; // Simplified calculation

    let status: 'healthy' | 'warning' | 'critical';
    if (energyImpact > 80) {
      status = 'critical';
    } else if (energyImpact > 50) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return {
      name: 'energy',
      value: Math.round(energyImpact),
      unit: 'impact',
      threshold: 50,
      status,
      timestamp: new Date(),
    };
  }

  private storeMetrics(metrics: HealthMetric[]): void {
    this.metrics.push(...metrics);

    // Keep only last 24 hours of metrics
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);
  }

  private processAlerts(result: HealthCheckResult): void {
    // Check for new critical conditions
    Object.entries(result.checks).forEach(([category, metric]) => {
      const alertId = `${category}-${metric.status}`;

      if (metric.status === 'critical') {
        if (!this.alerts.has(alertId)) {
          const alert: Alert = {
            id: alertId,
            level: 'critical',
            category,
            message: `${category} health check failed: ${metric.value}${metric.unit} exceeds threshold of ${metric.threshold}${metric.unit}`,
            details: metric,
            timestamp: new Date(),
            resolved: false,
          };
          this.alerts.set(alertId, alert);
          this.emit('alert-raised', alert);
        }
      } else if (metric.status === 'warning') {
        if (!this.alerts.has(alertId)) {
          const alert: Alert = {
            id: alertId,
            level: 'warning',
            category,
            message: `${category} health check warning: ${metric.value}${metric.unit} approaching threshold of ${metric.threshold}${metric.unit}`,
            details: metric,
            timestamp: new Date(),
            resolved: false,
          };
          this.alerts.set(alertId, alert);
          this.emit('alert-raised', alert);
        }
      } else {
        // Resolve any existing alerts for this category
        const existingAlerts = Array.from(this.alerts.values()).filter(
          a => a.category === category && !a.resolved
        );
        existingAlerts.forEach(alert => {
          alert.resolved = true;
          this.emit('alert-resolved', alert);
        });
      }
    });
  }

  private async attemptAutoRecovery(result: HealthCheckResult): Promise<void> {
    this.emit('auto-recovery-started', result);

    const recoveryActions: Promise<any>[] = [];

    // Memory recovery
    if (result.checks.memory.status === 'critical') {
      recoveryActions.push(this.recoverMemory());
    }

    // Database recovery
    if (result.checks.database.status === 'critical') {
      recoveryActions.push(this.recoverDatabase());
    }

    // CPU recovery
    if (result.checks.cpu.status === 'critical') {
      recoveryActions.push(this.recoverCPU());
    }

    await Promise.allSettled(recoveryActions);

    this.emit('auto-recovery-completed');
  }

  private async recoverMemory(): Promise<void> {
    // Force garbage collection
    this.memoryService.forceOptimize();
    if (global.gc) {
      global.gc();
    }

    // Clear caches
    this.emit('recovery-action', { type: 'memory', action: 'cache-clear' });
  }

  private async recoverDatabase(): Promise<void> {
    // Perform database maintenance
    await this.sqliteService.performMaintenance();
    this.emit('recovery-action', { type: 'database', action: 'maintenance' });
  }

  private async recoverCPU(): Promise<void> {
    // Switch to efficiency mode
    await this.siliconService.setPerformanceProfile('efficiency');
    this.emit('recovery-action', { type: 'cpu', action: 'efficiency-mode' });
  }

  private async sendTelemetry(result: HealthCheckResult): Promise<void> {
    if (!this.config.telemetryEnabled) {
      return;
    }

    const telemetryData = {
      timestamp: result.timestamp,
      overall: result.overall,
      metrics: Object.entries(result.checks).reduce((acc, [key, metric]) => {
        acc[key] = {
          value: metric.value,
          status: metric.status,
        };
        return acc;
      }, {} as any),
      alerts: result.alerts.length,
      platform: os.platform(),
      version: process.env['npm_package_version'] || '1.0.0',
    };

    // In production, send to telemetry endpoint
    this.emit('telemetry-sent', telemetryData);
  }

  // Public API
  async getHealthStatus(): Promise<HealthCheckResult> {
    return await this.performHealthCheck();
  }

  getAlerts(includeResolved: boolean = false): Alert[] {
    return Array.from(this.alerts.values()).filter(
      a => includeResolved || !a.resolved
    );
  }

  getMetricHistory(metricName: string, hours: number = 24): HealthMetric[] {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(
      m => m.name === metricName && m.timestamp > since
    );
  }

  async generateHealthReport(): Promise<any> {
    const currentHealth = await this.getHealthStatus();
    const alerts = this.getAlerts(true);
    const criticalAlerts = alerts.filter(a => a.level === 'critical');
    const warningAlerts = alerts.filter(a => a.level === 'warning');

    // Calculate uptime
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);

    // Calculate averages
    const last24Hours = this.metrics.filter(
      m => m.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const avgCPU = this.calculateAverage(last24Hours.filter(m => m.name === 'cpu'));
    const avgMemory = this.calculateAverage(last24Hours.filter(m => m.name === 'memory'));

    return {
      timestamp: new Date().toISOString(),
      status: currentHealth.overall,
      uptime: {
        days: uptimeDays,
        hours: uptimeHours,
        total: uptimeSeconds,
      },
      currentHealth: currentHealth.checks,
      averages: {
        cpu: avgCPU,
        memory: avgMemory,
      },
      alerts: {
        total: alerts.length,
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        resolved: alerts.filter(a => a.resolved).length,
      },
      recommendations: this.generateRecommendations(currentHealth),
    };
  }

  private calculateAverage(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return Math.round(sum / metrics.length);
  }

  private generateRecommendations(health: HealthCheckResult): string[] {
    const recommendations: string[] = [];

    if (health.checks.memory.status !== 'healthy') {
      recommendations.push('Consider increasing heap size or optimizing memory usage');
    }

    if (health.checks.cpu.status !== 'healthy') {
      recommendations.push('Review CPU-intensive operations and consider load balancing');
    }

    if (health.checks.database.status !== 'healthy') {
      recommendations.push('Schedule database maintenance during low-traffic periods');
    }

    if (health.checks.energy.status !== 'healthy') {
      recommendations.push('Enable efficiency mode to reduce energy consumption');
    }

    if (health.overall === 'critical') {
      recommendations.push('URGENT: System health is critical. Consider immediate intervention.');
    }

    return recommendations;
  }

  // Cleanup
  dispose(): void {
    this.stopMonitoring();
    this.alerts.clear();
    this.metrics = [];
    this.removeAllListeners();
  }
}

// Export singleton
export const productionHealthMonitor = ProductionHealthMonitor.getInstance();