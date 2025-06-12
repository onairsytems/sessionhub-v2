/**
 * Enhanced Connection Monitor
 * Advanced network monitoring with real-time status updates and quality metrics
 */

import { ConnectionMonitor, ServiceStatus } from './ConnectionMonitor';
import { Logger } from '@/src/lib/logging/Logger';

export interface NetworkMetrics {
  latency: number;
  jitter: number;
  packetLoss: number;
  bandwidth: {
    download: number;
    upload: number;
  };
  timestamp: Date;
}

export interface ServiceHealthMetrics {
  availability: number; // Percentage uptime
  averageLatency: number;
  errorRate: number;
  lastError?: string;
  healthScore: number; // 0-100
}

export class EnhancedConnectionMonitor extends ConnectionMonitor {
  private readonly enhancedLogger: Logger;
  private metricsHistory: Map<string, NetworkMetrics[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 100;
  private realtimeCheckInterval?: NodeJS.Timeout;
  private readonly REALTIME_CHECK_INTERVAL = 1000; // 1 second for critical services
  private criticalServices: Set<string> = new Set();
  private serviceHealthMetrics: Map<string, ServiceHealthMetrics> = new Map();

  constructor() {
    super();
    this.enhancedLogger = new Logger('EnhancedConnectionMonitor');
    this.setupRealtimeMonitoring();
  }

  /**
   * Mark a service as critical for real-time monitoring
   */
  markServiceAsCritical(serviceName: string): void {
    this.criticalServices.add(serviceName);
    this.enhancedLogger.info('Service marked as critical', { service: serviceName });
  }

  /**
   * Setup real-time monitoring for critical services
   */
  private setupRealtimeMonitoring(): void {
    this.realtimeCheckInterval = setInterval(() => {
      this.checkCriticalServices();
    }, this.REALTIME_CHECK_INTERVAL);
  }

  /**
   * Check critical services with higher frequency
   */
  private async checkCriticalServices(): Promise<void> {
    const promises = Array.from(this.criticalServices).map(service =>
      this.checkServiceWithMetrics(service)
    );
    await Promise.allSettled(promises);
  }

  /**
   * Enhanced service check with detailed metrics
   */
  private async checkServiceWithMetrics(name: string): Promise<void> {
    const status = await this.checkService(name);
    
    if (status) {
      // Calculate metrics
      const metrics = await this.calculateNetworkMetrics(name, status);
      this.addMetricsToHistory(name, metrics);
      
      // Update health metrics
      this.updateHealthMetrics(name, status, metrics);
      
      // Emit detailed status update
      this.emit('detailedStatusUpdate', {
        service: name,
        status,
        metrics,
        health: this.serviceHealthMetrics.get(name)
      });
    }
  }

  /**
   * Calculate network metrics for a service
   */
  private async calculateNetworkMetrics(
    serviceName: string, 
    status: ServiceStatus
  ): Promise<NetworkMetrics> {
    const history = this.metricsHistory.get(serviceName) || [];
    const latency = status.latency || 0;
    
    // Calculate jitter (variation in latency)
    const recentLatencies = history.slice(-10).map(m => m.latency);
    const jitter = this.calculateJitter(recentLatencies.concat(latency));
    
    // Estimate packet loss based on errors
    const recentStatuses = history.slice(-20);
    const errorCount = recentStatuses.filter(m => m.packetLoss > 0).length;
    const packetLoss = (errorCount / Math.max(recentStatuses.length, 1)) * 100;
    
    // Bandwidth estimation (simplified)
    const bandwidth = await this.estimateBandwidth(serviceName);
    
    return {
      latency,
      jitter,
      packetLoss,
      bandwidth,
      timestamp: new Date()
    };
  }

  /**
   * Calculate jitter from latency measurements
   */
  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;
    
    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalDiff += Math.abs(latencies[i]! - latencies[i - 1]!);
    }
    
