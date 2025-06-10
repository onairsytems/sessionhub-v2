/**
 * @actor system
 * @responsibility Data integrity validation and corruption recovery procedures
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface IntegrityCheck {
  id: string;
  type: 'file' | 'database' | 'index' | 'backup' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
    currentItem: string;
  };
  results: IntegrityResult;
  errors: IntegrityError[];
  options: IntegrityOptions;
}

export interface IntegrityResult {
  totalItems: number;
  validItems: number;
  corruptedItems: number;
  missingItems: number;
  repairedItems: number;
  unreparableItems: number;
  details: IntegrityDetail[];
  summary: {
    overallHealth: 'excellent' | 'good' | 'degraded' | 'critical';
    confidenceScore: number;
    recommendedActions: string[];
  };
}

export interface IntegrityDetail {
  path: string;
  type: 'file' | 'directory' | 'database' | 'index';
  status: 'valid' | 'corrupted' | 'missing' | 'repaired' | 'unrepairable';
  issues: IntegrityIssue[];
  expectedChecksum?: string;
  actualChecksum?: string;
  size: number;
  lastModified: string;
  repairActions: string[];
}

export interface IntegrityIssue {
  type: 'checksum_mismatch' | 'missing_file' | 'permission_denied' | 'size_mismatch' | 'format_error' | 'encoding_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  autoRepairable: boolean;
  repairAction?: string;
}

export interface IntegrityError {
  timestamp: string;
  type: string;
  path: string;
  message: string;
  stack?: string;
}

export interface IntegrityOptions {
  includeBackups: boolean;
  includeIndexes: boolean;
  includeDatabases: boolean;
  autoRepair: boolean;
  deepScan: boolean;
  parallelChecks: number;
  skipLargeFiles: boolean;
  maxFileSize: number;
  verifyChecksums: boolean;
  checkPermissions: boolean;
  validateFormat: boolean;
  createReport: boolean;
}

export interface ChecksumManifest {
  version: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, FileChecksum>;
  directories: Record<string, DirectoryChecksum>;
  totalFiles: number;
  totalSize: number;
  algorithm: string;
}

export interface FileChecksum {
  path: string;
  checksum: string;
  size: number;
  modifiedAt: string;
  permissions: number;
  encoding?: string;
}

export interface DirectoryChecksum {
  path: string;
  fileCount: number;
  totalSize: number;
  checksum: string; // Combined checksum of all files
  modifiedAt: string;
}

export interface CorruptionPattern {
  id: string;
  name: string;
  pattern: RegExp | ((data: any) => boolean);
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  autoFix?: (filePath: string) => Promise<boolean>;
}

export interface RecoveryPlan {
  id: string;
  corruptionType: string;
  affectedFiles: string[];
  recoverySteps: RecoveryStep[];
  estimatedTime: number;
  successProbability: number;
  requiresBackup: boolean;
  dataLossRisk: 'none' | 'minimal' | 'moderate' | 'high';
}

export interface RecoveryStep {
  id: string;
  description: string;
  action: 'backup' | 'restore' | 'repair' | 'recreate' | 'validate';
  parameters: Record<string, any>;
  reversible: boolean;
  estimatedTime: number;
}

export class DataIntegrityService extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly dataDir: string;
  private readonly integrityDir: string;
  private readonly manifestPath: string;

  private checksumManifest?: ChecksumManifest;
  private activeChecks = new Map<string, IntegrityCheck>();
  private corruptionPatterns: CorruptionPattern[] = [];
  
  private readonly defaultOptions: IntegrityOptions = {
    includeBackups: true,
    includeIndexes: true,
    includeDatabases: true,
    autoRepair: false,
    deepScan: false,
    parallelChecks: 3,
    skipLargeFiles: false,
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    verifyChecksums: true,
    checkPermissions: true,
    validateFormat: true,
    createReport: true
  };

  constructor(logger: Logger, auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger;
    
    // Use auditLogger for integrity operations
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'data-integrity-service' },
      operation: { type: 'initialization', description: 'DataIntegrityService initialized' },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: this.generateId('init') }
    }); // Used for audit logging

    this.dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.integrityDir = path.join(this.dataDir, 'integrity');
    this.manifestPath = path.join(this.integrityDir, 'checksum-manifest.json');

    this.initializeIntegrityService();
  }

  /**
   * Initialize integrity service
   */
  private async initializeIntegrityService(): Promise<void> {
    await fs.mkdir(this.integrityDir, { recursive: true });
    
    await this.loadChecksumManifest();
    this.setupCorruptionPatterns();
    
    // Schedule periodic integrity checks
    this.schedulePeriodicChecks();

    this.logger.info('Data integrity service initialized', {
      integrityDir: this.integrityDir,
      manifestExists: !!this.checksumManifest,
      patternsCount: this.corruptionPatterns.length
    });
  }

  /**
   * Perform comprehensive integrity check
   */
  async performIntegrityCheck(options: Partial<IntegrityOptions> = {}): Promise<IntegrityCheck> {
    const checkId = this.generateId('check');
    const mergedOptions = { ...this.defaultOptions, ...options };

    const check: IntegrityCheck = {
      id: checkId,
      type: 'full',
      status: 'pending',
      startedAt: new Date().toISOString(),
      progress: {
        current: 0,
        total: 0,
        percentage: 0,
        currentItem: ''
      },
      results: {
        totalItems: 0,
        validItems: 0,
        corruptedItems: 0,
        missingItems: 0,
        repairedItems: 0,
        unreparableItems: 0,
        details: [],
        summary: {
          overallHealth: 'excellent',
          confidenceScore: 1.0,
          recommendedActions: []
        }
      },
      errors: [],
      options: mergedOptions
    };

    this.activeChecks.set(checkId, check);

    // Start check process
    this.executeIntegrityCheckAsync(check);

    this.emit('integrityCheckStarted', check);

    this.logger.info('Integrity check started', {
      checkId,
      options: mergedOptions
    });

    return check;
  }

  /**
   * Get integrity check status
   */
  async getIntegrityCheck(checkId: string): Promise<IntegrityCheck | null> {
    return this.activeChecks.get(checkId) || null;
  }

  /**
   * Create or update checksum manifest
   */
  async createChecksumManifest(
    targetPaths: string[] = [this.dataDir],
    algorithm: string = 'sha256'
  ): Promise<ChecksumManifest> {
    this.logger.info('Creating checksum manifest', { targetPaths, algorithm });

    const manifest: ChecksumManifest = {
      version: '2.5.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: {},
      directories: {},
      totalFiles: 0,
      totalSize: 0,
      algorithm
    };

    for (const targetPath of targetPaths) {
      await this.processPathForManifest(targetPath, manifest, algorithm);
    }

    await this.saveChecksumManifest(manifest);
    this.checksumManifest = manifest;

    this.logger.info('Checksum manifest created', {
      totalFiles: manifest.totalFiles,
      totalSize: manifest.totalSize
    });

    return manifest;
  }

  /**
   * Verify file against manifest
   */
  async verifyFile(filePath: string): Promise<IntegrityDetail> {
    const detail: IntegrityDetail = {
      path: filePath,
      type: 'file',
      status: 'valid',
      issues: [],
      size: 0,
      lastModified: '',
      repairActions: []
    };

    try {
      const stats = await fs.stat(filePath);
      detail.size = stats.size;
      detail.lastModified = stats.mtime.toISOString();

      if (this.checksumManifest) {
        const expectedChecksum = this.checksumManifest.files[filePath];
        
        if (expectedChecksum) {
          detail.expectedChecksum = expectedChecksum.checksum;
          
          // Calculate actual checksum
          detail.actualChecksum = await this.calculateFileChecksum(filePath);
          
          if (detail.actualChecksum !== detail.expectedChecksum) {
            detail.status = 'corrupted';
            detail.issues.push({
              type: 'checksum_mismatch',
              severity: 'high',
              description: 'File checksum does not match expected value',
              autoRepairable: false
            });
          }

          // Check size
          if (stats.size !== expectedChecksum.size) {
            detail.status = 'corrupted';
            detail.issues.push({
              type: 'size_mismatch',
              severity: 'high',
              description: `File size mismatch: expected ${expectedChecksum.size}, got ${stats.size}`,
              autoRepairable: false
            });
          }
        }
      }

      // Check for corruption patterns
      await this.checkCorruptionPatterns(filePath, detail);

    } catch (error) {
      detail.status = 'missing';
      detail.issues.push({
        type: 'missing_file',
        severity: 'critical',
        description: `File cannot be accessed: ${(error as Error).message}`,
        autoRepairable: false
      });
    }

    return detail;
  }

  /**
   * Attempt to repair corrupted files
   */
  async repairCorruption(
    corruptedFiles: string[],
    options: {
      useBackups: boolean;
      createBackupBeforeRepair: boolean;
      autoApprove: boolean;
    } = {
      useBackups: true,
      createBackupBeforeRepair: true,
      autoApprove: false
    }
  ): Promise<{
    repaired: string[];
    failed: string[];
    recoveryPlans: RecoveryPlan[];
  }> {
    const result = {
      repaired: [] as string[],
      failed: [] as string[],
      recoveryPlans: [] as RecoveryPlan[]
    };

    for (const filePath of corruptedFiles) {
      try {
        const repaired = await this.repairSingleFile(filePath, options);
        if (repaired) {
          result.repaired.push(filePath);
        } else {
          result.failed.push(filePath);
          
          // Generate recovery plan
          const recoveryPlan = await this.generateRecoveryPlan(filePath);
          if (recoveryPlan) {
            result.recoveryPlans.push(recoveryPlan);
          }
        }
      } catch (error) {
        result.failed.push(filePath);
        this.logger.error('Failed to repair file', error as Error, { filePath });
      }
    }

    this.logger.info('Corruption repair completed', {
      repaired: result.repaired.length,
      failed: result.failed.length,
      recoveryPlans: result.recoveryPlans.length
    });

    return result;
  }

  /**
   * Get system integrity status
   */
  async getIntegrityStatus(): Promise<{
    overallHealth: 'excellent' | 'good' | 'degraded' | 'critical';
    lastCheck: string | null;
    issuesFound: number;
    criticalIssues: number;
    autoRepairableIssues: number;
    recommendations: string[];
  }> {
    const recentChecks = Array.from(this.activeChecks.values())
      .filter(check => check.status === 'completed')
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

    const lastCheck = recentChecks[0];
    
    if (!lastCheck) {
      return {
        overallHealth: 'good',
        lastCheck: null,
        issuesFound: 0,
        criticalIssues: 0,
        autoRepairableIssues: 0,
        recommendations: ['Perform initial integrity check to establish baseline']
      };
    }

    const criticalIssues = lastCheck.results.details.reduce((count, detail) => {
      return count + detail.issues.filter(issue => issue.severity === 'critical').length;
    }, 0);

    const autoRepairableIssues = lastCheck.results.details.reduce((count, detail) => {
      return count + detail.issues.filter(issue => issue.autoRepairable).length;
    }, 0);

    return {
      overallHealth: lastCheck.results.summary.overallHealth,
      lastCheck: lastCheck.completedAt!,
      issuesFound: lastCheck.results.corruptedItems + lastCheck.results.missingItems,
      criticalIssues,
      autoRepairableIssues,
      recommendations: lastCheck.results.summary.recommendedActions
    };
  }

  // Private helper methods

  private async executeIntegrityCheckAsync(check: IntegrityCheck): Promise<void> {
    try {
      check.status = 'running';
      const startTime = Date.now();

      // Scan for files to check
      const filesToCheck = await this.scanFilesToCheck(check.options);
      check.progress.total = filesToCheck.length;

      // Process files in batches
      const batchSize = check.options.parallelChecks;
      for (let i = 0; i < filesToCheck.length; i += batchSize) {
        const batch = filesToCheck.slice(i, i + batchSize);
        
        const promises = batch.map(async (filePath) => {
          check.progress.currentItem = filePath;
          const detail = await this.verifyFile(filePath);
          check.results.details.push(detail);
          check.progress.current++;
          check.progress.percentage = (check.progress.current / check.progress.total) * 100;
          
          // Update counts
          switch (detail.status) {
            case 'valid':
              check.results.validItems++;
              break;
            case 'corrupted':
              check.results.corruptedItems++;
              break;
            case 'missing':
              check.results.missingItems++;
              break;
            case 'repaired':
              check.results.repairedItems++;
              break;
          }
          
          return detail;
        });

        await Promise.all(promises);
      }

      check.results.totalItems = check.results.details.length;

      // Generate summary
      check.results.summary = this.generateIntegritySummary(check.results);

      // Auto-repair if enabled
      if (check.options.autoRepair && check.results.corruptedItems > 0) {
        const corruptedFiles = check.results.details
          .filter(d => d.status === 'corrupted')
          .map(d => d.path);
        
        const repairResult = await this.repairCorruption(corruptedFiles, {
          useBackups: true,
          createBackupBeforeRepair: true,
          autoApprove: true
        });
        
        check.results.repairedItems = repairResult.repaired.length;
        check.results.unreparableItems = repairResult.failed.length;
      }

      check.status = 'completed';
      check.completedAt = new Date().toISOString();

      // Create report if requested
      if (check.options.createReport) {
        await this.createIntegrityReport(check);
      }

      this.emit('integrityCheckCompleted', check);

      this.logger.info('Integrity check completed', {
        checkId: check.id,
        duration: Date.now() - startTime,
        totalItems: check.results.totalItems,
        corruptedItems: check.results.corruptedItems,
        overallHealth: check.results.summary.overallHealth
      });

    } catch (error) {
      check.status = 'failed';
      check.completedAt = new Date().toISOString();
      
      check.errors.push({
        timestamp: new Date().toISOString(),
        type: 'system_error',
        path: '',
        message: (error as Error).message,
        stack: (error as Error).stack
      });

      this.emit('integrityCheckFailed', check);

      this.logger.error('Integrity check failed', error as Error, { checkId: check.id });
    }
  }

  private async scanFilesToCheck(options: IntegrityOptions): Promise<string[]> {
    const files: string[] = [];
    
    // Add data directory files
    await this.scanDirectory(this.dataDir, files, options);

    return files;
  }

  private async scanDirectory(dirPath: string, files: string[], options: IntegrityOptions): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await this.scanDirectory(fullPath, files, options);
        } else if (stats.isFile()) {
          // Apply size filter
          if (options.skipLargeFiles && stats.size > options.maxFileSize) {
            continue;
          }
          
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to scan directory', { dirPath, error: (error as Error).message });
    }
  }

  private async processPathForManifest(
    targetPath: string,
    manifest: ChecksumManifest,
    algorithm: string
  ): Promise<void> {
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        await this.processDirectoryForManifest(targetPath, manifest, algorithm);
      } else if (stats.isFile()) {
        await this.processFileForManifest(targetPath, manifest, algorithm);
      }
    } catch (error) {
      this.logger.warn('Failed to process path for manifest', {
        targetPath,
        error: (error as Error).message
      });
    }
  }

  private async processFileForManifest(
    filePath: string,
    manifest: ChecksumManifest,
    algorithm: string
  ): Promise<void> {
    const stats = await fs.stat(filePath);
    const checksum = await this.calculateFileChecksum(filePath, algorithm);
    
    manifest.files[filePath] = {
      path: filePath,
      checksum,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      permissions: stats.mode
    };
    
    manifest.totalFiles++;
    manifest.totalSize += stats.size;
  }

  private async processDirectoryForManifest(
    dirPath: string,
    manifest: ChecksumManifest,
    algorithm: string
  ): Promise<void> {
    const entries = await fs.readdir(dirPath);
    let fileCount = 0;
    let totalSize = 0;
    const checksums: string[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile()) {
        await this.processFileForManifest(fullPath, manifest, algorithm);
        fileCount++;
        totalSize += stats.size;
        const fileManifest = manifest.files[fullPath];
        if (fileManifest) {
          checksums.push(fileManifest.checksum);
        }
      } else if (stats.isDirectory()) {
        await this.processDirectoryForManifest(fullPath, manifest, algorithm);
      }
    }
    
    // Create combined checksum for directory
    const combined = checksums.sort().join('');
    const dirChecksum = crypto.createHash(algorithm).update(combined).digest('hex');
    
    const stats = await fs.stat(dirPath);
    manifest.directories[dirPath] = {
      path: dirPath,
      fileCount,
      totalSize,
      checksum: dirChecksum,
      modifiedAt: stats.mtime.toISOString()
    };
  }

  private async calculateFileChecksum(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash(algorithm).update(fileBuffer).digest('hex');
  }

  private async checkCorruptionPatterns(filePath: string, detail: IntegrityDetail): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      for (const pattern of this.corruptionPatterns) {
        let isMatch = false;
        
        if (pattern.pattern instanceof RegExp) {
          isMatch = pattern.pattern.test(content);
        } else if (typeof pattern.pattern === 'function') {
          isMatch = pattern.pattern(content);
        }
        
        if (isMatch) {
          detail.status = 'corrupted';
          detail.issues.push({
            type: 'format_error',
            severity: pattern.severity,
            description: pattern.description,
            autoRepairable: !!pattern.autoFix,
            repairAction: pattern.autoFix ? 'auto_fix_available' : undefined
          });
        }
      }
    } catch {
      // File might be binary or inaccessible
    }
  }

  private setupCorruptionPatterns(): void {
    this.corruptionPatterns = [
      {
        id: 'json-syntax-error',
        name: 'JSON Syntax Error',
        pattern: (content: string) => {
          try {
            JSON.parse(content);
            return false;
          } catch {
            return content.trim().startsWith('{') || content.trim().startsWith('[');
          }
        },
        severity: 'high',
        description: 'JSON file contains syntax errors',
        autoFix: async (filePath: string) => {
          // Attempt to fix common JSON issues
          try {
            let content = await fs.readFile(filePath, 'utf-8');
            
            // Fix trailing commas
            content = content.replace(/,(\s*[}\]])/g, '$1');
            
            // Fix unquoted keys
            content = content.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            
            // Validate fix
            JSON.parse(content);
            
            // Create backup and save fixed version
            await fs.copyFile(filePath, `${filePath}.backup`);
            await fs.writeFile(filePath, content, 'utf-8');
            
            return true;
          } catch {
            return false;
          }
        }
      },
      {
        id: 'truncated-file',
        name: 'Truncated File',
        pattern: /[\x00-\x1F]{10,}/,
        severity: 'critical',
        description: 'File appears to be truncated or contains null bytes'
      }
    ];
  }

  private async repairSingleFile(
    filePath: string,
    options: {
      useBackups: boolean;
      createBackupBeforeRepair: boolean;
      autoApprove: boolean;
    }
  ): Promise<boolean> {
    // Implementation for repairing single file
    void options; // Avoid unused parameter warning
    // Check if file matches any auto-fixable patterns
    for (const pattern of this.corruptionPatterns) {
      if (pattern.autoFix) {
        try {
          const success = await pattern.autoFix(filePath);
          if (success) {
            this.logger.info('File auto-repaired', { filePath, pattern: pattern.name });
            return true;
          }
        } catch (error) {
          this.logger.warn('Auto-repair failed', { filePath, pattern: pattern.name, error });
        }
      }
    }

    // TODO: Implement backup-based recovery
    return false;
  }

  private async generateRecoveryPlan(filePath: string): Promise<RecoveryPlan | null> {
    // Generate recovery plan based on file type and corruption
    return {
      id: this.generateId('recovery'),
      corruptionType: 'unknown',
      affectedFiles: [filePath],
      recoverySteps: [
        {
          id: '1',
          description: 'Create backup of current state',
          action: 'backup',
          parameters: { source: filePath },
          reversible: true,
          estimatedTime: 5000
        },
        {
          id: '2',
          description: 'Restore from backup',
          action: 'restore',
          parameters: { target: filePath },
          reversible: false,
          estimatedTime: 10000
        }
      ],
      estimatedTime: 15000,
      successProbability: 0.8,
      requiresBackup: true,
      dataLossRisk: 'minimal'
    };
  }

  private generateIntegritySummary(results: IntegrityResult): IntegrityResult['summary'] {
    const totalIssues = results.corruptedItems + results.missingItems;
    const totalItems = results.totalItems;
    
    let overallHealth: 'excellent' | 'good' | 'degraded' | 'critical';
    let confidenceScore: number;
    const recommendedActions: string[] = [];
    
    if (totalIssues === 0) {
      overallHealth = 'excellent';
      confidenceScore = 1.0;
    } else if (totalIssues / totalItems < 0.01) {
      overallHealth = 'good';
      confidenceScore = 0.9;
      recommendedActions.push('Monitor corruption patterns');
    } else if (totalIssues / totalItems < 0.05) {
      overallHealth = 'degraded';
      confidenceScore = 0.7;
      recommendedActions.push('Perform repairs on corrupted files');
      recommendedActions.push('Increase backup frequency');
    } else {
      overallHealth = 'critical';
      confidenceScore = 0.4;
      recommendedActions.push('Immediate repair required');
      recommendedActions.push('Restore from backup');
      recommendedActions.push('Investigate root cause');
    }
    
    return {
      overallHealth,
      confidenceScore,
      recommendedActions
    };
  }

  private async createIntegrityReport(check: IntegrityCheck): Promise<void> {
    const reportPath = path.join(this.integrityDir, `integrity-report-${check.id}.json`);
    const report = {
      checkId: check.id,
      timestamp: new Date().toISOString(),
      summary: check.results.summary,
      statistics: {
        totalItems: check.results.totalItems,
        validItems: check.results.validItems,
        corruptedItems: check.results.corruptedItems,
        missingItems: check.results.missingItems
      },
      issues: check.results.details.filter(d => d.issues.length > 0),
      errors: check.errors,
      options: check.options
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    
    this.logger.info('Integrity report created', { reportPath });
  }

  private schedulePeriodicChecks(): void {
    // Schedule daily integrity checks
    setInterval(async () => {
      if (Array.from(this.activeChecks.values()).some(check => check.status === 'running')) {
        return; // Skip if check is already running
      }
      
      this.logger.info('Starting scheduled integrity check');
      await this.performIntegrityCheck({
        deepScan: false,
        autoRepair: true,
        createReport: true
      });
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private async loadChecksumManifest(): Promise<void> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      this.checksumManifest = JSON.parse(content);
      this.logger.info('Checksum manifest loaded', {
        totalFiles: this.checksumManifest?.totalFiles || 0
      });
    } catch {
      this.logger.info('No existing checksum manifest found');
    }
  }

  private async saveChecksumManifest(manifest: ChecksumManifest): Promise<void> {
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}