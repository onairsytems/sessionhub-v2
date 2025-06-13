import { EventEmitter } from 'events';
import { ErrorAnalyticsEngine } from './ErrorAnalyticsEngine';
import { ErrorTrendAnalyzer } from './ErrorTrendAnalyzer';
import { UserImpactAssessment } from './UserImpactAssessment';
import { PerformanceCorrelationAnalyzer } from './PerformanceCorrelationAnalyzer';
import { AnalyticsDataStore } from './AnalyticsDataStore';
import { AlertManagementSystem } from '../monitoring/AlertManagementSystem';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  format: 'pdf' | 'html' | 'json' | 'csv' | 'excel';
  recipients: ReportRecipient[];
  sections: ReportSection[];
  filters: ReportFilters;
  scheduling: ReportScheduling;
  customization: ReportCustomization;
}

export interface ReportRecipient {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'developer' | 'stakeholder';
  preferences: {
    format: string[];
    sections: string[];
    summary: boolean;
  };
}

export interface ReportSection {
  id: string;
  type: 'summary' | 'trends' | 'patterns' | 'impacts' | 'correlations' | 'alerts' | 'recommendations';
  title: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface ReportFilters {
  dateRange: { start: Date; end: Date };
  severityLevels: string[];
  errorTypes: string[];
  userSegments: string[];
  components: string[];
  customCriteria?: Record<string, any>;
}

export interface ReportScheduling {
  enabled: boolean;
  timezone: string;
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly reports
  dayOfMonth?: number; // 1-31 for monthly reports
  nextRun?: Date;
}

export interface ReportCustomization {
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  branding: {
    companyName: string;
    footer: string;
  };
  layout: 'standard' | 'executive' | 'technical' | 'dashboard';
}

export interface GeneratedReport {
  id: string;
  configId: string;
  name: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  format: string;
  filePath: string;
  size: number;
  recipients: string[];
  sections: GeneratedReportSection[];
  metadata: {
    totalErrors: number;
    totalUsers: number;
    keyInsights: string[];
    recommendations: string[];
  };
}

export interface GeneratedReportSection {
  id: string;
  type: string;
  title: string;
  data: any;
  charts?: ChartData[];
  insights?: string[];
}

export interface ChartData {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
  title: string;
  data: any[];
  config?: Record<string, any>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'executive' | 'technical' | 'operational' | 'compliance';
  sections: ReportSection[];
  defaultConfig: Partial<ReportConfig>;
}

export class ReportGenerator extends EventEmitter {
  private analyticsEngine: ErrorAnalyticsEngine;
  private trendAnalyzer: ErrorTrendAnalyzer;
  private userImpactAssessment: UserImpactAssessment;
  private performanceAnalyzer: PerformanceCorrelationAnalyzer;
  // private dataStore: AnalyticsDataStore;
  private alertSystem: AlertManagementSystem;
  
  private reportConfigs: Map<string, ReportConfig> = new Map();
  private generatedReports: Map<string, GeneratedReport> = new Map();
  private reportTemplates: Map<string, ReportTemplate> = new Map();
  
  private schedulingInterval: NodeJS.Timeout | null = null;
  private reportsDir: string;
  
  constructor(
    analyticsEngine: ErrorAnalyticsEngine,
    trendAnalyzer: ErrorTrendAnalyzer,
    userImpactAssessment: UserImpactAssessment,
    performanceAnalyzer: PerformanceCorrelationAnalyzer,
    _dataStore: AnalyticsDataStore,
    alertSystem: AlertManagementSystem,
    reportsDir: string = './reports'
  ) {
    super();
    this.analyticsEngine = analyticsEngine;
    this.trendAnalyzer = trendAnalyzer;
    this.userImpactAssessment = userImpactAssessment;
    this.performanceAnalyzer = performanceAnalyzer;
    // this.dataStore = dataStore;
    this.alertSystem = alertSystem;
    this.reportsDir = reportsDir;
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    // Ensure reports directory exists
    await fs.mkdir(this.reportsDir, { recursive: true });
    
    // Initialize default templates
    this.initializeDefaultTemplates();
    
    // Start scheduling
    this.startScheduling();
  }
  
