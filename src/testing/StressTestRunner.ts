/**
 * Stress Testing Runner for SessionHub
 * 
 * Validates system performance under extreme conditions and edge cases.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { SystemOrchestrator } from '../core/orchestrator/SystemOrchestrator';
import { DatabaseService } from '../database/DatabaseService';
import { RealWorldTestFramework } from './RealWorldTestFramework';
import { Worker } from 'worker_threads';
import * as path from 'path';

export interface StressTestConfig {
  name: string;
  description: string;
  duration: number; // milliseconds
  rampUpTime: number; // milliseconds
  targetLoad: LoadProfile;
  scenarios: StressScenario[];
  successCriteria: SuccessCriteria;
  monitoring: MonitoringConfig;
}

export interface LoadProfile {
  concurrentUsers: number;
  requestsPerSecond: number;
  sessionDuration: number;
  thinkTime: number; // Time between requests
  distribution: 'constant' | 'ramp' | 'spike' | 'wave';
}

export interface StressScenario {
  id: string;
  weight: number; // Percentage of load
  actions: ScenarioAction[];
  dataSet?: DataSet;
}

export interface ScenarioAction {
  type: 'create-session' | 'execute-code' | 'api-call' | 'database-query' | 'file-operation';
  params: Record<string, any>;
  validations?: Validation[];
}

export interface Validation {
  type: 'response-time' | 'status' | 'content' | 'error-rate';
  condition: string;
  value: any;
}

export interface DataSet {
  type: 'random' | 'sequential' | 'csv' | 'generated';
  source?: string;
  generator?: () => any;
}

export interface SuccessCriteria {
  maxResponseTime: number;
  maxErrorRate: number;
  minThroughput: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
  customChecks?: CustomCheck[];
}

export interface CustomCheck {
  name: string;
  check: (results: StressTestResults) => boolean;
  message: string;
}

export interface MonitoringConfig {
  interval: number; // milliseconds
  metrics: string[];
  alerts: AlertConfig[];
}

export interface AlertConfig {
  metric: string;
  threshold: number;
  action: 'log' | 'abort' | 'notify';
}

export interface StressTestResults {
  config: StressTestConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'passed' | 'failed' | 'aborted';
  metrics: StressMetrics;
  errors: StressError[];
  timeline: TimelineEntry[];
  summary: TestSummary;
}

export interface StressMetrics {
  requests: RequestMetrics;
  performance: PerformanceMetrics;
  resources: ResourceMetrics;
  custom: Record<string, any>;
}

export interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
}

export interface PerformanceMetrics {
  transactionsPerSecond: number;
  concurrentUsers: number;
  sessionDuration: number;
  dataTransferred: number;
}

export interface ResourceMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
}

export interface CPUMetrics {
  avg: number;
  max: number;
  p95: number;
}

export interface MemoryMetrics {
  avg: number;
  max: number;
  heapUsed: number;
  gcCount: number;
  gcDuration: number;
}

export interface DiskMetrics {
  reads: number;
  writes: number;
  throughput: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connections: number;
  errors: number;
}

export interface StressError {
  timestamp: Date;
  scenario: string;
  action: string;
  error: string;
  stack?: string;
  context?: Record<string, any>;
}

export interface TimelineEntry {
  timestamp: Date;
  event: string;
  value: any;
  type: 'metric' | 'error' | 'milestone' | 'alert';
}

export interface TestSummary {
  passed: boolean;
  failureReasons: string[];
  recommendations: string[];
  bottlenecks: Bottleneck[];
}

export interface Bottleneck {
  component: string;
  metric: string;
  value: number;
  threshold: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

export class StressTestRunner extends EventEmitter {
  private orchestrator: SystemOrchestrator;
  private database: DatabaseService;
  private testFramework: RealWorldTestFramework;
  
  private workers: Worker[] = [];
  private activeTests: Map<string, StressTestExecution> = new Map();
  private results: Map<string, StressTestResults[]> = new Map();
  
  private readonly maxWorkers: number;
  private readonly workerScript: string;

  constructor(
    orchestrator: SystemOrchestrator,
    database: DatabaseService,
    testFramework: RealWorldTestFramework
  ) {
    super();
    this.orchestrator = orchestrator;
    this.database = database;
    this.testFramework = testFramework;
    
    this.maxWorkers = os.cpus().length;
    this.workerScript = path.join(__dirname, 'stress-worker.js');
  }

  /**
   * Initialize workers pool
   */
  private async initializeWorkers(): Promise<void> {
    // Create worker pool for distributed load testing
    for (let i = 0; i < Math.min(this.maxWorkers, 4); i++) {
      try {
        const worker = new Worker(this.workerScript);
        this.workers.push(worker);
        worker.on('error', (error) => {
          this.emit('workerError', { workerId: i, error });
        });
      } catch {
        // Worker script not available yet
        break;
      }
    }
  }

  /**
   * Cleanup workers
   */
  private async cleanupWorkers(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }

  /**
   * Run a stress test
   */
  public async runStressTest(config: StressTestConfig): Promise<StressTestResults> {
    const testId = `stress-${Date.now()}`;
    const execution = new StressTestExecution(testId, config, this);
    
    this.activeTests.set(testId, execution);
    this.emit('testStarted', { testId, config });
    
    // Initialize workers if needed
    if (this.workers.length === 0) {
      await this.initializeWorkers();
    }
    
    try {
      const results = await execution.run();
      
      // Store results
      if (!this.results.has(config.name)) {
        this.results.set(config.name, []);
      }
      this.results.get(config.name)!.push(results);
      
      // Run orchestrated test if needed
      if (config.scenarios.length > 0) {
        await this.runOrchestratedTest(config);
      }
      
      // Store final metrics
      await this.storeMetrics(testId, results.metrics);
      
      this.emit('testCompleted', { testId, results });
      return results;
      
    } finally {
      this.activeTests.delete(testId);
      
      // Cleanup if no more active tests
      if (this.activeTests.size === 0) {
        await this.cleanupWorkers();
      }
    }
  }

  /**
   * Run orchestrated test execution
   */
  private async runOrchestratedTest(config: StressTestConfig): Promise<void> {
    // Use orchestrator for test coordination
    await this.orchestrator.processRequest(
      'stress-test-user',
      `Run stress test: ${config.name}`,
      { type: 'stress-test', config }
    );
  }

  /**
   * Store test metrics in database
   */
  private async storeMetrics(testId: string, metrics: StressMetrics): Promise<void> {
    try {
      await this.database.storeMetrics({
        testId,
        metrics,
        timestamp: new Date()
      });
      
      // Also run validation with test framework
      if (this.testFramework) {
        const validation = await this.testFramework.runScenario('stress-validation');
        this.emit('validationCompleted', { testId, validation });
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get predefined stress test configurations
   */
  public getPredefinedTests(): StressTestConfig[] {
    return [
      this.getHighLoadTest(),
      this.getSpikeTest(),
      this.getEnduranceTest(),
      this.getConcurrencyTest(),
      this.getResourceExhaustionTest()
    ];
  }

  /**
   * High Load Test - Sustained high traffic
   */
  private getHighLoadTest(): StressTestConfig {
    return {
      name: 'High Load Test',
      description: 'Tests system under sustained high load',
      duration: 300000, // 5 minutes
      rampUpTime: 60000, // 1 minute
      targetLoad: {
        concurrentUsers: 100,
        requestsPerSecond: 50,
        sessionDuration: 180000, // 3 minutes
        thinkTime: 2000, // 2 seconds
        distribution: 'ramp'
      },
      scenarios: [
        {
          id: 'create-react-app',
          weight: 40,
          actions: [
            {
              type: 'create-session',
              params: {
                request: 'Create a React TypeScript app with authentication'
              },
              validations: [
                {
                  type: 'response-time',
                  condition: 'less-than',
                  value: 5000
                }
              ]
            }
          ]
        },
        {
          id: 'execute-code-generation',
          weight: 30,
          actions: [
            {
              type: 'execute-code',
              params: {
                code: 'Generate CRUD operations for User model'
              },
              validations: [
                {
                  type: 'response-time',
                  condition: 'less-than',
                  value: 3000
                }
              ]
            }
          ]
        },
        {
          id: 'api-calls',
          weight: 30,
          actions: [
            {
              type: 'api-call',
              params: {
                endpoint: '/api/sessions',
                method: 'GET'
              },
              validations: [
                {
                  type: 'response-time',
                  condition: 'less-than',
                  value: 1000
                }
              ]
            }
          ]
        }
      ],
      successCriteria: {
        maxResponseTime: 5000,
        maxErrorRate: 0.05, // 5%
        minThroughput: 40, // requests per second
        maxMemoryUsage: 2048 * 1024 * 1024, // 2GB
        maxCpuUsage: 85
      },
      monitoring: {
        interval: 5000,
        metrics: ['cpu', 'memory', 'responseTime', 'errorRate'],
        alerts: [
          {
            metric: 'errorRate',
            threshold: 0.1,
            action: 'log'
          },
          {
            metric: 'memory',
            threshold: 0.9,
            action: 'abort'
          }
        ]
      }
    };
  }

  /**
   * Spike Test - Sudden traffic increase
   */
  private getSpikeTest(): StressTestConfig {
    return {
      name: 'Spike Test',
      description: 'Tests system response to sudden traffic spikes',
      duration: 180000, // 3 minutes
      rampUpTime: 5000, // 5 seconds
      targetLoad: {
        concurrentUsers: 200,
        requestsPerSecond: 100,
        sessionDuration: 60000, // 1 minute
        thinkTime: 1000, // 1 second
        distribution: 'spike'
      },
      scenarios: [
        {
          id: 'burst-requests',
          weight: 100,
          actions: [
            {
              type: 'create-session',
              params: {
                request: 'Quick task execution'
              }
            }
          ]
        }
      ],
      successCriteria: {
        maxResponseTime: 10000,
        maxErrorRate: 0.1,
        minThroughput: 50,
        maxMemoryUsage: 3072 * 1024 * 1024, // 3GB
        maxCpuUsage: 95
      },
      monitoring: {
        interval: 1000,
        metrics: ['cpu', 'memory', 'responseTime', 'queueLength'],
        alerts: [
          {
            metric: 'responseTime',
            threshold: 15000,
            action: 'abort'
          }
        ]
      }
    };
  }

  /**
   * Endurance Test - Long-running stability test
   */
  private getEnduranceTest(): StressTestConfig {
    return {
      name: 'Endurance Test',
      description: 'Tests system stability over extended period',
      duration: 3600000, // 1 hour
      rampUpTime: 300000, // 5 minutes
      targetLoad: {
        concurrentUsers: 50,
        requestsPerSecond: 20,
        sessionDuration: 600000, // 10 minutes
        thinkTime: 5000, // 5 seconds
        distribution: 'constant'
      },
      scenarios: [
        {
          id: 'mixed-workload',
          weight: 100,
          actions: [
            {
              type: 'create-session',
              params: {
                request: 'Standard development task'
              }
            },
            {
              type: 'database-query',
              params: {
                query: 'SELECT * FROM sessions ORDER BY created_at DESC LIMIT 10'
              }
            },
            {
              type: 'file-operation',
              params: {
                operation: 'read',
                path: '/test/sample.ts'
              }
            }
          ]
        }
      ],
      successCriteria: {
        maxResponseTime: 3000,
        maxErrorRate: 0.01,
        minThroughput: 15,
        maxMemoryUsage: 1536 * 1024 * 1024, // 1.5GB
        maxCpuUsage: 70,
        customChecks: [
          {
            name: 'Memory Leak Check',
            check: (results) => {
              const memoryTrend = this.analyzeMemoryTrend(results);
              return memoryTrend.slope < 0.1; // Less than 10% increase per hour
            },
            message: 'Memory usage should not increase more than 10% per hour'
          }
        ]
      },
      monitoring: {
        interval: 30000,
        metrics: ['memory', 'gcStats', 'connections'],
        alerts: [
          {
            metric: 'memory',
            threshold: 0.8,
            action: 'notify'
          }
        ]
      }
    };
  }

  /**
   * Concurrency Test - Maximum concurrent operations
   */
  private getConcurrencyTest(): StressTestConfig {
    return {
      name: 'Concurrency Test',
      description: 'Tests maximum concurrent operations',
      duration: 120000, // 2 minutes
      rampUpTime: 30000, // 30 seconds
      targetLoad: {
        concurrentUsers: 500,
        requestsPerSecond: 200,
        sessionDuration: 30000, // 30 seconds
        thinkTime: 500, // 0.5 seconds
        distribution: 'ramp'
      },
      scenarios: [
        {
          id: 'concurrent-sessions',
          weight: 100,
          actions: [
            {
              type: 'create-session',
              params: {
                request: 'Concurrent task ${userId}'
              },
              validations: [
                {
                  type: 'error-rate',
                  condition: 'less-than',
                  value: 0.05
                }
              ]
            }
          ],
          dataSet: {
            type: 'generated',
            generator: () => ({
              userId: Math.floor(Math.random() * 1000)
            })
          }
        }
      ],
      successCriteria: {
        maxResponseTime: 20000,
        maxErrorRate: 0.1,
        minThroughput: 100,
        maxMemoryUsage: 4096 * 1024 * 1024, // 4GB
        maxCpuUsage: 100 // Allow full CPU usage
      },
      monitoring: {
        interval: 2000,
        metrics: ['activeConnections', 'threadCount', 'queueDepth'],
        alerts: [
          {
            metric: 'activeConnections',
            threshold: 1000,
            action: 'log'
          }
        ]
      }
    };
  }

  /**
   * Resource Exhaustion Test - Push system to limits
   */
  private getResourceExhaustionTest(): StressTestConfig {
    return {
      name: 'Resource Exhaustion Test',
      description: 'Tests system behavior at resource limits',
      duration: 600000, // 10 minutes
      rampUpTime: 120000, // 2 minutes
      targetLoad: {
        concurrentUsers: 1000,
        requestsPerSecond: 500,
        sessionDuration: 120000, // 2 minutes
        thinkTime: 0, // No think time
        distribution: 'ramp'
      },
      scenarios: [
        {
          id: 'heavy-operations',
          weight: 50,
          actions: [
            {
              type: 'create-session',
              params: {
                request: 'Generate large codebase with 1000 files'
              }
            }
          ]
        },
        {
          id: 'memory-intensive',
          weight: 30,
          actions: [
            {
              type: 'execute-code',
              params: {
                code: 'Process large dataset'
              }
            }
          ]
        },
        {
          id: 'io-intensive',
          weight: 20,
          actions: [
            {
              type: 'file-operation',
              params: {
                operation: 'write',
                size: 10 * 1024 * 1024 // 10MB
              }
            }
          ]
        }
      ],
      successCriteria: {
        maxResponseTime: 60000,
        maxErrorRate: 0.2,
        minThroughput: 50,
        maxMemoryUsage: 8192 * 1024 * 1024, // 8GB
        maxCpuUsage: 100,
        customChecks: [
          {
            name: 'Graceful Degradation',
            check: (results) => {
              // System should degrade gracefully, not crash
              return results.status !== 'aborted';
            },
            message: 'System should degrade gracefully under extreme load'
          }
        ]
      },
      monitoring: {
        interval: 1000,
        metrics: ['all'],
        alerts: [
          {
            metric: 'errorRate',
            threshold: 0.5,
            action: 'notify'
          }
        ]
      }
    };
  }

  /**
   * Analyze memory trend
   */
  private analyzeMemoryTrend(results: StressTestResults): { slope: number } {
    const timeline = results.timeline.filter(e => 
      e.type === 'metric' && e.event === 'memory'
    );
    
    if (timeline.length < 2) {
      return { slope: 0 };
    }
    
    // Simple linear regression
    const n = timeline.length;
    const values = timeline.map(e => e.value);
    const times = timeline.map((_e, i) => i);
    
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = times.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return { slope };
  }

  /**
   * Abort a running test
   */
  public abortTest(testId: string): void {
    const execution = this.activeTests.get(testId);
    if (execution) {
      execution.abort();
      this.emit('testAborted', { testId });
    }
  }

  /**
   * Get test results
   */
  public getResults(testName?: string): StressTestResults[] {
    if (testName) {
      return this.results.get(testName) || [];
    }
    
    const allResults: StressTestResults[] = [];
    for (const results of this.results.values()) {
      allResults.push(...results);
    }
    return allResults;
  }

  /**
   * Generate comparison report
   */
  public generateComparisonReport(testNames: string[]): ComparisonReport {
    const testResults = testNames.map(name => ({
      name,
      results: this.results.get(name) || []
    }));
    
    return {
      tests: testResults,
      comparison: this.compareResults(testResults),
      recommendations: this.generateRecommendations(testResults),
      timestamp: new Date()
    };
  }

  /**
   * Compare test results
   */
  private compareResults(testResults: Array<{name: string; results: StressTestResults[]}>): any {
    // Implementation for comparing multiple test results
    const comparison: any = {
      performanceComparison: {},
      reliabilityComparison: {},
      resourceUsageComparison: {}
    };
    
    // Compare key metrics across test results
    for (const test of testResults) {
      if (test.results.length > 0) {
        const latestResult = test.results[test.results.length - 1];
        if (latestResult) {
          comparison.performanceComparison[test.name] = {
            avgResponseTime: latestResult.metrics.requests.avgResponseTime,
            throughput: latestResult.metrics.requests.throughput
          };
        }
      }
    }
    
    return comparison;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(testResults: Array<{name: string; results: StressTestResults[]}>): string[] {
    const recommendations: string[] = [];
    
    // Analyze results and generate recommendations
    for (const test of testResults) {
      if (test.results.length === 0) continue;
      
      const latestResult = test.results[test.results.length - 1];
      if (latestResult && latestResult.status === 'failed') {
        recommendations.push(`Address failures in ${test.name} test`);
      }
      
      // Check for performance issues
      if (latestResult && latestResult.metrics.requests.errorRate > 0.05) {
        recommendations.push(`Reduce error rate in ${test.name} (current: ${(latestResult.metrics.requests.errorRate * 100).toFixed(1)}%)`);
      }
    }
    
    return recommendations;
  }
}

/**
 * Individual stress test execution
 */
class StressTestExecution {
  private testId: string;
  private config: StressTestConfig;
  private runner: StressTestRunner;
  private startTime?: Date;
  private endTime?: Date;
  private metrics: StressMetrics;
  private errors: StressError[] = [];
  private timeline: TimelineEntry[] = [];
  private aborted = false;
  private monitoringInterval?: NodeJS.Timeout;
  private virtualUsers: VirtualUser[] = [];
  
  constructor(testId: string, config: StressTestConfig, runner: StressTestRunner) {
    this.testId = testId;
    this.config = config;
    this.runner = runner;
    
    this.metrics = this.initializeMetrics();
  }

  /**
   * Run the stress test
   */
  public async run(): Promise<StressTestResults> {
    this.startTime = new Date();
    
    try {
      // Start monitoring
      this.startMonitoring();
      
      // Ramp up users
      await this.rampUp();
      
      // Run test
      await this.executeTest();
      
      // Ramp down
      await this.rampDown();
      
    } catch (error) {
      this.recordError({
        timestamp: new Date(),
        scenario: 'test-execution',
        action: 'run',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      this.endTime = new Date();
      this.stopMonitoring();
    }
    
    return this.generateResults();
  }

  /**
   * Abort the test
   */
  public abort(): void {
    this.aborted = true;
    this.virtualUsers.forEach(user => user.stop());
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): StressMetrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: Number.MAX_VALUE,
        maxResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0
      },
      performance: {
        transactionsPerSecond: 0,
        concurrentUsers: 0,
        sessionDuration: 0,
        dataTransferred: 0
      },
      resources: {
        cpu: { avg: 0, max: 0, p95: 0 },
        memory: { avg: 0, max: 0, heapUsed: 0, gcCount: 0, gcDuration: 0 },
        disk: { reads: 0, writes: 0, throughput: 0 },
        network: { bytesIn: 0, bytesOut: 0, connections: 0, errors: 0 }
      },
      custom: {}
    };
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoring.interval);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Collect metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Update resource metrics
    this.metrics.resources.memory.heapUsed = memUsage.heapUsed;
    
    // Record timeline entry
    this.timeline.push({
      timestamp: new Date(),
      event: 'metrics',
      value: {
        memory: memUsage.heapUsed,
        cpu: cpuUsage.user + cpuUsage.system
      },
      type: 'metric'
    });
    
    // Check alerts
    this.checkAlerts();
  }

  /**
   * Check monitoring alerts
   */
  private checkAlerts(): void {
    for (const alert of this.config.monitoring.alerts) {
      const value = this.getMetricValue(alert.metric);
      
      if (value > alert.threshold) {
        this.timeline.push({
          timestamp: new Date(),
          event: 'alert',
          value: { metric: alert.metric, value, threshold: alert.threshold },
          type: 'alert'
        });
        
        switch (alert.action) {
          case 'abort':
            this.abort();
            break;
          case 'notify':
            this.runner.emit('alert', { testId: this.testId, alert, value });
            break;
          case 'log':
            // Alert logging should be handled by the event system
            this.runner.emit('alertLogged', { testId: this.testId, alert, value });
            break;
        }
      }
    }
  }

  /**
   * Get metric value
   */
  private getMetricValue(metric: string): number {
    switch (metric) {
      case 'memory':
        return process.memoryUsage().heapUsed / (1024 * 1024 * 1024); // GB
      case 'cpu':
        return 0; // Would need proper CPU measurement
      case 'errorRate':
        return this.metrics.requests.errorRate;
      case 'responseTime':
        return this.metrics.requests.avgResponseTime;
      default:
        return 0;
    }
  }

  /**
   * Ramp up virtual users
   */
  private async rampUp(): Promise<void> {
    const targetUsers = this.config.targetLoad.concurrentUsers;
    const rampUpTime = this.config.rampUpTime;
    const usersPerInterval = 10;
    const interval = rampUpTime / (targetUsers / usersPerInterval);
    
    for (let i = 0; i < targetUsers && !this.aborted; i += usersPerInterval) {
      const batch = Math.min(usersPerInterval, targetUsers - i);
      
      for (let j = 0; j < batch; j++) {
        const user = new VirtualUser(i + j, this.config, this);
        this.virtualUsers.push(user);
        user.start();
      }
      
      this.metrics.performance.concurrentUsers = this.virtualUsers.length;
      
      if (i + usersPerInterval < targetUsers) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    this.timeline.push({
      timestamp: new Date(),
      event: 'ramp-up-complete',
      value: { users: this.virtualUsers.length },
      type: 'milestone'
    });
  }

  /**
   * Execute main test
   */
  private async executeTest(): Promise<void> {
    const testDuration = this.config.duration - this.config.rampUpTime;
    const endTime = Date.now() + testDuration;
    
    while (Date.now() < endTime && !this.aborted) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate current metrics
      this.updateMetrics();
    }
  }

  /**
   * Ramp down users
   */
  private async rampDown(): Promise<void> {
    // Stop all virtual users
    for (const user of this.virtualUsers) {
      user.stop();
    }
    
    this.timeline.push({
      timestamp: new Date(),
      event: 'ramp-down-complete',
      value: { users: 0 },
      type: 'milestone'
    });
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const responseTimes: number[] = [];
    
    // Collect response times from virtual users
    for (const user of this.virtualUsers) {
      responseTimes.push(...user.getResponseTimes());
    }
    
    if (responseTimes.length > 0) {
      // Sort for percentile calculations
      responseTimes.sort((a, b) => a - b);
      
      // Update request metrics
      this.metrics.requests.avgResponseTime = 
        responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      this.metrics.requests.minResponseTime = responseTimes[0] || 0;
      this.metrics.requests.maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
      this.metrics.requests.p50ResponseTime = this.percentile(responseTimes, 50);
      this.metrics.requests.p95ResponseTime = this.percentile(responseTimes, 95);
      this.metrics.requests.p99ResponseTime = this.percentile(responseTimes, 99);
    }
    
    // Calculate throughput
    const duration = (Date.now() - this.startTime!.getTime()) / 1000;
    this.metrics.requests.throughput = this.metrics.requests.total / duration;
    
    // Calculate error rate
    this.metrics.requests.errorRate = 
      this.metrics.requests.total > 0 
        ? this.metrics.requests.failed / this.metrics.requests.total 
        : 0;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)] || 0;
  }

  /**
   * Record error
   */
  public recordError(error: StressError): void {
    this.errors.push(error);
    this.metrics.requests.failed++;
  }

  /**
   * Record successful request
   */
  public recordSuccess(_responseTime: number): void {
    this.metrics.requests.successful++;
    this.metrics.requests.total++;
  }

  /**
   * Generate test results
   */
  private generateResults(): StressTestResults {
    const duration = this.endTime!.getTime() - this.startTime!.getTime();
    
    // Determine if test passed
    const passedCriteria = this.evaluateSuccessCriteria();
    const status = this.aborted ? 'aborted' : passedCriteria.passed ? 'passed' : 'failed';
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks();
    
    return {
      config: this.config,
      startTime: this.startTime!,
      endTime: this.endTime!,
      duration,
      status,
      metrics: this.metrics,
      errors: this.errors,
      timeline: this.timeline,
      summary: {
        passed: passedCriteria.passed,
        failureReasons: passedCriteria.failureReasons,
        recommendations: this.generateRecommendations(bottlenecks),
        bottlenecks
      }
    };
  }

  /**
   * Evaluate success criteria
   */
  private evaluateSuccessCriteria(): { passed: boolean; failureReasons: string[] } {
    const criteria = this.config.successCriteria;
    const failureReasons: string[] = [];
    
    if (this.metrics.requests.maxResponseTime > criteria.maxResponseTime) {
      failureReasons.push(
        `Max response time ${this.metrics.requests.maxResponseTime}ms exceeded limit ${criteria.maxResponseTime}ms`
      );
    }
    
    if (this.metrics.requests.errorRate > criteria.maxErrorRate) {
      failureReasons.push(
        `Error rate ${(this.metrics.requests.errorRate * 100).toFixed(1)}% exceeded limit ${(criteria.maxErrorRate * 100).toFixed(1)}%`
      );
    }
    
    if (this.metrics.requests.throughput < criteria.minThroughput) {
      failureReasons.push(
        `Throughput ${this.metrics.requests.throughput.toFixed(1)} req/s below minimum ${criteria.minThroughput} req/s`
      );
    }
    
    // Check custom criteria
    if (criteria.customChecks) {
      for (const check of criteria.customChecks) {
        if (!check.check(this.generateResults())) {
          failureReasons.push(check.message);
        }
      }
    }
    
    return {
      passed: failureReasons.length === 0,
      failureReasons
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Response time bottleneck
    if (this.metrics.requests.p95ResponseTime > 3000) {
      bottlenecks.push({
        component: 'api',
        metric: 'p95ResponseTime',
        value: this.metrics.requests.p95ResponseTime,
        threshold: 3000,
        impact: this.metrics.requests.p95ResponseTime > 5000 ? 'critical' : 'high',
        suggestion: 'Optimize API endpoints and database queries'
      });
    }
    
    // Memory bottleneck
    const maxMemory = this.config.successCriteria.maxMemoryUsage;
    if (this.metrics.resources.memory.max > maxMemory * 0.8) {
      bottlenecks.push({
        component: 'memory',
        metric: 'maxUsage',
        value: this.metrics.resources.memory.max,
        threshold: maxMemory,
        impact: this.metrics.resources.memory.max > maxMemory ? 'critical' : 'medium',
        suggestion: 'Implement memory optimization and caching strategies'
      });
    }
    
    // CPU bottleneck
    if (this.metrics.resources.cpu.p95 > 80) {
      bottlenecks.push({
        component: 'cpu',
        metric: 'p95Usage',
        value: this.metrics.resources.cpu.p95,
        threshold: 80,
        impact: this.metrics.resources.cpu.p95 > 90 ? 'high' : 'medium',
        suggestion: 'Optimize CPU-intensive operations and consider horizontal scaling'
      });
    }
    
    return bottlenecks;
  }

  /**
   * Generate recommendations based on bottlenecks
   */
  private generateRecommendations(bottlenecks: Bottleneck[]): string[] {
    const recommendations: string[] = [];
    
    // Group bottlenecks by impact
    const critical = bottlenecks.filter(b => b.impact === 'critical');
    const high = bottlenecks.filter(b => b.impact === 'high');
    
    if (critical.length > 0) {
      recommendations.push('URGENT: Address critical bottlenecks immediately:');
      critical.forEach(b => recommendations.push(`- ${b.suggestion}`));
    }
    
    if (high.length > 0) {
      recommendations.push('HIGH PRIORITY: Optimize these components:');
      high.forEach(b => recommendations.push(`- ${b.suggestion}`));
    }
    
    // General recommendations based on metrics
    if (this.metrics.requests.errorRate > 0.01) {
      recommendations.push('Implement better error handling and retry mechanisms');
    }
    
    if (this.metrics.performance.concurrentUsers > 100 && 
        this.metrics.requests.throughput < this.metrics.performance.concurrentUsers * 0.5) {
      recommendations.push('Consider implementing request queueing and rate limiting');
    }
    
    return recommendations;
  }
}

