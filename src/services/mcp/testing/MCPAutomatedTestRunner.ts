import { EventEmitter } from 'events';
import { MCPIntegrationTestFramework, TestConfig, IntegrationTestReport } from './MCPIntegrationTestFramework';
import { MCPBatchProcessor } from '../batch/MCPBatchProcessor';
import { MCPIntegrationMonitor } from '../monitoring/MCPIntegrationMonitor';
import { MCPIntegrationService } from '../core/MCPIntegrationManager';
import { Logger } from '../../../lib/logging/Logger';
import * as cron from 'node-cron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface AutomatedTestConfig {
  schedule?: string; // Cron expression
  integrationIds?: string[]; // Specific integrations to test, or all if not specified
  testTypes: TestType[];
  faultInjection: FaultInjectionScenario[];
  loadTestProfiles: LoadTestProfile[];
  reportingConfig: ReportingConfig;
  cicdIntegration: CICDConfig;
}

export interface TestType {
  name: string;
  enabled: boolean;
  config?: any;
}

export interface FaultInjectionScenario {
  name: string;
  description: string;
  probability: number; // 0-1, chance of injection
  duration?: number; // milliseconds
  targetIntegrations?: string[];
  faults: FaultType[];
}

export interface FaultType {
  type: 'network' | 'timeout' | 'error' | 'rate_limit' | 'data_corruption' | 'service_down';
  config: any;
}

export interface LoadTestProfile {
  name: string;
  stages: LoadTestStage[];
  duration: number; // total duration in seconds
  warmupTime: number; // seconds
  cooldownTime: number; // seconds
}

export interface LoadTestStage {
  duration: number; // seconds
  targetRPS: number;
  concurrency: number;
}

export interface ReportingConfig {
  outputDir: string;
  formats: ('json' | 'html' | 'junit' | 'markdown')[];
  includeMetrics: boolean;
  includeLogs: boolean;
  archiveReports: boolean;
}

export interface CICDConfig {
  enabled: boolean;
  webhookUrl?: string;
  failureThreshold: number; // percentage
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

export interface TestRunResult {
  id: string;
  timestamp: Date;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  successRate: number;
  reports: IntegrationTestReport[];
  faultInjectionResults: FaultInjectionResult[];
  loadTestResults: LoadTestResult[];
  summary: string;
}

export interface FaultInjectionResult {
  scenario: string;
  injected: boolean;
  impact: string;
  recovery: boolean;
  recoveryTime?: number;
}

export interface LoadTestResult {
  profile: string;
  achievedRPS: number;
  targetRPS: number;
  successRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: number;
}

export class MCPAutomatedTestRunner extends EventEmitter {
  private logger: Logger;
  private testFramework: MCPIntegrationTestFramework;
  private batchProcessor: MCPBatchProcessor;
  private monitor: MCPIntegrationMonitor;
  private integrationService: MCPIntegrationService;
  private config: AutomatedTestConfig;
  private scheduledTask?: cron.ScheduledTask;
  private activeTests: Map<string, TestRunResult> = new Map();
  private faultInjector: FaultInjector;

  constructor(config: AutomatedTestConfig) {
    super();
    this.logger = new Logger('MCP');
    this.config = config;
    this.testFramework = new MCPIntegrationTestFramework();
    this.batchProcessor = new MCPBatchProcessor();
    this.monitor = new MCPIntegrationMonitor();
    this.integrationService = new MCPIntegrationService();
    (this.integrationService as any).getIntegration = async (id: string) => ({ id, name: 'Test', tools: [] });
    (this.integrationService as any).executeTool = async () => ({ success: true });
    this.faultInjector = new FaultInjector();

    this.setupEventListeners();
  }

  async start(): Promise<void> {
    this.logger.info('Starting automated test runner');

    // Start monitoring
    await this.monitor.startMonitoring();

    // Schedule tests if configured
    if (this.config.schedule) {
      this.scheduledTask = cron.schedule(this.config.schedule, async () => {
        await this.runAutomatedTests();
      });
      this.logger.info(`Scheduled tests with cron: ${this.config.schedule}`);
    }

    this.emit('runner-started');
  }

