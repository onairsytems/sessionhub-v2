
/**
 * ErrorDetectionEngine.ts
 * Comprehensive error detection and prevention system for SessionHub
 * 
 * This engine provides multi-layer error detection covering:
 * - TypeScript errors (type, syntax, semantic)
 * - Next.js specific errors
 * - Real-time monitoring
 * - Build-time validation
 * - Error categorization and prioritization
 */

import * as ts from 'typescript';
import { ESLint } from 'eslint';
import { Logger } from '../../lib/logging/Logger';
import { ErrorCatalog } from './ErrorCatalog';
import { ErrorPattern, ErrorReport, ErrorSeverity, ValidationResult } from './types';

export class ErrorDetectionEngine {
  private tsConfig!: ts.ParsedCommandLine;
  private eslint!: ESLint;
  private errorCatalog: ErrorCatalog;
  private logger: Logger;
  private watchers: Map<string, ts.FileWatcher> = new Map();
  private errorCache: Map<string, ErrorReport[]> = new Map();

  constructor() {
    this.logger = new Logger('ErrorDetectionEngine');
    this.errorCatalog = new ErrorCatalog();
    this.initializeTypeScript();
    this.initializeESLint();
  }

  /**
   * Initialize TypeScript compiler with strict settings
   */
  private initializeTypeScript(): void {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      throw new Error('tsconfig.json not found');
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    this.tsConfig = ts.parseJsonConfigFileContent(
      {
        ...configFile.config,
        compilerOptions: {
          ...configFile.config.compilerOptions,
          // Enforce strict mode for comprehensive error detection
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true,
          strictFunctionTypes: true,
          strictBindCallApply: true,
          strictPropertyInitialization: true,
          noImplicitThis: true,
          alwaysStrict: true,
          // Additional strict checks
          noUnusedLocals: true,
          noUnusedParameters: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedIndexedAccess: true,
          noPropertyAccessFromIndexSignature: true,
          // Module resolution
          moduleResolution: 'node',
          resolveJsonModule: true,
          esModuleInterop: true,
          // JSX
          jsx: 'react-jsx'
        }
      },
      ts.sys,
      ts.sys.getCurrentDirectory()
    );
  }

  /**
   * Initialize ESLint with Next.js specific rules
   */
  private initializeESLint(): void {
    this.eslint = new ESLint({
      overrideConfig: {
        rules: {
          // TypeScript specific rules
          '@typescript-eslint/no-explicit-any': 'error',
          '@typescript-eslint/explicit-function-return-type': 'error',
          '@typescript-eslint/no-unused-vars': 'error',
          '@typescript-eslint/no-floating-promises': 'error',
          '@typescript-eslint/no-misused-promises': 'error',
          '@typescript-eslint/await-thenable': 'error',
          '@typescript-eslint/no-unnecessary-type-assertion': 'error',
          '@typescript-eslint/no-unsafe-assignment': 'error',
          '@typescript-eslint/no-unsafe-member-access': 'error',
          '@typescript-eslint/no-unsafe-call': 'error',
          '@typescript-eslint/no-unsafe-return': 'error',
          
          // Next.js specific rules
          '@next/next/no-html-link-for-pages': 'error',
          '@next/next/no-img-element': 'error',
          '@next/next/no-sync-scripts': 'error',
          '@next/next/no-document-import-in-page': 'error',
          '@next/next/no-page-custom-font': 'error',
          '@next/next/no-assign-module-variable': 'error',
          
          // React rules
          'react/jsx-no-target-blank': 'error',
          'react/jsx-key': 'error',
          'react/no-unescaped-entities': 'error',
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'error'
        }
      }
    });
  }

