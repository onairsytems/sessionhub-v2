import { EventEmitter } from 'events';
import { Logger } from '../../../lib/logging/Logger';
import { IntegrationHealth } from '../monitoring/MCPIntegrationMonitor';

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
  throttling: {
    maxAlertsPerHour: number;
    cooldownMinutes: number;
  };
  escalation: {
    enabled: boolean;
    levels: EscalationLevel[];
  };
}

export interface AlertChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: any;
  enabled: boolean;
  filter?: AlertFilter;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  channels: string[]; // Channel IDs
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  type: 'threshold' | 'pattern' | 'composite';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number | string;
  duration?: number; // seconds - condition must be true for this duration
  window?: number; // seconds - time window for evaluation
}

export interface AlertFilter {
  severities?: string[];
  integrations?: string[];
  types?: string[];
}

export interface EscalationLevel {
  level: number;
  afterMinutes: number;
  channels: string[];
  notifyManagers?: boolean;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  integrationId: string;
  integrationName: string;
  severity: string;
  title: string;
  message: string;
  metric: string;
  actualValue: any;
  expectedValue: any;
  timestamp: Date;
  acknowledged: boolean;
  escalationLevel: number;
  metadata?: Record<string, any>;
}

export class MCPAlertManager extends EventEmitter {
  private logger: Logger;
  private config: AlertConfig;
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private alertHistory: AlertEvent[] = [];
  private throttleMap: Map<string, number> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();

  constructor(config: AlertConfig) {
    super();
    this.logger = new Logger('MCP');
    this.config = config;
    this.initializeChannels();
    this.initializeRules();
  }

  private initializeChannels(): void {
    for (const channel of this.config.channels) {
      this.channels.set(channel.id, channel);
    }
  }

  private initializeRules(): void {
    for (const rule of this.config.rules) {
      this.rules.set(rule.id, rule);
    }
  }

