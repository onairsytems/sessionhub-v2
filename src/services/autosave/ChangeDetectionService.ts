/**
 * @actor system
 * @responsibility Change detection for session state modifications
 */

import { Logger } from '@/src/lib/logging/Logger';
import * as crypto from 'crypto';

export interface StateSnapshot {
  sessionId: string;
  checksum: string;
  timestamp: Date;
  size: number;
  fieldChecksums: Map<string, string>;
}

export interface ChangeDetectionResult {
  hasChanges: boolean;
  changedFields: string[];
  addedFields: string[];
  removedFields: string[];
  totalChanges: number;
  changePercentage: number;
}

export interface FieldChange {
  field: string;
  type: 'added' | 'removed' | 'modified';
  oldChecksum?: string;
  newChecksum?: string;
  oldSize?: number;
  newSize?: number;
}

export class ChangeDetectionService {
  private readonly logger: Logger;
  private snapshots: Map<string, StateSnapshot> = new Map();
  private readonly maxSnapshots = 1000; // Prevent memory bloat

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create snapshot of current state
   */
  createSnapshot(sessionId: string, state: any): StateSnapshot {
    const serialized = JSON.stringify(state);
    const checksum = this.generateChecksum(serialized);
    const fieldChecksums = this.generateFieldChecksums(state);

    const snapshot: StateSnapshot = {
      sessionId,
      checksum,
      timestamp: new Date(),
      size: Buffer.byteLength(serialized, 'utf8'),
      fieldChecksums
    };

    this.snapshots.set(sessionId, snapshot);

    // Cleanup old snapshots if needed
    if (this.snapshots.size > this.maxSnapshots) {
      this.cleanupOldSnapshots();
    }

    this.logger.debug('State snapshot created', {
      sessionId,
      checksum,
      size: snapshot.size,
      fieldCount: fieldChecksums.size
    });

    return snapshot;
  }

  /**
   * Detect changes since last snapshot
   */
  detectChanges(sessionId: string, currentState: any): ChangeDetectionResult {
    const lastSnapshot = this.snapshots.get(sessionId);
    
    if (!lastSnapshot) {
      // No previous snapshot - everything is new
      return {
        hasChanges: true,
        changedFields: [],
        addedFields: Object.keys(this.flattenObject(currentState)),
        removedFields: [],
        totalChanges: Object.keys(this.flattenObject(currentState)).length,
        changePercentage: 100
      };
    }

    const currentSerialized = JSON.stringify(currentState);
    const currentChecksum = this.generateChecksum(currentSerialized);

    // Quick check - if checksums match, no changes
    if (currentChecksum === lastSnapshot.checksum) {
      return {
        hasChanges: false,
        changedFields: [],
        addedFields: [],
        removedFields: [],
        totalChanges: 0,
        changePercentage: 0
      };
    }

    // Detailed field-level change detection
    const currentFieldChecksums = this.generateFieldChecksums(currentState);
    const fieldChanges = this.compareFieldChecksums(
      lastSnapshot.fieldChecksums,
      currentFieldChecksums
    );

    const totalFields = Math.max(
      lastSnapshot.fieldChecksums.size,
      currentFieldChecksums.size
    );
    
    const changePercentage = totalFields > 0 
      ? (fieldChanges.length / totalFields) * 100 
      : 0;

    const result: ChangeDetectionResult = {
      hasChanges: fieldChanges.length > 0,
      changedFields: fieldChanges.filter(c => c.type === 'modified').map(c => c.field),
      addedFields: fieldChanges.filter(c => c.type === 'added').map(c => c.field),
      removedFields: fieldChanges.filter(c => c.type === 'removed').map(c => c.field),
      totalChanges: fieldChanges.length,
      changePercentage: Math.round(changePercentage * 100) / 100
    };

    this.logger.debug('Change detection completed', {
      sessionId,
      hasChanges: result.hasChanges,
      totalChanges: result.totalChanges,
      changePercentage: result.changePercentage
    });

    return result;
  }

