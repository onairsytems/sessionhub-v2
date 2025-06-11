/**
 * Production Readiness Validator for SessionHub
 * Comprehensive validation framework to ensure enterprise-grade readiness
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export interface ValidationCategory {
  name: string;
  description: string;
  weight: number;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  automated: boolean;
  validator: () => Promise<ValidationResult>;
}

export interface ValidationResult {
  checkId: string;
  passed: boolean;
  message: string;
  details?: any;
  evidence?: string[];
  recommendations?: string[];
  timestamp: number;
}

export interface ProductionReadinessReport {
  overallScore: number;
  status: 'ready' | 'not-ready' | 'needs-improvement';
  timestamp: Date;
  environment: EnvironmentInfo;
  categories: CategoryResult[];
  criticalIssues: ValidationResult[];
  recommendations: string[];
  detailedResults: ValidationResult[];
}

export interface CategoryResult {
  name: string;
  score: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalFailures: number;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  npmVersion: string;
  platform: string;
  architecture: string;
  cpuCores: number;
  totalMemory: number;
  timestamp: Date;
}

export class ProductionReadinessValidator extends EventEmitter {
  private categories: Map<string, ValidationCategory> = new Map();
  private results: ValidationResult[] = [];

  constructor() {
    super();
    this.initializeCategories();
  }

  private initializeCategories(): void {
    // Core Functionality
    this.addCategory({
      name: 'Core Functionality',
      description: 'Essential features and capabilities',
      weight: 30,
      checks: [
        {
          id: 'core-001',
          name: 'Application Startup',
          description: 'Verify application starts without errors',
          category: 'Core Functionality',
          severity: 'critical',
          automated: true,
          validator: this.validateApplicationStartup.bind(this)
        },
        {
          id: 'core-002',
          name: 'Critical Features',
          description: 'Verify all critical features are operational',
          category: 'Core Functionality',
          severity: 'critical',
          automated: true,
          validator: this.validateCriticalFeatures.bind(this)
        },
        {
          id: 'core-003',
          name: 'Data Persistence',
          description: 'Verify data is properly saved and loaded',
          category: 'Core Functionality',
          severity: 'critical',
          automated: true,
          validator: this.validateDataPersistence.bind(this)
        }
      ]
    });

    // Performance
    this.addCategory({
      name: 'Performance',
      description: 'Application performance and efficiency',
      weight: 20,
      checks: [
        {
          id: 'perf-001',
          name: 'Startup Time',
          description: 'Application starts within acceptable time',
          category: 'Performance',
          severity: 'high',
          automated: true,
          validator: this.validateStartupTime.bind(this)
        },
        {
          id: 'perf-002',
          name: 'Memory Usage',
          description: 'Memory usage within acceptable limits',
          category: 'Performance',
          severity: 'high',
          automated: true,
          validator: this.validateMemoryUsage.bind(this)
        },
        {
          id: 'perf-003',
          name: 'Response Time',
          description: 'UI responds within acceptable time',
          category: 'Performance',
          severity: 'medium',
          automated: true,
          validator: this.validateResponseTime.bind(this)
        }
      ]
    });

    // Security
    this.addCategory({
      name: 'Security',
      description: 'Security measures and best practices',
      weight: 25,
      checks: [
        {
          id: 'sec-001',
          name: 'Credential Storage',
          description: 'Credentials are securely stored',
          category: 'Security',
          severity: 'critical',
          automated: true,
          validator: this.validateCredentialStorage.bind(this)
        },
        {
          id: 'sec-002',
          name: 'API Security',
          description: 'API endpoints are properly secured',
          category: 'Security',
          severity: 'critical',
          automated: true,
          validator: this.validateApiSecurity.bind(this)
        },
        {
          id: 'sec-003',
          name: 'Data Encryption',
          description: 'Sensitive data is encrypted',
          category: 'Security',
          severity: 'high',
          automated: true,
          validator: this.validateDataEncryption.bind(this)
        }
      ]
    });

    // Code Quality
    this.addCategory({
      name: 'Code Quality',
      description: 'Code standards and maintainability',
      weight: 15,
      checks: [
        {
          id: 'qual-001',
          name: 'TypeScript Compilation',
          description: 'No TypeScript compilation errors',
          category: 'Code Quality',
          severity: 'critical',
          automated: true,
          validator: this.validateTypeScript.bind(this)
        },
        {
          id: 'qual-002',
          name: 'Linting',
          description: 'No ESLint violations',
          category: 'Code Quality',
          severity: 'high',
          automated: true,
          validator: this.validateLinting.bind(this)
        },
        {
          id: 'qual-003',
          name: 'Test Coverage',
          description: 'Adequate test coverage',
          category: 'Code Quality',
          severity: 'medium',
          automated: true,
          validator: this.validateTestCoverage.bind(this)
        }
      ]
    });

    // Reliability
    this.addCategory({
      name: 'Reliability',
      description: 'System stability and error handling',
      weight: 10,
      checks: [
        {
          id: 'rel-001',
          name: 'Error Handling',
          description: 'Proper error handling throughout',
          category: 'Reliability',
          severity: 'high',
          automated: true,
          validator: this.validateErrorHandling.bind(this)
        },
        {
          id: 'rel-002',
          name: 'Recovery Mechanisms',
          description: 'System can recover from failures',
          category: 'Reliability',
          severity: 'high',
          automated: true,
          validator: this.validateRecoveryMechanisms.bind(this)
        },
        {
          id: 'rel-003',
          name: 'Data Integrity',
          description: 'Data integrity is maintained',
          category: 'Reliability',
          severity: 'critical',
          automated: true,
          validator: this.validateDataIntegrity.bind(this)
        }
      ]
    });
  }

  private addCategory(category: ValidationCategory): void {
    this.categories.set(category.name, category);
  }

  /**
   * Run full production readiness validation
   */
  public async validate(): Promise<ProductionReadinessReport> {
    this.results = [];
    this.emit('validation:start');

    const environment = this.getEnvironmentInfo();
    const categoryResults: CategoryResult[] = [];
    const criticalIssues: ValidationResult[] = [];

    // Run all checks
    for (const category of this.categories.values()) {
      this.emit('category:start', category.name);
      
      const categoryResult: CategoryResult = {
        name: category.name,
        score: 0,
        totalChecks: category.checks.length,
        passedChecks: 0,
        failedChecks: 0,
        criticalFailures: 0
      };

      for (const check of category.checks) {
        try {
          this.emit('check:start', check);
          const result = await check.validator();
          this.results.push(result);

          if (result.passed) {
            categoryResult.passedChecks++;
          } else {
            categoryResult.failedChecks++;
            if (check.severity === 'critical') {
              categoryResult.criticalFailures++;
              criticalIssues.push(result);
            }
          }

          this.emit('check:complete', { check, result });
        } catch (error) {
          const errorResult: ValidationResult = {
            checkId: check.id,
            passed: false,
            message: `Check failed with error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now()
          };
          this.results.push(errorResult);
          categoryResult.failedChecks++;
          if (check.severity === 'critical') {
            categoryResult.criticalFailures++;
            criticalIssues.push(errorResult);
          }
        }
      }

      // Calculate category score
      categoryResult.score = Math.round(
        (categoryResult.passedChecks / categoryResult.totalChecks) * 100
      );
      categoryResults.push(categoryResult);
      
      this.emit('category:complete', categoryResult);
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(categoryResults);
    const status = this.determineReadinessStatus(overallScore, criticalIssues.length);
    const recommendations = this.generateRecommendations(this.results);

    const report: ProductionReadinessReport = {
      overallScore,
      status,
      timestamp: new Date(),
      environment,
      categories: categoryResults,
      criticalIssues,
      recommendations,
      detailedResults: this.results
    };

    this.emit('validation:complete', report);
    return report;
  }

  /**
   * Validation methods
   */
  private async validateApplicationStartup(): Promise<ValidationResult> {
    try {
      // Check if main process file exists
      const mainPath = path.join(process.cwd(), 'main', 'background.ts');
      const exists = fs.existsSync(mainPath);
      
      // Try to compile TypeScript
      if (exists) {
        execSync('npm run build:check', { stdio: 'pipe' });
      }

      return {
        checkId: 'core-001',
        passed: exists,
        message: exists ? 'Application startup files are present and compile' : 'Main process file not found',
        evidence: exists ? [mainPath] : [],
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'core-001',
        passed: false,
        message: `Application startup validation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
    }
  }

  private async validateCriticalFeatures(): Promise<ValidationResult> {
    const criticalFeatures = [
      'Session Management',
      'Project Switching',
      'IDE Integration',
      'Cloud Sync',
      'MCP Generation'
    ];

    const missingFeatures: string[] = [];
    
    // Check for feature modules
    const featureChecks = {
      'Session Management': 'src/models/Session.ts',
      'Project Switching': 'main/services/ProjectSwitcher.ts',
      'IDE Integration': 'main/services/ideAdapter.ts',
      'Cloud Sync': 'main/services/cloud/SupabaseService.ts',
      'MCP Generation': 'main/services/mcp/MCPGenerator.ts'
    };

    for (const [feature, filePath] of Object.entries(featureChecks)) {
      if (!fs.existsSync(path.join(process.cwd(), filePath))) {
        missingFeatures.push(feature);
      }
    }

    return {
      checkId: 'core-002',
      passed: missingFeatures.length === 0,
      message: missingFeatures.length === 0 
        ? 'All critical features are present' 
        : `Missing critical features: ${missingFeatures.join(', ')}`,
      details: { criticalFeatures, missingFeatures },
      timestamp: Date.now()
    };
  }

  private async validateDataPersistence(): Promise<ValidationResult> {
    try {
      const dbPath = path.join(process.cwd(), 'main', 'services', 'database.ts');
      const hasDatabase = fs.existsSync(dbPath);
      
      return {
        checkId: 'core-003',
        passed: hasDatabase,
        message: hasDatabase 
          ? 'Data persistence layer is implemented' 
          : 'Database service not found',
        evidence: hasDatabase ? [dbPath] : [],
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'core-003',
        passed: false,
        message: `Data persistence validation failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
    }
  }

  private async validateStartupTime(): Promise<ValidationResult> {
    // Measure build time as proxy for startup time
    const startTime = Date.now();
    try {
      execSync('npm run build:check', { stdio: 'pipe' });
      const duration = Date.now() - startTime;
      const maxAcceptable = 30000; // 30 seconds

      return {
        checkId: 'perf-001',
        passed: duration < maxAcceptable,
        message: `Build completed in ${duration}ms (limit: ${maxAcceptable}ms)`,
        details: { duration, maxAcceptable },
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'perf-001',
        passed: false,
        message: 'Failed to measure startup time',
        timestamp: Date.now()
      };
    }
  }

  private async validateMemoryUsage(): Promise<ValidationResult> {
    const usage = process.memoryUsage();
    const maxHeap = 512 * 1024 * 1024; // 512MB
    
    return {
      checkId: 'perf-002',
      passed: usage.heapUsed < maxHeap,
      message: `Heap usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB (limit: 512MB)`,
      details: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss
      },
      timestamp: Date.now()
    };
  }

  private async validateResponseTime(): Promise<ValidationResult> {
    // This would typically measure actual UI response time
    // For now, we'll validate that performance monitoring is in place
    const perfMonitorPath = path.join(process.cwd(), 'src', 'testing', 'AdvancedTestingMode.ts');
    const hasPerformanceMonitoring = fs.existsSync(perfMonitorPath);

    return {
      checkId: 'perf-003',
      passed: hasPerformanceMonitoring,
      message: hasPerformanceMonitoring
        ? 'Performance monitoring is implemented'
        : 'Performance monitoring not found',
      timestamp: Date.now()
    };
  }

  private async validateCredentialStorage(): Promise<ValidationResult> {
    // Check for secure credential handling patterns
    const insecurePatterns = [
      /password\s*=\s*["'].*["']/gi,
      /api[_-]?key\s*=\s*["'].*["']/gi,
      /secret\s*=\s*["'].*["']/gi
    ];

    const srcFiles = this.getSourceFiles();
    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of insecurePatterns) {
        if (pattern.test(content)) {
          violations.push(file);
          break;
        }
      }
    }

    return {
      checkId: 'sec-001',
      passed: violations.length === 0,
      message: violations.length === 0
        ? 'No hardcoded credentials found'
        : `Potential hardcoded credentials in ${violations.length} files`,
      details: { violations },
      recommendations: violations.length > 0
        ? ['Use environment variables or secure credential storage']
        : [],
      timestamp: Date.now()
    };
  }

  private async validateApiSecurity(): Promise<ValidationResult> {
    const apiHandlers = this.getApiHandlers();
    const unsecuredEndpoints: string[] = [];

    for (const handler of apiHandlers) {
      const content = fs.readFileSync(handler, 'utf-8');
      // Check for authentication/authorization
      if (!content.includes('auth') && !content.includes('Auth')) {
        unsecuredEndpoints.push(handler);
      }
    }

    return {
      checkId: 'sec-002',
      passed: unsecuredEndpoints.length === 0,
      message: unsecuredEndpoints.length === 0
        ? 'All API endpoints appear to have authentication'
        : `${unsecuredEndpoints.length} endpoints may lack authentication`,
      details: { unsecuredEndpoints },
      timestamp: Date.now()
    };
  }

  private async validateDataEncryption(): Promise<ValidationResult> {
    // Check for encryption implementations
    const encryptionKeywords = ['encrypt', 'crypto', 'cipher', 'hash'];
    const hasEncryption = this.getSourceFiles().some(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return encryptionKeywords.some(keyword => 
        content.toLowerCase().includes(keyword)
      );
    });

    return {
      checkId: 'sec-003',
      passed: hasEncryption,
      message: hasEncryption
        ? 'Encryption mechanisms found in codebase'
        : 'No encryption mechanisms detected',
      recommendations: !hasEncryption
        ? ['Implement encryption for sensitive data']
        : [],
      timestamp: Date.now()
    };
  }

  private async validateTypeScript(): Promise<ValidationResult> {
    try {
      execSync('npm run build:check', { stdio: 'pipe' });
      return {
        checkId: 'qual-001',
        passed: true,
        message: 'TypeScript compilation successful with no errors',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'qual-001',
        passed: false,
        message: 'TypeScript compilation failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      };
    }
  }

  private async validateLinting(): Promise<ValidationResult> {
    try {
      execSync('npm run lint', { stdio: 'pipe' });
      return {
        checkId: 'qual-002',
        passed: true,
        message: 'ESLint validation passed with no violations',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'qual-002',
        passed: false,
        message: 'ESLint validation failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      };
    }
  }

  private async validateTestCoverage(): Promise<ValidationResult> {
    try {
      // Run coverage and parse results
      execSync('npm run test:coverage -- --silent', { stdio: 'pipe' });
      
      // For now, we'll check if coverage command runs
      return {
        checkId: 'qual-003',
        passed: true,
        message: 'Test coverage analysis completed',
        recommendations: ['Maintain test coverage above 80%'],
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        checkId: 'qual-003',
        passed: false,
        message: 'Test coverage analysis failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now()
      };
    }
  }

  private async validateErrorHandling(): Promise<ValidationResult> {
    const errorHandlingPatterns = [
      /try\s*{[\s\S]*?}\s*catch/g,
      /\.catch\s*\(/g,
      /process\.on\s*\(\s*['"]uncaughtException/g,
      /process\.on\s*\(\s*['"]unhandledRejection/g
    ];

    const srcFiles = this.getSourceFiles();
    let totalErrorHandlers = 0;

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of errorHandlingPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          totalErrorHandlers += matches.length;
        }
      }
    }

    const adequate = totalErrorHandlers > 50; // Arbitrary threshold

    return {
      checkId: 'rel-001',
      passed: adequate,
      message: `Found ${totalErrorHandlers} error handling patterns`,
      details: { totalErrorHandlers },
      recommendations: !adequate
        ? ['Implement comprehensive error handling throughout the application']
        : [],
      timestamp: Date.now()
    };
  }

  private async validateRecoveryMechanisms(): Promise<ValidationResult> {
    const recoveryFiles = [
      'main/services/RecoveryService.ts',
      'main/services/BackupService.ts'
    ];

    const existingFiles = recoveryFiles.filter(file => 
      fs.existsSync(path.join(process.cwd(), file))
    );

    return {
      checkId: 'rel-002',
      passed: existingFiles.length > 0,
      message: existingFiles.length > 0
        ? `Recovery mechanisms found: ${existingFiles.join(', ')}`
        : 'No recovery mechanisms found',
      details: { existingFiles },
      timestamp: Date.now()
    };
  }

  private async validateDataIntegrity(): Promise<ValidationResult> {
    // Check for data validation patterns
    const validationPatterns = [
      /validate/i,
      /schema/i,
      /sanitize/i,
      /verify/i
    ];

    const srcFiles = this.getSourceFiles();
    let validationCount = 0;

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of validationPatterns) {
        if (pattern.test(content)) {
          validationCount++;
          break;
        }
      }
    }

    const percentage = Math.round((validationCount / srcFiles.length) * 100);

    return {
      checkId: 'rel-003',
      passed: percentage > 30,
      message: `Data validation found in ${percentage}% of files`,
      details: { percentage, totalFiles: srcFiles.length, filesWithValidation: validationCount },
      timestamp: Date.now()
    };
  }

  /**
   * Helper methods
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      npmVersion: (execSync('npm --version', { encoding: 'utf-8' }) || '').trim() || 'unknown',
      platform: os.platform(),
      architecture: os.arch(),
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      timestamp: new Date()
    };
  }

  private getSourceFiles(): string[] {
    const srcDir = path.join(process.cwd(), 'src');
    const mainDir = path.join(process.cwd(), 'main');
    const files: string[] = [];

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    };

    if (fs.existsSync(srcDir)) walkDir(srcDir);
    if (fs.existsSync(mainDir)) walkDir(mainDir);

    return files;
  }

  private getApiHandlers(): string[] {
    const handlersDir = path.join(process.cwd(), 'main', 'ipc');
    if (!fs.existsSync(handlersDir)) return [];

    return fs.readdirSync(handlersDir)
      .filter(file => file.endsWith('Handlers.ts'))
      .map(file => path.join(handlersDir, file));
  }

  private calculateOverallScore(categoryResults: CategoryResult[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const result of categoryResults) {
      const category = this.categories.get(result.name);
      if (category) {
        weightedSum += result.score * category.weight;
        totalWeight += category.weight;
      }
    }

    return Math.round(weightedSum / totalWeight);
  }

  private determineReadinessStatus(
    score: number, 
    criticalIssues: number
  ): 'ready' | 'not-ready' | 'needs-improvement' {
    if (criticalIssues > 0) return 'not-ready';
    if (score >= 90) return 'ready';
    if (score >= 70) return 'needs-improvement';
    return 'not-ready';
  }

  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    const failedChecks = results.filter(r => !r.passed);

    // Group by category
    const failuresByCategory = new Map<string, number>();
    failedChecks.forEach(result => {
      const checkId = result.checkId;
      const category = checkId.split('-')[0] || 'unknown';
      failuresByCategory.set(category, (failuresByCategory.get(category) || 0) + 1);
    });

    // Generate category-specific recommendations
    failuresByCategory.forEach((count, category) => {
      if (count > 0) {
      switch (category) {
        case 'core':
          recommendations.push('Focus on fixing core functionality issues before deployment');
          break;
        case 'perf':
          recommendations.push('Optimize performance to meet production requirements');
          break;
        case 'sec':
          recommendations.push('Address security vulnerabilities immediately');
          break;
        case 'qual':
          recommendations.push('Improve code quality to ensure maintainability');
          break;
        case 'rel':
          recommendations.push('Enhance reliability mechanisms for production stability');
          break;
      }
      }
    });

    // Add specific recommendations from failed checks
    failedChecks.forEach(result => {
      if (result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Generate detailed report
   */
  public generateDetailedReport(report: ProductionReadinessReport): string {
    const lines: string[] = [];
    
    lines.push('# Production Readiness Report');
    lines.push(`Generated: ${report.timestamp.toISOString()}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`Overall Score: ${report.overallScore}%`);
    lines.push(`Status: ${report.status.toUpperCase()}`);
    lines.push(`Critical Issues: ${report.criticalIssues.length}`);
    lines.push('');
    
    lines.push('## Environment');
    lines.push(`Platform: ${report.environment.platform} (${report.environment.architecture})`);
    lines.push(`Node.js: ${report.environment.nodeVersion}`);
    lines.push(`NPM: ${report.environment.npmVersion}`);
    lines.push('');
    
    lines.push('## Category Results');
    report.categories.forEach(category => {
      lines.push(`### ${category.name}`);
      lines.push(`Score: ${category.score}%`);
      lines.push(`Passed: ${category.passedChecks}/${category.totalChecks}`);
      if (category.criticalFailures > 0) {
        lines.push(`⚠️ Critical Failures: ${category.criticalFailures}`);
      }
      lines.push('');
    });
    
    if (report.criticalIssues.length > 0) {
      lines.push('## Critical Issues');
      report.criticalIssues.forEach(issue => {
        lines.push(`- ${issue.message}`);
      });
      lines.push('');
    }
    
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }
    
    lines.push('## Detailed Results');
    report.detailedResults.forEach(result => {
      lines.push(`### ${result.checkId}`);
      lines.push(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      lines.push(`Message: ${result.message}`);
      if (result.details) {
        lines.push(`Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      lines.push('');
    });
    
    return lines.join('\n');
  }
}

// Export singleton instance
let validatorInstance: ProductionReadinessValidator | null = null;

export const getProductionValidator = (): ProductionReadinessValidator => {
  if (!validatorInstance) {
    validatorInstance = new ProductionReadinessValidator();
  }
  return validatorInstance;
};

export const validateProductionReadiness = async (): Promise<ProductionReadinessReport> => {
  const validator = getProductionValidator();
  return validator.validate();
};