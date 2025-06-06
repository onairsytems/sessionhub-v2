/**
 * @actor system
 * @responsibility Manages and persists system state across all components
 */

import { Logger } from '@/src/lib/logging/Logger';
import { Session } from './SessionManager';
import { Workflow } from './WorkflowEngine';
import { ActorState } from './ActorCoordinator';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemState {
  version: string;
  lastUpdated: string;
  sessions: Record<string, Session>;
  workflows: Record<string, Workflow>;
  actors: Record<string, ActorState>;
  metrics: SystemMetrics;
  configuration: SystemConfiguration;
}

export interface SystemMetrics {
  startTime: string;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export interface SystemConfiguration {
  maxConcurrentSessions: number;
  sessionTimeoutMs: number;
  apiRateLimit: number;
  retryAttempts: number;
  retryDelayMs: number;
  features: Record<string, boolean>;
}

export interface StateSnapshot {
  id: string;
  timestamp: string;
  state: SystemState;
  reason: string;
}

export class StateManager {
  private readonly logger: Logger;
  private readonly stateFilePath: string;
  private readonly snapshotDir: string;
  private currentState: SystemState;
  private readonly saveInterval: number = 60000; // 1 minute
  private saveTimer?: NodeJS.Timeout;

  constructor(
    logger: Logger,
    dataDir: string = './data'
  ) {
    this.logger = logger;
    this.stateFilePath = path.join(dataDir, 'system-state.json');
    this.snapshotDir = path.join(dataDir, 'snapshots');
    
    this.currentState = this.initializeState();
  }

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await this.ensureDirectories();
      
      // Load existing state if available
      await this.loadState();
      
      // Start auto-save timer
      this.startAutoSave();
      
