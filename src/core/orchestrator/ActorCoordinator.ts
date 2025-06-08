
/**
 * @actor system
 * @responsibility Coordinates communication between Planning and Execution actors
 */

import { PlanningEngine } from '@/src/core/planning/PlanningEngine';
import { ExecutionEngine, ExecutionContext } from '@/src/core/execution/ExecutionEngine';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { ActorBoundaryEnforcer } from '@/src/core/orchestrator/ActorBoundaryEnforcer';
import { ErrorHandler } from '@/src/core/orchestrator/ErrorHandler';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { InstructionProtocol } from '@/src/models/Instruction';
import { UserRequest, ExecutionResult, Session } from './SessionManager';
import { InstructionQueue } from './InstructionQueue';

export interface ActorState {
  id: string;
  type: 'planning' | 'execution';
  status: 'idle' | 'busy' | 'error';
  currentOperation?: string;
  lastActivity: string;
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
  };
}

export interface CoordinationResult {
  sessionId: string;
  instructions: InstructionProtocol;
  executionResult: ExecutionResult;
  duration: number;
  actorMetrics: {
    planning: { duration: number; retries: number };
    execution: { duration: number; retries: number };
  };
}

export class ActorCoordinator {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly protocolValidator: ProtocolValidator;
  private readonly boundaryEnforcer: ActorBoundaryEnforcer;
  private readonly errorHandler: ErrorHandler;
  private readonly instructionQueue: InstructionQueue;
  
  private planningEngine?: PlanningEngine;
  private executionEngine?: ExecutionEngine;
  
  private readonly actorStates: Map<string, ActorState> = new Map();
  private readonly activeOperations: Map<string, string> = new Map(); // sessionId -> actorId

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    protocolValidator: ProtocolValidator,
    boundaryEnforcer: ActorBoundaryEnforcer,
    errorHandler: ErrorHandler
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.protocolValidator = protocolValidator;
    this.boundaryEnforcer = boundaryEnforcer;
    this.errorHandler = errorHandler;
    this.instructionQueue = new InstructionQueue(logger);
    
