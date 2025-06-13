import { EventEmitter } from 'events';
import { SessionStatus, SessionPriority } from '../../models/Session';
import { SessionManager } from '../../core/orchestrator/SessionManager';
// import { InstructionQueue } from '../../core/orchestrator/InstructionQueue';
// import { SessionExecutionPipeline } from '@/services/session/SessionExecutionPipeline';
// import { LocalCacheService } from '@/services/cache/LocalCacheService';

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
  request: any; // Will fix this later
  instructions?: any; // Will fix this later
  result?: any; // Will fix this later
  error?: any; // Will fix this later
  metadata: any; // Will fix this later
  
  // Queue-specific properties
  queuePosition: number;
  estimatedWaitTime: number;
  addedToQueueAt: Date;
  priority: SessionPriority;
}

export interface QueueMetrics {
  totalQueued: number;
  activeCount: number;
  pausedCount: number;
  completedToday: number;
  failedToday: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughputPerHour: number;
}

export interface QueueState {
  isPaused: boolean;
  sessions: QueuedSession[];
  metrics: QueueMetrics;
  lastUpdated: Date;
}

export type QueueEventType = 
  | 'session-added'
  | 'session-removed'
  | 'session-moved'
  | 'session-started'
  | 'session-completed'
  | 'session-failed'
  | 'queue-paused'
  | 'queue-resumed'
  | 'metrics-updated'
  | 'state-changed';

export interface QueueEvent {
  type: QueueEventType;
  sessionId?: string;
  data?: any;
  timestamp: Date;
}

export class SessionQueueManager extends EventEmitter {
  private static instance: SessionQueueManager;
  private sessionManager: SessionManager;
  // private _instructionQueue: InstructionQueue;
  // private cacheService: LocalCacheService;
  private queueState: QueueState;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.sessionManager = SessionManager.getInstance();
    // this._instructionQueue = InstructionQueue.getInstance();
    // Using instructionQueue for queue processing
    // this.cacheService = LocalCacheService.getInstance();
    
    this.queueState = {
      isPaused: false,
      sessions: [],
      metrics: this.createEmptyMetrics(),
      lastUpdated: new Date()
    };

