/**
 * @actor planning
 * @responsibility Intelligently splits complex sessions into focused sub-sessions
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session } from '@/src/core/orchestrator/SessionManager';
// Note: Session.request is of type UserRequest from SessionManager
import { 
  SessionComplexityAnalyzer, 
  ComplexityScore, 
  SuggestedSplit 
} from './SessionComplexityAnalyzer';
import { v4 as uuidv4 } from 'uuid';

export interface SplitSession extends Omit<Session, 'id'> {
  id: string;
  parentSessionId: string;
  splitIndex: number;
  splitTotal: number;
  dependencies: string[];
  estimatedComplexity: number;
  focusArea: string;
  objectives: string[];
  contextCarryOver: Record<string, any>;
}

export interface SessionSplitPlan {
  parentSessionId: string;
  totalSplits: number;
  splits: SplitSession[];
  executionOrder: string[];
  dependencies: Map<string, string[]>;
  estimatedTotalDuration: number;
  optimizationNotes: string[];
}

export interface SplitOptimizationOptions {
  maxComplexityPerSplit: number;
  maxMemoryPerSplit: number;
  preserveLogicalGrouping: boolean;
  enableParallelExecution: boolean;
  prioritizeByDependency: boolean;
}

export class SessionSplittingEngine {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly complexityAnalyzer: SessionComplexityAnalyzer; // Reserved for enhanced splitting logic
  
  private readonly DEFAULT_OPTIONS: SplitOptimizationOptions = {
    maxComplexityPerSplit: 40,
    maxMemoryPerSplit: 300, // MB
    preserveLogicalGrouping: true,
    enableParallelExecution: false,
    prioritizeByDependency: true
  };

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    complexityAnalyzer: SessionComplexityAnalyzer
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.complexityAnalyzer = complexityAnalyzer; // Store for future enhancements
  }

  /**
   * Split a complex session into manageable sub-sessions
   */
  async splitSession(
    session: Session,
    complexityScore: ComplexityScore,
    options: Partial<SplitOptimizationOptions> = {}
  ): Promise<SessionSplitPlan> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    this.logger.info('Splitting complex session', {
      sessionId: session.id,
      complexity: complexityScore.overall,
      estimatedMemory: complexityScore.estimatedMemoryUsage
    });

    // Use suggested splits if available, otherwise generate them
    const splits = complexityScore.suggestedSplits || 
                  await this.generateDefaultSplits(session, complexityScore);
    
    // Log complexity analysis from injected analyzer for monitoring
    this.logger.debug('Using complexity analyzer insights', {
      analyzerInstance: this.complexityAnalyzer.constructor.name,
      complexityScore: complexityScore.overall
    });

    // Optimize splits based on constraints
    const optimizedSplits = await this.optimizeSplits(splits, opts);

    // Create split sessions
    const splitSessions = await this.createSplitSessions(
      session,
      optimizedSplits,
      opts
    );

    // Build execution plan
    const executionPlan = this.buildExecutionPlan(splitSessions, opts);

    const splitPlan: SessionSplitPlan = {
      parentSessionId: session.id,
      totalSplits: splitSessions.length,
      splits: splitSessions,
      executionOrder: executionPlan.order,
      dependencies: executionPlan.dependencies,
      estimatedTotalDuration: executionPlan.estimatedDuration,
      optimizationNotes: executionPlan.notes
    };

    this.auditLogger.logEvent({
      actor: { type: 'planning', id: 'SessionSplittingEngine' },
      operation: {
        type: 'session.split',
        description: 'Split complex session into sub-sessions',
        input: { sessionId: session.id, complexity: complexityScore.overall }
      },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: session.id }
    });

    return splitPlan;
  }

  /**
   * Generate default splits if none suggested
   */
  private async generateDefaultSplits(
    session: Session,
    complexityScore: ComplexityScore
  ): Promise<SuggestedSplit[]> {
    if (!session.request) {
      throw new Error('Session must have a request to generate splits');
    }
    // session.request is of type UserRequest - imported at top

    const objectives = this.parseObjectives(session.request.content);
    const targetSplits = Math.ceil(complexityScore.overall / 40);
    const objectivesPerSplit = Math.ceil(objectives.length / targetSplits);

    const splits: SuggestedSplit[] = [];
    
    for (let i = 0; i < objectives.length; i += objectivesPerSplit) {
      const splitObjectives = objectives.slice(i, i + objectivesPerSplit);
      const splitIndex = Math.floor(i / objectivesPerSplit);
      
      splits.push({
        title: `${session.name} - Part ${splitIndex + 1}`,
        objectives: splitObjectives,
        estimatedComplexity: complexityScore.overall / targetSplits,
        dependencies: splitIndex > 0 ? [`${session.name} - Part ${splitIndex}`] : [],
        order: splitIndex + 1
      });
    }

    return splits;
  }

  /**
   * Optimize splits based on constraints
   */
  private async optimizeSplits(
    splits: SuggestedSplit[],
    options: SplitOptimizationOptions
  ): Promise<SuggestedSplit[]> {
    let optimized = [...splits];

    // Rebalance if any split exceeds complexity threshold
    if (options.maxComplexityPerSplit) {
      optimized = this.rebalanceByComplexity(optimized, options.maxComplexityPerSplit);
    }

    // Ensure logical grouping is preserved
    if (options.preserveLogicalGrouping) {
      optimized = this.preserveLogicalGroups(optimized);
    }

    // Optimize for parallel execution if enabled
    if (options.enableParallelExecution) {
      optimized = this.optimizeForParallelExecution(optimized);
    }

    // Sort by dependency order
    if (options.prioritizeByDependency) {
      optimized = this.sortByDependencyOrder(optimized);
    }

    return optimized;
  }

  /**
   * Rebalance splits that exceed complexity threshold
   */
  private rebalanceByComplexity(
    splits: SuggestedSplit[],
    maxComplexity: number
  ): SuggestedSplit[] {
    const rebalanced: SuggestedSplit[] = [];
    
    for (const split of splits) {
      if (split.estimatedComplexity <= maxComplexity) {
        rebalanced.push(split);
      } else {
        // Split this further
        const subSplitCount = Math.ceil(split.estimatedComplexity / maxComplexity);
        const objectivesPerSubSplit = Math.ceil(split.objectives.length / subSplitCount);
        
        for (let i = 0; i < split.objectives.length; i += objectivesPerSubSplit) {
          rebalanced.push({
            ...split,
            title: `${split.title} (${Math.floor(i / objectivesPerSubSplit) + 1}/${subSplitCount})`,
            objectives: split.objectives.slice(i, i + objectivesPerSubSplit),
            estimatedComplexity: split.estimatedComplexity / subSplitCount,
            order: split.order + (i / split.objectives.length)
          });
        }
      }
    }
    
    return rebalanced;
  }

  /**
   * Preserve logical grouping of related objectives
   */
  private preserveLogicalGroups(splits: SuggestedSplit[]): SuggestedSplit[] {
    // Analyze objectives for logical relationships
    const groups = this.identifyLogicalGroups(splits);
    
    // Reorganize splits to keep related objectives together
    const reorganized: SuggestedSplit[] = [];
    
    groups.forEach((group, index) => {
      reorganized.push({
        title: group.title,
        objectives: group.objectives,
        estimatedComplexity: group.complexity,
        dependencies: group.dependencies,
        order: index + 1
      });
    });
    
    return reorganized;
  }

  /**
   * Identify logical groups in objectives
   */
  private identifyLogicalGroups(
    splits: SuggestedSplit[]
  ): Array<{title: string; objectives: string[]; complexity: number; dependencies: string[]}> {
    const allObjectives = splits.flatMap(s => s.objectives);
    const groups: Map<string, string[]> = new Map();
    
    // Group by common keywords/themes
    const themes = {
      'UI/Frontend': ['ui', 'component', 'interface', 'frontend', 'design'],
      'Backend/API': ['api', 'backend', 'endpoint', 'service', 'server'],
      'Database': ['database', 'schema', 'migration', 'query', 'data'],
      'Testing': ['test', 'testing', 'validation', 'quality'],
      'Configuration': ['config', 'setting', 'environment', 'setup'],
      'Documentation': ['document', 'readme', 'guide', 'docs']
    };
    
    // Assign objectives to themes
    allObjectives.forEach(objective => {
      const lowerObj = objective.toLowerCase();
      let assigned = false;
      
      for (const [theme, keywords] of Object.entries(themes)) {
        if (keywords.some(keyword => lowerObj.includes(keyword))) {
          if (!groups.has(theme)) {
            groups.set(theme, []);
          }
          groups.get(theme)!.push(objective);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        if (!groups.has('General')) {
          groups.set('General', []);
        }
        groups.get('General')!.push(objective);
      }
    });
    
    // Convert to group objects
    return Array.from(groups.entries()).map(([theme, objectives]) => ({
      title: theme,
      objectives,
      complexity: objectives.length * 10, // Simple estimation
      dependencies: this.inferDependencies(theme)
    }));
  }

  /**
   * Infer dependencies based on theme
   */
  private inferDependencies(theme: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      'UI/Frontend': ['Backend/API'],
      'Backend/API': ['Database'],
      'Database': [],
      'Testing': ['UI/Frontend', 'Backend/API'],
      'Configuration': [],
      'Documentation': ['UI/Frontend', 'Backend/API', 'Database']
    };
    
    return dependencyMap[theme] || [];
  }

  /**
   * Optimize for parallel execution
   */
  private optimizeForParallelExecution(splits: SuggestedSplit[]): SuggestedSplit[] {
    // Identify independent splits that can run in parallel
    const dependencyGraph = this.buildDependencyGraph(splits);
    const parallelGroups = this.identifyParallelGroups(dependencyGraph);
    
    // Reorganize splits to maximize parallelism
    const optimized: SuggestedSplit[] = [];
    
    parallelGroups.forEach((group, index) => {
      group.forEach(split => {
        optimized.push({
          ...split,
          order: index + 1 // Same order = can run in parallel
        });
      });
    });
    
    return optimized;
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(
    splits: SuggestedSplit[]
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    splits.forEach(split => {
      if (!graph.has(split.title)) {
        graph.set(split.title, new Set());
      }
      
      split.dependencies.forEach(dep => {
        graph.get(split.title)!.add(dep);
      });
    });
    
    return graph;
  }

  /**
   * Identify groups that can run in parallel
   */
  private identifyParallelGroups(
    dependencyGraph: Map<string, Set<string>>
  ): SuggestedSplit[][] {
    const groups: SuggestedSplit[][] = [];
    const processed = new Set<string>();
    
    // Simple level-based grouping
    while (processed.size < dependencyGraph.size) {
      const currentGroup: SuggestedSplit[] = [];
      
      dependencyGraph.forEach((deps, title) => {
        if (!processed.has(title)) {
          // Can be included if all dependencies are processed
          const canInclude = Array.from(deps).every(dep => processed.has(dep));
          if (canInclude) {
            currentGroup.push({
              title,
              objectives: [], // Will be filled later
              estimatedComplexity: 0,
              dependencies: Array.from(deps),
              order: groups.length + 1
            });
            processed.add(title);
          }
        }
      });
      
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }
    
    return groups;
  }

  /**
   * Sort splits by dependency order
   */
  private sortByDependencyOrder(splits: SuggestedSplit[]): SuggestedSplit[] {
    const sorted: SuggestedSplit[] = [];
    const processed = new Set<string>();
    
    while (sorted.length < splits.length) {
      for (const split of splits) {
        if (!processed.has(split.title)) {
          const dependenciesMet = split.dependencies.every(dep => 
            processed.has(dep) || !splits.some(s => s.title === dep)
          );
          
          if (dependenciesMet) {
            sorted.push(split);
            processed.add(split.title);
          }
        }
      }
    }
    
    return sorted;
  }

  /**
   * Create split session objects
   */
  private async createSplitSessions(
    parentSession: Session,
    splits: SuggestedSplit[],
    options: SplitOptimizationOptions
  ): Promise<SplitSession[]> {
    const splitSessions: SplitSession[] = [];
    
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      if (!split) continue;
      
      const splitSession: SplitSession = {
        id: `${parentSession.id}_split_${i + 1}_${uuidv4().substring(0, 8)}`,
        parentSessionId: parentSession.id,
        name: split.title,
        description: `Split ${i + 1} of ${splits.length}: ${split.objectives.join(', ').substring(0, 100)}...`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: parentSession.userId,
        projectId: parentSession.projectId,
        splitIndex: i + 1,
        splitTotal: splits.length,
        dependencies: split.dependencies.map(dep => {
          const depSplit = splits.find(s => s.title === dep);
          return depSplit ? `${parentSession.id}_split_${splits.indexOf(depSplit) + 1}` : dep;
        }),
        estimatedComplexity: split.estimatedComplexity,
        focusArea: split.title,
        objectives: split.objectives,
        contextCarryOver: this.buildContextCarryOver(parentSession, split, i),
        metadata: {
          ...parentSession.metadata,
          'isSplit': true,
          'parentSessionId': parentSession.id,
          'splitConfiguration': options
        }
      };
      
      // Create a proper request for the split
      if (parentSession.request) {
        splitSession.request = {
          ...parentSession.request,
          id: `${parentSession.request.id}_split_${i + 1}`,
          sessionId: splitSession.id,
          content: this.buildSplitRequestContent(split, parentSession.request.content),
          context: {
            ...parentSession.request.context,
            isSplitSession: true,
            splitIndex: i + 1,
            splitTotal: splits.length,
            parentSessionId: parentSession.id
          }
        };
      }
      
      splitSessions.push(splitSession);
    }
    
    return splitSessions;
  }

  /**
   * Build context to carry over between splits
   */
  private buildContextCarryOver(
    parentSession: Session,
    split: SuggestedSplit,
    index: number
  ): Record<string, any> {
    const context: Record<string, any> = {
      parentContext: parentSession.request?.context || {},
      splitIndex: index + 1,
      focusArea: split.title,
      previousSplits: index > 0 ? index : 0
    };
    
    // Add any relevant context based on focus area
    if (split.title.includes('Database')) {
      context['schemaContext'] = true;
    } else if (split.title.includes('API')) {
      context['apiContext'] = true;
    } else if (split.title.includes('UI')) {
      context['uiContext'] = true;
    }
    
    return context;
  }

  /**
   * Build request content for split session
   */
  private buildSplitRequestContent(
    split: SuggestedSplit,
    originalContent: string
  ): string {
    const header = `[Split Session - ${split.title}]\n\n`;
    const objectives = `Objectives for this session:\n${split.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}\n\n`;
    const context = `Original Request Context:\n${originalContent.substring(0, 200)}...\n\n`;
    const focus = `Focus: This session specifically handles ${split.title.toLowerCase()} aspects of the original request.`;
    
    return header + objectives + context + focus;
  }

  /**
   * Build execution plan
   */
  private buildExecutionPlan(
    splitSessions: SplitSession[],
    options: SplitOptimizationOptions
  ): {
    order: string[];
    dependencies: Map<string, string[]>;
    estimatedDuration: number;
    notes: string[];
  } {
    const order: string[] = [];
    const dependencies = new Map<string, string[]>();
    const notes: string[] = [];
    
    // Build dependency map
    splitSessions.forEach(session => {
      dependencies.set(session.id, session.dependencies);
    });
    
    // Determine execution order
    if (options.enableParallelExecution) {
      // Group by order value for parallel execution
      const groups = new Map<number, string[]>();
      splitSessions.forEach(session => {
        const orderValue = session.splitIndex;
        if (!groups.has(orderValue)) {
          groups.set(orderValue, []);
        }
        groups.get(orderValue)!.push(session.id);
      });
      
      // Flatten groups into order
      Array.from(groups.keys()).sort((a, b) => a - b).forEach(key => {
        order.push(...groups.get(key)!);
      });
      
      notes.push('Parallel execution enabled - sessions with same priority can run concurrently');
    } else {
      // Sequential execution based on dependencies
      const processed = new Set<string>();
      
      while (processed.size < splitSessions.length) {
        for (const session of splitSessions) {
          if (!processed.has(session.id)) {
            const depsReady = session.dependencies.every(dep => processed.has(dep));
            if (depsReady) {
              order.push(session.id);
              processed.add(session.id);
            }
          }
        }
      }
      
      notes.push('Sequential execution - sessions run one after another');
    }
    
    // Estimate total duration
    const estimatedDuration = splitSessions.reduce(
      (total, session) => total + (session.estimatedComplexity * 0.5 + 10),
      0
    );
    
    // Add optimization notes
    if (options.preserveLogicalGrouping) {
      notes.push('Logical grouping preserved - related objectives kept together');
    }
    
    if (options.maxComplexityPerSplit < 40) {
      notes.push('Conservative complexity limits applied for reliability');
    }
    
    return { order, dependencies, estimatedDuration, notes };
  }

  /**
   * Parse objectives from content
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
    
    // If no structured list found, try to identify sentences with action verbs
    if (objectives.length === 0) {
      const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10);
      const actionVerbs = ['create', 'build', 'implement', 'add', 'update', 'fix', 'enhance', 'integrate'];
      
      sentences.forEach(sentence => {
        if (actionVerbs.some(verb => sentence.toLowerCase().includes(verb))) {
          objectives.push(sentence.trim());
        }
      });
    }
    
    return objectives;
  }

  /**
   * Merge split results back into parent session
   */
  async mergeSplitResults(
    parentSessionId: string,
    splitResults: Array<{sessionId: string; result: any}>
  ): Promise<{
    mergedResult: any;
    summary: string;
    allObjectivesCompleted: boolean;
  }> {
    const mergedDeliverables: any[] = [];
    const mergedLogs: string[] = [];
    const mergedErrors: string[] = [];
    let totalDuration = 0;
    let totalTasksCompleted = 0;
    let totalTasksFailed = 0;
    
    // Aggregate results from all splits
    splitResults.forEach(({ result }) => {
      if (result.deliverables) {
        mergedDeliverables.push(...result.deliverables);
      }
      if (result.logs) {
        mergedLogs.push(...result.logs);
      }
      if (result.errors) {
        mergedErrors.push(...result.errors);
      }
      if (result.metrics) {
        totalDuration += result.metrics.duration || 0;
        totalTasksCompleted += result.metrics.tasksCompleted || 0;
        totalTasksFailed += result.metrics.tasksFailed || 0;
      }
    });
    
    const allObjectivesCompleted = totalTasksFailed === 0 && splitResults.length > 0;
    
    const mergedResult = {
      sessionId: parentSessionId,
      status: allObjectivesCompleted ? 'success' : 'partial',
      deliverables: mergedDeliverables,
      logs: mergedLogs,
      errors: mergedErrors,
      metrics: {
        duration: totalDuration,
        tasksCompleted: totalTasksCompleted,
        tasksFailed: totalTasksFailed,
        splitsCompleted: splitResults.length
      }
    };
    
    const summary = `Completed ${splitResults.length} split sessions. ` +
                   `Total tasks: ${totalTasksCompleted + totalTasksFailed} ` +
                   `(${totalTasksCompleted} completed, ${totalTasksFailed} failed). ` +
                   `Total duration: ${Math.round(totalDuration / 60)} minutes.`;
    
    return {
      mergedResult,
      summary,
      allObjectivesCompleted
    };
  }
}