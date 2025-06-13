import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';
import { ZedAgentPanelAdapter } from './ZedAgentPanelAdapter';
import { ZedInstructionFlowService } from './ZedInstructionFlowService';
import { ZedBoundaryEnforcer } from './ZedBoundaryEnforcer';

export interface ActorSyncState {
  sessionHub: {
    connected: boolean;
    version: string;
    activeSession?: string;
    lastSync: Date;
  };
  planningActor: {
    active: boolean;
    currentTask?: string;
    pendingInstructions: number;
    agentPanelConnected: boolean;
  };
  executionActor: {
    active: boolean;
    currentTask?: string;
    progress?: number;
    editorConnected: boolean;
  };
  boundaries: {
    enforcementEnabled: boolean;
    violationCount: number;
    lastViolation?: Date;
  };
  flows: {
    active: number;
    pending: number;
    completed: number;
  };
}

export interface SyncEvent {
  type: 'state-change' | 'violation' | 'flow-update' | 'connection-change';
  timestamp: Date;
  data: any;
}

export class ZedActorSyncService extends EventEmitter {
  private logger: Logger;
  private agentPanelAdapter: ZedAgentPanelAdapter;
  private instructionFlowService: ZedInstructionFlowService;
  private boundaryEnforcer: ZedBoundaryEnforcer;
  private syncState: ActorSyncState;
  private syncInterval?: NodeJS.Timeout;
  private syncEvents: SyncEvent[] = [];

  constructor(
    agentPanelAdapter: ZedAgentPanelAdapter,
    instructionFlowService: ZedInstructionFlowService,
    boundaryEnforcer: ZedBoundaryEnforcer
  ) {
    super();
    this.logger = new Logger('ZedActorSyncService');
    this.agentPanelAdapter = agentPanelAdapter;
    this.instructionFlowService = instructionFlowService;
    this.boundaryEnforcer = boundaryEnforcer;

    // Initialize sync state
    this.syncState = this.createInitialState();

    // Set up event listeners
    this.setupEventListeners();
  }

  private createInitialState(): ActorSyncState {
    return {
      sessionHub: {
        connected: false,
        version: '2.27',
        lastSync: new Date()
      },
      planningActor: {
        active: false,
        pendingInstructions: 0,
        agentPanelConnected: false
      },
      executionActor: {
        active: false,
        editorConnected: false
      },
      boundaries: {
        enforcementEnabled: true,
        violationCount: 0
      },
      flows: {
        active: 0,
        pending: 0,
        completed: 0
      }
    };
  }

  private setupEventListeners(): void {
    // Agent Panel Adapter events
    this.agentPanelAdapter.on('zed-connected', () => {
      this.updatePlanningActorState({ agentPanelConnected: true });
    });

    this.agentPanelAdapter.on('zed-disconnected', () => {
      this.updatePlanningActorState({ agentPanelConnected: false });
    });

    this.agentPanelAdapter.on('planning-complete', () => {
      this.updatePlanningActorState({ active: false });
    });

    // Instruction Flow Service events
    this.instructionFlowService.on('flow-created', () => {
      this.updateFlowMetrics();
    });

    this.instructionFlowService.on('flow-executing', (flow) => {
      this.updateExecutionActorState({ 
        active: true, 
        currentTask: flow.planningRequest.instruction 
      });
    });

    this.instructionFlowService.on('flow-completed', () => {
      this.updateExecutionActorState({ active: false, currentTask: undefined });
      this.updateFlowMetrics();
    });

    // Boundary Enforcer events
    this.boundaryEnforcer.on('violation-detected', (violation) => {
      this.syncState.boundaries.violationCount++;
      this.syncState.boundaries.lastViolation = violation.timestamp;
      this.recordSyncEvent('violation', violation);
      this.broadcastState();
    });
  }

  // Start periodic synchronization
  startSync(intervalMs: number = 5000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, intervalMs);

    this.logger.info(`Started actor synchronization with ${intervalMs}ms interval`);

