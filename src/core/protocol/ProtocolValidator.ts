/**
 * @actor system
 * @responsibility Validates instruction protocol and enforces actor boundaries
 */

import { InstructionProtocol } from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';

export class ProtocolValidator {
  private readonly logger: Logger;
  
  // Patterns that indicate code in instructions
  private readonly codePatterns = [
    /function\s+\w+\s*\(/,
    /class\s+\w+/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    /import\s+.*from/,
    /require\s*\(/,
    /<[^>]+>/,  // HTML/JSX
    /```[a-z]*\n[\s\S]*?```/, // Code blocks
    /\bif\s*\(/,
    /\bfor\s*\(/,
    /\bwhile\s*\(/
  ];

  // Patterns that indicate strategic planning in execution
  private readonly planningPatterns = [
    /should\s+we/i,
    /what\s+if/i,
    /consider\s+using/i,
    /alternative\s+approach/i,
    /better\s+to/i,
    /recommend/i,
    /suggest/i
  ];

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
    const instructionText = JSON.stringify(instructions);
    
    for (const pattern of this.codePatterns) {
      if (pattern.test(instructionText)) {
        const error = new Error(
          `Planning Actor attempted to include code in instructions. Pattern detected: ${pattern.toString()}`
        );
        this.logger.error('ProtocolValidator: Code detected in instructions', error);
        throw error;
      }
    }
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
    instructions: InstructionProtocol,
    result: any
  ): boolean {
    // This would validate that execution results meet the success criteria
    // For now, we'll do basic validation
    return result && result.status !== 'failure';
  }
}