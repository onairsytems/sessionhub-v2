import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

interface CodePattern {
  id: string;
  type: 'success' | 'error' | 'workflow' | 'optimization';
  pattern: string;
  description: string;
  frequency: number;
  successRate: number;
  lastSeen: Date;
  examples: PatternExample[];
  solutions?: Solution[];
  tags: string[];
  score: number;
  projectTypes: string[];
  language?: string;
  framework?: string;
}

interface PatternExample {
  id: string;
  code: string;
  context: string;
  outcome: 'success' | 'failure';
  timestamp: Date;
  projectId: string;
  metadata?: Record<string, any>;
}

interface Solution {
  id: string;
  description: string;
  code: string;
  successRate: number;
  appliedCount: number;
  averageTimeToApply: number;
}

interface WorkflowPattern {
  id: string;
  steps: WorkflowStep[];
  averageDuration: number;
  successRate: number;
  optimizationPotential: number;
  bottlenecks: Bottleneck[];
}

interface WorkflowStep {
  id: string;
  name: string;
  averageDuration: number;
  failureRate: number;
  dependencies: string[];
}

interface Bottleneck {
  stepId: string;
  impact: number;
  suggestedOptimizations: string[];
}

interface PatternSuggestion {
  pattern: CodePattern;
  relevanceScore: number;
  reason: string;
  applicationStrategy: string;
  estimatedImpact: {
    timeReduction: number;
    errorReduction: number;
    qualityImprovement: number;
  };
}

interface PatternAnalysisResult {
  patterns: CodePattern[];
  suggestions: PatternSuggestion[];
  insights: string[];
  metrics: {
    totalPatternsAnalyzed: number;
    newPatternsDiscovered: number;
    patternAccuracy: number;
    improvementPotential: number;
  };
}

export class PatternRecognitionService {
  private supabase: SupabaseClient;
  private patterns: Map<string, CodePattern> = new Map();
  private workflowPatterns: Map<string, WorkflowPattern> = new Map();
  private patternCache: Map<string, PatternAnalysisResult> = new Map();
  private learningRate = 0.1;
  private minPatternFrequency = 3;
  private patternDecayRate = 0.95;

  constructor() {
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || '';
    const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.initializePatterns();
  }

  private async initializePatterns(): Promise<void> {
    try {
      // Load existing patterns from database
      const { data: patterns, error } = await this.supabase
        .from('code_patterns')
        .select('*')
        .order('score', { ascending: false });

      if (error) throw error;

      patterns?.forEach((pattern: any) => {
        this.patterns.set(pattern.id, {
          ...pattern,
          lastSeen: new Date(pattern.last_seen),
          examples: JSON.parse(pattern.examples || '[]'),
          solutions: JSON.parse(pattern.solutions || '[]'),
          tags: JSON.parse(pattern.tags || '[]'),
          projectTypes: JSON.parse(pattern.project_types || '[]')
        });
      });

      // Load workflow patterns
      const { data: workflows } = await this.supabase
        .from('workflow_patterns')
        .select('*');

      workflows?.forEach((workflow: any) => {
        this.workflowPatterns.set(workflow.id, {
          ...workflow,
          steps: JSON.parse(workflow.steps || '[]'),
          bottlenecks: JSON.parse(workflow.bottlenecks || '[]')
        });
      });
    } catch (error) {
      console.error('Failed to initialize patterns:', error);
    }
  }