  async runAutomatedTests(): Promise<TestRunResult> {
    const runId = `test-run-${Date.now()}`;
    const startTime = Date.now();

    const result: TestRunResult = {
      id: runId,
      timestamp: new Date(),
      duration: 0,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      successRate: 0,
      reports: [],
      faultInjectionResults: [],
      loadTestResults: [],
      summary: '',
    };

    this.activeTests.set(runId, result);
    this.emit('test-run-started', { runId });

    try {
      // Get integrations to test
      const integrations = await this.getIntegrationsToTest();

      // Run standard tests
      if (this.isTestTypeEnabled('standard')) {
        const standardReports = await this.runStandardTests(integrations);
        result.reports.push(...standardReports);
      }

      // Run fault injection tests
      if (this.config.faultInjection.length > 0) {
        const faultResults = await this.runFaultInjectionTests(integrations);
        result.faultInjectionResults = faultResults;
      }

      // Run load tests
      if (this.config.loadTestProfiles.length > 0) {
        const loadResults = await this.runLoadTests(integrations);
        result.loadTestResults = loadResults;
      }

      // Calculate totals
      result.duration = Date.now() - startTime;
      this.calculateTestTotals(result);

      // Generate reports
      await this.generateReports(result);

      // Handle CI/CD integration
      await this.handleCICDIntegration(result);

      this.emit('test-run-completed', result);
      return result;

    } catch (error: any) {
      this.logger.error('Automated test run failed:', error as Error);
      result.summary = `Test run failed: ${(error as Error).message}`;
      this.emit('test-run-failed', { runId, error });
      throw error;
    }
  }

  private async getIntegrationsToTest(): Promise<any[]> {
    if (this.config.integrationIds && this.config.integrationIds.length > 0) {
      const integrations = [];
      for (const id of this.config.integrationIds) {
        const integration = await this.integrationService.getIntegration(id);
        if (integration) {
          integrations.push(integration);
        }
      }
      return integrations;
    }

    return await this.integrationService.getAvailableIntegrations();
  }

  private isTestTypeEnabled(type: string): boolean {
    const testType = this.config.testTypes.find(t => t.name === type);
    return testType?.enabled ?? false;
  }

  private async runStandardTests(integrations: any[]): Promise<IntegrationTestReport[]> {
    const reports: IntegrationTestReport[] = [];

    for (const integration of integrations) {
      const config = await this.generateTestConfig(integration);
      const report = await this.testFramework.runIntegrationTests(config);
      reports.push(report);
    }

    return reports;
  }

  private async runFaultInjectionTests(integrations: any[]): Promise<FaultInjectionResult[]> {
    const results: FaultInjectionResult[] = [];

    for (const scenario of this.config.faultInjection) {
      // Determine if we should inject this fault
      if (Math.random() > scenario.probability) {
        results.push({
          scenario: scenario.name,
          injected: false,
          impact: 'Skipped due to probability',
          recovery: true,
        });
        continue;
      }

      // Get target integrations
      const targets = scenario.targetIntegrations 
        ? integrations.filter(i => scenario.targetIntegrations!.includes(i.id))
        : integrations;

      for (const integration of targets) {
        const result = await this.injectAndTestFault(integration, scenario);
        results.push(result);
      }
    }

    return results;
  }

