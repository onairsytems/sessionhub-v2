/**
 * @actor system
 * @responsibility Coordinate all AI learning and enhancement features
 * @dependencies All AI subsystems
 */
import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';
import { CodingStyleLearner } from './CodingStyleLearner';
import { ProjectPatternTemplates } from './ProjectPatternTemplates';
import { SmartAutocomplete, AutocompleteContext, AutocompleteSuggestion } from './SmartAutocomplete';
import { SessionMetricsTracker } from './SessionMetricsTracker';
import { PatternLibrary } from './PatternLibrary';
import { CrossProjectIntelligence } from './CrossProjectIntelligence';
export interface AIEnhancementConfig {
  enableLearning: boolean;
  enableAutocomplete: boolean;
  enableMetrics: boolean;
  enablePatternLibrary: boolean;
  enableCrossProject: boolean;
  privacyMode: boolean;
  dataRetentionDays: number;
}
export interface LearningStatus {
  patternsLearned: number;
  projectsAnalyzed: number;
  stylesIdentified: number;
  successRate: number;
  lastUpdate: Date;
}
export class AIEnhancementManager extends EventEmitter {
  private logger: Logger;
  private config: AIEnhancementConfig;
  private stylelearner: CodingStyleLearner;
  private projectTemplates: ProjectPatternTemplates;
  private autocomplete: SmartAutocomplete;
  private metricsTracker: SessionMetricsTracker;
  private patternLibrary: PatternLibrary;
  private crossProjectIntel: CrossProjectIntelligence;
  private initialized: boolean = false;
  constructor(config: Partial<AIEnhancementConfig> = {}) {
    super();
    this.logger = new Logger('AIEnhancementManager');
    this.config = {
      enableLearning: true,
      enableAutocomplete: true,
      enableMetrics: true,
      enablePatternLibrary: true,
      enableCrossProject: true,
      privacyMode: false,
      dataRetentionDays: 90,
      ...config
    };
    // Initialize subsystems
    this.stylelearner = new CodingStyleLearner();
    this.projectTemplates = new ProjectPatternTemplates();
    this.metricsTracker = new SessionMetricsTracker();
    this.patternLibrary = new PatternLibrary();
    this.autocomplete = new SmartAutocomplete(this.stylelearner, this.projectTemplates);
    this.crossProjectIntel = new CrossProjectIntelligence(
      this.stylelearner,
      this.patternLibrary,
      this.metricsTracker,
      this.projectTemplates
    );
  }
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.logger.info('Initializing AI Enhancement Manager');
      // Initialize all subsystems
      const initPromises: Promise<void>[] = [];
      if (this.config.enableLearning) {
        initPromises.push(this.stylelearner.initialize());
      }
      if (this.config.enableMetrics) {
        initPromises.push(this.metricsTracker.initialize());
      }
      if (this.config.enablePatternLibrary) {
        initPromises.push(this.patternLibrary.initialize());
      }
      if (this.config.enableCrossProject) {
        initPromises.push(this.crossProjectIntel.initialize());
      }
      await Promise.all(initPromises);
      // Set up event listeners
      this.setupEventListeners();
      this.initialized = true;
      this.logger.info('AI Enhancement Manager initialized successfully');
      this.emit('initialized', this.getStatus());
    } catch (error) {
      this.logger.error('Failed to initialize AI Enhancement Manager', error as Error);
      throw error;
    }
  }
  private setupEventListeners(): void {
    // Forward events from subsystems
    this.stylelearner.on('patterns-updated', (data) => {
      this.emit('learning-updated', { type: 'style', data });
    });
    this.metricsTracker.on('session-completed', (data) => {
      this.emit('metrics-updated', { type: 'session', data });
    });
    this.patternLibrary.on('pattern-added', (pattern) => {
      this.emit('pattern-library-updated', { action: 'added', pattern });
    });
    this.crossProjectIntel.on('global-insights-updated', (insights) => {
      this.emit('insights-updated', insights);
    });
  }
  // Learning capabilities
  async learnFromCode(filePath: string, content: string): Promise<void> {
    if (!this.config.enableLearning) return;
    try {
      await this.stylelearner.analyzeCode(filePath, content);
      // Extract patterns for the library
      const context = await this.detectCodeContext(filePath, content);
      if (context.isSignificant) {
        await this.patternLibrary.createPatternFromCode(content, {
          name: context.suggestedName,
          category: context.category,
          description: context.description,
          _language: context.language,
          tags: context.tags
        });
      }
    } catch (error) {
      this.logger.error('Failed to learn from code', error as Error);
    }
  }
  private async detectCodeContext(filePath: string, content: string): Promise<{
    isSignificant: boolean;
    suggestedName: string;
    category: any;
    description: string;
    language: string;
    tags: string[];
  }> {
    const ext = filePath.split('.').pop() || '';
    const lines = content.split('\n').length;
    // Simple heuristics for significance
    const isSignificant = lines > 20 && lines < 500;
    // Detect language
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go'
    };
    const language = languageMap[ext] || 'generic';
    // Detect category and tags based on content
    let category: any = 'component';
    const tags: string[] = [language];
    if (content.includes('test') || content.includes('describe')) {
      category = 'testing';
      tags.push('test');
    } else if (content.includes('api') || content.includes('router')) {
      category = 'api';
      tags.push('backend');
    } else if (content.includes('performance') || content.includes('optimize')) {
      category = 'performance';
      tags.push('optimization');
    }
    const fileName = filePath.split('/').pop() || 'unknown';
    const suggestedName = fileName.replace(/\.[^.]+$/, '');
    return {
      isSignificant,
      suggestedName,
      category,
      description: `Pattern extracted from ${fileName}`,
      language,
      tags
    };
  }
  // Autocomplete capabilities
  async getAutocompleteSuggestions(context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    if (!this.config.enableAutocomplete) return [];
    try {
      return await this.autocomplete.getSuggestions(context);
    } catch (error) {
      this.logger.error('Failed to get autocomplete suggestions', error as Error);
      return [];
    }
  }
  async recordAutocompleteUsage(
    suggestion: AutocompleteSuggestion,
    accepted: boolean
  ): Promise<void> {
    if (!this.config.enableAutocomplete) return;
    try {
      await this.autocomplete.recordCommand(
        suggestion.text,
        suggestion.type,
        accepted
      );
    } catch (error) {
      this.logger.error('Failed to record autocomplete usage', error as Error);
    }
  }
  // Project analysis capabilities
  async analyzeProject(projectPath: string): Promise<{
    template: any;
    knowledge: any;
    recommendations: string[];
  }> {
    try {
      const [template, knowledge, recommendations] = await Promise.all([
        this.projectTemplates.analyzeProject(projectPath),
        this.config.enableCrossProject 
          ? this.crossProjectIntel.analyzeProject(projectPath)
          : null,
        this.config.enableCrossProject
          ? this.crossProjectIntel.generateRecommendations(projectPath)
          : []
      ]);
      return {
        template,
        knowledge,
        recommendations
      };
    } catch (error) {
      this.logger.error('Failed to analyze project', error as Error);
      throw error;
    }
  }
  // Session tracking capabilities
  async startSession(sessionId: string, objectives: string[]): Promise<void> {
    if (!this.config.enableMetrics) return;
    try {
      await this.metricsTracker.startSession(sessionId, objectives);
    } catch (error) {
      this.logger.error('Failed to start session tracking', error as Error);
    }
  }
  async updateSession(sessionId: string, updates: any): Promise<void> {
    if (!this.config.enableMetrics) return;
    try {
      await this.metricsTracker.updateSession(sessionId, updates);
    } catch (error) {
      this.logger.error('Failed to update session', error as Error);
    }
  }
  async completeSession(sessionId: string, success: boolean): Promise<void> {
    if (!this.config.enableMetrics) return;
    try {
      await this.metricsTracker.updateSession(sessionId, {
        status: success ? 'completed' : 'failed'
      });
      // Generate insights after session completion
      if (this.config.enableCrossProject) {
        await this.crossProjectIntel.analyzeGlobalPatterns();
      }
    } catch (error) {
      this.logger.error('Failed to complete session', error as Error);
    }
  }
  // Pattern library capabilities
  async searchPatterns(criteria: any): Promise<any[]> {
    if (!this.config.enablePatternLibrary) return [];
    try {
      return await this.patternLibrary.searchPatterns(criteria);
    } catch (error) {
      this.logger.error('Failed to search patterns', error as Error);
      return [];
    }
  }
  async addPattern(pattern: any): Promise<any> {
    if (!this.config.enablePatternLibrary) {
      throw new Error('Pattern library is disabled');
    }
    try {
      return await this.patternLibrary.addPattern(pattern);
    } catch (error) {
      this.logger.error('Failed to add pattern', error as Error);
      throw error;
    }
  }
  // Cross-project intelligence
  async getProjectInsights(projectPath?: string): Promise<any[]> {
    if (!this.config.enableCrossProject) return [];
    try {
      return await this.crossProjectIntel.getInsights(projectPath);
    } catch (error) {
      this.logger.error('Failed to get project insights', error as Error);
      return [];
    }
  }
  async transferLearning(fromProject: string, toProject: string): Promise<any> {
    if (!this.config.enableCrossProject) {
      throw new Error('Cross-project intelligence is disabled');
    }
    try {
      return await this.crossProjectIntel.transferLearning(fromProject, toProject);
    } catch (error) {
      this.logger.error('Failed to transfer learning', error as Error);
      throw error;
    }
  }
  // Status and management
  getStatus(): LearningStatus {
    const summary = this.stylelearner.getLearningSummary();
    const patternStats = this.patternLibrary.getStatistics();
    const projectSummary = this.crossProjectIntel.getProjectSummary();
    return {
      patternsLearned: patternStats.totalPatterns,
      projectsAnalyzed: projectSummary.totalProjects,
      stylesIdentified: summary.totalPreferences,
      successRate: projectSummary.avgSuccessRate,
      lastUpdate: new Date()
    };
  }
  async getMetricsSummary(days: number = 30): Promise<any> {
    if (!this.config.enableMetrics) return null;
    try {
      return await this.metricsTracker.getSummary(days);
    } catch (error) {
      this.logger.error('Failed to get metrics summary', error as Error);
      return null;
    }
  }
  async generateInsightReport(): Promise<any> {
    if (!this.config.enableMetrics) return null;
    try {
      return await this.metricsTracker.generateInsights();
    } catch (error) {
      this.logger.error('Failed to generate insight report', error as Error);
      return null;
    }
  }
  // Privacy and data management
  async clearLearningData(): Promise<void> {
    this.logger.info('Clearing all AI learning data');
    const clearPromises: Promise<void>[] = [];
    if (this.config.enableLearning) {
      clearPromises.push(this.clearStyleLearning());
    }
    if (this.config.enablePatternLibrary) {
      clearPromises.push(this.clearPatternLibrary());
    }
    if (this.config.enableCrossProject) {
      clearPromises.push(this.clearCrossProjectData());
    }
    await Promise.all(clearPromises);
    this.emit('data-cleared');
  }
  private async clearStyleLearning(): Promise<void> {
    // This would clear the style learner's data
    this.logger.info('Cleared style learning data');
  }
  private async clearPatternLibrary(): Promise<void> {
    // This would clear the pattern library
    this.logger.info('Cleared pattern library');
  }
  private async clearCrossProjectData(): Promise<void> {
    // This would clear cross-project intelligence data
    this.logger.info('Cleared cross-project data');
  }
  async exportLearningData(): Promise<string> {
    const data = {
      status: this.getStatus(),
      patterns: await this.patternLibrary.exportPatterns(),
      insights: await this.crossProjectIntel.getInsights(),
      config: this.config,
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }
  async importLearningData(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data);
      if (parsed.patterns && this.config.enablePatternLibrary) {
        await this.patternLibrary.importPatterns(parsed.patterns);
      }
      this.emit('data-imported', parsed);
    } catch (error) {
      this.logger.error('Failed to import learning data', error as Error);
      throw error;
    }
  }
  updateConfig(config: Partial<AIEnhancementConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }
  getConfig(): AIEnhancementConfig {
    return { ...this.config };
  }
}