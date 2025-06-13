/**
 * @actor system
 * @responsibility Unified search functionality across projects, sessions, and templates
 */

import { Logger } from '@/src/lib/logging/Logger';
import { ProjectTemplate, ProjectTemplateSystem, TemplateSearchCriteria } from '../templates/ProjectTemplateSystem';
import { Project, SessionOrganizationSystem, ProjectSearchCriteria, SessionSearchCriteria } from '../organization/SessionOrganizationSystem';
import { EventEmitter } from 'events';
import * as path from 'path';
import { app } from 'electron';
import * as fs from 'fs/promises';

export interface SearchResult {
  id: string;
  type: 'project' | 'session' | 'template' | 'file';
  title: string;
  description: string;
  path?: string;
  icon: string;
  relevance: number;
  metadata: Record<string, any>;
  preview?: string;
  actions: SearchAction[];
}

export interface SearchAction {
  id: string;
  label: string;
  icon: string;
  primary?: boolean;
}

export interface SearchQuery {
  query: string;
  types?: Array<'project' | 'session' | 'template' | 'file'>;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
}

export interface SearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  status?: string[];
  frameworks?: string[];
  languages?: string[];
  authors?: string[];
  hasErrors?: boolean;
  archived?: boolean;
}

export interface SearchIndex {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  updatedAt: string;
}

export interface SearchStats {
  totalResults: number;
  resultsByType: Record<string, number>;
  searchDuration: number;
  indexSize: number;
  lastIndexUpdate: string;
}

export class UnifiedSearchService extends EventEmitter {
  private readonly logger: Logger;
  private readonly templateSystem: ProjectTemplateSystem;
  private readonly organizationSystem: SessionOrganizationSystem;
  
  private searchIndex = new Map<string, SearchIndex>();
  private indexDir: string;
  private indexUpdateQueue: Set<string> = new Set();
  private isIndexing = false;
  
  constructor(
    logger: Logger,
    templateSystem: ProjectTemplateSystem,
    organizationSystem: SessionOrganizationSystem
  ) {
    super();
    this.logger = logger;
    this.templateSystem = templateSystem;
    this.organizationSystem = organizationSystem;
    
    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.indexDir = path.join(dataDir, 'search-index');
    
    this.initializeSearchService();
  }

  /**
   * Initialize search service
   */
  private async initializeSearchService(): Promise<void> {
    await fs.mkdir(this.indexDir, { recursive: true });
    await this.loadSearchIndex();
    
    // Set up event listeners for index updates
    this.setupIndexUpdateListeners();
    
    // Start background indexing
    this.startBackgroundIndexing();
    
    this.logger.info('Unified search service initialized', {
      indexSize: this.searchIndex.size
    });
  }

