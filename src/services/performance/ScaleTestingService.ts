import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';

interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    percentage: number;
  };
  diskIO: {
    readSpeed: number;
    writeSpeed: number;
  };
  sessionMetrics: {
    activeCount: number;
    totalCount: number;
    averageExecutionTime: number;
  };
}

interface ScaleTestResult {
  testName: string;
  timestamp: Date;
  metrics: PerformanceMetrics;
  passed: boolean;
  details: any;
}

export class ScaleTestingService extends EventEmitter {
  private static instance: ScaleTestingService;
  private db!: Database.Database;
  private isMonitoring: boolean = false;
  private metrics: PerformanceMetrics[] = [];
  // private _testResults: ScaleTestResult[] = [];

  private constructor() {
    super();
    this.initializeDatabase();
  }

  static getInstance(): ScaleTestingService {
    if (!ScaleTestingService.instance) {
      ScaleTestingService.instance = new ScaleTestingService();
    }
    return ScaleTestingService.instance;
  }

  private initializeDatabase(): void {
    const dbPath = path.join(os.homedir(), '.sessionhub', 'performance.db');
    this.db = new Database(dbPath);

    // Create performance tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        cpu_usage REAL NOT NULL,
        memory_total INTEGER NOT NULL,
        memory_used INTEGER NOT NULL,
        memory_percentage REAL NOT NULL,
        disk_read_speed REAL NOT NULL,
        disk_write_speed REAL NOT NULL,
        active_sessions INTEGER NOT NULL,
        total_sessions INTEGER NOT NULL,
        avg_execution_time REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scale_test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        details TEXT NOT NULL,
        metrics TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_test_results_timestamp ON scale_test_results(timestamp);
    `);
  }

  // Start continuous performance monitoring
  startMonitoring(interval: number = 1000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringLoop(interval);
  }

  private async monitoringLoop(interval: number): Promise<void> {
    while (this.isMonitoring) {
      const metrics = await this.collectMetrics();
      this.metrics.push(metrics);
      this.saveMetrics(metrics);
      this.emit('metrics', metrics);
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const cpuUsage = this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskIO = await this.getDiskIO();
    const sessionMetrics = await this.getSessionMetrics();

    return {
      cpuUsage,
      memoryUsage,
      diskIO,
      sessionMetrics,
    };
  }

  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - Math.floor(idle * 100 / total);

    return usage;
  }

  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total: Math.floor(total / 1024 / 1024), // MB
      used: Math.floor(used / 1024 / 1024), // MB
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  private async getDiskIO(): Promise<PerformanceMetrics['diskIO']> {
    // Simulate disk I/O testing with file operations
    const testFile = path.join(os.tmpdir(), 'sessionhub-io-test.tmp');
    const testData = Buffer.alloc(10 * 1024 * 1024); // 10MB

    // Write test
    const writeStart = performance.now();
    await fs.promises.writeFile(testFile, testData);
    const writeEnd = performance.now();
    const writeSpeed = (10 * 1024) / (writeEnd - writeStart); // KB/ms

    // Read test
    const readStart = performance.now();
    await fs.promises.readFile(testFile);
    const readEnd = performance.now();
    const readSpeed = (10 * 1024) / (readEnd - readStart); // KB/ms

    // Cleanup
    await fs.promises.unlink(testFile).catch(() => {});

    return {
      readSpeed: Math.round(readSpeed),
      writeSpeed: Math.round(writeSpeed),
    };
  }

  private async getSessionMetrics(): Promise<PerformanceMetrics['sessionMetrics']> {
    // Query session database for metrics
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(*) as total_count,
        AVG(execution_time) as avg_execution_time
      FROM sessions
      WHERE created_at > datetime('now', '-24 hours')
    `);

    const result = stmt.get() as any || { active_count: 0, total_count: 0, avg_execution_time: 0 };

