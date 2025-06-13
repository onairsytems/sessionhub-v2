// Module declarations for internal services and libraries

// Analytics services
declare module '@/services/analytics/ErrorAnalyticsEngine' {
  import { EventEmitter } from 'events';
  
  export interface ErrorMetrics {
    totalErrors: number;
    errorRate: number;
    impactedUsers: number;
    impactedSessions: number;
    errorsBySeverity: Record<string, number>;
    errorsByType: Record<string, number>;
    errorsByPage: Record<string, number>;
    recoveryRate: number;
    meanTimeToRecovery: number;
    errorTrends: {
      timestamp: Date;
      count: number;
      rate: number;
    }[];
  }

  export interface TimeSeriesData {
    timestamp: Date;
    value: number;
    label?: string;
  }

  export interface ErrorPattern {
    id: string;
    pattern: string;
    frequency: number;
    severity: string;
    firstSeen: Date;
    lastSeen: Date;
    impactedUsers: number;
    relatedErrors: string[];
  }

  export interface ErrorInsight {
    id: string;
    type: 'pattern' | 'anomaly' | 'correlation' | 'prediction';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    timestamp: Date;
    relatedMetrics?: string[];
    relatedErrors?: string[];
    recommendation?: string;
    recommendations?: string[];
  }

  export class ErrorAnalyticsEngine extends EventEmitter {
    constructor(dataStore: any, errorHandler: any, logger: any);
    analyze(errorData: any): Promise<{
      metrics: ErrorMetrics;
      patterns: ErrorPattern[];
      insights: ErrorInsight[];
    }>;
    analyzeError(error: any): Promise<any>;
    getMetrics(): ErrorMetrics;
    getPatterns(): ErrorPattern[];
    getInsights(): ErrorInsight[];
    getErrorInsights(filters?: any): Promise<any>;
    getTimeSeriesData(metric: string, timeRange: string): TimeSeriesData[];
    getErrorTrends(range: string): Promise<any>;
    destroy(): Promise<void>;
  }
}

declare module '@/services/analytics/ErrorTrendAnalyzer' {
  import { EventEmitter } from 'events';
  export interface TrendData {
    timestamp: Date;
    value: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }

  export class ErrorTrendAnalyzer extends EventEmitter {
    constructor(dataStore: any, notificationService: any);
    analyzeTrends(data: any[]): TrendData[];
    detectAnomalies(data: any[]): any[];
    detectAnomaly(metrics: any): any;
    predictFuture(data: any[], periods?: number): any[];
    getTrends(range: string): Promise<any>;
    destroy(): Promise<void>;
  }
}

declare module '@/services/analytics/UserImpactAssessment' {
  import { EventEmitter } from 'events';
  export interface ImpactMetrics {
    impactedUsers: number;
    impactedSessions: number;
    severityDistribution: Record<string, number>;
    geographicDistribution: Record<string, number>;
  }

  export class UserImpactAssessment extends EventEmitter {
    constructor(sessionService: any, dataStore: any);
    assessImpact(errorData: any): ImpactMetrics;
    getImpactedWorkflows(): any[];
    getRecoveryRecommendations(): string[];
    calculateUserScore(metrics: any): number;
    destroy(): Promise<void>;
  }
}

declare module '@/services/analytics/PerformanceCorrelationAnalyzer' {
  import { EventEmitter } from 'events';
  export interface CorrelationData {
    metric1: string;
    metric2: string;
    correlation: number;
    significance: number;
  }

  export class PerformanceCorrelationAnalyzer extends EventEmitter {
    constructor(telemetryService: any, healthService: any, errorAnalytics: any, logger: any);
    analyzeCorrelations(metrics: any): CorrelationData[];
    findRootCause(errorData: any): any;
    findStrongestCorrelation(data: any): any;
    getCorrelations(range: string): Promise<any>;
    destroy(): Promise<void>;
  }
}

declare module '@/services/analytics/AnalyticsDataStore' {
  export interface StorageOptions {
    maxSize?: number;
    compression?: boolean;
    encryption?: boolean;
  }

  export class AnalyticsDataStore {
    constructor(options?: StorageOptions);
    store(key: string, data: any): Promise<void>;
    retrieve(key: string): Promise<any>;
    query(criteria: any): Promise<any[]>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    getMetrics(type: string, range: string): Promise<any>;
    destroy(): Promise<void>;
  }
}

declare module '@/services/analytics/ReportGenerator' {
  export interface ReportOptions {
    format: 'pdf' | 'html' | 'json';
    includeCharts?: boolean;
    includeRawData?: boolean;
  }

