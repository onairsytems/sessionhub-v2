import { ScaleTestingService } from '../services/performance/ScaleTestingService';
import { OptimizedDocumentAnalyzer } from '../services/performance/OptimizedDocumentAnalyzer';
import { MemoryOptimizationService } from '../services/performance/MemoryOptimizationService';
import { AppleSiliconOptimization } from '../services/mac/AppleSiliconOptimization';
import { SQLiteOptimizationService } from '../services/database/SQLiteOptimizationService';

export interface ProductionOptimizationConfig {
  performance: {
    enableAppleSiliconOptimization: boolean;
    memoryManagement: {
      enableAggressiveGC: boolean;
      cacheTimeout: number;
      heapSizeLimit: number;
    };
    documentAnalysis: {
      maxConcurrentAnalyses: number;
      chunkSize: number;
      enableParallelProcessing: boolean;
    };
    database: {
      cacheSize: number;
      walMode: boolean;
      mmapSize: number;
    };
  };
  monitoring: {
    enablePerformanceMonitoring: boolean;
    enableMemoryMonitoring: boolean;
    enablePowerMonitoring: boolean;
    monitoringInterval: number;
  };
  scaleLimits: {
    maxConcurrentSessions: number;
    maxDocumentSizeMB: number;
    maxCodebaseFiles: number;
    maxSessionHistoryEntries: number;
  };
}

export const PRODUCTION_OPTIMIZATIONS: ProductionOptimizationConfig = {
  performance: {
    enableAppleSiliconOptimization: true,
    memoryManagement: {
      enableAggressiveGC: true,
      cacheTimeout: 300000, // 5 minutes
      heapSizeLimit: 4096, // 4GB
    },
    documentAnalysis: {
      maxConcurrentAnalyses: 4,
      chunkSize: 65536, // 64KB
      enableParallelProcessing: true,
    },
    database: {
      cacheSize: 50000, // ~400MB
      walMode: true,
      mmapSize: 1073741824, // 1GB
    },
  },
  monitoring: {
    enablePerformanceMonitoring: true,
    enableMemoryMonitoring: true,
    enablePowerMonitoring: true,
    monitoringInterval: 10000, // 10 seconds
  },
  scaleLimits: {
    maxConcurrentSessions: 20,
    maxDocumentSizeMB: 100,
    maxCodebaseFiles: 10000,
    maxSessionHistoryEntries: 10000,
  },
};

export class ProductionOptimizationManager {
  private static instance: ProductionOptimizationManager;
  private scaleTestingService!: ScaleTestingService;
  private documentAnalyzer!: OptimizedDocumentAnalyzer;
  private memoryService!: MemoryOptimizationService;
  private siliconOptimization!: AppleSiliconOptimization;
  private sqliteService!: SQLiteOptimizationService;
  private config: ProductionOptimizationConfig;

  private constructor() {
    this.config = PRODUCTION_OPTIMIZATIONS;
    this.initializeServices();
  }

  static getInstance(): ProductionOptimizationManager {
    if (!ProductionOptimizationManager.instance) {
      ProductionOptimizationManager.instance = new ProductionOptimizationManager();
    }
    return ProductionOptimizationManager.instance;
  }

  private initializeServices(): void {
    this.scaleTestingService = ScaleTestingService.getInstance();
    this.documentAnalyzer = OptimizedDocumentAnalyzer.getInstance();
    this.memoryService = MemoryOptimizationService.getInstance();
    this.siliconOptimization = AppleSiliconOptimization.getInstance();
    this.sqliteService = SQLiteOptimizationService.getInstance();
  }

  async initialize(): Promise<void> {
// REMOVED: console statement

    // Apply database optimizations
    if (this.config.performance.database.walMode) {
      this.sqliteService.applyOptimizations({
        pageSize: 8192,
        cacheSize: this.config.performance.database.cacheSize,
        journalMode: 'WAL',
        synchronous: 'NORMAL',
        tempStore: 'MEMORY',
        mmapSize: this.config.performance.database.mmapSize,
        busyTimeout: 5000,
        walAutocheckpoint: 1000,
      });
    }

    // Start monitoring services
    if (this.config.monitoring.enablePerformanceMonitoring) {
      this.scaleTestingService.startMonitoring(this.config.monitoring.monitoringInterval);
    }

    if (this.config.monitoring.enableMemoryMonitoring) {
      this.memoryService.startMonitoring(this.config.monitoring.monitoringInterval);
    }

    // Apply Apple Silicon optimizations
    if (this.config.performance.enableAppleSiliconOptimization) {
      await this.siliconOptimization.setPerformanceProfile('balanced');
      await this.siliconOptimization.optimizeUnifiedMemory();
      
      if (this.config.monitoring.enablePowerMonitoring) {
        await this.siliconOptimization.startPowerMonitoring(this.config.monitoring.monitoringInterval);
      }
    }

    // Setup memory optimization handlers
    this.setupMemoryOptimizationHandlers();

    // Setup performance monitoring handlers
    this.setupPerformanceHandlers();

// REMOVED: console statement
  }

