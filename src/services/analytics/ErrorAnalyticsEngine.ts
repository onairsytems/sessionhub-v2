import { EnhancedErrorHandler, ErrorSeverity } from '@/core/orchestrator/EnhancedErrorHandler';
import { TelemetryCollectionService, TelemetryEventCategory } from '@/services/telemetry/TelemetryCollectionService';
import { HealthMonitoringService } from '@/services/monitoring/HealthMonitoringService';
import { EventEmitter } from 'events';

export interface ErrorMetrics {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByType: Record<string, number>;
  errorRate: number;
  errorTrend: 'increasing' | 'decreasing' | 'stable';
  impactedUsers: number;
  impactedSessions: number;
  recoveryRate: number;
  meanTimeToRecovery: number;
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  severity: ErrorSeverity;
  affectedComponents: string[];
  suggestedFix?: string;
}

export interface ErrorInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'correlation' | 'prediction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  relatedErrors: string[];
  timestamp: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface ErrorCorrelation {
  primaryError: string;
  correlatedErrors: string[];
  correlationStrength: number;
  commonFactors: string[];
}

export class ErrorAnalyticsEngine extends EventEmitter {
  private errorHandler: EnhancedErrorHandler;
  private telemetryService: TelemetryCollectionService;
  private healthMonitor: HealthMonitoringService;
  
  private errorBuffer: Array<{error: Error; timestamp: Date; context: any}> = [];
  private metrics: ErrorMetrics;
  private patterns: Map<string, ErrorPattern> = new Map();
  private insights: ErrorInsight[] = [];
  private correlations: ErrorCorrelation[] = [];
  
  private analyticsInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 1000;
  private readonly ANALYSIS_INTERVAL = 60000; // 1 minute
  private readonly PATTERN_THRESHOLD = 3;
  
