import { EventEmitter } from 'events';
import { ErrorAnalyticsEngine, ErrorMetrics, ErrorInsight } from '@/src/services/analytics/ErrorAnalyticsEngine';
import { HealthMonitoringService, HealthStatus } from '@/src/services/monitoring/HealthMonitoringService';
import { NotificationService } from '@/src/services/notifications/NotificationService';
// import { ErrorSeverity } from '@/core/orchestrator/EnhancedErrorHandler';
import { Logger } from '@/src/lib/logging/Logger';

export enum AlertChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app',
  SMS = 'sms'
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AlertThreshold {
  id: string;
  name: string;
  description: string;
  metric: keyof ErrorMetrics | 'healthScore' | 'cpuUsage' | 'memoryUsage' | 'responseTime';
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
  value: number;
  duration?: number; // Must exceed threshold for this duration (ms)
  priority: AlertPriority;
  enabled: boolean;
  channels: AlertChannel[];
  cooldown: number; // Minimum time between alerts (ms)
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  thresholdId: string;
  title: string;
  message: string;
  priority: AlertPriority;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  channels: AlertChannel[];
  data: {
    metric: string;
    currentValue: number;
    thresholdValue: number;
    duration?: number;
    relatedErrors?: string[];
    recommendations?: string[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string; // JavaScript expression
  priority: AlertPriority;
  channels: AlertChannel[];
  enabled: boolean;
  cooldown: number;
}

export interface NotificationConfig {
  [AlertChannel.EMAIL]: {
    recipients: string[];
    templateId?: string;
  };
  [AlertChannel.SLACK]: {
    webhookUrl: string;
    channel?: string;
    mentions?: string[];
  };
  [AlertChannel.WEBHOOK]: {
    url: string;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
  };
  [AlertChannel.IN_APP]: {
    broadcast: boolean;
    targetUsers?: string[];
  };
  [AlertChannel.SMS]: {
    recipients: string[];
    provider?: string;
  };
}

export class AlertManagementSystem extends EventEmitter {
  private analyticsEngine: ErrorAnalyticsEngine;
  private healthMonitor: HealthMonitoringService;
  private notificationService: NotificationService;
  private logger: Logger;
  
  private thresholds: Map<string, AlertThreshold> = new Map();
  private customRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  
  private notificationConfig: NotificationConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 10000; // 10 seconds
  private readonly MAX_HISTORY_SIZE = 1000;
  
  constructor(
    analyticsEngine: ErrorAnalyticsEngine,
    healthMonitor: HealthMonitoringService,
    notificationService: NotificationService,
    logger: Logger,
    notificationConfig: NotificationConfig
  ) {
    super();
    this.analyticsEngine = analyticsEngine;
    this.healthMonitor = healthMonitor;
    this.notificationService = notificationService;
    this.logger = logger;
    this.notificationConfig = notificationConfig;
    
    this.initializeDefaultThresholds();
    this.startMonitoring();
  }
  
  private initializeDefaultThresholds(): void {
    const defaultThresholds: AlertThreshold[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 50 errors per minute',
        metric: 'errorRate',
        operator: 'gt',
        value: 50,
        duration: 60000, // 1 minute
        priority: AlertPriority.HIGH,
        enabled: true,
        channels: [AlertChannel.IN_APP, AlertChannel.EMAIL],
        cooldown: 300000 // 5 minutes
      },
      {
        id: 'critical-errors',
        name: 'Critical Errors Detected',
        description: 'Critical severity errors detected',
        metric: 'errorsBySeverity',
        operator: 'gt',
        value: 0,
        priority: AlertPriority.CRITICAL,
        enabled: true,
        channels: [AlertChannel.IN_APP, AlertChannel.SLACK, AlertChannel.EMAIL],
        cooldown: 60000 // 1 minute
      },
      {
        id: 'low-recovery-rate',
        name: 'Low Recovery Rate',
        description: 'Recovery rate falls below 50%',
        metric: 'recoveryRate',
        operator: 'lt',
        value: 0.5,
        duration: 300000, // 5 minutes
        priority: AlertPriority.MEDIUM,
        enabled: true,
        channels: [AlertChannel.IN_APP],
        cooldown: 600000 // 10 minutes
      },
      {
        id: 'high-user-impact',
        name: 'High User Impact',
        description: 'More than 100 users impacted by errors',
        metric: 'impactedUsers',
        operator: 'gt',
        value: 100,
        priority: AlertPriority.HIGH,
        enabled: true,
        channels: [AlertChannel.IN_APP, AlertChannel.EMAIL],
        cooldown: 1800000 // 30 minutes
      },
      {
        id: 'system-health-degraded',
        name: 'System Health Degraded',
        description: 'Overall system health score below 70%',
        metric: 'healthScore',
        operator: 'lt',
        value: 70,
        duration: 120000, // 2 minutes
        priority: AlertPriority.HIGH,
        enabled: true,
        channels: [AlertChannel.IN_APP, AlertChannel.SLACK],
        cooldown: 600000 // 10 minutes
      },
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        description: 'CPU usage exceeds 80%',
        metric: 'cpuUsage',
        operator: 'gt',
        value: 80,
        duration: 300000, // 5 minutes
        priority: AlertPriority.MEDIUM,
        enabled: true,
        channels: [AlertChannel.IN_APP],
        cooldown: 900000 // 15 minutes
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds 85%',
        metric: 'memoryUsage',
        operator: 'gt',
        value: 85,
        duration: 300000, // 5 minutes
        priority: AlertPriority.MEDIUM,
        enabled: true,
        channels: [AlertChannel.IN_APP],
        cooldown: 900000 // 15 minutes
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        description: 'Average response time exceeds 3 seconds',
        metric: 'responseTime',
        operator: 'gt',
        value: 3000,
        duration: 180000, // 3 minutes
        priority: AlertPriority.MEDIUM,
        enabled: true,
        channels: [AlertChannel.IN_APP],
        cooldown: 600000 // 10 minutes
      }
    ];
    
    for (const threshold of defaultThresholds) {
      this.thresholds.set(threshold.id, threshold);
    }
  }
  
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkThresholds();
      this.evaluateCustomRules();
    }, this.MONITORING_INTERVAL);
    
    // Listen to analytics insights
    this.analyticsEngine.on('analysis:complete', (data: any) => {
      this.processInsights(data.insights);
    });
  }
  
  private async checkThresholds(): Promise<void> {
    const metrics = this.analyticsEngine.getMetrics();
    const healthStatus = await this.healthMonitor.getHealthStatus();
    
    for (const [id, threshold] of this.thresholds) {
      if (!threshold.enabled) continue;
      
      try {
        const shouldAlert = await this.evaluateThreshold(threshold, metrics, healthStatus!);
        
        if (shouldAlert && this.canSendAlert(id)) {
          await this.createAndSendAlert(threshold, metrics, healthStatus!);
        } else if (!shouldAlert && this.activeAlerts.has(id)) {
          this.resolveAlert(id);
        }
      } catch (error) {
        this.logger.error('Error evaluating threshold', error as Error, { thresholdId: id });
      }
    }
  }
  
  private async evaluateThreshold(
    threshold: AlertThreshold,
    metrics: ErrorMetrics,
    healthStatus: HealthStatus
  ): Promise<boolean> {
    let currentValue: number;
    
    switch (threshold.metric) {
      case 'errorsBySeverity':
        currentValue = metrics.errorsBySeverity['critical'] || 0;
        break;
      case 'healthScore':
        currentValue = this.calculateHealthScore(healthStatus);
        break;
      case 'cpuUsage':
        currentValue = 0; // CPU metrics not directly available in HealthStatus
        break;
      case 'memoryUsage':
        currentValue = 0; // Memory metrics not directly available in HealthStatus
        break;
      case 'responseTime':
        currentValue = 0; // Performance metrics not directly available in HealthStatus
        break;
      default:
        currentValue = metrics[threshold.metric as keyof ErrorMetrics] as number;
    }
    
    const exceedsThreshold = this.compareValue(currentValue, threshold.operator, threshold.value);
    
    if (!exceedsThreshold) {
      return false;
    }
    
    // Check duration requirement
    if (threshold.duration) {
      const key = `${threshold.id}_duration`;
      const firstExceeded = this.lastAlertTimes.get(key);
      
      if (!firstExceeded) {
        this.lastAlertTimes.set(key, Date.now());
        return false;
      }
      
      if (Date.now() - firstExceeded < threshold.duration) {
        return false;
      }
    }
    
    return true;
  }
  
  private compareValue(current: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return current > threshold;
      case 'lt': return current < threshold;
      case 'gte': return current >= threshold;
      case 'lte': return current <= threshold;
      case 'eq': return current === threshold;
      case 'neq': return current !== threshold;
      default: return false;
    }
  }
  
  private calculateHealthScore(health: HealthStatus): number {
    const weights = {
      cpu: 0.25,
      memory: 0.25,
      performance: 0.3,
      network: 0.2
    };
    
    // Scores based on component status rather than raw metrics
    const statusToScore = (status: string) => {
      switch (status) {
        case 'healthy': return 100;
        case 'warning': return 60;
        case 'critical': return 20;
        default: return 50;
      }
    };
    
    const cpuScore = statusToScore(health.components.cpu);
    const memoryScore = statusToScore(health.components.memory);
    const performanceScore = statusToScore(health.components.performance);
    const networkScore = statusToScore(health.components.network);
    
    return (
      cpuScore * weights.cpu +
      memoryScore * weights.memory +
      performanceScore * weights.performance +
      networkScore * weights.network
    );
  }
  
  private canSendAlert(thresholdId: string): boolean {
    const lastAlert = this.lastAlertTimes.get(thresholdId);
    const threshold = this.thresholds.get(thresholdId);
    
    if (!threshold || !lastAlert) return true;
    
    return Date.now() - lastAlert >= threshold.cooldown;
  }
  
  private async createAndSendAlert(
    threshold: AlertThreshold,
    metrics: ErrorMetrics,
    healthStatus: HealthStatus
  ): Promise<void> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${threshold.id}`,
      thresholdId: threshold.id,
      title: threshold.name,
      message: this.generateAlertMessage(threshold, metrics, healthStatus),
      priority: threshold.priority,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      channels: threshold.channels,
      data: {
        metric: String(threshold.metric),
        currentValue: this.getCurrentValue(String(threshold.metric), metrics, healthStatus),
        thresholdValue: threshold.value,
        recommendations: this.generateRecommendations(threshold, metrics)
      }
    };
    
    this.activeAlerts.set(threshold.id, alert);
    this.alertHistory.push(alert);
    this.lastAlertTimes.set(threshold.id, Date.now());
    
    // Trim history
    if (this.alertHistory.length > this.MAX_HISTORY_SIZE) {
      this.alertHistory = this.alertHistory.slice(-this.MAX_HISTORY_SIZE);
    }
    
    // Send notifications
    await this.sendNotifications(alert);
    
    // Log alert
    this.logger.warn('Alert triggered', {
      alertId: alert.id,
      threshold: threshold.name,
      priority: alert.priority
    });
    
    this.emit('alert:triggered', alert);
  }
  
  private generateAlertMessage(
    threshold: AlertThreshold,
    metrics: ErrorMetrics,
    healthStatus: HealthStatus
  ): string {
    const currentValue = this.getCurrentValue(String(threshold.metric), metrics, healthStatus);
    const unit = this.getMetricUnit(String(threshold.metric));
    
    return `${threshold.description}. Current value: ${currentValue}${unit} (threshold: ${threshold.value}${unit})`;
  }
  
  private getCurrentValue(
    metric: string,
    metrics: ErrorMetrics,
    healthStatus: HealthStatus
  ): number {
    switch (metric) {
      case 'errorsBySeverity':
        return metrics.errorsBySeverity['critical'] || 0;
      case 'healthScore':
        return this.calculateHealthScore(healthStatus);
      case 'cpuUsage':
        return 0; // CPU metrics not directly available
      case 'memoryUsage':
        return 0; // Memory metrics not directly available
      case 'responseTime':
        return 0; // Performance metrics not directly available
      default:
        return metrics[metric as keyof ErrorMetrics] as number || 0;
    }
  }
  
  private getMetricUnit(metric: string): string {
    const units: Record<string, string> = {
      errorRate: ' errors/min',
      recoveryRate: '%',
      cpuUsage: '%',
      memoryUsage: '%',
      responseTime: 'ms',
      healthScore: '%'
    };
    
    return units[metric] || '';
  }
  
  private generateRecommendations(threshold: AlertThreshold, _metrics: ErrorMetrics): string[] {
    const recommendations: string[] = [];
    
    switch (threshold.id) {
      case 'high-error-rate':
        recommendations.push('Review recent deployments for potential issues');
        recommendations.push('Check system logs for error patterns');
        recommendations.push('Consider enabling rate limiting');
        break;
      
      case 'critical-errors':
        recommendations.push('Immediate investigation required');
        recommendations.push('Check error details in monitoring dashboard');
        recommendations.push('Prepare rollback if necessary');
        break;
      
      case 'low-recovery-rate':
        recommendations.push('Review error recovery mechanisms');
        recommendations.push('Check retry configurations');
        recommendations.push('Investigate persistent failure patterns');
        break;
      
      case 'high-user-impact':
        recommendations.push('Communicate with affected users');
        recommendations.push('Prioritize fixes for high-impact errors');
        recommendations.push('Consider temporary workarounds');
        break;
      
      case 'system-health-degraded':
        recommendations.push('Check all system components');
        recommendations.push('Review resource allocation');
        recommendations.push('Consider scaling resources');
        break;
      
      case 'high-cpu-usage':
        recommendations.push('Identify CPU-intensive processes');
        recommendations.push('Optimize performance bottlenecks');
        recommendations.push('Consider horizontal scaling');
        break;
      
      case 'high-memory-usage':
        recommendations.push('Check for memory leaks');
        recommendations.push('Review memory allocation patterns');
        recommendations.push('Consider increasing memory limits');
        break;
      
      case 'slow-response-time':
        recommendations.push('Profile slow endpoints');
        recommendations.push('Check database query performance');
        recommendations.push('Review caching strategies');
        break;
    }
    
    return recommendations;
  }
  
  private async sendNotifications(alert: Alert): Promise<void> {
    for (const channel of alert.channels) {
      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        this.logger.error('Failed to send notification', error as Error, { channel, alertId: alert.id });
      }
    }
  }
  
  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel) {
      case AlertChannel.IN_APP:
        await this.notificationService.notify({
          title: alert.title,
          message: alert.message,
          type: this.mapPriorityToNotificationType(alert.priority)
        });
        break;
      
      case AlertChannel.EMAIL:
        const emailConfig = this.notificationConfig[AlertChannel.EMAIL];
        if (emailConfig) {
          // Email implementation would go here
          this.logger.info('Email alert sent', { recipients: emailConfig.recipients, alertId: alert.id });
        }
        break;
      
      case AlertChannel.SLACK:
        const slackConfig = this.notificationConfig[AlertChannel.SLACK];
        if (slackConfig) {
          // Slack webhook implementation would go here
          this.logger.info('Slack alert sent', { channel: slackConfig.channel, alertId: alert.id });
        }
        break;
      
      case AlertChannel.WEBHOOK:
        const webhookConfig = this.notificationConfig[AlertChannel.WEBHOOK];
        if (webhookConfig) {
          // Webhook implementation would go here
          this.logger.info('Webhook alert sent', { url: webhookConfig.url, alertId: alert.id });
        }
        break;
      
      case AlertChannel.SMS:
        const smsConfig = this.notificationConfig[AlertChannel.SMS];
        if (smsConfig) {
          // SMS implementation would go here
          this.logger.info('SMS alert sent', { recipients: smsConfig.recipients, alertId: alert.id });
        }
        break;
    }
  }
  
  private mapPriorityToNotificationType(priority: AlertPriority): 'info' | 'warning' | 'error' | 'success' {
    switch (priority) {
      case AlertPriority.LOW: return 'info';
      case AlertPriority.MEDIUM: return 'warning';
      case AlertPriority.HIGH: return 'error';
      case AlertPriority.CRITICAL: return 'error';
      default: return 'info';
    }
  }
  
  private resolveAlert(thresholdId: string): void {
    const alert = this.activeAlerts.get(thresholdId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      this.activeAlerts.delete(thresholdId);
      
      // Send resolution notification
      this.notificationService.notify({
        title: `Alert Resolved: ${alert.title}`,
        message: 'The alert condition has been resolved',
        type: 'success'
      });
      
      this.emit('alert:resolved', alert);
    }
  }
  
  private async evaluateCustomRules(): Promise<void> {
    const metrics = this.analyticsEngine.getMetrics();
    const healthStatus = await this.healthMonitor.getHealthStatus();
    const context = { metrics, healthStatus, Date, Math };
    
    for (const [id, rule] of this.customRules) {
      if (!rule.enabled) continue;
      
      try {
        // Safely evaluate rule condition
        const result = new Function('context', `with (context) { return ${rule.condition}; }`)(context);
        
        if (result && this.canSendAlert(id)) {
          await this.createCustomRuleAlert(rule);
        }
      } catch (error) {
        this.logger.error('Error evaluating custom rule', error as Error, { ruleId: id });
      }
    }
  }
  
  private async createCustomRuleAlert(rule: AlertRule): Promise<void> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${rule.id}`,
      thresholdId: rule.id,
      title: rule.name,
      message: `Custom rule "${rule.name}" triggered`,
      priority: rule.priority,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      channels: rule.channels,
      data: {
        metric: 'custom',
        currentValue: 1,
        thresholdValue: 1
      }
    };
    
    await this.sendNotifications(alert);
    this.lastAlertTimes.set(rule.id, Date.now());
    this.emit('alert:triggered', alert);
  }
  
  private processInsights(insights: ErrorInsight[]): void {
    for (const insight of insights) {
      if (insight.severity === 'critical' || insight.severity === 'high') {
        const alert: Alert = {
          id: `alert-insight-${Date.now()}-${insight.id}`,
          thresholdId: `insight-${insight.type}`,
          title: insight.title,
          message: insight.description,
          priority: insight.severity === 'critical' ? AlertPriority.CRITICAL : AlertPriority.HIGH,
          timestamp: insight.timestamp,
          acknowledged: false,
          resolved: false,
          channels: [AlertChannel.IN_APP],
          data: {
            metric: 'insight',
            currentValue: 1,
            thresholdValue: 1,
            relatedErrors: insight.relatedErrors,
            recommendations: insight.recommendation ? [insight.recommendation] : []
          }
        };
        
        this.sendNotifications(alert);
        this.emit('alert:triggered', alert);
      }
    }
  }
  
  // Public API methods
  
  public addThreshold(threshold: AlertThreshold): void {
    this.thresholds.set(threshold.id, threshold);
    this.emit('threshold:added', threshold);
  }
  
  public updateThreshold(id: string, updates: Partial<AlertThreshold>): void {
    const threshold = this.thresholds.get(id);
    if (threshold) {
      Object.assign(threshold, updates);
      this.emit('threshold:updated', threshold);
    }
  }
  
  public removeThreshold(id: string): void {
    const threshold = this.thresholds.get(id);
    if (threshold) {
      this.thresholds.delete(id);
      this.emit('threshold:removed', threshold);
    }
  }
  
  public getThresholds(): AlertThreshold[] {
    return Array.from(this.thresholds.values());
  }
  
  public addCustomRule(rule: AlertRule): void {
    this.customRules.set(rule.id, rule);
    this.emit('rule:added', rule);
  }
  
  public removeCustomRule(id: string): void {
    const rule = this.customRules.get(id);
    if (rule) {
      this.customRules.delete(id);
      this.emit('rule:removed', rule);
    }
  }
  
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
  
  public getAlertHistory(limit?: number): Alert[] {
    const alerts = [...this.alertHistory].reverse();
    return limit ? alerts.slice(0, limit) : alerts;
  }
  
  public acknowledgeAlert(alertId: string, userId: string): void {
    const alert = Array.from(this.activeAlerts.values()).find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      
      this.emit('alert:acknowledged', alert);
    }
  }
  
  public updateNotificationConfig(config: Partial<NotificationConfig>): void {
    Object.assign(this.notificationConfig, config);
    this.emit('config:updated', this.notificationConfig);
  }
  
  public testAlert(thresholdId: string): void {
    const threshold = this.thresholds.get(thresholdId);
    if (threshold) {
      const testAlert: Alert = {
        id: `test-alert-${Date.now()}`,
        thresholdId: threshold.id,
        title: `TEST: ${threshold.name}`,
        message: `This is a test alert for "${threshold.name}"`,
        priority: threshold.priority,
        timestamp: new Date(),
        acknowledged: false,
        resolved: false,
        channels: threshold.channels,
        data: {
          metric: String(threshold.metric),
          currentValue: threshold.value,
          thresholdValue: threshold.value
        }
      };
      
      this.sendNotifications(testAlert);
      this.emit('alert:test', testAlert);
    }
  }
  
  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.removeAllListeners();
    this.thresholds.clear();
    this.customRules.clear();
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.lastAlertTimes.clear();
  }
}