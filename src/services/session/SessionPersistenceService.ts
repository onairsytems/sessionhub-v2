/**
 * @actor system
 * @responsibility Session state persistence and recovery
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

export interface PersistedSession {
  id: string;
  state: any;
  timestamp: string;
  checkpointId: string;
  metadata: {
    phase: string;
    progress: number;
    documentsCount: number;
    lastActiveTimestamp: string;
  };
}

export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  phase: string;
  state: any;
  timestamp: string;
  canRestore: boolean;
}

export class SessionPersistenceService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly dataDir: string;
  private readonly sessionsDir: string;
  private readonly checkpointsDir: string;
  private readonly maxCheckpointsPerSession = 10;
  private readonly sessionRetentionDays = 30;

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    
    // Set up persistence directories
    this.dataDir = path.join(app.getPath('userData'), 'sessionhub');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.checkpointsDir = path.join(this.dataDir, 'checkpoints');
    
    this.initializeDirectories();
  }

  /**
   * Initialize persistence directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.sessionsDir, { recursive: true });
      await fs.mkdir(this.checkpointsDir, { recursive: true });
      
      this.logger.info('Session persistence directories initialized', {
        dataDir: this.dataDir,
        sessionsDir: this.sessionsDir,
        checkpointsDir: this.checkpointsDir
      });
    } catch (error) {
      this.logger.error('Failed to initialize persistence directories', error as Error);
    }
  }

  /**
   * Persist session state
   */
  async persistSession(sessionId: string, state: any, metadata: any): Promise<void> {
    const startTime = Date.now();
    
    try {
      const persistedSession: PersistedSession = {
        id: sessionId,
        state,
        timestamp: new Date().toISOString(),
        checkpointId: this.generateCheckpointId(),
        metadata: {
          phase: metadata.phase || 'unknown',
          progress: metadata.progress || 0,
          documentsCount: metadata.documentsCount || 0,
          lastActiveTimestamp: new Date().toISOString()
        }
      };

      const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.writeFile(
        sessionPath,
        JSON.stringify(persistedSession, null, 2),
        'utf-8'
      );

      this.logger.info('Session persisted successfully', {
        sessionId,
        phase: persistedSession.metadata.phase,
        progress: persistedSession.metadata.progress
      });

      this.auditLogger.logEvent({
        actor: { type: 'system', id: 'SessionPersistenceService' },
        operation: {
          type: 'session.persist',
          description: 'Persisted session state',
          input: { sessionId }
        },
        result: {
          status: 'success',
          duration: Date.now() - startTime
        },
        metadata: { correlationId: this.generateCorrelationId() }
      });
    } catch (error) {
      this.logger.error('Failed to persist session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Restore session state
   */
  async restoreSession(sessionId: string): Promise<PersistedSession | null> {
    try {
      const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
      
      // Check if session file exists
      try {
        await fs.access(sessionPath);
      } catch {
        return null;
      }

      const content = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(content) as PersistedSession;

      this.logger.info('Session restored successfully', {
        sessionId,
        phase: session.metadata.phase,
        progress: session.metadata.progress
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to restore session', error as Error, { sessionId });
      return null;
    }
  }

  /**
   * Create session checkpoint
   */
  async createCheckpoint(
    sessionId: string, 
    phase: string, 
    state: any,
    canRestore: boolean = true
  ): Promise<SessionCheckpoint> {
    try {
      const checkpoint: SessionCheckpoint = {
        id: this.generateCheckpointId(),
        sessionId,
        phase,
        state,
        timestamp: new Date().toISOString(),
        canRestore
      };

      const checkpointPath = path.join(
        this.checkpointsDir,
        sessionId,
        `${checkpoint.id}.json`
      );

      // Create session checkpoint directory
      await fs.mkdir(path.dirname(checkpointPath), { recursive: true });

      await fs.writeFile(
        checkpointPath,
        JSON.stringify(checkpoint, null, 2),
        'utf-8'
      );

      // Clean up old checkpoints
      await this.cleanupOldCheckpoints(sessionId);

      this.logger.info('Checkpoint created', {
        sessionId,
        checkpointId: checkpoint.id,
        phase
      });

      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to create checkpoint', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get session checkpoints
   */
  async getCheckpoints(sessionId: string): Promise<SessionCheckpoint[]> {
    try {
      const checkpointDir = path.join(this.checkpointsDir, sessionId);
      
      try {
        await fs.access(checkpointDir);
      } catch {
        return [];
      }

      const files = await fs.readdir(checkpointDir);
      const checkpoints: SessionCheckpoint[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(checkpointDir, file),
            'utf-8'
          );
          checkpoints.push(JSON.parse(content));
        }
      }

      // Sort by timestamp descending
      checkpoints.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return checkpoints;
    } catch (error) {
      this.logger.error('Failed to get checkpoints', error as Error, { sessionId });
      return [];
    }
  }

  /**
   * Restore from checkpoint
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<SessionCheckpoint | null> {
    try {
      // Search all session directories for the checkpoint
      const sessionDirs = await fs.readdir(this.checkpointsDir);
      
      for (const sessionId of sessionDirs) {
        const checkpointPath = path.join(
          this.checkpointsDir,
          sessionId,
          `${checkpointId}.json`
        );
        
        try {
          await fs.access(checkpointPath);
          const content = await fs.readFile(checkpointPath, 'utf-8');
          const checkpoint = JSON.parse(content) as SessionCheckpoint;
          
          if (checkpoint.canRestore) {
            this.logger.info('Checkpoint restored', {
              checkpointId,
              sessionId: checkpoint.sessionId,
              phase: checkpoint.phase
            });
            
            return checkpoint;
          } else {
            this.logger.warn('Checkpoint cannot be restored', { checkpointId });
            return null;
          }
        } catch {
          // Continue searching
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to restore from checkpoint', error as Error, { checkpointId });
      return null;
    }
  }

  /**
   * Get all persisted sessions
   */
  async getAllSessions(): Promise<PersistedSession[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: PersistedSession[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.sessionsDir, file),
            'utf-8'
          );
          sessions.push(JSON.parse(content));
        }
      }

      // Sort by last active timestamp descending
      sessions.sort((a, b) => 
        new Date(b.metadata.lastActiveTimestamp).getTime() - 
        new Date(a.metadata.lastActiveTimestamp).getTime()
      );

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get all sessions', error as Error);
      return [];
    }
  }

  /**
   * Delete session and its checkpoints
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete session file
      const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
      try {
        await fs.unlink(sessionPath);
      } catch {
        // File might not exist
      }

      // Delete checkpoints directory
      const checkpointDir = path.join(this.checkpointsDir, sessionId);
      try {
        await fs.rm(checkpointDir, { recursive: true });
      } catch {
        // Directory might not exist
      }

      this.logger.info('Session deleted', { sessionId });
    } catch (error) {
      this.logger.error('Failed to delete session', error as Error, { sessionId });
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.sessionRetentionDays);
      
      const sessions = await this.getAllSessions();
      let deletedCount = 0;

      for (const session of sessions) {
        const lastActive = new Date(session.metadata.lastActiveTimestamp);
        if (lastActive < cutoffDate) {
          await this.deleteSession(session.id);
          deletedCount++;
        }
      }

      this.logger.info('Cleaned up old sessions', { 
        deletedCount,
        retentionDays: this.sessionRetentionDays 
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to clean up old sessions', error as Error);
      return 0;
    }
  }

  /**
   * Clean up old checkpoints for a session
   */
  private async cleanupOldCheckpoints(sessionId: string): Promise<void> {
    try {
      const checkpoints = await this.getCheckpoints(sessionId);
      
      if (checkpoints.length > this.maxCheckpointsPerSession) {
        // Keep only the most recent checkpoints
        const toDelete = checkpoints.slice(this.maxCheckpointsPerSession);
        
        for (const checkpoint of toDelete) {
          const checkpointPath = path.join(
            this.checkpointsDir,
            sessionId,
            `${checkpoint.id}.json`
          );
          
          try {
            await fs.unlink(checkpointPath);
          } catch {
            // File might already be deleted
          }
        }
        
        this.logger.debug('Cleaned up old checkpoints', {
          sessionId,
          deletedCount: toDelete.length
        });
      }
    } catch (error) {
      this.logger.error('Failed to clean up checkpoints', error as Error, { sessionId });
    }
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    return `ckpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get persistence statistics
   */
  async getStatistics(): Promise<any> {
    try {
      const sessions = await this.getAllSessions();
      const sessionCount = sessions.length;
      
      let totalCheckpoints = 0;
      let totalSize = 0;
      
      for (const session of sessions) {
        const checkpoints = await this.getCheckpoints(session.id);
        totalCheckpoints += checkpoints.length;
      }

      // Calculate storage size
      const sessionFiles = await fs.readdir(this.sessionsDir);
      for (const file of sessionFiles) {
        const stats = await fs.stat(path.join(this.sessionsDir, file));
        totalSize += stats.size;
      }

      return {
        sessionCount,
        totalCheckpoints,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        dataDirectory: this.dataDir
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      return null;
    }
  }
}