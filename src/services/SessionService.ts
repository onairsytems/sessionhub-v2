import { Session, SessionRequest, SessionMetadata } from '@/src/models/Session';
import { ExecutionResult } from '@/src/models/ExecutionResult';
import { InstructionProtocol } from '@/src/models/Instruction';
import { DatabaseService } from '@/src/database/DatabaseService';
import { Logger } from '@/src/lib/logging/Logger';

class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export interface SessionFilter {
  status?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  tags?: string[];
  search?: string;
}

export interface SessionTemplate {
  name: string;
  description: string;
  instructions: any[];
}

export interface SessionAnalytics {
  totalSessions: number;
  completedSessions: number;
  averageDuration: number;
  successRate: number;
  sessionsByDay: Array<{ date: string; count: number }>;
  sessionsByStatus: Record<string, number>;
  performanceMetrics: {
    avgExecutionTime: number;
    avgPlanningTime: number;
    totalExecutionTime: number;
    totalPlanningTime: number;
  };
  commonErrors: Array<{ error: string; count: number }>;
}

export class SessionService {
  private static instance: SessionService;
  private db: DatabaseService;
  private logger: Logger;

  private constructor() {
    this.db = new DatabaseService();
    this.logger = new Logger({ component: 'SessionService' });
  }

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  async createSession(request: SessionRequest, metadata: SessionMetadata): Promise<Session> {
    try {
      const session: Session = {
        id: this.generateSessionId(),
        name: request.content.substring(0, 50) + '...', // Extract name from content
        description: request.content,
        objective: request.content,
        status: 'planning' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: request.userId,
        projectId: (metadata as any)['projectId'] || 'default',
        request,
        metadata
      };

      await this.db.sessions.create(session);
      this.logger.info('Session created', { sessionId: session.id });
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error as Error);
      throw new SessionError('Failed to create session');
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.db.sessions.findById(sessionId);
    } catch (error) {
      this.logger.error('Failed to get session', error as Error);
      throw new SessionError('Failed to get session');
    }
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new SessionError('Session not found');
      }

      const updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.db.sessions.update(session.id, updatedSession);
      this.logger.info('Session updated', { sessionId: session.id });
      return updatedSession;
    } catch (error) {
      this.logger.error('Failed to update session', error as Error);
      throw new SessionError('Failed to update session');
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.db.sessions.delete(sessionId);
      this.logger.info('Session deleted', { sessionId });
    } catch (error) {
      this.logger.error('Failed to delete session', error as Error);
      throw new SessionError('Failed to delete session');
    }
  }

  async listSessions(_filter?: SessionFilter): Promise<Session[]> {
    try {
      return await this.db.sessions.findAll();
    } catch (error) {
      this.logger.error('Failed to list sessions', error as Error);
      throw new SessionError('Failed to list sessions');
    }
  }

  async exportSession(sessionId: string, format: 'json' | 'md' = 'json'): Promise<string> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new SessionError('Session not found');
      }

      if (format === 'json') {
        return JSON.stringify(session, null, 2);
      } else {
        return this.formatSessionAsMarkdown(session);
      }
    } catch (error) {
      this.logger.error('Failed to export session', error as Error);
      throw new SessionError('Failed to export session');
    }
  }

  async executeInstruction(sessionId: string, instruction: InstructionProtocol): Promise<ExecutionResult> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new SessionError('Session not found');
      }

      // Implementation would connect to execution engine
      const result: ExecutionResult = {
        sessionId: session.id,
        instructionId: instruction.metadata.id,
        status: 'success',
        output: 'Instruction executed successfully',
        startTime: new Date().toISOString()
      };

      return result;
    } catch (error) {
      this.logger.error('Failed to execute instruction', error as Error);
      throw new SessionError('Failed to execute instruction');
    }
  }

  async getAnalytics(): Promise<SessionAnalytics> {
    try {
      const sessions = await this.db.sessions.findAll();
      const completed = sessions.filter(s => s.status === 'completed');
      
      // Group sessions by day
      const sessionsByDay = sessions.reduce((acc: Record<string, number>, session) => {
        const date = new Date(session.createdAt).toISOString().split('T')[0];
        if (date) {
          if (!acc[date]) acc[date] = 0;
          acc[date]++;
        }
        return acc;
      }, {} as Record<string, number>);
      
      // Group by status
      const sessionsByStatus = sessions.reduce((acc, session) => {
        const status = session.status;
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        averageDuration: this.calculateAverageDuration(completed),
        successRate: sessions.length > 0 ? completed.length / sessions.length : 0,
        sessionsByDay: Object.entries(sessionsByDay).map(([date, count]) => ({ date, count })),
        sessionsByStatus,
        performanceMetrics: {
          avgExecutionTime: 0,
          avgPlanningTime: 0,
          totalExecutionTime: 0,
          totalPlanningTime: 0
        },
        commonErrors: []
      };
    } catch (error) {
      this.logger.error('Failed to get analytics', error as Error);
      throw new SessionError('Failed to get analytics');
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // private generateResultId(): string {
  //   return `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // }

  private formatSessionAsMarkdown(session: Session): string {
    return `# Session: ${session.name}

## Metadata
- ID: ${session.id}
- Status: ${session.status}
- Created: ${session.createdAt}
- Updated: ${session.updatedAt}

## Instructions
${session.instructions && Array.isArray(session.instructions) ? session.instructions.map((i: any) => `- ${i.description}`).join('\n') : 'No instructions'}
`;
  }

  private calculateAverageDuration(sessions: Session[]): number {
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => {
      if (session.completedAt && session.createdAt) {
        const completedAt = new Date(session.completedAt);
        const createdAt = new Date(session.createdAt);
        return sum + (completedAt.getTime() - createdAt.getTime());
      }
      return sum;
    }, 0);
    
    return totalDuration / sessions.length;
  }

  async searchSessions(_filter: SessionFilter): Promise<Session[]> {
    try {
      const sessions = await this.db.sessions.findAll();
      
      return sessions.filter(session => {
        if (_filter.status && session.status !== _filter.status) return false;
        if (_filter.createdAfter && new Date(session.createdAt) < _filter.createdAfter) return false;
        if (_filter.createdBefore && new Date(session.createdAt) > _filter.createdBefore) return false;
        return true;
      });
    } catch (error) {
      this.logger.error('Failed to search sessions', error as Error);
      throw new SessionError('Failed to search sessions');
    }
  }

  async createTemplate(_name: string,_description: string,_content: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async getTemplates(): Promise<any[]> {
    throw new Error('Method not implemented');
  }

  async createSessionFromTemplate(_templateId: string,_data: any): Promise<Session> {
    throw new Error('Method not implemented');
  }

  async importSession(_data: any): Promise<Session> {
    throw new Error('Method not implemented');
  }

  async handoffToPlanningActor(_sessionId: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async handoffToExecutionActor(_sessionId: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async completeSession(sessionId: string): Promise<Session> {
    return this.updateSession(sessionId, { status: 'completed', completedAt: new Date().toISOString() });
  }

  async failSession(sessionId: string, error: string): Promise<Session> {
    return this.updateSession(sessionId, { status: 'failed', error: error as any });
  }

  async getRecentSessions(limit: number = 10): Promise<Session[]> {
    try {
      const sessions = await this.db.sessions.findAll();
      return sessions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get recent sessions', error as Error);
      throw new SessionError('Failed to get recent sessions');
    }
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const sessions = await this.db.sessions.findAll();
      return sessions.filter(session => session.metadata?.userId === userId);
    } catch (error) {
      this.logger.error('Failed to get user sessions', error as Error);
      throw new SessionError('Failed to get user sessions');
    }
  }
}

export default SessionService;