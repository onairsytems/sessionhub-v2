/**
 * @actor system
 * @responsibility Universal search and filtering across all SessionHub data
 */

import { Logger } from '@/src/lib/logging/Logger';
// import { Session } from '@/src/models/Session';
// import { WorkspaceMetadata } from '../persistence/EnhancedSessionPersistence';
// import { SearchIndex } from '../persistence/EnhancedSessionPersistence';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface SearchQuery {
  text: string;
  filters: SearchFilters;
  pagination: SearchPagination;
  sorting: SearchSorting;
}

export interface SearchFilters {
  types?: SearchEntityType[];
  status?: string[];
  dateRange?: {
    start: string;
    end: string;
    field: 'createdAt' | 'updatedAt' | 'completedAt';
  };
  tags?: string[];
  categories?: string[];
  workspaceIds?: string[];
  projectPaths?: string[];
  userIds?: string[];
  customFields?: Record<string, any>;
  contentTypes?: string[];
  fileExtensions?: string[];
  minScore?: number;
}

export interface SearchPagination {
  page: number;
  limit: number;
  offset?: number;
}

export interface SearchSorting {
  field: string;
  order: 'asc' | 'desc';
  secondary?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  entityId: string;
  title: string;
  description: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  highlights: SearchHighlight[];
  breadcrumb: string[];
  matchedFields: string[];
  timestamp: string;
  url?: string;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
  startOffset: number;
  endOffset: number;
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  aggregations: SearchAggregations;
  facets: SearchFacets;
  suggestions: string[];
  searchTime: number;
  query: SearchQuery;
}

export interface SearchAggregations {
  byType: Record<SearchEntityType, number>;
  byStatus: Record<string, number>;
  byWorkspace: Record<string, number>;
  byDate: Record<string, number>;
  byTags: Record<string, number>;
  byCategories: Record<string, number>;
}

export interface SearchFacets {
  types: Array<{ value: SearchEntityType; count: number; selected: boolean }>;
  statuses: Array<{ value: string; count: number; selected: boolean }>;
  workspaces: Array<{ value: string; label: string; count: number; selected: boolean }>;
  tags: Array<{ value: string; count: number; selected: boolean }>;
  categories: Array<{ value: string; count: number; selected: boolean }>;
  dateRanges: Array<{ value: string; label: string; count: number; selected: boolean }>;
}

export type SearchEntityType = 
  | 'session' 
  | 'workspace' 
  | 'template' 
  | 'integration' 
  | 'file' 
  | 'log' 
  | 'checkpoint' 
  | 'instruction' 
  | 'result';

export interface IndexedEntity {
  id: string;
  type: SearchEntityType;
  entityId: string;
  title: string;
  description: string;
  content: string;
  metadata: Record<string, any>;
  tags: string[];
  categories: string[];
  workspaceId?: string;
  projectPath?: string;
  userId?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  fileSize?: number;
  fileType?: string;
  customFields?: Record<string, any>;
}

export interface SearchIndexConfig {
  maxIndexSize: number;
  indexUpdateBatchSize: number;
  indexUpdateInterval: number;
  contentMaxLength: number;
  enableFuzzySearch: boolean;
  enableStemming: boolean;
  enableStopWords: boolean;
  minQueryLength: number;
  maxResults: number;
  highlightFragmentSize: number;
  stopWords: string[];
  stemRules: Record<string, string>;
}

