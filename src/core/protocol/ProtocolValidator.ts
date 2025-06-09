
/**
 * @actor system
 * @responsibility Validates instruction protocol and enforces actor boundaries
 */

import { InstructionProtocol } from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';

export class ProtocolValidator {
  private readonly logger: Logger;
  
  // Enhanced patterns that indicate code in instructions
  private readonly codePatterns = [
    // Function definitions
    /function\s+\w+\s*\(/,
    /const\s+\w+\s*=\s*\([^)]*\)\s*=>/,
    /\w+\s*:\s*\([^)]*\)\s*=>/,
    
    // Class definitions
    /class\s+\w+/,
    /interface\s+\w+/,
    /type\s+\w+\s*=/,
    /enum\s+\w+/,
    
    // Variable declarations
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    
    // Import/Export statements
    /import\s+.*from/,
    /export\s+(default\s+)?/,
    /require\s*\(/,
    /module\.exports/,
    
    // Control structures
    /\bif\s*\(/,
    /\bfor\s*\(/,
    /\bwhile\s*\(/,
    /\bswitch\s*\(/,
    /\btry\s*{/,
    /\bcatch\s*\(/,
    
    // Code blocks
    /```[a-z]*\n[\s\S]*?```/,
    /~~~[a-z]*\n[\s\S]*?~~~/, 
    
    // HTML/JSX
    /<[^>]+>/,
    /className=/,
    /onClick=/,
    
    // Shell commands
    /cat\s*>\s*[\w\/.]+\s*<<\s*['"]?EOF/,
    /npm\s+(install|i)\s+/,
    /yarn\s+add\s+/,
    /pip\s+install\s+/,
    /git\s+(clone|init|add|commit)/,
    /mkdir\s+-?p?\s+/,
    
    // API/Database queries
    /SELECT\s+.*FROM/i,
    /INSERT\s+INTO/i,
    /UPDATE\s+.*SET/i,
    /DELETE\s+FROM/i,
    
    // Method calls and operators
    /\.\w+\(/,
    /=>/,
    /\+=|-=|\*=|\/=/,
    /===|!==|==|!=/
  ];

  // Enhanced patterns that indicate strategic planning in execution
  private readonly planningPatterns = [
    /should\s+we/i,
    /what\s+if/i,
    /consider\s+using/i,
    /alternative\s+approach/i,
    /better\s+to/i,
    /recommend/i,
    /suggest/i,
    /might\s+want\s+to/i,
    /could\s+try/i,
    /let's\s+think/i,
    /analyze\s+the/i,
    /evaluate\s+whether/i,
    /pros\s+and\s+cons/i,
    /trade-?offs?/i,
    /which\s+is\s+better/i
  ];
  
  // Violation tracking for reporting
  private violationHistory: Array<{
    timestamp: Date;
    type: 'code-in-planning' | 'planning-in-execution';
    pattern: string;
    context: string;
  }> = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Validate instruction protocol structure and content
   */
  validate(instructions: InstructionProtocol): void {
    this.logger.debug('ProtocolValidator: Validating instructions', {
      instructionId: instructions.metadata.id
    });

    // Validate required fields
    this.validateStructure(instructions);
    
    // Validate metadata
    this.validateMetadata(instructions);
    
    // Validate no code in instructions
    this.ensureNoCode(instructions);
    
    // Validate requirements are descriptive
    this.validateRequirements(instructions);
    
    // Validate success criteria
    this.validateSuccessCriteria(instructions);

    this.logger.debug('ProtocolValidator: Validation passed');
  }

  /**
   * Ensure instructions contain no executable code
   */
  ensureNoCode(instructions: InstructionProtocol): void {
    const instructionText = JSON.stringify(instructions, null, 2);
    const violations: Array<{pattern: RegExp, match: string, location: string}> = [];
    
    // Check each pattern
    for (const pattern of this.codePatterns) {
      const matches = instructionText.match(pattern);
      if (matches) {
        // Find approximate location in the instruction
        const location = this.findViolationLocation(instructions, matches[0]);
        violations.push({
          pattern,
          match: matches[0],
          location
        });
      }
    }
    
    if (violations.length > 0) {
      // Log violation to history
      violations.forEach(v => {
        this.violationHistory.push({
          timestamp: new Date(),
          type: 'code-in-planning',
          pattern: v.pattern.toString(),
          context: v.match
        });
      });
      
      // Create detailed error message
      const violationDetails = violations.map(v => 
        `  - Pattern: ${v.pattern.toString()}\n    Found: "${v.match}"\n    Location: ${v.location}`
      ).join('\n');
      
      const error = new Error(
        `🚨 ACTOR BOUNDARY VIOLATION: Planning Actor attempted to include code in instructions.\n\n` +
        `Violations detected:\n${violationDetails}\n\n` +
        `See docs/ACTOR-VIOLATIONS.md for examples of correct patterns.`
      );
      
      this.logger.error('ProtocolValidator: Code detected in planning instructions', error, {
        violations: violations.length,
        history: this.violationHistory.length
      });
      
      throw error;
    }
  }
  
  /**
   * Find approximate location of violation in instruction structure
   */
  private findViolationLocation(instructions: InstructionProtocol, match: string): string {
    const text = JSON.stringify(instructions, null, 2);
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes(match)) {
        // Try to identify the field
        for (let j = i; j >= 0; j--) {
          const prevLine = lines[j];
          if (prevLine) {
            const fieldMatch = prevLine.match(/"(\w+)":/);
            if (fieldMatch && fieldMatch[1]) {
              return `${fieldMatch[1]} field (line ~${i + 1})`;
            }
          }
        }
        return `line ~${i + 1}`;
      }
    }
    return 'unknown location';
  }

  /**
   * Ensure execution doesn't contain planning/strategy
   */
  ensureExecutionBoundary(instructions: InstructionProtocol): void {
    if (instructions.metadata.actor !== 'planning') {
      // Only check execution actor outputs
      const instructionText = JSON.stringify(instructions);
      
      for (const pattern of this.planningPatterns) {
        if (pattern.test(instructionText)) {
          const error = new Error(
            `Execution Actor attempted strategic planning. Pattern detected: ${pattern.toString()}`
          );
          this.logger.error('ProtocolValidator: Planning detected in execution', error);
          throw error;
        }
      }
    }
  }

  private validateStructure(instructions: InstructionProtocol): void {
    const requiredFields = [
      'metadata',
      'context', 
      'objectives',
      'requirements',
      'deliverables',
      'constraints',
      'successCriteria'
    ];

    for (const field of requiredFields) {
      if (!(field in instructions)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate arrays are not empty
    if (instructions.objectives.length === 0) {
      throw new Error('Instructions must have at least one objective');
    }
    
    if (instructions.requirements.length === 0) {
      throw new Error('Instructions must have at least one requirement');
    }
    
    if (instructions.successCriteria.length === 0) {
      throw new Error('Instructions must have at least one success criterion');
    }
  }

  private validateMetadata(instructions: InstructionProtocol): void {
    const { metadata } = instructions;
    
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Invalid instruction ID');
    }
    
    if (!metadata.sessionId || typeof metadata.sessionId !== 'string') {
      throw new Error('Invalid session ID');
    }
    
    if (metadata.version !== '1.0') {
      throw new Error(`Unsupported instruction version: ${metadata.version}`);
    }
    
    if (!['planning', 'execution'].includes(metadata.actor)) {
      throw new Error(`Invalid actor type: ${metadata.actor}`);
    }
    
    // Validate timestamp
    const timestamp = new Date(metadata.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid timestamp');
    }
  }

  private validateRequirements(instructions: InstructionProtocol): void {
    for (const requirement of instructions.requirements) {
      // Ensure requirements are descriptive, not prescriptive
      if (!requirement.description || requirement.description.length < 10) {
        throw new Error('Requirement description too short');
      }
      
      if (!['must', 'should', 'could'].includes(requirement.priority)) {
        throw new Error(`Invalid requirement priority: ${requirement.priority}`);
      }
      
      // Check for implementation details in requirements
      const implementationKeywords = [
        'npm install',
        'yarn add',
        'pip install',
        'git clone',
        'mkdir',
        'create file'
      ];
      
      const desc = requirement.description.toLowerCase();
      for (const keyword of implementationKeywords) {
        if (desc.includes(keyword)) {
          throw new Error(
            `Requirement contains implementation details: "${keyword}" in "${requirement.description}"`
          );
        }
      }
    }
  }

  private validateSuccessCriteria(instructions: InstructionProtocol): void {
    for (const criterion of instructions.successCriteria) {
      if (!criterion.criterion || criterion.criterion.length < 10) {
        throw new Error('Success criterion too short');
      }
      
      if (!criterion.validationMethod) {
        throw new Error('Success criterion missing validation method');
      }
      
      if (typeof criterion.automated !== 'boolean') {
        throw new Error('Success criterion must specify if automated');
      }
    }
  }

  /**
   * Validate that an execution result matches success criteria
   */
  validateExecutionResult(
    _instructions: InstructionProtocol,
    result: any
  ): boolean {
    // This would validate that execution results meet the success criteria
    // For now, we'll do basic validation
    return result && result.status !== 'failure';
  }
  
  /**
   * Get violation history for reporting
   */
  getViolationHistory(): typeof this.violationHistory {
    return [...this.violationHistory];
  }
  
  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.violationHistory = [];
  }
}