  async analyzeProjectPatterns(projectId: string): Promise<PatternAnalysisResult> {
    const cacheKey = `project-${projectId}-${Date.now()}`;
    const cached = this.patternCache.get(cacheKey);
    if (cached && Date.now() - cached.metrics.totalPatternsAnalyzed < 300000) {
      return cached;
    }

    try {
      // Fetch project sessions and code
      const { data: sessions, error } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const patterns: CodePattern[] = [];
      const newPatterns: CodePattern[] = [];

      // Analyze code patterns in sessions
      for (const session of sessions || []) {
        const sessionPatterns = await this.extractPatternsFromSession(session);
        patterns.push(...sessionPatterns);
        
        // Identify new patterns
        sessionPatterns.forEach(pattern => {
          if (!this.patterns.has(pattern.id)) {
            newPatterns.push(pattern);
          }
        });
      }

      // Analyze workflow patterns
      const workflowAnalysis = await this.analyzeWorkflowPatterns(projectId);

      // Generate suggestions based on patterns
      const suggestions = await this.generatePatternSuggestions(projectId, patterns);

      // Calculate insights
      const insights = this.generateInsights(patterns, workflowAnalysis);

      const result: PatternAnalysisResult = {
        patterns: this.rankPatterns(patterns),
        suggestions,
        insights,
        metrics: {
          totalPatternsAnalyzed: patterns.length,
          newPatternsDiscovered: newPatterns.length,
          patternAccuracy: this.calculatePatternAccuracy(patterns),
          improvementPotential: this.calculateImprovementPotential(suggestions)
        }
      };

      this.patternCache.set(cacheKey, result);
      
      // Update pattern database with new discoveries
      await this.updatePatternDatabase(newPatterns);

      return result;
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return {
        patterns: [],
        suggestions: [],
        insights: ['Analysis failed due to an error'],
        metrics: {
          totalPatternsAnalyzed: 0,
          newPatternsDiscovered: 0,
          patternAccuracy: 0,
          improvementPotential: 0
        }
      };
    }
  }

  private async extractPatternsFromSession(session: any): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    const codeBlocks = this.extractCodeBlocks(session.content || '');

    for (const block of codeBlocks) {
      // Analyze success patterns
      const successPatterns = this.identifySuccessPatterns(block);
      patterns.push(...successPatterns);

      // Analyze error patterns
      const errorPatterns = this.identifyErrorPatterns(block);
      patterns.push(...errorPatterns);

      // Analyze optimization opportunities
      const optimizationPatterns = this.identifyOptimizationPatterns(block);
      patterns.push(...optimizationPatterns);
    }

