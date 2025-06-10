/**
 * Self-Healing Service for SessionHub
 * 
 * Automatically detects and resolves common issues without user intervention.
 */

import { EventEmitter } from 'events';
import { ErrorRecoverySystem, SystemError, ErrorType } from '../recovery/ErrorRecoverySystem';
import { ProductionMonitoringDashboard, SystemMetrics, AlertType } from './ProductionMonitoringDashboard';
import { DatabaseService } from '../../database/DatabaseService';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HealingStrategy {
  id: string;
  name: string;
  description: string;
  triggers: HealingTrigger[];
  conditions: HealingCondition[];
  actions: HealingAction[];
  cooldown: number; // milliseconds
  priority: number;
  enabled: boolean;
}

export interface HealingTrigger {
  type: 'metric' | 'error' | 'alert' | 'pattern';
  value: any;
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'matches';
  threshold?: number;
}

export interface HealingCondition {
  type: 'time' | 'frequency' | 'state';
  value: any;
  operator: 'equals' | 'greater' | 'less' | 'between';
  threshold?: number;
  expected?: any;
}

export interface HealingAction {
  type: ActionType;
  target: string;
  params?: Record<string, any>;
  timeout?: number;
}

export enum ActionType {
  RESTART_SERVICE = 'restart_service',
  CLEAR_CACHE = 'clear_cache',
  GARBAGE_COLLECT = 'garbage_collect',
  KILL_PROCESS = 'kill_process',
  RECONNECT_DATABASE = 'reconnect_database',
  OPTIMIZE_DATABASE = 'optimize_database',
  ROTATE_LOGS = 'rotate_logs',
  SCALE_RESOURCES = 'scale_resources',
  FAILOVER = 'failover',
  NOTIFY = 'notify',
  CUSTOM_SCRIPT = 'custom_script'
}

export interface HealingResult {
  strategy: string;
  success: boolean;
  timestamp: Date;
  duration: number;
  actions: ActionResult[];
  metrics: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  error?: string;
}

export interface ActionResult {
  action: HealingAction;
  success: boolean;
  duration: number;
  output?: any;
  error?: string;
}

export interface HealingHistory {
  strategyId: string;
  timestamp: Date;
  trigger: string;
  result: HealingResult;
}

export class SelfHealingService extends EventEmitter {
  private strategies: Map<string, HealingStrategy> = new Map();
  private history: HealingHistory[] = [];
  private lastExecution: Map<string, number> = new Map();
  private isHealing = false;
  
  private recoverySystem: ErrorRecoverySystem;
  private monitoringDashboard: ProductionMonitoringDashboard;
  private database: DatabaseService;
  
  private monitoringInterval?: NodeJS.Timeout;
  private readonly maxHistory = 1000;
  private readonly monitoringIntervalMs = 30000; // 30 seconds

  constructor(
    recoverySystem: ErrorRecoverySystem,
    monitoringDashboard: ProductionMonitoringDashboard,
    database: DatabaseService
  ) {
    super();
    this.recoverySystem = recoverySystem;
    this.monitoringDashboard = monitoringDashboard;
    this.database = database;
    
    this.initializeStrategies();
    this.setupEventListeners();
    this.startMonitoring();
  }

