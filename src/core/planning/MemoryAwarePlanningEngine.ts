/**
 * @actor planning
 * @responsibility Enhanced planning engine with memory-aware instruction generation
 */

import { PlanningEngine, UserRequest } from './PlanningEngine';
import { InstructionProtocol, InstructionObjective } from '@/src/models/Instruction';
import { Logger } from '@/src/lib/logging/Logger';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { PatternRecognitionService } from '@/src/services/intelligence/PatternRecognitionService';
import { SessionComplexityAnalyzer, ComplexityScore } from '@/src/services/session/SessionComplexityAnalyzer';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
// import { v4 as uuidv4 } from 'uuid'; - not needed, inherited from parent

export interface MemoryConstraints {
  maxInstructionSize: number; // KB
  maxObjectives: number;
  maxRequirements: number;
  maxDeliverables: number;
  estimatedExecutionMemory: number; // MB
}

export interface OptimizedInstruction extends InstructionProtocol {
  memoryProfile: {
    estimatedSize: number; // KB
    estimatedExecutionMemory: number; // MB
    optimizationApplied: string[];
    splitRecommended: boolean;
  };
}

export interface InstructionOptimizationOptions {
  targetMemoryLimit: number; // MB
  prioritizeByImportance: boolean;
  allowObjectiveSplitting: boolean;
  preserveCriticalRequirements: boolean;
}

export class MemoryAwarePlanningEngine extends PlanningEngine {
  private readonly complexityAnalyzer: SessionComplexityAnalyzer;
  private readonly auditLogger: AuditLogger;
  
  private readonly DEFAULT_CONSTRAINTS: MemoryConstraints = {
    maxInstructionSize: 100, // 100KB for instruction JSON
    maxObjectives: 10,
    maxRequirements: 15,
    maxDeliverables: 20,
    estimatedExecutionMemory: 300 // 300MB default limit
  };
  
  private readonly MEMORY_WEIGHTS = {
    perObjective: 20, // MB
    perRequirement: 10, // MB
    perDeliverable: 15, // MB
    perIntegration: 30, // MB
    baseOverhead: 50 // MB
  };

  constructor(
    logger: Logger,
    validator: ProtocolValidator,
    auditLogger: AuditLogger,
    complexityAnalyzer: SessionComplexityAnalyzer,
    claudeApi?: ClaudeAPIClient,
    patternService?: PatternRecognitionService
  ) {
    super(logger, validator, claudeApi, patternService);
    this.complexityAnalyzer = complexityAnalyzer;
    this.auditLogger = auditLogger;
  }

  /**
   * Generate memory-aware instructions
   */
  async generateMemoryAwareInstructions(
    request: UserRequest,
    constraints: Partial<MemoryConstraints> = {}
  ): Promise<OptimizedInstruction> {
    const memoryConstraints = { ...this.DEFAULT_CONSTRAINTS, ...constraints };
    
    // Use console for logging since logger is private in parent
    console.debug('Generating memory-aware instructions', {
      requestId: request.id,
      memoryLimit: memoryConstraints.estimatedExecutionMemory
    });

    // Analyze complexity first - adapt request type
    const complexityAnalyzer = this.complexityAnalyzer;
    const analysisRequest: any = {
      ...request,
      sessionId: request.sessionId || `session_${Date.now()}`,
      userId: request.context?.['userId'] || 'system'
    };
    const complexityScore = await complexityAnalyzer.analyzeComplexity(analysisRequest);
    
    // Generate initial instructions
    let instructions = await super.generateInstructions(request);
    
    // Estimate memory usage
    let memoryProfile = this.estimateMemoryUsage(instructions, complexityScore);
    
    // Optimize if needed
    if (memoryProfile.estimatedExecutionMemory > memoryConstraints.estimatedExecutionMemory) {
      instructions = await this.optimizeInstructions(
        instructions,
        memoryConstraints,
        complexityScore
      );
      memoryProfile = this.estimateMemoryUsage(instructions, complexityScore);
    }
    
    const optimizedInstruction: OptimizedInstruction = {
      ...instructions,
      memoryProfile
    };

    this.auditLogger.logEvent({
      actor: { type: 'planning', id: 'MemoryAwarePlanningEngine' },
      operation: {
        type: 'generate.memory-aware-instructions',
        description: 'Generated memory-optimized instructions',
        input: { requestId: request.id, constraints: memoryConstraints }
      },
      result: { 
        status: 'success',
        duration: 0 // Placeholder duration
      },
      metadata: { correlationId: request.id }
    });

    return optimizedInstruction;
  }