/**
 * Virtual user simulating load
 */
class VirtualUser {
  private userId: number;
  private config: StressTestConfig;
  private execution: StressTestExecution;
  private active = false;
  private responseTimes: number[] = [];
  private sessionStart?: Date;
  
  constructor(userId: number, config: StressTestConfig, execution: StressTestExecution) {
    this.userId = userId;
    this.config = config;
    this.execution = execution;
  }

  public start(): void {
    this.active = true;
    this.sessionStart = new Date();
    this.runSession();
  }

  public stop(): void {
    this.active = false;
  }

  public getResponseTimes(): number[] {
    return [...this.responseTimes];
  }

  private async runSession(): Promise<void> {
    while (this.active) {
      // Select scenario based on weights
      const scenario = this.selectScenario();
      
      // Execute scenario actions
      for (const action of scenario.actions) {
        if (!this.active) break;
        
        const startTime = Date.now();
        
        try {
          await this.executeAction(action, scenario);
          const responseTime = Date.now() - startTime;
          this.responseTimes.push(responseTime);
          this.execution.recordSuccess(responseTime);
          
          // Validate response
          if (action.validations) {
            this.validateAction(action, responseTime);
          }
          
        } catch (error) {
          this.execution.recordError({
            timestamp: new Date(),
            scenario: scenario.id,
            action: action.type,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            context: { userId: this.userId }
          });
        }
        
        // Think time
        if (this.config.targetLoad.thinkTime > 0) {
          await new Promise(resolve => 
            setTimeout(resolve, this.config.targetLoad.thinkTime)
          );
        }
      }
      
      // Check session duration
      if (Date.now() - this.sessionStart!.getTime() > this.config.targetLoad.sessionDuration) {
        break;
      }
    }
  }

