import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@/src/lib/logging/Logger';
import {
  Framework,
  Library,
  ArchitecturePattern,
  TestingFramework,
  BuildTool,
  LanguageStats,
  ProjectStructure
} from '@/src/models/ProjectContext';

export class MetadataExtractor {
  private logger = new Logger('MetadataExtractor');
  
  // Common file patterns to analyze
  private readonly CONFIG_PATTERNS = {
    'package.json': { type: 'npm', purpose: 'Node.js package configuration' },
    'tsconfig.json': { type: 'typescript', purpose: 'TypeScript configuration' },
    'webpack.config.js': { type: 'webpack', purpose: 'Webpack bundler configuration' },
    'vite.config.js': { type: 'vite', purpose: 'Vite bundler configuration' },
    '.eslintrc': { type: 'eslint', purpose: 'ESLint linting configuration' },
    'jest.config.js': { type: 'jest', purpose: 'Jest testing configuration' },
    'next.config.js': { type: 'nextjs', purpose: 'Next.js framework configuration' },
    'tailwind.config.js': { type: 'tailwind', purpose: 'Tailwind CSS configuration' },
    'docker-compose.yml': { type: 'docker', purpose: 'Docker container orchestration' },
    'Dockerfile': { type: 'docker', purpose: 'Docker image configuration' },
    '.github/workflows': { type: 'github-actions', purpose: 'CI/CD workflows' }
  };
  
  // Framework detection patterns
  private readonly FRAMEWORK_PATTERNS = {
    react: {
      indicators: ['react', 'react-dom'],
      files: ['App.tsx', 'App.jsx', 'index.tsx', 'index.jsx'],
      category: 'frontend' as const
    },
    nextjs: {
      indicators: ['next'],
      files: ['next.config.js', 'pages/', 'app/'],
      category: 'fullstack' as const
    },
    vue: {
      indicators: ['vue'],
      files: ['App.vue', 'main.js'],
      category: 'frontend' as const
    },
    angular: {
      indicators: ['@angular/core'],
      files: ['angular.json', 'main.ts'],
      category: 'frontend' as const
    },
    express: {
      indicators: ['express'],
      files: ['server.js', 'app.js'],
      category: 'backend' as const
    },
    nestjs: {
      indicators: ['@nestjs/core'],
      files: ['nest-cli.json', 'main.ts'],
      category: 'backend' as const
    },
    electron: {
      indicators: ['electron'],
      files: ['main/background.ts', 'electron.js'],
      category: 'fullstack' as const
    }
  };
  
  // Architecture pattern detection
  private readonly ARCHITECTURE_PATTERNS = {
    mvc: {
      indicators: ['controllers/', 'models/', 'views/'],
      description: 'Model-View-Controller architecture'
    },
    mvvm: {
      indicators: ['viewmodels/', 'models/', 'views/'],
      description: 'Model-View-ViewModel architecture'
    },
    layered: {
      indicators: ['presentation/', 'business/', 'data/', 'domain/'],
      description: 'Layered architecture'
    },
    microservices: {
      indicators: ['services/', 'api-gateway/', 'docker-compose.yml'],
      description: 'Microservices architecture'
    },
    hexagonal: {
      indicators: ['domain/', 'application/', 'infrastructure/', 'ports/', 'adapters/'],
      description: 'Hexagonal/Ports & Adapters architecture'
    },
    clean: {
      indicators: ['entities/', 'usecases/', 'interfaces/', 'frameworks/'],
      description: 'Clean Architecture'
    },
    'two-actor': {
      indicators: ['planning/', 'execution/', 'orchestrator/', 'protocol/'],
      description: 'Two-Actor Model architecture'
    }
  };
  