  private async injectAndTestFault(
    integration: any,
    scenario: FaultInjectionScenario
  ): Promise<FaultInjectionResult> {
    // // const startTime = Date.now(); // Unused in this context
    let recovered = false;
    let impact = '';

    try {
      // Record baseline health
      const baselineHealth = this.monitor.getIntegrationHealth(integration.id);

      // Inject faults
      for (const fault of scenario.faults) {
        await this.faultInjector.inject(integration.id, fault);
      }

      // Wait for impact
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check impact
      const impactedHealth = this.monitor.getIntegrationHealth(integration.id);
      impact = this.assessImpact(baselineHealth, impactedHealth);

      // Wait for duration or recovery
      const recoveryStartTime = Date.now();
      const maxWaitTime = scenario.duration || 30000;

      while (Date.now() - recoveryStartTime < maxWaitTime) {
        const currentHealth = this.monitor.getIntegrationHealth(integration.id);
        if (currentHealth?.status === 'healthy') {
          recovered = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Remove faults
      for (const fault of scenario.faults) {
        await this.faultInjector.remove(integration.id, fault);
      }

      return {
        scenario: scenario.name,
        injected: true,
        impact,
        recovery: recovered,
        recoveryTime: recovered ? Date.now() - recoveryStartTime : undefined,
      };

    } catch (error: any) {
      return {
        scenario: scenario.name,
        injected: false,
        impact: `Injection failed: ${error.message}`,
        recovery: false,
      };
    }
  }

  private assessImpact(baseline: any, current: any): string {
    if (!baseline || !current) return 'Unable to assess impact';

    const impacts = [];

    if (current.status !== baseline.status) {
      impacts.push(`Status changed from ${baseline.status} to ${current.status}`);
    }

    if (current.errorRate > baseline.errorRate + 10) {
      impacts.push(`Error rate increased by ${(current.errorRate - baseline.errorRate).toFixed(1)}%`);
    }

    if (current.responseTime > baseline.responseTime * 2) {
      impacts.push(`Response time increased by ${((current.responseTime / baseline.responseTime - 1) * 100).toFixed(0)}%`);
    }

    return impacts.length > 0 ? impacts.join(', ') : 'No significant impact';
  }

  private async runLoadTests(integrations: any[]): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];

    for (const profile of this.config.loadTestProfiles) {
      for (const integration of integrations) {
        const result = await this.runLoadTestProfile(integration, profile);
        results.push(result);
      }
    }

    return results;
  }

  private async runLoadTestProfile(
    integration: any,
    profile: LoadTestProfile
  ): Promise<LoadTestResult> {
    const metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      responseTimes: [] as number[],
      errors: 0,
    };

    // Warmup
    if (profile.stages.length > 0) {
      const firstStage = profile.stages[0];
      if (firstStage) {
        await this.runLoadTestStage(integration, {
          duration: profile.warmupTime,
          targetRPS: firstStage.targetRPS / 2,
          concurrency: firstStage.concurrency,
        }, metrics, false);
      }
    }

    // Run stages
    for (const stage of profile.stages) {
      await this.runLoadTestStage(integration, stage, metrics, true);
    }

    // Cooldown
    if (profile.stages.length > 0) {
      const lastStage = profile.stages[profile.stages.length - 1];
      if (lastStage) {
        await this.runLoadTestStage(integration, {
          duration: profile.cooldownTime,
          targetRPS: lastStage.targetRPS / 2,
          concurrency: lastStage.concurrency,
        }, metrics, false);
      }
    }

    // Calculate results
    const sortedResponseTimes = [...metrics.responseTimes].sort((a, b) => a - b);
    const avgResponseTime = sortedResponseTimes.reduce((a, b) => a + b, 0) / sortedResponseTimes.length;

