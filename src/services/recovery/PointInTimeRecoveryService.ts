/**
 * @actor system
 * @responsibility Point-in-time recovery system with corruption detection and automatic recovery
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { BackupService } from '../BackupService';
import { IncrementalBackupService } from '../autosave/IncrementalBackupService';
import { promisify } from 'util';
import * as zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

export interface RecoveryPoint {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'checkpoint';
  description: string;
  sessionId?: string;
  projectId?: string;
  size: number;
  healthy: boolean;
  checksumValid: boolean;
  filePath: string;
  metadata: RecoveryMetadata;
}

export interface RecoveryMetadata {
  version: string;
  sessionCount?: number;
  changeCount?: number;
  compressed: boolean;
  originalChecksum: string;
  verifiedAt?: Date;
  corruptionDetected?: boolean;
  autoRecoveryAttempted?: boolean;
}

export interface RecoveryOptions {
  targetTimestamp?: Date;
  sessionId?: string;
  projectId?: string;
  skipCorrupted?: boolean;
  attemptAutoRepair?: boolean;
  mergePartialSaves?: boolean;
}

export interface RecoveryResult {
  success: boolean;
  recoveredData: any;
  timestamp: Date;
  recoveryPoint: RecoveryPoint;
  errors: string[];
  warnings: string[];
  metadata: {
    recoveryDuration: number;
    dataIntegrityScore: number;
    repairsAttempted: number;
    repairsSuccessful: number;
  };
}

export interface CorruptionReport {
  fileCount: number;
  corruptedFiles: string[];
  repairableFiles: string[];
  unreparableFiles: string[];
  recommendedAction: 'auto-repair' | 'manual-recovery' | 'restore-previous';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConflictResolution {
  strategy: 'newest-wins' | 'merge' | 'prompt-user';
  conflicts: ConflictItem[];
  resolution: any;
}

export interface ConflictItem {
  field: string;
  localValue: any;
  remoteValue: any;
  timestamp: Date;
  source: string;
}

export class PointInTimeRecoveryService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly recoveryDir: string;
  private recoveryPoints: Map<string, RecoveryPoint> = new Map();

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    _backupService: BackupService,
    _incrementalBackupService: IncrementalBackupService,
    recoveryDir?: string
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    // Services are injected but not stored as they're not used in this implementation
    this.recoveryDir = recoveryDir || path.join(process.cwd(), 'data', 'recovery');
    
    this.initializeRecoverySystem();
  }

  /**
   * Initialize recovery system
   */
  private async initializeRecoverySystem(): Promise<void> {
    try {
      await fs.mkdir(this.recoveryDir, { recursive: true });
      await this.scanForRecoveryPoints();
      this.logger.info('Recovery system initialized', {
        recoveryPointCount: this.recoveryPoints.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize recovery system', error as Error);
    }
  }

  /**
   * Scan for available recovery points
   */
  async scanForRecoveryPoints(): Promise<RecoveryPoint[]> {
    const points: RecoveryPoint[] = [];

    try {
      // Scan backup directories
      const backupDirs = [
        path.join(process.cwd(), 'data', 'backups'),
        path.join(process.cwd(), 'data', 'incremental-backups'),
        this.recoveryDir
      ];

      for (const dir of backupDirs) {
        try {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            if (file.endsWith('.json') || file.endsWith('.gz')) {
              const filePath = path.join(dir, file);
              const point = await this.analyzeRecoveryPoint(filePath);
              
              if (point) {
                points.push(point);
                this.recoveryPoints.set(point.id, point);
              }
            }
          }
        } catch (error) {
          // Directory might not exist
          continue;
        }
      }

      this.logger.info('Recovery points scanned', {
        totalPoints: points.length,
        healthyPoints: points.filter(p => p.healthy).length
      });

      return points;
    } catch (error) {
      this.logger.error('Failed to scan recovery points', error as Error);
      return [];
    }
  }

  /**
   * Analyze a recovery point for health and metadata
   */
  private async analyzeRecoveryPoint(filePath: string): Promise<RecoveryPoint | null> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath);
      
      let data: any;
      let compressed = false;
      
      // Handle compressed files
      if (filePath.endsWith('.gz')) {
        compressed = true;
        const decompressed = await gunzip(content);
        data = JSON.parse(decompressed.toString('utf8'));
      } else {
        data = JSON.parse(content.toString('utf8'));
      }

      // Verify checksum
      const checksum = this.calculateChecksum(JSON.stringify(data));
      const checksumValid = data.checksum ? checksum === data.checksum : true;
      
      // Detect corruption
      const healthy = checksumValid && this.validateDataIntegrity(data);

      const recoveryPoint: RecoveryPoint = {
        id: data.id || crypto.randomBytes(16).toString('hex'),
        timestamp: new Date(data.timestamp || stats.mtime),
        type: this.detectBackupType(data),
        description: this.generateDescription(data),
        sessionId: data.sessionId,
        projectId: data.projectId,
        size: stats.size,
        healthy,
        checksumValid,
        filePath,
        metadata: {
          version: data.version || '1.0.0',
          sessionCount: data.sessions?.length,
          changeCount: data.changes?.length,
          compressed,
          originalChecksum: checksum,
          verifiedAt: new Date(),
          corruptionDetected: !healthy,
          autoRecoveryAttempted: false
        }
      };

      return recoveryPoint;
    } catch (error) {
      this.logger.warn('Failed to analyze recovery point', {
        filePath,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Perform point-in-time recovery
   */
  async recoverToPoint(options: RecoveryOptions): Promise<RecoveryResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    let repairsAttempted = 0;
    let repairsSuccessful = 0;

    try {
      // Find best recovery point
      const recoveryPoint = await this.findBestRecoveryPoint(options);
      
      if (!recoveryPoint) {
        throw new Error('No suitable recovery point found');
      }

      this.logger.info('Starting point-in-time recovery', {
        recoveryPointId: recoveryPoint.id,
        timestamp: recoveryPoint.timestamp,
        options
      });

      // Check if recovery point is corrupted
      if (!recoveryPoint.healthy && options.attemptAutoRepair) {
        const repairResult = await this.attemptAutoRepair(recoveryPoint);
        if (repairResult.success) {
          repairsAttempted++;
          repairsSuccessful++;
          warnings.push('Recovery point was repaired automatically');
        } else {
          errors.push('Failed to repair corrupted recovery point');
          if (!options.skipCorrupted) {
            throw new Error('Recovery point is corrupted and cannot be repaired');
          }
        }
      }

      // Load recovery data
      const recoveredData = await this.loadRecoveryData(recoveryPoint);

      // Handle partial saves and conflicts
      if (options.mergePartialSaves) {
        const mergeResult = await this.mergePartialSaves(recoveredData, options);
        if (mergeResult.conflicts.length > 0) {
          warnings.push(`Resolved ${mergeResult.conflicts.length} conflicts during merge`);
        }
        Object.assign(recoveredData, mergeResult.resolution);
      }

      // Calculate data integrity score
      const integrityScore = this.calculateIntegrityScore(recoveredData);

      // Log recovery event
      await this.auditLogger.log({
        action: 'recovery_completed',
        actorType: 'system',
        actorId: 'recovery-service',
        details: {
          recoveryPointId: recoveryPoint.id,
          timestamp: recoveryPoint.timestamp,
          options,
          integrityScore,
          duration: Date.now() - startTime
        }
      });

      return {
        success: true,
        recoveredData,
        timestamp: recoveryPoint.timestamp,
        recoveryPoint,
        errors,
        warnings,
        metadata: {
          recoveryDuration: Date.now() - startTime,
          dataIntegrityScore: integrityScore,
          repairsAttempted,
          repairsSuccessful
        }
      };
    } catch (error) {
      this.logger.error('Point-in-time recovery failed', error as Error);
      
      return {
        success: false,
        recoveredData: null,
        timestamp: new Date(),
        recoveryPoint: null as any,
        errors: [...errors, (error as Error).message],
        warnings,
        metadata: {
          recoveryDuration: Date.now() - startTime,
          dataIntegrityScore: 0,
          repairsAttempted,
          repairsSuccessful
        }
      };
    }
  }

  /**
   * Detect and report corruption
   */
  async detectCorruption(): Promise<CorruptionReport> {
    const corruptedFiles: string[] = [];
    const repairableFiles: string[] = [];
    const unreparableFiles: string[] = [];

    await this.scanForRecoveryPoints();

    for (const [_id, point] of this.recoveryPoints) {
      if (!point.healthy) {
        corruptedFiles.push(point.filePath);
        
        // Test if repairable
        const repairResult = await this.testRepairability(point);
        if (repairResult) {
          repairableFiles.push(point.filePath);
        } else {
          unreparableFiles.push(point.filePath);
        }
      }
    }

    const severity = this.calculateCorruptionSeverity(
      corruptedFiles.length,
      this.recoveryPoints.size
    );

    const recommendedAction = this.determineRecommendedAction(
      repairableFiles.length,
      unreparableFiles.length,
      severity
    );

    return {
      fileCount: this.recoveryPoints.size,
      corruptedFiles,
      repairableFiles,
      unreparableFiles,
      recommendedAction,
      severity
    };
  }

  /**
   * Attempt automatic recovery
   */
  async attemptAutoRecovery(sessionId?: string): Promise<RecoveryResult> {
    this.logger.info('Attempting automatic recovery', { sessionId });

    // Find latest healthy recovery point
    const options: RecoveryOptions = {
      sessionId,
      skipCorrupted: true,
      attemptAutoRepair: true,
      mergePartialSaves: true
    };

    return await this.recoverToPoint(options);
  }

  /**
   * Create recovery checkpoint
   */
  async createRecoveryCheckpoint(
    data: any,
    description: string,
    metadata?: Partial<RecoveryMetadata>
  ): Promise<RecoveryPoint> {
    const id = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date();
    const checksum = this.calculateChecksum(JSON.stringify(data));

    const checkpoint = {
      id,
      timestamp: timestamp.toISOString(),
      type: 'checkpoint',
      description,
      data,
      checksum,
      version: '1.0.0',
      ...metadata
    };

    const filePath = path.join(
      this.recoveryDir,
      `checkpoint-${id}-${timestamp.getTime()}.json`
    );

    await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 2));

    const recoveryPoint: RecoveryPoint = {
      id,
      timestamp,
      type: 'checkpoint',
      description,
      size: Buffer.byteLength(JSON.stringify(checkpoint)),
      healthy: true,
      checksumValid: true,
      filePath,
      metadata: {
        version: '1.0.0',
        compressed: false,
        originalChecksum: checksum,
        verifiedAt: timestamp,
        corruptionDetected: false,
        autoRecoveryAttempted: false,
        ...metadata
      }
    };

    this.recoveryPoints.set(id, recoveryPoint);
    
    this.logger.info('Recovery checkpoint created', {
      id,
      description,
      size: recoveryPoint.size
    });

    return recoveryPoint;
  }

  /**
   * Private helper methods
   */
  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private validateDataIntegrity(data: any): boolean {
    // Basic integrity checks
    if (!data || typeof data !== 'object') return false;
    if (data.sessions && !Array.isArray(data.sessions)) return false;
    if (data.changes && !Array.isArray(data.changes)) return false;
    
    // Check for required fields based on type
    if (data.type === 'full' && !data.sessions) return false;
    if (data.type === 'incremental' && !data.changes) return false;
    
    return true;
  }

  private detectBackupType(data: any): 'full' | 'incremental' | 'checkpoint' {
    if (data.type) return data.type;
    if (data.changes) return 'incremental';
    if (data.sessions) return 'full';
    return 'checkpoint';
  }

  private generateDescription(data: any): string {
    if (data.description) return data.description;
    
    const type = this.detectBackupType(data);
    const timestamp = new Date(data.timestamp || Date.now());
    
    switch (type) {
      case 'full':
        return `Full backup with ${data.sessions?.length || 0} sessions`;
      case 'incremental':
        return `Incremental backup with ${data.changes?.length || 0} changes`;
      default:
        return `Recovery checkpoint at ${timestamp.toLocaleString()}`;
    }
  }

  private async findBestRecoveryPoint(options: RecoveryOptions): Promise<RecoveryPoint | null> {
    const candidates = Array.from(this.recoveryPoints.values())
      .filter(point => {
        if (options.sessionId && point.sessionId !== options.sessionId) return false;
        if (options.projectId && point.projectId !== options.projectId) return false;
        if (options.targetTimestamp && point.timestamp > options.targetTimestamp) return false;
        if (!options.skipCorrupted && !point.healthy) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return candidates[0] || null;
  }

  private async loadRecoveryData(point: RecoveryPoint): Promise<any> {
    const content = await fs.readFile(point.filePath);
    
    if (point.metadata.compressed) {
      const decompressed = await gunzip(content);
      return JSON.parse(decompressed.toString('utf8'));
    }
    
    return JSON.parse(content.toString('utf8'));
  }

  private async attemptAutoRepair(point: RecoveryPoint): Promise<{ success: boolean }> {
    try {
      // Attempt to repair common issues
      const data = await this.loadRecoveryData(point);
      
      // Fix missing required fields
      if (!data.id) data.id = point.id;
      if (!data.timestamp) data.timestamp = point.timestamp.toISOString();
      if (!data.version) data.version = '1.0.0';
      
      // Recalculate checksum
      const newChecksum = this.calculateChecksum(JSON.stringify(data));
      data.checksum = newChecksum;
      
      // Save repaired version
      const repairedPath = point.filePath.replace(/\.json$/, '-repaired.json');
      await fs.writeFile(repairedPath, JSON.stringify(data, null, 2));
      
      // Update recovery point
      point.healthy = true;
      point.checksumValid = true;
      point.metadata.autoRecoveryAttempted = true;
      
      return { success: true };
    } catch (error) {
      this.logger.error('Auto repair failed', error as Error);
      return { success: false };
    }
  }

  private async mergePartialSaves(
    baseData: any,
    options: RecoveryOptions
  ): Promise<ConflictResolution> {
    const conflicts: ConflictItem[] = [];
    const resolution: any = { ...baseData };

    // Look for partial saves in recovery directory
    const partialSaves = await this.findPartialSaves(options);
    
    for (const partial of partialSaves) {
      const partialData = await this.loadRecoveryData(partial);
      
      // Detect conflicts
      for (const key in partialData) {
        if (baseData[key] && baseData[key] !== partialData[key]) {
          conflicts.push({
            field: key,
            localValue: baseData[key],
            remoteValue: partialData[key],
            timestamp: partial.timestamp,
            source: partial.filePath
          });
        }
      }
      
      // Apply merge strategy (newest wins by default)
      if (partial.timestamp > new Date(baseData.timestamp || 0)) {
        Object.assign(resolution, partialData);
      }
    }

    return {
      strategy: 'newest-wins',
      conflicts,
      resolution
    };
  }

  private async findPartialSaves(options: RecoveryOptions): Promise<RecoveryPoint[]> {
    return Array.from(this.recoveryPoints.values())
      .filter(point => {
        if (options.sessionId && point.sessionId === options.sessionId) return true;
        if (options.projectId && point.projectId === options.projectId) return true;
        return false;
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateIntegrityScore(data: any): number {
    let score = 100;
    
    // Deduct points for missing fields
    if (!data.id) score -= 10;
    if (!data.timestamp) score -= 10;
    if (!data.version) score -= 5;
    
    // Deduct points for data issues
    if (data.sessions && data.sessions.some((s: any) => !s.id)) score -= 15;
    if (data.errors && data.errors.length > 0) score -= 20;
    
    return Math.max(0, score);
  }

  private async testRepairability(point: RecoveryPoint): Promise<boolean> {
    try {
      const data = await this.loadRecoveryData(point);
      return this.validateDataIntegrity(data);
    } catch {
      return false;
    }
  }

  private calculateCorruptionSeverity(
    corruptedCount: number,
    totalCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = (corruptedCount / totalCount) * 100;
    
    if (percentage === 0) return 'low';
    if (percentage < 10) return 'low';
    if (percentage < 30) return 'medium';
    if (percentage < 60) return 'high';
    return 'critical';
  }

  private determineRecommendedAction(
    repairableCount: number,
    unreparableCount: number,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): 'auto-repair' | 'manual-recovery' | 'restore-previous' {
    if (unreparableCount === 0 && repairableCount > 0) return 'auto-repair';
    if (severity === 'critical') return 'restore-previous';
    return 'manual-recovery';
  }
}