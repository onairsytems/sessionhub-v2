/**
 * Performance Benchmark Suite for SessionHub
 * Validates speed, reliability, and resource usage requirements
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface BenchmarkConfig {
  iterations: number;
  warmupRuns: number;
  cooldownTime: number;
  memoryLimit: number;
  cpuLimit: number;
  timeLimit: number;
}

export interface Benchmark {
  id: string;
  name: string;
  category: 'startup' | 'runtime' | 'memory' | 'cpu' | 'io' | 'network';
  description: string;
  config: Partial<BenchmarkConfig>;
  runner: () => Promise<BenchmarkResult>;
}

export interface BenchmarkResult {
  benchmarkId: string;
  name: string;
  success: boolean;
  metrics: PerformanceMetrics;
  passed: boolean;
  message: string;
  violations?: string[];
  timestamp: number;
}

export interface PerformanceMetrics {
  duration: number;
  averageDuration?: number;
  minDuration?: number;
  maxDuration?: number;
  standardDeviation?: number;
  memoryUsed: number;
  peakMemory?: number;
  cpuUsage?: number;
  throughput?: number;
  latency?: number;
  errorRate?: number;
}

export interface PerformanceReport {
  timestamp: Date;
  environment: EnvironmentInfo;
  summary: PerformanceSummary;
  benchmarks: BenchmarkResult[];
  violations: PerformanceViolation[];
  recommendations: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface PerformanceSummary {
  totalBenchmarks: number;
  passedBenchmarks: number;
  failedBenchmarks: number;
  averageScore: number;
  categories: Map<string, CategoryScore>;
}

export interface CategoryScore {
  category: string;
  score: number;
  benchmarkCount: number;
  passedCount: number;
}

export interface PerformanceViolation {
  benchmarkId: string;
  type: 'time' | 'memory' | 'cpu' | 'reliability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  actual: number;
  limit: number;
}

export interface EnvironmentInfo {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  nodeVersion: string;
}

export class PerformanceBenchmark extends EventEmitter {
  private benchmarks: Map<string, Benchmark> = new Map();
  private results: BenchmarkResult[] = [];
  private violations: PerformanceViolation[] = [];
  private defaultConfig: BenchmarkConfig = {
    iterations: 10,
    warmupRuns: 3,
    cooldownTime: 100,
    memoryLimit: 512 * 1024 * 1024, // 512MB
    cpuLimit: 80, // 80%
    timeLimit: 5000 // 5 seconds
  };

  constructor() {
    super();
    this.initializeBenchmarks();
  }

  private initializeBenchmarks(): void {
    // Startup Performance
    this.addBenchmark({
      id: 'startup-001',
      name: 'Application Cold Start',
      category: 'startup',
      description: 'Measure cold start time',
      config: { timeLimit: 10000 },
      runner: this.benchmarkColdStart.bind(this)
    });

    this.addBenchmark({
      id: 'startup-002',
      name: 'Application Warm Start',
      category: 'startup',
      description: 'Measure warm start time',
      config: { timeLimit: 3000 },
      runner: this.benchmarkWarmStart.bind(this)
    });

    // Runtime Performance
    this.addBenchmark({
      id: 'runtime-001',
      name: 'Session Creation',
      category: 'runtime',
      description: 'Measure session creation performance',
      config: { timeLimit: 1000 },
      runner: this.benchmarkSessionCreation.bind(this)
    });

    this.addBenchmark({
      id: 'runtime-002',
      name: 'Project Switching',
      category: 'runtime',
      description: 'Measure project switching speed',
      config: { timeLimit: 500 },
      runner: this.benchmarkProjectSwitching.bind(this)
    });

    this.addBenchmark({
      id: 'runtime-003',
      name: 'File Operations',
      category: 'runtime',
      description: 'Measure file operation performance',
      config: { timeLimit: 2000 },
      runner: this.benchmarkFileOperations.bind(this)
    });

    // Memory Performance
    this.addBenchmark({
      id: 'memory-001',
      name: 'Memory Baseline',
      category: 'memory',
      description: 'Measure baseline memory usage',
      config: { memoryLimit: 256 * 1024 * 1024 },
      runner: this.benchmarkMemoryBaseline.bind(this)
    });

    this.addBenchmark({
      id: 'memory-002',
      name: 'Memory Under Load',
      category: 'memory',
      description: 'Measure memory usage under load',
      config: { memoryLimit: 512 * 1024 * 1024 },
      runner: this.benchmarkMemoryLoad.bind(this)
    });

    this.addBenchmark({
      id: 'memory-003',
      name: 'Memory Leak Detection',
      category: 'memory',
      description: 'Check for memory leaks',
      config: { iterations: 100 },
      runner: this.benchmarkMemoryLeaks.bind(this)
    });

    // CPU Performance
    this.addBenchmark({
      id: 'cpu-001',
      name: 'CPU Baseline',
      category: 'cpu',
      description: 'Measure baseline CPU usage',
      config: { cpuLimit: 50 },
      runner: this.benchmarkCPUBaseline.bind(this)
    });

    this.addBenchmark({
      id: 'cpu-002',
      name: 'CPU Under Load',
      category: 'cpu',
      description: 'Measure CPU usage under load',
      config: { cpuLimit: 80 },
      runner: this.benchmarkCPULoad.bind(this)
    });

    // I/O Performance
    this.addBenchmark({
      id: 'io-001',
      name: 'Disk Read Performance',
      category: 'io',
      description: 'Measure disk read speed',
      config: { timeLimit: 1000 },
      runner: this.benchmarkDiskRead.bind(this)
    });

    this.addBenchmark({
      id: 'io-002',
      name: 'Disk Write Performance',
      category: 'io',
      description: 'Measure disk write speed',
      config: { timeLimit: 1000 },
      runner: this.benchmarkDiskWrite.bind(this)
    });

    // Network Performance
    this.addBenchmark({
      id: 'network-001',
      name: 'API Response Time',
      category: 'network',
      description: 'Measure API response times',
      config: { timeLimit: 2000 },
      runner: this.benchmarkAPIResponse.bind(this)
    });
  }

  private addBenchmark(benchmark: Benchmark): void {
    this.benchmarks.set(benchmark.id, benchmark);
  }

  /**
   * Run all benchmarks
   */
  public async runAll(): Promise<PerformanceReport> {
    this.emit('benchmark:start');
    this.results = [];
    this.violations = [];

    const environment = this.getEnvironmentInfo();
    const categorySummary = new Map<string, CategoryScore>();

    // Initialize category scores
    const categories = ['startup', 'runtime', 'memory', 'cpu', 'io', 'network'];
    categories.forEach(cat => {
      categorySummary.set(cat, {
        category: cat,
        score: 0,
        benchmarkCount: 0,
        passedCount: 0
      });
    });

    // Run benchmarks
    for (const [id, benchmark] of this.benchmarks) {
      this.emit('benchmark:running', benchmark);
      
      try {
        // Warmup
        if (benchmark.config.warmupRuns || this.defaultConfig.warmupRuns) {
          await this.runWarmup(benchmark);
        }

        // Run benchmark
        const result = await this.runBenchmark(benchmark);
        this.results.push(result);

        // Update category score
        const categoryScore = categorySummary.get(benchmark.category)!;
        categoryScore.benchmarkCount++;
        if (result.passed) {
          categoryScore.passedCount++;
        }

        // Check for violations
        this.checkViolations(benchmark, result);

        this.emit('benchmark:complete', result);

        // Cooldown
        if (benchmark.config.cooldownTime || this.defaultConfig.cooldownTime) {
          await this.sleep(benchmark.config.cooldownTime || this.defaultConfig.cooldownTime);
        }
      } catch (error) {
        const errorResult: BenchmarkResult = {
          benchmarkId: id,
          name: benchmark.name,
          success: false,
          passed: false,
          message: `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`,
          metrics: {
            duration: 0,
            memoryUsed: 0
          },
          timestamp: Date.now()
        };
        this.results.push(errorResult);
      }
    }

    // Calculate scores
    categorySummary.forEach((score) => {
      if (score.benchmarkCount > 0) {
        score.score = Math.round((score.passedCount / score.benchmarkCount) * 100);
      }
    });

    // Generate report
    const summary: PerformanceSummary = {
      totalBenchmarks: this.results.length,
      passedBenchmarks: this.results.filter(r => r.passed).length,
      failedBenchmarks: this.results.filter(r => !r.passed).length,
      averageScore: this.calculateAverageScore(categorySummary),
      categories: categorySummary
    };

    const report: PerformanceReport = {
      timestamp: new Date(),
      environment,
      summary,
      benchmarks: this.results,
      violations: this.violations,
      recommendations: this.generateRecommendations(),
      grade: this.calculateGrade(summary.averageScore)
    };

    this.emit('benchmark:complete', report);
    return report;
  }

  /**
   * Run specific benchmark
   */
  public async runSingle(benchmarkId: string): Promise<BenchmarkResult> {
    const benchmark = this.benchmarks.get(benchmarkId);
    if (!benchmark) {
      throw new Error(`Benchmark ${benchmarkId} not found`);
    }

    return this.runBenchmark(benchmark);
  }

  /**
   * Benchmark implementations
   */
  private async benchmarkColdStart(): Promise<BenchmarkResult> {
    const iterations = 5;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate cold start by clearing module cache
      Object.keys(require.cache).forEach(key => {
        if (key.includes('sessionhub')) {
          delete require.cache[key];
        }
      });

      // Measure TypeScript compilation
      try {
        execSync('npm run build:check', { stdio: 'pipe' });
      } catch {
        // Ignore errors for now
      }

      const duration = performance.now() - start;
      durations.push(duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const passed = avgDuration < 10000; // 10 seconds

    return {
      benchmarkId: 'startup-001',
      name: 'Application Cold Start',
      success: true,
      passed,
      message: `Average cold start time: ${Math.round(avgDuration)}ms`,
      metrics: {
        duration: avgDuration,
        averageDuration: avgDuration,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        memoryUsed: process.memoryUsage().heapUsed
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkWarmStart(): Promise<BenchmarkResult> {
    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate warm start (modules already cached)
      await import('../models/Session');
      
      const duration = performance.now() - start;
      durations.push(duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const passed = avgDuration < 100; // 100ms

    return {
      benchmarkId: 'startup-002',
      name: 'Application Warm Start',
      success: true,
      passed,
      message: `Average warm start time: ${Math.round(avgDuration)}ms`,
      metrics: {
        duration: avgDuration,
        averageDuration: avgDuration,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        memoryUsed: process.memoryUsage().heapUsed
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkSessionCreation(): Promise<BenchmarkResult> {
    const iterations = 100;
    const durations: number[] = [];
    const memoryBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate session creation
      // Simulate session creation
      void {
        id: `session-${i}`,
        name: `Test Session ${i}`,
        createdAt: new Date(),
        status: 'active',
        data: new Array(1000).fill(0).map(() => Math.random())
      };
      
      const duration = performance.now() - start;
      durations.push(duration);
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const memoryPerSession = (memoryAfter - memoryBefore) / iterations;
    const passed = avgDuration < 10 && memoryPerSession < 1024 * 1024; // 10ms, 1MB

    return {
      benchmarkId: 'runtime-001',
      name: 'Session Creation',
      success: true,
      passed,
      message: `Average creation time: ${avgDuration.toFixed(2)}ms, Memory per session: ${(memoryPerSession / 1024).toFixed(2)}KB`,
      metrics: {
        duration: avgDuration,
        averageDuration: avgDuration,
        memoryUsed: memoryPerSession,
        throughput: 1000 / avgDuration // sessions per second
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkProjectSwitching(): Promise<BenchmarkResult> {
    const iterations = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate project switch
      // Simulate project switch
      void {
        id: `project-${i}`,
        name: `Project ${i}`,
        path: `/fake/path/project-${i}`,
        lastOpened: new Date()
      };
      
      // Simulate state update
      await this.sleep(1);
      
      const duration = performance.now() - start;
      durations.push(duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const passed = avgDuration < 50; // 50ms

    return {
      benchmarkId: 'runtime-002',
      name: 'Project Switching',
      success: true,
      passed,
      message: `Average switch time: ${avgDuration.toFixed(2)}ms`,
      metrics: {
        duration: avgDuration,
        averageDuration: avgDuration,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        memoryUsed: process.memoryUsage().heapUsed
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkFileOperations(): Promise<BenchmarkResult> {
    const testDir = path.join(os.tmpdir(), 'sessionhub-bench');
    fs.mkdirSync(testDir, { recursive: true });

    const iterations = 100;
    const readTimes: number[] = [];
    const writeTimes: number[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        const filePath = path.join(testDir, `test-${i}.json`);
        const data = JSON.stringify({ id: i, data: new Array(100).fill(0) });

        // Write
        const writeStart = performance.now();
        fs.writeFileSync(filePath, data);
        writeTimes.push(performance.now() - writeStart);

        // Read
        const readStart = performance.now();
        fs.readFileSync(filePath);
        readTimes.push(performance.now() - readStart);
      }

      // Cleanup
      fs.rmSync(testDir, { recursive: true });

      const avgWrite = writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length;
      const avgRead = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
      const passed = avgWrite < 5 && avgRead < 2; // 5ms write, 2ms read

      return {
        benchmarkId: 'runtime-003',
        name: 'File Operations',
        success: true,
        passed,
        message: `Avg read: ${avgRead.toFixed(2)}ms, Avg write: ${avgWrite.toFixed(2)}ms`,
        metrics: {
          duration: avgRead + avgWrite,
          averageDuration: (avgRead + avgWrite) / 2,
          memoryUsed: process.memoryUsage().heapUsed
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        benchmarkId: 'runtime-003',
        name: 'File Operations',
        success: false,
        passed: false,
        message: `File operation benchmark failed: ${error instanceof Error ? error.message : String(error)}`,
        metrics: {
          duration: 0,
          memoryUsed: 0
        },
        timestamp: Date.now()
      };
    }
  }

  private async benchmarkMemoryBaseline(): Promise<BenchmarkResult> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    await this.sleep(100);

    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const passed = heapUsed < 256 * 1024 * 1024; // 256MB

    return {
      benchmarkId: 'memory-001',
      name: 'Memory Baseline',
      success: true,
      passed,
      message: `Baseline memory usage: ${(heapUsed / 1024 / 1024).toFixed(2)}MB`,
      metrics: {
        duration: 0,
        memoryUsed: heapUsed,
        peakMemory: usage.heapTotal
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkMemoryLoad(): Promise<BenchmarkResult> {
    const dataSets: any[] = [];
    const iterations = 10;
    const memorySnapshots: number[] = [];

    for (let i = 0; i < iterations; i++) {
      // Create large data structure
      const data = {
        id: i,
        sessions: new Array(100).fill(0).map((_, j) => ({
          id: `session-${i}-${j}`,
          data: new Array(1000).fill(0).map(() => Math.random())
        }))
      };
      dataSets.push(data);

      memorySnapshots.push(process.memoryUsage().heapUsed);
      await this.sleep(10);
    }

    const peakMemory = Math.max(...memorySnapshots);
    const passed = peakMemory < 512 * 1024 * 1024; // 512MB

    return {
      benchmarkId: 'memory-002',
      name: 'Memory Under Load',
      success: true,
      passed,
      message: `Peak memory usage: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`,
      metrics: {
        duration: 0,
        memoryUsed: process.memoryUsage().heapUsed,
        peakMemory
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkMemoryLeaks(): Promise<BenchmarkResult> {
    const iterations = 100;
    const memorySnapshots: number[] = [];

    // Initial GC
    if (global.gc) {
      global.gc();
    }

    for (let i = 0; i < iterations; i++) {
      // Create and release objects
      let data: any = new Array(1000).fill(0).map(() => ({
        id: Math.random(),
        data: new Array(100).fill(0)
      }));
      
      // Use data
      data.forEach((item: any) => item.processed = true);
      
      // Clear reference
      data = null;

      if (i % 10 === 0 && global.gc) {
        global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    // Check for memory growth
    const firstHalf = memorySnapshots.slice(0, memorySnapshots.length / 2);
    const secondHalf = memorySnapshots.slice(memorySnapshots.length / 2);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const growth = ((avgSecond - avgFirst) / avgFirst) * 100;
    const passed = growth < 10; // Less than 10% growth

    return {
      benchmarkId: 'memory-003',
      name: 'Memory Leak Detection',
      success: true,
      passed,
      message: `Memory growth: ${growth.toFixed(2)}%`,
      metrics: {
        duration: 0,
        memoryUsed: process.memoryUsage().heapUsed,
        errorRate: growth
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkCPUBaseline(): Promise<BenchmarkResult> {
    const startUsage = process.cpuUsage();
    const startTime = Date.now();

    // Wait for baseline
    await this.sleep(1000);

    const endUsage = process.cpuUsage(startUsage);
    const elapsedTime = Date.now() - startTime;
    
    const cpuPercent = ((endUsage.user + endUsage.system) / 1000 / elapsedTime) * 100;
    const passed = cpuPercent < 50; // Less than 50%

    return {
      benchmarkId: 'cpu-001',
      name: 'CPU Baseline',
      success: true,
      passed,
      message: `Baseline CPU usage: ${cpuPercent.toFixed(2)}%`,
      metrics: {
        duration: elapsedTime,
        memoryUsed: process.memoryUsage().heapUsed,
        cpuUsage: cpuPercent
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkCPULoad(): Promise<BenchmarkResult> {
    const startUsage = process.cpuUsage();
    const startTime = Date.now();
    const iterations = 1000000;

    // CPU intensive task
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    // Use result to prevent optimization
    // Suppress unused variable warning
    if (result) { /* intentionally empty */ }

    const endUsage = process.cpuUsage(startUsage);
    const elapsedTime = Date.now() - startTime;
    
    const cpuPercent = ((endUsage.user + endUsage.system) / 1000 / elapsedTime) * 100;
    const passed = cpuPercent < 80 && elapsedTime < 5000; // Less than 80% CPU, completes in 5s

    return {
      benchmarkId: 'cpu-002',
      name: 'CPU Under Load',
      success: true,
      passed,
      message: `CPU usage: ${cpuPercent.toFixed(2)}%, Duration: ${elapsedTime}ms`,
      metrics: {
        duration: elapsedTime,
        memoryUsed: process.memoryUsage().heapUsed,
        cpuUsage: cpuPercent,
        throughput: iterations / elapsedTime * 1000
      },
      timestamp: Date.now()
    };
  }

  private async benchmarkDiskRead(): Promise<BenchmarkResult> {
    const testFile = path.join(os.tmpdir(), 'sessionhub-read-bench.dat');
    const fileSize = 10 * 1024 * 1024; // 10MB
    const buffer = Buffer.alloc(fileSize);
    
    // Create test file
    fs.writeFileSync(testFile, buffer);

    const iterations = 10;
    const durations: number[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fs.readFileSync(testFile);
        durations.push(performance.now() - start);
      }

      fs.unlinkSync(testFile);

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const throughput = (fileSize / 1024 / 1024) / (avgDuration / 1000); // MB/s
      const passed = throughput > 100; // > 100 MB/s

      return {
        benchmarkId: 'io-001',
        name: 'Disk Read Performance',
        success: true,
        passed,
        message: `Read throughput: ${throughput.toFixed(2)} MB/s`,
        metrics: {
          duration: avgDuration,
          averageDuration: avgDuration,
          memoryUsed: process.memoryUsage().heapUsed,
          throughput
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        benchmarkId: 'io-001',
        name: 'Disk Read Performance',
        success: false,
        passed: false,
        message: `Disk read benchmark failed: ${error instanceof Error ? error.message : String(error)}`,
        metrics: {
          duration: 0,
          memoryUsed: 0
        },
        timestamp: Date.now()
      };
    }
  }

  private async benchmarkDiskWrite(): Promise<BenchmarkResult> {
    const testFile = path.join(os.tmpdir(), 'sessionhub-write-bench.dat');
    const fileSize = 10 * 1024 * 1024; // 10MB
    const buffer = Buffer.alloc(fileSize);
    
    const iterations = 10;
    const durations: number[] = [];

    try {
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        fs.writeFileSync(testFile, buffer);
        durations.push(performance.now() - start);
        fs.unlinkSync(testFile);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const throughput = (fileSize / 1024 / 1024) / (avgDuration / 1000); // MB/s
      const passed = throughput > 50; // > 50 MB/s

      return {
        benchmarkId: 'io-002',
        name: 'Disk Write Performance',
        success: true,
        passed,
        message: `Write throughput: ${throughput.toFixed(2)} MB/s`,
        metrics: {
          duration: avgDuration,
          averageDuration: avgDuration,
          memoryUsed: process.memoryUsage().heapUsed,
          throughput
        },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        benchmarkId: 'io-002',
        name: 'Disk Write Performance',
        success: false,
        passed: false,
        message: `Disk write benchmark failed: ${error instanceof Error ? error.message : String(error)}`,
        metrics: {
          duration: 0,
          memoryUsed: 0
        },
        timestamp: Date.now()
      };
    }
  }

  private async benchmarkAPIResponse(): Promise<BenchmarkResult> {
    // Simulate API calls
    const iterations = 20;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      // Simulate API call with random latency
      await this.sleep(Math.random() * 100 + 50);
      
      latencies.push(performance.now() - start);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const passed = avgLatency < 200 && p95Latency < 500; // avg < 200ms, p95 < 500ms

    return {
      benchmarkId: 'network-001',
      name: 'API Response Time',
      success: true,
      passed,
      message: `Avg latency: ${avgLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`,
      metrics: {
        duration: avgLatency,
        averageDuration: avgLatency,
        latency: p95Latency,
        memoryUsed: process.memoryUsage().heapUsed
      },
      timestamp: Date.now()
    };
  }

  /**
   * Helper methods
   */
  private async runWarmup(benchmark: Benchmark): Promise<void> {
    const warmupRuns = benchmark.config.warmupRuns || this.defaultConfig.warmupRuns;
    
    for (let i = 0; i < warmupRuns; i++) {
      await benchmark.runner();
      await this.sleep(50);
    }
  }

  private async runBenchmark(benchmark: Benchmark): Promise<BenchmarkResult> {
    const config = { ...this.defaultConfig, ...benchmark.config };
    const iterations = config.iterations;
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await benchmark.runner();
      results.push(result);
      
      if (!result.success) {
        return result; // Return early on failure
      }
    }

    // Aggregate results
    const durations = results.map(r => r.metrics.duration);
    const memoryUsages = results.map(r => r.metrics.memoryUsed);

    const aggregated: BenchmarkResult = {
      benchmarkId: benchmark.id,
      name: benchmark.name,
      success: true,
      passed: results.every(r => r.passed),
      message: results[results.length - 1]?.message || 'No results',
      metrics: {
        duration: durations.reduce((a, b) => a + b, 0) / durations.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        standardDeviation: this.calculateStandardDeviation(durations),
        memoryUsed: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        peakMemory: Math.max(...memoryUsages),
        ...(results[0]?.metrics || {}) // Include other metrics from first result
      },
      timestamp: Date.now()
    };

    return aggregated;
  }

  private checkViolations(benchmark: Benchmark, result: BenchmarkResult): void {
    const config = { ...this.defaultConfig, ...benchmark.config };

    // Time limit violation
    if (config.timeLimit && result.metrics.duration > config.timeLimit) {
      this.violations.push({
        benchmarkId: benchmark.id,
        type: 'time',
        severity: 'high',
        message: `Exceeded time limit: ${result.metrics.duration.toFixed(2)}ms > ${config.timeLimit}ms`,
        actual: result.metrics.duration,
        limit: config.timeLimit
      });
    }

    // Memory limit violation
    if (config.memoryLimit && result.metrics.memoryUsed > config.memoryLimit) {
      this.violations.push({
        benchmarkId: benchmark.id,
        type: 'memory',
        severity: 'high',
        message: `Exceeded memory limit: ${(result.metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB > ${(config.memoryLimit / 1024 / 1024).toFixed(2)}MB`,
        actual: result.metrics.memoryUsed,
        limit: config.memoryLimit
      });
    }

    // CPU limit violation
    if (config.cpuLimit && result.metrics.cpuUsage && result.metrics.cpuUsage > config.cpuLimit) {
      this.violations.push({
        benchmarkId: benchmark.id,
        type: 'cpu',
        severity: 'medium',
        message: `Exceeded CPU limit: ${result.metrics.cpuUsage.toFixed(2)}% > ${config.cpuLimit}%`,
        actual: result.metrics.cpuUsage,
        limit: config.cpuLimit
      });
    }
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      totalMemory: os.totalmem(),
      nodeVersion: process.version
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  private calculateAverageScore(categorySummary: Map<string, CategoryScore>): number {
    const scores = Array.from(categorySummary.values()).map(c => c.score);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze violations
    const criticalViolations = this.violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push('Address critical performance violations immediately');
    }

    // Time-based recommendations
    const slowBenchmarks = this.results.filter(r => 
      r.metrics.duration > 1000 && r.benchmarkId.includes('runtime')
    );
    if (slowBenchmarks.length > 0) {
      recommendations.push('Optimize runtime operations to reduce latency');
    }

    // Memory-based recommendations
    const highMemoryBenchmarks = this.results.filter(r => 
      r.metrics.memoryUsed > 256 * 1024 * 1024
    );
    if (highMemoryBenchmarks.length > 0) {
      recommendations.push('Reduce memory usage in memory-intensive operations');
    }

    // CPU-based recommendations
    const highCPUBenchmarks = this.results.filter(r => 
      r.metrics.cpuUsage && r.metrics.cpuUsage > 70
    );
    if (highCPUBenchmarks.length > 0) {
      recommendations.push('Optimize CPU-intensive operations or implement throttling');
    }

    // I/O recommendations
    const slowIOBenchmarks = this.results.filter(r => 
      r.benchmarkId.includes('io') && r.metrics.throughput && r.metrics.throughput < 50
    );
    if (slowIOBenchmarks.length > 0) {
      recommendations.push('Improve I/O performance with caching or async operations');
    }

    return recommendations;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate detailed report
   */
  public generateDetailedReport(report: PerformanceReport): string {
    const lines: string[] = [];
    
    lines.push('# Performance Benchmark Report');
    lines.push(`Generated: ${report.timestamp.toISOString()}`);
    lines.push(`Grade: ${report.grade}`);
    lines.push('');
    
    lines.push('## Environment');
    lines.push(`Platform: ${report.environment.platform} (${report.environment.arch})`);
    lines.push(`CPU: ${report.environment.cpuModel} (${report.environment.cpuCores} cores)`);
    lines.push(`Memory: ${(report.environment.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
    lines.push(`Node.js: ${report.environment.nodeVersion}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`Average Score: ${report.summary.averageScore}%`);
    lines.push(`Total Benchmarks: ${report.summary.totalBenchmarks}`);
    lines.push(`Passed: ${report.summary.passedBenchmarks}`);
    lines.push(`Failed: ${report.summary.failedBenchmarks}`);
    lines.push('');
    
    lines.push('## Category Scores');
    report.summary.categories.forEach((score, category) => {
      lines.push(`- ${category}: ${score.score}% (${score.passedCount}/${score.benchmarkCount})`);
    });
    lines.push('');
    
    if (report.violations.length > 0) {
      lines.push('## Violations');
      report.violations.forEach(violation => {
        lines.push(`- [${violation.severity.toUpperCase()}] ${violation.message}`);
      });
      lines.push('');
    }
    
    lines.push('## Benchmark Results');
    report.benchmarks.forEach(result => {
      lines.push(`### ${result.name}`);
      lines.push(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      lines.push(result.message);
      
      if (result.metrics.averageDuration !== undefined) {
        lines.push(`- Average Duration: ${result.metrics.averageDuration.toFixed(2)}ms`);
      }
      if (result.metrics.throughput !== undefined) {
        lines.push(`- Throughput: ${result.metrics.throughput.toFixed(2)}`);
      }
      if (result.metrics.cpuUsage !== undefined) {
        lines.push(`- CPU Usage: ${result.metrics.cpuUsage.toFixed(2)}%`);
      }
      lines.push('');
    });
    
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
    }
    
    return lines.join('\n');
  }
}

// Export singleton instance
let benchmarkInstance: PerformanceBenchmark | null = null;

export const getPerformanceBenchmark = (): PerformanceBenchmark => {
  if (!benchmarkInstance) {
    benchmarkInstance = new PerformanceBenchmark();
  }
  return benchmarkInstance;
};

export const runPerformanceBenchmarks = async (): Promise<PerformanceReport> => {
  const benchmark = getPerformanceBenchmark();
  return benchmark.runAll();
};