/**
 * @actor system
 * @responsibility Provide context-aware suggestions during session planning
 * @dependencies Database, CodingStyleLearner, ProjectPatternTemplates
 */
import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';
import { CodingStyleLearner } from './CodingStyleLearner';
import { ProjectPatternTemplates } from './ProjectPatternTemplates';
export interface AutocompleteSuggestion {
  text: string;
  type: 'command' | 'file' | 'function' | 'pattern' | 'template';
  confidence: number;
  description?: string;
  metadata?: any;
}
export interface AutocompleteContext {
  currentInput: string;
  cursorPosition: number;
  sessionType?: string;
  projectPath?: string;
  recentCommands?: string[];
  fileContext?: string;
}
interface CommandHistory {
  command: string;
  frequency: number;
  lastUsed: Date;
  context: string;
  success: boolean;
}
export class SmartAutocomplete extends EventEmitter {
  private logger: Logger;
  private stylelearner: CodingStyleLearner;
  private patternTemplates: ProjectPatternTemplates;
  private commandHistory: Map<string, CommandHistory>;
  private suggestionCache: Map<string, AutocompleteSuggestion[]>;
  private commonPatterns: Map<string, string[]>;
  constructor(
    stylelearner: CodingStyleLearner,
    patternTemplates: ProjectPatternTemplates
  ) {
    super();
    this.logger = new Logger('SmartAutocomplete');
    this.stylelearner = stylelearner;
    this.patternTemplates = patternTemplates;
    this.commandHistory = new Map();
    this.suggestionCache = new Map();
    this.commonPatterns = new Map();
    this.initializeCommonPatterns();
  }
  private initializeCommonPatterns(): void {
    // Common session commands
    this.commonPatterns.set('session', [
      'create new session',
      'complete session',
      'validate session',
      'run quality gates',
      'update Foundation.md',
      'commit changes'
    ]);
    // Common file operations
    this.commonPatterns.set('file', [
      'create component',
      'update imports',
      'add tests',
      'refactor function',
      'fix TypeScript errors',
      'add documentation'
    ]);
    // Common project operations
    this.commonPatterns.set('project', [
      'initialize project',
      'add dependency',
      'update configuration',
      'run build',
      'deploy to production',
      'setup CI/CD'
    ]);
    // Common debugging operations
    this.commonPatterns.set('debug', [
      'check logs',
      'inspect error',
      'add breakpoint',
      'trace execution',
      'profile performance',
      'memory analysis'
    ]);
  }
  async getSuggestions(_context: AutocompleteContext): Promise<AutocompleteSuggestion[]> {
    try {
      const cacheKey = this.getCacheKey(_context);
      // Check cache first
      if (this.suggestionCache.has(cacheKey)) {
        return this.suggestionCache.get(cacheKey)!;
      }
      const suggestions: AutocompleteSuggestion[] = [];
      // Get different types of suggestions
      const [
        commandSuggestions,
        patternSuggestions,
        fileSuggestions,
        templateSuggestions
      ] = await Promise.all([
        this.getCommandSuggestions(_context),
        this.getPatternSuggestions(_context),
        this.getFileSuggestions(_context),
        this.getTemplateSuggestions(_context)
      ]);
      suggestions.push(
        ...commandSuggestions,
        ...patternSuggestions,
        ...fileSuggestions,
        ...templateSuggestions
      );
      // Sort by confidence and relevance
      const sorted = this.rankSuggestions(suggestions, _context);
      // Cache results
      this.suggestionCache.set(cacheKey, sorted);
      // Clear cache after 5 minutes
      setTimeout(() => {
        this.suggestionCache.delete(cacheKey);
      }, 5 * 60 * 1000);
      return sorted.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      this.logger.error('Failed to get suggestions', error as Error);
      return [];
    }
  }
  private async getCommandSuggestions(
    _context: AutocompleteContext
  ): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    const input = _context.currentInput.toLowerCase();
    // Check command history
    for (const [command, history] of this.commandHistory) {
      if (command.toLowerCase().includes(input)) {
        suggestions.push({
          text: command,
          type: 'command',
          confidence: this.calculateConfidence(history),
          description: `Used ${history.frequency} times, last: ${history.lastUsed.toLocaleDateString()}`
        });
      }
    }
    // Check common patterns
    for (const [category, patterns] of this.commonPatterns) {
      for (const pattern of patterns) {
        if (pattern.toLowerCase().includes(input)) {
          suggestions.push({
            text: pattern,
            type: 'command',
            confidence: 0.7,
            description: `Common ${category} operation`,
            metadata: { category }
          });
        }
      }
    }
    // Context-aware suggestions
    if (input.includes('fix')) {
      suggestions.push(
        {
          text: 'fix TypeScript errors',
          type: 'command',
          confidence: 0.9,
          description: 'Run TypeScript compiler and fix errors'
        },
        {
          text: 'fix ESLint violations',
          type: 'command',
          confidence: 0.85,
          description: 'Run ESLint and fix violations'
        }
      );
    }
    if (input.includes('test')) {
      suggestions.push(
        {
          text: 'run tests',
          type: 'command',
          confidence: 0.9,
          description: 'Execute test suite'
        },
        {
          text: 'add test coverage',
          type: 'command',
          confidence: 0.8,
          description: 'Add tests for uncovered code'
        }
      );
    }
    return suggestions;
  }
  private async getPatternSuggestions(
    _context: AutocompleteContext
  ): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    if (!_context.fileContext) return suggestions;
    // Get coding style suggestions
    const stylePrefs = await this.stylelearner.getStyleSuggestions(_context.fileContext);
    for (const pref of stylePrefs) {
      suggestions.push({
        text: `Apply ${pref.rule}: ${pref.value}`,
        type: 'pattern',
        confidence: pref.confidence,
        description: `Based on ${pref.examples.length} examples`,
        metadata: { preference: pref }
      });
    }
    // Get pattern suggestions based on file type
    const fileExt = _context.fileContext.split('.').pop();
    if (fileExt === 'tsx' || fileExt === 'jsx') {
      suggestions.push(
        {
          text: 'Create React component',
          type: 'pattern',
          confidence: 0.8,
          description: 'Generate component boilerplate'
        },
        {
          text: 'Add custom hook',
          type: 'pattern',
          confidence: 0.75,
          description: 'Create reusable hook'
        }
      );
    }
    return suggestions;
  }
  private async getFileSuggestions(
    _context: AutocompleteContext
  ): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    if (!_context.projectPath) return suggestions;
    const input = _context.currentInput.toLowerCase();
    // Suggest file operations based on input
    if (input.includes('create')) {
      const analysis = await this.patternTemplates.analyzeProject(_context.projectPath);
      if (analysis.detectedType === 'nextjs') {
        suggestions.push(
          {
            text: 'create page component',
            type: 'file',
            confidence: 0.85,
            description: 'Create new Next.js page'
          },
          {
            text: 'create API route',
            type: 'file',
            confidence: 0.8,
            description: 'Create new API endpoint'
          }
        );
      } else if (analysis.detectedType === 'electron') {
        suggestions.push(
          {
            text: 'create IPC handler',
            type: 'file',
            confidence: 0.85,
            description: 'Create new IPC handler'
          },
          {
            text: 'create renderer component',
            type: 'file',
            confidence: 0.8,
            description: 'Create new renderer component'
          }
        );
      }
    }
    return suggestions;
  }
  private async getTemplateSuggestions(
    _context: AutocompleteContext
  ): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    if (!_context.projectPath) return suggestions;
    const analysis = await this.patternTemplates.analyzeProject(_context.projectPath);
    if (analysis.missingElements.length > 0) {
      suggestions.push({
        text: `Complete ${analysis.detectedType} structure`,
        type: 'template',
        confidence: 0.9,
        description: `Missing ${analysis.missingElements.length} elements`,
        metadata: { analysis }
      });
    }
    // Suggest based on detected type
    for (const recommendation of analysis.suggestedStructure.recommendations) {
      if (recommendation.toLowerCase().includes(_context.currentInput.toLowerCase())) {
        suggestions.push({
          text: recommendation,
          type: 'template',
          confidence: 0.75,
          description: `${analysis.detectedType} best practice`,
          metadata: { projectType: analysis.detectedType }
        });
      }
    }
    return suggestions;
  }
  private calculateConfidence(history: CommandHistory): number {
    const recencyScore = this.getRecencyScore(history.lastUsed);
    const frequencyScore = Math.min(history.frequency / 10, 1);
    const successScore = history.success ? 1 : 0.5;
    return (recencyScore + frequencyScore + successScore) / 3;
  }
  private getRecencyScore(date: Date): number {
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) return 1;
    if (daysSince < 7) return 0.8;
    if (daysSince < 30) return 0.6;
    return 0.4;
  }
  private rankSuggestions(
    suggestions: AutocompleteSuggestion[],
    _context: AutocompleteContext
  ): AutocompleteSuggestion[] {
    return suggestions.sort((a, b) => {
      // Prioritize by type relevance
      const typeWeight = this.getTypeWeight(a.type, _context);
      const aScore = a.confidence * typeWeight;
      const bScore = b.confidence * typeWeight;
      return bScore - aScore;
    });
  }
  private getTypeWeight(type: string, _context: AutocompleteContext): number {
    // Adjust weights based on context
    if (_context.sessionType === 'planning' && type === 'template') return 1.2;
    if (_context.sessionType === 'execution' && type === 'command') return 1.2;
    if (_context.fileContext && type === 'pattern') return 1.1;
    return 1.0;
  }
  private getCacheKey(_context: AutocompleteContext): string {
    return `${_context.currentInput}-${_context.sessionType}-${_context.projectPath}`;
  }
  async recordCommand(
    command: string,
    context: string,
    success: boolean
  ): Promise<void> {
    const existing = this.commandHistory.get(command);
    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date();
      existing.success = success;
    } else {
      this.commandHistory.set(command, {
        command,
        frequency: 1,
        lastUsed: new Date(),
        context,
        success
      });
    }
    this.emit('command-recorded', { command, success });
  }
  async applySuggestion(
    suggestion: AutocompleteSuggestion,
    _context: AutocompleteContext
  ): Promise<string> {
    switch (suggestion.type) {
      case 'command':
        return suggestion.text;
      case 'pattern':
        if (suggestion.metadata?.preference) {
          const pref = suggestion.metadata.preference;
          return `Apply ${pref.rule} with value ${pref.value}`;
        }
        return suggestion.text;
      case 'template':
        if (suggestion.metadata?.analysis) {
          return `Generate ${suggestion.metadata.analysis.detectedType} structure`;
        }
        return suggestion.text;
      default:
        return suggestion.text;
    }
  }
  clearCache(): void {
    this.suggestionCache.clear();
  }
}