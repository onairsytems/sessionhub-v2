import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface OptimizationConfig {
  pageSize: number;
  cacheSize: number; // Pages
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  synchronous: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
  tempStore: 'DEFAULT' | 'FILE' | 'MEMORY';
  mmapSize: number; // Bytes
  busyTimeout: number; // Milliseconds
  walAutocheckpoint: number; // Pages
}

// Unused interface - commented out
// interface IndexInfo {
//   name: string;
//   table: string;
//   columns: string[];
//   unique: boolean;
//   partial: string | null;
// }

interface QueryStats {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: Date;
}

interface DatabaseHealth {
  fileSize: number;
  pageCount: number;
  freePages: number;
  fragmentationRatio: number;
  lastVacuum: Date | null;
  lastAnalyze: Date | null;
  indexCount: number;
  tableCount: number;
}

export class SQLiteOptimizationService extends EventEmitter {
  private static instance: SQLiteOptimizationService;
  private db!: Database.Database;
  private queryStats: QueryStats[] = [];
  // private isOptimized: boolean = false; // Unused variable
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private readonly defaultConfig: OptimizationConfig = {
    pageSize: 4096, // 4KB pages
    cacheSize: 10000, // ~40MB cache
    journalMode: 'WAL', // Write-Ahead Logging
    synchronous: 'NORMAL', // Balance between safety and speed
    tempStore: 'MEMORY', // Use memory for temp tables
    mmapSize: 268435456, // 256MB memory-mapped I/O
    busyTimeout: 5000, // 5 second timeout
    walAutocheckpoint: 1000, // Checkpoint every 1000 pages
  };

  private readonly performanceConfig: OptimizationConfig = {
    pageSize: 8192, // 8KB pages for better performance
    cacheSize: 50000, // ~400MB cache
    journalMode: 'WAL',
    synchronous: 'OFF', // Maximum speed, less safe
    tempStore: 'MEMORY',
    mmapSize: 1073741824, // 1GB memory-mapped I/O
    busyTimeout: 10000,
    walAutocheckpoint: 5000,
  };

  private constructor() {
    super();
    this.initializeDatabase();
  }

  static getInstance(): SQLiteOptimizationService {
    if (!SQLiteOptimizationService.instance) {
      SQLiteOptimizationService.instance = new SQLiteOptimizationService();
    }
    return SQLiteOptimizationService.instance;
  }

