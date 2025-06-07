
/**
 * Specialized audit logger for tracking all actor operations
 * Provides immutable audit trail for compliance and debugging
 */

import { Logger } from './Logger';

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: {
    type: 'planning' | 'execution' | 'system';
    id: string;
  };
  operation: {
    type: string;
    description: string;
    input?: unknown;
    output?: unknown;
  };
  result: {
    status: 'success' | 'failure';
    duration: number;
    error?: string;
  };
  metadata: {
    sessionId?: string;
    instructionId?: string;
    correlationId: string;
  };
}

export class AuditLogger {
  private readonly logger: Logger;
  private readonly events: AuditEvent[] = [];
  private readonly maxEvents: number = 50000;

  constructor() {
    this.logger = new Logger('AuditLogger', 'audit.log');
  }

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const fullEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString()
    };

    // Add to events array
    this.events.push(fullEvent);
    
    // Trim if needed
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log to underlying logger
    this.logger.info('Audit Event', {
      eventId: fullEvent.id,
      actor: fullEvent.actor.type,
      operation: fullEvent.operation.type,
      status: fullEvent.result.status
    });

    // In production, this would also:
    // 1. Write to immutable storage
    // 2. Send to audit service
    // 3. Create blockchain entry for critical operations
  }

  /**
   * Log the start of an operation
   */
  startOperation(
    actor: AuditEvent['actor'],
    operationType: string,
    _description: string,
    _input?: any
  ): string {
    const correlationId = this.generateCorrelationId();
    
    this.logger.info('Operation Started', {
      correlationId,
      actor: actor.type,
      operation: operationType
    });

    return correlationId;
  }

  /**
   * Log the completion of an operation
   */
  completeOperation(
    correlationId: string,
    actor: AuditEvent['actor'],
    operationType: string,
    description: string,
    status: 'success' | 'failure',
    duration: number,
    output?: any,
    error?: string
  ): void {
    this.logEvent({
      actor,
      operation: {
        type: operationType,
        description,
        output
      },
      result: {
        status,
        duration,
        error
      },
      metadata: {
        correlationId
      }
    });
  }

  /**
   * Get audit trail for a specific actor
   */
  getActorAuditTrail(actorId: string): AuditEvent[] {
    return this.events.filter(event => event.actor.id === actorId);
  }

  /**
   * Get audit trail for a session
   */
  getSessionAuditTrail(sessionId: string): AuditEvent[] {
    return this.events.filter(event => event.metadata.sessionId === sessionId);
  }

  /**
   * Get all failures within a time range
   */
  getFailures(startTime: string, endTime: string): AuditEvent[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return this.events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return event.result.status === 'failure' && 
             eventTime >= start && 
             eventTime <= end;
    });
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(startTime: string, endTime: string): unknown {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    const relevantEvents = this.events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= start && eventTime <= end;
    });

    const report = {
      period: { start: startTime, end: endTime },
      totalOperations: relevantEvents.length,
      byActor: {
        planning: relevantEvents.filter(e => e.actor.type === 'planning').length,
        execution: relevantEvents.filter(e => e.actor.type === 'execution').length,
        system: relevantEvents.filter(e => e.actor.type === 'system').length
      },
      byStatus: {
        success: relevantEvents.filter(e => e.result.status === 'success').length,
        failure: relevantEvents.filter(e => e.result.status === 'failure').length
      },
      averageDuration: this.calculateAverageDuration(relevantEvents),
      failures: relevantEvents.filter(e => e.result.status === 'failure').map(e => ({
        timestamp: e.timestamp,
        actor: e.actor.type,
        operation: e.operation.type,
        error: e.result.error
      }))
    };

    return report;
  }

  private calculateAverageDuration(events: AuditEvent[]): number {
    if (events.length === 0) return 0;
    
    const totalDuration = events.reduce((sum, event) => 
      sum + event.result.duration, 0
    );
    
    return totalDuration / events.length;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export audit trail to JSON
   */
  exportAuditTrail(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Clear audit trail (for testing only)
   */
  clearAuditTrail(): void {
    this.events.length = 0;
    this.logger.clearLogs();
  }
}