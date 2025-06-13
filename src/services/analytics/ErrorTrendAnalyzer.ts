import { ErrorAnalyticsEngine, ErrorPattern, TimeSeriesData } from './ErrorAnalyticsEngine';
import { ErrorSeverity } from '@/src/core/orchestrator/EnhancedErrorHandler';
import { EventEmitter } from 'events';

export interface TrendAnalysis {
  id: string;
  type: 'seasonal' | 'cyclic' | 'spike' | 'gradual' | 'sudden';
  confidence: number; // 0-1
  description: string;
  startTime: Date;
  endTime?: Date;
  affectedMetric: string;
  magnitude: number; // Percentage change
  predictions: TrendPrediction[];
}

export interface TrendPrediction {
  timestamp: Date;
  metric: string;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  probability: number;
}

export interface Seasonality {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  strength: number; // 0-1
  peakTimes: Date[];
  lowTimes: Date[];
}

export interface Anomaly {
  id: string;
  timestamp: Date;
  metric: string;
  actualValue: number;
  expectedValue: number;
  deviation: number; // Standard deviations from mean
  severity: 'low' | 'medium' | 'high';
}

export interface PatternCluster {
  id: string;
  patterns: ErrorPattern[];
  commonCharacteristics: string[];
  frequency: number;
  severity: ErrorSeverity;
  recommendation: string;
}

export class ErrorTrendAnalyzer extends EventEmitter {
  private analyticsEngine: ErrorAnalyticsEngine;
  private historicalData: Map<string, TimeSeriesData[]> = new Map();
  private trendAnalyses: Map<string, TrendAnalysis> = new Map();
  private detectedSeasonality: Map<string, Seasonality> = new Map();
  private anomalies: Anomaly[] = [];
  private patternClusters: Map<string, PatternCluster> = new Map();
  
  private readonly ANALYSIS_WINDOW = 86400000; // 24 hours
  private readonly MIN_DATA_POINTS = 50;
  private readonly ANOMALY_THRESHOLD = 2.5; // Standard deviations
  private readonly TREND_CONFIDENCE_THRESHOLD = 0.7;
  
  constructor(analyticsEngine: ErrorAnalyticsEngine) {
    super();
    this.analyticsEngine = analyticsEngine;
    this.startAnalysis();
  }
  
  private startAnalysis(): void {
    // Run initial analysis
    this.runComprehensiveAnalysis();
    
    // Schedule periodic analysis
    setInterval(() => {
      this.runComprehensiveAnalysis();
    }, 300000); // Every 5 minutes
    
    // Listen to analytics updates
    this.analyticsEngine.on('analysis:complete', () => {
      this.updateRealTimeTrends();
    });
  }
  
  private async runComprehensiveAnalysis(): Promise<void> {
    try {
      await Promise.all([
        this.collectHistoricalData(),
        this.detectTrends(),
        this.analyzeSeasonality(),
        this.detectAnomalies(),
        this.clusterPatterns(),
        this.generatePredictions()
      ]);
      
      this.emit('analysis:complete', {
        trends: Array.from(this.trendAnalyses.values()),
        seasonality: Array.from(this.detectedSeasonality.entries()),
        anomalies: this.anomalies,
        clusters: Array.from(this.patternClusters.values())
      });
    } catch (error) {
      // console.error('Error in trend analysis:', error);
    }
  }
  
  private async collectHistoricalData(): Promise<void> {
    const metrics = ['errorRate', 'impactedUsers', 'recoveryRate', 'totalErrors'];
    
    for (const metric of metrics) {
      const data = this.analyticsEngine.getTimeSeries(
        metric as keyof import('./ErrorAnalyticsEngine').ErrorMetrics,
        this.ANALYSIS_WINDOW
      );
      
      this.historicalData.set(metric, data);
    }
  }
  
