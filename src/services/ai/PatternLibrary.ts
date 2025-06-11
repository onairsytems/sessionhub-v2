/**
 * @actor system
 * @responsibility Store, categorize, and retrieve successful patterns
 * @dependencies Database, FileSystem
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
export interface CodePattern {
  id: string;
  name: string;
  category: 'architecture' | 'component' | 'api' | 'testing' | 'performance' | 'security' | 'workflow';
  description: string;
  code: string;
  _language: string;
  tags: string[];
  usage: {
    count: number;
    lastUsed: Date;
    projects: string[];
    successRate: number;
  };
  metadata: {
    author?: string;
    created: Date;
    updated: Date;
    version: number;
    dependencies?: string[];
    relatedPatterns?: string[];
  };
  examples: Array<{
    description: string;
    code: string;
    context?: string;
  }>;
  performance?: {
    avgExecutionTime?: number;
    memoryUsage?: number;
    complexity?: string;
  };
}
export interface PatternSearchCriteria {
  category?: string;
  tags?: string[];
  language?: string;
  minSuccessRate?: number;
  searchText?: string;
}
export interface PatternMatch {
  pattern: CodePattern;
  relevance: number;
  reason: string;
}
export class PatternLibrary extends EventEmitter {
  private logger: Logger;
  private patterns: Map<string, CodePattern>;
  private patternIndex: Map<string, Set<string>>; // tag -> pattern IDs
  private libraryPath: string;
  constructor() {
    super();
    this.logger = new Logger('PatternLibrary');
    this.patterns = new Map();
    this.patternIndex = new Map();
    this.libraryPath = path.join(process.env['HOME'] || '' || '', '.sessionhub', 'pattern-library');
  }
  async initialize(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadPatterns();
    await this.buildIndex();
  }
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.libraryPath, { recursive: true });
      await fs.mkdir(path.join(this.libraryPath, 'patterns'), { recursive: true });
      await fs.mkdir(path.join(this.libraryPath, 'examples'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create pattern library directory', error as Error);
    }
  }
  private async loadPatterns(): Promise<void> {
    try {
      const patternsDir = path.join(this.libraryPath, 'patterns');
      const files = await fs.readdir(patternsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(patternsDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const pattern = JSON.parse(data);
          this.patterns.set(pattern.id, pattern);
        }
      }
      this.logger.info(`Loaded ${this.patterns.size} patterns`);
    } catch (error) {
      this.logger.error('Failed to load patterns', error as Error);
    }
  }
  private async buildIndex(): Promise<void> {
    this.patternIndex.clear();
    for (const pattern of this.patterns.values()) {
      // Index by tags
      for (const tag of pattern.tags) {
        if (!this.patternIndex.has(tag)) {
          this.patternIndex.set(tag, new Set());
        }
        this.patternIndex.get(tag)!.add(pattern.id);
      }
      // Index by category
      if (!this.patternIndex.has(pattern.category)) {
        this.patternIndex.set(pattern.category, new Set());
      }
      this.patternIndex.get(pattern.category)!.add(pattern.id);
      // Index by language
      if (!this.patternIndex.has(pattern._language)) {
        this.patternIndex.set(pattern._language, new Set());
      }
      this.patternIndex.get(pattern._language)!.add(pattern.id);
    }
  }
  async addPattern(pattern: Omit<CodePattern, 'id' | 'metadata'>): Promise<CodePattern> {
    const id = this.generateId(pattern.name);
    const now = new Date();
    const newPattern: CodePattern = {
      ...pattern,
      id,
      usage: {
        count: 0,
        lastUsed: now,
        projects: [],
        successRate: 1.0
      },
      metadata: {
        created: now,
        updated: now,
        version: 1
      }
    };
    this.patterns.set(id, newPattern);
    await this.savePattern(newPattern);
    await this.buildIndex();
    this.emit('pattern-added', newPattern);
    return newPattern;
  }
  private generateId(name: string): string {
    const base = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    let id = base;
    let counter = 1;
    while (this.patterns.has(id)) {
      id = `${base}-${counter}`;
      counter++;
    }
    return id;
  }
  async updatePattern(id: string, updates: Partial<CodePattern>): Promise<void> {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      throw new Error(`Pattern ${id} not found`);
    }
    const updatedPattern = {
      ...pattern,
      ...updates,
      metadata: {
        ...pattern.metadata,
        updated: new Date(),
        version: pattern.metadata.version + 1
      }
    };
    this.patterns.set(id, updatedPattern);
    await this.savePattern(updatedPattern);
    await this.buildIndex();
    this.emit('pattern-updated', updatedPattern);
  }
  async recordUsage(
    id: string,
    projectPath: string,
    success: boolean
  ): Promise<void> {
    const pattern = this.patterns.get(id);
    if (!pattern) return;
    pattern.usage.count++;
    pattern.usage.lastUsed = new Date();
    if (!pattern.usage.projects.includes(projectPath)) {
      pattern.usage.projects.push(projectPath);
    }
    // Update success rate with exponential moving average
    const alpha = 0.1; // Smoothing factor
    const currentSuccess = success ? 1 : 0;
    pattern.usage.successRate = alpha * currentSuccess + (1 - alpha) * pattern.usage.successRate;
    await this.savePattern(pattern);
    this.emit('pattern-used', { pattern, projectPath, success });
  }
  async searchPatterns(criteria: PatternSearchCriteria): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];
    let candidateIds = new Set<string>();
    // Start with all patterns if no specific criteria
    if (!criteria.category && !criteria.tags?.length && !criteria.language) {
      candidateIds = new Set(this.patterns.keys());
    } else {
      // Find patterns matching criteria
      if (criteria.category && this.patternIndex.has(criteria.category)) {
        candidateIds = new Set(this.patternIndex.get(criteria.category));
      }
      if (criteria.tags) {
        for (const tag of criteria.tags) {
          const tagPatterns = this.patternIndex.get(tag);
          if (tagPatterns) {
            if (candidateIds.size === 0) {
              candidateIds = new Set(tagPatterns);
            } else {
              // Intersection
              candidateIds = new Set([...candidateIds].filter(id => tagPatterns.has(id)));
            }
          }
        }
      }
      if (criteria.language && this.patternIndex.has(criteria.language)) {
        const langPatterns = this.patternIndex.get(criteria.language);
        if (candidateIds.size === 0) {
          candidateIds = new Set(langPatterns);
        } else {
          candidateIds = new Set([...candidateIds].filter(id => langPatterns?.has(id)));
        }
      }
    }
    // Apply filters and calculate relevance
    for (const id of candidateIds) {
      const pattern = this.patterns.get(id)!;
      // Check success rate filter
      if (criteria.minSuccessRate && pattern.usage.successRate < criteria.minSuccessRate) {
        continue;
      }
      // Calculate relevance
      let relevance = 0;
      const reasons: string[] = [];
      // Base relevance on success rate and usage
      relevance += pattern.usage.successRate * 0.3;
      relevance += Math.min(pattern.usage.count / 100, 1) * 0.2;
      // Text search
      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        if (pattern.name.toLowerCase().includes(searchLower)) {
          relevance += 0.3;
          reasons.push('Name match');
        } else if (pattern.description.toLowerCase().includes(searchLower)) {
          relevance += 0.2;
          reasons.push('Description match');
        } else if (pattern.code.toLowerCase().includes(searchLower)) {
          relevance += 0.1;
          reasons.push('Code match');
        } else {
          continue; // Skip if no text match when searching
        }
      }
      // Recency bonus
      const daysSinceUsed = (Date.now() - pattern.usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUsed < 7) {
        relevance += 0.1;
        reasons.push('Recently used');
      }
      matches.push({
        pattern,
        relevance,
        reason: reasons.join(', ') || 'Criteria match'
      });
    }
    // Sort by relevance
    matches.sort((a, b) => b.relevance - a.relevance);
    return matches;
  }
  async getRelatedPatterns(id: string, limit: number = 5): Promise<CodePattern[]> {
    const pattern = this.patterns.get(id);
    if (!pattern) return [];
    const related: Array<{ pattern: CodePattern; score: number }> = [];
    for (const [otherId, otherPattern] of this.patterns) {
      if (otherId === id) continue;
      let score = 0;
      // Same category
      if (otherPattern.category === pattern.category) {
        score += 0.3;
      }
      // Shared tags
      const sharedTags = pattern.tags.filter(t => otherPattern.tags.includes(t));
      score += sharedTags.length * 0.1;
      // Same language
      if (otherPattern._language === pattern._language) {
        score += 0.2;
      }
      // Explicitly related
      if (pattern.metadata.relatedPatterns?.includes(otherId)) {
        score += 0.5;
      }
      // Used in same projects
      const sharedProjects = pattern.usage.projects.filter(p => 
        otherPattern.usage.projects.includes(p)
      );
      score += sharedProjects.length * 0.05;
      if (score > 0) {
        related.push({ pattern: otherPattern, score });
      }
    }
    // Sort by score and return top matches
    related.sort((a, b) => b.score - a.score);
    return related.slice(0, limit).map(r => r.pattern);
  }
  async createPatternFromCode(
    code: string,
    context: {
      name: string;
      category: CodePattern['category'];
      description: string;
      _language: string;
      tags: string[];
    }
  ): Promise<CodePattern> {
    // Analyze code for patterns
    const analysis = this.analyzeCode(code, context._language);
    const pattern = await this.addPattern({
      name: context.name,
      category: context.category,
      description: context.description,
      code,
      _language: context._language,
      tags: [...context.tags, ...analysis.suggestedTags],
      examples: [{
        description: 'Original implementation',
        code
      }],
      performance: analysis.performance,
      usage: {
        count: 0,
        lastUsed: new Date(),
        projects: [],
        successRate: 1.0
      }
    });
    return pattern;
  }
  private analyzeCode(code: string, _language: string): {
    suggestedTags: string[];
    performance?: CodePattern['performance'];
  } {
    const tags: string[] = [];
    const performance: CodePattern['performance'] = {};
    // Simple analysis based on code content
    if (code.includes('async') || code.includes('await')) {
      tags.push('async');
    }
    if (code.includes('try') && code.includes('catch')) {
      tags.push('error-handling');
    }
    if (code.includes('test') || code.includes('describe') || code.includes('it(')) {
      tags.push('testing');
    }
    if (code.includes('useState') || code.includes('useEffect')) {
      tags.push('react-hooks');
    }
    // Estimate complexity
    const lines = code.split('\n').length;
    if (lines < 20) {
      performance.complexity = 'simple';
    } else if (lines < 50) {
      performance.complexity = 'moderate';
    } else {
      performance.complexity = 'complex';
    }
    return { suggestedTags: tags, performance };
  }
  private async savePattern(pattern: CodePattern): Promise<void> {
    try {
      const filePath = path.join(this.libraryPath, 'patterns', `${pattern.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(pattern, null, 2));
    } catch (error) {
      this.logger.error('Failed to save pattern', error as Error);
    }
  }
  async exportPatterns(category?: string): Promise<string> {
    const patterns = category
      ? Array.from(this.patterns.values()).filter(p => p.category === category)
      : Array.from(this.patterns.values());
    return JSON.stringify(patterns, null, 2);
  }
  async importPatterns(data: string): Promise<number> {
    try {
      const patterns = JSON.parse(data);
      let imported = 0;
      for (const pattern of patterns) {
        if (!this.patterns.has(pattern.id)) {
          this.patterns.set(pattern.id, pattern);
          await this.savePattern(pattern);
          imported++;
        }
      }
      await this.buildIndex();
      return imported;
    } catch (error) {
      this.logger.error('Failed to import patterns', error as Error);
      throw error;
    }
  }
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const pattern of this.patterns.values()) {
      categories.add(pattern.category);
    }
    return Array.from(categories);
  }
  getTags(): string[] {
    return Array.from(this.patternIndex.keys())
      .filter(key => !this.getCategories().includes(key));
  }
  getStatistics(): {
    totalPatterns: number;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    mostUsed: CodePattern[];
    highestRated: CodePattern[];
  } {
    const byCategory: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    for (const pattern of this.patterns.values()) {
      byCategory[pattern.category] = (byCategory[pattern.category] || 0) + 1;
      byLanguage[pattern._language] = (byLanguage[pattern._language] || 0) + 1;
    }
    const patterns = Array.from(this.patterns.values());
    const mostUsed = patterns
      .sort((a, b) => b.usage.count - a.usage.count)
      .slice(0, 5);
    const highestRated = patterns
      .filter(p => p.usage.count > 5) // Only patterns with sufficient usage
      .sort((a, b) => b.usage.successRate - a.usage.successRate)
      .slice(0, 5);
    return {
      totalPatterns: this.patterns.size,
      byCategory,
      byLanguage,
      mostUsed,
      highestRated
    };
  }
}