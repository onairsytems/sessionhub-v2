import { EventEmitter } from 'events';
import { ErrorAnalyticsEngine } from './ErrorAnalyticsEngine';
import { HealthMonitoringService } from '@/services/monitoring/HealthMonitoringService';
import { TelemetryCollectionService } from '@/services/telemetry/TelemetryCollectionService';
// import { ErrorSeverity } from '@/core/orchestrator/EnhancedErrorHandler';

export interface ResourceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    processes: ProcessMetrics[];
    loadAverage: number[];
  };
  memory: {
    used: number;
    available: number;
    swapUsed: number;
    heapUsed: number;
    heapTotal: number;
  };
  network: {
    latency: number;
    bandwidth: number;
    packetsLost: number;
    connections: number;
  };
  disk: {
    usage: number;
    ioOperations: number;
    readSpeed: number;
    writeSpeed: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    concurrentUsers: number;
    errorRate: number;
  };
}

export interface ProcessMetrics {
  pid: number;
  name: string;
  cpuUsage: number;
  memoryUsage: number;
  ioActivity: number;
}

export interface PerformanceCorrelation {
  id: string;
  errorType: string;
  resourceMetric: string;
  correlationStrength: number; // -1 to 1
  pValue: number; // Statistical significance
  timeDelay: number; // Milliseconds between resource change and error
  confidence: 'low' | 'medium' | 'high';
  description: string;
  recommendations: string[];
  evidencePoints: CorrelationEvidence[];
}

export interface CorrelationEvidence {
  timestamp: Date;
  errorCount: number;
  resourceValue: number;
  deviation: number; // How far from normal
}

export interface ResourceThreshold {
  metric: string;
  warningLevel: number;
  criticalLevel: number;
  unit: string;
  description: string;
}

export interface PerformanceProfile {
  component: string;
  baselineMetrics: {
    averageResponseTime: number;
    averageCpuUsage: number;
    averageMemoryUsage: number;
    typicalErrorRate: number;
  };
  degradationIndicators: {
    responseTimeThreshold: number;
    cpuThreshold: number;
    memoryThreshold: number;
    errorRateThreshold: number;
  };
  correlatedResources: string[];
  recommendations: string[];
}

export interface ResourceImpactAssessment {
  resource: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedErrors: string[];
  affectedUsers: number;
  degradationPeriod: { start: Date; end?: Date };
  expectedRecoveryTime: number;
  mitigation: string[];
}

export class PerformanceCorrelationAnalyzer extends EventEmitter {
  private analyticsEngine: ErrorAnalyticsEngine;
  private healthMonitor: HealthMonitoringService;
  private telemetryService: TelemetryCollectionService;
  
  private resourceHistory: ResourceMetrics[] = [];
  private correlations: Map<string, PerformanceCorrelation> = new Map();
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private resourceThresholds: Map<string, ResourceThreshold> = new Map();
  private impactAssessments: Map<string, ResourceImpactAssessment> = new Map();
  
  private analysisInterval: NodeJS.Timeout | null = null;
  private readonly HISTORY_SIZE = 1000;
  private readonly ANALYSIS_INTERVAL = 60000; // 1 minute
  private readonly CORRELATION_WINDOW = 300000; // 5 minutes
  
  constructor(
    analyticsEngine: ErrorAnalyticsEngine,
    healthMonitor: HealthMonitoringService,
    telemetryService: TelemetryCollectionService
  ) {
    super();
    this.analyticsEngine = analyticsEngine;
    this.healthMonitor = healthMonitor;
    this.telemetryService = telemetryService;
    
    this.initializeThresholds();
    this.startAnalysis();
  }
  
