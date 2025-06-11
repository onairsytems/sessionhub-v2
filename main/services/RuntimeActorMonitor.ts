import { EventEmitter } from 'events';

export interface ActorViolation {
  type: string;
  actor: string;
  operation: string;
  timestamp: Date;
}

export interface ActorOperation {
  actor: string;
  operation: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class RuntimeActorMonitor extends EventEmitter {
  private violations: ActorViolation[] = [];
  private operations: ActorOperation[] = [];
  private isRunning = false;
  private violationThreshold = 10;
  private blockedActors = new Set<string>();

  start(): void {
    this.isRunning = true;
    this.violations = [];
    this.operations = [];
  }

  stop(): void {
    this.isRunning = false;
  }

  getViolations(): ActorViolation[] {
    return this.violations;
  }

  getOperations(): ActorOperation[] {
    return this.operations;
  }

  getAuditTrail(): { events: ActorOperation[] } {
    return { events: this.operations };
  }

  setViolationThreshold(threshold: number): void {
    this.violationThreshold = threshold;
  }

  isBlocked(actor: string): boolean {
    return this.blockedActors.has(actor);
  }

  getOperationsBySession(_sessionId: string): ActorOperation[] {
    // Mock implementation - filter by session
    return this.operations;
  }

  getViolationsBySession(_sessionId: string): ActorViolation[] {
    // Mock implementation - filter by session
    return this.violations;
  }

  trackOperation(operation: ActorOperation): void {
    if (!this.isRunning) return;
    this.operations.push(operation);
  }

  trackViolation(violation: ActorViolation): void {
    if (!this.isRunning) return;
    this.violations.push(violation);
    this.emit('violation', violation);
    
    // Check if actor should be blocked
    const actorViolations = this.violations.filter(v => v.actor === violation.actor);
    if (actorViolations.length >= this.violationThreshold) {
      this.blockedActors.add(violation.actor);
    }
  }

  getConfiguration(): any {
    return {
      violationThreshold: this.violationThreshold,
      rules: {}
    };
  }

  setRules(rules: any): void {
    if (!rules || typeof rules !== 'object') {
      throw new Error('Invalid rules configuration');
    }
  }
}