  private setupMemoryOptimizationHandlers(): void {
    // Handle memory warnings
    this.memoryService.on('memory-warning', (_data) => {
// REMOVED: console statement
      // Switch to efficiency mode
      if (this.config.performance.enableAppleSiliconOptimization) {
        this.siliconOptimization.setPerformanceProfile('efficiency');
      }
    });

    // Handle critical memory situations
    this.memoryService.on('memory-critical', async (_data) => {
// REMOVED: console statement
      // Emergency cleanup
      this.memoryService.forceOptimize();
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });

    // Handle memory leak detection
    this.memoryService.on('memory-leak-detected', (_detection) => {
// REMOVED: console statement
      // Log to monitoring service
    });
  }

  private setupPerformanceHandlers(): void {
    // Handle slow queries
    this.sqliteService.on('slow-query', (_data) => {
// REMOVED: console statement
    });

    // Handle thermal throttling
    this.siliconOptimization.on('thermal-throttling', (_metrics) => {
// REMOVED: console statement
    });

    // Handle document analysis completion
    this.documentAnalyzer.on('analysis-complete', (_result) => {
// REMOVED: console statement
    });
  }

  async optimizeForWorkload(workloadType: 'development' | 'analysis' | 'building' | 'testing'): Promise<void> {
    switch (workloadType) {
      case 'development':
        await this.siliconOptimization.setPerformanceProfile('balanced');
        await this.siliconOptimization.optimizeForWorkload('cpu-intensive');
        break;

      case 'analysis':
        await this.siliconOptimization.setPerformanceProfile('performance');
        await this.siliconOptimization.optimizeForWorkload('memory-intensive');
        break;

      case 'building':
        await this.siliconOptimization.setPerformanceProfile('performance');
        await this.siliconOptimization.optimizeForWorkload('io-intensive');
        break;

      case 'testing':
        await this.siliconOptimization.setPerformanceProfile('balanced');
        await this.siliconOptimization.optimizeForWorkload('cpu-intensive');
        break;
    }
  }

  async getPerformanceReport(): Promise<any> {
    const memoryStats = this.memoryService.getMemoryStats();
    const dbHealth = await this.sqliteService.getDatabaseHealth();
    const perfReport = this.scaleTestingService.generatePerformanceReport();

    return {
      timestamp: new Date().toISOString(),
      memory: memoryStats,
      database: dbHealth,
      performance: perfReport,
      recommendations: await this.siliconOptimization.getOptimizationRecommendations(),
    };
  }

  async runHealthCheck(): Promise<boolean> {
    const memoryStats = this.memoryService.getMemoryStats();
    const dbHealth = await this.sqliteService.getDatabaseHealth();

    // Check memory health
    if (memoryStats.leakDetection.isLeaking) {
// REMOVED: console statement
      return false;
    }

    if (memoryStats.current.heapUsed > this.config.performance.memoryManagement.heapSizeLimit * 0.9) {
// REMOVED: console statement
      return false;
    }

    // Check database health
    if (dbHealth.fragmentationRatio > 0.3) {
// REMOVED: console statement
      await this.sqliteService.performMaintenance();
    }

    return true;
  }

  async shutdown(): Promise<void> {
// REMOVED: console statement

    // Stop all monitoring
    this.scaleTestingService.stopMonitoring();
    this.memoryService.stopMonitoring();
    this.siliconOptimization.stopPowerMonitoring();
    this.sqliteService.stopHealthMonitoring();

    // Cleanup resources
    this.documentAnalyzer.dispose();
    this.memoryService.dispose();
    this.siliconOptimization.dispose();
    this.sqliteService.close();

// REMOVED: console statement
  }
}

// Export singleton instance
export const productionOptimizations = ProductionOptimizationManager.getInstance();