  private async detectTrends(): Promise<void> {
    for (const [metric, data] of this.historicalData) {
      if (data.length < this.MIN_DATA_POINTS) continue;
      
      // Linear regression for overall trend
      const trend = this.calculateLinearTrend(data);
      
      // Moving averages for trend detection
      const ma7 = this.calculateMovingAverage(data, 7);
      const ma21 = this.calculateMovingAverage(data, 21);
      
      // Detect trend type
      const trendType = this.detectTrendType(data, ma7, ma21);
      
      if (trendType && trend.confidence > this.TREND_CONFIDENCE_THRESHOLD) {
        const analysis: TrendAnalysis = {
          id: `trend-${metric}-${Date.now()}`,
          type: trendType,
          confidence: trend.confidence,
          description: this.describeTrend(metric, trendType, trend),
          startTime: data[0]?.timestamp || new Date(),
          affectedMetric: metric,
          magnitude: trend.slope * 100, // Percentage change
          predictions: []
        };
        
        this.trendAnalyses.set(metric, analysis);
      }
    }
  }
  
  private calculateLinearTrend(data: TimeSeriesData[]): { slope: number; intercept: number; confidence: number } {
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    
    data.forEach((point, i) => {
      sumX += i;
      sumY += point.value;
      sumXY += i * point.value;
      sumX2 += i * i;
      sumY2 += point.value * point.value;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for confidence
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    
    data.forEach((point, i) => {
      const yPred = slope * i + intercept;
      ssTotal += Math.pow(point.value - yMean, 2);
      ssResidual += Math.pow(point.value - yPred, 2);
    });
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, confidence: Math.max(0, rSquared) };
  }
  
  private calculateMovingAverage(data: TimeSeriesData[], window: number): number[] {
    const ma: number[] = [];
    
    for (let i = window - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < window; j++) {
        sum += data[i - j]?.value || 0;
      }
      ma.push(sum / window);
    }
    
    return ma;
  }
  
  private detectTrendType(
    data: TimeSeriesData[], 
    _shortMA: number[], 
    _longMA: number[]
  ): TrendAnalysis['type'] | null {
    const recentData = data.slice(-20);
    const volatility = this.calculateVolatility(recentData);
    
    // Check for spike
    const maxValue = Math.max(...recentData.map(d => d.value));
    const avgValue = recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;
    if (maxValue > avgValue * 3) {
      return 'spike';
    }
    
    // Check for sudden change
    if (volatility > 2) {
      return 'sudden';
    }
    
    // Check for cyclic pattern
    if (this.detectCyclicPattern(data)) {
      return 'cyclic';
    }
    
    // Check for seasonal pattern
    if (this.hasSeasonalPattern(data)) {
      return 'seasonal';
    }
    
    // Default to gradual
    return 'gradual';
  }
  
  private calculateVolatility(data: TimeSeriesData[]): number {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }
  
  private detectCyclicPattern(data: TimeSeriesData[]): boolean {
    // Simple autocorrelation check
    const values = data.map(d => d.value);
    const n = values.length;
    
    for (let lag = 5; lag < n / 2; lag++) {
      const correlation = this.autocorrelation(values, lag);
      if (correlation > 0.7) {
        return true;
      }
    }
    
    return false;
  }
  
  private autocorrelation(values: number[], lag: number): number {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n - lag; i++) {
      numerator += ((values[i] || 0) - mean) * ((values[i + lag] || 0) - mean);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow((values[i] || 0) - mean, 2);
    }
    