  export class ReportGenerator {
    constructor(dataStore: any, errorAnalytics: any, trendAnalyzer: any, performanceAnalyzer: any, userImpact: any, logger: any);
    generateReport(type: string, data: any, config?: any): Promise<any>;
    scheduleReport(schedule: string, options: ReportOptions): void;
    createConfigFromTemplate(template: string): any;
    destroy(): Promise<void>;
  }
}

// Logging services
declare module '@/lib/logging/Logger' {
  export interface LoggerOptions {
    level?: 'debug' | 'info' | 'warn' | 'error';
    context?: string;
  }

  export class Logger {
    constructor(options?: LoggerOptions);
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    setContext(context: string): void;
  }
}

declare module '@/lib/logging/AuditLogger' {
  export interface AuditEvent {
    action?: string;
    operation?: string;
    actorType?: string;
    userId?: string;
    timestamp: Date;
    metadata?: any;
  }

  export class AuditLogger {
    constructor();
    log(operation: string, data: any, metadata?: any): Promise<void>;
    logOperation(event: AuditEvent): Promise<void>;
    query(criteria: any): AuditEvent[];
  }
}

// Monitoring services
declare module '@/services/monitoring/HealthMonitoringService' {
  import { EventEmitter } from 'events';
  export interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    cpu: {
      usage: number;
      threshold: number;
      loadAverage?: number[];
    };
    memory: {
      used: number;
      total: number;
      swap?: {
        used: number;
        total: number;
      };
    };
    performance: {
      responseTime: number;
      errorRate: number;
      throughput?: number;
    };
    network: {
      latency: number;
      packetLoss: number;
      failedRequests?: number;
      totalRequests?: number;
    };
    storage?: {
      used: number;
      total: number;
    };
  }

  export interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastCheck: Date;
  }

  export class HealthMonitoringService extends EventEmitter {
    constructor();
    checkHealth(): Promise<HealthCheck[]>;
    getStatus(): HealthStatus;
    getHealthStatus(): Promise<HealthStatus>;
    registerCheck(name: string, check: () => Promise<boolean>): void;
  }
}

declare module '@/services/monitoring/AlertManagementSystem' {
  import { EventEmitter } from 'events';
  export type AlertChannel = 'email' | 'sms' | 'slack' | 'webhook';
  export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

  export interface Alert {
    id: string;
    title: string;
    description: string;
    priority: AlertPriority;
    timestamp: Date;
    channels: AlertChannel[];
  }

  export class AlertManagementSystem extends EventEmitter {
    constructor(errorAnalytics: any, healthService: any, notificationService: any, errorHandler: any, logger: any, auditLogger: any);
    createAlert(config: any): void;
    checkThresholds(metrics: any): void;
    sendAlert(alert: Alert): Promise<void>;
    getActiveAlerts(): Alert[];
    acknowledgeAlert(id: string): void;
    resolveAlert(id: string): void;
    destroy(): Promise<void>;
  }
}

// Core services
declare module '@/core/orchestrator/EnhancedErrorHandler' {
  export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
  }

  export interface RetryConfig {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  }

  export interface ErrorInfo {
    error: Error;
    severity: ErrorSeverity;
    context?: any;
    timestamp: Date;
  }

  export class EnhancedErrorHandler {
    constructor();
    handleError(error: Error, severity?: ErrorSeverity, context?: any): void;
    setRetryConfig(config: RetryConfig): void;
    getErrorHistory(): ErrorInfo[];
    classifySeverity(error: Error): ErrorSeverity;
  }
}

// Telemetry services
declare module '@/services/telemetry/TelemetryCollectionService' {
  import { EventEmitter } from 'events';
  
  export enum TelemetryEventCategory {
    ERROR = 'error',
    PERFORMANCE = 'performance',
    USER_ACTION = 'user_action',
    SYSTEM = 'system'
  }
  
  export interface TelemetryData {
    metric: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
  }

  export class TelemetryCollectionService extends EventEmitter {
    constructor();
    collect(data: TelemetryData): void;
    flush(): Promise<void>;
    getMetrics(query: any): TelemetryData[];
    getAggregatedMetrics(timeRange: number): Promise<any>;
  }
}

// Notification services
declare module '@/services/notifications/NotificationService' {
  export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    timestamp: Date;
  }

  export class NotificationService {
    constructor();
    send(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<void>;
    notify(notification: { title: string; message: string; type: string; persistent?: boolean; actions?: any[] }): Promise<void>;
    getNotifications(): Notification[];
    markAsRead(id: string): void;
  }
}