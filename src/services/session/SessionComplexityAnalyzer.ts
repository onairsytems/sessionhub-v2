/**
 * @actor planning
 * @responsibility Analyzes session complexity and recommends optimal session sizing
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { UserRequest } from '@/src/core/orchestrator/SessionManager';
import { PatternRecognitionService } from '../intelligence/PatternRecognitionService';

export interface ComplexityScore {
  overall: number; // 0-100
  components: {
    objectives: number;
    integrations: number;
    scope: number;
    dependencies: number;
    technicalDepth: number;
    memoryRequirements: number;
  };
  recommendation: ComplexityRecommendation;
  estimatedMemoryUsage: number; // MB
  splitRecommended: boolean;
  suggestedSplits?: SuggestedSplit[];
}

export interface ComplexityRecommendation {
  sessionSize: 'small' | 'medium' | 'large' | 'split-required';
  reasoning: string[];
  estimatedDuration: number; // minutes
  memoryRisk: 'low' | 'medium' | 'high';
  successProbability: number; // 0-1
}

export interface SuggestedSplit {
  title: string;
  objectives: string[];
  estimatedComplexity: number;
  dependencies: string[];
  order: number;
}

export interface ComplexityFactors {
  fileOperations: number;
  apiIntegrations: number;
  databaseOperations: number;
  uiComponents: number;
  testingRequirements: number;
  configurationChanges: number;
  architecturalChanges: number;
  crossModuleImpact: number;
}

export class SessionComplexityAnalyzer {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly patternService: PatternRecognitionService;
  
  // Thresholds for complexity scoring
  private readonly COMPLEXITY_THRESHOLDS = {
    small: 30,
    medium: 60,
    large: 85,
    splitRequired: 100
  };
  
  // Memory usage estimates (MB)
  private readonly MEMORY_ESTIMATES = {
    baseSession: 50,
    perFile: 5,
    perApiIntegration: 20,
    perDbOperation: 10,
    perUiComponent: 15,
    perTest: 8,
    architecturalChange: 50
  };
  
  // Success probability factors
  private readonly SUCCESS_FACTORS = {
    smallSession: 0.95,
    mediumSession: 0.85,
    largeSession: 0.70,
    splitSession: 0.90
  };

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    patternService: PatternRecognitionService
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.patternService = patternService;
  }

  /**
   * Analyze session complexity from user request
   */
  async analyzeComplexity(request: UserRequest): Promise<ComplexityScore> {
    this.logger.info('Analyzing session complexity', { requestId: request.id });

    // Extract complexity factors from request
    const factors = await this.extractComplexityFactors(request);
    
    // Calculate component scores
    const components = this.calculateComponentScores(factors);
    
    // Calculate overall complexity
    const overall = this.calculateOverallComplexity(components);
    
    // Estimate memory usage
    const estimatedMemoryUsage = this.estimateMemoryUsage(factors);
    
    // Determine if splitting is recommended
    const splitRecommended = overall > this.COMPLEXITY_THRESHOLDS.large || 
                           estimatedMemoryUsage > 500;
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      overall, 
      estimatedMemoryUsage,
      splitRecommended
    );
    
    // Generate split suggestions if needed
    let suggestedSplits: SuggestedSplit[] | undefined;
    if (splitRecommended) {
      suggestedSplits = await this.generateSplitSuggestions(request, factors);
    }
    
    const complexityScore: ComplexityScore = {
      overall,
      components,
      recommendation,
      estimatedMemoryUsage,
      splitRecommended,
      suggestedSplits
    };

    // Learn from historical patterns
    await this.learnFromPatterns(request, complexityScore);

    this.auditLogger.logEvent({
      actor: { type: 'planning', id: 'SessionComplexityAnalyzer' },
      operation: {
        type: 'analyze.complexity',
        description: 'Analyzed session complexity',
        input: { requestId: request.id }
      },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: request.id }
    });

    return complexityScore;
  }

  /**
   * Extract complexity factors from request content
   */
  private async extractComplexityFactors(request: UserRequest): Promise<ComplexityFactors> {
    const content = request.content.toLowerCase();
    const context = request.context;

    // Analyze request content for complexity indicators
    const factors: ComplexityFactors = {
      fileOperations: this.countPatterns(content, [
        'create file', 'modify file', 'update file', 'delete file',
        'new component', 'new service', 'new module'
      ]),
      apiIntegrations: this.countPatterns(content, [
        'api', 'integration', 'webhook', 'endpoint', 'rest', 'graphql',
        'external service', 'third-party'
      ]),
      databaseOperations: this.countPatterns(content, [
        'database', 'schema', 'migration', 'query', 'table', 'index',
        'orm', 'sql', 'nosql'
      ]),
      uiComponents: this.countPatterns(content, [
        'ui', 'component', 'page', 'screen', 'interface', 'ux',
        'layout', 'design', 'frontend'
      ]),
      testingRequirements: this.countPatterns(content, [
        'test', 'testing', 'unit test', 'integration test', 'e2e',
        'coverage', 'assertion', 'mock'
      ]),
      configurationChanges: this.countPatterns(content, [
        'config', 'configuration', 'settings', 'environment',
        'variable', 'option', 'preference'
      ]),
      architecturalChanges: this.countPatterns(content, [
        'architecture', 'refactor', 'restructure', 'pattern',
        'framework', 'major change', 'overhaul'
      ]),
      crossModuleImpact: this.estimateCrossModuleImpact(content, context)
    };

    // Apply historical pattern adjustments
    const patterns = await (this.patternService as any).getRelevantPatterns(
      { sessionId: request.sessionId, userId: request.userId, projectId: context['projectId'] || '' }
    );
    
    // Adjust factors based on learned patterns
    if (patterns.length > 0) {
      const avgComplexity = patterns.reduce((sum: number, p: any) => sum + (p.metadata?.complexity || 0), 0) / patterns.length;
      if (avgComplexity > 70) {
        // Historical data suggests higher complexity for similar requests
        Object.keys(factors).forEach(key => {
          factors[key as keyof ComplexityFactors] *= 1.2;
        });
      }
    }

    return factors;
  }

  /**
   * Count occurrences of patterns in text
   */
  private countPatterns(text: string, patterns: string[]): number {
    return patterns.reduce((count, pattern) => {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Estimate cross-module impact
   */
  private estimateCrossModuleImpact(content: string, context: Record<string, any>): number {
    let impact = 0;
    
    // Check for keywords indicating broad impact
    const broadImpactPatterns = [
      'across all', 'everywhere', 'all modules', 'entire system',
      'global', 'throughout', 'system-wide'
    ];
    
    impact += this.countPatterns(content, broadImpactPatterns) * 3;
    
    // Check context for multiple module references
    if (context['modules'] && Array.isArray(context['modules'])) {
      impact += context['modules'].length;
    }
    
    return Math.min(impact, 10); // Cap at 10
  }

  /**
   * Calculate component scores
   */
  private calculateComponentScores(factors: ComplexityFactors): ComplexityScore['components'] {
    return {
      objectives: Math.min(100, factors.fileOperations * 10 + factors.uiComponents * 5),
      integrations: Math.min(100, factors.apiIntegrations * 15 + factors.databaseOperations * 10),
      scope: Math.min(100, factors.crossModuleImpact * 10 + factors.architecturalChanges * 20),
      dependencies: Math.min(100, (factors.apiIntegrations + factors.databaseOperations) * 12),
      technicalDepth: Math.min(100, factors.architecturalChanges * 25 + factors.testingRequirements * 10),
      memoryRequirements: this.calculateMemoryScore(factors)
    };
  }

  /**
   * Calculate memory requirement score
   */
  private calculateMemoryScore(factors: ComplexityFactors): number {
    const estimatedMB = 
      this.MEMORY_ESTIMATES.baseSession +
      (factors.fileOperations * this.MEMORY_ESTIMATES.perFile) +
      (factors.apiIntegrations * this.MEMORY_ESTIMATES.perApiIntegration) +
      (factors.databaseOperations * this.MEMORY_ESTIMATES.perDbOperation) +
      (factors.uiComponents * this.MEMORY_ESTIMATES.perUiComponent) +
      (factors.testingRequirements * this.MEMORY_ESTIMATES.perTest) +
      (factors.architecturalChanges * this.MEMORY_ESTIMATES.architecturalChange);
    
    // Convert to 0-100 score (500MB = 100 score)
    return Math.min(100, (estimatedMB / 500) * 100);
  }

  /**
   * Calculate overall complexity score
   */
  private calculateOverallComplexity(components: ComplexityScore['components']): number {
    // Weighted average of components
    const weights = {
      objectives: 0.20,
      integrations: 0.20,
      scope: 0.25,
      dependencies: 0.15,
      technicalDepth: 0.15,
      memoryRequirements: 0.05
    };
    
    let weighted = 0;
    Object.entries(components).forEach(([key, value]) => {
      weighted += value * weights[key as keyof typeof weights];
    });
    
    return Math.round(weighted);
  }

  /**
   * Estimate memory usage in MB
   */
  private estimateMemoryUsage(factors: ComplexityFactors): number {
    return Math.round(
      this.MEMORY_ESTIMATES.baseSession +
      (factors.fileOperations * this.MEMORY_ESTIMATES.perFile) +
      (factors.apiIntegrations * this.MEMORY_ESTIMATES.perApiIntegration) +
      (factors.databaseOperations * this.MEMORY_ESTIMATES.perDbOperation) +
      (factors.uiComponents * this.MEMORY_ESTIMATES.perUiComponent) +
      (factors.testingRequirements * this.MEMORY_ESTIMATES.perTest) +
      (factors.architecturalChanges * this.MEMORY_ESTIMATES.architecturalChange)
    );
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    complexity: number,
    memoryUsage: number,
    splitRecommended: boolean
  ): ComplexityRecommendation {
    let sessionSize: ComplexityRecommendation['sessionSize'];
    let memoryRisk: ComplexityRecommendation['memoryRisk'];
    let successProbability: number;
    const reasoning: string[] = [];

    // Determine session size
    if (splitRecommended) {
      sessionSize = 'split-required';
      successProbability = this.SUCCESS_FACTORS.splitSession;
      reasoning.push('Session complexity exceeds safe execution limits');
      reasoning.push('Splitting into focused sub-sessions recommended');
    } else if (complexity <= this.COMPLEXITY_THRESHOLDS.small) {
      sessionSize = 'small';
      successProbability = this.SUCCESS_FACTORS.smallSession;
      reasoning.push('Low complexity - can execute in single session');
    } else if (complexity <= this.COMPLEXITY_THRESHOLDS.medium) {
      sessionSize = 'medium';
      successProbability = this.SUCCESS_FACTORS.mediumSession;
      reasoning.push('Moderate complexity - standard session handling');
    } else {
      sessionSize = 'large';
      successProbability = this.SUCCESS_FACTORS.largeSession;
      reasoning.push('High complexity - requires careful execution');
    }

    // Determine memory risk
    if (memoryUsage < 200) {
      memoryRisk = 'low';
      reasoning.push('Memory usage within comfortable limits');
    } else if (memoryUsage < 400) {
      memoryRisk = 'medium';
      reasoning.push('Moderate memory usage - monitor during execution');
    } else {
      memoryRisk = 'high';
      reasoning.push('High memory usage - consider optimization');
      successProbability *= 0.8; // Reduce success probability
    }

    // Estimate duration based on complexity
    const estimatedDuration = Math.round(
      10 + (complexity * 0.5) + (memoryUsage * 0.05)
    );

    return {
      sessionSize,
      reasoning,
      estimatedDuration,
      memoryRisk,
      successProbability: Math.round(successProbability * 100) / 100
    };
  }

  /**
   * Generate split suggestions for complex sessions
   */
  private async generateSplitSuggestions(
    request: UserRequest,
    factors: ComplexityFactors
  ): Promise<SuggestedSplit[]> {
    const splits: SuggestedSplit[] = [];
    
    // Parse objectives from request
    const objectives = this.parseObjectives(request.content);
    
    // Group related objectives
    if (factors.architecturalChanges > 0) {
      splits.push({
        title: 'Architecture and Structure Changes',
        objectives: objectives.filter(obj => 
          obj.toLowerCase().includes('architect') ||
          obj.toLowerCase().includes('structure') ||
          obj.toLowerCase().includes('refactor')
        ),
        estimatedComplexity: 40,
        dependencies: [],
        order: 1
      });
    }
    
    if (factors.databaseOperations > 0) {
      splits.push({
        title: 'Database and Data Model Updates',
        objectives: objectives.filter(obj => 
          obj.toLowerCase().includes('database') ||
          obj.toLowerCase().includes('schema') ||
          obj.toLowerCase().includes('data')
        ),
        estimatedComplexity: 30,
        dependencies: factors.architecturalChanges > 0 ? ['Architecture and Structure Changes'] : [],
        order: 2
      });
    }
    
    if (factors.apiIntegrations > 0) {
      splits.push({
        title: 'API and Integration Implementation',
        objectives: objectives.filter(obj => 
          obj.toLowerCase().includes('api') ||
          obj.toLowerCase().includes('integration') ||
          obj.toLowerCase().includes('service')
        ),
        estimatedComplexity: 35,
        dependencies: factors.databaseOperations > 0 ? ['Database and Data Model Updates'] : [],
        order: 3
      });
    }
    
    if (factors.uiComponents > 0) {
      splits.push({
        title: 'UI Components and Frontend',
        objectives: objectives.filter(obj => 
          obj.toLowerCase().includes('ui') ||
          obj.toLowerCase().includes('component') ||
          obj.toLowerCase().includes('interface')
        ),
        estimatedComplexity: 25,
        dependencies: factors.apiIntegrations > 0 ? ['API and Integration Implementation'] : [],
        order: 4
      });
    }
    
    if (factors.testingRequirements > 0) {
      splits.push({
        title: 'Testing and Quality Assurance',
        objectives: objectives.filter(obj => 
          obj.toLowerCase().includes('test') ||
          obj.toLowerCase().includes('quality') ||
          obj.toLowerCase().includes('validation')
        ),
        estimatedComplexity: 20,
        dependencies: ['All implementation tasks'],
        order: 5
      });
    }
    
    // If no specific splits identified, create generic splits
    if (splits.length === 0) {
      const chunkSize = Math.ceil(objectives.length / 3);
      for (let i = 0; i < objectives.length; i += chunkSize) {
        splits.push({
          title: `Implementation Phase ${Math.floor(i / chunkSize) + 1}`,
          objectives: objectives.slice(i, i + chunkSize),
          estimatedComplexity: 35,
          dependencies: i > 0 ? [`Implementation Phase ${Math.floor(i / chunkSize)}`] : [],
          order: Math.floor(i / chunkSize) + 1
        });
      }
    }
    
    return splits;
  }

  /**
   * Parse objectives from request content
   */
  private parseObjectives(content: string): string[] {
    const objectives: string[] = [];
    
    // Look for numbered lists
    const numberedPattern = /\d+\.\s*([^\n]+)/g;
    let match;
    while ((match = numberedPattern.exec(content)) !== null) {
      if (match[1]) objectives.push(match[1].trim());
    }
    
    // Look for bullet points
    const bulletPattern = /[-*]\s*([^\n]+)/g;
    while ((match = bulletPattern.exec(content)) !== null) {
      if (match[1]) objectives.push(match[1].trim());
    }
    
    // If no structured list found, split by common delimiters
    if (objectives.length === 0) {
      const parts = content.split(/[,;]|\band\b/i);
      objectives.push(...parts.map(p => p.trim()).filter(p => p.length > 10));
    }
    
    return objectives;
  }

  /**
   * Learn from patterns for future predictions
   */
  private async learnFromPatterns(
    request: UserRequest,
    complexityScore: ComplexityScore
  ): Promise<void> {
    // Store the complexity analysis as a pattern for future learning
    await (this.patternService as any).recordPattern({
      type: 'session_complexity',
      pattern: request.content.substring(0, 100),
      context: {
        sessionId: request.sessionId,
        userId: request.userId,
        projectId: request.context['projectId'] || ''
      },
      metadata: {
        complexity: complexityScore.overall,
        memoryUsage: complexityScore.estimatedMemoryUsage,
        splitRecommended: complexityScore.splitRecommended,
        components: complexityScore.components
      }
    });
  }

  /**
   * Get complexity statistics
   */
  async getComplexityStatistics(
    userId?: string,
    projectId?: string
  ): Promise<{
    averageComplexity: number;
    splitRate: number;
    successRateBySize: Record<string, number>;
    memoryUsageDistribution: Record<string, number>;
  }> {
    const patterns = await (this.patternService as any).getRelevantPatterns({
      sessionId: '',
      userId: userId || '',
      projectId: projectId || ''
    });

    const complexityPatterns = patterns.filter((p: any) => p.type === 'session_complexity');
    
    if (complexityPatterns.length === 0) {
      return {
        averageComplexity: 0,
        splitRate: 0,
        successRateBySize: {},
        memoryUsageDistribution: {}
      };
    }

    const averageComplexity = complexityPatterns.reduce(
      (sum: number, p: any) => sum + (p.metadata?.complexity || 0), 0
    ) / complexityPatterns.length;

    const splitRate = complexityPatterns.filter(
      (p: any) => p.metadata?.splitRecommended
    ).length / complexityPatterns.length;

    // TODO: Implement success rate tracking by session size
    const successRateBySize = {
      small: 0.95,
      medium: 0.85,
      large: 0.70,
      'split-required': 0.90
    };

    // Memory usage distribution
    const memoryUsageDistribution: Record<string, number> = {
      'low': 0,
      'medium': 0,
      'high': 0
    } as Record<string, number>;

    complexityPatterns.forEach((p: any) => {
      const usage = p.metadata?.memoryUsage || 0;
      if (usage < 200) memoryUsageDistribution['low'] = (memoryUsageDistribution['low'] || 0) + 1;
      else if (usage < 400) memoryUsageDistribution['medium'] = (memoryUsageDistribution['medium'] || 0) + 1;
      else memoryUsageDistribution['high'] = (memoryUsageDistribution['high'] || 0) + 1;
    });

    return {
      averageComplexity,
      splitRate,
      successRateBySize,
      memoryUsageDistribution
    };
  }
}