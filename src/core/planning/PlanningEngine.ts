/**
 * @actor planning
 * @responsibility Generates instructions from user requests
 * @forbidden Cannot execute code, only generate instructions
 */

import { 
  InstructionProtocol, 
  InstructionMetadata, 
  InstructionContext,
  InstructionObjective,
  InstructionRequirement,
  InstructionDeliverable,
  InstructionConstraints,
  SuccessCriterion
} from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { v4 as uuidv4 } from 'uuid';

export interface UserRequest {
  id: string;
  content: string;
  context?: Record<string, any>;
  sessionId?: string;
  timestamp: string;
}

export interface PlanningStrategy {
  approach: string;
  rationale: string;
  risks: string[];
  alternatives: string[];
}

export class PlanningEngine {
  private readonly logger: Logger;
  private readonly validator: ProtocolValidator;

  constructor(logger: Logger, validator: ProtocolValidator) {
    this.logger = logger;
    this.validator = validator;
  }

  /**
   * Main entry point for generating instructions from user requests
   * This method ONLY creates instructions, never executes anything
   */
  async generateInstructions(request: UserRequest): Promise<InstructionProtocol> {
    this.logger.info('PlanningEngine: Generating instructions', { requestId: request.id });

    try {
      // Analyze the request to understand intent
      const context = await this.analyzeContext(request);
      
      // Generate strategic approach
      const strategy = await this.generateStrategy(request, context);
      
      // Build instruction protocol
      const instructions = await this.buildInstructions(request, context, strategy);
      
      // Validate instructions contain no code
      this.validator.ensureNoCode(instructions);
      
      // Validate complete instruction format
      this.validator.validate(instructions);
      
      this.logger.info('PlanningEngine: Instructions generated successfully', {
        instructionId: instructions.metadata.id
      });
      
      return instructions;
    } catch (error) {
      this.logger.error('PlanningEngine: Failed to generate instructions', error as Error);
      throw error;
    }
  }

  private async analyzeContext(request: UserRequest): Promise<InstructionContext> {
    // In a real implementation, this would use AI to analyze the request
    // For now, we'll create a structured context
    return {
      description: `User request: ${request.content}`,
      prerequisites: this.extractPrerequisites(request),
      relatedSessions: request.context?.relatedSessions || [],
      userRequest: request.content
    };
  }

  private extractPrerequisites(request: UserRequest): string[] {
    const prerequisites: string[] = [];
    
    // Check for common prerequisite patterns
    if (request.content.toLowerCase().includes('api')) {
      prerequisites.push('API endpoint available');
    }
    if (request.content.toLowerCase().includes('database')) {
      prerequisites.push('Database connection configured');
    }
    if (request.content.toLowerCase().includes('auth')) {
      prerequisites.push('Authentication system in place');
    }
    
    return prerequisites;
  }

  private async generateStrategy(
    request: UserRequest, 
    context: InstructionContext
  ): Promise<PlanningStrategy> {
    // Strategic planning without implementation details
    return {
      approach: 'Systematic implementation following best practices',
      rationale: 'Ensures maintainable and scalable solution',
      risks: this.identifyRisks(request),
      alternatives: []
    };
  }

  private identifyRisks(request: UserRequest): string[] {
    const risks: string[] = [];
    
    if (request.content.toLowerCase().includes('migration')) {
      risks.push('Data loss during migration');
    }
    if (request.content.toLowerCase().includes('performance')) {
      risks.push('Performance degradation under load');
    }
    
    return risks;
  }

  private async buildInstructions(
    request: UserRequest,
    context: InstructionContext,
    strategy: PlanningStrategy
  ): Promise<InstructionProtocol> {
    const instructionId = uuidv4();
    
    return {
      metadata: this.createMetadata(instructionId, request),
      context,
      objectives: this.createObjectives(request, strategy),
      requirements: this.createRequirements(request),
      deliverables: this.createDeliverables(request),
      constraints: this.createConstraints(request),
      successCriteria: this.createSuccessCriteria(request)
    };
  }

  private createMetadata(instructionId: string, request: UserRequest): InstructionMetadata {
    return {
      id: instructionId,
      sessionId: request.sessionId || uuidv4(),
      sessionName: this.extractSessionName(request),
      timestamp: new Date().toISOString(),
      version: '1.0',
      actor: 'planning'
    };
  }

  private extractSessionName(request: UserRequest): string {
    // Extract a meaningful name from the request
    const words = request.content.split(' ').slice(0, 5);
    return words.join(' ');
  }

  private createObjectives(request: UserRequest, strategy: PlanningStrategy): InstructionObjective[] {
    // Create high-level objectives without implementation details
    return [{
      id: uuidv4(),
      primary: `Fulfill user request: ${request.content}`,
      secondary: [
        'Ensure solution follows best practices',
        'Maintain system integrity',
        'Provide clear validation of success'
      ],
      measurable: true
    }];
  }

  private createRequirements(request: UserRequest): InstructionRequirement[] {
    // Extract requirements from request without specifying HOW
    const requirements: InstructionRequirement[] = [];
    
    // Always include core requirements
    requirements.push({
      id: uuidv4(),
      description: 'Solution must be fully functional',
      priority: 'must',
      acceptanceCriteria: ['All features work as requested']
    });
    
    requirements.push({
      id: uuidv4(),
      description: 'Code must follow project standards',
      priority: 'must',
      acceptanceCriteria: ['Passes all validation checks']
    });
    
    return requirements;
  }

  private createDeliverables(request: UserRequest): InstructionDeliverable[] {
    // Define what should be delivered, not how
    return [{
      type: 'file',
      description: 'Implementation files for the requested functionality',
      validation: 'Files exist and are syntactically correct'
    }];
  }

  private createConstraints(request: UserRequest): InstructionConstraints {
    return {
      patterns: ['Follow existing project patterns'],
      avoid: ['Breaking changes to existing functionality'],
      timeLimit: 3600000 // 1 hour default
    };
  }

  private createSuccessCriteria(request: UserRequest): SuccessCriterion[] {
    return [
      {
        id: uuidv4(),
        criterion: 'All requested functionality is implemented',
        validationMethod: 'Functional testing',
        automated: true
      },
      {
        id: uuidv4(),
        criterion: 'No errors in implementation',
        validationMethod: 'Static analysis and linting',
        automated: true
      }
    ];
  }
}