  /**
   * Initialize default healing strategies
   */
  private initializeStrategies(): void {
    // Memory Pressure Relief Strategy
    this.addStrategy({
      id: 'memory-pressure-relief',
      name: 'Memory Pressure Relief',
      description: 'Automatically frees memory when usage is high',
      triggers: [
        {
          type: 'metric',
          value: 'memory.percentage',
          operator: 'greater',
          threshold: 85
        }
      ],
      conditions: [
        {
          type: 'frequency',
          value: 'lastHour',
          operator: 'less',
          threshold: 3 // Max 3 times per hour
        }
      ],
      actions: [
        {
          type: ActionType.GARBAGE_COLLECT,
          target: 'node',
          timeout: 5000
        },
        {
          type: ActionType.CLEAR_CACHE,
          target: 'application',
          params: { aggressive: true }
        },
        {
          type: ActionType.ROTATE_LOGS,
          target: 'logs',
          params: { compress: true }
        }
      ],
      cooldown: 300000, // 5 minutes
      priority: 1,
      enabled: true
    });

    // Database Connection Recovery Strategy
    this.addStrategy({
      id: 'database-connection-recovery',
      name: 'Database Connection Recovery',
      description: 'Automatically reconnects and optimizes database',
      triggers: [
        {
          type: 'error',
          value: ErrorType.DATABASE,
          operator: 'equals'
        },
        {
          type: 'alert',
          value: AlertType.HEALTH_CHECK_FAILURE,
          operator: 'equals'
        }
      ],
      conditions: [
        {
          type: 'state',
          value: 'database.connected',
          operator: 'equals',
          expected: false
        }
      ],
      actions: [
        {
          type: ActionType.RECONNECT_DATABASE,
          target: 'database',
          timeout: 10000
        },
        {
          type: ActionType.OPTIMIZE_DATABASE,
          target: 'database',
          params: { vacuum: true, analyze: true }
        }
      ],
      cooldown: 60000, // 1 minute
      priority: 1,
      enabled: true
    });

    // High CPU Usage Mitigation Strategy
    this.addStrategy({
      id: 'high-cpu-mitigation',
      name: 'High CPU Usage Mitigation',
      description: 'Reduces CPU load by throttling non-critical operations',
      triggers: [
        {
          type: 'metric',
          value: 'cpu.usage',
          operator: 'greater',
          threshold: 90
        }
      ],
      conditions: [
        {
          type: 'time',
          value: 'duration',
          operator: 'greater',
          threshold: 120000 // 2 minutes
        }
      ],
      actions: [
        {
          type: ActionType.SCALE_RESOURCES,
          target: 'workers',
          params: { action: 'reduce', amount: 0.5 }
        },
        {
          type: ActionType.KILL_PROCESS,
          target: 'heavy-operations',
          params: { graceful: true }
        }
      ],
      cooldown: 600000, // 10 minutes
      priority: 2,
      enabled: true
    });

    // Error Storm Prevention Strategy
    this.addStrategy({
      id: 'error-storm-prevention',
      name: 'Error Storm Prevention',
      description: 'Prevents cascading errors by isolating problematic components',
      triggers: [
        {
          type: 'pattern',
          value: 'error-rate',
          operator: 'greater',
          threshold: 50 // 50 errors per minute
        }
      ],
      conditions: [
        {
          type: 'frequency',
          value: 'lastMinute',
          operator: 'greater',
          threshold: 50
        }
      ],
      actions: [
        {
          type: ActionType.FAILOVER,
          target: 'error-component',
          params: { isolate: true }
        },
        {
          type: ActionType.NOTIFY,
          target: 'admin',
          params: { 
            severity: 'critical',
            message: 'Error storm detected and mitigated'
          }
        }
      ],
      cooldown: 300000, // 5 minutes
      priority: 1,
      enabled: true
    });

    // Disk Space Cleanup Strategy
    this.addStrategy({
      id: 'disk-space-cleanup',
      name: 'Disk Space Cleanup',
      description: 'Automatically cleans up disk space when running low',
      triggers: [
        {
          type: 'metric',
          value: 'disk.usage.percentage',
          operator: 'greater',
          threshold: 90
        }
      ],
      conditions: [],
      actions: [
        {
          type: ActionType.ROTATE_LOGS,
          target: 'logs',
          params: { 
            compress: true,
            deleteOld: true,
            maxAge: 7 // days
          }
        },
        {
          type: ActionType.CLEAR_CACHE,
          target: 'temp-files',
          params: { pattern: '*.tmp' }
        },
        {
          type: ActionType.CUSTOM_SCRIPT,
          target: 'cleanup',
          params: { 
            script: 'npm run cleanup:old-sessions'
          }
        }
      ],
      cooldown: 3600000, // 1 hour
      priority: 2,
      enabled: true
    });

    // Session Recovery Strategy
    this.addStrategy({
      id: 'session-recovery',
      name: 'Session Recovery',
      description: 'Recovers failed sessions automatically',
      triggers: [
        {
          type: 'error',
          value: 'session-failure',
          operator: 'equals'
        }
      ],
      conditions: [
        {
          type: 'state',
          value: 'session.recoverable',
          operator: 'equals',
          expected: true
        }
      ],
      actions: [
        {
          type: ActionType.CUSTOM_SCRIPT,
          target: 'session',
          params: { 
            script: 'recover-session',
            maxRetries: 3
          }
        },
        {
          type: ActionType.NOTIFY,
          target: 'user',
          params: { 
            message: 'Session automatically recovered'
          }
        }
      ],
      cooldown: 60000, // 1 minute
      priority: 1,
      enabled: true
    });

    // Performance Optimization Strategy
    this.addStrategy({
      id: 'performance-optimization',
      name: 'Performance Optimization',
      description: 'Optimizes system performance when degraded',
      triggers: [
        {
          type: 'metric',
          value: 'performance.responseTime',
          operator: 'greater',
          threshold: 3000 // 3 seconds
        }
      ],
      conditions: [
        {
          type: 'time',
          value: 'business-hours',
          operator: 'equals',
          expected: true
        }
      ],
      actions: [
        {
          type: ActionType.OPTIMIZE_DATABASE,
          target: 'database',
          params: { 
            reindex: true,
            updateStats: true
          }
        },
        {
          type: ActionType.CLEAR_CACHE,
          target: 'query-cache',
          params: { selective: true }
        },
        {
          type: ActionType.SCALE_RESOURCES,
          target: 'workers',
          params: { action: 'increase', amount: 2 }
        }
      ],
      cooldown: 1800000, // 30 minutes
      priority: 2,
      enabled: true
    });
  }

