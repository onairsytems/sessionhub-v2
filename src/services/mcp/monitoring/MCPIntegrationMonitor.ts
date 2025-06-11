import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';

type MCPIntegration = any; // TODO: Define proper type
import { MCPIntegrationService } from '../core/MCPIntegrationManager';
import { Logger } from '../../../lib/logging/Logger';
import * as os from 'os';

export interface IntegrationHealth {
  integrationId: string;
  integrationName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  uptime: number; // percentage
  lastChecked: Date;
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  throughput: number; // requests per minute
  consecutiveFailures: number;
  lastError?: string;
  metrics: IntegrationMetrics;
}

export interface IntegrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorsPerMinute: number;
  lastHourStats: HourlyStats;
}

export interface HourlyStats {
  requests: number[];
  errors: number[];
  responseTimes: number[];
}

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  unhealthyThreshold: number; // consecutive failures
  degradedThreshold: number; // error rate percentage
  metricsRetentionHours: number;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  errorRateThreshold: number; // percentage
  responseTimeThreshold: number; // milliseconds
  uptimeThreshold: number; // percentage
  throughputDropThreshold: number; // percentage
}

export interface Alert {
  id: string;
  integrationId: string;
  integrationName: string;
  type: 'error_rate' | 'response_time' | 'uptime' | 'throughput' | 'failure';
  severity: 'warning' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface DependencyMap {
  integrationId: string;
  dependencies: string[]; // IDs of dependent integrations
  dependents: string[]; // IDs of integrations that depend on this
}

export class MCPIntegrationMonitor extends EventEmitter {
  private logger: Logger;
  private integrationService: MCPIntegrationService;
  private healthChecks: Map<string, IntegrationHealth> = new Map();
  private metricsHistory: Map<string, IntegrationMetrics[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private dependencyMaps: Map<string, DependencyMap> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timer> = new Map();
  private wsServer?: WebSocketServer;
  private config: MonitoringConfig;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.logger = new Logger('MCP');
    this.integrationService = new MCPIntegrationService();
    
        
    this.config = {
      checkInterval: config?.checkInterval || 30000, // 30 seconds
      healthCheckTimeout: config?.healthCheckTimeout || 5000, // 5 seconds
      unhealthyThreshold: config?.unhealthyThreshold || 3,
      degradedThreshold: config?.degradedThreshold || 10, // 10% error rate
      metricsRetentionHours: config?.metricsRetentionHours || 24,
      alertThresholds: {
        errorRateThreshold: config?.alertThresholds?.errorRateThreshold || 15,
        responseTimeThreshold: config?.alertThresholds?.responseTimeThreshold || 3000,
        uptimeThreshold: config?.alertThresholds?.uptimeThreshold || 95,
        throughputDropThreshold: config?.alertThresholds?.throughputDropThreshold || 50,
        ...config?.alertThresholds,
      },
    };
  }

  async startMonitoring(): Promise<void> {
    this.logger.info('Starting MCP integration monitoring');

    // Get all integrations
    const integrations = await this.integrationService.getAvailableIntegrations();

    // Initialize health checks for each integration
    for (const integration of integrations) {
      await this.initializeHealthCheck(integration);
      this.startIntegrationMonitoring((integration as any).id || integration);
    }

    // Start WebSocket server for real-time updates
    this.startWebSocketServer();

    // Start metrics cleanup
    this.startMetricsCleanup();

    this.emit('monitoring-started');
  }

  private async initializeHealthCheck(integration: MCPIntegration): Promise<void> {
    const health: IntegrationHealth = {
      integrationId: integration.id,
      integrationName: integration.name,
      status: 'healthy',
      uptime: 100,
      lastChecked: new Date(),
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      consecutiveFailures: 0,
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerMinute: 0,
        errorsPerMinute: 0,
        lastHourStats: {
          requests: new Array(60).fill(0),
          errors: new Array(60).fill(0),
          responseTimes: new Array(60).fill(0),
        },
      },
    };

    this.healthChecks.set(integration.id, health);
  }

  private startIntegrationMonitoring(integrationId: string): void {
    const interval = setInterval(async () => {
      await this.checkIntegrationHealth(integrationId);
    }, this.config.checkInterval);

    this.monitoringIntervals.set(integrationId, interval);
  }