  /**
   * Perform unified search
   */
  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    stats: SearchStats;
    suggestions?: string[];
  }> {
    const startTime = Date.now();
    const results: SearchResult[] = [];
    const resultsByType: Record<string, number> = {};
    
    try {
      // Determine which types to search
      const typesToSearch = searchQuery.types || ['project', 'session', 'template', 'file'];
      
      // Search each type
      const searchPromises: Promise<SearchResult[]>[] = [];
      
      if (typesToSearch.includes('project')) {
        searchPromises.push(this.searchProjects(searchQuery));
      }
      
      if (typesToSearch.includes('session')) {
        searchPromises.push(this.searchSessions(searchQuery));
      }
      
      if (typesToSearch.includes('template')) {
        searchPromises.push(this.searchTemplates(searchQuery));
      }
      
      if (typesToSearch.includes('file')) {
        searchPromises.push(this.searchFiles(searchQuery));
      }
      
      // Execute searches in parallel
      const searchResults = await Promise.all(searchPromises);
      
      // Combine and sort results
      for (const typeResults of searchResults) {
        results.push(...typeResults);
      }
      
      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance);
      
      // Apply pagination
      const paginatedResults = this.paginateResults(
        results,
        searchQuery.offset || 0,
        searchQuery.limit || 50
      );
      
      // Count results by type
      for (const result of results) {
        resultsByType[result.type] = (resultsByType[result.type] || 0) + 1;
      }
      
      // Generate search suggestions
      const suggestions = searchQuery.fuzzy ? await this.generateSuggestions(searchQuery.query) : undefined;
      
      const stats: SearchStats = {
        totalResults: results.length,
        resultsByType,
        searchDuration: Date.now() - startTime,
        indexSize: this.searchIndex.size,
        lastIndexUpdate: this.getLastIndexUpdate()
      };
      
      this.emit('searchCompleted', {
        query: searchQuery,
        stats
      });
      
      return {
        results: paginatedResults,
        stats,
        suggestions
      };
      
    } catch (error) {
      this.logger.error('Search failed', error as Error, { query: searchQuery });
      throw error;
    }
  }

  /**
   * Quick search (for autocomplete)
   */
  async quickSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    const searchQuery: SearchQuery = {
      query,
      limit,
      fuzzy: true
    };
    
    const { results } = await this.search(searchQuery);
    return results;
  }

  /**
   * Update search index for specific item
   */
  async updateIndex(itemId: string, type: string): Promise<void> {
    this.indexUpdateQueue.add(`${type}:${itemId}`);
    
    if (!this.isIndexing) {
      await this.processIndexQueue();
    }
  }

  /**
   * Rebuild entire search index
   */
  async rebuildIndex(): Promise<void> {
    this.emit('indexRebuildStarted');
    
    try {
      this.searchIndex.clear();
      
      // Index all projects
      const projects = await this.organizationSystem.searchProjects({});
      for (const project of projects) {
        await this.indexProject(project);
      }
      
      // Index all templates
      const templates = await this.templateSystem.getTemplates();
      for (const template of templates) {
        await this.indexTemplate(template);
      }
      
      // Index sessions would be done here
      // await this.indexAllSessions();
      
      await this.saveSearchIndex();
      
      this.emit('indexRebuildCompleted', {
        itemsIndexed: this.searchIndex.size
      });
      
      this.logger.info('Search index rebuilt', {
        itemsIndexed: this.searchIndex.size
      });
      
    } catch (error) {
      this.emit('indexRebuildFailed', error);
      this.logger.error('Index rebuild failed', error as Error);
      throw error;
    }
  }

  // Private search methods

  private async searchProjects(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const criteria: ProjectSearchCriteria = {
      query: searchQuery.query,
      tags: searchQuery.filters?.tags,
      includeArchived: searchQuery.filters?.archived
    };
    
    const projects = await this.organizationSystem.searchProjects(criteria);
    
    return projects.map(project => this.projectToSearchResult(project, searchQuery.query));
  }

  private async searchSessions(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const criteria: SessionSearchCriteria = {
      query: searchQuery.query,
      tags: searchQuery.filters?.tags,
      dateFrom: searchQuery.filters?.dateFrom,
      dateTo: searchQuery.filters?.dateTo,
      hasErrors: searchQuery.filters?.hasErrors
    };
    
    const sessions = await this.organizationSystem.searchSessions(criteria);
    
    // Map session search results
    return sessions.map(session => ({
      id: session.sessionId,
      type: 'session' as const,
      title: `Session in ${session.projectName}`,
      description: session.sessionId,
      icon: 'session',
      relevance: this.calculateRelevance(searchQuery.query, session.sessionId),
      metadata: {
        projectId: session.projectId,
        projectName: session.projectName
      },
      actions: [
        { id: 'open', label: 'Open Session', icon: 'open', primary: true },
        { id: 'view-project', label: 'View Project', icon: 'project' }
      ]
    }));
  }

  private async searchTemplates(searchQuery: SearchQuery): Promise<SearchResult[]> {
    const criteria: TemplateSearchCriteria = {
      query: searchQuery.query,
      framework: searchQuery.filters?.frameworks?.[0],
      language: searchQuery.filters?.languages?.[0],
      features: searchQuery.filters?.tags
    };
    
    const templates = await this.templateSystem.searchTemplates(criteria);
    
    return templates.map(template => this.templateToSearchResult(template, searchQuery.query));
  }

  private async searchFiles(searchQuery: SearchQuery): Promise<SearchResult[]> {
    // Implementation would search through project files
    // For now, return empty array
    void searchQuery;
    return [];
  }

  // Conversion methods

  private projectToSearchResult(project: Project, query: string): SearchResult {
    return {
      id: project.id,
      type: 'project',
      title: project.name,
      description: project.description,
      path: project.path,
      icon: this.getProjectIcon(project.type),
      relevance: this.calculateRelevance(query, `${project.name} ${project.description}`),
      metadata: {
        type: project.type,
        status: project.status,
        framework: project.framework,
        language: project.language,
        sessions: project.sessions.length,
        lastAccessed: project.lastAccessedAt
      },
      preview: this.generateProjectPreview(project),
      actions: [
        { id: 'open', label: 'Open Project', icon: 'folder-open', primary: true },
        { id: 'sessions', label: 'View Sessions', icon: 'list' },
        { id: 'settings', label: 'Project Settings', icon: 'settings' }
      ]
    };
  }

  private templateToSearchResult(template: ProjectTemplate, query: string): SearchResult {
    return {
      id: template.id,
      type: 'template',
      title: template.name,
      description: template.description,
      icon: this.getTemplateIcon(template.category),
      relevance: this.calculateRelevance(query, `${template.name} ${template.description}`),
      metadata: {
        category: template.category,
        framework: template.framework,
        language: template.language,
        features: template.features,
        rating: template.metadata.userRating,
        usageCount: template.metadata.usageCount
      },
      preview: this.generateTemplatePreview(template),
      actions: [
        { id: 'use', label: 'Use Template', icon: 'plus', primary: true },
        { id: 'preview', label: 'Preview', icon: 'eye' },
        { id: 'customize', label: 'Customize', icon: 'edit' }
      ]
    };
  }

  // Helper methods

  private calculateRelevance(query: string, content: string): number {
    if (!query || !content) return 0;
    
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Exact match
    if (contentLower === queryLower) return 1.0;
    
    // Contains exact query
    if (contentLower.includes(queryLower)) return 0.8;
    
    // Word-based matching
    const queryWords = queryLower.split(/\s+/);
    const contentWords = contentLower.split(/\s+/);
    
    let matchCount = 0;
    for (const queryWord of queryWords) {
      if (contentWords.some(word => word.includes(queryWord))) {
        matchCount++;
      }
    }
    
    return matchCount / queryWords.length * 0.6;
  }

  private paginateResults(
    results: SearchResult[],
    offset: number,
    limit: number
  ): SearchResult[] {
    return results.slice(offset, offset + limit);
  }

  private async generateSuggestions(query: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Get common search terms from index
    const terms = new Set<string>();
    
    for (const [, indexEntry] of this.searchIndex) {
      const words = indexEntry.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.startsWith(query.toLowerCase()) && word !== query.toLowerCase()) {
          terms.add(word);
        }
      }
    }
    
    // Convert to array and sort by frequency
    suggestions.push(...Array.from(terms).slice(0, 5));
    
    return suggestions;
  }

  private getProjectIcon(type: Project['type']): string {
    const iconMap: Record<Project['type'], string> = {
      'web-app': 'globe',
      'api': 'server',
      'mobile': 'smartphone',
      'desktop': 'monitor',
      'library': 'package',
      'cli': 'terminal',
      'fullstack': 'layers',
      'microservice': 'grid',
      'data-science': 'chart',
      'machine-learning': 'cpu',
      'blockchain': 'link',
      'game': 'gamepad',
      'iot': 'wifi',
      'documentation': 'book',
      'other': 'folder'
    };
    
    return iconMap[type] || 'folder';
  }

  private getTemplateIcon(category: ProjectTemplate['category']): string {
    const iconMap: Record<ProjectTemplate['category'], string> = {
      'web-app': 'globe',
      'api': 'server',
      'mobile': 'smartphone',
      'desktop': 'monitor',
      'library': 'package',
      'cli': 'terminal',
      'fullstack': 'layers',
      'microservice': 'grid',
      'data-science': 'chart',
      'machine-learning': 'cpu',
      'blockchain': 'link',
      'game': 'gamepad',
      'iot': 'wifi',
      'custom': 'star'
    };
    
    return iconMap[category] || 'file';
  }

  private generateProjectPreview(project: Project): string {
    return `${project.type} project with ${project.sessions.length} sessions. Status: ${project.status}.`;
  }

  private generateTemplatePreview(template: ProjectTemplate): string {
    return `${template.framework} template with ${template.features.join(', ')}. Rating: ${template.metadata.userRating}/5.`;
  }

  // Index management

  private async indexProject(project: Project): Promise<void> {
    const indexEntry: SearchIndex = {
      id: project.id,
      type: 'project',
      content: `${project.name} ${project.description} ${project.metadata.tags.join(' ')}`,
      metadata: {
        name: project.name,
        type: project.type,
        status: project.status,
        path: project.path
      },
      updatedAt: project.updatedAt
    };
    
    this.searchIndex.set(`project:${project.id}`, indexEntry);
  }

  private async indexTemplate(template: ProjectTemplate): Promise<void> {
    const indexEntry: SearchIndex = {
      id: template.id,
      type: 'template',
      content: `${template.name} ${template.description} ${template.features.join(' ')} ${template.metadata.tags.join(' ')}`,
      metadata: {
        name: template.name,
        category: template.category,
        framework: template.framework,
        language: template.language
      },
      updatedAt: template.updatedAt
    };
    
    this.searchIndex.set(`template:${template.id}`, indexEntry);
  }

  private setupIndexUpdateListeners(): void {
    // Listen for project updates
    this.organizationSystem.on('projectCreated', (project: Project) => {
      this.updateIndex(project.id, 'project');
    });
    
    this.organizationSystem.on('projectUpdated', (project: Project) => {
      this.updateIndex(project.id, 'project');
    });
    
    this.organizationSystem.on('projectDeleted', (projectId: string) => {
      this.searchIndex.delete(`project:${projectId}`);
      void this.saveSearchIndex();
    });
    
    // Listen for template updates
    this.templateSystem.on('customTemplateCreated', (template: ProjectTemplate) => {
      this.updateIndex(template.id, 'template');
    });
    
    this.templateSystem.on('customTemplateUpdated', (template: ProjectTemplate) => {
      this.updateIndex(template.id, 'template');
    });
    
    this.templateSystem.on('customTemplateDeleted', (templateId: string) => {
      this.searchIndex.delete(`template:${templateId}`);
      void this.saveSearchIndex();
    });
  }

  private async startBackgroundIndexing(): Promise<void> {
    setInterval(async () => {
      if (this.indexUpdateQueue.size > 0 && !this.isIndexing) {
        await this.processIndexQueue();
      }
    }, 5000); // Process queue every 5 seconds
  }

  private async processIndexQueue(): Promise<void> {
    if (this.isIndexing || this.indexUpdateQueue.size === 0) {
      return;
    }
    
    this.isIndexing = true;
    
    try {
      const items = Array.from(this.indexUpdateQueue);
      this.indexUpdateQueue.clear();
      
      for (const item of items) {
        const [type, id] = item.split(':');
        
        switch (type) {
          case 'project':
            const project = id ? await this.organizationSystem.getProject(id) : null;
            if (project) {
              await this.indexProject(project);
            }
            break;
          
          case 'template':
            const template = id ? await this.templateSystem.getTemplate(id) : null;
            if (template) {
              await this.indexTemplate(template);
            }
            break;
        }
      }
      
      await this.saveSearchIndex();
      
    } catch (error) {
      this.logger.error('Index update failed', error as Error);
    } finally {
      this.isIndexing = false;
    }
  }

  private async loadSearchIndex(): Promise<void> {
    try {
      const indexFile = path.join(this.indexDir, 'search-index.json');
      const content = await fs.readFile(indexFile, 'utf-8');
      const indexData = JSON.parse(content) as Record<string, SearchIndex>;
      
      this.searchIndex.clear();
      for (const [key, value] of Object.entries(indexData)) {
        this.searchIndex.set(key, value);
      }
    } catch (error) {
      // Index doesn't exist yet
      this.logger.info('No existing search index found');
    }
  }

  private async saveSearchIndex(): Promise<void> {
    const indexFile = path.join(this.indexDir, 'search-index.json');
    const indexData: Record<string, SearchIndex> = {};
    
    for (const [key, value] of this.searchIndex) {
      indexData[key] = value;
    }
    
    await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf-8');
  }

  private getLastIndexUpdate(): string {
    let lastUpdate = new Date(0);
    
    for (const [, entry] of this.searchIndex) {
      const entryDate = new Date(entry.updatedAt);
      if (entryDate > lastUpdate) {
        lastUpdate = entryDate;
      }
    }
    
    return lastUpdate.toISOString();
  }
}