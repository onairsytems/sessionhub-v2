/**
 * @actor system
 * @responsibility Learns from session execution patterns to improve future session optimization
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session, ExecutionResult } from '@/src/core/orchestrator/SessionManager';
import { ComplexityScore } from './SessionComplexityAnalyzer';
import { PatternRecognitionService } from '../intelligence/PatternRecognitionService';
import { DatabaseService } from '@/src/database/DatabaseService';

export interface SessionPattern {
  id: string;
  type: 'success' | 'failure' | 'optimization' | 'splitting';
  pattern: string;
  description: string;
  complexity: {
    overall: number;
    components: Record<string, number>;
  };
  executionMetrics: {
    duration: number;
    memoryUsage: number;
    successRate: number;
    errorRate: number;
  };
  optimizationStrategy?: {
    applied: string[];
    effectiveness: number;
    memoryReduction: number;
  };
  splittingStrategy?: {
    originalComplexity: number;
    splitCount: number;
    averageSplitComplexity: number;
    successRate: number;
  };
  frequency: number;
  lastSeen: string;
  confidence: number;
}

export interface LearningInsight {
  type: 'complexity' | 'memory' | 'splitting' | 'success' | 'failure';
  insight: string;
  recommendation: string;
  confidence: number;
  basedOn: number; // Number of sessions analyzed
}

export interface OptimizationRecommendation {
  strategy: string;
  expectedImprovement: {
    memoryReduction: number; // percentage
    successRateIncrease: number; // percentage
    durationReduction: number; // percentage
  };
  confidence: number;
  reasoning: string[];
}

export class SessionPatternLearningSystem {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly patternService: PatternRecognitionService;
  private readonly db: DatabaseService;
  
  // Learning thresholds
  private readonly PATTERN_CONFIDENCE_THRESHOLD = 0.7;
  private readonly MIN_SESSIONS_FOR_PATTERN = 5;
  private readonly PATTERN_DECAY_RATE = 0.95; // Per month
  
  // Pattern storage
  private patterns: Map<string, SessionPattern> = new Map();
  private insights: LearningInsight[] = [];

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    patternService: PatternRecognitionService,
    db: DatabaseService
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.patternService = patternService;
    this.db = db;
    
    this.loadStoredPatterns();
  }

  /**
   * Load previously learned patterns from database
   */
  private async loadStoredPatterns(): Promise<void> {
    try {
      const storedPatterns = await (this.db as any).query(
        'SELECT * FROM session_patterns WHERE confidence > ?',
        [this.PATTERN_CONFIDENCE_THRESHOLD]
      ) as SessionPattern[];
      
      storedPatterns.forEach((pattern: SessionPattern) => {
        this.patterns.set(pattern.id, pattern);
      });
      
      this.logger.info('Loaded session patterns', {
        count: this.patterns.size
      });
    } catch (error) {
      this.logger.error('Failed to load session patterns', error as Error);
    }
  }

  /**
   * Learn from a completed session
   */
  async learnFromSession(
    session: Session,
    complexityScore: ComplexityScore,
    executionResult: ExecutionResult
  ): Promise<void> {
    this.logger.info('Learning from session', {
      sessionId: session.id,
      status: executionResult.status,
      complexity: complexityScore.overall
    });

    // Extract pattern features
    const patternKey = this.generatePatternKey(session, complexityScore);
    const existingPattern = this.patterns.get(patternKey);
    
    if (existingPattern) {
      // Update existing pattern
      await this.updatePattern(existingPattern, session, complexityScore, executionResult);
    } else {
      // Create new pattern
      await this.createPattern(patternKey, session, complexityScore, executionResult);
    }
    
    // Generate insights
    await this.generateInsights();
    
    // Update pattern service with new learnings
    await this.updatePatternService();
    
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'SessionPatternLearningSystem' },
      operation: {
        type: 'learn.session',
        description: 'Learned from session execution',
        input: { sessionId: session.id }
      },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: session.id }
    });
  }

  /**
   * Generate pattern key from session characteristics
   */
  private generatePatternKey(
    session: Session,
    complexityScore: ComplexityScore
  ): string {
    const complexityBucket = Math.floor(complexityScore.overall / 20) * 20;
    const type = session.metadata['isSplit'] ? 'split' : 'regular';
    const memoryBucket = Math.floor(complexityScore.estimatedMemoryUsage / 100) * 100;
    
    return `${type}_complexity_${complexityBucket}_memory_${memoryBucket}`;
  }

  /**
   * Update existing pattern with new session data
   */
  private async updatePattern(
    pattern: SessionPattern,
    _session: Session,
    _complexityScore: ComplexityScore,
    executionResult: ExecutionResult
  ): Promise<void> {
    const isSuccess = executionResult.status === 'success';
    
    // Update frequency and recency
    pattern.frequency++;
    pattern.lastSeen = new Date().toISOString();
    
    // Update execution metrics with weighted average
    const weight = 1 / pattern.frequency;
    pattern.executionMetrics.duration = 
      pattern.executionMetrics.duration * (1 - weight) + 
      executionResult.metrics.duration * weight;
    
    pattern.executionMetrics.memoryUsage = 
      pattern.executionMetrics.memoryUsage * (1 - weight) + 
      _complexityScore.estimatedMemoryUsage * weight;
    
    // Update success rate
    const totalSessions = pattern.frequency;
    const successCount = pattern.executionMetrics.successRate * (totalSessions - 1) + (isSuccess ? 1 : 0);
    pattern.executionMetrics.successRate = successCount / totalSessions;
    pattern.executionMetrics.errorRate = 1 - pattern.executionMetrics.successRate;
    
    // Update confidence based on frequency and consistency
    pattern.confidence = this.calculateConfidence(pattern);
    
    // Store updated pattern
    await this.storePattern(pattern);
  }

  /**
   * Create new pattern from session
   */
  private async createPattern(
    patternKey: string,
    session: Session,
    complexityScore: ComplexityScore,
    executionResult: ExecutionResult
  ): Promise<void> {
    const isSuccess = executionResult.status === 'success';
    const isSplit = !!session.metadata['isSplit'];
    
    const pattern: SessionPattern = {
      id: patternKey,
      type: isSuccess ? 'success' : 'failure',
      pattern: patternKey,
      description: this.generatePatternDescription(session, complexityScore),
      complexity: {
        overall: complexityScore.overall,
        components: complexityScore.components
      },
      executionMetrics: {
        duration: executionResult.metrics.duration,
        memoryUsage: complexityScore.estimatedMemoryUsage,
        successRate: isSuccess ? 1 : 0,
        errorRate: isSuccess ? 0 : 1
      },
      frequency: 1,
      lastSeen: new Date().toISOString(),
      confidence: 0.5 // Initial confidence
    };
    
    // Add optimization data if available
    if (session.metadata['optimizationApplied']) {
      pattern.optimizationStrategy = {
        applied: session.metadata['optimizationApplied'] as string[],
        effectiveness: isSuccess ? 1 : 0,
        memoryReduction: (session.metadata['memoryReduction'] as number) || 0
      };
    }
    
    // Add splitting data if applicable
    if (isSplit) {
      pattern.splittingStrategy = {
        originalComplexity: (session.metadata['originalComplexity'] as number) || complexityScore.overall * 2,
        splitCount: (session.metadata['splitTotal'] as number) || 1,
        averageSplitComplexity: complexityScore.overall,
        successRate: isSuccess ? 1 : 0
      };
    }
    
    this.patterns.set(patternKey, pattern);
    await this.storePattern(pattern);
  }

  /**
   * Generate human-readable pattern description
   */
  private generatePatternDescription(
    _session: Session,
    complexityScore: ComplexityScore
  ): string {
    const complexityLevel = 
      complexityScore.overall < 30 ? 'Low' :
      complexityScore.overall < 60 ? 'Medium' :
      complexityScore.overall < 85 ? 'High' : 'Very High';
    
    const memoryLevel = 
      complexityScore.estimatedMemoryUsage < 200 ? 'low' :
      complexityScore.estimatedMemoryUsage < 400 ? 'moderate' : 'high';
    
    return `${complexityLevel} complexity session with ${memoryLevel} memory usage`;
  }

  /**
   * Calculate pattern confidence
   */
  private calculateConfidence(pattern: SessionPattern): number {
    // Base confidence on frequency
    const frequencyFactor = Math.min(pattern.frequency / this.MIN_SESSIONS_FOR_PATTERN, 1);
    
    // Factor in success rate consistency
    const successConsistency = pattern.executionMetrics.successRate > 0.5 ? 
      pattern.executionMetrics.successRate : 
      (1 - pattern.executionMetrics.errorRate);
    
    // Apply time decay
    const daysSinceLastSeen = 
      (Date.now() - new Date(pattern.lastSeen).getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.pow(this.PATTERN_DECAY_RATE, daysSinceLastSeen / 30);
    
    return frequencyFactor * successConsistency * timeDecay;
  }

  /**
   * Store pattern in database
   */
  private async storePattern(pattern: SessionPattern): Promise<void> {
    try {
      await (this.db as any).run(
        `INSERT OR REPLACE INTO session_patterns 
         (id, type, pattern, description, complexity, execution_metrics, 
          optimization_strategy, splitting_strategy, frequency, last_seen, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pattern.id,
          pattern.type,
          pattern.pattern,
          pattern.description,
          JSON.stringify(pattern.complexity),
          JSON.stringify(pattern.executionMetrics),
          JSON.stringify(pattern.optimizationStrategy),
          JSON.stringify(pattern.splittingStrategy),
          pattern.frequency,
          pattern.lastSeen,
          pattern.confidence
        ]
      );
    } catch (error) {
      this.logger.error('Failed to store pattern', error as Error);
    }
  }

  /**
   * Generate insights from learned patterns
   */
  private async generateInsights(): Promise<void> {
    this.insights = [];
    
    // Complexity insights
    const complexityPatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence > this.PATTERN_CONFIDENCE_THRESHOLD);
    
    if (complexityPatterns.length >= this.MIN_SESSIONS_FOR_PATTERN) {
      // Find complexity threshold for failures
      const failures = complexityPatterns.filter(p => p.type === 'failure');
      if (failures.length > 0) {
        const avgFailureComplexity = failures.reduce((sum, p) => sum + p.complexity.overall, 0) / failures.length;
        
        this.insights.push({
          type: 'complexity',
          insight: `Sessions with complexity above ${Math.round(avgFailureComplexity)} have higher failure rates`,
          recommendation: `Consider splitting sessions with complexity scores above ${Math.round(avgFailureComplexity * 0.8)}`,
          confidence: 0.8,
          basedOn: failures.length
        });
      }
      
      // Memory usage insights
      const highMemoryPatterns = complexityPatterns.filter(
        p => p.executionMetrics.memoryUsage > 400
      );
      
      if (highMemoryPatterns.length > 0) {
        const avgSuccessRate = highMemoryPatterns.reduce(
          (sum, p) => sum + p.executionMetrics.successRate, 0
        ) / highMemoryPatterns.length;
        
        this.insights.push({
          type: 'memory',
          insight: `High memory sessions (>400MB) have ${Math.round(avgSuccessRate * 100)}% success rate`,
          recommendation: avgSuccessRate < 0.7 ? 
            'Apply memory optimization for sessions exceeding 400MB' :
            'Current memory handling is effective',
          confidence: 0.75,
          basedOn: highMemoryPatterns.length
        });
      }
      
      // Splitting effectiveness
      const splitPatterns = complexityPatterns.filter(p => p.splittingStrategy);
      if (splitPatterns.length > 0) {
        const avgSplitSuccess = splitPatterns.reduce(
          (sum, p) => sum + p.splittingStrategy!.successRate, 0
        ) / splitPatterns.length;
        
        this.insights.push({
          type: 'splitting',
          insight: `Split sessions have ${Math.round(avgSplitSuccess * 100)}% success rate`,
          recommendation: avgSplitSuccess > 0.8 ?
            'Session splitting is highly effective for complex tasks' :
            'Review splitting strategies for better success rates',
          confidence: 0.85,
          basedOn: splitPatterns.length
        });
      }
    }
  }

  /**
   * Update pattern service with new learnings
   */
  private async updatePatternService(): Promise<void> {
    // Convert session patterns to pattern service format
    const highConfidencePatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence > this.PATTERN_CONFIDENCE_THRESHOLD)
      .map(p => ({
        id: p.id,
        type: p.type as 'success' | 'error' | 'workflow' | 'optimization',
        pattern: p.pattern,
        description: p.description,
        frequency: p.frequency,
        successRate: p.executionMetrics.successRate,
        tags: this.generatePatternTags(p),
        context: {
          complexity: p.complexity.overall,
          memoryUsage: p.executionMetrics.memoryUsage
        },
        metadata: {
          lastSeen: p.lastSeen,
          confidence: p.confidence
        }
      }));
    
    // Record patterns in pattern service
    for (const pattern of highConfidencePatterns) {
      await (this.patternService as any).recordPattern(pattern);
    }
  }

  /**
   * Generate tags for pattern
   */
  private generatePatternTags(pattern: SessionPattern): string[] {
    const tags: string[] = [];
    
    // Complexity tags
    if (pattern.complexity.overall < 30) tags.push('low-complexity');
    else if (pattern.complexity.overall < 60) tags.push('medium-complexity');
    else if (pattern.complexity.overall < 85) tags.push('high-complexity');
    else tags.push('very-high-complexity');
    
    // Memory tags
    if (pattern.executionMetrics.memoryUsage < 200) tags.push('low-memory');
    else if (pattern.executionMetrics.memoryUsage < 400) tags.push('moderate-memory');
    else tags.push('high-memory');
    
    // Success tags
    if (pattern.executionMetrics.successRate > 0.9) tags.push('highly-successful');
    else if (pattern.executionMetrics.successRate < 0.5) tags.push('problematic');
    
    // Feature tags
    if (pattern.optimizationStrategy) tags.push('optimized');
    if (pattern.splittingStrategy) tags.push('split-session');
    
    return tags;
  }

  /**
   * Get recommendations for a given complexity score
   */
  async getRecommendations(
    complexityScore: ComplexityScore
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Find similar patterns
    const similarPatterns = Array.from(this.patterns.values())
      .filter(p => {
        const complexityDiff = Math.abs(p.complexity.overall - complexityScore.overall);
        const memoryDiff = Math.abs(p.executionMetrics.memoryUsage - complexityScore.estimatedMemoryUsage);
        return complexityDiff < 20 && memoryDiff < 100;
      })
      .filter(p => p.confidence > this.PATTERN_CONFIDENCE_THRESHOLD);
    
    if (similarPatterns.length === 0) {
      return recommendations;
    }
    
    // Analyze successful patterns
    const successfulPatterns = similarPatterns.filter(p => p.executionMetrics.successRate > 0.8);
    
    // Recommendation 1: Splitting strategy
    if (complexityScore.splitRecommended) {
      const splitPatterns = successfulPatterns.filter(p => p.splittingStrategy);
      if (splitPatterns.length > 0) {
        const avgSplitCount = splitPatterns.reduce(
          (sum, p) => sum + (p.splittingStrategy?.splitCount || 0), 0
        ) / splitPatterns.length;
        
        recommendations.push({
          strategy: `Split into ${Math.round(avgSplitCount)} focused sessions`,
          expectedImprovement: {
            memoryReduction: 40,
            successRateIncrease: 25,
            durationReduction: 10
          },
          confidence: 0.85,
          reasoning: [
            `Based on ${splitPatterns.length} similar successful split sessions`,
            `Average split complexity: ${Math.round(splitPatterns[0]?.splittingStrategy?.averageSplitComplexity || 0)}`,
            'Splitting has proven effective for similar complexity levels'
          ]
        });
      }
    }
    
    // Recommendation 2: Memory optimization
    const optimizedPatterns = successfulPatterns.filter(p => p.optimizationStrategy);
    if (optimizedPatterns.length > 0 && complexityScore.estimatedMemoryUsage > 300) {
      const avgMemoryReduction = optimizedPatterns.reduce(
        (sum, p) => sum + (p.optimizationStrategy!.memoryReduction || 0), 0
      ) / optimizedPatterns.length;
      
      recommendations.push({
        strategy: 'Apply memory optimization techniques',
        expectedImprovement: {
          memoryReduction: Math.round(avgMemoryReduction),
          successRateIncrease: 15,
          durationReduction: 5
        },
        confidence: 0.75,
        reasoning: [
          `Memory optimization reduced usage by ${Math.round(avgMemoryReduction)}% in similar sessions`,
          'High memory usage identified as potential bottleneck',
          `${optimizedPatterns.length} successful optimizations recorded`
        ]
      });
    }
    
    // Recommendation 3: Execution strategy based on component analysis
    const componentInsights = this.analyzeComponentPatterns(complexityScore, successfulPatterns);
    if (componentInsights.length > 0 && componentInsights[0]) {
      recommendations.push({
        strategy: componentInsights[0].strategy,
        expectedImprovement: componentInsights[0].improvement,
        confidence: componentInsights[0].confidence,
        reasoning: componentInsights[0].reasoning
      });
    }
    
    return recommendations;
  }

  /**
   * Analyze component patterns for insights
   */
  private analyzeComponentPatterns(
    complexityScore: ComplexityScore,
    patterns: SessionPattern[]
  ): Array<{
    strategy: string;
    improvement: OptimizationRecommendation['expectedImprovement'];
    confidence: number;
    reasoning: string[];
  }> {
    const insights: any[] = [];
    
    // High integration complexity
    if (complexityScore.components.integrations > 70) {
      const integrationPatterns = patterns.filter(
        p => p.complexity && p.complexity.components && p.complexity.components['integrations'] && p.complexity.components['integrations'] > 60
      );
      
      if (integrationPatterns.length > 0) {
        insights.push({
          strategy: 'Implement integration caching and connection pooling',
          improvement: {
            memoryReduction: 20,
            successRateIncrease: 30,
            durationReduction: 25
          },
          confidence: 0.8,
          reasoning: [
            'High integration complexity detected',
            `${integrationPatterns.length} similar patterns show caching benefits`,
            'Connection pooling reduces overhead significantly'
          ]
        });
      }
    }
    
    // High technical depth
    if (complexityScore.components.technicalDepth > 80) {
      insights.push({
        strategy: 'Use incremental implementation with validation checkpoints',
        improvement: {
          memoryReduction: 15,
          successRateIncrease: 35,
          durationReduction: 10
        },
        confidence: 0.75,
        reasoning: [
          'High technical complexity requires careful execution',
          'Checkpoints allow early failure detection',
          'Incremental approach proven effective in similar cases'
        ]
      });
    }
    
    return insights;
  }

  /**
   * Get learning insights
   */
  getInsights(): LearningInsight[] {
    return this.insights;
  }

  /**
   * Get pattern statistics
   */
  getPatternStatistics(): {
    totalPatterns: number;
    highConfidencePatterns: number;
    averageSuccessRate: number;
    mostCommonFailureComplexity: number;
    optimizationEffectiveness: number;
  } {
    const allPatterns = Array.from(this.patterns.values());
    const highConfidence = allPatterns.filter(
      p => p.confidence > this.PATTERN_CONFIDENCE_THRESHOLD
    );
    
    const avgSuccess = allPatterns.length > 0 ?
      allPatterns.reduce((sum, p) => sum + p.executionMetrics.successRate, 0) / allPatterns.length :
      0;
    
    const failures = allPatterns.filter(p => p.type === 'failure');
    const mostCommonFailure = failures.length > 0 ?
      Math.round(failures.reduce((sum, p) => sum + p.complexity.overall, 0) / failures.length) :
      0;
    
    const optimizedPatterns = allPatterns.filter(p => p.optimizationStrategy);
    const optimizationEffect = optimizedPatterns.length > 0 ?
      optimizedPatterns.reduce((sum, p) => sum + (p.optimizationStrategy!.effectiveness || 0), 0) / optimizedPatterns.length :
      0;
    
    return {
      totalPatterns: allPatterns.length,
      highConfidencePatterns: highConfidence.length,
      averageSuccessRate: Math.round(avgSuccess * 100) / 100,
      mostCommonFailureComplexity: mostCommonFailure,
      optimizationEffectiveness: Math.round(optimizationEffect * 100)
    };
  }

  /**
   * Clean up old patterns
   */
  async cleanupOldPatterns(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [id, pattern] of this.patterns.entries()) {
      if (new Date(pattern.lastSeen) < cutoffDate && pattern.confidence < 0.5) {
        this.patterns.delete(id);
        await (this.db as any).run('DELETE FROM session_patterns WHERE id = ?', [id]);
        cleaned++;
      }
    }
    
    this.logger.info('Cleaned up old patterns', { count: cleaned });
    return cleaned;
  }
}