export class UniversalSearchEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly indexDir: string;
  private readonly cacheDir: string;
  
  private entities = new Map<string, IndexedEntity>();
  private searchIndex = new Map<string, Set<string>>(); // word -> entity IDs
  private reverseIndex = new Map<string, Set<string>>(); // entity ID -> words
  private facetCache = new Map<string, any>();
  private queryCache = new Map<string, SearchResponse>();
  
  private config: SearchIndexConfig;
  private indexUpdateTimer?: NodeJS.Timeout; // Index update timer
  private pendingUpdates = new Set<string>();
  
  constructor(logger: Logger, config?: Partial<SearchIndexConfig>) {
    super();
    this.logger = logger;
    
    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.indexDir = path.join(dataDir, 'search-index');
    this.cacheDir = path.join(dataDir, 'search-cache');
    
    this.config = {
      maxIndexSize: 100000,
      indexUpdateBatchSize: 100,
      indexUpdateInterval: 30000,
      contentMaxLength: 10000,
      enableFuzzySearch: true,
      enableStemming: true,
      enableStopWords: true,
      minQueryLength: 2,
      maxResults: 1000,
      highlightFragmentSize: 150,
      stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'],
      stemRules: {
        'ing': '',
        'ed': '',
        'er': '',
        'est': '',
        'ly': '',
        's': ''
      },
      ...config
    };
    
    this.initializeSearchEngine();
  }

  /**
   * Initialize search engine
   */
  private async initializeSearchEngine(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.indexDir, { recursive: true }),
      fs.mkdir(this.cacheDir, { recursive: true })
    ]);

    await this.loadSearchIndex();
    await this.loadEntities();
    
    this.startIndexUpdates();
    
    this.logger.info('Universal search engine initialized', {
      entitiesCount: this.entities.size,
      indexSize: this.searchIndex.size,
      config: this.config
    });
  }

  /**
   * Perform universal search
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - new Date(cached.searchTime).getTime() < 300000) { // 5 min cache
      return cached;
    }

    // Validate query
    if (query.text.length < this.config.minQueryLength) {
      throw new Error(`Query must be at least ${this.config.minQueryLength} characters`);
    }

    // Process query text
    const queryTerms = this.processQuery(query.text);
    
    // Find matching entities
    const matchingEntities = await this.findMatchingEntities(queryTerms, query.filters);
    
    // Score and rank results
    const scoredResults = await this.scoreResults(matchingEntities, queryTerms, query.text);
    
    // Sort results
    const sortedResults = this.sortResults(scoredResults, query.sorting);
    
    // Apply pagination
    const paginatedResults = this.paginateResults(sortedResults, query.pagination);
    
    // Generate aggregations and facets
    const aggregations = this.generateAggregations(matchingEntities);
    const facets = this.generateFacets(matchingEntities, query.filters);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(query.text, matchingEntities);
    
    const response: SearchResponse = {
      results: paginatedResults,
      pagination: {
        page: query.pagination.page,
        limit: query.pagination.limit,
        total: sortedResults.length,
        totalPages: Math.ceil(sortedResults.length / query.pagination.limit),
        hasNext: (query.pagination.page * query.pagination.limit) < sortedResults.length,
        hasPrev: query.pagination.page > 1
      },
      aggregations,
      facets,
      suggestions,
      searchTime: Date.now() - startTime,
      query
    };

    // Cache result
    this.queryCache.set(cacheKey, response);
    
    // Cleanup old cache entries
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries());
      const oldEntries = entries.slice(0, entries.length - 500);
      oldEntries.forEach(([key]) => this.queryCache.delete(key));
    }

    this.emit('searchCompleted', {
      query: query.text,
      resultsCount: response.results.length,
      searchTime: response.searchTime
    });

    this.logger.info('Search completed', {
      query: query.text,
      resultsCount: response.results.length,
      searchTime: response.searchTime,
      filtersApplied: Object.keys(query.filters).length
    });

    return response;
  }

  /**
   * Index entity for search
   */
  async indexEntity(entity: IndexedEntity): Promise<void> {
    // Process content for indexing
    const processedContent = this.processContent(entity.content);
    const processedTitle = this.processContent(entity.title);
    const processedDescription = this.processContent(entity.description);
    
    // Combine all searchable text
    const allWords = new Set([
      ...processedTitle,
      ...processedDescription,
      ...processedContent,
      ...entity.tags.flatMap(tag => this.processContent(tag)),
      ...entity.categories.flatMap(cat => this.processContent(cat))
    ]);

    // Update reverse index
    const existingWords = this.reverseIndex.get(entity.id) || new Set();
    
    // Remove old words from search index
    for (const word of existingWords) {
      const entityIds = this.searchIndex.get(word);
      if (entityIds) {
        entityIds.delete(entity.id);
        if (entityIds.size === 0) {
          this.searchIndex.delete(word);
        }
      }
    }
    
    // Add new words to search index
    for (const word of allWords) {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set());
      }
      this.searchIndex.get(word)!.add(entity.id);
    }
    
    // Update reverse index
    this.reverseIndex.set(entity.id, allWords);
    
    // Store entity
    this.entities.set(entity.id, entity);
    
    // Mark for batch update
    this.pendingUpdates.add(entity.id);
    
    this.emit('entityIndexed', entity.id);
    
    this.logger.debug('Entity indexed', {
      entityId: entity.id,
      type: entity.type,
      wordsCount: allWords.size
    });
  }

  /**
   * Remove entity from index
   */
  async removeEntity(entityId: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return;
    }

    // Remove from search index
    const words = this.reverseIndex.get(entityId);
    if (words) {
      for (const word of words) {
        const entityIds = this.searchIndex.get(word);
        if (entityIds) {
          entityIds.delete(entityId);
          if (entityIds.size === 0) {
            this.searchIndex.delete(word);
          }
        }
      }
    }

    // Remove from maps
    this.entities.delete(entityId);
    this.reverseIndex.delete(entityId);
    this.pendingUpdates.delete(entityId);
    
    // Clear relevant caches
    this.clearRelatedCaches(entityId);

    this.emit('entityRemoved', entityId);
    
    this.logger.debug('Entity removed from index', { entityId });
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    const processed = this.processContent(partialQuery);
    if (processed.length === 0) {
      return [];
    }

    const lastWord = processed[processed.length - 1] || '';
    const suggestions = new Set<string>();
    
    // Find words that start with the last partial word
    for (const [word] of this.searchIndex) {
      if (lastWord && word.startsWith(lastWord) && word !== lastWord) {
        suggestions.add(word);
      }
      
      if (suggestions.size >= limit * 2) {
        break;
      }
    }
    
    // Convert to full query suggestions
    const baseQuery = processed.slice(0, -1).join(' ');
    const querySuggestions = Array.from(suggestions)
      .slice(0, limit)
      .map(word => baseQuery ? `${baseQuery} ${word}` : word);

    return querySuggestions;
  }

  /**
   * Get search statistics
   */
  async getStatistics(): Promise<any> {
    const stats = {
      totalEntities: this.entities.size,
      totalWords: this.searchIndex.size,
      indexSizeMB: await this.calculateIndexSize(),
      entityTypes: this.getEntityTypeStats(),
      topWords: this.getTopWords(20),
      cacheStats: {
        queryCache: this.queryCache.size,
        facetCache: this.facetCache.size
      },
      pendingUpdates: this.pendingUpdates.size
    };

    return stats;
  }

  /**
   * Clear all search indices and caches
   */
  async clearIndex(): Promise<void> {
    this.entities.clear();
    this.searchIndex.clear();
    this.reverseIndex.clear();
    this.facetCache.clear();
    this.queryCache.clear();
    this.pendingUpdates.clear();
    
    // Clear on-disk indices
    try {
      const files = await fs.readdir(this.indexDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.indexDir, file)).catch(() => {}))
      );
      
      const cacheFiles = await fs.readdir(this.cacheDir);
      await Promise.all(
        cacheFiles.map(file => fs.unlink(path.join(this.cacheDir, file)).catch(() => {}))
      );
    } catch {
      // Directories might not exist
    }

    this.emit('indexCleared');
    
    this.logger.info('Search index cleared');
  }

  // Private helper methods

  private processQuery(query: string): string[] {
    return this.processContent(query);
  }

  private processContent(content: string): string[] {
    if (!content) return [];
    
    // Normalize and tokenize
    let processed = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = processed.split(' ').filter(word => word.length > 0);
    
    // Remove stop words
    const filteredWords = this.config.enableStopWords 
      ? words.filter(word => !this.config.stopWords.includes(word))
      : words;
    
    // Apply stemming
    const stemmedWords = this.config.enableStemming
      ? filteredWords.map(word => this.stemWord(word))
      : filteredWords;
    
    return stemmedWords;
  }

  private stemWord(word: string): string {
    for (const [suffix, replacement] of Object.entries(this.config.stemRules)) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length) + replacement;
      }
    }
    return word;
  }

  private async findMatchingEntities(queryTerms: string[], filters: SearchFilters): Promise<IndexedEntity[]> {
    const entityScores = new Map<string, number>();
    
    // Find entities containing query terms
    for (const term of queryTerms) {
      const directMatches = this.searchIndex.get(term) || new Set();
      
      // Add fuzzy matches if enabled
      const fuzzyMatches = this.config.enableFuzzySearch 
        ? this.findFuzzyMatches(term)
        : new Set();
      
      const allMatches = new Set([...directMatches, ...fuzzyMatches]);
      
      for (const entityId of allMatches) {
        if (typeof entityId === 'string') {
          const currentScore = entityScores.get(entityId) || 0;
          const matchScore = directMatches.has(entityId) ? 1 : 0.5; // Fuzzy matches get lower score
          entityScores.set(entityId, currentScore + matchScore);
        }
      }
    }

    // Get entities and apply filters
    const matchingEntities: IndexedEntity[] = [];
    
    for (const [entityId, score] of entityScores) {
      if (typeof entityId !== 'string') continue;
      const entity = this.entities.get(entityId);
      if (!entity) continue;
      void score; // Avoid unused variable warning
      
      if (this.passesFilters(entity, filters)) {
        matchingEntities.push(entity);
      }
    }

    return matchingEntities;
  }

  private findFuzzyMatches(term: string): Set<string> {
    const matches = new Set<string>();
    const maxDistance = Math.max(1, Math.floor(term.length / 4));
    
    for (const [word, entityIds] of this.searchIndex) {
      const distance = this.levenshteinDistance(term, word);
      if (distance <= maxDistance) {
        for (const entityId of entityIds) {
          matches.add(entityId);
        }
      }
    }
    
    return matches;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j]![0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + cost
        );
      }
    }
    
    return matrix[b.length]![a.length]!;
  }

  private passesFilters(entity: IndexedEntity, filters: SearchFilters): boolean {
    // Type filter
    if (filters.types && !filters.types.includes(entity.type)) {
      return false;
    }
    
    // Status filter
    if (filters.status && entity.status && !filters.status.includes(entity.status)) {
      return false;
    }
    
    // Date range filter
    if (filters.dateRange) {
      const dateField = filters.dateRange.field as keyof IndexedEntity;
      const entityDate = new Date((entity[dateField] as string) || entity.createdAt);
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      
      if (entityDate < startDate || entityDate > endDate) {
        return false;
      }
    }
    
    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some(tag => entity.tags?.includes(tag))) {
        return false;
      }
    }
    
    // Categories filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.some(cat => entity.categories?.includes(cat))) {
        return false;
      }
    }
    
    // Workspace filter
    if (filters.workspaceIds && filters.workspaceIds.length > 0) {
      if (!entity.workspaceId || !filters.workspaceIds.includes(entity.workspaceId)) {
        return false;
      }
    }
    
    // Project path filter
    if (filters.projectPaths && filters.projectPaths.length > 0) {
      if (!entity.projectPath || !filters.projectPaths.some(path => entity.projectPath!.includes(path))) {
        return false;
      }
    }
    
    // User filter
    if (filters.userIds && filters.userIds.length > 0) {
      if (!entity.userId || !filters.userIds.includes(entity.userId)) {
        return false;
      }
    }
    
    return true;
  }

  private async scoreResults(entities: IndexedEntity[], queryTerms: string[], originalQuery: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const entity of entities) {
      const score = this.calculateRelevanceScore(entity, queryTerms, originalQuery);
      
      const minScore = (this.config as any).minScore || 0;
      if (score >= minScore) {
        const highlights = this.generateHighlights(entity, queryTerms);
        const breadcrumb = this.generateBreadcrumb(entity);
        
        results.push({
          id: entity.id,
          type: entity.type,
          entityId: entity.entityId,
          title: entity.title,
          description: entity.description,
          content: entity.content.substring(0, 500),
          metadata: entity.metadata,
          score,
          highlights,
          breadcrumb,
          matchedFields: this.getMatchedFields(entity, queryTerms),
          timestamp: entity.updatedAt,
          url: this.generateEntityUrl(entity)
        });
      }
    }
    
    return results;
  }

  private calculateRelevanceScore(entity: IndexedEntity, queryTerms: string[], originalQuery: string): number {
    let score = 0;
    
    // Title matches (highest weight)
    const titleWords = this.processContent(entity.title);
    for (const term of queryTerms) {
      if (titleWords.includes(term)) {
        score += 10;
      }
    }
    
    // Description matches
    const descWords = this.processContent(entity.description);
    for (const term of queryTerms) {
      if (descWords.includes(term)) {
        score += 5;
      }
    }
    
    // Content matches
    const contentWords = this.processContent(entity.content);
    for (const term of queryTerms) {
      const occurrences = contentWords.filter(word => word === term).length;
      score += occurrences * 2;
    }
    
    // Exact phrase bonus
    if (entity.content.toLowerCase().includes(originalQuery.toLowerCase())) {
      score += 15;
    }
    
    // Tag matches
    for (const term of queryTerms) {
      if (entity.tags.some(tag => this.processContent(tag).includes(term))) {
        score += 8;
      }
    }
    
    // Recency bonus
    const ageInDays = (Date.now() - new Date(entity.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - ageInDays / 10);
    
    // Type-specific bonuses
    switch (entity.type) {
      case 'session':
        score += 2;
        break;
      case 'template':
        score += 1;
        break;
    }
    
    return score;
  }

  private generateHighlights(entity: IndexedEntity, queryTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const fields = ['title', 'description', 'content'];
    
    for (const field of fields) {
      const text = entity[field as keyof IndexedEntity] as string || '';
      const fieldHighlights = this.findHighlightsInText(text, queryTerms);
      
      if (fieldHighlights.length > 0) {
        highlights.push({
          field,
          fragments: fieldHighlights,
          startOffset: 0,
          endOffset: text.length
        });
      }
    }
    
    return highlights;
  }

  private findHighlightsInText(text: string, queryTerms: string[]): string[] {
    const fragments: string[] = [];
    const textLower = text.toLowerCase();
    
    for (const term of queryTerms) {
      const termLower = term.toLowerCase();
      let index = textLower.indexOf(termLower);
      
      while (index !== -1) {
        const start = Math.max(0, index - this.config.highlightFragmentSize / 2);
        const end = Math.min(text.length, index + term.length + this.config.highlightFragmentSize / 2);
        
        let fragment = text.substring(start, end);
        
        // Highlight the term
        const highlightStart = index - start;
        const highlightEnd = highlightStart + term.length;
        fragment = 
          fragment.substring(0, highlightStart) +
          `<mark>${fragment.substring(highlightStart, highlightEnd)}</mark>` +
          fragment.substring(highlightEnd);
        
        fragments.push(fragment);
        
        index = textLower.indexOf(termLower, index + 1);
        
        if (fragments.length >= 3) break; // Limit fragments per field
      }
    }
    
    return fragments;
  }

  private generateBreadcrumb(entity: IndexedEntity): string[] {
    const breadcrumb: string[] = [];
    
    if (entity.workspaceId) {
      // Add workspace name if available
      breadcrumb.push('Workspace'); // Would need workspace name lookup
    }
    
    if (entity.projectPath) {
      breadcrumb.push(path.basename(entity.projectPath));
    }
    
    breadcrumb.push(entity.type);
    
    return breadcrumb;
  }

  private getMatchedFields(entity: IndexedEntity, queryTerms: string[]): string[] {
    const matchedFields: string[] = [];
    
    if (queryTerms.some(term => this.processContent(entity.title).includes(term))) {
      matchedFields.push('title');
    }
    
    if (queryTerms.some(term => this.processContent(entity.description).includes(term))) {
      matchedFields.push('description');
    }
    
    if (queryTerms.some(term => this.processContent(entity.content).includes(term))) {
      matchedFields.push('content');
    }
    
    if (queryTerms.some(term => entity.tags.some(tag => this.processContent(tag).includes(term)))) {
      matchedFields.push('tags');
    }
    
    return matchedFields;
  }

  private generateEntityUrl(entity: IndexedEntity): string {
    // Generate appropriate URL based on entity type
    switch (entity.type) {
      case 'session':
        return `/sessions/${entity.entityId}`;
      case 'workspace':
        return `/workspaces/${entity.entityId}`;
      case 'template':
        return `/templates/${entity.entityId}`;
      default:
        return `/${entity.type}s/${entity.entityId}`;
    }
  }

  private sortResults(results: SearchResult[], sorting: SearchSorting): SearchResult[] {
    return results.sort((a, b) => {
      const getValue = (result: SearchResult, field: string): any => {
        switch (field) {
          case 'score':
            return result.score;
          case 'title':
            return result.title.toLowerCase();
          case 'timestamp':
            return new Date(result.timestamp);
          case 'type':
            return result.type;
          default:
            return result.metadata[field] || '';
        }
      };

      const aValue = getValue(a, sorting.field);
      const bValue = getValue(b, sorting.field);
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;
      
      if (sorting.order === 'desc') comparison *= -1;
      
      // Apply secondary sort if values are equal
      if (comparison === 0 && sorting.secondary) {
        const aSecondary = getValue(a, sorting.secondary.field);
        const bSecondary = getValue(b, sorting.secondary.field);
        
        if (aSecondary < bSecondary) comparison = -1;
        else if (aSecondary > bSecondary) comparison = 1;
        
        if (sorting.secondary.order === 'desc') comparison *= -1;
      }
      
      return comparison;
    });
  }

  private paginateResults(results: SearchResult[], pagination: SearchPagination): SearchResult[] {
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;
    return results.slice(start, end);
  }

  private generateAggregations(entities: IndexedEntity[]): SearchAggregations {
    const aggregations: SearchAggregations = {
      byType: {
        file: 0,
        session: 0,
        workspace: 0,
        template: 0,
        user: 0,
        project: 0,
        setting: 0,
        backup: 0,
        index: 0,
        integration: 0,
        log: 0,
        checkpoint: 0,
        instruction: 0,
        result: 0
      } as Record<SearchEntityType, number>,
      byStatus: {},
      byWorkspace: {},
      byDate: {},
      byTags: {},
      byCategories: {}
    };

    for (const entity of entities) {
      // By type
      aggregations.byType[entity.type] = (aggregations.byType[entity.type] || 0) + 1;
      
      // By status
      if (entity.status) {
        aggregations.byStatus[entity.status] = (aggregations.byStatus[entity.status] || 0) + 1;
      }
      
      // By workspace
      if (entity.workspaceId) {
        aggregations.byWorkspace[entity.workspaceId] = (aggregations.byWorkspace[entity.workspaceId] || 0) + 1;
      }
      
      // By date (grouped by month)
      const month = new Date(entity.createdAt).toISOString().substring(0, 7);
      aggregations.byDate[month] = (aggregations.byDate[month] || 0) + 1;
      
      // By tags
      for (const tag of entity.tags) {
        aggregations.byTags[tag] = (aggregations.byTags[tag] || 0) + 1;
      }
      
      // By categories
      for (const category of entity.categories) {
        aggregations.byCategories[category] = (aggregations.byCategories[category] || 0) + 1;
      }
    }

    return aggregations;
  }

  private generateFacets(entities: IndexedEntity[], filters: SearchFilters): SearchFacets {
    const aggregations = this.generateAggregations(entities);
    
    return {
      types: Object.entries(aggregations.byType).map(([value, count]) => ({
        value: value as SearchEntityType,
        count,
        selected: filters.types?.includes(value as SearchEntityType) || false
      })),
      statuses: Object.entries(aggregations.byStatus).map(([value, count]) => ({
        value,
        count,
        selected: filters.status?.includes(value) || false
      })),
      workspaces: Object.entries(aggregations.byWorkspace).map(([value, count]) => ({
        value,
        label: value, // Would need workspace name lookup
        count,
        selected: filters.workspaceIds?.includes(value) || false
      })),
      tags: Object.entries(aggregations.byTags).map(([value, count]) => ({
        value,
        count,
        selected: filters.tags?.includes(value) || false
      })),
      categories: Object.entries(aggregations.byCategories).map(([value, count]) => ({
        value,
        count,
        selected: filters.categories?.includes(value) || false
      })),
      dateRanges: Object.entries(aggregations.byDate).map(([value, count]) => ({
        value,
        label: new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        count,
        selected: false // Would need to check against date range filter
      }))
    };
  }

  private generateSuggestions(query: string, entities: IndexedEntity[]): string[] {
    const suggestions = new Set<string>();
    const queryWords = this.processContent(query);
    
    // Find related terms from matching entities
    for (const entity of entities.slice(0, 20)) { // Limit to top 20 for performance
      const allWords = [
        ...this.processContent(entity.title),
        ...this.processContent(entity.description),
        ...entity.tags.flatMap(tag => this.processContent(tag))
      ];
      
      for (const word of allWords) {
        if (!queryWords.includes(word) && word.length > 2) {
          suggestions.add(word);
        }
        
        if (suggestions.size >= 10) break;
      }
    }
    
    return Array.from(suggestions).slice(0, 5);
  }

  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      text: query.text,
      filters: query.filters,
      sorting: query.sorting,
      pagination: { page: query.pagination.page, limit: query.pagination.limit }
    });
  }

  private clearRelatedCaches(entityId: string): void {
    // Clear query cache entries that might be affected
    for (const [key, response] of this.queryCache) {
      if (response.results.some(result => result.entityId === entityId)) {
        this.queryCache.delete(key);
      }
    }
    
    // Clear facet cache
    this.facetCache.clear();
  }

  private startIndexUpdates(): void {
    this.indexUpdateTimer = setInterval(async () => {
      if (this.pendingUpdates.size > 0) {
        await this.persistIndex();
      }
    }, 60000); // Update every minute
    
    // Use the timer to avoid unused variable warning
    void this.indexUpdateTimer;
  }

  private async loadSearchIndex(): Promise<void> {
    try {
      const indexFile = path.join(this.indexDir, 'search-index.json');
      await fs.access(indexFile);
      const content = await fs.readFile(indexFile, 'utf-8');
      const data = JSON.parse(content);
      
      // Reconstruct Map from stored data
      this.searchIndex = new Map(data.searchIndex.map(([key, values]: [string, string[]]) => 
        [key, new Set(values)]
      ));
      
      this.reverseIndex = new Map(data.reverseIndex.map(([key, values]: [string, string[]]) => 
        [key, new Set(values)]
      ));
      
      this.logger.info('Search index loaded', {
        wordsCount: this.searchIndex.size,
        entitiesCount: this.reverseIndex.size
      });
    } catch {
      // Index file doesn't exist yet
      this.logger.info('No existing search index found, starting fresh');
    }
  }

  private async loadEntities(): Promise<void> {
    try {
      const entitiesFile = path.join(this.indexDir, 'entities.json');
      await fs.access(entitiesFile);
      const content = await fs.readFile(entitiesFile, 'utf-8');
      const entities = JSON.parse(content) as IndexedEntity[];
      
      entities.forEach(entity => this.entities.set(entity.id, entity));
      
      this.logger.info('Entities loaded', { count: this.entities.size });
    } catch {
      // Entities file doesn't exist yet
    }
  }

  private async persistIndex(): Promise<void> {
    try {
      // Convert Maps to serializable format
      const indexData = {
        searchIndex: Array.from(this.searchIndex.entries()).map(([key, values]) => 
          [key, Array.from(values)]
        ),
        reverseIndex: Array.from(this.reverseIndex.entries()).map(([key, values]) => 
          [key, Array.from(values)]
        )
      };
      
      const indexFile = path.join(this.indexDir, 'search-index.json');
      await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf-8');
      
      // Persist entities
      const entitiesFile = path.join(this.indexDir, 'entities.json');
      const entities = Array.from(this.entities.values());
      await fs.writeFile(entitiesFile, JSON.stringify(entities, null, 2), 'utf-8');
      
      this.pendingUpdates.clear();
      
      this.logger.debug('Search index persisted', {
        wordsCount: this.searchIndex.size,
        entitiesCount: this.entities.size
      });
    } catch (error) {
      this.logger.error('Failed to persist search index', error as Error);
    }
  }

  private async calculateIndexSize(): Promise<number> {
    try {
      let totalSize = 0;
      const files = await fs.readdir(this.indexDir);
      
      for (const file of files) {
        const stats = await fs.stat(path.join(this.indexDir, file));
        totalSize += stats.size;
      }
      
      return totalSize / (1024 * 1024); // Convert to MB
    } catch {
      return 0;
    }
  }

  private getEntityTypeStats(): Record<SearchEntityType, number> {
    const stats: Record<string, number> = {};
    
    for (const entity of this.entities.values()) {
      stats[entity.type] = (stats[entity.type] || 0) + 1;
    }
    
    return stats as Record<SearchEntityType, number>;
  }

  private getTopWords(limit: number): Array<{ word: string; count: number }> {
    return Array.from(this.searchIndex.entries())
      .map(([word, entityIds]) => ({ word, count: entityIds.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}