  /**
   * Estimate memory usage for instructions
   */
  private estimateMemoryUsage(
    instructions: InstructionProtocol,
    complexityScore: ComplexityScore
  ): OptimizedInstruction['memoryProfile'] {
    // Calculate instruction size
    const instructionJson = JSON.stringify(instructions);
    const instructionSize = new TextEncoder().encode(instructionJson).length / 1024; // KB
    
    // Estimate execution memory
    let executionMemory = this.MEMORY_WEIGHTS.baseOverhead;
    
    // Add memory for objectives
    executionMemory += instructions.objectives.length * this.MEMORY_WEIGHTS.perObjective;
    
    // Add memory for requirements
    executionMemory += instructions.requirements.length * this.MEMORY_WEIGHTS.perRequirement;
    
    // Add memory for deliverables
    executionMemory += instructions.deliverables.length * this.MEMORY_WEIGHTS.perDeliverable;
    
    // Add memory for integrations (from complexity analysis)
    const integrationCount = complexityScore.components.integrations / 20; // Rough estimate
    executionMemory += integrationCount * this.MEMORY_WEIGHTS.perIntegration;
    
    // Factor in complexity multiplier
    const complexityMultiplier = 1 + (complexityScore.overall / 100);
    executionMemory *= complexityMultiplier;
    
    return {
      estimatedSize: Math.round(instructionSize),
      estimatedExecutionMemory: Math.round(executionMemory),
      optimizationApplied: [],
      splitRecommended: complexityScore.splitRecommended || executionMemory > 500
    };
  }

  /**
   * Optimize instructions to fit memory constraints
   */
  private async optimizeInstructions(
    instructions: InstructionProtocol,
    constraints: MemoryConstraints,
    complexityScore: ComplexityScore
  ): Promise<InstructionProtocol> {
    const optimizations: string[] = [];
    let optimized = { ...instructions };
    
    // 1. Reduce objectives if too many
    if (optimized.objectives.length > constraints.maxObjectives) {
      optimized.objectives = this.prioritizeObjectives(
        optimized.objectives,
        constraints.maxObjectives
      );
      optimizations.push(`Reduced objectives from ${instructions.objectives.length} to ${constraints.maxObjectives}`);
    }
    
    // 2. Consolidate requirements
    if (optimized.requirements.length > constraints.maxRequirements) {
      optimized.requirements = this.consolidateRequirements(
        optimized.requirements,
        constraints.maxRequirements
      );
      optimizations.push(`Consolidated requirements from ${instructions.requirements.length} to ${constraints.maxRequirements}`);
    }
    
    // 3. Streamline deliverables
    if (optimized.deliverables.length > constraints.maxDeliverables) {
      optimized.deliverables = this.streamlineDeliverables(
        optimized.deliverables,
        constraints.maxDeliverables
      );
      optimizations.push(`Streamlined deliverables from ${instructions.deliverables.length} to ${constraints.maxDeliverables}`);
    }
    
    // 4. Simplify success criteria
    if (optimized.successCriteria.length > 10) {
      optimized.successCriteria = this.simplifySuccessCriteria(
        optimized.successCriteria,
        10
      );
      optimizations.push('Simplified success criteria');
    }
    
    // 5. Apply chunking strategies
    if (complexityScore.overall > 70) {
      optimized = this.applyChunkingStrategy(optimized, complexityScore);
      optimizations.push('Applied chunking strategy for complex operations');
    }
    
    // 6. Remove verbose descriptions
    optimized = this.removeVerboseDescriptions(optimized);
    optimizations.push('Removed verbose descriptions');
    
    // Log optimizations - logger is private in parent class
    console.debug('Applied memory optimizations', {
      instructionId: optimized.metadata.id,
      optimizations
    });
    
    return optimized;
  }

