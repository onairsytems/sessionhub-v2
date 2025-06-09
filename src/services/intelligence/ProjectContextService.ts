import { Logger } from '@/src/lib/logging/Logger';
import { SupabaseService } from '@/src/services/cloud/SupabaseService';
import { PatternRecognitionService } from './PatternRecognitionService';
import { MetadataExtractor } from './MetadataExtractor';
import {
  BaseProjectContext,
  ProjectType,
  Framework,
  Library,
  ArchitecturePattern,
  ProjectStructure,
  QualityMetrics,
  WebAppContext,
  APIContext,
  ElectronContext,
  MLContext,
  ContextVersion,
  ContextChange,
  ContextAnalysisResult
} from '@/src/models/ProjectContext';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export class ProjectContextService {
  private static instance: ProjectContextService;
  private logger = new Logger('ProjectContextService');
  private supabase = new SupabaseService(new Logger('SupabaseService'));
  private patternService = new PatternRecognitionService();
  private metadataExtractor = new MetadataExtractor();
  
  // Context cache with TTL
  private contextCache = new Map<string, {
    context: BaseProjectContext;
    timestamp: number;
  }>();
  
  // Context versions for tracking changes
  private contextVersions = new Map<string, ContextVersion[]>();
  
  // Cache duration: 10 minutes
  private readonly CACHE_TTL = 600000;
  
  private constructor() {
    this.logger.info('Initializing ProjectContextService');
  }
  
  static getInstance(): ProjectContextService {
    if (!ProjectContextService.instance) {
      ProjectContextService.instance = new ProjectContextService();
    }
    return ProjectContextService.instance;
  }
  
  /**
   * Analyze a project and extract comprehensive context
   */
  async analyzeProjectContext(projectPath: string, projectId: string): Promise<ContextAnalysisResult> {
    this.logger.info(`Analyzing project context for: ${projectPath}`);
    
    try {
      // Check cache first
      const cached = this.getFromCache(projectId);
      if (cached) {
        return {
          context: cached,
          confidence: 1.0,
          warnings: ['Using cached context']
        };
      }
      
      // Detect project type
      const projectType = await this._detectProjectType(projectPath);
      
      // Extract base context
      const baseContext = await this._extractBaseContext(projectPath, projectId, projectType);
      
      // Extract specialized context based on project type
      let context: BaseProjectContext;
      switch (projectType) {
        case ProjectType.WEB_APP:
        case ProjectType.NEXTJS:
        case ProjectType.REACT:
          context = await this._extractWebAppContext(baseContext, projectPath);
          break;
        case ProjectType.API:
        case ProjectType.MICROSERVICE:
          context = await this._extractAPIContext(baseContext, projectPath);
          break;
        case ProjectType.ELECTRON:
          context = await this._extractElectronContext(baseContext, projectPath);
          break;
        case ProjectType.MACHINE_LEARNING:
          context = await this._extractMLContext(baseContext, projectPath);
          break;
        default:
          context = baseContext;
      }
      
      // Generate embeddings for RAG
      context.embeddings = await this.generateContextEmbeddings(context);
      
      // Generate summary
      context.summary = await this.generateContextSummary(context);
      
      // Store in cache
      this.cacheContext(projectId, context);
      
      // Track version if context changed
      await this.trackContextVersion(projectId, context);
      
      // Store in Supabase
      await this.storeContext(context);
      
      // Get related patterns
      const relatedPatterns = await this.getRelatedPatterns(context);
      
      return {
        context,
        confidence: 0.95,
        suggestions: this.generateSuggestions(context),
        relatedPatterns
      };
      
    } catch (error) {
      this.logger.error('Failed to analyze project context', error as Error);
      throw error;
    }
  }
  
  /**
   * Detect project type based on files and structure
   */
  private async _detectProjectType(_projectPath: string): Promise<ProjectType> {
    try {
      // Check for specific framework indicators
      const files = await this.getProjectFiles(_projectPath);
      
      // Electron detection
      if (files.some(f => f.includes('electron')) && 
          this.hasFile(_projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(_projectPath, 'package.json'), 'utf-8'));
        if (pkg.main && (pkg.dependencies?.electron || pkg.devDependencies?.electron)) {
          return ProjectType.ELECTRON;
        }
      }
      
      // Next.js detection
      if (this.hasFile(_projectPath, 'next.config.js') || 
          this.hasFile(_projectPath, 'next.config.ts') ||
          files.some(f => f.includes('pages') || f.includes('app'))) {
        return ProjectType.NEXTJS;
      }
      
      // React detection
      if (this.hasFile(_projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(_projectPath, 'package.json'), 'utf-8'));
        if (pkg.dependencies?.react || pkg.devDependencies?.react) {
          return ProjectType.REACT;
        }
      }
      
      // API detection
      if (files.some(f => f.includes('routes') || f.includes('controllers') || 
                         f.includes('api') || f.includes('endpoints'))) {
        return ProjectType.API;
      }
      
      // ML detection
      if (files.some(f => f.includes('.ipynb') || f.includes('model') || 
                         f.includes('train') || f.includes('dataset'))) {
        return ProjectType.MACHINE_LEARNING;
      }
      
      // Python project
      if (files.some(f => f.endsWith('.py')) && 
          (this.hasFile(_projectPath, 'setup.py') || 
           this.hasFile(_projectPath, 'pyproject.toml'))) {
        return ProjectType.PYTHON;
      }
      
      // Node.js project
      if (this.hasFile(_projectPath, 'package.json')) {
        return ProjectType.NODE;
      }
      
      // CLI tool
      if (files.some(f => f.includes('cli') || f.includes('bin'))) {
        return ProjectType.CLI;
      }
      
      return ProjectType.UNKNOWN;
      
    } catch (error) {
      this.logger.error('Failed to detect project type', error as Error);
      return ProjectType.UNKNOWN;
    }
  }
  
  /**
   * Extract base context common to all project types
   */
  private async _extractBaseContext(
    projectPath: string,
    projectId: string,
    projectType: ProjectType
  ): Promise<BaseProjectContext> {
    const now = new Date();
    
    // Use enhanced metadata extractor
    const metadata = await this.metadataExtractor.extractProjectMetadata(projectPath);
    
    // Calculate additional quality metrics
    const metrics = await this._calculateQualityMetrics(projectPath);
    
    return {
      projectId,
      projectType,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      name: path.basename(projectPath),
      language: this.detectPrimaryLanguage(metadata.structure),
      frameworks: metadata.frameworks,
      libraries: metadata.libraries,
      architecturePatterns: metadata.architecturePatterns,
      testingFrameworks: metadata.testingFrameworks,
      buildTools: metadata.buildTools,
      structure: metadata.structure,
      metrics,
      summary: '' // Will be generated later
    };
  }
  
  /**
   * Extract web app specific context
   */
  private async _extractWebAppContext(
    baseContext: BaseProjectContext,
    projectPath: string
  ): Promise<WebAppContext> {
    const webContext = baseContext as WebAppContext;
    
    // Detect web framework
    webContext.webFramework = await this._detectWebFramework(projectPath);
    
    // Detect CSS framework
    webContext.cssFramework = await this._detectCSSFramework(projectPath);
    
    // Detect state management
    webContext.stateManagement = await this._detectStateManagement(projectPath);
    
    // Detect routing
    webContext.routing = await this._detectRouting(projectPath);
    
    // Detect API integration
    webContext.apiIntegration = await this._detectAPIIntegration(projectPath);
    
    // Extract build configuration
    webContext.buildConfig = await this._extractBuildConfig(projectPath);
    
    return webContext;
  }
  
  /**
   * Extract API specific context
   */
  private async _extractAPIContext(
    baseContext: BaseProjectContext,
    projectPath: string
  ): Promise<APIContext> {
    const apiContext = baseContext as APIContext;
    
    // Detect API framework
    apiContext.apiFramework = await this._detectAPIFramework(projectPath);
    
    // Detect API protocol
    apiContext.apiProtocol = await this._detectAPIProtocol(projectPath);
    
    // Detect databases
    apiContext.databases = await this._detectDatabases(projectPath);
    
    // Detect documentation
    apiContext.documentation = await this._detectAPIDocumentation(projectPath);
    
    // Detect authentication
    apiContext.authentication = await this._detectAuthentication(projectPath);
    
    return apiContext;
  }
  
  /**
   * Extract Electron specific context
   */
  private async _extractElectronContext(
    baseContext: BaseProjectContext,
    projectPath: string
  ): Promise<ElectronContext> {
    const electronContext = baseContext as ElectronContext;
    
    // Extract Electron version and config
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
    electronContext.electronVersion = pkg.dependencies?.electron || pkg.devDependencies?.electron || 'unknown';
    
    // Analyze main process
    electronContext.mainProcess = await this._analyzeMainProcess(projectPath);
    
    // Analyze renderer process
    electronContext.rendererProcess = await this._analyzeRendererProcess(projectPath);
    
    // Check security settings
    electronContext.nodeIntegration = await this._checkNodeIntegration(projectPath);
    electronContext.contextIsolation = await this._checkContextIsolation(projectPath);
    
    // Detect platform features
    electronContext.platformFeatures = await this._detectPlatformFeatures(projectPath);
    
    return electronContext;
  }
  
  /**
   * Extract ML specific context
   */
  private async _extractMLContext(
    baseContext: BaseProjectContext,
    projectPath: string
  ): Promise<MLContext> {
    const mlContext = baseContext as MLContext;
    
    // Detect ML framework
    mlContext.mlFramework = await this._detectMLFramework(projectPath);
    
    // Detect ML type
    mlContext.mlType = await this._detectMLType(projectPath);
    
    // Find models
    mlContext.models = await this._findMLModels(projectPath);
    
    // Analyze data pipeline
    mlContext.dataPipeline = await this._analyzeDataPipeline(projectPath);
    
    // Extract training config
    mlContext.training = await this._extractTrainingConfig(projectPath);
    
    return mlContext;
  }
  
  /**
   * Generate embeddings for context using existing RAG system
   */
  private async generateContextEmbeddings(context: BaseProjectContext): Promise<number[]> {
    // Convert context to string representation
    const contextString = JSON.stringify({
      projectType: context.projectType,
      language: context.language,
      frameworks: context.frameworks.map((f: Framework) => f.name),
      libraries: context.libraries.map((l: Library) => l.name),
      architecturePatterns: context.architecturePatterns.map((p: ArchitecturePattern) => p.pattern),
      summary: context.summary
    });
    
    // Generate embeddings using the hash as a simple vector
    // In production, this would use a proper embedding model
    const hash = createHash('sha256').update(contextString).digest();
    const embeddings: number[] = [];
    for (let i = 0; i < 32; i++) {
      embeddings.push(hash[i]! / 255);
    }
    
    return embeddings;
  }
  
  /**
   * Generate context summary for quick reference
   */
  private async generateContextSummary(context: BaseProjectContext): Promise<string> {
    const parts: string[] = [];
    
    // Project type and language
    parts.push(`${context.projectType.replace(/_/g, ' ')} project in ${context.language}`);
    
    // Main framework
    if (context.frameworks.length > 0) {
      const mainFramework = context.frameworks
        .sort((a: Framework, b: Framework) => b.confidence - a.confidence)[0];
      parts.push(`using ${mainFramework!.name}`);
    }
    
    // Architecture patterns
    if (context.architecturePatterns.length > 0) {
      const patterns = context.architecturePatterns
        .slice(0, 2)
        .map((p: ArchitecturePattern) => p.pattern)
        .join(' and ');
      parts.push(`with ${patterns} architecture`);
    }
    
    // Testing
    if (context.testingFrameworks.length > 0) {
      parts.push(`tested with ${context.testingFrameworks[0]!.name}`);
    }
    
    // Quality metrics
    if (context.metrics.testCoverage) {
      parts.push(`(${context.metrics.testCoverage}% test coverage)`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Get related patterns based on context
   */
  private async getRelatedPatterns(context: BaseProjectContext): Promise<string[]> {
    const patterns = await this.patternService.getSuggestionsForContext({
      projectType: context.projectType,
      language: context.language,
      framework: context.frameworks[0]?.name
    });
    
    return patterns
      .filter((p: any) => p.relevanceScore > 0.7)
      .map((p: any) => p.pattern.id);
  }
  
  /**
   * Generate suggestions based on context analysis
   */
  private generateSuggestions(context: BaseProjectContext): string[] {
    const suggestions: string[] = [];
    
    // Testing suggestions
    if (context.testingFrameworks.length === 0) {
      suggestions.push('Consider adding unit tests to improve code quality');
    }
    
    // Type safety suggestions
    if (context.language === 'javascript' && !context.frameworks.some((f: Framework) => f.name === 'typescript')) {
      suggestions.push('Consider migrating to TypeScript for better type safety');
    }
    
    // Architecture suggestions
    if (!context.architecturePatterns.some((p: ArchitecturePattern) => p.pattern.includes('layer'))) {
      suggestions.push('Consider implementing a layered architecture for better separation of concerns');
    }
    
    // Performance suggestions
    if (context.metrics.performanceScore && context.metrics.performanceScore < 70) {
      suggestions.push('Performance optimization needed - consider code splitting and lazy loading');
    }
    
    return suggestions;
  }
  
  /**
   * Track context versions
   */
  private async trackContextVersion(projectId: string, newContext: BaseProjectContext): Promise<void> {
    const versions = this.contextVersions.get(projectId) || [];
    
    if (versions.length > 0) {
      const lastVersion = versions[versions.length - 1];
      const changes = this.detectContextChanges(lastVersion!.snapshot, newContext);
      
      if (changes.length > 0) {
        const newVersion: ContextVersion = {
          version: this.incrementVersion(lastVersion!.version),
          timestamp: new Date(),
          changes,
          snapshot: JSON.parse(JSON.stringify(newContext))
        };
        
        versions.push(newVersion);
        this.contextVersions.set(projectId, versions);
        
        // Keep only last 10 versions
        if (versions.length > 10) {
          versions.shift();
        }
      }
    } else {
      // First version
      const firstVersion: ContextVersion = {
        version: '1.0.0',
        timestamp: new Date(),
        changes: [],
        snapshot: JSON.parse(JSON.stringify(newContext))
      };
      
      this.contextVersions.set(projectId, [firstVersion]);
    }
  }
  
  /**
   * Store context in Supabase
   */
  private async storeContext(context: BaseProjectContext): Promise<void> {
    try {
      const { error } = await this.supabase.getClient()
        .from('project_contexts')
        .upsert({
          project_id: context.projectId,
          context_data: context,
          embeddings: context.embeddings,
          summary: context.summary,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        throw error;
      }
      
      this.logger.info(`Stored context for project ${context.projectId}`);
    } catch (error) {
      this.logger.error('Failed to store context in Supabase', error as Error);
    }
  }
  
  /**
   * Get context for Planning Actor
   */
  async getContextForPlanning(projectId: string): Promise<BaseProjectContext | null> {
    try {
      // Check cache first
      const cached = this.getFromCache(projectId);
      if (cached) {
        return cached;
      }
      
      // Fetch from Supabase
      const { data, error } = await this.supabase.getClient()
        .from('project_contexts')
        .select('context_data')
        .eq('project_id', projectId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      const context = data.context_data as BaseProjectContext;
      this.cacheContext(projectId, context);
      
      return context;
    } catch (error) {
      this.logger.error('Failed to get context for planning', error as Error);
      return null;
    }
  }
  
  /**
   * Search similar contexts using embeddings
   */
  async searchSimilarContexts(
    context: BaseProjectContext,
    limit: number = 5
  ): Promise<BaseProjectContext[]> {
    if (!context.embeddings) {
      return [];
    }
    
    try {
      // In a real implementation, this would use vector similarity search
      // For now, we'll do a simple type and language match
      const { data, error } = await this.supabase.getClient()
        .from('project_contexts')
        .select('context_data')
        .eq('context_data->projectType', context.projectType)
        .eq('context_data->language', context.language)
        .limit(limit);
      
      if (error || !data) {
        return [];
      }
      
      return data.map((d: any) => d.context_data as BaseProjectContext);
    } catch (error) {
      this.logger.error('Failed to search similar contexts', error as Error);
      return [];
    }
  }
  
  // Utility methods
  
  private getFromCache(projectId: string): BaseProjectContext | null {
    const cached = this.contextCache.get(projectId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.context;
    }
    return null;
  }
  
  private cacheContext(projectId: string, context: BaseProjectContext): void {
    this.contextCache.set(projectId, {
      context,
      timestamp: Date.now()
    });
  }
  
  private hasFile(projectPath: string, fileName: string): boolean {
    return fs.existsSync(path.join(projectPath, fileName));
  }
  
  private async getProjectFiles(_projectPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and hidden directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(path.relative(_projectPath, fullPath));
        }
      }
    };
    
    walk(_projectPath);
    return files;
  }
  
  private detectPrimaryLanguage(structure: ProjectStructure): string {
    if (structure.primaryLanguages.length === 0) {
      return 'unknown';
    }
    return structure.primaryLanguages[0]!.language;
  }
  
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]!) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }
  
  private detectContextChanges(
    oldContext: BaseProjectContext,
    newContext: BaseProjectContext
  ): ContextChange[] {
    const changes: ContextChange[] = [];
    
    // Check frameworks
    if (JSON.stringify(oldContext.frameworks) !== JSON.stringify(newContext.frameworks)) {
      changes.push({
        field: 'frameworks',
        oldValue: oldContext.frameworks,
        newValue: newContext.frameworks,
        reason: 'Framework dependencies changed'
      });
    }
    
    // Check libraries
    if (JSON.stringify(oldContext.libraries) !== JSON.stringify(newContext.libraries)) {
      changes.push({
        field: 'libraries',
        oldValue: oldContext.libraries,
        newValue: newContext.libraries,
        reason: 'Library dependencies changed'
      });
    }
    
    // Check architecture patterns
    if (JSON.stringify(oldContext.architecturePatterns) !== JSON.stringify(newContext.architecturePatterns)) {
      changes.push({
        field: 'architecturePatterns',
        oldValue: oldContext.architecturePatterns,
        newValue: newContext.architecturePatterns,
        reason: 'Architecture patterns evolved'
      });
    }
    
    return changes;
  }
  
  // Placeholder methods for specific detections
  // These would be implemented with actual detection logic
  
  
  private async _calculateQualityMetrics(_projectPath: string): Promise<QualityMetrics> {
    // Implementation would calculate actual metrics
    return {
      lastAnalyzed: new Date()
    };
  }
  
  private async _detectWebFramework(_projectPath: string): Promise<'next' | 'react' | 'vue' | 'angular' | 'svelte' | 'other'> {
    // Implementation would detect web framework
    return 'other';
  }
  
  private async _detectCSSFramework(_projectPath: string): Promise<'tailwind' | 'mui' | 'bootstrap' | 'styled-components' | 'other' | undefined> {
    // Implementation would detect CSS framework
    return undefined;
  }
  
  private async _detectStateManagement(_projectPath: string): Promise<'redux' | 'zustand' | 'mobx' | 'context' | 'other' | undefined> {
    // Implementation would detect state management
    return undefined;
  }
  
  private async _detectRouting(_projectPath: string): Promise<'pages' | 'app' | 'react-router' | 'other' | undefined> {
    // Implementation would detect routing approach
    return undefined;
  }
  
  private async _detectAPIIntegration(_projectPath: string): Promise<{
    type: 'rest' | 'graphql' | 'trpc' | 'other';
    client?: string;
  } | undefined> {
    // Implementation would detect API integration
    return undefined;
  }
  
  private async _extractBuildConfig(_projectPath: string): Promise<{
    bundler: 'webpack' | 'vite' | 'parcel' | 'turbopack' | 'other';
    transpiler: 'babel' | 'swc' | 'tsc' | 'other';
    outputFormat: 'esm' | 'cjs' | 'umd' | 'iife';
  }> {
    // Implementation would extract build configuration
    return {
      bundler: 'other',
      transpiler: 'other',
      outputFormat: 'esm'
    };
  }
  
  private async _detectAPIFramework(_projectPath: string): Promise<'express' | 'fastify' | 'koa' | 'hapi' | 'nestjs' | 'other'> {
    // Implementation would detect API framework
    return 'other';
  }
  
  private async _detectAPIProtocol(_projectPath: string): Promise<'rest' | 'graphql' | 'grpc' | 'websocket' | 'other'> {
    // Implementation would detect API protocol
    return 'rest';
  }
  
  private async _detectDatabases(_projectPath: string): Promise<{
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'other';
    orm?: string;
    migrations?: boolean;
  }[] | undefined> {
    // Implementation would detect databases
    return undefined;
  }
  
  private async _detectAPIDocumentation(_projectPath: string): Promise<{
    type: 'openapi' | 'graphql-schema' | 'asyncapi' | 'other';
    path?: string;
  } | undefined> {
    // Implementation would detect API documentation
    return undefined;
  }
  
  private async _detectAuthentication(_projectPath: string): Promise<{
    type: 'jwt' | 'oauth' | 'basic' | 'api-key' | 'other';
    provider?: string;
  } | undefined> {
    // Implementation would detect authentication
    return undefined;
  }
  
  private async _analyzeMainProcess(_projectPath: string): Promise<{
    entryPoint: string;
    ipcHandlers: string[];
    services: string[];
  }> {
    // Implementation would analyze Electron main process
    return {
      entryPoint: 'main/background.ts',
      ipcHandlers: [],
      services: []
    };
  }
  
  private async _analyzeRendererProcess(_projectPath: string): Promise<{
    framework: 'react' | 'vue' | 'angular' | 'vanilla' | 'other';
    entryPoints: string[];
  }> {
    // Implementation would analyze Electron renderer process
    return {
      framework: 'react',
      entryPoints: []
    };
  }
  
  private async _checkNodeIntegration(_projectPath: string): Promise<boolean> {
    // Implementation would check Electron security settings
    return false;
  }
  
  private async _checkContextIsolation(_projectPath: string): Promise<boolean> {
    // Implementation would check Electron security settings
    return true;
  }
  
  private async _detectPlatformFeatures(_projectPath: string): Promise<{
    autoUpdater: boolean;
    nativeModules: string[];
    systemIntegration: string[];
  }> {
    // Implementation would detect platform features
    return {
      autoUpdater: false,
      nativeModules: [],
      systemIntegration: []
    };
  }
  
  private async _detectMLFramework(_projectPath: string): Promise<'tensorflow' | 'pytorch' | 'scikit-learn' | 'keras' | 'other'> {
    // Implementation would detect ML framework
    return 'other';
  }
  
  private async _detectMLType(_projectPath: string): Promise<'classification' | 'regression' | 'clustering' | 'nlp' | 'cv' | 'other'> {
    // Implementation would detect ML type
    return 'other';
  }
  
  private async _findMLModels(_projectPath: string): Promise<{
    name: string;
    type: string;
    path: string;
    format: string;
  }[] | undefined> {
    // Implementation would find ML models
    return undefined;
  }
  
  private async _analyzeDataPipeline(_projectPath: string): Promise<{
    sources: string[];
    preprocessing: string[];
    features: string[];
  } | undefined> {
    // Implementation would analyze data pipeline
    return undefined;
  }
  
  private async _extractTrainingConfig(_projectPath: string): Promise<{
    framework: string;
    distributed: boolean;
    gpu: boolean;
  } | undefined> {
    // Implementation would extract training configuration
    return undefined;
  }
}