  private initializeDatabase(): void {
    const dbPath = path.join(os.homedir(), '.sessionhub', 'sessions.db');
    const dbDir = path.dirname(dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.createOptimizedSchema();
    this.applyOptimizations(this.defaultConfig);
    this.prepareCoreStatements();
  }

  private createOptimizedSchema(): void {
    this.db.exec(`
      -- Main sessions table with optimized structure
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'failed')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        started_at INTEGER,
        completed_at INTEGER,
        execution_time INTEGER GENERATED ALWAYS AS (
          CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL 
            THEN completed_at - started_at 
            ELSE NULL 
          END
        ) STORED,
        metadata TEXT, -- JSON data
        error TEXT
      ) WITHOUT ROWID;

      -- Optimized indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_project_status ON sessions(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_sessions_execution_time ON sessions(execution_time) WHERE execution_time IS NOT NULL;

      -- Session history table (partitioned by month)
      CREATE TABLE IF NOT EXISTS session_history (
        id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
        event_type TEXT NOT NULL,
        details TEXT, -- JSON data
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_history_session_id ON session_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON session_history(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_history_session_timestamp ON session_history(session_id, timestamp DESC);

      -- Metrics table for performance data
      CREATE TABLE IF NOT EXISTS session_metrics (
        session_id TEXT PRIMARY KEY,
        cpu_usage REAL,
        memory_usage INTEGER,
        disk_io INTEGER,
        network_io INTEGER,
        duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      ) WITHOUT ROWID;

      -- Full-text search for session content
      CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
        session_id,
        name,
        content,
        tokenize='porter ascii'
      );

      -- Triggers for automatic timestamp updates
      CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
      AFTER UPDATE ON sessions
      BEGIN
        UPDATE sessions SET updated_at = unixepoch() WHERE id = NEW.id;
      END;

      -- Trigger for session search sync
      CREATE TRIGGER IF NOT EXISTS sync_session_search_insert
      AFTER INSERT ON sessions
      BEGIN
        INSERT INTO session_search(session_id, name, content) 
        VALUES (NEW.id, NEW.name, json_extract(NEW.metadata, '$.description'));
      END;

      CREATE TRIGGER IF NOT EXISTS sync_session_search_update
      AFTER UPDATE ON sessions
      BEGIN
        UPDATE session_search 
        SET name = NEW.name, 
            content = json_extract(NEW.metadata, '$.description')
        WHERE session_id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS sync_session_search_delete
      AFTER DELETE ON sessions
      BEGIN
        DELETE FROM session_search WHERE session_id = OLD.id;
      END;
    `);
  }

  applyOptimizations(config: OptimizationConfig): void {
    try {
      // Set page size (must be done before any tables are created)
      this.db.pragma(`page_size = ${config.pageSize}`);
      
      // Set cache size
      this.db.pragma(`cache_size = ${config.cacheSize}`);
      
      // Set journal mode
      this.db.pragma(`journal_mode = ${config.journalMode}`);
      
      // Set synchronous mode
      this.db.pragma(`synchronous = ${config.synchronous}`);
      
      // Set temp store
      this.db.pragma(`temp_store = ${config.tempStore}`);
      
      // Set memory-mapped I/O size
      this.db.pragma(`mmap_size = ${config.mmapSize}`);
      
      // Set busy timeout
      this.db.pragma(`busy_timeout = ${config.busyTimeout}`);
      
      // WAL-specific optimizations
      if (config.journalMode === 'WAL') {
        this.db.pragma(`wal_autocheckpoint = ${config.walAutocheckpoint}`);
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }
      
      // Additional optimizations
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('recursive_triggers = ON');
      this.db.pragma('optimize');
      
      // Mark as optimized
      (this as any).isOptimized = true;
      this.emit('optimizations-applied', config);
    } catch (error) {
      this.emit('optimization-error', error);
      throw error;
    }
  }

  // Performance monitoring
  wrapQuery<T>(query: () => T, sql: string): T {
    const start = performance.now();
    let rowsAffected = 0;

    try {
      const result = query();
      
      // Extract rows affected if available
      if (result && typeof result === 'object' && 'changes' in result) {
        rowsAffected = (result as any).changes;
      }

      const executionTime = performance.now() - start;
      
      this.queryStats.push({
        query: sql,
        executionTime,
        rowsAffected,
        timestamp: new Date(),
      });

      // Keep only recent stats
      if (this.queryStats.length > 1000) {
        this.queryStats = this.queryStats.slice(-1000);
      }

      // Emit slow query warning
      if (executionTime > 100) { // 100ms threshold
        this.emit('slow-query', {
          query: sql,
          executionTime,
          rowsAffected,
        });
      }

      return result;
    } catch (error) {
      this.emit('query-error', { query: sql, error });
      throw error;
    }
  }

  // Prepared statements for common operations
  private preparedStatements = {
    insertSession: null as Database.Statement | null,
    updateSessionStatus: null as Database.Statement | null,
    getRecentSessions: null as Database.Statement | null,
    searchSessions: null as Database.Statement | null,
  };

  private prepareCoreStatements(): void {
    this.preparedStatements.insertSession = this.db.prepare(`
      INSERT INTO sessions (id, project_id, name, type, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.preparedStatements.updateSessionStatus = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, 
          started_at = CASE WHEN ? = 'active' THEN unixepoch() ELSE started_at END,
          completed_at = CASE WHEN ? IN ('completed', 'failed') THEN unixepoch() ELSE completed_at END
      WHERE id = ?
    `);

    this.preparedStatements.getRecentSessions = this.db.prepare(`
      SELECT s.*, m.cpu_usage, m.memory_usage, m.duration
      FROM sessions s
      LEFT JOIN session_metrics m ON s.id = m.session_id
      WHERE s.project_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?
    `);

    this.preparedStatements.searchSessions = this.db.prepare(`
      SELECT s.*
      FROM sessions s
      INNER JOIN session_search ss ON s.id = ss.session_id
      WHERE session_search MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
  }

  // Optimized bulk operations
  async bulkInsertSessions(sessions: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const insert = this.db.prepare(`
        INSERT INTO sessions (id, project_id, name, type, status, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((sessions) => {
        for (const session of sessions) {
          insert.run(
            session.id,
            session.projectId,
            session.name,
            session.type,
            session.status,
            JSON.stringify(session.metadata || {})
          );
        }
      });

      try {
        insertMany(sessions);
        this.emit('bulk-insert-complete', { count: sessions.length });
        resolve();
      } catch (error) {
        this.emit('bulk-insert-error', error);
        reject(error);
      }
    });
  }

  // Database maintenance
  async performMaintenance(): Promise<void> {
    const maintenanceStart = performance.now();

    try {
      // Analyze tables for query optimization
      this.db.exec('ANALYZE');
      
      // Check database integrity
      const integrityCheck = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      if (!integrityCheck[0] || integrityCheck[0].integrity_check !== 'ok') {
        throw new Error('Database integrity check failed');
      }

      // Vacuum if needed
      const health = await this.getDatabaseHealth();
      if (health.fragmentationRatio > 0.2) { // 20% fragmentation
        this.db.exec('VACUUM');
        this.emit('vacuum-complete');
      }

      // Optimize FTS index
      this.db.exec('INSERT INTO session_search(session_search) VALUES("optimize")');

      // WAL checkpoint
      const journalMode = this.db.pragma('journal_mode') as Array<{ journal_mode: string }>;
      if (journalMode[0]?.journal_mode === 'wal') {
        this.db.pragma('wal_checkpoint(TRUNCATE)');
      }

      const duration = performance.now() - maintenanceStart;
      this.emit('maintenance-complete', { duration });
    } catch (error) {
      this.emit('maintenance-error', error);
      throw error;
    }
  }

  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const pageCountResult = this.db.pragma('page_count') as Array<{ page_count: number }>;
    const pageSizeResult = this.db.pragma('page_size') as Array<{ page_size: number }>;
    const freePageCountResult = this.db.pragma('freelist_count') as Array<{ freelist_count: number }>;
    
    const pageCount = pageCountResult[0]?.page_count ?? 0;
    const pageSize = pageSizeResult[0]?.page_size ?? 0;
    const freePageCount = freePageCountResult[0]?.freelist_count ?? 0;
    
    const fileSize = pageCount * pageSize;
    const fragmentationRatio = freePageCount / pageCount;

    // Get last maintenance timestamps
    const lastVacuum = this.db.prepare(`
      SELECT datetime(timestamp, 'unixepoch') as last_vacuum 
      FROM sqlite_stat1 
      WHERE tbl = 'sessions' 
      LIMIT 1
    `).get() as any;

    // Count indexes and tables
    const indexCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index'
    `).get() as any;

    const tableCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'
    `).get() as any;

