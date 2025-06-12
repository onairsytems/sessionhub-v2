/**
 * @actor system
 * @responsibility Automatic session state preservation with 30-second intervals
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { SessionPersistenceService } from '../session/SessionPersistenceService';

export interface AutoSaveConfig {
  intervalMs: number;
  enabled: boolean;
  maxRetries: number;
  pauseOnUserActivity: boolean;
  compressionEnabled: boolean;
}

export interface SessionState {
  sessionId: string;
  state: any;
  metadata: any;
  lastModified: Date;
  checksum: string;
}

export interface AutoSaveStatus {
  isRunning: boolean;
  lastSaveTime: Date | null;
  nextSaveTime: Date | null;
  saveCount: number;
  errors: string[];
  isPaused: boolean;
}

export class AutoSaveService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly persistenceService: SessionPersistenceService;
  
  private config: AutoSaveConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private activeSessions: Map<string, SessionState> = new Map();
  private status: AutoSaveStatus;
  private isProcessing = false;
  private retryQueue: string[] = [];

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    persistenceService: SessionPersistenceService,
    config?: Partial<AutoSaveConfig>
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.persistenceService = persistenceService;
    
    this.config = {
      intervalMs: 30000, // 30 seconds
      enabled: true,
      maxRetries: 3,
      pauseOnUserActivity: true,
      compressionEnabled: true,
      ...config
    };

    this.status = {
      isRunning: false,
      lastSaveTime: null,
      nextSaveTime: null,
      saveCount: 0,
      errors: [],
      isPaused: false
    };

    this.logger.info('AutoSaveService initialized', {
      interval: this.config.intervalMs,
      enabled: this.config.enabled
    });
  }

  /**
   * Start auto-save service
   */
  start(): void {
    if (this.status.isRunning) {
      this.logger.warn('AutoSave already running');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('AutoSave disabled by configuration');
      return;
    }

    this.intervalId = setInterval(() => {
      this.performAutoSave();
    }, this.config.intervalMs);

    this.status.isRunning = true;
    this.status.nextSaveTime = new Date(Date.now() + this.config.intervalMs);

    this.logger.info('AutoSave service started', {
      interval: this.config.intervalMs,
      nextSave: this.status.nextSaveTime
    });

    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'AutoSaveService' },
      operation: {
        type: 'autosave.start',
        description: 'Auto-save service started',
        input: { interval: this.config.intervalMs }
      },
      result: { status: 'success', duration: Date.now() - Date.now() },
      metadata: { correlationId: this.generateCorrelationId() }
    });
  }

  /**
   * Stop auto-save service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.status.isRunning = false;
    this.status.nextSaveTime = null;

    this.logger.info('AutoSave service stopped');

    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'AutoSaveService' },
      operation: {
        type: 'autosave.stop',
        description: 'Auto-save service stopped',
        input: {}
      },
      result: { status: 'success', duration: Date.now() - Date.now() },
      metadata: { correlationId: this.generateCorrelationId() }
    });
  }

  /**
   * Pause auto-save temporarily
   */
  pause(): void {
    this.status.isPaused = true;
    this.logger.info('AutoSave paused');
  }

  /**
   * Resume auto-save
   */
  resume(): void {
    this.status.isPaused = false;
    this.logger.info('AutoSave resumed');
  }

  /**
   * Register session for auto-save monitoring
   */
  registerSession(sessionId: string, state: any, metadata: any): void {
    const sessionState: SessionState = {
      sessionId,
      state,
      metadata,
      lastModified: new Date(),
      checksum: this.generateChecksum(state)
    };

    this.activeSessions.set(sessionId, sessionState);

    this.logger.debug('Session registered for auto-save', {
      sessionId,
      checksum: sessionState.checksum
    });
  }

  /**
   * Update session state
   */
  updateSession(sessionId: string, state: any, metadata?: any): void {
    const existing = this.activeSessions.get(sessionId);
    if (!existing) {
      this.logger.warn('Attempted to update unregistered session', { sessionId });
      return;
    }

    const newChecksum = this.generateChecksum(state);
    
    // Only update if state has actually changed
    if (newChecksum !== existing.checksum) {
      existing.state = state;
      existing.metadata = { ...existing.metadata, ...metadata };
      existing.lastModified = new Date();
      existing.checksum = newChecksum;

      this.logger.debug('Session state updated', {
        sessionId,
        checksum: newChecksum
      });
    }
  }

  /**
   * Unregister session from auto-save
   */
  unregisterSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.logger.debug('Session unregistered from auto-save', { sessionId });
  }

  /**
   * Perform auto-save operation
   */
  private async performAutoSave(): Promise<void> {
    if (this.isProcessing || this.status.isPaused) {
      return;
    }

    if (this.activeSessions.size === 0) {
      this.logger.debug('No active sessions to save');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      await this.processSessions();
      await this.processRetryQueue();

      this.status.lastSaveTime = new Date();
      this.status.nextSaveTime = new Date(Date.now() + this.config.intervalMs);
      this.status.saveCount++;

      this.logger.debug('Auto-save completed', {
        sessionsProcessed: this.activeSessions.size,
        duration: Date.now() - startTime
      });

    } catch (error) {
      this.logger.error('Auto-save failed', error as Error);
      this.status.errors.push(`Auto-save failed: ${(error as Error).message}`);
      
      // Keep only last 10 errors
      if (this.status.errors.length > 10) {
        this.status.errors = this.status.errors.slice(-10);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process all active sessions
   */
  private async processSessions(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [sessionId, sessionState] of this.activeSessions) {
      promises.push(this.saveSession(sessionId, sessionState));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Save individual session
   */
  private async saveSession(sessionId: string, sessionState: SessionState): Promise<void> {
    try {
      // Persist session state
      await this.persistenceService.persistSession(
        sessionId,
        sessionState.state,
        sessionState.metadata
      );

      // Create checkpoint if needed
      await this.persistenceService.createCheckpoint(
        sessionId,
        sessionState.metadata?.phase || 'auto-save',
        sessionState.state,
        true
      );

      this.logger.debug('Session auto-saved', {
        sessionId,
        checksum: sessionState.checksum
      });

    } catch (error) {
      this.logger.error('Failed to save session', error as Error, { sessionId });
      
      // Add to retry queue if not already there
      if (!this.retryQueue.includes(sessionId)) {
        this.retryQueue.push(sessionId);
      }
      
      throw error;
    }
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) {
      return;
    }

    const toRetry = [...this.retryQueue];
    this.retryQueue = [];

    for (const sessionId of toRetry) {
      const sessionState = this.activeSessions.get(sessionId);
      if (sessionState) {
        try {
          await this.saveSession(sessionId, sessionState);
          this.logger.info('Session retry successful', { sessionId });
        } catch (error) {
          this.logger.error('Session retry failed', error as Error, { sessionId });
          // Don't re-add to retry queue to avoid infinite loops
        }
      }
    }
  }

  /**
   * Force immediate save of all sessions
   */
  async forceSave(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Auto-save already in progress, skipping force save');
      return;
    }

    this.logger.info('Force save initiated');
    await this.performAutoSave();
  }

  /**
   * Get auto-save status
   */
  getStatus(): AutoSaveStatus {
    return { ...this.status };
  }

  /**
   * Get configuration
   */
  getConfig(): AutoSaveConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoSaveConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart if interval changed and service is running
    if (oldConfig.intervalMs !== this.config.intervalMs && this.status.isRunning) {
      this.stop();
      this.start();
    }

    this.logger.info('AutoSave configuration updated', {
      oldConfig,
      newConfig: this.config
    });
  }

  /**
   * Get active sessions summary
   */
  getActiveSessionsSummary(): Array<{
    sessionId: string;
    lastModified: Date;
    checksum: string;
  }> {
    return Array.from(this.activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      lastModified: session.lastModified,
      checksum: session.checksum
    }));
  }

  /**
   * Generate checksum for state
   */
  private generateChecksum(state: any): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(state))
      .digest('hex')
      .substr(0, 8);
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}