  private initializeDefaultTemplates(): void {
    const templates: ReportTemplate[] = [
      {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'High-level overview for executives and stakeholders',
        type: 'executive',
        sections: [
          { id: 'summary', type: 'summary', title: 'Executive Summary', enabled: true },
          { id: 'key-metrics', type: 'trends', title: 'Key Metrics', enabled: true },
          { id: 'top-issues', type: 'patterns', title: 'Top Issues', enabled: true },
          { id: 'user-impact', type: 'impacts', title: 'User Impact', enabled: true },
          { id: 'recommendations', type: 'recommendations', title: 'Action Items', enabled: true }
        ],
        defaultConfig: {
          format: 'pdf',
          frequency: 'weekly',
          customization: {
            colors: { primary: '#1f2937', secondary: '#6b7280', accent: '#3b82f6' },
            branding: { companyName: 'SessionHub', footer: 'Confidential - Internal Use Only' },
            layout: 'executive'
          }
        }
      },
      {
        id: 'technical-deep-dive',
        name: 'Technical Deep Dive',
        description: 'Detailed technical analysis for developers and engineers',
        type: 'technical',
        sections: [
          { id: 'summary', type: 'summary', title: 'Technical Summary', enabled: true },
          { id: 'error-trends', type: 'trends', title: 'Error Trends', enabled: true },
          { id: 'pattern-analysis', type: 'patterns', title: 'Pattern Analysis', enabled: true },
          { id: 'performance-correlations', type: 'correlations', title: 'Performance Correlations', enabled: true },
          { id: 'system-health', type: 'correlations', title: 'System Health', enabled: true },
          { id: 'technical-recommendations', type: 'recommendations', title: 'Technical Recommendations', enabled: true }
        ],
        defaultConfig: {
          format: 'html',
          frequency: 'daily',
          customization: {
            colors: { primary: '#059669', secondary: '#6b7280', accent: '#10b981' },
            branding: { companyName: 'SessionHub Engineering', footer: 'Technical Report' },
            layout: 'technical'
          }
        }
      },
      {
        id: 'operational-status',
        name: 'Operational Status',
        description: 'Real-time operational insights for support teams',
        type: 'operational',
        sections: [
          { id: 'current-status', type: 'summary', title: 'Current Status', enabled: true },
          { id: 'active-alerts', type: 'alerts', title: 'Active Alerts', enabled: true },
          { id: 'user-impact-analysis', type: 'impacts', title: 'User Impact Analysis', enabled: true },
          { id: 'trend-analysis', type: 'trends', title: 'Trend Analysis', enabled: true },
          { id: 'immediate-actions', type: 'recommendations', title: 'Immediate Actions', enabled: true }
        ],
        defaultConfig: {
          format: 'html',
          frequency: 'daily',
          customization: {
            colors: { primary: '#dc2626', secondary: '#6b7280', accent: '#ef4444' },
            branding: { companyName: 'SessionHub Operations', footer: 'Operations Report' },
            layout: 'dashboard'
          }
        }
      },
      {
        id: 'compliance-audit',
        name: 'Compliance Audit',
        description: 'Compliance and audit trail report',
        type: 'compliance',
        sections: [
          { id: 'audit-summary', type: 'summary', title: 'Audit Summary', enabled: true },
          { id: 'error-tracking', type: 'patterns', title: 'Error Tracking', enabled: true },
          { id: 'user-privacy', type: 'impacts', title: 'User Privacy Impact', enabled: true },
          { id: 'alert-history', type: 'alerts', title: 'Alert History', enabled: true },
          { id: 'compliance-status', type: 'recommendations', title: 'Compliance Status', enabled: true }
        ],
        defaultConfig: {
          format: 'pdf',
          frequency: 'monthly',
          customization: {
            colors: { primary: '#7c3aed', secondary: '#6b7280', accent: '#8b5cf6' },
            branding: { companyName: 'SessionHub Compliance', footer: 'Compliance Report - Confidential' },
            layout: 'standard'
          }
        }
      }
    ];
    
    templates.forEach(template => {
      this.reportTemplates.set(template.id, template);
    });
  }
  
  private startScheduling(): void {
    // Check for scheduled reports every minute
    this.schedulingInterval = setInterval(() => {
      this.checkScheduledReports();
    }, 60000);
  }
  
  private async checkScheduledReports(): Promise<void> {
    const now = new Date();
    
    for (const [id, config] of this.reportConfigs) {
      if (config.scheduling.enabled && config.scheduling.nextRun) {
        if (now >= config.scheduling.nextRun) {
          try {
            await this.generateReport(id);
            this.scheduleNextRun(config);
          } catch (error) {
            // console.error(`Failed to generate scheduled report ${id}:`, error);
          }
        }
      }
    }
  }
  
  private scheduleNextRun(config: ReportConfig): void {
    const now = new Date();
    let nextRun: Date;
    
    switch (config.frequency) {
      case 'daily':
        nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun = new Date(now);
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      case 'quarterly':
        nextRun = new Date(now);
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
      default:
        return; // Custom scheduling not implemented
    }
    
    // Set time
    const [hours, minutes] = config.scheduling.time.split(':').map(Number);
    nextRun.setHours(hours || 0, minutes || 0, 0, 0);
    
    config.scheduling.nextRun = nextRun;
  }
  