  /**
   * Prioritize objectives by importance
   */
  private prioritizeObjectives(
    objectives: InstructionObjective[],
    maxCount: number
  ): InstructionObjective[] {
    // Score objectives by importance indicators
    const scored = objectives.map(obj => {
      let score = 0;
      
      // Primary objectives get higher score
      if (obj.primary.toLowerCase().includes('must') || 
          obj.primary.toLowerCase().includes('critical')) {
        score += 10;
      }
      
      // Measurable objectives are important
      if (obj.measurable) {
        score += 5;
      }
      
      // Fewer secondary objectives = more focused = higher priority
      score += (10 - Math.min((obj.secondary || []).length, 10));
      
      return { objective: obj, score };
    });
    
    // Sort by score and take top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCount)
      .map(s => s.objective);
  }

  /**
   * Consolidate similar requirements
   */
  private consolidateRequirements(
    requirements: InstructionProtocol['requirements'],
    maxCount: number
  ): InstructionProtocol['requirements'] {
    // Group by priority
    const byPriority = {
      must: requirements.filter(r => r.priority === 'must'),
      should: requirements.filter(r => r.priority === 'should'),
      could: requirements.filter(r => r.priority === 'could')
    };
    
    // Take all 'must' requirements first
    const consolidated = [...byPriority.must];
    
    // Add 'should' requirements if space
    const shouldSpace = maxCount - consolidated.length;
    if (shouldSpace > 0) {
      consolidated.push(...byPriority.should.slice(0, shouldSpace));
    }
    
    // Add 'could' requirements if still space
    const couldSpace = maxCount - consolidated.length;
    if (couldSpace > 0) {
      consolidated.push(...byPriority.could.slice(0, couldSpace));
    }
    
    return consolidated.slice(0, maxCount);
  }

  /**
   * Streamline deliverables
   */
  private streamlineDeliverables(
    deliverables: InstructionProtocol['deliverables'],
    maxCount: number
  ): InstructionProtocol['deliverables'] {
    // Group similar deliverables
    const groups: Map<string, typeof deliverables> = new Map();
    
    deliverables.forEach(deliverable => {
      const type = deliverable.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(deliverable);
    });
    
    // Consolidate each group
    const streamlined: typeof deliverables = [];
    
    groups.forEach((group, type) => {
      if (group.length === 1 && group[0]) {
        streamlined.push(group[0]);
      } else if (group[0]) {
        // Merge similar deliverables
        streamlined.push({
          type: type as any, // Cast to avoid type error
          description: `${group.length} ${type} deliverables: ${group.map(d => d.description).join('; ')}`,
          validation: group[0].validation // Use first validation method
        });
      }
    });
    
    return streamlined.slice(0, maxCount);
  }

  /**
   * Simplify success criteria
   */
  private simplifySuccessCriteria(
    criteria: InstructionProtocol['successCriteria'],
    maxCount: number
  ): InstructionProtocol['successCriteria'] {
    // Prioritize automated criteria
    const automated = criteria.filter(c => c.automated);
    const manual = criteria.filter(c => !c.automated);
    
    // Take automated first, then manual
    return [...automated, ...manual].slice(0, maxCount);
  }

  /**
   * Apply chunking strategy for complex instructions
   */
  private applyChunkingStrategy(
    instructions: InstructionProtocol,
    _complexityScore: ComplexityScore // Unused parameter
  ): InstructionProtocol {
    const chunked = { ...instructions };
    
    // Add chunking guidance to context
    chunked.context = {
      ...chunked.context,
      description: chunked.context.description + 
        '\n\nNote: Due to complexity, implement in phases to manage memory usage effectively.'
    };
    
    // Add phased approach to objectives
    if (chunked.objectives.length > 0 && chunked.objectives[0]) {
      chunked.objectives[0].secondary = [
        ...(chunked.objectives[0].secondary || []),
        'Implement in logical phases to prevent memory overload',
        'Complete and verify each phase before proceeding'
      ];
    }
    
    // Add memory management constraint
    if (chunked.constraints.patterns) {
      chunked.constraints.patterns.push(
        'Use memory-efficient implementations',
        'Clean up resources after each phase'
      );
    }
    
    return chunked;
  }

