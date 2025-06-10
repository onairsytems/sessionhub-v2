/**
 * Production Monitoring Dashboard for SessionHub
 * 
 * Real-time monitoring, alerting, and diagnostics for production environments.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { WebSocketServer } from 'ws';
import { ErrorRecoverySystem } from '../recovery/ErrorRecoverySystem';
import { DatabaseService } from '../../database/DatabaseService';

export interface SystemMetrics {
  timestamp: Date;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  process: ProcessMetrics;
  application: ApplicationMetrics;
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
  temperature?: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface DiskMetrics {
  read: number;
  write: number;
  usage: DiskUsage[];
}

export interface DiskUsage {
  filesystem: string;
  used: number;
  available: number;
  percentage: number;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  activeConnections: number;
  errors: number;
}

export interface ProcessMetrics {
  uptime: number;
  pid: number;
  handles: number;
  threads: number;
}

export interface ApplicationMetrics {
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  apiCalls: APICallMetrics;
  errors: ErrorMetrics;
  performance: PerformanceMetrics;
}

export interface APICallMetrics {
  total: number;
  successful: number;
  failed: number;
  averageLatency: number;
  byEndpoint: Record<string, EndpointMetrics>;
}

export interface EndpointMetrics {
  calls: number;
  errors: number;
  latency: number;
}

export interface ErrorMetrics {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  recoveryRate: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  component: string;
  metrics?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export enum AlertType {
  CPU_HIGH = 'cpu_high',
  MEMORY_HIGH = 'memory_high',
  DISK_FULL = 'disk_full',
  ERROR_RATE_HIGH = 'error_rate_high',
  API_LATENCY_HIGH = 'api_latency_high',
  SESSION_FAILURE = 'session_failure',
  RECOVERY_FAILURE = 'recovery_failure',
  HEALTH_CHECK_FAILURE = 'health_check_failure'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AlertRule {
  id: string;
  type: AlertType;
  condition: (metrics: SystemMetrics) => boolean;
  severity: AlertSeverity;
  cooldown: number; // milliseconds
  action?: (alert: Alert) => Promise<void>;
}

export interface DiagnosticReport {
  id: string;
  timestamp: Date;
  systemHealth: SystemHealth;
  issues: DiagnosticIssue[];
  recommendations: Recommendation[];
  metrics: SystemMetrics;
}

export interface SystemHealth {
  overall: HealthStatus;
  components: Record<string, ComponentHealth>;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  FAILED = 'failed'
}

export interface ComponentHealth {
  status: HealthStatus;
  lastCheck: Date;
  issues: string[];
}

export interface DiagnosticIssue {
  id: string;
  component: string;
  type: string;
  severity: AlertSeverity;
  description: string;
  impact: string;
  evidence: Record<string, any>;
}

export interface Recommendation {
  issue: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  automated: boolean;
  script?: string;
}

export class ProductionMonitoringDashboard extends EventEmitter {
  private wsServer?: WebSocketServer;
  private metricsHistory: SystemMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  
  private recoverySystem: ErrorRecoverySystem;
  private database: DatabaseService;
  
  private metricsInterval?: NodeJS.Timeout;
  private diagnosticsInterval?: NodeJS.Timeout;
  
  private readonly maxMetricsHistory = 1440; // 24 hours at 1-minute intervals
  private readonly metricsIntervalMs = 60000; // 1 minute
  private readonly diagnosticsIntervalMs = 300000; // 5 minutes

  constructor(
    recoverySystem: ErrorRecoverySystem,
    database: DatabaseService,
    wsPort?: number
  ) {
    super();
    this.recoverySystem = recoverySystem;
    this.database = database;
    
    this.initializeAlertRules();
    this.startMetricsCollection();
    this.startDiagnostics();
    
    if (wsPort) {
      this.startWebSocketServer(wsPort);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    // CPU Alert Rule
    this.addAlertRule({
      id: 'cpu-high',
      type: AlertType.CPU_HIGH,
      condition: (metrics) => metrics.cpu.usage > 85,
      severity: AlertSeverity.WARNING,
      cooldown: 300000 // 5 minutes
    });

    // Memory Alert Rule
    this.addAlertRule({
      id: 'memory-high',
      type: AlertType.MEMORY_HIGH,
      condition: (metrics) => metrics.memory.percentage > 90,
      severity: AlertSeverity.ERROR,
      cooldown: 300000
    });

    // Disk Alert Rule
    this.addAlertRule({
      id: 'disk-full',
      type: AlertType.DISK_FULL,
      condition: (metrics) => 
        metrics.disk.usage.some(disk => disk.percentage > 95),
      severity: AlertSeverity.CRITICAL,
      cooldown: 600000 // 10 minutes
    });

    // Error Rate Alert Rule
    this.addAlertRule({
      id: 'error-rate-high',
      type: AlertType.ERROR_RATE_HIGH,
      condition: (metrics) => {
        const errorRate = metrics.application.errors.total / 
          (metrics.application.apiCalls.total || 1);
        return errorRate > 0.05; // 5% error rate
      },
      severity: AlertSeverity.ERROR,
      cooldown: 180000 // 3 minutes
    });

    // API Latency Alert Rule
    this.addAlertRule({
      id: 'api-latency-high',
      type: AlertType.API_LATENCY_HIGH,
      condition: (metrics) => 
        metrics.application.apiCalls.averageLatency > 3000, // 3 seconds
      severity: AlertSeverity.WARNING,
      cooldown: 300000
    });

    // Session Failure Alert Rule
    this.addAlertRule({
      id: 'session-failure-high',
      type: AlertType.SESSION_FAILURE,
      condition: (metrics) => {
        const failureRate = metrics.application.failedSessions / 
          (metrics.application.completedSessions + metrics.application.failedSessions || 1);
        return failureRate > 0.1; // 10% failure rate
      },
      severity: AlertSeverity.ERROR,
      cooldown: 600000
    });
  }

  /**
   * Add custom alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit('alertRuleAdded', rule);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.collectMetrics(); // Initial collection
    
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.metricsIntervalMs);
  }

  /**
   * Start diagnostics
   */
  private startDiagnostics(): void {
    this.runDiagnostics(); // Initial run
    
    this.diagnosticsInterval = setInterval(() => {
      this.runDiagnostics();
    }, this.diagnosticsIntervalMs);
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    const metrics = await this.gatherSystemMetrics();
    
    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxMetricsHistory) {
      this.metricsHistory.shift();
    }
    
    // Check alert rules
    this.checkAlertRules(metrics);
    
    // Broadcast to connected clients
    this.broadcastMetrics(metrics);
    
    // Store in database for historical analysis
    await this.storeMetrics(metrics);
    
    this.emit('metricsCollected', metrics);
  }

  /**
   * Gather system metrics
   */
  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memUsage = process.memoryUsage();
    
    // CPU usage calculation
    const cpuUsage = await this.calculateCPUUsage();
    
    // Application metrics
    const appMetrics = await this.gatherApplicationMetrics();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage,
        loadAverage: os.loadavg(),
        cores: cpus.length
      },
      memory: {
        used: totalMemory - freeMemory,
        total: totalMemory,
        percentage: ((totalMemory - freeMemory) / totalMemory) * 100,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      disk: await this.gatherDiskMetrics(),
      network: await this.gatherNetworkMetrics(),
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        handles: (process as any).getActiveHandles?.().length || 0,
        threads: (process as any).getActiveRequests?.().length || 0
      },
      application: appMetrics
    };
  }

  /**
   * Calculate CPU usage
   */
  private async calculateCPUUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endUsage = process.cpuUsage(startUsage);
    const endTime = process.hrtime(startTime);
    
    const cpuTime = (endUsage.user + endUsage.system) / 1000; // microseconds to milliseconds
    const realTime = endTime[0] * 1000 + endTime[1] / 1000000; // seconds and nanoseconds to milliseconds
    
    return (cpuTime / realTime) * 100;
  }

  /**
   * Gather disk metrics
   */
  private async gatherDiskMetrics(): Promise<DiskMetrics> {
    // This would need platform-specific implementation
    // For now, returning mock data
    return {
      read: 0,
      write: 0,
      usage: [{
        filesystem: '/',
        used: 50 * 1024 * 1024 * 1024, // 50GB
        available: 100 * 1024 * 1024 * 1024, // 100GB
        percentage: 33.3
      }]
    };
  }

  /**
   * Gather network metrics
   */
  private async gatherNetworkMetrics(): Promise<NetworkMetrics> {
    // This would need platform-specific implementation
    return {
      bytesReceived: 0,
      bytesSent: 0,
      activeConnections: 0,
      errors: 0
    };
  }

  /**
   * Gather application metrics
   */
  private async gatherApplicationMetrics(): Promise<ApplicationMetrics> {
    const sessions = await this.database.getSessionMetrics('current');
    const errors = this.recoverySystem.getErrorHistory(1000);
    const recoveryHistory = this.recoverySystem.getRecoveryHistory(100);
    
    // Calculate error metrics
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    
    for (const error of errors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }
    
    const successfulRecoveries = recoveryHistory.filter(r => r.success).length;
    const recoveryRate = recoveryHistory.length > 0 
      ? successfulRecoveries / recoveryHistory.length 
      : 1;
    
    // Process sessions data
    const activeSessions = sessions.filter((s: any) => s.status === 'active').length;
    const completedSessions = sessions.filter((s: any) => s.status === 'completed').length;
    const failedSessions = sessions.filter((s: any) => s.status === 'failed').length;
    
    return {
      activeSessions,
      completedSessions,
      failedSessions,
      apiCalls: {
        total: 0, // Would track actual API calls
        successful: 0,
        failed: 0,
        averageLatency: 0,
        byEndpoint: {}
      },
      errors: {
        total: errors.length,
        byType: errorsByType,
        bySeverity: errorsBySeverity,
        recoveryRate
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0
      }
    };
  }

  /**
   * Check alert rules
   */
  private checkAlertRules(metrics: SystemMetrics): void {
    for (const rule of this.alertRules.values()) {
      const lastAlert = this.lastAlertTime.get(rule.id) || 0;
      const now = Date.now();
      
      // Check cooldown
      if (now - lastAlert < rule.cooldown) {
        continue;
      }
      
      // Check condition
      if (rule.condition(metrics)) {
        const alert: Alert = {
          id: `${rule.type}-${now}`,
          type: rule.type,
          severity: rule.severity,
          message: this.generateAlertMessage(rule.type, metrics),
          timestamp: new Date(),
          component: this.getComponentForAlertType(rule.type),
          metrics: this.getRelevantMetrics(rule.type, metrics),
          resolved: false
        };
        
        this.alerts.set(alert.id, alert);
        this.lastAlertTime.set(rule.id, now);
        
        this.emit('alertTriggered', alert);
        
        // Execute action if defined
        if (rule.action) {
          rule.action(alert).catch(error => {
            this.emit('alertActionFailed', { alert, error });
          });
        }
      }
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(type: AlertType, metrics: SystemMetrics): string {
    switch (type) {
      case AlertType.CPU_HIGH:
        return `CPU usage is high: ${metrics.cpu.usage.toFixed(1)}%`;
      case AlertType.MEMORY_HIGH:
        return `Memory usage is high: ${metrics.memory.percentage.toFixed(1)}%`;
      case AlertType.DISK_FULL:
        const fullDisk = metrics.disk.usage.find(d => d.percentage > 95);
        return `Disk space is critically low on ${fullDisk?.filesystem}: ${fullDisk?.percentage.toFixed(1)}%`;
      case AlertType.ERROR_RATE_HIGH:
        const errorRate = (metrics.application.errors.total / metrics.application.apiCalls.total) * 100;
        return `Error rate is high: ${errorRate.toFixed(1)}%`;
      case AlertType.API_LATENCY_HIGH:
        return `API latency is high: ${metrics.application.apiCalls.averageLatency}ms`;
      case AlertType.SESSION_FAILURE:
        const failureRate = (metrics.application.failedSessions / 
          (metrics.application.completedSessions + metrics.application.failedSessions)) * 100;
        return `Session failure rate is high: ${failureRate.toFixed(1)}%`;
      default:
        return `Alert triggered: ${type}`;
    }
  }

  /**
   * Get component for alert type
   */
  private getComponentForAlertType(type: AlertType): string {
    const mapping: Record<AlertType, string> = {
      [AlertType.CPU_HIGH]: 'cpu',
      [AlertType.MEMORY_HIGH]: 'memory',
      [AlertType.DISK_FULL]: 'disk',
      [AlertType.ERROR_RATE_HIGH]: 'application',
      [AlertType.API_LATENCY_HIGH]: 'api',
      [AlertType.SESSION_FAILURE]: 'sessions',
      [AlertType.RECOVERY_FAILURE]: 'recovery',
      [AlertType.HEALTH_CHECK_FAILURE]: 'health'
    };
    
    return mapping[type] || 'unknown';
  }

  /**
   * Get relevant metrics for alert
   */
  private getRelevantMetrics(type: AlertType, metrics: SystemMetrics): Record<string, any> {
    switch (type) {
      case AlertType.CPU_HIGH:
        return metrics.cpu;
      case AlertType.MEMORY_HIGH:
        return metrics.memory;
      case AlertType.DISK_FULL:
        return metrics.disk;
      case AlertType.ERROR_RATE_HIGH:
      case AlertType.SESSION_FAILURE:
        return metrics.application;
      case AlertType.API_LATENCY_HIGH:
        return metrics.application.apiCalls;
      default:
        return {};
    }
  }

  /**
   * Run diagnostics
   */
  private async runDiagnostics(): Promise<void> {
    const report = await this.generateDiagnosticReport();
    
    // Auto-heal if possible
    for (const recommendation of report.recommendations) {
      if (recommendation.automated && recommendation.script) {
        try {
          await this.executeRecommendation(recommendation);
          this.emit('autoHealExecuted', recommendation);
        } catch (error) {
          this.emit('autoHealFailed', { recommendation, error });
        }
      }
    }
    
    this.emit('diagnosticsCompleted', report);
  }

  /**
   * Generate diagnostic report
   */
  private async generateDiagnosticReport(): Promise<DiagnosticReport> {
    let currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!currentMetrics) {
      await this.collectMetrics();
      currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    }
    const issues: DiagnosticIssue[] = [];
    const recommendations: Recommendation[] = [];
    
    // Check system health
    const systemHealth = await this.assessSystemHealth();
    
    // Analyze metrics trends
    if (this.metricsHistory.length > 10) {
      const cpuTrend = this.analyzeTrend(this.metricsHistory.map(m => m.cpu.usage));
      if (cpuTrend.increasing && cpuTrend.average > 70) {
        issues.push({
          id: 'cpu-trend-high',
          component: 'cpu',
          type: 'performance',
          severity: AlertSeverity.WARNING,
          description: 'CPU usage shows increasing trend',
          impact: 'System may become unresponsive',
          evidence: { trend: cpuTrend }
        });
        
        recommendations.push({
          issue: 'cpu-trend-high',
          action: 'Identify and optimize CPU-intensive operations',
          priority: 'high',
          automated: false
        });
      }
      
      const memoryTrend = this.analyzeTrend(this.metricsHistory.map(m => m.memory.percentage));
      if (memoryTrend.increasing && memoryTrend.average > 80) {
        issues.push({
          id: 'memory-leak-suspected',
          component: 'memory',
          type: 'resource-leak',
          severity: AlertSeverity.ERROR,
          description: 'Possible memory leak detected',
          impact: 'Application may crash due to out of memory',
          evidence: { trend: memoryTrend }
        });
        
        recommendations.push({
          issue: 'memory-leak-suspected',
          action: 'Force garbage collection and clear caches',
          priority: 'urgent',
          automated: true,
          script: 'clearMemory'
        });
      }
    }
    
    // Check error patterns
    const recentErrors = this.recoverySystem.getErrorHistory(100);
    const errorPatterns = this.analyzeErrorPatterns(recentErrors);
    
    for (const [errorType, count] of Object.entries(errorPatterns)) {
      if (count > 10) {
        issues.push({
          id: `recurring-error-${errorType}`,
          component: 'error-handling',
          type: 'reliability',
          severity: AlertSeverity.ERROR,
          description: `Recurring ${errorType} errors detected`,
          impact: 'System reliability degraded',
          evidence: { errorType, count }
        });
        
        recommendations.push({
          issue: `recurring-error-${errorType}`,
          action: `Investigate and fix root cause of ${errorType} errors`,
          priority: 'high',
          automated: false
        });
      }
    }
    
    return {
      id: `diagnostic-${Date.now()}`,
      timestamp: new Date(),
      systemHealth,
      issues,
      recommendations,
      metrics: currentMetrics!
    };
  }

  /**
   * Assess system health
   */
  private async assessSystemHealth(): Promise<SystemHealth> {
    const components: Record<string, ComponentHealth> = {};
    
    // CPU Health
    const cpuUsage = this.metricsHistory[this.metricsHistory.length - 1]?.cpu.usage || 0;
    components['cpu'] = {
      status: cpuUsage < 70 ? HealthStatus.HEALTHY : 
              cpuUsage < 85 ? HealthStatus.DEGRADED : 
              HealthStatus.CRITICAL,
      lastCheck: new Date(),
      issues: cpuUsage > 70 ? [`High CPU usage: ${cpuUsage.toFixed(1)}%`] : []
    };
    
    // Memory Health
    const memUsage = this.metricsHistory[this.metricsHistory.length - 1]?.memory.percentage || 0;
    components['memory'] = {
      status: memUsage < 80 ? HealthStatus.HEALTHY : 
              memUsage < 90 ? HealthStatus.DEGRADED : 
              HealthStatus.CRITICAL,
      lastCheck: new Date(),
      issues: memUsage > 80 ? [`High memory usage: ${memUsage.toFixed(1)}%`] : []
    };
    
    // Database Health
    const dbHealth = this.recoverySystem.getHealthStatus()['database'];
    components['database'] = {
      status: dbHealth?.status === 'healthy' ? HealthStatus.HEALTHY : 
              dbHealth?.status === 'degraded' ? HealthStatus.DEGRADED : 
              HealthStatus.FAILED,
      lastCheck: dbHealth?.lastCheck || new Date(),
      issues: dbHealth?.status !== 'healthy' ? ['Database connection issues'] : []
    };
    
    // Calculate overall health
    const statuses = Object.values(components).map(c => c.status);
    let overall: HealthStatus;
    
    if (statuses.some(s => s === HealthStatus.FAILED)) {
      overall = HealthStatus.FAILED;
    } else if (statuses.some(s => s === HealthStatus.CRITICAL)) {
      overall = HealthStatus.CRITICAL;
    } else if (statuses.some(s => s === HealthStatus.DEGRADED)) {
      overall = HealthStatus.DEGRADED;
    } else {
      overall = HealthStatus.HEALTHY;
    }
    
    return { overall, components };
  }

  /**
   * Analyze trend in metrics
   */
  private analyzeTrend(values: number[]): { increasing: boolean; average: number; slope: number } {
    if (values.length < 2) {
      return { increasing: false, average: values[0] || 0, slope: 0 };
    }
    
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * (i + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return {
      increasing: slope > 0,
      average,
      slope
    };
  }

  /**
   * Analyze error patterns
   */
  private analyzeErrorPatterns(errors: any[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    for (const error of errors) {
      patterns[error.type] = (patterns[error.type] || 0) + 1;
    }
    
    return patterns;
  }

  /**
   * Execute recommendation
   */
  private async executeRecommendation(recommendation: Recommendation): Promise<void> {
    switch (recommendation.script) {
      case 'clearMemory':
        if (global.gc) {
          global.gc();
        }
        // Clear application caches
        break;
      
      // Add more automated actions as needed
    }
  }

  /**
   * Start WebSocket server for real-time dashboard
   */
  private startWebSocketServer(port: number): void {
    this.wsServer = new WebSocketServer({ port });
    
    this.wsServer.on('connection', (ws) => {
      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: {
          metrics: this.metricsHistory.slice(-60), // Last hour
          alerts: Array.from(this.alerts.values()),
          health: this.assessSystemHealth()
        }
      }));
      
      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message' }));
        }
      });
    });
  }

  /**
   * Handle client WebSocket message
   */
  private handleClientMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'getMetrics':
        ws.send(JSON.stringify({
          type: 'metrics',
          data: this.metricsHistory.slice(-(data.limit || 60))
        }));
        break;
      
      case 'getAlerts':
        ws.send(JSON.stringify({
          type: 'alerts',
          data: Array.from(this.alerts.values())
        }));
        break;
      
      case 'resolveAlert':
        const alert = this.alerts.get(data.alertId);
        if (alert) {
          alert.resolved = true;
          alert.resolvedAt = new Date();
          ws.send(JSON.stringify({
            type: 'alertResolved',
            data: alert
          }));
        }
        break;
      
      case 'runDiagnostics':
        this.runDiagnostics().then(() => {
          ws.send(JSON.stringify({
            type: 'diagnosticsComplete',
            data: true
          }));
        });
        break;
    }
  }

  /**
   * Broadcast metrics to all connected clients
   */
  private broadcastMetrics(metrics: SystemMetrics): void {
    if (!this.wsServer) return;
    
    const message = JSON.stringify({
      type: 'metricsUpdate',
      data: metrics
    });
    
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    // Store metrics for historical analysis
    await this.database.storeMetrics(metrics);
  }

  /**
   * Get current dashboard state
   */
  public getDashboardState(): any {
    return {
      metrics: this.metricsHistory.slice(-60),
      alerts: Array.from(this.alerts.values()),
      health: this.assessSystemHealth(),
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Shutdown monitoring
   */
  public async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.diagnosticsInterval) {
      clearInterval(this.diagnosticsInterval);
    }
    
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    this.emit('shutdown');
  }
}