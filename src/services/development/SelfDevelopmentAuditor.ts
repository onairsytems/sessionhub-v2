
/**
 * Self-Development Auditor
 * Comprehensive logging and audit trail for all self-development activities
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { Logger } from '../../lib/logging/Logger';
import { DevelopmentConfig, getConfig } from '../../config/development.config';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  actor: 'planning' | 'execution' | 'system' | 'user';
  action: string;
  target: string;
  details: Record<string, any>;
  risk: 'low' | 'medium' | 'high' | 'critical';
  integrity: {
    hash: string;
    signature?: string;
    previousHash?: string;
  };
  context: {
    sessionId?: string;
    issueNumber?: number;
    version?: string;
    gitCommit?: string;
    userId?: string;
    ipAddress?: string;
  };
}

export type AuditEventType = 
  | 'session_created'
  | 'session_started'
  | 'session_completed'
  | 'session_failed'
  | 'instruction_generated'
  | 'instruction_executed'
  | 'code_modified'
  | 'file_created'
  | 'file_deleted'
  | 'file_updated'
  | 'update_built'
  | 'update_deployed'
  | 'update_rolled_back'
  | 'emergency_mode_entered'
  | 'emergency_mode_exited'
  | 'recovery_command_executed'
  | 'qa_pipeline_run'
  | 'security_scan_completed'
  | 'performance_benchmark_run'
  | 'actor_boundary_violation'
  | 'configuration_changed'
  | 'credentials_accessed'
  | 'external_api_called'
  | 'database_modified'
  | 'user_intervention';

export interface AuditQuery {
  fromDate?: Date;
  toDate?: Date;
  types?: AuditEventType[];
  actors?: string[];
  risks?: string[];
  sessionId?: string;
  target?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByActor: Record<string, number>;
  eventsByRisk: Record<string, number>;
  timeRange: { start: Date; end: Date };
  anomalies: AuditEvent[];
  integrityViolations: AuditEvent[];
  securityEvents: AuditEvent[];
}

export class SelfDevelopmentAuditor {
  private logger: Logger;
  private config: DevelopmentConfig;
  private auditLogPath: string;
  // private auditIndexPath: string; // Commented out for future use
  private eventChain: string | null = null;

  constructor() {
    this.logger = new Logger('SelfDevelopmentAuditor');
    this.config = getConfig();
    this.auditLogPath = join(this.expandPath(this.config.dataDirectory), 'audit.log');
    // this.auditIndexPath = join(this.expandPath(this.config.dataDirectory), 'audit-index.json'); // Commented out for future use
  }

  /**
   * Initialize audit system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing self-development auditor');

    // Ensure audit directories exist
    const auditDir = join(this.expandPath(this.config.dataDirectory));
    await fs.mkdir(auditDir, { recursive: true });

    // Load existing event chain
    await this.loadEventChain();

    // Log auditor initialization
    await this.logEvent({
      type: 'configuration_changed',
      actor: 'system',
      action: 'auditor_initialized',
      target: 'audit_system',
      details: {
        auditLevel: this.config.security.auditLevel,
        instanceId: this.config.instanceId,
      },
      risk: 'low',
      context: {}
    });

    this.logger.info('Self-development auditor initialized');
  }

  /**
   * Log an audit event
   */
  async logEvent(eventData: Omit<AuditEvent, 'id' | 'timestamp' | 'integrity'>): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...eventData,
      integrity: {
        hash: '',
        previousHash: this.eventChain || undefined,
      },
    };

    // Calculate event hash
    event.integrity.hash = this.calculateEventHash(event);

    // Update event chain
    this.eventChain = event.integrity.hash;

    // Write to audit log
    await this.writeAuditLog(event);

    // Update audit index for fast queries
    await this.updateAuditIndex(event);

    // Check for anomalies
    await this.checkForAnomalies(event);

    this.logger.debug('Audit event logged', {
      id: event.id,
      type: event.type,
      actor: event.actor,
      action: event.action,
      risk: event.risk,
    });
  }

  /**
   * Log session lifecycle events
   */
  async logSessionCreated(sessionId: string, issueNumber?: number, description?: string): Promise<void> {
    await this.logEvent({
      type: 'session_created',
      actor: 'system',
      action: 'create_session',
      target: sessionId,
      details: {
        issueNumber,
        description,
        trigger: issueNumber ? 'github_issue' : 'manual',
      },
      risk: 'medium',
      context: { sessionId, issueNumber },
    });
  }

  async logSessionStarted(sessionId: string, instruction: any): Promise<void> {
    await this.logEvent({
      type: 'session_started',
      actor: 'execution',
      action: 'start_session',
      target: sessionId,
      details: {
        objectives: instruction.objectives?.length || 0,
        requirements: instruction.requirements?.length || 0,
        complexity: instruction.estimatedComplexity,
      },
      risk: 'medium',
      context: { sessionId },
    });
  }

  async logSessionCompleted(sessionId: string, result: any): Promise<void> {
    await this.logEvent({
      type: 'session_completed',
      actor: 'execution',
      action: 'complete_session',
      target: sessionId,
      details: {
        success: result.success,
        duration: result.duration,
        artifacts: result.artifacts?.length || 0,
        testsPass: result.testsPass,
      },
      risk: 'low',
      context: { sessionId },
    });
  }

  async logSessionFailed(sessionId: string, error: Error): Promise<void> {
    await this.logEvent({
      type: 'session_failed',
      actor: 'execution',
      action: 'fail_session',
      target: sessionId,
      details: {
        error: error.message,
        stack: error.stack,
      },
      risk: 'high',
      context: { sessionId },
    });
  }

  /**
   * Log code modification events
   */
  async logCodeModification(filePath: string, operation: 'create' | 'update' | 'delete', details?: any): Promise<void> {
    const type = operation === 'create' ? 'file_created' : 
                 operation === 'update' ? 'file_updated' : 'file_deleted';

    await this.logEvent({
      type,
      actor: 'execution',
      action: `${operation}_file`,
      target: filePath,
      details: {
        operation,
        size: details?.size,
        hash: details?.hash,
        lineCount: details?.lineCount,
      },
      risk: this.assessFileModificationRisk(filePath),
      context: details?.context,
    });
  }

  /**
   * Log update pipeline events
   */
  async logUpdateBuilt(version: string, manifest: any): Promise<void> {
    await this.logEvent({
      type: 'update_built',
      actor: 'system',
      action: 'build_update',
      target: version,
      details: {
        fileCount: manifest.files?.length || 0,
        buildDuration: manifest.metadata?.buildDuration,
        testsPass: manifest.metadata?.testsPass,
        gitCommit: manifest.gitCommit,
      },
      risk: 'medium',
      context: { version, gitCommit: manifest.gitCommit },
    });
  }

  async logUpdateDeployed(version: string, deploymentResult: any): Promise<void> {
    await this.logEvent({
      type: 'update_deployed',
      actor: 'system',
      action: 'deploy_update',
      target: version,
      details: {
        success: deploymentResult.success,
        duration: deploymentResult.duration,
        rollback: deploymentResult.rollback,
      },
      risk: deploymentResult.success ? 'medium' : 'high',
      context: { version },
    });
  }

  /**
   * Log security and compliance events
   */
  async logActorBoundaryViolation(actor: string, violation: string, context?: any): Promise<void> {
    await this.logEvent({
      type: 'actor_boundary_violation',
      actor: actor as any,
      action: 'boundary_violation',
      target: 'actor_model',
      details: {
        violation,
        context,
      },
      risk: 'critical',
      context,
    });
  }

  async logCredentialAccess(service: string, operation: string, context?: any): Promise<void> {
    await this.logEvent({
      type: 'credentials_accessed',
      actor: 'system',
      action: operation,
      target: service,
      details: {
        service,
        operation,
        success: true, // Assume success if we're logging
      },
      risk: 'medium',
      context,
    });
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    this.logger.debug('Querying audit events', query);

    try {
      const allEvents = await this.loadAllEvents();
      let filteredEvents = allEvents;

      // Apply filters
      if (query.fromDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp >= query.fromDate!);
      }

      if (query.toDate) {
        filteredEvents = filteredEvents.filter(e => e.timestamp <= query.toDate!);
      }

      if (query.types?.length) {
        filteredEvents = filteredEvents.filter(e => query.types!.includes(e.type));
      }

      if (query.actors?.length) {
        filteredEvents = filteredEvents.filter(e => query.actors!.includes(e.actor));
      }

      if (query.risks?.length) {
        filteredEvents = filteredEvents.filter(e => query.risks!.includes(e.risk));
      }

      if (query.sessionId) {
        filteredEvents = filteredEvents.filter(e => e.context.sessionId === query.sessionId);
      }

      if (query.target) {
        filteredEvents = filteredEvents.filter(e => e.target.includes(query.target!));
      }

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      
      return filteredEvents
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(offset, offset + limit);

    } catch (error) {
      this.logger.error('Failed to query audit events', error as Error);
      return [];
    }
  }

  /**
   * Generate audit summary
   */
  async generateSummary(query: AuditQuery = {}): Promise<AuditSummary> {
    const events = await this.queryEvents({ ...query, limit: 10000 });

    const summary: AuditSummary = {
      totalEvents: events.length,
      eventsByType: {} as Record<AuditEventType, number>,
      eventsByActor: {},
      eventsByRisk: {},
      timeRange: {
        start: events[events.length - 1]?.timestamp || new Date(),
        end: events[0]?.timestamp || new Date(),
      },
      anomalies: [],
      integrityViolations: [],
      securityEvents: [],
    };

    // Calculate statistics
    for (const event of events) {
      summary.eventsByType[event.type] = (summary.eventsByType[event.type] || 0) + 1;
      summary.eventsByActor[event.actor] = (summary.eventsByActor[event.actor] || 0) + 1;
      summary.eventsByRisk[event.risk] = (summary.eventsByRisk[event.risk] || 0) + 1;

      // Identify special events
      if (event.type === 'actor_boundary_violation' || event.risk === 'critical') {
        summary.securityEvents.push(event);
      }

      // Check integrity
      if (!this.verifyEventIntegrity(event)) {
        summary.integrityViolations.push(event);
      }
    }

    // Detect anomalies
    summary.anomalies = await this.detectAnomalies(events);

    return summary;
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(): Promise<{ valid: boolean; violations: string[] }> {
    this.logger.info('Verifying audit trail integrity');

    const violations: string[] = [];
    const events = await this.loadAllEvents();

    let previousHash: string | null = null;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;

      // Verify event hash
      const expectedHash = this.calculateEventHash(event);
      if (event.integrity.hash !== expectedHash) {
        violations.push(`Event ${event.id}: Hash mismatch`);
      }

      // Verify chain integrity
      if (i > 0 && event.integrity.previousHash !== previousHash) {
        violations.push(`Event ${event.id}: Chain broken`);
      }

      previousHash = event.integrity.hash;
    }

    const valid = violations.length === 0;
    this.logger.info('Audit trail integrity verification completed', { 
      valid, 
      violations: violations.length 
    });

    return { valid, violations };
  }

  /**
   * Private helper methods
   */
  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateEventHash(event: AuditEvent): string {
    const hashData = {
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      type: event.type,
      actor: event.actor,
      action: event.action,
      target: event.target,
      details: event.details,
      risk: event.risk,
      context: event.context,
      previousHash: event.integrity.previousHash,
    };

    return createHash('sha256')
      .update(JSON.stringify(hashData, Object.keys(hashData).sort()))
      .digest('hex');
  }

  private async writeAuditLog(event: AuditEvent): Promise<void> {
    const logLine = JSON.stringify(event) + '\n';
    await fs.appendFile(this.auditLogPath, logLine);
  }

  private async updateAuditIndex(_event: AuditEvent): Promise<void> {
    // Update index for fast queries
    // This is a simplified implementation
    // const indexEntry = { // Commented out for future use
    //   id: event.id,
    //   timestamp: event.timestamp,
    //   type: event.type,
    //   actor: event.actor,
    //   risk: event.risk,
    //   target: event.target,
    // };

    // In a real implementation, this would update a proper index structure
  }

  private async loadEventChain(): Promise<void> {
    try {
      const events = await this.loadAllEvents();
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        if (lastEvent) {
          this.eventChain = lastEvent.integrity.hash;
        }
      }
    } catch (error) {
      this.eventChain = null;
    }
  }

  private async loadAllEvents(): Promise<AuditEvent[]> {
    try {
      const logContent = await fs.readFile(this.auditLogPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(line => line.length > 0);
      
      return lines.map(line => {
        const event = JSON.parse(line);
        event.timestamp = new Date(event.timestamp);
        return event;
      });
    } catch (error) {
      return [];
    }
  }

  private assessFileModificationRisk(filePath: string): AuditEvent['risk'] {
    // Assess risk based on file path and type
    if (filePath.includes('config') || filePath.includes('security')) {
      return 'high';
    }
    if (filePath.includes('core') || filePath.includes('orchestrator')) {
      return 'medium';
    }
    if (filePath.includes('test') || filePath.includes('docs')) {
      return 'low';
    }
    return 'medium';
  }

  private async checkForAnomalies(event: AuditEvent): Promise<void> {
    // Simple anomaly detection
    if (event.risk === 'critical') {
      this.logger.warn('Critical security event detected', { 
        eventId: event.id,
        type: event.type,
        actor: event.actor,
      });
    }

    // Check for unusual activity patterns
    if (event.type === 'file_deleted' && event.target.includes('core/')) {
      this.logger.warn('Core file deletion detected', { 
        eventId: event.id,
        target: event.target,
      });
    }
  }

  private verifyEventIntegrity(event: AuditEvent): boolean {
    const expectedHash = this.calculateEventHash(event);
    return event.integrity.hash === expectedHash;
  }

  private async detectAnomalies(events: AuditEvent[]): Promise<AuditEvent[]> {
    const anomalies: AuditEvent[] = [];

    // Detect rapid succession of high-risk events
    const highRiskEvents = events.filter(e => e.risk === 'high' || e.risk === 'critical');
    
    for (let i = 0; i < highRiskEvents.length - 1; i++) {
      const current = highRiskEvents[i];
      const next = highRiskEvents[i + 1];
      
      if (current && next) {
        const timeDiff = current.timestamp.getTime() - next.timestamp.getTime();
        if (timeDiff < 60000) { // Less than 1 minute apart
          anomalies.push(current);
        }
      }
    }

    return anomalies;
  }

  private expandPath(path: string): string {
    return path.replace(/^~/, require('os').homedir());
  }
}