  constructor(
    errorHandler: EnhancedErrorHandler,
    telemetryService: TelemetryCollectionService,
    healthMonitor: HealthMonitoringService
  ) {
    super();
    this.errorHandler = errorHandler;
    this.telemetryService = telemetryService;
    this.healthMonitor = healthMonitor;
    
    this.metrics = this.initializeMetrics();
    this.setupErrorInterception();
    this.startAnalyticsEngine();
  }
  
  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      errorsByType: {},
      errorRate: 0,
      errorTrend: 'stable',
      impactedUsers: 0,
      impactedSessions: 0,
      recoveryRate: 0,
      meanTimeToRecovery: 0
    };
  }
  
  private setupErrorInterception(): void {
    // Intercept errors from error handler
    const originalHandleError = this.errorHandler.handleError.bind(this.errorHandler);
    this.errorHandler.handleError = async (error: Error, context?: any) => {
      this.captureError(error, context);
      return originalHandleError(error, context);
    };
    
    // Listen to telemetry events
    this.telemetryService.on('event', (event: any) => {
      if (event.category === TelemetryEventCategory.ERROR) {
        this.processTelemetryError(event);
      }
    });
  }
  
  private captureError(error: Error, context?: any): void {
    const errorEntry = {
      error,
      timestamp: new Date(),
      context: {
        ...context,
        stack: error.stack,
        severity: this.errorHandler.classifySeverity(error),
        userAgent: globalThis.navigator?.userAgent,
        timestamp: Date.now()
      }
    };
    
    this.errorBuffer.push(errorEntry);
    if (this.errorBuffer.length > this.BUFFER_SIZE) {
      this.errorBuffer.shift();
    }
    
    this.updateRealTimeMetrics(errorEntry);
    this.emit('error:captured', errorEntry);
  }
  
  private processTelemetryError(event: any): void {
    if (event.data?.error) {
      this.captureError(
        new Error(event.data.error.message || 'Unknown error'),
        event.data.context
      );
    }
  }
  
  private updateRealTimeMetrics(errorEntry: any): void {
    this.metrics.totalErrors++;
    
    const severity = errorEntry.context.severity as ErrorSeverity;
    this.metrics.errorsBySeverity[severity] = (this.metrics.errorsBySeverity[severity] || 0) + 1;
    
    const errorType = errorEntry.error.name || 'UnknownError';
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    
    // Update error rate (errors per minute)
    const recentErrors = this.errorBuffer.filter(
      e => e.timestamp.getTime() > Date.now() - 60000
    );
    this.metrics.errorRate = recentErrors.length;
    
    // Emit real-time update
    this.emit('metrics:updated', this.metrics);
  }
  
  private startAnalyticsEngine(): void {
    this.analyticsInterval = setInterval(() => {
      this.runAnalysis();
    }, this.ANALYSIS_INTERVAL);
    
    // Run initial analysis
    this.runAnalysis();
  }
  
  private async runAnalysis(): Promise<void> {
    try {
      await Promise.all([
        this.analyzeErrorPatterns(),
        this.detectAnomalies(),
        this.findCorrelations(),
        this.calculateTrends(),
        this.assessUserImpact(),
        this.generateInsights()
      ]);
      
      this.emit('analysis:complete', {
        metrics: this.metrics,
        patterns: Array.from(this.patterns.values()),
        insights: this.insights,
        correlations: this.correlations
      });
    } catch (error) {
      // console.error('Error during analysis:', error);
    }
  }
  
  private async analyzeErrorPatterns(): Promise<void> {
    const patternMap = new Map<string, ErrorPattern>();
    
    for (const entry of this.errorBuffer) {
      const pattern = this.extractPattern(entry.error);
      const existing = patternMap.get(pattern);
      
      if (existing) {
        existing.frequency++;
        existing.lastOccurrence = entry.timestamp;
        if (entry.context.component) {
          existing.affectedComponents.push(entry.context.component);
        }
      } else {
        patternMap.set(pattern, {
          pattern,
          frequency: 1,
          lastOccurrence: entry.timestamp,
          severity: entry.context.severity,
          affectedComponents: entry.context.component ? [entry.context.component] : [],
          suggestedFix: this.suggestFix(entry.error)
        });
      }
    }
    
    // Filter patterns that meet threshold
    for (const [key, pattern] of patternMap) {
      if (pattern.frequency >= this.PATTERN_THRESHOLD) {
        this.patterns.set(key, pattern);
      }
    }
  }
  
  private extractPattern(error: Error): string {
    // Extract pattern from error message and stack
    const message = error.message.replace(/\d+/g, 'N').replace(/0x[0-9a-fA-F]+/g, 'HEX');
    const stackLines = (error.stack || '').split('\n').slice(0, 3);
    return `${error.name}:${message}:${stackLines.join('|')}`;
  }
  
  private suggestFix(error: Error): string | undefined {
    // Pattern-based fix suggestions
    const fixMap: Record<string, string> = {
      'TypeError': 'Check for null/undefined values before accessing properties',
      'ReferenceError': 'Ensure variables are declared before use',
      'NetworkError': 'Implement retry logic with exponential backoff',
      'TimeoutError': 'Increase timeout duration or optimize performance',
      'MemoryError': 'Reduce memory usage or increase available memory'
    };
    
    return fixMap[error.name];
  }
  
  private async detectAnomalies(): Promise<void> {
    const recentErrors = this.errorBuffer.filter(
      e => e.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
    );
    
    // Calculate baseline
    const baseline = this.calculateBaseline();
    const currentRate = recentErrors.length / 5; // Per minute
    
    if (currentRate > baseline * 2) {
      this.insights.push({
        id: `anomaly-${Date.now()}`,
        type: 'anomaly',
        severity: 'high',
        title: 'Abnormal Error Rate Detected',
        description: `Error rate is ${Math.round(currentRate / baseline)}x higher than normal`,
        impact: 'Potential system instability or ongoing incident',
        recommendation: 'Investigate recent changes and monitor system health',
        relatedErrors: recentErrors.slice(0, 5).map(e => e.error.message),
        timestamp: new Date()
      });
    }
  }
  
  private calculateBaseline(): number {
    // Calculate average error rate over past hour
    const hourAgo = Date.now() - 3600000;
    const hourlyErrors = this.errorBuffer.filter(
      e => e.timestamp.getTime() > hourAgo
    );
    return hourlyErrors.length / 60; // Per minute
  }
  
  private async findCorrelations(): Promise<void> {
    const errorGroups = this.groupErrorsByTimeWindow();
    
    for (const group of errorGroups) {
      if (group.length > 1) {
        const correlation = this.analyzeCorrelation(group);
        if (correlation && correlation.correlationStrength > 0.7) {
          this.correlations.push(correlation);
        }
      }
    }
  }
  
  private groupErrorsByTimeWindow(): Array<Array<any>> {
    const groups: Array<Array<any>> = [];
    const windowSize = 5000; // 5 seconds
    
    let currentGroup: Array<any> = [];
    let windowStart = 0;
    
    for (const entry of this.errorBuffer) {
      const timestamp = entry.timestamp.getTime();
      
      if (timestamp - windowStart > windowSize) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [entry];
        windowStart = timestamp;
      } else {
        currentGroup.push(entry);
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  private analyzeCorrelation(errors: Array<any>): ErrorCorrelation | null {
    if (errors.length < 2) return null;
    
    const primaryError = errors[0];
    const correlatedErrors = errors.slice(1);
    
    // Find common factors
    const commonFactors: string[] = [];
    
    // Check for common components
    const components = errors.map(e => e.context?.component).filter(Boolean);
    if (components.length === errors.length && new Set(components).size === 1) {
      commonFactors.push(`component:${components[0]}`);
    }
    
    // Check for common user
    const users = errors.map(e => e.context?.userId).filter(Boolean);
    if (users.length === errors.length && new Set(users).size === 1) {
      commonFactors.push(`user:${users[0]}`);
    }
    
    // Calculate correlation strength
    const timeSpan = errors[errors.length - 1].timestamp.getTime() - errors[0].timestamp.getTime();
    const correlationStrength = Math.max(0, 1 - (timeSpan / 10000)); // Stronger if closer in time
    
    return {
      primaryError: primaryError.error.message,
      correlatedErrors: correlatedErrors.map(e => e.error.message),
      correlationStrength,
      commonFactors
    };
  }
  
  private async calculateTrends(): Promise<void> {
    const windows = [
      { size: 300000, label: '5min' },    // 5 minutes
      { size: 3600000, label: '1hour' },  // 1 hour
      { size: 86400000, label: '24hour' } // 24 hours
    ];
    
    for (const window of windows) {
      const current = this.errorBuffer.filter(
        e => e.timestamp.getTime() > Date.now() - window.size
      ).length;
      
      const previous = this.errorBuffer.filter(
        e => e.timestamp.getTime() > Date.now() - (window.size * 2) &&
             e.timestamp.getTime() <= Date.now() - window.size
      ).length;
      
      if (previous > 0) {
        const change = ((current - previous) / previous) * 100;
        
        if (change > 20) {
          this.metrics.errorTrend = 'increasing';
        } else if (change < -20) {
          this.metrics.errorTrend = 'decreasing';
        } else {
          this.metrics.errorTrend = 'stable';
        }
      }
    }
  }
  
  private async assessUserImpact(): Promise<void> {
    const impactedUsers = new Set<string>();
    const impactedSessions = new Set<string>();
    let recoveredErrors = 0;
    let totalRecoveryTime = 0;
    
    for (const entry of this.errorBuffer) {
      if (entry.context?.userId) {
        impactedUsers.add(entry.context.userId);
      }
      if (entry.context?.sessionId) {
        impactedSessions.add(entry.context.sessionId);
      }
      if (entry.context?.recovered) {
        recoveredErrors++;
        if (entry.context.recoveryTime) {
          totalRecoveryTime += entry.context.recoveryTime;
        }
      }
    }
    
    this.metrics.impactedUsers = impactedUsers.size;
    this.metrics.impactedSessions = impactedSessions.size;
    this.metrics.recoveryRate = this.metrics.totalErrors > 0 
      ? recoveredErrors / this.metrics.totalErrors 
      : 0;
    this.metrics.meanTimeToRecovery = recoveredErrors > 0 
      ? totalRecoveryTime / recoveredErrors 
      : 0;
  }
  
  private async generateInsights(): Promise<void> {
    // Clear old insights
    this.insights = this.insights.filter(
      i => i.timestamp.getTime() > Date.now() - 3600000 // Keep last hour
    );
    
    // Generate pattern-based insights
    for (const pattern of this.patterns.values()) {
      if (pattern.frequency > 10 && pattern.severity >= ErrorSeverity.HIGH) {
        this.insights.push({
          id: `pattern-${Date.now()}-${pattern.pattern.substring(0, 10)}`,
          type: 'pattern',
          severity: 'high',
          title: `Recurring ${pattern.severity} Error Pattern`,
          description: `"${pattern.pattern.split(':')[1]}" has occurred ${pattern.frequency} times`,
          impact: `Affecting ${pattern.affectedComponents.length} components`,
          recommendation: pattern.suggestedFix || 'Review error logs and implement fixes',
          relatedErrors: [pattern.pattern],
          timestamp: new Date()
        });
      }
    }
    
    // Generate correlation insights
    for (const correlation of this.correlations) {
      if (correlation.correlationStrength > 0.8) {
        this.insights.push({
          id: `correlation-${Date.now()}`,
          type: 'correlation',
          severity: 'medium',
          title: 'Correlated Errors Detected',
          description: `${correlation.correlatedErrors.length + 1} errors occurring together`,
          impact: `Common factors: ${correlation.commonFactors.join(', ')}`,
          recommendation: 'Investigate root cause of correlated failures',
          relatedErrors: [correlation.primaryError, ...correlation.correlatedErrors],
          timestamp: new Date()
        });
      }
    }
    
    // Generate prediction insights
    if (this.metrics.errorTrend === 'increasing' && this.metrics.errorRate > 10) {
      const health = await this.healthMonitor.getHealthStatus();
      this.insights.push({
        id: `prediction-${Date.now()}`,
        type: 'prediction',
        severity: 'critical',
        title: 'System Instability Predicted',
        description: 'Error rate increasing rapidly, system failure possible',
        impact: `${this.metrics.impactedUsers} users affected, system health: ${health.overall}`,
        recommendation: 'Immediate intervention required - check system resources',
        relatedErrors: [],
        timestamp: new Date()
      });
    }
  }
  
  // Public API methods
  
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }
  
  public getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values());
  }
  
  public getInsights(): ErrorInsight[] {
    return [...this.insights];
  }
  
  public getCorrelations(): ErrorCorrelation[] {
    return [...this.correlations];
  }
  
  public getTimeSeries(metric: keyof ErrorMetrics, duration: number): TimeSeriesData[] {
    const data: TimeSeriesData[] = [];
    const interval = duration > 3600000 ? 300000 : 60000; // 5 min or 1 min intervals
    const startTime = Date.now() - duration;
    
    for (let time = startTime; time <= Date.now(); time += interval) {
      const windowErrors = this.errorBuffer.filter(
        e => e.timestamp.getTime() >= time && 
             e.timestamp.getTime() < time + interval
      );
      
      let value = 0;
      switch (metric) {
        case 'totalErrors':
          value = windowErrors.length;
          break;
        case 'errorRate':
          value = windowErrors.length / (interval / 60000);
          break;
        case 'impactedUsers':
          value = new Set(windowErrors.map(e => e.context?.userId).filter(Boolean)).size;
          break;
        case 'recoveryRate':
          const recovered = windowErrors.filter(e => e.context?.recovered).length;
          value = windowErrors.length > 0 ? recovered / windowErrors.length : 0;
          break;
      }
      
      data.push({
        timestamp: new Date(time),
        value,
        metadata: { metric }
      });
    }
    
    return data;
  }
  
  public async generateReport(startDate: Date, endDate: Date): Promise<any> {
    const relevantErrors = this.errorBuffer.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );
    
    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalErrors: relevantErrors.length,
        uniquePatterns: new Set(relevantErrors.map(e => this.extractPattern(e.error))).size,
        impactedUsers: new Set(relevantErrors.map(e => e.context?.userId).filter(Boolean)).size,
        averageErrorRate: relevantErrors.length / ((endDate.getTime() - startDate.getTime()) / 60000)
      },
      topErrors: this.getTopErrors(relevantErrors, 10),
      severityDistribution: this.getSeverityDistribution(relevantErrors),
      componentHealth: this.getComponentHealth(relevantErrors),
      recommendations: this.generateRecommendations(relevantErrors)
    };
  }
  
  private getTopErrors(errors: Array<any>, limit: number): Array<any> {
    const errorCounts = new Map<string, number>();
    
    for (const error of errors) {
      const key = error.error.message;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }
    
    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([message, count]) => ({ message, count }));
  }
  
  private getSeverityDistribution(errors: Array<any>): Record<ErrorSeverity, number> {
    const distribution = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    for (const error of errors) {
      const severity = error.context?.severity || ErrorSeverity.MEDIUM;
      distribution[severity as ErrorSeverity]++;
    }
    
    return distribution;
  }
  
  private getComponentHealth(errors: Array<any>): Array<any> {
    const componentErrors = new Map<string, number>();
    
    for (const error of errors) {
      if (error.context?.component) {
        componentErrors.set(
          error.context.component,
          (componentErrors.get(error.context.component) || 0) + 1
        );
      }
    }
    
    return Array.from(componentErrors.entries())
      .map(([component, errorCount]) => ({
        component,
        errorCount,
        health: errorCount > 10 ? 'poor' : errorCount > 5 ? 'fair' : 'good'
      }))
      .sort((a, b) => b.errorCount - a.errorCount);
  }
  
  private generateRecommendations(errors: Array<any>): string[] {
    const recommendations: string[] = [];
    
    // Check for high error rate
    if (errors.length > 100) {
      recommendations.push('High error volume detected - consider implementing rate limiting');
    }
    
    // Check for critical errors
    const criticalErrors = errors.filter(
      e => e.context?.severity === ErrorSeverity.CRITICAL
    );
    if (criticalErrors.length > 0) {
      recommendations.push(`${criticalErrors.length} critical errors require immediate attention`);
    }
    
    // Check for patterns
    const patterns = new Set(errors.map(e => this.extractPattern(e.error)));
    if (patterns.size < errors.length * 0.1) {
      recommendations.push('Many duplicate errors - implement error deduplication');
    }
    
    return recommendations;
  }
  
  public destroy(): void {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
    
    this.removeAllListeners();
    this.errorBuffer = [];
    this.patterns.clear();
    this.insights = [];
    this.correlations = [];
  }
}