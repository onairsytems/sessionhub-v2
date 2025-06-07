/**
 * @actor system
 * @responsibility Manages session state persistence across actor interactions
 */

import { Logger } from '@/src/lib/logging/Logger';
import { InstructionProtocol, ExecutionResult } from '@/src/models/Instruction';
import { UserRequest } from '../planning/PlanningEngine';
import { SupabaseService } from '@/src/services/cloud/SupabaseService';
import { v4 as uuidv4 } from 'uuid';

export interface SessionState {
  id: string;
  sessionId: string;
  created: string;
  updated: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  context: SessionContext;
  history: SessionHistoryEntry[];
  metadata: Record<string, any>;
}

export interface SessionContext {
  projectPath: string;
  projectType: string;
  language: string;
  framework?: string;
  environment: Record<string, string>;
  userPreferences: Record<string, any>;
  apiKeys?: {
    claudeChatConfigured: boolean;
    claudeCodeConfigured: boolean;
  };
}

export interface SessionHistoryEntry {
  id: string;
  timestamp: string;
  type: 'request' | 'instruction' | 'execution' | 'error';
  actor: 'user' | 'planning' | 'execution' | 'system';
  data: any;
  parentId?: string;
}

export interface SessionPersistence {
  local: boolean;
  cloud: boolean;
  realtime: boolean;
}

export class SessionStateManager {
  private readonly logger: Logger;
  private readonly sessions: Map<string, SessionState> = new Map();
  private readonly supabaseService?: SupabaseService;
  private readonly persistence: SessionPersistence;
  private readonly maxHistoryEntries = 1000;
  
  constructor(
    logger: Logger,
    supabaseService?: SupabaseService,
    persistence?: SessionPersistence
  ) {
    this.logger = logger;
    this.supabaseService = supabaseService;
    this.persistence = persistence || {
      local: true,
      cloud: !!supabaseService,
      realtime: false
    };
  }

  /**
   * Create a new session state
   */
  async createSession(
    sessionId: string,
    context: SessionContext
  ): Promise<SessionState> {
    const session: SessionState = {
      id: uuidv4(),
      sessionId,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      status: 'active',
      context,
      history: [],
      metadata: {}
    };

    this.sessions.set(sessionId, session);

    // Persist to cloud if enabled
    if (this.persistence.cloud && this.supabaseService) {
      await this.persistToCloud(session);
    }

    this.logger.info('Session state created', {
      sessionId,
      projectType: context.projectType
    });

    return session;
  }

  /**
   * Get session state
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    // Check local cache first
    let session = this.sessions.get(sessionId);
    
    if (!session && this.persistence.cloud && this.supabaseService) {
      // Try to load from cloud
      session = await this.loadFromCloud(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

    return session || null;
  }

  /**
   * Update session context
   */
  async updateContext(
    sessionId: string,
    updates: Partial<SessionContext>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.context = {
      ...session.context,
      ...updates
    };
    session.updated = new Date().toISOString();

    await this.persistSession(session);
  }

