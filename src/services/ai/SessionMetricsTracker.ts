/**
 * @actor system
 * @responsibility Track session outcomes and provide insights
 * @dependencies Database, SessionService
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  objectives: string[];
  completedObjectives: string[];
  errors: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }>;
  qualityGates: {
    typescript: { passed: boolean; errors: number };
    eslint: { passed: boolean; violations: number };
    tests: { passed: boolean; failing: number };
    build: { passed: boolean; warnings: number };
  };
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  performance: {
    planningTime?: number;
    executionTime?: number;
    validationTime?: number;
  };
}
export interface MetricsSummary {
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  averageDuration: number;
  commonErrors: Array<{ error: string; count: number }>;
  averageObjectiveCompletion: number;
  qualityGatePassRate: {
    typescript: number;
    eslint: number;
    tests: number;
    build: number;
  };
  productivityTrends: Array<{
    date: string;
    sessionsCompleted: number;
    objectivesCompleted: number;
    averageDuration: number;
  }>;
}
export interface InsightReport {
  insights: Array<{
    type: 'success' | 'warning' | 'improvement';
    title: string;
    description: string;
    recommendation?: string;
    data?: any;
  }>;
  patterns: Array<{
    pattern: string;
    frequency: number;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  recommendations: string[];
}
export class SessionMetricsTracker extends EventEmitter {
  private logger: Logger;
  private metrics: Map<string, SessionMetrics>;
  private metricsDataPath: string;
  private insightCache: Map<string, InsightReport>;
  constructor() {
    super();
    this.logger = new Logger('SessionMetricsTracker');
    this.metrics = new Map();
    this.insightCache = new Map();
    this.metricsDataPath = path.join(process.env["HOME"] || '', '.sessionhub', 'metrics');
  }
  async initialize(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadMetrics();
  }
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.metricsDataPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create metrics directory', error as Error);
    }
  }
  private async loadMetrics(): Promise<void> {
    try {
      const files = await fs.readdir(this.metricsDataPath);
      const metricFiles = files.filter(f => f.endsWith('.json'));
      for (const file of metricFiles) {
        const filePath = path.join(this.metricsDataPath, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const metric = JSON.parse(data);
        this.metrics.set(metric.sessionId, metric);
      }
      this.logger.info(`Loaded ${this.metrics.size} session metrics`);
    } catch (error) {
      this.logger.error('Failed to load metrics', error as Error);
    }
  }
  async startSession(sessionId: string, objectives: string[]): Promise<void> {
    const metrics: SessionMetrics = {
      sessionId,
      startTime: new Date(),
      status: 'running',
      objectives,
      completedObjectives: [],
      errors: [],
      qualityGates: {
        typescript: { passed: false, errors: 0 },
        eslint: { passed: false, violations: 0 },
        tests: { passed: false, failing: 0 },
        build: { passed: false, warnings: 0 }
      },
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      commits: 0,
      performance: {}
    };
    this.metrics.set(sessionId, metrics);
    await this.saveMetrics(sessionId);
    this.emit('session-started', { sessionId, objectives });
  }
  async updateSession(sessionId: string, updates: Partial<SessionMetrics>): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) {
      this.logger.warn(`No metrics found for session ${sessionId}`);
      return;
    }
    Object.assign(metrics, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
    }
    await this.saveMetrics(sessionId);
    this.emit('session-updated', { sessionId, updates });
  }
  async recordError(sessionId: string, error: { type: string; message: string }): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;
    metrics.errors.push({
      ...error,
      timestamp: new Date()
    });
    await this.saveMetrics(sessionId);
  }
  async recordQualityGate(
    sessionId: string,
    gate: keyof SessionMetrics['qualityGates'],
    result: { passed: boolean; count: number }
  ): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;
    switch (gate) {
      case 'typescript':
        metrics.qualityGates.typescript = { passed: result.passed, errors: result.count };
        break;
      case 'eslint':
        metrics.qualityGates.eslint = { passed: result.passed, violations: result.count };
        break;
      case 'tests':
        metrics.qualityGates.tests = { passed: result.passed, failing: result.count };
        break;
      case 'build':
        metrics.qualityGates.build = { passed: result.passed, warnings: result.count };
        break;
    }
    await this.saveMetrics(sessionId);
  }
  async recordObjectiveComplete(sessionId: string, objective: string): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;
    if (!metrics.completedObjectives.includes(objective)) {
      metrics.completedObjectives.push(objective);
    }
    await this.saveMetrics(sessionId);
  }
  async recordPerformance(
    sessionId: string,
    phase: 'planning' | 'execution' | 'validation',
    duration: number
  ): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;
    metrics.performance[`${phase}Time`] = duration;
    await this.saveMetrics(sessionId);
  }
  async recordCodeChanges(
    sessionId: string,
    changes: { filesChanged: number; linesAdded: number; linesRemoved: number }
  ): Promise<void> {
    const metrics = this.metrics.get(sessionId);
    if (!metrics) return;
    metrics.filesChanged += changes.filesChanged;
    metrics.linesAdded += changes.linesAdded;
    metrics.linesRemoved += changes.linesRemoved;
    await this.saveMetrics(sessionId);
  }
  private async saveMetrics(sessionId: string): Promise<void> {
    try {
      const metrics = this.metrics.get(sessionId);
      if (!metrics) return;
      const filePath = path.join(this.metricsDataPath, `${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      this.logger.error('Failed to save metrics', error as Error);
    }
  }
  async getSummary(days: number = 30): Promise<MetricsSummary> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentMetrics = Array.from(this.metrics.values())
      .filter(m => m.startTime > cutoffDate);
    const successfulSessions = recentMetrics.filter(m => m.status === 'completed');
    const failedSessions = recentMetrics.filter(m => m.status === 'failed');
    // Calculate average duration
    const durations = successfulSessions
      .map(m => m.duration)
      .filter((d): d is number => d !== undefined);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    // Count common errors
    const errorCounts = new Map<string, number>();
    for (const metric of recentMetrics) {
      for (const error of metric.errors) {
        const key = error.type;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      }
    }
    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    // Calculate objective completion rate
    const totalObjectives = recentMetrics.reduce((sum, m) => sum + m.objectives.length, 0);
    const completedObjectives = recentMetrics.reduce((sum, m) => sum + m.completedObjectives.length, 0);
    const averageObjectiveCompletion = totalObjectives > 0 ? completedObjectives / totalObjectives : 0;
    // Calculate quality gate pass rates
    const qualityGatePassRate = {
      typescript: this.calculatePassRate(recentMetrics, 'typescript'),
      eslint: this.calculatePassRate(recentMetrics, 'eslint'),
      tests: this.calculatePassRate(recentMetrics, 'tests'),
      build: this.calculatePassRate(recentMetrics, 'build')
    };
    // Calculate productivity trends
    const productivityTrends = this.calculateProductivityTrends(recentMetrics);
    return {
      totalSessions: recentMetrics.length,
      successfulSessions: successfulSessions.length,
      failedSessions: failedSessions.length,
      averageDuration,
      commonErrors,
      averageObjectiveCompletion,
      qualityGatePassRate,
      productivityTrends
    };
  }
  private calculatePassRate(
    metrics: SessionMetrics[],
    gate: keyof SessionMetrics['qualityGates']
  ): number {
    const total = metrics.length;
    if (total === 0) return 0;
    const passed = metrics.filter(m => m.qualityGates[gate].passed).length;
    return passed / total;
  }
  private calculateProductivityTrends(metrics: SessionMetrics[]): MetricsSummary['productivityTrends'] {
    const dailyData = new Map<string, {
      sessions: SessionMetrics[];
      objectives: number;
      duration: number;
    }>();
    for (const metric of metrics) {
      const date = metric.startTime.toISOString().split('T')[0] || '';
      if (!dailyData.has(date)) {
        dailyData.set(date, { sessions: [], objectives: 0, duration: 0 });
      }
      const data = dailyData.get(date)!;
      data.sessions.push(metric);
      data.objectives += metric.completedObjectives.length;
      data.duration += metric.duration || 0;
    }
    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        sessionsCompleted: data.sessions.filter(s => s.status === 'completed').length,
        objectivesCompleted: data.objectives,
        averageDuration: data.duration / data.sessions.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async generateInsights(): Promise<InsightReport> {
    const cacheKey = 'latest-insights';
    // Check cache
    if (this.insightCache.has(cacheKey)) {
      return this.insightCache.get(cacheKey)!;
    }
    const summary = await this.getSummary();
    const insights: InsightReport['insights'] = [];
    const patterns: InsightReport['patterns'] = [];
    const recommendations: string[] = [];
    // Success rate insights
    const successRate = summary.totalSessions > 0
      ? summary.successfulSessions / summary.totalSessions
      : 0;
    if (successRate > 0.9) {
      insights.push({
        type: 'success',
        title: 'Excellent Success Rate',
        description: `${(successRate * 100).toFixed(1)}% of sessions completed successfully`,
        data: { successRate }
      });
    } else if (successRate < 0.7) {
      insights.push({
        type: 'warning',
        title: 'Low Success Rate',
        description: `Only ${(successRate * 100).toFixed(1)}% of sessions completed successfully`,
        recommendation: 'Review common errors and improve session planning',
        data: { successRate }
      });
    }
    // Quality gate insights
    for (const [gate, passRate] of Object.entries(summary.qualityGatePassRate)) {
      if (passRate < 0.8) {
        insights.push({
          type: 'improvement',
          title: `${gate} Quality Gate Issues`,
          description: `Only ${(passRate * 100).toFixed(1)}% pass rate for ${gate}`,
          recommendation: `Focus on improving ${gate} compliance`,
          data: { gate, passRate }
        });
      }
    }
    // Error patterns
    if (summary.commonErrors.length > 0) {
      const topError = summary.commonErrors[0];
      patterns.push({
        pattern: `Frequent ${topError?.error || 'unknown'} errors`,
        frequency: topError?.count || 0,
        impact: 'negative'
      });
      recommendations.push(`Address recurring ${topError?.error || 'unknown'} errors`);
    }
    // Productivity patterns
    if (summary.productivityTrends.length > 7) {
      const recent = summary.productivityTrends.slice(-7);
      const avgRecent = recent.reduce((sum, t) => sum + t.sessionsCompleted, 0) / recent.length;
      const older = summary.productivityTrends.slice(0, -7);
      const avgOlder = older.reduce((sum, t) => sum + t.sessionsCompleted, 0) / older.length;
      if (avgRecent > avgOlder * 1.2) {
        patterns.push({
          pattern: 'Increasing productivity',
          frequency: recent.length,
          impact: 'positive'
        });
      } else if (avgRecent < avgOlder * 0.8) {
        patterns.push({
          pattern: 'Decreasing productivity',
          frequency: recent.length,
          impact: 'negative'
        });
        recommendations.push('Review recent workflow changes');
      }
    }
    // Duration insights
    if (summary.averageDuration > 2 * 60 * 60 * 1000) { // 2 hours
      insights.push({
        type: 'improvement',
        title: 'Long Session Duration',
        description: `Average session takes ${(summary.averageDuration / (60 * 60 * 1000)).toFixed(1)} hours`,
        recommendation: 'Consider breaking down sessions into smaller tasks',
        data: { averageDuration: summary.averageDuration }
      });
    }
    // Generate recommendations
    if (summary.averageObjectiveCompletion < 0.8) {
      recommendations.push('Improve objective planning and scoping');
    }
    if (summary.failedSessions > summary.successfulSessions * 0.3) {
      recommendations.push('Implement better error recovery strategies');
    }
    const report: InsightReport = {
      insights,
      patterns,
      recommendations
    };
    // Cache for 1 hour
    this.insightCache.set(cacheKey, report);
    setTimeout(() => {
      this.insightCache.delete(cacheKey);
    }, 60 * 60 * 1000);
    return report;
  }
  async getSessionMetrics(sessionId: string): Promise<SessionMetrics | undefined> {
    return this.metrics.get(sessionId);
  }
  async getAllMetrics(): Promise<SessionMetrics[]> {
    return Array.from(this.metrics.values());
  }
}