  private selectScenario(): StressScenario {
    const random = Math.random() * 100;
    let accumulated = 0;
    
    for (const scenario of this.config.scenarios) {
      accumulated += scenario.weight;
      if (random <= accumulated) {
        return scenario;
      }
    }
    
    return this.config.scenarios[0] || this.config.scenarios.find(() => true)!;
  }

  private async executeAction(action: ScenarioAction, _scenario: StressScenario): Promise<void> {
    // Simulate action execution
    // In real implementation, this would make actual API calls
    
    switch (action.type) {
      case 'create-session':
        await this.simulateDelay(1000, 5000);
        break;
      
      case 'execute-code':
        await this.simulateDelay(500, 3000);
        break;
      
      case 'api-call':
        await this.simulateDelay(50, 500);
        break;
      
      case 'database-query':
        await this.simulateDelay(10, 200);
        break;
      
      case 'file-operation':
        await this.simulateDelay(100, 1000);
        break;
    }
  }

  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = min + Math.random() * (max - min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private validateAction(action: ScenarioAction, responseTime: number): void {
    for (const validation of action.validations || []) {
      switch (validation.type) {
        case 'response-time':
          if (validation.condition === 'less-than' && responseTime > validation.value) {
            throw new Error(`Response time ${responseTime}ms exceeded limit ${validation.value}ms`);
          }
          break;
        
        // Add other validation types
      }
    }
  }
}

export interface ComparisonReport {
  tests: Array<{
    name: string;
    results: StressTestResults[];
  }>;
  comparison: any;
  recommendations: string[];
  timestamp: Date;
}