  public async generateReport(configId: string, customFilters?: Partial<ReportFilters>): Promise<GeneratedReport> {
    const config = this.reportConfigs.get(configId);
    if (!config) {
      throw new Error(`Report configuration not found: ${configId}`);
    }
    
    try {
      // Merge filters
      const filters = customFilters ? { ...config.filters, ...customFilters } : config.filters;
      
      // Collect data for all sections
      const sectionsData = await this.collectSectionData(config.sections, filters);
      
      // Generate report content
      const reportContent = await this.generateReportContent(config, sectionsData, filters);
      
      // Generate file
      const filePath = await this.generateReportFile(config, reportContent);
      
      // Get file size
      const stats = await fs.stat(filePath);
      
      // Create report record
      const report: GeneratedReport = {
        id: `report-${Date.now()}`,
        configId,
        name: config.name,
        generatedAt: new Date(),
        period: filters.dateRange,
        format: config.format,
        filePath,
        size: stats.size,
        recipients: config.recipients.map(r => r.email),
        sections: sectionsData,
        metadata: this.extractReportMetadata(sectionsData)
      };
      
      this.generatedReports.set(report.id, report);
      
      // Send to recipients if configured
      if (config.recipients.length > 0) {
        await this.sendReportToRecipients(report, config.recipients);
      }
      
      this.emit('report:generated', report);
      return report;
    } catch (error) {
      // console.error(`Failed to generate report ${configId}:`, error);
      throw error;
    }
  }
  
  private async collectSectionData(
    sections: ReportSection[], 
    filters: ReportFilters
  ): Promise<GeneratedReportSection[]> {
    const sectionsData: GeneratedReportSection[] = [];
    
    for (const section of sections.filter(s => s.enabled)) {
      const sectionData = await this.collectDataForSection(section, filters);
      sectionsData.push(sectionData);
    }
    
    return sectionsData;
  }
  
  private async collectDataForSection(
    section: ReportSection, 
    filters: ReportFilters
  ): Promise<GeneratedReportSection> {
    let data: any = {};
    let charts: ChartData[] = [];
    let insights: string[] = [];
    
    switch (section.type) {
      case 'summary':
        data = await this.collectSummaryData(filters);
        charts = this.generateSummaryCharts(data);
        insights = this.generateSummaryInsights(data);
        break;
        
      case 'trends':
        data = await this.collectTrendData(filters);
        charts = this.generateTrendCharts(data);
        insights = this.generateTrendInsights(data);
        break;
        
      case 'patterns':
        data = await this.collectPatternData(filters);
        charts = this.generatePatternCharts(data);
        insights = this.generatePatternInsights(data);
        break;
        
      case 'impacts':
        data = await this.collectImpactData(filters);
        charts = this.generateImpactCharts(data);
        insights = this.generateImpactInsights(data);
        break;
        
      case 'correlations':
        data = await this.collectCorrelationData(filters);
        charts = this.generateCorrelationCharts(data);
        insights = this.generateCorrelationInsights(data);
        break;
        
      case 'alerts':
        data = await this.collectAlertData(filters);
        charts = this.generateAlertCharts(data);
        insights = this.generateAlertInsights(data);
        break;
        
      case 'recommendations':
        data = await this.collectRecommendationData(filters);
        insights = data.recommendations || [];
        break;
    }
    
    return {
      id: section.id,
      type: section.type,
      title: section.title,
      data,
      charts,
      insights
    };
  }
  
  private async collectSummaryData(filters: ReportFilters): Promise<any> {
    const metrics = this.analyticsEngine.getMetrics();
    const userMetrics = this.userImpactAssessment.getAllUserMetrics();
    const workflowImpacts = this.userImpactAssessment.getAllWorkflowImpacts();
    
    const totalUsers = userMetrics.length;
    const affectedUsers = userMetrics.filter(u => u.errorCount > 0).length;
    const criticalIssues = metrics.errorsBySeverity['critical'] || 0;
    
    return {
      period: filters.dateRange,
      overview: {
        totalErrors: metrics.totalErrors,
        errorRate: metrics.errorRate,
        affectedUsers,
        totalUsers,
        impactPercentage: totalUsers > 0 ? (affectedUsers / totalUsers) * 100 : 0,
        criticalIssues,
        recoveryRate: metrics.recoveryRate * 100
      },
      trends: {
        errorTrend: metrics.errorTrend,
        userGrowth: userMetrics.length,
        systemStability: metrics.recoveryRate > 0.8 ? 'stable' : 'unstable'
      },
      topWorkflows: workflowImpacts
        .sort((a, b) => b.averageErrorsPerAttempt - a.averageErrorsPerAttempt)
        .slice(0, 5)
    };
  }
  
