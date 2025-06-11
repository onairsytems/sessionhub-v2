#!/usr/bin/env ts-node
/**
 * Session 2.15: Comprehensive Codebase Analysis & Error Detection
 * 
 * OBJECTIVES:
 * - Execute complete codebase analysis across entire SessionHub repository
 * - Generate comprehensive error report documenting all quality issues
 * - Verify GitHub synchronization status
 * - Create baseline assessment for systematic error resolution
 * - Establish error tracking system for monitoring resolution progress
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as glob from 'glob';

interface ErrorType {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'typescript' | 'eslint' | 'console' | 'build' | 'other';
  rule?: string;
}

interface AnalysisReport {
  timestamp: string;
  totalFiles: number;
  totalErrors: number;
  errors: {
    typescript: ErrorType[];
    eslint: ErrorType[];
    console: ErrorType[];
    build: ErrorType[];
    other: ErrorType[];
  };
  gitStatus: {
    isClean: boolean;
    uncommittedFiles: string[];
    unpushedCommits: number;
    branch: string;
    remoteSync: boolean;
  };
  summary: {
    criticalErrors: number;
    warnings: number;
    consoleStatements: number;
    buildIssues: number;
  };
}

class ComprehensiveCodebaseAnalyzer {
  private report: AnalysisReport;
  private projectRoot: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.report = {
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      totalErrors: 0,
      errors: {
        typescript: [],
        eslint: [],
        console: [],
        build: [],
        other: []
      },
      gitStatus: {
        isClean: true,
        uncommittedFiles: [],
        unpushedCommits: 0,
        branch: '',
        remoteSync: true
      },
      summary: {
        criticalErrors: 0,
        warnings: 0,
        consoleStatements: 0,
        buildIssues: 0
      }
    };
  }

  /**
   * Main analysis entry point
   */
  async analyze(): Promise<void> {
    console.log('🔍 Starting Session 2.15: Comprehensive Codebase Analysis\n');

    try {
      // 1. Scan file system
      await this.scanFileSystem();

      // 2. Check TypeScript errors
      await this.analyzeTypeScriptErrors();

      // 3. Check ESLint violations
      await this.analyzeESLintViolations();

      // 4. Check console statements
      await this.analyzeConsoleStatements();

      // 5. Check build issues
      await this.analyzeBuildIssues();

      // 6. Check Git status
      await this.analyzeGitStatus();

      // 7. Generate report
      await this.generateReport();

      // 8. Create tracking infrastructure
      await this.createTrackingInfrastructure();

      // 9. Display summary
      this.displaySummary();

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  }

  /**
   * Scan entire file system for analysis
   */
  private async scanFileSystem(): Promise<void> {
    console.log('📁 Scanning file system...');

    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: [
        'node_modules/**',
        'dist/**',
        'out/**',
        '.next/**',
        'coverage/**',
        '*.min.js',
        '**/*.d.ts'
      ]
    });

    this.report.totalFiles = files.length;
    console.log(`  Found ${files.length} files to analyze\n`);
  }

  /**
   * Analyze TypeScript compilation errors
   */
  private async analyzeTypeScriptErrors(): Promise<void> {
    console.log('🔧 Analyzing TypeScript errors...');

    try {
      // Run TypeScript compiler in no-emit mode
      execSync('npx tsc --noEmit --pretty false', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('  ✅ No TypeScript errors found\n');
    } catch (error: any) {
      const output = error.stdout || error.message;
      const errors = this.parseTypeScriptErrors(output);
      
      this.report.errors.typescript = errors;
      this.report.summary.criticalErrors += errors.filter(e => e.severity === 'error').length;
      
      console.log(`  ❌ Found ${errors.length} TypeScript errors\n`);
    }
  }

  /**
   * Parse TypeScript error output
   */
  private parseTypeScriptErrors(output: string): ErrorType[] {
    const errors: ErrorType[] = [];
    const lines = output.split('\n');
    
    const errorRegex = /^(.+)\((\d+),(\d+)\):\s+error\s+TS(\d+):\s+(.+)$/;
    
    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        const [, file, lineNum, colNum, code, message] = match;
        errors.push({
          file: path.relative(this.projectRoot, file || ''),
          line: parseInt(lineNum || '0'),
          column: parseInt(colNum || '0'),
          message: message || '',
          severity: 'error',
          category: 'typescript',
          rule: `TS${code}`
        });
      }
    }

    return errors;
  }

  /**
   * Analyze ESLint violations
   */
  private async analyzeESLintViolations(): Promise<void> {
    console.log('🔍 Analyzing ESLint violations...');

    try {
      const result = execSync('npx eslint . --format json', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const eslintResults = JSON.parse(result);
      const errors = this.parseESLintResults(eslintResults);
      
      this.report.errors.eslint = errors;
      this.report.summary.warnings += errors.filter(e => e.severity === 'warning').length;
      
      console.log(`  Found ${errors.length} ESLint violations\n`);
    } catch (error: any) {
      if (error.stdout) {
        try {
          const eslintResults = JSON.parse(error.stdout);
          const errors = this.parseESLintResults(eslintResults);
          
          this.report.errors.eslint = errors;
          this.report.summary.warnings += errors.filter(e => e.severity === 'warning').length;
          
          console.log(`  ⚠️  Found ${errors.length} ESLint violations\n`);
        } catch (parseError) {
          console.log('  ❌ Failed to parse ESLint results\n');
        }
      } else {
        console.log('  ❌ ESLint analysis failed\n');
      }
    }
  }

  /**
   * Parse ESLint results
   */
  private parseESLintResults(results: any[]): ErrorType[] {
    const errors: ErrorType[] = [];

    for (const file of results) {
      if (file.messages && file.messages.length > 0) {
        for (const message of file.messages) {
          errors.push({
            file: path.relative(this.projectRoot, file.filePath),
            line: message.line,
            column: message.column,
            message: message.message,
            severity: message.severity === 2 ? 'error' : 'warning',
            category: 'eslint',
            rule: message.ruleId
          });
        }
      }
    }

    return errors;
  }

  /**
   * Analyze console statements
   */
  private async analyzeConsoleStatements(): Promise<void> {
    console.log('📝 Analyzing console statements...');

    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: [
        'node_modules/**',
        'dist/**',
        'out/**',
        '.next/**',
        'coverage/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        'scripts/**'
      ]
    });

    let totalConsoleStatements = 0;

    for (const file of files) {
      const filePath = path.join(this.projectRoot, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const consoleMatch = line.match(/console\.(log|warn|error|info|debug)/);
        if (consoleMatch) {
          this.report.errors.console.push({
            file,
            line: index + 1,
            message: `Console statement found: ${consoleMatch[0]}`,
            severity: 'warning',
            category: 'console'
          });
          totalConsoleStatements++;
        }
      });
    }

    this.report.summary.consoleStatements = totalConsoleStatements;
    console.log(`  Found ${totalConsoleStatements} console statements\n`);
  }

  /**
   * Analyze build issues
   */
  private async analyzeBuildIssues(): Promise<void> {
    console.log('🏗️  Analyzing build issues...');

    try {
      // Try Next.js build
      execSync('npm run build', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('  ✅ Build successful\n');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      const buildErrors = this.parseBuildErrors(output);
      
      this.report.errors.build = buildErrors;
      this.report.summary.buildIssues = buildErrors.length;
      
      console.log(`  ❌ Found ${buildErrors.length} build issues\n`);
    }
  }

  /**
   * Parse build errors
   */
  private parseBuildErrors(output: string): ErrorType[] {
    const errors: ErrorType[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('error') || line.includes('Error')) {
        errors.push({
          file: 'build',
          message: line.trim(),
          severity: 'error',
          category: 'build'
        });
      }
    }

    return errors;
  }

  /**
   * Analyze Git synchronization status
   */
  private async analyzeGitStatus(): Promise<void> {
    console.log('🔄 Analyzing Git synchronization status...');

    try {
      // Get current branch
      const branch = execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();
      
      this.report.gitStatus.branch = branch;

      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      }).trim();

      if (status) {
        this.report.gitStatus.isClean = false;
        this.report.gitStatus.uncommittedFiles = status.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(' ');
            return parts[parts.length - 1] || '';
          })
          .filter(file => file);
      }

      // Check for unpushed commits
      try {
        const unpushed = execSync(`git log origin/${branch}..HEAD --oneline`, {
          cwd: this.projectRoot,
          encoding: 'utf8'
        }).trim();

        if (unpushed) {
          const commits = unpushed.split('\n').filter(line => line.trim());
          this.report.gitStatus.unpushedCommits = commits.length;
          this.report.gitStatus.remoteSync = false;
        }
      } catch (e) {
        console.log('  ⚠️  Could not check remote sync status');
      }

      console.log(`  Branch: ${branch}`);
      console.log(`  Clean: ${this.report.gitStatus.isClean ? '✅' : '❌'}`);
      console.log(`  Synced: ${this.report.gitStatus.remoteSync ? '✅' : '❌'}\n`);

    } catch (error) {
      console.log('  ❌ Failed to analyze Git status\n');
    }
  }

  /**
   * Generate comprehensive report
   */
  private async generateReport(): Promise<void> {
    console.log('📊 Generating comprehensive report...');

    // Calculate totals
    this.report.totalErrors = 
      this.report.errors.typescript.length +
      this.report.errors.eslint.length +
      this.report.errors.console.length +
      this.report.errors.build.length;

    // Create reports directory
    const reportsDir = path.join(this.projectRoot, 'analysis-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate detailed report
    const reportPath = path.join(reportsDir, `analysis-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));

    // Generate summary report
    const summaryPath = path.join(reportsDir, 'ANALYSIS_SUMMARY.md');
    const summary = this.generateSummaryReport();
    fs.writeFileSync(summaryPath, summary);

    console.log(`  ✅ Report generated: ${reportPath}`);
    console.log(`  ✅ Summary generated: ${summaryPath}\n`);
  }

  /**
   * Generate markdown summary report
   */
  private generateSummaryReport(): string {
    const { errors, summary, gitStatus } = this.report;

    return `# SessionHub Codebase Analysis Report

## Session 2.15: Comprehensive Analysis Results

**Generated:** ${this.report.timestamp}
**Total Files Analyzed:** ${this.report.totalFiles}
**Total Issues Found:** ${this.report.totalErrors}

## Summary

- **Critical Errors:** ${summary.criticalErrors}
- **Warnings:** ${summary.warnings}
- **Console Statements:** ${summary.consoleStatements}
- **Build Issues:** ${summary.buildIssues}

## Git Status

- **Branch:** ${gitStatus.branch}
- **Repository Clean:** ${gitStatus.isClean ? '✅ Yes' : '❌ No'}
- **Remote Sync:** ${gitStatus.remoteSync ? '✅ Yes' : '❌ No'}
- **Uncommitted Files:** ${gitStatus.uncommittedFiles.length}
- **Unpushed Commits:** ${gitStatus.unpushedCommits}

## Error Breakdown

### TypeScript Errors (${errors.typescript.length})
${errors.typescript.slice(0, 10).map(e => 
  `- ${e.file}:${e.line} - ${e.rule}: ${e.message}`
).join('\n')}
${errors.typescript.length > 10 ? `\n... and ${errors.typescript.length - 10} more` : ''}

### ESLint Violations (${errors.eslint.length})
${errors.eslint.slice(0, 10).map(e => 
  `- ${e.file}:${e.line} - ${e.rule}: ${e.message}`
).join('\n')}
${errors.eslint.length > 10 ? `\n... and ${errors.eslint.length - 10} more` : ''}

### Console Statements (${errors.console.length})
${errors.console.slice(0, 10).map(e => 
  `- ${e.file}:${e.line} - ${e.message}`
).join('\n')}
${errors.console.length > 10 ? `\n... and ${errors.console.length - 10} more` : ''}

### Build Issues (${errors.build.length})
${errors.build.map(e => `- ${e.message}`).join('\n')}

## Recommendations

1. **Immediate Actions:**
   - Fix all TypeScript compilation errors
   - Remove console statements from production code
   - Resolve build issues

2. **Quality Improvements:**
   - Address ESLint violations systematically
   - Implement pre-commit hooks for quality gates
   - Set up continuous integration checks

3. **Next Steps:**
   - Use error tracking system to monitor resolution progress
   - Prioritize critical errors for immediate fix
   - Schedule systematic error resolution sessions
`;
  }

  /**
   * Create error tracking infrastructure
   */
  private async createTrackingInfrastructure(): Promise<void> {
    console.log('🔧 Creating error tracking infrastructure...');

    // Create tracking directory
    const trackingDir = path.join(this.projectRoot, 'error-tracking');
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }

    // Create baseline file
    const baselinePath = path.join(trackingDir, 'baseline.json');
    fs.writeFileSync(baselinePath, JSON.stringify({
      timestamp: this.report.timestamp,
      totals: {
        typescript: this.report.errors.typescript.length,
        eslint: this.report.errors.eslint.length,
        console: this.report.errors.console.length,
        build: this.report.errors.build.length,
        total: this.report.totalErrors
      },
      categories: this.categorizeErrors()
    }, null, 2));

    // Create progress tracking template
    const progressPath = path.join(trackingDir, 'progress.json');
    if (!fs.existsSync(progressPath)) {
      fs.writeFileSync(progressPath, JSON.stringify({
        sessions: [],
        totalResolved: 0,
        lastUpdated: this.report.timestamp
      }, null, 2));
    }

    console.log('  ✅ Error tracking infrastructure created\n');
  }

  /**
   * Categorize errors by severity and type
   */
  private categorizeErrors(): Record<string, any> {
    const categories = {
      critical: [] as ErrorType[],
      high: [] as ErrorType[],
      medium: [] as ErrorType[],
      low: [] as ErrorType[]
    };

    // Categorize all errors
    const allErrors = [
      ...this.report.errors.typescript,
      ...this.report.errors.eslint,
      ...this.report.errors.console,
      ...this.report.errors.build
    ];

    for (const error of allErrors) {
      if (error.category === 'typescript' || error.category === 'build') {
        categories.critical.push(error);
      } else if (error.severity === 'error') {
        categories.high.push(error);
      } else if (error.category === 'console') {
        categories.medium.push(error);
      } else {
        categories.low.push(error);
      }
    }

    return categories;
  }

  /**
   * Display final summary
   */
  public displaySummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS COMPLETE - SESSION 2.15');
    console.log('='.repeat(60));
    
    console.log('\n🎯 Total Issues Found:', this.report.totalErrors);
    console.log('  - TypeScript Errors:', this.report.errors.typescript.length);
    console.log('  - ESLint Violations:', this.report.errors.eslint.length);
    console.log('  - Console Statements:', this.report.errors.console.length);
    console.log('  - Build Issues:', this.report.errors.build.length);

    console.log('\n📁 Git Repository Status:');
    console.log('  - Clean:', this.report.gitStatus.isClean ? '✅' : '❌');
    console.log('  - Synced:', this.report.gitStatus.remoteSync ? '✅' : '❌');

    console.log('\n✅ Reports generated in ./analysis-reports/');
    console.log('✅ Error tracking infrastructure created in ./error-tracking/');
    console.log('\n🚀 Ready for systematic error resolution in subsequent sessions!');
    console.log('='.repeat(60) + '\n');
  }
}

// Execute analysis
async function main() {
  const analyzer = new ComprehensiveCodebaseAnalyzer();
  await analyzer.analyze();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveCodebaseAnalyzer };
export type { AnalysisReport, ErrorType };