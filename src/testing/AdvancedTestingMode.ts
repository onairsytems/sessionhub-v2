/**
 * Advanced Testing Mode for SessionHub
 * Provides enhanced debugging capabilities, performance monitoring, and detailed diagnostics
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

export interface TestingModeConfig {
  enabled: boolean;
  debugLevel: 'minimal' | 'standard' | 'verbose' | 'trace';
  performanceMonitoring: boolean;
  memoryProfiling: boolean;
  networkTracing: boolean;
  errorStackTraces: boolean;
  timingAnalysis: boolean;
  isolationMode: boolean;
  testDataPath?: string;
}

export interface DiagnosticInfo {
  timestamp: number;
  type: 'performance' | 'memory' | 'error' | 'network' | 'system';
  level: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  data?: any;
  stack?: string;
  metrics?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

export interface TestExecutionContext {
  testId: string;
  testName: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  diagnostics: DiagnosticInfo[];
  performanceMarks: Map<string, number>;
  memorySnapshots: Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
  }>;
  errorLog: Error[];
}

export class AdvancedTestingMode extends EventEmitter {
  private static instance: AdvancedTestingMode;
  private config: TestingModeConfig;
  private activeContexts: Map<string, TestExecutionContext> = new Map();
  private diagnosticsBuffer: DiagnosticInfo[] = [];
  private performanceObserver?: PerformanceObserver;
  private memoryInterval?: NodeJS.Timeout;
  private testDataManager: TestDataManager;

  private constructor(config: TestingModeConfig) {
    super();
    this.config = config;
    this.testDataManager = new TestDataManager(config.testDataPath || './test-data');
    
    if (config.enabled) {
      this.initialize();
    }
  }

  static getInstance(config?: TestingModeConfig): AdvancedTestingMode {
    if (!AdvancedTestingMode.instance) {
      AdvancedTestingMode.instance = new AdvancedTestingMode(
        config || {
          enabled: false,
          debugLevel: 'standard',
          performanceMonitoring: true,
          memoryProfiling: true,
          networkTracing: true,
          errorStackTraces: true,
          timingAnalysis: true,
          isolationMode: true
        }
      );
    }
    return AdvancedTestingMode.instance;
  }

  private initialize(): void {
    this.setupPerformanceMonitoring();
    this.setupMemoryProfiling();
    this.setupErrorCapture();
    this.setupNetworkTracing();
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.recordDiagnostic({
          timestamp: Date.now(),
          type: 'performance',
          level: 'info',
          category: 'performance-mark',
          message: `Performance mark: ${entry.name}`,
          data: {
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
            entryType: entry.entryType
          }
        });
      });
    });

    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'mark', 'navigation', 'resource'] 
    });
  }

  private setupMemoryProfiling(): void {
    if (!this.config.memoryProfiling) return;

    this.memoryInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.recordDiagnostic({
        timestamp: Date.now(),
        type: 'memory',
        level: 'info',
        category: 'memory-snapshot',
        message: 'Memory usage snapshot',
        data: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          arrayBuffers: usage.arrayBuffers,
          rss: usage.rss
        }
      });
    }, 5000); // Every 5 seconds
  }

  private setupErrorCapture(): void {
    if (!this.config.errorStackTraces) return;

    process.on('unhandledRejection', (reason, promise) => {
      this.recordDiagnostic({
        timestamp: Date.now(),
        type: 'error',
        level: 'critical',
        category: 'unhandled-rejection',
        message: 'Unhandled Promise Rejection',
        data: { reason, promise },
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });

    process.on('uncaughtException', (error) => {
      this.recordDiagnostic({
        timestamp: Date.now(),
        type: 'error',
        level: 'critical',
        category: 'uncaught-exception',
        message: 'Uncaught Exception',
        data: { error },
        stack: error.stack
      });
    });
  }

  private setupNetworkTracing(): void {
    // Network tracing implementation would go here
    // This would integrate with HTTP libraries to trace requests
  }

  public startTestContext(testId: string, testName: string): TestExecutionContext {
    const context: TestExecutionContext = {
      testId,
      testName,
      startTime: Date.now(),
      status: 'running',
      diagnostics: [],
      performanceMarks: new Map(),
      memorySnapshots: [],
      errorLog: []
    };

    this.activeContexts.set(testId, context);
    this.emit('test:start', context);

    if (this.config.debugLevel === 'verbose' || this.config.debugLevel === 'trace') {
      this.recordDiagnostic({
        timestamp: Date.now(),
        type: 'system',
        level: 'info',
        category: 'test-start',
        message: `Starting test: ${testName}`,
        data: { testId, testName }
      });
    }

    return context;
  }

  public endTestContext(testId: string, status: 'passed' | 'failed' | 'skipped'): void {
    const context = this.activeContexts.get(testId);
    if (!context) return;

    context.endTime = Date.now();
    context.status = status;

    const duration = context.endTime - context.startTime;
    
    this.recordDiagnostic({
      timestamp: Date.now(),
      type: 'performance',
      level: status === 'failed' ? 'error' : 'info',
      category: 'test-complete',
      message: `Test ${status}: ${context.testName}`,
      data: {
        testId,
        duration,
        status,
        diagnosticCount: context.diagnostics.length,
        errorCount: context.errorLog.length
      }
    });

    this.emit('test:end', context);
    
    // Archive context for analysis
    this.archiveTestContext(context);
    
    this.activeContexts.delete(testId);
  }

  public recordDiagnostic(diagnostic: DiagnosticInfo): void {
    // Add to buffer
    this.diagnosticsBuffer.push(diagnostic);
    
    // Add to active contexts
    this.activeContexts.forEach((context) => {
      context.diagnostics.push(diagnostic);
    });

    // Emit for real-time monitoring
    this.emit('diagnostic', diagnostic);

    // Log based on debug level
    if (this.shouldLog(diagnostic)) {
      this.logDiagnostic(diagnostic);
    }
  }

  private shouldLog(diagnostic: DiagnosticInfo): boolean {
    const levels = {
      minimal: ['critical'],
      standard: ['critical', 'error'],
      verbose: ['critical', 'error', 'warning'],
      trace: ['critical', 'error', 'warning', 'info']
    };

    return levels[this.config.debugLevel].includes(diagnostic.level);
  }

  private logDiagnostic(_diagnostic: DiagnosticInfo): void {
    // Logging has been removed. 
    // TODO: Implement proper logging mechanism if needed (e.g., using a logging library like winston or pino)
  }

  private archiveTestContext(context: TestExecutionContext): void {
    const archivePath = path.join(
      this.testDataManager.getArchivePath(),
      `test-${context.testId}-${Date.now()}.json`
    );

    fs.writeFileSync(archivePath, JSON.stringify(context, null, 2));
  }

  public mark(name: string): void {
    if (!this.config.timingAnalysis) return;
    performance.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): void {
    if (!this.config.timingAnalysis) return;
    
    try {
      performance.measure(name, startMark, endMark);
    } catch (error) {
      this.recordDiagnostic({
        timestamp: Date.now(),
        type: 'error',
        level: 'warning',
        category: 'performance-measure',
        message: `Failed to measure ${name}`,
        data: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  public captureMemorySnapshot(label: string): void {
    if (!this.config.memoryProfiling) return;

    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      label,
      usage
    };

    this.activeContexts.forEach((context) => {
      context.memorySnapshots.push({
        timestamp: snapshot.timestamp,
        usage: snapshot.usage
      });
    });

    this.recordDiagnostic({
      timestamp: Date.now(),
      type: 'memory',
      level: 'info',
      category: 'memory-capture',
      message: `Memory snapshot: ${label}`,
      data: snapshot
    });
  }

  public getTestDataManager(): TestDataManager {
    return this.testDataManager;
  }

  public getActiveTests(): TestExecutionContext[] {
    return Array.from(this.activeContexts.values());
  }

  public getDiagnosticsBuffer(): DiagnosticInfo[] {
    return [...this.diagnosticsBuffer];
  }

  public clearDiagnosticsBuffer(): void {
    this.diagnosticsBuffer = [];
  }

  public cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
    this.activeContexts.clear();
    this.diagnosticsBuffer = [];
  }
}

/**
 * Test Data Manager for handling test data lifecycle
 */
