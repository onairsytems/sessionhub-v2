/**
 * IPC handlers for session progress tracking
 */

import { ipcMain, BrowserWindow } from 'electron';
import { SystemOrchestrator } from '@/src/core/orchestrator/SystemOrchestrator';
import { Logger } from '@/src/lib/logging/Logger';

export interface ProgressEvent {
  type: 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'retrying';
  sessionId: string;
  timestamp: string;
  data?: any;
}

export class ProgressHandlers {
  private readonly logger: Logger;
  private readonly orchestrator: SystemOrchestrator;
  private readonly progressSubscribers: Map<string, Set<number>> = new Map();

  constructor(orchestrator: SystemOrchestrator) {
    this.logger = new Logger('ProgressHandlers');
    this.orchestrator = orchestrator;
  }

  registerHandlers(): void {
    // Subscribe to progress events
    ipcMain.handle('progress:subscribe', async (event, sessionId: string) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!windowId) return false;

      // Add subscriber
      if (!this.progressSubscribers.has(sessionId)) {
        this.progressSubscribers.set(sessionId, new Set());
      }
      this.progressSubscribers.get(sessionId)!.add(windowId);

      // Start monitoring
      this.startProgressMonitoring(sessionId);

      this.logger.debug('Progress subscription added', { sessionId, windowId });
      return true;
    });

    // Unsubscribe from progress events
    ipcMain.handle('progress:unsubscribe', async (event, sessionId: string) => {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      if (!windowId) return false;

      const subscribers = this.progressSubscribers.get(sessionId);
      if (subscribers) {
        subscribers.delete(windowId);
        if (subscribers.size === 0) {
          this.progressSubscribers.delete(sessionId);
        }
      }

      this.logger.debug('Progress subscription removed', { sessionId, windowId });
      return true;
    });

    // Get session status
    ipcMain.handle('session:getStatus', async (_event, sessionId: string) => {
      try {
        const status = await this.orchestrator.getSessionStatus(sessionId);
        return { success: true, data: status };
      } catch (error) {
        this.logger.error('Failed to get session status', error as Error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Get session history
    ipcMain.handle('session:getHistory', async (_event, sessionId: string) => {
      try {
        const sessionStateManager = this.orchestrator.getSessionStateManager();
        const history = await sessionStateManager.getHistory(sessionId);
        return { success: true, data: history };
      } catch (error) {
        this.logger.error('Failed to get session history', error as Error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Get queue metrics
    ipcMain.handle('queue:getMetrics', async () => {
      try {
        const metrics = this.orchestrator.getQueueMetrics();
        return { success: true, data: metrics };
      } catch (error) {
        this.logger.error('Failed to get queue metrics', error as Error);
        return { success: false, error: (error as Error).message };
      }
    });
  }

  private startProgressMonitoring(sessionId: string): void {
    // Get instruction queue from orchestrator
    const actorCoordinator = this.orchestrator.getActorCoordinator();
    const instructionQueue = actorCoordinator.getInstructionQueue();

    // Subscribe to instruction events
    const eventStream = instructionQueue.getEventStream();
    
    // Process events
    (async () => {
      for await (const event of eventStream) {
        if (event.sessionId === sessionId) {
          this.broadcastProgressEvent({
            type: event.type as ProgressEvent['type'],
            sessionId: event.sessionId,
            timestamp: event.timestamp,
            data: event.data
          });
        }
      }
    })().catch(error => {
      this.logger.error('Error in progress monitoring', error);
    });
  }

  private broadcastProgressEvent(event: ProgressEvent): void {
    const subscribers = this.progressSubscribers.get(event.sessionId);
    if (!subscribers || subscribers.size === 0) return;

    subscribers.forEach(windowId => {
      const window = BrowserWindow.fromId(windowId);
      if (window && !window.isDestroyed()) {
        window.webContents.send(`progress:${event.sessionId}`, event);
      } else {
        // Clean up destroyed windows
        subscribers.delete(windowId);
      }
    });
  }

  /**
   * Manually emit a progress event (for testing or external triggers)
   */
  emitProgressEvent(event: ProgressEvent): void {
    this.broadcastProgressEvent(event);
  }

  /**
   * Clean up all subscriptions for a window
   */
  cleanupWindow(windowId: number): void {
    this.progressSubscribers.forEach((subscribers, sessionId) => {
      subscribers.delete(windowId);
      if (subscribers.size === 0) {
        this.progressSubscribers.delete(sessionId);
      }
    });
  }
}