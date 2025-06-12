/**
 * Conflict Resolution Service
 * Handles conflicts that arise from simultaneous online and offline changes
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { DatabaseService } from '@/src/database/DatabaseService';
import { applyPatch, createPatch } from 'diff';
import { v4 as uuidv4 } from 'uuid';

export interface ConflictItem {
  id: string;
  type: 'field' | 'record' | 'structural';
  table: string;
  recordId: string;
  field?: string;
  localValue: any;
  remoteValue: any;
  baseValue?: any; // Original value before both changes
  localTimestamp: Date;
  remoteTimestamp: Date;
  conflictDetectedAt: Date;
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
  suggestedResolution?: 'local' | 'remote' | 'merge';
  mergeStrategy?: string;
}

export interface ResolutionStrategy {
  name: string;
  description: string;
  applicableTo: string[]; // field types or patterns
  resolver: (conflict: ConflictItem) => Promise<any>;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'local' | 'remote' | 'merge' | 'custom';
  resolvedValue: any;
  resolvedBy: 'auto' | 'user';
  resolvedAt: Date;
  notes?: string;
}

export class ConflictResolutionService extends EventEmitter {
  private readonly logger: Logger;
  private readonly db: DatabaseService;
  private strategies: Map<string, ResolutionStrategy> = new Map();
  private activeConflicts: Map<string, ConflictItem> = new Map();

  constructor(db: DatabaseService) {
    super();
    this.logger = new Logger('ConflictResolutionService');
    this.db = db;
    this.initializeSchema();
    this.registerDefaultStrategies();
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Conflicts table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS conflicts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          field TEXT,
          local_value TEXT,
          remote_value TEXT,
          base_value TEXT,
          local_timestamp DATETIME NOT NULL,
          remote_timestamp DATETIME NOT NULL,
          detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          severity TEXT DEFAULT 'medium',
          auto_resolvable INTEGER DEFAULT 0,
          suggested_resolution TEXT,
          merge_strategy TEXT,
          status TEXT DEFAULT 'pending'
        )
      `);

      // Resolutions table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS conflict_resolutions (
          id TEXT PRIMARY KEY,
          conflict_id TEXT NOT NULL,
          resolution TEXT NOT NULL,
          resolved_value TEXT,
          resolved_by TEXT NOT NULL,
          resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (conflict_id) REFERENCES conflicts(id)
        )
      `);

      this.logger.info('Conflict resolution schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize schema', error as Error);
      throw error;
    }
  }

  /**
   * Register default resolution strategies
   */
  private registerDefaultStrategies(): void {
    // Last-write-wins strategy
    this.registerStrategy({
      name: 'last-write-wins',
      description: 'Most recent change wins',
      applicableTo: ['*'],
      resolver: async (conflict: ConflictItem) => {
        return conflict.localTimestamp > conflict.remoteTimestamp
          ? conflict.localValue
          : conflict.remoteValue;
      }
    });

    // Text merge strategy
    this.registerStrategy({
      name: 'text-merge',
      description: 'Three-way merge for text fields',
      applicableTo: ['text', 'string', 'description', 'notes'],
      resolver: async (conflict: ConflictItem) => {
        if (typeof conflict.localValue !== 'string' || 
            typeof conflict.remoteValue !== 'string') {
          throw new Error('Text merge requires string values');
        }

        const baseText = conflict.baseValue || '';
        const localPatch = createPatch('text', baseText, conflict.localValue);
        const remotePatch = createPatch('text', baseText, conflict.remoteValue);

        // Try to apply both patches
        try {
          let merged = baseText;
          merged = applyPatch(merged, localPatch);
          merged = applyPatch(merged, remotePatch);
          return merged;
        } catch (error) {
          // If patches conflict, fall back to including both
          return `<<<<<<< LOCAL\n${conflict.localValue}\n=======\n${conflict.remoteValue}\n>>>>>>> REMOTE`;
        }
      }
    });

    // Array merge strategy
    this.registerStrategy({
      name: 'array-merge',
      description: 'Merge arrays by combining unique elements',
      applicableTo: ['array', 'list', 'tags', 'objectives'],
      resolver: async (conflict: ConflictItem) => {
        if (!Array.isArray(conflict.localValue) || 
            !Array.isArray(conflict.remoteValue)) {
          throw new Error('Array merge requires array values');
        }

        // Combine and deduplicate
        const combined = new Set([
          ...conflict.localValue,
          ...conflict.remoteValue
        ]);

        return Array.from(combined);
      }
    });

    // Numeric max strategy
    this.registerStrategy({
      name: 'numeric-max',
      description: 'Keep the maximum numeric value',
      applicableTo: ['version', 'count', 'progress'],
      resolver: async (conflict: ConflictItem) => {
        const localNum = Number(conflict.localValue);
        const remoteNum = Number(conflict.remoteValue);

        if (isNaN(localNum) || isNaN(remoteNum)) {
          throw new Error('Numeric max requires numeric values');
        }

        return Math.max(localNum, remoteNum);
      }
    });

    // JSON deep merge strategy
    this.registerStrategy({
      name: 'json-deep-merge',
      description: 'Deep merge JSON objects',
      applicableTo: ['json', 'object', 'settings', 'metadata'],
      resolver: async (conflict: ConflictItem) => {
        try {
          const local = typeof conflict.localValue === 'string' 
            ? JSON.parse(conflict.localValue) 
            : conflict.localValue;
          const remote = typeof conflict.remoteValue === 'string'
            ? JSON.parse(conflict.remoteValue)
            : conflict.remoteValue;

          return this.deepMerge(local, remote);
        } catch (error) {
          throw new Error('JSON merge failed: ' + (error as Error).message);
        }
      }
    });
  }

  /**
   * Register a custom resolution strategy
   */
  registerStrategy(strategy: ResolutionStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.info('Registered resolution strategy', { name: strategy.name });
  }

  /**
   * Detect conflicts between local and remote versions
   */
  async detectConflict(
    table: string,
    recordId: string,
    localData: any,
    remoteData: any,
    baseData?: any
  ): Promise<ConflictItem[]> {
    const conflicts: ConflictItem[] = [];
    const conflictDetectedAt = new Date();

    // Compare each field
    const allFields = new Set([
      ...Object.keys(localData),
      ...Object.keys(remoteData)
    ]);

    for (const field of allFields) {
      if (this.shouldIgnoreField(field)) continue;

      const localValue = localData[field];
      const remoteValue = remoteData[field];
      const baseValue = baseData?.[field];

      // Check if values differ
      if (!this.valuesEqual(localValue, remoteValue)) {
        // Check if both changed from base
        const localChanged = baseValue !== undefined && !this.valuesEqual(localValue, baseValue);
        const remoteChanged = baseValue !== undefined && !this.valuesEqual(remoteValue, baseValue);

        if (localChanged && remoteChanged) {
          // Both changed - definite conflict
          const conflict = await this.createConflict({
            type: 'field',
            table,
            recordId,
            field,
            localValue,
            remoteValue,
            baseValue,
            localTimestamp: new Date(localData.updated_at || localData.updatedAt),
            remoteTimestamp: new Date(remoteData.updated_at || remoteData.updatedAt),
            conflictDetectedAt
          });

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Create a conflict record
   */
  private async createConflict(data: Partial<ConflictItem>): Promise<ConflictItem> {
    const conflict: ConflictItem = {
      id: uuidv4(),
      type: data.type || 'field',
      table: data.table!,
      recordId: data.recordId!,
      field: data.field,
      localValue: data.localValue,
      remoteValue: data.remoteValue,
      baseValue: data.baseValue,
      localTimestamp: data.localTimestamp!,
      remoteTimestamp: data.remoteTimestamp!,
      conflictDetectedAt: data.conflictDetectedAt || new Date(),
      severity: this.calculateSeverity(data),
      autoResolvable: false,
      suggestedResolution: undefined
    };

    // Determine if auto-resolvable and suggest resolution
    const strategy = this.findApplicableStrategy(conflict);
    if (strategy) {
      conflict.autoResolvable = true;
      conflict.suggestedResolution = await this.suggestResolution(conflict);
      conflict.mergeStrategy = strategy.name;
    }

    // Save to database
    await this.saveConflict(conflict);

    // Cache in memory
    this.activeConflicts.set(conflict.id, conflict);

    // Emit event
    this.emit('conflictDetected', conflict);

    return conflict;
  }

  /**
   * Save conflict to database
   */
  private async saveConflict(conflict: ConflictItem): Promise<void> {
    await this.db.run(`
      INSERT INTO conflicts (
        id, type, table_name, record_id, field,
        local_value, remote_value, base_value,
        local_timestamp, remote_timestamp,
        severity, auto_resolvable, suggested_resolution, merge_strategy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      conflict.id,
      conflict.type,
      conflict.table,
      conflict.recordId,
      conflict.field,
      JSON.stringify(conflict.localValue),
      JSON.stringify(conflict.remoteValue),
      JSON.stringify(conflict.baseValue),
      conflict.localTimestamp.toISOString(),
      conflict.remoteTimestamp.toISOString(),
      conflict.severity,
      conflict.autoResolvable ? 1 : 0,
      conflict.suggestedResolution,
      conflict.mergeStrategy
    ]);
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge' | 'custom',
    customValue?: any,
    resolvedBy: 'auto' | 'user' = 'user',
    notes?: string
  ): Promise<ConflictResolution> {
    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let resolvedValue: any;

    switch (resolution) {
      case 'local':
        resolvedValue = conflict.localValue;
        break;
      case 'remote':
        resolvedValue = conflict.remoteValue;
        break;
      case 'merge':
        const strategy = this.strategies.get(conflict.mergeStrategy!);
        if (!strategy) {
          throw new Error('No merge strategy available');
        }
        resolvedValue = await strategy.resolver(conflict);
        break;
      case 'custom':
        if (customValue === undefined) {
          throw new Error('Custom value required for custom resolution');
        }
        resolvedValue = customValue;
        break;
    }

    const conflictResolution: ConflictResolution = {
      conflictId,
      resolution,
      resolvedValue,
      resolvedBy,
      resolvedAt: new Date(),
      notes
    };

    // Save resolution
    await this.saveResolution(conflictResolution);

    // Update conflict status
    await this.db.run(`
      UPDATE conflicts SET status = 'resolved' WHERE id = ?
    `, [conflictId]);

    // Remove from active conflicts
    this.activeConflicts.delete(conflictId);

    // Emit event
    this.emit('conflictResolved', conflictResolution);

    return conflictResolution;
  }

  /**
   * Save resolution to database
   */
  private async saveResolution(resolution: ConflictResolution): Promise<void> {
    await this.db.run(`
      INSERT INTO conflict_resolutions (
        id, conflict_id, resolution, resolved_value, resolved_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      resolution.conflictId,
      resolution.resolution,
      JSON.stringify(resolution.resolvedValue),
      resolution.resolvedBy,
      resolution.notes
    ]);
  }

  /**
   * Auto-resolve conflicts where possible
   */
  async autoResolveConflicts(): Promise<{
    resolved: number;
    failed: number;
    errors: Error[];
  }> {
    const stats = {
      resolved: 0,
      failed: 0,
      errors: [] as Error[]
    };

    const autoResolvable = Array.from(this.activeConflicts.values())
      .filter(c => c.autoResolvable);

    for (const conflict of autoResolvable) {
      try {
        const resolution = conflict.suggestedResolution || 'merge';
        await this.resolveConflict(conflict.id, resolution, undefined, 'auto');
        stats.resolved++;
      } catch (error) {
        stats.failed++;
        stats.errors.push(error as Error);
        this.logger.error('Auto-resolve failed', error as Error, {
          conflictId: conflict.id
        });
      }
    }

    this.emit('autoResolveCompleted', stats);
    return stats;
  }

  /**
   * Get conflicts for a record
   */
  async getConflictsForRecord(
    table: string, 
    recordId: string
  ): Promise<ConflictItem[]> {
    const results = (await this.db.query(`
      SELECT * FROM conflicts 
      WHERE table_name = ? AND record_id = ? AND status = 'pending'
      ORDER BY detected_at DESC
    `, [table, recordId])).rows;

    return results.map(r => ({
      id: r.id,
      type: r.type,
      table: r.table_name,
      recordId: r.record_id,
      field: r.field,
      localValue: JSON.parse(r.local_value),
      remoteValue: JSON.parse(r.remote_value),
      baseValue: r.base_value ? JSON.parse(r.base_value) : undefined,
      localTimestamp: new Date(r.local_timestamp),
      remoteTimestamp: new Date(r.remote_timestamp),
      conflictDetectedAt: new Date(r.detected_at),
      severity: r.severity,
      autoResolvable: r.auto_resolvable === 1,
      suggestedResolution: r.suggested_resolution,
      mergeStrategy: r.merge_strategy
    }));
  }

  /**
   * Get all active conflicts
   */
  async getAllActiveConflicts(): Promise<ConflictItem[]> {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Helper methods
   */
  private shouldIgnoreField(field: string): boolean {
    const ignoredFields = ['id', 'created_at', 'createdAt', 'sync_status'];
    return ignoredFields.includes(field);
  }

  private valuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return false;
  }

  private calculateSeverity(data: Partial<ConflictItem>): 'low' | 'medium' | 'high' {
    // Critical fields
    if (['status', 'state', 'payment', 'amount'].includes(data.field || '')) {
      return 'high';
    }

    // Metadata fields
    if (['description', 'notes', 'tags'].includes(data.field || '')) {
      return 'low';
    }

    return 'medium';
  }

  private findApplicableStrategy(conflict: ConflictItem): ResolutionStrategy | null {
    const field = conflict.field || '';
    
    // Look for exact field match
    for (const strategy of this.strategies.values()) {
      if (strategy.applicableTo.includes(field)) {
        return strategy;
      }
    }

    // Look for type match
    const valueType = Array.isArray(conflict.localValue) ? 'array' 
      : typeof conflict.localValue === 'object' ? 'object'
      : typeof conflict.localValue;

    for (const strategy of this.strategies.values()) {
      if (strategy.applicableTo.includes(valueType) || 
          strategy.applicableTo.includes('*')) {
        return strategy;
      }
    }

    return null;
  }

  private async suggestResolution(conflict: ConflictItem): Promise<'local' | 'remote' | 'merge'> {
    // If one value is null/undefined, prefer the other
    if (conflict.localValue == null) return 'remote';
    if (conflict.remoteValue == null) return 'local';

    // If merge strategy exists, suggest merge
    if (conflict.mergeStrategy) return 'merge';

    // Default to last-write-wins
    return conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
  }

  private deepMerge(obj1: any, obj2: any): any {
    if (obj1 === obj2) return obj1;
    if (!obj1 || !obj2) return obj2 || obj1;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj2;

    const result = { ...obj1 };

    for (const key in obj2) {
      if (obj2.hasOwnProperty(key)) {
        if (typeof obj2[key] === 'object' && !Array.isArray(obj2[key])) {
          result[key] = this.deepMerge(obj1[key], obj2[key]);
        } else {
          result[key] = obj2[key];
        }
      }
    }

    return result;
  }

  /**
   * Export conflict history
   */
  async exportConflictHistory(days: number = 30): Promise<any> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const conflicts = (await this.db.query(`
      SELECT c.*, r.resolution, r.resolved_by, r.resolved_at
      FROM conflicts c
      LEFT JOIN conflict_resolutions r ON c.id = r.conflict_id
      WHERE c.detected_at > ?
      ORDER BY c.detected_at DESC
    `, [cutoff])).rows;

    return conflicts;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.activeConflicts.clear();
    this.strategies.clear();
    this.removeAllListeners();
  }
}