  private async collectTrendData(filters: ReportFilters): Promise<any> {
    const duration = filters.dateRange.end.getTime() - filters.dateRange.start.getTime();
    const errorRateData = this.analyticsEngine.getTimeSeries('errorRate', duration);
    const userImpactData = this.analyticsEngine.getTimeSeries('impactedUsers', duration);
    const recoveryRateData = this.analyticsEngine.getTimeSeries('recoveryRate', duration);
    
    const trends = this.trendAnalyzer.getTrends();
    const anomalies = this.trendAnalyzer.getAnomalies(10);
    const seasonality = this.trendAnalyzer.getSeasonality();
    
    return {
      timeSeries: {
        errorRate: errorRateData,
        userImpact: userImpactData,
        recoveryRate: recoveryRateData
      },
      trends,
      anomalies,
      seasonality
    };
  }
  
  private async collectPatternData(_filters: ReportFilters): Promise<any> {
    const patterns = this.analyticsEngine.getPatterns();
    const clusters = this.trendAnalyzer.getPatternClusters();
    const correlations = this.analyticsEngine.getCorrelations();
    
    return {
      errorPatterns: patterns.slice(0, 20),
      patternClusters: clusters,
      errorCorrelations: correlations.slice(0, 10),
      topErrorTypes: this.getTopErrorTypes(patterns)
    };
  }
  
  private async collectImpactData(_filters: ReportFilters): Promise<any> {
    const userMetrics = this.userImpactAssessment.getAllUserMetrics();
    const workflowImpacts = this.userImpactAssessment.getAllWorkflowImpacts();
    const userSegments = this.userImpactAssessment.getUserSegments();
    const mostImpacted = this.userImpactAssessment.getMostImpactedUsers(10);
    
    return {
      userMetrics: {
        total: userMetrics.length,
        impacted: userMetrics.filter(u => u.errorCount > 0).length,
        segments: userSegments
      },
      workflowAnalysis: workflowImpacts,
      mostImpactedUsers: mostImpacted,
      sessionAnalysis: this.calculateSessionAnalysis()
    };
  }
  
  private async collectCorrelationData(_filters: ReportFilters): Promise<any> {
    const correlations = this.performanceAnalyzer.getStrongestCorrelations(10);
    const resourceImpacts = this.performanceAnalyzer.getResourceImpacts();
    const performanceProfiles = this.performanceAnalyzer.getPerformanceProfiles();
    const currentMetrics = this.performanceAnalyzer.getCurrentResourceMetrics();
    
    return {
      performanceCorrelations: correlations,
      resourceImpacts,
      performanceProfiles,
      currentResourceStatus: currentMetrics
    };
  }
  
  private async collectAlertData(filters: ReportFilters): Promise<any> {
    const activeAlerts = this.alertSystem.getActiveAlerts();
    const alertHistory = this.alertSystem.getAlertHistory(100);
    const thresholds = this.alertSystem.getThresholds();
    
    // Filter alerts by date range
    const periodAlerts = alertHistory.filter(alert => 
      alert.timestamp >= filters.dateRange.start && 
      alert.timestamp <= filters.dateRange.end
    );
    
    return {
      activeAlerts,
      alertHistory: periodAlerts,
      alertStatistics: this.calculateAlertStatistics(periodAlerts),
      thresholdConfiguration: thresholds
    };
  }
  
  private async collectRecommendationData(_filters: ReportFilters): Promise<any> {
    const insights = this.analyticsEngine.getInsights();
    // const _trendInsights = this.trendAnalyzer.getTrends();
    const correlationInsights = this.performanceAnalyzer.getStrongestCorrelations(5);
    
    const recommendations: string[] = [];
    
    // Extract recommendations from insights
    insights.forEach(insight => {
      recommendations.push(insight.recommendation);
    });
    
    // Add correlation-based recommendations
    correlationInsights.forEach(corr => {
      recommendations.push(...corr.recommendations);
    });
    
    // Add performance recommendations
    const performanceProfiles = this.performanceAnalyzer.getPerformanceProfiles();
    performanceProfiles.forEach(profile => {
      recommendations.push(...profile.recommendations);
    });
    
    return {
      recommendations: [...new Set(recommendations)].slice(0, 10),
      prioritizedActions: this.prioritizeRecommendations(recommendations),
      insights: insights.slice(0, 5)
    };
  }
  
