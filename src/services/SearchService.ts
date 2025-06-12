/**
 * Enhanced search service with full-text search and advanced filtering
 */

import { Session } from '../models/Session';
import { 
  SearchOptions, 
  FilterCriteria, 
  SortOptions, 
  SearchResult,
  SearchFacets,
  FacetBucket,
  DatePreset,
  SavedFilter,
  SessionTag,
  SessionFolder,
  OrganizationMetadata
} from '../models/SearchFilter';
import { LocalCacheService } from './cache/LocalCacheService';
import { Logger } from '../lib/logging/Logger';
import Database from 'better-sqlite3';

export class SearchService {
  private static instance: SearchService;
  private cache: LocalCacheService;
  private logger: Logger;
  private db: Database.Database | null = null;

  private constructor() {
    this.logger = new Logger('SearchService');
    this.cache = new LocalCacheService(this.logger);
  }

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  async initialize(db: Database.Database): Promise<void> {
    this.db = db;
    await this.createSearchIndexes();
    await this.createOrganizationTables();
  }

  private async createSearchIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexes = `
      -- Create full-text search virtual table
      CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
        id UNINDEXED,
        name,
        description,
        request_content,
        instructions_content,
        result_output,
        error_message,
        tags,
        content=sessions,
        content_rowid=rowid
      );

      -- Create triggers to keep FTS index in sync
      CREATE TRIGGER IF NOT EXISTS sessions_fts_insert AFTER INSERT ON sessions BEGIN
        INSERT INTO sessions_fts(rowid, id, name, description, request_content)
        SELECT NEW.rowid, NEW.id, NEW.title, NEW.description, 
               json_extract(NEW.metadata, '$.request.content');
      END;

      CREATE TRIGGER IF NOT EXISTS sessions_fts_delete AFTER DELETE ON sessions BEGIN
        DELETE FROM sessions_fts WHERE rowid = OLD.rowid;
      END;

      CREATE TRIGGER IF NOT EXISTS sessions_fts_update AFTER UPDATE ON sessions BEGIN
        DELETE FROM sessions_fts WHERE rowid = OLD.rowid;
        INSERT INTO sessions_fts(rowid, id, name, description, request_content)
        SELECT NEW.rowid, NEW.id, NEW.title, NEW.description,
               json_extract(NEW.metadata, '$.request.content');
      END;

      -- Additional indexes for performance
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_metadata_tags ON sessions(json_extract(metadata, '$.tags'));
      CREATE INDEX IF NOT EXISTS idx_sessions_metadata_favorite ON sessions(json_extract(metadata, '$.organizationMetadata.isFavorite'));
      CREATE INDEX IF NOT EXISTS idx_sessions_duration ON sessions(total_duration);
    `;