    return patterns;
  }

  private identifySuccessPatterns(code: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    
    // Common successful patterns
    const successIndicators = [
      {
        regex: /async\s+\w+\s*\([^)]*\)\s*{\s*try\s*{[\s\S]*?}\s*catch/g,
        type: 'error-handling',
        description: 'Proper async/await with try-catch error handling'
      },
      {
        regex: /const\s+\w+\s*=\s*useMemo\(\(\)\s*=>/g,
        type: 'performance',
        description: 'React useMemo for expensive computations'
      },
      {
        regex: /interface\s+\w+\s*{[\s\S]*?}/g,
        type: 'type-safety',
        description: 'TypeScript interface definitions'
      },
      {
        regex: /describe\s*\(['"`][\s\S]*?['"`]\s*,\s*\(\)\s*=>\s*{[\s\S]*?it\s*\(/g,
        type: 'testing',
        description: 'Comprehensive test suite structure'
      },
      {
        regex: /const\s+\[\w+,\s*set\w+\]\s*=\s*useState/g,
        type: 'state-management',
        description: 'React useState hook pattern'
      }
    ];

    successIndicators.forEach(indicator => {
      const matches = code.match(indicator.regex);
      if (matches && matches.length > 0) {
        const patternId = `success-${indicator.type}-${this.generateHash(indicator.description)}`;
        patterns.push({
          id: patternId,
          type: 'success',
          pattern: indicator.regex.source,
          description: indicator.description,
          frequency: matches.length,
          successRate: 0.85,
          lastSeen: new Date(),
          examples: matches.slice(0, 3).map((match, index) => ({
            id: `${patternId}-example-${index}`,
            code: match,
            context: indicator.type,
            outcome: 'success',
            timestamp: new Date(),
            projectId: '',
            metadata: { indicatorType: indicator.type }
          })),
          tags: [indicator.type, 'best-practice'],
          score: this.calculatePatternScore(matches.length, 0.85),
          projectTypes: ['web', 'mobile', 'desktop']
        });
      }
    });

    return patterns;
  }

  private identifyErrorPatterns(code: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    
    // Common error patterns
    const errorIndicators = [
      {
        regex: /console\.(log|error|warn)\(/g,
        type: 'debugging',
        description: 'Console statements left in code',
        solution: 'Remove console statements or use proper logging service'
      },
      {
        regex: /any/g,
        type: 'type-safety',
        description: 'TypeScript "any" type usage',
        solution: 'Replace with specific type definitions'
      },
      {
        regex: /setTimeout\s*\(\s*\(\)\s*=>\s*{[\s\S]*?},\s*0\)/g,
        type: 'timing',
        description: 'Zero timeout hack',
        solution: 'Use proper async patterns or React effects'
      },
      {
        regex: /catch\s*\(\s*\w*\s*\)\s*{\s*}/g,
        type: 'error-handling',
        description: 'Empty catch blocks',
        solution: 'Implement proper error handling'
      },
      {
        regex: /==(?!=)/g,
        type: 'comparison',
        description: 'Loose equality comparison',
        solution: 'Use strict equality (===) instead'
      }
    ];

    errorIndicators.forEach(indicator => {
      const matches = code.match(indicator.regex);
      if (matches && matches.length > 0) {
        const patternId = `error-${indicator.type}-${this.generateHash(indicator.description)}`;
        patterns.push({
          id: patternId,
          type: 'error',
          pattern: indicator.regex.source,
          description: indicator.description,
          frequency: matches.length,
          successRate: 0.3,
          lastSeen: new Date(),
          examples: matches.slice(0, 3).map((match, index) => ({
            id: `${patternId}-example-${index}`,
            code: match,
            context: indicator.type,
            outcome: 'failure',
            timestamp: new Date(),
            projectId: '',
            metadata: { errorType: indicator.type }
          })),
          solutions: [{
            id: `${patternId}-solution`,
            description: indicator.solution,
            code: '',
            successRate: 0.9,
            appliedCount: 0,
            averageTimeToApply: 5
          }],
          tags: [indicator.type, 'anti-pattern'],
          score: this.calculatePatternScore(matches.length, 0.3, true),
          projectTypes: ['all']
        });
      }
    });

    return patterns;
  }

  private identifyOptimizationPatterns(code: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    
    // Optimization opportunities
    const optimizationIndicators = [
      {
        regex: /map\s*\([^)]*\)\s*\.filter\s*\(/g,
        type: 'performance',
        description: 'Map followed by filter can be optimized',
        optimization: 'Use reduce or filter then map for better performance'
      },
      {
        regex: /document\.querySelector/g,
        type: 'dom-access',
        description: 'Direct DOM manipulation in React',
        optimization: 'Use React refs instead'
      },
      {
        regex: /for\s*\(\s*let\s+\w+\s*=\s*0;\s*\w+\s*<\s*\w+\.length/g,
        type: 'iteration',
        description: 'Traditional for loop',
        optimization: 'Consider using array methods for cleaner code'
      },
      {
        regex: /new\s+Promise\s*\(\s*\(\s*resolve\s*,\s*reject\s*\)\s*=>\s*{\s*\w+\(/g,
        type: 'async',
        description: 'Manual promise wrapping',
        optimization: 'Use async/await or promisify utilities'
      }
    ];

    optimizationIndicators.forEach(indicator => {
      const matches = code.match(indicator.regex);
      if (matches && matches.length > 0) {
        const patternId = `optimization-${indicator.type}-${this.generateHash(indicator.description)}`;
        patterns.push({
          id: patternId,
          type: 'optimization',
          pattern: indicator.regex.source,
          description: indicator.description,
          frequency: matches.length,
          successRate: 0.6,
          lastSeen: new Date(),
          examples: matches.slice(0, 3).map((match, index) => ({
            id: `${patternId}-example-${index}`,
            code: match,
            context: indicator.type,
            outcome: 'success',
            timestamp: new Date(),
            projectId: '',
            metadata: { optimizationType: indicator.type }
          })),
          solutions: [{
            id: `${patternId}-solution`,
            description: indicator.optimization,
            code: '',
            successRate: 0.85,
            appliedCount: 0,
            averageTimeToApply: 10
          }],
          tags: [indicator.type, 'performance', 'refactoring'],
          score: this.calculatePatternScore(matches.length, 0.6),
          projectTypes: ['all']
        });
      }
    });

    return patterns;
  }

  private async analyzeWorkflowPatterns(projectId: string): Promise<WorkflowPattern[]> {
    try {
      const { data: sessions, error } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const workflowSteps: Map<string, WorkflowStep> = new Map();
      const workflows: WorkflowPattern[] = [];

      // Analyze session sequences
      for (let i = 0; i < (sessions?.length || 0) - 1; i++) {
        const currentSession = sessions![i];
        const nextSession = sessions![i + 1];
        
        const timeDiff = new Date(nextSession.created_at).getTime() - 
                        new Date(currentSession.created_at).getTime();
        
        const stepId = `${currentSession.type}-to-${nextSession.type}`;
        const existing = workflowSteps.get(stepId);
        
        if (existing) {
          existing.averageDuration = (existing.averageDuration + timeDiff) / 2;
        } else {
          workflowSteps.set(stepId, {
            id: stepId,
            name: `${currentSession.type} → ${nextSession.type}`,
            averageDuration: timeDiff,
            failureRate: 0.1,
            dependencies: []
          });
        }
      }

      // Identify bottlenecks
      const avgDuration = Array.from(workflowSteps.values())
        .reduce((sum, step) => sum + step.averageDuration, 0) / workflowSteps.size;

      const bottlenecks: Bottleneck[] = Array.from(workflowSteps.values())
        .filter(step => step.averageDuration > avgDuration * 1.5)
        .map(step => ({
          stepId: step.id,
          impact: step.averageDuration / avgDuration,
          suggestedOptimizations: this.generateOptimizationSuggestions(step)
        }));

      if (workflowSteps.size > 0) {
        workflows.push({
          id: `workflow-${projectId}`,
          steps: Array.from(workflowSteps.values()),
          averageDuration: avgDuration,
          successRate: 0.85,
          optimizationPotential: bottlenecks.length > 0 ? 0.7 : 0.3,
          bottlenecks
        });
      }

      return workflows;
    } catch (error) {
      console.error('Workflow pattern analysis failed:', error);
      return [];
    }
  }

  private generateOptimizationSuggestions(step: WorkflowStep): string[] {
    const suggestions: string[] = [];
    
    if (step.name.includes('validation')) {
      suggestions.push('Consider parallel validation checks');
      suggestions.push('Cache validation results for similar inputs');
    }
    
    if (step.name.includes('build')) {
      suggestions.push('Enable incremental builds');
      suggestions.push('Use build caching strategies');
      suggestions.push('Optimize dependency resolution');
    }
    
    if (step.name.includes('test')) {
      suggestions.push('Run tests in parallel');
      suggestions.push('Use test result caching');
      suggestions.push('Implement smart test selection');
    }
    
    if (step.averageDuration > 60000) {
      suggestions.push('Consider breaking this step into smaller tasks');
      suggestions.push('Investigate async processing options');
    }
    
    return suggestions;
  }

  private async generatePatternSuggestions(
    projectId: string, 
    patterns: CodePattern[]
  ): Promise<PatternSuggestion[]> {
    const suggestions: PatternSuggestion[] = [];
    
    // Get project context
    const { data: project } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    // Analyze current patterns and suggest improvements
    const errorPatterns = patterns.filter(p => p.type === 'error');
    const successPatterns = patterns.filter(p => p.type === 'success');
    
    // Suggest successful patterns that could replace error patterns
    errorPatterns.forEach(errorPattern => {
      const relevantSuccess = successPatterns.find(sp => 
        sp.tags.some(tag => errorPattern.tags.includes(tag))
      );
      
      if (relevantSuccess) {
        suggestions.push({
          pattern: relevantSuccess,
          relevanceScore: this.calculateRelevanceScore(errorPattern, relevantSuccess),
          reason: `Replace ${errorPattern.description} with ${relevantSuccess.description}`,
          applicationStrategy: this.generateApplicationStrategy(errorPattern, relevantSuccess),
          estimatedImpact: {
            timeReduction: 20,
            errorReduction: 40,
            qualityImprovement: 30
          }
        });
      }
    });

    // Suggest patterns from successful projects
    const topPatterns = Array.from(this.patterns.values())
      .filter(p => p.successRate > 0.8)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    topPatterns.forEach(pattern => {
      if (!patterns.find(p => p.id === pattern.id)) {
        suggestions.push({
          pattern,
          relevanceScore: this.calculateProjectRelevance(pattern, project),
          reason: `High-success pattern from similar projects`,
          applicationStrategy: `Apply ${pattern.description} to improve code quality`,
          estimatedImpact: {
            timeReduction: 15,
            errorReduction: 25,
            qualityImprovement: 35
          }
        });
      }
    });

    return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
  }

  private calculateRelevanceScore(errorPattern: CodePattern, successPattern: CodePattern): number {
    let score = 0;
    
    // Tag similarity
    const commonTags = errorPattern.tags.filter(tag => successPattern.tags.includes(tag));
    score += commonTags.length * 0.2;
    
    // Success rate impact
    score += successPattern.successRate * 0.3;
    
    // Frequency consideration
    score += Math.min(successPattern.frequency / 100, 0.3);
    
    // Recent usage bonus
    const daysSinceUsed = (Date.now() - successPattern.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUsed < 7) score += 0.2;
    
    return Math.min(score, 1);
  }

  private calculateProjectRelevance(pattern: CodePattern, project: any): number {
    let score = 0;
    
    // Project type match
    if (pattern.projectTypes.includes(project?.type || 'web')) {
      score += 0.3;
    }
    
    // Framework match
    if (pattern.framework === project?.framework) {
      score += 0.25;
    }
    
    // Language match
    if (pattern.language === project?.language) {
      score += 0.25;
    }
    
    // Success rate
    score += pattern.successRate * 0.2;
    
    return score;
  }

  private generateApplicationStrategy(errorPattern: CodePattern, successPattern: CodePattern): string {
    const strategies = [
      `Refactor instances of "${errorPattern.description}" to use "${successPattern.description}"`,
      `Apply automated fixes using pattern matching and AST transformation`,
      `Create lint rules to prevent future occurrences of the error pattern`,
      `Implement gradual migration with deprecation warnings`
    ];
    
    return strategies[0] || ''; // Could be more sophisticated based on pattern types
  }

  private generateInsights(patterns: CodePattern[], workflowPatterns: WorkflowPattern[]): string[] {
    const insights: string[] = [];
    
    // Pattern-based insights
    const errorRate = patterns.filter(p => p.type === 'error').length / patterns.length;
    if (errorRate > 0.3) {
      insights.push(`High error pattern rate (${(errorRate * 100).toFixed(1)}%) indicates need for better code review practices`);
    }
    
    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
    if (avgSuccessRate < 0.7) {
      insights.push(`Low average success rate (${(avgSuccessRate * 100).toFixed(1)}%) suggests need for better testing`);
    }
    
    // Workflow insights
    workflowPatterns.forEach(workflow => {
      if (workflow.bottlenecks.length > 0) {
        insights.push(`Workflow bottlenecks detected: ${workflow.bottlenecks.map(b => b.stepId).join(', ')}`);
      }
      
      if (workflow.optimizationPotential > 0.5) {
        insights.push(`High optimization potential (${(workflow.optimizationPotential * 100).toFixed(1)}%) in current workflow`);
      }
    });
    
    // Trending patterns
    const recentPatterns = patterns.filter(p => 
      (Date.now() - p.lastSeen.getTime()) < 7 * 24 * 60 * 60 * 1000
    );
    
    if (recentPatterns.length > patterns.length * 0.7) {
      insights.push('Most patterns are recently active, indicating consistent coding practices');
    }
    
    return insights;
  }

  private rankPatterns(patterns: CodePattern[]): CodePattern[] {
    return patterns.sort((a, b) => {
      // Multi-factor ranking
      const aScore = a.score * 0.4 + 
                    a.successRate * 0.3 + 
                    (a.frequency / 100) * 0.2 +
                    (a.solutions?.length || 0) * 0.1;
                    
      const bScore = b.score * 0.4 + 
                    b.successRate * 0.3 + 
                    (b.frequency / 100) * 0.2 +
                    (b.solutions?.length || 0) * 0.1;
                    
      return bScore - aScore;
    });
  }

  private calculatePatternScore(frequency: number, successRate: number, isError = false): number {
    let score = frequency * 0.3 + successRate * 0.7;
    
    // Penalize error patterns
    if (isError) {
      score *= 0.5;
    }
    
    // Normalize to 0-100
    return Math.min(score * 100, 100);
  }

  private calculatePatternAccuracy(patterns: CodePattern[]): number {
    if (patterns.length === 0) return 0;
    
    const accuratePatterns = patterns.filter(p => 
      p.successRate > 0.7 || (p.type === 'error' && p.solutions && p.solutions.length > 0)
    );
    
    return accuratePatterns.length / patterns.length;
  }

  private calculateImprovementPotential(suggestions: PatternSuggestion[]): number {
    if (suggestions.length === 0) return 0;
    
    const avgImpact = suggestions.reduce((sum, s) => 
      sum + (s.estimatedImpact.timeReduction + 
             s.estimatedImpact.errorReduction + 
             s.estimatedImpact.qualityImprovement) / 3, 0
    ) / suggestions.length;
    
    return avgImpact / 100;
  }

  private async updatePatternDatabase(newPatterns: CodePattern[]): Promise<void> {
    for (const pattern of newPatterns) {
      try {
        await this.supabase.from('code_patterns').insert({
          id: pattern.id,
          type: pattern.type,
          pattern: pattern.pattern,
          description: pattern.description,
          frequency: pattern.frequency,
          success_rate: pattern.successRate,
          last_seen: pattern.lastSeen.toISOString(),
          examples: JSON.stringify(pattern.examples),
          solutions: JSON.stringify(pattern.solutions || []),
          tags: JSON.stringify(pattern.tags),
          score: pattern.score,
          project_types: JSON.stringify(pattern.projectTypes),
          language: pattern.language,
          framework: pattern.framework
        });
        
        this.patterns.set(pattern.id, pattern);
      } catch (error) {
        console.error(`Failed to save pattern ${pattern.id}:`, error);
      }
    }
  }

  async learnFromNewPattern(pattern: Partial<CodePattern>): Promise<void> {
    const existingPattern = pattern.id ? this.patterns.get(pattern.id) : null;
    
    if (existingPattern) {
      // Update existing pattern with new information
      existingPattern.frequency += 1;
      existingPattern.lastSeen = new Date();
      
      if (pattern.successRate !== undefined) {
        // Exponential moving average for success rate
        existingPattern.successRate = 
          existingPattern.successRate * (1 - this.learningRate) + 
          pattern.successRate * this.learningRate;
      }
      
      if (pattern.examples) {
        existingPattern.examples.push(...pattern.examples);
        // Keep only recent examples
        existingPattern.examples = existingPattern.examples.slice(-10);
      }
      
      existingPattern.score = this.calculatePatternScore(
        existingPattern.frequency, 
        existingPattern.successRate
      );
      
      await this.updatePatternInDatabase(existingPattern);
    } else if (pattern.pattern && pattern.description) {
      // Create new pattern
      const newPattern: CodePattern = {
        id: `pattern-${this.generateHash(pattern.pattern)}`,
        type: pattern.type || 'success',
        pattern: pattern.pattern,
        description: pattern.description,
        frequency: 1,
        successRate: pattern.successRate || 0.5,
        lastSeen: new Date(),
        examples: pattern.examples || [],
        solutions: pattern.solutions,
        tags: pattern.tags || [],
        score: 50,
        projectTypes: pattern.projectTypes || ['all'],
        language: pattern.language,
        framework: pattern.framework
      };
      
      this.patterns.set(newPattern.id, newPattern);
      await this.updatePatternDatabase([newPattern]);
    }
  }

  private async updatePatternInDatabase(pattern: CodePattern): Promise<void> {
    try {
      await this.supabase
        .from('code_patterns')
        .update({
          frequency: pattern.frequency,
          success_rate: pattern.successRate,
          last_seen: pattern.lastSeen.toISOString(),
          examples: JSON.stringify(pattern.examples),
          score: pattern.score
        })
        .eq('id', pattern.id);
    } catch (error) {
      console.error(`Failed to update pattern ${pattern.id}:`, error);
    }
  }

  async getSuggestionsForContext(context: {
    projectType?: string;
    language?: string;
    framework?: string;
    currentCode?: string;
    errorMessage?: string;
  }): Promise<PatternSuggestion[]> {
    const relevantPatterns = Array.from(this.patterns.values()).filter(pattern => {
      let matches = true;
      
      if (context.projectType && !pattern.projectTypes.includes(context.projectType)) {
        matches = false;
      }
      
      if (context.language && pattern.language && pattern.language !== context.language) {
        matches = false;
      }
      
      if (context.framework && pattern.framework && pattern.framework !== context.framework) {
        matches = false;
      }
      
      return matches;
    });

    const suggestions: PatternSuggestion[] = [];

    // If there's an error, find solutions
    if (context.errorMessage) {
      const errorPatterns = relevantPatterns.filter(p => 
        p.type === 'error' && 
        context.errorMessage!.toLowerCase().includes(p.description.toLowerCase())
      );
      
      errorPatterns.forEach(pattern => {
        if (pattern.solutions && pattern.solutions.length > 0) {
          suggestions.push({
            pattern,
            relevanceScore: 0.9,
            reason: `Direct solution for: ${pattern.description}`,
            applicationStrategy: pattern.solutions[0]?.description || '',
            estimatedImpact: {
              timeReduction: 30,
              errorReduction: 80,
              qualityImprovement: 40
            }
          });
        }
      });
    }

    // Find optimization opportunities in current code
    if (context.currentCode) {
      const optimizationPatterns = this.identifyOptimizationPatterns(context.currentCode);
      optimizationPatterns.forEach(pattern => {
        suggestions.push({
          pattern,
          relevanceScore: 0.7,
          reason: `Code optimization opportunity detected`,
          applicationStrategy: pattern.solutions?.[0]?.description || 'Apply optimization',
          estimatedImpact: {
            timeReduction: 20,
            errorReduction: 10,
            qualityImprovement: 50
          }
        });
      });
    }

    // Add general best practices
    const bestPractices = relevantPatterns
      .filter(p => p.type === 'success' && p.successRate > 0.85)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
      
    bestPractices.forEach(pattern => {
      suggestions.push({
        pattern,
        relevanceScore: 0.6,
        reason: 'Recommended best practice',
        applicationStrategy: `Implement ${pattern.description}`,
        estimatedImpact: {
          timeReduction: 15,
          errorReduction: 20,
          qualityImprovement: 60
        }
      });
    });

    return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private extractCodeBlocks(content: string): string[] {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push(match[1] || '');
    }
    
    return blocks;
  }

  private generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async decayPatternScores(): Promise<void> {
    // Run periodically to decay pattern scores based on age
    const now = Date.now();
    
    for (const [id, pattern] of this.patterns) {
      const daysSinceUsed = (now - pattern.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUsed > 30) {
        pattern.score *= this.patternDecayRate;
        
        if (pattern.score < 10 && pattern.frequency < this.minPatternFrequency) {
          // Remove patterns that are no longer relevant
          this.patterns.delete(id);
          await this.removePatternFromDatabase(id);
        } else {
          await this.updatePatternInDatabase(pattern);
        }
      }
    }
  }

  private async removePatternFromDatabase(patternId: string): Promise<void> {
    try {
      await this.supabase
        .from('code_patterns')
        .delete()
        .eq('id', patternId);
    } catch (error) {
      console.error(`Failed to remove pattern ${patternId}:`, error);
    }
  }

  async exportPatternReport(projectId?: string): Promise<{
    summary: string;
    topPatterns: CodePattern[];
    recommendations: string[];
    metrics: Record<string, number>;
  }> {
    const patterns = projectId 
      ? (await this.analyzeProjectPatterns(projectId)).patterns
      : Array.from(this.patterns.values());
      
    const topPatterns = patterns
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
      
    const metrics = {
      totalPatterns: patterns.length,
      successPatterns: patterns.filter(p => p.type === 'success').length,
      errorPatterns: patterns.filter(p => p.type === 'error').length,
      averageSuccessRate: patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length,
      patternsWithSolutions: patterns.filter(p => p.solutions && p.solutions.length > 0).length
    };
    
    const recommendations = this.generateRecommendations(patterns, metrics);
    
    const summary = `
Pattern Recognition Report
========================
Total Patterns Analyzed: ${metrics.totalPatterns}
Success Patterns: ${metrics.successPatterns}
Error Patterns: ${metrics.errorPatterns}
Average Success Rate: ${(metrics.averageSuccessRate * 100).toFixed(1)}%
Patterns with Solutions: ${metrics.patternsWithSolutions}

Top Insights:
${recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join('\n')}
    `.trim();
    
    return {
      summary,
      topPatterns,
      recommendations,
      metrics
    };
  }

  private generateRecommendations(patterns: CodePattern[], metrics: Record<string, number>): string[] {
    const recommendations: string[] = [];
    
    if ((metrics['errorPatterns'] || 0) > (metrics['successPatterns'] || 0)) {
      recommendations.push('Focus on implementing more success patterns to balance error-prone code');
    }
    
    if ((metrics['averageSuccessRate'] || 0) < 0.6) {
      recommendations.push('Low success rate indicates need for better testing and validation');
    }
    
    const errorPatternsWithoutSolutions = patterns.filter(p => 
      p.type === 'error' && (!p.solutions || p.solutions.length === 0)
    );
    
    if (errorPatternsWithoutSolutions.length > 0) {
      recommendations.push(`${errorPatternsWithoutSolutions.length} error patterns lack solutions - document fixes`);
    }
    
    const highFrequencyErrors = patterns
      .filter(p => p.type === 'error' && p.frequency > 10)
      .sort((a, b) => b.frequency - a.frequency);
      
    if (highFrequencyErrors.length > 0) {
      recommendations.push(`Address high-frequency error: "${highFrequencyErrors[0]?.description || 'Unknown error'}"`);
    }
    
    const recentSuccessPatterns = patterns.filter(p => 
      p.type === 'success' && 
      (Date.now() - p.lastSeen.getTime()) < 7 * 24 * 60 * 60 * 1000
    );
    
    if (recentSuccessPatterns.length > 0) {
      recommendations.push(`Continue using successful pattern: "${recentSuccessPatterns[0]?.description || 'Success pattern'}"`);
    }
    
    return recommendations;
  }
}