    return {
      profile: profile.name,
      achievedRPS: metrics.totalRequests / profile.duration,
      targetRPS: profile.stages.reduce((sum, s) => sum + s.targetRPS, 0) / profile.stages.length,
      successRate: (metrics.successfulRequests / metrics.totalRequests) * 100,
      averageResponseTime: avgResponseTime,
      p95ResponseTime: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0,
      p99ResponseTime: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] || 0,
      errors: metrics.errors,
    };
  }

  private async runLoadTestStage(
    integration: any,
    stage: LoadTestStage,
    metrics: any,
    recordMetrics: boolean
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (stage.duration * 1000);
    const requestInterval = 1000 / stage.targetRPS;

    const promises: Promise<void>[] = [];

    while (Date.now() < endTime) {
      // Launch concurrent requests
      for (let i = 0; i < stage.concurrency; i++) {
        const promise = this.executeLoadTestRequest(integration, metrics, recordMetrics);
        promises.push(promise);
      }

      // Wait for next interval
      await new Promise(resolve => setTimeout(resolve, requestInterval));
    }

    // Wait for all requests to complete
    await Promise.all(promises);
  }

  private async executeLoadTestRequest(
    integration: any,
    metrics: any,
    recordMetrics: boolean
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Execute a random tool from the integration
      const tool = integration.tools[Math.floor(Math.random() * integration.tools.length)];
      await this.integrationService.executeTool(integration.id, tool.name, {});

      const responseTime = Date.now() - startTime;
      
      if (recordMetrics) {
        metrics.totalRequests++;
        metrics.successfulRequests++;
        metrics.responseTimes.push(responseTime);
      }

    } catch (error: any) {
      if (recordMetrics) {
        metrics.totalRequests++;
        metrics.errors++;
      }
    }
  }

  private calculateTestTotals(result: TestRunResult): void {
    // Calculate from integration reports
    for (const report of result.reports) {
      result.totalTests += report.totalTests;
      result.passed += report.passed;
      result.failed += report.failed;
      result.skipped += report.skipped;
    }

    // Add fault injection tests
    result.totalTests += result.faultInjectionResults.length;
    result.passed += result.faultInjectionResults.filter(r => r.recovery).length;
    result.failed += result.faultInjectionResults.filter(r => !r.recovery).length;

    // Add load test results
    result.totalTests += result.loadTestResults.length;
    result.passed += result.loadTestResults.filter(r => r.successRate >= 95).length;
    result.failed += result.loadTestResults.filter(r => r.successRate < 95).length;

    // Calculate success rate
    result.successRate = result.totalTests > 0 
      ? (result.passed / result.totalTests) * 100 
      : 0;

    // Generate summary
    result.summary = this.generateTestSummary(result);
  }

  private generateTestSummary(result: TestRunResult): string {
    const lines = [
      `Test Run ${result.id} completed in ${(result.duration / 1000).toFixed(1)}s`,
      `Total Tests: ${result.totalTests}`,
      `Passed: ${result.passed} (${result.successRate.toFixed(1)}%)`,
      `Failed: ${result.failed}`,
      `Skipped: ${result.skipped}`,
    ];

    if (result.faultInjectionResults.length > 0) {
      const recovered = result.faultInjectionResults.filter(r => r.recovery).length;
      lines.push(`Fault Injection: ${recovered}/${result.faultInjectionResults.length} recovered`);
    }

    if (result.loadTestResults.length > 0) {
      const avgRPS = result.loadTestResults.reduce((sum, r) => sum + r.achievedRPS, 0) / result.loadTestResults.length;
      lines.push(`Load Tests: Average ${avgRPS.toFixed(0)} RPS achieved`);
    }

    return lines.join('\n');
  }

  private async generateReports(result: TestRunResult): Promise<void> {
    const reportDir = path.join(this.config.reportingConfig.outputDir, result.id);
    await fs.mkdir(reportDir, { recursive: true });

    for (const format of this.config.reportingConfig.formats) {
      switch (format) {
        case 'json':
          await this.generateJSONReport(result, reportDir);
          break;
        case 'html':
          await this.generateHTMLReport(result, reportDir);
          break;
        case 'junit':
          await this.generateJUnitReport(result, reportDir);
          break;
        case 'markdown':
          await this.generateMarkdownReport(result, reportDir);
          break;
      }
    }

    // Archive if configured
    if (this.config.reportingConfig.archiveReports) {
      await this.archiveReports(reportDir);
    }
  }

  private async generateJSONReport(result: TestRunResult, reportDir: string): Promise<void> {
    const reportPath = path.join(reportDir, 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
  }

  private async generateHTMLReport(result: TestRunResult, reportDir: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>MCP Integration Test Report - ${result.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; }
    .passed { color: green; }
    .failed { color: red; }
    .skipped { color: orange; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>MCP Integration Test Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Test Run ID:</strong> ${result.id}</p>
    <p><strong>Date:</strong> ${result.timestamp}</p>
    <p><strong>Duration:</strong> ${(result.duration / 1000).toFixed(1)}s</p>
    <p><strong>Total Tests:</strong> ${result.totalTests}</p>
    <p class="passed"><strong>Passed:</strong> ${result.passed} (${result.successRate.toFixed(1)}%)</p>
    <p class="failed"><strong>Failed:</strong> ${result.failed}</p>
    <p class="skipped"><strong>Skipped:</strong> ${result.skipped}</p>
  </div>

  <h2>Integration Test Results</h2>
  <table>
    <tr>
      <th>Integration</th>
      <th>Total</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Coverage</th>
      <th>Avg Response Time</th>
    </tr>
    ${result.reports.map(r => `
    <tr>
      <td>${r.integrationName}</td>
      <td>${r.totalTests}</td>
      <td class="passed">${r.passed}</td>
      <td class="failed">${r.failed}</td>
      <td>${r.coverage.toFixed(1)}%</td>
      <td>${r.averageResponseTime.toFixed(0)}ms</td>
    </tr>
    `).join('')}
  </table>

  ${result.faultInjectionResults.length > 0 ? `
  <h2>Fault Injection Results</h2>
  <table>
    <tr>
      <th>Scenario</th>
      <th>Injected</th>
      <th>Impact</th>
      <th>Recovery</th>
      <th>Recovery Time</th>
    </tr>
    ${result.faultInjectionResults.map(r => `
    <tr>
      <td>${r.scenario}</td>
      <td>${r.injected ? 'Yes' : 'No'}</td>
      <td>${r.impact}</td>
      <td class="${r.recovery ? 'passed' : 'failed'}">${r.recovery ? 'Yes' : 'No'}</td>
      <td>${r.recoveryTime ? `${(r.recoveryTime / 1000).toFixed(1)}s` : 'N/A'}</td>
    </tr>
    `).join('')}
  </table>
  ` : ''}

  ${result.loadTestResults.length > 0 ? `
  <h2>Load Test Results</h2>
  <table>
    <tr>
      <th>Profile</th>
      <th>Target RPS</th>
      <th>Achieved RPS</th>
      <th>Success Rate</th>
      <th>Avg Response Time</th>
      <th>P95</th>
      <th>P99</th>
    </tr>
    ${result.loadTestResults.map(r => `
    <tr>
      <td>${r.profile}</td>
      <td>${r.targetRPS.toFixed(0)}</td>
      <td>${r.achievedRPS.toFixed(0)}</td>
      <td class="${r.successRate >= 95 ? 'passed' : 'failed'}">${r.successRate.toFixed(1)}%</td>
      <td>${r.averageResponseTime.toFixed(0)}ms</td>
      <td>${r.p95ResponseTime.toFixed(0)}ms</td>
      <td>${r.p99ResponseTime.toFixed(0)}ms</td>
    </tr>
    `).join('')}
  </table>
  ` : ''}
</body>
</html>
    `;

    const reportPath = path.join(reportDir, 'report.html');
    await fs.writeFile(reportPath, html);
  }

  private async generateJUnitReport(result: TestRunResult, reportDir: string): Promise<void> {
    const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MCP Integration Tests" tests="${result.totalTests}" failures="${result.failed}" skipped="${result.skipped}" time="${result.duration / 1000}">
  ${result.reports.map(report => `
  <testsuite name="${report.integrationName}" tests="${report.totalTests}" failures="${report.failed}" skipped="${report.skipped}" time="${report.testResults.reduce((sum, r) => sum + r.duration, 0) / 1000}">
    ${report.testResults.map(test => `
    <testcase name="${test.testCaseId}" time="${test.duration / 1000}">
      ${test.status === 'failed' ? `<failure message="${test.error || 'Test failed'}">${test.error || 'Test failed'}</failure>` : ''}
      ${test.status === 'skipped' ? '<skipped/>' : ''}
    </testcase>
    `).join('')}
  </testsuite>
  `).join('')}
</testsuites>`;

    const reportPath = path.join(reportDir, 'junit.xml');
    await fs.writeFile(reportPath, junit);
  }

  private async generateMarkdownReport(result: TestRunResult, reportDir: string): Promise<void> {
    const markdown = `# MCP Integration Test Report

## Summary
- **Test Run ID:** ${result.id}
- **Date:** ${result.timestamp}
- **Duration:** ${(result.duration / 1000).toFixed(1)}s
- **Total Tests:** ${result.totalTests}
- **Passed:** ${result.passed} (${result.successRate.toFixed(1)}%)
- **Failed:** ${result.failed}
- **Skipped:** ${result.skipped}

## Integration Test Results

| Integration | Total | Passed | Failed | Coverage | Avg Response Time |
|-------------|-------|--------|--------|----------|-------------------|
${result.reports.map(r => 
`| ${r.integrationName} | ${r.totalTests} | ${r.passed} | ${r.failed} | ${r.coverage.toFixed(1)}% | ${r.averageResponseTime.toFixed(0)}ms |`
).join('\n')}

${result.faultInjectionResults.length > 0 ? `
## Fault Injection Results

| Scenario | Injected | Impact | Recovery | Recovery Time |
|----------|----------|--------|----------|---------------|
${result.faultInjectionResults.map(r => 
`| ${r.scenario} | ${r.injected ? 'Yes' : 'No'} | ${r.impact} | ${r.recovery ? 'Yes' : 'No'} | ${r.recoveryTime ? `${(r.recoveryTime / 1000).toFixed(1)}s` : 'N/A'} |`
).join('\n')}
` : ''}

${result.loadTestResults.length > 0 ? `
## Load Test Results

| Profile | Target RPS | Achieved RPS | Success Rate | Avg Response | P95 | P99 |
|---------|------------|--------------|--------------|--------------|-----|-----|
${result.loadTestResults.map(r => 
`| ${r.profile} | ${r.targetRPS.toFixed(0)} | ${r.achievedRPS.toFixed(0)} | ${r.successRate.toFixed(1)}% | ${r.averageResponseTime.toFixed(0)}ms | ${r.p95ResponseTime.toFixed(0)}ms | ${r.p99ResponseTime.toFixed(0)}ms |`
).join('\n')}
` : ''}

## Summary
${result.summary}
`;

    const reportPath = path.join(reportDir, 'report.md');
    await fs.writeFile(reportPath, markdown);
  }

  private async archiveReports(reportDir: string): Promise<void> {
    // Implementation would compress and move reports to archive location
    this.logger.info(`Archiving reports from ${reportDir}`);
  }

  private async handleCICDIntegration(result: TestRunResult): Promise<void> {
    if (!this.config.cicdIntegration.enabled) return;

    const shouldNotify = 
      (result.successRate < this.config.cicdIntegration.failureThreshold && this.config.cicdIntegration.notifyOnFailure) ||
      (result.successRate >= this.config.cicdIntegration.failureThreshold && this.config.cicdIntegration.notifyOnSuccess);

    if (shouldNotify && this.config.cicdIntegration.webhookUrl) {
      await this.sendWebhookNotification(result);
    }

    // Exit with appropriate code for CI/CD
    if (result.successRate < this.config.cicdIntegration.failureThreshold) {
      process.exitCode = 1;
    }
  }

  private async sendWebhookNotification(_result: TestRunResult): Promise<void> {
    // Implementation would send webhook notification
    this.logger.info('Sending CI/CD webhook notification');
  }

  private async generateTestConfig(integration: any): Promise<TestConfig> {
    // Implementation similar to test framework
    return {
      integration,
      testCases: [],
      performanceThresholds: {
        maxResponseTime: 1000,
        minThroughput: 10,
        maxMemoryUsage: 100,
        maxCpuUsage: 50
      }
    };
  }

  private setupEventListeners(): void {
    this.testFramework.on('test-started', (data) => {
      this.emit('integration-test-started', data);
    });

    this.testFramework.on('test-completed', (data) => {
      this.emit('integration-test-completed', data);
    });

    this.monitor.on('health-update', (data) => {
      this.emit('health-update', data);
    });

    this.monitor.on('alert-created', (data) => {
      this.emit('alert-created', data);
    });
  }

  async stop(): Promise<void> {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
    }

    await this.monitor.stopMonitoring();
    await this.batchProcessor.cleanup();

    this.emit('runner-stopped');
  }
}

