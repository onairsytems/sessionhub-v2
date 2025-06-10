/**
 * Runtime Actor Monitor - Real-time boundary enforcement
 * Monitors and prevents actor violations during execution
 */

import { Logger } from '@/src/lib/logging/Logger';
import { ActorBoundaryEnforcer, Actor, Operation } from './ActorBoundaryEnforcer';
import { EventEmitter } from 'events';

export interface ActorActivity {
  actorId: string;
  actorType: 'planning' | 'execution';
  operation: string;
  timestamp: string;
  duration?: number;
  status: 'started' | 'completed' | 'failed' | 'blocked';
  metadata?: Record<string, any>;
}

export interface ViolationAlert {
  id: string;
  actorId: string;
  actorType: 'planning' | 'execution';
  violationType: 'boundary' | 'content' | 'method' | 'api';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  blocked: boolean;
  details: Record<string, any>;
}

export class RuntimeActorMonitor extends EventEmitter {
  private readonly logger: Logger;
  private readonly boundaryEnforcer: ActorBoundaryEnforcer;
  private activities: Map<string, ActorActivity> = new Map();
  private violations: Map<string, ViolationAlert> = new Map();
  private readonly monitoringActive = true;
  private readonly maxActivities = 1000;

  constructor(logger: Logger, boundaryEnforcer: ActorBoundaryEnforcer) {
    super();
    this.logger = logger;
    this.boundaryEnforcer = boundaryEnforcer;
  }

  /**
   * Start monitoring an actor operation
   */
  startOperation(
    actorId: string,
    actorType: 'planning' | 'execution',
    operation: string,
    metadata?: Record<string, any>
  ): string {
    const operationId = this.generateOperationId();
    
    const activity: ActorActivity = {
      actorId,
      actorType,
      operation,
      timestamp: new Date().toISOString(),
      status: 'started',
      metadata
    };

    // Validate operation is allowed for this actor
    try {
      const actor: Actor = {
        id: actorId,
        type: actorType,
        capabilities: this.getActorCapabilities(actorType)
      };

      const operationData: Operation = {
        type: this.categorizeOperation(operation) as 'plan' | 'execute' | 'analyze' | 'decide',
        actor,
        description: operation,
        timestamp: activity.timestamp
      };

      this.boundaryEnforcer.validateOperation(operationData);
      this.activities.set(operationId, activity);

      this.logger.debug('Actor operation started', {
        operationId,
        actorId,
        actorType,
        operation
      });

      // Emit event for UI updates
      this.emit('operationStarted', { operationId, activity });

    } catch (error: any) {
      // Operation blocked - create violation alert
      const violation = this.createViolationAlert(
        actorId,
        actorType,
        'boundary',
        `Attempted forbidden operation: ${operation}`,
        'high',
        true,
        { operation, error: (error as Error).message }
      );

      activity.status = 'blocked';
      this.activities.set(operationId, activity);

      this.logger.error('Actor operation blocked', error as Error, {
        operationId,
        actorId,
        actorType,
        operation
      });

      // Emit violation event
      this.emit('violation', violation);
      this.emit('operationBlocked', { operationId, activity, violation });

      throw error;
    }

    return operationId;
  }

  /**
   * Complete an actor operation
   */
  completeOperation(operationId: string, success = true): void {
    const activity = this.activities.get(operationId);
    if (!activity) {
      this.logger.warn('Attempted to complete unknown operation', { operationId });
      return;
    }

    activity.status = success ? 'completed' : 'failed';
    activity.duration = Date.now() - new Date(activity.timestamp).getTime();

    this.logger.debug('Actor operation completed', {
      operationId,
      actorId: activity.actorId,
      duration: activity.duration,
      success
    });

    // Emit completion event
    this.emit('operationCompleted', { operationId, activity, success });

    // Clean up old activities
    this.cleanupOldActivities();
  }

  /**
   * Validate content for actor boundary compliance
   */
  validateContent(
    actorId: string,
    actorType: 'planning' | 'execution',
    content: string,
    context?: Record<string, any>
  ): void {
    try {
      this.boundaryEnforcer.validateContent(content, actorType);
    } catch (error: any) {
      // Content violation detected
      const violation = this.createViolationAlert(
        actorId,
        actorType,
        'content',
        `Content violation: ${(error as Error).message}`,
        'medium',
        true,
        { content: content.substring(0, 200), context, error: (error as Error).message }
      );

      this.logger.error('Content validation failed', error as Error, {
        actorId,
        actorType,
        contentLength: content.length
      });

      this.emit('violation', violation);
      throw error;
    }
  }

