
/**
 * Comprehensive logging system for SessionHub
 * Provides audit trail and debugging capabilities
 */

import * as os from 'os';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  actor?: string;
  operation?: string;
  correlationId?: string;
}

export class Logger {
  private readonly name: string;
  private readonly logs: LogEntry[] = [];
  private readonly maxLogs: number = 10000;
  private readonly logFile?: string;

  constructor(name: string, auditFile?: string) {
    this.name = name;
    
    // If audit file requested, use Mac log directory
    if (auditFile) {
      const logDir = path.join(os.homedir(), 'Library', 'Logs', 'SessionHub');
      this.logFile = path.join(logDir, auditFile);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, { ...context, error: error?.message, stack: error?.stack });
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.name}] ${message}`,
      context
    };

    // Add to in-memory logs
    this.logs.push(entry);
    
    // Trim logs if exceeded max
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console
    this.outputToConsole(entry);

    // Write to log file if configured
    if (this.logFile) {
      this.writeToLogFile(entry);
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const { timestamp, level, message, context } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const fullMessage = `${prefix} ${message}${contextStr}`;

    switch (level) {
      case 'debug':
        console.debug(fullMessage);
        break;
      case 'info':
        console.info(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
        console.error(fullMessage);
        break;
    }
  }

  private writeToLogFile(_entry: LogEntry): void {
    // In production Mac app, this would write to log file
    // Using async file operations to avoid blocking
    // For now, we'll skip actual file I/O
    // import { promises as fsPromises } from 'fs';
    // fsPromises.appendFile(this.logFile, JSON.stringify(entry) + '\n');
  }

  /**
   * Get logs filtered by criteria
   */
  getLogs(filter?: {
    level?: LogLevel;
    startTime?: string;
    endTime?: string;
    actor?: string;
    search?: string;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter(log => log.level === filter.level);
    }

    if (filter?.startTime) {
      const start = new Date(filter.startTime).getTime();
      filtered = filtered.filter(log => 
        new Date(log.timestamp).getTime() >= start
      );
    }

    if (filter?.endTime) {
      const end = new Date(filter.endTime).getTime();
      filtered = filtered.filter(log => 
        new Date(log.timestamp).getTime() <= end
      );
    }

    if (filter?.actor) {
      filtered = filtered.filter(log => log.actor === filter.actor);
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.context).toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }

  /**
   * Create audit report for a time period
   */
  generateAuditReport(startTime: string, endTime: string): string {
    const logs = this.getLogs({ startTime, endTime });
    
    const report = {
      period: { start: startTime, end: endTime },
      totalLogs: logs.length,
      byLevel: {
        debug: logs.filter(l => l.level === 'debug').length,
        info: logs.filter(l => l.level === 'info').length,
        warn: logs.filter(l => l.level === 'warn').length,
        error: logs.filter(l => l.level === 'error').length
      },
      errors: logs.filter(l => l.level === 'error').map(l => ({
        timestamp: l.timestamp,
        message: l.message,
        context: l.context
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs.length = 0;
  }
}