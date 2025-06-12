/**
 * Automatic Recovery Service
 * Implements self-healing procedures for detected degradation and failures
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { HealthStatus, HealthIssue } from '../monitoring/HealthMonitoringService';
import { FailurePrediction } from '../monitoring/PredictiveFailureDetector';
import { RecoveryService } from '@/src/services/RecoveryService';
import { MemoryOptimizationService } from '@/src/services/performance/MemoryOptimizationService';
import { ConnectionMonitor } from '../monitoring/ConnectionMonitor';
import { UserNotificationService } from '../notification/UserNotificationService';

export interface RecoveryAction {
  id: string;
  type: RecoveryActionType;
  component: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
  requiresConfirmation: boolean;
  estimatedDuration: number; // milliseconds
  successRate: number; // 0-1 historical success rate
}

export enum RecoveryActionType {
  RESTART_SERVICE = 'restart_service',
  CLEAR_CACHE = 'clear_cache',
  OPTIMIZE_MEMORY = 'optimize_memory',
  RESET_CONNECTION = 'reset_connection',
  SCALE_RESOURCES = 'scale_resources',
  FAILOVER = 'failover',
  ROLLBACK = 'rollback',
  GARBAGE_COLLECT = 'garbage_collect',
  REBUILD_INDEXES = 'rebuild_indexes',
  COMPACT_DATABASE = 'compact_database',
  THROTTLE_REQUESTS = 'throttle_requests',
  EMERGENCY_SHUTDOWN = 'emergency_shutdown'
}

export interface RecoveryPlan {
  id: string;
  issue: HealthIssue | FailurePrediction;
  actions: RecoveryAction[];
  strategy: 'sequential' | 'parallel' | 'fallback';
  maxRetries: number;
  timeout: number;
  createdAt: string;
}

export interface RecoveryResult {
  planId: string;
  success: boolean;
  actionsExecuted: string[];
  duration: number;
  error?: Error;
  newHealthStatus?: HealthStatus;
  timestamp: string;
}

interface RecoveryHistory {
  action: RecoveryAction;
  success: boolean;
  duration: number;
  timestamp: string;
}

export class AutomaticRecoveryService extends EventEmitter {
  private readonly logger: Logger;
  private readonly recoveryService: RecoveryService;
  private readonly memoryOptimization: MemoryOptimizationService;
  private readonly connectionMonitor: ConnectionMonitor;
  private readonly notificationService: UserNotificationService;
  
  private readonly activePlans: Map<string, RecoveryPlan> = new Map();
  private readonly recoveryHistory: RecoveryHistory[] = [];
  private readonly actionRegistry: Map<RecoveryActionType, RecoveryActionHandler> = new Map();
  
  private isRecovering = false;
  private readonly maxConcurrentRecoveries = 3;
  private activeRecoveries = 0;

  constructor(
    logger: Logger,
    recoveryService: RecoveryService,
    memoryOptimization: MemoryOptimizationService,
    connectionMonitor: ConnectionMonitor,
    notificationService: UserNotificationService
  ) {
    super();
    this.logger = logger;
    this.recoveryService = recoveryService;
    this.memoryOptimization = memoryOptimization;
    this.connectionMonitor = connectionMonitor;
    this.notificationService = notificationService;
    
    this.registerRecoveryActions();
  }

  /**
   * Handle health status change
   */
  async handleHealthStatusChange(status: HealthStatus): Promise<void> {
    if (status.overall === 'healthy') {
      this.logger.info('System healthy, no recovery needed');
      return;
    }

    if (this.isRecovering) {
      this.logger.info('Recovery already in progress');
      return;
    }

    // Create recovery plan based on issues
    const plan = this.createRecoveryPlan(status);
    if (!plan) {
      this.logger.warn('No recovery plan available for current issues');
      return;
    }

    // Execute recovery plan
    await this.executeRecoveryPlan(plan);
  }

  /**
   * Handle failure prediction
   */
  async handleFailurePrediction(prediction: FailurePrediction): Promise<void> {
    if (prediction.likelihood < 0.7 || prediction.confidence < 0.6) {
      return; // Not confident enough
    }

    // Create preventive recovery plan
    const plan = this.createPreventiveRecoveryPlan(prediction);
    if (!plan) {
      this.logger.warn('No preventive recovery plan available');
      return;
    }

    // Execute if we have capacity
    if (this.activeRecoveries < this.maxConcurrentRecoveries) {
      await this.executeRecoveryPlan(plan);
    } else {
      this.logger.info('Recovery capacity reached, queueing plan', {
        planId: plan.id
      });
    }
  }

  /**
   * Create recovery plan based on health issues
   */
  private createRecoveryPlan(status: HealthStatus): RecoveryPlan | null {
    const criticalIssues = status.issues.filter(i => i.severity === 'critical');
    const warningIssues = status.issues.filter(i => i.severity === 'warning');
    
    const actions: RecoveryAction[] = [];

    // Handle critical issues first
    for (const issue of criticalIssues) {
      const issueActions = this.getRecoveryActionsForIssue(issue);
      actions.push(...issueActions);
    }

    // Then warnings if no critical issues
    if (actions.length === 0) {
      for (const issue of warningIssues) {
        const issueActions = this.getRecoveryActionsForIssue(issue);
        actions.push(...issueActions);
      }
    }

    if (actions.length === 0) {
      return null;
    }

    // Sort by priority
    actions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const issue = criticalIssues[0] || warningIssues[0];
    if (!issue) {
      return null;
    }

    return {
      id: this.generatePlanId(),
      issue,
      actions,
      strategy: criticalIssues.length > 0 ? 'sequential' : 'parallel',
      maxRetries: 3,
      timeout: 300000, // 5 minutes
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create preventive recovery plan
   */
  private createPreventiveRecoveryPlan(prediction: FailurePrediction): RecoveryPlan | null {
    const actions: RecoveryAction[] = [];

    // Based on component and metric
    switch (prediction.component) {
      case 'memory':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.OPTIMIZE_MEMORY,
          'memory',
          'Optimize memory before critical threshold',
          'high'
        ));
        actions.push(this.createRecoveryAction(
          RecoveryActionType.GARBAGE_COLLECT,
          'memory',
          'Force garbage collection',
          'medium'
        ));
        break;

      case 'cpu':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.THROTTLE_REQUESTS,
          'cpu',
          'Throttle incoming requests',
          'high'
        ));
        break;

      case 'storage':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.CLEAR_CACHE,
          'storage',
          'Clear temporary files and cache',
          'high'
        ));
        actions.push(this.createRecoveryAction(
          RecoveryActionType.COMPACT_DATABASE,
          'storage',
          'Compact database files',
          'medium'
        ));
        break;

      case 'network':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.RESET_CONNECTION,
          'network',
          'Reset network connections',
          'medium'
        ));
        break;
    }

    if (actions.length === 0) {
      return null;
    }

    return {
      id: this.generatePlanId(),
      issue: prediction,
      actions,
      strategy: 'sequential',
      maxRetries: 2,
      timeout: 180000, // 3 minutes
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get recovery actions for specific issue
   */
  private getRecoveryActionsForIssue(issue: HealthIssue): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (issue.component) {
      case 'memory':
        if (issue.severity === 'critical') {
          actions.push(this.createRecoveryAction(
            RecoveryActionType.OPTIMIZE_MEMORY,
            'memory',
            'Emergency memory optimization',
            'critical'
          ));
          actions.push(this.createRecoveryAction(
            RecoveryActionType.RESTART_SERVICE,
            'memory',
            'Restart memory-intensive services',
            'high'
          ));
        } else {
          actions.push(this.createRecoveryAction(
            RecoveryActionType.GARBAGE_COLLECT,
            'memory',
            'Trigger garbage collection',
            'medium'
          ));
        }
        break;

      case 'cpu':
        if (issue.severity === 'critical') {
          actions.push(this.createRecoveryAction(
            RecoveryActionType.THROTTLE_REQUESTS,
            'cpu',
            'Emergency request throttling',
            'critical'
          ));
        }
        actions.push(this.createRecoveryAction(
          RecoveryActionType.SCALE_RESOURCES,
          'cpu',
          'Scale CPU resources',
          issue.severity === 'critical' ? 'high' : 'medium'
        ));
        break;

      case 'performance':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.CLEAR_CACHE,
          'performance',
          'Clear performance cache',
          'medium'
        ));
        actions.push(this.createRecoveryAction(
          RecoveryActionType.REBUILD_INDEXES,
          'performance',
          'Rebuild database indexes',
          'low'
        ));
        break;

      case 'network':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.RESET_CONNECTION,
          'network',
          'Reset network connections',
          issue.severity === 'critical' ? 'high' : 'medium'
        ));
        if (issue.severity === 'critical') {
          actions.push(this.createRecoveryAction(
            RecoveryActionType.FAILOVER,
            'network',
            'Failover to backup connection',
            'high'
          ));
        }
        break;

      case 'storage':
        actions.push(this.createRecoveryAction(
          RecoveryActionType.CLEAR_CACHE,
          'storage',
          'Clear storage cache',
          'high'
        ));
        if (issue.value > 90) {
          actions.push(this.createRecoveryAction(
            RecoveryActionType.COMPACT_DATABASE,
            'storage',
            'Compact database storage',
            'medium'
          ));
        }
        break;
    }

    return actions;
  }

  /**
   * Execute recovery plan
   */
  private async executeRecoveryPlan(plan: RecoveryPlan): Promise<RecoveryResult> {
    this.isRecovering = true;
    this.activeRecoveries++;
    this.activePlans.set(plan.id, plan);
    
    const startTime = Date.now();
    const actionsExecuted: string[] = [];
    let success = true;
    let error: Error | undefined;

    // Notify user about recovery
    await this.notificationService.notifyRecovery({
      errorId: plan.id,
      recoveryStatus: 'attempting',
      recoveryMethod: plan.strategy,
      details: `Executing ${plan.actions.length} recovery actions`
    });

    this.logger.info('Executing recovery plan', {
      planId: plan.id,
      actionCount: plan.actions.length,
      strategy: plan.strategy
    });

    try {
      switch (plan.strategy) {
        case 'sequential':
          for (const action of plan.actions) {
            const actionResult = await this.executeRecoveryAction(action, plan);
            actionsExecuted.push(action.id);
            if (!actionResult.success) {
              success = false;
              error = actionResult.error;
              break;
            }
          }
          break;

        case 'parallel':
          const results = await Promise.allSettled(
            plan.actions.map(action => this.executeRecoveryAction(action, plan))
          );
          
          for (let i = 0; i < results.length; i++) {
            const action = plan.actions[i];
            const result = results[i];
            if (action && result) {
              actionsExecuted.push(action.id);
              if (result.status === 'rejected') {
                success = false;
                error = new Error(`Action failed: ${action.description}`);
              }
            }
          }
          break;

        case 'fallback':
          for (const action of plan.actions) {
            const actionResult = await this.executeRecoveryAction(action, plan);
            actionsExecuted.push(action.id);
            if (actionResult.success) {
              break; // First successful action stops the chain
            }
          }
          break;
      }

      const duration = Date.now() - startTime;
      
      // Notify user about result
      await this.notificationService.notifyRecovery({
        errorId: plan.id,
        recoveryStatus: success ? 'succeeded' : 'failed',
        recoveryMethod: plan.strategy,
        duration,
        details: success 
          ? `Successfully executed ${actionsExecuted.length} recovery actions`
          : `Recovery failed after ${actionsExecuted.length} actions`
      });

      const result: RecoveryResult = {
        planId: plan.id,
        success,
        actionsExecuted,
        duration,
        error,
        timestamp: new Date().toISOString()
      };

      this.emit('recoveryCompleted', result);
      
      return result;

    } catch (err) {
      error = err as Error;
      this.logger.error('Recovery plan execution failed', error);
      
      return {
        planId: plan.id,
        success: false,
        actionsExecuted,
        duration: Date.now() - startTime,
        error,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      this.isRecovering = false;
      this.activeRecoveries--;
      this.activePlans.delete(plan.id);
    }
  }

  /**
   * Execute individual recovery action
   */
  private async executeRecoveryAction(
    action: RecoveryAction,
    plan: RecoveryPlan
  ): Promise<{ success: boolean; error?: Error }> {
    this.logger.info('Executing recovery action', {
      actionId: action.id,
      type: action.type,
      description: action.description
    });

    const handler = this.actionRegistry.get(action.type);
    if (!handler) {
      return {
        success: false,
        error: new Error(`No handler for action type: ${action.type}`)
      };
    }

    const startTime = Date.now();
    
    try {
      // Check if confirmation required
      if (action.requiresConfirmation && !action.automated) {
        const confirmed = await this.requestUserConfirmation(action);
        if (!confirmed) {
          return {
            success: false,
            error: new Error('User declined recovery action')
          };
        }
      }

      // Execute the action
      await handler(action, plan);
      
      const duration = Date.now() - startTime;
      
      // Record in history
      this.recoveryHistory.push({
        action,
        success: true,
        duration,
        timestamp: new Date().toISOString()
      });

      this.logger.info('Recovery action completed successfully', {
        actionId: action.id,
        duration
      });

      return { success: true };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recoveryHistory.push({
        action,
        success: false,
        duration,
        timestamp: new Date().toISOString()
      });

      this.logger.error('Recovery action failed', error as Error, {
        actionId: action.id
      });

      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Register recovery action handlers
   */
  private registerRecoveryActions(): void {
    // Memory optimization
    this.actionRegistry.set(RecoveryActionType.OPTIMIZE_MEMORY, async () => {
      await this.memoryOptimization.optimizeMemory();
    });

    // Garbage collection
    this.actionRegistry.set(RecoveryActionType.GARBAGE_COLLECT, async () => {
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    // Clear cache
    this.actionRegistry.set(RecoveryActionType.CLEAR_CACHE, async () => {
      // Would implement cache clearing logic
      this.logger.info('Clearing application cache');
    });

    // Reset connection
    this.actionRegistry.set(RecoveryActionType.RESET_CONNECTION, async () => {
      await this.connectionMonitor.resetConnections();
    });

    // Restart service
    this.actionRegistry.set(RecoveryActionType.RESTART_SERVICE, async (action) => {
      this.logger.info('Restarting service', { component: action.component });
      // Would implement service restart logic
    });

    // Scale resources
    this.actionRegistry.set(RecoveryActionType.SCALE_RESOURCES, async (action) => {
      this.logger.info('Scaling resources', { component: action.component });
      // Would implement resource scaling logic
    });

    // Failover
    this.actionRegistry.set(RecoveryActionType.FAILOVER, async () => {
      this.logger.info('Initiating failover');
      // Would implement failover logic
    });

    // Rollback
    this.actionRegistry.set(RecoveryActionType.ROLLBACK, async () => {
      await this.recoveryService.rollbackToLastStable();
    });

    // Rebuild indexes
    this.actionRegistry.set(RecoveryActionType.REBUILD_INDEXES, async () => {
      this.logger.info('Rebuilding database indexes');
      // Would implement index rebuilding logic
    });

    // Compact database
    this.actionRegistry.set(RecoveryActionType.COMPACT_DATABASE, async () => {
      this.logger.info('Compacting database');
      // Would implement database compaction logic
    });

    // Throttle requests
    this.actionRegistry.set(RecoveryActionType.THROTTLE_REQUESTS, async () => {
      this.logger.info('Enabling request throttling');
      // Would implement request throttling logic
    });

    // Emergency shutdown
    this.actionRegistry.set(RecoveryActionType.EMERGENCY_SHUTDOWN, async () => {
      this.logger.error('Emergency shutdown initiated');
      // Would implement graceful shutdown logic
    });
  }

  /**
   * Create recovery action
   */
  private createRecoveryAction(
    type: RecoveryActionType,
    component: string,
    description: string,
    priority: RecoveryAction['priority']
  ): RecoveryAction {
    const successRate = this.calculateActionSuccessRate(type);
    
    return {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      component,
      description,
      priority,
      automated: priority !== 'critical', // Critical actions require confirmation
      requiresConfirmation: priority === 'critical',
      estimatedDuration: this.getEstimatedDuration(type),
      successRate
    };
  }

  /**
   * Calculate historical success rate for action type
   */
  private calculateActionSuccessRate(type: RecoveryActionType): number {
    const relevantHistory = this.recoveryHistory.filter(h => h.action.type === type);
    if (relevantHistory.length === 0) return 0.8; // Default 80%
    
    const successful = relevantHistory.filter(h => h.success).length;
    return successful / relevantHistory.length;
  }

  /**
   * Get estimated duration for action type
   */
  private getEstimatedDuration(type: RecoveryActionType): number {
    const durations: Record<RecoveryActionType, number> = {
      [RecoveryActionType.RESTART_SERVICE]: 30000,
      [RecoveryActionType.CLEAR_CACHE]: 5000,
      [RecoveryActionType.OPTIMIZE_MEMORY]: 10000,
      [RecoveryActionType.RESET_CONNECTION]: 5000,
      [RecoveryActionType.SCALE_RESOURCES]: 60000,
      [RecoveryActionType.FAILOVER]: 30000,
      [RecoveryActionType.ROLLBACK]: 120000,
      [RecoveryActionType.GARBAGE_COLLECT]: 3000,
      [RecoveryActionType.REBUILD_INDEXES]: 300000,
      [RecoveryActionType.COMPACT_DATABASE]: 600000,
      [RecoveryActionType.THROTTLE_REQUESTS]: 1000,
      [RecoveryActionType.EMERGENCY_SHUTDOWN]: 10000
    };
    
    return durations[type] || 10000;
  }

  /**
   * Request user confirmation for action
   */
  private async requestUserConfirmation(action: RecoveryAction): Promise<boolean> {
    // In real implementation, would show confirmation dialog
    this.logger.info('User confirmation requested', {
      action: action.description
    });
    
    // For now, auto-confirm after delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }

  /**
   * Generate plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recovery statistics
   */
  getStats(): {
    totalPlans: number;
    activePlans: number;
    successRate: number;
    averageDuration: number;
    actionSuccessRates: Record<string, number>;
  } {
    const completedPlans = this.recoveryHistory.length;
    const successfulPlans = this.recoveryHistory.filter(h => h.success).length;
    
    const totalDuration = this.recoveryHistory.reduce((sum, h) => sum + h.duration, 0);
    
    const actionSuccessRates: Record<string, number> = {};
    for (const type of Object.values(RecoveryActionType)) {
      actionSuccessRates[type] = this.calculateActionSuccessRate(type);
    }
    
    return {
      totalPlans: completedPlans,
      activePlans: this.activePlans.size,
      successRate: completedPlans > 0 ? successfulPlans / completedPlans : 0,
      averageDuration: completedPlans > 0 ? totalDuration / completedPlans : 0,
      actionSuccessRates
    };
  }
}

type RecoveryActionHandler = (action: RecoveryAction, plan: RecoveryPlan) => Promise<void>;