  private getTopErrorTypes(patterns: any[]): any[] {
    const errorTypeCounts = new Map<string, number>();
    
    patterns.forEach(pattern => {
      const errorType = pattern.pattern.split(':')[0];
      errorTypeCounts.set(errorType, (errorTypeCounts.get(errorType) || 0) + pattern.frequency);
    });
    
    return Array.from(errorTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }
  
  private calculateSessionAnalysis(): any {
    const userMetrics = this.userImpactAssessment.getAllUserMetrics();
    
    const totalSessions = userMetrics.reduce((sum, u) => sum + u.sessionCount, 0);
    const successfulSessions = userMetrics.reduce((sum, u) => 
      sum + (u.sessionCount * u.sessionSuccessRate), 0);
    
    return {
      totalSessions,
      successfulSessions: Math.round(successfulSessions),
      successRate: totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0,
      averageSessionDuration: userMetrics.reduce((sum, u) => 
        sum + u.averageSessionDuration, 0) / userMetrics.length
    };
  }
  
  private calculateAlertStatistics(alerts: any[]): any {
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(a => a.priority === 'critical').length;
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged).length;
    const resolvedAlerts = alerts.filter(a => a.resolved).length;
    
    const alertsByDay = new Map<string, number>();
    alerts.forEach(alert => {
      const day = alert.timestamp.toISOString().split('T')[0];
      alertsByDay.set(day, (alertsByDay.get(day) || 0) + 1);
    });
    
    return {
      total: totalAlerts,
      critical: criticalAlerts,
      acknowledged: acknowledgedAlerts,
      resolved: resolvedAlerts,
      averageResolutionTime: this.calculateAverageResolutionTime(alerts),
      dailyDistribution: Array.from(alertsByDay.entries())
    };
  }
  