    this.initialize();
  }

  static getInstance(): SessionQueueManager {
    if (!SessionQueueManager.instance) {
      SessionQueueManager.instance = new SessionQueueManager();
    }
    return SessionQueueManager.instance;
  }

  private async initialize() {
    await this.loadPersistedState();
    this.startMetricsUpdater();
    this.startQueueProcessor();
    this.setupEventListeners();
  }

  private createEmptyMetrics(): QueueMetrics {
    return {
      totalQueued: 0,
      activeCount: 0,
      pausedCount: 0,
      completedToday: 0,
      failedToday: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughputPerHour: 0
    };
  }

  private async loadPersistedState() {
    try {
      // TODO: Implement cache service integration
      // const persistedState = await this.cacheService.get('queue-state');
      // For now, start with empty state
    } catch (error) {
      // Failed to load persisted queue state
    }
  }

  private async persistState() {
    try {
      // TODO: Implement cache service integration
      // await this.cacheService.set('queue-state', JSON.stringify(this.queueState));
    } catch (error) {
      // Failed to persist queue state
    }
  }

  private setupEventListeners() {
    // TODO: Implement proper event listeners when SessionManager events are ready
    // this.sessionManager.on('session-created', (session: any) => {
    //   if (session.status === 'pending') {
    //     this.addToQueue(session);
    //   }
    // });

    // this.sessionManager.on('session-updated', (session: any) => {
    //   this.updateSessionInQueue(session);
    // });

    // this.instructionQueue.on('instruction-completed', () => {
    //   this.updateMetrics();
    // });

    // this.instructionQueue.on('instruction-failed', () => {
    //   this.updateMetrics();
    // });
  }

  private startMetricsUpdater() {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update every 5 seconds
  }

  private startQueueProcessor() {
    this.processingInterval = setInterval(() => {
      if (!this.queueState.isPaused) {
        this.processQueue();
      }
    }, 1000); // Check every second
  }

  private async processQueue() {
    const availableSlots = this.sessionManager.getAvailableSlots();
    if (availableSlots <= 0) return;

    const pendingSessions = this.queueState.sessions
      .filter(s => s.status === 'pending')
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority);
        }
        return a.queuePosition - b.queuePosition;
      })
      .slice(0, availableSlots);

    for (const session of pendingSessions) {
      await this.startSession(session.id);
    }
  }

  private getPriorityValue(priority: SessionPriority): number {
    const values: Record<SessionPriority, number> = {
      critical: 1000,
      high: 100,
      medium: 10,
      low: 1
    };
    return values[priority] || 1;
  }

  async addToQueue(session: any): Promise<void> {
    const queuedSession: QueuedSession = {
      id: session.id,
      name: session.name,
      description: session.description,
      objective: session.objective,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      userId: session.userId,
      projectId: session.projectId,
      request: session.request,
      instructions: session.instructions,
      result: session.result,
      error: session.error,
      metadata: session.metadata,
      queuePosition: this.queueState.sessions.length + 1,
      estimatedWaitTime: this.calculateEstimatedWaitTime(),
      addedToQueueAt: new Date(),
      priority: session.metadata?.priority || 'medium'
    };

    this.queueState.sessions.push(queuedSession);
    this.updateQueuePositions();
    await this.persistState();

    this.emitEvent({
      type: 'session-added',
      sessionId: session.id,
      data: queuedSession,
      timestamp: new Date()
    });
  }

  async removeFromQueue(sessionId: string): Promise<void> {
    const index = this.queueState.sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return;

    const [removed] = this.queueState.sessions.splice(index, 1);
    this.updateQueuePositions();
    await this.persistState();

    this.emitEvent({
      type: 'session-removed',
      sessionId,
      data: removed,
      timestamp: new Date()
    });
  }

  async moveSession(sessionId: string, newPosition: number): Promise<void> {
    const sessionIndex = this.queueState.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return;

    const [session] = this.queueState.sessions.splice(sessionIndex, 1);
    if (session) {
      this.queueState.sessions.splice(newPosition - 1, 0, session);
    }
    this.updateQueuePositions();
    await this.persistState();

    this.emitEvent({
      type: 'session-moved',
      sessionId,
      data: { oldPosition: sessionIndex + 1, newPosition },
      timestamp: new Date()
    });
  }

  async updatePriority(sessionId: string, priority: SessionPriority): Promise<void> {
    const session = this.queueState.sessions.find(s => s.id === sessionId);
    if (!session) return;

    session.priority = priority;
    await this.sessionManager.updateSession(sessionId, {
      metadata: { ...session.metadata, priority }
    });
    await this.persistState();

    this.emitEvent({
      type: 'session-moved',
      sessionId,
      data: { priority },
      timestamp: new Date()
    });
  }

  async pauseQueue(): Promise<void> {
    this.queueState.isPaused = true;
    await this.persistState();

    this.emitEvent({
      type: 'queue-paused',
      timestamp: new Date()
    });
  }

  async resumeQueue(): Promise<void> {
    this.queueState.isPaused = false;
    await this.persistState();

    this.emitEvent({
      type: 'queue-resumed',
      timestamp: new Date()
    });
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, { status: 'cancelled' });
    await this.removeFromQueue(sessionId);
  }

  async cancelMultipleSessions(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      await this.cancelSession(sessionId);
    }
  }

  private async startSession(sessionId: string): Promise<void> {
    const session = this.queueState.sessions.find(s => s.id === sessionId);
    if (!session) return;

    await this.sessionManager.updateSession(sessionId, { status: 'executing' });
    
    this.emitEvent({
      type: 'session-started',
      sessionId,
      timestamp: new Date()
    });

    // TODO: Implement session execution pipeline
    // const pipeline = new SessionExecutionPipeline(sessionId);
    // pipeline.execute().then(() => {
    //   this.emitEvent({
    //     type: 'session-completed',
    //     sessionId,
    //     timestamp: new Date()
    //   });
    //   this.removeFromQueue(sessionId);
    // }).catch((error) => {
    //   this.emitEvent({
    //     type: 'session-failed',
    //     sessionId,
    //     data: { error: error.message },
    //     timestamp: new Date()
    //   });
    // });
  }

  // Removed unused updateSessionInQueue method

  private updateQueuePositions() {
    this.queueState.sessions.forEach((session, index) => {
      session.queuePosition = index + 1;
      session.estimatedWaitTime = this.calculateEstimatedWaitTime(index);
    });
  }

  private calculateEstimatedWaitTime(position: number = 0): number {
    const avgProcessingTime = this.queueState.metrics.averageProcessingTime || 300; // 5 minutes default
    // TODO: Implement proper session manager methods// 
    // const activeSessions = 0; // this.sessionManager.getActiveSessions().length;
    const maxConcurrent = 3; // this.sessionManager.getMaxConcurrentSessions();
    
    const sessionsAhead = position;
    const waves = Math.ceil(sessionsAhead / maxConcurrent);
    
    return waves * avgProcessingTime;
  }

  private async updateMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // TODO: Implement proper session manager methods
    const allSessions: any[] = []; // await this.sessionManager.getAllSessions();
    const todaysSessions = allSessions.filter((s: any) => 
      new Date(s.updatedAt) >= todayStart
    );

    const completedToday = todaysSessions.filter((s: any) => s.status === 'completed').length;
    const failedToday = todaysSessions.filter((s: any) => s.status === 'failed').length;
    
    const metrics: QueueMetrics = {
      totalQueued: this.queueState.sessions.filter(s => s.status === 'pending').length,
      activeCount: 0, // this.sessionManager.getActiveSessions().length,
      pausedCount: this.queueState.sessions.filter(s => s.status === 'paused').length,
      completedToday,
      failedToday,
      averageWaitTime: this.calculateAverageWaitTime(),
      averageProcessingTime: this.calculateAverageProcessingTime(todaysSessions),
      throughputPerHour: this.calculateThroughput(todaysSessions)
    };

    this.queueState.metrics = metrics;
    this.queueState.lastUpdated = now;
    await this.persistState();

    this.emitEvent({
      type: 'metrics-updated',
      data: metrics,
      timestamp: now
    });
  }

  private calculateAverageWaitTime(): number {// 
    const activeSessions = this.queueState.sessions.filter(s => 
      s.status === 'executing' || s.status === 'completed'
    );
    
    if (activeSessions.length === 0) return 0;
    
    const totalWaitTime = activeSessions.reduce((sum, session) => {
      const startTime = new Date(session.updatedAt).getTime();
      const queueTime = new Date(session.addedToQueueAt).getTime();
      return sum + (startTime - queueTime);
    }, 0);
    
    return Math.round(totalWaitTime / activeSessions.length / 1000); // Convert to seconds
  }

  private calculateAverageProcessingTime(sessions: any[]): number {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    if (completedSessions.length === 0) return 300; // 5 minutes default
    
    const totalTime = completedSessions.reduce((sum, session) => {
      const duration = session.metadata?.executionTime || 300;
      return sum + duration;
    }, 0);
    
    return Math.round(totalTime / completedSessions.length);
  }

  private calculateThroughput(sessions: any[]): number {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const hoursElapsed = (Date.now() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60);
    
    if (hoursElapsed === 0) return 0;
    return Math.round(completedSessions.length / hoursElapsed * 10) / 10;
  }

  getQueueState(): QueueState {
    return { ...this.queueState };
  }

  getSession(sessionId: string): QueuedSession | undefined {
    return this.queueState.sessions.find(s => s.id === sessionId);
  }

  streamQueueUpdates(): AsyncGenerator<QueueEvent> {
    return this.createEventStream();
  }

  private async *createEventStream(): AsyncGenerator<QueueEvent> {
    const eventQueue: QueueEvent[] = [];
    
    const handleEvent = (event: QueueEvent) => {
      eventQueue.push(event);
    };

    this.on('queue-event', handleEvent);

    try {
      while (true) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.off('queue-event', handleEvent);
    }
  }

  private emitEvent(event: QueueEvent) {
    this.emit('queue-event', event);
    this.emit(event.type, event);
  }

  destroy() {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.removeAllListeners();
  }
}