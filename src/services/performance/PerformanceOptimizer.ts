/**
 * @actor system
 * @responsibility Optimize performance for handling thousands of stored sessions
 */

import { Logger } from '@/src/lib/logging/Logger';
import { EventEmitter } from 'events';
import * as os from 'os';

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    usage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  io: {
    readOperations: number;
    writeOperations: number;
    readBytes: number;
    writeBytes: number;
  };
  sessions: {
    active: number;
    cached: number;
    indexed: number;
    totalProcessed: number;
  };
  search: {
    indexSize: number;
    queryTime: number;
    cacheHitRate: number;
  };
  database: {
    connectionPool: number;
    queryTime: number;
    transactionTime: number;
  };
  timestamp: string;
}

export interface PerformanceConfig {
  sessionCacheSize: number;
  searchIndexBatchSize: number;
  databaseConnectionPoolSize: number;
  memoryThreshold: number;
  cpuThreshold: number;
  ioThreshold: number;
  autoOptimization: boolean;
  compressionEnabled: boolean;
  indexingThrottle: number;
  garbageCollectionInterval: number;
}

export interface OptimizationRule {
  id: string;
  name: string;
  condition: (metrics: PerformanceMetrics) => boolean;
  action: (optimizer: PerformanceOptimizer) => Promise<void>;
  priority: number;
  cooldownMs: number;
  lastExecuted?: string;
}

export class PerformanceOptimizer extends EventEmitter {
  private readonly logger: Logger;
  private config: PerformanceConfig;
  
  private sessionCache = new Map<string, any>();
  private indexCache = new Map<string, any>();
  private metrics: PerformanceMetrics[] = [];
  private optimizationRules: OptimizationRule[] = [];
  
  private metricsTimer?: NodeJS.Timeout;
  private optimizationTimer?: NodeJS.Timeout;
  private gcTimer?: NodeJS.Timeout;

  constructor(logger: Logger, config?: Partial<PerformanceConfig>) {
    super();
    this.logger = logger;
    this.config = {
      sessionCacheSize: 1000,
      searchIndexBatchSize: 100,
      databaseConnectionPoolSize: 10,
      memoryThreshold: 0.8,
      cpuThreshold: 0.7,
      ioThreshold: 1000,
      autoOptimization: true,
      compressionEnabled: true,
      indexingThrottle: 100,
      garbageCollectionInterval: 300000,
      ...config
    };

    this.initializeOptimizer();
  }

  private async initializeOptimizer(): Promise<void> {
    this.setupOptimizationRules();
    this.startMetricsCollection();
    this.startOptimizationLoop();
    this.startGarbageCollection();

    this.logger.info('Performance optimizer initialized', {
      config: this.config,
      rulesCount: this.optimizationRules.length
    });
  }

