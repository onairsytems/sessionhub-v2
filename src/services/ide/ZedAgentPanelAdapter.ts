import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { Logger } from '../../lib/logging/Logger';
import { BaseProjectContext } from '../../models/ProjectContext';

export interface PlanningRequest {
  id: string;
  instruction: string;
  context: {
    file?: string;
    selection?: string;
    projectPath: string;
  };
  timestamp: Date;
}

export interface PlanningResponse {
  id: string;
  plan: {
    summary: string;
    steps: PlanningStep[];
    estimatedTime: number;
    complexity: 'low' | 'medium' | 'high';
  };
  metadata: {
    planningDuration: number;
    actorVersion: string;
  };
}

export interface PlanningStep {
  order: number;
  description: string;
  action: string;
  target?: string;
  validation?: string;
}

export interface AgentPanelStatus {
  connected: boolean;
  planningActive: boolean;
  currentRequest?: PlanningRequest;
  lastResponse?: PlanningResponse;
  pendingInstructions: number;
}

interface ZedIntegrationMessage {
  type: string;
  payload?: any;
  timestamp: Date;
}

export class ZedAgentPanelAdapter extends EventEmitter {
  private logger: Logger;
  private wsServer?: WebSocket.Server;
  private connectedClients: Map<string, WebSocket> = new Map();
  private status: AgentPanelStatus = {
    connected: false,
    planningActive: false,
    pendingInstructions: 0
  };
  private planningQueue: PlanningRequest[] = [];
  private port: number = 3456;

  constructor() {
    super();
    this.logger = new Logger('ZedAgentPanelAdapter');
  }