  /**
   * Perform comprehensive error detection on a file
   */
  public async detectErrors(filePath: string): Promise<ErrorReport[]> {
    const errors: ErrorReport[] = [];

    try {
      // TypeScript errors
      const tsErrors = await this.detectTypeScriptErrors(filePath);
      errors.push(...tsErrors);

      // ESLint errors
      const eslintErrors = await this.detectESLintErrors(filePath);
      errors.push(...eslintErrors);

      // Next.js specific errors
      const nextErrors = await this.detectNextJsErrors(filePath);
      errors.push(...nextErrors);

      // Custom pattern matching
      const patternErrors = await this.detectPatternErrors(filePath);
      errors.push(...patternErrors);

      // Cache results
      this.errorCache.set(filePath, errors);

      // Log summary
      if (errors.length > 0) {
        this.logger.error(`Found ${errors.length} errors in ${filePath}`);
      }

      return errors;
    } catch (error) {
      this.logger.error(`Error detection failed for ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * Detect TypeScript compilation errors
   */
  private async detectTypeScriptErrors(filePath: string): Promise<ErrorReport[]> {
    const program = ts.createProgram([filePath], this.tsConfig.options);
    const diagnostics = [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
      ...program.getDeclarationDiagnostics()
    ];

    return diagnostics.map(diagnostic => {
      const file = diagnostic.file;
      const start = diagnostic.start || 0;
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      
      let line = 0;
      let column = 0;
      if (file && start) {
        const { line: l, character: c } = file.getLineAndCharacterOfPosition(start);
        line = l + 1;
        column = c + 1;
      }

      const errorCode = `TS${diagnostic.code}`;
      const suggestion = this.errorCatalog.getSuggestion(errorCode, message);

      return {
        filePath: file?.fileName || filePath,
        line,
        column,
        severity: this.mapTsSeverity(diagnostic.category),
        category: 'TypeScript',
        code: errorCode,
        message,
        suggestion,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Detect ESLint errors
   */
  private async detectESLintErrors(filePath: string): Promise<ErrorReport[]> {
    const results = await this.eslint.lintFiles([filePath]);
    const errors: ErrorReport[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        const suggestion = this.errorCatalog.getSuggestion(
          message.ruleId || 'any',
          message.message
        );

        errors.push({
          filePath: result.filePath,
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          category: this.categorizeESLintRule(message.ruleId || ''),
          code: message.ruleId || 'unknown',
          message: message.message,
          suggestion,
          timestamp: new Date().toISOString()
        });
      }
    }

    return errors;
  }

  /**
   * Detect Next.js specific errors
   */
  private async detectNextJsErrors(filePath: string): Promise<ErrorReport[]> {
    const errors: ErrorReport[] = [];
    const content = await ts.sys.readFile(filePath) || '';

    // Check for server component violations
    if (filePath.includes('app/') && !filePath.includes('.client.')) {
      const clientSidePatterns = [
        /useState\s*\(/,
        /useEffect\s*\(/,
        /useContext\s*\(/,
        /onClick\s*=/,
        /onChange\s*=/,
        /window\./,
        /document\./,
        /localStorage\./,
        /sessionStorage\./
      ];

      clientSidePatterns.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
          const lines = content.substring(0, match.index).split('\n');
          errors.push({
            filePath,
            line: lines.length,
            column: (lines.length > 0 && lines[lines.length - 1]?.length || 0) + 1,
            severity: 'error',
            category: 'Next.js',
            code: 'NEXT_SERVER_COMPONENT_CLIENT_CODE',
            message: `Server component contains client-side code: ${match[0]}`,
            suggestion: 'Add "use client" directive or move client code to a client component',
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Check for invalid async components
    if (content.includes('async function') && content.includes('export default')) {
      const asyncComponentPattern = /export\s+default\s+async\s+function/;
      if (asyncComponentPattern.test(content) && !filePath.includes('app/')) {
        errors.push({
          filePath,
          line: 1,
          column: 1,
          severity: 'error',
          category: 'Next.js',
          code: 'NEXT_INVALID_ASYNC_COMPONENT',
          message: 'Async components are only allowed in app directory',
          suggestion: 'Move component to app directory or remove async',
          timestamp: new Date().toISOString()
        });
      }
    }

    return errors;
  }

  /**
   * Detect pattern-based errors
   */
  private async detectPatternErrors(filePath: string): Promise<ErrorReport[]> {
    const content = await ts.sys.readFile(filePath) || '';
    const errors: ErrorReport[] = [];
    
    // Define error patterns
    const patterns: ErrorPattern[] = [
      {
        pattern: /console\.(log|error|warn|info|debug)\(/g,
        code: 'NO_CONSOLE',
        message: 'Console statements should be removed in production',
        severity: 'warning',
        category: 'Code Quality'
      },
      {
        pattern: /debugger;/g,
        code: 'NO_DEBUGGER',
        message: 'Debugger statements must be removed',
        severity: 'error',
        category: 'Code Quality'
      },
      {
        pattern: /any\s*;|:\s*any\s*[,\)]/g,
        code: 'NO_ANY_TYPE',
        message: 'Avoid using "any" type',
        severity: 'error',
        category: 'TypeScript'
      },
      {
        pattern: /process\.env\[['"]([^'"]+)['"]\]/g,
        code: 'ENV_VAR_BRACKET_ACCESS',
        message: 'Use dot notation for environment variables',
        severity: 'error',
        category: 'Code Style'
      },
      {
        pattern: /throw\s+new\s+Error\([^)]*\)\s*;?\s*}/g,
        code: 'UNHANDLED_ERROR',
        message: 'Error thrown without proper error boundary',
        severity: 'warning',
        category: 'Error Handling'
      }
    ];

    // Check each pattern
    patterns.forEach(({ pattern, code, message, severity, category }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lines = content.substring(0, match.index).split('\n');
        const line = lines.length;
        const column = (lines.length > 0 && lines[lines.length - 1]?.length || 0) + 1;

        errors.push({
          filePath,
          line,
          column,
          severity,
          category,
          code,
          message,
          suggestion: this.errorCatalog.getSuggestion(code, message),
          timestamp: new Date().toISOString()
        });
      }
    });

    return errors;
  }

  /**
   * Start real-time error monitoring
   */
  public startRealTimeMonitoring(
    filePaths: string[], 
    onError: (errors: ErrorReport[]) => void
  ): void {
    filePaths.forEach(filePath => {
      const watcher = ts.sys.watchFile?.(filePath, async () => {
        try {
          const errors = await this.detectErrors(filePath);
          if (errors.length > 0) {
            onError(errors);
          }
        } catch (error) {
          this.logger.error(`Real-time monitoring error for ${filePath}`, error as Error);
        }
      });

      if (watcher) {
        this.watchers.set(filePath, watcher);
      }
    });

    this.logger.info(`Started real-time monitoring for ${filePaths.length} files`);
  }

  /**
   * Stop real-time monitoring
   */
  public stopRealTimeMonitoring(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    this.logger.info('Stopped real-time monitoring');
  }

  /**
   * Validate entire project
   */
  public async validateProject(): Promise<ValidationResult> {
    const startTime = Date.now();
    const allErrors: ErrorReport[] = [];
    
    try {
      // Get all TypeScript files
      const files = this.tsConfig.fileNames;
      
      // Process files in parallel batches
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchErrors = await Promise.all(
          batch.map(file => this.detectErrors(file))
        );
        allErrors.push(...batchErrors.flat());
      }

      // Categorize errors
      const errorsBySeverity = this.categorizeErrors(allErrors);
      const errorsByCategory = this.groupByCategory(allErrors);
      
      const result: ValidationResult = {
        success: allErrors.filter(e => e.severity === 'error').length === 0,
        totalErrors: allErrors.length,
        errorsBySeverity,
        errorsByCategory,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        errors: allErrors
      };

      // Log summary
      this.logger.info('Project validation complete', {
        success: result.success,
        totalErrors: result.totalErrors,
        duration: result.duration
      });

      return result;
    } catch (error) {
      this.logger.error('Project validation failed', error as Error);
      throw error;
    }
  }

  /**
   * Get cached errors for a file
   */
  public getCachedErrors(filePath: string): ErrorReport[] {
    return this.errorCache.get(filePath) || [];
  }

  /**
   * Clear error cache
   */
  public clearCache(filePath?: string): void {
    if (filePath) {
      this.errorCache.delete(filePath);
    } else {
      this.errorCache.clear();
    }
  }

  /**
   * Map TypeScript severity
   */
  private mapTsSeverity(category: ts.DiagnosticCategory): ErrorSeverity {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      case ts.DiagnosticCategory.Suggestion:
      case ts.DiagnosticCategory.Message:
        return 'info';
      default:
        return 'warning';
    }
  }

  /**
   * Categorize ESLint rule
   */
  private categorizeESLintRule(ruleId: string): string {
    if (ruleId.startsWith('@typescript-eslint/')) return 'TypeScript';
    if (ruleId.startsWith('@next/')) return 'Next.js';
    if (ruleId.startsWith('react/') || ruleId.startsWith('react-hooks/')) return 'React';
    return 'ESLint';
  }

  /**
   * Categorize errors by severity
   */
  private categorizeErrors(errors: ErrorReport[]): Record<ErrorSeverity, number> {
    return errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
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
}