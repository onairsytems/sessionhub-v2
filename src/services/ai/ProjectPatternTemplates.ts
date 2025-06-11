/**
 * @actor system
 * @responsibility Auto-detect project types and suggest optimal structures
 * @dependencies FileSystem, Database
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
export interface ProjectTemplate {
  id: string;
  name: string;
  type: 'nextjs' | 'electron' | 'react' | 'node' | 'typescript' | 'python' | 'rust' | 'generic';
  description: string;
  detection: {
    files?: string[];
    dependencies?: string[];
    patterns?: RegExp[];
  };
  structure: {
    directories: string[];
    files: Array<{
      path: string;
      template?: string;
      required: boolean;
    }>;
  };
  recommendations: string[];
  confidence: number;
}
export interface ProjectAnalysis {
  detectedType: string;
  confidence: number;
  matchedPatterns: string[];
  suggestedStructure: ProjectTemplate;
  missingElements: string[];
}
export class ProjectPatternTemplates extends EventEmitter {
  private logger: Logger;
  private templates: Map<string, ProjectTemplate>;
  private projectCache: Map<string, ProjectAnalysis>;
  constructor() {
    super();
    this.logger = new Logger('ProjectPatternTemplates');
    this.templates = new Map();
    this.projectCache = new Map();
    this.initializeTemplates();
  }
  private initializeTemplates(): void {
    // Next.js template
    this.templates.set('nextjs', {
      id: 'nextjs',
      name: 'Next.js Application',
      type: 'nextjs',
      description: 'Modern React framework with SSR/SSG support',
      detection: {
        files: ['next.config.js', 'next.config.mjs', 'pages/_app.tsx', 'app/page.tsx'],
        dependencies: ['next', 'react', 'react-dom'],
        patterns: [/pages\/.*\.tsx?$/, /app\/.*\.tsx?$/]
      },
      structure: {
        directories: [
          'pages',
          'app',
          'components',
          'styles',
          'public',
          'lib',
          'hooks',
          'utils',
          'api',
          'types'
        ],
        files: [
          { path: 'next.config.js', required: true },
          { path: 'tsconfig.json', required: true },
          { path: '.env.local', required: false },
          { path: 'middleware.ts', required: false }
        ]
      },
      recommendations: [
        'Use App Router for new projects',
        'Implement proper error boundaries',
        'Optimize images with next/image',
        'Use ISR for dynamic content'
      ],
      confidence: 0
    });
    // Electron template
    this.templates.set('electron', {
      id: 'electron',
      name: 'Electron Desktop Application',
      type: 'electron',
      description: 'Cross-platform desktop application',
      detection: {
        files: ['electron.json', 'main/background.ts', 'main/preload.ts'],
        dependencies: ['electron', 'electron-builder'],
        patterns: [/main\/.*\.ts$/, /renderer\/.*\.tsx?$/]
      },
      structure: {
        directories: [
          'main',
          'renderer',
          'resources',
          'dist',
          'dist-electron',
          'scripts',
          'types'
        ],
        files: [
          { path: 'main/background.ts', required: true },
          { path: 'main/preload.ts', required: true },
          { path: 'electron-builder.yml', required: false },
          { path: 'resources/icon.png', required: false }
        ]
      },
      recommendations: [
        'Implement proper IPC security',
        'Use context isolation',
        'Sign and notarize for distribution',
        'Implement auto-updater'
      ],
      confidence: 0
    });
    // React template
    this.templates.set('react', {
      id: 'react',
      name: 'React Application',
      type: 'react',
      description: 'Single-page React application',
      detection: {
        files: ['src/App.tsx', 'src/index.tsx', 'public/index.html'],
        dependencies: ['react', 'react-dom'],
        patterns: [/src\/.*\.tsx?$/, /components\/.*\.tsx?$/]
      },
      structure: {
        directories: [
          'src',
          'src/components',
          'src/hooks',
          'src/utils',
          'src/services',
          'src/types',
          'public',
          'tests'
        ],
        files: [
          { path: 'src/App.tsx', required: true },
          { path: 'src/index.tsx', required: true },
          { path: 'tsconfig.json', required: true },
          { path: '.env', required: false }
        ]
      },
      recommendations: [
        'Use React.memo for performance',
        'Implement proper error boundaries',
        'Use custom hooks for logic reuse',
        'Consider state management solution'
      ],
      confidence: 0
    });
    // Node.js template
    this.templates.set('node', {
      id: 'node',
      name: 'Node.js Application',
      type: 'node',
      description: 'Backend Node.js application',
      detection: {
        files: ['server.js', 'index.js', 'app.js', 'src/server.ts'],
        dependencies: ['express', 'fastify', 'koa', '@types/node'],
        patterns: [/routes\/.*\.[jt]s$/, /controllers\/.*\.[jt]s$/]
      },
      structure: {
        directories: [
          'src',
          'src/routes',
          'src/controllers',
          'src/models',
          'src/services',
          'src/middleware',
          'src/utils',
          'config',
          'tests'
        ],
        files: [
          { path: 'src/server.ts', required: true },
          { path: 'tsconfig.json', required: false },
          { path: '.env', required: false },
          { path: 'Dockerfile', required: false }
        ]
      },
      recommendations: [
        'Implement proper error handling',
        'Use environment variables for config',
        'Add request validation',
        'Implement proper logging'
      ],
      confidence: 0
    });
  }
  async analyzeProject(_projectPath: string): Promise<ProjectAnalysis> {
    try {
      // Check cache first
      const cached = this.projectCache.get(_projectPath);
      if (cached) {
        return cached;
      }
      const detectedTypes: Array<{ type: string; confidence: number; patterns: string[] }> = [];
      // Analyze each template
      for (const [type, template] of this.templates) {
        const result = await this.checkTemplate(_projectPath, template);
        if (result.confidence > 0) {
          detectedTypes.push({
            type,
            confidence: result.confidence,
            patterns: result.patterns
          });
        }
      }
      // Sort by confidence
      detectedTypes.sort((a, b) => b.confidence - a.confidence);
      if (detectedTypes.length === 0) {
        // Generic project
        return this.createGenericAnalysis(_projectPath);
      }
      const bestMatch = detectedTypes[0];
      if (!bestMatch) {
        return this.createGenericAnalysis(_projectPath);
      }
      const template = this.templates.get(bestMatch.type)!;
      // Check what's missing
      const missingElements = await this.checkMissingElements(_projectPath, template);
      const analysis: ProjectAnalysis = {
        detectedType: bestMatch.type,
        confidence: bestMatch.confidence,
        matchedPatterns: bestMatch.patterns,
        suggestedStructure: template,
        missingElements
      };
      // Cache the result
      this.projectCache.set(_projectPath, analysis);
      this.emit('project-analyzed', analysis);
      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze project', error as Error);
      return this.createGenericAnalysis(_projectPath);
    }
  }
  private async checkTemplate(
    _projectPath: string,
    template: ProjectTemplate
  ): Promise<{ confidence: number; patterns: string[] }> {
    let matchScore = 0;
    let totalChecks = 0;
    const matchedPatterns: string[] = [];
    // Check files
    if (template.detection.files) {
      for (const file of template.detection.files) {
        totalChecks++;
        const filePath = path.join(_projectPath, file);
        if (await this.fileExists(filePath)) {
          matchScore++;
          matchedPatterns.push(`File: ${file}`);
        }
      }
    }
    // Check package.json dependencies
    if (template.detection.dependencies) {
      const packageJsonPath = path.join(_projectPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };
          for (const dep of template.detection.dependencies) {
            totalChecks++;
            if (allDeps[dep]) {
              matchScore++;
              matchedPatterns.push(`Dependency: ${dep}`);
            }
          }
        } catch (error) {
          this.logger.warn('Failed to parse package.json', error as Error);
        }
      }
    }
    // Check file patterns
    if (template.detection.patterns) {
      const files = await this.getAllFiles(_projectPath);
      for (const pattern of template.detection.patterns) {
        totalChecks++;
        const hasMatch = files.some(f => pattern.test(f));
        if (hasMatch) {
          matchScore++;
          matchedPatterns.push(`Pattern: ${pattern.source}`);
        }
      }
    }
    const confidence = totalChecks > 0 ? matchScore / totalChecks : 0;
    return { confidence, patterns: matchedPatterns };
  }
  private async checkMissingElements(
    _projectPath: string,
    template: ProjectTemplate
  ): Promise<string[]> {
    const missing: string[] = [];
    // Check required directories
    for (const dir of template.structure.directories) {
      const dirPath = path.join(_projectPath, dir);
      if (!(await this.fileExists(dirPath))) {
        missing.push(`Directory: ${dir}`);
      }
    }
    // Check required files
    for (const file of template.structure.files) {
      if (file.required) {
        const filePath = path.join(_projectPath, file.path);
        if (!(await this.fileExists(filePath))) {
          missing.push(`File: ${file.path}`);
        }
      }
    }
    return missing;
  }
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  private async getAllFiles(dirPath: string, relativeTo: string = dirPath): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath, relativeTo);
          files.push(...subFiles);
        } else {
          const relativePath = path.relative(relativeTo, fullPath);
          files.push(relativePath);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory ${dirPath}`, error as Error);
    }
    return files;
  }
  private createGenericAnalysis(_projectPath: string): ProjectAnalysis {
    return {
      detectedType: 'generic',
      confidence: 0.5,
      matchedPatterns: [],
      suggestedStructure: {
        id: 'generic',
        name: 'Generic Project',
        type: 'generic',
        description: 'General purpose project structure',
        detection: {},
        structure: {
          directories: ['src', 'tests', 'docs', 'scripts'],
          files: [
            { path: 'README.md', required: true },
            { path: '.gitignore', required: true }
          ]
        },
        recommendations: [
          'Add a clear README.md',
          'Set up version control',
          'Define project structure',
          'Add appropriate .gitignore'
        ],
        confidence: 0.5
      },
      missingElements: []
    };
  }
  async generateProjectStructure(
    _projectPath: string,
    template: ProjectTemplate
  ): Promise<void> {
    try {
      // Create directories
      for (const dir of template.structure.directories) {
        const dirPath = path.join(_projectPath, dir);
        await fs.mkdir(dirPath, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
      // Create required files with templates
      for (const file of template.structure.files) {
        if (file.required && file.template) {
          const filePath = path.join(_projectPath, file.path);
          if (!(await this.fileExists(filePath))) {
            await fs.writeFile(filePath, file.template);
            this.logger.info(`Created file: ${file.path}`);
          }
        }
      }
      this.emit('structure-generated', { _projectPath, template: template.id });
    } catch (error) {
      this.logger.error('Failed to generate project structure', error as Error);
      throw error;
    }
  }
  getSuggestedTemplate(projectType: string): ProjectTemplate | undefined {
    return this.templates.get(projectType);
  }
  getAllTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }
  clearCache(): void {
    this.projectCache.clear();
  }
}