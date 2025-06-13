import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ErrorMetrics, ErrorPattern, ErrorInsight } from './ErrorAnalyticsEngine';
import { TrendAnalysis, Anomaly, PatternCluster } from './ErrorTrendAnalyzer';
import { UserImpactMetrics, SessionImpactAnalysis, WorkflowImpact } from './UserImpactAssessment';
import { Alert } from '../monitoring/AlertManagementSystem';

export interface StoredAnalyticsData {
  timestamp: Date;
  version: string;
  metrics: ErrorMetrics;
  patterns: ErrorPattern[];
  insights: ErrorInsight[];
  trends: TrendAnalysis[];
  anomalies: Anomaly[];
  clusters: PatternCluster[];
  userImpacts: UserImpactMetrics[];
  sessionAnalyses: SessionImpactAnalysis[];
  workflowImpacts: WorkflowImpact[];
  alerts: Alert[];
}

export interface DataRetentionPolicy {
  raw: number; // Days to keep raw data
  aggregated: number; // Days to keep aggregated data
  reports: number; // Days to keep generated reports
}

export interface QueryOptions {
  startDate?: Date;
  endDate?: Date;
  metrics?: string[];
  aggregation?: 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  limit?: number;
  offset?: number;
}

export interface AggregatedData {
  period: { start: Date; end: Date };
  aggregationType: string;
  metrics: Partial<ErrorMetrics>;
  errorCount: number;
  userCount: number;
  sessionCount: number;
  topErrors: Array<{ message: string; count: number }>;
  averageRecoveryTime: number;
}

export interface DataSnapshot {
  id: string;
  name: string;
  description?: string;
  timestamp: Date;
  dataPath: string;
  size: number;
  metadata: Record<string, any>;
}

export class AnalyticsDataStore extends EventEmitter {
  private readonly dataDir: string;
  private readonly cacheDir: string;
  private readonly snapshotDir: string;
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB per file
  private retentionPolicy: DataRetentionPolicy;
  private compressionEnabled: boolean = true;
  