  async initialize(): Promise<void> {
    try {
      // Start WebSocket server for Zed extension communication
      this.wsServer = new WebSocket.Server({ 
        port: this.port,
        path: '/zed-integration'
      });

      this.wsServer.on('connection', (ws) => {
        const clientId = this.generateClientId();
        this.connectedClients.set(clientId, ws as any);
        
        this.logger.info(`Zed extension connected: ${clientId}`);
        this.status.connected = true;
        this.emit('zed-connected', clientId);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as ZedIntegrationMessage;
            this.handleZedMessage(clientId, message);
          } catch (error) {
            this.logger.error('Failed to parse Zed message:', error as Error);
          }
        });

        ws.on('close', () => {
          this.connectedClients.delete(clientId);
          this.logger.info(`Zed extension disconnected: ${clientId}`);
          
          if (this.connectedClients.size === 0) {
            this.status.connected = false;
            this.emit('zed-disconnected');
          }
        });

        // Send initial status
        this.sendToClient(clientId, {
          type: 'actor-update',
          state: this.status
        });
      });

      this.logger.info(`ZedAgentPanelAdapter started on port ${this.port}`);
    } catch (error) {
      this.logger.error('Failed to initialize ZedAgentPanelAdapter:', error as Error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    // Close all client connections
    for (const [_clientId, ws] of this.connectedClients) {
      ws.close();
    }
    this.connectedClients.clear();

    // Close server
    if (this.wsServer) {
      await new Promise<void>((resolve) => {
        this.wsServer!.close(() => resolve());
      });
    }

    this.logger.info('ZedAgentPanelAdapter shut down');
  }

  // Planning Actor Operations
  async processPlanningRequest(request: PlanningRequest): Promise<PlanningResponse> {
    this.status.planningActive = true;
    this.status.currentRequest = request;
    this.updateAllClients();

    const startTime = Date.now();

    try {
      // Analyze the instruction to create a structured plan
      const plan = await this.generatePlan(request);

      const response: PlanningResponse = {
        id: request.id,
        plan,
        metadata: {
          planningDuration: Date.now() - startTime,
          actorVersion: '2.27'
        }
      };

      this.status.lastResponse = response;
      this.status.planningActive = false;
      this.status.currentRequest = undefined;
      
      // Send response to all connected Zed instances
      this.broadcast({
        type: 'planning-response',
        plan: response.plan,
        requestId: request.id
      });

      this.emit('planning-complete', response);
      return response;

    } catch (error) {
      this.status.planningActive = false;
      this.status.currentRequest = undefined;
      this.updateAllClients();
      
      throw error;
    }
  }

  private async generatePlan(request: PlanningRequest): Promise<PlanningResponse['plan']> {
    // Analyze the instruction to determine complexity and steps
    const instruction = request.instruction.toLowerCase();
    
    // Determine complexity based on keywords and patterns
    let complexity: 'low' | 'medium' | 'high' = 'medium';
    let estimatedTime = 5; // minutes

    if (instruction.includes('refactor') || instruction.includes('architecture') || 
        instruction.includes('migrate') || instruction.includes('system')) {
      complexity = 'high';
      estimatedTime = 30;
    } else if (instruction.includes('fix') || instruction.includes('add') || 
               instruction.includes('update') || instruction.includes('simple')) {
      complexity = 'low';
      estimatedTime = 10;
    }

    // Generate steps based on instruction analysis
    const steps: PlanningStep[] = [];
    
    // Always start with analysis
    steps.push({
      order: 1,
      description: 'Analyze current implementation and requirements',
      action: 'analyze',
      target: request.context.file || 'project',
      validation: 'Understand existing code structure and constraints'
    });

    // Add instruction-specific steps
    if (instruction.includes('component') || instruction.includes('ui')) {
      steps.push({
        order: steps.length + 1,
        description: 'Design component structure and interface',
        action: 'design',
        target: 'component',
        validation: 'Component follows existing patterns'
      });
    }

    if (instruction.includes('test')) {
      steps.push({
        order: steps.length + 1,
        description: 'Create comprehensive test cases',
        action: 'test',
        target: 'test-suite',
        validation: 'All edge cases covered'
      });
    }

    if (instruction.includes('api') || instruction.includes('service')) {
      steps.push({
        order: steps.length + 1,
        description: 'Design API interface and contracts',
        action: 'design',
        target: 'api',
        validation: 'API follows REST/GraphQL conventions'
      });
    }

    // Implementation step
    steps.push({
      order: steps.length + 1,
      description: 'Implement the solution following best practices',
      action: 'implement',
      target: request.context.file || 'new-file',
      validation: 'Code is clean, maintainable, and tested'
    });

    // Validation step
    steps.push({
      order: steps.length + 1,
      description: 'Validate implementation and run quality checks',
      action: 'validate',
      target: 'implementation',
      validation: 'All tests pass, no lint errors, types are correct'
    });

    return {
      summary: `Plan for: ${request.instruction}`,
      steps,
      estimatedTime,
      complexity
    };
  }

  // Boundary Enforcement
  enforceAssistantBoundaries(message: any): any {
    // Remove any code blocks from planning responses
    if (message.type === 'assistant-response' && this.status.planningActive) {
      if (typeof message.content === 'string') {
        message.content = message.content.replace(/```[\s\S]*?```/g, 
          '[Code generation blocked - Planning Actor only generates instructions]');
      }
      message.isPlanningResponse = true;
    }
    return message;
  }

  // Instruction Flow Management
  async queueInstruction(instruction: PlanningRequest): Promise<void> {
    this.planningQueue.push(instruction);
    this.status.pendingInstructions = this.planningQueue.length;
    this.updateAllClients();
    this.emit('instruction-queued', instruction);
  }

  async getNextInstruction(): Promise<PlanningRequest | undefined> {
    const instruction = this.planningQueue.shift();
    this.status.pendingInstructions = this.planningQueue.length;
    this.updateAllClients();
    return instruction;
  }

  // Communication with Zed Extension
  private handleZedMessage(clientId: string, message: ZedIntegrationMessage): void {
    this.logger.debug(`Received message from Zed: ${message.type}`);

    switch (message.type) {
      case 'zed-connected':
        this.emit('extension-ready', { clientId, version: message.payload?.extensionVersion });
        break;

      case 'planning-request':
        const request = message.payload?.instruction as PlanningRequest;
        if (request) {
          this.processPlanningRequest(request).catch(error => {
            this.logger.error('Planning request failed:', error);
            this.sendToClient(clientId, {
              type: 'planning-error',
              error: error instanceof Error ? error.message : String(error)
            });
          });
        }
        break;

      case 'execution-request':
        // Forward to execution actor
        this.emit('execution-requested', message.payload);
        break;

      case 'sync-request':
        // Handle sync request
        this.emit('sync-requested', { clientId, state: message.payload?.state });
        break;

      case 'boundary-violation':
        // Log boundary violation
        this.logger.warn('Boundary violation detected:', message.payload);
        this.emit('boundary-violation', message.payload);
        break;

      default:
        this.logger.debug(`Unknown message type: ${message.type}`);
    }
  }

  private sendToClient(clientId: string, message: any): void {
    const client = this.connectedClients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        ...message,
        timestamp: new Date()
      }));
    }
  }

  private broadcast(message: any): void {
    for (const [clientId] of this.connectedClients) {
      this.sendToClient(clientId, message);
    }
  }

  private updateAllClients(): void {
    this.broadcast({
      type: 'actor-update',
      state: this.status
    });
  }

  // State Management
  getStatus(): AgentPanelStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  isPlanningActive(): boolean {
    return this.status.planningActive;
  }

  getPendingInstructionCount(): number {
    return this.status.pendingInstructions;
  }

  // Integration with SessionHub
  async syncWithSessionHub(context: BaseProjectContext): Promise<void> {
    this.emit('sessionhub-sync', {
      projectContext: context,
      agentStatus: this.status,
      connectedClients: this.connectedClients.size
    });
  }

  private generateClientId(): string {
    return `zed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}