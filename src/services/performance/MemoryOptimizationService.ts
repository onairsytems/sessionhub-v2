import { EventEmitter } from 'events';
import * as v8 from 'v8';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  gcCount: number;
}

interface MemoryLeakDetection {
  isLeaking: boolean;
  growthRate: number; // MB per minute
  confidence: number; // 0-1
  suggestions: string[];
}

interface GarbageCollectionStats {
  type: string;
  duration: number;
  heapBefore: number;
  heapAfter: number;
  reclaimed: number;
}

export class MemoryOptimizationService extends EventEmitter {
  private static instance: MemoryOptimizationService;
  private snapshots: MemorySnapshot[] = [];
  private gcStats: GarbageCollectionStats[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private lastGCCount: number = 0;
  
  // Memory thresholds
  private readonly thresholds = {
    heapUsageWarning: 0.7, // 70% of heap limit
    heapUsageCritical: 0.85, // 85% of heap limit
    growthRateWarning: 5, // 5MB per minute
    growthRateCritical: 10, // 10MB per minute
  };

  // Optimization settings
  private readonly optimizationConfig = {
    enableAggressiveGC: true,
    cacheTimeout: 300000, // 5 minutes
    maxSnapshots: 1000,
    snapshotInterval: 10000, // 10 seconds
  };

  private caches: Map<string, { data: any; timestamp: number }> = new Map();
  private disposables: Set<() => void> = new Set();

  private constructor() {
    super();
    this.setupGCMonitoring();
  }

  static getInstance(): MemoryOptimizationService {
    if (!MemoryOptimizationService.instance) {
      MemoryOptimizationService.instance = new MemoryOptimizationService();
    }
    return MemoryOptimizationService.instance;
  }

  private setupGCMonitoring(): void {
    if (typeof global.gc === 'function') {
      // GC monitoring through performance observer
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'gc') {
            const gcEntry = entry as any;
            this.recordGCStats({
              type: gcEntry.kind,
              duration: entry.duration,
              heapBefore: gcEntry.startTime,
              heapAfter: gcEntry.endTime,
              reclaimed: 0, // Will be calculated
            });
          }
        });
      });
      
      this.gcObserver.observe({ entryTypes: ['gc'] });
    }
  }

  startMonitoring(interval?: number): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    const monitorInterval = interval || this.optimizationConfig.snapshotInterval;

    this.monitoringInterval = setInterval(() => {
      this.captureSnapshot();
      this.performOptimizations();
      this.detectMemoryLeaks();
      this.cleanupOldData();
    }, monitorInterval);

    this.emit('monitoring-started', { interval: monitorInterval });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring-stopped');
  }

  private captureSnapshot(): void {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0,
      rss: memUsage.rss,
      gcCount: this.lastGCCount,
    };

    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots
    if (this.snapshots.length > this.optimizationConfig.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.optimizationConfig.maxSnapshots);
    }

    // Check thresholds
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    const heapUsageRatio = snapshot.heapUsed / heapLimit;

    if (heapUsageRatio > this.thresholds.heapUsageCritical) {
      this.emit('memory-critical', {
        heapUsed: snapshot.heapUsed,
        heapLimit,
        ratio: heapUsageRatio,
      });
      this.performEmergencyCleanup();
    } else if (heapUsageRatio > this.thresholds.heapUsageWarning) {
      this.emit('memory-warning', {
        heapUsed: snapshot.heapUsed,
        heapLimit,
        ratio: heapUsageRatio,
      });
    }
  }

  private performOptimizations(): void {
    // Clear expired caches
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.caches.forEach((value, key) => {
      if (now - value.timestamp > this.optimizationConfig.cacheTimeout) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.caches.delete(key);
      this.emit('cache-cleared', { key });
    });

    // Run disposables
    if (this.disposables.size > 0) {
      this.disposables.forEach(dispose => {
        try {
          dispose();
        } catch (error) {
          this.emit('disposal-error', error);
        }
      });
      this.disposables.clear();
    }

    // Trigger GC if available and needed
    if (this.optimizationConfig.enableAggressiveGC && typeof global.gc === 'function') {
      const currentHeapUsed = process.memoryUsage().heapUsed;
      const heapLimit = v8.getHeapStatistics().heap_size_limit;
      
      if (currentHeapUsed / heapLimit > 0.6) {
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        
        this.emit('gc-triggered', {
          before,
          after,
          reclaimed: before - after,
        });
      }
    }
  }

  private detectMemoryLeaks(): MemoryLeakDetection {
    if (this.snapshots.length < 10) {
      return {
        isLeaking: false,
        growthRate: 0,
        confidence: 0,
        suggestions: ['Not enough data for leak detection'],
      };
    }

    // Calculate growth rate over the last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentSnapshots = this.snapshots.filter(s => s.timestamp > oneMinuteAgo);
    
    if (recentSnapshots.length < 2) {
      return {
        isLeaking: false,
        growthRate: 0,
        confidence: 0,
        suggestions: ['Not enough recent data'],
      };
    }

    const firstSnapshot = recentSnapshots[0];
    const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
    const timeDiff = (lastSnapshot!.timestamp - firstSnapshot!.timestamp) / 1000 / 60; // minutes
    const memoryGrowth = (lastSnapshot!.heapUsed - firstSnapshot!.heapUsed) / 1024 / 1024; // MB
    const growthRate = memoryGrowth / timeDiff; // MB per minute

    // Linear regression for confidence
    const xs = recentSnapshots.map(s => s.timestamp);
    const ys = recentSnapshots.map(s => s.heapUsed);
    const correlation = this.calculateCorrelation(xs, ys);
    const confidence = Math.abs(correlation);

    const isLeaking = growthRate > this.thresholds.growthRateWarning && confidence > 0.7;

    const suggestions: string[] = [];
    if (isLeaking) {
      suggestions.push('Potential memory leak detected');
      suggestions.push('Review event listener cleanup');
      suggestions.push('Check for circular references');
      suggestions.push('Ensure proper disposal of resources');
      
      if (growthRate > this.thresholds.growthRateCritical) {
        suggestions.push('CRITICAL: Consider restarting the application');
      }
    }

    const detection: MemoryLeakDetection = {
      isLeaking,
      growthRate: Math.round(growthRate * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      suggestions,
    };

    if (isLeaking) {
      this.emit('memory-leak-detected', detection);
    }

    return detection;
  }

  private calculateCorrelation(xs: number[], ys: number[]): number {
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((total, x, i) => total + x * ys[i]!, 0);
    const sumX2 = xs.reduce((total, x) => total + x * x, 0);
    const sumY2 = ys.reduce((total, y) => total + y * y, 0);

    const correlation = (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return correlation;
  }

  private performEmergencyCleanup(): void {
    this.emit('emergency-cleanup-started');

    // Clear all caches
    const cacheSize = this.caches.size;
    this.caches.clear();

    // Run all disposables
    const disposableCount = this.disposables.size;
    this.disposables.forEach(dispose => {
      try {
        dispose();
      } catch (error) {
        // Ignore errors during emergency cleanup
      }
    });
    this.disposables.clear();

    // Force garbage collection if available
    if (typeof global.gc === 'function') {
      global.gc();
      global.gc(); // Run twice for thoroughness
    }

    // Clear old snapshots
    this.snapshots = this.snapshots.slice(-10);
    this.gcStats = this.gcStats.slice(-10);

    this.emit('emergency-cleanup-completed', {
      cachesCleared: cacheSize,
      disposablesRun: disposableCount,
    });
  }

  private cleanupOldData(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    // Clean old snapshots
    this.snapshots = this.snapshots.filter(s => s.timestamp > oneHourAgo);
    
    // Clean old GC stats
    this.gcStats = this.gcStats.filter(s => s.duration > 0); // Keep all for now
  }

  private recordGCStats(stats: GarbageCollectionStats): void {
    this.gcStats.push(stats);
    this.lastGCCount++;
    
    if (this.gcStats.length > 100) {
      this.gcStats = this.gcStats.slice(-100);
    }

    this.emit('gc-stats', stats);
  }

  // Public API for memory management
  registerCache(key: string, data: any): void {
    this.caches.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  getCache(key: string): any | null {
    const cached = this.caches.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.optimizationConfig.cacheTimeout) {
      this.caches.delete(key);
      return null;
    }

    // Update timestamp on access
    cached.timestamp = Date.now();
    return cached.data;
  }

  registerDisposable(dispose: () => void): void {
    this.disposables.add(dispose);
  }

  unregisterDisposable(dispose: () => void): void {
    this.disposables.delete(dispose);
  }

  // Memory profiling
  async createHeapSnapshot(): Promise<string> {
    const snapshotStream = v8.getHeapSnapshot();
    const chunks: string[] = [];

    for await (const chunk of snapshotStream) {
      chunks.push(chunk);
    }

    return chunks.join('');
  }

  getMemoryStats(): any {
    const currentUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const detection = this.detectMemoryLeaks();

    return {
      current: {
        heapUsed: Math.round(currentUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(currentUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(currentUsage.external / 1024 / 1024), // MB
        rss: Math.round(currentUsage.rss / 1024 / 1024), // MB
      },
      heap: {
        totalHeapSize: Math.round(heapStats.total_heap_size / 1024 / 1024), // MB
        totalHeapSizeExecutable: Math.round(heapStats.total_heap_size_executable / 1024 / 1024), // MB
        totalPhysicalSize: Math.round(heapStats.total_physical_size / 1024 / 1024), // MB
        totalAvailableSize: Math.round(heapStats.total_available_size / 1024 / 1024), // MB
        usedHeapSize: Math.round(heapStats.used_heap_size / 1024 / 1024), // MB
        heapSizeLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024), // MB
      },
      leakDetection: detection,
      caches: {
        count: this.caches.size,
        totalSize: Array.from(this.caches.values()).reduce((sum, cache) => {
          return sum + JSON.stringify(cache.data).length;
        }, 0),
      },
      gc: {
        count: this.lastGCCount,
        lastStats: this.gcStats.slice(-5),
      },
    };
  }

  // Force optimization
  forceOptimize(): void {
    this.performOptimizations();
    this.cleanupOldData();
    
    if (typeof global.gc === 'function') {
      global.gc();
    }
  }

  // Cleanup
  dispose(): void {
    this.stopMonitoring();
    this.caches.clear();
    this.disposables.forEach(dispose => dispose());
    this.disposables.clear();
    this.snapshots = [];
    this.gcStats = [];
    
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }
    
    this.removeAllListeners();
  }
}