import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';
import { ZedAgentPanelAdapter, PlanningRequest, PlanningResponse } from './ZedAgentPanelAdapter';
const uuidv4 = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export interface ExecutionInstruction {
  id: string;
  planId: string;
  type: 'code-generation' | 'file-operation' | 'command-execution';
  action: string;
  target?: string;
  content?: string;
  validation?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface InstructionFlow {
  id: string;
  planningRequest: PlanningRequest;
  planningResponse?: PlanningResponse;
  executionInstructions: ExecutionInstruction[];
  status: 'planning' | 'ready' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface FlowTransition {
  from: 'planning' | 'execution';
  to: 'planning' | 'execution';
  reason: string;
  timestamp: Date;
  metadata?: any;
}

export class ZedInstructionFlowService extends EventEmitter {
  private logger: Logger;
  private activeFlows: Map<string, InstructionFlow> = new Map();
  private flowTransitions: FlowTransition[] = [];
  private agentPanelAdapter: ZedAgentPanelAdapter;
  private executionQueue: ExecutionInstruction[] = [];
  private isExecuting: boolean = false;

  constructor(agentPanelAdapter: ZedAgentPanelAdapter) {
    super();
    this.logger = new Logger('ZedInstructionFlowService');
    this.agentPanelAdapter = agentPanelAdapter;
    
    // Listen for planning completions
    this.agentPanelAdapter.on('planning-complete', this.handlePlanningComplete.bind(this));
  }

  // Create a new instruction flow
  async createFlow(request: PlanningRequest): Promise<string> {
    const flowId = uuidv4();
    
    const flow: InstructionFlow = {
      id: flowId,
      planningRequest: request,
      executionInstructions: [],
      status: 'planning',
      createdAt: new Date()
    };
    
    this.activeFlows.set(flowId, flow);
    
    // Record transition
    this.recordTransition({
      from: 'execution',
      to: 'planning',
      reason: 'New instruction flow initiated',
      timestamp: new Date(),
      metadata: { flowId, instruction: request.instruction }
    });
    
    this.emit('flow-created', flow);
    return flowId;
  }

  // Handle planning completion
  private async handlePlanningComplete(response: PlanningResponse): Promise<void> {
    // Find the flow for this response
    const flow = Array.from(this.activeFlows.values()).find(
      f => f.planningRequest.id === response.id
    );
    
    if (!flow) {
      this.logger.warn(`No flow found for planning response: ${response.id}`);
      return;
    }
    
    flow.planningResponse = response;
    flow.status = 'ready';
    
    // Convert plan steps to execution instructions
    const instructions = this.convertPlanToInstructions(response);
    flow.executionInstructions = instructions;
    
    // Record transition
    this.recordTransition({
      from: 'planning',
      to: 'execution',
      reason: 'Planning completed, ready for execution',
      timestamp: new Date(),
      metadata: { 
        flowId: flow.id, 
        instructionCount: instructions.length,
        complexity: response.plan.complexity
      }
    });
    
    this.emit('flow-ready', flow);
  }

  // Convert planning response to execution instructions
  private convertPlanToInstructions(response: PlanningResponse): ExecutionInstruction[] {
    const instructions: ExecutionInstruction[] = [];
    
    for (const step of response.plan.steps) {
      let type: ExecutionInstruction['type'] = 'code-generation';
      
      // Determine instruction type based on action
      if (step.action === 'analyze' || step.action === 'validate') {
        continue; // Skip non-executable steps
      }
      
      if (step.action === 'design' || step.action === 'implement') {
        type = 'code-generation';
      } else if (step.action === 'test') {
        type = 'command-execution';
      }
      
      const instruction: ExecutionInstruction = {
        id: uuidv4(),
        planId: response.id,
        type,
        action: step.action,
        target: step.target,
        validation: step.validation,
        status: 'pending'
      };
      
      instructions.push(instruction);
    }
    
    return instructions;
  }

  // Execute a flow
  async executeFlow(flowId: string): Promise<void> {
    const flow = this.activeFlows.get(flowId);
    
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    if (flow.status !== 'ready') {
      throw new Error(`Flow is not ready for execution: ${flow.status}`);
    }
    
    flow.status = 'executing';
    
    // Add instructions to execution queue
    this.executionQueue.push(...flow.executionInstructions);
    
    // Start execution if not already running
    if (!this.isExecuting) {
      this.processExecutionQueue();
    }
    
    this.emit('flow-executing', flow);
  }

  // Process execution queue
  private async processExecutionQueue(): Promise<void> {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }
    
    this.isExecuting = true;
    
    while (this.executionQueue.length > 0) {
      const instruction = this.executionQueue.shift()!;
      
      try {
        await this.executeInstruction(instruction);
      } catch (error) {
        this.logger.error('Instruction execution failed:', error as Error);
        instruction.status = 'failed';
        instruction.error = (error as Error).message;
        this.emit('instruction-failed', instruction);
      }
    }
    
    this.isExecuting = false;
  }

  // Execute a single instruction
  private async executeInstruction(instruction: ExecutionInstruction): Promise<void> {
    instruction.status = 'in-progress';
    instruction.startedAt = new Date();
    
    this.emit('instruction-started', instruction);
    
    try {
      switch (instruction.type) {
        case 'code-generation':
          await this.executeCodeGeneration(instruction);
          break;
          
        case 'file-operation':
          await this.executeFileOperation(instruction);
          break;
          
        case 'command-execution':
          await this.executeCommand(instruction);
          break;
      }
      
      instruction.status = 'completed';
      instruction.completedAt = new Date();
      
      this.emit('instruction-completed', instruction);
      
      // Check if flow is complete
      this.checkFlowCompletion(instruction.planId);
      
    } catch (error) {
      throw error;
    }
  }

  // Execute code generation instruction
  private async executeCodeGeneration(instruction: ExecutionInstruction): Promise<void> {
    // This would interface with the actual code generation service
    this.emit('code-generation-request', {
      instruction,
      target: instruction.target,
      context: instruction.content
    });
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Execute file operation
  private async executeFileOperation(instruction: ExecutionInstruction): Promise<void> {
    // This would interface with the file system
    this.emit('file-operation-request', {
      instruction,
      operation: instruction.action,
      target: instruction.target
    });
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Execute command
  private async executeCommand(instruction: ExecutionInstruction): Promise<void> {
    // This would interface with the command execution service
    this.emit('command-execution-request', {
      instruction,
      command: instruction.content || instruction.action
    });
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Check if flow is complete
  private checkFlowCompletion(planId: string): void {
    const flow = Array.from(this.activeFlows.values()).find(
      f => f.planningResponse?.id === planId
    );
    
    if (!flow) return;
    
    const allComplete = flow.executionInstructions.every(
      inst => inst.status === 'completed' || inst.status === 'failed'
    );
    
    if (allComplete) {
      flow.status = 'completed';
      flow.completedAt = new Date();
      
      this.recordTransition({
        from: 'execution',
        to: 'planning',
        reason: 'Flow execution completed',
        timestamp: new Date(),
        metadata: { 
          flowId: flow.id,
          duration: flow.completedAt.getTime() - flow.createdAt.getTime()
        }
      });
      
      this.emit('flow-completed', flow);
    }
  }

  // Record actor transition
  private recordTransition(transition: FlowTransition): void {
    this.flowTransitions.push(transition);
    
    // Keep only last 100 transitions
    if (this.flowTransitions.length > 100) {
      this.flowTransitions = this.flowTransitions.slice(-100);
    }
    
    this.emit('transition-recorded', transition);
  }

  // Get flow status
  getFlowStatus(flowId: string): InstructionFlow | undefined {
    return this.activeFlows.get(flowId);
  }

  // Get all active flows
  getActiveFlows(): InstructionFlow[] {
    return Array.from(this.activeFlows.values()).filter(
      flow => flow.status !== 'completed' && flow.status !== 'failed'
    );
  }

  // Get flow transitions
  getFlowTransitions(limit: number = 20): FlowTransition[] {
    return this.flowTransitions.slice(-limit);
  }

  // Cancel a flow
  async cancelFlow(flowId: string): Promise<void> {
    const flow = this.activeFlows.get(flowId);
    
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    
    flow.status = 'failed';
    
    // Remove pending instructions from queue
    this.executionQueue = this.executionQueue.filter(
      inst => !flow.executionInstructions.find(fi => fi.id === inst.id)
    );
    
    this.emit('flow-cancelled', flow);
  }

  // Get execution metrics
  getExecutionMetrics(): {
    activeFlows: number;
    pendingInstructions: number;
    completedFlows: number;
    averageExecutionTime: number;
  } {
    const completedFlows = Array.from(this.activeFlows.values()).filter(
      f => f.status === 'completed'
    );
    
    const totalExecutionTime = completedFlows.reduce((sum, flow) => {
      if (flow.completedAt) {
        return sum + (flow.completedAt.getTime() - flow.createdAt.getTime());
      }
      return sum;
    }, 0);
    
    return {
      activeFlows: this.getActiveFlows().length,
      pendingInstructions: this.executionQueue.length,
      completedFlows: completedFlows.length,
      averageExecutionTime: completedFlows.length > 0 
        ? totalExecutionTime / completedFlows.length 
        : 0
    };
  }
}