    return {
      fileSize,
      pageCount,
      freePages: freePageCount,
      fragmentationRatio,
      lastVacuum: lastVacuum ? new Date(lastVacuum.last_vacuum) : null,
      lastAnalyze: null, // Would need to track this separately
      indexCount: indexCount.count,
      tableCount: tableCount.count,
    };
  }

  // Query optimization helpers
  explainQueryPlan(query: string): any[] {
    return this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
  }

  analyzeSlowQueries(): any[] {
    const slowQueries = this.queryStats
      .filter(stat => stat.executionTime > 50) // 50ms threshold
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return slowQueries.map(stat => ({
      ...stat,
      optimization: this.suggestOptimization(stat.query),
    }));
  }

  private suggestOptimization(query: string): string[] {
    const suggestions: string[] = [];
    const upperQuery = query.toUpperCase();

    if (upperQuery.includes('WHERE') && !upperQuery.includes('INDEX')) {
      suggestions.push('Consider adding an index on the WHERE clause columns');
    }

    if (upperQuery.includes('ORDER BY') && !upperQuery.includes('INDEX')) {
      suggestions.push('Consider adding an index on the ORDER BY columns');
    }

    if (upperQuery.includes('LIKE') && query.includes('%')) {
      if (query.match(/LIKE\s+'%[^%]/)) {
        suggestions.push('Leading wildcard in LIKE prevents index usage');
      }
    }

    if (upperQuery.includes('SELECT *')) {
      suggestions.push('Avoid SELECT *, specify only needed columns');
    }

    if (!upperQuery.includes('LIMIT') && upperQuery.includes('SELECT')) {
      suggestions.push('Consider adding LIMIT to prevent large result sets');
    }

    return suggestions;
  }

  // Start health monitoring
  startHealthMonitoring(interval: number = 300000): void { // 5 minutes
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getDatabaseHealth();
        this.emit('health-check', health);

        // Auto-maintenance if needed
        if (health.fragmentationRatio > 0.3) {
          await this.performMaintenance();
        }
      } catch (error) {
        this.emit('health-check-error', error);
      }
    }, interval);
  }

  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Performance testing
  async runPerformanceTest(): Promise<any> {
    const results: any = {
      insertPerformance: 0,
      selectPerformance: 0,
      updatePerformance: 0,
      searchPerformance: 0,
      transactionPerformance: 0,
    };

    // Test insert performance
    const insertStart = performance.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO sessions (id, project_id, name, type, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (let i = 0; i < 1000; i++) {
      insertStmt.run(
        `test-${Date.now()}-${i}`,
        'test-project',
        `Test Session ${i}`,
        'test',
        'completed',
        JSON.stringify({ index: i })
      );
    }
    results.insertPerformance = 1000 / ((performance.now() - insertStart) / 1000); // ops/sec

    // Test select performance
    const selectStart = performance.now();
    for (let i = 0; i < 100; i++) {
      this.db.prepare('SELECT * FROM sessions WHERE project_id = ? LIMIT 100')
        .all('test-project');
    }
    results.selectPerformance = 100 / ((performance.now() - selectStart) / 1000); // ops/sec

    // Test update performance
    const updateStart = performance.now();
    const updateStmt = this.db.prepare('UPDATE sessions SET status = ? WHERE project_id = ?');
    for (let i = 0; i < 100; i++) {
      updateStmt.run('active', 'test-project');
    }
    results.updatePerformance = 100 / ((performance.now() - updateStart) / 1000); // ops/sec

    // Test search performance
    const searchStart = performance.now();
    for (let i = 0; i < 50; i++) {
      this.db.prepare('SELECT * FROM session_search WHERE session_search MATCH ?')
        .all('test');
    }
    results.searchPerformance = 50 / ((performance.now() - searchStart) / 1000); // ops/sec

    // Test transaction performance
    const transactionStart = performance.now();
    const transaction = this.db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        insertStmt.run(
          `trans-${Date.now()}-${i}`,
          'test-project',
          `Transaction Test ${i}`,
          'test',
          'completed',
          '{}'
        );
      }
    });
    transaction();
    results.transactionPerformance = 100 / ((performance.now() - transactionStart) / 1000); // ops/sec

    // Cleanup test data
    this.db.prepare('DELETE FROM sessions WHERE project_id = ?').run('test-project');

    return results;
  }

  // Export for production builds
  exportOptimizations(): OptimizationConfig {
    return this.performanceConfig;
  }

  // Cleanup
  close(): void {
    this.stopHealthMonitoring();
    
    // Close prepared statements - better-sqlite3 doesn't require manual finalization
    // Statements are automatically finalized when the database closes

    // Final optimization before closing
    this.db.pragma('optimize');
    
    this.db.close();
    this.removeAllListeners();
  }
}