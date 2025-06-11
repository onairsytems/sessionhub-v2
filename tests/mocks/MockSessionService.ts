import { Session, SessionData, PlanningResult } from '../../src/models/SessionCompat';
import { ExecutionResult } from '../../src/models/ExecutionResult';

export interface SessionListOptions {
  page?: number;
  limit?: number;
  status?: string;
  projectId?: string;
}

export interface SessionListResult {
  sessions: Session[];
  total: number;
  hasMore: boolean;
}

export interface SessionMetrics {
  duration: number;
  totalExecutions: number;
  successfulExecutions: number;
  filesModified: number;
  testsRun: number;
  testsPassed: number;
  testPassRate: number;
}

export class SessionService {
  private sessions: Map<string, Session> = new Map();

  async createSession(data: SessionData): Promise<Session> {
    const session = new Session(data);
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(id: string): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  async startSession(id: string): Promise<Session> {
    const session = await this.getSession(id);
    if (session.status === 'active') {
      throw new Error('Session is already active');
    }
    session.transitionTo('active');
    return session;
  }

  async completeSession(id: string): Promise<Session> {
    const session = await this.getSession(id);
    if (session.status !== 'active') {
      throw new Error('Cannot complete session that is not active');
    }
    session.transitionTo('completed');
    return session;
  }

  async addPlanningResult(id: string, result: PlanningResult): Promise<Session> {
    const session = await this.getSession(id);
    if (session.status === 'completed') {
      throw new Error('Cannot modify completed session');
    }
    session.addPlanningResult(result);
    return session;
  }

  async addExecutionResult(id: string, result: ExecutionResult): Promise<Session> {
    const session = await this.getSession(id);
    if (session.status === 'completed') {
      throw new Error('Cannot modify completed session');
    }
    if (!session.planningResult) {
      throw new Error('Cannot execute without planning result');
    }
    session.addExecutionResult(result);
    return session;
  }

  async getSessionMetrics(id: string): Promise<SessionMetrics> {
    const session = await this.getSession(id);
    const duration = session.getDuration() || 0;
    const stats = session.getTestStatistics();
    
    const filesModified = session.executionResults.reduce((sum, r) => 
      sum + (r.filesModified?.length || 0), 0
    );

    return {
      duration,
      totalExecutions: session.executionResults.length,
      successfulExecutions: session.executionResults.filter(r => r.success).length,
      filesModified,
      testsRun: stats.totalTests,
      testsPassed: stats.passedTests,
      testPassRate: stats.passRate
    };
  }

  async listSessions(options: SessionListOptions): Promise<SessionListResult> {
    const { page = 1, limit = 10, status, projectId } = options;
    
    let sessions = Array.from(this.sessions.values());
    
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }
    
    if (projectId) {
      sessions = sessions.filter(s => s.projectContext.id === projectId);
    }
    
    const total = sessions.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginated = sessions.slice(start, end);
    
    return {
      sessions: paginated,
      total,
      hasMore: end < total
    };
  }

  async deleteSession(id: string, options?: { confirm?: boolean }): Promise<void> {
    const session = await this.getSession(id);
    
    if (session.status === 'active') {
      throw new Error('Cannot delete active session');
    }
    
    if (session.status === 'completed' && !options?.confirm) {
      throw new Error('Confirmation required to delete completed session');
    }
    
    this.sessions.delete(id);
  }

  async generatePlan(sessionId: string, _objective: string): Promise<any> {
    await this.getSession(sessionId);
    return {
      instructions: [
        { id: '1', type: 'code', content: 'Create component' },
        { id: '2', type: 'test', content: 'Write tests' },
        { id: '3', type: 'docs', content: 'Update documentation' }
      ],
      strategy: 'Test-driven development',
      estimatedTime: 45
    };
  }

  async switchProject(sessionId: string, newProjectId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session.projectsAffected) {
      session.projectsAffected = [session.projectContext.id];
    }
    session.projectsAffected.push(newProjectId);
  }
}