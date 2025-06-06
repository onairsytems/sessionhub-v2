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
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { PatternRecognitionService } from '@/src/services/intelligence/PatternRecognitionService';
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
  private readonly claudeApi?: ClaudeAPIClient;
  private readonly patternService: PatternRecognitionService;
  private readonly useRealApi: boolean;

  constructor(
    logger: Logger, 
    validator: ProtocolValidator,
    claudeApi?: ClaudeAPIClient,
    patternService?: PatternRecognitionService
  ) {
    this.logger = logger;
    this.validator = validator;
    this.claudeApi = claudeApi;
    this.patternService = patternService || new PatternRecognitionService();
    this.useRealApi = !!claudeApi;
  }

  /**
   * Main entry point for generating instructions from user requests
   * This method ONLY creates instructions, never executes anything
   */
  async generateInstructions(request: UserRequest): Promise<InstructionProtocol> {
    this.logger.info('PlanningEngine: Generating instructions', { 
      requestId: request.id,
      useRealApi: this.useRealApi 
    });

    try {
      // Get pattern suggestions for the request context
      const patternSuggestions = await this.getPatternSuggestionsForRequest(request);
      
      let instructions: InstructionProtocol;

      if (this.useRealApi && this.claudeApi) {
        // Use real Claude API with pattern context
        instructions = await this.generateWithClaudeAPI(request, patternSuggestions);
      } else {
        // Use mock implementation with pattern enhancements
        const context = await this.analyzeContext(request, patternSuggestions);
        const strategy = await this.generateStrategy(request, context, patternSuggestions);
        instructions = await this.buildInstructions(request, context, strategy, patternSuggestions);
      }
      
      // Validate instructions contain no code
      this.validator.ensureNoCode(instructions);
      
      // Validate complete instruction format
      this.validator.validate(instructions);
      
      this.logger.info('PlanningEngine: Instructions generated successfully', {
        instructionId: instructions.metadata.id,
        patternsApplied: patternSuggestions.length
      });
      
      return instructions;
    } catch (error) {
      this.logger.error('PlanningEngine: Failed to generate instructions', error as Error);
      throw error;
    }
  }

  /**
   * Get pattern suggestions relevant to the user request
   */
  private async getPatternSuggestionsForRequest(request: UserRequest): Promise<any[]> {
    try {
      // Extract context from request
      const projectType = request.context?.projectType || 'web';
      const language = request.context?.language || 'typescript';
      const framework = request.context?.framework || 'react';
      
      // Get suggestions from pattern service
      const suggestions = await this.patternService.getSuggestionsForContext({
        projectType,
        language,
        framework,
        currentCode: request.context?.currentCode,
        errorMessage: request.context?.errorMessage
      });
      
      this.logger.info('PlanningEngine: Retrieved pattern suggestions', {
        requestId: request.id,
        suggestionCount: suggestions.length
      });
      
      return suggestions;
    } catch (error) {
      this.logger.warn('PlanningEngine: Failed to get pattern suggestions', error as Error);
      return [];
    }
  }

  private async generateWithClaudeAPI(request: UserRequest, patternSuggestions: any[]): Promise<InstructionProtocol> {
    if (!this.claudeApi) {
      throw new Error('Claude API client not configured');
    }

    const context = await this.analyzeContext(request, patternSuggestions);
    
    // Generate strategy using Claude API with pattern context
    const strategyResponse = await this.claudeApi.generateStrategy({
      request: {
        id: request.id,
        content: request.content,
        context: request.context,
        timestamp: request.timestamp
      },
      context,
      patternSuggestions: patternSuggestions.map(s => ({
        pattern: s.pattern.description,
        relevance: s.relevanceScore,
        reason: s.reason,
        strategy: s.applicationStrategy
      }))
    });

    // If Claude returns a complete instruction protocol, use it
    if (this.isValidInstructionProtocol(strategyResponse)) {
      return strategyResponse as InstructionProtocol;
    }

    // Otherwise, build instructions from the strategy
    const strategy: PlanningStrategy = {
      approach: strategyResponse.approach || 'Systematic implementation',
      rationale: strategyResponse.rationale || 'Best practices approach',
      risks: strategyResponse.risks || [],
      alternatives: strategyResponse.alternatives || []
    };

    return this.buildInstructions(request, context, strategy, patternSuggestions);
  }

  private isValidInstructionProtocol(obj: any): boolean {
    return obj &&
      obj.metadata &&
      obj.context &&
      obj.objectives &&
      obj.requirements &&
      obj.deliverables &&
      obj.constraints &&
      obj.successCriteria;
  }

  private async analyzeContext(request: UserRequest, patternSuggestions: any[]): Promise<InstructionContext> {
    // Create context enriched with pattern insights
    const prerequisites = this.extractPrerequisites(request);
    
    // Add pattern-based prerequisites
    patternSuggestions.forEach(suggestion => {
      if (suggestion.pattern.type === 'success' && suggestion.relevanceScore > 0.7) {
        const patternPrereq = `Pattern: ${suggestion.pattern.description} (${Math.round(suggestion.pattern.successRate * 100)}% success rate)`;
        if (!prerequisites.includes(patternPrereq)) {
          prerequisites.push(patternPrereq);
        }
      }
    });
    
    // Build enhanced context description
    const patternInsights = patternSuggestions.length > 0 
      ? `\nRecommended patterns: ${patternSuggestions.slice(0, 3).map(s => s.pattern.description).join(', ')}`
      : '';
    
    return {
      description: `User request: ${request.content}${patternInsights}`,
      prerequisites,
      relatedSessions: request.context?.relatedSessions || [],
      userRequest: request.content,
      patternContext: {
        suggestedPatterns: patternSuggestions.map(s => s.pattern.description),
        avoidPatterns: patternSuggestions
          .filter(s => s.pattern.type === 'error')
          .map(s => s.pattern.description)
      }
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
    context: InstructionContext,
    patternSuggestions: any[]
  ): Promise<PlanningStrategy> {
    // Strategic planning enhanced with pattern insights
    const topSuggestion = patternSuggestions[0];
    const hasErrorPatterns = patternSuggestions.some(s => s.pattern.type === 'error');
    
    // Build approach based on patterns
    const approach = topSuggestion 
      ? `${topSuggestion.applicationStrategy}. Apply proven patterns with ${Math.round(topSuggestion.pattern.successRate * 100)}% success rate`
      : 'Systematic implementation following best practices';
    
    // Build rationale incorporating pattern benefits
    const patternBenefits = patternSuggestions.slice(0, 2).map(s => {
      const impact = s.estimatedImpact;
      return `${s.pattern.description}: ${impact.timeReduction}% faster, ${impact.errorReduction}% fewer errors`;
    }).join('; ');
    
    const rationale = patternBenefits 
      ? `${patternBenefits}. Ensures maintainable and scalable solution`
      : 'Ensures maintainable and scalable solution';
    
    // Identify risks including pattern-based risks
    const risks = this.identifyRisks(request, patternSuggestions);
    
    // Generate alternatives based on pattern suggestions
    const alternatives = patternSuggestions.slice(1, 3).map(s => 
      `Alternative: ${s.applicationStrategy} (${Math.round(s.relevanceScore * 100)}% relevance)`
    );
    
    return {
      approach,
      rationale,
      risks,
      alternatives
    };
  }

  private identifyRisks(request: UserRequest, patternSuggestions?: any[]): string[] {
    const risks: string[] = [];
    
    // Standard risk identification
    if (request.content.toLowerCase().includes('migration')) {
      risks.push('Data loss during migration');
    }
    if (request.content.toLowerCase().includes('performance')) {
      risks.push('Performance degradation under load');
    }
    
    // Pattern-based risk identification
    if (patternSuggestions) {
      const errorPatterns = patternSuggestions.filter(s => s.pattern.type === 'error');
      errorPatterns.forEach(errorPattern => {
        risks.push(`Risk of ${errorPattern.pattern.description} (seen ${errorPattern.pattern.frequency} times)`);
      });
      
      // Add risks for low success rate patterns
      const lowSuccessPatterns = patternSuggestions.filter(s => s.pattern.successRate < 0.5);
      lowSuccessPatterns.forEach(pattern => {
        risks.push(`Low success rate (${Math.round(pattern.pattern.successRate * 100)}%) for ${pattern.pattern.description}`);
      });
    }
    
    return risks;
  }

  private async buildInstructions(
    request: UserRequest,
    context: InstructionContext,
    strategy: PlanningStrategy,
    patternSuggestions?: any[]
  ): Promise<InstructionProtocol> {
    const instructionId = uuidv4();
    
    return {
      metadata: this.createMetadata(instructionId, request),
      context,
      objectives: this.createObjectives(request, strategy, patternSuggestions),
      requirements: this.createRequirements(request, patternSuggestions),
      deliverables: this.createDeliverables(request, patternSuggestions),
      constraints: this.createConstraints(request, patternSuggestions),
      successCriteria: this.createSuccessCriteria(request, patternSuggestions)
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

  private createObjectives(request: UserRequest, strategy: PlanningStrategy, patternSuggestions?: any[]): InstructionObjective[] {
    // Create high-level objectives without implementation details
    const secondaryObjectives = [
      'Ensure solution follows best practices',
      'Maintain system integrity',
      'Provide clear validation of success'
    ];
    
    // Add pattern-based objectives
    if (patternSuggestions && patternSuggestions.length > 0) {
      const topPattern = patternSuggestions[0];
      secondaryObjectives.push(
        `Apply ${topPattern.pattern.description} for ${topPattern.estimatedImpact.qualityImprovement}% quality improvement`
      );
      
      // Add error prevention objective if error patterns detected
      const errorPatterns = patternSuggestions.filter(s => s.pattern.type === 'error');
      if (errorPatterns.length > 0) {
        secondaryObjectives.push(
          `Avoid known error patterns: ${errorPatterns.map(e => e.pattern.description).join(', ')}`
        );
      }
    }
    
    return [{
      id: uuidv4(),
      primary: `Fulfill user request: ${request.content}`,
      secondary: secondaryObjectives,
      measurable: true
    }];
  }

  private createRequirements(request: UserRequest, patternSuggestions?: any[]): InstructionRequirement[] {
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
    
    // Add pattern-based requirements
    if (patternSuggestions && patternSuggestions.length > 0) {
      // Require implementation of high-relevance success patterns
      const successPatterns = patternSuggestions.filter(s => 
        s.pattern.type === 'success' && s.relevanceScore > 0.7
      );
      
      if (successPatterns.length > 0) {
        requirements.push({
          id: uuidv4(),
          description: `Implement recommended patterns: ${successPatterns[0].pattern.description}`,
          priority: 'should',
          acceptanceCriteria: [
            `Pattern applied correctly with ${successPatterns[0].pattern.successRate * 100}% expected success rate`,
            'Pattern improves code quality and maintainability'
          ]
        });
      }
      
      // Require avoidance of error patterns
      const errorPatterns = patternSuggestions.filter(s => s.pattern.type === 'error');
      if (errorPatterns.length > 0) {
        requirements.push({
          id: uuidv4(),
          description: 'Avoid known anti-patterns and error-prone code',
          priority: 'must',
          acceptanceCriteria: errorPatterns.map(e => 
            `No instances of: ${e.pattern.description}`
          )
        });
      }
    }
    
    return requirements;
  }

  private createDeliverables(request: UserRequest, patternSuggestions?: any[]): InstructionDeliverable[] {
    // Define what should be delivered, not how
    const deliverables: InstructionDeliverable[] = [{
      type: 'file',
      description: 'Implementation files for the requested functionality',
      validation: 'Files exist and are syntactically correct'
    }];
    
    // Add pattern-specific deliverables
    if (patternSuggestions && patternSuggestions.length > 0) {
      const hasTestPatterns = patternSuggestions.some(s => 
        s.pattern.tags.includes('testing') || s.pattern.description.includes('test')
      );
      
      if (hasTestPatterns) {
        deliverables.push({
          type: 'test',
          description: 'Test files following recommended testing patterns',
          validation: 'Tests pass and provide adequate coverage'
        });
      }
      
      const hasDocPatterns = patternSuggestions.some(s => 
        s.pattern.tags.includes('documentation') || s.pattern.description.includes('documentation')
      );
      
      if (hasDocPatterns) {
        deliverables.push({
          type: 'documentation',
          description: 'Documentation following project standards',
          validation: 'Documentation is clear and comprehensive'
        });
      }
    }
    
    return deliverables;
  }

  private createConstraints(request: UserRequest, patternSuggestions?: any[]): InstructionConstraints {
    const patterns = ['Follow existing project patterns'];
    const avoid = ['Breaking changes to existing functionality'];
    
    // Add pattern-based constraints
    if (patternSuggestions && patternSuggestions.length > 0) {
      // Add recommended patterns to follow
      const successPatterns = patternSuggestions
        .filter(s => s.pattern.type === 'success' && s.relevanceScore > 0.6)
        .slice(0, 3);
      
      successPatterns.forEach(s => {
        patterns.push(`Apply: ${s.pattern.description} (${Math.round(s.pattern.successRate * 100)}% success rate)`);
      });
      
      // Add error patterns to avoid
      const errorPatterns = patternSuggestions
        .filter(s => s.pattern.type === 'error')
        .slice(0, 5);
      
      errorPatterns.forEach(s => {
        avoid.push(`Avoid: ${s.pattern.description} (causes ${Math.round((1 - s.pattern.successRate) * 100)}% failure rate)`);
        if (s.pattern.solutions && s.pattern.solutions.length > 0) {
          patterns.push(`Instead use: ${s.pattern.solutions[0].description}`);
        }
      });
      
      // Add optimization patterns
      const optimizationPatterns = patternSuggestions
        .filter(s => s.pattern.type === 'optimization');
      
      optimizationPatterns.forEach(s => {
        patterns.push(`Optimize: ${s.pattern.description} for ${s.estimatedImpact.timeReduction}% performance gain`);
      });
    }
    
    return {
      patterns,
      avoid,
      timeLimit: 3600000 // 1 hour default
    };
  }

  private createSuccessCriteria(request: UserRequest, patternSuggestions?: any[]): SuccessCriterion[] {
    const criteria: SuccessCriterion[] = [
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
    
    // Add pattern-based success criteria
    if (patternSuggestions && patternSuggestions.length > 0) {
      // Success pattern implementation criteria
      const successPatterns = patternSuggestions.filter(s => 
        s.pattern.type === 'success' && s.relevanceScore > 0.7
      );
      
      if (successPatterns.length > 0) {
        criteria.push({
          id: uuidv4(),
          criterion: `Recommended patterns implemented: ${successPatterns.map(s => s.pattern.description).join(', ')}`,
          validationMethod: 'Pattern matching and code analysis',
          automated: true
        });
      }
      
      // Error pattern avoidance criteria
      const errorPatterns = patternSuggestions.filter(s => s.pattern.type === 'error');
      if (errorPatterns.length > 0) {
        criteria.push({
          id: uuidv4(),
          criterion: 'No instances of known error patterns detected',
          validationMethod: 'Anti-pattern detection and analysis',
          automated: true
        });
      }
      
      // Performance improvement criteria
      const hasPerformancePatterns = patternSuggestions.some(s => 
        s.pattern.tags.includes('performance') || s.pattern.type === 'optimization'
      );
      
      if (hasPerformancePatterns) {
        const avgTimeReduction = patternSuggestions
          .filter(s => s.estimatedImpact?.timeReduction)
          .reduce((sum, s) => sum + s.estimatedImpact.timeReduction, 0) / patternSuggestions.length;
        
        criteria.push({
          id: uuidv4(),
          criterion: `Performance improved by at least ${Math.round(avgTimeReduction)}% through pattern optimization`,
          validationMethod: 'Performance benchmarking',
          automated: true
        });
      }
    }
    
    return criteria;
  }
}