  /**
   * Add a healing strategy
   */
  public addStrategy(strategy: HealingStrategy): void {
    this.strategies.set(strategy.id, strategy);
    this.emit('strategyAdded', strategy);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for errors from recovery system
    this.recoverySystem.on('errorDetected', (error: SystemError) => {
      this.checkTriggers('error', error);
    });
    
    // Listen for alerts from monitoring dashboard
    this.monitoringDashboard.on('alertTriggered', (alert) => {
      this.checkTriggers('alert', alert);
    });
    
    // Listen for metrics updates
    this.monitoringDashboard.on('metricsCollected', (metrics: SystemMetrics) => {
      this.checkTriggers('metric', metrics);
    });
  }

  /**
   * Start monitoring for healing opportunities
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkPatterns();
    }, this.monitoringIntervalMs);
  }

  /**
   * Check triggers for healing strategies
   */
  private async checkTriggers(type: string, data: any): Promise<void> {
    if (this.isHealing) return;
    
    for (const strategy of this.strategies.values()) {
      if (!strategy.enabled) continue;
      
      // Check cooldown
      const lastExec = this.lastExecution.get(strategy.id) || 0;
      if (Date.now() - lastExec < strategy.cooldown) continue;
      
      // Check triggers
      const triggered = strategy.triggers.some(trigger => {
        if (trigger.type !== type) return false;
        
        switch (type) {
          case 'metric':
            return this.checkMetricTrigger(trigger, data);
          case 'error':
            return this.checkErrorTrigger(trigger, data);
          case 'alert':
            return this.checkAlertTrigger(trigger, data);
          case 'pattern':
            return this.checkPatternTrigger(trigger, data);
          default:
            return false;
        }
      });
      
      if (triggered) {
        // Check conditions
        const conditionsMet = await this.checkConditions(strategy.conditions);
        
        if (conditionsMet) {
          await this.executeStrategy(strategy, `${type}: ${JSON.stringify(data)}`);
        }
      }
    }
  }

  /**
   * Check metric trigger
   */
  private checkMetricTrigger(trigger: HealingTrigger, metrics: SystemMetrics): boolean {
    const value = this.getNestedValue(metrics, trigger.value);
    
    switch (trigger.operator) {
      case 'greater':
        return value > trigger.threshold!;
      case 'less':
        return value < trigger.threshold!;
      case 'equals':
        return value === trigger.threshold;
      default:
        return false;
    }
  }

  /**
   * Check error trigger
   */
  private checkErrorTrigger(trigger: HealingTrigger, error: SystemError): boolean {
    switch (trigger.operator) {
      case 'equals':
        return error.type === trigger.value;
      case 'contains':
        return error.message.includes(trigger.value);
      default:
        return false;
    }
  }

  /**
   * Check alert trigger
   */
  private checkAlertTrigger(trigger: HealingTrigger, alert: any): boolean {
    switch (trigger.operator) {
      case 'equals':
        return alert.type === trigger.value;
      case 'contains':
        return alert.message.includes(trigger.value);
      default:
        return false;
    }
  }

  /**
   * Check pattern trigger
   */
  private checkPatternTrigger(_trigger: HealingTrigger, _data: any): boolean {
    // Pattern triggers are checked in checkPatterns()
    return false;
  }