    this.initializeActorStates();
    this.setupQueueEventListeners();
  }

  /**
   * Initialize actor engines
   */
  async initialize(
    planningEngine: PlanningEngine,
    executionEngine: ExecutionEngine
  ): Promise<void> {
    this.planningEngine = planningEngine;
    this.executionEngine = executionEngine;
    
    this.logger.info('ActorCoordinator initialized', {
      planningEngine: !!planningEngine,
      executionEngine: !!executionEngine
    });
  }

  /**
   * Process a user request through both actors
   */
  async processRequest(
    session: Session,
    request: UserRequest
  ): Promise<CoordinationResult> {
    if (!this.planningEngine || !this.executionEngine) {
      throw new Error('ActorCoordinator not initialized');
    }

    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();
    
    this.logger.info('Processing request', {
      sessionId: session.id,
      correlationId
    });

    try {
      // Phase 1: Planning
      const planningStart = Date.now();
      const instructions = await this.runPlanningPhase(
        session,
        request,
        correlationId
      );
      const planningDuration = Date.now() - planningStart;

      // Validate instructions
      this.protocolValidator.validate(instructions);
      
      // Phase 2: Execution
      const executionStart = Date.now();
      const executionResult = await this.runExecutionPhase(
        session,
        instructions,
        correlationId
      );
      const executionDuration = Date.now() - executionStart;

      const totalDuration = Date.now() - startTime;

      const result: CoordinationResult = {
        sessionId: session.id,
        instructions,
        executionResult,
        duration: totalDuration,
        actorMetrics: {
          planning: { duration: planningDuration, retries: 0 },
          execution: { duration: executionDuration, retries: 0 }
        }
      };

      this.logger.info('Request processed successfully', {
        sessionId: session.id,
        duration: totalDuration,
        correlationId
      });

      return result;

    } catch (error: any) {
      await this.errorHandler.handleError(error as Error, {
        actor: 'coordinator',
        operation: 'processRequest',
        recoverable: false
      });
      
      throw error;
    } finally {
      this.activeOperations.delete(session.id);
    }
  }

  /**
   * Run planning phase
   */
  private async runPlanningPhase(
    session: Session,
    request: UserRequest,
    correlationId: string
  ): Promise<InstructionProtocol> {
    const planningActorId = 'planning-actor-1';
    
    this.updateActorState(planningActorId, {
      status: 'busy',
      currentOperation: `Planning for session ${session.id}`
    });

    this.activeOperations.set(session.id, planningActorId);

    try {
      // Enforce planning boundaries
      const operation = {
        type: 'plan' as const,
        actor: {
          type: 'planning' as const,
          id: planningActorId,
          capabilities: ['analyze', 'plan', 'strategize']
        },
        description: 'Generate instructions from user request',
        timestamp: new Date().toISOString()
      };
      
      this.boundaryEnforcer.validateOperation(operation);

      // Generate instructions - adapt request format
      const planningRequest = {
        id: request.id,
        content: request.content,
        context: request.context,
        sessionId: request.sessionId,
        timestamp: request.timestamp
      };
      const instructions = await this.planningEngine!.generateInstructions(planningRequest);

      // Validate no code in instructions
      this.protocolValidator.ensureNoCode(instructions);

      // Log success
      this.auditLogger.logEvent({
        actor: {
          type: 'planning',
          id: planningActorId
        },
        operation: {
          type: 'instruction.generate',
          description: 'Generated instructions from request',
          input: request,
          output: instructions
        },
        result: {
          status: 'success',
          duration: 0
        },
        metadata: {
          sessionId: session.id,
          instructionId: instructions.metadata.id,
          correlationId
        }
      });

      this.updateActorState(planningActorId, {
        status: 'idle',
        currentOperation: undefined
      });

      return instructions;

    } catch (error: any) {
      this.updateActorState(planningActorId, {
        status: 'error',
        currentOperation: undefined
      });
      
      throw error;
    }
  }

  /**
   * Run execution phase
   */
  private async runExecutionPhase(
    session: Session,
    instructions: InstructionProtocol,
    correlationId: string
  ): Promise<ExecutionResult> {
    const executionActorId = 'execution-actor-1';
    
    this.updateActorState(executionActorId, {
      status: 'busy',
      currentOperation: `Executing for session ${session.id}`
    });

    this.activeOperations.set(session.id, executionActorId);

    try {
      // Enforce execution boundaries
      const operation = {
        type: 'execute' as const,
        actor: {
          type: 'execution' as const,
          id: executionActorId,
          capabilities: ['execute', 'implement', 'run']
        },
        description: 'Execute instructions',
        timestamp: new Date().toISOString()
      };
      
      this.boundaryEnforcer.validateOperation(operation);

      // Execute instructions
      const executionContext: ExecutionContext = {
        workingDirectory: session.metadata['projectPath'] || process.cwd(),
        environment: {},
        timeout: 30000,
        dryRun: false
      };

      const result = await this.executionEngine!.executeInstructions(
        instructions,
        executionContext
      );

      // Log success
      this.auditLogger.logEvent({
        actor: {
          type: 'execution',
          id: executionActorId
        },
        operation: {
          type: 'instruction.execute',
          description: 'Executed instructions',
          input: instructions,
          output: result
        },
        result: {
          status: result.status === 'success' ? 'success' : 'failure',
          duration: new Date(result.endTime).getTime() - new Date(result.startTime).getTime()
        },
        metadata: {
          sessionId: session.id,
          instructionId: instructions.metadata.id,
          correlationId
        }
      });

      this.updateActorState(executionActorId, {
        status: 'idle',
        currentOperation: undefined
      });

      // Convert to SessionManager ExecutionResult format
      return {
        sessionId: session.id,
        status: result.status === 'success' ? 'success' : result.status === 'failure' ? 'failure' : 'partial',
        deliverables: result.outputs.map(o => ({
          type: o.type === 'file' ? 'file' : 'documentation',
          path: o.path || '',
          status: 'created' as const
        })),
        logs: result.logs,
        errors: result.errors.map(e => e.message),
        metrics: {
          duration: new Date(result.endTime).getTime() - new Date(result.startTime).getTime(),
          tasksCompleted: result.status === 'success' ? 1 : 0,
          tasksFailed: result.status === 'failure' ? 1 : 0
        }
      };

    } catch (error: any) {
      this.updateActorState(executionActorId, {
        status: 'error',
        currentOperation: undefined
      });
      
      throw error;
    }
  }

  /**
   * Get actor state
   */
  getActorState(actorId: string): ActorState | undefined {
    return this.actorStates.get(actorId);
  }

  /**
   * Get all actor states
   */
  getAllActorStates(): ActorState[] {
    return Array.from(this.actorStates.values());
  }

  /**
   * Check if actors are available
   */
  areActorsAvailable(): boolean {
    const planningActor = this.actorStates.get('planning-actor-1');
    const executionActor = this.actorStates.get('execution-actor-1');
    
    return planningActor?.status === 'idle' && executionActor?.status === 'idle';
  }

  /**
   * Get actor metrics
   */
  getActorMetrics(): unknown {
    const actors = this.getAllActorStates();
    
    return {
      total: actors.length,
      byType: {
        planning: actors.filter(a => a.type === 'planning').length,
        execution: actors.filter(a => a.type === 'execution').length
      },
      byStatus: {
        idle: actors.filter(a => a.status === 'idle').length,
        busy: actors.filter(a => a.status === 'busy').length,
        error: actors.filter(a => a.status === 'error').length
      },
      performance: actors.map(a => ({
        id: a.id,
        type: a.type,
        successRate: a.metrics.totalOperations > 0 
          ? (a.metrics.successfulOperations / a.metrics.totalOperations) * 100
          : 0,
        averageResponseTime: a.metrics.averageResponseTime
      }))
    };
  }

  /**
   * Health check for actors
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    actors: Array<{ id: string; healthy: boolean; reason?: string }>;
  }> {
    const results: Array<{ id: string; healthy: boolean; reason?: string }> = [];
    
    // Check planning actor
    const planningActor = this.actorStates.get('planning-actor-1');
    if (!planningActor) {
      results.push({ id: 'planning-actor-1', healthy: false, reason: 'Not found' });
    } else if (planningActor.status === 'error') {
      results.push({ id: 'planning-actor-1', healthy: false, reason: 'In error state' });
    } else if (!this.planningEngine) {
      results.push({ id: 'planning-actor-1', healthy: false, reason: 'Engine not initialized' });
    } else {
      results.push({ id: 'planning-actor-1', healthy: true });
    }

    // Check execution actor
    const executionActor = this.actorStates.get('execution-actor-1');
    if (!executionActor) {
      results.push({ id: 'execution-actor-1', healthy: false, reason: 'Not found' });
    } else if (executionActor.status === 'error') {
      results.push({ id: 'execution-actor-1', healthy: false, reason: 'In error state' });
    } else if (!this.executionEngine) {
      results.push({ id: 'execution-actor-1', healthy: false, reason: 'Engine not initialized' });
    } else {
      results.push({ id: 'execution-actor-1', healthy: true });
    }

    const healthy = results.every(r => r.healthy);
    
    return { healthy, actors: results };
  }

  private initializeActorStates(): void {
    // Initialize planning actor state
    this.actorStates.set('planning-actor-1', {
      id: 'planning-actor-1',
      type: 'planning',
      status: 'idle',
      lastActivity: new Date().toISOString(),
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0
      }
    });

    // Initialize execution actor state
    this.actorStates.set('execution-actor-1', {
      id: 'execution-actor-1',
      type: 'execution',
      status: 'idle',
      lastActivity: new Date().toISOString(),
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0
      }
    });
  }

  private updateActorState(
    actorId: string,
    updates: Partial<ActorState>
  ): void {
    const currentState = this.actorStates.get(actorId);
    if (!currentState) return;

    const updatedState: ActorState = {
      ...currentState,
      ...updates,
      lastActivity: new Date().toISOString()
    };

    this.actorStates.set(actorId, updatedState);
  }

  private generateCorrelationId(): string {
    return `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup queue event listeners for real-time monitoring
   */
  private setupQueueEventListeners(): void {
    this.instructionQueue.on('instruction-event', (event) => {
      this.logger.info('Instruction event', {
        type: event.type,
        instructionId: event.instructionId,
        sessionId: event.sessionId
      });

      // Update actor metrics based on events
      switch (event.type) {
        case 'started':
          this.incrementActorMetric('planning-actor-1', 'totalOperations');
          break;
        case 'completed':
          this.incrementActorMetric('execution-actor-1', 'successfulOperations');
          break;
        case 'failed':
          this.incrementActorMetric('execution-actor-1', 'failedOperations');
          break;
      }
    });
  }

  /**
   * Increment actor metric
   */
  private incrementActorMetric(actorId: string, metric: keyof ActorState['metrics']): void {
    const actor = this.actorStates.get(actorId);
    if (actor && typeof actor.metrics[metric] === 'number') {
      actor.metrics[metric]++;
    }
  }

  /**
   * Get instruction queue
   */
  getInstructionQueue(): InstructionQueue {
    return this.instructionQueue;
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): unknown {
    return this.instructionQueue.getMetrics();
  }
}