  /**
   * Check if session has changes since last snapshot
   */
  hasChanges(sessionId: string, currentState: any): boolean {
    const result = this.detectChanges(sessionId, currentState);
    return result.hasChanges;
  }

  /**
   * Get last snapshot for session
   */
  getLastSnapshot(sessionId: string): StateSnapshot | null {
    return this.snapshots.get(sessionId) || null;
  }

  /**
   * Remove snapshot for session
   */
  removeSnapshot(sessionId: string): boolean {
    return this.snapshots.delete(sessionId);
  }

  /**
   * Get all session IDs with snapshots
   */
  getSnapshotSessionIds(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Get change detection statistics
   */
  getStatistics(): {
    totalSnapshots: number;
    oldestSnapshot?: Date;
    newestSnapshot?: Date;
    averageSnapshotSize: number;
  } {
    const snapshots = Array.from(this.snapshots.values());
    
    if (snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        averageSnapshotSize: 0
      };
    }

    const timestamps = snapshots.map(s => s.timestamp);
    const sizes = snapshots.map(s => s.size);

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      newestSnapshot: new Date(Math.max(...timestamps.map(t => t.getTime()))),
      averageSnapshotSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)
    };
  }

  /**
   * Generate checksum for data
   */
  private generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate checksums for individual fields
   */
  private generateFieldChecksums(obj: any, prefix = ''): Map<string, string> {
    const checksums = new Map<string, string>();
    const flattened = this.flattenObject(obj, prefix);

    for (const [key, value] of Object.entries(flattened)) {
      const serialized = JSON.stringify(value);
      const checksum = this.generateChecksum(serialized);
      checksums.set(key, checksum);
    }

    return checksums;
  }

  /**
   * Flatten nested object into dot-notation paths
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

  /**
   * Compare field checksums to detect changes
   */
  private compareFieldChecksums(
    oldChecksums: Map<string, string>,
    newChecksums: Map<string, string>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allFields = new Set([
      ...oldChecksums.keys(),
      ...newChecksums.keys()
    ]);

    for (const field of allFields) {
      const oldChecksum = oldChecksums.get(field);
      const newChecksum = newChecksums.get(field);

      if (!oldChecksum && newChecksum) {
        // Field was added
        changes.push({
          field,
          type: 'added',
          newChecksum
        });
      } else if (oldChecksum && !newChecksum) {
        // Field was removed
        changes.push({
          field,
          type: 'removed',
          oldChecksum
        });
      } else if (oldChecksum && newChecksum && oldChecksum !== newChecksum) {
        // Field was modified
        changes.push({
          field,
          type: 'modified',
          oldChecksum,
          newChecksum
        });
      }
    }

    return changes;
  }

  /**
   * Cleanup old snapshots to prevent memory bloat
   */
  private cleanupOldSnapshots(): void {
    if (this.snapshots.size <= this.maxSnapshots) {
      return;
    }

    // Sort by timestamp and keep only the newest ones
    const snapshots = Array.from(this.snapshots.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    // Keep newest maxSnapshots, remove the rest
    const toRemove = snapshots.slice(this.maxSnapshots);
    
    for (const [sessionId] of toRemove) {
      this.snapshots.delete(sessionId);
    }

    this.logger.debug('Cleaned up old snapshots', {
      removed: toRemove.length,
      remaining: this.snapshots.size
    });
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    const count = this.snapshots.size;
    this.snapshots.clear();
    
    this.logger.info('All snapshots cleared', { count });
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): {
    snapshotCount: number;
    estimatedMemoryBytes: number;
    estimatedMemoryMB: number;
  } {
    const snapshots = Array.from(this.snapshots.values());
    
    // Rough estimation of memory usage
    const estimatedBytes = snapshots.reduce((total, snapshot) => {
      return total + snapshot.size + (snapshot.fieldChecksums.size * 100); // Rough overhead
    }, 0);

    return {
      snapshotCount: snapshots.length,
      estimatedMemoryBytes: estimatedBytes,
      estimatedMemoryMB: Math.round(estimatedBytes / (1024 * 1024) * 100) / 100
    };
  }
}