export class TestDataManager {
  private basePath: string;
  private activeSandboxes: Map<string, string> = new Map();

  constructor(basePath: string) {
    this.basePath = basePath;
    this.ensureDirectoryExists(basePath);
    this.ensureDirectoryExists(path.join(basePath, 'sandboxes'));
    this.ensureDirectoryExists(path.join(basePath, 'archives'));
    this.ensureDirectoryExists(path.join(basePath, 'fixtures'));
  }

  public createSandbox(testId: string): string {
    const sandboxPath = path.join(this.basePath, 'sandboxes', testId);
    this.ensureDirectoryExists(sandboxPath);
    this.activeSandboxes.set(testId, sandboxPath);
    return sandboxPath;
  }

  public cleanupSandbox(testId: string): void {
    const sandboxPath = this.activeSandboxes.get(testId);
    if (sandboxPath && fs.existsSync(sandboxPath)) {
      fs.rmSync(sandboxPath, { recursive: true, force: true });
      this.activeSandboxes.delete(testId);
    }
  }

  public cleanupAllSandboxes(): void {
    this.activeSandboxes.forEach((_, testId) => {
      this.cleanupSandbox(testId);
    });
  }

  public getFixturePath(fixtureName: string): string {
    return path.join(this.basePath, 'fixtures', fixtureName);
  }

  public getArchivePath(): string {
    return path.join(this.basePath, 'archives');
  }

  public reset(): void {
    this.cleanupAllSandboxes();
    const sandboxesPath = path.join(this.basePath, 'sandboxes');
    if (fs.existsSync(sandboxesPath)) {
      fs.readdirSync(sandboxesPath).forEach(file => {
        fs.rmSync(path.join(sandboxesPath, file), { recursive: true, force: true });
      });
    }
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// Export singleton instance helpers
export const getTestingMode = (config?: TestingModeConfig) => 
  AdvancedTestingMode.getInstance(config);

export const enableTestingMode = () => 
  AdvancedTestingMode.getInstance({ 
    enabled: true,
    debugLevel: 'verbose',
    performanceMonitoring: true,
    memoryProfiling: true,
    networkTracing: true,
    errorStackTraces: true,
    timingAnalysis: true,
    isolationMode: true
  });

export const disableTestingMode = () => {
  const instance = AdvancedTestingMode.getInstance();
  instance.cleanup();
};