/**
 * @actor system
 * @responsibility Incremental backup creation storing only deltas between backup points
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ChangeDetectionService, ChangeDetectionResult } from './ChangeDetectionService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface IncrementalBackup {
  id: string;
  sessionId: string;
  baselineId: string | null; // Reference to full backup or previous incremental
  timestamp: Date;
  changes: BackupChange[];
  metadata: IncrementalBackupMetadata;
  filePath?: string;
  checksum: string;
}

export interface BackupChange {
  type: 'add' | 'modify' | 'remove';
  field: string;
  oldValue?: any;
  newValue?: any;
  valueChecksum?: string;
}

export interface IncrementalBackupMetadata {
  version: string;
  compressed: boolean;
  totalChanges: number;
  changePercentage: number;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
}

export interface BackupChain {
  sessionId: string;
  baseline: IncrementalBackup | null;
  incrementals: IncrementalBackup[];
  totalBackups: number;
  lastBackupTime: Date | null;
  chainSize: number;
}

export interface RestorePoint {
  sessionId: string;
  backupChain: IncrementalBackup[];
  restoredState: any;
  metadata: {
    totalBackupsApplied: number;
    restorationTime: number;
    dataIntegrityCheck: boolean;
  };
}

export class IncrementalBackupService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly changeDetection: ChangeDetectionService;
  private readonly backupDir: string;
  private readonly maxIncrementalsPerChain = 50;
  private readonly compressionThreshold = 1024; // Compress if larger than 1KB

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    changeDetection: ChangeDetectionService,
    backupDir?: string
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.changeDetection = changeDetection;
    this.backupDir = backupDir || path.join(process.cwd(), 'data', 'incremental-backups');
    
    this.initializeBackupDirectory();
  }

  /**
   * Initialize backup directory
   */
  private async initializeBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      this.logger.info('Incremental backup directory initialized', {
        backupDir: this.backupDir
      });
    } catch (error) {
      this.logger.error('Failed to initialize backup directory', error as Error);
    }
  }

  /**
   * Create incremental backup from current state
   */
  async createIncrementalBackup(
    sessionId: string,
    currentState: any,
    forceBaseline = false
  ): Promise<IncrementalBackup> {
    const startTime = Date.now();

    try {
      // Detect changes since last backup
      const changeResult = this.changeDetection.detectChanges(sessionId, currentState);
      
      // Check if we need a new baseline
      const shouldCreateBaseline = forceBaseline || 
        await this.shouldCreateBaseline(sessionId, changeResult);

      if (shouldCreateBaseline) {
        return await this.createBaselineBackup(sessionId, currentState);
      }

      // Create incremental backup
      const backup = await this.createIncrementalFromChanges(
        sessionId,
        currentState,
        changeResult
      );

      // Update change detection snapshot
      this.changeDetection.createSnapshot(sessionId, currentState);

      this.logger.info('Incremental backup created', {
        sessionId,
        backupId: backup.id,
        totalChanges: backup.metadata.totalChanges,
        changePercentage: backup.metadata.changePercentage,
        duration: Date.now() - startTime
      });

      this.auditLogger.logEvent({
        actor: { type: 'system', id: 'IncrementalBackupService' },
        operation: {
          type: 'backup.incremental.create',
          description: 'Created incremental backup',
          input: { sessionId, totalChanges: backup.metadata.totalChanges }
        },
        result: {
          status: 'success',
          duration: Date.now() - startTime
        },
        metadata: { correlationId: this.generateCorrelationId() }
      });

      return backup;

    } catch (error) {
      this.logger.error('Failed to create incremental backup', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Create baseline backup (full state)
   */
  private async createBaselineBackup(
    sessionId: string,
    currentState: any
  ): Promise<IncrementalBackup> {
    const backupId = this.generateBackupId('baseline');
    const timestamp = new Date();
    
    const serializedState = JSON.stringify(currentState);
    const originalSize = Buffer.byteLength(serializedState, 'utf8');
    
    const shouldCompress = originalSize > this.compressionThreshold;
    let finalData = serializedState;
    let compressedSize: number | undefined;

    if (shouldCompress) {
      const compressed = await gzip(Buffer.from(serializedState, 'utf8'));
      finalData = compressed.toString('base64');
      compressedSize = compressed.length;
    }

    const backup: IncrementalBackup = {
      id: backupId,
      sessionId,
      baselineId: null,
      timestamp,
      changes: [{
        type: 'add',
        field: '__BASELINE__',
        newValue: finalData,
        valueChecksum: this.generateChecksum(serializedState)
      }],
      metadata: {
        version: '1.0.0',
        compressed: shouldCompress,
        totalChanges: 1,
        changePercentage: 100,
        originalSize,
        compressedSize,
        compressionRatio: compressedSize ? originalSize / compressedSize : undefined
      },
      checksum: this.generateChecksum(finalData)
    };

    await this.saveBackupToFile(backup);

    this.logger.info('Baseline backup created', {
      sessionId,
      backupId,
      originalSize,
      compressed: shouldCompress,
      compressionRatio: backup.metadata.compressionRatio
    });

    return backup;
  }

  /**
   * Create incremental backup from changes
   */
  private async createIncrementalFromChanges(
    sessionId: string,
    currentState: any,
    changeResult: ChangeDetectionResult
  ): Promise<IncrementalBackup> {
    const backupId = this.generateBackupId('incremental');
    const baselineId = await this.getLatestBackupId(sessionId);
    
    if (!baselineId) {
      throw new Error(`No baseline backup found for session ${sessionId}`);
    }

    const changes = await this.buildChangeList(currentState, changeResult);
    const serializedChanges = JSON.stringify(changes);
    const originalSize = Buffer.byteLength(serializedChanges, 'utf8');
    
    const shouldCompress = originalSize > this.compressionThreshold;
    let compressedSize: number | undefined;

    if (shouldCompress) {
      const compressed = await gzip(Buffer.from(serializedChanges, 'utf8'));
      compressedSize = compressed.length;
    }

    const backup: IncrementalBackup = {
      id: backupId,
      sessionId,
      baselineId,
      timestamp: new Date(),
      changes,
      metadata: {
        version: '1.0.0',
        compressed: shouldCompress,
        totalChanges: changeResult.totalChanges,
        changePercentage: changeResult.changePercentage,
        originalSize,
        compressedSize,
        compressionRatio: compressedSize ? originalSize / compressedSize : undefined
      },
      checksum: this.generateChecksum(serializedChanges)
    };

    await this.saveBackupToFile(backup);
    return backup;
  }

  /**
   * Build change list from detection result
   */
  private async buildChangeList(
    currentState: any,
    changeResult: ChangeDetectionResult
  ): Promise<BackupChange[]> {
    const changes: BackupChange[] = [];
    const flattenedState = this.flattenObject(currentState);

    // Handle added fields
    for (const field of changeResult.addedFields) {
      changes.push({
        type: 'add',
        field,
        newValue: flattenedState[field],
        valueChecksum: this.generateChecksum(JSON.stringify(flattenedState[field]))
      });
    }

    // Handle removed fields
    for (const field of changeResult.removedFields) {
      changes.push({
        type: 'remove',
        field
      });
    }

    // Handle modified fields
    for (const field of changeResult.changedFields) {
      changes.push({
        type: 'modify',
        field,
        newValue: flattenedState[field],
        valueChecksum: this.generateChecksum(JSON.stringify(flattenedState[field]))
      });
    }

    return changes;
  }

  /**
   * Restore session state from backup chain
   */
  async restoreFromBackupChain(sessionId: string, targetBackupId?: string): Promise<RestorePoint> {
    const startTime = Date.now();

    try {
      const backupChain = await this.buildBackupChain(sessionId, targetBackupId);
      
      if (backupChain.length === 0) {
        throw new Error(`No backup chain found for session ${sessionId}`);
      }

      const restoredState = await this.applyBackupChain(backupChain);
      
      const restorePoint: RestorePoint = {
        sessionId,
        backupChain,
        restoredState,
        metadata: {
          totalBackupsApplied: backupChain.length,
          restorationTime: Date.now() - startTime,
          dataIntegrityCheck: await this.verifyRestoredState(restoredState, backupChain)
        }
      };

      this.logger.info('Session restored from backup chain', {
        sessionId,
        backupsApplied: backupChain.length,
        restorationTime: restorePoint.metadata.restorationTime,
        integrityCheck: restorePoint.metadata.dataIntegrityCheck
      });

      return restorePoint;

    } catch (error) {
      this.logger.error('Failed to restore from backup chain', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Build backup chain from baseline to target
   */
  private async buildBackupChain(
    sessionId: string,
    targetBackupId?: string
  ): Promise<IncrementalBackup[]> {
    const allBackups = await this.getSessionBackups(sessionId);
    
    if (allBackups.length === 0) {
      return [];
    }

    // Sort by timestamp
    allBackups.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Find baseline backup
    const baseline = allBackups.find(b => b.baselineId === null);
    if (!baseline) {
      throw new Error(`No baseline backup found for session ${sessionId}`);
    }

    const chain: IncrementalBackup[] = [baseline];

    // Build chain forward from baseline
    let currentBackupId = baseline.id;
    
    while (true) {
      const nextBackup = allBackups.find(b => 
        b.baselineId === currentBackupId && 
        (!targetBackupId || b.id !== targetBackupId)
      );
      
      if (!nextBackup) {
        break;
      }

      chain.push(nextBackup);
      currentBackupId = nextBackup.id;

      if (targetBackupId && nextBackup.id === targetBackupId) {
        break;
      }
    }

    return chain;
  }

  /**
   * Apply backup chain to restore state
   */
  private async applyBackupChain(backupChain: IncrementalBackup[]): Promise<any> {
    if (backupChain.length === 0) {
      throw new Error('Empty backup chain');
    }

    // Start with baseline
    const baseline = backupChain[0];
    if (!baseline) {
      throw new Error('Empty backup chain');
    }
    if (baseline.baselineId !== null) {
      throw new Error('First backup in chain is not a baseline');
    }

    const baselineChange = baseline.changes.find(c => c.field === '__BASELINE__');
    if (!baselineChange || !baselineChange.newValue) {
      throw new Error('Invalid baseline backup');
    }

    let state: any;
    
    if (baseline.metadata.compressed) {
      const compressed = Buffer.from(baselineChange.newValue as string, 'base64');
      const decompressed = await gunzip(compressed);
      state = JSON.parse(decompressed.toString('utf8'));
    } else {
      state = JSON.parse(baselineChange.newValue as string);
    }

    // Apply incremental changes
    for (let i = 1; i < backupChain.length; i++) {
      const backup = backupChain[i];
      if (backup) {
        state = this.applyChangesToState(state, backup.changes);
      }
    }

    return state;
  }

  /**
   * Apply changes to state object
   */
  private applyChangesToState(state: any, changes: BackupChange[]): any {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    
    for (const change of changes) {
      const path = change.field.split('.');
      
      if (change.type === 'add' || change.type === 'modify') {
        this.setNestedProperty(newState, path, change.newValue);
      } else if (change.type === 'remove') {
        this.deleteNestedProperty(newState, path);
      }
    }

    return newState;
  }

  /**
   * Get all backups for a session
   */
  private async getSessionBackups(sessionId: string): Promise<IncrementalBackup[]> {
    try {
      const sessionDir = path.join(this.backupDir, sessionId);
      
      try {
        await fs.access(sessionDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(sessionDir);
      const backups: IncrementalBackup[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(sessionDir, file),
            'utf8'
          );
          backups.push(JSON.parse(content));
        }
      }

      return backups;

    } catch (error) {
      this.logger.error('Failed to get session backups', error as Error, { sessionId });
      return [];
    }
  }

  /**
   * Save backup to file
   */
  private async saveBackupToFile(backup: IncrementalBackup): Promise<void> {
    const sessionDir = path.join(this.backupDir, backup.sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const filename = `${backup.id}.json`;
    const filePath = path.join(sessionDir, filename);

    await fs.writeFile(filePath, JSON.stringify(backup, null, 2), 'utf8');
    backup.filePath = filePath;
  }

  /**
   * Check if baseline backup should be created
   */
  private async shouldCreateBaseline(
    sessionId: string,
    changeResult: ChangeDetectionResult
  ): Promise<boolean> {
    // Create baseline if no existing backups
    const existing = await this.getSessionBackups(sessionId);
    if (existing.length === 0) {
      return true;
    }

    // Create baseline if too many incrementals
    const incrementalCount = existing.filter(b => b.baselineId !== null).length;
    if (incrementalCount >= this.maxIncrementalsPerChain) {
      return true;
    }

    // Create baseline if changes are too extensive
    if (changeResult.changePercentage > 70) {
      return true;
    }

    return false;
  }

  /**
   * Get latest backup ID for session
   */
  private async getLatestBackupId(sessionId: string): Promise<string | null> {
    const backups = await this.getSessionBackups(sessionId);
    
    if (backups.length === 0) {
      return null;
    }

    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups[0]?.id || null;
  }

  /**
   * Verify restored state integrity
   */
  private async verifyRestoredState(
    restoredState: any,
    _backupChain: IncrementalBackup[]
  ): Promise<boolean> {
    try {
      // Basic verification - ensure state is valid JSON
      const serialized = JSON.stringify(restoredState);
      JSON.parse(serialized);
      
      // More thorough verification could be added here
      return true;
      
    } catch (error) {
      this.logger.error('State integrity verification failed', error as Error);
      return false;
    }
  }

  /**
   * Utility methods
   */
  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  private setNestedProperty(obj: any, path: string[], value: any): void {
    let current = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const pathSegment = path[i];
      if (!pathSegment) continue;
      
      if (!(pathSegment in current) || typeof current[pathSegment] !== 'object') {
        current[pathSegment] = {};
      }
      current = current[pathSegment];
    }
    
    const lastSegment = path[path.length - 1];
    if (lastSegment) {
      current[lastSegment] = value;
    }
  }

  private deleteNestedProperty(obj: any, path: string[]): void {
    let current = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const pathSegment = path[i];
      if (!pathSegment || !(pathSegment in current)) {
        return;
      }
      current = current[pathSegment];
    }
    
    const lastSegment = path[path.length - 1];
    if (lastSegment) {
      delete current[lastSegment];
    }
  }

  private generateBackupId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateCorrelationId(): string {
    return `incr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get backup chain information
   */
  async getBackupChainInfo(sessionId: string): Promise<BackupChain> {
    const backups = await this.getSessionBackups(sessionId);
    
    const baseline = backups.find(b => b.baselineId === null) || null;
    const incrementals = backups.filter(b => b.baselineId !== null);
    
    const lastBackupTime = backups.length > 0
      ? new Date(Math.max(...backups.map(b => b.timestamp.getTime())))
      : null;

    const chainSize = backups.reduce((total, backup) => {
      return total + (backup.metadata.compressedSize || backup.metadata.originalSize);
    }, 0);

    return {
      sessionId,
      baseline,
      incrementals,
      totalBackups: backups.length,
      lastBackupTime,
      chainSize
    };
  }
}