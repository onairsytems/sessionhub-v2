import { v4 as uuidv4 } from 'uuid';
import { Session, SessionRequest, SessionMetadata } from '../../models/Session';
import { SessionService } from '../SessionService';
import { Logger } from '../../lib/logging/Logger';

export interface SessionOperation {
  id: string;
  type: 'reopen' | 'duplicate' | 'archive' | 'delete' | 'export' | 'bulk_delete' | 'bulk_archive' | 'bulk_export';
  sessionIds: string[];
  timestamp: string;
  userId: string;
  parameters?: Record<string, any>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ReopenOptions {
  newWorkflow?: boolean;
  resetStatus?: boolean;
  preserveInstructions?: boolean;
  preserveResults?: boolean;
}

export interface DuplicateOptions {
  namePrefix?: string;
  preserveMetadata?: boolean;
  resetStatus?: boolean;
  modifications?: {
    name?: string;
    description?: string;
    content?: string;
    metadata?: Partial<SessionMetadata>;
  };
}

export interface BulkOperationProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  currentItem?: string;
}

export interface UndoableOperation {
  operationId: string;
  type: SessionOperation['type'];
  sessionSnapshots: Session[];
  timestamp: string;
  undoable: boolean;
  expired: boolean;
}

export class SessionOperationsService {
  private static instance: SessionOperationsService;
  private sessionService: SessionService;
  private logger: Logger;
  private operationHistory: Map<string, SessionOperation> = new Map();
  private undoHistory: Map<string, UndoableOperation> = new Map();
  private readonly UNDO_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.logger = new Logger('SessionOperationsService');
    this.sessionService = SessionService.getInstance();
    this.cleanupExpiredUndos();
  }

  static getInstance(): SessionOperationsService {
    if (!SessionOperationsService.instance) {
      SessionOperationsService.instance = new SessionOperationsService();
    }
    return SessionOperationsService.instance;
  }

  // Session Reopen Operations
  async reopenSession(sessionId: string, options: ReopenOptions = {}): Promise<Session> {
    const operation = this.createOperation('reopen', [sessionId], options);
    
    try {
      operation.status = 'in_progress';
      this.operationHistory.set(operation.id, operation);

      const originalSession = await this.sessionService.getSession(sessionId);
      if (!originalSession) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create snapshot for undo
      await this.createUndoSnapshot(operation.id, 'reopen', [originalSession]);

      let newSession: Session;
      
      if (options.newWorkflow) {
        // Create entirely new session from the original request
        const newRequest: SessionRequest = {
          ...originalSession.request,
          id: uuidv4(),
          sessionId: '', // Will be set after session creation
          timestamp: new Date().toISOString()
        };

        const newMetadata: SessionMetadata = {
          ...originalSession.metadata,
          originalSessionId: originalSession.id,
          reopenedAt: new Date().toISOString(),
          reopenType: 'new_workflow',
          retryCount: 0
        };

        newSession = await this.sessionService.createSession(newRequest, newMetadata);
      } else {
        // Reset existing session
        const updates: Partial<Session> = {
          status: options.resetStatus ? 'pending' : originalSession.status,
          error: undefined,
          completedAt: undefined,
          metadata: {
            ...originalSession.metadata,
            reopenedAt: new Date().toISOString(),
            reopenType: 'reset',
            retryCount: (originalSession.metadata.retryCount || 0) + 1
          }
        };

        if (!options.preserveInstructions) {
          updates.instructions = undefined;
        }

        if (!options.preserveResults) {
          updates.result = undefined;
        }

        newSession = await this.sessionService.updateSession(sessionId, updates);
      }

      operation.status = 'completed';
      operation.result = { newSessionId: newSession.id };
      this.operationHistory.set(operation.id, operation);

      this.logger.info(`Session ${sessionId} reopened successfully`, { 
        newSessionId: newSession.id, 
        options 
      });

      return newSession;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.set(operation.id, operation);
      
      this.logger.error(`Failed to reopen session ${sessionId}`, error as Error);
      throw error;
    }
  }

  // Session Duplicate Operations
  async duplicateSession(sessionId: string, options: DuplicateOptions = {}): Promise<Session> {
    const operation = this.createOperation('duplicate', [sessionId], options);
    
    try {
      operation.status = 'in_progress';
      this.operationHistory.set(operation.id, operation);

      const originalSession = await this.sessionService.getSession(sessionId);
      if (!originalSession) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const newRequest: SessionRequest = {
        ...originalSession.request,
        id: uuidv4(),
        sessionId: '', // Will be set after session creation
        content: options.modifications?.content || originalSession.request.content,
        timestamp: new Date().toISOString()
      };

      const baseName = options.modifications?.name || originalSession.name;
      const namePrefix = options.namePrefix || 'Copy of ';
      
      const newMetadata: SessionMetadata = {
        ...(options.preserveMetadata ? originalSession.metadata : {}),
        ...options.modifications?.metadata,
        originalSessionId: originalSession.id,
        duplicatedAt: new Date().toISOString(),
        name: baseName.startsWith(namePrefix) ? baseName : `${namePrefix}${baseName}`,
        description: options.modifications?.description || `${originalSession.description} (Copy)`,
        retryCount: 0
      };

      const duplicatedSession = await this.sessionService.createSession(newRequest, newMetadata);

      operation.status = 'completed';
      operation.result = { duplicatedSessionId: duplicatedSession.id };
      this.operationHistory.set(operation.id, operation);

      this.logger.info(`Session ${sessionId} duplicated successfully`, { 
        duplicatedSessionId: duplicatedSession.id 
      });

      return duplicatedSession;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.set(operation.id, operation);
      
      this.logger.error(`Failed to duplicate session ${sessionId}`, error as Error);
      throw error;
    }
  }

  // Session Archive Operations
  async archiveSession(sessionId: string): Promise<void> {
    const operation = this.createOperation('archive', [sessionId]);
    
    try {
      operation.status = 'in_progress';
      this.operationHistory.set(operation.id, operation);

      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create snapshot for undo
      await this.createUndoSnapshot(operation.id, 'archive', [session]);

      const updates: Partial<Session> = {
        metadata: {
          ...session.metadata,
          archived: true,
          archivedAt: new Date().toISOString()
        }
      };

      await this.sessionService.updateSession(sessionId, updates);

      operation.status = 'completed';
      this.operationHistory.set(operation.id, operation);

      this.logger.info(`Session ${sessionId} archived successfully`);
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.set(operation.id, operation);
      
      this.logger.error(`Failed to archive session ${sessionId}`, error as Error);
      throw error;
    }
  }

  // Session Delete Operations
  async deleteSession(sessionId: string): Promise<void> {
    const operation = this.createOperation('delete', [sessionId]);
    
    try {
      operation.status = 'in_progress';
      this.operationHistory.set(operation.id, operation);

      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create snapshot for undo
      await this.createUndoSnapshot(operation.id, 'delete', [session]);

      await this.sessionService.deleteSession(sessionId);

      operation.status = 'completed';
      this.operationHistory.set(operation.id, operation);

      this.logger.info(`Session ${sessionId} deleted successfully`);
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.set(operation.id, operation);
      
      this.logger.error(`Failed to delete session ${sessionId}`, error as Error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkArchive(
    sessionIds: string[], 
    progressCallback?: (progress: BulkOperationProgress) => void
  ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
    return this.executeBulkOperation('bulk_archive', sessionIds, progressCallback, async (sessionId) => {
      await this.archiveSession(sessionId);
    });
  }

  async bulkDelete(
    sessionIds: string[], 
    progressCallback?: (progress: BulkOperationProgress) => void
  ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
    return this.executeBulkOperation('bulk_delete', sessionIds, progressCallback, async (sessionId) => {
      await this.deleteSession(sessionId);
    });
  }

  async bulkExport(
    sessionIds: string[], 
    progressCallback?: (progress: BulkOperationProgress) => void
  ): Promise<{ succeeded: Array<{ id: string; data: string }>; failed: Array<{ id: string; error: string }> }> {
    const operation = this.createOperation('bulk_export', sessionIds);
    const succeeded: Array<{ id: string; data: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    try {
      operation.status = 'in_progress';
      this.operationHistory.set(operation.id, operation);

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];
        if (!sessionId) continue;
        
        progressCallback?.({
          total: sessionIds.length,
          completed: succeeded.length,
          failed: failed.length,
          inProgress: 1,
          currentItem: sessionId
        });

        try {
          const exportData = await this.sessionService.exportSession(sessionId);
          succeeded.push({ id: sessionId, data: exportData || '' });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({ id: sessionId, error: errorMessage });
        }
      }

      operation.status = 'completed';
      operation.result = { succeeded: succeeded.length, failed: failed.length };
      this.operationHistory.set(operation.id, operation);

      progressCallback?.({
        total: sessionIds.length,
        completed: succeeded.length,
        failed: failed.length,
        inProgress: 0
      });

      return { succeeded, failed };
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      this.operationHistory.set(operation.id, operation);
      throw error;
    }
  }

  // Undo Operations
  async undoOperation(operationId: string): Promise<void> {
    const undoData = this.undoHistory.get(operationId);
    if (!undoData) {
      throw new Error(`No undo data found for operation ${operationId}`);
    }

    if (undoData.expired) {
      throw new Error('Undo operation has expired');
    }

    if (!undoData.undoable) {
      throw new Error('This operation cannot be undone');
    }

    try {
      switch (undoData.type) {
        case 'archive':
          // Restore archived sessions
          for (const session of undoData.sessionSnapshots) {
            const updates: Partial<Session> = {
              metadata: {
                ...session.metadata,
                archived: false,
                archivedAt: undefined
              }
            };
            await this.sessionService.updateSession(session.id, updates);
          }
          break;

        case 'delete':
          // Recreate deleted sessions
          for (const session of undoData.sessionSnapshots) {
            await this.sessionService.createSession(session.request, session.metadata);
          }
          break;

        case 'reopen':
          // This is more complex and might not always be possible
          // For now, we'll just log that it's not supported
          throw new Error('Undo for reopen operations is not currently supported');

        default:
          throw new Error(`Undo not supported for operation type: ${undoData.type}`);
      }

      // Mark as used (expired)
      undoData.expired = true;
      this.undoHistory.set(operationId, undoData);

      this.logger.info(`Undo operation ${operationId} completed successfully`);
    } catch (error) {
      this.logger.error(`Failed to undo operation ${operationId}`, error as Error);
      throw error;
    }
  }

  // Utility Methods
  getOperationHistory(): SessionOperation[] {
    return Array.from(this.operationHistory.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getUndoableOperations(): UndoableOperation[] {
    return Array.from(this.undoHistory.values())
      .filter(op => op.undoable && !op.expired)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private async executeBulkOperation(
    type: SessionOperation['type'],
    sessionIds: string[],
    progressCallback?: (progress: BulkOperationProgress) => void,
    operation?: (sessionId: string) => Promise<void>
  ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
    const operationRecord = this.createOperation(type, sessionIds);
    const succeeded: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    try {
      operationRecord.status = 'in_progress';
      this.operationHistory.set(operationRecord.id, operationRecord);

      // Get snapshots for undo
      const sessions = await Promise.all(
        sessionIds.map(id => this.sessionService.getSession(id))
      );
      const validSessions = sessions.filter((s): s is Session => s !== null);
      await this.createUndoSnapshot(operationRecord.id, type, validSessions);

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];
        if (!sessionId) continue;
        
        progressCallback?.({
          total: sessionIds.length,
          completed: succeeded.length,
          failed: failed.length,
          inProgress: 1,
          currentItem: sessionId
        });

        try {
          if (operation) {
            await operation(sessionId);
          }
          succeeded.push(sessionId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({ id: sessionId, error: errorMessage });
        }
      }

      operationRecord.status = 'completed';
      operationRecord.result = { succeeded: succeeded.length, failed: failed.length };
      this.operationHistory.set(operationRecord.id, operationRecord);

      progressCallback?.({
        total: sessionIds.length,
        completed: succeeded.length,
        failed: failed.length,
        inProgress: 0
      });

      return { succeeded, failed };
    } catch (error) {
      operationRecord.status = 'failed';
      operationRecord.error = error instanceof Error ? error.message : 'Unknown error';
      this.operationHistory.set(operationRecord.id, operationRecord);
      throw error;
    }
  }

  private createOperation(
    type: SessionOperation['type'], 
    sessionIds: string[], 
    parameters?: Record<string, any>
  ): SessionOperation {
    return {
      id: uuidv4(),
      type,
      sessionIds,
      timestamp: new Date().toISOString(),
      userId: 'current-user', // TODO: Get from auth context
      parameters,
      status: 'pending'
    };
  }

  private async createUndoSnapshot(
    operationId: string,
    type: SessionOperation['type'],
    sessions: Session[]
  ): Promise<void> {
    const undoData: UndoableOperation = {
      operationId,
      type,
      sessionSnapshots: sessions,
      timestamp: new Date().toISOString(),
      undoable: ['archive', 'delete'].includes(type),
      expired: false
    };

    this.undoHistory.set(operationId, undoData);

    // Set expiration timer
    setTimeout(() => {
      const existing = this.undoHistory.get(operationId);
      if (existing) {
        existing.expired = true;
        this.undoHistory.set(operationId, existing);
      }
    }, this.UNDO_TIMEOUT);
  }

  private cleanupExpiredUndos(): void {
    // Clean up expired undo operations every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [operationId, undoData] of this.undoHistory.entries()) {
        const operationTime = new Date(undoData.timestamp).getTime();
        if (now - operationTime > this.UNDO_TIMEOUT) {
          this.undoHistory.delete(operationId);
        }
      }
    }, 5 * 60 * 1000);
  }
}