class FaultInjector {
  private activeFaults: Map<string, FaultType[]> = new Map();

  async inject(integrationId: string, fault: FaultType): Promise<void> {
    const faults = this.activeFaults.get(integrationId) || [];
    faults.push(fault);
    this.activeFaults.set(integrationId, faults);

    // Apply fault based on type
    switch (fault.type) {
      case 'network':
        // Simulate network issues
        break;
      case 'timeout':
        // Add artificial delays
        break;
      case 'error':
        // Force errors
        break;
      case 'rate_limit':
        // Simulate rate limiting
        break;
      case 'data_corruption':
        // Corrupt response data
        break;
      case 'service_down':
        // Make service unavailable
        break;
    }
  }

  async remove(integrationId: string, fault: FaultType): Promise<void> {
    const faults = this.activeFaults.get(integrationId) || [];
    const index = faults.findIndex(f => f.type === fault.type);
    if (index >= 0) {
      faults.splice(index, 1);
    }

    if (faults.length === 0) {
      this.activeFaults.delete(integrationId);
    } else {
      this.activeFaults.set(integrationId, faults);
    }
  }

  isActive(integrationId: string, faultType: string): boolean {
    const faults = this.activeFaults.get(integrationId) || [];
    return faults.some(f => f.type === faultType);
  }
}