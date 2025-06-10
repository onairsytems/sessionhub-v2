import { Logger } from '../../lib/logging/Logger';
import { SupabaseService } from '../cloud/SupabaseService';
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
} from '../../models/ProjectContext';
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
   * Search similar contexts using embeddings and similarity metrics
   */
  async searchSimilarContexts(
    context: BaseProjectContext,
    limit: number = 5
  ): Promise<BaseProjectContext[]> {
    try {
      // Get all contexts for comparison
      const { data, error } = await this.supabase.getClient()
        .from('project_contexts')
        .select('context_data, embeddings')
        .neq('project_id', context.projectId);
      
      if (error || !data) {
        return [];
      }
      
      // Calculate similarity scores
      const similarities: Array<{
        context: BaseProjectContext;
        similarity: number;
      }> = [];
      
      for (const row of data) {
        const otherContext = row.context_data as BaseProjectContext;
        const similarity = this.calculateContextSimilarity(context, otherContext, row.embeddings);
        
        similarities.push({
          context: otherContext,
          similarity
        });
      }
      
      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .filter(s => s.similarity > 0.3) // Only return contexts with meaningful similarity
        .map(s => s.context);
        
    } catch (error) {
      this.logger.error('Failed to search similar contexts', error as Error);
      return [];
    }
  }

  /**
   * Calculate similarity between two project contexts
   */
  private calculateContextSimilarity(
    contextA: BaseProjectContext,
    contextB: BaseProjectContext,
    embeddingsB?: number[]
  ): number {
    let totalScore = 0;
    let weightSum = 0;
    
    // Language similarity (weight: 0.3)
    const languageWeight = 0.3;
    const languageScore = contextA.language === contextB.language ? 1 : 0;
    totalScore += languageScore * languageWeight;
    weightSum += languageWeight;
    
    // Project type similarity (weight: 0.25)
    const typeWeight = 0.25;
    const typeScore = contextA.projectType === contextB.projectType ? 1 : 
                     this.getProjectTypeSimilarity(contextA.projectType, contextB.projectType);
    totalScore += typeScore * typeWeight;
    weightSum += typeWeight;
    
    // Framework similarity (weight: 0.2)
    const frameworkWeight = 0.2;
    const frameworkScore = this.calculateFrameworkSimilarity(contextA.frameworks, contextB.frameworks);
    totalScore += frameworkScore * frameworkWeight;
    weightSum += frameworkWeight;
    
    // Architecture pattern similarity (weight: 0.15)
    const architectureWeight = 0.15;
    const architectureScore = this.calculateArchitectureSimilarity(
      contextA.architecturePatterns, 
      contextB.architecturePatterns
    );
    totalScore += architectureScore * architectureWeight;
    weightSum += architectureWeight;
    
    // Embedding similarity (weight: 0.1) - if available
    if (contextA.embeddings && embeddingsB) {
      const embeddingWeight = 0.1;
      const embeddingScore = this.calculateEmbeddingSimilarity(contextA.embeddings, embeddingsB);
      totalScore += embeddingScore * embeddingWeight;
      weightSum += embeddingWeight;
    }
    
    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Calculate similarity between project types
   */
  private getProjectTypeSimilarity(typeA: string, typeB: string): number {
    // Define related project types
    const typeGroups = [
      ['WEB_APP', 'NEXTJS', 'REACT', 'VUE', 'ANGULAR'],
      ['API', 'MICROSERVICE', 'BACKEND'],
      ['MOBILE', 'REACT_NATIVE', 'FLUTTER'],
      ['DESKTOP', 'ELECTRON', 'TAURI'],
      ['MACHINE_LEARNING', 'DATA_SCIENCE', 'AI']
    ];
    
    // Find if both types are in the same group
    for (const group of typeGroups) {
      if (group.includes(typeA) && group.includes(typeB)) {
        return 0.7; // High similarity for related types
      }
    }
    
    return 0; // No similarity
  }

  /**
   * Calculate similarity between framework lists
   */
  private calculateFrameworkSimilarity(frameworksA: Framework[], frameworksB: Framework[]): number {
    if (frameworksA.length === 0 && frameworksB.length === 0) return 1;
    if (frameworksA.length === 0 || frameworksB.length === 0) return 0;
    
    const namesA = new Set(frameworksA.map(f => f.name.toLowerCase()));
    const namesB = new Set(frameworksB.map(f => f.name.toLowerCase()));
    
    const intersection = new Set([...namesA].filter(name => namesB.has(name)));
    const union = new Set([...namesA, ...namesB]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Calculate similarity between architecture patterns
   */
  private calculateArchitectureSimilarity(
    patternsA: ArchitecturePattern[], 
    patternsB: ArchitecturePattern[]
  ): number {
    if (patternsA.length === 0 && patternsB.length === 0) return 1;
    if (patternsA.length === 0 || patternsB.length === 0) return 0;
    
    const namesA = new Set(patternsA.map(p => p.pattern.toLowerCase()));
    const namesB = new Set(patternsB.map(p => p.pattern.toLowerCase()));
    
    const intersection = new Set([...namesA].filter(name => namesB.has(name)));
    const union = new Set([...namesA, ...namesB]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private calculateEmbeddingSimilarity(embeddingsA: number[], embeddingsB: number[]): number {
    if (embeddingsA.length !== embeddingsB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < embeddingsA.length; i++) {
      dotProduct += embeddingsA[i]! * embeddingsB[i]!;
      normA += embeddingsA[i]! * embeddingsA[i]!;
      normB += embeddingsB[i]! * embeddingsB[i]!;
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
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
  
  private async _detectWebFramework(projectPath: string): Promise<'next' | 'react' | 'vue' | 'angular' | 'svelte' | 'other'> {
    try {
      // Check for Next.js
      if (this.hasFile(projectPath, 'next.config.js') || 
          this.hasFile(projectPath, 'next.config.ts') ||
          this.hasFile(projectPath, 'next.config.mjs')) {
        return 'next';
      }
      
      // Check package.json for framework dependencies
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.next) return 'next';
        if (deps.vue || deps['@vue/cli-service']) return 'vue';
        if (deps['@angular/core']) return 'angular';
        if (deps.svelte || deps['@sveltejs/kit']) return 'svelte';
        if (deps.react) return 'react';
      }
      
      // Check for framework-specific files
      const files = await this.getProjectFiles(projectPath);
      if (files.some(f => f.endsWith('.vue'))) return 'vue';
      if (files.some(f => f.includes('angular.json'))) return 'angular';
      if (files.some(f => f.endsWith('.svelte'))) return 'svelte';
      
      return 'other';
    } catch (error) {
      this.logger.error('Failed to detect web framework', error as Error);
      return 'other';
    }
  }
  
  private async _detectCSSFramework(projectPath: string): Promise<'tailwind' | 'mui' | 'bootstrap' | 'styled-components' | 'other' | undefined> {
    try {
      // Check for Tailwind
      if (this.hasFile(projectPath, 'tailwind.config.js') || 
          this.hasFile(projectPath, 'tailwind.config.ts') ||
          this.hasFile(projectPath, 'postcss.config.js')) {
        const postcssPath = path.join(projectPath, 'postcss.config.js');
        if (fs.existsSync(postcssPath)) {
          const content = fs.readFileSync(postcssPath, 'utf-8');
          if (content.includes('tailwindcss')) return 'tailwind';
        }
        return 'tailwind';
      }
      
      // Check package.json
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.tailwindcss) return 'tailwind';
        if (deps['@mui/material'] || deps['@material-ui/core']) return 'mui';
        if (deps.bootstrap || deps['react-bootstrap']) return 'bootstrap';
        if (deps['styled-components'] || deps['@emotion/styled']) return 'styled-components';
      }
      
      // Check imports in source files
      const files = await this.getProjectFiles(projectPath);
      const cssFiles = files.filter(f => f.endsWith('.css') || f.endsWith('.scss'));
      
      for (const file of cssFiles.slice(0, 5)) { // Check first 5 CSS files
        const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
        if (content.includes('@tailwind')) return 'tailwind';
        if (content.includes('bootstrap')) return 'bootstrap';
      }
      
      return undefined;
    } catch (error) {
      this.logger.error('Failed to detect CSS framework', error as Error);
      return undefined;
    }
  }
  
  private async _detectStateManagement(projectPath: string): Promise<'redux' | 'zustand' | 'mobx' | 'context' | 'other' | undefined> {
    try {
      // Check package.json
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps['redux'] || deps['@reduxjs/toolkit']) return 'redux';
        if (deps['zustand']) return 'zustand';
        if (deps['mobx'] || deps['mobx-react']) return 'mobx';
      }
      
      // Check for Redux store
      const files = await this.getProjectFiles(projectPath);
      if (files.some(f => f.includes('store') && (f.endsWith('.ts') || f.endsWith('.js')))) {
        const storeFiles = files.filter(f => f.includes('store'));
        for (const file of storeFiles.slice(0, 3)) {
          const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
          if (content.includes('createStore') || content.includes('configureStore')) return 'redux';
          if (content.includes('create(') && content.includes('zustand')) return 'zustand';
        }
      }
      
      // Check for React Context usage
      const tsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx')).slice(0, 10);
      let contextCount = 0;
      for (const file of tsxFiles) {
        const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
        if (content.includes('createContext') || content.includes('useContext')) {
          contextCount++;
        }
      }
      
      if (contextCount > 3) return 'context';
      
      return undefined;
    } catch (error) {
      this.logger.error('Failed to detect state management', error as Error);
      return undefined;
    }
  }
  
  private async _detectRouting(_projectPath: string): Promise<'pages' | 'app' | 'react-router' | 'other' | undefined> {
    // Implementation would detect routing approach
    return undefined;
  }
  
  private async _detectAPIIntegration(projectPath: string): Promise<{
    type: 'rest' | 'graphql' | 'trpc' | 'other';
    client?: string;
  } | undefined> {
    try {
      // Check package.json
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // GraphQL detection
        if (deps['graphql'] || deps['@apollo/client'] || deps['urql']) {
          return {
            type: 'graphql',
            client: deps['@apollo/client'] ? 'apollo' : deps['urql'] ? 'urql' : 'graphql'
          };
        }
        
        // tRPC detection
        if (deps['@trpc/client'] || deps['@trpc/server']) {
          return { type: 'trpc', client: 'trpc' };
        }
        
        // REST clients
        if (deps['axios']) return { type: 'rest', client: 'axios' };
        if (deps['swr']) return { type: 'rest', client: 'swr' };
        if (deps['@tanstack/react-query']) return { type: 'rest', client: 'react-query' };
      }
      
      // Check for API files
      const files = await this.getProjectFiles(projectPath);
      const apiFiles = files.filter(f => f.includes('api') || f.includes('service')).slice(0, 5);
      
      for (const file of apiFiles) {
        const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
        if (content.includes('graphql') || content.includes('gql`')) return { type: 'graphql' };
        if (content.includes('trpc') || content.includes('createTRPCClient')) return { type: 'trpc' };
        if (content.includes('fetch(') || content.includes('axios')) return { type: 'rest' };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error('Failed to detect API integration', error as Error);
      return undefined;
    }
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
  
  private async _detectDatabases(projectPath: string): Promise<{
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'other';
    orm?: string;
    migrations?: boolean;
  }[] | undefined> {
    try {
      const databases: {
        type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'other';
        orm?: string;
        migrations?: boolean;
      }[] = [];
      
      // Check package.json
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // PostgreSQL
        if (deps['pg'] || deps['postgres'] || deps['@supabase/supabase-js']) {
          databases.push({
            type: 'postgres',
            orm: deps['prisma'] ? 'prisma' : deps['typeorm'] ? 'typeorm' : deps['sequelize'] ? 'sequelize' : undefined,
            migrations: this.hasFile(projectPath, 'migrations') || this.hasFile(projectPath, 'prisma/migrations')
          });
        }
        
        // MySQL
        if (deps['mysql'] || deps['mysql2']) {
          databases.push({
            type: 'mysql',
            orm: deps['prisma'] ? 'prisma' : deps['typeorm'] ? 'typeorm' : deps['sequelize'] ? 'sequelize' : undefined
          });
        }
        
        // MongoDB
        if (deps['mongodb'] || deps['mongoose']) {
          databases.push({
            type: 'mongodb',
            orm: deps['mongoose'] ? 'mongoose' : undefined
          });
        }
        
        // Redis
        if (deps['redis'] || deps['ioredis']) {
          databases.push({ type: 'redis' });
        }
      }
      
      // Check for database configuration files
      if (this.hasFile(projectPath, 'prisma/schema.prisma')) {
        const content = fs.readFileSync(path.join(projectPath, 'prisma/schema.prisma'), 'utf-8');
        if (content.includes('postgresql')) {
          const hasPostgres = databases.some(db => db.type === 'postgres');
          if (!hasPostgres) {
            databases.push({ type: 'postgres', orm: 'prisma', migrations: true });
          }
        }
      }
      
      return databases.length > 0 ? databases : undefined;
    } catch (error) {
      this.logger.error('Failed to detect databases', error as Error);
      return undefined;
    }
  }
  
  private async _detectAPIDocumentation(_projectPath: string): Promise<{
    type: 'openapi' | 'graphql-schema' | 'asyncapi' | 'other';
    path?: string;
  } | undefined> {
    // Implementation would detect API documentation
    return undefined;
  }
  
  private async _detectAuthentication(projectPath: string): Promise<{
    type: 'jwt' | 'oauth' | 'basic' | 'api-key' | 'other';
    provider?: string;
  } | undefined> {
    try {
      // Check package.json
      if (this.hasFile(projectPath, 'package.json')) {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // JWT
        if (deps['jsonwebtoken'] || deps['jose']) {
          return { type: 'jwt' };
        }
        
        // OAuth providers
        if (deps['passport']) {
          return { type: 'oauth', provider: 'passport' };
        }
        if (deps['next-auth'] || deps['@auth/core']) {
          return { type: 'oauth', provider: 'next-auth' };
        }
        if (deps['@supabase/supabase-js'] || deps['@supabase/auth-helpers-nextjs']) {
          return { type: 'oauth', provider: 'supabase' };
        }
        if (deps['@clerk/nextjs'] || deps['@clerk/clerk-sdk-node']) {
          return { type: 'oauth', provider: 'clerk' };
        }
        if (deps['firebase'] || deps['firebase-admin']) {
          return { type: 'oauth', provider: 'firebase' };
        }
      }
      
      // Check for auth-related files
      const files = await this.getProjectFiles(projectPath);
      const authFiles = files.filter(f => 
        f.includes('auth') || f.includes('jwt') || f.includes('token')
      ).slice(0, 5);
      
      for (const file of authFiles) {
        const content = fs.readFileSync(path.join(projectPath, file), 'utf-8');
        if (content.includes('jwt.sign') || content.includes('jsonwebtoken')) return { type: 'jwt' };
        if (content.includes('Bearer')) return { type: 'jwt' };
        if (content.includes('OAuth') || content.includes('oauth')) return { type: 'oauth' };
      }
      
      return undefined;
    } catch (error) {
      this.logger.error('Failed to detect authentication', error as Error);
      return undefined;
    }
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