    return numerator / denominator;
  }
  
  private hasSeasonalPattern(data: TimeSeriesData[]): boolean {
    // Check for daily patterns
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    data.forEach(point => {
      const hour = point.timestamp.getHours();
      hourlyAverages[hour] += point.value;
      hourlyCounts[hour]++;
    });
    
    // Calculate hourly averages
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }
    
    // Check for significant variation
    const maxHourly = Math.max(...hourlyAverages);
    const minHourly = Math.min(...hourlyAverages.filter(v => v > 0));
    
    return maxHourly > minHourly * 2;
  }
  
  private describeTrend(metric: string, type: TrendAnalysis['type'], trend: any): string {
    const direction = trend.slope > 0 ? 'increasing' : 'decreasing';
    const rate = Math.abs(trend.slope * 100).toFixed(1);
    
    switch (type) {
      case 'spike':
        return `Spike detected in ${metric} with sudden increase`;
      case 'sudden':
        return `Sudden change in ${metric} detected`;
      case 'cyclic':
        return `Cyclic pattern detected in ${metric}`;
      case 'seasonal':
        return `Seasonal pattern detected in ${metric}`;
      case 'gradual':
        return `${metric} is gradually ${direction} at ${rate}% per hour`;
      default:
        return `Trend detected in ${metric}`;
    }
  }
  
  private async analyzeSeasonality(): Promise<void> {
    for (const [metric, data] of this.historicalData) {
      if (data.length < this.MIN_DATA_POINTS * 7) continue; // Need at least a week of data
      
      const seasonality = this.detectSeasonalityPatterns(data);
      if (seasonality) {
        this.detectedSeasonality.set(metric, seasonality);
      }
    }
  }
  
  private detectSeasonalityPatterns(data: TimeSeriesData[]): Seasonality | null {
    // Analyze different time periods
    const hourlyPattern = this.analyzeHourlyPattern(data);
    const dailyPattern = this.analyzeDailyPattern(data);
    const weeklyPattern = this.analyzeWeeklyPattern(data);
    
    // Find strongest pattern
    let strongest: Seasonality | null = null;
    let maxStrength = 0;
    
    for (const pattern of [hourlyPattern, dailyPattern, weeklyPattern]) {
      if (pattern && pattern.strength > maxStrength) {
        strongest = pattern;
        maxStrength = pattern.strength;
      }
    }
    
    return maxStrength > 0.5 ? strongest : null;
  }
  
  private analyzeHourlyPattern(data: TimeSeriesData[]): Seasonality {
    const hourlyStats = new Array(24).fill(null).map(() => ({ sum: 0, count: 0, values: [] as number[] }));
    
    data.forEach(point => {
      const hour = point.timestamp.getHours();
      hourlyStats[hour]!.sum += point.value;
      hourlyStats[hour]!.count++;
      hourlyStats[hour]!.values.push(point.value);
    });
    
    const hourlyAverages = hourlyStats.map(stat => 
      stat.count > 0 ? stat.sum / stat.count : 0
    );
    
    const maxHour = hourlyAverages.indexOf(Math.max(...hourlyAverages));
    const minHour = hourlyAverages.indexOf(Math.min(...hourlyAverages.filter(v => v > 0)));
    
    const strength = this.calculateSeasonalityStrength(hourlyStats.map(s => s.values));
    
    return {
      period: 'hourly',
      strength,
      peakTimes: [new Date(2024, 0, 1, maxHour)],
      lowTimes: [new Date(2024, 0, 1, minHour)]
    };
  }
  
  private analyzeDailyPattern(data: TimeSeriesData[]): Seasonality {
    const dailyStats = new Array(7).fill(null).map(() => ({ sum: 0, count: 0, values: [] as number[] }));
    
    data.forEach(point => {
      const day = point.timestamp.getDay();
      if (dailyStats[day]) {
        dailyStats[day].sum += point.value;
        dailyStats[day].count++;
        dailyStats[day].values.push(point.value);
      }
    });
    
    const dailyAverages = dailyStats.map(stat => 
      stat.count > 0 ? stat.sum / stat.count : 0
    );
    
    const maxDay = dailyAverages.indexOf(Math.max(...dailyAverages));
    const minDay = dailyAverages.indexOf(Math.min(...dailyAverages.filter(v => v > 0)));
    
    const strength = this.calculateSeasonalityStrength(dailyStats.map(s => s.values));
    
    return {
      period: 'daily',
      strength,
      peakTimes: [new Date(2024, 0, maxDay + 1)],
      lowTimes: [new Date(2024, 0, minDay + 1)]
    };
  }
  
  private analyzeWeeklyPattern(data: TimeSeriesData[]): Seasonality {
    const weeklyStats = new Array(4).fill(null).map(() => ({ sum: 0, count: 0, values: [] as number[] }));
    
    data.forEach(point => {
      const weekOfMonth = Math.floor(point.timestamp.getDate() / 7);
      if (weekOfMonth < 4 && weeklyStats[weekOfMonth]) {
        weeklyStats[weekOfMonth].sum += point.value;
        weeklyStats[weekOfMonth].count++;
        weeklyStats[weekOfMonth].values.push(point.value);
      }
    });
    
    const strength = this.calculateSeasonalityStrength(weeklyStats.map(s => s.values));
    
    return {
      period: 'weekly',
      strength,
      peakTimes: [],
      lowTimes: []
    };
  }
  
  private calculateSeasonalityStrength(periodData: number[][]): number {
    // Calculate variance within periods vs between periods
    let withinVariance = 0;
    let betweenVariance = 0;
    let totalCount = 0;
    
    const periodMeans = periodData.map(values => {
      if (values.length === 0) return 0;
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    });
    
    const grandMean = periodMeans.reduce((sum, m) => sum + m, 0) / periodMeans.length;
    
    periodData.forEach((values, i) => {
      values.forEach(value => {
        const mean = periodMeans[i] ?? 0;
        withinVariance += Math.pow(value - mean, 2);
        totalCount++;
      });
      const mean = periodMeans[i] ?? 0;
      betweenVariance += values.length * Math.pow(mean - grandMean, 2);
    });
    
    if (totalCount === 0) return 0;
    
    withinVariance /= totalCount;
    betweenVariance /= periodData.length;
    
    return betweenVariance / (betweenVariance + withinVariance);
  }
  
  private async detectAnomalies(): Promise<void> {
    this.anomalies = [];
    
    for (const [metric, data] of this.historicalData) {
      if (data.length < this.MIN_DATA_POINTS) continue;
      
      // Calculate statistics
      const values = data.map(d => d.value);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );
      
      // Detect anomalies
      data.forEach((point, i) => {
        const deviation = Math.abs(point.value - mean) / stdDev;
        
        if (deviation > this.ANOMALY_THRESHOLD) {
          const anomaly: Anomaly = {
            id: `anomaly-${metric}-${i}`,
            timestamp: point.timestamp,
            metric,
            actualValue: point.value,
            expectedValue: mean,
            deviation,
            severity: deviation > 4 ? 'high' : deviation > 3 ? 'medium' : 'low'
          };
          
          this.anomalies.push(anomaly);
        }
      });
    }
    
    // Sort by timestamp
    this.anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  private async clusterPatterns(): Promise<void> {
    const patterns = this.analyticsEngine.getPatterns();
    
    // Simple clustering based on similarity
    const clusters: Map<string, ErrorPattern[]> = new Map();
    
    patterns.forEach(pattern => {
      let added = false;
      
      for (const [, clusterPatterns] of clusters) {
        if (clusterPatterns[0] && this.patternsAreSimilar(pattern, clusterPatterns[0])) {
          clusterPatterns.push(pattern);
          added = true;
          break;
        }
      }
      
      if (!added) {
        clusters.set(`cluster-${Date.now()}-${Math.random()}`, [pattern]);
      }
    });
    
    // Convert to PatternCluster objects
    this.patternClusters.clear();
    
    for (const [id, clusterPatterns] of clusters) {
      if (clusterPatterns.length > 1) {
        const cluster: PatternCluster = {
          id,
          patterns: clusterPatterns,
          commonCharacteristics: this.findCommonCharacteristics(clusterPatterns),
          frequency: clusterPatterns.reduce((sum, p) => sum + p.frequency, 0),
          severity: this.getMaxSeverity(clusterPatterns),
          recommendation: this.generateClusterRecommendation(clusterPatterns)
        };
        
        this.patternClusters.set(id, cluster);
      }
    }
  }
  
  private patternsAreSimilar(p1: ErrorPattern, p2: ErrorPattern): boolean {
    // Check if patterns share common elements
    const p1Parts = p1.pattern.split(':');
    const p2Parts = p2.pattern.split(':');
    
    // Same error type
    if (p1Parts[0] === p2Parts[0]) return true;
    
    // Similar message
    if (p1Parts[1] && p2Parts[1]) {
      const similarity = this.calculateStringSimilarity(p1Parts[1], p2Parts[1]);
      if (similarity > 0.7) return true;
    }
    
    // Same severity and similar components
    if (p1.severity === p2.severity && 
        p1.affectedComponents.some(c => p2.affectedComponents.includes(c))) {
      return true;
    }
    
    return false;
  }
  
  private calculateStringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1] ?? 0;
          if (s1[i - 1] !== s2[j - 1]) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j] ?? 0) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue ?? lastValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue ?? 0;
    }
    
    return costs[s2.length] ?? 0;
  }
  
  private findCommonCharacteristics(patterns: ErrorPattern[]): string[] {
    const characteristics: string[] = [];
    
    // Common error types
    const errorTypes = new Set(patterns.map(p => p.pattern.split(':')[0]));
    if (errorTypes.size === 1) {
      characteristics.push(`All ${errorTypes.values().next().value} errors`);
    }
    
    // Common components
    const componentCounts: Record<string, number> = {};
    patterns.forEach(p => {
      p.affectedComponents.forEach(c => {
        componentCounts[c] = (componentCounts[c] || 0) + 1;
      });
    });
    
    Object.entries(componentCounts)
      .filter(([_, count]) => count > patterns.length * 0.5)
      .forEach(([component, _]) => {
        characteristics.push(`Affects ${component}`);
      });
    
    // Common severity
    const severities = new Set(patterns.map(p => p.severity));
    if (severities.size === 1) {
      characteristics.push(`All ${severities.values().next().value} severity`);
    }
    
    return characteristics;
  }
  
  private getMaxSeverity(patterns: ErrorPattern[]): ErrorSeverity {
    const severityOrder = [
      ErrorSeverity.LOW,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.HIGH,
      ErrorSeverity.CRITICAL
    ];
    
    let maxIndex = 0;
    patterns.forEach(p => {
      const index = severityOrder.indexOf(p.severity);
      if (index > maxIndex) maxIndex = index;
    });
    
    return severityOrder[maxIndex] ?? ErrorSeverity.LOW;
  }
  
  private generateClusterRecommendation(patterns: ErrorPattern[]): string {
    const totalFrequency = patterns.reduce((sum, p) => sum + p.frequency, 0);
    const avgFrequency = totalFrequency / patterns.length;
    
    if (avgFrequency > 100) {
      return 'High-frequency error cluster requires immediate attention';
    } else if (this.getMaxSeverity(patterns) === ErrorSeverity.CRITICAL) {
      return 'Critical error cluster - investigate root cause immediately';
    } else if (patterns.length > 5) {
      return 'Large error cluster indicates systemic issue - review architecture';
    } else {
      return 'Monitor cluster growth and implement targeted fixes';
    }
  }
  
  private async generatePredictions(): Promise<void> {
    for (const [metric, analysis] of this.trendAnalyses) {
      const data = this.historicalData.get(metric);
      if (!data || data.length < this.MIN_DATA_POINTS) continue;
      
      const predictions = this.predictFutureValues(data, analysis);
      analysis.predictions = predictions;
    }
  }
  
  private predictFutureValues(
    data: TimeSeriesData[], 
    analysis: TrendAnalysis
  ): TrendPrediction[] {
    const predictions: TrendPrediction[] = [];
    if (data.length === 0) return predictions;
    
    const lastData = data[data.length - 1];
    if (!lastData) return predictions;
    const lastValue = lastData.value;
    const lastTime = lastData.timestamp.getTime();
    
    // Simple linear prediction with confidence intervals
    const trend = this.calculateLinearTrend(data);
    const stdError = this.calculateStandardError(data, trend);
    
    // Predict next 6 hours
    for (let i = 1; i <= 6; i++) {
      const futureTime = new Date(lastTime + i * 3600000); // 1 hour intervals
      const predictedValue = Math.max(0, lastValue + (trend.slope * i * 60)); // Slope is per data point
      
      predictions.push({
        timestamp: futureTime,
        metric: analysis.affectedMetric,
        predictedValue,
        confidenceInterval: {
          lower: Math.max(0, predictedValue - 2 * stdError),
          upper: predictedValue + 2 * stdError
        },
        probability: trend.confidence
      });
    }
    
    return predictions;
  }
  
  private calculateStandardError(data: TimeSeriesData[], trend: any): number {
    let sumSquaredErrors = 0;
    
    data.forEach((point, i) => {
      const predicted = trend.slope * i + trend.intercept;
      sumSquaredErrors += Math.pow(point.value - predicted, 2);
    });
    
    return Math.sqrt(sumSquaredErrors / (data.length - 2));
  }
  
  private updateRealTimeTrends(): void {
    // Quick update for real-time monitoring
    const metrics = this.analyticsEngine.getMetrics();
    
    // Check for sudden changes
    for (const [metric, analysis] of this.trendAnalyses) {
      const currentValue = metrics[metric as keyof typeof metrics] as number;
      if (typeof currentValue === 'number' && analysis.predictions.length > 0 && analysis.predictions[0]) {
        const expectedValue = analysis.predictions[0].predictedValue;
        const deviation = Math.abs(currentValue - expectedValue) / expectedValue;
        
        if (deviation > 0.5) {
          this.emit('trend:deviation', {
            metric,
            expected: expectedValue,
            actual: currentValue,
            deviation: deviation * 100
          });
        }
      }
    }
  }
  
  // Public API methods
  
  public getTrends(): TrendAnalysis[] {
    return Array.from(this.trendAnalyses.values());
  }
  
  public getSeasonality(): Array<[string, Seasonality]> {
    return Array.from(this.detectedSeasonality.entries());
  }
  
  public getAnomalies(limit?: number): Anomaly[] {
    return limit ? this.anomalies.slice(0, limit) : [...this.anomalies];
  }
  
  public getPatternClusters(): PatternCluster[] {
    return Array.from(this.patternClusters.values());
  }
  
  public getPredictions(metric: string): TrendPrediction[] {
    const analysis = this.trendAnalyses.get(metric);
    return analysis ? [...analysis.predictions] : [];
  }
  
  public async analyzePeriod(startDate: Date, endDate: Date): Promise<any> {
    // Custom period analysis
    const periodData: Record<string, TimeSeriesData[]> = {};
    
    for (const [metric, data] of this.historicalData) {
      periodData[metric] = data.filter(
        d => d.timestamp >= startDate && d.timestamp <= endDate
      );
    }
    
    return {
      period: { start: startDate, end: endDate },
      trends: this.detectTrendsInPeriod(periodData),
      anomalies: this.anomalies.filter(
        a => a.timestamp >= startDate && a.timestamp <= endDate
      ),
      insights: this.generatePeriodInsights(periodData)
    };
  }
  
  private detectTrendsInPeriod(periodData: Record<string, TimeSeriesData[]>): any[] {
    const trends: any[] = [];
    
    for (const [metric, data] of Object.entries(periodData)) {
      if (data.length > 10) {
        const trend = this.calculateLinearTrend(data);
        trends.push({
          metric,
          direction: trend.slope > 0 ? 'increasing' : 'decreasing',
          rate: Math.abs(trend.slope),
          confidence: trend.confidence
        });
      }
    }
    
    return trends;
  }
  
  private generatePeriodInsights(periodData: Record<string, TimeSeriesData[]>): string[] {
    const insights: string[] = [];
    
    // Check for significant changes
    for (const [metric, data] of Object.entries(periodData)) {
      if (data.length > 0) {
        const firstData = data[0];
        const lastData = data[data.length - 1];
        if (!firstData || !lastData) continue;
        const firstValue = firstData.value;
        const lastValue = lastData.value;
        const change = ((lastValue - firstValue) / firstValue) * 100;
        
        if (Math.abs(change) > 50) {
          insights.push(`${metric} changed by ${change.toFixed(1)}% during this period`);
        }
      }
    }
    
    return insights;
  }
  
  public destroy(): void {
    this.removeAllListeners();
    this.historicalData.clear();
    this.trendAnalyses.clear();
    this.detectedSeasonality.clear();
    this.anomalies = [];
    this.patternClusters.clear();
  }
}