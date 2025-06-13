import { EventEmitter } from 'events';
import { SessionStatus, SessionPriority } from '../../models/Session';

export interface QueuedSession {
  // Session base properties
  id: string;
  name: string;
  description: string;
  objective?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  userId: string;
  projectId: string;
  request: any;
  instructions?: any;
  result?: any;
  error?: any;
  metadata: any;
  
  // Queue-specific properties
  queuePosition: number;
  estimatedWaitTime: number;
  addedToQueueAt: Date;
  priority: SessionPriority;
  executionStartTime?: Date;
  executionDuration?: number;
}

export interface QueueState {
  sessions: QueuedSession[];
  isPaused: boolean;
  isProcessing: boolean;
  metrics: QueueMetrics;
}

export interface QueueMetrics {
  totalSessions: number;
  pendingSessions: number;
  executingSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number;
  successRate: number;
  // Additional properties required by QueueMetricsPanel
  totalQueued: number;
  activeCount: number;
  pausedCount: number;
  completedToday: number;
  failedToday: number;
  averageProcessingTime: number;
  throughputPerHour: number;
}

export interface QueueEvent {
  type: 'session-added' | 'session-removed' | 'session-started' | 'session-completed' | 
        'session-failed' | 'queue-paused' | 'queue-resumed' | 'state-changed' | 
        'metrics-updated' | 'position-changed';
  sessionId?: string;
  data?: any;
  timestamp: Date;
}

/**
 * Client-side Session Queue Manager
 * This is a client-safe version that doesn't import server-side modules
 */
export class SessionQueueManagerClient extends EventEmitter {
  private static instance: SessionQueueManagerClient;
  private queueState: QueueState = {
    sessions: [],
    isPaused: false,
    isProcessing: false,
    metrics: {
      totalSessions: 0,
      pendingSessions: 0,
      executingSessions: 0,
      completedSessions: 0,
      failedSessions: 0,
      averageWaitTime: 0,
      averageExecutionTime: 0,
      throughput: 0,
      successRate: 0,
      totalQueued: 0,
      activeCount: 0,
      pausedCount: 0,
      completedToday: 0,
      failedToday: 0,
      averageProcessingTime: 0,
      throughputPerHour: 0
    }
  };

  private constructor() {
    super();
  }

  static getInstance(): SessionQueueManagerClient {
    if (!SessionQueueManagerClient.instance) {
      SessionQueueManagerClient.instance = new SessionQueueManagerClient();
    }
    return SessionQueueManagerClient.instance;
  }

  /**
   * Get current queue state
   */
  getQueueState(): QueueState {
    return { ...this.queueState };
  }

  /**
   * Add session to queue (client-side mock)
   */
  async addSession(session: Partial<QueuedSession>): Promise<void> {
    // In a real implementation, this would make an API call
    console.log('Adding session to queue:', session);
    this.emitQueueEvent({
      type: 'session-added',
      sessionId: session.id,
      timestamp: new Date()
    });
  }

  /**
   * Cancel a session (client-side mock)
   */
  async cancelSession(sessionId: string): Promise<void> {
    console.log('Cancelling session:', sessionId);
    this.emitQueueEvent({
      type: 'session-removed',
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Cancel multiple sessions (client-side mock)
   */
  async cancelMultipleSessions(sessionIds: string[]): Promise<void> {
    console.log('Cancelling sessions:', sessionIds);
    sessionIds.forEach(id => {
      this.emitQueueEvent({
        type: 'session-removed',
        sessionId: id,
        timestamp: new Date()
      });
    });
  }

  /**
   * Update session priority (client-side mock)
   */
  async updatePriority(sessionId: string, priority: SessionPriority): Promise<void> {
    console.log('Updating priority:', sessionId, priority);
    this.emitQueueEvent({
      type: 'position-changed',
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Move session position (client-side mock)
   */
  async moveSession(sessionId: string, newPosition: number): Promise<void> {
    console.log('Moving session:', sessionId, 'to position:', newPosition);
    this.emitQueueEvent({
      type: 'position-changed',
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Pause queue (client-side mock)
   */
  async pauseQueue(): Promise<void> {
    console.log('Pausing queue');
    this.queueState.isPaused = true;
    this.emitQueueEvent({
      type: 'queue-paused',
      timestamp: new Date()
    });
  }

  /**
   * Resume queue (client-side mock)
   */
  async resumeQueue(): Promise<void> {
    console.log('Resuming queue');
    this.queueState.isPaused = false;
    this.emitQueueEvent({
      type: 'queue-resumed',
      timestamp: new Date()
    });
  }

  private emitQueueEvent(event: QueueEvent): void {
    this.emit('queue-event', event);
    this.emit(event.type, event);
  }
}