  private initializeThresholds(): void {
    const thresholds: ResourceThreshold[] = [
      {
        metric: 'cpu.usage',
        warningLevel: 70,
        criticalLevel: 90,
        unit: '%',
        description: 'CPU usage percentage'
      },
      {
        metric: 'memory.used',
        warningLevel: 75,
        criticalLevel: 90,
        unit: '%',
        description: 'Memory usage percentage'
      },
      {
        metric: 'disk.usage',
        warningLevel: 80,
        criticalLevel: 95,
        unit: '%',
        description: 'Disk usage percentage'
      },
      {
        metric: 'network.latency',
        warningLevel: 200,
        criticalLevel: 500,
        unit: 'ms',
        description: 'Network latency'
      },
      {
        metric: 'performance.responseTime',
        warningLevel: 2000,
        criticalLevel: 5000,
        unit: 'ms',
        description: 'Average response time'
      },
      {
        metric: 'performance.errorRate',
        warningLevel: 5,
        criticalLevel: 10,
        unit: '%',
        description: 'Error rate percentage'
      }
    ];
    
    thresholds.forEach(threshold => {
      this.resourceThresholds.set(threshold.metric, threshold);
    });
  }
  
  private startAnalysis(): void {
    // Start periodic analysis
    this.analysisInterval = setInterval(() => {
      this.runCorrelationAnalysis();
    }, this.ANALYSIS_INTERVAL);
    
    // Start resource collection
    this.startResourceCollection();
    
    // Run initial analysis
    this.runCorrelationAnalysis();
  }
  
  private startResourceCollection(): void {
    // Collect resource metrics every 10 seconds
    setInterval(async () => {
      try {
        const metrics = await this.collectResourceMetrics();
        this.resourceHistory.push(metrics);
        
        // Limit history size
        if (this.resourceHistory.length > this.HISTORY_SIZE) {
          this.resourceHistory.shift();
        }
        
        // Check for immediate threshold violations
        this.checkThresholdViolations(metrics);
        
        this.emit('metrics:collected', metrics);
      } catch (error) {
        // console.error('Failed to collect resource metrics:', error);
      }
    }, 10000);
  }
  
  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    const healthStatus = await this.healthMonitor.getHealthStatus();
    const telemetryData = await this.telemetryService.getAggregatedMetrics(60000);
    
