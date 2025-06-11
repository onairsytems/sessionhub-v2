/**
 * @actor system
 * @responsibility Learn and adapt to user's coding style and preferences
 * @dependencies Database, FileSystem
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Logger } from '../../lib/logging/Logger';
export interface CodingPattern {
  id: string;
  pattern: string;
  frequency: number;
  lastSeen: Date;
  context: string;
  category: 'naming' | 'structure' | 'imports' | 'comments' | 'testing';
}
export interface StylePreference {
  id: string;
  rule: string;
  value: any;
  confidence: number;
  examples: string[];
}
export interface ProjectContext {
  projectPath: string;
  framework?: string;
  language: string;
  patterns: CodingPattern[];
  preferences: StylePreference[];
}
export class CodingStyleLearner extends EventEmitter {
  private logger: Logger;
  private patterns: Map<string, CodingPattern>;
  private preferences: Map<string, StylePreference>;
  // private projectContexts: Map<string, ProjectContext>; // Reserved for future use
  private learningDataPath: string;
  constructor() {
    super();
    this.logger = new Logger('CodingStyleLearner');
    this.patterns = new Map();
    this.preferences = new Map();
    // this.projectContexts = new Map(); // Reserved for future use
    this.learningDataPath = path.join(process.env['HOME'] || process.env['USERPROFILE'] || '', '.sessionhub', 'ai-learning');
  }
  async initialize(): Promise<void> {
    await this.ensureDataDirectory();
    await this.loadLearningData();
  }
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.learningDataPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create learning data directory', error as Error);
    }
  }
  private async loadLearningData(): Promise<void> {
    try {
      const dataFile = path.join(this.learningDataPath, 'coding-styles.json');
      if (await this.fileExists(dataFile)) {
        const data = await fs.readFile(dataFile, 'utf-8');
        const parsed = JSON.parse(data);
        // Load patterns
        if (parsed.patterns) {
          parsed.patterns.forEach((p: CodingPattern) => {
            this.patterns.set(p.id, p);
          });
        }
        // Load preferences
        if (parsed.preferences) {
          parsed.preferences.forEach((p: StylePreference) => {
            this.preferences.set(p.id, p);
          });
        }
        this.logger.info(`Loaded ${this.patterns.size} patterns and ${this.preferences.size} preferences`);
      }
    } catch (error) {
      this.logger.error('Failed to load learning data', error as Error);
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
  async analyzeCode(filePath: string, content: string): Promise<void> {
    try {
      // Extract patterns from code
      const patterns = this.extractPatterns(content, filePath);
      // Update pattern frequency
      for (const pattern of patterns) {
        const existing = this.patterns.get(pattern.id);
        if (existing) {
          existing.frequency++;
          existing.lastSeen = new Date();
        } else {
          this.patterns.set(pattern.id, pattern);
        }
      }
      // Extract style preferences
      const preferences = this.extractPreferences(content, filePath);
      // Update preferences with confidence scoring
      for (const pref of preferences) {
        const existing = this.preferences.get(pref.id);
        if (existing) {
          existing.confidence = Math.min(1, existing.confidence + 0.1);
          const firstExample = pref.examples[0];
          if (firstExample && !existing.examples.includes(firstExample)) {
            existing.examples.push(firstExample);
          }
        } else {
          this.preferences.set(pref.id, pref);
        }
      }
      await this.saveLearningData();
      this.emit('patterns-updated', { patterns: patterns.length, preferences: preferences.length });
    } catch (error) {
      this.logger.error('Failed to analyze code', error as Error);
    }
  }
  private extractPatterns(content: string, _filePath: string): CodingPattern[] {
    const patterns: CodingPattern[] = [];
    // const ext = path.extname(_filePath); // Reserved for future use
    // Naming patterns
    const functionPattern = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)\s*=>|\([^)]*\)\s*{)/g;
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      const name = match[1];
      const style = this.detectNamingStyle(name || '');
      if (name) {
        patterns.push({
          id: `naming-function-${style}`,
        pattern: style,
        frequency: 1,
        lastSeen: new Date(),
        context: 'function-naming',
          category: 'naming'
        });
      }
    }
    // Import patterns
    const importPattern = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;
      const isRelative = importPath?.startsWith('.') || false;
      patterns.push({
        id: `import-${isRelative ? 'relative' : 'absolute'}`,
        pattern: isRelative ? 'relative-imports' : 'absolute-imports',
        frequency: 1,
        lastSeen: new Date(),
        context: 'import-style',
        category: 'imports'
      });
    }
    // Comment patterns
    const hasJSDoc = /\/\*\*[\s\S]*?\*\//g.test(content);
    const hasSingleLineComments = /\/\/.*$/gm.test(content);
    if (hasJSDoc) {
      patterns.push({
        id: 'comments-jsdoc',
        pattern: 'jsdoc',
        frequency: 1,
        lastSeen: new Date(),
        context: 'documentation',
        category: 'comments'
      });
    }
    if (hasSingleLineComments) {
      patterns.push({
        id: 'comments-single-line',
        pattern: 'single-line',
        frequency: 1,
        lastSeen: new Date(),
        context: 'documentation',
        category: 'comments'
      });
    }
    return patterns;
  }
  private detectNamingStyle(name: string): string {
    if (/^[a-z]+(?:[A-Z][a-z]+)*$/.test(name)) return 'camelCase';
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(name)) return 'PascalCase';
    if (/^[a-z]+(?:_[a-z]+)*$/.test(name)) return 'snake_case';
    if (/^[A-Z]+(?:_[A-Z]+)*$/.test(name)) return 'UPPER_SNAKE_CASE';
    if (/^[a-z]+(?:-[a-z]+)*$/.test(name)) return 'kebab-case';
    return 'mixed';
  }
  private extractPreferences(content: string, filePath: string): StylePreference[] {
    const preferences: StylePreference[] = [];
    // Quote style
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    const prefersSingle = singleQuotes > doubleQuotes;
    preferences.push({
      id: 'quotes',
      rule: 'quote-style',
      value: prefersSingle ? 'single' : 'double',
      confidence: 0.5,
      examples: [filePath]
    });
    // Semicolon usage
    const lines = content.split('\n');
    const statementsWithSemi = lines.filter(l => l.trim().endsWith(';')).length;
    const statementsWithoutSemi = lines.filter(l => {
      const trimmed = l.trim();
      return trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}');
    }).length;
    preferences.push({
      id: 'semicolons',
      rule: 'semicolon-usage',
      value: statementsWithSemi > statementsWithoutSemi,
      confidence: 0.5,
      examples: [filePath]
    });
    // Indentation
    const twoSpaces = content.match(/\n {2}(?! )/g)?.length || 0;
    const fourSpaces = content.match(/\n {4}(?! {4})/g)?.length || 0;
    const tabs = content.match(/\n\t/g)?.length || 0;
    let indentStyle = 'unknown';
    if (twoSpaces > fourSpaces && twoSpaces > tabs) indentStyle = '2-spaces';
    else if (fourSpaces > twoSpaces && fourSpaces > tabs) indentStyle = '4-spaces';
    else if (tabs > twoSpaces && tabs > fourSpaces) indentStyle = 'tabs';
    if (indentStyle !== 'unknown') {
      preferences.push({
        id: 'indentation',
        rule: 'indent-style',
        value: indentStyle,
        confidence: 0.5,
        examples: [filePath]
      });
    }
    return preferences;
  }
  async getStyleSuggestions(_context: string): Promise<StylePreference[]> {
    const relevant = Array.from(this.preferences.values())
      .filter(p => p.confidence > 0.7)
      .sort((a, b) => b.confidence - a.confidence);
    return relevant.slice(0, 5);
  }
  async getPatternSuggestions(category: string): Promise<CodingPattern[]> {
    const relevant = Array.from(this.patterns.values())
      .filter(p => p.category === category)
      .sort((a, b) => b.frequency - a.frequency);
    return relevant.slice(0, 5);
  }
  private async saveLearningData(): Promise<void> {
    try {
      const data = {
        patterns: Array.from(this.patterns.values()),
        preferences: Array.from(this.preferences.values()),
        lastUpdated: new Date().toISOString()
      };
      const dataFile = path.join(this.learningDataPath, 'coding-styles.json');
      await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save learning data', error as Error);
    }
  }
  async applyLearnedStyle(code: string, targetStyle?: StylePreference[]): Promise<string> {
    let modifiedCode = code;
    const stylesToApply = targetStyle || Array.from(this.preferences.values()).filter(p => p.confidence > 0.8);
    for (const style of stylesToApply) {
      switch (style.rule) {
        case 'quote-style':
          if (style.value === 'single') {
            modifiedCode = modifiedCode.replace(/"/g, "'");
          } else {
            modifiedCode = modifiedCode.replace(/'/g, '"');
          }
          break;
        case 'semicolon-usage':
          if (style.value === true) {
            // Add semicolons where missing
            modifiedCode = modifiedCode.replace(/^(\s*(?:const|let|var|return|import|export).*[^;{])\s*$/gm, '$1;');
          } else {
            // Remove semicolons
            modifiedCode = modifiedCode.replace(/;(\s*)$/gm, '$1');
          }
          break;
        case 'indent-style':
          // This would require more sophisticated AST manipulation
          // For now, just log the preference
          this.logger.info(`Preferred indentation: ${style.value}`);
          break;
      }
    }
    return modifiedCode;
  }
  getLearningSummary(): {
    totalPatterns: number;
    totalPreferences: number;
    topPatterns: CodingPattern[];
    confidentPreferences: StylePreference[];
  } {
    return {
      totalPatterns: this.patterns.size,
      totalPreferences: this.preferences.size,
      topPatterns: Array.from(this.patterns.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
      confidentPreferences: Array.from(this.preferences.values())
        .filter(p => p.confidence > 0.8)
        .sort((a, b) => b.confidence - a.confidence)
    };
  }
}