  private memoryCache: Map<string, any> = new Map();
  private readonly cacheExpiry = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor(
    baseDir: string = './analytics-data',
    retentionPolicy: DataRetentionPolicy = { raw: 30, aggregated: 90, reports: 365 }
  ) {
    super();
    this.dataDir = path.join(baseDir, 'raw');
    this.cacheDir = path.join(baseDir, 'cache');
    this.snapshotDir = path.join(baseDir, 'snapshots');
    this.retentionPolicy = retentionPolicy;
    
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    // Create directories
    await this.ensureDirectories();
    
    // Start cleanup process
    this.startCleanupProcess();
    
    // Load recent data into cache
    await this.warmupCache();
  }
  
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.dataDir, this.cacheDir, this.snapshotDir];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }
  
  private startCleanupProcess(): void {
    // Run cleanup every 6 hours
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 21600000);
    
    // Run initial cleanup
    this.performCleanup();
  }
  
  private async warmupCache(): Promise<void> {
    try {
      // Load last 24 hours of data into cache
      const yesterday = new Date(Date.now() - 86400000);
      const recentData = await this.queryTimeRange(yesterday, new Date());
      
      recentData.forEach(data => {
        const key = this.getCacheKey(data.timestamp);
        this.memoryCache.set(key, {
          data,
          expiry: Date.now() + this.cacheExpiry
        });
      });
    } catch (error) {
      // console.error('Failed to warmup cache:', error);
    }
  }
  
  public async store(data: Partial<StoredAnalyticsData>): Promise<void> {
    const timestamp = data.timestamp || new Date();
    const fullData: StoredAnalyticsData = {
      timestamp,
      version: '1.0',
      metrics: data.metrics || {} as ErrorMetrics,
      patterns: data.patterns || [],
      insights: data.insights || [],
      trends: data.trends || [],
      anomalies: data.anomalies || [],
      clusters: data.clusters || [],
      userImpacts: data.userImpacts || [],
      sessionAnalyses: data.sessionAnalyses || [],
      workflowImpacts: data.workflowImpacts || [],
      alerts: data.alerts || []
    };
    
    try {
      // Store in time-partitioned files
      const filePath = this.getFilePath(timestamp);
      const existingData = await this.loadFile(filePath);
      
      // Append new data
      existingData.push(fullData);
      
      // Check file size and split if necessary
      const dataStr = JSON.stringify(existingData);
      if (dataStr.length > this.maxFileSize) {
        await this.splitDataFile(filePath, existingData);
      } else {
        await this.saveFile(filePath, existingData);
      }
      
      // Update cache
      const cacheKey = this.getCacheKey(timestamp);
      this.memoryCache.set(cacheKey, {
        data: fullData,
        expiry: Date.now() + this.cacheExpiry
      });
      
      // Emit event
      this.emit('data:stored', { timestamp, size: dataStr.length });
      
      // Trigger aggregation if needed
      await this.checkAndAggregate(timestamp);
    } catch (error) {
      // console.error('Failed to store analytics data:', error);
      throw error;
    }
  }
  
  private getFilePath(timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hour = String(timestamp.getHours()).padStart(2, '0');
    
    return path.join(this.dataDir, `${year}`, `${month}`, `${day}`, `data-${hour}.json`);
  }
  
  private getCacheKey(timestamp: Date): string {
    return `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}`;
  }
  
  private async loadFile(filePath: string): Promise<StoredAnalyticsData[]> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  private async saveFile(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    const content = this.compressionEnabled 
      ? await this.compress(JSON.stringify(data))
      : JSON.stringify(data, null, 2);
    
    await fs.writeFile(filePath, content);
  }
  
  private async compress(data: string): Promise<string> {
    // Simple compression using base64 encoding
    // In production, use proper compression like gzip
    return Buffer.from(data).toString('base64');
  }
  
  // private async _decompress(_data: string): Promise<string> {
  //   // Simple decompression
  //   return Buffer.from(_data, 'base64').toString('utf-8');
  // }
  
  private async splitDataFile(filePath: string, data: StoredAnalyticsData[]): Promise<void> {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, '.json');
    
    const chunks = this.chunkArray(data, Math.ceil(data.length / 2));
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(dir, `${basename}-part${i + 1}.json`);
      await this.saveFile(chunkPath, chunks[i]);
    }
    
    // Remove original file
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  public async query(options: QueryOptions = {}): Promise<StoredAnalyticsData[]> {
    const {
      startDate = new Date(Date.now() - 86400000), // Default: last 24 hours
      endDate = new Date(),
      metrics,
      aggregation = 'none',
      limit,
      offset = 0
    } = options;
    
    // Check cache first
    const cacheKey = `query-${startDate.getTime()}-${endDate.getTime()}-${aggregation}`;
    const cached = this.memoryCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    // Load data from files
    const data = await this.queryTimeRange(startDate, endDate);
    
    // Filter by metrics if specified
    let filtered = metrics ? this.filterByMetrics(data, metrics) : data;
    
    // Apply aggregation
    if (aggregation !== 'none') {
      filtered = await this.aggregateData(filtered, aggregation);
    }
    
    // Apply pagination
    if (limit) {
      filtered = filtered.slice(offset, offset + limit);
    }
    
    // Cache result
    this.memoryCache.set(cacheKey, {
      data: filtered,
      expiry: Date.now() + this.cacheExpiry
    });
    
    return filtered;
  }
  
  private async queryTimeRange(startDate: Date, endDate: Date): Promise<StoredAnalyticsData[]> {
    const results: StoredAnalyticsData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const filePath = this.getFilePath(currentDate);
      const dir = path.dirname(filePath);
      
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          if (file.startsWith('data-') && file.endsWith('.json')) {
            const fullPath = path.join(dir, file);
            const data = await this.loadFile(fullPath);
            
            const filtered = data.filter(d => 
              d.timestamp >= startDate && d.timestamp <= endDate
            );
            
            results.push(...filtered);
          }
        }
      } catch (error) {
        // Directory doesn't exist, skip
      }
      
      // Move to next hour
      currentDate.setHours(currentDate.getHours() + 1);
    }
    
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  private filterByMetrics(data: StoredAnalyticsData[], metrics: string[]): StoredAnalyticsData[] {
    return data.map(entry => {
      const filtered: any = {
        timestamp: entry.timestamp,
        version: entry.version
      };
      
      metrics.forEach(metric => {
        if (metric in entry) {
          filtered[metric] = (entry as any)[metric];
        }
      });
      
      return filtered as StoredAnalyticsData;
    });
  }
  
  private async aggregateData(
    data: StoredAnalyticsData[], 
    aggregation: string
  ): Promise<any[]> {
    const groups = this.groupByPeriod(data, aggregation);
    const aggregated: AggregatedData[] = [];
    
    for (const [period, entries] of groups) {
      const agg = this.calculateAggregates(entries, period);
      aggregated.push(agg);
    }
    
    return aggregated;
  }
  
  private groupByPeriod(
    data: StoredAnalyticsData[], 
    aggregation: string
  ): Map<string, StoredAnalyticsData[]> {
    const groups = new Map<string, StoredAnalyticsData[]>();
    
    data.forEach(entry => {
      const key = this.getPeriodKey(entry.timestamp, aggregation);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    });
    
    return groups;
  }
  
  private getPeriodKey(date: Date, aggregation: string): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hour = date.getHours();
    
    switch (aggregation) {
      case 'hourly':
        return `${year}-${month}-${day}-${hour}`;
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly':
        const week = Math.floor(day / 7);
        return `${year}-${month}-w${week}`;
      case 'monthly':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}-${hour}`;
    }
  }
  
  private calculateAggregates(
    entries: StoredAnalyticsData[], 
    periodKey: string
  ): AggregatedData {
    const startTime = Math.min(...entries.map(e => e.timestamp.getTime()));
    const endTime = Math.max(...entries.map(e => e.timestamp.getTime()));
    
    // Aggregate metrics
    const totalErrors = entries.reduce((sum, e) => sum + (e.metrics.totalErrors || 0), 0);
    const totalUsers = new Set(entries.flatMap(e => e.userImpacts.map(u => u.userId))).size;
    const totalSessions = new Set(entries.flatMap(e => e.sessionAnalyses.map(s => s.sessionId))).size;
    
    // Calculate averages
    const avgRecoveryTime = entries.reduce((sum, e) => sum + (e.metrics.meanTimeToRecovery || 0), 0) / entries.length;
    
    // Get top errors
    const errorCounts = new Map<string, number>();
    entries.forEach(entry => {
      Object.entries(entry.metrics.errorsByType || {}).forEach(([type, count]) => {
        errorCounts.set(type, (errorCounts.get(type) || 0) + count);
      });
    });
    
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));
    
    return {
      period: { start: new Date(startTime), end: new Date(endTime) },
      aggregationType: periodKey,
      metrics: {
        totalErrors,
        errorRate: totalErrors / entries.length
      },
      errorCount: totalErrors,
      userCount: totalUsers,
      sessionCount: totalSessions,
      topErrors,
      averageRecoveryTime: avgRecoveryTime
    };
  }
  
  public async createSnapshot(name: string, description?: string): Promise<DataSnapshot> {
    const snapshotId = `snapshot-${Date.now()}`;
    const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);
    
    try {
      // Get current data
      const currentData = await this.query({
        startDate: new Date(Date.now() - 86400000), // Last 24 hours
        endDate: new Date()
      });
      
      // Create snapshot
      const snapshot: DataSnapshot = {
        id: snapshotId,
        name,
        description,
        timestamp: new Date(),
        dataPath: snapshotPath,
        size: 0,
        metadata: {
          dataPoints: currentData.length,
          startDate: currentData[0]?.timestamp,
          endDate: currentData[currentData.length - 1]?.timestamp
        }
      };
      
      // Save snapshot
      await this.saveFile(snapshotPath, {
        snapshot,
        data: currentData
      });
      
      // Get file size
      const stats = await fs.stat(snapshotPath);
      snapshot.size = stats.size;
      
      this.emit('snapshot:created', snapshot);
      return snapshot;
    } catch (error) {
      // console.error('Failed to create snapshot:', error);
      throw error;
    }
  }
  
  public async loadSnapshot(snapshotId: string): Promise<StoredAnalyticsData[]> {
    const snapshotPath = path.join(this.snapshotDir, `${snapshotId}.json`);
    
    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const { data } = JSON.parse(content);
      return data;
    } catch (error) {
      // console.error('Failed to load snapshot:', error);
      throw error;
    }
  }
  
  public async listSnapshots(): Promise<DataSnapshot[]> {
    try {
      const files = await fs.readdir(this.snapshotDir);
      const snapshots: DataSnapshot[] = [];
      
      for (const file of files) {
        if (file.startsWith('snapshot-') && file.endsWith('.json')) {
          const fullPath = path.join(this.snapshotDir, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          const { snapshot } = JSON.parse(content);
          snapshots.push(snapshot);
        }
      }
      
      return snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      // console.error('Failed to list snapshots:', error);
      return [];
    }
  }
  
  private async checkAndAggregate(timestamp: Date): Promise<void> {
    // Check if hourly aggregation is needed
    const currentHour = timestamp.getHours();
    if (timestamp.getMinutes() === 0) {
      await this.performHourlyAggregation(timestamp);
    }
    
    // Check if daily aggregation is needed
    if (currentHour === 0 && timestamp.getMinutes() === 0) {
      await this.performDailyAggregation(timestamp);
    }
  }
  
  private async performHourlyAggregation(timestamp: Date): Promise<void> {
    const hourAgo = new Date(timestamp.getTime() - 3600000);
    const data = await this.queryTimeRange(hourAgo, timestamp);
    
    if (data.length > 0) {
      const aggregated = this.calculateAggregates(data, this.getPeriodKey(timestamp, 'hourly'));
      
      // Store aggregated data
      const aggPath = path.join(this.cacheDir, 'hourly', `${timestamp.getFullYear()}`, `agg-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}.json`);
      await this.saveFile(aggPath, aggregated);
    }
  }
  
  private async performDailyAggregation(timestamp: Date): Promise<void> {
    const dayAgo = new Date(timestamp.getTime() - 86400000);
    const data = await this.queryTimeRange(dayAgo, timestamp);
    
    if (data.length > 0) {
      const aggregated = this.calculateAggregates(data, this.getPeriodKey(timestamp, 'daily'));
      
      // Store aggregated data
      const aggPath = path.join(this.cacheDir, 'daily', `${timestamp.getFullYear()}`, `agg-${timestamp.getMonth()}-${timestamp.getDate()}.json`);
      await this.saveFile(aggPath, aggregated);
    }
  }
  
  private async performCleanup(): Promise<void> {
    try {
      // Clean up old raw data
      await this.cleanupOldData(this.dataDir, this.retentionPolicy.raw);
      
      // Clean up old aggregated data
      await this.cleanupOldData(path.join(this.cacheDir, 'hourly'), this.retentionPolicy.aggregated);
      await this.cleanupOldData(path.join(this.cacheDir, 'daily'), this.retentionPolicy.aggregated);
      
      // Clean up old snapshots
      await this.cleanupOldSnapshots();
      
      // Clean memory cache
      this.cleanMemoryCache();
      
      this.emit('cleanup:complete', { timestamp: new Date() });
    } catch (error) {
      // console.error('Cleanup failed:', error);
    }
  }
  
  private async cleanupOldData(dir: string, retentionDays: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000);
    
    try {
      const years = await fs.readdir(dir);
      
      for (const year of years) {
        const yearPath = path.join(dir, year);
        const yearNum = parseInt(year);
        
        if (yearNum < cutoffDate.getFullYear()) {
          // Remove entire year directory
          await fs.rmdir(yearPath, { recursive: true });
          continue;
        }
        
        const months = await fs.readdir(yearPath);
        
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const monthNum = parseInt(month);
          
          if (yearNum === cutoffDate.getFullYear() && monthNum < cutoffDate.getMonth() + 1) {
            // Remove entire month directory
            await fs.rmdir(monthPath, { recursive: true });
            continue;
          }
          
          // Check individual days
          const days = await fs.readdir(monthPath);
          
          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            const dayNum = parseInt(day);
            
            const fileDate = new Date(yearNum, monthNum - 1, dayNum);
            if (fileDate < cutoffDate) {
              await fs.rmdir(dayPath, { recursive: true });
            }
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist, ignore
    }
  }
  
  private async cleanupOldSnapshots(): Promise<void> {
    const snapshots = await this.listSnapshots();
    const cutoffDate = new Date(Date.now() - this.retentionPolicy.reports * 86400000);
    
    for (const snapshot of snapshots) {
      if (snapshot.timestamp < cutoffDate) {
        try {
          await fs.unlink(snapshot.dataPath);
          this.emit('snapshot:deleted', snapshot);
        } catch (error) {
          // console.error(`Failed to delete snapshot ${snapshot.id}:`, error);
        }
      }
    }
  }
  
  private cleanMemoryCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.memoryCache) {
      if (value.expiry < now) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.memoryCache.delete(key));
  }
  
  public async exportData(
    options: QueryOptions & { format: 'json' | 'csv' }
  ): Promise<string> {
    const data = await this.query(options);
    
    if (options.format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  private convertToCSV(data: StoredAnalyticsData[]): string {
    if (data.length === 0) return '';
    
    // Flatten the data structure for CSV
    const rows = data.map(entry => ({
      timestamp: entry.timestamp,
      totalErrors: entry.metrics.totalErrors,
      errorRate: entry.metrics.errorRate,
      impactedUsers: entry.metrics.impactedUsers,
      impactedSessions: entry.metrics.impactedSessions,
      recoveryRate: entry.metrics.recoveryRate,
      criticalErrors: entry.metrics.errorsBySeverity?.['critical'] || 0,
      patternCount: entry.patterns.length,
      insightCount: entry.insights.length,
      anomalyCount: entry.anomalies.length,
      alertCount: entry.alerts.length
    }));
    
    // Generate CSV header
    const headers = rows[0] ? Object.keys(rows[0]).join(',') : '';
    
    // Generate CSV rows
    const csvRows = rows.map(row => 
      Object.values(row).map(v => 
        typeof v === 'string' && (v as string).includes(',') ? `"${v}"` : v
      ).join(',')
    );
    
    return [headers, ...csvRows].join('\n');
  }
  
  public getStorageStats(): Promise<{ totalSize: number; fileCount: number; oldestData: Date }> {
    return this.calculateStorageStats();
  }
  
  private async calculateStorageStats(): Promise<any> {
    let totalSize = 0;
    let fileCount = 0;
    let oldestData: Date | null = null;
    
    const scanDir = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            fileCount++;
            
            if (!oldestData || stats.mtime < oldestData) {
              oldestData = stats.mtime;
            }
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };
    
    await scanDir(this.dataDir);
    await scanDir(this.cacheDir);
    await scanDir(this.snapshotDir);
    
    return {
      totalSize,
      fileCount,
      oldestData: oldestData || new Date()
    };
  }
  
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.memoryCache.clear();
    this.removeAllListeners();
  }
}