/**
 * @actor system
 * @responsibility Recovery logging system for tracking all restoration activities
 */

import { Logger } from '@/src/lib/logging/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface RecoveryLogEntry {
  id: string;
  timestamp: Date;
  type: RecoveryEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  action: string;
  details: RecoveryEventDetails;
  outcome: 'success' | 'failure' | 'partial';
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
}

export type RecoveryEventType =
  | 'recovery-started'
  | 'recovery-completed'
  | 'recovery-failed'
  | 'corruption-detected'
  | 'auto-repair-attempted'
  | 'auto-repair-completed'
  | 'backup-restored'
  | 'checkpoint-created'
  | 'emergency-mode-entered'
  | 'emergency-mode-exited'
  | 'safe-mode-activated'
  | 'factory-reset-performed'
  | 'conflict-resolved'
  | 'data-merged'
  | 'integrity-check'
  | 'health-check';

export interface RecoveryEventDetails {
  sessionId?: string;
  backupId?: string;
  recoveryPointId?: string;
  sourceFile?: string;
  targetFile?: string;
  filesAffected?: number;
  dataSize?: number;
  integrityScore?: number;
  repairsAttempted?: number;
  repairsSuccessful?: number;
  conflictsResolved?: number;
  warningCount?: number;
  errorCount?: number;
  metadata?: Record<string, any>;
}

export interface RecoveryLogSummary {
  totalEvents: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  partialRecoveries: number;
  corruptionEvents: number;
  autoRepairs: number;
  emergencyModeActivations: number;
  factoryResets: number;
  lastRecoveryDate?: Date;
  lastSuccessfulRecovery?: Date;
  lastFailedRecovery?: Date;
  averageRecoveryDuration: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
}

export interface RecoveryLogQuery {
  startDate?: Date;
  endDate?: Date;
  type?: RecoveryEventType | RecoveryEventType[];
  severity?: 'info' | 'warning' | 'error' | 'critical';
  outcome?: 'success' | 'failure' | 'partial';
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export class RecoveryLogger {
  private readonly logger: Logger;
  private readonly logDir: string;
  private readonly maxLogSize = 50 * 1024 * 1024; // 50MB per log file
  private readonly maxLogFiles = 10;
  private currentLogFile: string;
  private logBuffer: RecoveryLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger, logDir?: string) {
    this.logger = logger;
    this.logDir = logDir || path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'SessionHub',
      'recovery-logs'
    );
    
