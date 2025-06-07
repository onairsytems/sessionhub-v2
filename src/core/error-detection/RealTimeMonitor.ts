/**
 * RealTimeMonitor.ts
 * Real-time error monitoring with immediate feedback
 */

import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { ErrorDetectionEngine } from './ErrorDetectionEngine';
import { ErrorReport, ErrorSeverity } from './types';
import { Logger } from '../../lib/logging/Logger';
import * as path from 'path';
import * as fs from 'fs/promises';

interface MonitoringOptions {
  debounceMs: number;
  maxConcurrentChecks: number;
  ignoredPaths: string[];
  enableAutoFix: boolean;
}

interface ErrorEvent {
  type: 'error-detected' | 'error-fixed' | 'file-changed';
  filePath: string;
  errors?: ErrorReport[];
  timestamp: string;
}

export class RealTimeMonitor extends EventEmitter {
  private engine: ErrorDetectionEngine;
  private watcher: chokidar.FSWatcher | null = null;
  private logger: Logger;
  private options: MonitoringOptions;
  private pendingChecks: Map<string, NodeJS.Timeout> = new Map();
  private activeChecks: Set<string> = new Set();
  private errorHistory: Map<string, ErrorReport[]> = new Map();

  constructor(engine: ErrorDetectionEngine, options: Partial<MonitoringOptions> = {}) {
    super();
    this.engine = engine;
    this.logger = new Logger('RealTimeMonitor');
    this.options = {
      debounceMs: 100,
      maxConcurrentChecks: 5,
      ignoredPaths: ['node_modules', '.git', 'dist', '.next', 'coverage'],
      enableAutoFix: false,
      ...options
    };
  }

  /**
   * Start monitoring files
   */
  public async start(paths: string[] = ['src', 'app', 'pages', 'components']): Promise<void> {
    try {
      this.logger.info('Starting real-time error monitoring', { paths });

      this.watcher = chokidar.watch(paths, {
        ignored: this.options.ignoredPaths,
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      // Set up event handlers
      this.watcher
        .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
        .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
        .on('unlink', (filePath) => this.handleFileRemove(filePath))
        .on('error', (error) => this.logger.error('Watcher error', { error }));

      // Wait for initial scan
      await new Promise<void>((resolve) => {
        this.watcher!.on('ready', () => {
          this.logger.info('Real-time monitoring ready');
          resolve();
        });
      });

      // Perform initial validation
      await this.performInitialScan();

    } catch (error) {
      this.logger.error('Failed to start monitoring', { error });
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Clear pending checks
    this.pendingChecks.forEach(timeout => clearTimeout(timeout));
    this.pendingChecks.clear();
    this.activeChecks.clear();

    this.logger.info('Real-time monitoring stopped');
  }

  /**
   * Handle file changes
   */
  private handleFileChange(filePath: string, event: 'add' | 'change'): void {
    // Only process TypeScript/JavaScript files
    if (!this.isValidFile(filePath)) return;

    // Debounce file checks
    if (this.pendingChecks.has(filePath)) {
      clearTimeout(this.pendingChecks.get(filePath)!);
    }

    const timeout = setTimeout(() => {
      this.pendingChecks.delete(filePath);
      this.checkFile(filePath, event);
    }, this.options.debounceMs);

    this.pendingChecks.set(filePath, timeout);
  }

  /**
   * Handle file removal
   */
  private handleFileRemove(filePath: string): void {
    this.errorHistory.delete(filePath);
    this.emit('file-removed', { filePath });
  }

  /**
   * Check file for errors
   */
  private async checkFile(filePath: string, event: 'add' | 'change'): Promise<void> {
    // Rate limiting
    if (this.activeChecks.size >= this.options.maxConcurrentChecks) {
      // Queue for later
      setTimeout(() => this.checkFile(filePath, event), 100);
      return;
    }

    this.activeChecks.add(filePath);

    try {
      const startTime = Date.now();
      const errors = await this.engine.detectErrors(filePath);
      const duration = Date.now() - startTime;

      // Compare with previous errors
      const previousErrors = this.errorHistory.get(filePath) || [];
      const hasChanged = this.hasErrorsChanged(previousErrors, errors);

      if (hasChanged) {
        this.errorHistory.set(filePath, errors);

        // Emit error event
        const errorEvent: ErrorEvent = {
          type: 'error-detected',
          filePath,
          errors,
          timestamp: new Date().toISOString()
        };

        this.emit('errors', errorEvent);

        // Log summary
        if (errors.length > 0) {
          const errorCount = errors.filter(e => e.severity === 'error').length;
          const warningCount = errors.filter(e => e.severity === 'warning').length;
          
          this.logger.warn(`Errors detected in ${path.basename(filePath)}`, {
            errorCount,
            warningCount,
            duration
          });

          // Show immediate feedback
          this.showImmediateFeedback(filePath, errors);
        } else if (previousErrors.length > 0) {
          this.logger.info(`All errors fixed in ${path.basename(filePath)}`);
          this.emit('errors-fixed', { filePath });
        }
      }

      // Attempt auto-fix if enabled
      if (this.options.enableAutoFix && errors.length > 0) {
        await this.attemptAutoFix(filePath, errors);
      }

    } catch (error) {
      this.logger.error('Error checking file', { filePath, error });
    } finally {
      this.activeChecks.delete(filePath);
    }
  }

  /**
   * Perform initial scan of all files
   */
  private async performInitialScan(): Promise<void> {
    const files = await this.getAllTrackedFiles();
    this.logger.info(`Performing initial scan of ${files.length} files`);

    const batchSize = 10;
    let totalErrors = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (file) => {
        const errors = await this.engine.detectErrors(file);
        if (errors.length > 0) {
          this.errorHistory.set(file, errors);
          totalErrors += errors.length;
        }
      }));
    }

    if (totalErrors > 0) {
      this.logger.warn(`Initial scan found ${totalErrors} errors`);
      this.emit('initial-scan-complete', { totalErrors });
    } else {
      this.logger.info('Initial scan complete - no errors found');
    }
  }

