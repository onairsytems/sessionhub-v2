/**
 * @actor system
 * @responsibility Comprehensive project template system for accelerated setup
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  framework: string;
  language: string;
  features: string[];
  structure: ProjectStructure;
  dependencies: ProjectDependencies;
  scripts: ProjectScripts;
  configuration: ProjectConfiguration;
  customizableOptions: CustomizableOption[];
  estimatedSetupTime: number;
  metadata: ProjectTemplateMetadata;
  createdAt: string;
  updatedAt: string;
}

export type ProjectCategory = 
  | 'web-app'
  | 'api'
  | 'mobile'
  | 'desktop'
  | 'library'
  | 'cli'
  | 'fullstack'
  | 'microservice'
  | 'data-science'
  | 'machine-learning'
  | 'blockchain'
  | 'game'
  | 'iot'
  | 'custom';

export interface ProjectStructure {
  directories: DirectoryDefinition[];
  files: FileDefinition[];
  gitignore: string[];
  readme: ReadmeTemplate;
}

export interface DirectoryDefinition {
  path: string;
  description: string;
  optional: boolean;
}

export interface FileDefinition {
  path: string;
  template: string;
  variables: Record<string, any>;
  optional: boolean;
  condition?: string;
}

export interface ProjectDependencies {
  runtime: Record<string, string>;
  dev: Record<string, string>;
  peer?: Record<string, string>;
  optional?: Record<string, string>;
}

export interface ProjectScripts {
  dev: string;
  build: string;
  test: string;
  lint: string;
  format: string;
  [key: string]: string;
}

export interface ProjectConfiguration {
  typescript?: TypeScriptConfig;
  eslint?: ESLintConfig;
  prettier?: PrettierConfig;
  jest?: JestConfig;
  webpack?: WebpackConfig;
  vite?: ViteConfig;
  nextjs?: NextJSConfig;
  docker?: DockerConfig;
  kubernetes?: KubernetesConfig;
  cicd?: CICDConfig;
}

export interface TypeScriptConfig {
  compilerOptions: Record<string, any>;
  include: string[];
  exclude: string[];
}

export interface ESLintConfig {
  extends: string[];
  rules: Record<string, any>;
  plugins: string[];
}

export interface PrettierConfig {
  semi: boolean;
  singleQuote: boolean;
  tabWidth: number;
  trailingComma: string;
  [key: string]: any;
}

export interface JestConfig {
  preset?: string;
  testEnvironment: string;
  collectCoverageFrom: string[];
  coverageThreshold: Record<string, any>;
}

export interface WebpackConfig {
  entry: string;
  output: Record<string, any>;
  module: Record<string, any>;
  plugins: any[];
}

export interface ViteConfig {
  plugins: any[];
  server: Record<string, any>;
  build: Record<string, any>;
}

export interface NextJSConfig {
  reactStrictMode: boolean;
  images?: Record<string, any>;
  env?: Record<string, string>;
}

export interface DockerConfig {
  dockerfile: string;
  dockerCompose?: string;
  baseImage: string;
}

export interface KubernetesConfig {
  deployment: string;
  service: string;
  configMap?: string;
  ingress?: string;
}

export interface CICDConfig {
  github?: GitHubActionsConfig;
  gitlab?: GitLabCIConfig;
  jenkins?: JenkinsConfig;
  circleci?: CircleCIConfig;
}

export interface GitHubActionsConfig {
  workflows: Array<{
    name: string;
    on: string[];
    jobs: Record<string, any>;
  }>;
}

export interface GitLabCIConfig {
  stages: string[];
  jobs: Record<string, any>;
}

export interface JenkinsConfig {
  pipeline: string;
}

export interface CircleCIConfig {
  version: number;
  jobs: Record<string, any>;
  workflows: Record<string, any>;
}

export interface CustomizableOption {
  id: string;
  name: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'multiselect';
  defaultValue: any;
  options?: any[];
  validation?: {
    required?: boolean;
    pattern?: string;
    min?: number;
    max?: number;
  };
  affects: string[];
}

export interface ReadmeTemplate {
  sections: Array<{
    title: string;
    content: string;
    order: number;
  }>;
}

export interface ProjectTemplateMetadata {
  author: string;
  version: string;
  license: string;
  tags: string[];
  popularity: number;
  lastUsed?: string;
  usageCount: number;
  averageSetupTime: number;
  successRate: number;
  userRating: number;
  compatibility: {
    node: string;
    npm: string;
    platforms: string[];
  };
}

export interface ProjectSetupOptions {
  templateId: string;
  projectName: string;
  projectPath: string;
  customizations: Record<string, any>;
  skipDependencies?: boolean;
  skipGitInit?: boolean;
  openInEditor?: boolean;
}

export interface ProjectSetupResult {
  success: boolean;
  projectPath: string;
  filesCreated: string[];
  dependenciesInstalled: boolean;
  gitInitialized: boolean;
  setupDuration: number;
  errors: string[];
  warnings: string[];
  nextSteps: string[];
}

export interface TemplateSearchCriteria {
  query?: string;
  category?: ProjectCategory;
  framework?: string;
  language?: string;
  features?: string[];
  minRating?: number;
  sortBy?: 'popularity' | 'rating' | 'recent' | 'name';
  limit?: number;
  offset?: number;
}

export interface CustomTemplateDefinition {
  name: string;
  description: string;
  basedOn?: string;
  category: ProjectCategory;
  framework: string;
  language: string;
  features: string[];
  structure: Partial<ProjectStructure>;
  dependencies: Partial<ProjectDependencies>;
  scripts: Partial<ProjectScripts>;
  configuration: Partial<ProjectConfiguration>;
  customizableOptions: CustomizableOption[];
}

export class ProjectTemplateSystem extends EventEmitter {
  private readonly logger: Logger;
  // private readonly _auditLogger: AuditLogger;
  // Removed unused auditLogger
  private readonly templatesDir: string;
  private readonly customTemplatesDir: string;
  private readonly cacheDir: string;
  
  private templates = new Map<string, ProjectTemplate>();
  private builtInTemplates: ProjectTemplate[] = [];
  private templateCache = new Map<string, any>();
  
  constructor(logger: Logger, _auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    // this._auditLogger = auditLogger;
    
    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.templatesDir = path.join(dataDir, 'project-templates');
    this.customTemplatesDir = path.join(dataDir, 'custom-project-templates');
    this.cacheDir = path.join(dataDir, 'template-cache');
    
    this.initializeTemplateSystem();
  }

  /**
   * Initialize the template system
   */
  private async initializeTemplateSystem(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.templatesDir, { recursive: true }),
      fs.mkdir(this.customTemplatesDir, { recursive: true }),
      fs.mkdir(this.cacheDir, { recursive: true })
    ]);

    await this.loadBuiltInTemplates();
    await this.loadCustomTemplates();

    this.logger.info('Project template system initialized', {
      builtInTemplates: this.builtInTemplates.length,
      customTemplates: this.templates.size - this.builtInTemplates.length
    });
  }

  /**
   * Get all available templates
   */
  async getTemplates(): Promise<ProjectTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Search templates based on criteria
   */
  async searchTemplates(criteria: TemplateSearchCriteria): Promise<ProjectTemplate[]> {
    let templates = Array.from(this.templates.values());

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (criteria.category) {
      templates = templates.filter(t => t.category === criteria.category);
    }

    if (criteria.framework) {
      templates = templates.filter(t => t.framework === criteria.framework);
    }

    if (criteria.language) {
      templates = templates.filter(t => t.language === criteria.language);
    }

    if (criteria.features && criteria.features.length > 0) {
      templates = templates.filter(t =>
        criteria.features!.every(feature => t.features.includes(feature))
      );
    }

    if (criteria.minRating) {
      templates = templates.filter(t => t.metadata.userRating >= criteria.minRating!);
    }

    // Sort
    switch (criteria.sortBy) {
      case 'popularity':
        templates.sort((a, b) => b.metadata.popularity - a.metadata.popularity);
        break;
      case 'rating':
        templates.sort((a, b) => b.metadata.userRating - a.metadata.userRating);
        break;
      case 'recent':
        templates.sort((a, b) => 
          new Date(b.metadata.lastUsed || b.updatedAt).getTime() -
          new Date(a.metadata.lastUsed || a.updatedAt).getTime()
        );
        break;
      case 'name':
        templates.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Apply pagination
    if (criteria.offset) {
      templates = templates.slice(criteria.offset);
    }
    if (criteria.limit) {
      templates = templates.slice(0, criteria.limit);
    }

    return templates;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ProjectTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Setup new project from template
   */
  async setupProject(options: ProjectSetupOptions): Promise<ProjectSetupResult> {
    const startTime = Date.now();
    const result: ProjectSetupResult = {
      success: false,
      projectPath: options.projectPath,
      filesCreated: [],
      dependenciesInstalled: false,
      gitInitialized: false,
      setupDuration: 0,
      errors: [],
      warnings: [],
      nextSteps: []
    };

    try {
      const template = await this.getTemplate(options.templateId);
      if (!template) {
        throw new Error(`Template ${options.templateId} not found`);
      }

      this.emit('projectSetupStarted', { templateId: options.templateId, projectName: options.projectName });

      // Create project directory
      await fs.mkdir(options.projectPath, { recursive: true });

      // Apply template structure
      await this.applyTemplateStructure(template, options, result);

      // Apply customizations
      await this.applyCustomizations(template, options, result);

      // Initialize Git
      if (!options.skipGitInit) {
        await this.initializeGit(options.projectPath, result);
      }

      // Install dependencies
      if (!options.skipDependencies) {
        await this.installDependencies(template, options.projectPath, result);
      }

      // Generate next steps
      result.nextSteps = this.generateNextSteps(template, options);

      // Update template analytics
      await this.updateTemplateAnalytics(template.id, true, Date.now() - startTime);

      result.success = true;
      result.setupDuration = Date.now() - startTime;

      this.emit('projectSetupCompleted', result);

      this.logger.info('Project setup completed', {
        templateId: options.templateId,
        projectName: options.projectName,
        duration: result.setupDuration
      });

    } catch (error) {
      result.errors.push((error as Error).message);
      result.setupDuration = Date.now() - startTime;

      await this.updateTemplateAnalytics(options.templateId, false, result.setupDuration);

      this.emit('projectSetupFailed', { ...result, error });

      this.logger.error('Project setup failed', error as Error, {
        templateId: options.templateId,
        projectName: options.projectName
      });
    }

    return result;
  }

  /**
   * Create custom template
   */
  async createCustomTemplate(definition: CustomTemplateDefinition): Promise<ProjectTemplate> {
    const baseTemplate = definition.basedOn ? await this.getTemplate(definition.basedOn) : null;

    const template: ProjectTemplate = {
      id: this.generateId('custom-tpl'),
      name: definition.name,
      description: definition.description,
      category: definition.category,
      framework: definition.framework,
      language: definition.language,
      features: definition.features,
      structure: {
        ...baseTemplate?.structure,
        ...definition.structure
      } as ProjectStructure,
      dependencies: {
        ...baseTemplate?.dependencies,
        ...definition.dependencies
      } as ProjectDependencies,
      scripts: {
        ...baseTemplate?.scripts,
        ...definition.scripts
      } as ProjectScripts,
      configuration: {
        ...baseTemplate?.configuration,
        ...definition.configuration
      } as ProjectConfiguration,
      customizableOptions: definition.customizableOptions,
      estimatedSetupTime: baseTemplate?.estimatedSetupTime || 300000,
      metadata: {
        author: 'user',
        version: '1.0.0',
        license: 'MIT',
        tags: [...definition.features, definition.framework, definition.language],
        popularity: 0,
        usageCount: 0,
        averageSetupTime: 0,
        successRate: 0,
        userRating: 0,
        compatibility: baseTemplate?.metadata.compatibility || {
          node: '>=16.0.0',
          npm: '>=7.0.0',
          platforms: ['darwin', 'linux', 'win32']
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(template.id, template);
    await this.persistCustomTemplate(template);

    this.emit('customTemplateCreated', template);

    this.logger.info('Custom template created', {
      templateId: template.id,
      name: template.name,
      basedOn: definition.basedOn
    });

    return template;
  }

  /**
   * Update custom template
   */
  async updateCustomTemplate(
    templateId: string,
    updates: Partial<CustomTemplateDefinition>
  ): Promise<ProjectTemplate> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    if (template.metadata.author !== 'user') {
      throw new Error('Can only update custom templates');
    }

    // Apply updates
    Object.assign(template, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await this.persistCustomTemplate(template);

    this.emit('customTemplateUpdated', template);

    this.logger.info('Custom template updated', {
      templateId,
      name: template.name
    });

    return template;
  }

  /**
   * Delete custom template
   */
  async deleteCustomTemplate(templateId: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return;
    }

    if (template.metadata.author !== 'user') {
      throw new Error('Can only delete custom templates');
    }

    this.templates.delete(templateId);

    const templateFile = path.join(this.customTemplatesDir, `${templateId}.json`);
    await fs.unlink(templateFile).catch(() => {});

    this.emit('customTemplateDeleted', templateId);

    this.logger.info('Custom template deleted', {
      templateId,
      name: template.name
    });
  }

  /**
   * Export template
   */
  async exportTemplate(templateId: string, exportPath: string): Promise<void> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    await fs.writeFile(
      exportPath,
      JSON.stringify(template, null, 2),
      'utf-8'
    );

    this.logger.info('Template exported', {
      templateId,
      exportPath
    });
  }

  /**
   * Import template
   */
  async importTemplate(importPath: string): Promise<ProjectTemplate> {
    const content = await fs.readFile(importPath, 'utf-8');
    const templateData = JSON.parse(content) as ProjectTemplate;

    // Generate new ID for imported template
    const template: ProjectTemplate = {
      ...templateData,
      id: this.generateId('imported-tpl'),
      metadata: {
        ...templateData.metadata,
        author: 'imported',
        popularity: 0,
        usageCount: 0,
        averageSetupTime: 0,
        successRate: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(template.id, template);
    await this.persistCustomTemplate(template);

    this.emit('templateImported', template);

    this.logger.info('Template imported', {
      templateId: template.id,
      name: template.name,
      importPath
    });

    return template;
  }

  // Private helper methods

  private async applyTemplateStructure(
    template: ProjectTemplate,
    options: ProjectSetupOptions,
    result: ProjectSetupResult
  ): Promise<void> {
    // Create directories
    for (const dir of template.structure.directories) {
      if (dir.optional && options.customizations[`skip_${dir.path}`]) {
        continue;
      }

      const dirPath = path.join(options.projectPath, dir.path);
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Create files
    for (const file of template.structure.files) {
      if (file.optional && options.customizations[`skip_${file.path}`]) {
        continue;
      }

      if (file.condition && !this.evaluateCondition(file.condition, options.customizations)) {
        continue;
      }

      const filePath = path.join(options.projectPath, file.path);
      const content = await this.renderTemplate(file.template, {
        ...file.variables,
        projectName: options.projectName,
        ...options.customizations
      });

      await fs.writeFile(filePath, content, 'utf-8');
      result.filesCreated.push(file.path);
    }

    // Create .gitignore
    if (template.structure.gitignore.length > 0) {
      const gitignorePath = path.join(options.projectPath, '.gitignore');
      await fs.writeFile(gitignorePath, template.structure.gitignore.join('\n'), 'utf-8');
      result.filesCreated.push('.gitignore');
    }

    // Create README
    const readmeContent = this.generateReadme(template, options);
    const readmePath = path.join(options.projectPath, 'README.md');
    await fs.writeFile(readmePath, readmeContent, 'utf-8');
    result.filesCreated.push('README.md');
  }

  private async applyCustomizations(
    template: ProjectTemplate,
    options: ProjectSetupOptions,
    result: ProjectSetupResult
  ): Promise<void> {
    // Apply configuration customizations
    for (const option of template.customizableOptions) {
      const value = options.customizations[option.id] ?? option.defaultValue;
      
      for (const affected of option.affects) {
        // Handle different customization effects
        if (affected.startsWith('config.')) {
          await this.applyConfigCustomization(template, options, affected, value, result);
        } else if (affected.startsWith('dependency.')) {
          await this.applyDependencyCustomization(template, options, affected, value, result);
        } else if (affected.startsWith('script.')) {
          await this.applyScriptCustomization(template, options, affected, value, result);
        }
      }
    }
  }

  private async applyConfigCustomization(
    template: ProjectTemplate,
    options: ProjectSetupOptions,
    affected: string,
    value: any,
    result: ProjectSetupResult
  ): Promise<void> {
    const [, configType, ...pathParts] = affected.split('.');
    const configPath = pathParts.join('.');

    switch (configType) {
      case 'typescript':
        if (template.configuration.typescript) {
          const tsConfigPath = path.join(options.projectPath, 'tsconfig.json');
          const tsConfig = template.configuration.typescript;
          this.setNestedProperty(tsConfig, configPath, value);
          await fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), 'utf-8');
          if (!result.filesCreated.includes('tsconfig.json')) {
            result.filesCreated.push('tsconfig.json');
          }
        }
        break;
      // Handle other config types...
    }
  }

  private async applyDependencyCustomization(
    template: ProjectTemplate,
    options: ProjectSetupOptions,
    affected: string,
    value: any,
    result: ProjectSetupResult
  ): Promise<void> {
    void template;
    void options;
    void affected;
    void value;
    void result;
    // Implementation for dependency customizations
  }

  private async applyScriptCustomization(
    template: ProjectTemplate,
    options: ProjectSetupOptions,
    affected: string,
    value: any,
    result: ProjectSetupResult
  ): Promise<void> {
    void template;
    void options;
    void affected;
    void value;
    void result;
    // Implementation for script customizations
  }

  private async initializeGit(projectPath: string, result: ProjectSetupResult): Promise<void> {
    try {
      await execAsync('git init', { cwd: projectPath });
      await execAsync('git add .', { cwd: projectPath });
      await execAsync('git commit -m "Initial commit from SessionHub template"', { cwd: projectPath });
      result.gitInitialized = true;
    } catch (error) {
      result.warnings.push(`Git initialization failed: ${(error as Error).message}`);
    }
  }

  private async installDependencies(
    template: ProjectTemplate,
    projectPath: string,
    result: ProjectSetupResult
  ): Promise<void> {
    try {
      // Create package.json
      const packageJson = {
        name: path.basename(projectPath),
        version: '1.0.0',
        description: template.description,
        scripts: template.scripts,
        dependencies: template.dependencies.runtime,
        devDependencies: template.dependencies.dev,
        peerDependencies: template.dependencies.peer,
        optionalDependencies: template.dependencies.optional
      };

      const packageJsonPath = path.join(projectPath, 'package.json');
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
      result.filesCreated.push('package.json');

      // Install dependencies
      const { stdout, stderr } = await execAsync('npm install', { cwd: projectPath });
      
      if (stderr) {
        result.warnings.push(`NPM install warnings: ${stderr}`);
      }

      result.dependenciesInstalled = true;
      this.logger.info('Dependencies installed', { stdout: stdout.slice(0, 200) });
    } catch (error) {
      result.errors.push(`Dependency installation failed: ${(error as Error).message}`);
    }
  }

  private generateReadme(template: ProjectTemplate, options: ProjectSetupOptions): string {
    let content = `# ${options.projectName}\n\n`;
    content += `${template.description}\n\n`;

    for (const section of template.structure.readme.sections.sort((a, b) => a.order - b.order)) {
      content += `## ${section.title}\n\n`;
      content += this.renderTemplateString(section.content, {
        projectName: options.projectName,
        ...options.customizations
      });
      content += '\n\n';
    }

    return content;
  }

  private generateNextSteps(template: ProjectTemplate, options: ProjectSetupOptions): string[] {
    const steps: string[] = [];

    steps.push(`cd ${options.projectPath}`);

    if (!options.skipDependencies && template.scripts.dev) {
      steps.push(`npm run dev`);
    }

    if (template.configuration.docker) {
      steps.push('docker build -t ' + options.projectName + ' .');
    }

    steps.push('Happy coding! 🚀');

    return steps;
  }

  private async renderTemplate(templateName: string, variables: Record<string, any>): Promise<string> {
    // Load template from cache or file
    let templateContent = this.templateCache.get(templateName);
    
    if (!templateContent) {
      const templatePath = path.join(this.templatesDir, 'file-templates', `${templateName}.template`);
      templateContent = await fs.readFile(templatePath, 'utf-8');
      this.templateCache.set(templateName, templateContent);
    }

    return this.renderTemplateString(templateContent, variables);
  }

  private renderTemplateString(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return key in variables ? String(variables[key]) : match;
    });
  }

  private evaluateCondition(condition: string, customizations: Record<string, any>): boolean {
    try {
      // Simple condition evaluation - in production, use a proper expression evaluator
      const func = new Function('customizations', `return ${condition}`);
      return func(customizations);
    } catch {
      return false;
    }
  }

  private setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && !current[part]) {
        current[part] = {};
      }
      if (part) {
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  private async updateTemplateAnalytics(
    templateId: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.metadata.usageCount++;
    template.metadata.lastUsed = new Date().toISOString();

    if (success) {
      const successCount = template.metadata.successRate * (template.metadata.usageCount - 1);
      template.metadata.successRate = (successCount + 1) / template.metadata.usageCount;
    } else {
      const successCount = template.metadata.successRate * (template.metadata.usageCount - 1);
      template.metadata.successRate = successCount / template.metadata.usageCount;
    }

    const totalTime = template.metadata.averageSetupTime * (template.metadata.usageCount - 1);
    template.metadata.averageSetupTime = (totalTime + duration) / template.metadata.usageCount;

    template.updatedAt = new Date().toISOString();

    if (template.metadata.author === 'user' || template.metadata.author === 'imported') {
      await this.persistCustomTemplate(template);
    }
  }

  private async persistCustomTemplate(template: ProjectTemplate): Promise<void> {
    const templatePath = path.join(this.customTemplatesDir, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf-8');
  }

  private async loadBuiltInTemplates(): Promise<void> {
    // Load built-in templates
    this.builtInTemplates = await this.createBuiltInTemplates();
    
    for (const template of this.builtInTemplates) {
      this.templates.set(template.id, template);
    }
  }

  private async loadCustomTemplates(): Promise<void> {
    try {
      const files = await fs.readdir(this.customTemplatesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.customTemplatesDir, file),
            'utf-8'
          );
          const template = JSON.parse(content) as ProjectTemplate;
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load custom templates', error as Error);
    }
  }

  private async createBuiltInTemplates(): Promise<ProjectTemplate[]> {
    return [
      // React TypeScript App
      {
        id: 'react-typescript',
        name: 'React TypeScript App',
        description: 'Modern React application with TypeScript, Vite, and Tailwind CSS',
        category: 'web-app',
        framework: 'React',
        language: 'TypeScript',
        features: ['react', 'typescript', 'vite', 'tailwind', 'eslint', 'prettier'],
        structure: {
          directories: [
            { path: 'src', description: 'Source code', optional: false },
            { path: 'src/components', description: 'React components', optional: false },
            { path: 'src/pages', description: 'Page components', optional: false },
            { path: 'src/hooks', description: 'Custom hooks', optional: false },
            { path: 'src/utils', description: 'Utility functions', optional: false },
            { path: 'src/types', description: 'TypeScript types', optional: false },
            { path: 'src/styles', description: 'Global styles', optional: false },
            { path: 'public', description: 'Static assets', optional: false },
            { path: 'tests', description: 'Test files', optional: true }
          ],
          files: [
            {
              path: 'src/main.tsx',
              template: 'react-main',
              variables: {},
              optional: false
            },
            {
              path: 'src/App.tsx',
              template: 'react-app',
              variables: {},
              optional: false
            },
            {
              path: 'src/index.css',
              template: 'tailwind-css',
              variables: {},
              optional: false
            },
            {
              path: 'index.html',
              template: 'vite-html',
              variables: {},
              optional: false
            },
            {
              path: 'vite.config.ts',
              template: 'vite-config',
              variables: {},
              optional: false
            },
            {
              path: '.eslintrc.json',
              template: 'eslint-react',
              variables: {},
              optional: false
            },
            {
              path: '.prettierrc',
              template: 'prettier-config',
              variables: {},
              optional: false
            },
            {
              path: 'tailwind.config.js',
              template: 'tailwind-config',
              variables: {},
              optional: false
            },
            {
              path: 'postcss.config.js',
              template: 'postcss-config',
              variables: {},
              optional: false
            }
          ],
          gitignore: [
            'node_modules',
            'dist',
            '.env',
            '.env.local',
            '.vscode',
            '.idea',
            '*.log',
            '.DS_Store'
          ],
          readme: {
            sections: [
              {
                title: 'Getting Started',
                content: 'Run `npm install` to install dependencies, then `npm run dev` to start the development server.',
                order: 1
              },
              {
                title: 'Available Scripts',
                content: '- `npm run dev`: Start development server\n- `npm run build`: Build for production\n- `npm run preview`: Preview production build\n- `npm run lint`: Run ESLint\n- `npm run format`: Format code with Prettier',
                order: 2
              }
            ]
          }
        },
        dependencies: {
          runtime: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
          },
          dev: {
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            '@typescript-eslint/eslint-plugin': '^6.0.0',
            '@typescript-eslint/parser': '^6.0.0',
            '@vitejs/plugin-react': '^4.0.0',
            'autoprefixer': '^10.4.0',
            'eslint': '^8.0.0',
            'eslint-plugin-react': '^7.0.0',
            'eslint-plugin-react-hooks': '^4.0.0',
            'postcss': '^8.4.0',
            'prettier': '^3.0.0',
            'tailwindcss': '^3.3.0',
            'typescript': '^5.0.0',
            'vite': '^4.0.0'
          }
        },
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
          lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
          format: 'prettier --write "src/**/*.{ts,tsx,css}"',
          test: 'vitest'
        },
        configuration: {
          typescript: {
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true
            },
            include: ['src'],
            exclude: ['node_modules']
          },
          vite: {
            plugins: ['@vitejs/plugin-react'],
            server: {
              port: 3000,
              open: true
            },
            build: {
              outDir: 'dist',
              sourcemap: true
            }
          }
        },
        customizableOptions: [
          {
            id: 'includeRouter',
            name: 'Include React Router',
            description: 'Add React Router for client-side routing',
            type: 'boolean',
            defaultValue: true,
            affects: ['dependency.runtime.react-router-dom', 'dependency.dev.@types/react-router-dom']
          },
          {
            id: 'includeTests',
            name: 'Include Testing Setup',
            description: 'Add Vitest and React Testing Library',
            type: 'boolean',
            defaultValue: true,
            affects: ['dependency.dev.vitest', 'dependency.dev.@testing-library/react']
          },
          {
            id: 'includeStateManagement',
            name: 'State Management',
            description: 'Choose state management solution',
            type: 'select',
            defaultValue: 'none',
            options: ['none', 'redux', 'zustand', 'mobx'],
            affects: ['dependency.runtime.state-management']
          }
        ],
        estimatedSetupTime: 180000, // 3 minutes
        metadata: {
          author: 'system',
          version: '1.0.0',
          license: 'MIT',
          tags: ['react', 'typescript', 'vite', 'tailwind', 'spa'],
          popularity: 100,
          usageCount: 0,
          averageSetupTime: 180000,
          successRate: 1.0,
          userRating: 4.8,
          compatibility: {
            node: '>=16.0.0',
            npm: '>=7.0.0',
            platforms: ['darwin', 'linux', 'win32']
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      
      // Next.js TypeScript App
      {
        id: 'nextjs-typescript',
        name: 'Next.js TypeScript App',
        description: 'Full-stack Next.js application with TypeScript, Tailwind CSS, and App Router',
        category: 'fullstack',
        framework: 'Next.js',
        language: 'TypeScript',
        features: ['nextjs', 'typescript', 'tailwind', 'app-router', 'eslint', 'prettier'],
        structure: {
          directories: [
            { path: 'app', description: 'App Router pages and layouts', optional: false },
            { path: 'components', description: 'Shared components', optional: false },
            { path: 'lib', description: 'Utility functions and shared code', optional: false },
            { path: 'public', description: 'Static assets', optional: false },
            { path: 'styles', description: 'Global styles', optional: false },
            { path: 'types', description: 'TypeScript type definitions', optional: false },
            { path: 'hooks', description: 'Custom React hooks', optional: true },
            { path: 'services', description: 'API services', optional: true },
            { path: 'tests', description: 'Test files', optional: true }
          ],
          files: [
            {
              path: 'app/layout.tsx',
              template: 'nextjs-root-layout',
              variables: {},
              optional: false
            },
            {
              path: 'app/page.tsx',
              template: 'nextjs-home-page',
              variables: {},
              optional: false
            },
            {
              path: 'app/globals.css',
              template: 'nextjs-globals-css',
              variables: {},
              optional: false
            },
            {
              path: 'next.config.js',
              template: 'nextjs-config',
              variables: {},
              optional: false
            },
            {
              path: 'tailwind.config.ts',
              template: 'nextjs-tailwind-config',
              variables: {},
              optional: false
            },
            {
              path: 'postcss.config.js',
              template: 'postcss-config',
              variables: {},
              optional: false
            },
            {
              path: '.eslintrc.json',
              template: 'eslint-nextjs',
              variables: {},
              optional: false
            },
            {
              path: '.prettierrc',
              template: 'prettier-config',
              variables: {},
              optional: false
            },
            {
              path: 'middleware.ts',
              template: 'nextjs-middleware',
              variables: {},
              optional: true,
              condition: 'customizations.includeAuth'
            }
          ],
          gitignore: [
            'node_modules',
            '.next',
            'out',
            'dist',
            '.env',
            '.env.local',
            '.env.production',
            '.vscode',
            '.idea',
            '*.log',
            '.DS_Store',
            '.vercel'
          ],
          readme: {
            sections: [
              {
                title: 'Getting Started',
                content: 'Run `npm install` to install dependencies, then `npm run dev` to start the development server at http://localhost:3000.',
                order: 1
              },
              {
                title: 'Project Structure',
                content: 'This project uses the Next.js App Router. Pages are defined in the `app` directory.',
                order: 2
              },
              {
                title: 'Available Scripts',
                content: '- `npm run dev`: Start development server\n- `npm run build`: Build for production\n- `npm run start`: Start production server\n- `npm run lint`: Run ESLint\n- `npm run format`: Format code with Prettier',
                order: 3
              }
            ]
          }
        },
        dependencies: {
          runtime: {
            'next': '^14.0.0',
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
          },
          dev: {
            '@types/node': '^20.0.0',
            '@types/react': '^18.2.0',
            '@types/react-dom': '^18.2.0',
            'autoprefixer': '^10.4.0',
            'eslint': '^8.0.0',
            'eslint-config-next': '^14.0.0',
            'postcss': '^8.4.0',
            'prettier': '^3.0.0',
            'tailwindcss': '^3.3.0',
            'typescript': '^5.0.0'
          }
        },
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
          format: 'prettier --write "**/*.{ts,tsx,js,jsx,json,css,md}"',
          typecheck: 'tsc --noEmit',
          test: 'jest'
        },
        configuration: {
          typescript: {
            compilerOptions: {
              target: 'es5',
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'node',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: {
                '@/*': ['./*']
              }
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules']
          },
          nextjs: {
            reactStrictMode: true,
            images: {
              domains: []
            }
          }
        },
        customizableOptions: [
          {
            id: 'includeAuth',
            name: 'Include Authentication',
            description: 'Add NextAuth.js for authentication',
            type: 'boolean',
            defaultValue: false,
            affects: ['dependency.runtime.next-auth', 'dependency.dev.@types/next-auth']
          },
          {
            id: 'includeDatabase',
            name: 'Database Integration',
            description: 'Choose database ORM',
            type: 'select',
            defaultValue: 'none',
            options: ['none', 'prisma', 'drizzle', 'mongoose'],
            affects: ['dependency.runtime.database-orm']
          },
          {
            id: 'includeAPI',
            name: 'API Routes',
            description: 'Include example API routes',
            type: 'boolean',
            defaultValue: true,
            affects: ['structure.directories.api']
          }
        ],
        estimatedSetupTime: 240000, // 4 minutes
        metadata: {
          author: 'system',
          version: '1.0.0',
          license: 'MIT',
          tags: ['nextjs', 'typescript', 'tailwind', 'fullstack', 'ssr'],
          popularity: 95,
          usageCount: 0,
          averageSetupTime: 240000,
          successRate: 1.0,
          userRating: 4.9,
          compatibility: {
            node: '>=18.17.0',
            npm: '>=7.0.0',
            platforms: ['darwin', 'linux', 'win32']
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}