  /**
   * Monitor API calls for compliance
   */
  monitorAPICall(
    actorId: string,
    actorType: 'planning' | 'execution',
    apiEndpoint: string,
    requestData: any
  ): void {
    // Validate that the actor is calling the correct API
    const expectedAPIs = {
      planning: ['anthropic.com/v1/messages', 'claude.ai/chat'],
      execution: ['anthropic.com/v1/messages', 'claude.ai/code']
    };

    const allowedAPIs = expectedAPIs[actorType];
    const isAllowed = allowedAPIs.some(api => apiEndpoint.includes(api));

    if (!isAllowed) {
      const violation = this.createViolationAlert(
        actorId,
        actorType,
        'api',
        `Unauthorized API call to ${apiEndpoint}`,
        'critical',
        true,
        { apiEndpoint, requestData: JSON.stringify(requestData).substring(0, 200) }
      );

      this.logger.error('Unauthorized API call detected', undefined, {
        actorId,
        actorType,
        apiEndpoint,
        allowedAPIs
      });

      this.emit('violation', violation);
      throw new Error(`Actor ${actorType} not authorized to call ${apiEndpoint}`);
    }

    this.logger.debug('API call authorized', {
      actorId,
      actorType,
      apiEndpoint
    });
  }

  /**
   * Get current actor activities
   */
  getCurrentActivities(): ActorActivity[] {
    return Array.from(this.activities.values())
      .filter(activity => activity.status === 'started')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get recent violations
   */
  getRecentViolations(limit = 50): ViolationAlert[] {
    return Array.from(this.violations.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get violation statistics
   */
  getViolationStats(): {
    total: number;
    blocked: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byActor: Record<string, number>;
  } {
    const violations = Array.from(this.violations.values());
    
    const stats = {
      total: violations.length,
      blocked: violations.filter(v => v.blocked).length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byActor: {} as Record<string, number>
    };

    violations.forEach(violation => {
      // By type
      stats.byType[violation.violationType] = (stats.byType[violation.violationType] || 0) + 1;
      
      // By severity
      stats.bySeverity[violation.severity] = (stats.bySeverity[violation.severity] || 0) + 1;
      
      // By actor type
      stats.byActor[violation.actorType] = (stats.byActor[violation.actorType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear violation history
   */
  clearViolations(): void {
    this.violations.clear();
    this.emit('violationsCleared');
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    active: boolean;
    activeOperations: number;
    totalViolations: number;
    criticalViolations: number;
  } {
    const criticalViolations = Array.from(this.violations.values())
      .filter(v => v.severity === 'critical').length;

    return {
      active: this.monitoringActive,
      activeOperations: this.getCurrentActivities().length,
      totalViolations: this.violations.size,
      criticalViolations
    };
  }

  private createViolationAlert(
    actorId: string,
    actorType: 'planning' | 'execution',
    violationType: ViolationAlert['violationType'],
    description: string,
    severity: ViolationAlert['severity'],
    blocked: boolean,
    details: Record<string, any>
  ): ViolationAlert {
    const violation: ViolationAlert = {
      id: this.generateViolationId(),
      actorId,
      actorType,
      violationType,
      description,
      severity,
      timestamp: new Date().toISOString(),
      blocked,
      details
    };

    this.violations.set(violation.id, violation);
    return violation;
  }

  private getActorCapabilities(actorType: 'planning' | 'execution'): string[] {
    const capabilities = {
      planning: ['analyze', 'plan', 'decide', 'strategize'],
      execution: ['execute', 'implement', 'run', 'deploy']
    };
    return capabilities[actorType];
  }

  private categorizeOperation(operation: string): string {
    const operationLower = operation.toLowerCase();
    
    // Planning operations
    if (operationLower.includes('plan') || operationLower.includes('analyze') || 
        operationLower.includes('decide') || operationLower.includes('strategy')) {
      return 'plan';
    }
    
    // Execution operations
    if (operationLower.includes('execute') || operationLower.includes('implement') || 
        operationLower.includes('run') || operationLower.includes('deploy')) {
      return 'execute';
    }
    
    // Default to analyze for planning operations
    return 'analyze';
  }

  private cleanupOldActivities(): void {
    if (this.activities.size <= this.maxActivities) return;

    // Remove completed activities older than 1 hour
    const cutoff = Date.now() - (60 * 60 * 1000);
    
    for (const [id, activity] of this.activities.entries()) {
      if (activity.status !== 'started' && 
          new Date(activity.timestamp).getTime() < cutoff) {
        this.activities.delete(id);
      }
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateViolationId(): string {
    return `viol_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}