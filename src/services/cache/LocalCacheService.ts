
/**
 * Local SQLite Cache Service for SessionHub
 * Provides fast local caching of Supabase data with offline support
 * Uses better-sqlite3 for synchronous operations and better performance
 */

import Database from 'better-sqlite3';
import { Logger } from '@/src/lib/logging/Logger';
import { 
  Project,
  SupabaseService 
} from '@/src/services/cloud/SupabaseService';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Conditional electron import for test compatibility
let electronApp: any;
try {
  electronApp = eval("require('electron')").app;
} catch (e) {
  // Not in electron environment
}

// Cache configuration
export interface CacheConfig {
  maxSizeBytes?: number; // Maximum cache size in bytes
  maxRecords?: number; // Maximum number of records per table
  ttlSeconds?: number; // Time to live for cached records
  syncIntervalSeconds?: number; // Interval for syncing with Supabase
  enableAutoSync?: boolean; // Enable automatic syncing
  cachePath?: string; // Custom cache directory path
}

// Sync status for records
export interface SyncStatus {
  id: string;
  table_name: string;
  operation: 'create' | 'update' | 'delete';
  local_version: number;
  remote_version?: number;
  sync_status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
  last_sync_attempt?: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

// Cache statistics
export interface CacheStats {
  totalSize: number;
  recordCounts: Record<string, number>;
  pendingSyncs: number;
  lastSync?: string;
  cacheHitRate: number;
  oldestRecord?: string;
}

// Migration interface
export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export class LocalCacheService {
  private db: Database.Database | null = null;
  private readonly logger: Logger;
  private readonly config: Required<CacheConfig>;
  private syncInterval: NodeJS.Timeout | null = null;
  private supabaseService: SupabaseService | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly defaultCachePath: string;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<CacheConfig> = {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxRecords: 10000,
    ttlSeconds: 3600, // 1 hour
    syncIntervalSeconds: 300, // 5 minutes
    enableAutoSync: true,
    cachePath: ''
  };

  // SQL type mappings
  // Commented out for future use
  // private readonly typeMap: Record<string, string> = {
  //   'uuid': 'TEXT',
  //   'varchar': 'TEXT',
  //   'text': 'TEXT',
  //   'timestamp with time zone': 'TEXT',
  //   'jsonb': 'TEXT',
  //   'integer': 'INTEGER',
  //   'decimal': 'REAL',
  //   'interval': 'TEXT',
  //   'boolean': 'INTEGER'
  // };

  constructor(logger: Logger, config?: CacheConfig) {
    this.logger = logger;
    // Use electron userData path if available, otherwise use os temp dir
    try {
      this.defaultCachePath = electronApp && electronApp.getPath
        ? path.join(electronApp.getPath('userData'), 'cache')
        : path.join(os.tmpdir(), 'sessionhub-cache');
    } catch (e) {
      this.defaultCachePath = path.join(os.tmpdir(), 'sessionhub-cache');
    }
    this.config = {
      ...LocalCacheService.DEFAULT_CONFIG,
      ...config,
      cachePath: config?.cachePath || this.defaultCachePath
    };
  }

  /**
   * Initialize the cache database
   */
  async initialize(supabaseService?: SupabaseService): Promise<void> {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(this.config.cachePath)) {
        fs.mkdirSync(this.config.cachePath, { recursive: true });
      }

      // Open database connection
      const dbPath = path.join(this.config.cachePath, 'sessionhub-cache.db');
      this.db = new Database(dbPath);
      
      // Enable foreign keys and optimize for performance
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -20000'); // 20MB cache
      this.db.pragma('temp_store = MEMORY');

      // Create schema
      await this.createSchema();
      
      // Run migrations
      await this.runMigrations();

      // Set up Supabase service
      if (supabaseService) {
        this.supabaseService = supabaseService;
        
        // Start sync interval if enabled
        if (this.config.enableAutoSync) {
          this.startSyncInterval();
        }
      }

      this.logger.info('Local cache initialized successfully', { 
        path: dbPath,
        config: this.config 
      });
    } catch (error: any) {
      this.logger.error('Failed to initialize local cache', error as Error);
      throw error;
    }
  }

  /**
   * Create the cache schema
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const createTables = `
      -- Metadata table for tracking cache state
      CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Projects table (mirror of Supabase)
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        type TEXT DEFAULT 'other',
        created_at TEXT DEFAULT (datetime('now')),
        last_accessed TEXT DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}',
        -- Cache metadata
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_expires_at TEXT,
        version INTEGER DEFAULT 1
      );

      -- Sessions table (mirror of Supabase)
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}',
        title TEXT,
        description TEXT,
        total_duration TEXT,
        -- Cache metadata
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_expires_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Instructions table (mirror of Supabase)
      CREATE TABLE IF NOT EXISTS instructions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}',
        sequence_number INTEGER,
        parent_instruction_id TEXT,
        -- Cache metadata
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_expires_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_instruction_id) REFERENCES instructions(id) ON DELETE SET NULL,
        UNIQUE(session_id, sequence_number)
      );

      -- Execution results table (mirror of Supabase)
      CREATE TABLE IF NOT EXISTS execution_results (
        id TEXT PRIMARY KEY,
        instruction_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        outputs TEXT DEFAULT '{}',
        errors TEXT DEFAULT '[]',
        duration TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        resources_used TEXT DEFAULT '{}',
        -- Cache metadata
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_expires_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (instruction_id) REFERENCES instructions(id) ON DELETE CASCADE
      );

      -- Patterns table (mirror of Supabase)
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        description TEXT NOT NULL,
        frequency INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.00,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT,
        project_id TEXT,
        -- Cache metadata
        cached_at TEXT DEFAULT (datetime('now')),
        ttl_expires_at TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      -- Sync tracking table
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        local_version INTEGER NOT NULL,
        remote_version INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'pending' 
          CHECK (sync_status IN ('pending', 'syncing', 'synced', 'conflict', 'error')),
        last_sync_attempt TEXT,
        sync_error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(record_id, table_name)
      );

      -- Cache statistics table
      CREATE TABLE IF NOT EXISTS cache_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_type TEXT NOT NULL,
        stat_value TEXT NOT NULL,
        recorded_at TEXT DEFAULT (datetime('now'))
      );

      -- Migration tracking table
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed DESC);
      CREATE INDEX IF NOT EXISTS idx_projects_ttl ON projects(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_ttl ON sessions(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_instructions_session_id ON instructions(session_id);
      CREATE INDEX IF NOT EXISTS idx_instructions_type ON instructions(type);
      CREATE INDEX IF NOT EXISTS idx_instructions_ttl ON instructions(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_execution_results_instruction_id ON execution_results(instruction_id);
      CREATE INDEX IF NOT EXISTS idx_execution_results_status ON execution_results(status);
      CREATE INDEX IF NOT EXISTS idx_execution_results_ttl ON execution_results(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_patterns_frequency ON patterns(frequency DESC);
      CREATE INDEX IF NOT EXISTS idx_patterns_ttl ON patterns(ttl_expires_at);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);

      -- Create triggers for update timestamps
      CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
        AFTER UPDATE ON sessions
        BEGIN
          UPDATE sessions SET updated_at = datetime('now') WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_patterns_timestamp 
        AFTER UPDATE ON patterns
        BEGIN
          UPDATE patterns SET updated_at = datetime('now') WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_sync_queue_timestamp 
        AFTER UPDATE ON sync_queue
        BEGIN
          UPDATE sync_queue SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
    `;

    this.db.exec(createTables);
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const migrations: Migration[] = [
      {
        version: 1,
        name: 'initial_schema',
        up: '', // Schema created in createSchema()
        down: ''
      },
      // Add future migrations here
    ];

    const getAppliedVersions = this.db.prepare(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedVersions = new Set(
      getAppliedVersions.all().map((row: any) => row.version)
    );

    const insertMigration = this.db.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
    );

    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version) && migration.up) {
        try {
          this.db.exec(migration.up);
          insertMigration.run(migration.version, migration.name);
          this.logger.info(`Applied migration: ${migration.name}`);
        } catch (error: any) {
          this.logger.error(`Failed to apply migration ${migration.name}`, error as Error);
          throw error;
        }
      }
    }
  }

  /**
   * Start automatic sync interval
   */
  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncWithSupabase();
      } catch (error: any) {
        this.logger.error('Sync interval failed', error as Error);
      }
    }, this.config.syncIntervalSeconds * 1000);

    this.logger.info('Sync interval started', { 
      intervalSeconds: this.config.syncIntervalSeconds 
    });
  }

  /**
   * Calculate TTL expiration time
   */
  private getTTLExpiration(): string {
    const expirationTime = new Date();
    expirationTime.setSeconds(expirationTime.getSeconds() + this.config.ttlSeconds);
    return expirationTime.toISOString();
  }

  /**
   * Check if a record is expired
   */
  private isExpired(ttlExpiresAt?: string | null): boolean {
    if (!ttlExpiresAt) return false;
    return new Date(ttlExpiresAt) < new Date();
  }

  /**
   * Get cache size in bytes
   */
  private getCacheSize(): number {
    if (!this.db) return 0;
    
    const result = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get();
    return (result as any)?.size || 0;
  }

  /**
   * Enforce cache size limits with LRU eviction
   */
  private async enforceCacheLimits(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(() => {
      // Check size limit
      const currentSize = this.getCacheSize();
      if (currentSize > this.config.maxSizeBytes) {
        this.logger.warn('Cache size limit exceeded, performing LRU eviction', {
          currentSize,
          maxSize: this.config.maxSizeBytes
        });
        
        // Evict oldest records first (LRU)
        const tables = ['execution_results', 'instructions', 'sessions', 'patterns', 'projects'];
        for (const table of tables) {
          const deleteOldest = this.db!.prepare(
            `DELETE FROM ${table} 
             WHERE id IN (
               SELECT id FROM ${table} 
               ORDER BY cached_at ASC 
               LIMIT ?
             )`
          );
          
          // Delete 10% of records at a time
          const recordCount = this.db!.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          const deleteCount = Math.floor((recordCount as any).count * 0.1);
          if (deleteCount > 0) {
            deleteOldest.run(deleteCount);
          }
        }
      }

      // Check record count limits per table
      const tables = ['projects', 'sessions', 'instructions', 'execution_results', 'patterns'];
      for (const table of tables) {
        const countResult = this.db!.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        if ((countResult as any).count > this.config.maxRecords) {
          const deleteCount = (countResult as any).count - this.config.maxRecords;
          const deleteOldest = this.db!.prepare(
            `DELETE FROM ${table} 
             WHERE id IN (
               SELECT id FROM ${table} 
               ORDER BY cached_at ASC 
               LIMIT ?
             )`
          );
          deleteOldest.run(deleteCount);
          this.logger.info(`Evicted ${deleteCount} records from ${table}`);
        }
      }

      // Clean up expired records
      for (const table of tables) {
        const deleteExpired = this.db!.prepare(
          `DELETE FROM ${table} WHERE ttl_expires_at < datetime('now')`
        );
        const result = deleteExpired.run();
        if (result.changes > 0) {
          this.logger.info(`Cleaned up ${result.changes} expired records from ${table}`);
        }
      }
    });

    transaction();
  }

  /**
   * Track sync operation
   */
  private trackSync(
    recordId: string, 
    tableName: string, 
    operation: 'create' | 'update' | 'delete',
    localVersion: number
  ): void {
    if (!this.db) return;

    const upsert = this.db.prepare(`
      INSERT INTO sync_queue (record_id, table_name, operation, local_version, sync_status)
      VALUES (?, ?, ?, ?, 'pending')
      ON CONFLICT(record_id, table_name) 
      DO UPDATE SET 
        operation = excluded.operation,
        local_version = excluded.local_version,
        sync_status = 'pending',
        updated_at = datetime('now')
    `);

    upsert.run(recordId, tableName, operation, localVersion);
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(
    recordId: string, 
    tableName: string, 
    status: SyncStatus['sync_status'],
    error?: string
  ): void {
    if (!this.db) return;

    const update = this.db.prepare(`
      UPDATE sync_queue 
      SET sync_status = ?, 
          last_sync_attempt = datetime('now'),
          sync_error = ?,
          updated_at = datetime('now')
      WHERE record_id = ? AND table_name = ?
    `);

    update.run(status, error || null, recordId, tableName);
  }

  // CRUD Operations with caching

  /**
   * Get or cache a project
   */
  async getProject(id: string, forceRefresh = false): Promise<Project | null> {
    if (!this.db) throw new Error('Cache not initialized');

    const getStmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const cached = getStmt.get(id);

    // Check if we have a valid cached version
    if (cached && !forceRefresh && !this.isExpired((cached as any).ttl_expires_at)) {
      this.cacheHits++;
      return this.deserializeProject(cached);
    }

    this.cacheMisses++;

    // Fetch from Supabase if available
    if (this.supabaseService && this.supabaseService.isServiceOnline()) {
      try {
        const project = await this.supabaseService.getProject(id);
        if (project) {
          await this.cacheProject(project);
          return project;
        }
      } catch (error: any) {
        this.logger.warn('Failed to fetch project from Supabase', error as Error);
        // Fall back to cached version if available
        if (cached) {
          return this.deserializeProject(cached);
        }
      }
    }

    return cached ? this.deserializeProject(cached) : null;
  }

  /**
   * Cache a project
   */
  async cacheProject(project: Project): Promise<void> {
    if (!this.db || !project.id) return;

    const upsert = this.db.prepare(`
      INSERT INTO projects (id, name, path, type, created_at, last_accessed, metadata, cached_at, ttl_expires_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        type = excluded.type,
        last_accessed = excluded.last_accessed,
        metadata = excluded.metadata,
        cached_at = datetime('now'),
        ttl_expires_at = excluded.ttl_expires_at,
        version = version + 1
    `);

    upsert.run(
      project.id,
      project.name,
      project.path,
      project.type,
      project.created_at,
      project.last_accessed,
      JSON.stringify(project.metadata || {}),
      this.getTTLExpiration()
    );

    await this.enforceCacheLimits();
  }

  /**
   * Create a project (cache and sync)
   */
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'last_accessed'>): Promise<Project> {
    if (!this.db) throw new Error('Cache not initialized');

    const id = this.generateId();
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      id,
      created_at: now,
      last_accessed: now
    };

    // Cache locally first
    await this.cacheProject(newProject);

    // Track for sync
    this.trackSync(id, 'projects', 'create', 1);

    // Try to sync immediately if online
    if (this.supabaseService && this.supabaseService.isServiceOnline()) {
      try {
        const remoteProject = await this.supabaseService.createProject(project);
        if (remoteProject.id) {
          // Update local cache with remote ID
          const update = this.db.prepare('UPDATE projects SET id = ? WHERE id = ?');
          update.run(remoteProject.id, id);
          this.updateSyncStatus(remoteProject.id, 'projects', 'synced');
          return remoteProject;
        }
      } catch (error: any) {
        this.logger.warn('Failed to sync project creation', error as Error);
        this.updateSyncStatus(id, 'projects', 'error', (error as Error).message);
      }
    }

    return newProject;
  }

  /**
   * Update a project (cache and sync)
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    if (!this.db) throw new Error('Cache not initialized');

    // Get current version
    const current = await this.getProject(id);
    if (!current) throw new Error('Project not found');

    const updated = { ...current, ...updates };
    await this.cacheProject(updated);

    // Track for sync
    const versionStmt = this.db.prepare('SELECT version FROM projects WHERE id = ?');
    const version = (versionStmt.get(id) as { version?: number })?.version || 1;
    this.trackSync(id, 'projects', 'update', version);

    // Try to sync immediately if online
    if (this.supabaseService && this.supabaseService.isServiceOnline()) {
      try {
        const remoteProject = await this.supabaseService.updateProject(id, updates);
        this.updateSyncStatus(id, 'projects', 'synced');
        return remoteProject;
      } catch (error: any) {
        this.logger.warn('Failed to sync project update', error as Error);
        this.updateSyncStatus(id, 'projects', 'error', (error as Error).message);
      }
    }

    return updated;
  }

  /**
   * Delete a project (cache and sync)
   */
  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('Cache not initialized');

    // Track for sync before deleting
    this.trackSync(id, 'projects', 'delete', 0);

    // Delete from cache
    const deleteStmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    deleteStmt.run(id);

    // Try to sync immediately if online
    if (this.supabaseService && this.supabaseService.isServiceOnline()) {
      try {
        await this.supabaseService.deleteProject(id);
        this.updateSyncStatus(id, 'projects', 'synced');
      } catch (error: any) {
        this.logger.warn('Failed to sync project deletion', error as Error);
        this.updateSyncStatus(id, 'projects', 'error', (error as Error).message);
      }
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    if (!this.db) throw new Error('Cache not initialized');

    // Always try to refresh from Supabase if online
    if (this.supabaseService && this.supabaseService.isServiceOnline()) {
      try {
        const projects = await this.supabaseService.getProjects();
        // Cache all projects
        for (const project of projects) {
          await this.cacheProject(project);
        }
        return projects;
      } catch (error: any) {
        this.logger.warn('Failed to fetch projects from Supabase', error as Error);
      }
    }

    // Fall back to cache
    const getAll = this.db.prepare('SELECT * FROM projects ORDER BY last_accessed DESC');
    const cached = getAll.all();
    return cached.map((row: any) => this.deserializeProject(row));
  }

  // Similar implementations for Sessions, Instructions, ExecutionResults, and Patterns...
  // (The pattern is the same: cache locally, track syncs, sync when online)

  /**
   * Sync with Supabase
   */
  async syncWithSupabase(): Promise<void> {
    if (!this.db || !this.supabaseService || !this.supabaseService.isServiceOnline()) {
      return;
    }

    this.logger.info('Starting sync with Supabase');

    const getPending = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE sync_status IN ('pending', 'error') 
      ORDER BY created_at ASC 
      LIMIT 100
    `);

    const pending = getPending.all() as SyncStatus[];

    for (const sync of pending) {
      try {
        await this.syncRecord(sync);
      } catch (error: any) {
        this.logger.error(`Failed to sync record ${sync.id}`, error as Error);
        this.updateSyncStatus(sync.id, sync.table_name, 'error', (error as Error).message);
      }
    }

    // Update cache metadata
    const updateLastSync = this.db.prepare(`
      INSERT INTO cache_metadata (key, value) VALUES ('last_sync', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);
    updateLastSync.run(new Date().toISOString());

    this.logger.info('Sync completed');
  }

  /**
   * Sync a single record
   */
  private async syncRecord(sync: SyncStatus): Promise<void> {
    if (!this.supabaseService) return;

    this.updateSyncStatus(sync.id, sync.table_name, 'syncing');

    switch (sync.table_name) {
      case 'projects':
        await this.syncProject(sync);
        break;
      case 'sessions':
        await this.syncSession(sync);
        break;
      case 'instructions':
        await this.syncInstruction(sync);
        break;
      case 'execution_results':
        await this.syncExecutionResult(sync);
        break;
      case 'patterns':
        await this.syncPattern(sync);
        break;
    }
  }

  /**
   * Sync a project record
   */
  private async syncProject(sync: SyncStatus): Promise<void> {
    if (!this.db || !this.supabaseService) return;

    switch (sync.operation) {
      case 'create':
      case 'update':
        const getProject = this.db.prepare('SELECT * FROM projects WHERE id = ?');
        const project = getProject.get(sync.id);
        if (project) {
          const projectData = this.deserializeProject(project);
          if (sync.operation === 'create') {
            await this.supabaseService.createProject(projectData);
          } else {
            await this.supabaseService.updateProject(sync.id, projectData);
          }
        }
        break;
      case 'delete':
        await this.supabaseService.deleteProject(sync.id);
        break;
    }

    this.updateSyncStatus(sync.id, sync.table_name, 'synced');
  }

  /**
   * Sync a session record
   */
  private async syncSession(_sync: SyncStatus): Promise<void> {
    // Similar implementation to syncProject
    // ... implementation details ...
  }

  /**
   * Sync an instruction record
   */
  private async syncInstruction(_sync: SyncStatus): Promise<void> {
    // Similar implementation to syncProject
    // ... implementation details ...
  }

  /**
   * Sync an execution result record
   */
  private async syncExecutionResult(_sync: SyncStatus): Promise<void> {
    // Similar implementation to syncProject
    // ... implementation details ...
  }

  /**
   * Sync a pattern record
   */
  private async syncPattern(_sync: SyncStatus): Promise<void> {
    // Similar implementation to syncProject
    // ... implementation details ...
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    if (!this.db) throw new Error('Cache not initialized');

    const stats: CacheStats = {
      totalSize: this.getCacheSize(),
      recordCounts: {},
      pendingSyncs: 0,
      cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
    };

    // Get record counts
    const tables = ['projects', 'sessions', 'instructions', 'execution_results', 'patterns'];
    for (const table of tables) {
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats.recordCounts[table] = (count as any).count;
    }

    // Get pending syncs
    const pendingSyncs = this.db.prepare(
      `SELECT COUNT(*) as count FROM sync_queue WHERE sync_status IN ('pending', 'error')`
    ).get();
    stats.pendingSyncs = (pendingSyncs as any).count;

    // Get last sync time
    const lastSync = this.db.prepare(
      `SELECT value FROM cache_metadata WHERE key = 'last_sync'`
    ).get();
    if (lastSync) {
      stats.lastSync = (lastSync as any).value;
    }

    // Get oldest record
    const oldestRecord = this.db.prepare(`
      SELECT MIN(cached_at) as oldest FROM (
        SELECT MIN(cached_at) as cached_at FROM projects
        UNION SELECT MIN(cached_at) FROM sessions
        UNION SELECT MIN(cached_at) FROM instructions
        UNION SELECT MIN(cached_at) FROM execution_results
        UNION SELECT MIN(cached_at) FROM patterns
      )
    `).get();
    if ((oldestRecord as any)?.oldest) {
      (stats as any).oldestRecord = (oldestRecord as any).oldest;
    }

    return stats;
  }

  /**
   * Clear the entire cache
   */
  async clearCache(): Promise<void> {
    if (!this.db) throw new Error('Cache not initialized');

    const transaction = this.db.transaction(() => {
      const tables = ['execution_results', 'instructions', 'sessions', 'patterns', 'projects', 'sync_queue', 'cache_stats'];
      for (const table of tables) {
        this.db!.prepare(`DELETE FROM ${table}`).run();
      }
    });

    transaction();
    this.logger.info('Cache cleared');
  }

  /**
   * Export cache data
   */
  async exportCache(): Promise<any> {
    if (!this.db) throw new Error('Cache not initialized');

    const data: any = {
      exportedAt: new Date().toISOString(),
      stats: await this.getCacheStats(),
      tables: {}
    };

    const tables = ['projects', 'sessions', 'instructions', 'execution_results', 'patterns'];
    for (const table of tables) {
      const getAll = this.db.prepare(`SELECT * FROM ${table}`);
      data.tables[table] = getAll.all();
    }

    return data;
  }

  /**
   * Import cache data
   */
  async importCache(data: any): Promise<void> {
    if (!this.db) throw new Error('Cache not initialized');

    const transaction = this.db.transaction(() => {
      // Clear existing data
      const tables = ['execution_results', 'instructions', 'sessions', 'patterns', 'projects'];
      for (const table of tables) {
        this.db!.prepare(`DELETE FROM ${table}`).run();
      }

      // Import new data
      for (const table of tables) {
        if (data.tables[table]) {
          const columns = Object.keys(data.tables[table][0] || {}).join(', ');
          const placeholders = Object.keys(data.tables[table][0] || {}).map(() => '?').join(', ');
          const insert = this.db!.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`);
          
          for (const row of data.tables[table]) {
            insert.run(...Object.values(row));
          }
        }
      }
    });

    transaction();
    this.logger.info('Cache imported');
  }

  /**
   * Optimize the database
   */
  async optimize(): Promise<void> {
    if (!this.db) return;

    this.db.pragma('optimize');
    this.db.exec('VACUUM');
    this.logger.info('Cache optimized');
  }

  // Utility methods

  /**
   * Generate a UUID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Deserialize a project from cache
   */
  private deserializeProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      created_at: row.created_at,
      last_accessed: row.last_accessed,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  /**
   * Check if cache is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Get offline queue size
   */
  async getOfflineQueueSize(): Promise<number> {
    if (!this.db) return 0;

    const count = this.db.prepare(
      `SELECT COUNT(*) as count FROM sync_queue WHERE sync_status IN ('pending', 'error')`
    ).get();

    return (count as any)?.count || 0;
  }

  /**
   * Force sync all pending changes
   */
  async forceSyncAll(): Promise<void> {
    await this.syncWithSupabase();
  }

  /**
   * Cleanup and close database
   */
  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.logger.info('Local cache service cleaned up');
  }
}

// Export singleton instance (commented out for test compatibility)
// export const localCacheService = new LocalCacheService(new Logger('LocalCacheService'));