    this.currentLogFile = this.generateLogFileName();
    this.initializeLogger();
  }

  /**
   * Initialize the recovery logger
   */
  private async initializeLogger(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Start flush interval
      this.flushInterval = setInterval(() => {
        this.flushBuffer();
      }, 5000); // Flush every 5 seconds
      
      this.logger.info('Recovery logger initialized', {
        logDir: this.logDir,
        currentLogFile: this.currentLogFile
      });
    } catch (error) {
      this.logger.error('Failed to initialize recovery logger', error as Error);
    }
  }

  /**
   * Log a recovery event
   */
  async log(entry: Omit<RecoveryLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: RecoveryLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Log to system logger based on severity
    const logContext = {
      type: entry.type,
      details: entry.details,
      outcome: entry.outcome
    };
    
    switch (entry.severity) {
      case 'critical':
      case 'error':
        this.logger.error(
          `Recovery: ${entry.action}`,
          entry.errorMessage ? new Error(entry.errorMessage) : undefined,
          logContext
        );
        break;
      case 'warning':
        this.logger.warn(`Recovery: ${entry.action}`, logContext);
        break;
      default:
        this.logger.info(`Recovery: ${entry.action}`, logContext);
    }

    // Flush immediately for critical events
    if (entry.severity === 'critical' || entry.type === 'recovery-failed') {
      await this.flushBuffer();
    }
  }

  /**
   * Query recovery logs
   */
  async query(query: RecoveryLogQuery): Promise<RecoveryLogEntry[]> {
    const results: RecoveryLogEntry[] = [];
    
    try {
      // Get all log files
      const logFiles = await this.getLogFiles();
      
      for (const file of logFiles) {
        const entries = await this.readLogFile(file);
        
        for (const entry of entries) {
          if (this.matchesQuery(entry, query)) {
            results.push(entry);
          }
        }
        
        // Check if we have enough results
        if (query.limit && results.length >= query.limit + (query.offset || 0)) {
          break;
        }
      }

      // Apply offset and limit
      const start = query.offset || 0;
      const end = query.limit ? start + query.limit : undefined;
      
      return results.slice(start, end);
    } catch (error) {
      this.logger.error('Failed to query recovery logs', error as Error);
      return [];
    }
  }

  /**
   * Get recovery log summary
   */
  async getSummary(startDate?: Date, endDate?: Date): Promise<RecoveryLogSummary> {
    const entries = await this.query({ startDate, endDate });
    
    const summary: RecoveryLogSummary = {
      totalEvents: entries.length,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      partialRecoveries: 0,
      corruptionEvents: 0,
      autoRepairs: 0,
      emergencyModeActivations: 0,
      factoryResets: 0,
      averageRecoveryDuration: 0,
      mostCommonErrors: []
    };

    const errorCounts: Map<string, number> = new Map();
    let totalDuration = 0;
    let durationCount = 0;

    for (const entry of entries) {
      // Count by type
      switch (entry.type) {
        case 'recovery-completed':
          if (entry.outcome === 'success') summary.successfulRecoveries++;
          else if (entry.outcome === 'partial') summary.partialRecoveries++;
          break;
        case 'recovery-failed':
          summary.failedRecoveries++;
          break;
        case 'corruption-detected':
          summary.corruptionEvents++;
          break;
        case 'auto-repair-completed':
          summary.autoRepairs++;
          break;
        case 'emergency-mode-entered':
          summary.emergencyModeActivations++;
          break;
        case 'factory-reset-performed':
          summary.factoryResets++;
          break;
      }

      // Track durations
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }

      // Track errors
      if (entry.errorMessage) {
        const count = errorCounts.get(entry.errorMessage) || 0;
        errorCounts.set(entry.errorMessage, count + 1);
      }

      // Track dates
      if (entry.type === 'recovery-completed') {
        if (!summary.lastRecoveryDate || entry.timestamp > summary.lastRecoveryDate) {
          summary.lastRecoveryDate = entry.timestamp;
        }
        
        if (entry.outcome === 'success') {
          if (!summary.lastSuccessfulRecovery || entry.timestamp > summary.lastSuccessfulRecovery) {
            summary.lastSuccessfulRecovery = entry.timestamp;
          }
        } else if (entry.outcome === 'failure') {
          if (!summary.lastFailedRecovery || entry.timestamp > summary.lastFailedRecovery) {
            summary.lastFailedRecovery = entry.timestamp;
          }
        }
      }
    }

    // Calculate average duration
    if (durationCount > 0) {
      summary.averageRecoveryDuration = Math.round(totalDuration / durationCount);
    }

    // Get most common errors
    const sortedErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
    
    summary.mostCommonErrors = sortedErrors;

    return summary;
  }

  /**
   * Export recovery logs
   */
  async exportLogs(
    outputPath: string,
    query?: RecoveryLogQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<void> {
    const entries = await this.query(query || {});
    
    if (format === 'json') {
      await fs.writeFile(outputPath, JSON.stringify(entries, null, 2));
    } else {
      const csv = this.convertToCSV(entries);
      await fs.writeFile(outputPath, csv);
    }
    
    this.logger.info('Recovery logs exported', {
      outputPath,
      format,
      entryCount: entries.length
    });
  }

  /**
   * Clean up old recovery logs
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const files = await fs.readdir(this.logDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      this.logger.info('Recovery log cleanup completed', {
        deletedCount,
        daysToKeep
      });
    } catch (error) {
      this.logger.error('Recovery log cleanup failed', error as Error);
    }
  }

  /**
   * Private helper methods
   */
  private generateId(): string {
    return `recovery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `recovery-log-${dateStr}.json`;
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    try {
      const logFilePath = path.join(this.logDir, this.currentLogFile);
      
      // Check if we need to rotate log files
      try {
        const stats = await fs.stat(logFilePath);
        if (stats.size > this.maxLogSize) {
          await this.rotateLogFiles();
        }
      } catch {
        // File doesn't exist yet
      }

      // Read existing entries
      let existingEntries: RecoveryLogEntry[] = [];
      try {
        const content = await fs.readFile(logFilePath, 'utf8');
        existingEntries = JSON.parse(content);
      } catch {
        // File doesn't exist or is empty
      }

      // Append new entries
      const allEntries = [...existingEntries, ...this.logBuffer];
      
      // Write to file
      await fs.writeFile(logFilePath, JSON.stringify(allEntries, null, 2));
      
      // Clear buffer
      this.logBuffer = [];
    } catch (error) {
      this.logger.error('Failed to flush recovery log buffer', error as Error);
    }
  }

  private async rotateLogFiles(): Promise<void> {
    // Generate new log file name
    this.currentLogFile = this.generateLogFileName();
    
    // Clean up old log files if needed
    const files = await fs.readdir(this.logDir);
    const logFiles = files
      .filter(f => f.startsWith('recovery-log-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    // Delete oldest files if we exceed max
    if (logFiles.length >= this.maxLogFiles) {
      const filesToDelete = logFiles.slice(this.maxLogFiles - 1);
      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.logDir, file));
      }
    }
  }

  private async getLogFiles(): Promise<string[]> {
    const files = await fs.readdir(this.logDir);
    return files
      .filter(f => f.startsWith('recovery-log-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => path.join(this.logDir, f));
  }

  private async readLogFile(filePath: string): Promise<RecoveryLogEntry[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private matchesQuery(entry: RecoveryLogEntry, query: RecoveryLogQuery): boolean {
    if (query.startDate && entry.timestamp < query.startDate) return false;
    if (query.endDate && entry.timestamp > query.endDate) return false;
    if (query.severity && entry.severity !== query.severity) return false;
    if (query.outcome && entry.outcome !== query.outcome) return false;
    if (query.sessionId && entry.details.sessionId !== query.sessionId) return false;
    
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      if (!types.includes(entry.type)) return false;
    }
    
    return true;
  }

  private convertToCSV(entries: RecoveryLogEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'Type',
      'Severity',
      'Action',
      'Outcome',
      'Duration',
      'Session ID',
      'Backup ID',
      'Error Message'
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.type,
      entry.severity,
      entry.action,
      entry.outcome,
      entry.duration || '',
      entry.details.sessionId || '',
      entry.details.backupId || '',
      entry.errorMessage || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  /**
   * Stop the recovery logger
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flushBuffer();
  }
}