  /**
   * Remove verbose descriptions to save space
   */
  private removeVerboseDescriptions(
    instructions: InstructionProtocol
  ): InstructionProtocol {
    const concise = { ...instructions };
    
    // Shorten context description
    if (concise.context.description.length > 500) {
      concise.context.description = 
        concise.context.description.substring(0, 497) + '...';
    }
    
    // Shorten objective descriptions
    concise.objectives = concise.objectives.map(obj => ({
      ...obj,
      primary: this.truncateText(obj.primary, 200),
      secondary: (obj.secondary || []).map(s => this.truncateText(s, 100))
    }));
    
    // Shorten requirement descriptions
    concise.requirements = concise.requirements.map(req => ({
      ...req,
      description: this.truncateText(req.description, 150),
      acceptanceCriteria: (req.acceptanceCriteria || []).map(ac => 
        this.truncateText(ac, 100)
      )
    }));
    
    return concise;
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate split-aware instructions
   */
  async generateSplitAwareInstructions(
    request: UserRequest,
    splitContext: {
      isSplit: boolean;
      splitIndex: number;
      totalSplits: number;
      focusArea: string;
      dependencies: string[];
    }
  ): Promise<OptimizedInstruction> {
    // Enhance request with split context
    const enhancedRequest: UserRequest = {
      ...request,
      context: {
        ...request.context,
        splitContext
      }
    };
    
    // Generate instructions with split awareness
    const instructions = await this.generateMemoryAwareInstructions(enhancedRequest);
    
    // Add split-specific metadata - store in general metadata for now
    instructions.metadata = {
      ...instructions.metadata,
      // TODO: Add splitInfo to InstructionMetadata type definition
      // splitInfo: {
      //   index: splitContext.splitIndex,
      //   total: splitContext.totalSplits,
      //   focusArea: splitContext.focusArea
      // }
    };
    
    // Add split context to description
    instructions.context.description = 
      `[Split ${splitContext.splitIndex}/${splitContext.totalSplits} - ${splitContext.focusArea}]\n` +
      instructions.context.description;
    
    // Add dependencies to prerequisites
    if (splitContext.dependencies.length > 0) {
      instructions.context.prerequisites.push(
        ...splitContext.dependencies.map(dep => `Requires completion of: ${dep}`)
      );
    }
    
    return instructions;
  }

  /**
   * Analyze instruction memory impact
   */
  async analyzeInstructionMemoryImpact(
    instructions: InstructionProtocol
  ): Promise<{
    totalMemoryMB: number;
    breakdown: Record<string, number>;
    recommendations: string[];
    optimizationPotential: number; // percentage
  }> {
    const breakdown: Record<string, number> = {
      base: this.MEMORY_WEIGHTS.baseOverhead,
      objectives: instructions.objectives.length * this.MEMORY_WEIGHTS.perObjective,
      requirements: instructions.requirements.length * this.MEMORY_WEIGHTS.perRequirement,
      deliverables: instructions.deliverables.length * this.MEMORY_WEIGHTS.perDeliverable
    };
    
    const totalMemoryMB = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    const recommendations: string[] = [];
    let optimizationPotential = 0;
    
    // Check for optimization opportunities
    if (instructions.objectives.length > 5) {
      recommendations.push(`Consider reducing objectives from ${instructions.objectives.length} to 5`);
      optimizationPotential += 10;
    }
    
    if (instructions.requirements.length > 10) {
      recommendations.push(`Consider consolidating requirements from ${instructions.requirements.length} to 10`);
      optimizationPotential += 15;
    }
    
    if (totalMemoryMB > 400) {
      recommendations.push('Consider splitting this session into multiple smaller sessions');
      optimizationPotential += 25;
    }
    
    // Check for verbose content
    const contentSize = JSON.stringify(instructions).length;
    if (contentSize > 50000) {
      recommendations.push('Reduce verbose descriptions and consolidate similar items');
      optimizationPotential += 20;
    }
    
    return {
      totalMemoryMB: Math.round(totalMemoryMB),
      breakdown,
      recommendations,
      optimizationPotential: Math.min(optimizationPotential, 50)
    };
  }
}