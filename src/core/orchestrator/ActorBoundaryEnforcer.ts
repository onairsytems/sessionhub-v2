/**
 * Enforces strict boundaries between Planning and Execution actors
 * Prevents any cross-contamination of responsibilities
 */

import { Logger } from '@/src/lib/logging/Logger';

export interface Actor {
  type: 'planning' | 'execution';
  id: string;
  capabilities: string[];
}

export interface Operation {
  type: 'plan' | 'execute' | 'analyze' | 'decide';
  actor: Actor;
  description: string;
  timestamp: string;
}

export class ActorBoundaryEnforcer {
  private readonly logger: Logger;
  private readonly violations: Map<string, Operation[]> = new Map();

  // Define what each actor can and cannot do
  private readonly actorPermissions = {
    planning: {
      allowed: ['analyze', 'plan', 'decide', 'strategize'],
      forbidden: ['execute', 'implement', 'run', 'deploy']
    },
    execution: {
      allowed: ['execute', 'implement', 'run', 'deploy'],
      forbidden: ['analyze', 'plan', 'decide', 'strategize']
    }
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate that an actor is allowed to perform an operation
   */
  validateOperation(operation: Operation): void {
    const { actor, type } = operation;
    const permissions = this.actorPermissions[actor.type];

    if (!permissions) {
      throw new Error(`Unknown actor type: ${actor.type}`);
    }

    // Check if operation is forbidden for this actor
    const operationCategory = this.categorizeOperation(type);
    
    if (permissions.forbidden.includes(operationCategory)) {
      const violation = new Error(
        `Boundary violation: ${actor.type} actor attempted to ${operationCategory}. ` +
        `This operation is forbidden for ${actor.type} actors.`
      );
      
      this.logViolation(operation);
      this.logger.error('ActorBoundaryEnforcer: Boundary violation detected', violation);
      throw violation;
    }

    // Log successful validation
    this.logger.debug('ActorBoundaryEnforcer: Operation validated', {
      actor: actor.type,
      operation: type
    });
  }

  /**
   * Check if a piece of code/text violates actor boundaries
   */
  validateContent(content: string, actorType: 'planning' | 'execution'): void {
    const violations: string[] = [];

    if (actorType === 'planning') {
      // Planning should not contain implementation
      const implementationPatterns = [
        { pattern: /npm\s+install/gi, description: 'npm install command' },
        { pattern: /yarn\s+add/gi, description: 'yarn add command' },
        { pattern: /function\s+\w+\s*\(/g, description: 'function definition' },
        { pattern: /class\s+\w+/g, description: 'class definition' },
        { pattern: /CREATE\s+TABLE/gi, description: 'SQL DDL' },
        { pattern: /docker\s+run/gi, description: 'docker command' }
      ];

      for (const { pattern, description } of implementationPatterns) {
        if (pattern.test(content)) {
          violations.push(`Planning actor included ${description}`);
        }
      }
    } else if (actorType === 'execution') {
      // Execution should not contain strategic planning
      const planningPatterns = [
        { pattern: /should\s+we\s+use/gi, description: 'strategic question' },
        { pattern: /let's\s+consider/gi, description: 'planning language' },
        { pattern: /alternative\s+approach/gi, description: 'alternative planning' },
        { pattern: /pros\s+and\s+cons/gi, description: 'decision making' },
        { pattern: /recommend\s+using/gi, description: 'recommendation' }
      ];

      for (const { pattern, description } of planningPatterns) {
        if (pattern.test(content)) {
          violations.push(`Execution actor included ${description}`);
        }
      }
    }

    if (violations.length > 0) {
      const error = new Error(
        `Content boundary violations detected:\n${violations.join('\n')}`
      );
      this.logger.error('ActorBoundaryEnforcer: Content violations', error);
      throw error;
    }
  }

  /**
   * Intercept and validate method calls to ensure boundary compliance
   */
  createBoundaryProxy<T extends object>(target: T, actorType: 'planning' | 'execution'): T {
    return new Proxy(target, {
      get: (obj, prop) => {
        const value = obj[prop as keyof T];
        
        if (typeof value === 'function') {
          return (...args: any[]) => {
            // Validate the method call
            const methodName = String(prop);
            this.validateMethodCall(methodName, actorType);
            
            // Execute the original method
            return value.apply(obj, args);
          };
        }
        
        return value;
      }
    });
  }

  private validateMethodCall(methodName: string, actorType: 'planning' | 'execution'): void {
    const forbiddenMethods = {
      planning: ['execute', 'run', 'deploy', 'implement'],
      execution: ['plan', 'strategize', 'decide', 'analyze']
    };

    const forbidden = forbiddenMethods[actorType] || [];
    
    for (const forbiddenMethod of forbidden) {
      if (methodName.toLowerCase().includes(forbiddenMethod)) {
        throw new Error(
          `Method "${methodName}" is forbidden for ${actorType} actors`
        );
      }
    }
  }

  private categorizeOperation(operationType: string): string {
    const categories = {
      execute: ['execute', 'run', 'implement', 'deploy'],
      plan: ['plan', 'analyze', 'decide', 'strategize']
    };

    for (const [category, types] of Object.entries(categories)) {
      if (types.includes(operationType)) {
        return category;
      }
    }

    return operationType;
  }

  private logViolation(operation: Operation): void {
    const violations = this.violations.get(operation.actor.id) || [];
    violations.push(operation);
    this.violations.set(operation.actor.id, violations);
  }

  /**
   * Get violation history for an actor
   */
  getViolationHistory(actorId: string): Operation[] {
    return this.violations.get(actorId) || [];
  }

  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.violations.clear();
  }
}