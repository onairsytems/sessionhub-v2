/**
 * BuildValidator.ts
 * Build-time validation that prevents any production build with errors
 */

import { ErrorDetectionEngine } from './ErrorDetectionEngine';
import { BuildValidation, ErrorReport } from './types';
import { Logger } from '../../lib/logging/Logger';
import * as fs from 'fs/promises';
// import * as path from 'path'; // Commented out for future use
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildValidationOptions {
  failOnWarning: boolean;
  maxErrors: number;
  skipTests: boolean;
  skipLint: boolean;
  skipTypeCheck: boolean;
  reportPath?: string;
}

export class BuildValidator {
  private engine: ErrorDetectionEngine;
  private logger: Logger;
  private options: BuildValidationOptions;

  constructor(engine: ErrorDetectionEngine, options: Partial<BuildValidationOptions> = {}) {
    this.engine = engine;
    this.logger = new Logger('BuildValidator');
    this.options = {
      failOnWarning: false,
      maxErrors: 0, // 0 means no limit
      skipTests: false,
      skipLint: false,
      skipTypeCheck: false,
      ...options
    };
  }

  /**
   * Validate build readiness
   */
  public async validateBuild(): Promise<BuildValidation> {
    const startTime = Date.now();
    this.logger.info('Starting build validation...');

    try {
      const validationSteps = [
        { name: 'TypeScript Compilation', fn: () => this.validateTypeScript() },
        { name: 'ESLint Check', fn: () => this.validateESLint(), skip: this.options.skipLint },
        { name: 'Next.js Build', fn: () => this.validateNextBuild() },
        { name: 'Test Suite', fn: () => this.runTests(), skip: this.options.skipTests },
        { name: 'Project-wide Validation', fn: () => this.engine.validateProject() }
      ];

      const blockingErrors: ErrorReport[] = [];
      const warnings: ErrorReport[] = [];
      let canBuild = true;

      for (const step of validationSteps) {
        if (step.skip) {
          this.logger.info(`Skipping ${step.name}`);
          continue;
        }

        this.logger.info(`Running ${step.name}...`);
        
        try {
          const result = await step.fn();
          
          if ('errors' in result) {
            const stepErrors = result.errors.filter(e => e.severity === 'error');
            const stepWarnings = result.errors.filter(e => e.severity === 'warning');
            
            blockingErrors.push(...stepErrors);
            warnings.push(...stepWarnings);

            if (stepErrors.length > 0) {
              canBuild = false;
              this.logger.error(`${step.name} failed with ${stepErrors.length} errors`);
            }

            if (this.options.failOnWarning && stepWarnings.length > 0) {
              canBuild = false;
              this.logger.error(`${step.name} has ${stepWarnings.length} warnings (failOnWarning enabled)`);
            }
          }
        } catch (error) {
          canBuild = false;
          this.logger.error(`${step.name} failed: ${error}`);
          
          blockingErrors.push({
            filePath: 'build',
            line: 0,
            column: 0,
            severity: 'error',
            category: 'Build',
            code: 'BUILD_STEP_FAILED',
            message: `${step.name} failed: ${error}`,
            timestamp: new Date().toISOString()
          });
        }

        // Check max errors limit
        if (this.options.maxErrors > 0 && blockingErrors.length > this.options.maxErrors) {
          canBuild = false;
          this.logger.error(`Build validation failed: exceeded maximum error limit (${this.options.maxErrors})`);
          break;
        }
      }

      const duration = Date.now() - startTime;
      
      const result: BuildValidation = {
        canBuild,
        blockingErrors,
        warnings,
        timestamp: new Date().toISOString()
      };

      // Generate report
      if (this.options.reportPath) {
        await this.generateReport(result, duration);
      }

      // Log summary
      this.logValidationSummary(result, duration);

      return result;

    } catch (error) {
      this.logger.error('Build validation failed with unexpected error', error as Error);
      
      return {
        canBuild: false,
        blockingErrors: [{
          filePath: 'build',
          line: 0,
          column: 0,
          severity: 'error',
          category: 'Build',
          code: 'BUILD_VALIDATION_FAILED',
          message: `Build validation failed: ${error}`,
          timestamp: new Date().toISOString()
        }],
        warnings: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate TypeScript compilation
   */
  private async validateTypeScript(): Promise<{ errors: ErrorReport[] }> {
    try {
      const { stdout: _stdout, stderr } = await execAsync('npx tsc --noEmit --pretty false');
      
      if (stderr) {
        return { errors: this.parseTypeScriptErrors(stderr) };
      }

      return { errors: [] };
    } catch (error: any) {
      // TypeScript exits with code 1 on compilation errors
      if (error.stdout) {
        return { errors: this.parseTypeScriptErrors(error.stdout) };
      }
      throw error;
    }
  }

  /**
   * Validate ESLint
   */
  private async validateESLint(): Promise<{ errors: ErrorReport[] }> {
    try {
      const { stdout } = await execAsync('npx eslint . --ext .ts,.tsx,.js,.jsx --format json');
      const results = JSON.parse(stdout);
      
      const errors: ErrorReport[] = [];
      
      for (const file of results) {
        for (const message of file.messages) {
          errors.push({
            filePath: file.filePath,
            line: message.line || 0,
            column: message.column || 0,
            severity: message.severity === 2 ? 'error' : 'warning',
            category: 'ESLint',
            code: message.ruleId || 'unknown',
            message: message.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      return { errors };
    } catch (error: any) {
      if (error.stdout) {
        try {
          const results = JSON.parse(error.stdout);
          const errors: ErrorReport[] = [];
          
          for (const file of results) {
            for (const message of file.messages) {
              errors.push({
                filePath: file.filePath,
                line: message.line || 0,
                column: message.column || 0,
                severity: message.severity === 2 ? 'error' : 'warning',
                category: 'ESLint',
                code: message.ruleId || 'unknown',
                message: message.message,
                timestamp: new Date().toISOString()
              });
            }
          }

          return { errors };
        } catch {
          // Failed to parse JSON
        }
      }
      throw error;
    }
  }

  /**
   * Validate Next.js build
   */
  private async validateNextBuild(): Promise<{ errors: ErrorReport[] }> {
    try {
      // Run Next.js build in dry-run mode
      const { stdout, stderr } = await execAsync('npx next build --no-lint', {
        env: { ...process.env, NODE_ENV: 'production' }
      });

      const errors: ErrorReport[] = [];

      // Parse Next.js build output for errors
      const output = stdout + stderr;
      const errorLines = output.split('\n').filter(line => 
        line.includes('Error:') || 
        line.includes('Failed to compile') ||
        line.includes('Type error:')
      );

      errorLines.forEach(line => {
        errors.push({
          filePath: 'next-build',
          line: 0,
          column: 0,
          severity: 'error',
          category: 'Next.js',
          code: 'NEXT_BUILD_ERROR',
          message: line.trim(),
          timestamp: new Date().toISOString()
        });
      });

      return { errors };
    } catch (error: any) {
      const errorMessage = error.stderr || error.stdout || error.message;
      
      return {
        errors: [{
          filePath: 'next-build',
          line: 0,
          column: 0,
          severity: 'error',
          category: 'Next.js',
          code: 'NEXT_BUILD_FAILED',
          message: `Next.js build failed: ${errorMessage}`,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }

  /**
   * Run test suite
   */
  private async runTests(): Promise<{ errors: ErrorReport[] }> {
    try {
      const { stdout: _stdout, stderr } = await execAsync('npm test -- --passWithNoTests');
      
      if (stderr && stderr.includes('FAIL')) {
        return {
          errors: [{
            filePath: 'tests',
            line: 0,
            column: 0,
            severity: 'error',
            category: 'Tests',
            code: 'TEST_FAILED',
            message: 'Test suite failed',
            timestamp: new Date().toISOString()
          }]
        };
      }

      return { errors: [] };
    } catch (error: any) {
      return {
        errors: [{
          filePath: 'tests',
          line: 0,
          column: 0,
          severity: 'error',
          category: 'Tests',
          code: 'TEST_SUITE_ERROR',
          message: `Test suite error: ${error.message}`,
          timestamp: new Date().toISOString()
        }]
      };
    }
  }

  /**
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(output: string): ErrorReport[] {
    const errors: ErrorReport[] = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const match = line.match(/^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
      
      if (match) {
        errors.push({
          filePath: match[1] || '',
          line: parseInt(match[2] || '0'),
          column: parseInt(match[3] || '0'),
          severity: 'error',
          category: 'TypeScript',
          code: match[4] || '',
          message: match[5] || '',
          timestamp: new Date().toISOString()
        });
      }
    }

    return errors;
  }

  /**
   * Generate validation report
   */
  private async generateReport(result: BuildValidation, duration: number): Promise<void> {
    const report = {
      ...result,
      duration,
      summary: {
        totalErrors: result.blockingErrors.length,
        totalWarnings: result.warnings.length,
        canBuild: result.canBuild,
        errorsByCategory: this.groupByCategory([...result.blockingErrors, ...result.warnings])
      }
    };

    const reportContent = JSON.stringify(report, null, 2);
    await fs.writeFile(this.options.reportPath!, reportContent);
    
    this.logger.info(`Build validation report saved to ${this.options.reportPath}`);
  }

  /**
   * Log validation summary
   */
  private logValidationSummary(result: BuildValidation, duration: number): void {
    const errorCount = result.blockingErrors.length;
    const warningCount = result.warnings.length;

    if (result.canBuild) {
      this.logger.info(`✅ Build validation PASSED in ${duration}ms`, {
        warnings: warningCount
      });
    } else {
      this.logger.error(`❌ Build validation FAILED in ${duration}ms`, undefined, {
        errorCount,
        warningCount
      });

      // Log first few errors
      result.blockingErrors.slice(0, 5).forEach(error => {
        this.logger.error(`  ${error.filePath}:${error.line}:${error.column} - ${error.message}`);
      });

      if (errorCount > 5) {
        this.logger.error(`  ... and ${errorCount - 5} more errors`);
      }
    }
  }

  /**
   * Group errors by category
   */
  private groupByCategory(errors: ErrorReport[]): Record<string, number> {
    return errors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Pre-commit hook validation
   */
  public async validateForCommit(stagedFiles: string[]): Promise<boolean> {
    this.logger.info(`Validating ${stagedFiles.length} staged files`);

    const errors: ErrorReport[] = [];
    
    for (const file of stagedFiles) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const fileErrors = await this.engine.detectErrors(file);
        errors.push(...fileErrors.filter(e => e.severity === 'error'));
      }
    }

    if (errors.length > 0) {
      this.logger.error(`❌ Commit blocked: ${errors.length} errors found`);
      errors.forEach(error => {
        this.logger.error(`  ${error.filePath}:${error.line} - ${error.message}`);
      });
      return false;
    }

    this.logger.info('✅ Pre-commit validation passed');
    return true;
  }
}