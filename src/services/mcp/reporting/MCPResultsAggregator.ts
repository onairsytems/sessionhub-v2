import { EventEmitter } from 'events';
import { IntegrationTestReport } from '../testing/MCPIntegrationTestFramework';
import { BatchOperation } from '../batch/MCPBatchProcessor';
import { IntegrationHealth, Alert } from '../monitoring/MCPIntegrationMonitor';
import { TestRunResult } from '../testing/MCPAutomatedTestRunner';
import { Logger } from '../../../lib/logging/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

export interface AggregatedResults {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  integrations: IntegrationSummary[];
  batchOperations: BatchOperationSummary[];
  testRuns: TestRunSummary[];
  healthMetrics: HealthMetricsSummary;
  alerts: AlertSummary;
  trends: TrendAnalysis;
  recommendations: string[];
  auditTrail: AuditEntry[];
}

export interface IntegrationSummary {
  integrationId: string;
  integrationName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testCoverage: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
  lastTested: Date;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
}

export interface BatchOperationSummary {
  operationId: string;
  type: string;
  itemCount: number;
  successCount: number;
  failureCount: number;
  duration: number;
  throughput: number;
  status: string;
  timestamp: Date;
}

export interface TestRunSummary {
  runId: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  successRate: number;
  duration: number;
  faultInjectionResults: number;
  loadTestResults: number;
}

export interface HealthMetricsSummary {
  overallHealth: number; // 0-100
  averageUptime: number;
  averageResponseTime: number;
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  integrationStatuses: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    offline: number;
  };
}

export interface AlertSummary {
  total: number;
  byType: Record<string, number>;
  bySeverity: {
    warning: number;
    critical: number;
  };
  acknowledged: number;
  unacknowledged: number;
  averageResolutionTime: number;
}

export interface TrendAnalysis {
  uptimeTrend: 'improving' | 'stable' | 'declining';
  performanceTrend: 'improving' | 'stable' | 'declining';
  errorRateTrend: 'improving' | 'stable' | 'declining';
  testCoverageTrend: 'improving' | 'stable' | 'declining';
  historicalData: HistoricalDataPoint[];
}

export interface HistoricalDataPoint {
  timestamp: Date;
  uptime: number;
  responseTime: number;
  errorRate: number;
  testCoverage: number;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  userId?: string;
}

export interface ReportConfig {
  outputDir: string;
  formats: ('json' | 'html' | 'csv' | 'pdf')[];
  includeCharts: boolean;
  includeRawData: boolean;
  aggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
}

