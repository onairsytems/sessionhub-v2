import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { SupportedLanguage } from './types';

interface LanguageIndicator {
  files: string[];
  extensions: string[];
  patterns?: RegExp[];
  weight: number;
}

export class LanguageDetector {
  private logger: Logger;
  private languageIndicators: Record<SupportedLanguage, LanguageIndicator> = {
    typescript: {
      files: ['tsconfig.json', 'tsconfig.*.json'],
      extensions: ['.ts', '.tsx'],
      weight: 10
    },
    javascript: {
      files: ['package.json', 'jsconfig.json'],
      extensions: ['.js', '.jsx', '.mjs', '.cjs'],
      patterns: [/^node_modules$/],
      weight: 8
    },
    python: {
      files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
      extensions: ['.py', '.pyw'],
      patterns: [/__pycache__/, /\.egg-info$/],
      weight: 9
    },
    java: {
      files: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'gradlew'],
      extensions: ['.java'],
      patterns: [/^src\/main\/java/],
      weight: 9
    },
    csharp: {
      files: ['*.csproj', '*.sln', 'Directory.Build.props'],
      extensions: ['.cs', '.csx'],
      patterns: [/^bin/, /^obj/],
      weight: 9
    },
    go: {
      files: ['go.mod', 'go.sum'],
      extensions: ['.go'],
      weight: 9
    },
    rust: {
      files: ['Cargo.toml', 'Cargo.lock'],
      extensions: ['.rs'],
      patterns: [/^target/],
      weight: 9
    },
    ruby: {
      files: ['Gemfile', 'Gemfile.lock', 'Rakefile', '*.gemspec'],
      extensions: ['.rb', '.rake'],
      weight: 8
    },
    php: {
      files: ['composer.json', 'composer.lock', 'phpunit.xml'],
      extensions: ['.php', '.phtml'],
      weight: 8
    },
    swift: {
      files: ['Package.swift', '*.xcodeproj', '*.xcworkspace'],
      extensions: ['.swift'],
      weight: 9
    },
    kotlin: {
      files: ['build.gradle.kts', 'settings.gradle.kts'],
      extensions: ['.kt', '.kts'],
      weight: 8
    },
    scala: {
      files: ['build.sbt', 'build.scala'],
      extensions: ['.scala', '.sc'],
      weight: 8
    }
  };

  constructor() {
    this.logger = new Logger('LanguageDetector');
  }

  /**
   * Detect languages used in a project
   */
  async detectLanguages(projectPath: string): Promise<SupportedLanguage[]> {
    try {
      const scores = new Map<SupportedLanguage, number>();

      // Scan project directory
      await this.scanDirectory(projectPath, scores);

      // Sort languages by score
      const detectedLanguages = Array.from(scores.entries())
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([lang]) => lang);

      this.logger.info('Detected languages:', detectedLanguages);
      return detectedLanguages;

    } catch (error) {
      this.logger.error('Language detection failed:', error as Error);
      return [];
    }
  }

  /**
   * Scan directory recursively for language indicators
   */
  private async scanDirectory(
    dirPath: string,
    scores: Map<SupportedLanguage, number>,
    depth: number = 0,
    maxDepth: number = 5
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip common non-source directories
        if (this.shouldSkipDirectory(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, scores, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          await this.analyzeFile(entry.name, fullPath, scores);
        }
      }

      // Check for language-specific patterns in current directory
      await this.checkDirectoryPatterns(dirPath, scores);

    } catch (error) {
      this.logger.warn(`Error scanning directory ${dirPath}:`, error as Error);
    }
  }

  /**
   * Analyze a file for language indicators
   */
  private async analyzeFile(
    fileName: string,
    _filePath: string,
    scores: Map<SupportedLanguage, number>
  ): Promise<void> {
    const extension = path.extname(fileName).toLowerCase();

    for (const [language, indicator] of Object.entries(this.languageIndicators) as [SupportedLanguage, LanguageIndicator][]) {
      // Check file name matches
      for (const pattern of indicator.files) {
        if (this.matchesPattern(fileName, pattern)) {
          const currentScore = scores.get(language) || 0;
          scores.set(language, currentScore + indicator.weight * 2); // Double weight for config files
        }
      }

      // Check extensions
      if (indicator.extensions.includes(extension)) {
        const currentScore = scores.get(language) || 0;
        scores.set(language, currentScore + indicator.weight);
      }
    }
  }

  /**
   * Check directory for language-specific patterns
   */
  private async checkDirectoryPatterns(
    dirPath: string,
    scores: Map<SupportedLanguage, number>
  ): Promise<void> {
    const dirName = path.basename(dirPath);

    for (const [language, indicator] of Object.entries(this.languageIndicators) as [SupportedLanguage, LanguageIndicator][]) {
      if (indicator.patterns) {
        for (const pattern of indicator.patterns) {
          if (pattern.test(dirName)) {
            const currentScore = scores.get(language) || 0;
            scores.set(language, currentScore + indicator.weight);
          }
        }
      }
    }
  }

  /**
   * Check if a pattern matches a filename
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(fileName);
    }
    return fileName === pattern;
  }

  /**
   * Check if directory should be skipped
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      '__pycache__',
      '.pytest_cache',
      'venv',
      'env',
      '.env',
      'dist',
      'build',
      'out',
      'target',
      'bin',
      'obj',
      '.idea',
      '.vscode',
      '.vs',
      'coverage',
      '.nyc_output'
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Get language from file extension
   */
  getLanguageFromExtension(filePath: string): SupportedLanguage | null {
    const extension = path.extname(filePath).toLowerCase();

    for (const [language, indicator] of Object.entries(this.languageIndicators) as [SupportedLanguage, LanguageIndicator][]) {
      if (indicator.extensions.includes(extension)) {
        return language;
      }
    }

    return null;
  }
}