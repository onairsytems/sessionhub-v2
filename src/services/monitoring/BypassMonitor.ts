
/**
 * Bypass Monitor Service
 * Detects and logs attempts to bypass quality gates
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface BypassAttempt {
  timestamp: string;
  type: 'git' | 'build' | 'typescript' | 'hook' | 'config';
  severity: 'warning' | 'critical';
  details: string;
  user: string;
  cwd: string;
}

export class BypassMonitor extends EventEmitter {
  private readonly logFile: string;
  private readonly alertFile: string;
  private watchIntervals: NodeJS.Timeout[] = [];

  constructor() {
    super();
    const logDir = path.join(process.env['HOME']!, '.sessionhub');
    fs.mkdirSync(logDir, { recursive: true });
    
    this.logFile = path.join(logDir, 'bypass-attempts.log');
    this.alertFile = path.join(logDir, 'critical-alerts.log');
  }

  /**
   * Start monitoring for bypass attempts
   */
  public startMonitoring(): void {
// REMOVED: console statement
    
    // Monitor git audit log
    this.watchGitAudit();
    
    // Monitor TypeScript config violations
    this.watchTSConfigViolations();
    
    // Monitor process environment
    this.watchEnvironment();
    
    // Monitor file system for dangerous patterns
    this.watchFileSystem();
  }

  /**
   * Stop all monitoring
   */
  public stopMonitoring(): void {
    this.watchIntervals.forEach(interval => clearInterval(interval));
    this.watchIntervals = [];
  }

  /**
   * Log a bypass attempt
   */
  public logAttempt(attempt: BypassAttempt): void {
    const logEntry = JSON.stringify(attempt) + '\n';
    
    fs.appendFileSync(this.logFile, logEntry);
    
    if (attempt.severity === 'critical') {
      fs.appendFileSync(this.alertFile, logEntry);
      this.emit('critical-alert', attempt);
    }
    
    this.emit('bypass-attempt', attempt);
  }

  /**
   * Get recent bypass attempts
   */
  public getRecentAttempts(hours: number = 24): BypassAttempt[] {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }

    const logs = fs.readFileSync(this.logFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as BypassAttempt);

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    return logs.filter(log => new Date(log.timestamp) > cutoff);
  }

  /**
   * Generate a security report
   */
  public generateReport(): string {
    const attempts = this.getRecentAttempts(24 * 7); // Last week
    const criticalCount = attempts.filter(a => a.severity === 'critical').length;
    const byType = attempts.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
# SessionHub Security Report
Generated: ${new Date().toISOString()}

## Summary
- Total bypass attempts: ${attempts.length}
- Critical attempts: ${criticalCount}

## Attempts by Type
${Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

## Recent Critical Alerts
${attempts.filter(a => a.severity === 'critical')
  .slice(0, 10)
  .map(a => `- [${a.timestamp}] ${a.type}: ${a.details}`)
  .join('\n')}
`;
  }

  private watchGitAudit(): void {
    const auditLog = path.join(process.env['HOME']!, '.sessionhub/git-audit.log');
    
    if (fs.existsSync(auditLog)) {
      let lastSize = fs.statSync(auditLog).size;
      
      const interval = setInterval(() => {
        if (!fs.existsSync(auditLog)) return;
        
        const currentSize = fs.statSync(auditLog).size;
        if (currentSize > lastSize) {
          // Read new entries
          const fd = fs.openSync(auditLog, 'r');
          const buffer = Buffer.alloc(currentSize - lastSize);
          fs.readSync(fd, buffer, 0, buffer.length, lastSize);
          fs.closeSync(fd);
          
          const newEntries = buffer.toString().split('\n').filter(line => line);
          newEntries.forEach(entry => {
            if (entry.includes('BYPASS_ATTEMPT') || entry.includes('FORCE_PUSH')) {
              this.logAttempt({
                timestamp: new Date().toISOString(),
                type: 'git',
                severity: entry.includes('BYPASS_ATTEMPT') ? 'critical' : 'warning',
                details: entry,
                user: process.env['USER'] || 'unknown',
                cwd: process.cwd()
              });
            }
          });
          
          lastSize = currentSize;
        }
      }, 1000);
      
      this.watchIntervals.push(interval);
    }
  }

  private watchTSConfigViolations(): void {
    const violationLog = path.join(process.env['HOME']!, '.sessionhub/tsconfig-violations.log');
    
    if (fs.existsSync(violationLog)) {
      fs.watchFile(violationLog, () => {
        this.logAttempt({
          timestamp: new Date().toISOString(),
          type: 'typescript',
          severity: 'critical',
          details: 'TypeScript configuration violation detected',
          user: process.env['USER'] || 'unknown',
          cwd: process.cwd()
        });
      });
    }
  }

  private watchEnvironment(): void {
    const dangerousVars = [
      'HUSKY_SKIP_HOOKS',
      'SKIP_PREFLIGHT_CHECK',
      'FORCE_COLOR'
    ];

    const interval = setInterval(() => {
      dangerousVars.forEach(varName => {
        if (process.env[varName] && process.env[varName] !== '0') {
          this.logAttempt({
            timestamp: new Date().toISOString(),
            type: 'hook',
            severity: 'critical',
            details: `Environment variable ${varName}=${process.env[varName]} detected`,
            user: process.env['USER'] || 'unknown',
            cwd: process.cwd()
          });
        }
      });
    }, 5000);
    
    this.watchIntervals.push(interval);
  }

  private watchFileSystem(): void {
    const dangerousPatterns = [
      '.git/hooks',
      'tsconfig.json',
      '.eslintrc',
      '.prettierrc'
    ];

    dangerousPatterns.forEach(pattern => {
      if (fs.existsSync(pattern)) {
        fs.watchFile(pattern, () => {
          this.logAttempt({
            timestamp: new Date().toISOString(),
            type: 'config',
            severity: 'warning',
            details: `Configuration file ${pattern} was modified`,
            user: process.env['USER'] || 'unknown',
            cwd: process.cwd()
          });
        });
      }
    });
  }
}

// Export singleton instance
export const bypassMonitor = new BypassMonitor();