/**
 * @actor system
 * @responsibility Apply learnings across all user projects
 * @dependencies CodingStyleLearner, PatternLibrary, SessionMetricsTracker
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { CodingStyleLearner, StylePreference } from './CodingStyleLearner';
import { PatternLibrary, CodePattern } from './PatternLibrary';
import { SessionMetricsTracker } from './SessionMetricsTracker';
import { ProjectPatternTemplates, ProjectAnalysis } from './ProjectPatternTemplates';
export interface ProjectKnowledge {
  projectPath: string;
  projectType: string;
  lastAnalyzed: Date;
  patterns: string[]; // Pattern IDs
  stylePrefences: StylePreference[];
  metrics: {
    sessionCount: number;
    successRate: number;
    avgDuration: number;
    commonErrors: string[];
  };
  dependencies: string[];
  technicalDebt: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}
export interface CrossProjectInsight {
  type: 'pattern' | 'antipattern' | 'optimization' | 'warning';
  title: string;
  description: string;
  affectedProjects: string[];
  recommendation: string;
  confidence: number;
  examples?: Array<{
    project: string;
    code?: string;
    result?: string;
  }>;
}
export interface LearningTransfer {
  fromProject: string;
  toProject: string;
  patterns: CodePattern[];
  styles: StylePreference[];
  recommendations: string[];
}
export class CrossProjectIntelligence extends EventEmitter {
  private logger: Logger;
  private stylelearner: CodingStyleLearner;
  private patternLibrary: PatternLibrary;
  private metricsTracker: SessionMetricsTracker;
  private projectTemplates: ProjectPatternTemplates;
  private projectKnowledge: Map<string, ProjectKnowledge>;
  private globalInsights: CrossProjectInsight[];
  private knowledgePath: string;
  constructor(
    stylelearner: CodingStyleLearner,
    patternLibrary: PatternLibrary,
    metricsTracker: SessionMetricsTracker,
    projectTemplates: ProjectPatternTemplates
  ) {
    super();
    this.logger = new Logger('CrossProjectIntelligence');
    this.stylelearner = stylelearner;
    this.patternLibrary = patternLibrary;
    this.metricsTracker = metricsTracker;
    this.projectTemplates = projectTemplates;
    this.projectKnowledge = new Map();
    this.globalInsights = [];
    this.knowledgePath = path.join(process.env['HOME'] || '' || '', '.sessionhub', 'cross-project');
  }
  async initialize(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadKnowledge();
    await this.analyzeGlobalPatterns();
  }
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.knowledgePath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create knowledge directory', error as Error);
    }
  }
  private async loadKnowledge(): Promise<void> {
    try {
      const knowledgeFile = path.join(this.knowledgePath, 'project-knowledge.json');
      if (await this.fileExists(knowledgeFile)) {
        const data = await fs.readFile(knowledgeFile, 'utf-8');
        const parsed = JSON.parse(data);
        for (const knowledge of parsed.projects || []) {
          this.projectKnowledge.set(knowledge.projectPath, knowledge);
        }
        this.globalInsights = parsed.insights || [];
        this.logger.info(`Loaded knowledge for ${this.projectKnowledge.size} projects`);
      }
    } catch (error) {
      this.logger.error('Failed to load knowledge', error as Error);
    }
  }
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  async analyzeProject(projectPath: string): Promise<ProjectKnowledge> {
    try {
      // Get project analysis
      const analysis = await this.projectTemplates.analyzeProject(projectPath);
      // Get session metrics for this project
      const allMetrics = await this.metricsTracker.getAllMetrics();
      const projectMetrics = allMetrics.filter(m => 
        m.sessionId.includes(path.basename(projectPath))
      );
      // Calculate metrics
      const successfulSessions = projectMetrics.filter(m => m.status === 'completed').length;
      const totalSessions = projectMetrics.length;
      const successRate = totalSessions > 0 ? successfulSessions / totalSessions : 0;
      const durations = projectMetrics
        .map(m => m.duration)
        .filter((d): d is number => d !== undefined);
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
      // Collect common errors
      const errorMap = new Map<string, number>();
      for (const metric of projectMetrics) {
        for (const error of metric.errors) {
          errorMap.set(error.type, (errorMap.get(error.type) || 0) + 1);
        }
      }
      const commonErrors = Array.from(errorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error]) => error);
      // Get project dependencies
      const dependencies = await this.getProjectDependencies(projectPath);
      // Detect technical debt
      const technicalDebt = await this.detectTechnicalDebt(projectPath, analysis);
      // Get used patterns
      const patterns = await this.getProjectPatterns(projectPath);
      // Get style preferences
      const stylePrefs = await this.stylelearner.getStyleSuggestions(projectPath);
      const knowledge: ProjectKnowledge = {
        projectPath,
        projectType: analysis.detectedType,
        lastAnalyzed: new Date(),
        patterns,
        stylePrefences: stylePrefs,
        metrics: {
          sessionCount: totalSessions,
          successRate,
          avgDuration,
          commonErrors
        },
        dependencies,
        technicalDebt
      };
      // Store knowledge
      this.projectKnowledge.set(projectPath, knowledge);
      await this.saveKnowledge();
      this.emit('project-analyzed', knowledge);
      return knowledge;
    } catch (error) {
      this.logger.error('Failed to analyze project', error as Error);
      throw error;
    }
  }
  private async getProjectDependencies(projectPath: string): Promise<string[]> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        return Object.keys({
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        });
      }
    } catch (error) {
      this.logger.warn('Failed to read package.json', error as Error);
    }
    return [];
  }
  private async detectTechnicalDebt(
    projectPath: string,
    analysis: ProjectAnalysis
  ): Promise<ProjectKnowledge['technicalDebt']> {
    const debt: ProjectKnowledge['technicalDebt'] = [];
    // Check for missing elements
    if (analysis.missingElements.length > 5) {
      debt.push({
        type: 'structure',
        severity: 'medium',
        description: `Missing ${analysis.missingElements.length} recommended project elements`
      });
    }
    // Check for outdated patterns
    const patterns = await this.getProjectPatterns(projectPath);
    for (const patternId of patterns) {
      const pattern = await this.patternLibrary.searchPatterns({ searchText: patternId });
      const firstPattern = pattern[0];
      if (firstPattern && firstPattern.pattern.usage.successRate < 0.7) {
        debt.push({
          type: 'pattern',
          severity: 'low',
          description: `Pattern "${firstPattern.pattern.name}" has low success rate`
        });
      }
    }
    // Check for common errors
    const knowledge = this.projectKnowledge.get(projectPath);
    if (knowledge && knowledge.metrics.commonErrors.length > 3) {
      debt.push({
        type: 'quality',
        severity: 'high',
        description: `Recurring errors: ${knowledge.metrics.commonErrors.slice(0, 3).join(', ')}`
      });
    }
    return debt;
  }
  private async getProjectPatterns(projectPath: string): Promise<string[]> {
    // This would integrate with the pattern library to find patterns used in this project
    const allPatterns = await this.patternLibrary.searchPatterns({});
    return allPatterns
      .filter(match => match.pattern.usage.projects.includes(projectPath))
      .map(match => match.pattern.id);
  }
  async findSimilarProjects(projectPath: string): Promise<Array<{
    project: ProjectKnowledge;
    similarity: number;
    sharedPatterns: string[];
    sharedDependencies: string[];
  }>> {
    const targetKnowledge = await this.getOrAnalyzeProject(projectPath);
    const similar: Array<{
      project: ProjectKnowledge;
      similarity: number;
      sharedPatterns: string[];
      sharedDependencies: string[];
    }> = [];
    for (const [otherPath, otherKnowledge] of this.projectKnowledge) {
      if (otherPath === projectPath) continue;
      // Calculate similarity
      const sharedPatterns = targetKnowledge.patterns.filter(p => 
        otherKnowledge.patterns.includes(p)
      );
      const sharedDependencies = targetKnowledge.dependencies.filter(d => 
        otherKnowledge.dependencies.includes(d)
      );
      let similarity = 0;
      // Project type similarity
      if (targetKnowledge.projectType === otherKnowledge.projectType) {
        similarity += 0.3;
      }
      // Pattern similarity
      const patternSimilarity = targetKnowledge.patterns.length > 0
        ? sharedPatterns.length / targetKnowledge.patterns.length
        : 0;
      similarity += patternSimilarity * 0.3;
      // Dependency similarity
      const depSimilarity = targetKnowledge.dependencies.length > 0
        ? sharedDependencies.length / targetKnowledge.dependencies.length
        : 0;
      similarity += depSimilarity * 0.2;
      // Success rate similarity
      const successDiff = Math.abs(
        targetKnowledge.metrics.successRate - otherKnowledge.metrics.successRate
      );
      similarity += (1 - successDiff) * 0.2;
      if (similarity > 0.3) {
        similar.push({
          project: otherKnowledge,
          similarity,
          sharedPatterns,
          sharedDependencies
        });
      }
    }
    // Sort by similarity
    similar.sort((a, b) => b.similarity - a.similarity);
    return similar;
  }
  private async getOrAnalyzeProject(projectPath: string): Promise<ProjectKnowledge> {
    let knowledge = this.projectKnowledge.get(projectPath);
    if (!knowledge || this.isStale(knowledge.lastAnalyzed)) {
      knowledge = await this.analyzeProject(projectPath);
    }
    return knowledge;
  }
  private isStale(date: Date): boolean {
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7; // Re-analyze after a week
  }
  async transferLearning(
    fromProject: string,
    toProject: string
  ): Promise<LearningTransfer> {
    const fromKnowledge = await this.getOrAnalyzeProject(fromProject);
    const toKnowledge = await this.getOrAnalyzeProject(toProject);
    // Find applicable patterns
    const applicablePatterns: CodePattern[] = [];
    for (const patternId of fromKnowledge.patterns) {
      const matches = await this.patternLibrary.searchPatterns({ searchText: patternId });
      const firstMatch = matches[0];
      if (firstMatch) {
        const pattern = firstMatch.pattern;
        // Check if pattern is applicable to target project type
        if (this.isPatternApplicable(pattern, toKnowledge)) {
          applicablePatterns.push(pattern);
        }
      }
    }
    // Find applicable styles
    const applicableStyles = fromKnowledge.stylePrefences.filter(style => 
      style.confidence > 0.8 && !this.hasConflictingStyle(style, toKnowledge)
    );
    // Generate recommendations
    const recommendations: string[] = [];
    if (fromKnowledge.metrics.successRate > toKnowledge.metrics.successRate) {
      recommendations.push(
        `Consider adopting practices from ${path.basename(fromProject)} which has ${
          (fromKnowledge.metrics.successRate * 100).toFixed(1)
        }% success rate`
      );
    }
    // Recommend fixing common issues
    const sharedErrors = fromKnowledge.metrics.commonErrors.filter(e => 
      !toKnowledge.metrics.commonErrors.includes(e)
    );
    if (sharedErrors.length > 0) {
      recommendations.push(
        `${path.basename(fromProject)} solved these issues: ${sharedErrors.join(', ')}`
      );
    }
    const transfer: LearningTransfer = {
      fromProject,
      toProject,
      patterns: applicablePatterns,
      styles: applicableStyles,
      recommendations
    };
    this.emit('learning-transferred', transfer);
    return transfer;
  }
  private isPatternApplicable(pattern: CodePattern, project: ProjectKnowledge): boolean {
    // Check language compatibility
    if (pattern._language !== 'generic' && pattern._language !== project.projectType) {
      return false;
    }
    // Check dependency requirements
    if (pattern.metadata.dependencies) {
      const hasAllDeps = pattern.metadata.dependencies.every(dep => 
        project.dependencies.includes(dep)
      );
      if (!hasAllDeps) return false;
    }
    // Check success rate in similar projects
    const similarProjects = pattern.usage.projects.filter(p => {
      const knowledge = this.projectKnowledge.get(p);
      return knowledge && knowledge.projectType === project.projectType;
    });
    if (similarProjects.length > 0 && pattern.usage.successRate < 0.7) {
      return false;
    }
    return true;
  }
  private hasConflictingStyle(style: StylePreference, project: ProjectKnowledge): boolean {
    const existingStyle = project.stylePrefences.find(s => s.rule === style.rule);
    return existingStyle ? existingStyle.value !== style.value : false;
  }
  async analyzeGlobalPatterns(): Promise<void> {
    const insights: CrossProjectInsight[] = [];
    // Analyze successful patterns across projects
    const allPatterns = await this.patternLibrary.searchPatterns({});
    for (const match of allPatterns) {
      const pattern = match.pattern;
      if (pattern.usage.count > 10 && pattern.usage.successRate > 0.9) {
        insights!.push({
          type: 'pattern',
          title: `Highly successful pattern: ${pattern.name}`,
          description: `Used ${pattern.usage.count} times with ${
            (pattern.usage.successRate * 100).toFixed(1)
          }% success rate`,
          affectedProjects: pattern.usage.projects,
          recommendation: `Consider using this pattern in similar contexts`,
          confidence: pattern.usage.successRate
        });
      } else if (pattern.usage.count > 5 && pattern.usage.successRate < 0.5) {
        insights!.push({
          type: 'antipattern',
          title: `Problematic pattern: ${pattern.name}`,
          description: `Low success rate (${
            (pattern.usage.successRate * 100).toFixed(1)
          }%) across ${pattern.usage.count} uses`,
          affectedProjects: pattern.usage.projects,
          recommendation: `Avoid this pattern or refactor existing usage`,
          confidence: 1 - pattern.usage.successRate
        });
      }
    }
    // Analyze common errors across projects
    const errorFrequency = new Map<string, Set<string>>();
    for (const [projectPath, knowledge] of this.projectKnowledge) {
      for (const error of knowledge.metrics.commonErrors) {
        if (!errorFrequency.has(error)) {
          errorFrequency.set(error, new Set());
        }
        errorFrequency.get(error)!.add(projectPath);
      }
    }
    for (const [error, projects] of errorFrequency) {
      if (projects.size > 2) {
        insights!.push({
          type: 'warning',
          title: `Common error across projects: ${error}`,
          description: `This error appears in ${projects.size} projects`,
          affectedProjects: Array.from(projects),
          recommendation: `Create a shared solution or pattern to address this issue`,
          confidence: projects.size / this.projectKnowledge.size
        });
      }
    }
    // Analyze optimization opportunities
    const avgDurations = new Map<string, number[]>();
    for (const knowledge of this.projectKnowledge.values()) {
      if (!avgDurations.has(knowledge.projectType)) {
        avgDurations.set(knowledge.projectType, []);
      }
      avgDurations.get(knowledge.projectType)!.push(knowledge.metrics.avgDuration);
    }
    for (const [projectType, durations] of avgDurations) {
      if (durations.length > 2) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const fast = Math.min(...durations);
        if (avg > fast * 1.5) {
          const slowProjects = Array.from(this.projectKnowledge.entries())
            .filter(([_, k]) => 
              k.projectType === projectType && k.metrics.avgDuration > avg
            )
            .map(([path]) => path);
          insights!.push({
            type: 'optimization',
            title: `Performance optimization opportunity for ${projectType} projects`,
            description: `Average duration is ${(avg / 1000 / 60).toFixed(1)} minutes, but fastest is ${
              (fast / 1000 / 60).toFixed(1)} minutes`,
            affectedProjects: slowProjects,
            recommendation: `Study the fastest project's patterns and apply optimizations`,
            confidence: 0.8
          });
        }
      }
    }
    this.globalInsights = insights;
    await this.saveKnowledge();
    this.emit('global-insights-updated', insights);
  }
  async getInsights(projectPath?: string): Promise<CrossProjectInsight[]> {
    if (projectPath) {
      // Filter insights relevant to this project
      return this.globalInsights.filter(insight => 
        insight.affectedProjects.includes(projectPath)
      );
    }
    return this.globalInsights;
  }
  private async saveKnowledge(): Promise<void> {
    try {
      const data = {
        projects: Array.from(this.projectKnowledge.values()),
        insights: this.globalInsights,
        lastUpdated: new Date().toISOString()
      };
      const knowledgeFile = path.join(this.knowledgePath, 'project-knowledge.json');
      await fs.writeFile(knowledgeFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save knowledge', error as Error);
    }
  }
  async generateRecommendations(projectPath: string): Promise<string[]> {
    const recommendations: string[] = [];
    const knowledge = await this.getOrAnalyzeProject(projectPath);
    // Find similar successful projects
    const similar = await this.findSimilarProjects(projectPath);
    for (const sim of similar.slice(0, 3)) {
      if (sim.project.metrics.successRate > knowledge.metrics.successRate + 0.2) {
        recommendations.push(
          `Study ${path.basename(sim.project.projectPath)} - similar project with better success rate`
        );
      }
    }
    // Check for applicable patterns
    const successfulPatterns = await this.patternLibrary.searchPatterns({
      minSuccessRate: 0.9,
      category: knowledge.projectType as any
    });
    for (const match of successfulPatterns.slice(0, 3)) {
      if (!knowledge.patterns.includes(match.pattern.id)) {
        recommendations.push(
          `Consider using pattern: ${match.pattern.name} (${
            (match.pattern.usage.successRate * 100).toFixed(0)
          }% success rate)`
        );
      }
    }
    // Technical debt recommendations
    const highPriorityDebt = knowledge.technicalDebt.filter(d => d.severity === 'high');
    for (const debt of highPriorityDebt) {
      recommendations.push(`Address technical debt: ${debt.description}`);
    }
    return recommendations;
  }
  getProjectSummary(): {
    totalProjects: number;
    avgSuccessRate: number;
    commonPatterns: string[];
    commonIssues: string[];
  } {
    const projects = Array.from(this.projectKnowledge.values());
    const avgSuccessRate = projects.length > 0
      ? projects.reduce((sum, p) => sum + p.metrics.successRate, 0) / projects.length
      : 0;
    // Find most common patterns
    const patternCount = new Map<string, number>();
    for (const project of projects) {
      for (const pattern of project.patterns) {
        patternCount.set(pattern, (patternCount.get(pattern) || 0) + 1);
      }
    }
    const commonPatterns = Array.from(patternCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
    // Find most common issues
    const issueCount = new Map<string, number>();
    for (const project of projects) {
      for (const error of project.metrics.commonErrors) {
        issueCount.set(error, (issueCount.get(error) || 0) + 1);
      }
    }
    const commonIssues = Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
    return {
      totalProjects: projects.length,
      avgSuccessRate,
      commonPatterns,
      commonIssues
    };
  }
}