    return {
      activeCount: result.active_count,
      totalCount: result.total_count,
      averageExecutionTime: result.avg_execution_time || 0,
    };
  }

  private saveMetrics(metrics: PerformanceMetrics): void {
    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (
        timestamp, cpu_usage, memory_total, memory_used, memory_percentage,
        disk_read_speed, disk_write_speed, active_sessions, total_sessions, avg_execution_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      Date.now(),
      metrics.cpuUsage,
      metrics.memoryUsage.total,
      metrics.memoryUsage.used,
      metrics.memoryUsage.percentage,
      metrics.diskIO.readSpeed,
      metrics.diskIO.writeSpeed,
      metrics.sessionMetrics.activeCount,
      metrics.sessionMetrics.totalCount,
      metrics.sessionMetrics.averageExecutionTime
    );
  }

  // Scale testing methods
  async testLargeCodebase(filesCount: number = 1000, linesPerFile: number = 100): Promise<ScaleTestResult> {
    const testName = `Large Codebase Test (${filesCount} files, ${linesPerFile} lines/file)`;
    const startTime = performance.now();
    const startMetrics = await this.collectMetrics();

    try {
      // Simulate processing large codebase
      const testDir = path.join(os.tmpdir(), 'sessionhub-scale-test');
      await fs.promises.mkdir(testDir, { recursive: true });

      // Create test files
      for (let i = 0; i < filesCount; i++) {
        const content = Array(linesPerFile).fill(`// Line content for file ${i}`).join('\n');
        await fs.promises.writeFile(
          path.join(testDir, `test-file-${i}.ts`),
          content
        );
      }

      // Simulate analysis
      const files = await fs.promises.readdir(testDir);
      let totalLines = 0;
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(testDir, file), 'utf-8');
        totalLines += content.split('\n').length;
      }

      // Cleanup
      await fs.promises.rm(testDir, { recursive: true, force: true });

      const endTime = performance.now();
      const endMetrics = await this.collectMetrics();
      const executionTime = endTime - startTime;

      const passed = executionTime < filesCount * 10 && // 10ms per file max
                    endMetrics.memoryUsage.percentage < 80 &&
                    endMetrics.cpuUsage < 90;

      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: endMetrics,
        passed,
        details: {
          filesProcessed: filesCount,
          totalLines,
          executionTime: Math.round(executionTime),
          memoryDelta: endMetrics.memoryUsage.used - startMetrics.memoryUsage.used,
        },
      };

      this.saveTestResult(result);
      return result;

    } catch (error) {
      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: await this.collectMetrics(),
        passed: false,
        details: { error: (error as Error).message },
      };
      this.saveTestResult(result);
      return result;
    }
  }

  async testDocumentAnalysis(documentSize: number = 10): Promise<ScaleTestResult> {
    const testName = `Document Analysis Test (${documentSize}MB)`;
    const startTime = performance.now();
    await this.collectMetrics();

    try {
      // Generate large document
      const content = Array(documentSize * 1024 * 1024 / 100)
        .fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20))
        .join('\n');

      // Simulate document processing
      const words = content.split(/\s+/).length;
      const lines = content.split('\n').length;
      const characters = content.length;

      const endTime = performance.now();
      const endMetrics = await this.collectMetrics();
      const executionTime = endTime - startTime;

      const passed = executionTime < documentSize * 1000 && // 1s per MB max
                    endMetrics.memoryUsage.percentage < 85;

      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: endMetrics,
        passed,
        details: {
          documentSizeMB: documentSize,
          words,
          lines,
          characters,
          executionTime: Math.round(executionTime),
          processingSpeed: Math.round(documentSize / (executionTime / 1000)), // MB/s
        },
      };

      this.saveTestResult(result);
      return result;

    } catch (error) {
      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: await this.collectMetrics(),
        passed: false,
        details: { error: (error as Error).message },
      };
      this.saveTestResult(result);
      return result;
    }
  }

  async testConcurrentSessions(sessionCount: number = 10): Promise<ScaleTestResult> {
    const testName = `Concurrent Sessions Test (${sessionCount} sessions)`;
    const startTime = performance.now();
    await this.collectMetrics();

    try {
      // Simulate concurrent session operations
      const sessionPromises = Array(sessionCount).fill(0).map(async (_, index) => {
        const sessionStart = performance.now();
        
        // Simulate session work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        
        // Simulate CPU-intensive task
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i);
        }
        
        return {
          sessionId: index,
          executionTime: performance.now() - sessionStart,
          result: sum,
        };
      });

      const results = await Promise.all(sessionPromises);
      
      const endTime = performance.now();
      const endMetrics = await this.collectMetrics();
      const executionTime = endTime - startTime;
      const avgSessionTime = results.reduce((acc, r) => acc + r.executionTime, 0) / results.length;

      const passed = executionTime < sessionCount * 200 && // 200ms per session max
                    endMetrics.cpuUsage < 95 &&
                    avgSessionTime < 2000;

      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: endMetrics,
        passed,
        details: {
          sessionCount,
          totalExecutionTime: Math.round(executionTime),
          averageSessionTime: Math.round(avgSessionTime),
          cpuPeak: endMetrics.cpuUsage,
          memoryPeak: endMetrics.memoryUsage.percentage,
        },
      };

      this.saveTestResult(result);
      return result;

    } catch (error) {
      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: await this.collectMetrics(),
        passed: false,
        details: { error: (error as Error).message },
      };
      this.saveTestResult(result);
      return result;
    }
  }

  async testLongRunningSession(durationMinutes: number = 5): Promise<ScaleTestResult> {
    const testName = `Long Running Session Test (${durationMinutes} minutes)`;
    const startTime = performance.now();
    const startMetrics = await this.collectMetrics();
    const metricsHistory: PerformanceMetrics[] = [];

    try {
      const endTime = startTime + (durationMinutes * 60 * 1000);
      
      while (performance.now() < endTime) {
        // Simulate ongoing work
        const workPromises = Array(5).fill(0).map(async () => {
          // Simulate file operations
          const tempFile = path.join(os.tmpdir(), `session-work-${Date.now()}.tmp`);
          await fs.promises.writeFile(tempFile, 'test data');
          await fs.promises.readFile(tempFile);
          await fs.promises.unlink(tempFile);
          
          // Simulate computation
          let result = 0;
          for (let i = 0; i < 100000; i++) {
            result += Math.sqrt(i);
          }
          return result;
        });

        await Promise.all(workPromises);
        
        const metrics = await this.collectMetrics();
        metricsHistory.push(metrics);
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10s
      }

      const finalMetrics = await this.collectMetrics();
      const actualDuration = (performance.now() - startTime) / 1000 / 60; // minutes

      // Check for memory leaks and performance degradation
      const memoryGrowth = finalMetrics.memoryUsage.used - startMetrics.memoryUsage.used;
      const memoryGrowthRate = memoryGrowth / actualDuration; // MB per minute
      
      const avgCPU = metricsHistory.reduce((acc, m) => acc + m.cpuUsage, 0) / metricsHistory.length;

      const passed = memoryGrowthRate < 10 && // Less than 10MB/min growth
                    avgCPU < 80 &&
                    finalMetrics.memoryUsage.percentage < 90;

      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: finalMetrics,
        passed,
        details: {
          durationMinutes: actualDuration,
          memoryGrowthMB: memoryGrowth,
          memoryGrowthRate: Math.round(memoryGrowthRate * 100) / 100,
          averageCPU: Math.round(avgCPU * 100) / 100,
          samplesCollected: metricsHistory.length,
        },
      };

      this.saveTestResult(result);
      return result;

    } catch (error) {
      const result: ScaleTestResult = {
        testName,
        timestamp: new Date(),
        metrics: await this.collectMetrics(),
        passed: false,
        details: { error: (error as Error).message },
      };
      this.saveTestResult(result);
      return result;
    }
  }

  private saveTestResult(result: ScaleTestResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO scale_test_results (test_name, timestamp, passed, details, metrics)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.testName,
      result.timestamp.getTime(),
      result.passed ? 1 : 0,
      JSON.stringify(result.details),
      JSON.stringify(result.metrics)
    );
  }

  // Reporting methods
  generatePerformanceReport(): any {
    const recentMetrics = this.db.prepare(`
      SELECT * FROM performance_metrics
      WHERE timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all(Date.now() - 3600000); // Last hour

    const testResults = this.db.prepare(`
      SELECT * FROM scale_test_results
      ORDER BY timestamp DESC
      LIMIT 50
    `).all();

    const avgMetrics = this.db.prepare(`
      SELECT 
        AVG(cpu_usage) as avg_cpu,
        AVG(memory_percentage) as avg_memory,
        MAX(cpu_usage) as max_cpu,
        MAX(memory_percentage) as max_memory,
        AVG(disk_read_speed) as avg_read_speed,
        AVG(disk_write_speed) as avg_write_speed
      FROM performance_metrics
      WHERE timestamp > ?
    `).get(Date.now() - 3600000) as any;

    return {
      summary: {
        averageCPU: Math.round(avgMetrics.avg_cpu * 100) / 100,
        averageMemory: Math.round(avgMetrics.avg_memory * 100) / 100,
        peakCPU: Math.round(avgMetrics.max_cpu * 100) / 100,
        peakMemory: Math.round(avgMetrics.max_memory * 100) / 100,
        avgDiskReadSpeed: Math.round(avgMetrics.avg_read_speed),
        avgDiskWriteSpeed: Math.round(avgMetrics.avg_write_speed),
      },
      recentMetrics: recentMetrics.slice(0, 100),
      testResults: testResults.map((r: any) => ({
        ...r,
        details: JSON.parse(r.details),
        metrics: JSON.parse(r.metrics),
      })),
    };
  }

  // Cleanup
  close(): void {
    this.stopMonitoring();
    this.db.close();
  }
}