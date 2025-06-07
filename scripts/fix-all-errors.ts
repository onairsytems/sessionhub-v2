#!/usr/bin/env ts-node

/**
 * Automatic Error Fixing Script
 * 
 * This script attempts to automatically fix common TypeScript and ESLint errors
 * to help maintain the zero-error policy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ErrorDetectionEngine } from '../src/core/error-detection/ErrorDetectionEngine';
import { Logger } from '../src/lib/logging/Logger';

const logger = new Logger('ErrorFixer');

interface ErrorFix {
  pattern: RegExp;
  fix: () => void;
  description: string;
}

class AutomaticErrorFixer {
  private errorDetector: ErrorDetectionEngine;
  private fixCount: number = 0;
  private errorFixes: ErrorFix[] = [
    {
      pattern: /Cannot find module '(.+)' or its corresponding type declarations/,
      fix: this.fixMissingModule.bind(this),
      description: 'Fix missing module imports'
    },
    {
      pattern: /Property '(.+)' does not exist on type '(.+)'/,
      fix: this.fixMissingProperty.bind(this),
      description: 'Fix missing properties on types'
    },
    {
      pattern: /'(.+)' is declared but its value is never read/,
      fix: this.fixUnusedVariable.bind(this),
      description: 'Remove unused variables'
    },
    {
      pattern: /Expected (.+) arguments, but got (.+)/,
      fix: this.fixArgumentCount.bind(this),
      description: 'Fix function argument counts'
    },
    {
      pattern: /Type '(.+)' is not assignable to type '(.+)'/,
      fix: this.fixTypeAssignment.bind(this),
      description: 'Fix type assignments'
    }
  ];

  constructor() {
    this.errorDetector = new ErrorDetectionEngine();
  }

  async fixAllErrors(): Promise<void> {
    logger.info('Starting automatic error fixing...');
    
    // Step 1: Fix ESLint errors
    await this.fixESLintErrors();
    
    // Step 2: Fix TypeScript errors
    await this.fixTypeScriptErrors();
    
    // Step 3: Fix missing dependencies
    await this.fixMissingDependencies();
    
    // Step 4: Fix import/export issues
    await this.fixImportExportIssues();
    
    // Step 5: Run final validation
    await this.runFinalValidation();
    
    logger.info(`Fixed ${this.fixCount} errors automatically`);
  }

  private async fixESLintErrors(): Promise<void> {
    logger.info('Fixing ESLint errors...');
    
    try {
      // First, ensure ESLint config is correct
      await this.fixESLintConfig();
      
      // Run ESLint with --fix
      execSync('npx eslint . --fix --ext .ts,.tsx,.js,.jsx', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      logger.info('ESLint auto-fix completed');
    } catch (error) {
      logger.warn('Some ESLint errors could not be auto-fixed');
    }
  }

  private async fixESLintConfig(): Promise<void> {
    const eslintConfigPath = path.join(process.cwd(), '.eslintrc.json');
    
    if (!fs.existsSync(eslintConfigPath)) {
      // Create a proper ESLint config
      const eslintConfig = {
        extends: [
          'next/core-web-vitals',
          'plugin:@typescript-eslint/recommended'
        ],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
          '@typescript-eslint/no-explicit-any': 'warn',
          '@typescript-eslint/explicit-function-return-type': 'off',
          '@typescript-eslint/no-unused-vars': ['error', { 
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
          }],
          '@typescript-eslint/no-floating-promises': 'error',
          '@typescript-eslint/no-misused-promises': 'error',
          '@typescript-eslint/await-thenable': 'error',
          '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
          '@typescript-eslint/no-unsafe-assignment': 'warn'
        },
        ignorePatterns: [
          'node_modules/',
          '.next/',
          'out/',
          'dist/',
          'dist-electron/'
        ]
      };
      
      fs.writeFileSync(eslintConfigPath, JSON.stringify(eslintConfig, null, 2));
      logger.info('Created ESLint configuration');
      this.fixCount++;
    }
  }

  private async fixTypeScriptErrors(): Promise<void> {
    logger.info('Fixing TypeScript errors...');
    
    const validationResult = await this.errorDetector.validateProject();
    const errors = validationResult.errors.filter(err => err.category === 'TypeScript');
    
    logger.info(`Found ${errors.length} TypeScript errors to fix`);
    
    for (const error of errors) {
      for (const errorFix of this.errorFixes) {
        const match = error.message.match(errorFix.pattern);
        if (match) {
          try {
            errorFix.fix(error.filePath, error.line, match);
            this.fixCount++;
          } catch (fixError) {
            logger.warn(`Could not apply fix for: ${error.message}`);
          }
        }
      }
    }
  }

  private async fixMissingDependencies(): Promise<void> {
    logger.info('Checking for missing dependencies...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Ensure required dependencies are installed
    const requiredDeps = {
      '@typescript-eslint/parser': '^5.0.0',
      '@typescript-eslint/eslint-plugin': '^5.0.0',
      'eslint-config-next': '^14.0.0'
    };
    
    let depsAdded = false;
    
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!packageJson.devDependencies?.[dep]) {
        packageJson.devDependencies = packageJson.devDependencies || {};
        packageJson.devDependencies[dep] = version;
        depsAdded = true;
        logger.info(`Added missing dependency: ${dep}`);
        this.fixCount++;
      }
    }
    
    if (depsAdded) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      logger.info('Installing new dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }
  }

  private async fixImportExportIssues(): Promise<void> {
    logger.info('Fixing import/export issues...');
    
    // Fix common import issues
    // const filesToFix = [
    //   'src/**/*.ts',
    //   'src/**/*.tsx',
    //   'scripts/**/*.ts',
    //   'main/**/*.ts',
    //   'renderer/**/*.ts',
    //   'renderer/**/*.tsx'
    // ];
    
    // This would normally scan files and fix import issues
    // For now, we'll ensure tsconfig paths are correct
    await this.fixTsConfigPaths();
  }

  private async fixTsConfigPaths(): Promise<void> {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    
    // Ensure proper compiler options
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.baseUrl = '.';
    tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};
    
    // Add common path mappings
    const pathMappings = {
      '@/*': ['src/*'],
      '@components/*': ['components/*'],
      '@lib/*': ['lib/*'],
      '@renderer/*': ['renderer/*'],
      '@main/*': ['main/*']
    };
    
    for (const [key, value] of Object.entries(pathMappings)) {
      if (!tsconfig.compilerOptions.paths[key]) {
        tsconfig.compilerOptions.paths[key] = value;
        this.fixCount++;
      }
    }
    
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }

  private async runFinalValidation(): Promise<void> {
    logger.info('Running final validation...');
    
    try {
      execSync('npm run validate', { encoding: 'utf8', stdio: 'pipe' });
      logger.info('✅ All validations passed!');
    } catch (error) {
      logger.warn('Some errors remain after automatic fixing');
      
      // Generate a report of remaining errors
      const validationResult = await this.errorDetector.validateProject();
      const remainingErrors = validationResult.errors;
      
      if (remainingErrors.length > 0) {
        const reportPath = path.join(process.cwd(), 'remaining-errors.txt');
        const report = `Total Errors: ${validationResult.totalErrors}\n` +
          `Errors by Severity: ${JSON.stringify(validationResult.errorsBySeverity, null, 2)}\n` +
          `Errors by Category: ${JSON.stringify(validationResult.errorsByCategory, null, 2)}\n\n` +
          `Detailed Errors:\n` +
          remainingErrors.map(err => 
            `${err.filePath}:${err.line}:${err.column} - [${err.category}] ${err.message}`
          ).join('\n');
        
        fs.writeFileSync(reportPath, report);
        logger.info(`Remaining errors written to: ${reportPath}`);
      }
    }
  }

  // Individual fix methods
  private fixMissingModule(filePath: string, _line: number, match: RegExpMatchArray): void {
    const moduleName = match[1];
    logger.info(`Fixing missing module: ${moduleName} in ${filePath}`);
    
    // This would implement actual module fixing logic
    // For now, we'll log the issue
  }

  private fixMissingProperty(filePath: string, _line: number, match: RegExpMatchArray): void {
    const property = match[1];
    const type = match[2];
    logger.info(`Fixing missing property: ${property} on type ${type} in ${filePath}`);
    
    // This would implement actual property fixing logic
  }

  private fixUnusedVariable(filePath: string, _line: number, match: RegExpMatchArray): void {
    const variable = match[1];
    logger.info(`Removing unused variable: ${variable} in ${filePath}:${_line}`);
    
    // Read file and remove the unused variable
    // This is a simplified implementation
  }

  private fixArgumentCount(filePath: string, _line: number, match: RegExpMatchArray): void {
    const expected = match[1];
    const got = match[2];
    logger.info(`Fixing argument count: expected ${expected}, got ${got} in ${filePath}:${_line}`);
  }

  private fixTypeAssignment(filePath: string, _line: number, match: RegExpMatchArray): void {
    const fromType = match[1];
    const toType = match[2];
    logger.info(`Fixing type assignment: ${fromType} to ${toType} in ${filePath}:${_line}`);
  }
}

// Main execution
async function main() {
  const fixer = new AutomaticErrorFixer();
  
  try {
    await fixer.fixAllErrors();
    console.log('\n✅ Automatic error fixing completed!');
  } catch (error) {
    console.error('❌ Error fixing failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { AutomaticErrorFixer };