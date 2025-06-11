/**
 * Comprehensive Testing Framework for SessionHub
 * Orchestrates all testing components with automated validation and issue tracking
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Import all testing components
import { 
  AdvancedTestingMode, 
  getTestingMode,
  DiagnosticInfo,
  TestExecutionContext
} from './AdvancedTestingMode';

import { 
  SafeTestingEnvironment, 
  getSafeTestingEnvironment,
  TestEnvironment
} from './SafeTestingEnvironment';

import { 
  SessionInspector, 
  getSessionInspector
} from './SessionInspector';

import type {
  SessionState
} from './SessionInspector';

import { 
  getProductionValidator
} from './ProductionReadinessValidator';

import type {
  ProductionReadinessReport
} from './ProductionReadinessValidator';

import { 
  getIntegrationValidator
} from './IntegrationValidator';

import type {
  IntegrationReport
} from './IntegrationValidator';

import { 
  getPerformanceBenchmark
} from './PerformanceBenchmark';

import type {
  PerformanceReport
} from './PerformanceBenchmark';

import { 
  getSecurityAudit
} from './SecurityAuditFramework';

import type {
  SecurityAuditReport
} from './SecurityAuditFramework';

import { 
  getIssueIdentifier,
  TestingIssueIdentifier
} from './TestingIssueIdentifier';

import type {
  TestingIssue
} from './TestingIssueIdentifier';

export interface TestingConfiguration {
  mode: 'development' | 'staging' | 'production';
  enableAdvancedDebugging: boolean;
  enableSafeEnvironment: boolean;
  enableSessionInspection: boolean;
  enableIssueTracking: boolean;
  runProductionValidation: boolean;
  runIntegrationTests: boolean;
  runPerformanceBenchmarks: boolean;
  runSecurityAudit: boolean;
  testDataPath?: string;
  reportPath?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: Test[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface Test {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  runner: () => Promise<TestResult>;
  timeout?: number;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  duration: number;
  message?: string;
  error?: Error;
  diagnostics?: DiagnosticInfo[];
}

export interface ComprehensiveTestReport {
  timestamp: Date;
  configuration: TestingConfiguration;
  summary: TestingSummary;
  testResults: TestResult[];
  productionReadiness?: ProductionReadinessReport;
  integrationStatus?: IntegrationReport;
  performanceMetrics?: PerformanceReport;
  securityAudit?: SecurityAuditReport;
  issues: TestingIssue[];
  recommendations: string[];
}

export interface TestingSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  testCoverage?: number;
  readinessScore: number;
}

export class ComprehensiveTestingFramework extends EventEmitter {
  private config: TestingConfiguration;
  private testingMode?: AdvancedTestingMode;
  private safeEnvironment?: SafeTestingEnvironment;
  private sessionInspector?: SessionInspector;
  private issueIdentifier?: TestingIssueIdentifier;
  private testSuites: Map<string, TestSuite> = new Map();
  private activeSession?: SessionState;
  private testResults: TestResult[] = [];

  constructor(config: Partial<TestingConfiguration> = {}) {
    super();
    this.config = {
      mode: 'development',
      enableAdvancedDebugging: true,
      enableSafeEnvironment: true,
      enableSessionInspection: true,
      enableIssueTracking: true,
      runProductionValidation: true,
      runIntegrationTests: true,
      runPerformanceBenchmarks: true,
      runSecurityAudit: true,
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    // Initialize components based on configuration
    if (this.config.enableAdvancedDebugging) {
      this.testingMode = getTestingMode({
        enabled: true,
        debugLevel: 'verbose',
        performanceMonitoring: true,
        memoryProfiling: true,
        networkTracing: true,
        errorStackTraces: true,
        timingAnalysis: true,
        isolationMode: this.config.enableSafeEnvironment
      });
    }

    if (this.config.enableSafeEnvironment) {
      this.safeEnvironment = getSafeTestingEnvironment(this.config.testDataPath);
    }

    if (this.config.enableSessionInspection) {
      this.sessionInspector = getSessionInspector({
        captureSystemMetrics: true,
        captureNetworkActivity: true,
        captureFileSystemChanges: true,
        verboseLogging: this.config.mode === 'development',
        realTimeUpdates: true,
        persistInspectionData: true
      });
    }

    if (this.config.enableIssueTracking) {
      this.issueIdentifier = getIssueIdentifier({
        storagePath: path.join(this.config.testDataPath || '.', 'issues'),
        autoClassify: true
      });
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Forward events from components
    if (this.testingMode) {
      this.testingMode.on('diagnostic', (diagnostic: DiagnosticInfo) => {
        this.emit('diagnostic', diagnostic);
        
        // Track errors as issues
        if (diagnostic.level === 'error' || diagnostic.level === 'critical') {
          this.trackIssueFromDiagnostic(diagnostic);
        }
      });
    }

    if (this.sessionInspector) {
      this.sessionInspector.on('error:recorded', ({ error }) => {
        this.trackIssueFromError(error);
      });
    }
  }

  /**
   * Register a test suite
   */
  public registerTestSuite(suite: TestSuite): void {
    this.testSuites.set(suite.id, suite);
    this.emit('suite:registered', suite);
  }

  /**
   * Run all tests
   */
  public async runAllTests(): Promise<ComprehensiveTestReport> {
    this.emit('testing:start');
    const startTime = Date.now();
    this.testResults = [];

    // Create safe testing environment if enabled
    let testEnvironment: TestEnvironment | undefined;
    if (this.config.enableSafeEnvironment && this.safeEnvironment) {
      testEnvironment = this.safeEnvironment.createEnvironment('comprehensive-test', {
        enableFileSystemIsolation: true,
        enableDatabaseIsolation: true,
        enableNetworkIsolation: true,
        enableProcessIsolation: true,
        mockExternalServices: true,
        preserveTestData: this.config.mode === 'development'
      });
      this.safeEnvironment.activateEnvironment(testEnvironment.id);
    }

    // Start session inspection if enabled
    if (this.config.enableSessionInspection && this.sessionInspector) {
      this.activeSession = this.sessionInspector.startSession(
        `test-session-${Date.now()}`,
        'Comprehensive Testing Session'
      );
    }

    try {
      // Run test suites
      await this.runTestSuites();

      // Run validation frameworks
      const validationReports = await this.runValidationFrameworks();

      // Generate comprehensive report
      const report = await this.generateComprehensiveReport(
        startTime,
        validationReports
      );

      this.emit('testing:complete', report);
      return report;

    } finally {
      // Cleanup
      if (testEnvironment && this.safeEnvironment) {
        this.safeEnvironment.deactivateEnvironment();
      }

      if (this.activeSession && this.sessionInspector) {
        this.sessionInspector.completeSession(this.activeSession.id);
      }
    }
  }

  /**
   * Run all test suites
   */
  private async runTestSuites(): Promise<void> {
    for (const [, suite] of this.testSuites) {
      this.emit('suite:start', suite);

      // Setup
      if (suite.setup) {
        await suite.setup();
      }

      // Run tests
      for (const test of suite.tests) {
        const result = await this.runTest(test);
        this.testResults.push(result);
      }

      // Teardown
      if (suite.teardown) {
        await suite.teardown();
      }

      this.emit('suite:complete', suite);
    }
  }

  /**
   * Run individual test
   */
  private async runTest(test: Test): Promise<TestResult> {
    this.emit('test:start', test);

    let testContext: TestExecutionContext | undefined;
    if (this.testingMode) {
      testContext = this.testingMode.startTestContext(test.id, test.name);
    }

    const startTime = Date.now();
    let result: TestResult;

    try {
      // Run with timeout if specified
      const testPromise = test.runner();
      const timeoutPromise = test.timeout
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), test.timeout)
          )
        : null;

      const testResult = timeoutPromise
        ? await Promise.race([testPromise, timeoutPromise])
        : await testPromise;

      result = {
        ...testResult,
        duration: Date.now() - startTime
      };

    } catch (error) {
      result = {
        testId: test.id,
        passed: false,
        duration: Date.now() - startTime,
        message: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error))
      };

      // Track as issue
      if (this.issueIdentifier) {
        this.issueIdentifier.createIssue({
          title: `Test failure: ${test.name}`,
          description: (error instanceof Error ? error.message : String(error)) || 'Unknown error',
          source: {
            type: 'automated-test',
            testId: test.id,
            testName: test.name
          },
          category: 'functional',
          severity: 'high',
          stackTrace: (error as Error).stack,
          reproducible: true
        });
      }
    }

    if (testContext && this.testingMode) {
      this.testingMode.endTestContext(test.id, result.passed ? 'passed' : 'failed');
      result.diagnostics = testContext.diagnostics;
    }

    this.emit('test:complete', { test, result });
    return result;
  }

  /**
   * Run validation frameworks
   */
  private async runValidationFrameworks(): Promise<{
    productionReadiness?: ProductionReadinessReport;
    integrationStatus?: IntegrationReport;
    performanceMetrics?: PerformanceReport;
    securityAudit?: SecurityAuditReport;
  }> {
    const reports: any = {};

    if (this.config.runProductionValidation) {
      this.emit('validation:production:start');
      try {
        reports.productionReadiness = await getProductionValidator().validate();
        this.emit('validation:production:complete', reports.productionReadiness);
      } catch (error) {
        this.emit('validation:production:error', error);
        this.trackIssueFromError(error instanceof Error ? error : new Error(String(error)), 'Production Validation');
      }
    }

    if (this.config.runIntegrationTests) {
      this.emit('validation:integration:start');
      try {
        reports.integrationStatus = await getIntegrationValidator().validateAll();
        this.emit('validation:integration:complete', reports.integrationStatus);
      } catch (error) {
        this.emit('validation:integration:error', error);
        this.trackIssueFromError(error instanceof Error ? error : new Error(String(error)), 'Integration Validation');
      }
    }

    if (this.config.runPerformanceBenchmarks) {
      this.emit('validation:performance:start');
      try {
        reports.performanceMetrics = await getPerformanceBenchmark().runAll();
        this.emit('validation:performance:complete', reports.performanceMetrics);
      } catch (error) {
        this.emit('validation:performance:error', error);
        this.trackIssueFromError(error instanceof Error ? error : new Error(String(error)), 'Performance Benchmarks');
      }
    }

    if (this.config.runSecurityAudit) {
      this.emit('validation:security:start');
      try {
        reports.securityAudit = await getSecurityAudit().runAudit();
        this.emit('validation:security:complete', reports.securityAudit);
      } catch (error) {
        this.emit('validation:security:error', error);
        this.trackIssueFromError(error instanceof Error ? error : new Error(String(error)), 'Security Audit');
      }
    }

    return reports;
  }

  /**
   * Track issue from diagnostic
   */
  private trackIssueFromDiagnostic(diagnostic: DiagnosticInfo): void {
    if (!this.issueIdentifier) return;

    this.issueIdentifier.createIssue({
      title: `Diagnostic ${diagnostic.level}: ${diagnostic.category}`,
      description: diagnostic.message,
      source: {
        type: 'automated-test',
        tool: 'AdvancedTestingMode'
      },
      category: diagnostic.type === 'performance' ? 'performance' : 
                diagnostic.type === 'error' ? 'functional' : 'functional',
      severity: diagnostic.level === 'critical' ? 'critical' : 
                diagnostic.level === 'error' ? 'high' : 'medium',
      stackTrace: diagnostic.stack
    });
  }

  /**
   * Track issue from error
   */
  private trackIssueFromError(error: Error, context?: string): void {
    if (!this.issueIdentifier) return;

    this.issueIdentifier.createIssue({
      title: context ? `${context}: ${error.name}` : error.name,
      description: error.message,
      source: {
        type: 'automated-test',
        tool: 'ComprehensiveTestingFramework'
      },
      category: 'functional',
      severity: 'high',
      stackTrace: error.stack
    });
  }

  /**
   * Generate comprehensive report
   */
  private async generateComprehensiveReport(
    startTime: number,
    validationReports: any
  ): Promise<ComprehensiveTestReport> {
    const duration = Date.now() - startTime;

    // Calculate summary
    const summary: TestingSummary = {
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.passed).length,
      failedTests: this.testResults.filter(r => !r.passed).length,
      skippedTests: 0,
      totalDuration: duration,
      readinessScore: this.calculateReadinessScore(validationReports)
    };

    // Get test coverage if available
    try {
      const coverageResult = execSync('npm run test:coverage -- --json', { encoding: 'utf-8' });
      const coverage = JSON.parse(coverageResult);
      if (coverage.total && coverage.total.statements) {
        summary.testCoverage = coverage.total.statements.pct;
      }
    } catch {
      // Coverage not available
    }

    // Get all issues
    const issues = this.issueIdentifier ? this.issueIdentifier.getAllIssues() : [];

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, validationReports, issues);

    const report: ComprehensiveTestReport = {
      timestamp: new Date(),
      configuration: this.config,
      summary,
      testResults: this.testResults,
      ...validationReports,
      issues,
      recommendations
    };

    // Save report if path specified
    if (this.config.reportPath) {
      await this.saveReport(report);
    }

    return report;
  }

  /**
   * Calculate overall readiness score
   */
  private calculateReadinessScore(validationReports: any): number {
    const scores: number[] = [];

    // Test pass rate
    if (this.testResults.length > 0) {
      const passRate = this.testResults.filter(r => r.passed).length / this.testResults.length;
      scores.push(passRate * 100);
    }

    // Production readiness score
    if (validationReports.productionReadiness) {
      scores.push(validationReports.productionReadiness.overallScore);
    }

    // Integration health
    if (validationReports.integrationStatus) {
      const integrationScore = (validationReports.integrationStatus.healthyServices / 
                               validationReports.integrationStatus.totalServices) * 100;
      scores.push(integrationScore);
    }

    // Performance grade
    if (validationReports.performanceMetrics) {
      const gradeMap: Record<string, number> = {
        'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50
      };
      const gradeScore = gradeMap[validationReports.performanceMetrics.grade] || 50;
      scores.push(gradeScore);
    }

    // Security compliance
    if (validationReports.securityAudit) {
      scores.push(validationReports.securityAudit.complianceScore);
    }

    return scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    summary: TestingSummary,
    validationReports: any,
    issues: TestingIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // Test failures
    if (summary.failedTests > 0) {
      recommendations.push(`Fix ${summary.failedTests} failing tests before deployment`);
    }

    // Test coverage
    if (summary.testCoverage && summary.testCoverage < 80) {
      recommendations.push(`Increase test coverage from ${summary.testCoverage}% to at least 80%`);
    }

    // Readiness score
    if (summary.readinessScore < 90) {
      recommendations.push('Address identified issues to achieve production readiness score of 90% or higher');
    }

    // Critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`Resolve ${criticalIssues.length} critical issues immediately`);
    }

    // Add recommendations from validation reports
    if (validationReports.productionReadiness?.recommendations) {
      recommendations.push(...validationReports.productionReadiness.recommendations);
    }

    if (validationReports.integrationStatus?.recommendations) {
      recommendations.push(...validationReports.integrationStatus.recommendations);
    }

    if (validationReports.performanceMetrics?.recommendations) {
      recommendations.push(...validationReports.performanceMetrics.recommendations);
    }

    if (validationReports.securityAudit?.recommendations) {
      recommendations.push(...validationReports.securityAudit.recommendations);
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Save report to file
   */
  private async saveReport(report: ComprehensiveTestReport): Promise<void> {
    if (!this.config.reportPath) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `comprehensive-test-report-${timestamp}.json`;
    const filepath = path.join(this.config.reportPath, filename);

    fs.mkdirSync(this.config.reportPath, { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

    // Also generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = filepath.replace('.json', '.md');
    fs.writeFileSync(markdownPath, markdownReport);

    this.emit('report:saved', { json: filepath, markdown: markdownPath });
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: ComprehensiveTestReport): string {
    const lines: string[] = [];

    lines.push('# Comprehensive Testing Report');
    lines.push(`Generated: ${report.timestamp.toISOString()}`);
    lines.push(`Mode: ${report.configuration.mode}`);
    lines.push('');

    lines.push('## Summary');
    lines.push(`- **Readiness Score**: ${report.summary.readinessScore}%`);
    lines.push(`- **Total Tests**: ${report.summary.totalTests}`);
    lines.push(`- **Passed**: ${report.summary.passedTests}`);
    lines.push(`- **Failed**: ${report.summary.failedTests}`);
    if (report.summary.testCoverage) {
      lines.push(`- **Test Coverage**: ${report.summary.testCoverage}%`);
    }
    lines.push(`- **Duration**: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    lines.push('');

    // Test Results
    if (report.testResults.length > 0) {
      lines.push('## Test Results');
      const failedTests = report.testResults.filter(r => !r.passed);
      if (failedTests.length > 0) {
        lines.push('### Failed Tests');
        failedTests.forEach(test => {
          lines.push(`- **${test.testId}**: ${test.message || 'Test failed'}`);
        });
        lines.push('');
      }
    }

    // Production Readiness
    if (report.productionReadiness) {
      lines.push('## Production Readiness');
      lines.push(`Status: ${report.productionReadiness.status.toUpperCase()}`);
      lines.push(`Score: ${report.productionReadiness.overallScore}%`);
      if (report.productionReadiness.criticalIssues.length > 0) {
        lines.push(`Critical Issues: ${report.productionReadiness.criticalIssues.length}`);
      }
      lines.push('');
    }

    // Integration Status
    if (report.integrationStatus) {
      lines.push('## Integration Status');
      lines.push(`Healthy Services: ${report.integrationStatus.healthyServices}/${report.integrationStatus.totalServices}`);
      if (report.integrationStatus.criticalFailures.length > 0) {
        lines.push('### Critical Failures');
        report.integrationStatus.criticalFailures.forEach(failure => {
          lines.push(`- ${failure.service}: ${failure.message}`);
        });
      }
      lines.push('');
    }

    // Performance
    if (report.performanceMetrics) {
      lines.push('## Performance Metrics');
      lines.push(`Grade: ${report.performanceMetrics.grade}`);
      lines.push(`Average Score: ${report.performanceMetrics.summary.averageScore}%`);
      lines.push('');
    }

    // Security
    if (report.securityAudit) {
      lines.push('## Security Audit');
      lines.push(`Compliance Score: ${report.securityAudit.complianceScore}%`);
      lines.push(`Overall Risk: ${report.securityAudit.summary.overallRisk.toUpperCase()}`);
      lines.push(`Critical Vulnerabilities: ${report.securityAudit.summary.criticalVulnerabilities}`);
      lines.push('');
    }

    // Issues
    if (report.issues.length > 0) {
      lines.push('## Issues Identified');
      const criticalIssues = report.issues.filter(i => i.severity === 'critical');
      const highIssues = report.issues.filter(i => i.severity === 'high');
      
      if (criticalIssues.length > 0) {
        lines.push('### Critical Issues');
        criticalIssues.forEach(issue => {
          lines.push(`- ${issue.title}: ${issue.description}`);
        });
        lines.push('');
      }
      
      if (highIssues.length > 0) {
        lines.push('### High Priority Issues');
        highIssues.forEach(issue => {
          lines.push(`- ${issue.title}: ${issue.description}`);
        });
        lines.push('');
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Run specific test suite
   */
  public async runTestSuite(suiteId: string): Promise<TestResult[]> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`);
    }

    const results: TestResult[] = [];

    if (suite.setup) {
      await suite.setup();
    }

    for (const test of suite.tests) {
      const result = await this.runTest(test);
      results.push(result);
    }

    if (suite.teardown) {
      await suite.teardown();
    }

    return results;
  }

  /**
   * Get testing status
   */
  public getStatus(): {
    activeTests: number;
    completedTests: number;
    failedTests: number;
    issues: number;
    readinessScore: number;
  } {
    return {
      activeTests: this.testSuites.size,
      completedTests: this.testResults.filter(r => r.passed).length,
      failedTests: this.testResults.filter(r => !r.passed).length,
      issues: this.issueIdentifier ? this.issueIdentifier.getAllIssues().length : 0,
      readinessScore: 0 // Will be calculated after full test run
    };
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    if (this.testingMode) {
      this.testingMode.cleanup();
    }

    if (this.safeEnvironment) {
      this.safeEnvironment.cleanupAll();
    }

    if (this.sessionInspector) {
      this.sessionInspector.cleanup();
    }

    this.testSuites.clear();
    this.testResults = [];
  }
}

// Export singleton instance and helper functions
let frameworkInstance: ComprehensiveTestingFramework | null = null;

export const getTestingFramework = (
  config?: Partial<TestingConfiguration>
): ComprehensiveTestingFramework => {
  if (!frameworkInstance) {
    frameworkInstance = new ComprehensiveTestingFramework(config);
  }
  return frameworkInstance;
};

export const runComprehensiveTests = async (
  config?: Partial<TestingConfiguration>
): Promise<ComprehensiveTestReport> => {
  const framework = getTestingFramework(config);
  return framework.runAllTests();
};

// Components are re-exported from index.ts to avoid duplicate exports