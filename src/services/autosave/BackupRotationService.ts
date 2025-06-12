/**
 * @actor system
 * @responsibility Backup rotation policy with configurable retention
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RotationPolicy {
  hourly: {
    enabled: boolean;
    retainCount: number; // Keep last N hourly backups
  };
  daily: {
    enabled: boolean;
    retainCount: number; // Keep last N daily backups
  };
  weekly: {
    enabled: boolean;
    retainCount: number; // Keep last N weekly backups
  };
  monthly: {
    enabled: boolean;
    retainCount: number; // Keep last N monthly backups
  };
  maxTotalSize: number; // Maximum total size in MB
  maxAge: number; // Maximum age in days
}

export interface BackupFile {
  path: string;
  size: number;
  created: Date;
  sessionId: string;
  type: 'baseline' | 'incremental' | 'manual';
  category: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface RotationResult {
  filesScanned: number;
  filesRemoved: number;
  spaceFreed: number; // bytes
  errors: string[];
  categorization: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface StorageStatistics {
  totalFiles: number;
  totalSize: number; // bytes
  oldestBackup: Date | null;
  newestBackup: Date | null;
  byCategory: {
    hourly: { count: number; size: number };
    daily: { count: number; size: number };
    weekly: { count: number; size: number };
    monthly: { count: number; size: number };
  };
  bySessions: Map<string, { count: number; size: number }>;
}

export class BackupRotationService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly backupDir: string;
  private policy: RotationPolicy;
  private rotationInterval?: NodeJS.Timeout;

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    backupDir: string,
    policy?: Partial<RotationPolicy>
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.backupDir = backupDir;
    
    this.policy = {
      hourly: {
        enabled: true,
        retainCount: 24 // Keep last 24 hours
      },
      daily: {
        enabled: true,
        retainCount: 30 // Keep last 30 days
      },
      weekly: {
        enabled: true,
        retainCount: 12 // Keep last 12 weeks
      },
      monthly: {
        enabled: true,
        retainCount: 12 // Keep last 12 months
      },
      maxTotalSize: 5000, // 5GB
      maxAge: 365, // 1 year
      ...policy
    };

    this.logger.info('BackupRotationService initialized', {
      backupDir: this.backupDir,
      policy: this.policy
    });
  }

  /**
   * Start automatic rotation service
   */
  startAutomaticRotation(intervalHours = 6): void {
    if (this.rotationInterval) {
      this.logger.warn('Automatic rotation already running');
      return;
    }

    this.rotationInterval = setInterval(async () => {
      try {
        await this.performRotation();
      } catch (error) {
        this.logger.error('Automatic rotation failed', error as Error);
      }
    }, intervalHours * 60 * 60 * 1000);

    this.logger.info('Automatic rotation started', {
      intervalHours
    });
  }

  /**
   * Stop automatic rotation service
   */
  stopAutomaticRotation(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
      this.logger.info('Automatic rotation stopped');
    }
  }

  /**
   * Perform backup rotation
   */
  async performRotation(): Promise<RotationResult> {
    const startTime = Date.now();
    
    this.logger.info('Starting backup rotation');

    try {
      const backupFiles = await this.scanBackupFiles();
      const categorizedFiles = this.categorizeBackupsByAge(backupFiles);
      
      const result: RotationResult = {
        filesScanned: backupFiles.length,
        filesRemoved: 0,
        spaceFreed: 0,
        errors: [],
        categorization: {
          hourly: categorizedFiles.hourly.length,
          daily: categorizedFiles.daily.length,
          weekly: categorizedFiles.weekly.length,
          monthly: categorizedFiles.monthly.length
        }
      };

      // Apply rotation policies
      await this.applyHourlyRotation(categorizedFiles.hourly, result);
      await this.applyDailyRotation(categorizedFiles.daily, result);
      await this.applyWeeklyRotation(categorizedFiles.weekly, result);
      await this.applyMonthlyRotation(categorizedFiles.monthly, result);
      
      // Apply size and age limits
      await this.applySizeLimits(backupFiles, result);
      await this.applyAgeLimits(backupFiles, result);

      this.logger.info('Backup rotation completed', {
        ...result,
        duration: Date.now() - startTime
      });

      this.auditLogger.logEvent({
        actor: { type: 'system', id: 'BackupRotationService' },
        operation: {
          type: 'backup.rotation.complete',
          description: 'Completed backup rotation',
          input: { policy: this.policy }
        },
        result: {
          status: 'success',
          duration: Date.now() - startTime
        },
        metadata: { correlationId: this.generateCorrelationId() }
      });

      return result;

    } catch (error) {
      this.logger.error('Backup rotation failed', error as Error);
      throw error;
    }
  }

  /**
   * Scan backup directory for files
   */
  private async scanBackupFiles(): Promise<BackupFile[]> {
    const backupFiles: BackupFile[] = [];

    try {
      const sessionDirs = await fs.readdir(this.backupDir);

      for (const sessionId of sessionDirs) {
        const sessionPath = path.join(this.backupDir, sessionId);
        
        try {
          const stats = await fs.stat(sessionPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(sessionPath);
          
          for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const filePath = path.join(sessionPath, file);
            const fileStats = await fs.stat(filePath);

            // Determine backup type from filename
            let type: 'baseline' | 'incremental' | 'manual' = 'incremental';
            if (file.includes('baseline')) type = 'baseline';
            else if (file.includes('manual')) type = 'manual';

            const backupFile: BackupFile = {
              path: filePath,
              size: fileStats.size,
              created: fileStats.birthtime,
              sessionId,
              type,
              category: this.categorizeByAge(fileStats.birthtime)
            };

            backupFiles.push(backupFile);

          }
        } catch (error) {
          this.logger.warn('Failed to scan session directory', { sessionId, error });
        }
      }

    } catch (error) {
      this.logger.error('Failed to scan backup directory', error as Error);
    }

    return backupFiles.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Categorize backup by age
   */
  private categorizeByAge(created: Date): 'hourly' | 'daily' | 'weekly' | 'monthly' {
    const now = new Date();
    const ageHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (ageHours <= 24) return 'hourly';
    if (ageHours <= 24 * 7) return 'daily';
    if (ageHours <= 24 * 7 * 4) return 'weekly';
    return 'monthly';
  }

  /**
   * Categorize backups by age groups
   */
  private categorizeBackupsByAge(backupFiles: BackupFile[]): {
    hourly: BackupFile[];
    daily: BackupFile[];
    weekly: BackupFile[];
    monthly: BackupFile[];
  } {
    const categories = {
      hourly: [] as BackupFile[],
      daily: [] as BackupFile[],
      weekly: [] as BackupFile[],
      monthly: [] as BackupFile[]
    };

    for (const file of backupFiles) {
      categories[file.category].push(file);
    }

    return categories;
  }

  /**
   * Apply hourly rotation policy
   */
  private async applyHourlyRotation(
    hourlyFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    if (!this.policy.hourly.enabled) return;

    const toRemove = hourlyFiles.slice(this.policy.hourly.retainCount);
    await this.removeFiles(toRemove, result, 'hourly policy');
  }

  /**
   * Apply daily rotation policy
   */
  private async applyDailyRotation(
    dailyFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    if (!this.policy.daily.enabled) return;

    // Group by day and keep only the most recent from each day
    const byDay = this.groupByDay(dailyFiles);
    const toKeep: BackupFile[] = [];
    
    const sortedDays = Object.keys(byDay).sort().reverse();
    const daysToKeep = sortedDays.slice(0, this.policy.daily.retainCount);
    
    for (const day of daysToKeep) {
      // Keep the most recent backup from each day
      const dayFiles = byDay[day]?.sort((a, b) => b.created.getTime() - a.created.getTime());
      if (dayFiles && dayFiles[0]) {
        toKeep.push(dayFiles[0]);
      }
    }

    const toRemove = dailyFiles.filter(file => !toKeep.includes(file));
    await this.removeFiles(toRemove, result, 'daily policy');
  }

  /**
   * Apply weekly rotation policy
   */
  private async applyWeeklyRotation(
    weeklyFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    if (!this.policy.weekly.enabled) return;

    // Group by week and keep only the most recent from each week
    const byWeek = this.groupByWeek(weeklyFiles);
    const toKeep: BackupFile[] = [];
    
    const sortedWeeks = Object.keys(byWeek).sort().reverse();
    const weeksToKeep = sortedWeeks.slice(0, this.policy.weekly.retainCount);
    
    for (const week of weeksToKeep) {
      const weekFiles = byWeek[week]?.sort((a, b) => b.created.getTime() - a.created.getTime());
      if (weekFiles && weekFiles[0]) {
        toKeep.push(weekFiles[0]);
      }
    }

    const toRemove = weeklyFiles.filter(file => !toKeep.includes(file));
    await this.removeFiles(toRemove, result, 'weekly policy');
  }

  /**
   * Apply monthly rotation policy
   */
  private async applyMonthlyRotation(
    monthlyFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    if (!this.policy.monthly.enabled) return;

    // Group by month and keep only the most recent from each month
    const byMonth = this.groupByMonth(monthlyFiles);
    const toKeep: BackupFile[] = [];
    
    const sortedMonths = Object.keys(byMonth).sort().reverse();
    const monthsToKeep = sortedMonths.slice(0, this.policy.monthly.retainCount);
    
    for (const month of monthsToKeep) {
      const monthFiles = byMonth[month]?.sort((a, b) => b.created.getTime() - a.created.getTime());
      if (monthFiles && monthFiles[0]) {
        toKeep.push(monthFiles[0]);
      }
    }

    const toRemove = monthlyFiles.filter(file => !toKeep.includes(file));
    await this.removeFiles(toRemove, result, 'monthly policy');
  }

  /**
   * Apply size limits
   */
  private async applySizeLimits(
    backupFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    const totalSize = backupFiles.reduce((sum, file) => sum + file.size, 0);
    const maxSizeBytes = this.policy.maxTotalSize * 1024 * 1024;

    if (totalSize <= maxSizeBytes) return;

    this.logger.info('Applying size limits', {
      totalSize: totalSize / 1024 / 1024,
      maxSize: this.policy.maxTotalSize
    });

    // Sort by age (oldest first) and remove until under limit
    const sortedFiles = [...backupFiles].sort((a, b) => a.created.getTime() - b.created.getTime());
    let currentSize = totalSize;
    const toRemove: BackupFile[] = [];

    for (const file of sortedFiles) {
      if (currentSize <= maxSizeBytes) break;
      
      toRemove.push(file);
      currentSize -= file.size;
    }

    await this.removeFiles(toRemove, result, 'size limit');
  }

  /**
   * Apply age limits
   */
  private async applyAgeLimits(
    backupFiles: BackupFile[],
    result: RotationResult
  ): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.policy.maxAge);

    const toRemove = backupFiles.filter(file => file.created < cutoffDate);
    
    if (toRemove.length > 0) {
      this.logger.info('Applying age limits', {
        cutoffDate,
        filesToRemove: toRemove.length
      });

      await this.removeFiles(toRemove, result, 'age limit');
    }
  }

  /**
   * Remove files and update result
   */
  private async removeFiles(
    files: BackupFile[],
    result: RotationResult,
    reason: string
  ): Promise<void> {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
        result.filesRemoved++;
        result.spaceFreed += file.size;
        
        this.logger.debug('Backup file removed', {
          path: file.path,
          size: file.size,
          reason
        });

      } catch (error) {
        const errorMsg = `Failed to remove ${file.path}: ${(error as Error).message}`;
        result.errors.push(errorMsg);
        this.logger.error('Failed to remove backup file', error as Error, {
          path: file.path
        });
      }
    }
  }

  /**
   * Group files by day
   */
  private groupByDay(files: BackupFile[]): Record<string, BackupFile[]> {
    const groups: Record<string, BackupFile[]> = {};
    
    for (const file of files) {
      const day = file.created.toISOString().split('T')[0];
      if (day) {
        if (!groups[day]) groups[day] = [];
        groups[day].push(file);
      }
    }
    
    return groups;
  }

  /**
   * Group files by week
   */
  private groupByWeek(files: BackupFile[]): Record<string, BackupFile[]> {
    const groups: Record<string, BackupFile[]> = {};
    
    for (const file of files) {
      const weekStart = this.getWeekStart(file.created);
      const weekKey = weekStart.toISOString().split('T')[0];
      if (weekKey) {
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(file);
      }
    }
    
    return groups;
  }

  /**
   * Group files by month
   */
  private groupByMonth(files: BackupFile[]): Record<string, BackupFile[]> {
    const groups: Record<string, BackupFile[]> = {};
    
    for (const file of files) {
      const month = `${file.created.getFullYear()}-${(file.created.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!groups[month]) groups[month] = [];
      groups[month].push(file);
    }
    
    return groups;
  }

  /**
   * Get start of week for date
   */
  private getWeekStart(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day;
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<StorageStatistics> {
    const backupFiles = await this.scanBackupFiles();
    
    const stats: StorageStatistics = {
      totalFiles: backupFiles.length,
      totalSize: backupFiles.reduce((sum, file) => sum + file.size, 0),
      oldestBackup: null,
      newestBackup: null,
      byCategory: {
        hourly: { count: 0, size: 0 },
        daily: { count: 0, size: 0 },
        weekly: { count: 0, size: 0 },
        monthly: { count: 0, size: 0 }
      },
      bySessions: new Map()
    };

    if (backupFiles.length > 0) {
      const timestamps = backupFiles.map(f => f.created.getTime());
      stats.oldestBackup = new Date(Math.min(...timestamps));
      stats.newestBackup = new Date(Math.max(...timestamps));
    }

    // Categorize files
    for (const file of backupFiles) {
      // By category
      stats.byCategory[file.category].count++;
      stats.byCategory[file.category].size += file.size;

      // By session
      const sessionStats = stats.bySessions.get(file.sessionId) || { count: 0, size: 0 };
      sessionStats.count++;
      sessionStats.size += file.size;
      stats.bySessions.set(file.sessionId, sessionStats);
    }

    return stats;
  }

  /**
   * Update rotation policy
   */
  updatePolicy(newPolicy: Partial<RotationPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
    
    this.logger.info('Rotation policy updated', {
      newPolicy: this.policy
    });
  }

  /**
   * Get current policy
   */
  getPolicy(): RotationPolicy {
    return { ...this.policy };
  }

  /**
   * Estimate storage usage after rotation
   */
  async estimatePostRotationUsage(): Promise<{
    currentSize: number;
    estimatedSize: number;
    estimatedReduction: number;
    estimatedFiles: number;
  }> {
    const backupFiles = await this.scanBackupFiles();
    const currentSize = backupFiles.reduce((sum, file) => sum + file.size, 0);
    
    // Simulate rotation to estimate final size
    const categorized = this.categorizeBackupsByAge(backupFiles);
    
    let estimatedFiles = 0;
    let estimatedSize = 0;

    // Estimate hourly retention
    if (this.policy.hourly.enabled) {
      const kept = Math.min(categorized.hourly.length, this.policy.hourly.retainCount);
      estimatedFiles += kept;
      estimatedSize += categorized.hourly.slice(0, kept).reduce((sum, f) => sum + f.size, 0);
    }

    // Estimate daily retention (keeping one per day)
    if (this.policy.daily.enabled) {
      const byDay = this.groupByDay(categorized.daily);
      const daysKept = Math.min(Object.keys(byDay).length, this.policy.daily.retainCount);
      estimatedFiles += daysKept;
      
      // Estimate size (approximate)
      const dayCount = Object.keys(byDay).length;
      const avgDailySize = categorized.daily.length > 0 && dayCount > 0
        ? categorized.daily.reduce((sum, f) => sum + f.size, 0) / dayCount
        : 0;
      estimatedSize += avgDailySize * daysKept;
    }

    // Similar estimates for weekly and monthly...

    return {
      currentSize,
      estimatedSize: Math.min(estimatedSize, this.policy.maxTotalSize * 1024 * 1024),
      estimatedReduction: currentSize - estimatedSize,
      estimatedFiles
    };
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `rot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}