  private async checkIntegrationHealth(integrationId: string): Promise<void> {
    const health = this.healthChecks.get(integrationId);
    if (!health) return;

    const startTime = Date.now();

    try {
      // Perform health check
      const integration = await this.integrationService.getIntegration(integrationId);
      if (!integration) {
        throw new Error('Integration not found');
      }

      // Test basic functionality
      // const healthCheckResult = 
await this.performHealthCheck(integration);
      
      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(health, true, responseTime);

      // Reset consecutive failures
      health.consecutiveFailures = 0;
      health.status = this.calculateHealthStatus(health);
      health.lastChecked = new Date();

      // Check for alerts
      this.checkAlertConditions(health);

      // Emit update
      this.emitHealthUpdate(health);

    } catch (error: any) {
      // Update failure metrics
      this.updateMetrics(health, false, Date.now() - startTime);
      
      health.consecutiveFailures++;
      health.lastError = error.message;
      health.status = this.calculateHealthStatus(health);
      health.lastChecked = new Date();

      // Check for alerts
      this.checkAlertConditions(health);

      // Emit update
      this.emitHealthUpdate(health);

      this.logger.error(`Health check failed for ${integrationId}:`, error);
    }
  }

  private async performHealthCheck(integration: MCPIntegration): Promise<boolean> {
    // Create a timeout promise
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeout);
    });

    // Perform actual health check
    const healthCheckPromise = (async () => {
      // Test if integration has any tools
      if (!integration.tools || integration.tools.length === 0) {
        throw new Error('No tools available');
      }

      // Try to execute a simple tool (preferably a health check tool if available)
      const healthTool = integration.tools.find((t: any) => t.name === 'health' || t.name === 'ping') 
                        || integration.tools[0];

      await this.integrationService.executeTool(
        integration.id,
        healthTool.name,
        {} // Empty input for health check
      );

      return true;
    })();

    return await Promise.race([healthCheckPromise, timeoutPromise]);
  }

  private updateMetrics(health: IntegrationHealth, success: boolean, responseTime: number): void {
    const metrics = health.metrics;
    
    // Update totals
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update response times
    const responseTimes = this.getResponseTimeHistory(health.integrationId);
    responseTimes.push(responseTime);
    
    // Keep only last 1000 response times for percentile calculations
    if (responseTimes && responseTimes.length > 1000) {
      responseTimes.shift();
    }

    // Calculate percentiles
    const sorted = responseTimes ? [...responseTimes].sort((a, b) => a - b) : [];
    metrics.averageResponseTime = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    metrics.p95ResponseTime = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] || 0 : 0;
    metrics.p99ResponseTime = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] || 0 : 0;

    // Update hourly stats
    const currentMinute = new Date().getMinutes();
    if (metrics.lastHourStats) {
      if (metrics.lastHourStats.requests && currentMinute < metrics.lastHourStats.requests.length) {
        metrics.lastHourStats.requests[currentMinute] = (metrics.lastHourStats.requests[currentMinute] || 0) + 1;
      }
      if (!success && metrics.lastHourStats.errors && currentMinute < metrics.lastHourStats.errors.length) {
        metrics.lastHourStats.errors[currentMinute] = (metrics.lastHourStats.errors[currentMinute] || 0) + 1;
      }
      if (metrics.lastHourStats.responseTimes && currentMinute < metrics.lastHourStats.responseTimes.length) {
        metrics.lastHourStats.responseTimes[currentMinute] = responseTime;
      }
    }

    // Calculate rates
    const totalLastHour = metrics.lastHourStats?.requests?.reduce((a, b) => a + b, 0) || 0;
    const errorsLastHour = metrics.lastHourStats?.errors?.reduce((a, b) => a + b, 0) || 0;
    
    metrics.requestsPerMinute = totalLastHour / 60;
    metrics.errorsPerMinute = errorsLastHour / 60;
    
    // Update health metrics
    health.responseTime = responseTime;
    health.errorRate = metrics.totalRequests > 0 
      ? (metrics.failedRequests / metrics.totalRequests) * 100 
      : 0;
    health.throughput = metrics.requestsPerMinute;
    health.uptime = metrics.totalRequests > 0
      ? (metrics.successfulRequests / metrics.totalRequests) * 100
      : 100;
  }

  private getResponseTimeHistory(integrationId: string): number[] {
    const key = `${integrationId}-response-times`;
    if (!this.metricsHistory.has(key)) {
      this.metricsHistory.set(key, []);
    }
    return (this.metricsHistory.get(key) || []) as any as number[];
  }

  private calculateHealthStatus(health: IntegrationHealth): IntegrationHealth['status'] {
    // Check consecutive failures
    if (health.consecutiveFailures >= this.config.unhealthyThreshold) {
      return 'unhealthy';
    }

    // Check if offline
    if (health.uptime === 0) {
      return 'offline';
    }

    // Check error rate
    if (health.errorRate >= this.config.degradedThreshold) {
      return 'degraded';
    }

    // Check response time
    if (health.responseTime > this.config.alertThresholds.responseTimeThreshold) {
      return 'degraded';
    }

    return 'healthy';
  }

  private checkAlertConditions(health: IntegrationHealth): void {
    const thresholds = this.config.alertThresholds;

    // Check error rate
    if (health.errorRate > thresholds.errorRateThreshold) {
      this.createAlert(health, 'error_rate', thresholds.errorRateThreshold, health.errorRate);
    }

    // Check response time
    if (health.responseTime > thresholds.responseTimeThreshold) {
      this.createAlert(health, 'response_time', thresholds.responseTimeThreshold, health.responseTime);
    }

    // Check uptime
    if (health.uptime < thresholds.uptimeThreshold) {
      this.createAlert(health, 'uptime', thresholds.uptimeThreshold, health.uptime);
    }

    // Check for integration failure
    if (health.status === 'unhealthy') {
      this.createAlert(health, 'failure', 0, health.consecutiveFailures);
    }
  }

  private createAlert(
    health: IntegrationHealth,
    type: Alert['type'],
    threshold: number,
    actualValue: number
  ): void {
    const alertId = `${health.integrationId}-${type}`;
    
    // Check if alert already exists and is not acknowledged
    if (this.alerts.has(alertId)) {
      const existingAlert = this.alerts.get(alertId)!;
      if (!existingAlert.acknowledged) {
        return; // Don't create duplicate alerts
      }
    }

    const alert: Alert = {
      id: alertId,
      integrationId: health.integrationId,
      integrationName: health.integrationName,
      type,
      severity: this.getAlertSeverity(type, actualValue, threshold),
      message: this.getAlertMessage(type, health.integrationName, threshold, actualValue),
      threshold,
      actualValue,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alertId, alert);
    this.emit('alert-created', alert);

    // Also emit to WebSocket clients
    this.broadcastToClients({
      type: 'alert',
      data: alert,
    });
  }

  private getAlertSeverity(type: Alert['type'], actualValue: number, threshold: number): Alert['severity'] {
    const ratio = type === 'uptime' ? threshold / actualValue : actualValue / threshold;
    return ratio > 1.5 ? 'critical' : 'warning';
  }

  private getAlertMessage(type: Alert['type'], integrationName: string, threshold: number, actualValue: number): string {
    switch (type) {
      case 'error_rate':
        return `Integration '${integrationName}' error rate (${actualValue.toFixed(1)}%) exceeds threshold (${threshold}%)`;
      case 'response_time':
        return `Integration '${integrationName}' response time (${actualValue}ms) exceeds threshold (${threshold}ms)`;
      case 'uptime':
        return `Integration '${integrationName}' uptime (${actualValue.toFixed(1)}%) below threshold (${threshold}%)`;
      case 'throughput':
        return `Integration '${integrationName}' throughput dropped by ${actualValue.toFixed(1)}%`;
      case 'failure':
        return `Integration '${integrationName}' has failed ${actualValue} consecutive health checks`;
    }
  }

  private emitHealthUpdate(health: IntegrationHealth): void {
    this.emit('health-update', health);
    
    // Broadcast to WebSocket clients
    this.broadcastToClients({
      type: 'health-update',
      data: health,
    });
  }

  private startWebSocketServer(): void {
    const port = parseInt(process.env['MCP_MONITOR_WS_PORT'] || '8081');
    
    this.wsServer = new WebSocketServer({ port });
    
    this.wsServer.on('connection', (ws: WebSocket) => {
      this.logger.info('New WebSocket client connected');

      // Send current health status to new client
      const healthData = Array.from(this.healthChecks.values());
      ws.send(JSON.stringify({
        type: 'initial-health',
        data: healthData,
      }));

      // Send active alerts
      const alerts = Array.from(this.alerts.values()).filter(a => !a.acknowledged);
      ws.send(JSON.stringify({
        type: 'active-alerts',
        data: alerts,
      }));

      ws.on('message', (message: string) => {
        try {
          const msg = JSON.parse(message);
          this.handleWebSocketMessage(ws, msg);
        } catch (error: any) {
          this.logger.error('Invalid WebSocket message:', error as Error);
        }
      });

      ws.on('close', () => {
        this.logger.info('WebSocket client disconnected');
      });
    });

    this.logger.info(`WebSocket server started on port ${port}`);
  }

  private handleWebSocketMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'acknowledge-alert':
        this.acknowledgeAlert(message.alertId);
        break;
      case 'request-metrics':
        this.sendDetailedMetrics(ws, message.integrationId);
        break;
      case 'request-dependencies':
        this.sendDependencyMap(ws, message.integrationId);
        break;
    }
  }

  private broadcastToClients(message: any): void {
    if (!this.wsServer) return;

    const messageStr = JSON.stringify(message);
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      
      this.broadcastToClients({
        type: 'alert-acknowledged',
        data: { alertId },
      });
    }
  }

  private sendDetailedMetrics(ws: WebSocket, integrationId: string): void {
    const health = this.healthChecks.get(integrationId);
    if (health) {
      ws.send(JSON.stringify({
        type: 'detailed-metrics',
        data: {
          integrationId,
          health,
          responseTimeHistory: this.getResponseTimeHistory(integrationId),
        },
      }));
    }
  }

  private sendDependencyMap(ws: WebSocket, integrationId: string): void {
    const dependencies = this.dependencyMaps.get(integrationId);
    ws.send(JSON.stringify({
      type: 'dependency-map',
      data: dependencies || { integrationId, dependencies: [], dependents: [] },
    }));
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoffTime = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
      
      // Clean up old alerts
      for (const [id, alert] of this.alerts.entries()) {
        if (alert.acknowledged && alert.timestamp.getTime() < cutoffTime) {
          this.alerts.delete(id);
        }
      }

      // Reset hourly stats older than retention period
      for (const health of this.healthChecks.values()) {
        // This is a simplified cleanup - in production, you'd want more sophisticated retention
        const currentMinute = new Date().getMinutes();
        const resetMinute = (currentMinute + 1) % 60;
        health.metrics.lastHourStats.requests[resetMinute] = 0;
        health.metrics.lastHourStats.errors[resetMinute] = 0;
        health.metrics.lastHourStats.responseTimes[resetMinute] = 0;
      }
    }, 60 * 60 * 1000); // Every hour
  }

  getIntegrationHealth(integrationId: string): IntegrationHealth | undefined {
    return this.healthChecks.get(integrationId);
  }

  getAllIntegrationHealth(): IntegrationHealth[] {
    return Array.from(this.healthChecks.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.acknowledged);
  }

  async setDependencyMap(integrationId: string, dependencies: string[], dependents: string[]): Promise<void> {
    this.dependencyMaps.set(integrationId, {
      integrationId,
      dependencies,
      dependents,
    });

    // Emit update
    this.emit('dependency-map-updated', { integrationId, dependencies, dependents });
  }

  async analyzeDependencyImpact(integrationId: string): Promise<string[]> {
    const impactedIntegrations: Set<string> = new Set();
    
    // Get direct dependents
    const dependencyMap = this.dependencyMaps.get(integrationId);
    if (dependencyMap) {
      dependencyMap.dependents.forEach(id => impactedIntegrations.add(id));
    }

    // Recursively find all impacted integrations
    const toCheck = [...impactedIntegrations];
    while (toCheck.length > 0) {
      const checkId = toCheck.pop()!;
      const checkMap = this.dependencyMaps.get(checkId);
      if (checkMap) {
        checkMap.dependents.forEach(id => {
          if (!impactedIntegrations.has(id)) {
            impactedIntegrations.add(id);
            toCheck.push(id);
          }
        });
      }
    }

    return Array.from(impactedIntegrations);
  }

  async stopMonitoring(): Promise<void> {
    // Stop all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval as any);
    }
    this.monitoringIntervals.clear();

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    this.emit('monitoring-stopped');
  }

  async exportHealthReport(): Promise<string> {
    const report = {
      timestamp: new Date(),
      summary: {
        totalIntegrations: this.healthChecks.size,
        healthy: Array.from(this.healthChecks.values()).filter(h => h.status === 'healthy').length,
        degraded: Array.from(this.healthChecks.values()).filter(h => h.status === 'degraded').length,
        unhealthy: Array.from(this.healthChecks.values()).filter(h => h.status === 'unhealthy').length,
        offline: Array.from(this.healthChecks.values()).filter(h => h.status === 'offline').length,
      },
      integrations: Array.from(this.healthChecks.values()),
      activeAlerts: this.getActiveAlerts(),
      systemHealth: {
        cpu: os.loadavg()[0],
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        },
      },
    };

    return JSON.stringify(report, null, 2);
  }
}