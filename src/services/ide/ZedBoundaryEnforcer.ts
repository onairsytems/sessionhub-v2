import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';

export interface BoundaryViolation {
  id: string;
  type: 'code-in-planning' | 'unauthorized-execution' | 'cross-actor-access' | 'api-misuse';
  actor: 'planning' | 'execution' | 'unknown';
  action: string;
  details: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  prevented: boolean;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  actor: 'planning' | 'execution' | 'both';
  validator: (context: BoundaryContext) => BoundaryValidation;
  action: 'block' | 'warn' | 'audit';
}

export interface BoundaryContext {
  actor: 'planning' | 'execution';
  operation: string;
  content?: string;
  target?: string;
  metadata?: any;
}

export interface BoundaryValidation {
  allowed: boolean;
  violation?: Omit<BoundaryViolation, 'id' | 'timestamp' | 'prevented'>;
  suggestion?: string;
}

export class ZedBoundaryEnforcer extends EventEmitter {
  private logger: Logger;
  private rules: Map<string, BoundaryRule> = new Map();
  private violations: BoundaryViolation[] = [];
  private enforcementEnabled: boolean = true;

  constructor() {
    super();
    this.logger = new Logger('ZedBoundaryEnforcer');
    this.registerDefaultRules();
  }

  private registerDefaultRules(): void {
    // Rule: No code generation in planning actor
    this.registerRule({
      id: 'no-code-in-planning',
      name: 'No Code Generation in Planning Actor',
      description: 'Planning Actor must not generate executable code',
      actor: 'planning',
      validator: (context) => {
        if (context.content && this.containsCodeBlock(context.content)) {
          return {
            allowed: false,
            violation: {
              type: 'code-in-planning',
              actor: 'planning',
              action: context.operation,
              details: { 
                content: context.content.substring(0, 100) + '...',
                codeBlocksFound: true
              },
              severity: 'high'
            },
            suggestion: 'Remove code blocks from planning responses. Use descriptive instructions instead.'
          };
        }
        return { allowed: true };
      },
      action: 'block'
    });

    // Rule: Execution actor must have approved plan
    this.registerRule({
      id: 'execution-requires-plan',
      name: 'Execution Requires Approved Plan',
      description: 'Execution Actor must only act on approved plans',
      actor: 'execution',
      validator: (context) => {
        if (!context.metadata?.planId) {
          return {
            allowed: false,
            violation: {
              type: 'unauthorized-execution',
              actor: 'execution',
              action: context.operation,
              details: { 
                reason: 'No approved plan ID provided',
                target: context.target
              },
              severity: 'critical'
            },
            suggestion: 'Execution must be initiated through an approved planning session.'
          };
        }
        return { allowed: true };
      },
      action: 'block'
    });

    // Rule: No cross-actor data access
    this.registerRule({
      id: 'no-cross-actor-access',
      name: 'No Cross-Actor Data Access',
      description: 'Actors cannot directly access each other\'s internal state',
      actor: 'both',
      validator: (context) => {
        const crossActorPatterns = [
          /planningActor\./,
          /executionActor\./,
          /directAccess/,
          /internalState/
        ];
        
        if (context.content) {
          for (const pattern of crossActorPatterns) {
            if (pattern.test(context.content)) {
              return {
                allowed: false,
                violation: {
                  type: 'cross-actor-access',
                  actor: context.actor,
                  action: context.operation,
                  details: { 
                    pattern: pattern.toString(),
                    content: context.content.substring(0, 100) + '...'
                  },
                  severity: 'high'
                },
                suggestion: 'Use proper instruction flow mechanisms for actor communication.'
              };
            }
          }
        }
        return { allowed: true };
      },
      action: 'block'
    });

    // Rule: Planning responses must be sanitized
    this.registerRule({
      id: 'sanitize-planning-responses',
      name: 'Sanitize Planning Responses',
      description: 'Planning responses must be sanitized before display',
      actor: 'planning',
      validator: (context) => {
        if (context.operation === 'response' && context.content) {
          // Check for potentially dangerous content
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /eval\(/,
            /Function\(/
          ];
          
          for (const pattern of dangerousPatterns) {
            if (pattern.test(context.content)) {
              return {
                allowed: false,
                violation: {
                  type: 'api-misuse',
                  actor: 'planning',
                  action: 'response',
                  details: { 
                    pattern: pattern.toString(),
                    content: context.content.substring(0, 100) + '...'
                  },
                  severity: 'critical'
                },
                suggestion: 'Remove potentially dangerous content from responses.'
              };
            }
          }
        }
        return { allowed: true };
      },
      action: 'block'
    });

    // Rule: Audit all actor transitions
    this.registerRule({
      id: 'audit-transitions',
      name: 'Audit Actor Transitions',
      description: 'All actor transitions must be logged',
      actor: 'both',
      validator: (context) => {
        if (context.operation === 'transition') {
          // Always allow but audit
          this.logger.info('Actor transition:', {
            from: context.metadata?.from,
            to: context.metadata?.to,
            reason: context.metadata?.reason
          });
        }
        return { allowed: true };
      },
      action: 'audit'
    });
  }

  // Register a new boundary rule
  registerRule(rule: BoundaryRule): void {
    this.rules.set(rule.id, rule);
    this.logger.info(`Registered boundary rule: ${rule.name}`);
  }

  // Check if an operation is allowed
  async checkBoundary(context: BoundaryContext): Promise<BoundaryValidation> {
    if (!this.enforcementEnabled) {
      return { allowed: true };
    }

    const applicableRules = Array.from(this.rules.values()).filter(
      rule => rule.actor === context.actor || rule.actor === 'both'
    );

    for (const rule of applicableRules) {
      const validation = rule.validator(context);
      
      if (!validation.allowed) {
        const violation: BoundaryViolation = {
          id: this.generateViolationId(),
          ...validation.violation!,
          timestamp: new Date(),
          prevented: rule.action === 'block'
        };
        
        this.recordViolation(violation);
        
        if (rule.action === 'block') {
          return validation;
        }
      }
    }

    return { allowed: true };
  }

  // Sanitize planning content
  sanitizePlanningContent(content: string): string {
    // Remove code blocks
    let sanitized = content.replace(/```[\s\S]*?```/g, 
      '[Code block removed - Planning Actor generates instructions only]');
    
    // Remove inline code
    sanitized = sanitized.replace(/`[^`]+`/g, (match) => {
      // Keep short inline code that's likely just formatting
      if (match.length < 20) return match;
      return '[Code removed]';
    });
    
    // Remove script tags and dangerous content
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized;
  }

  // Check if content contains code blocks
  private containsCodeBlock(content: string): boolean {
    return /```[\s\S]*?```/.test(content) || 
           /^\s{4,}[\w\W]+/m.test(content); // Indented code blocks
  }

  // Record a violation
  private recordViolation(violation: BoundaryViolation): void {
    this.violations.push(violation);
    
    // Keep only last 1000 violations
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-1000);
    }
    
    this.emit('violation-detected', violation);
    
    // Log based on severity
    const logMessage = `Boundary violation: ${violation.type} - ${violation.action}`;
    switch (violation.severity) {
      case 'critical':
        this.logger.error(logMessage, new Error(JSON.stringify(violation)));
        break;
      case 'high':
        this.logger.warn(logMessage, new Error(JSON.stringify(violation)));
        break;
      default:
        this.logger.info(logMessage);
    }
  }

  // Get violation statistics
  getViolationStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentViolations: BoundaryViolation[];
  } {
    const stats = {
      total: this.violations.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recentViolations: this.violations.slice(-10)
    };
    
    for (const violation of this.violations) {
      stats.byType[violation.type] = (stats.byType[violation.type] || 0) + 1;
      stats.bySeverity[violation.severity] = (stats.bySeverity[violation.severity] || 0) + 1;
    }
    
    return stats;
  }

  // Enable/disable enforcement
  setEnforcementEnabled(enabled: boolean): void {
    this.enforcementEnabled = enabled;
    this.logger.info(`Boundary enforcement ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Clear violations
  clearViolations(): void {
    this.violations = [];
    this.emit('violations-cleared');
  }

  // Export violations for analysis
  exportViolations(): BoundaryViolation[] {
    return [...this.violations];
  }

  private generateViolationId(): string {
    return `vio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Middleware for assistant responses
  async enforceAssistantBoundaries(response: any): Promise<any> {
    const context: BoundaryContext = {
      actor: 'planning',
      operation: 'response',
      content: response.content,
      metadata: response.metadata
    };
    
    const validation = await this.checkBoundary(context);
    
    if (!validation.allowed) {
      // Sanitize the response
      response.content = this.sanitizePlanningContent(response.content);
      response.boundaryEnforced = true;
      response.violation = validation.violation;
    }
    
    return response;
  }

  // Middleware for execution requests
  async enforceExecutionBoundaries(request: any): Promise<boolean> {
    const context: BoundaryContext = {
      actor: 'execution',
      operation: request.type || 'execute',
      content: request.content,
      target: request.target,
      metadata: request.metadata
    };
    
    const validation = await this.checkBoundary(context);
    
    if (!validation.allowed) {
      this.emit('execution-blocked', {
        request,
        violation: validation.violation,
        suggestion: validation.suggestion
      });
    }
    
    return validation.allowed;
  }
}