  /**
   * Add entry to session history
   */
  async addHistoryEntry(
    sessionId: string,
    entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>
  ): Promise<SessionHistoryEntry> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const historyEntry: SessionHistoryEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };

    session.history.push(historyEntry);
    session.updated = new Date().toISOString();

    // Trim history if too long
    if (session.history.length > this.maxHistoryEntries) {
      session.history = session.history.slice(-this.maxHistoryEntries);
    }

    await this.persistSession(session);

    return historyEntry;
  }

  /**
   * Record user request
   */
  async recordUserRequest(
    sessionId: string,
    request: UserRequest
  ): Promise<void> {
    await this.addHistoryEntry(sessionId, {
      type: 'request',
      actor: 'user',
      data: request
    });
  }

  /**
   * Record generated instructions
   */
  async recordInstructions(
    sessionId: string,
    instructions: InstructionProtocol,
    requestId: string
  ): Promise<void> {
    await this.addHistoryEntry(sessionId, {
      type: 'instruction',
      actor: 'planning',
      data: instructions,
      parentId: requestId
    });
  }

  /**
   * Record execution result
   */
  async recordExecutionResult(
    sessionId: string,
    result: ExecutionResult,
    instructionId: string
  ): Promise<void> {
    await this.addHistoryEntry(sessionId, {
      type: 'execution',
      actor: 'execution',
      data: result,
      parentId: instructionId
    });
  }

  /**
   * Record error
   */
  async recordError(
    sessionId: string,
    error: Error,
    actor: SessionHistoryEntry['actor'],
    parentId?: string
  ): Promise<void> {
    await this.addHistoryEntry(sessionId, {
      type: 'error',
      actor,
      data: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      parentId
    });
  }

  /**
   * Get session history
   */
  async getHistory(
    sessionId: string,
    filter?: {
      type?: SessionHistoryEntry['type'];
      actor?: SessionHistoryEntry['actor'];
      since?: string;
      limit?: number;
    }
  ): Promise<SessionHistoryEntry[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    let history = [...session.history];

    if (filter) {
      if (filter.type) {
        history = history.filter(h => h.type === filter.type);
      }
      if (filter.actor) {
        history = history.filter(h => h.actor === filter.actor);
      }
      if (filter.since) {
        const sinceTime = new Date(filter.since).getTime();
        history = history.filter(h => new Date(h.timestamp).getTime() > sinceTime);
      }
      if (filter.limit) {
        history = history.slice(-filter.limit);
      }
    }

    return history;
  }

  /**
   * Get latest state for actor
   */
  async getLatestActorState(
    sessionId: string,
    actor: 'planning' | 'execution'
  ): Promise<any | null> {
    const history = await this.getHistory(sessionId, {
      actor,
      limit: 1
    });

    return history.length > 0 ? history[0].data : null;
  }

  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string,
    status: SessionState['status']
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    session.updated = new Date().toISOString();

    await this.persistSession(session);
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<SessionState[]> {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active');

    if (this.persistence.cloud && this.supabaseService) {
      // Also fetch from cloud
      const cloudSessions = await this.fetchActiveSessionsFromCloud();
      
      // Merge with local, avoiding duplicates
      const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));
      cloudSessions.forEach(s => {
        if (!sessionMap.has(s.sessionId)) {
          sessionMap.set(s.sessionId, s);
        }
      });

      return Array.from(sessionMap.values());
    }

    return sessions;
  }

  /**
   * Export session data
   */
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session data
   */
  async importSession(sessionData: string): Promise<SessionState> {
    const session = JSON.parse(sessionData) as SessionState;
    
    // Generate new IDs to avoid conflicts
    session.id = uuidv4();
    session.history.forEach(entry => {
      entry.id = uuidv4();
    });

    this.sessions.set(session.sessionId, session);
    await this.persistSession(session);

    return session;
  }

  /**
   * Clean up old sessions
   */
  async cleanup(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (new Date(session.updated) < cutoffDate && session.status !== 'active') {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (this.persistence.cloud && this.supabaseService) {
      // Also clean up cloud storage
      await this.cleanupCloudSessions(cutoffDate);
    }

    this.logger.info('Cleaned up old sessions', { count: cleaned });
    return cleaned;
  }

  private async persistSession(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionId, session);

    if (this.persistence.cloud && this.supabaseService) {
      await this.persistToCloud(session);
    }
  }

  private async persistToCloud(session: SessionState): Promise<void> {
    try {
      await this.supabaseService!.upsertSessionState(session);
    } catch (error) {
      this.logger.error('Failed to persist session to cloud', error as Error);
    }
  }

  private async loadFromCloud(sessionId: string): Promise<SessionState | null> {
    try {
      return await this.supabaseService!.getSessionState(sessionId);
    } catch (error) {
      this.logger.error('Failed to load session from cloud', error as Error);
      return null;
    }
  }

  private async fetchActiveSessionsFromCloud(): Promise<SessionState[]> {
    try {
      return await this.supabaseService!.getActiveSessions();
    } catch (error) {
      this.logger.error('Failed to fetch active sessions from cloud', error as Error);
      return [];
    }
  }

  private async cleanupCloudSessions(cutoffDate: Date): Promise<void> {
    try {
      await this.supabaseService!.cleanupOldSessions(cutoffDate);
    } catch (error) {
      this.logger.error('Failed to cleanup cloud sessions', error as Error);
    }
  }
}