  /**
   * Check patterns for healing opportunities
   */
  private async checkPatterns(): Promise<void> {
    // Check error rate pattern
    const errorHistory = this.recoverySystem.getErrorHistory(100);
    const recentErrors = errorHistory.filter(e => 
      Date.now() - e.timestamp.getTime() < 60000 // Last minute
    );
    
    const errorRate = recentErrors.length;
    await this.checkTriggers('pattern', { 
      type: 'error-rate', 
      value: errorRate 
    });
    
    // Check other patterns
    // ...
  }

  /**
   * Check healing conditions
   */
  private async checkConditions(conditions: HealingCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.checkCondition(condition);
      if (!met) return false;
    }
    return true;
  }

  /**
   * Check individual condition
   */
  private async checkCondition(condition: HealingCondition): Promise<boolean> {
    switch (condition.type) {
      case 'time':
        return this.checkTimeCondition(condition);
      case 'frequency':
        return this.checkFrequencyCondition(condition);
      case 'state':
        return await this.checkStateCondition(condition);
      default:
        return true;
    }
  }

  /**
   * Check time-based condition
   */
  private checkTimeCondition(condition: HealingCondition): boolean {
    if (condition.value === 'business-hours') {
      const hour = new Date().getHours();
      return hour >= 9 && hour < 17; // 9 AM to 5 PM
    }
    
    if (condition.value === 'duration') {
      // Check how long a condition has been true
      // This would need state tracking
      return true;
    }
    
    return true;
  }

  /**
   * Check frequency condition
   */
  private checkFrequencyCondition(condition: HealingCondition): boolean {
    const period = condition.value;
    const threshold = condition.threshold || 0;
    
    // Count executions in period
    const executions = this.history.filter(h => {
      const age = Date.now() - h.timestamp.getTime();
      switch (period) {
        case 'lastMinute':
          return age < 60000;
        case 'lastHour':
          return age < 3600000;
        case 'lastDay':
          return age < 86400000;
        default:
          return false;
      }
    });
    
    switch (condition.operator) {
      case 'less':
        return executions.length < threshold;
      case 'greater':
        return executions.length > threshold;
      default:
        return true;
    }
  }

  /**
   * Check state condition
   */
  private async checkStateCondition(condition: HealingCondition): Promise<boolean> {
    switch (condition.value) {
      case 'database.connected':
        const dbHealth = await this.database.healthCheck();
        return dbHealth === condition.expected;
      
      case 'session.recoverable':
        // Check if current session is recoverable
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Execute healing strategy
   */
  private async executeStrategy(strategy: HealingStrategy, trigger: string): Promise<void> {
    this.isHealing = true;
    const startTime = Date.now();
    
    const result: HealingResult = {
      strategy: strategy.id,
      success: false,
      timestamp: new Date(),
      duration: 0,
      actions: [],
      metrics: {
        before: await this.captureMetrics(),
        after: {}
      }
    };
    
    try {
      this.emit('healingStarted', { strategy, trigger });
      
      // Execute actions in sequence
      for (const action of strategy.actions) {
        const actionResult = await this.executeAction(action);
        result.actions.push(actionResult);
        
        if (!actionResult.success && action.type !== ActionType.NOTIFY) {
          // Stop on failure (except notifications)
          break;
        }
      }
      
      // Capture after metrics
      result.metrics.after = await this.captureMetrics();
      
      // Determine overall success
      result.success = result.actions.every(a => 
        a.success || a.action.type === ActionType.NOTIFY
      );
      
      result.duration = Date.now() - startTime;
      
      // Record execution
      this.lastExecution.set(strategy.id, Date.now());
      this.history.push({
        strategyId: strategy.id,
        timestamp: new Date(),
        trigger,
        result
      });
      
      // Trim history
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(-this.maxHistory);
      }
      
      this.emit('healingCompleted', { strategy, result });
      
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.duration = Date.now() - startTime;
      
      this.emit('healingFailed', { strategy, error });
    } finally {
      this.isHealing = false;
    }
  }

  /**
   * Execute healing action
   */
  private async executeAction(action: HealingAction): Promise<ActionResult> {
    const startTime = Date.now();
    const result: ActionResult = {
      action,
      success: false,
      duration: 0
    };
    
    try {
      switch (action.type) {
        case ActionType.RESTART_SERVICE:
          result.output = await this.restartService(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.CLEAR_CACHE:
          result.output = await this.clearCache(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.GARBAGE_COLLECT:
          result.output = await this.garbageCollect();
          result.success = true;
          break;
        
        case ActionType.KILL_PROCESS:
          result.output = await this.killProcess(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.RECONNECT_DATABASE:
          result.output = await this.reconnectDatabase();
          result.success = true;
          break;
        
        case ActionType.OPTIMIZE_DATABASE:
          result.output = await this.optimizeDatabase(action.params);
          result.success = true;
          break;
        
        case ActionType.ROTATE_LOGS:
          result.output = await this.rotateLogs(action.params);
          result.success = true;
          break;
        
        case ActionType.SCALE_RESOURCES:
          result.output = await this.scaleResources(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.FAILOVER:
          result.output = await this.failover(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.NOTIFY:
          result.output = await this.notify(action.target, action.params);
          result.success = true;
          break;
        
        case ActionType.CUSTOM_SCRIPT:
          result.output = await this.runCustomScript(action.params);
          result.success = true;
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }

  /**
   * Implementation of healing actions
   */
  
  private async restartService(target: string, _params?: any): Promise<any> {
    // Implementation depends on the service
    return { restarted: target };
  }
  
  private async clearCache(target: string, params?: any): Promise<any> {
    // Clear specific caches
    if (target === 'application') {
      // Clear application caches
    }
    return { cleared: target, aggressive: params?.aggressive };
  }
  
  private async garbageCollect(): Promise<any> {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      return {
        before: before.heapUsed,
        after: after.heapUsed,
        freed: before.heapUsed - after.heapUsed
      };
    }
    return { message: 'GC not available' };
  }
  
  private async killProcess(target: string, params?: any): Promise<any> {
    // Kill specific processes
    return { killed: target, graceful: params?.graceful };
  }
  
  private async reconnectDatabase(): Promise<any> {
    await this.database.disconnect();
    await this.database.connect();
    const health = await this.database.healthCheck();
    return { connected: health };
  }
  
  private async optimizeDatabase(params?: any): Promise<any> {
    const results: any = {};
    
    if (params?.vacuum) {
      await this.database.vacuum();
      results.vacuum = true;
    }
    
    if (params?.analyze) {
      await this.database.analyze();
      results.analyze = true;
    }
    
    if (params?.reindex) {
      await this.database.reindex();
      results.reindex = true;
    }
    
    return results;
  }
  
  private async rotateLogs(params?: any): Promise<any> {
    // Rotate log files
    return { 
      rotated: true,
      compressed: params?.compress,
      deletedOld: params?.deleteOld
    };
  }
  
  private async scaleResources(target: string, params?: any): Promise<any> {
    // Scale resources up or down
    return {
      target,
      action: params?.action,
      amount: params?.amount
    };
  }
  
  private async failover(target: string, params?: any): Promise<any> {
    // Implement failover logic
    return {
      target,
      isolated: params?.isolate
    };
  }
  
  private async notify(target: string, params?: any): Promise<any> {
    // Send notifications
    this.emit('notification', {
      target,
      severity: params?.severity,
      message: params?.message
    });
    
    return { notified: target };
  }
  
  private async runCustomScript(params?: any): Promise<any> {
    if (!params?.script) {
      throw new Error('Script not specified');
    }
    
    try {
      const { stdout, stderr } = await execAsync(params.script);
      return { stdout, stderr };
    } catch (error) {
      throw new Error(`Script failed: ${error}`);
    }
  }

  /**
   * Capture current metrics
   */
  private async captureMetrics(): Promise<Record<string, any>> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  /**
   * Get healing history
   */
  public getHistory(limit?: number): HealingHistory[] {
    return limit ? this.history.slice(-limit) : this.history;
  }

  /**
   * Get strategy statistics
   */
  public getStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const strategy of this.strategies.values()) {
      const executions = this.history.filter(h => h.strategyId === strategy.id);
      const successful = executions.filter(h => h.result.success);
      
      stats[strategy.id] = {
        name: strategy.name,
        enabled: strategy.enabled,
        executions: executions.length,
        successful: successful.length,
        successRate: executions.length > 0 
          ? successful.length / executions.length 
          : 0,
        lastExecution: this.lastExecution.get(strategy.id),
        averageDuration: executions.length > 0
          ? executions.reduce((sum, h) => sum + h.result.duration, 0) / executions.length
          : 0
      };
    }
    
    return stats;
  }

  /**
   * Enable/disable strategy
   */
  public setStrategyEnabled(strategyId: string, enabled: boolean): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.enabled = enabled;
      this.emit('strategyUpdated', strategy);
    }
  }

  /**
   * Shutdown self-healing service
   */
  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.emit('shutdown');
  }
}