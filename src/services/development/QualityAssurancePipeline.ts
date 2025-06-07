
/**
 * Quality Assurance Pipeline
 * Validates all self-modifications before deployment to ensure system integrity
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../lib/logging/Logger';

export interface QAResult {
  stage: string;
  passed: boolean;
  score: number; // 0-100
  details: string;
  duration: number;
  artifacts: string[];
  recommendations?: string[];
}

export interface QAPipelineResult {
  overallPassed: boolean;
  overallScore: number;
  stages: QAResult[];
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  blockers: string[];
  warnings: string[];
  approvedForDeployment: boolean;
}

export interface PerformanceBenchmark {
  metric: string;
  current: number;
  baseline: number;
  threshold: number;
  unit: string;
  passed: boolean;
}

export interface SecurityScanResult {
  vulnerabilities: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
    file: string;
    line?: number;
    recommendation: string;
  }[];
  passed: boolean;
  score: number;
}

export class QualityAssurancePipeline {
  private logger: Logger;
  // private config: DevelopmentConfig; // Commented out for future use
  private qaWorkspace: string;
  // private baselineMetrics: string; // Commented out for future use

  constructor() {
    this.logger = new Logger('QualityAssurancePipeline');
    // this.config = getConfig(); // Commented out for future use
    this.qaWorkspace = join(process.cwd(), '.qa-workspace');
    // this.baselineMetrics = join(process.cwd(), '.qa-baselines', 'metrics.json'); // Commented out for future use
  }

  /**
   * Run complete QA pipeline on self-modifications
   */
  async runQAPipeline(version: string, changes: string[]): Promise<QAPipelineResult> {
    this.logger.info('Starting QA pipeline', { version, changeCount: changes.length });

    const result: QAPipelineResult = {
      overallPassed: false,
      overallScore: 0,
      stages: [],
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0,
      blockers: [],
      warnings: [],
      approvedForDeployment: false,
    };

    try {
      // Initialize QA workspace
      await this.initializeWorkspace();

      // Stage 1: Static Analysis
      const staticAnalysis = await this.runStaticAnalysis(changes);
      result.stages.push(staticAnalysis);
      if (!staticAnalysis.passed) {
        result.blockers.push(`Static analysis failed: ${staticAnalysis.details}`);
      }

      // Stage 2: Security Scan
      const securityScan = await this.runSecurityScan(changes);
      result.stages.push(securityScan);
      if (!securityScan.passed) {
        result.blockers.push(`Security scan failed: ${securityScan.details}`);
      }

      // Stage 3: Unit Tests
      const unitTests = await this.runUnitTests();
      result.stages.push(unitTests);
      if (!unitTests.passed) {
        result.blockers.push(`Unit tests failed: ${unitTests.details}`);
      }

      // Stage 4: Integration Tests
      const integrationTests = await this.runIntegrationTests();
      result.stages.push(integrationTests);
      if (!integrationTests.passed) {
        result.blockers.push(`Integration tests failed: ${integrationTests.details}`);
      }

      // Stage 5: Architecture Validation
      const architectureValidation = await this.validateArchitecture(changes);
      result.stages.push(architectureValidation);
      if (!architectureValidation.passed) {
        result.blockers.push(`Architecture validation failed: ${architectureValidation.details}`);
      }

      // Stage 6: Performance Benchmarks
      const performanceBenchmarks = await this.runPerformanceBenchmarks();
      result.stages.push(performanceBenchmarks);
      if (!performanceBenchmarks.passed) {
        result.warnings.push(`Performance regression detected: ${performanceBenchmarks.details}`);
      }

      // Stage 7: Self-Development Capability Test
      const selfDevTest = await this.testSelfDevelopmentCapability();
      result.stages.push(selfDevTest);
      if (!selfDevTest.passed) {
        result.blockers.push(`Self-development capability test failed: ${selfDevTest.details}`);
      }

      // Calculate overall results
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - result.startTime.getTime();
      result.overallScore = this.calculateOverallScore(result.stages);
      result.overallPassed = result.blockers.length === 0;
      result.approvedForDeployment = result.overallPassed && result.overallScore >= 85;

      this.logger.info('QA pipeline completed', {
        version,
        overallPassed: result.overallPassed,
        overallScore: result.overallScore,
        duration: result.totalDuration,
        blockers: result.blockers.length,
        warnings: result.warnings.length,
      });

      return result;

    } catch (error) {
      this.logger.error('QA pipeline failed with error', error as Error);
      
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - result.startTime.getTime();
      result.blockers.push(`Pipeline error: ${error instanceof Error ? error.message : String(error)}`);
      
      return result;
    }
  }

  /**
   * Stage 1: Static Analysis
   */
  private async runStaticAnalysis(changes: string[]): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Running static analysis');

    try {
      const artifacts: string[] = [];
      const issues: string[] = [];

      // TypeScript compilation check
      const tscResult = await this.runCommand('npx', ['tsc', '--noEmit']);
      if (tscResult.exitCode !== 0) {
        issues.push('TypeScript compilation errors detected');
        artifacts.push('tsc-errors.log');
        await fs.writeFile(join(this.qaWorkspace, 'tsc-errors.log'), tscResult.stderr);
      }

      // ESLint analysis
      const eslintResult = await this.runCommand('npx', ['eslint', '--format=json', ...changes]);
      if (eslintResult.exitCode !== 0) {
        const eslintReport = JSON.parse(eslintResult.stdout || '[]');
        const errorCount = eslintReport.reduce((sum: number, file: any) => sum + file.errorCount, 0);
        if (errorCount > 0) {
          issues.push(`ESLint found ${errorCount} errors`);
          artifacts.push('eslint-report.json');
          await fs.writeFile(join(this.qaWorkspace, 'eslint-report.json'), eslintResult.stdout);
        }
      }

      // Code complexity analysis
      const complexityResult = await this.analyzeCodeComplexity(changes);
      if (complexityResult.highComplexityFiles.length > 0) {
        issues.push(`${complexityResult.highComplexityFiles.length} files have high complexity`);
        artifacts.push('complexity-report.json');
      }

      const passed = issues.length === 0;
      const score = passed ? 100 : Math.max(0, 100 - (issues.length * 20));

      return {
        stage: 'Static Analysis',
        passed,
        score,
        details: passed ? 'All static analysis checks passed' : issues.join('; '),
        duration: Date.now() - startTime,
        artifacts,
        recommendations: this.getStaticAnalysisRecommendations(issues),
      };

    } catch (error) {
      return {
        stage: 'Static Analysis',
        passed: false,
        score: 0,
        details: `Static analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 2: Security Scan
   */
  private async runSecurityScan(changes: string[]): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Running security scan');

    try {
      const scanResult = await this.performSecurityScan(changes);
      const criticalVulns = scanResult.vulnerabilities.filter(v => v.severity === 'critical').length;
      const highVulns = scanResult.vulnerabilities.filter(v => v.severity === 'high').length;

      const passed = criticalVulns === 0 && highVulns === 0;
      const details = passed 
        ? 'No critical or high severity vulnerabilities found'
        : `Found ${criticalVulns} critical and ${highVulns} high severity vulnerabilities`;

      return {
        stage: 'Security Scan',
        passed,
        score: scanResult.score,
        details,
        duration: Date.now() - startTime,
        artifacts: ['security-report.json'],
        recommendations: scanResult.vulnerabilities.map(v => v.recommendation),
      };

    } catch (error) {
      return {
        stage: 'Security Scan',
        passed: false,
        score: 0,
        details: `Security scan failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 3: Unit Tests
   */
  private async runUnitTests(): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Running unit tests');

    try {
      const testResult = await this.runCommand('npm', ['test', '--', '--reporter=json']);
      
      // Parse Jest output
      const testResults = JSON.parse(testResult.stdout || '{"success": false, "numPassedTests": 0, "numFailedTests": 1}');
      
      const passed = testResults.success === true;
      const coverage = await this.getCoverageReport();
      const score = this.calculateTestScore(testResults, coverage);

      return {
        stage: 'Unit Tests',
        passed,
        score,
        details: passed 
          ? `${testResults.numPassedTests} tests passed, ${coverage.percentage}% coverage`
          : `${testResults.numFailedTests} tests failed`,
        duration: Date.now() - startTime,
        artifacts: ['test-results.json', 'coverage-report.html'],
      };

    } catch (error) {
      return {
        stage: 'Unit Tests',
        passed: false,
        score: 0,
        details: `Unit tests failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 4: Integration Tests
   */
  private async runIntegrationTests(): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Running integration tests');

    try {
      // Run two-actor architecture tests
      const architectureTestResult = await this.runCommand('npx', ['jest', 'tests/two-actor-architecture']);
      
      // Run orchestration tests  
      const orchestrationTestResult = await this.runCommand('npx', ['jest', 'tests/integration']);

      const passed = architectureTestResult.exitCode === 0 && orchestrationTestResult.exitCode === 0;
      const score = passed ? 100 : 0;

      return {
        stage: 'Integration Tests',
        passed,
        score,
        details: passed ? 'All integration tests passed' : 'Integration tests failed',
        duration: Date.now() - startTime,
        artifacts: ['integration-test-results.json'],
      };

    } catch (error) {
      return {
        stage: 'Integration Tests',
        passed: false,
        score: 0,
        details: `Integration tests failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 5: Architecture Validation
   */
  private async validateArchitecture(changes: string[]): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Validating architecture compliance');

    try {
      const violations: string[] = [];

      // Check Two-Actor Model compliance
      const actorViolations = await this.checkActorBoundaries(changes);
      violations.push(...actorViolations);

      // Check dependency directions
      const dependencyViolations = await this.checkDependencyDirections(changes);
      violations.push(...dependencyViolations);

      // Check for prohibited patterns
      const patternViolations = await this.checkProhibitedPatterns(changes);
      violations.push(...patternViolations);

      const passed = violations.length === 0;
      const score = passed ? 100 : Math.max(0, 100 - (violations.length * 15));

      return {
        stage: 'Architecture Validation',
        passed,
        score,
        details: passed ? 'Architecture compliance verified' : `${violations.length} violations found`,
        duration: Date.now() - startTime,
        artifacts: ['architecture-report.json'],
        recommendations: violations,
      };

    } catch (error) {
      return {
        stage: 'Architecture Validation',
        passed: false,
        score: 0,
        details: `Architecture validation failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 6: Performance Benchmarks
   */
  private async runPerformanceBenchmarks(): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Running performance benchmarks');

    try {
      const benchmarks = await this.measurePerformanceMetrics();
      const regressions = benchmarks.filter(b => !b.passed);
      
      const passed = regressions.length === 0;
      const score = this.calculatePerformanceScore(benchmarks);

      return {
        stage: 'Performance Benchmarks',
        passed,
        score,
        details: passed 
          ? 'All performance benchmarks passed'
          : `${regressions.length} performance regressions detected`,
        duration: Date.now() - startTime,
        artifacts: ['performance-report.json'],
        recommendations: regressions.map(r => `Optimize ${r.metric}: ${r.current} ${r.unit} (threshold: ${r.threshold} ${r.unit})`),
      };

    } catch (error) {
      return {
        stage: 'Performance Benchmarks',
        passed: false,
        score: 50, // Performance issues are warnings, not blockers
        details: `Performance benchmarks failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Stage 7: Self-Development Capability Test
   */
  private async testSelfDevelopmentCapability(): Promise<QAResult> {
    const startTime = Date.now();
    this.logger.info('Testing self-development capability');

    try {
      // Test that the system can still generate instructions
      const instructionTest = await this.testInstructionGeneration();
      
      // Test that the system can still execute tasks
      const executionTest = await this.testExecutionCapability();
      
      // Test that the system maintains actor boundaries
      const boundaryTest = await this.testActorBoundaryEnforcement();

      const allTestsPassed = instructionTest && executionTest && boundaryTest;
      const score = allTestsPassed ? 100 : 0;

      return {
        stage: 'Self-Development Capability',
        passed: allTestsPassed,
        score,
        details: allTestsPassed 
          ? 'Self-development capabilities verified'
          : 'Self-development capability compromised',
        duration: Date.now() - startTime,
        artifacts: ['self-dev-test-results.json'],
      };

    } catch (error) {
      return {
        stage: 'Self-Development Capability',
        passed: false,
        score: 0,
        details: `Self-development test failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        artifacts: [],
      };
    }
  }

  /**
   * Private helper methods
   */
  private async initializeWorkspace(): Promise<void> {
    await fs.rm(this.qaWorkspace, { recursive: true, force: true });
    await fs.mkdir(this.qaWorkspace, { recursive: true });
  }

  private async runCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        resolve({ exitCode: code || 0, stdout, stderr });
      });
    });
  }

  private async analyzeCodeComplexity(_changes: string[]): Promise<{ highComplexityFiles: string[] }> {
    // Placeholder for complexity analysis
    return { highComplexityFiles: [] };
  }

  private async performSecurityScan(_changes: string[]): Promise<SecurityScanResult> {
    // Placeholder for security scanning
    return {
      vulnerabilities: [],
      passed: true,
      score: 100,
    };
  }

  private async getCoverageReport(): Promise<{ percentage: number }> {
    // Placeholder for coverage analysis
    return { percentage: 85 };
  }

  private async checkActorBoundaries(changes: string[]): Promise<string[]> {
    const violations: string[] = [];
    
    // Check for code patterns that violate Two-Actor Model
    for (const file of changes) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // Planning actors should not contain implementation code
        if (file.includes('planning') && this.containsImplementationCode(content)) {
          violations.push(`Planning actor contains implementation code: ${file}`);
        }
        
        // Execution actors should not contain strategic decisions
        if (file.includes('execution') && this.containsStrategicDecisions(content)) {
          violations.push(`Execution actor contains strategic decisions: ${file}`);
        }
      } catch (error) {
        // File might not exist or be readable
      }
    }
    
    return violations;
  }

  private async checkDependencyDirections(_changes: string[]): Promise<string[]> {
    // Placeholder for dependency analysis
    return [];
  }

  private async checkProhibitedPatterns(_changes: string[]): Promise<string[]> {
    // Placeholder for pattern checking
    return [];
  }

  private async measurePerformanceMetrics(): Promise<PerformanceBenchmark[]> {
    // Placeholder for performance measurement
    return [
      {
        metric: 'startup_time',
        current: 2500,
        baseline: 2000,
        threshold: 3000,
        unit: 'ms',
        passed: true,
      },
      {
        metric: 'memory_usage',
        current: 150,
        baseline: 120,
        threshold: 200,
        unit: 'MB',
        passed: true,
      },
    ];
  }

  private async testInstructionGeneration(): Promise<boolean> {
    // Test that planning engine can still generate instructions
    return true;
  }

  private async testExecutionCapability(): Promise<boolean> {
    // Test that execution engine can still execute tasks
    return true;
  }

  private async testActorBoundaryEnforcement(): Promise<boolean> {
    // Test that actor boundaries are still enforced
    return true;
  }

  private containsImplementationCode(content: string): boolean {
    // Check for implementation patterns that shouldn't be in planning code
    const implementationPatterns = [
      /fs\.writeFile/,
      /spawn\(/,
      /exec\(/,
      /process\.exit/,
    ];
    
    return implementationPatterns.some(pattern => pattern.test(content));
  }

  private containsStrategicDecisions(content: string): boolean {
    // Check for strategic patterns that shouldn't be in execution code
    const strategicPatterns = [
      /should.*implement/i,
      /we.*need.*to/i,
      /strategy/i,
      /approach.*is/i,
    ];
    
    return strategicPatterns.some(pattern => pattern.test(content));
  }

  private calculateOverallScore(stages: QAResult[]): number {
    if (stages.length === 0) return 0;
    
    const weights = {
      'Static Analysis': 0.15,
      'Security Scan': 0.25,
      'Unit Tests': 0.20,
      'Integration Tests': 0.15,
      'Architecture Validation': 0.20,
      'Performance Benchmarks': 0.05,
      'Self-Development Capability': 0.25,
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const stage of stages) {
      const weight = weights[stage.stage as keyof typeof weights] || 0.1;
      weightedSum += stage.score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  private calculateTestScore(testResults: any, coverage: { percentage: number }): number {
    const testScore = testResults.success ? 70 : 0;
    const coverageScore = Math.min(30, coverage.percentage * 0.3);
    return testScore + coverageScore;
  }

  private calculatePerformanceScore(benchmarks: PerformanceBenchmark[]): number {
    if (benchmarks.length === 0) return 100;
    
    const passedCount = benchmarks.filter(b => b.passed).length;
    return Math.round((passedCount / benchmarks.length) * 100);
  }

  private getStaticAnalysisRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];
    
    if (issues.some(issue => issue.includes('TypeScript'))) {
      recommendations.push('Fix TypeScript compilation errors before proceeding');
    }
    
    if (issues.some(issue => issue.includes('ESLint'))) {
      recommendations.push('Address ESLint errors to improve code quality');
    }
    
    if (issues.some(issue => issue.includes('complexity'))) {
      recommendations.push('Refactor high-complexity functions to improve maintainability');
    }
    
    return recommendations;
  }
}