      this.logger.info('StateManager initialized', {
        stateFile: this.stateFilePath,
        snapshotDir: this.snapshotDir
      });
    } catch (error) {
      this.logger.error('Failed to initialize StateManager', error as Error);
      throw error;
    }
  }

  /**
   * Get current system state
   */
  getState(): SystemState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * Update sessions in state
   */
  updateSessions(sessions: Record<string, Session>): void {
    this.currentState.sessions = { ...sessions };
    this.currentState.lastUpdated = new Date().toISOString();
  }

  /**
   * Update workflows in state
   */
  updateWorkflows(workflows: Record<string, Workflow>): void {
    this.currentState.workflows = { ...workflows };
    this.currentState.lastUpdated = new Date().toISOString();
  }

  /**
   * Update actors in state
   */
  updateActors(actors: Record<string, ActorState>): void {
    this.currentState.actors = { ...actors };
    this.currentState.lastUpdated = new Date().toISOString();
  }

  /**
   * Update system metrics
   */
  updateMetrics(updates: Partial<SystemMetrics>): void {
    this.currentState.metrics = {
      ...this.currentState.metrics,
      ...updates,
      uptime: Date.now() - new Date(this.currentState.metrics.startTime).getTime(),
      memoryUsage: process.memoryUsage()
    };
    this.currentState.lastUpdated = new Date().toISOString();
  }

  /**
   * Update system configuration
   */
  updateConfiguration(updates: Partial<SystemConfiguration>): void {
    this.currentState.configuration = {
      ...this.currentState.configuration,
      ...updates
    };
    this.currentState.lastUpdated = new Date().toISOString();
  }

  /**
   * Save current state to disk
   */
  async saveState(): Promise<void> {
    try {
      const stateJson = JSON.stringify(this.currentState, null, 2);
      await fs.writeFile(this.stateFilePath, stateJson, 'utf-8');
      
      this.logger.debug('State saved', {
        file: this.stateFilePath,
        size: stateJson.length
      });
    } catch (error) {
      this.logger.error('Failed to save state', error as Error);
      throw error;
    }
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<void> {
    try {
      const stateJson = await fs.readFile(this.stateFilePath, 'utf-8');
      const loadedState = JSON.parse(stateJson) as SystemState;
      
      // Merge with current state to preserve runtime data
      this.currentState = {
        ...this.currentState,
        ...loadedState,
        metrics: {
          ...this.currentState.metrics,
          ...loadedState.metrics,
          startTime: this.currentState.metrics.startTime,
          memoryUsage: process.memoryUsage()
        }
      };
      
      this.logger.info('State loaded', {
        file: this.stateFilePath,
        sessions: Object.keys(loadedState.sessions).length,
        workflows: Object.keys(loadedState.workflows).length
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.logger.info('No existing state file found, using initial state');
      } else {
        this.logger.error('Failed to load state', error as Error);
        throw error;
      }
    }
  }

  /**
   * Create a state snapshot
   */
  async createSnapshot(reason: string): Promise<StateSnapshot> {
    const snapshot: StateSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(this.currentState)),
      reason
    };

    try {
      const snapshotPath = path.join(
        this.snapshotDir,
        `snapshot_${snapshot.id}.json`
      );
      
      await fs.writeFile(
        snapshotPath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );
      
      this.logger.info('Snapshot created', {
        id: snapshot.id,
        reason,
        file: snapshotPath
      });
      
      return snapshot;
    } catch (error) {
      this.logger.error('Failed to create snapshot', error as Error);
      throw error;
    }
  }

  /**
   * Restore from a snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      const snapshotPath = path.join(
        this.snapshotDir,
        `snapshot_${snapshotId}.json`
      );
      
      const snapshotJson = await fs.readFile(snapshotPath, 'utf-8');
      const snapshot = JSON.parse(snapshotJson) as StateSnapshot;
      
      this.currentState = snapshot.state;
      await this.saveState();
      
      this.logger.info('State restored from snapshot', {
        id: snapshotId,
        timestamp: snapshot.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to restore snapshot', error as Error);
      throw error;
    }
  }

  /**
   * List available snapshots
   */
  async listSnapshots(): Promise<StateSnapshot[]> {
    try {
      const files = await fs.readdir(this.snapshotDir);
      const snapshotFiles = files.filter(f => f.startsWith('snapshot_'));
      
      const snapshots: StateSnapshot[] = [];
      
      for (const file of snapshotFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.snapshotDir, file),
            'utf-8'
          );
          snapshots.push(JSON.parse(content));
        } catch (error) {
          this.logger.warn('Failed to read snapshot file', { file });
        }
      }
      
      return snapshots.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      this.logger.error('Failed to list snapshots', error as Error);
      return [];
    }
  }

  /**
   * Clean up old snapshots
   */
  async cleanupSnapshots(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const snapshots = await this.listSnapshots();
    let cleaned = 0;
    
    for (const snapshot of snapshots) {
      if (new Date(snapshot.timestamp) < cutoffDate) {
        try {
          const snapshotPath = path.join(
            this.snapshotDir,
            `snapshot_${snapshot.id}.json`
          );
          await fs.unlink(snapshotPath);
          cleaned++;
        } catch (error) {
          this.logger.warn('Failed to delete snapshot', {
            id: snapshot.id,
            error
          });
        }
      }
    }
    
    this.logger.info('Cleaned up old snapshots', { count: cleaned });
    return cleaned;
  }

  /**
   * Export state for debugging
   */
  exportState(): string {
    return JSON.stringify(this.currentState, null, 2);
  }

  /**
   * Import state (use with caution)
   */
  async importState(stateJson: string): Promise<void> {
    try {
      const importedState = JSON.parse(stateJson) as SystemState;
      
      // Validate state structure
      if (!importedState.version || !importedState.sessions || !importedState.workflows) {
        throw new Error('Invalid state structure');
      }
      
      // Create snapshot before import
      await this.createSnapshot('Before import');
      
      this.currentState = importedState;
      await this.saveState();
      
      this.logger.info('State imported successfully');
    } catch (error) {
      this.logger.error('Failed to import state', error as Error);
      throw error;
    }
  }

  /**
   * Shutdown the state manager
   */
  async shutdown(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    
    await this.saveState();
    await this.createSnapshot('System shutdown');
    
    this.logger.info('StateManager shutdown complete');
  }

  private initializeState(): SystemState {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      sessions: {},
      workflows: {},
      actors: {},
      metrics: {
        startTime: new Date().toISOString(),
        uptime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        activeConnections: 0,
        memoryUsage: process.memoryUsage()
      },
      configuration: {
        maxConcurrentSessions: 5,
        sessionTimeoutMs: 3600000, // 1 hour
        apiRateLimit: 100,
        retryAttempts: 3,
        retryDelayMs: 1000,
        features: {
          autoSave: true,
          snapshots: true,
          metrics: true,
          audit: true
        }
      }
    };
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });
    await fs.mkdir(this.snapshotDir, { recursive: true });
  }

  private startAutoSave(): void {
    if (this.currentState.configuration.features.autoSave) {
      this.saveTimer = setInterval(async () => {
        try {
          await this.saveState();
        } catch (error) {
          this.logger.error('Auto-save failed', error as Error);
        }
      }, this.saveInterval);
    }
  }

  private generateSnapshotId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}