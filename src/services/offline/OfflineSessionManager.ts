/**
 * Offline Session Manager
 * Enables full session creation and editing capabilities while offline
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { DatabaseService } from '@/src/database/DatabaseService';
import { LocalCacheService } from '../cache/LocalCacheService';
import { OfflineOperationQueue } from './OfflineOperationQueue';
import { v4 as uuidv4 } from 'uuid';

export interface OfflineSession {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  status: 'draft' | 'planning' | 'executing' | 'completed';
  objectives: string[];
  planningInstructions?: any;
  executionResults?: any;
  createdOffline: boolean;
  localOnly: boolean;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict';
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface OfflineCapability {
  feature: string;
  available: boolean;
  limitations?: string[];
  fallbackMode?: string;
}

export class OfflineSessionManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly db: DatabaseService;
  private readonly localCache: LocalCacheService;
  private readonly operationQueue: OfflineOperationQueue;

  constructor(
    db: DatabaseService,
    localCache: LocalCacheService,
    operationQueue: OfflineOperationQueue
  ) {
    super();
    this.logger = new Logger('OfflineSessionManager');
    this.db = db;
    this.localCache = localCache;
    this.operationQueue = operationQueue;
    this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Extend sessions table with offline-specific fields
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS offline_sessions (
          id TEXT PRIMARY KEY,
          session_data TEXT NOT NULL,
          created_offline INTEGER DEFAULT 1,
          local_only INTEGER DEFAULT 0,
          sync_status TEXT DEFAULT 'pending',
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Track offline edits
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS offline_edits (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          edit_type TEXT NOT NULL,
          field_path TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (session_id) REFERENCES offline_sessions(id)
        )
      `);

      this.logger.info('Offline session schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize schema', error as Error);
      throw error;
    }
  }

  /**
   * Create a new session while offline
   */
  async createOfflineSession(
    data: Omit<OfflineSession, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<OfflineSession> {
    const session: OfflineSession = {
      ...data,
      id: uuidv4(),
      createdOffline: true,
      localOnly: true,
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    try {
      // Save to offline sessions table
      await this.db.run(`
        INSERT INTO offline_sessions (
          id, session_data, created_offline, local_only, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        session.id,
        JSON.stringify(session),
        1,
        1,
        session.syncStatus,
        session.version
      ]);

      // Also save to local cache for quick access
      await this.localCache.upsertSession(session as any);

      // Queue for sync when online
      await this.operationQueue.enqueue({
        type: 'database_sync',
        operation: 'create_session',
        payload: {
          table: 'sessions',
          action: 'insert',
          data: session
        },
        metadata: {
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 5,
          priority: 'high',
          sessionId: session.id
        },
        status: 'pending'
      });

      this.emit('sessionCreated', session);
      this.logger.info('Created offline session', { id: session.id });

      return session;
    } catch (error) {
      this.logger.error('Failed to create offline session', error as Error);
      throw error;
    }
  }

  /**
   * Edit a session while offline
   */
  async editOfflineSession(
    sessionId: string,
    updates: Partial<OfflineSession>
  ): Promise<OfflineSession> {
    try {
      // Get current session data
      const currentSession = await this.getOfflineSession(sessionId);
      if (!currentSession) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Track individual edits for granular sync
      for (const [field, value] of Object.entries(updates)) {
        await this.trackEdit(sessionId, field, currentSession[field as keyof OfflineSession], value);
      }

      // Update session
      const updatedSession: OfflineSession = {
        ...currentSession,
        ...updates,
        updatedAt: new Date(),
        version: currentSession.version + 1,
        syncStatus: 'pending'
      };

      // Save updated session
      await this.db.run(`
        UPDATE offline_sessions 
        SET session_data = ?, version = ?, updated_at = CURRENT_TIMESTAMP, sync_status = ?
        WHERE id = ?
      `, [
        JSON.stringify(updatedSession),
        updatedSession.version,
        updatedSession.syncStatus,
        sessionId
      ]);

      // Update local cache
      await this.localCache.upsertSession(updatedSession as any);

      // Queue update for sync
      await this.operationQueue.enqueue({
        type: 'database_sync',
        operation: 'update_session',
        payload: {
          table: 'sessions',
          action: 'update',
          data: updatedSession
        },
        metadata: {
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 5,
          priority: 'high',
          sessionId: sessionId
        },
        status: 'pending'
      });

      this.emit('sessionUpdated', updatedSession);
      this.logger.info('Updated offline session', { id: sessionId });

      return updatedSession;
    } catch (error) {
      this.logger.error('Failed to edit offline session', error as Error);
      throw error;
    }
  }

  /**
   * Track individual field edits for conflict resolution
   */
  private async trackEdit(
    sessionId: string,
    fieldPath: string,
    oldValue: any,
    newValue: any
  ): Promise<void> {
    const editId = uuidv4();
    
    await this.db.run(`
      INSERT INTO offline_edits (
        id, session_id, edit_type, field_path, old_value, new_value
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      editId,
      sessionId,
      'field_update',
      fieldPath,
      JSON.stringify(oldValue),
      JSON.stringify(newValue)
    ]);
  }

  /**
   * Get offline session by ID
   */
  async getOfflineSession(sessionId: string): Promise<OfflineSession | null> {
    try {
      // First try local cache
      const cached = await this.localCache.getSession(sessionId);
      if (cached) {
        return cached as unknown as OfflineSession;
      }

      // Then check offline sessions table
      const result = (await this.db.query(`
        SELECT session_data FROM offline_sessions WHERE id = ?
      `, [sessionId])).rows;

      if (result.length > 0) {
        return JSON.parse(result[0].session_data);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get offline session', error as Error);
      return null;
    }
  }

  /**
   * List all offline sessions
   */
  async listOfflineSessions(
    filter?: { status?: string; syncStatus?: string }
  ): Promise<OfflineSession[]> {
    try {
      let query = 'SELECT session_data FROM offline_sessions WHERE 1=1';
      const params: any[] = [];

      if (filter?.syncStatus) {
        query += ' AND sync_status = ?';
        params.push(filter.syncStatus);
      }

      query += ' ORDER BY updated_at DESC';

      const results = (await this.db.query(query, params)).rows;
      const sessions = results.map(r => JSON.parse(r.session_data));

      // Apply additional filters on parsed data
      if (filter?.status) {
        return sessions.filter(s => s.status === filter.status);
      }

      return sessions;
    } catch (error) {
      this.logger.error('Failed to list offline sessions', error as Error);
      return [];
    }
  }

  /**
   * Get offline capabilities
   */
  getOfflineCapabilities(): OfflineCapability[] {
    return [
      {
        feature: 'Session Creation',
        available: true,
        limitations: ['No AI assistance for planning', 'Limited validation']
      },
      {
        feature: 'Session Editing',
        available: true,
        limitations: ['Changes queued for sync', 'Conflict resolution required']
      },
      {
        feature: 'Session Execution',
        available: false,
        limitations: ['Requires API connection'],
        fallbackMode: 'Queue for later execution'
      },
      {
        feature: 'Pattern Recognition',
        available: true,
        limitations: ['Limited to cached patterns'],
        fallbackMode: 'Local pattern cache'
      },
      {
        feature: 'File Operations',
        available: true,
        limitations: ['Local filesystem only']
      },
      {
        feature: 'Version Control',
        available: true,
        limitations: ['Remote push queued']
      }
    ];
  }

  /**
   * Execute offline operations when back online
   */
  async executeQueuedOperations(): Promise<{
    successful: number;
    failed: number;
    errors: Error[];
  }> {
    const stats = {
      successful: 0,
      failed: 0,
      errors: [] as Error[]
    };

    try {
      // Get all pending offline sessions
      const pendingSessions = await this.listOfflineSessions({
        syncStatus: 'pending'
      });

      for (const session of pendingSessions) {
        try {
          // Mark as syncing
          session.syncStatus = 'syncing';
          await this.updateSyncStatus(session.id, 'syncing');

          // Attempt to sync
          await this.syncSession(session);
          
          // Mark as synced
          await this.updateSyncStatus(session.id, 'synced');
          stats.successful++;

        } catch (error) {
          stats.failed++;
          stats.errors.push(error as Error);
          await this.updateSyncStatus(session.id, 'conflict');
        }
      }

      this.emit('queueExecutionCompleted', stats);
    } catch (error) {
      this.logger.error('Failed to execute queued operations', error as Error);
    }

    return stats;
  }

  /**
   * Sync a specific session
   */
  private async syncSession(session: OfflineSession): Promise<void> {
    // This would integrate with the actual sync service
    // For now, just emit an event
    this.emit('sessionSyncRequired', session);
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(
    sessionId: string, 
    status: OfflineSession['syncStatus']
  ): Promise<void> {
    await this.db.run(`
      UPDATE offline_sessions 
      SET sync_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, sessionId]);
  }

  /**
   * Resolve session conflicts
   */
  async resolveSessionConflict(
    sessionId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: OfflineSession
  ): Promise<void> {
    try {
      if (resolution === 'merge' && !mergedData) {
        throw new Error('Merged data required for merge resolution');
      }

      const session = await this.getOfflineSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      if (resolution === 'local') {
        // Keep local version, queue for upload
        await this.updateSyncStatus(sessionId, 'pending');
      } else if (resolution === 'remote') {
        // Discard local changes
        await this.db.run(`
          DELETE FROM offline_sessions WHERE id = ?
        `, [sessionId]);
        await this.localCache.deleteSession(sessionId);
      } else if (resolution === 'merge' && mergedData) {
        // Save merged version
        await this.editOfflineSession(sessionId, mergedData);
      }

      this.emit('conflictResolved', { sessionId, resolution });
    } catch (error) {
      this.logger.error('Failed to resolve conflict', error as Error);
      throw error;
    }
  }

  /**
   * Get session edit history
   */
  async getSessionEditHistory(sessionId: string): Promise<Array<{
    id: string;
    fieldPath: string;
    oldValue: any;
    newValue: any;
    timestamp: Date;
  }>> {
    const edits = (await this.db.query(`
      SELECT * FROM offline_edits 
      WHERE session_id = ? 
      ORDER BY timestamp DESC
    `, [sessionId])).rows;

    return edits.map(edit => ({
      id: edit.id,
      fieldPath: edit.field_path,
      oldValue: JSON.parse(edit.old_value),
      newValue: JSON.parse(edit.new_value),
      timestamp: new Date(edit.timestamp)
    }));
  }

  /**
   * Clean up old offline data
   */
  async cleanupOldData(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAgeMs).toISOString();

    // Delete old synced sessions
    await this.db.run(`
      DELETE FROM offline_sessions 
      WHERE sync_status = 'synced' 
      AND updated_at < ?
    `, [cutoffDate]);

    // Delete old edit history
    await this.db.run(`
      DELETE FROM offline_edits 
      WHERE timestamp < ? 
      AND synced = 1
    `, [cutoffDate]);

    this.logger.info('Cleaned up old offline data');
  }

  /**
   * Export offline sessions for backup
   */
  async exportOfflineSessions(): Promise<{
    sessions: OfflineSession[];
    edits: any[];
    exportDate: Date;
  }> {
    const sessions = await this.listOfflineSessions();
    const allEdits = [];

    for (const session of sessions) {
      const edits = await this.getSessionEditHistory(session.id);
      allEdits.push(...edits.map(e => ({ ...e, sessionId: session.id })));
    }

    return {
      sessions,
      edits: allEdits,
      exportDate: new Date()
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.removeAllListeners();
  }
}