
/**
 * @actor system
 * @responsibility Manages the flow of instructions through the system
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';

export interface WorkflowStep {
  id: string;
  type: 'request' | 'planning' | 'validation' | 'execution' | 'result';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface Workflow {
  id: string;
  sessionId: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata: Record<string, any>;
}

export interface WorkflowTransition {
  from: WorkflowStep['type'];
  to: WorkflowStep['type'];
  condition?: (step: WorkflowStep) => boolean;
}

export class WorkflowEngine {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly workflows: Map<string, Workflow> = new Map();
  private readonly activeWorkflows: Set<string> = new Set();
  
  // Define valid workflow transitions
  private readonly transitions: WorkflowTransition[] = [
    { from: 'request', to: 'planning' },
    { from: 'planning', to: 'validation' },
    { from: 'validation', to: 'execution', condition: (step) => step.status === 'completed' },
    { from: 'execution', to: 'result' }
  ];

  // Define workflow step templates
  private readonly stepTemplates = {
    request: { id: 'request', type: 'request' as const, status: 'pending' as const },
    planning: { id: 'planning', type: 'planning' as const, status: 'pending' as const },
    validation: { id: 'validation', type: 'validation' as const, status: 'pending' as const },
    execution: { id: 'execution', type: 'execution' as const, status: 'pending' as const },
    result: { id: 'result', type: 'result' as const, status: 'pending' as const }
  };

  constructor(logger: Logger, auditLogger: AuditLogger) {
    this.logger = logger;
    this.auditLogger = auditLogger;
  }

  /**
   * Create a new workflow for a session
   */
  createWorkflow(sessionId: string): Workflow {
    const workflowId = this.generateWorkflowId();
    
    const workflow: Workflow = {
      id: workflowId,
      sessionId,
      status: 'active',
      steps: Object.values(this.stepTemplates).map(template => ({ ...template })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    };

    this.workflows.set(workflowId, workflow);
    this.activeWorkflows.add(workflowId);

    this.logger.info('Workflow created', {
      workflowId,
      sessionId,
      steps: workflow.steps.length
    });

    return workflow;
  }

  /**
   * Start a workflow step
   */
  async startStep(
    workflowId: string,
    stepType: WorkflowStep['type'],
    input?: any
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.type === stepType);
    if (!step) {
      throw new Error(`Step not found: ${stepType}`);
    }

    // Validate transition
    if (!this.canTransitionTo(workflow, stepType)) {
      throw new Error(`Invalid transition to step: ${stepType}`);
    }

    // Update step
    step.status = 'in_progress';
    step.startTime = new Date().toISOString();
    step.input = input;

    workflow.updatedAt = new Date().toISOString();
    
    this.logger.info('Workflow step started', {
      workflowId,
      sessionId: workflow.sessionId,
      stepType,
      hasInput: !!input
    });

    this.auditLogger.logEvent({
      actor: {
        type: 'system',
        id: 'WorkflowEngine'
      },
      operation: {
        type: 'workflow.step.start',
        description: `Started ${stepType} step`,
        input
      },
      result: {
        status: 'success',
        duration: 0
      },
      metadata: {
        sessionId: workflow.sessionId,
        correlationId: this.generateCorrelationId()
      }
    });
  }

  /**
   * Complete a workflow step
   */
  async completeStep(
    workflowId: string,
    stepType: WorkflowStep['type'],
    output?: any
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.type === stepType);
    if (!step) {
      throw new Error(`Step not found: ${stepType}`);
    }

    if (step.status !== 'in_progress') {
      throw new Error(`Step not in progress: ${stepType}`);
    }

    // Update step
    step.status = 'completed';
    step.endTime = new Date().toISOString();
    step.duration = step.startTime 
      ? new Date(step.endTime).getTime() - new Date(step.startTime).getTime()
      : 0;
    step.output = output;

    workflow.updatedAt = new Date().toISOString();

    // Check if workflow is complete
    if (this.isWorkflowComplete(workflow)) {
      await this.completeWorkflow(workflowId);
    }

    this.logger.info('Workflow step completed', {
      workflowId,
      sessionId: workflow.sessionId,
      stepType,
      duration: step.duration,
      hasOutput: !!output
    });
  }

  /**
   * Fail a workflow step
   */
  async failStep(
    workflowId: string,
    stepType: WorkflowStep['type'],
    error: string
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const step = workflow.steps.find(s => s.type === stepType);
    if (!step) {
      throw new Error(`Step not found: ${stepType}`);
    }

    // Update step
    step.status = 'failed';
    step.endTime = new Date().toISOString();
    step.duration = step.startTime 
      ? new Date(step.endTime).getTime() - new Date(step.startTime).getTime()
      : 0;
    step.error = error;

    workflow.status = 'failed';
    workflow.updatedAt = new Date().toISOString();
    this.activeWorkflows.delete(workflowId);

    this.logger.error('Workflow step failed', new Error(error), {
      workflowId,
      sessionId: workflow.sessionId,
      stepType
    });
  }

  /**
   * Get current step for a workflow
   */
  getCurrentStep(workflowId: string): WorkflowStep | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    return workflow.steps.find(s => s.status === 'in_progress');
  }

  /**
   * Get next step for a workflow
   */
  getNextStep(workflowId: string): WorkflowStep | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    const currentStep = this.getCurrentStep(workflowId);
    if (currentStep) return undefined; // Can't get next if current is in progress

    // Find the first pending step in order
    return workflow.steps.find(s => s.status === 'pending');
  }

  /**
   * Get workflow by session ID
   */
  getWorkflowBySessionId(sessionId: string): Workflow | undefined {
    return Array.from(this.workflows.values()).find(
      w => w.sessionId === sessionId
    );
  }

  /**
   * Get workflow metrics
   */
  getMetrics(): unknown {
    const workflows = Array.from(this.workflows.values());
    
    return {
      total: workflows.length,
      active: this.activeWorkflows.size,
      byStatus: {
        active: workflows.filter(w => w.status === 'active').length,
        completed: workflows.filter(w => w.status === 'completed').length,
        failed: workflows.filter(w => w.status === 'failed').length,
        cancelled: workflows.filter(w => w.status === 'cancelled').length
      },
      averageCompletionTime: this.calculateAverageCompletionTime(workflows),
      stepMetrics: this.calculateStepMetrics(workflows)
    };
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.status = 'cancelled';
    workflow.updatedAt = new Date().toISOString();
    workflow.metadata['cancellationReason'] = reason;
    
    // Mark all pending steps as skipped
    workflow.steps.forEach(step => {
      if (step.status === 'pending' || step.status === 'in_progress') {
        step.status = 'skipped';
      }
    });

    this.activeWorkflows.delete(workflowId);

    this.logger.info('Workflow cancelled', {
      workflowId,
      sessionId: workflow.sessionId,
      reason
    });
  }

  /**
   * Get workflow progress
   */
  getProgress(workflowId: string): {
    completedSteps: number;
    totalSteps: number;
    percentage: number;
    currentStep?: string;
  } {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return { completedSteps: 0, totalSteps: 0, percentage: 0 };
    }

    const completedSteps = workflow.steps.filter(
      s => s.status === 'completed'
    ).length;
    const totalSteps = workflow.steps.length;
    const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    const currentStep = this.getCurrentStep(workflowId)?.type;

    return { completedSteps, totalSteps, percentage, currentStep };
  }

  private canTransitionTo(workflow: Workflow, toStep: WorkflowStep['type']): boolean {
    // If it's the first step (request), always allow
    if (toStep === 'request') return true;

    // Find the last completed step
    const completedSteps = workflow.steps.filter(s => s.status === 'completed');
    if (completedSteps.length === 0) {
      // No completed steps, only request can start
      return toStep === 'planning';
    }

    const lastCompleted = completedSteps[completedSteps.length - 1];
    if (!lastCompleted) return false;
    
    // Check if transition is valid
    const transition = this.transitions.find(
      t => t.from === lastCompleted.type && t.to === toStep
    );

    if (!transition) return false;

    // Check transition condition if exists
    if (transition.condition && lastCompleted) {
      return transition.condition(lastCompleted);
    }

    return true;
  }

  private isWorkflowComplete(workflow: Workflow): boolean {
    return workflow.steps.every(
      step => step.status === 'completed' || step.status === 'skipped'
    );
  }

  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = new Date().toISOString();
    workflow.updatedAt = workflow.completedAt;
    
    this.activeWorkflows.delete(workflowId);

    this.logger.info('Workflow completed', {
      workflowId,
      sessionId: workflow.sessionId,
      duration: new Date(workflow.completedAt).getTime() - 
                new Date(workflow.createdAt).getTime()
    });
  }

  private calculateAverageCompletionTime(workflows: Workflow[]): number {
    const completed = workflows.filter(w => w.completedAt);
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, w) => {
      const duration = new Date(w.completedAt!).getTime() - 
                      new Date(w.createdAt).getTime();
      return sum + duration;
    }, 0);

    return totalTime / completed.length;
  }

  private calculateStepMetrics(workflows: Workflow[]): unknown {
    const stepTypes: WorkflowStep['type'][] = ['request', 'planning', 'validation', 'execution', 'result'];
    const metrics: Record<string, any> = {};

    stepTypes.forEach(type => {
      const steps = workflows.flatMap(w => w.steps).filter(s => s.type === type);
      const completedSteps = steps.filter(s => s.status === 'completed');
      
      metrics[type] = {
        total: steps.length,
        completed: completedSteps.length,
        failed: steps.filter(s => s.status === 'failed').length,
        averageDuration: completedSteps.length > 0
          ? completedSteps.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSteps.length
          : 0
      };
    });

    return metrics;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `wf_corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}