export class MCPResultsAggregator extends EventEmitter {
  private logger: Logger;
  private historicalData: Map<string, HistoricalDataPoint[]> = new Map();
  private auditTrail: AuditEntry[] = [];
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    super();
    this.logger = new Logger('MCP');
    this.config = config;
  }

  async aggregateResults(
    testReports: IntegrationTestReport[],
    batchOperations: BatchOperation[],
    healthData: IntegrationHealth[],
    alerts: Alert[],
    testRuns: TestRunResult[]
  ): Promise<AggregatedResults> {
    const aggregationId = `agg-${Date.now()}`;
    const now = new Date();
    const periodStart = this.getPeriodStart(now, this.config.aggregationPeriod);

    this.emit('aggregation-started', { id: aggregationId });

    try {
      // Aggregate integration summaries
      const integrationSummaries = this.aggregateIntegrations(testReports, healthData);

      // Aggregate batch operations
      const batchSummaries = this.aggregateBatchOperations(batchOperations);

      // Aggregate test runs
      const testRunSummaries = this.aggregateTestRuns(testRuns);

      // Calculate health metrics
      const healthMetrics = this.calculateHealthMetrics(healthData);

      // Aggregate alerts
      const alertSummary = this.aggregateAlerts(alerts);

      // Analyze trends
      const trends = await this.analyzeTrends(integrationSummaries, healthData);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        integrationSummaries,
        healthMetrics,
        alertSummary,
        trends
      );

      // Create aggregated results
      const results: AggregatedResults = {
        id: aggregationId,
        timestamp: now,
        period: {
          start: periodStart,
          end: now,
        },
        integrations: integrationSummaries,
        batchOperations: batchSummaries,
        testRuns: testRunSummaries,
        healthMetrics,
        alerts: alertSummary,
        trends,
        recommendations,
        auditTrail: this.getRecentAuditEntries(),
      };

      // Store historical data
      await this.storeHistoricalData(results);

      // Generate reports
      await this.generateReports(results);

      // Add audit entry
      this.addAuditEntry({
        timestamp: now,
        action: 'aggregate_results',
        resourceType: 'aggregation',
        resourceId: aggregationId,
        details: `Aggregated results for ${integrationSummaries.length} integrations`,
      });

      this.emit('aggregation-completed', results);
      return results;

    } catch (error) {
      this.logger.error('Results aggregation failed:', error as Error);
      this.emit('aggregation-failed', { id: aggregationId, error });
      throw error;
    }
  }

  private aggregateIntegrations(
    testReports: IntegrationTestReport[],
    healthData: IntegrationHealth[]
  ): IntegrationSummary[] {
    // const summaries: IntegrationSummary[] = [];
    const integrationMap = new Map<string, IntegrationSummary>();

    // Process test reports
    for (const report of testReports) {
      const summary: IntegrationSummary = {
        integrationId: report.integrationId,
        integrationName: report.integrationName,
        totalTests: report.totalTests,
        passedTests: report.passed,
        failedTests: report.failed,
        testCoverage: report.coverage,
        averageResponseTime: report.averageResponseTime,
        errorRate: 0,
        uptime: 100,
        lastTested: report.timestamp,
        status: 'healthy',
      };

      integrationMap.set(report.integrationId, summary);
    }

    // Merge health data
    for (const health of healthData) {
      const summary = integrationMap.get(health.integrationId);
      if (summary) {
        summary.errorRate = health.errorRate;
        summary.uptime = health.uptime;
        summary.status = health.status;
        summary.averageResponseTime = health.metrics.averageResponseTime;
      } else {
        // Create summary from health data only
        integrationMap.set(health.integrationId, {
          integrationId: health.integrationId,
          integrationName: health.integrationName,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          testCoverage: 0,
          averageResponseTime: health.metrics.averageResponseTime,
          errorRate: health.errorRate,
          uptime: health.uptime,
          lastTested: health.lastChecked,
          status: health.status,
        });
      }
    }

    return Array.from(integrationMap.values());
  }

  private aggregateBatchOperations(operations: BatchOperation[]): BatchOperationSummary[] {
    return operations.map(op => ({
      operationId: op.id,
      type: op.type,
      itemCount: op.items.length,
      successCount: op.results.filter(r => r.status === 'success').length,
      failureCount: op.results.filter(r => r.status === 'failed').length,
      duration: op.completedAt && op.startedAt
        ? op.completedAt.getTime() - op.startedAt.getTime()
        : 0,
      throughput: op.progress.throughput,
      status: op.status,
      timestamp: op.createdAt,
    }));
  }

  private aggregateTestRuns(testRuns: TestRunResult[]): TestRunSummary[] {
    return testRuns.map(run => ({
      runId: run.id,
      timestamp: run.timestamp,
      totalTests: run.totalTests,
      passed: run.passed,
      failed: run.failed,
      successRate: run.successRate,
      duration: run.duration,
      faultInjectionResults: run.faultInjectionResults.length,
      loadTestResults: run.loadTestResults.length,
    }));
  }

  private calculateHealthMetrics(healthData: IntegrationHealth[]): HealthMetricsSummary {
    if (healthData.length === 0) {
      return {
        overallHealth: 100,
        averageUptime: 100,
        averageResponseTime: 0,
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 0,
        integrationStatuses: {
          healthy: 0,
          degraded: 0,
          unhealthy: 0,
          offline: 0,
        },
      };
    }

    const totalUptime = healthData.reduce((sum, h) => sum + h.uptime, 0);
    const totalResponseTime = healthData.reduce((sum, h) => sum + h.responseTime, 0);
    const totalRequests = healthData.reduce((sum, h) => sum + h.metrics.totalRequests, 0);
    const totalErrors = healthData.reduce((sum, h) => sum + h.metrics.failedRequests, 0);

    const statuses = {
      healthy: healthData.filter(h => h.status === 'healthy').length,
      degraded: healthData.filter(h => h.status === 'degraded').length,
      unhealthy: healthData.filter(h => h.status === 'unhealthy').length,
      offline: healthData.filter(h => h.status === 'offline').length,
    };

    const overallHealth = (statuses.healthy / healthData.length) * 100;

    return {
      overallHealth,
      averageUptime: totalUptime / healthData.length,
      averageResponseTime: totalResponseTime / healthData.length,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      integrationStatuses: statuses,
    };
  }

  private aggregateAlerts(alerts: Alert[]): AlertSummary {
    const byType: Record<string, number> = {};
    const bySeverity = { warning: 0, critical: 0 };
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const alert of alerts) {
      // Count by type
      byType[alert.type] = (byType[alert.type] || 0) + 1;

      // Count by severity
      bySeverity[alert.severity]++;

      // Calculate resolution time if acknowledged
      if (alert.acknowledged) {
        // Assuming resolution time is stored somewhere
        totalResolutionTime += 60000; // Default 1 minute for now
        resolvedCount++;
      }
    }

    return {
      total: alerts.length,
      byType,
      bySeverity,
      acknowledged: alerts.filter(a => a.acknowledged).length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }

  private async analyzeTrends(
    integrations: IntegrationSummary[],
    _healthData: IntegrationHealth[]
  ): Promise<TrendAnalysis> {
    // Get historical data for trend analysis
    // // const historicalPoints: HistoricalDataPoint[] = []; // Unused
    
    // Aggregate current data point
    const currentPoint: HistoricalDataPoint = {
      timestamp: new Date(),
      uptime: integrations.reduce((sum, i) => sum + i.uptime, 0) / integrations.length,
      responseTime: integrations.reduce((sum, i) => sum + i.averageResponseTime, 0) / integrations.length,
      errorRate: integrations.reduce((sum, i) => sum + i.errorRate, 0) / integrations.length,
      testCoverage: integrations.reduce((sum, i) => sum + i.testCoverage, 0) / integrations.length,
    };

    // Get stored historical data
    const storedHistory = this.historicalData.get('global') || [];
    const recentHistory = [...storedHistory, currentPoint].slice(-30); // Keep last 30 points

    // Calculate trends
    const uptimeTrend = this.calculateTrend(recentHistory.map(p => p.uptime));
    const performanceTrend = this.calculateTrend(recentHistory.map(p => -p.responseTime)); // Negative for inverse relationship
    const errorRateTrend = this.calculateTrend(recentHistory.map(p => -p.errorRate)); // Negative for inverse relationship
    const testCoverageTrend = this.calculateTrend(recentHistory.map(p => p.testCoverage));

    // Store updated history
    this.historicalData.set('global', recentHistory);

    return {
      uptimeTrend,
      performanceTrend,
      errorRateTrend,
      testCoverageTrend,
      historicalData: recentHistory,
    };
  }

  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';

    // Simple linear regression
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Determine trend based on slope
    if (slope > 0.01) return 'improving';
    if (slope < -0.01) return 'declining';
    return 'stable';
  }

  private generateRecommendations(
    integrations: IntegrationSummary[],
    healthMetrics: HealthMetricsSummary,
    alerts: AlertSummary,
    trends: TrendAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (healthMetrics.overallHealth < 80) {
      recommendations.push('Overall system health is below 80%. Investigate unhealthy integrations.');
    }

    if (healthMetrics.errorRate > 5) {
      recommendations.push(`High error rate detected (${healthMetrics.errorRate.toFixed(1)}%). Review error logs and implement fixes.`);
    }

    // Integration-specific recommendations
    const poorPerformers = integrations.filter(i => i.uptime < 95 || i.errorRate > 10);
    if (poorPerformers.length > 0) {
      recommendations.push(`${poorPerformers.length} integrations have poor performance. Consider optimization or replacement.`);
    }

    const lowCoverage = integrations.filter(i => i.testCoverage < 70);
    if (lowCoverage.length > 0) {
      recommendations.push(`${lowCoverage.length} integrations have test coverage below 70%. Add more tests.`);
    }

    // Alert-based recommendations
    if (alerts.unacknowledged > 5) {
      recommendations.push('Multiple unacknowledged alerts. Review and address critical issues.');
    }

    if (alerts.bySeverity.critical > 0) {
      recommendations.push(`${alerts.bySeverity.critical} critical alerts require immediate attention.`);
    }

    // Trend-based recommendations
    if (trends.uptimeTrend === 'declining') {
      recommendations.push('Uptime trend is declining. Investigate stability issues.');
    }

    if (trends.performanceTrend === 'declining') {
      recommendations.push('Performance is degrading. Consider scaling or optimization.');
    }

    if (trends.errorRateTrend === 'declining') {
      recommendations.push('Error rate is increasing. Review recent changes and deployments.');
    }

    // Batch operation recommendations
    const slowIntegrations = integrations.filter(i => i.averageResponseTime > 3000);
    if (slowIntegrations.length > 0) {
      recommendations.push(`${slowIntegrations.length} integrations have response times over 3s. Optimize for better performance.`);
    }

    return recommendations;
  }

  private async generateReports(results: AggregatedResults): Promise<void> {
    const reportDir = path.join(this.config.outputDir, results.id);
    await fs.mkdir(reportDir, { recursive: true });

    for (const format of this.config.formats) {
      switch (format) {
        case 'json':
          await this.generateJSONReport(results, reportDir);
          break;
        case 'html':
          await this.generateHTMLReport(results, reportDir);
          break;
        case 'csv':
          await this.generateCSVReports(results, reportDir);
          break;
        case 'pdf':
          await this.generatePDFReport(results, reportDir);
          break;
      }
    }

    // Cleanup old reports
    await this.cleanupOldReports();
  }

  private async generateJSONReport(results: AggregatedResults, reportDir: string): Promise<void> {
    const reportPath = path.join(reportDir, 'aggregated-results.json');
    const content = this.config.includeRawData ? results : this.stripRawData(results);
    await fs.writeFile(reportPath, JSON.stringify(content, null, 2));
  }

  private async generateHTMLReport(results: AggregatedResults, reportDir: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>MCP Integration Results - ${results.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1, h2, h3 { color: #333; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
    .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
    .metric-label { color: #666; margin-top: 5px; }
    .status-healthy { color: #28a745; }
    .status-degraded { color: #ffc107; }
    .status-unhealthy { color: #dc3545; }
    .status-offline { color: #6c757d; }
    .trend-improving { color: #28a745; }
    .trend-stable { color: #6c757d; }
    .trend-declining { color: #dc3545; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; }
    .recommendation { background: #fff3cd; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #ffc107; }
    .chart-container { margin: 30px 0; }
    ${this.config.includeCharts ? `
    canvas { max-width: 100%; height: 300px; }
    ` : ''}
  </style>
  ${this.config.includeCharts ? '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' : ''}
</head>
<body>
  <div class="container">
    <h1>MCP Integration Results Report</h1>
    <p><strong>Report ID:</strong> ${results.id}</p>
    <p><strong>Period:</strong> ${results.period.start.toISOString()} to ${results.period.end.toISOString()}</p>

    <h2>Executive Summary</h2>
    <div class="summary-grid">
      <div class="metric-card">
        <div class="metric-value">${results.healthMetrics.overallHealth.toFixed(0)}%</div>
        <div class="metric-label">Overall Health</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${results.integrations.length}</div>
        <div class="metric-label">Total Integrations</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${results.healthMetrics.averageUptime.toFixed(1)}%</div>
        <div class="metric-label">Average Uptime</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${results.healthMetrics.errorRate.toFixed(2)}%</div>
        <div class="metric-label">Error Rate</div>
      </div>
    </div>

    <h2>Integration Status</h2>
    <div class="summary-grid">
      <div class="metric-card">
        <div class="metric-value status-healthy">${results.healthMetrics.integrationStatuses.healthy}</div>
        <div class="metric-label">Healthy</div>
      </div>
      <div class="metric-card">
        <div class="metric-value status-degraded">${results.healthMetrics.integrationStatuses.degraded}</div>
        <div class="metric-label">Degraded</div>
      </div>
      <div class="metric-card">
        <div class="metric-value status-unhealthy">${results.healthMetrics.integrationStatuses.unhealthy}</div>
        <div class="metric-label">Unhealthy</div>
      </div>
      <div class="metric-card">
        <div class="metric-value status-offline">${results.healthMetrics.integrationStatuses.offline}</div>
        <div class="metric-label">Offline</div>
      </div>
    </div>

    <h2>Trends</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Trend</th>
        <th>Current Value</th>
      </tr>
      <tr>
        <td>Uptime</td>
        <td class="trend-${results.trends.uptimeTrend}">${results.trends.uptimeTrend}</td>
        <td>${results.healthMetrics.averageUptime.toFixed(1)}%</td>
      </tr>
      <tr>
        <td>Performance</td>
        <td class="trend-${results.trends.performanceTrend}">${results.trends.performanceTrend}</td>
        <td>${results.healthMetrics.averageResponseTime.toFixed(0)}ms</td>
      </tr>
      <tr>
        <td>Error Rate</td>
        <td class="trend-${results.trends.errorRateTrend}">${results.trends.errorRateTrend}</td>
        <td>${results.healthMetrics.errorRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td>Test Coverage</td>
        <td class="trend-${results.trends.testCoverageTrend}">${results.trends.testCoverageTrend}</td>
        <td>${(results.integrations.reduce((sum, i) => sum + i.testCoverage, 0) / results.integrations.length).toFixed(1)}%</td>
      </tr>
    </table>

    ${this.config.includeCharts ? `
    <h2>Performance Trends</h2>
    <div class="chart-container">
      <canvas id="trendsChart"></canvas>
    </div>
    ` : ''}

    <h2>Integration Details</h2>
    <table>
      <tr>
        <th>Integration</th>
        <th>Status</th>
        <th>Uptime</th>
        <th>Response Time</th>
        <th>Error Rate</th>
        <th>Test Coverage</th>
      </tr>
      ${results.integrations.map(i => `
      <tr>
        <td>${i.integrationName}</td>
        <td class="status-${i.status}">${i.status}</td>
        <td>${i.uptime.toFixed(1)}%</td>
        <td>${i.averageResponseTime.toFixed(0)}ms</td>
        <td>${i.errorRate.toFixed(2)}%</td>
        <td>${i.testCoverage.toFixed(1)}%</td>
      </tr>
      `).join('')}
    </table>

    <h2>Recommendations</h2>
    ${results.recommendations.map(r => `
    <div class="recommendation">${r}</div>
    `).join('')}

    <h2>Recent Test Runs</h2>
    <table>
      <tr>
        <th>Run ID</th>
        <th>Date</th>
        <th>Tests</th>
        <th>Success Rate</th>
        <th>Duration</th>
      </tr>
      ${results.testRuns.slice(0, 10).map(r => `
      <tr>
        <td>${r.runId}</td>
        <td>${r.timestamp.toISOString()}</td>
        <td>${r.totalTests}</td>
        <td>${r.successRate.toFixed(1)}%</td>
        <td>${(r.duration / 1000).toFixed(1)}s</td>
      </tr>
      `).join('')}
    </table>

    <h2>Alert Summary</h2>
    <div class="summary-grid">
      <div class="metric-card">
        <div class="metric-value">${results.alerts.total}</div>
        <div class="metric-label">Total Alerts</div>
      </div>
      <div class="metric-card">
        <div class="metric-value status-unhealthy">${results.alerts.bySeverity.critical}</div>
        <div class="metric-label">Critical</div>
      </div>
      <div class="metric-card">
        <div class="metric-value status-degraded">${results.alerts.bySeverity.warning}</div>
        <div class="metric-label">Warnings</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${results.alerts.unacknowledged}</div>
        <div class="metric-label">Unacknowledged</div>
      </div>
    </div>

    <p style="margin-top: 40px; color: #666; font-size: 0.9em;">
      Generated on ${new Date().toISOString()}
    </p>
  </div>

  ${this.config.includeCharts ? `
  <script>
    const ctx = document.getElementById('trendsChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(results.trends.historicalData.map(d => d.timestamp.toISOString().split('T')[0]))},
        datasets: [{
          label: 'Uptime %',
          data: ${JSON.stringify(results.trends.historicalData.map(d => d.uptime))},
          borderColor: '#28a745',
          tension: 0.1
        }, {
          label: 'Error Rate %',
          data: ${JSON.stringify(results.trends.historicalData.map(d => d.errorRate))},
          borderColor: '#dc3545',
          tension: 0.1
        }, {
          label: 'Test Coverage %',
          data: ${JSON.stringify(results.trends.historicalData.map(d => d.testCoverage))},
          borderColor: '#007bff',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  </script>
  ` : ''}
</body>
</html>
    `;

    const reportPath = path.join(reportDir, 'aggregated-report.html');
    await fs.writeFile(reportPath, html);
  }

  private async generateCSVReports(results: AggregatedResults, reportDir: string): Promise<void> {
    // Integration summary CSV
    const integrationsCsv = createObjectCsvWriter({
      path: path.join(reportDir, 'integrations.csv'),
      header: [
        { id: 'integrationName', title: 'Integration' },
        { id: 'status', title: 'Status' },
        { id: 'uptime', title: 'Uptime %' },
        { id: 'averageResponseTime', title: 'Avg Response Time (ms)' },
        { id: 'errorRate', title: 'Error Rate %' },
        { id: 'testCoverage', title: 'Test Coverage %' },
        { id: 'totalTests', title: 'Total Tests' },
        { id: 'passedTests', title: 'Passed Tests' },
        { id: 'failedTests', title: 'Failed Tests' },
      ],
    });
    await integrationsCsv.writeRecords(results.integrations);

    // Test runs CSV
    const testRunsCsv = createObjectCsvWriter({
      path: path.join(reportDir, 'test-runs.csv'),
      header: [
        { id: 'runId', title: 'Run ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'totalTests', title: 'Total Tests' },
        { id: 'passed', title: 'Passed' },
        { id: 'failed', title: 'Failed' },
        { id: 'successRate', title: 'Success Rate %' },
        { id: 'duration', title: 'Duration (ms)' },
      ],
    });
    await testRunsCsv.writeRecords(results.testRuns);

    // Batch operations CSV
    const batchOpsCsv = createObjectCsvWriter({
      path: path.join(reportDir, 'batch-operations.csv'),
      header: [
        { id: 'operationId', title: 'Operation ID' },
        { id: 'type', title: 'Type' },
        { id: 'status', title: 'Status' },
        { id: 'itemCount', title: 'Items' },
        { id: 'successCount', title: 'Successful' },
        { id: 'failureCount', title: 'Failed' },
        { id: 'throughput', title: 'Throughput (items/s)' },
        { id: 'duration', title: 'Duration (ms)' },
      ],
    });
    await batchOpsCsv.writeRecords(results.batchOperations);
  }

  private async generatePDFReport(_results: AggregatedResults, _reportDir: string): Promise<void> {
    // PDF generation would require a library like puppeteer or pdfkit
    // For now, we'll create a placeholder
    this.logger.info('PDF report generation not implemented yet');
  }

  private stripRawData(results: AggregatedResults): any {
    // Remove sensitive or verbose data for non-raw reports
    const stripped = { ...results };
    delete (stripped as any).auditTrail;
    return stripped;
  }

  private async storeHistoricalData(results: AggregatedResults): Promise<void> {
    const dataDir = path.join(this.config.outputDir, 'historical');
    await fs.mkdir(dataDir, { recursive: true });

    const dataFile = path.join(dataDir, `data-${results.period.start.toISOString().split('T')[0]}.json`);
    
    try {
      const existing = await fs.readFile(dataFile, 'utf-8');
      const data = JSON.parse(existing);
      data.push(results);
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    } catch {
      // File doesn't exist, create new
      await fs.writeFile(dataFile, JSON.stringify([results], null, 2));
    }
  }

  private async cleanupOldReports(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const files = await fs.readdir(this.config.outputDir);
    
    for (const file of files) {
      const filePath = path.join(this.config.outputDir, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory() && stats.mtime < cutoffDate) {
        await fs.rm(filePath, { recursive: true });
        this.logger.info(`Cleaned up old report: ${file}`);
      }
    }
  }

  private getPeriodStart(date: Date, period: string): Date {
    const start = new Date(date);
    
    switch (period) {
      case 'hourly':
        start.setHours(start.getHours() - 1);
        break;
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }
    
    return start;
  }

  addAuditEntry(entry: AuditEntry): void {
    this.auditTrail.push(entry);
    
    // Keep only recent entries (last 1000)
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-1000);
    }
    
    this.emit('audit-entry-added', entry);
  }

  private getRecentAuditEntries(): AuditEntry[] {
    // Return last 100 audit entries
    return this.auditTrail.slice(-100);
  }

  async exportAuditTrail(startDate?: Date, endDate?: Date): Promise<string> {
    const filtered = this.auditTrail.filter(entry => {
      if (startDate && entry.timestamp < startDate) return false;
      if (endDate && entry.timestamp > endDate) return false;
      return true;
    });

    return JSON.stringify(filtered, null, 2);
  }
}