  /**
   * Check if errors have changed
   */
  private hasErrorsChanged(oldErrors: ErrorReport[], newErrors: ErrorReport[]): boolean {
    if (oldErrors.length !== newErrors.length) return true;

    const oldErrorsSet = new Set(
      oldErrors.map(e => `${e.line}:${e.column}:${e.code}:${e.message}`)
    );

    return newErrors.some(
      e => !oldErrorsSet.has(`${e.line}:${e.column}:${e.code}:${e.message}`)
    );
  }

  /**
   * Show immediate feedback for errors
   */
  private showImmediateFeedback(filePath: string, errors: ErrorReport[]): void {
    const criticalErrors = errors.filter(e => e.severity === 'error');
    if (criticalErrors.length === 0) return;

    const firstError = criticalErrors[0];
    const feedback = `
❌ Error in ${path.basename(filePath)}:${firstError.line}:${firstError.column}
${firstError.message}
${firstError.suggestion ? `💡 ${firstError.suggestion}` : ''}
    `.trim();

    // Emit feedback event for UI integration
    this.emit('feedback', { 
      type: 'error',
      message: feedback,
      filePath,
      line: firstError.line,
      column: firstError.column
    });
  }

  /**
   * Attempt to auto-fix errors
   */
  private async attemptAutoFix(filePath: string, errors: ErrorReport[]): Promise<void> {
    // Only auto-fix certain safe patterns
    const fixableErrors = errors.filter(e => 
      ['NO_CONSOLE', 'ENV_VAR_BRACKET_ACCESS', '@typescript-eslint/no-unused-vars'].includes(e.code)
    );

    if (fixableErrors.length === 0) return;

    try {
      let content = await fs.readFile(filePath, 'utf-8');
      let modified = false;

      for (const error of fixableErrors) {
        switch (error.code) {
          case 'NO_CONSOLE':
            // Remove console statements
            content = content.replace(/console\.(log|error|warn|info|debug)\([^)]*\);?\n?/g, '');
            modified = true;
            break;

          case 'ENV_VAR_BRACKET_ACCESS':
            // Convert bracket notation to dot notation
            content = content.replace(/process\.env\[['"]([^'"]+)['"]\]/g, 'process.env.$1');
            modified = true;
            break;

          case '@typescript-eslint/no-unused-vars':
            // Add underscore prefix to unused vars
            const varMatch = error.message.match(/'([^']+)' is declared but/);
            if (varMatch) {
              const varName = varMatch[1];
              content = content.replace(
                new RegExp(`\\b(const|let|var)\\s+${varName}\\b`, 'g'),
                `$1 _${varName}`
              );
              modified = true;
            }
            break;
        }
      }

      if (modified) {
        await fs.writeFile(filePath, content);
        this.logger.info(`Auto-fixed ${fixableErrors.length} errors in ${path.basename(filePath)}`);
        this.emit('auto-fix', { filePath, fixedCount: fixableErrors.length });
      }

    } catch (error) {
      this.logger.error('Auto-fix failed', { filePath, error });
    }
  }

  /**
   * Check if file should be monitored
   */
  private isValidFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  /**
   * Get all tracked files
   */
  private async getAllTrackedFiles(): Promise<string[]> {
    const files: string[] = [];
    
    if (this.watcher) {
      const watched = this.watcher.getWatched();
      for (const [dir, fileNames] of Object.entries(watched)) {
        for (const fileName of fileNames) {
          const filePath = path.join(dir, fileName);
          if (this.isValidFile(filePath)) {
            files.push(filePath);
          }
        }
      }
    }

    return files;
  }

  /**
   * Get current error summary
   */
  public getErrorSummary(): {
    totalFiles: number;
    filesWithErrors: number;
    totalErrors: number;
    errorsBySeverity: Record<ErrorSeverity, number>;
  } {
    let totalErrors = 0;
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0
    };

    for (const errors of this.errorHistory.values()) {
      totalErrors += errors.length;
      errors.forEach(error => {
        errorsBySeverity[error.severity]++;
      });
    }

    return {
      totalFiles: this.errorHistory.size,
      filesWithErrors: Array.from(this.errorHistory.values()).filter(e => e.length > 0).length,
      totalErrors,
      errorsBySeverity
    };
  }

  /**
   * Get errors for specific file
   */
  public getFileErrors(filePath: string): ErrorReport[] {
    return this.errorHistory.get(filePath) || [];
  }

  /**
   * Clear all errors
   */
  public clearErrors(): void {
    this.errorHistory.clear();
    this.emit('errors-cleared');
  }
}