    return totalDiff / (latencies.length - 1);
  }

  /**
   * Estimate bandwidth (simplified implementation)
   */
  private async estimateBandwidth(serviceName: string): Promise<{
    download: number;
    upload: number;
  }> {
    // In a real implementation, this would perform actual bandwidth tests
    // For now, return estimated values based on latency
    const status = this.getServiceStatus(serviceName);
    const latency = status?.latency || 1000;
    
    // Rough estimation: lower latency usually means better bandwidth
    const quality = latency < 50 ? 1 : latency < 100 ? 0.8 : latency < 200 ? 0.6 : 0.3;
    
    return {
      download: 100 * quality, // Mbps
      upload: 50 * quality     // Mbps
    };
  }

  /**
   * Add metrics to history
   */
  private addMetricsToHistory(serviceName: string, metrics: NetworkMetrics): void {
    let history = this.metricsHistory.get(serviceName) || [];
    history.push(metrics);
    
    // Keep only recent history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history = history.slice(-this.MAX_HISTORY_SIZE);
    }
    
    this.metricsHistory.set(serviceName, history);
  }

  /**
   * Update health metrics for a service
   */
  private updateHealthMetrics(
    serviceName: string, 
    status: ServiceStatus,
    metrics: NetworkMetrics
  ): void {
    const history = this.metricsHistory.get(serviceName) || [];
    const totalChecks = history.length;
    const successfulChecks = history.filter(m => m.packetLoss === 0).length;
    
    const availability = totalChecks > 0 
      ? (successfulChecks / totalChecks) * 100 
      : 100;
    
    const averageLatency = history.length > 0
      ? history.reduce((sum, m) => sum + m.latency, 0) / history.length
      : 0;
    
    const recentErrors = history.slice(-20).filter(m => m.packetLoss > 0).length;
    const errorRate = recentErrors / Math.max(history.slice(-20).length, 1) * 100;
    
    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= Math.min(30, errorRate * 3); // Error rate impact
    healthScore -= Math.min(30, (averageLatency / 10)); // Latency impact
    healthScore -= Math.min(20, metrics.jitter / 5); // Jitter impact
    healthScore -= Math.min(20, metrics.packetLoss); // Packet loss impact
    healthScore = Math.max(0, Math.round(healthScore));
    
    this.serviceHealthMetrics.set(serviceName, {
      availability,
      averageLatency: Math.round(averageLatency),
      errorRate: Math.round(errorRate * 100) / 100,
      lastError: status.error,
      healthScore
    });
  }

  /**
   * Get detailed metrics for a service
   */
  getServiceMetrics(serviceName: string): {
    current: NetworkMetrics | null;
    history: NetworkMetrics[];
    health: ServiceHealthMetrics | null;
  } {
    const history = this.metricsHistory.get(serviceName) || [];
    const current = history[history.length - 1] || null;
    const health = this.serviceHealthMetrics.get(serviceName) || null;
    
    return { current, history, health };
  }

  /**
   * Get network quality assessment
   */
  getNetworkQuality = (): {
    overall: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
    details: Map<string, 'excellent' | 'good' | 'fair' | 'poor'>;
    recommendations: string[];
  } => {
    const health = this.getHealth();
    
    if (health.overall === 'offline') {
      return {
        overall: 'offline',
        details: new Map(),
        recommendations: ['Check your internet connection']
      };
    }
    
    const details = new Map<string, 'excellent' | 'good' | 'fair' | 'poor'>();
    const recommendations: string[] = [];
    let totalScore = 0;
    let serviceCount = 0;
    
    for (const [name, metrics] of this.serviceHealthMetrics) {
      const score = metrics.healthScore;
      let quality: 'excellent' | 'good' | 'fair' | 'poor';
      
      if (score >= 90) quality = 'excellent';
      else if (score >= 70) quality = 'good';
      else if (score >= 50) quality = 'fair';
      else quality = 'poor';
      
      details.set(name, quality);
      totalScore += score;
      serviceCount++;
      
      // Generate recommendations
      if (metrics.averageLatency > 500) {
        recommendations.push(`High latency detected for ${name}. Consider checking your network.`);
      }
      if (metrics.errorRate > 10) {
        recommendations.push(`${name} experiencing connection errors. May affect functionality.`);
      }
    }
    
    const averageScore = serviceCount > 0 ? totalScore / serviceCount : 0;
    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (averageScore >= 90) overall = 'excellent';
    else if (averageScore >= 70) overall = 'good';
    else if (averageScore >= 50) overall = 'fair';
    else overall = 'poor';
    
    return { overall, details, recommendations };
  }

  /**
   * Predict connection stability
   */
  predictStability = (): {
    stable: boolean;
    confidence: number;
    prediction: string;
  } => {
    // Analyze recent metrics to predict stability
    const allMetrics: NetworkMetrics[] = [];
    for (const history of this.metricsHistory.values()) {
      allMetrics.push(...history.slice(-20));
    }
    
    if (allMetrics.length < 10) {
      return {
        stable: true,
        confidence: 0.5,
        prediction: 'Insufficient data for prediction'
      };
    }
    
    // Calculate stability metrics
    const recentLatencies = allMetrics.map(m => m.latency);
    const latencyVariance = this.calculateVariance(recentLatencies);
    const recentPacketLoss = allMetrics.map(m => m.packetLoss);
    const avgPacketLoss = recentPacketLoss.reduce((a, b) => a + b, 0) / recentPacketLoss.length;
    
    // Determine stability
    const stable = latencyVariance < 100 && avgPacketLoss < 5;
    const confidence = Math.min(0.95, allMetrics.length / 50);
    
    let prediction = stable 
      ? 'Connection is stable and reliable'
      : 'Connection may experience issues';
    
    if (latencyVariance > 200) {
      prediction += '. High latency variation detected.';
    }
    if (avgPacketLoss > 10) {
      prediction += '. Significant packet loss observed.';
    }
    
    return { stable, confidence, prediction };
  }

  /**
   * Calculate variance of numbers
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Export detailed metrics report
   */
  exportDetailedReport(): {
    timestamp: Date;
    services: Array<{
      name: string;
      status: ServiceStatus;
      metrics: NetworkMetrics | null;
      health: ServiceHealthMetrics | null;
    }>;
    networkQuality: ReturnType<EnhancedConnectionMonitor['getNetworkQuality']>;
    stability: ReturnType<EnhancedConnectionMonitor['predictStability']>;
  } {
    const services = [];
    
    for (const [name, status] of this.services) {
      const { current, health } = this.getServiceMetrics(name);
      services.push({
        name,
        status,
        metrics: current,
        health
      });
    }
    
    return {
      timestamp: new Date(),
      services,
      networkQuality: this.getNetworkQuality(),
      stability: this.predictStability()
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.realtimeCheckInterval) {
      clearInterval(this.realtimeCheckInterval);
    }
    this.stop();
  }
}