  async evaluateHealth(health: IntegrationHealth): Promise<void> {
    if (!this.config.enabled) return;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const triggered = this.evaluateRule(rule, health);
      if (triggered) {
        await this.triggerAlert(rule, health);
      }
    }
  }

  private evaluateRule(rule: AlertRule, health: IntegrationHealth): boolean {
    const { condition } = rule;
    let metricValue: any;

    // Get metric value
    switch (condition.metric) {
      case 'status':
        metricValue = health.status;
        break;
      case 'uptime':
        metricValue = health.uptime;
        break;
      case 'responseTime':
        metricValue = health.responseTime;
        break;
      case 'errorRate':
        metricValue = health.errorRate;
        break;
      case 'throughput':
        metricValue = health.throughput;
        break;
      case 'consecutiveFailures':
        metricValue = health.consecutiveFailures;
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case '>':
        return metricValue > condition.value;
      case '<':
        return metricValue < condition.value;
      case '>=':
        return metricValue >= condition.value;
      case '<=':
        return metricValue <= condition.value;
      case '==':
        return metricValue === condition.value;
      case '!=':
        return metricValue !== condition.value;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, health: IntegrationHealth): Promise<void> {
    // Check throttling
    if (this.isThrottled(rule.id)) {
      this.logger.debug(`Alert throttled for rule ${rule.id}`);
      return;
    }

    // Create alert event
    const alert: AlertEvent = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      integrationId: health.integrationId,
      integrationName: health.integrationName,
      severity: rule.severity,
      title: `${rule.name} - ${health.integrationName}`,
      message: this.formatAlertMessage(rule, health),
      metric: rule.condition.metric,
      actualValue: this.getMetricValue(rule.condition.metric, health),
      expectedValue: rule.condition.value,
      timestamp: new Date(),
      acknowledged: false,
      escalationLevel: 0,
      metadata: rule.metadata,
    };

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);
    this.updateThrottle(rule.id);

    // Send to channels
    await this.sendAlert(alert, rule.channels);

    // Schedule escalation if enabled
    if (this.config.escalation.enabled) {
      this.scheduleEscalation(alert);
    }

    this.emit('alert-triggered', alert);
  }

  private getMetricValue(metric: string, health: IntegrationHealth): any {
    switch (metric) {
      case 'status':
        return health.status;
      case 'uptime':
        return health.uptime;
      case 'responseTime':
        return health.responseTime;
      case 'errorRate':
        return health.errorRate;
      case 'throughput':
        return health.throughput;
      case 'consecutiveFailures':
        return health.consecutiveFailures;
      default:
        return null;
    }
  }

  private formatAlertMessage(rule: AlertRule, health: IntegrationHealth): string {
    const value = this.getMetricValue(rule.condition.metric, health);
    return `${rule.description}\n` +
           `Integration: ${health.integrationName}\n` +
           `Metric: ${rule.condition.metric}\n` +
           `Current Value: ${value}\n` +
           `Threshold: ${rule.condition.operator} ${rule.condition.value}\n` +
           `Status: ${health.status}`;
  }

  private async sendAlert(alert: AlertEvent, channelIds: string[]): Promise<void> {
    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) continue;

      // Apply channel filter
      if (channel.filter) {
        if (channel.filter.severities && !channel.filter.severities.includes(alert.severity)) {
          continue;
        }
        if (channel.filter.integrations && !channel.filter.integrations.includes(alert.integrationId)) {
          continue;
        }
      }

      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        this.logger.error(`Failed to send alert to channel ${channelId}:`, error as Error);
      }
    }
  }

  private async sendToChannel(channel: AlertChannel, alert: AlertEvent): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.logger.info(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.title}`);
        this.logger.info(alert.message);
        break;

      case 'webhook':
        await this.sendWebhook(channel.config.url, alert);
        break;

      case 'slack':
        await this.sendSlackNotification(channel.config, alert);
        break;

      case 'email':
        await this.sendEmailNotification(channel.config, alert);
        break;
    }
  }

  private async sendWebhook(url: string, alert: AlertEvent): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alert,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendSlackNotification(config: any, alert: AlertEvent): Promise<void> {
    const color = alert.severity === 'critical' ? 'danger' : 
                  alert.severity === 'warning' ? 'warning' : 'good';

    const payload = {
      attachments: [{
        color,
        title: alert.title,
        text: alert.message,
        fields: [
          {
            title: 'Integration',
            value: alert.integrationName,
            short: true,
          },
          {
            title: 'Severity',
            value: alert.severity,
            short: true,
          },
          {
            title: 'Metric',
            value: `${alert.metric}: ${alert.actualValue}`,
            short: true,
          },
          {
            title: 'Time',
            value: alert.timestamp.toLocaleString(),
            short: true,
          },
        ],
        footer: 'MCP Alert Manager',
        ts: Math.floor(alert.timestamp.getTime() / 1000),
      }],
    };

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`);
    }
  }

  private async sendEmailNotification(config: any, _alert: AlertEvent): Promise<void> {
    // Email implementation would depend on the email service being used
    this.logger.info(`Email alert would be sent to ${config.recipients.join(', ')}`);
  }

  private isThrottled(ruleId: string): boolean {
    const lastAlert = this.throttleMap.get(ruleId);
    if (!lastAlert) return false;

    const hourAgo = Date.now() - (60 * 60 * 1000);
    const recentAlerts = Array.from(this.throttleMap.entries())
      .filter(([_, time]) => time > hourAgo)
      .length;

    if (recentAlerts >= this.config.throttling.maxAlertsPerHour) {
      return true;
    }

    const cooldownTime = lastAlert + (this.config.throttling.cooldownMinutes * 60 * 1000);
    return Date.now() < cooldownTime;
  }

  private updateThrottle(ruleId: string): void {
    this.throttleMap.set(ruleId, Date.now());

    // Clean old entries
    const hourAgo = Date.now() - (60 * 60 * 1000);
    for (const [id, time] of this.throttleMap.entries()) {
      if (time < hourAgo) {
        this.throttleMap.delete(id);
      }
    }
  }

  private scheduleEscalation(alert: AlertEvent): void {
    for (const level of this.config.escalation.levels) {
      setTimeout(async () => {
        // Check if alert is still active and not acknowledged
        const currentAlert = this.activeAlerts.get(alert.id);
        if (!currentAlert || currentAlert.acknowledged) return;

        currentAlert.escalationLevel = level.level;
        await this.sendAlert(currentAlert, level.channels);

        if (level.notifyManagers) {
          this.emit('escalation-triggered', {
            alert: currentAlert,
            level: level.level,
          });
        }
      }, level.afterMinutes * 60 * 1000);
    }
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
    }
  }

  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values())
      .filter(a => !a.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlertHistory(hours: number = 24): AlertEvent[] {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    return this.alertHistory
      .filter(a => a.timestamp.getTime() > since)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.config.rules.push(rule);
    this.emit('rule-added', rule);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      this.emit('rule-updated', rule);
    }
  }

  deleteRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId);
    this.emit('rule-deleted', ruleId);
  }

  async testAlert(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const testHealth: IntegrationHealth = {
      integrationId: 'test-integration',
      integrationName: 'Test Integration',
      status: 'degraded',
      uptime: 95,
      lastChecked: new Date(),
      responseTime: 1500,
      errorRate: 15,
      throughput: 50,
      consecutiveFailures: 2,
      metrics: {} as any,
    };

    await this.triggerAlert(rule, testHealth);
  }
}