/**
 * @actor system
 * @responsibility Periodic backup health monitoring and integrity verification
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface BackupHealthStatus {
  healthy: boolean;
  totalBackups: number;
  healthyBackups: number;
  corruptedBackups: number;
  lastCheckTime: Date;
  nextScheduledCheck: Date;
  issues: HealthIssue[];
  recommendations: string[];
}

export interface HealthIssue {
  backupId: string;
  filePath: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'corruption' | 'missing' | 'checksum-mismatch' | 'outdated' | 'size-anomaly';
  description: string;
  detectedAt: Date;
  autoFixable: boolean;
}

export interface HealthCheckResult {
  backupId: string;
  filePath: string;
  healthy: boolean;
  issues: HealthIssue[];
  checkDuration: number;
}

export interface MonitoringConfig {
  checkInterval: number; // milliseconds
  maxBackupAge: number; // milliseconds
  minBackupSize: number; // bytes
  maxBackupSize: number; // bytes
  enableAutoFix: boolean;
  alertThreshold: number; // percentage of unhealthy backups
}

export class BackupHealthMonitor extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly config: MonitoringConfig;
  private readonly backupDirs: string[];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastHealthStatus: BackupHealthStatus | null = null;
  private healthCache: Map<string, HealthCheckResult> = new Map();

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    backupDirs: string[],
    config?: Partial<MonitoringConfig>
  ) {
    super();
    
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.backupDirs = backupDirs;
    
    this.config = {
      checkInterval: 60 * 60 * 1000, // 1 hour
      maxBackupAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      minBackupSize: 100, // 100 bytes
      maxBackupSize: 100 * 1024 * 1024, // 100 MB
      enableAutoFix: true,
      alertThreshold: 20, // Alert if >20% backups are unhealthy
      ...config
    };
  }

  /**
   * Start monitoring backup health
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      this.logger.warn('Backup health monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.logger.info('Starting backup health monitoring', {
      checkInterval: this.config.checkInterval,
      backupDirs: this.backupDirs
    });

    // Perform initial check
    await this.performHealthCheck();

    // Schedule periodic checks
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkInterval);

    this.emit('monitoring-started');
  }

  /**
   * Stop monitoring backup health
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    this.logger.info('Stopped backup health monitoring');
    this.emit('monitoring-stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<BackupHealthStatus> {
    const startTime = Date.now();
    const issues: HealthIssue[] = [];
    const healthResults: HealthCheckResult[] = [];

    this.logger.info('Starting backup health check');

    try {
      // Scan all backup directories
      for (const dir of this.backupDirs) {
        try {
          const files = await this.scanBackupDirectory(dir);
          
          for (const file of files) {
            const result = await this.checkBackupHealth(file);
            healthResults.push(result);
            issues.push(...result.issues);
          }
        } catch (error) {
          this.logger.warn(`Failed to scan backup directory: ${dir}`, error as Error);
        }
      }

      // Calculate statistics
      const totalBackups = healthResults.length;
      const healthyBackups = healthResults.filter(r => r.healthy).length;
      const corruptedBackups = totalBackups - healthyBackups;
      const healthPercentage = totalBackups > 0 ? (healthyBackups / totalBackups) * 100 : 100;

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues, healthPercentage);

      // Create health status
      const status: BackupHealthStatus = {
        healthy: healthPercentage >= (100 - this.config.alertThreshold),
        totalBackups,
        healthyBackups,
        corruptedBackups,
        lastCheckTime: new Date(),
        nextScheduledCheck: new Date(Date.now() + this.config.checkInterval),
        issues,
        recommendations
      };

      this.lastHealthStatus = status;

      // Log audit event
      await this.auditLogger.log({
        action: 'backup_health_check',
        actorType: 'system',
        actorId: 'backup-health-monitor',
        details: {
          totalBackups,
          healthyBackups,
          corruptedBackups,
          healthPercentage,
          duration: Date.now() - startTime,
          issueCount: issues.length
        }
      });

      // Emit events based on health status
      if (!status.healthy) {
        this.emit('health-alert', status);
        
        // Attempt auto-fix if enabled
        if (this.config.enableAutoFix) {
          await this.attemptAutoFix(issues.filter(i => i.autoFixable));
        }
      }

      this.emit('health-check-complete', status);
      return status;

    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      throw error;
    }
  }

  /**
   * Check individual backup health
   */
  private async checkBackupHealth(filePath: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const issues: HealthIssue[] = [];
    const backupId = path.basename(filePath, path.extname(filePath));

    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      
      // Check file size
      if (stats.size < this.config.minBackupSize) {
        issues.push({
          backupId,
          filePath,
          severity: 'high',
          type: 'size-anomaly',
          description: `Backup file too small: ${stats.size} bytes`,
          detectedAt: new Date(),
          autoFixable: false
        });
      }

      if (stats.size > this.config.maxBackupSize) {
        issues.push({
          backupId,
          filePath,
          severity: 'medium',
          type: 'size-anomaly',
          description: `Backup file too large: ${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          detectedAt: new Date(),
          autoFixable: false
        });
      }

      // Check age
      const age = Date.now() - stats.mtime.getTime();
      if (age > this.config.maxBackupAge) {
        issues.push({
          backupId,
          filePath,
          severity: 'low',
          type: 'outdated',
          description: `Backup is ${Math.floor(age / (24 * 60 * 60 * 1000))} days old`,
          detectedAt: new Date(),
          autoFixable: true // Can be auto-deleted
        });
      }

      // Read and verify content
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Parse JSON
        const data = JSON.parse(content);
        
        // Verify checksum if present
        if (data.checksum) {
          const calculatedChecksum = this.calculateChecksum(JSON.stringify(data.data || data));
          if (calculatedChecksum !== data.checksum) {
            issues.push({
              backupId,
              filePath,
              severity: 'critical',
              type: 'checksum-mismatch',
              description: 'Checksum verification failed',
              detectedAt: new Date(),
              autoFixable: false
            });
          }
        }

        // Check for required fields
        if (!data.id || !data.timestamp) {
          issues.push({
            backupId,
            filePath,
            severity: 'high',
            type: 'corruption',
            description: 'Missing required fields',
            detectedAt: new Date(),
            autoFixable: false
          });
        }

      } catch (error) {
        issues.push({
          backupId,
          filePath,
          severity: 'critical',
          type: 'corruption',
          description: `Cannot read backup: ${(error as Error).message}`,
          detectedAt: new Date(),
          autoFixable: false
        });
      }

      const result: HealthCheckResult = {
        backupId,
        filePath,
        healthy: issues.length === 0,
        issues,
        checkDuration: Date.now() - startTime
      };

      // Cache result
      this.healthCache.set(filePath, result);

      return result;

    } catch (error) {
      // File doesn't exist or other system error
      return {
        backupId,
        filePath,
        healthy: false,
        issues: [{
          backupId,
          filePath,
          severity: 'critical',
          type: 'missing',
          description: `Backup file not accessible: ${(error as Error).message}`,
          detectedAt: new Date(),
          autoFixable: false
        }],
        checkDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Scan backup directory for files
   */
  private async scanBackupDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile() && (entry.endsWith('.json') || entry.endsWith('.gz'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to scan directory: ${dir}`, error as Error);
    }

    return files;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: HealthIssue[], healthPercentage: number): string[] {
    const recommendations: string[] = [];

    // Critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Immediate action required: Critical backup corruption detected');
      recommendations.push('Run emergency recovery procedure to restore from healthy backups');
    }

    // High severity issues
    const highIssues = issues.filter(i => i.severity === 'high');
    if (highIssues.length > 0) {
      recommendations.push('Several backups have integrity issues - manual review recommended');
    }

    // Outdated backups
    const outdatedCount = issues.filter(i => i.type === 'outdated').length;
    if (outdatedCount > 10) {
      recommendations.push(`Clean up ${outdatedCount} outdated backups to free up storage`);
    }

    // Low health percentage
    if (healthPercentage < 80) {
      recommendations.push('Backup health is below acceptable threshold');
      recommendations.push('Consider creating fresh full backups of critical data');
    }

    // Size anomalies
    const sizeIssues = issues.filter(i => i.type === 'size-anomaly');
    if (sizeIssues.length > 0) {
      recommendations.push('Review backup compression settings and storage limits');
    }

    return recommendations;
  }

  /**
   * Attempt to automatically fix issues
   */
  private async attemptAutoFix(fixableIssues: HealthIssue[]): Promise<void> {
    for (const issue of fixableIssues) {
      try {
        switch (issue.type) {
          case 'outdated':
            // Delete outdated backups
            await fs.unlink(issue.filePath);
            this.logger.info('Deleted outdated backup', {
              backupId: issue.backupId,
              filePath: issue.filePath
            });
            break;
            
          // Add more auto-fix cases as needed
        }

        await this.auditLogger.log({
          action: 'backup_auto_fix',
          actorType: 'system',
          actorId: 'backup-health-monitor',
          details: {
            backupId: issue.backupId,
            issueType: issue.type,
            severity: issue.severity
          }
        });

      } catch (error) {
        this.logger.error('Auto-fix failed', error as Error, {
          issue
        });
      }
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): BackupHealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Force immediate health check
   */
  async checkNow(): Promise<BackupHealthStatus> {
    return await this.performHealthCheck();
  }

  /**
   * Get health check result for specific backup
   */
  getBackupHealth(filePath: string): HealthCheckResult | undefined {
    return this.healthCache.get(filePath);
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}