  // Testing framework patterns
  private readonly TESTING_PATTERNS = {
    jest: {
      indicators: ['jest', '@types/jest'],
      configFiles: ['jest.config.js', 'jest.config.ts'],
      type: 'unit' as const
    },
    mocha: {
      indicators: ['mocha', '@types/mocha'],
      configFiles: ['.mocharc.json', 'mocha.opts'],
      type: 'unit' as const
    },
    vitest: {
      indicators: ['vitest'],
      configFiles: ['vitest.config.js', 'vitest.config.ts'],
      type: 'unit' as const
    },
    cypress: {
      indicators: ['cypress'],
      configFiles: ['cypress.config.js', 'cypress.json'],
      type: 'e2e' as const
    },
    playwright: {
      indicators: ['@playwright/test'],
      configFiles: ['playwright.config.js', 'playwright.config.ts'],
      type: 'e2e' as const
    }
  };
  
  /**
   * Extract comprehensive metadata from a project
   */
  async extractProjectMetadata(projectPath: string): Promise<{
    frameworks: Framework[];
    libraries: Library[];
    architecturePatterns: ArchitecturePattern[];
    testingFrameworks: TestingFramework[];
    buildTools: BuildTool[];
    structure: ProjectStructure;
  }> {
    this.logger.info(`Extracting metadata from: ${projectPath}`);
    
    const [
      { frameworks, libraries },
      architecturePatterns,
      testingFrameworks,
      buildTools,
      structure
    ] = await Promise.all([
      this.extractDependencies(projectPath),
      this.detectArchitecturePatterns(projectPath),
      this.detectTestingFrameworks(projectPath),
      this.detectBuildTools(projectPath),
      this.analyzeProjectStructure(projectPath)
    ]);
    
    return {
      frameworks,
      libraries,
      architecturePatterns,
      testingFrameworks,
      buildTools,
      structure
    };
  }
  
