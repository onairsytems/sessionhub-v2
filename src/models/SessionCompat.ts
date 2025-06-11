import { BaseProjectContext } from './ProjectContext';
import { ExecutionResult } from './ExecutionResult';

export interface SessionData {
  title: string;
  objectives: string;
  projectContext: BaseProjectContext;
}

export interface PlanningResult {
  instructions: any[];
  strategy: string;
  estimatedTime: number;
}

export class Session {
  id: string;
  title: string;
  objectives: string;
  projectContext: BaseProjectContext;
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  planningResult?: PlanningResult;
  executionResults: ExecutionResult[] = [];
  actorInteractions: any[] = [];
  duration?: number;
  projectsAffected?: string[];

  constructor(data: SessionData) {
    if (!data.title) throw new Error('Title is required');
    if (!data.objectives) throw new Error('Objectives are required');
    if (!data.projectContext) throw new Error('Project context is required');
    if (data.title.length > 255) throw new Error('Title must be less than 255 characters');

    this.id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.title = data.title;
    this.objectives = data.objectives;
    this.projectContext = data.projectContext;
    this.status = 'draft';
    this.createdAt = new Date();
    this.executionResults = [];
    this.actorInteractions = [];
  }

  canTransitionTo(newStatus: string): boolean {
    if (this.status === 'draft' && newStatus === 'active') return true;
    if (this.status === 'active' && newStatus === 'completed') return true;
    if (this.status === 'completed') return false;
    return false;
  }

  transitionTo(newStatus: 'active' | 'completed'): void {
    if (this.status === 'completed') {
      throw new Error('Cannot transition from completed state');
    }

    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;

    if (newStatus === 'active') {
      this.startedAt = new Date();
    } else if (newStatus === 'completed') {
      this.completedAt = new Date();
    }
  }

  addPlanningResult(result: PlanningResult): void {
    if (this.status === 'completed') {
      throw new Error('Cannot modify completed session');
    }
    if (this.status !== 'active') {
      throw new Error('Session must be active to add planning');
    }

    this.planningResult = result;
  }

  addExecutionResult(result: ExecutionResult): void {
    if (this.status === 'completed') {
      throw new Error('Cannot modify completed session');
    }
    if (!this.planningResult) {
      throw new Error('Cannot execute without planning');
    }

    this.executionResults.push(result);
  }

  getDuration(): number | null {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  getSuccessRate(): number {
    if (this.executionResults.length === 0) {
      return 0;
    }
    const successful = this.executionResults.filter(r => r.success).length;
    return Math.round((successful / this.executionResults.length) * 100 * 100) / 100;
  }

  getTestStatistics(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
  } {
    const totalTests = this.executionResults.reduce((sum, r) => sum + (r.testsRun || 0), 0);
    const passedTests = this.executionResults.reduce((sum, r) => sum + (r.testsPassed || 0), 0);
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100 * 100) / 100 : 0;

    return { totalTests, passedTests, failedTests, passRate };
  }

  toJSON(): any {
    return {
      id: this.id,
      title: this.title,
      objectives: this.objectives,
      status: this.status,
      projectContext: this.projectContext,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      planningResult: this.planningResult,
      executionResults: this.executionResults,
      actorInteractions: this.actorInteractions
    };
  }

  static fromJSON(json: any): Session {
    const session = new Session({
      title: json.title,
      objectives: json.objectives,
      projectContext: json.projectContext
    });

    session.id = json.id;
    session.status = json.status;
    session.createdAt = new Date(json.createdAt);
    if (json.startedAt) session.startedAt = new Date(json.startedAt);
    if (json.completedAt) session.completedAt = new Date(json.completedAt);
    if (json.planningResult) session.planningResult = json.planningResult;
    session.executionResults = json.executionResults || [];
    session.actorInteractions = json.actorInteractions || [];

    return session;
  }
}