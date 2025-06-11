/**
 * @actor system
 * @responsibility Manages multi-session workflows with dependency handling and state management
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session, SessionManager } from '@/src/core/orchestrator/SessionManager';
import { SessionSplitPlan } from './SessionSplittingEngine';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface SessionWorkflow {
  id: string;
  name: string;
  description: string;
  sessions: string[]; // Session IDs in workflow
  executionOrder: string[];
  dependencies: Map<string, string[]>;
  state: WorkflowState;
  progress: WorkflowProgress;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface WorkflowState {
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentSession: string | null;
  completedSessions: string[];
  failedSessions: string[];
  pendingSessions: string[];
  context: Record<string, any>; // Shared context between sessions
}

export interface WorkflowProgress {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // minutes
  startTime: string | null;
  endTime: string | null;
}

export interface WorkflowExecutionOptions {
  continueOnFailure: boolean;
  maxParallelSessions: number;
  retryFailedSessions: boolean;
  maxRetries: number;
  pauseBetweenSessions: number; // milliseconds
  preserveContext: boolean;
}

export interface SessionTransition {
  fromSession: string;
  toSession: string;
  context: Record<string, any>;
  outputs: any[];
  timestamp: string;
}

export class SessionOrchestrationFramework extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger; // Reserved for future audit logging
  private readonly sessionManager: SessionManager;
  private readonly workflows: Map<string, SessionWorkflow> = new Map();
  private readonly activeWorkflows: Set<string> = new Set();
  private readonly sessionTransitions: Map<string, SessionTransition[]> = new Map();
  
  private readonly DEFAULT_OPTIONS: WorkflowExecutionOptions = {
    continueOnFailure: false,
    maxParallelSessions: 1,
    retryFailedSessions: true,
    maxRetries: 2,
    pauseBetweenSessions: 1000,
    preserveContext: true
  };

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    sessionManager: SessionManager
  ) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger; // Store for future use
    
    // TODO: Add audit logging for workflow operations
    // this.auditLogger.logEvent({ ... })
    this.sessionManager = sessionManager;
  }

  /**
   * Create a workflow from a session split plan
   */
  async createWorkflowFromSplitPlan(
    splitPlan: SessionSplitPlan,
    name: string,
    description: string
  ): Promise<SessionWorkflow> {
    const workflowId = this.generateWorkflowId();
    
    const workflow: SessionWorkflow = {
      id: workflowId,
      name,
      description,
      sessions: splitPlan.splits.map(s => s.id),
      executionOrder: splitPlan.executionOrder,
      dependencies: splitPlan.dependencies,
      state: {
        status: 'pending',
        currentSession: null,
        completedSessions: [],
        failedSessions: [],
        pendingSessions: [...splitPlan.executionOrder],
        context: {}
      },
      progress: {
        totalSessions: splitPlan.totalSplits,
        completedSessions: 0,
        failedSessions: 0,
        percentComplete: 0,
        estimatedTimeRemaining: splitPlan.estimatedTotalDuration,
        startTime: null,
        endTime: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        parentSessionId: splitPlan.parentSessionId,
        optimizationNotes: splitPlan.optimizationNotes
      }
    };
    
    this.workflows.set(workflowId, workflow);
    
    this.logger.info('Created workflow from split plan', {
      workflowId,
      totalSessions: workflow.sessions.length,
      parentSessionId: splitPlan.parentSessionId
    });
    
    this.emit('workflow:created', workflow);
    
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'SessionOrchestrationFramework' },
      operation: {
        type: 'workflow.create',
        description: 'Created workflow from split plan',
        input: { workflowId, parentSessionId: splitPlan.parentSessionId }
      },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: workflowId }
    });
    
    return workflow;
  }

  /**
   * Create a custom workflow
   */
  async createCustomWorkflow(
    name: string,
    description: string,
    sessions: Array<{sessionId: string; dependencies?: string[]}>
  ): Promise<SessionWorkflow> {
    const workflowId = this.generateWorkflowId();
    const dependencies = new Map<string, string[]>();
    const executionOrder: string[] = [];
    
    // Build dependency map
    sessions.forEach(({ sessionId, dependencies: deps = [] }) => {
      dependencies.set(sessionId, deps);
    });
    
    // Calculate execution order
    const ordered = this.topologicalSort(dependencies);
    executionOrder.push(...ordered);
    
    const workflow: SessionWorkflow = {
      id: workflowId,
      name,
      description,
      sessions: sessions.map(s => s.sessionId),
      executionOrder,
      dependencies,
      state: {
        status: 'pending',
        currentSession: null,
        completedSessions: [],
        failedSessions: [],
        pendingSessions: [...executionOrder],
        context: {}
      },
      progress: {
        totalSessions: sessions.length,
        completedSessions: 0,
        failedSessions: 0,
        percentComplete: 0,
        estimatedTimeRemaining: sessions.length * 20, // Default estimate
        startTime: null,
        endTime: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        isCustomWorkflow: true
      }
    };
    
    this.workflows.set(workflowId, workflow);
    
    this.logger.info('Created custom workflow', {
      workflowId,
      totalSessions: workflow.sessions.length
    });
    
    this.emit('workflow:created', workflow);
    
    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    options: Partial<WorkflowExecutionOptions> = {}
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    if (this.activeWorkflows.has(workflowId)) {
      throw new Error(`Workflow already executing: ${workflowId}`);
    }
    
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    this.activeWorkflows.add(workflowId);
    workflow.state.status = 'running';
    workflow.progress.startTime = new Date().toISOString();
    
    this.logger.info('Starting workflow execution', {
      workflowId,
      totalSessions: workflow.sessions.length
    });
    
    this.emit('workflow:started', workflow);
    
    try {
      await this.executeWorkflowSessions(workflow, opts);
      
      workflow.state.status = 'completed';
      workflow.progress.endTime = new Date().toISOString();
      
      this.logger.info('Workflow completed successfully', {
        workflowId,
        duration: this.calculateDuration(workflow.progress.startTime!, workflow.progress.endTime)
      });
      
      this.emit('workflow:completed', workflow);
    } catch (error) {
      workflow.state.status = 'failed';
      workflow.progress.endTime = new Date().toISOString();
      
      this.logger.error('Workflow execution failed', error as Error, { workflowId });
      
      this.emit('workflow:failed', { workflow, error });
      
      throw error;
    } finally {
      this.activeWorkflows.delete(workflowId);
      await this.updateWorkflow(workflowId, workflow);
    }
  }

  /**
   * Execute workflow sessions
   */
  private async executeWorkflowSessions(
    workflow: SessionWorkflow,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const { executionOrder, dependencies } = workflow;
    
    for (const sessionId of executionOrder) {
      // Check if workflow was cancelled
      if (workflow.state.status === 'cancelled') {
        throw new Error('Workflow cancelled');
      }
      
      // Check if workflow is paused
      while (workflow.state.status === 'paused') {
        await this.delay(1000);
      }
      
      // Check dependencies
      const sessionDeps = dependencies.get(sessionId) || [];
      const depsReady = sessionDeps.every(dep => 
        workflow.state.completedSessions.includes(dep)
      );
      
      if (!depsReady) {
        if (options.continueOnFailure) {
          this.logger.warn('Skipping session due to unmet dependencies', {
            sessionId,
            missingDeps: sessionDeps.filter(dep => !workflow.state.completedSessions.includes(dep))
          });
          continue;
        } else {
          throw new Error(`Dependencies not met for session: ${sessionId}`);
        }
      }
      
      // Execute session
      try {
        workflow.state.currentSession = sessionId;
        this.emit('session:starting', { workflow, sessionId });
        
        await this.executeSession(sessionId, workflow, options);
        
        workflow.state.completedSessions.push(sessionId);
        workflow.state.pendingSessions = workflow.state.pendingSessions.filter(id => id !== sessionId);
        workflow.progress.completedSessions++;
        workflow.progress.percentComplete = 
          (workflow.progress.completedSessions / workflow.progress.totalSessions) * 100;
        
        this.emit('session:completed', { workflow, sessionId });
        
        // Pause between sessions if configured
        if (options.pauseBetweenSessions > 0) {
          await this.delay(options.pauseBetweenSessions);
        }
      } catch (error) {
        workflow.state.failedSessions.push(sessionId);
        workflow.progress.failedSessions++;
        
        this.emit('session:failed', { workflow, sessionId, error });
        
        if (!options.continueOnFailure) {
          throw error;
        }
        
        // Retry if configured
        if (options.retryFailedSessions && options.maxRetries > 0) {
          await this.retrySession(sessionId, workflow, options);
        }
      }
      
      // Update progress
      await this.updateWorkflow(workflow.id, workflow);
      this.emit('workflow:progress', workflow);
    }
  }

  /**
   * Execute a single session
   */
  private async executeSession(
    sessionId: string,
    workflow: SessionWorkflow,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    // Get session context from previous transitions
    const context = this.buildSessionContext(sessionId, workflow, options);
    
    // Update session with workflow context
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.request) {
      session.request.context = {
        ...session.request.context,
        workflowContext: context
      };
    }
    
    // Mark session as executing
    await this.sessionManager.updateSession(sessionId, {
      status: 'planning',
      metadata: {
        ...session.metadata,
        workflowId: workflow.id,
        workflowContext: context
      }
    });
    
    // Wait for session to complete (this would integrate with actual execution)
    // For now, we'll simulate execution
    await this.simulateSessionExecution(session);
    
    // Record transition
    const transition: SessionTransition = {
      fromSession: workflow.state.currentSession || 'start',
      toSession: sessionId,
      context: context,
      outputs: [], // Would be populated from actual execution
      timestamp: new Date().toISOString()
    };
    
    if (!this.sessionTransitions.has(workflow.id)) {
      this.sessionTransitions.set(workflow.id, []);
    }
    this.sessionTransitions.get(workflow.id)!.push(transition);
  }

  /**
   * Retry a failed session
   */
  private async retrySession(
    sessionId: string,
    workflow: SessionWorkflow,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    let retries = 0;
    
    while (retries < options.maxRetries) {
      try {
        this.logger.info('Retrying failed session', {
          sessionId,
          attempt: retries + 1,
          maxRetries: options.maxRetries
        });
        
        await this.executeSession(sessionId, workflow, options);
        
        // Remove from failed and add to completed
        workflow.state.failedSessions = workflow.state.failedSessions.filter(id => id !== sessionId);
        workflow.state.completedSessions.push(sessionId);
        workflow.progress.failedSessions--;
        workflow.progress.completedSessions++;
        
        return;
      } catch (error) {
        retries++;
        if (retries >= options.maxRetries) {
          this.logger.error('Max retries exceeded for session', error as Error, {
            sessionId,
            retries
          });
        }
      }
    }
  }

  /**
   * Build context for session execution
   */
  private buildSessionContext(
    sessionId: string,
    workflow: SessionWorkflow,
    options: WorkflowExecutionOptions
  ): Record<string, any> {
    const context: Record<string, any> = {};
    
    if (!options.preserveContext) {
      return context;
    }
    
    // Include workflow context
    Object.assign(context, workflow.state.context);
    
    // Include outputs from dependencies
    const transitions = this.sessionTransitions.get(workflow.id) || [];
    const dependencies = workflow.dependencies.get(sessionId) || [];
    
    dependencies.forEach(depId => {
      const depTransitions = transitions.filter(t => t.toSession === depId);
      if (depTransitions.length > 0) {
        const latestTransition = depTransitions[depTransitions.length - 1];
        if (latestTransition) {
          context[`${depId}_outputs`] = latestTransition.outputs;
        }
      }
    });
    
    return context;
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    if (workflow.state.status !== 'running') {
      throw new Error('Can only pause running workflows');
    }
    
    workflow.state.status = 'paused';
    await this.updateWorkflow(workflowId, workflow);
    
    this.logger.info('Workflow paused', { workflowId });
    this.emit('workflow:paused', workflow);
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    if (workflow.state.status !== 'paused') {
      throw new Error('Can only resume paused workflows');
    }
    
    workflow.state.status = 'running';
    await this.updateWorkflow(workflowId, workflow);
    
    this.logger.info('Workflow resumed', { workflowId });
    this.emit('workflow:resumed', workflow);
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    workflow.state.status = 'cancelled';
    workflow.progress.endTime = new Date().toISOString();
    await this.updateWorkflow(workflowId, workflow);
    
    this.logger.info('Workflow cancelled', { workflowId });
    this.emit('workflow:cancelled', workflow);
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): SessionWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): SessionWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): SessionWorkflow[] {
    return Array.from(this.activeWorkflows).map(id => 
      this.workflows.get(id)!
    ).filter(Boolean);
  }

  /**
   * Update workflow
   */
  private async updateWorkflow(
    workflowId: string,
    workflow: SessionWorkflow
  ): Promise<void> {
    workflow.updatedAt = new Date().toISOString();
    this.workflows.set(workflowId, workflow);
  }

  /**
   * Topological sort for dependency ordering
   */
  private topologicalSort(dependencies: Map<string, string[]>): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (node: string) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected: ${node}`);
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visiting.add(node);
      
      const deps = dependencies.get(node) || [];
      deps.forEach(dep => {
        if (dependencies.has(dep)) {
          visit(dep);
        }
      });
      
      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    };
    
    Array.from(dependencies.keys()).forEach(node => {
      if (!visited.has(node)) {
        visit(node);
      }
    });
    
    return sorted;
  }

  /**
   * Calculate duration between timestamps
   */
  private calculateDuration(start: string, end: string): number {
    return new Date(end).getTime() - new Date(start).getTime();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate workflow ID
   */
  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Simulate session execution (temporary for testing)
   */
  private async simulateSessionExecution(session: Session): Promise<void> {
    // Simulate planning phase
    await this.delay(2000);
    
    await this.sessionManager.updateSession(session.id, {
      status: 'executing'
    });
    
    // Simulate execution phase
    await this.delay(5000);
    
    // Simulate completion
    await this.sessionManager.completeSession(session.id, {
      sessionId: session.id,
      status: 'success',
      deliverables: [],
      logs: ['Session completed successfully'],
      errors: [],
      metrics: {
        duration: 7000,
        tasksCompleted: 1,
        tasksFailed: 0
      }
    });
  }

  /**
   * Get workflow transitions
   */
  getWorkflowTransitions(workflowId: string): SessionTransition[] {
    return this.sessionTransitions.get(workflowId) || [];
  }

  /**
   * Export workflow data
   */
  exportWorkflow(workflowId: string): string {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    const transitions = this.getWorkflowTransitions(workflowId);
    
    return JSON.stringify({
      workflow,
      transitions
    }, null, 2);
  }

  /**
   * Import workflow data
   */
  importWorkflow(data: string): SessionWorkflow {
    const { workflow, transitions } = JSON.parse(data);
    
    this.workflows.set(workflow.id, workflow);
    if (transitions && transitions.length > 0) {
      this.sessionTransitions.set(workflow.id, transitions);
    }
    
    return workflow;
  }
}