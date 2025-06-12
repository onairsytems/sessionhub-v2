/**
 * Predictive Failure Detector
 * Uses machine learning patterns and statistical analysis to predict failures before they occur
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { HealthMonitoringService, HealthMetrics } from './HealthMonitoringService';
import { EnhancedErrorHandler } from '@/src/core/orchestrator/EnhancedErrorHandler';

export interface FailurePrediction {
  id: string;
  component: string;
  metric: string;
  likelihood: number; // 0-1
  timeToFailure?: number; // milliseconds
  confidence: number; // 0-1
  predictedValue?: number;
  threshold: number;
  currentValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendation: string;
  timestamp: string;
}

export interface AnomalyDetection {
  id: string;
  component: string;
  metric: string;
  severity: 'low' | 'medium' | 'high';
  deviation: number; // standard deviations from mean
  value: number;
  expectedRange: { min: number; max: number };
  possibleCauses: string[];
  timestamp: string;
}

export interface PatternAnalysis {
  pattern: 'periodic' | 'exponential' | 'linear' | 'irregular';
  confidence: number;
  period?: number; // for periodic patterns
  rate?: number; // for exponential/linear patterns
  nextPeak?: number; // timestamp
}

interface MetricHistory {
  values: number[];
  timestamps: number[];
  anomalies: AnomalyDetection[];
  predictions: FailurePrediction[];
}

interface StatisticalModel {
  mean: number;
  stdDev: number;
  median: number;
  percentiles: { p95: number; p99: number };
  trend: { slope: number; intercept: number };
  seasonality?: { period: number; amplitude: number };
}

export class PredictiveFailureDetector extends EventEmitter {
  private readonly logger: Logger;
  private readonly healthMonitor: HealthMonitoringService;
  private readonly errorHandler: EnhancedErrorHandler;
  
  private readonly metricHistories: Map<string, MetricHistory> = new Map();
  private readonly models: Map<string, StatisticalModel> = new Map();
  private readonly predictions: Map<string, FailurePrediction> = new Map();
  
  private analysisInterval: NodeJS.Timeout | null = null;
  private readonly analysisIntervalMs = 30000; // 30 seconds
  private readonly historyWindowSize = 1000;
  
  // Thresholds for predictions
  private readonly predictionThresholds = {
    likelihood: 0.7, // Warn when 70% likely
    confidence: 0.6, // Minimum confidence for predictions
    anomalyDeviation: 3, // Standard deviations for anomaly
  };

  constructor(
    logger: Logger,
    healthMonitor: HealthMonitoringService,
    errorHandler: EnhancedErrorHandler
  ) {
    super();
    this.logger = logger;
    this.healthMonitor = healthMonitor;
    this.errorHandler = errorHandler;
    
    // Subscribe to health metrics
    this.healthMonitor.on('metrics', this.onHealthMetrics.bind(this));
    
    // Subscribe to error patterns
    this.subscribeToErrorPatterns();
  }

  /**
   * Start predictive analysis
   */
  start(): void {
    if (this.analysisInterval) {
      this.logger.warn('Predictive failure detector already started');
      return;
    }

    this.logger.info('Starting predictive failure detector');
    
    // Perform initial analysis
    this.performAnalysis();
    
    // Schedule regular analysis
    this.analysisInterval = setInterval(() => {
      this.performAnalysis();
    }, this.analysisIntervalMs);
  }

  /**
   * Stop predictive analysis
   */
  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
      this.logger.info('Predictive failure detector stopped');
    }
  }

  /**
   * Handle incoming health metrics
   */
  private onHealthMetrics(data: { 
    metrics: HealthMetrics; 
    status: any; 
    trends: any 
  }): void {
    const { metrics } = data;
    const timestamp = Date.now();
    
    // Update metric histories
    this.updateMetricHistory('cpu.usage', metrics.cpu.usage, timestamp);
    this.updateMetricHistory('memory.percentUsed', metrics.memory.percentUsed, timestamp);
    this.updateMetricHistory('memory.heapUsed', metrics.memory.heapUsedMB, timestamp);
    this.updateMetricHistory('performance.responseTime', metrics.performance.responseTime, timestamp);
    this.updateMetricHistory('performance.errorRate', metrics.performance.errorRate, timestamp);
    this.updateMetricHistory('network.latency', metrics.network.latency, timestamp);
    this.updateMetricHistory('storage.diskUsage', metrics.storage.diskUsagePercent, timestamp);
    
    // Check for immediate anomalies
    this.detectAnomalies();
  }

  /**
   * Update metric history
   */
  private updateMetricHistory(
    metricName: string, 
    value: number, 
    timestamp: number
  ): void {
    if (!this.metricHistories.has(metricName)) {
      this.metricHistories.set(metricName, {
        values: [],
        timestamps: [],
        anomalies: [],
        predictions: []
      });
    }
    
    const history = this.metricHistories.get(metricName)!;
    history.values.push(value);
    history.timestamps.push(timestamp);
    
    // Maintain window size
    if (history.values.length > this.historyWindowSize) {
      history.values.shift();
      history.timestamps.shift();
    }
  }

  /**
   * Perform comprehensive analysis
   */
  private async performAnalysis(): Promise<void> {
    try {
      this.logger.debug('Performing predictive analysis');
      
      // Update statistical models
      this.updateModels();
      
      // Generate predictions
      const predictions = this.generatePredictions();
      
      // Detect patterns
      this.detectPatterns();
      
      // Correlate with error history
      await this.correlateWithErrors();
      
      // Emit high-risk predictions
      for (const prediction of predictions) {
        if (prediction.likelihood >= this.predictionThresholds.likelihood &&
            prediction.confidence >= this.predictionThresholds.confidence) {
          this.emit('failurePredicted', prediction);
          this.logger.warn('Failure predicted', prediction);
        }
      }
      
      // Store predictions
      for (const prediction of predictions) {
        this.predictions.set(prediction.id, prediction);
      }
      
    } catch (error) {
      this.logger.error('Predictive analysis failed', error as Error);
    }
  }

  /**
   * Update statistical models for each metric
   */
  private updateModels(): void {
    for (const [metricName, history] of this.metricHistories) {
      if (history.values.length < 10) continue; // Need minimum data
      
      const model = this.calculateStatisticalModel(history.values, history.timestamps);
      this.models.set(metricName, model);
    }
  }

  /**
   * Calculate statistical model for a metric
   */
  private calculateStatisticalModel(
    values: number[], 
    timestamps: number[]
  ): StatisticalModel {
    // Basic statistics
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)] ?? 0;
    
    // Standard deviation
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Percentiles
    const p95 = sortedValues[Math.floor(sortedValues.length * 0.95)] ?? 0;
    const p99 = sortedValues[Math.floor(sortedValues.length * 0.99)] ?? 0;
    
    // Linear regression for trend
    const trend = this.calculateLinearRegression(values, timestamps);
    
    // Detect seasonality (simplified)
    const seasonality = this.detectSeasonality(values, timestamps);
    
    return {
      mean,
      stdDev,
      median,
      percentiles: { p95, p99 },
      trend,
      seasonality
    };
  }

  /**
   * Calculate linear regression
   */
  private calculateLinearRegression(
    values: number[], 
    timestamps: number[]
  ): { slope: number; intercept: number } {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] || 0 };
    
    // Normalize timestamps
    const startTime = timestamps[0] ?? 0;
    const normalizedTimes = timestamps.map(t => (t - startTime) / 1000); // seconds
    
    // Calculate sums
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const x = normalizedTimes[i] ?? 0;
      const y = values[i] ?? 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  /**
   * Detect seasonality in data
   */
  private detectSeasonality(
    values: number[], 
    timestamps: number[]
  ): { period: number; amplitude: number } | undefined {
    if (values.length < 100) return undefined; // Need sufficient data
    
    // Simple FFT-based seasonality detection (simplified)
    // In production, would use proper FFT library
    
    // For now, check for daily patterns (86400000 ms)
    const dayMs = 86400000;
    const periods: number[] = [];
    
    for (let i = 24; i < values.length; i++) {
      const currentTime = timestamps[i] ?? 0;
      const prevTime = timestamps[i - 24] ?? 0;
      const currentValue = values[i] ?? 0;
      const prevValue = values[i - 24] ?? 0;
      if (currentTime - prevTime >= dayMs * 0.9 &&
          currentTime - prevTime <= dayMs * 1.1) {
        periods.push(Math.abs(currentValue - prevValue));
      }
    }
    
    if (periods.length > 0) {
      const avgAmplitude = periods.reduce((a, b) => a + b, 0) / periods.length;
      if (avgAmplitude > 0) {
        return { period: dayMs, amplitude: avgAmplitude };
      }
    }
    
    return undefined;
  }

  /**
   * Generate failure predictions
   */
  private generatePredictions(): FailurePrediction[] {
    const predictions: FailurePrediction[] = [];
    
    for (const [metricName, history] of this.metricHistories) {
      const model = this.models.get(metricName);
      if (!model || history.values.length < 10) continue;
      
      const prediction = this.predictMetricFailure(metricName, history, model);
      if (prediction) {
        predictions.push(prediction);
      }
    }
    
    return predictions;
  }

  /**
   * Predict failure for a specific metric
   */
  private predictMetricFailure(
    metricName: string,
    history: MetricHistory,
    model: StatisticalModel
  ): FailurePrediction | null {
    const currentValue = history.values[history.values.length - 1] ?? 0;
    
    // Get threshold based on metric
    const threshold = this.getMetricThreshold(metricName);
    if (!threshold) return null;
    
    // Project future value based on trend
    const projectionTimeMs = 3600000; // 1 hour ahead
    const projectedValue = this.projectValue(model, projectionTimeMs / 1000);
    
    // Calculate likelihood of exceeding threshold
    const likelihood = this.calculateFailureLikelihood(
      currentValue,
      projectedValue,
      threshold,
      model
    );
    
    // Calculate time to failure
    const timeToFailure = this.calculateTimeToFailure(
      currentValue,
      threshold,
      model.trend.slope
    );
    
    // Calculate confidence based on model stability
    const confidence = this.calculatePredictionConfidence(history, model);
    
    // Determine trend
    const trend = model.trend.slope > 0.1 ? 'increasing' : 
                  model.trend.slope < -0.1 ? 'decreasing' : 'stable';
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      metricName,
      currentValue,
      threshold,
      trend,
      likelihood
    );
    
    return {
      id: `pred_${metricName}_${Date.now()}`,
      component: this.getComponentFromMetric(metricName),
      metric: metricName,
      likelihood,
      timeToFailure,
      confidence,
      predictedValue: projectedValue,
      threshold,
      currentValue,
      trend,
      recommendation,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Project future value based on model
   */
  private projectValue(model: StatisticalModel, timeAheadSeconds: number): number {
    let projectedValue = model.trend.intercept + model.trend.slope * timeAheadSeconds;
    
    // Add seasonality if detected
    if (model.seasonality) {
      const phase = (timeAheadSeconds * 1000) % model.seasonality.period;
      const seasonalComponent = model.seasonality.amplitude * 
        Math.sin(2 * Math.PI * phase / model.seasonality.period);
      projectedValue += seasonalComponent;
    }
    
    return projectedValue;
  }

  /**
   * Calculate likelihood of failure
   */
  private calculateFailureLikelihood(
    currentValue: number,
    projectedValue: number,
    threshold: number,
    model: StatisticalModel
  ): number {
    // Distance from threshold considering uncertainty
    const currentDistance = (threshold - currentValue) / model.stdDev;
    const projectedDistance = (threshold - projectedValue) / model.stdDev;
    
    // Use cumulative distribution function approximation
    const cdf = (x: number) => 0.5 * (1 + Math.tanh(x / Math.sqrt(2)));
    
    // Calculate probabilities
    const currentProb = 1 - cdf(currentDistance);
    const projectedProb = 1 - cdf(projectedDistance);
    
    // Weight current and projected
    return 0.3 * currentProb + 0.7 * projectedProb;
  }

  /**
   * Calculate time to failure
   */
  private calculateTimeToFailure(
    currentValue: number,
    threshold: number,
    slope: number
  ): number | undefined {
    if (slope <= 0) return undefined; // Not approaching threshold
    
    const timeSeconds = (threshold - currentValue) / slope;
    if (timeSeconds < 0) return undefined; // Already past threshold
    
    return timeSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(
    history: MetricHistory,
    model: StatisticalModel
  ): number {
    // Factors affecting confidence:
    // 1. Data quantity
    const dataFactor = Math.min(1, history.values.length / 100);
    
    // 2. Model fit (R-squared approximation)
    const rSquared = this.calculateRSquared(history.values, model);
    
    // 3. Stability (coefficient of variation)
    const cv = model.stdDev / Math.abs(model.mean);
    const stabilityFactor = 1 / (1 + cv);
    
    // 4. Recent anomalies
    const recentAnomalies = history.anomalies.filter(
      a => Date.now() - new Date(a.timestamp).getTime() < 3600000
    ).length;
    const anomalyFactor = 1 / (1 + recentAnomalies * 0.1);
    
    // Combine factors
    return dataFactor * rSquared * stabilityFactor * anomalyFactor;
  }

  /**
   * Calculate R-squared for model fit
   */
  private calculateRSquared(values: number[], model: StatisticalModel): number {
    const mean = model.mean;
    let ssTotal = 0;
    let ssResidual = 0;
    
    for (let i = 0; i < values.length; i++) {
      const value = values[i] ?? 0;
      const predicted = model.trend.intercept + model.trend.slope * i;
      ssTotal += Math.pow(value - mean, 2);
      ssResidual += Math.pow(value - predicted, 2);
    }
    
    return 1 - (ssResidual / ssTotal);
  }

  /**
   * Detect anomalies in current data
   */
  private detectAnomalies(): void {
    for (const [metricName, history] of this.metricHistories) {
      const model = this.models.get(metricName);
      if (!model || history.values.length < 10) continue;
      
      const currentValue = history.values[history.values.length - 1] ?? 0;
      const deviation = Math.abs(currentValue - model.mean) / model.stdDev;
      
      if (deviation > this.predictionThresholds.anomalyDeviation) {
        const anomaly: AnomalyDetection = {
          id: `anomaly_${metricName}_${Date.now()}`,
          component: this.getComponentFromMetric(metricName),
          metric: metricName,
          severity: deviation > 5 ? 'high' : deviation > 4 ? 'medium' : 'low',
          deviation,
          value: currentValue ?? 0,
          expectedRange: {
            min: model.mean - 3 * model.stdDev,
            max: model.mean + 3 * model.stdDev
          },
          possibleCauses: this.identifyPossibleCauses(metricName, currentValue ?? 0, model),
          timestamp: new Date().toISOString()
        };
        
        history.anomalies.push(anomaly);
        this.emit('anomalyDetected', anomaly);
        
        this.logger.warn('Anomaly detected', anomaly);
      }
    }
  }

  /**
   * Detect patterns in metrics
   */
  private detectPatterns(): Map<string, PatternAnalysis> {
    const patterns = new Map<string, PatternAnalysis>();
    
    for (const [metricName, history] of this.metricHistories) {
      if (history.values.length < 50) continue;
      
      const pattern = this.analyzePattern(history.values, history.timestamps);
      if (pattern) {
        patterns.set(metricName, pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Analyze pattern in time series data
   */
  private analyzePattern(
    values: number[], 
    timestamps: number[]
  ): PatternAnalysis | null {
    const model = this.calculateStatisticalModel(values, timestamps);
    
    // Check for linear pattern
    if (Math.abs(model.trend.slope) > 0.1) {
      const rSquared = this.calculateRSquared(values, model);
      if (rSquared > 0.7) {
        return {
          pattern: 'linear',
          confidence: rSquared,
          rate: model.trend.slope
        };
      }
    }
    
    // Check for periodic pattern
    if (model.seasonality) {
      return {
        pattern: 'periodic',
        confidence: 0.8, // Simplified
        period: model.seasonality.period,
        nextPeak: Date.now() + model.seasonality.period
      };
    }
    
    // Check for exponential pattern
    const exponentialFit = this.checkExponentialPattern(values);
    if (exponentialFit.confidence > 0.7) {
      return {
        pattern: 'exponential',
        confidence: exponentialFit.confidence,
        rate: exponentialFit.rate
      };
    }
    
    return null;
  }

  /**
   * Check for exponential pattern
   */
  private checkExponentialPattern(
    values: number[]
  ): { confidence: number; rate: number } {
    // Simple exponential detection using log transformation
    const logValues = values.map(v => Math.log(Math.max(1, v)));
    const timestamps = values.map((_, i) => i);
    
    const logModel = this.calculateStatisticalModel(logValues, timestamps);
    const rSquared = this.calculateRSquared(logValues, logModel);
    
    return {
      confidence: rSquared,
      rate: logModel.trend.slope
    };
  }

  /**
   * Correlate with error history
   */
  private async correlateWithErrors(): Promise<Map<string, number>> {
    const correlations = new Map<string, number>();
    
    // Get error statistics from error handler
    // const errorStats = this.errorHandler.getErrorStats();
    
    // Correlate metric trends with error occurrences
    for (const [metricName, _history] of this.metricHistories) {
      // Simplified correlation calculation
      // In production, would use proper correlation algorithms
      const correlation = 0.5; // Placeholder
      correlations.set(metricName, correlation);
    }
    
    return correlations;
  }

  /**
   * Subscribe to error patterns
   */
  private subscribeToErrorPatterns(): void {
    // Get predictions from error handler
    const errorCodes = ['TIMEOUT_ERROR', 'NETWORK_ERROR', 'MEMORY_ERROR'];
    
    for (const code of errorCodes) {
      const prediction = this.errorHandler.predictFailure(code);
      if (prediction.likelihood > 0.5) {
        this.logger.info('Error pattern detected', { code, prediction });
      }
    }
  }

  /**
   * Get metric threshold
   */
  private getMetricThreshold(metricName: string): number | null {
    const thresholds: Record<string, number> = {
      'cpu.usage': 90,
      'memory.percentUsed': 90,
      'memory.heapUsed': 1024, // MB
      'performance.responseTime': 5000, // ms
      'performance.errorRate': 10, // percent
      'network.latency': 500, // ms
      'storage.diskUsage': 95 // percent
    };
    
    return thresholds[metricName] || null;
  }

  /**
   * Get component from metric name
   */
  private getComponentFromMetric(metricName: string): string {
    const parts = metricName.split('.');
    return parts[0] || 'unknown';
  }

  /**
   * Identify possible causes for anomaly
   */
  private identifyPossibleCauses(
    metricName: string,
    value: number,
    model: StatisticalModel
  ): string[] {
    const causes: string[] = [];
    
    if (metricName.includes('cpu')) {
      if (value > model.mean + 2 * model.stdDev) {
        causes.push('High computational load');
        causes.push('Runaway process');
        causes.push('Insufficient CPU resources');
      }
    } else if (metricName.includes('memory')) {
      if (value > model.percentiles.p95) {
        causes.push('Memory leak');
        causes.push('Large data processing');
        causes.push('Insufficient garbage collection');
      }
    } else if (metricName.includes('responseTime')) {
      if (value > model.percentiles.p99) {
        causes.push('Database slowdown');
        causes.push('Network congestion');
        causes.push('Resource contention');
      }
    } else if (metricName.includes('errorRate')) {
      causes.push('Service degradation');
      causes.push('Configuration issues');
      causes.push('External service failures');
    }
    
    return causes;
  }

  /**
   * Generate recommendation based on prediction
   */
  private generateRecommendation(
    metricName: string,
    _currentValue: number,
    _threshold: number,
    trend: string,
    likelihood: number
  ): string {
    const component = this.getComponentFromMetric(metricName);
    const severity = likelihood > 0.9 ? 'immediate' : likelihood > 0.7 ? 'soon' : 'eventual';
    
    const recommendations: Record<string, Record<string, string>> = {
      cpu: {
        immediate: 'Scale up CPU resources immediately or optimize CPU-intensive operations',
        soon: 'Monitor CPU usage closely and prepare to scale resources',
        eventual: 'Review CPU usage patterns and plan optimization'
      },
      memory: {
        immediate: 'Investigate memory leaks and restart services if necessary',
        soon: 'Analyze memory allocation patterns and optimize usage',
        eventual: 'Schedule memory profiling and optimization'
      },
      performance: {
        immediate: 'Investigate performance bottlenecks and implement caching',
        soon: 'Review slow queries and optimize database indexes',
        eventual: 'Plan performance optimization sprint'
      },
      network: {
        immediate: 'Check network connectivity and bandwidth utilization',
        soon: 'Review network configuration and optimize routes',
        eventual: 'Monitor network patterns and plan capacity upgrade'
      },
      storage: {
        immediate: 'Free up disk space immediately or expand storage',
        soon: 'Archive old data and implement retention policies',
        eventual: 'Plan storage capacity expansion'
      }
    };
    
    return recommendations[component]?.[severity] || 
           `Monitor ${metricName} closely as it shows ${trend} trend`;
  }

  /**
   * Get current predictions
   */
  getPredictions(): FailurePrediction[] {
    return Array.from(this.predictions.values())
      .filter(p => Date.now() - new Date(p.timestamp).getTime() < 3600000) // Last hour
      .sort((a, b) => b.likelihood - a.likelihood);
  }

  /**
   * Get prediction statistics
   */
  getStats(): {
    totalPredictions: number;
    highRiskPredictions: number;
    anomaliesDetected: number;
    modelAccuracy: number;
    componentRisks: Record<string, number>;
  } {
    const predictions = this.getPredictions();
    const highRisk = predictions.filter(p => p.likelihood > 0.8);
    
    const componentRisks: Record<string, number> = {};
    for (const pred of predictions) {
      const risk = componentRisks[pred.component] || 0;
      componentRisks[pred.component] = Math.max(risk, pred.likelihood);
    }
    
    let totalAnomalies = 0;
    for (const history of this.metricHistories.values()) {
      totalAnomalies += history.anomalies.length;
    }
    
    return {
      totalPredictions: predictions.length,
      highRiskPredictions: highRisk.length,
      anomaliesDetected: totalAnomalies,
      modelAccuracy: 0.85, // Would calculate from historical accuracy
      componentRisks
    };
  }
}