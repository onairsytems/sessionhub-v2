import { Logger } from '@/src/lib/logging/Logger';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { EventEmitter } from 'events';

export interface ViolationEvent {
  type: 'code-in-planning' | 'planning-in-execution';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  pattern: string;
  context: string;
  actor: 'planning' | 'execution';
  suggestion?: string;
  timestamp: Date;
}

export class ActorViolationService extends EventEmitter {
  private readonly logger: Logger;
  private readonly validator: ProtocolValidator;
  private violationCount: number = 0;
  private readonly maxViolationsBeforeBlock = 3;

  constructor(logger: Logger, validator: ProtocolValidator) {
    super();
    this.logger = logger;
    this.validator = validator;
  }

  /**
   * Check content for actor boundary violations
   */
  checkForViolations(content: string, actor: 'planning' | 'execution'): ViolationEvent[] {
    const violations: ViolationEvent[] = [];

    if (actor === 'planning') {
      violations.push(...this.checkPlanningViolations(content));
    } else {
      violations.push(...this.checkExecutionViolations(content));
    }

    // Emit violations
    violations.forEach(violation => {
      this.violationCount++;
      this.emit('violation', violation);
      
      // Log violation
      this.logger.warn('Actor boundary violation detected', {
        ...violation,
        totalViolations: this.violationCount
      });
    });

    // Check if we should block further operations
    if (this.violationCount >= this.maxViolationsBeforeBlock) {
      this.emit('block', {
        reason: 'Too many actor boundary violations',
        count: this.violationCount
      });
    }

    return violations;
  }

  /**
   * Check for code patterns in planning actor content
   */
  private checkPlanningViolations(content: string): ViolationEvent[] {
    const violations: ViolationEvent[] = [];
    
    // Code block patterns
    const codeBlockPattern = /```[a-z]*\n[\s\S]*?```/g;
    const codeBlocks = content.match(codeBlockPattern);
    if (codeBlocks) {
      violations.push({
        type: 'code-in-planning',
        severity: 'CRITICAL',
        message: 'Planning Actor attempted to write code blocks',
        pattern: 'Code block (```)',
        context: codeBlocks[0].substring(0, 100) + '...',
        actor: 'planning',
        suggestion: 'Describe what the code should do instead of writing it. See PLANNING-ACTOR-RULES.md',
        timestamp: new Date()
      });
    }

    // Function definitions
    const functionPattern = /function\s+\w+\s*\(|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g;
    const functions = content.match(functionPattern);
    if (functions) {
      violations.push({
        type: 'code-in-planning',
        severity: 'CRITICAL',
        message: 'Planning Actor attempted to define functions',
        pattern: 'Function definition',
        context: functions[0],
        actor: 'planning',
        suggestion: 'Describe the function\'s purpose and behavior instead',
        timestamp: new Date()
      });
    }

    // Shell commands
    const shellPattern = /npm\s+(install|i)\s+|yarn\s+add\s+|pip\s+install\s+|git\s+\w+/g;
    const shellCommands = content.match(shellPattern);
    if (shellCommands) {
      violations.push({
        type: 'code-in-planning',
        severity: 'HIGH',
        message: 'Planning Actor specified shell commands',
        pattern: 'Shell command',
        context: shellCommands[0],
        actor: 'planning',
        suggestion: 'Describe the setup requirements instead of specific commands',
        timestamp: new Date()
      });
    }

    // Specific library mentions
    const libraryPattern = /import\s+.*from\s+['"]|React\.|Vue\.|Angular|Express\.|Django/g;
    const libraries = content.match(libraryPattern);
    if (libraries) {
      violations.push({
        type: 'code-in-planning',
        severity: 'MEDIUM',
        message: 'Planning Actor mentioned specific libraries',
        pattern: 'Library specification',
        context: libraries[0],
        actor: 'planning',
        suggestion: 'Describe capabilities needed instead of specific technologies',
        timestamp: new Date()
      });
    }

    return violations;
  }

  /**
   * Check for strategic planning in execution actor content
   */
  private checkExecutionViolations(content: string): ViolationEvent[] {
    const violations: ViolationEvent[] = [];

    // Questions and uncertainty
    const questionPattern = /should\s+we\s+|what\s+if\s+|which\s+is\s+better|might\s+be\s+better/gi;
    const questions = content.match(questionPattern);
    if (questions) {
      violations.push({
        type: 'planning-in-execution',
        severity: 'HIGH',
        message: 'Execution Actor is asking strategic questions',
        pattern: 'Strategic questioning',
        context: questions[0],
        actor: 'execution',
        suggestion: 'Make decisive implementation choices based on the instructions',
        timestamp: new Date()
      });
    }

    // Recommendations
    const recommendPattern = /I\s+(recommend|suggest)|would\s+be\s+better|consider\s+using/gi;
    const recommendations = content.match(recommendPattern);
    if (recommendations) {
      violations.push({
        type: 'planning-in-execution',
        severity: 'HIGH',
        message: 'Execution Actor is making recommendations',
        pattern: 'Recommendation language',
        context: recommendations[0],
        actor: 'execution',
        suggestion: 'Implement directly without recommending alternatives',
        timestamp: new Date()
      });
    }

    // Analysis language
    const analysisPattern = /let's\s+analyze|pros\s+and\s+cons|trade-?offs?|evaluate\s+whether/gi;
    const analysis = content.match(analysisPattern);
    if (analysis) {
      violations.push({
        type: 'planning-in-execution',
        severity: 'MEDIUM',
        message: 'Execution Actor is performing strategic analysis',
        pattern: 'Analysis language',
        context: analysis[0],
        actor: 'execution',
        suggestion: 'Execute the task directly without analysis',
        timestamp: new Date()
      });
    }

    return violations;
  }

  /**
   * Get violation statistics
   */
  getStats() {
    return {
      totalViolations: this.violationCount,
      isBlocked: this.violationCount >= this.maxViolationsBeforeBlock,
      violationHistory: this.validator.getViolationHistory()
    };
  }

  /**
   * Reset violation count (e.g., after a session)
   */
  reset() {
    this.violationCount = 0;
    this.validator.clearViolationHistory();
    this.emit('reset');
  }

  /**
   * Check if actor should be blocked
   */
  shouldBlock(): boolean {
    return this.violationCount >= this.maxViolationsBeforeBlock;
  }
}