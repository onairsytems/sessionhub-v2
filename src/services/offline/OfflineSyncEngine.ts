/**
 * Offline Sync Engine
 * Manages data synchronization between local storage and cloud services
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { LocalCacheService } from '../cache/LocalCacheService';
import { SupabaseService } from '../cloud/SupabaseService';
import { OfflineOperationQueue, QueuedOperation } from './OfflineOperationQueue';
import { DatabaseService } from '@/src/database/DatabaseService';

export interface SyncConflict {
  id: string;
  table: string;
  recordId: string;
  localVersion: any;
  remoteVersion: any;
  localTimestamp: Date;
  remoteTimestamp: Date;
  resolution?: 'local' | 'remote' | 'merge';
  mergedVersion?: any;
}

export interface SyncProgress {
  phase: 'preparing' | 'uploading' | 'downloading' | 'resolving' | 'completed';
  current: number;
  total: number;
  percentage: number;
  currentTable?: string;
  conflicts: number;
  errors: number;
}

export interface SyncResult {
  success: boolean;
  duration: number;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: Array<{ message: string; operation?: any }>;
  timestamp: Date;
}

export class OfflineSyncEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly localCache: LocalCacheService;
  private readonly supabase: SupabaseService;
  private readonly operationQueue: OfflineOperationQueue;
  private readonly db: DatabaseService;
  private syncInProgress: boolean = false;
  private readonly BATCH_SIZE = 100;
  private conflicts: Map<string, SyncConflict> = new Map();

  constructor(
    localCache: LocalCacheService,
    supabase: SupabaseService,
    operationQueue: OfflineOperationQueue,
    db: DatabaseService
  ) {
    super();
    this.logger = new Logger('OfflineSyncEngine');
    this.localCache = localCache;
    this.supabase = supabase;
    this.operationQueue = operationQueue;
    this.db = db;
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Create sync metadata table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          id TEXT PRIMARY KEY,
          table_name TEXT NOT NULL,
          last_sync DATETIME,
          sync_direction TEXT CHECK(sync_direction IN ('up', 'down', 'both')),
          status TEXT NOT NULL DEFAULT 'pending',
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create conflict resolution table
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id TEXT PRIMARY KEY,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          local_version TEXT NOT NULL,
          remote_version TEXT NOT NULL,
          local_timestamp DATETIME NOT NULL,
          remote_timestamp DATETIME NOT NULL,
          resolution TEXT CHECK(resolution IN ('local', 'remote', 'merge', NULL)),
          merged_version TEXT,
          resolved_at DATETIME,
          resolved_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.logger.info('Sync engine schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize schema', error as Error);
      throw error;
    }
  }

  /**
   * Perform full synchronization
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.supabase.isServiceOnline()) {
      throw new Error('Cannot sync: Supabase service is offline');
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      duration: 0,
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      errors: [],
      timestamp: new Date()
    };

    try {
      this.emit('syncStarted');
      
      // Phase 1: Process offline operation queue
      await this.processPendingOperations(result);
      
      // Phase 2: Upload local changes
      await this.uploadLocalChanges(result);
      
      // Phase 3: Download remote changes
      await this.downloadRemoteChanges(result);
      
      // Phase 4: Resolve conflicts
      await this.resolveConflicts(result);
      
      // Phase 5: Clean up and finalize
      await this.finalizeSynchronization(result);
      
      result.success = true;
      result.duration = Date.now() - startTime;
      
      this.emit('syncCompleted', result);
      this.logger.info('Sync completed successfully', result);
      
    } catch (error) {
      result.errors.push({ message: (error as Error).message });
      this.emit('syncFailed', error);
      this.logger.error('Sync failed', error as Error);
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Process pending operations from the queue
   */
  private async processPendingOperations(result: SyncResult): Promise<void> {
    this.updateProgress('preparing', 0, 1);

    try {
      await this.operationQueue.processQueue(async (operation: QueuedOperation) => {
        if (operation.type === 'api_call') {
          return await this.executeApiCall(operation);
        } else if (operation.type === 'database_sync') {
          return await this.executeDatabaseSync(operation);
        }
        throw new Error(`Unknown operation type: ${operation.type}`);
      });

      const stats = await this.operationQueue.getStatistics();
      result.uploaded += stats.completed;
      
    } catch (error) {
      result.errors.push({ 
        message: 'Failed to process operation queue',
        operation: error
      });
    }
  }

  /**
   * Upload local changes to cloud
   */
  private async uploadLocalChanges(result: SyncResult): Promise<void> {
    const tables = ['projects', 'sessions', 'instructions', 'patterns'];
    let currentItem = 0;
    const totalItems = await this.getTotalPendingSyncItems();

    for (const table of tables) {
      this.updateProgress('uploading', currentItem, totalItems, table);
      
      try {
        const pendingItems = await this.localCache.getPendingSyncItems(table);
        
        for (const batch of this.chunkArray(pendingItems, this.BATCH_SIZE)) {
          const uploaded = await this.uploadBatch(table, batch, result);
          result.uploaded += uploaded;
          currentItem += uploaded;
          this.updateProgress('uploading', currentItem, totalItems, table);
        }
      } catch (error) {
        result.errors.push({
          message: `Failed to upload ${table}`,
          operation: error
        });
      }
    }
  }

  /**
   * Download remote changes from cloud
   */
  private async downloadRemoteChanges(result: SyncResult): Promise<void> {
    const tables = ['projects', 'sessions', 'instructions', 'patterns'];
    let currentItem = 0;
    const totalItems = tables.length; // Simplified for now

    for (const table of tables) {
      this.updateProgress('downloading', currentItem, totalItems, table);
      
      try {
        const lastSync = await this.getLastSyncTime(table);
        const remoteChanges = await this.fetchRemoteChanges(table, lastSync);
        
        for (const batch of this.chunkArray(remoteChanges, this.BATCH_SIZE)) {
          const downloaded = await this.downloadBatch(table, batch, result);
          result.downloaded += downloaded;
        }
        
        await this.updateLastSyncTime(table);
        currentItem++;
        this.updateProgress('downloading', currentItem, totalItems, table);
        
      } catch (error) {
        result.errors.push({
          message: `Failed to download ${table}`,
          operation: error
        });
      }
    }
  }

  /**
   * Resolve sync conflicts
   */
  private async resolveConflicts(result: SyncResult): Promise<void> {
    const conflicts = Array.from(this.conflicts.values());
    
    if (conflicts.length === 0) {
      return;
    }

    this.updateProgress('resolving', 0, conflicts.length);

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      
      try {
        if (conflict) {
          await this.resolveConflict(conflict);
          result.conflicts.push(conflict);
        }
      } catch (error) {
        result.errors.push({
          message: `Failed to resolve conflict for ${conflict?.table}:${conflict?.recordId}`,
          operation: error
        });
      }
      
      this.updateProgress('resolving', i + 1, conflicts.length);
    }
  }

  /**
   * Execute API call from queue
   */
  private async executeApiCall(operation: QueuedOperation): Promise<any> {
    const { endpoint, method, headers } = operation.metadata;
    
    const response = await fetch(endpoint!, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(operation.payload)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute database sync operation
   */
  private async executeDatabaseSync(operation: QueuedOperation): Promise<any> {
    const { table, action, data } = operation.payload;
    
    switch (action) {
      case 'insert':
        return await this.supabase.getClient().from(table).insert(data);
      case 'update':
        return await this.supabase.getClient().from(table).update(data).eq('id', data.id);
      case 'delete':
        return await this.supabase.getClient().from(table).delete().eq('id', data.id);
      default:
        throw new Error(`Unknown database action: ${action}`);
    }
  }

  /**
   * Upload a batch of items
   */
  private async uploadBatch(
    table: string, 
    items: any[], 
    result: SyncResult
  ): Promise<number> {
    let uploaded = 0;
    
    for (const item of items) {
      try {
        const exists = await this.checkRemoteExists(table, item.id);
        
        if (exists) {
          // Check for conflicts
          const remoteItem = await this.fetchRemoteItem(table, item.id);
          if (this.hasConflict(item, remoteItem)) {
            this.registerConflict(table, item, remoteItem);
            continue;
          }
        }
        
        // Upload the item
        await this.supabase.getClient()
          .from(table)
          .upsert(item);
        
        // Mark as synced in local cache
        await this.localCache.markAsSynced(table, item.id);
        uploaded++;
        
      } catch (error) {
        this.logger.error(`Failed to upload item ${item.id}`, error as Error);
        result.errors.push({
          message: `Failed to upload ${table}:${item.id}`,
          operation: item
        });
      }
    }
    
    return uploaded;
  }

  /**
   * Download a batch of items
   */
  private async downloadBatch(
    table: string, 
    items: any[], 
    result: SyncResult
  ): Promise<number> {
    let downloaded = 0;
    
    for (const item of items) {
      try {
        const localItem = await this.localCache.get(table, item.id);
        
        if (localItem && this.hasConflict(localItem, item)) {
          this.registerConflict(table, localItem, item);
          continue;
        }
        
        // Save to local cache
        await this.localCache.set(table, item.id, item, {
          skipSync: true // Don't mark for upload since it came from remote
        });
        
        downloaded++;
        
      } catch (error) {
        this.logger.error(`Failed to download item ${item.id}`, error as Error);
        result.errors.push({
          message: `Failed to download ${table}:${item.id}`,
          operation: item
        });
      }
    }
    
    return downloaded;
  }

  /**
   * Check if item has conflict
   */
  private hasConflict(localItem: any, remoteItem: any): boolean {
    // Simple version-based conflict detection
    if (localItem.version && remoteItem.version) {
      return localItem.version !== remoteItem.version &&
             localItem.updated_at !== remoteItem.updated_at;
    }
    
    // Timestamp-based conflict detection
    const localTime = new Date(localItem.updated_at).getTime();
    const remoteTime = new Date(remoteItem.updated_at).getTime();
    
    // If both were modified after last sync, it's a conflict
    return Math.abs(localTime - remoteTime) > 1000; // 1 second tolerance
  }

  /**
   * Register a conflict
   */
  private registerConflict(table: string, localItem: any, remoteItem: any): void {
    const conflictId = `${table}:${localItem.id}`;
    
    const conflict: SyncConflict = {
      id: conflictId,
      table,
      recordId: localItem.id,
      localVersion: localItem,
      remoteVersion: remoteItem,
      localTimestamp: new Date(localItem.updated_at),
      remoteTimestamp: new Date(remoteItem.updated_at)
    };
    
    this.conflicts.set(conflictId, conflict);
    this.emit('conflictDetected', conflict);
  }

  /**
   * Resolve a conflict
   */
  private async resolveConflict(conflict: SyncConflict): Promise<void> {
    // Default strategy: last-write-wins
    const resolution = conflict.localTimestamp > conflict.remoteTimestamp 
      ? 'local' 
      : 'remote';
    
    conflict.resolution = resolution;
    
    if (resolution === 'local') {
      // Upload local version
      await this.supabase.getClient()
        .from(conflict.table)
        .upsert(conflict.localVersion);
    } else {
      // Download remote version
      await this.localCache.set(
        conflict.table, 
        conflict.recordId, 
        conflict.remoteVersion,
        { skipSync: true }
      );
    }
    
    // Save conflict resolution
    await this.saveConflictResolution(conflict);
    
    this.emit('conflictResolved', conflict);
  }

  /**
   * Save conflict resolution to database
   */
  private async saveConflictResolution(conflict: SyncConflict): Promise<void> {
    await this.db.run(`
      INSERT INTO sync_conflicts (
        id, table_name, record_id, local_version, remote_version,
        local_timestamp, remote_timestamp, resolution, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      conflict.id,
      conflict.table,
      conflict.recordId,
      JSON.stringify(conflict.localVersion),
      JSON.stringify(conflict.remoteVersion),
      conflict.localTimestamp.toISOString(),
      conflict.remoteTimestamp.toISOString(),
      conflict.resolution
    ]);
  }

  /**
   * Update sync progress
   */
  private updateProgress(
    phase: SyncProgress['phase'],
    current: number,
    total: number,
    currentTable?: string
  ): void {
    const progress: SyncProgress = {
      phase,
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      currentTable,
      conflicts: this.conflicts.size,
      errors: 0
    };
    
    this.emit('syncProgress', progress);
  }

  /**
   * Helper methods
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async getTotalPendingSyncItems(): Promise<number> {
    let total = 0;
    const tables = ['projects', 'sessions', 'instructions', 'patterns'];
    
    for (const table of tables) {
      const items = await this.localCache.getPendingSyncItems(table);
      total += items.length;
    }
    
    return total;
  }

  private async getLastSyncTime(table: string): Promise<Date | null> {
    const result = (await this.db.query(`
      SELECT last_sync FROM sync_metadata 
      WHERE table_name = ? 
      ORDER BY last_sync DESC 
      LIMIT 1
    `, [table])).rows;
    
    return result[0]?.last_sync ? new Date(result[0].last_sync) : null;
  }

  private async updateLastSyncTime(table: string): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO sync_metadata (id, table_name, last_sync)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [`${table}_sync`, table]);
  }

  private async checkRemoteExists(table: string, id: string): Promise<boolean> {
    const { data } = await this.supabase.getClient()
      .from(table)
      .select('id')
      .eq('id', id)
      .single();
    
    return !!data;
  }

  private async fetchRemoteItem(table: string, id: string): Promise<any> {
    const { data, error } = await this.supabase.getClient()
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  private async fetchRemoteChanges(table: string, since: Date | null): Promise<any[]> {
    let query = this.supabase.getClient()
      .from(table)
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (since) {
      query = query.gt('updated_at', since.toISOString());
    }
    
    const { data, error } = await query.limit(1000);
    
    if (error) throw error;
    return data || [];
  }

  private async finalizeSynchronization(_result: SyncResult): Promise<void> {
    // Clear resolved conflicts
    this.conflicts.clear();
    
    // Clean up old sync metadata
    await this.db.run(`
      DELETE FROM sync_metadata 
      WHERE last_sync < datetime('now', '-30 days')
    `);
    
    // Update sync completion status
    this.updateProgress('completed', 1, 1);
  }

  /**
   * Force sync specific items
   */
  async syncItems(table: string, ids: string[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      duration: 0,
      uploaded: 0,
      downloaded: 0,
      conflicts: [],
      errors: [],
      timestamp: new Date()
    };

    const startTime = Date.now();

    try {
      for (const id of ids) {
        const localItem = await this.localCache.get(table, id);
        if (localItem) {
          await this.uploadBatch(table, [localItem], result);
        }
      }
      
      result.success = true;
      result.duration = Date.now() - startTime;
      
    } catch (error) {
      result.errors.push({ message: (error as Error).message });
    }

    return result;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    lastSync: Date | null;
    pendingItems: number;
    conflicts: number;
    tables: Array<{
      name: string;
      lastSync: Date | null;
      pendingCount: number;
    }>;
  }> {
    const tables = ['projects', 'sessions', 'instructions', 'patterns'];
    const tableStatus = [];
    let totalPending = 0;
    let lastSync: Date | null = null;

    for (const table of tables) {
      const tableLastSync = await this.getLastSyncTime(table);
      const pending = await this.localCache.getPendingSyncItems(table);
      
      tableStatus.push({
        name: table,
        lastSync: tableLastSync,
        pendingCount: pending.length
      });
      
      totalPending += pending.length;
      
      if (tableLastSync && (!lastSync || tableLastSync > lastSync)) {
        lastSync = tableLastSync;
      }
    }

    return {
      lastSync,
      pendingItems: totalPending,
      conflicts: this.conflicts.size,
      tables: tableStatus
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.conflicts.clear();
  }
}