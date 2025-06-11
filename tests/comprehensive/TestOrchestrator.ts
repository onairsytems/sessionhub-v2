import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { securityAudit } from '../security/SecurityAuditFramework';
import { performanceValidator } from '../performance/PerformanceValidationSystem';

export interface TestSuiteResult {
  category: string;
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  duration: number;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  errors?: string[];
}

export interface ComprehensiveTestResult {
  passed: boolean;
  score: number;
  timestamp: Date;
  duration: number;
  suites: TestSuiteResult[];
  security: {
    passed: boolean;
    score: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
  };
  performance: {
    passed: boolean;
    score: number;
    enterpriseReady: boolean;
  };
  coverage: {
    overall: number;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  qualityGates: {
    typescript: boolean;
    eslint: boolean;
    prettier: boolean;
    consoleStatements: boolean;
    buildSuccess: boolean;
  };
  productionReadiness: boolean;
}

export class TestOrchestrator {
  private results: TestSuiteResult[] = [];
  private startTime: number = 0;

  async runComprehensiveTests(): Promise<ComprehensiveTestResult> {
    console.log('🚀 Starting Comprehensive Testing & Security Audit...\n');
    this.startTime = Date.now();
    this.results = [];

    // Create test results directory
    const resultsDir = join(__dirname, '../../test-results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    // Run all test suites
    const [
      unitTests,
      integrationTests,
      e2eTests,
      twoActorTests,
      securityResults,
      performanceResults,
      qualityGates,
      coverage
    ] = await Promise.all([
      this.runUnitTests(),
      this.runIntegrationTests(),
      this.runE2ETests(),
      this.runTwoActorValidation(),
      this.runSecurityAudit(),
      this.runPerformanceValidation(),
      this.runQualityGates(),
      this.generateCoverageReport()
    ]);

    // Calculate overall results
    const duration = Date.now() - this.startTime;
    const allSuites = [unitTests, integrationTests, e2eTests, twoActorTests];
    const overallPassed = allSuites.every(suite => suite.passed) && 
                         securityResults.passed && 
                         performanceResults.passed &&
                         Object.values(qualityGates).every(gate => gate);

    const overallScore = this.calculateOverallScore(
      allSuites,
      securityResults.score,
      performanceResults.score,
      coverage.overall
    );

    const productionReadiness = this.assessProductionReadiness(
      overallPassed,
      overallScore,
      securityResults,
      performanceResults,
      coverage
    );

    const result: ComprehensiveTestResult = {
      passed: overallPassed,
      score: overallScore,
      timestamp: new Date(),
      duration,
      suites: allSuites,
      security: {
        passed: securityResults.passed,
        score: securityResults.score,
        criticalVulnerabilities: securityResults.vulnerabilities.filter(v => v.severity === 'critical').length,
        highVulnerabilities: securityResults.vulnerabilities.filter(v => v.severity === 'high').length
      },
      performance: {
        passed: performanceResults.passed,
        score: performanceResults.score,
        enterpriseReady: performanceResults.enterpriseReady
      },
      coverage,
      qualityGates,
      productionReadiness
    };

    // Generate comprehensive report
    await this.generateComprehensiveReport(result);

    return result;
  }

  private async runUnitTests(): Promise<TestSuiteResult> {
    console.log('🧪 Running Unit Tests...');
    const startTime = Date.now();

    try {
      const output = execSync('npm run test:unit -- --json --outputFile=test-results/unit-results.json', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const results = this.parseJestResults('test-results/unit-results.json');
      
      return {
        category: 'Unit Tests',
        passed: results.success,
        testsRun: results.numTotalTests,
        testsPassed: results.numPassedTests,
        testsFailed: results.numFailedTests,
        duration: Date.now() - startTime,
        coverage: results.coverageMap
      };
    } catch (error: any) {
      // Jest returns non-zero exit code on test failure
      const results = this.parseJestResults('test-results/unit-results.json');
      
      return {
        category: 'Unit Tests',
        passed: false,
        testsRun: results?.numTotalTests || 0,
        testsPassed: results?.numPassedTests || 0,
        testsFailed: results?.numFailedTests || 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  private async runIntegrationTests(): Promise<TestSuiteResult> {
    console.log('🔗 Running Integration Tests...');
    const startTime = Date.now();

    try {
      const output = execSync('npm run test:integration -- --json --outputFile=test-results/integration-results.json', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const results = this.parseJestResults('test-results/integration-results.json');
      
      return {
        category: 'Integration Tests',
        passed: results.success,
        testsRun: results.numTotalTests,
        testsPassed: results.numPassedTests,
        testsFailed: results.numFailedTests,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      const results = this.parseJestResults('test-results/integration-results.json');
      
      return {
        category: 'Integration Tests',
        passed: false,
        testsRun: results?.numTotalTests || 0,
        testsPassed: results?.numPassedTests || 0,
        testsFailed: results?.numFailedTests || 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  private async runE2ETests(): Promise<TestSuiteResult> {
    console.log('🌐 Running E2E Tests...');
    const startTime = Date.now();

    try {
      // Start the application server for E2E tests
      const appProcess = execSync('npm run dev &', { 
        encoding: 'utf-8',
        stdio: 'pipe',
        shell: true
      });

      // Wait for app to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Run E2E tests
      const output = execSync('npm run test:e2e', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      // Parse Playwright results
      const results = this.parsePlaywrightResults(output);

      // Kill the app process
      execSync('pkill -f "npm run dev"', { stdio: 'ignore' });

      return {
        category: 'E2E Tests',
        passed: results.passed,
        testsRun: results.total,
        testsPassed: results.passed ? results.total : 0,
        testsFailed: results.passed ? 0 : results.total,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      // Clean up app process on error
      try {
        execSync('pkill -f "npm run dev"', { stdio: 'ignore' });
      } catch {}

      return {
        category: 'E2E Tests',
        passed: false,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  private async runTwoActorValidation(): Promise<TestSuiteResult> {
    console.log('🎭 Running Two-Actor Architecture Validation...');
    const startTime = Date.now();

    try {
      const output = execSync('npm run test:two-actor', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const passed = output.includes('All tests passed');
      const testCount = (output.match(/✓/g) || []).length;

      return {
        category: 'Two-Actor Validation',
        passed,
        testsRun: testCount,
        testsPassed: passed ? testCount : 0,
        testsFailed: passed ? 0 : testCount,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        category: 'Two-Actor Validation',
        passed: false,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        duration: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  private async runSecurityAudit(): Promise<any> {
    console.log('🔐 Running Security Audit...');
    
    const result = await securityAudit.runComprehensiveAudit();
    await securityAudit.generateReport(result);
    
    return result;
  }

  private async runPerformanceValidation(): Promise<any> {
    console.log('⚡ Running Performance Validation...');
    
    const result = await performanceValidator.runEnterpriseValidation();
    await performanceValidator.generateReport(result);
    
    return result;
  }

  private async runQualityGates(): Promise<any> {
    console.log('🚦 Running Quality Gates...');
    
    const gates = {
      typescript: await this.checkTypeScript(),
      eslint: await this.checkESLint(),
      prettier: await this.checkPrettier(),
      consoleStatements: await this.checkConsoleStatements(),
      buildSuccess: await this.checkBuild()
    };

    return gates;
  }

  private async checkTypeScript(): Promise<boolean> {
    try {
      execSync('npm run build:check', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkESLint(): Promise<boolean> {
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkPrettier(): Promise<boolean> {
    try {
      execSync('npm run format:check', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkConsoleStatements(): Promise<boolean> {
    try {
      execSync('npm run console:check', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async checkBuild(): Promise<boolean> {
    try {
      execSync('npm run build', { stdio: 'pipe' });
      execSync('npm run build:electron', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private async generateCoverageReport(): Promise<any> {
    console.log('📊 Generating Coverage Report...');
    
    try {
      execSync('npm run test:coverage', { stdio: 'pipe' });
      
      // Read coverage summary
      const coveragePath = join(__dirname, '../../coverage/coverage-summary.json');
      if (existsSync(coveragePath)) {
        const coverage = JSON.parse(require('fs').readFileSync(coveragePath, 'utf-8'));
        const total = coverage.total;
        
        return {
          overall: Math.round((total.statements.pct + total.branches.pct + total.functions.pct + total.lines.pct) / 4),
          statements: total.statements.pct,
          branches: total.branches.pct,
          functions: total.functions.pct,
          lines: total.lines.pct
        };
      }
    } catch (error) {
      console.error('Coverage generation failed:', error);
    }

    return {
      overall: 0,
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    };
  }

  private parseJestResults(filepath: string): any {
    try {
      if (existsSync(filepath)) {
        return JSON.parse(require('fs').readFileSync(filepath, 'utf-8'));
      }
    } catch (error) {
      console.error(`Failed to parse Jest results from ${filepath}:`, error);
    }
    
    return {
      success: false,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0
    };
  }

  private parsePlaywrightResults(output: string): any {
    const totalMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    
    return {
      total: total + failed,
      passed: failed === 0
    };
  }

  private calculateOverallScore(
    suites: TestSuiteResult[],
    securityScore: number,
    performanceScore: number,
    coverageScore: number
  ): number {
    // Calculate test suite score
    const suiteScores = suites.map(suite => {
      if (suite.testsRun === 0) return 0;
      return (suite.testsPassed / suite.testsRun) * 100;
    });
    
    const avgSuiteScore = suiteScores.reduce((a, b) => a + b, 0) / suiteScores.length;
    
    // Weighted average of all scores
    const weights = {
      tests: 0.3,
      security: 0.3,
      performance: 0.2,
      coverage: 0.2
    };
    
    const overallScore = 
      avgSuiteScore * weights.tests +
      securityScore * weights.security +
      performanceScore * weights.performance +
      coverageScore * weights.coverage;
    
    return Math.round(overallScore);
  }

  private assessProductionReadiness(
    passed: boolean,
    score: number,
    security: any,
    performance: any,
    coverage: any
  ): boolean {
    // Production readiness criteria
    const criteria = [
      passed, // All tests passed
      score >= 95, // Overall score 95+
      security.criticalVulnerabilities === 0, // No critical vulnerabilities
      security.highVulnerabilities === 0, // No high vulnerabilities
      performance.enterpriseReady, // Performance validated for enterprise
      coverage.overall >= 90 // 90%+ test coverage
    ];
    
    return criteria.every(criterion => criterion === true);
  }

  private async generateComprehensiveReport(result: ComprehensiveTestResult): Promise<void> {
    const reportPath = join(__dirname, '../../test-results/comprehensive-test-report.md');
    
    let report = `# Comprehensive Test & Security Audit Report\n\n`;
    report += `**Date:** ${result.timestamp.toISOString()}\n`;
    report += `**Duration:** ${(result.duration / 1000).toFixed(2)}s\n`;
    report += `**Overall Score:** ${result.score}/100\n`;
    report += `**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `**Production Ready:** ${result.productionReadiness ? '✅ YES' : '❌ NO'}\n\n`;
    
    // Test Suites Summary
    report += `## Test Suites Summary\n\n`;
    report += `| Suite | Result | Tests Run | Passed | Failed | Coverage |\n`;
    report += `|-------|--------|-----------|---------|---------|----------|\n`;
    
    result.suites.forEach(suite => {
      const resultIcon = suite.passed ? '✅' : '❌';
      const coverage = suite.coverage ? `${suite.coverage.lines}%` : 'N/A';
      report += `| ${suite.category} | ${resultIcon} | ${suite.testsRun} | ${suite.testsPassed} | ${suite.testsFailed} | ${coverage} |\n`;
    });
    
    // Security Summary
    report += `\n## Security Audit Summary\n\n`;
    report += `- **Security Score:** ${result.security.score}/100\n`;
    report += `- **Result:** ${result.security.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Critical Vulnerabilities:** ${result.security.criticalVulnerabilities}\n`;
    report += `- **High Vulnerabilities:** ${result.security.highVulnerabilities}\n`;
    
    // Performance Summary
    report += `\n## Performance Validation Summary\n\n`;
    report += `- **Performance Score:** ${result.performance.score}/100\n`;
    report += `- **Result:** ${result.performance.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- **Enterprise Ready:** ${result.performance.enterpriseReady ? '✅ YES' : '❌ NO'}\n`;
    
    // Coverage Summary
    report += `\n## Code Coverage Summary\n\n`;
    report += `- **Overall Coverage:** ${result.coverage.overall}%\n`;
    report += `- **Statements:** ${result.coverage.statements}%\n`;
    report += `- **Branches:** ${result.coverage.branches}%\n`;
    report += `- **Functions:** ${result.coverage.functions}%\n`;
    report += `- **Lines:** ${result.coverage.lines}%\n`;
    
    // Quality Gates
    report += `\n## Quality Gates\n\n`;
    report += `| Gate | Status |\n`;
    report += `|------|--------|\n`;
    report += `| TypeScript Compilation | ${result.qualityGates.typescript ? '✅ PASS' : '❌ FAIL'} |\n`;
    report += `| ESLint | ${result.qualityGates.eslint ? '✅ PASS' : '❌ FAIL'} |\n`;
    report += `| Prettier | ${result.qualityGates.prettier ? '✅ PASS' : '❌ FAIL'} |\n`;
    report += `| Console Statements | ${result.qualityGates.consoleStatements ? '✅ PASS' : '❌ FAIL'} |\n`;
    report += `| Build Success | ${result.qualityGates.buildSuccess ? '✅ PASS' : '❌ FAIL'} |\n`;
    
    // Production Readiness Checklist
    report += `\n## Production Readiness Checklist\n\n`;
    const checklist = [
      { item: 'All tests passing', checked: result.passed },
      { item: 'Quality score 95+', checked: result.score >= 95 },
      { item: 'No critical vulnerabilities', checked: result.security.criticalVulnerabilities === 0 },
      { item: 'No high vulnerabilities', checked: result.security.highVulnerabilities === 0 },
      { item: 'Enterprise performance validated', checked: result.performance.enterpriseReady },
      { item: 'Code coverage 90%+', checked: result.coverage.overall >= 90 },
      { item: 'All quality gates passing', checked: Object.values(result.qualityGates).every(g => g) }
    ];
    
    checklist.forEach(item => {
      report += `- [${item.checked ? 'x' : ' '}] ${item.item}\n`;
    });
    
    // Certification
    if (result.productionReadiness) {
      report += `\n## 🏆 Production Readiness Certification\n\n`;
      report += `This application has passed all comprehensive tests and security audits.\n`;
      report += `It is certified as **PRODUCTION READY** for enterprise deployment.\n`;
    } else {
      report += `\n## ⚠️ Not Production Ready\n\n`;
      report += `This application has not met all production readiness criteria.\n`;
      report += `Please address the failing tests and security issues before deployment.\n`;
    }
    
    writeFileSync(reportPath, report);
    console.log(`\n📄 Comprehensive test report generated: ${reportPath}`);
  }
}

// Export singleton instance
export const testOrchestrator = new TestOrchestrator();

// CLI runner
if (require.main === module) {
  testOrchestrator.runComprehensiveTests().then(result => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`COMPREHENSIVE TEST RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Overall Score: ${result.score}/100`);
    console.log(`Production Ready: ${result.productionReadiness ? '✅ YES' : '❌ NO'}`);
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(result.passed ? 0 : 1);
  }).catch(error => {
    console.error('Test orchestration failed:', error);
    process.exit(1);
  });
}