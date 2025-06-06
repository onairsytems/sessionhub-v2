/**
 * @actor system
 * @responsibility Manages session lifecycle and state
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { InstructionProtocol } from '@/src/models/Instruction';

export interface Session {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  userId: string;
  projectId: string;
  request?: UserRequest;
  instructions?: InstructionProtocol;
  result?: ExecutionResult;
  error?: string;
  metadata: Record<string, any>;
}

export interface UserRequest {
  id: string;
  sessionId: string;
  userId: string;
  request: string;
  context: Record<string, any>;
  timestamp: string;
}

export interface ExecutionResult {
  sessionId: string;
  status: 'success' | 'partial' | 'failure';
  deliverables: Array<{
    type: string;
    path: string;
    status: 'created' | 'modified' | 'failed';
  }>;
  logs: string[];
  errors: string[];
  metrics: {
    duration: number;
    tasksCompleted: number;
    tasksFailed: number;
  };
}

export class SessionManager {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly sessions: Map<string, Session> = new Map();
  private readonly activeSessions: Set<string> = new Set();
  private readonly maxConcurrentSessions: number = 5;

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
  }

  /**
   * Create a new session
   */
  async createSession(
    request: Omit<UserRequest, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<Session> {
    const sessionId = this.generateSessionId();
    const session: Session = {
      id: sessionId,
      name: `Session ${new Date().toISOString()}`,
      description: request.request.substring(0, 100),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: request.userId,
      projectId: request.context.projectId || 'default',
      request: {
        ...request,
        id: this.generateRequestId(),
        sessionId,
        timestamp: new Date().toISOString()
      },
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    
    this.logger.info('Session created', {
      sessionId,
      userId: session.userId,
      projectId: session.projectId
    });

    this.auditLogger.logEvent({
      actor: {
        type: 'system',
        id: 'SessionManager'
      },
      operation: {
        type: 'session.create',
        description: 'Created new session',
        input: request
      },
      result: {
        status: 'success',
        duration: 0
      },
      metadata: {
        sessionId,
        correlationId: this.generateCorrelationId()
      }
    });

    return session;
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedSession: Session = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, updatedSession);

    // Track active sessions
    if (updates.status === 'planning' || updates.status === 'executing') {
      this.activeSessions.add(sessionId);
    } else if (updates.status === 'completed' || updates.status === 'failed') {
      this.activeSessions.delete(sessionId);
    }

    this.logger.info('Session updated', {
      sessionId,
      status: updatedSession.status,
      previousStatus: session.status
    });

    return updatedSession;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId
    );
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): Session[] {
    return Array.from(this.activeSessions).map(
      id => this.sessions.get(id)!
    ).filter(Boolean);
  }

  /**
   * Check if we can start a new session
   */
  canStartNewSession(): boolean {
    return this.activeSessions.size < this.maxConcurrentSessions;
  }

  /**
   * Complete a session
   */
  async completeSession(
    sessionId: string,
    result: ExecutionResult
  ): Promise<void> {
    await this.updateSession(sessionId, {
      status: result.status === 'success' ? 'completed' : 'failed',
      result
    });

    this.auditLogger.logEvent({
      actor: {
        type: 'system',
        id: 'SessionManager'
      },
      operation: {
        type: 'session.complete',
        description: 'Completed session',
        output: result
      },
      result: {
        status: result.status === 'success' ? 'success' : 'failure',
        duration: result.metrics.duration
      },
      metadata: {
        sessionId,
        correlationId: this.generateCorrelationId()
      }
    });
  }

  /**
   * Fail a session
   */
  async failSession(sessionId: string, error: string): Promise<void> {
    await this.updateSession(sessionId, {
      status: 'failed',
      error
    });

    this.logger.error('Session failed', new Error(error), { sessionId });
  }

  /**
   * Get session metrics
   */
  getMetrics(): any {
    const sessions = Array.from(this.sessions.values());
    
    return {
      total: sessions.length,
      active: this.activeSessions.size,
      byStatus: {
        pending: sessions.filter(s => s.status === 'pending').length,
        planning: sessions.filter(s => s.status === 'planning').length,
        executing: sessions.filter(s => s.status === 'executing').length,
        completed: sessions.filter(s => s.status === 'completed').length,
        failed: sessions.filter(s => s.status === 'failed').length
      },
      successRate: this.calculateSuccessRate(sessions),
      averageDuration: this.calculateAverageDuration(sessions)
    };
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (new Date(session.updatedAt) < cutoffDate && 
          (session.status === 'completed' || session.status === 'failed')) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    this.logger.info('Cleaned up old sessions', { count: cleaned });
    return cleaned;
  }

  private calculateSuccessRate(sessions: Session[]): number {
    const completed = sessions.filter(s => 
      s.status === 'completed' || s.status === 'failed'
    );
    
    if (completed.length === 0) return 0;
    
    const successful = completed.filter(s => s.status === 'completed');
    return (successful.length / completed.length) * 100;
  }

  private calculateAverageDuration(sessions: Session[]): number {
    const withResults = sessions.filter(s => s.result?.metrics?.duration);
    
    if (withResults.length === 0) return 0;
    
    const totalDuration = withResults.reduce(
      (sum, s) => sum + (s.result!.metrics.duration || 0), 0
    );
    
    return totalDuration / withResults.length;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export session data
   */
  exportSession(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session data
   */
  importSession(sessionData: string): Session {
    const session: Session = JSON.parse(sessionData);
    this.sessions.set(session.id, session);
    return session;
  }
}