  /**
   * Extract frameworks and libraries from package.json
   */
  private async extractDependencies(projectPath: string): Promise<{
    frameworks: Framework[];
    libraries: Library[];
  }> {
    const frameworks: Framework[] = [];
    const libraries: Library[] = [];
    
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return { frameworks, libraries };
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      // Detect frameworks
      for (const [name, pattern] of Object.entries(this.FRAMEWORK_PATTERNS)) {
        const confidence = this.calculateFrameworkConfidence(
          name,
          pattern,
          allDeps,
          projectPath
        );
        
        if (confidence > 0.5) {
          frameworks.push({
            name,
            version: this.extractVersion(allDeps, pattern.indicators),
            category: pattern.category,
            confidence
          });
        }
      }
      
      // Extract other libraries
      for (const [dep, version] of Object.entries(allDeps)) {
        const isFramework = frameworks.some(f => {
          const pattern = this.FRAMEWORK_PATTERNS[f.name as keyof typeof this.FRAMEWORK_PATTERNS];
          return pattern?.indicators.includes(dep);
        });
        
        if (!isFramework && typeof version === 'string') {
          libraries.push({
            name: dep,
            version: version,
            purpose: this.inferLibraryPurpose(dep),
            isDevDependency: !packageJson.dependencies?.[dep]
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to extract dependencies', error as Error);
    }
    
    return { frameworks, libraries };
  }
  
  /**
   * Detect architecture patterns in the project
   */
  private async detectArchitecturePatterns(projectPath: string): Promise<ArchitecturePattern[]> {
    const patterns: ArchitecturePattern[] = [];
    const projectFiles = await this.getProjectStructure(projectPath);
    
    for (const [name, pattern] of Object.entries(this.ARCHITECTURE_PATTERNS)) {
      const locations: string[] = [];
      let matchCount = 0;
      
      for (const indicator of pattern.indicators) {
        const matches = projectFiles.filter(f => f.includes(indicator));
        if (matches.length > 0) {
          matchCount++;
          locations.push(...matches.slice(0, 3)); // Keep first 3 examples
        }
      }
      
      const confidence = matchCount / pattern.indicators.length;
      if (confidence > 0.3) {
        patterns.push({
          pattern: name,
          confidence,
          locations: [...new Set(locations)], // Remove duplicates
          description: pattern.description
        });
      }
    }
    
    // Sort by confidence
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Detect testing frameworks
   */
  private async detectTestingFrameworks(projectPath: string): Promise<TestingFramework[]> {
    const frameworks: TestingFramework[] = [];
    
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return frameworks;
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      for (const [name, pattern] of Object.entries(this.TESTING_PATTERNS)) {
        const hasIndicator = pattern.indicators.some(ind => allDeps[ind]);
        const configFile = pattern.configFiles.find(cf => 
          fs.existsSync(path.join(projectPath, cf))
        );
        
        if (hasIndicator || configFile) {
          frameworks.push({
            name,
            type: pattern.type,
            configFile
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to detect testing frameworks', error as Error);
    }
    
    return frameworks;
  }
  
  /**
   * Detect build tools
   */
  private async detectBuildTools(projectPath: string): Promise<BuildTool[]> {
    const buildTools: BuildTool[] = [];
    
    try {
      // Check package.json scripts
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (packageJson.scripts) {
          buildTools.push({
            name: 'npm scripts',
            configFile: 'package.json',
            scripts: packageJson.scripts
          });
        }
      }
      
      // Check for specific build tool configs
      const buildConfigs = [
        { file: 'webpack.config.js', name: 'webpack' },
        { file: 'vite.config.js', name: 'vite' },
        { file: 'rollup.config.js', name: 'rollup' },
        { file: 'parcel.json', name: 'parcel' },
        { file: 'turbo.json', name: 'turbopack' },
        { file: 'gulpfile.js', name: 'gulp' }
      ];
      
      for (const config of buildConfigs) {
        if (fs.existsSync(path.join(projectPath, config.file))) {
          buildTools.push({
            name: config.name,
            configFile: config.file
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Failed to detect build tools', error as Error);
    }
    
    return buildTools;
  }
  
  /**
   * Analyze project structure
   */
  private async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      rootPath: projectPath,
      sourceDirectories: [],
      testDirectories: [],
      configFiles: [],
      entryPoints: [],
      outputDirectories: [],
      totalFiles: 0,
      totalLines: 0,
      primaryLanguages: []
    };
    
    try {
      const files = await this.getProjectStructure(projectPath);
      const languageStats = new Map<string, LanguageStats>();
      
      for (const file of files) {
        structure.totalFiles++;
        
        // Identify directories
        const dir = path.dirname(file);
        if (dir.includes('src') && !structure.sourceDirectories.includes(dir)) {
          structure.sourceDirectories.push(dir);
        }
        if ((dir.includes('test') || dir.includes('spec')) && 
            !structure.testDirectories.includes(dir)) {
          structure.testDirectories.push(dir);
        }
        if ((dir.includes('dist') || dir.includes('build') || dir.includes('out')) &&
            !structure.outputDirectories.includes(dir)) {
          structure.outputDirectories.push(dir);
        }
        
        // Identify config files
        const fileName = path.basename(file);
        const configPattern = this.CONFIG_PATTERNS[fileName as keyof typeof this.CONFIG_PATTERNS];
        if (configPattern) {
          structure.configFiles.push({
            path: file,
            type: configPattern.type,
            purpose: configPattern.purpose
          });
        }
        
        // Identify entry points
        if (fileName.match(/^(index|main|app)\.(js|ts|jsx|tsx)$/)) {
          structure.entryPoints.push(file);
        }
        
        // Count language stats
        const ext = path.extname(file).toLowerCase();
        const language = this.getLanguageFromExtension(ext);
        if (language) {
          const stats = languageStats.get(language) || {
            language,
            files: 0,
            lines: 0,
            percentage: 0
          };
          stats.files++;
          
          // Count lines (simplified - in production would actually read file)
          try {
            const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
            const lines = content.split('\n').length;
            stats.lines += lines;
            structure.totalLines += lines;
          } catch {
            // Skip files that can't be read
          }
          
          languageStats.set(language, stats);
        }
      }
      
      // Calculate language percentages
      for (const stats of languageStats.values()) {
        stats.percentage = (stats.files / structure.totalFiles) * 100;
        structure.primaryLanguages.push(stats);
      }
      
      // Sort languages by file count
      structure.primaryLanguages.sort((a: LanguageStats, b: LanguageStats) => b.files - a.files);
      
    } catch (error) {
      this.logger.error('Failed to analyze project structure', error as Error);
    }
    
    return structure;
  }
  
  /**
   * Get all files in project (excluding node_modules, etc.)
   */
  private async getProjectStructure(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = new Set([
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      'out'
    ]);
    
    const walk = (dir: string, baseDir: string = projectPath) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.') && entry.isDirectory()) {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
              walk(fullPath, baseDir);
            }
          } else {
            files.push(relativePath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    walk(projectPath);
    return files;
  }
  
  /**
   * Calculate confidence score for framework detection
   */
  private calculateFrameworkConfidence(
    _name: string,
    pattern: any,
    dependencies: Record<string, any>,
    projectPath: string
  ): number {
    let score = 0;
    let checks = 0;
    
    // Check dependencies
    checks++;
    if (pattern.indicators.some((ind: string) => dependencies[ind])) {
      score += 0.6; // High weight for dependency presence
    }
    
    // Check files
    checks++;
    const fileMatches = pattern.files.filter((file: string) => {
      if (file.endsWith('/')) {
        return fs.existsSync(path.join(projectPath, file));
      }
      return fs.existsSync(path.join(projectPath, file));
    }).length;
    
    if (fileMatches > 0) {
      score += 0.4 * (fileMatches / pattern.files.length);
    }
    
    return score / checks;
  }
  
  /**
   * Extract version from dependencies
   */
  private extractVersion(deps: Record<string, any>, indicators: string[]): string | undefined {
    for (const indicator of indicators) {
      if (deps[indicator]) {
        const version = deps[indicator];
        // Clean version string (remove ^, ~, etc.)
        return version.replace(/^[\^~]/, '');
      }
    }
    return undefined;
  }
  
  /**
   * Infer library purpose from name
   */
  private inferLibraryPurpose(name: string): string {
    const purposes: Record<string, string[]> = {
      'HTTP client': ['axios', 'fetch', 'got', 'request'],
      'State management': ['redux', 'mobx', 'zustand', 'recoil'],
      'Form handling': ['formik', 'react-hook-form', 'yup'],
      'Styling': ['styled-components', 'emotion', 'sass', 'less'],
      'Testing': ['jest', 'mocha', 'chai', 'sinon'],
      'Database': ['mongoose', 'sequelize', 'typeorm', 'prisma'],
      'Authentication': ['passport', 'jsonwebtoken', 'bcrypt'],
      'Validation': ['joi', 'yup', 'zod', 'class-validator'],
      'Logging': ['winston', 'pino', 'bunyan', 'morgan'],
      'Utilities': ['lodash', 'ramda', 'underscore', 'moment']
    };
    
    for (const [purpose, libs] of Object.entries(purposes)) {
      if (libs.some(lib => name.includes(lib))) {
        return purpose;
      }
    }
    
    // Generic purposes based on prefixes
    if (name.startsWith('@types/')) return 'TypeScript types';
    if (name.startsWith('eslint-')) return 'Linting';
    if (name.startsWith('babel-')) return 'Transpilation';
    if (name.startsWith('webpack-')) return 'Bundling';
    
    return 'Utility';
  }
  
  /**
   * Map file extension to language
   */
  private getLanguageFromExtension(ext: string): string | null {
    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.r': 'R',
      '.m': 'Objective-C',
      '.vue': 'Vue',
      '.svelte': 'Svelte'
    };
    
    return languageMap[ext] || null;
  }
}