    // Perform initial sync
    this.performSync();
  }

  // Stop synchronization
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    this.logger.info('Stopped actor synchronization');
  }

  // Perform synchronization
  private async performSync(): Promise<void> {
    try {
      // Update planning actor state
      const agentStatus = this.agentPanelAdapter.getStatus();
      this.syncState.planningActor = {
        active: agentStatus.planningActive,
        currentTask: agentStatus.currentRequest?.instruction,
        pendingInstructions: agentStatus.pendingInstructions,
        agentPanelConnected: agentStatus.connected
      };

      // Update flow metrics
      this.updateFlowMetrics();

      // Update boundary stats
      const violationStats = this.boundaryEnforcer.getViolationStats();
      this.syncState.boundaries.violationCount = violationStats.total;

      // Update sync timestamp
      this.syncState.sessionHub.lastSync = new Date();

      // Broadcast updated state
      this.broadcastState();

    } catch (error) {
      this.logger.error('Sync failed:', error as Error);
    }
  }

  // Update planning actor state
  private updatePlanningActorState(updates: Partial<ActorSyncState['planningActor']>): void {
    this.syncState.planningActor = {
      ...this.syncState.planningActor,
      ...updates
    };
    this.recordSyncEvent('state-change', { actor: 'planning', updates });
    this.broadcastState();
  }

  // Update execution actor state
  private updateExecutionActorState(updates: Partial<ActorSyncState['executionActor']>): void {
    this.syncState.executionActor = {
      ...this.syncState.executionActor,
      ...updates
    };
    this.recordSyncEvent('state-change', { actor: 'execution', updates });
    this.broadcastState();
  }

  // Update flow metrics
  private updateFlowMetrics(): void {
    const metrics = this.instructionFlowService.getExecutionMetrics();
    const activeFlows = this.instructionFlowService.getActiveFlows();
    
    this.syncState.flows = {
      active: activeFlows.length,
      pending: metrics.pendingInstructions,
      completed: metrics.completedFlows
    };
  }

  // Broadcast current state
  private broadcastState(): void {
    this.emit('state-updated', this.syncState);

    // Send to all connected Zed instances
    this.agentPanelAdapter.emit('actor-sync', this.syncState);
  }

  // Record sync event
  private recordSyncEvent(type: SyncEvent['type'], data: any): void {
    const event: SyncEvent = {
      type,
      timestamp: new Date(),
      data
    };
    
    this.syncEvents.push(event);
    
    // Keep only last 100 events
    if (this.syncEvents.length > 100) {
      this.syncEvents = this.syncEvents.slice(-100);
    }
  }

  // Get current sync state
  getSyncState(): ActorSyncState {
    return { ...this.syncState };
  }

  // Get sync events
  getSyncEvents(limit: number = 20): SyncEvent[] {
    return this.syncEvents.slice(-limit);
  }

  // Force synchronization
  async forceSyc(): Promise<void> {
    await this.performSync();
  }

  // Reset sync state
  resetSyncState(): void {
    this.syncState = this.createInitialState();
    this.syncEvents = [];
    this.broadcastState();
    this.logger.info('Sync state reset');
  }

  // Get actor activity timeline
  getActivityTimeline(): Array<{
    timestamp: Date;
    actor: 'planning' | 'execution';
    event: string;
    details?: any;
  }> {
    const timeline: any[] = [];
    
    // Extract events from sync events
    for (const event of this.syncEvents) {
      if (event.type === 'state-change' && event.data.actor) {
        timeline.push({
          timestamp: event.timestamp,
          actor: event.data.actor,
          event: 'state-change',
          details: event.data.updates
        });
      }
    }
    
    // Add flow transitions
    const transitions = this.instructionFlowService.getFlowTransitions();
    for (const transition of transitions) {
      timeline.push({
        timestamp: transition.timestamp,
        actor: transition.from,
        event: 'transition',
        details: transition
      });
    }
    
    // Sort by timestamp
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return timeline.slice(0, 50); // Return last 50 events
  }

  // Export sync data for analysis
  exportSyncData(): {
    state: ActorSyncState;
    events: SyncEvent[];
    timeline: any[];
    metrics: any;
  } {
    return {
      state: this.getSyncState(),
      events: this.getSyncEvents(100),
      timeline: this.getActivityTimeline(),
      metrics: {
        totalEvents: this.syncEvents.length,
        violationCount: this.syncState.boundaries.violationCount,
        flowsCompleted: this.syncState.flows.completed,
        uptime: Date.now() - this.syncState.sessionHub.lastSync.getTime()
      }
    };
  }
}