    this.db.exec(indexes);
  }

  private async createOrganizationTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = `
      -- Tags table
      CREATE TABLE IF NOT EXISTS session_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        description TEXT,
        session_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT DEFAULT (datetime('now'))
      );

      -- Folders table
      CREATE TABLE IF NOT EXISTS session_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        color TEXT,
        icon TEXT,
        session_count INTEGER DEFAULT 0,
        subfolder_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        path TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES session_folders(id) ON DELETE CASCADE
      );

      -- Saved filters table
      CREATE TABLE IF NOT EXISTS saved_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        filter_json TEXT NOT NULL,
        search_json TEXT,
        sort_json TEXT,
        is_public INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        usage_count INTEGER DEFAULT 0
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_tags_name ON session_tags(name);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON session_folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_folders_path ON session_folders(path);
      CREATE INDEX IF NOT EXISTS idx_saved_filters_pinned ON saved_filters(is_pinned);
    `;

    this.db.exec(tables);
  }

  /**
   * Perform full-text search with advanced options
   */
  async search(
    options: SearchOptions,
    filter?: FilterCriteria,
    sort?: SortOptions
  ): Promise<SearchResult<Session>> {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    
    // Build the search query
    let query = this.buildSearchQuery(options, filter, sort);
    
    // Execute search
    const stmt = this.db.prepare(query.sql);
    const results = stmt.all(...query.params);
    
    // Get total count
    const countQuery = this.buildCountQuery(options, filter);
    const countStmt = this.db.prepare(countQuery.sql);
    const totalCount = (countStmt.get(...countQuery.params) as any).count;
    
    // Process results
    const sessions = results.map((row: any) => this.deserializeSession(row));
    
    // Generate facets if needed
    const facets = await this.generateFacets(filter);
    
    // Calculate performance metrics
    const searchTimeMs = Date.now() - startTime;
    
    return {
      items: sessions,
      totalCount,
      hasMore: sessions.length < totalCount,
      facets,
      performanceMetrics: {
        searchTimeMs,
        indexUsed: true
      }
    };
  }

  private buildSearchQuery(
    options: SearchOptions,
    filter?: FilterCriteria,
    sort?: SortOptions
  ): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = `
      SELECT DISTINCT s.*
      FROM sessions s
    `;

    const conditions: string[] = [];

    // Add full-text search if query provided
    if (options.query) {
      sql += ` JOIN sessions_fts fts ON s.rowid = fts.rowid `;
      conditions.push(`sessions_fts MATCH ?`);
      params.push(this.formatFTSQuery(options.query));
    }

    // Add filter conditions
    if (filter) {
      const filterConditions = this.buildFilterConditions(filter, params);
      conditions.push(...filterConditions);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add sorting
    if (sort) {
      sql += ` ORDER BY ${this.buildSortClause(sort)}`;
    } else {
      sql += ` ORDER BY s.created_at DESC`;
    }

    // Add pagination
    if (options.maxResults) {
      sql += ` LIMIT ?`;
      params.push(options.maxResults);
      
      if (options.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    return { sql, params };
  }

  private buildCountQuery(
    options: SearchOptions,
    filter?: FilterCriteria
  ): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = `
      SELECT COUNT(DISTINCT s.id) as count
      FROM sessions s
    `;

    const conditions: string[] = [];

    // Add full-text search if query provided
    if (options.query) {
      sql += ` JOIN sessions_fts fts ON s.rowid = fts.rowid `;
      conditions.push(`sessions_fts MATCH ?`);
      params.push(this.formatFTSQuery(options.query));
    }

    // Add filter conditions
    if (filter) {
      const filterConditions = this.buildFilterConditions(filter, params);
      conditions.push(...filterConditions);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    return { sql, params };
  }

  private formatFTSQuery(query: string): string {
    // Escape special FTS5 characters and format query
    const escaped = query.replace(/['"]/g, '');
    
    // Split into terms and quote each
    const terms = escaped.split(/\s+/).filter(t => t.length > 0);
    
    // Join with AND operator for all terms to match
    return terms.map(term => `"${term}"*`).join(' AND ');
  }

  private buildFilterConditions(filter: FilterCriteria, params: any[]): string[] {
    const conditions: string[] = [];

    // Status filter
    if (filter.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(',');
      conditions.push(`s.status IN (${placeholders})`);
      params.push(...filter.status);
    }

    // Date range filter
    if (filter.dateRange) {
      const dateConditions = this.buildDateRangeConditions(filter.dateRange, params);
      conditions.push(...dateConditions);
    }

    // Project filter
    if (filter.projects && filter.projects.length > 0) {
      const placeholders = filter.projects.map(() => '?').join(',');
      conditions.push(`s.project_id IN (${placeholders})`);
      params.push(...filter.projects);
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => 
        `json_extract(s.metadata, '$.organizationMetadata.tags') LIKE ?`
      );
      conditions.push(`(${tagConditions.join(' OR ')})`);
      params.push(...filter.tags.map(tag => `%"${tag}"%`));
    }

    // Folders filter
    if (filter.folders && filter.folders.length > 0) {
      const folderConditions = filter.folders.map(() => 
        `json_extract(s.metadata, '$.organizationMetadata.folders') LIKE ?`
      );
      conditions.push(`(${folderConditions.join(' OR ')})`);
      params.push(...filter.folders.map(folder => `%"${folder}"%`));
    }

    // Favorite filter
    if (filter.isFavorite !== undefined) {
      conditions.push(`json_extract(s.metadata, '$.organizationMetadata.isFavorite') = ?`);
      params.push(filter.isFavorite ? 1 : 0);
    }

    // Error filter
    if (filter.hasError !== undefined) {
      if (filter.hasError) {
        conditions.push(`json_extract(s.metadata, '$.error') IS NOT NULL`);
      } else {
        conditions.push(`json_extract(s.metadata, '$.error') IS NULL`);
      }
    }

    // Duration filter
    if (filter.duration) {
      const durationConditions = this.buildDurationConditions(filter.duration, params);
      conditions.push(...durationConditions);
    }

    return conditions;
  }

  private buildDateRangeConditions(dateRange: any, params: any[]): string[] {
    const conditions: string[] = [];

    if (dateRange.preset) {
      const { from, to } = this.getPresetDateRange(dateRange.preset);
      conditions.push(`s.created_at >= ?`);
      params.push(from.toISOString());
      conditions.push(`s.created_at <= ?`);
      params.push(to.toISOString());
    } else {
      if (dateRange.from) {
        conditions.push(`s.created_at >= ?`);
        params.push(dateRange.from.toISOString());
      }
      if (dateRange.to) {
        conditions.push(`s.created_at <= ?`);
        params.push(dateRange.to.toISOString());
      }
    }

    return conditions;
  }

  private getPresetDateRange(preset: DatePreset): { from: Date; to: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return { from: today, to: now };
      
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday, to: today };
      
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { from: weekStart, to: now };
      
      case 'lastWeek':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return { from: lastWeekStart, to: lastWeekEnd };
      
      case 'thisMonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: monthStart, to: now };
      
      case 'lastMonth':
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { from: lastMonthStart, to: lastMonthEnd };
      
      case 'last7Days':
        const week = new Date(now);
        week.setDate(week.getDate() - 7);
        return { from: week, to: now };
      
      case 'last30Days':
        const month = new Date(now);
        month.setDate(month.getDate() - 30);
        return { from: month, to: now };
      
      case 'last90Days':
        const quarter = new Date(now);
        quarter.setDate(quarter.getDate() - 90);
        return { from: quarter, to: now };
      
      default:
        return { from: today, to: now };
    }
  }

  private buildDurationConditions(duration: any, params: any[]): string[] {
    const conditions: string[] = [];
    let multiplier = 1000; // Default to milliseconds

    if (duration.unit === 'seconds') multiplier = 1000;
    else if (duration.unit === 'minutes') multiplier = 60000;
    else if (duration.unit === 'hours') multiplier = 3600000;

    if (duration.min !== undefined) {
      conditions.push(`CAST(s.total_duration AS INTEGER) >= ?`);
      params.push(duration.min * multiplier);
    }

    if (duration.max !== undefined) {
      conditions.push(`CAST(s.total_duration AS INTEGER) <= ?`);
      params.push(duration.max * multiplier);
    }

    return conditions;
  }

  private buildSortClause(sort: SortOptions): string {
    const direction = sort.direction.toUpperCase();
    const nullHandling = sort.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST';

    switch (sort.field) {
      case 'createdAt':
        return `s.created_at ${direction} ${nullHandling}`;
      case 'updatedAt':
        return `s.updated_at ${direction} ${nullHandling}`;
      case 'completedAt':
        return `json_extract(s.metadata, '$.completedAt') ${direction} ${nullHandling}`;
      case 'name':
        return `s.title ${direction} ${nullHandling}`;
      case 'status':
        return `s.status ${direction} ${nullHandling}`;
      case 'duration':
        return `CAST(s.total_duration AS INTEGER) ${direction} ${nullHandling}`;
      case 'projectId':
        return `s.project_id ${direction} ${nullHandling}`;
      case 'favoriteCount':
        return `json_extract(s.metadata, '$.organizationMetadata.favoriteAddedAt') ${direction} ${nullHandling}`;
      default:
        return `s.created_at DESC`;
    }
  }

  private async generateFacets(filter?: FilterCriteria): Promise<SearchFacets> {
    if (!this.db) throw new Error('Database not initialized');

    // Generate status facets
    const statusFacets = await this.generateStatusFacets(filter);
    
    // Generate project facets
    const projectFacets = await this.generateProjectFacets(filter);
    
    // Generate tag facets
    const tagFacets = await this.generateTagFacets(filter);
    
    // Generate date range facets
    const dateRangeFacets = await this.generateDateRangeFacets(filter);

    return {
      status: statusFacets,
      projects: projectFacets,
      tags: tagFacets,
      dateRanges: dateRangeFacets
    };
  }

  private async generateStatusFacets(filter?: FilterCriteria): Promise<FacetBucket<any>[]> {
    if (!this.db) return [];

    const sql = `
      SELECT status as value, COUNT(*) as count
      FROM sessions
      GROUP BY status
      ORDER BY count DESC
    `;

    const results = this.db.prepare(sql).all();
    return results.map((row: any) => ({
      value: row.value,
      count: row.count,
      label: this.formatStatusLabel(row.value)
    }));
  }

  private async generateProjectFacets(filter?: FilterCriteria): Promise<FacetBucket<string>[]> {
    if (!this.db) return [];

    const sql = `
      SELECT project_id as value, COUNT(*) as count
      FROM sessions
      GROUP BY project_id
      ORDER BY count DESC
      LIMIT 10
    `;

    const results = this.db.prepare(sql).all();
    return results.map((row: any) => ({
      value: row.value,
      count: row.count
    }));
  }

  private async generateTagFacets(filter?: FilterCriteria): Promise<FacetBucket<string>[]> {
    if (!this.db) return [];

    const sql = `
      SELECT name as value, session_count as count
      FROM session_tags
      ORDER BY session_count DESC
      LIMIT 20
    `;

    const results = this.db.prepare(sql).all();
    return results.map((row: any) => ({
      value: row.value,
      count: row.count
    }));
  }

  private async generateDateRangeFacets(filter?: FilterCriteria): Promise<FacetBucket<string>[]> {
    return [
      { value: 'today', count: 0, label: 'Today' },
      { value: 'yesterday', count: 0, label: 'Yesterday' },
      { value: 'thisWeek', count: 0, label: 'This Week' },
      { value: 'lastWeek', count: 0, label: 'Last Week' },
      { value: 'thisMonth', count: 0, label: 'This Month' },
      { value: 'lastMonth', count: 0, label: 'Last Month' }
    ];
  }

  private formatStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      planning: 'Planning',
      validating: 'Validating',
      executing: 'Executing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }

  /**
   * Tag management
   */
  async createTag(tag: Omit<SessionTag, 'id' | 'sessionCount' | 'createdAt' | 'lastUsedAt'>): Promise<SessionTag> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO session_tags (id, name, color, description, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, tag.name, tag.color, tag.description, now, now);

    return {
      id,
      ...tag,
      sessionCount: 0,
      createdAt: now,
      lastUsedAt: now
    };
  }

  async getTags(): Promise<SessionTag[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM session_tags
      ORDER BY session_count DESC, name ASC
    `);

    return stmt.all() as SessionTag[];
  }

  async updateTag(id: string, updates: Partial<SessionTag>): Promise<SessionTag> {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE session_tags
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    const getStmt = this.db.prepare('SELECT * FROM session_tags WHERE id = ?');
    return getStmt.get(id) as SessionTag;
  }

  async deleteTag(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM session_tags WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Folder management
   */
  async createFolder(folder: Omit<SessionFolder, 'id' | 'sessionCount' | 'subfolderCount' | 'createdAt' | 'updatedAt' | 'path'>): Promise<SessionFolder> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();

    // Calculate path
    let path: string[] = [folder.name];
    if (folder.parentId) {
      const parentStmt = this.db.prepare('SELECT path FROM session_folders WHERE id = ?');
      const parent = parentStmt.get(folder.parentId) as any;
      if (parent) {
        path = [...JSON.parse(parent.path), folder.name];
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO session_folders (id, name, description, parent_id, color, icon, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      folder.name,
      folder.description,
      folder.parentId,
      folder.color,
      folder.icon,
      JSON.stringify(path),
      now,
      now
    );

    // Update parent's subfolder count
    if (folder.parentId) {
      const updateParent = this.db.prepare(`
        UPDATE session_folders
        SET subfolder_count = subfolder_count + 1
        WHERE id = ?
      `);
      updateParent.run(folder.parentId);
    }

    return {
      id,
      ...folder,
      sessionCount: 0,
      subfolderCount: 0,
      createdAt: now,
      updatedAt: now,
      path
    };
  }

  async getFolders(parentId?: string): Promise<SessionFolder[]> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = parentId
      ? 'SELECT * FROM session_folders WHERE parent_id = ? ORDER BY name'
      : 'SELECT * FROM session_folders WHERE parent_id IS NULL ORDER BY name';

    const stmt = this.db.prepare(sql);
    const results = parentId ? stmt.all(parentId) : stmt.all();

    return results.map((row: any) => ({
      ...row,
      path: JSON.parse(row.path)
    }));
  }

  async updateFolder(id: string, updates: Partial<SessionFolder>): Promise<SessionFolder> {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }
    if (updates.icon !== undefined) {
      fields.push('icon = ?');
      values.push(updates.icon);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE session_folders
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    const getStmt = this.db.prepare('SELECT * FROM session_folders WHERE id = ?');
    const folder = getStmt.get(id) as any;
    return {
      ...folder,
      path: JSON.parse(folder.path)
    };
  }

  async deleteFolder(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Update parent's subfolder count
    const folderStmt = this.db.prepare('SELECT parent_id FROM session_folders WHERE id = ?');
    const folder = folderStmt.get(id) as any;
    
    if (folder?.parent_id) {
      const updateParent = this.db.prepare(`
        UPDATE session_folders
        SET subfolder_count = subfolder_count - 1
        WHERE id = ?
      `);
      updateParent.run(folder.parent_id);
    }

    const stmt = this.db.prepare('DELETE FROM session_folders WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Saved filter management
   */
  async createSavedFilter(filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<SavedFilter> {
    if (!this.db) throw new Error('Database not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO saved_filters (
        id, name, description, filter_json, search_json, sort_json,
        is_public, is_pinned, created_at, updated_at, usage_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    stmt.run(
      id,
      filter.name,
      filter.description,
      JSON.stringify(filter.filter),
      filter.search ? JSON.stringify(filter.search) : null,
      filter.sort ? JSON.stringify(filter.sort) : null,
      filter.isPublic ? 1 : 0,
      filter.isPinned ? 1 : 0,
      now,
      now
    );

    return {
      id,
      ...filter,
      createdAt: now,
      updatedAt: now,
      usageCount: 0
    };
  }

  async getSavedFilters(): Promise<SavedFilter[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM saved_filters
      ORDER BY is_pinned DESC, usage_count DESC, name ASC
    `);

    const results = stmt.all();
    return results.map((row: any) => ({
      ...row,
      filter: JSON.parse(row.filter_json),
      search: row.search_json ? JSON.parse(row.search_json) : undefined,
      sort: row.sort_json ? JSON.parse(row.sort_json) : undefined,
      isPublic: row.is_public === 1,
      isPinned: row.is_pinned === 1
    }));
  }

  async updateSavedFilter(id: string, updates: Partial<SavedFilter>): Promise<SavedFilter> {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.filter !== undefined) {
      fields.push('filter_json = ?');
      values.push(JSON.stringify(updates.filter));
    }
    if (updates.search !== undefined) {
      fields.push('search_json = ?');
      values.push(JSON.stringify(updates.search));
    }
    if (updates.sort !== undefined) {
      fields.push('sort_json = ?');
      values.push(JSON.stringify(updates.sort));
    }
    if (updates.isPublic !== undefined) {
      fields.push('is_public = ?');
      values.push(updates.isPublic ? 1 : 0);
    }
    if (updates.isPinned !== undefined) {
      fields.push('is_pinned = ?');
      values.push(updates.isPinned ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE saved_filters
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    // Increment usage count
    const incrementStmt = this.db.prepare(`
      UPDATE saved_filters
      SET usage_count = usage_count + 1
      WHERE id = ?
    `);
    incrementStmt.run(id);

    const getStmt = this.db.prepare('SELECT * FROM saved_filters WHERE id = ?');
    const filter = getStmt.get(id) as any;
    
    return {
      ...filter,
      filter: JSON.parse(filter.filter_json),
      search: filter.search_json ? JSON.parse(filter.search_json) : undefined,
      sort: filter.sort_json ? JSON.parse(filter.sort_json) : undefined,
      isPublic: filter.is_public === 1,
      isPinned: filter.is_pinned === 1
    };
  }

  async deleteSavedFilter(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM saved_filters WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Update session organization metadata
   */
  async updateSessionOrganization(sessionId: string, metadata: Partial<OrganizationMetadata>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get current session
    const getStmt = this.db.prepare('SELECT metadata FROM sessions WHERE id = ?');
    const session = getStmt.get(sessionId) as any;
    
    if (!session) throw new Error('Session not found');

    const currentMetadata = JSON.parse(session.metadata || '{}');
    const currentOrgMetadata = currentMetadata.organizationMetadata || {};

    // Update organization metadata
    const updatedOrgMetadata = {
      ...currentOrgMetadata,
      ...metadata
    };

    if (metadata.isFavorite === true && !currentOrgMetadata.favoriteAddedAt) {
      updatedOrgMetadata.favoriteAddedAt = new Date().toISOString();
    } else if (metadata.isFavorite === false) {
      delete updatedOrgMetadata.favoriteAddedAt;
    }

    const updatedMetadata = {
      ...currentMetadata,
      organizationMetadata: updatedOrgMetadata
    };

    // Update session
    const updateStmt = this.db.prepare(`
      UPDATE sessions
      SET metadata = ?, updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(
      JSON.stringify(updatedMetadata),
      new Date().toISOString(),
      sessionId
    );

    // Update tag usage counts
    if (metadata.tags) {
      await this.updateTagUsageCounts();
    }

    // Update folder session counts
    if (metadata.folders) {
      await this.updateFolderSessionCounts();
    }
  }

  private async updateTagUsageCounts(): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      UPDATE session_tags
      SET session_count = (
        SELECT COUNT(DISTINCT s.id)
        FROM sessions s
        WHERE json_extract(s.metadata, '$.organizationMetadata.tags') LIKE '%"' || session_tags.name || '"%'
      )
    `);

    stmt.run();
  }

  private async updateFolderSessionCounts(): Promise<void> {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      UPDATE session_folders
      SET session_count = (
        SELECT COUNT(DISTINCT s.id)
        FROM sessions s
        WHERE json_extract(s.metadata, '$.organizationMetadata.folders') LIKE '%"' || session_folders.id || '"%'
      )
    `);

    stmt.run();
  }

  private deserializeSession(row: any): Session {
    const metadata = JSON.parse(row.metadata || '{}');
    const { request, instructions, result, error, ...sessionMetadata } = metadata;

    return {
      id: row.id,
      name: row.title || 'Untitled Session',
      description: row.description || '',
      status: row.status || 'pending',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.status === 'completed' ? row.updated_at : undefined,
      userId: row.user_id,
      projectId: row.project_id,
      request: request || {
        id: row.id,
        sessionId: row.id,
        userId: row.user_id,
        content: row.description || '',
        context: {},
        timestamp: row.created_at
      },
      instructions: instructions,
      result: result,
      error: error,
      metadata: {
        ...sessionMetadata,
        totalDuration: row.total_duration ? Number(row.total_duration) : undefined
      }
    };
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}