    // Get additional system metrics
    const processMetrics = await this.getProcessMetrics();
    const networkMetrics = await this.getNetworkMetrics();
    const diskMetrics = await this.getDiskMetrics();
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: healthStatus.cpu.usage,
        processes: processMetrics,
        loadAverage: healthStatus.cpu.loadAverage || [0, 0, 0]
      },
      memory: {
        used: healthStatus.memory.used,
        available: healthStatus.memory.total - healthStatus.memory.used,
        swapUsed: healthStatus.memory.swap?.used || 0,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      },
      network: {
        latency: healthStatus.network.latency,
        bandwidth: networkMetrics.bandwidth,
        packetsLost: networkMetrics.packetsLost,
        connections: networkMetrics.connections
      },
      disk: {
        usage: healthStatus.storage?.used || 0,
        ioOperations: diskMetrics.ioOperations,
        readSpeed: diskMetrics.readSpeed,
        writeSpeed: diskMetrics.writeSpeed
      },
      performance: {
        responseTime: healthStatus.performance.responseTime,
        throughput: healthStatus.performance.throughput || 0,
        concurrentUsers: (telemetryData.metrics as any)?.concurrentUsers?.count || 0,
        errorRate: healthStatus.performance.errorRate
      }
    };
  }
  
  private async getProcessMetrics(): Promise<ProcessMetrics[]> {
    // In a real implementation, this would use system APIs
    // For now, return mock data with current process info
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return [
      {
        pid: process.pid,
        name: 'SessionHub',
        cpuUsage: cpuUsage.user / 1000000, // Convert to percentage
        memoryUsage: memUsage.heapUsed / (1024 * 1024), // MB
        ioActivity: 0 // Would need additional monitoring
      }
    ];
  }
  
  private async getNetworkMetrics(): Promise<any> {
    // Mock network metrics - would integrate with actual monitoring
    return {
      bandwidth: 100, // Mbps
      packetsLost: 0,
      connections: 10
    };
  }
  
  private async getDiskMetrics(): Promise<any> {
    // Mock disk metrics - would integrate with actual monitoring
    return {
      ioOperations: 50,
      readSpeed: 100, // MB/s
      writeSpeed: 80 // MB/s
    };
  }
  
  private checkThresholdViolations(metrics: ResourceMetrics): void {
    for (const [metricPath, threshold] of this.resourceThresholds) {
      const value = this.getMetricValue(metrics, metricPath);
      
      if (value !== null) {
        if (value >= threshold.criticalLevel) {
          this.emit('threshold:critical', {
            metric: metricPath,
            value,
            threshold: threshold.criticalLevel,
            description: threshold.description
          });
        } else if (value >= threshold.warningLevel) {
          this.emit('threshold:warning', {
            metric: metricPath,
            value,
            threshold: threshold.warningLevel,
            description: threshold.description
          });
        }
      }
    }
  }
  
  private getMetricValue(metrics: ResourceMetrics, path: string): number | null {
    const parts = path.split('.');
    let current: any = metrics;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return typeof current === 'number' ? current : null;
  }
  
  private async runCorrelationAnalysis(): Promise<void> {
    try {
      // Get recent error data
      // const _errorMetrics = this.analyticsEngine.getMetrics();
      // const _errorPatterns = this.analyticsEngine.getPatterns();
      
      // Analyze correlations between errors and resource metrics
      await Promise.all([
        this.analyzeErrorResourceCorrelations(),
        this.identifyPerformanceDegradation(),
        this.assessResourceImpact(),
        this.updatePerformanceProfiles(),
        this.generateCorrelationInsights()
      ]);
      
      this.emit('analysis:complete', {
        correlations: Array.from(this.correlations.values()),
        profiles: Array.from(this.performanceProfiles.values()),
        assessments: Array.from(this.impactAssessments.values())
      });
    } catch (error) {
      // console.error('Correlation analysis failed:', error);
    }
  }
  
  private async analyzeErrorResourceCorrelations(): Promise<void> {
    const recentMetrics = this.resourceHistory.slice(-30); // Last 5 minutes
    if (recentMetrics.length < 10) return;
    
    // Get error time series
    const errorTimeSeries = this.analyticsEngine.getTimeSeries('errorRate', this.CORRELATION_WINDOW);
    const userTimeSeries = this.analyticsEngine.getTimeSeries('impactedUsers', this.CORRELATION_WINDOW);
    
    // Resource metrics to analyze
    const resourcePaths = [
      'cpu.usage',
      'memory.used',
      'network.latency',
      'disk.usage',
      'performance.responseTime'
    ];
    
    for (const resourcePath of resourcePaths) {
      const resourceValues = recentMetrics.map(m => ({
        timestamp: m.timestamp,
        value: this.getMetricValue(m, resourcePath) || 0
      }));
      
      // Calculate correlation with error rate
      const errorCorrelation = this.calculateCorrelation(
        this.alignTimeSeries(errorTimeSeries, resourceValues),
        'errorRate',
        resourcePath
      );
      
      // Calculate correlation with user impact
      const userCorrelation = this.calculateCorrelation(
        this.alignTimeSeries(userTimeSeries, resourceValues),
        'impactedUsers',
        resourcePath
      );
      
      // Store significant correlations
      if (Math.abs(errorCorrelation.correlationStrength) > 0.5) {
        this.correlations.set(`error-${resourcePath}`, errorCorrelation);
      }
      
      if (Math.abs(userCorrelation.correlationStrength) > 0.5) {
        this.correlations.set(`user-${resourcePath}`, userCorrelation);
      }
    }
  }
  
  private alignTimeSeries(
    series1: Array<{ timestamp: Date; value: number }>,
    series2: Array<{ timestamp: Date; value: number }>
  ): Array<{ x: number; y: number; timestamp: Date }> {
    const aligned: Array<{ x: number; y: number; timestamp: Date }> = [];
    
    // Simple alignment - match by closest timestamp
    for (const point1 of series1) {
      const closest = series2.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.timestamp.getTime() - point1.timestamp.getTime());
        const currDiff = Math.abs(curr.timestamp.getTime() - point1.timestamp.getTime());
        return currDiff < prevDiff ? curr : prev;
      });
      
      if (Math.abs(closest.timestamp.getTime() - point1.timestamp.getTime()) < 60000) { // Within 1 minute
        aligned.push({
          x: point1.value,
          y: closest.value,
          timestamp: point1.timestamp
        });
      }
    }
    
    return aligned;
  }
  
  private calculateCorrelation(
    alignedData: Array<{ x: number; y: number; timestamp: Date }>,
    errorType: string,
    resourcePath: string
  ): PerformanceCorrelation {
    if (alignedData.length < 5) {
      return this.createEmptyCorrelation(errorType, resourcePath);
    }
    
    // Calculate Pearson correlation coefficient
    const n = alignedData.length;
    const sumX = alignedData.reduce((sum, d) => sum + d.x, 0);
    const sumY = alignedData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = alignedData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = alignedData.reduce((sum, d) => sum + d.x * d.x, 0);
    const sumY2 = alignedData.reduce((sum, d) => sum + d.y * d.y, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const correlationStrength = denominator === 0 ? 0 : numerator / denominator;
    
    // Calculate p-value (simplified)
    const tScore = correlationStrength * Math.sqrt((n - 2) / (1 - correlationStrength * correlationStrength));
    const pValue = this.calculatePValue(tScore, n - 2);
    
    // Determine confidence
    const confidence = pValue < 0.01 ? 'high' : pValue < 0.05 ? 'medium' : 'low';
    
    // Calculate time delay (simplified)
    const timeDelay = this.calculateTimeDelay(alignedData);
    
    // Generate evidence points
    const evidencePoints = this.generateEvidencePoints(alignedData, correlationStrength);
    
    return {
      id: `corr-${errorType}-${resourcePath}-${Date.now()}`,
      errorType,
      resourceMetric: resourcePath,
      correlationStrength,
      pValue,
      timeDelay,
      confidence,
      description: this.generateCorrelationDescription(errorType, resourcePath, correlationStrength),
      recommendations: this.generateCorrelationRecommendations(resourcePath, correlationStrength),
      evidencePoints
    };
  }
  
  private createEmptyCorrelation(errorType: string, resourcePath: string): PerformanceCorrelation {
    return {
      id: `corr-${errorType}-${resourcePath}-${Date.now()}`,
      errorType,
      resourceMetric: resourcePath,
      correlationStrength: 0,
      pValue: 1,
      timeDelay: 0,
      confidence: 'low',
      description: 'Insufficient data for correlation analysis',
      recommendations: [],
      evidencePoints: []
    };
  }
  
  private calculatePValue(tScore: number, _degreesOfFreedom: number): number {
    // Simplified p-value calculation
    // In production, use a proper statistical library
    const absT = Math.abs(tScore);
    
    if (absT > 2.58) return 0.01; // p < 0.01
    if (absT > 1.96) return 0.05; // p < 0.05
    if (absT > 1.64) return 0.1;  // p < 0.1
    
    return 0.2; // p >= 0.1
  }
  
  private calculateTimeDelay(_alignedData: Array<{ x: number; y: number; timestamp: Date }>): number {
    // Find the optimal time delay by testing different offsets
    // For now, return 0 (no delay)
    return 0;
  }
  
  private generateEvidencePoints(
    alignedData: Array<{ x: number; y: number; timestamp: Date }>,
    _correlationStrength: number
  ): CorrelationEvidence[] {
    // Calculate standard deviation for both metrics
    // const xMean = alignedData.reduce((sum, d) => sum + d.x, 0) / alignedData.length;
    const yMean = alignedData.reduce((sum, d) => sum + d.y, 0) / alignedData.length;
    
    // const xStd = Math.sqrt(
    //   alignedData.reduce((sum, d) => sum + Math.pow(d.x - xMean, 2), 0) / alignedData.length
    // );
    
    return alignedData
      .filter((_, i) => i % 3 === 0) // Sample every 3rd point
      .map(d => ({
        timestamp: d.timestamp,
        errorCount: d.x,
        resourceValue: d.y,
        deviation: Math.abs(d.y - yMean) / Math.max(1, yMean) // Normalized deviation
      }))
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 5); // Top 5 evidence points
  }
  
  private generateCorrelationDescription(
    errorType: string,
    resourcePath: string,
    strength: number
  ): string {
    const direction = strength > 0 ? 'increases' : 'decreases';
    const magnitude = Math.abs(strength);
    
    let intensityWord = 'weak';
    if (magnitude > 0.7) intensityWord = 'strong';
    else if (magnitude > 0.5) intensityWord = 'moderate';
    
    const resourceName = this.getResourceDisplayName(resourcePath);
    
    return `${intensityWord} correlation: ${errorType} ${direction} when ${resourceName} changes`;
  }
  
  private getResourceDisplayName(resourcePath: string): string {
    const names: Record<string, string> = {
      'cpu.usage': 'CPU usage',
      'memory.used': 'memory usage',
      'network.latency': 'network latency',
      'disk.usage': 'disk usage',
      'performance.responseTime': 'response time'
    };
    
    return names[resourcePath] || resourcePath;
  }
  
  private generateCorrelationRecommendations(
    resourcePath: string,
    strength: number
  ): string[] {
    const recommendations: string[] = [];
    const isPositive = strength > 0;
    const isStrong = Math.abs(strength) > 0.7;
    
    switch (resourcePath) {
      case 'cpu.usage':
        if (isPositive && isStrong) {
          recommendations.push('Optimize CPU-intensive operations');
          recommendations.push('Consider implementing CPU usage limits');
          recommendations.push('Add CPU monitoring alerts');
        }
        break;
        
      case 'memory.used':
        if (isPositive && isStrong) {
          recommendations.push('Investigate memory leaks');
          recommendations.push('Implement memory usage monitoring');
          recommendations.push('Consider increasing available memory');
        }
        break;
        
      case 'network.latency':
        if (isPositive && isStrong) {
          recommendations.push('Optimize network requests');
          recommendations.push('Implement request caching');
          recommendations.push('Add network timeout handling');
        }
        break;
        
      case 'disk.usage':
        if (isPositive && isStrong) {
          recommendations.push('Implement disk space monitoring');
          recommendations.push('Add log rotation policies');
          recommendations.push('Consider disk cleanup automation');
        }
        break;
        
      case 'performance.responseTime':
        if (isPositive && isStrong) {
          recommendations.push('Profile and optimize slow operations');
          recommendations.push('Implement performance budgets');
          recommendations.push('Add response time monitoring');
        }
        break;
    }
    
    return recommendations;
  }
  
  private async identifyPerformanceDegradation(): Promise<void> {
    const recentMetrics = this.resourceHistory.slice(-10); // Last 10 measurements
    if (recentMetrics.length < 5) return;
    
    // Calculate baselines from older data
    const baselineMetrics = this.resourceHistory.slice(-60, -10);
    if (baselineMetrics.length < 10) return;
    
    // Check for degradation in key metrics
    const keyMetrics = [
      'performance.responseTime',
      'performance.errorRate',
      'cpu.usage',
      'memory.used'
    ];
    
    for (const metricPath of keyMetrics) {
      const recentValues = recentMetrics.map(m => this.getMetricValue(m, metricPath) || 0);
      const baselineValues = baselineMetrics.map(m => this.getMetricValue(m, metricPath) || 0);
      
      const recentAvg = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
      const baselineAvg = baselineValues.reduce((sum, v) => sum + v, 0) / baselineValues.length;
      
      const degradationPercent = ((recentAvg - baselineAvg) / baselineAvg) * 100;
      
      // Check for significant degradation (>20% increase in negative metrics)
      if (degradationPercent > 20 && this.isNegativeMetric(metricPath)) {
        this.emit('performance:degradation', {
          metric: metricPath,
          degradationPercent,
          current: recentAvg,
          baseline: baselineAvg,
          severity: degradationPercent > 50 ? 'high' : 'medium'
        });
      }
    }
  }
  
  private isNegativeMetric(metricPath: string): boolean {
    // Metrics where higher values are worse
    const negativeMetrics = [
      'performance.responseTime',
      'performance.errorRate',
      'cpu.usage',
      'memory.used',
      'disk.usage',
      'network.latency'
    ];
    
    return negativeMetrics.includes(metricPath);
  }
  
  private async assessResourceImpact(): Promise<void> {
    const currentMetrics = this.resourceHistory[this.resourceHistory.length - 1];
    if (!currentMetrics) return;
    
    // Assess impact of each resource on errors
    for (const [metricPath, threshold] of this.resourceThresholds) {
      const currentValue = this.getMetricValue(currentMetrics, metricPath);
      
      if (currentValue !== null && currentValue > threshold.warningLevel) {
        const impact = this.calculateResourceImpact(metricPath, currentValue, threshold);
        this.impactAssessments.set(metricPath, impact);
      }
    }
  }
  
  private calculateResourceImpact(
    metricPath: string,
    currentValue: number,
    threshold: ResourceThreshold
  ): ResourceImpactAssessment {
    const exceedsWarning = currentValue > threshold.warningLevel;
    const exceedsCritical = currentValue > threshold.criticalLevel;
    
    let impactLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (exceedsCritical) impactLevel = 'critical';
    else if (exceedsWarning) impactLevel = currentValue > threshold.criticalLevel * 0.8 ? 'high' : 'medium';
    
    // Get correlated errors
    const affectedErrors = Array.from(this.correlations.values())
      .filter(c => c.resourceMetric === metricPath && Math.abs(c.correlationStrength) > 0.5)
      .map(c => c.errorType);
    
    // Estimate affected users (simplified)
    const metrics = this.analyticsEngine.getMetrics();
    const affectedUsers = Math.floor(metrics.impactedUsers * (currentValue / 100));
    
    return {
      resource: metricPath,
      impactLevel,
      affectedErrors,
      affectedUsers,
      degradationPeriod: { start: new Date() },
      expectedRecoveryTime: this.estimateRecoveryTime(metricPath, impactLevel),
      mitigation: this.generateMitigationSteps(metricPath, impactLevel)
    };
  }
  
  private estimateRecoveryTime(metricPath: string, impactLevel: string): number {
    // Recovery time estimates in minutes
    const baseTimes: Record<string, number> = {
      'cpu.usage': 5,
      'memory.used': 10,
      'network.latency': 2,
      'disk.usage': 30,
      'performance.responseTime': 3
    };
    
    const multipliers = {
      low: 0.5,
      medium: 1,
      high: 2,
      critical: 4
    };
    
    const baseTime = baseTimes[metricPath] || 5;
    const multiplier = multipliers[impactLevel as keyof typeof multipliers] || 1;
    
    return baseTime * multiplier * 60000; // Convert to milliseconds
  }
  
  private generateMitigationSteps(metricPath: string, impactLevel: string): string[] {
    const steps: string[] = [];
    
    switch (metricPath) {
      case 'cpu.usage':
        steps.push('Identify CPU-intensive processes');
        steps.push('Terminate non-essential processes');
        if (impactLevel === 'critical') {
          steps.push('Scale to additional CPU resources');
        }
        break;
        
      case 'memory.used':
        steps.push('Clear application caches');
        steps.push('Restart memory-intensive services');
        if (impactLevel === 'critical') {
          steps.push('Scale to additional memory');
        }
        break;
        
      case 'network.latency':
        steps.push('Check network connectivity');
        steps.push('Implement request caching');
        steps.push('Switch to backup network path');
        break;
        
      case 'disk.usage':
        steps.push('Clear temporary files');
        steps.push('Archive old log files');
        steps.push('Free up disk space');
        break;
        
      case 'performance.responseTime':
        steps.push('Identify slow operations');
        steps.push('Implement response caching');
        steps.push('Scale application resources');
        break;
    }
    
    return steps;
  }
  
  private async updatePerformanceProfiles(): Promise<void> {
    // Update baseline performance profiles for components
    const components = ['ui', 'api', 'database', 'network', 'storage'];
    
    for (const component of components) {
      const profile = this.calculatePerformanceProfile(component);
      this.performanceProfiles.set(component, profile);
    }
  }
  
  private calculatePerformanceProfile(component: string): PerformanceProfile {
    // Calculate baseline metrics from historical data
    const recentMetrics = this.resourceHistory.slice(-100); // Last 100 measurements
    
    if (recentMetrics.length < 10) {
      return this.createDefaultProfile(component);
    }
    
    const avgResponseTime = recentMetrics.reduce((sum, m) => 
      sum + m.performance.responseTime, 0) / recentMetrics.length;
    const avgCpuUsage = recentMetrics.reduce((sum, m) => 
      sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => 
      sum + (m.memory.used / (m.memory.used + m.memory.available)) * 100, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => 
      sum + m.performance.errorRate, 0) / recentMetrics.length;
    
    return {
      component,
      baselineMetrics: {
        averageResponseTime: avgResponseTime,
        averageCpuUsage: avgCpuUsage,
        averageMemoryUsage: avgMemoryUsage,
        typicalErrorRate: avgErrorRate
      },
      degradationIndicators: {
        responseTimeThreshold: avgResponseTime * 2,
        cpuThreshold: avgCpuUsage * 1.5,
        memoryThreshold: avgMemoryUsage * 1.3,
        errorRateThreshold: avgErrorRate * 3
      },
      correlatedResources: this.getCorrelatedResources(component),
      recommendations: this.generateProfileRecommendations(component)
    };
  }
  
  private createDefaultProfile(component: string): PerformanceProfile {
    return {
      component,
      baselineMetrics: {
        averageResponseTime: 500,
        averageCpuUsage: 30,
        averageMemoryUsage: 40,
        typicalErrorRate: 1
      },
      degradationIndicators: {
        responseTimeThreshold: 2000,
        cpuThreshold: 70,
        memoryThreshold: 80,
        errorRateThreshold: 5
      },
      correlatedResources: [],
      recommendations: []
    };
  }
  
  private getCorrelatedResources(_component: string): string[] {
    // Return resources that correlate with this component's performance
    const correlatedResources = Array.from(this.correlations.values())
      .filter(c => c.confidence !== 'low')
      .map(c => c.resourceMetric);
    
    return [...new Set(correlatedResources)];
  }
  
  private generateProfileRecommendations(component: string): string[] {
    const recommendations: string[] = [];
    
    switch (component) {
      case 'ui':
        recommendations.push('Monitor render performance');
        recommendations.push('Implement UI virtualization for large lists');
        recommendations.push('Optimize bundle size');
        break;
        
      case 'api':
        recommendations.push('Implement API response caching');
        recommendations.push('Add request rate limiting');
        recommendations.push('Monitor endpoint performance');
        break;
        
      case 'database':
        recommendations.push('Optimize database queries');
        recommendations.push('Add connection pooling');
        recommendations.push('Monitor database performance');
        break;
        
      case 'network':
        recommendations.push('Implement retry logic');
        recommendations.push('Add network monitoring');
        recommendations.push('Use CDN for static assets');
        break;
        
      case 'storage':
        recommendations.push('Implement storage monitoring');
        recommendations.push('Add file compression');
        recommendations.push('Use efficient storage formats');
        break;
    }
    
    return recommendations;
  }
  
  private async generateCorrelationInsights(): Promise<void> {
    const insights: string[] = [];
    
    // Identify strongest correlations
    const strongCorrelations = Array.from(this.correlations.values())
      .filter(c => Math.abs(c.correlationStrength) > 0.7)
      .sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength));
    
    if (strongCorrelations.length > 0 && strongCorrelations[0]) {
      const strongest = strongCorrelations[0];
      insights.push(`Strong correlation detected: ${strongest.description}`);
    }
    
    // Check for resource stress
    const currentMetrics = this.resourceHistory[this.resourceHistory.length - 1];
    if (currentMetrics) {
      const stressedResources = Array.from(this.resourceThresholds.entries())
        .filter(([path, threshold]) => {
          const value = this.getMetricValue(currentMetrics, path);
          return value !== null && value > threshold.warningLevel;
        })
        .map(([path]) => this.getResourceDisplayName(path));
      
      if (stressedResources.length > 0) {
        insights.push(`Resource stress detected in: ${stressedResources.join(', ')}`);
      }
    }
    
    this.emit('insights:generated', insights);
  }
  
  // Public API methods
  
  public getCorrelations(): PerformanceCorrelation[] {
    return Array.from(this.correlations.values());
  }
  
  public getStrongestCorrelations(limit: number = 5): PerformanceCorrelation[] {
    return Array.from(this.correlations.values())
      .sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength))
      .slice(0, limit);
  }
  
  public getPerformanceProfiles(): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values());
  }
  
  public getResourceImpacts(): ResourceImpactAssessment[] {
    return Array.from(this.impactAssessments.values());
  }
  
  public getCurrentResourceMetrics(): ResourceMetrics | null {
    return this.resourceHistory[this.resourceHistory.length - 1] || null;
  }
  
  public getResourceHistory(duration: number = 3600000): ResourceMetrics[] {
    const cutoff = new Date(Date.now() - duration);
    return this.resourceHistory.filter(m => m.timestamp >= cutoff);
  }
  
  public getResourceTrend(metricPath: string, duration: number = 3600000): Array<{ timestamp: Date; value: number }> {
    const history = this.getResourceHistory(duration);
    return history.map(m => ({
      timestamp: m.timestamp,
      value: this.getMetricValue(m, metricPath) || 0
    }));
  }
  
  public async generateCorrelationReport(): Promise<any> {
    const correlations = this.getCorrelations();
    const profiles = this.getPerformanceProfiles();
    const impacts = this.getResourceImpacts();
    
    return {
      timestamp: new Date(),
      summary: {
        totalCorrelations: correlations.length,
        strongCorrelations: correlations.filter(c => Math.abs(c.correlationStrength) > 0.7).length,
        activeImpacts: impacts.length,
        degradedComponents: profiles.filter(p => this.isComponentDegraded(p)).length
      },
      correlations: correlations.slice(0, 10), // Top 10
      criticalImpacts: impacts.filter(i => i.impactLevel === 'critical'),
      recommendations: this.generateTopRecommendations(),
      resourceStatus: this.getCurrentResourceStatus()
    };
  }
  
  private isComponentDegraded(profile: PerformanceProfile): boolean {
    const current = this.getCurrentResourceMetrics();
    if (!current) return false;
    
    return (
      current.performance.responseTime > profile.degradationIndicators.responseTimeThreshold ||
      current.cpu.usage > profile.degradationIndicators.cpuThreshold ||
      current.performance.errorRate > profile.degradationIndicators.errorRateThreshold
    );
  }
  
  private generateTopRecommendations(): string[] {
    const allRecommendations = new Set<string>();
    
    // Add recommendations from correlations
    this.correlations.forEach(correlation => {
      correlation.recommendations.forEach(rec => allRecommendations.add(rec));
    });
    
    // Add recommendations from impacts
    this.impactAssessments.forEach(impact => {
      impact.mitigation.forEach(mit => allRecommendations.add(mit));
    });
    
    return Array.from(allRecommendations).slice(0, 5);
  }
  
  private getCurrentResourceStatus(): Record<string, any> {
    const current = this.getCurrentResourceMetrics();
    if (!current) return {};
    
    const status: Record<string, any> = {};
    
    for (const [metricPath, threshold] of this.resourceThresholds) {
      const value = this.getMetricValue(current, metricPath);
      
      if (value !== null) {
        status[metricPath] = {
          value,
          status: value > threshold.criticalLevel ? 'critical' 
                : value > threshold.warningLevel ? 'warning' 
                : 'normal',
          threshold: threshold.warningLevel,
          unit: threshold.unit
        };
      }
    }
    
    return status;
  }
  
  public destroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    
    this.removeAllListeners();
    this.resourceHistory = [];
    this.correlations.clear();
    this.performanceProfiles.clear();
    this.resourceThresholds.clear();
    this.impactAssessments.clear();
  }
}