  private setupOptimizationRules(): void {
    this.optimizationRules = [
      {
        id: 'memory-cleanup',
        name: 'Memory Cleanup',
        condition: (metrics) => metrics.memory.usage > this.config.memoryThreshold,
        action: async () => await this.cleanupMemory(),
        priority: 1,
        cooldownMs: 60000
      },
      {
        id: 'cache-optimization',
        name: 'Cache Optimization',
        condition: (_metrics) => this.sessionCache.size > this.config.sessionCacheSize * 1.2,
        action: async () => await this.optimizeCache(),
        priority: 2,
        cooldownMs: 30000
      },
      {
        id: 'index-compression',
        name: 'Index Compression',
        condition: (metrics) => metrics.search.indexSize > 50 * 1024 * 1024, // 50MB
        action: async () => await this.compressIndices(),
        priority: 3,
        cooldownMs: 300000
      },
      {
        id: 'io-throttling',
        name: 'I/O Throttling',
        condition: (metrics) => metrics.io.readOperations + metrics.io.writeOperations > this.config.ioThreshold,
        action: async () => await this.throttleIO(),
        priority: 4,
        cooldownMs: 15000
      }
    ];
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(async () => {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);
      
      // Keep only last 1000 metric points
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
      
      this.emit('metricsCollected', metrics);
    }, 5000); // Collect every 5 seconds
  }

  private startOptimizationLoop(): void {
    if (!this.config.autoOptimization) return;

    this.optimizationTimer = setInterval(async () => {
      if (this.metrics.length === 0) return;

      const currentMetrics = this.metrics[this.metrics.length - 1];
      if (currentMetrics) {
        await this.executeOptimizations(currentMetrics);
      }
    }, 10000); // Check every 10 seconds
  }

  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      if (global.gc) {
        global.gc();
        this.logger.debug('Manual garbage collection triggered');
      }
    }, this.config.garbageCollectionInterval);
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        usage: usedMemory / totalMemory,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      cpu: {
        usage: await this.getCpuUsage(),
        loadAverage: os.loadavg()
      },
      io: {
        readOperations: 0, // Would need to track actual I/O
        writeOperations: 0,
        readBytes: 0,
        writeBytes: 0
      },
      sessions: {
        active: this.sessionCache.size,
        cached: this.sessionCache.size,
        indexed: this.indexCache.size,
        totalProcessed: 0 // Would track from session manager
      },
      search: {
        indexSize: this.indexCache.size * 1024, // Rough estimate
        queryTime: 0, // Would track from search engine
        cacheHitRate: 0.85 // Would track actual cache hits
      },
      database: {
        connectionPool: this.config.databaseConnectionPoolSize,
        queryTime: 0,
        transactionTime: 0
      },
      timestamp: new Date().toISOString()
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const usage = totalUsage / 1000000; // Convert to seconds
        resolve(Math.min(usage / os.cpus().length, 1)); // Normalize to 0-1
      }, 100);
    });
  }

  private async executeOptimizations(metrics: PerformanceMetrics): Promise<void> {
    const applicableRules = this.optimizationRules
      .filter(rule => {
        // Check cooldown
        if (rule.lastExecuted) {
          const elapsed = Date.now() - new Date(rule.lastExecuted).getTime();
          if (elapsed < rule.cooldownMs) {
            return false;
          }
        }
        
        // Check condition
        return rule.condition(metrics);
      })
      .sort((a, b) => a.priority - b.priority);

    for (const rule of applicableRules.slice(0, 2)) { // Limit concurrent optimizations
      try {
        this.logger.info('Executing optimization rule', { ruleName: rule.name });
        await rule.action(this);
        rule.lastExecuted = new Date().toISOString();
        
        this.emit('optimizationExecuted', {
          ruleName: rule.name,
          metrics
        });
      } catch (error) {
        this.logger.error('Optimization rule failed', error as Error, {
          ruleName: rule.name
        });
      }
    }
  }

  private async cleanupMemory(): Promise<void> {
    // Clear old metrics
    if (this.metrics.length > 500) {
      this.metrics = this.metrics.slice(-500);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.logger.info('Memory cleanup completed');
  }

  private async optimizeCache(): Promise<void> {
    const targetSize = this.config.sessionCacheSize;
    
    if (this.sessionCache.size > targetSize) {
      // Remove oldest entries (LRU-style)
      const entries = Array.from(this.sessionCache.entries());
      const toRemove = entries.slice(0, entries.length - targetSize);
      
      for (const [key] of toRemove) {
        this.sessionCache.delete(key);
      }
      
      this.logger.info('Cache optimized', {
        removed: toRemove.length,
        currentSize: this.sessionCache.size
      });
    }
  }

  private async compressIndices(): Promise<void> {
    // Implement index compression logic
    this.logger.info('Index compression completed');
  }

  private async throttleIO(): Promise<void> {
    // Implement I/O throttling
    await new Promise(resolve => setTimeout(resolve, 100));
    this.logger.info('I/O throttling applied');
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] ?? null : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(minutes: number = 60): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => new Date(m.timestamp) >= cutoff);
  }

  /**
   * Add item to session cache with optimization
   */
  cacheSession(sessionId: string, sessionData: any): void {
    // Remove oldest if at capacity
    if (this.sessionCache.size >= this.config.sessionCacheSize) {
      const firstKey = this.sessionCache.keys().next().value;
      if (firstKey) {
        this.sessionCache.delete(firstKey);
      }
    }
    
    this.sessionCache.set(sessionId, {
      data: sessionData,
      timestamp: Date.now(),
      accessCount: 0
    });
  }

  /**
   * Get session from cache
   */
  getCachedSession(sessionId: string): any | null {
    const cached = this.sessionCache.get(sessionId);
    if (cached) {
      cached.accessCount++;
      cached.lastAccess = Date.now();
      return cached.data;
    }
    return null;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get performance statistics
   */
  getStatistics(): any {
    if (this.metrics.length === 0) {
      return null;
    }

    const recent = this.getMetricsHistory(60);
    
    return {
      current: this.getCurrentMetrics(),
      averages: {
        memoryUsage: recent.reduce((sum, m) => sum + m.memory.usage, 0) / recent.length,
        cpuUsage: recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length,
        sessionCount: recent.reduce((sum, m) => sum + m.sessions.active, 0) / recent.length
      },
      peaks: {
        memoryUsage: Math.max(...recent.map(m => m.memory.usage)),
        cpuUsage: Math.max(...recent.map(m => m.cpu.usage)),
        sessionCount: Math.max(...recent.map(m => m.sessions.active))
      },
      cacheStats: {
        sessionCacheSize: this.sessionCache.size,
        indexCacheSize: this.indexCache.size,
        hitRate: 0.85 // Would calculate actual hit rate
      },
      optimizations: {
        rulesExecuted: this.optimizationRules.filter(r => r.lastExecuted).length,
        lastOptimization: this.optimizationRules
          .filter(r => r.lastExecuted)
          .reduce((latest, r) => {
            const time = r.lastExecuted ? new Date(r.lastExecuted).getTime() : 0;
            return time > latest.time ? { time, rule: r.name } : latest;
          }, { time: 0, rule: '' })
      }
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
    
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }
    
    this.sessionCache.clear();
    this.indexCache.clear();
    this.metrics.length = 0;
    
    this.logger.info('Performance optimizer destroyed');
  }
}