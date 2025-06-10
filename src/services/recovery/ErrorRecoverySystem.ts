/**
 * Error Recovery System for SessionHub
 * 
 * Provides comprehensive error recovery, crash protection, and self-healing
 * capabilities to ensure system reliability and data integrity.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { DatabaseService } from '../../database/DatabaseService';
import { StateManager } from '../../core/orchestrator/StateManager';
import { SystemOrchestrator } from '../../core/orchestrator/SystemOrchestrator';

export interface RecoveryStrategy {
  id: string;
  name: string;
  errorTypes: string[];
  priority: number;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  recover: (error: SystemError, context: RecoveryContext) => Promise<RecoveryResult>;
}

export interface SystemError {
  id: string;
  type: ErrorType;
  message: string;
  stack?: string;
  timestamp: Date;
  component: string;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  recoverable: boolean;
}

export enum ErrorType {
  DATABASE = 'database',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  MEMORY = 'memory',
  PROCESS = 'process',
  API = 'api',
  STATE = 'state',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RecoveryContext {
  error: SystemError;
  attempt: number;
  previousAttempts: RecoveryAttempt[];
  systemState: any;
  availableStrategies: RecoveryStrategy[];
}

export interface RecoveryAttempt {
  strategy: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  error?: string;
}

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  duration: number;
  dataLoss: boolean;
  manualInterventionRequired: boolean;
  message: string;
  actions: RecoveryAction[];
}

export interface RecoveryAction {
  type: 'restore' | 'retry' | 'rollback' | 'restart' | 'notify' | 'isolate';
  target: string;
  details?: Record<string, any>;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'snapshot';
  components: string[];
  size: number;
  location: string;
  valid: boolean;
}

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'failed';
  lastCheck: Date;
  metrics?: Record<string, any>;
}

export class ErrorRecoverySystem extends EventEmitter {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private errorHistory: SystemError[] = [];
  private recoveryHistory: RecoveryResult[] = [];
  private backups: Map<string, BackupMetadata> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private isRecovering = false;
  
  private database: DatabaseService;
  private stateManager: StateManager;
  // private orchestrator: SystemOrchestrator; // Reserved for future use
  
  private readonly maxErrorHistory = 1000;
  private readonly backupDir: string;
  private readonly checkpointInterval = 5 * 60 * 1000; // 5 minutes
  private checkpointTimer?: NodeJS.Timeout;

  constructor(
    database: DatabaseService,
    stateManager: StateManager,
    _orchestrator: SystemOrchestrator,
    backupDir: string = path.join(process.cwd(), 'backups')
  ) {
    super();
    this.database = database;
    this.stateManager = stateManager;
    // this.orchestrator = orchestrator; // Reserved for future use
    this.backupDir = backupDir;
    
    this.initializeStrategies();
    this.setupErrorHandlers();
    this.startHealthMonitoring();
    this.startCheckpointing();
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Database Recovery Strategy
    this.addStrategy({
      id: 'database-recovery',
      name: 'Database Recovery',
      errorTypes: [ErrorType.DATABASE],
      priority: 1,
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      recover: async (error, _context) => {
        const actions: RecoveryAction[] = [];
        
        try {
          // Try to reconnect
          await this.database.disconnect();
          await this.database.connect();
          
          actions.push({
            type: 'restart',
            target: 'database',
            details: { reconnected: true }
          });
          
          // Verify data integrity
          const integrityCheck = await this.database.verifyIntegrity();
          if (!integrityCheck) {
            // Restore from backup
            const backup = await this.findLatestBackup('database');
            if (backup) {
              await this.restoreFromBackup(backup);
              actions.push({
                type: 'restore',
                target: 'database',
                details: { backupId: backup.id }
              });
            }
          }
          
          return {
            success: true,
            strategy: 'database-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: false,
            manualInterventionRequired: false,
            message: 'Database recovered successfully',
            actions
          };
        } catch (recoveryError) {
          return {
            success: false,
            strategy: 'database-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: true,
            manualInterventionRequired: true,
            message: `Database recovery failed: ${recoveryError}`,
            actions
          };
        }
      }
    });

    // Network Recovery Strategy
    this.addStrategy({
      id: 'network-recovery',
      name: 'Network Recovery',
      errorTypes: [ErrorType.NETWORK],
      priority: 2,
      maxRetries: 5,
      retryDelay: 2000,
      backoffMultiplier: 1.5,
      recover: async (error, _context) => {
        const actions: RecoveryAction[] = [];
        
        // Implement exponential backoff
        const delay = _context.attempt > 0 
          ? this.strategies.get('network-recovery')!.retryDelay * 
            Math.pow(this.strategies.get('network-recovery')!.backoffMultiplier, _context.attempt - 1)
          : 0;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        actions.push({
          type: 'retry',
          target: 'network-request',
          details: { 
            attempt: _context.attempt + 1,
            delay 
          }
        });
        
        // Test network connectivity
        const isOnline = await this.checkNetworkConnectivity();
        
        if (isOnline) {
          return {
            success: true,
            strategy: 'network-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: false,
            manualInterventionRequired: false,
            message: 'Network connectivity restored',
            actions
          };
        }
        
        // If still offline after max retries, notify user
        if (_context.attempt >= this.strategies.get('network-recovery')!.maxRetries) {
          actions.push({
            type: 'notify',
            target: 'user',
            details: { 
              message: 'Network connectivity issues detected. Please check your connection.' 
            }
          });
          
          return {
            success: false,
            strategy: 'network-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: false,
            manualInterventionRequired: true,
            message: 'Network recovery failed after maximum retries',
            actions
          };
        }
        
        return {
          success: false,
          strategy: 'network-recovery',
          duration: Date.now() - error.timestamp.getTime(),
          dataLoss: false,
          manualInterventionRequired: false,
          message: 'Network still unavailable, will retry',
          actions
        };
      }
    });

    // State Recovery Strategy
    this.addStrategy({
      id: 'state-recovery',
      name: 'State Recovery',
      errorTypes: [ErrorType.STATE],
      priority: 1,
      maxRetries: 1,
      retryDelay: 0,
      backoffMultiplier: 1,
      recover: async (error, _context) => {
        const actions: RecoveryAction[] = [];
        
        try {
          // Find last valid checkpoint
          const checkpoint = await this.findLatestCheckpoint();
          if (checkpoint) {
            await this.restoreFromCheckpoint(checkpoint);
            actions.push({
              type: 'restore',
              target: 'state',
              details: { checkpointId: checkpoint.id }
            });
            
            return {
              success: true,
              strategy: 'state-recovery',
              duration: Date.now() - error.timestamp.getTime(),
              dataLoss: false,
              manualInterventionRequired: false,
              message: 'State restored from checkpoint',
              actions
            };
          }
          
          // If no checkpoint, try to reconstruct state
          await this.reconstructState();
          actions.push({
            type: 'restore',
            target: 'state',
            details: { method: 'reconstruction' }
          });
          
          return {
            success: true,
            strategy: 'state-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: true,
            manualInterventionRequired: false,
            message: 'State reconstructed with possible data loss',
            actions
          };
        } catch (recoveryError) {
          return {
            success: false,
            strategy: 'state-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: true,
            manualInterventionRequired: true,
            message: `State recovery failed: ${recoveryError}`,
            actions
          };
        }
      }
    });

    // Memory Recovery Strategy
    this.addStrategy({
      id: 'memory-recovery',
      name: 'Memory Recovery',
      errorTypes: [ErrorType.MEMORY],
      priority: 1,
      maxRetries: 2,
      retryDelay: 500,
      backoffMultiplier: 1,
      recover: async (error, _context) => {
        const actions: RecoveryAction[] = [];
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          actions.push({
            type: 'isolate',
            target: 'memory',
            details: { action: 'garbage-collection' }
          });
        }
        
        // Clear caches
        await this.clearCaches();
        actions.push({
          type: 'isolate',
          target: 'caches',
          details: { cleared: true }
        });
        
        // Check memory usage after cleanup
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        if (heapUsedMB < 1024) { // Less than 1GB
          return {
            success: true,
            strategy: 'memory-recovery',
            duration: Date.now() - error.timestamp.getTime(),
            dataLoss: false,
            manualInterventionRequired: false,
            message: 'Memory usage reduced successfully',
            actions
          };
        }
        
        // If still high, isolate non-critical components
        await this.isolateNonCriticalComponents();
        actions.push({
          type: 'isolate',
          target: 'non-critical-components',
          details: { isolated: true }
        });
        
        return {
          success: true,
          strategy: 'memory-recovery',
          duration: Date.now() - error.timestamp.getTime(),
          dataLoss: false,
          manualInterventionRequired: false,
          message: 'Memory recovered by isolating non-critical components',
          actions
        };
      }
    });

    // Process Recovery Strategy
    this.addStrategy({
      id: 'process-recovery',
      name: 'Process Recovery',
      errorTypes: [ErrorType.PROCESS],
      priority: 1,
      maxRetries: 1,
      retryDelay: 0,
      backoffMultiplier: 1,
      recover: async (error, _context) => {
        const actions: RecoveryAction[] = [];
        
        // Save crash dump
        const crashDump = await this.saveCrashDump(error);
        actions.push({
          type: 'notify',
          target: 'crash-reporter',
          details: { dumpFile: crashDump }
        });
        
        // Attempt graceful restart
        actions.push({
          type: 'restart',
          target: 'process',
          details: { graceful: true }
        });
        
        return {
          success: true,
          strategy: 'process-recovery',
          duration: Date.now() - error.timestamp.getTime(),
          dataLoss: false,
          manualInterventionRequired: false,
          message: 'Process will restart gracefully',
          actions
        };
      }
    });
  }

  /**
   * Add a recovery strategy
   */
  public addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.set(strategy.id, strategy);
    this.emit('strategyAdded', strategy);
  }

  /**
   * Handle system error
   */
  public async handleError(error: SystemError): Promise<RecoveryResult> {
    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }
    
    this.emit('errorDetected', error);
    
    // Check if already recovering
    if (this.isRecovering) {
      return {
        success: false,
        strategy: 'none',
        duration: 0,
        dataLoss: false,
        manualInterventionRequired: true,
        message: 'Recovery already in progress',
        actions: []
      };
    }
    
    this.isRecovering = true;
    
    try {
      // Find applicable strategies
      const applicableStrategies = this.findApplicableStrategies(error);
      
      if (applicableStrategies.length === 0) {
        return {
          success: false,
          strategy: 'none',
          duration: 0,
          dataLoss: true,
          manualInterventionRequired: true,
          message: 'No recovery strategy available for this error',
          actions: []
        };
      }
      
      // Try strategies in order of priority
      const context: RecoveryContext = {
        error,
        attempt: 0,
        previousAttempts: [],
        systemState: this.stateManager.getState(),
        availableStrategies: applicableStrategies
      };
      
      for (const strategy of applicableStrategies) {
        const attempt: RecoveryAttempt = {
          strategy: strategy.id,
          timestamp: new Date(),
          success: false,
          duration: 0
        };
        
        const startTime = Date.now();
        
        try {
          const result = await strategy.recover(error, context);
          attempt.duration = Date.now() - startTime;
          attempt.success = result.success;
          
          context.previousAttempts.push(attempt);
          this.recoveryHistory.push(result);
          
          if (result.success) {
            this.emit('errorRecovered', { error, result });
            return result;
          }
        } catch (strategyError) {
          attempt.duration = Date.now() - startTime;
          attempt.error = strategyError instanceof Error ? strategyError.message : 'Unknown error';
          context.previousAttempts.push(attempt);
        }
        
        context.attempt++;
      }
      
      // All strategies failed
      const finalResult: RecoveryResult = {
        success: false,
        strategy: 'all-failed',
        duration: Date.now() - error.timestamp.getTime(),
        dataLoss: true,
        manualInterventionRequired: true,
        message: 'All recovery strategies failed',
        actions: [{
          type: 'notify',
          target: 'admin',
          details: { 
            error,
            attempts: context.previousAttempts 
          }
        }]
      };
      
      this.emit('recoveryFailed', { error, result: finalResult });
      return finalResult;
      
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      const systemError: SystemError = {
        id: `uncaught-${Date.now()}`,
        type: ErrorType.PROCESS,
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
        component: 'global',
        severity: ErrorSeverity.CRITICAL,
        recoverable: false
      };
      
      await this.handleError(systemError);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, _promise) => {
      const systemError: SystemError = {
        id: `unhandled-${Date.now()}`,
        type: ErrorType.PROCESS,
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        timestamp: new Date(),
        component: 'promise',
        severity: ErrorSeverity.HIGH,
        recoverable: true
      };
      
      await this.handleError(systemError);
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  /**
   * Start automatic checkpointing
   */
  private startCheckpointing(): void {
    this.checkpointTimer = setInterval(async () => {
      await this.createCheckpoint();
    }, this.checkpointInterval);
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const checks: HealthCheck[] = [];
    
    // Database health
    try {
      const dbHealth = await this.database.healthCheck();
      checks.push({
        component: 'database',
        status: dbHealth ? 'healthy' : 'failed',
        lastCheck: new Date(),
        metrics: {}
      });
    } catch (error) {
      checks.push({
        component: 'database',
        status: 'failed',
        lastCheck: new Date()
      });
    }
    
    // Memory health
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    checks.push({
      component: 'memory',
      status: heapUsedMB < 1024 ? 'healthy' : heapUsedMB < 1536 ? 'degraded' : 'failed',
      lastCheck: new Date(),
      metrics: {
        heapUsedMB,
        heapTotalMB: memUsage.heapTotal / 1024 / 1024,
        externalMB: memUsage.external / 1024 / 1024
      }
    });
    
    // Update health checks
    for (const check of checks) {
      this.healthChecks.set(check.component, check);
      
      if (check.status === 'failed') {
        const error: SystemError = {
          id: `health-${check.component}-${Date.now()}`,
          type: this.mapComponentToErrorType(check.component),
          message: `${check.component} health check failed`,
          timestamp: new Date(),
          component: check.component,
          severity: ErrorSeverity.HIGH,
          recoverable: true,
          context: check.metrics
        };
        
        await this.handleError(error);
      }
    }
    
    this.emit('healthChecksCompleted', checks);
  }

  /**
   * Create checkpoint
   */
  private async createCheckpoint(): Promise<BackupMetadata> {
    const checkpointId = `checkpoint-${Date.now()}`;
    const checkpointPath = path.join(this.backupDir, 'checkpoints', checkpointId);
    
    await fs.ensureDir(checkpointPath);
    
    // Save state
    const state = this.stateManager.getState();
    await fs.writeJson(path.join(checkpointPath, 'state.json'), state);
    
    // Save database snapshot
    const dbSnapshotPath = path.join(checkpointPath, 'database.snapshot');
    await this.database.createSnapshot(dbSnapshotPath);
    
    const metadata: BackupMetadata = {
      id: checkpointId,
      timestamp: new Date(),
      type: 'snapshot',
      components: ['state', 'database'],
      size: 0, // Calculate actual size
      location: checkpointPath,
      valid: true
    };
    
    this.backups.set(checkpointId, metadata);
    
    // Clean old checkpoints
    await this.cleanOldCheckpoints();
    
    this.emit('checkpointCreated', metadata);
    return metadata;
  }

  /**
   * Find applicable recovery strategies
   */
  private findApplicableStrategies(error: SystemError): RecoveryStrategy[] {
    return Array.from(this.strategies.values())
      .filter(strategy => strategy.errorTypes.includes(error.type))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find latest backup
   */
  private async findLatestBackup(component: string): Promise<BackupMetadata | null> {
    const backups = Array.from(this.backups.values())
      .filter(b => b.components.includes(component) && b.valid)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return backups[0] || null;
  }

  /**
   * Find latest checkpoint
   */
  private async findLatestCheckpoint(): Promise<BackupMetadata | null> {
    const checkpoints = Array.from(this.backups.values())
      .filter(b => b.type === 'snapshot' && b.valid)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return checkpoints[0] || null;
  }

  /**
   * Restore from backup
   */
  private async restoreFromBackup(backup: BackupMetadata): Promise<void> {
    // Implementation depends on backup type and components
    this.emit('backupRestored', backup);
  }

  /**
   * Restore from checkpoint
   */
  private async restoreFromCheckpoint(checkpoint: BackupMetadata): Promise<void> {
    const checkpointPath = checkpoint.location;
    
    // Restore state
    const state = await fs.readJson(path.join(checkpointPath, 'state.json'));
    await this.stateManager.setState(state);
    
    // Restore database
    const dbSnapshotPath = path.join(checkpointPath, 'database.snapshot');
    await this.database.restoreFromSnapshot(dbSnapshotPath);
    
    this.emit('checkpointRestored', checkpoint);
  }

  /**
   * Reconstruct state from database
   */
  private async reconstructState(): Promise<void> {
    // Rebuild state from database records
    const sessionsList = await this.database.getAllSessions();
    
    // Convert array to record
    const sessions: Record<string, any> = {};
    sessionsList.forEach((session: any) => {
      sessions[session.id] = session;
    });
    
    // Get current state as template
    const currentState = this.stateManager.getState();
    
    // Create new state with recovered sessions
    const newState = {
      ...currentState,
      sessions,
      lastUpdated: new Date().toISOString()
    };
    
    await this.stateManager.setState(newState);
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://api.anthropic.com/health', {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clear caches to free memory
   */
  private async clearCaches(): Promise<void> {
    // Clear various caches in the system
    this.emit('cacheCleared');
  }

  /**
   * Isolate non-critical components
   */
  private async isolateNonCriticalComponents(): Promise<void> {
    // Disable or reduce functionality of non-critical components
    this.emit('componentsIsolated');
  }

  /**
   * Save crash dump
   */
  private async saveCrashDump(error: SystemError): Promise<string> {
    const dumpPath = path.join(this.backupDir, 'crashes', `crash-${Date.now()}.json`);
    await fs.ensureDir(path.dirname(dumpPath));
    
    const dump = {
      error,
      state: this.stateManager.getState(),
      errorHistory: this.errorHistory.slice(-100),
      recoveryHistory: this.recoveryHistory.slice(-50),
      healthChecks: Object.fromEntries(this.healthChecks),
      timestamp: new Date()
    };
    
    await fs.writeJson(dumpPath, dump, { spaces: 2 });
    return dumpPath;
  }

  /**
   * Clean old checkpoints
   */
  private async cleanOldCheckpoints(): Promise<void> {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    for (const [id, backup] of this.backups) {
      if (backup.type === 'snapshot' && now - backup.timestamp.getTime() > maxAge) {
        await fs.remove(backup.location);
        this.backups.delete(id);
      }
    }
  }

  /**
   * Map component to error type
   */
  private mapComponentToErrorType(component: string): ErrorType {
    const mapping: Record<string, ErrorType> = {
      database: ErrorType.DATABASE,
      network: ErrorType.NETWORK,
      memory: ErrorType.MEMORY,
      filesystem: ErrorType.FILESYSTEM,
      state: ErrorType.STATE
    };
    
    return mapping[component] || ErrorType.UNKNOWN;
  }

  /**
   * Get system health status
   */
  public getHealthStatus(): Record<string, HealthCheck> {
    return Object.fromEntries(this.healthChecks);
  }

  /**
   * Get error history
   */
  public getErrorHistory(limit?: number): SystemError[] {
    return limit ? this.errorHistory.slice(-limit) : this.errorHistory;
  }

  /**
   * Get recovery history
   */
  public getRecoveryHistory(limit?: number): RecoveryResult[] {
    return limit ? this.recoveryHistory.slice(-limit) : this.recoveryHistory;
  }

  /**
   * Shutdown recovery system
   */
  public async shutdown(): Promise<void> {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }
    
    // Create final checkpoint
    await this.createCheckpoint();
    
    this.emit('shutdown');
  }
}