  private calculateAverageResolutionTime(alerts: any[]): number {
    const resolvedAlerts = alerts.filter(a => a.resolved && a.resolvedAt);
    
    if (resolvedAlerts.length === 0) return 0;
    
    const totalTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime());
    }, 0);
    
    return totalTime / resolvedAlerts.length;
  }
  
  private prioritizeRecommendations(recommendations: string[]): any[] {
    // Simple prioritization based on keywords
    const priorities = new Map<string, number>();
    
    recommendations.forEach(rec => {
      let priority = 1;
      
      if (rec.toLowerCase().includes('critical') || rec.toLowerCase().includes('immediate')) {
        priority = 4;
      } else if (rec.toLowerCase().includes('high') || rec.toLowerCase().includes('urgent')) {
        priority = 3;
      } else if (rec.toLowerCase().includes('medium') || rec.toLowerCase().includes('important')) {
        priority = 2;
      }
      
      priorities.set(rec, priority);
    });
    
    return Array.from(priorities.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([recommendation, priority]) => ({ recommendation, priority }));
  }
  
  private generateSummaryCharts(data: any): ChartData[] {
    return [
      {
        id: 'error-overview',
        type: 'pie',
        title: 'Error Distribution by Severity',
        data: [
          { name: 'Critical', value: data.overview.criticalIssues, color: '#ef4444' },
          { name: 'Other', value: data.overview.totalErrors - data.overview.criticalIssues, color: '#6b7280' }
        ]
      },
      {
        id: 'user-impact',
        type: 'bar',
        title: 'User Impact Overview',
        data: [
          { category: 'Total Users', value: data.overview.totalUsers },
          { category: 'Affected Users', value: data.overview.affectedUsers },
          { category: 'Unaffected Users', value: data.overview.totalUsers - data.overview.affectedUsers }
        ]
      }
    ];
  }
  
  private generateTrendCharts(data: any): ChartData[] {
    return [
      {
        id: 'error-rate-trend',
        type: 'line',
        title: 'Error Rate Over Time',
        data: data.timeSeries.errorRate.map((point: any) => ({
          time: point.timestamp.toISOString(),
          value: point.value
        }))
      },
      {
        id: 'user-impact-trend',
        type: 'area',
        title: 'User Impact Trend',
        data: data.timeSeries.userImpact.map((point: any) => ({
          time: point.timestamp.toISOString(),
          value: point.value
        }))
      }
    ];
  }
  
  private generatePatternCharts(data: any): ChartData[] {
    return [
      {
        id: 'top-error-types',
        type: 'bar',
        title: 'Top Error Types',
        data: data.topErrorTypes.map((item: any) => ({
          type: item.type,
          count: item.count
        }))
      }
    ];
  }
  
  private generateImpactCharts(data: any): ChartData[] {
    return [
      {
        id: 'workflow-completion-rates',
        type: 'bar',
        title: 'Workflow Completion Rates',
        data: data.workflowAnalysis.map((workflow: any) => ({
          workflow: workflow.workflowName,
          rate: workflow.completionRate * 100
        }))
      }
    ];
  }
  
  private generateCorrelationCharts(data: any): ChartData[] {
    return [
      {
        id: 'performance-correlations',
        type: 'scatter',
        title: 'Performance Correlations',
        data: data.performanceCorrelations.map((corr: any) => ({
          x: corr.correlationStrength,
          y: corr.confidence === 'high' ? 3 : corr.confidence === 'medium' ? 2 : 1,
          label: corr.resourceMetric
        }))
      }
    ];
  }
  
  private generateAlertCharts(data: any): ChartData[] {
    return [
      {
        id: 'alerts-by-day',
        type: 'line',
        title: 'Daily Alert Volume',
        data: data.alertStatistics.dailyDistribution.map(([day, count]: [string, number]) => ({
          date: day,
          alerts: count
        }))
      }
    ];
  }
  
  private generateSummaryInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.overview.impactPercentage > 20) {
      insights.push(`${data.overview.impactPercentage.toFixed(1)}% of users experienced errors`);
    }
    
    if (data.overview.criticalIssues > 0) {
      insights.push(`${data.overview.criticalIssues} critical issues require immediate attention`);
    }
    
    if (data.overview.recoveryRate > 80) {
      insights.push(`High recovery rate (${data.overview.recoveryRate.toFixed(1)}%) indicates good error handling`);
    }
    
    return insights;
  }
  
  private generateTrendInsights(data: any): string[] {
    const insights: string[] = [];
    
    data.trends.forEach((trend: any) => {
      if (trend.confidence > 0.7) {
        insights.push(`${trend.description} (confidence: ${(trend.confidence * 100).toFixed(0)}%)`);
      }
    });
    
    if (data.anomalies.length > 0) {
      insights.push(`${data.anomalies.length} anomalies detected in the data`);
    }
    
    return insights;
  }
  
  private generatePatternInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.patternClusters.length > 0) {
      insights.push(`${data.patternClusters.length} error pattern clusters identified`);
    }
    
    const frequentPatterns = data.errorPatterns.filter((p: any) => p.frequency > 10);
    if (frequentPatterns.length > 0) {
      insights.push(`${frequentPatterns.length} high-frequency error patterns detected`);
    }
    
    return insights;
  }
  
  private generateImpactInsights(data: any): string[] {
    const insights: string[] = [];
    
    const strugglingWorkflows = data.workflowAnalysis.filter((w: any) => w.completionRate < 0.7);
    if (strugglingWorkflows.length > 0) {
      insights.push(`${strugglingWorkflows.length} workflows have low completion rates`);
    }
    
    if (data.sessionAnalysis.successRate < 80) {
      insights.push(`Session success rate is below 80% at ${data.sessionAnalysis.successRate.toFixed(1)}%`);
    }
    
    return insights;
  }
  
  private generateCorrelationInsights(data: any): string[] {
    const insights: string[] = [];
    
    const strongCorrelations = data.performanceCorrelations.filter((c: any) => 
      Math.abs(c.correlationStrength) > 0.7
    );
    
    if (strongCorrelations.length > 0) {
      insights.push(`${strongCorrelations.length} strong performance correlations identified`);
    }
    
    const criticalImpacts = data.resourceImpacts.filter((i: any) => i.impactLevel === 'critical');
    if (criticalImpacts.length > 0) {
      insights.push(`${criticalImpacts.length} resources have critical performance impact`);
    }
    
    return insights;
  }
  
  private generateAlertInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.alertStatistics.total > 50) {
      insights.push(`High alert volume: ${data.alertStatistics.total} alerts in reporting period`);
    }
    
    if (data.alertStatistics.critical > 0) {
      insights.push(`${data.alertStatistics.critical} critical alerts require attention`);
    }
    
    const resolutionRate = data.alertStatistics.resolved / Math.max(data.alertStatistics.total, 1);
    if (resolutionRate < 0.8) {
      insights.push(`Alert resolution rate is low at ${(resolutionRate * 100).toFixed(1)}%`);
    }
    
    return insights;
  }
  
  private async generateReportContent(
    config: ReportConfig, 
    sections: GeneratedReportSection[], 
    filters: ReportFilters
  ): Promise<any> {
    return {
      config,
      metadata: {
        generatedAt: new Date(),
        period: filters.dateRange,
        generator: 'SessionHub Analytics',
        version: '1.0'
      },
      sections,
      summary: this.generateExecutiveSummary(sections),
      appendix: {
        definitions: this.getDefinitions(),
        methodology: this.getMethodology()
      }
    };
  }
  
  private generateExecutiveSummary(sections: GeneratedReportSection[]): any {
    const summarySection = sections.find(s => s.type === 'summary');
    const keyInsights = sections.flatMap(s => s.insights || []).slice(0, 5);
    const topRecommendations = sections
      .find(s => s.type === 'recommendations')?.data?.prioritizedActions?.slice(0, 3) || [];
    
    return {
      overview: summarySection?.data?.overview || {},
      keyInsights,
      topRecommendations: topRecommendations.map((r: any) => r.recommendation)
    };
  }
  
  private getDefinitions(): Record<string, string> {
    return {
      'Error Rate': 'Number of errors per minute',
      'Recovery Rate': 'Percentage of errors that were automatically recovered',
      'User Impact': 'Number of unique users affected by errors',
      'Session Success Rate': 'Percentage of sessions completed without critical errors',
      'Correlation Strength': 'Statistical measure of relationship between variables (-1 to 1)',
      'Pattern Cluster': 'Group of similar error patterns',
      'Anomaly': 'Data point that deviates significantly from normal patterns'
    };
  }
  
  private getMethodology(): string {
    return `This report is generated using SessionHub's error analytics engine, which collects and analyzes error data, user behavior, and system performance metrics. Statistical methods including correlation analysis, trend detection, and pattern clustering are used to identify insights and generate recommendations.`;
  }
  
  private async generateReportFile(config: ReportConfig, content: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${config.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.${config.format}`;
    const filePath = path.join(this.reportsDir, fileName);
    
    switch (config.format) {
      case 'json':
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        break;
      case 'html':
        const html = this.generateHTMLReport(content, config);
        await fs.writeFile(filePath, html);
        break;
      case 'csv':
        const csv = this.generateCSVReport(content);
        await fs.writeFile(filePath, csv);
        break;
      case 'pdf':
        // PDF generation would require a library like puppeteer
        // For now, generate HTML and indicate PDF conversion needed
        const htmlContent = this.generateHTMLReport(content, config);
        await fs.writeFile(filePath.replace('.pdf', '.html'), htmlContent);
        break;
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
    
    return filePath;
  }
  
  private generateHTMLReport(content: any, config: ReportConfig): string {
    const { customization } = config;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${content.config.name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            color: #333;
            line-height: 1.6;
        }
        .header { 
            border-bottom: 3px solid ${customization.colors.primary}; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
        }
        .section { 
            margin-bottom: 40px; 
            page-break-inside: avoid;
        }
        .chart-placeholder { 
            background: #f5f5f5; 
            padding: 20px; 
            text-align: center; 
            border: 1px solid #ddd;
            margin: 10px 0;
        }
        .insight { 
            background: ${customization.colors.accent}20; 
            padding: 10px; 
            border-left: 4px solid ${customization.colors.accent};
            margin: 10px 0;
        }
        .recommendation { 
            background: #f0f9ff; 
            padding: 15px; 
            border-radius: 5px;
            margin: 10px 0;
        }
        .footer { 
            border-top: 1px solid #ddd; 
            padding-top: 20px; 
            margin-top: 40px; 
            font-size: 0.9em; 
            color: #666;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left;
        }
        th { 
            background: ${customization.colors.primary}; 
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${content.config.name}</h1>
        <p><strong>Generated:</strong> ${content.metadata.generatedAt.toLocaleString()}</p>
        <p><strong>Period:</strong> ${content.metadata.period.start.toLocaleDateString()} - ${content.metadata.period.end.toLocaleDateString()}</p>
        <p><strong>Company:</strong> ${customization.branding.companyName}</p>
    </div>
    
    ${content.summary ? `
    <div class="section">
        <h2>Executive Summary</h2>
        ${content.summary.keyInsights.map((insight: string) => `
            <div class="insight">${insight}</div>
        `).join('')}
        
        ${content.summary.topRecommendations.length > 0 ? `
            <h3>Top Recommendations</h3>
            ${content.summary.topRecommendations.map((rec: string) => `
                <div class="recommendation">${rec}</div>
            `).join('')}
        ` : ''}
    </div>
    ` : ''}
    
    ${content.sections.map((section: GeneratedReportSection) => `
        <div class="section">
            <h2>${section.title}</h2>
            
            ${section.charts?.map((chart: ChartData) => `
                <div class="chart-placeholder">
                    <h4>${chart.title}</h4>
                    <p>Chart: ${chart.type.toUpperCase()} - ${chart.data.length} data points</p>
                </div>
            `).join('') || ''}
            
            ${section.insights?.length ? `
                <h3>Key Insights</h3>
                ${section.insights.map((insight: string) => `
                    <div class="insight">${insight}</div>
                `).join('')}
            ` : ''}
            
            ${section.data && Object.keys(section.data).length > 0 ? `
                <h3>Data Summary</h3>
                <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(section.data, null, 2)}</pre>
            ` : ''}
        </div>
    `).join('')}
    
    <div class="footer">
        <p>${customization.branding.footer}</p>
        <p>Generated by SessionHub Analytics Engine v${content.metadata.version}</p>
    </div>
</body>
</html>`;
  }
  
  private generateCSVReport(content: any): string {
    // Generate a basic CSV with key metrics
    const rows: string[] = [];
    
    // Header
    rows.push('Metric,Value,Timestamp');
    
    // Add summary data
    if (content.summary?.overview) {
      const overview = content.summary.overview;
      Object.entries(overview).forEach(([key, value]) => {
        rows.push(`${key},${value},${content.metadata.generatedAt.toISOString()}`);
      });
    }
    
    return rows.join('\n');
  }
  
  private extractReportMetadata(sections: GeneratedReportSection[]): any {
    const summarySection = sections.find(s => s.type === 'summary');
    const allInsights = sections.flatMap(s => s.insights || []);
    const allRecommendations = sections
      .find(s => s.type === 'recommendations')?.data?.recommendations || [];
    
    return {
      totalErrors: summarySection?.data?.overview?.totalErrors || 0,
      totalUsers: summarySection?.data?.overview?.totalUsers || 0,
      keyInsights: allInsights.slice(0, 5),
      recommendations: allRecommendations.slice(0, 5)
    };
  }
  
  private async sendReportToRecipients(
    report: GeneratedReport, 
    recipients: ReportRecipient[]
  ): Promise<void> {
    // In a real implementation, this would integrate with email service
    this.emit('report:sent', { 
      reportId: report.id, 
      recipients: recipients.map(r => r.email) 
    });
  }
  
  // Public API methods
  
  public createReportConfig(config: Omit<ReportConfig, 'id'>): string {
    const id = `config-${Date.now()}`;
    const fullConfig: ReportConfig = { ...config, id };
    
    this.reportConfigs.set(id, fullConfig);
    this.scheduleNextRun(fullConfig);
    
    this.emit('config:created', fullConfig);
    return id;
  }
  
  public updateReportConfig(id: string, updates: Partial<ReportConfig>): void {
    const config = this.reportConfigs.get(id);
    if (config) {
      Object.assign(config, updates);
      if (updates.scheduling) {
        this.scheduleNextRun(config);
      }
      this.emit('config:updated', config);
    }
  }
  
  public deleteReportConfig(id: string): void {
    const config = this.reportConfigs.get(id);
    if (config) {
      this.reportConfigs.delete(id);
      this.emit('config:deleted', config);
    }
  }
  
  public getReportConfigs(): ReportConfig[] {
    return Array.from(this.reportConfigs.values());
  }
  
  public getReportTemplate(id: string): ReportTemplate | undefined {
    return this.reportTemplates.get(id);
  }
  
  public getReportTemplates(): ReportTemplate[] {
    return Array.from(this.reportTemplates.values());
  }
  
  public createConfigFromTemplate(templateId: string, customization: Partial<ReportConfig>): string {
    const template = this.reportTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    const config: Omit<ReportConfig, 'id'> = {
      name: customization.name || template.name,
      description: customization.description || template.description,
      frequency: customization.frequency || template.defaultConfig.frequency || 'weekly',
      format: customization.format || template.defaultConfig.format || 'html',
      recipients: customization.recipients || [],
      sections: template.sections,
      filters: customization.filters || {
        dateRange: { start: new Date(Date.now() - 86400000), end: new Date() },
        severityLevels: ['low', 'medium', 'high', 'critical'],
        errorTypes: [],
        userSegments: [],
        components: []
      },
      scheduling: customization.scheduling || {
        enabled: false,
        timezone: 'UTC',
        time: '09:00'
      },
      customization: {
        ...template.defaultConfig.customization,
        ...customization.customization
      } as ReportCustomization
    };
    
    return this.createReportConfig(config);
  }
  
  public getGeneratedReports(): GeneratedReport[] {
    return Array.from(this.generatedReports.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }
  
  public getGeneratedReport(id: string): GeneratedReport | undefined {
    return this.generatedReports.get(id);
  }
  
  public async deleteGeneratedReport(id: string): Promise<void> {
    const report = this.generatedReports.get(id);
    if (report) {
      try {
        await fs.unlink(report.filePath);
      } catch (error) {
        // File may not exist, ignore
      }
      this.generatedReports.delete(id);
      this.emit('report:deleted', report);
    }
  }
  
  public destroy(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
    
    this.removeAllListeners();
    this.reportConfigs.clear();
    this.generatedReports.clear();
    this.reportTemplates.clear();
  }
}