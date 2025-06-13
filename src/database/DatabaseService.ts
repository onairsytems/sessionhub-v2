/**
 * Database Service for SessionHub
 * 
 * Provides a centralized interface for database operations
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface DatabaseConfig {
  path?: string;
  readonly?: boolean;
  memory?: boolean;
  timeout?: number;
  verbose?: boolean;
}

export interface QueryResult {
  rows: any[];
  changes: number;
  lastInsertRowid: number | bigint;
}

interface SessionRepository {
  create(session: any): Promise<void>;
  findById(id: string): Promise<any | null>;
  findAll(): Promise<any[]>;
  update(id: string, updates: any): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DatabaseService extends EventEmitter {
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private isConnected = false;
  public sessions: SessionRepository;

  constructor(config: DatabaseConfig = {}) {
    super();
    this.config = {
      path: config.path || path.join(os.homedir(), '.sessionhub', 'database.db'),
      readonly: config.readonly || false,
      memory: config.memory || false,
      timeout: config.timeout || 5000,
      verbose: config.verbose || false
    };
    
    // Initialize repositories
    this.sessions = {
      create: async (session: any) => {
        const sql = `INSERT INTO sessions (id, name, description, status, userId, projectId, createdAt, updatedAt, metadata)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await this.run(sql, [
          session.id,
          session.name,
          session.description,
          session.status,
          session.userId,
          session.projectId,
          session.createdAt,
          session.updatedAt,
          JSON.stringify(session.metadata || {})
        ]);
      },
      findById: async (id: string) => {
        const result = await this.query('SELECT * FROM sessions WHERE id = ?', [id]);
        return result.rows[0] || null;
      },
      findAll: async () => {
        const result = await this.query('SELECT * FROM sessions', []);
        return result.rows;
      },
      update: async (id: string, updates: any) => {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);
        await this.run(`UPDATE sessions SET ${fields} WHERE id = ?`, values);
      },
      delete: async (id: string) => {
        await this.run('DELETE FROM sessions WHERE id = ?', [id]);
      }
    };
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected && this.db) {
        return;
      }

      // Ensure directory exists
      if (!this.config.memory && this.config.path) {
        const dir = path.dirname(this.config.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Create database connection
      this.db = new Database(this.config.memory ? ':memory:' : this.config.path!, {
        readonly: this.config.readonly,
        timeout: this.config.timeout,
        verbose: this.config.verbose ? ((message?: unknown, ..._additionalArgs: unknown[]) => { 
        this.emit('verbose', String(message)); 
      }) : undefined
      });

      this.isConnected = true;
      this.emit('connected');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isConnected = false;
      this.emit('disconnected');
    }
  }

  /**
   * Execute a query
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const stmt = this.db.prepare(sql);
      
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(...params);
        return {
          rows,
          changes: 0,
          lastInsertRowid: 0
        };
      } else {
        const result = stmt.run(...params);
        return {
          rows: [],
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        };
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Execute a run query (INSERT, UPDATE, DELETE)
   * Alias for query method for compatibility
   */
  async run(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  /**
   * Execute a transaction
   */
  async transaction(callback: (db: Database.Database) => void): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    const transaction = this.db.transaction(callback);
    try {
      transaction(this.db);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get database info
   */
  getInfo(): Record<string, any> {
    if (!this.db || !this.isConnected) {
      return {
        connected: false
      };
    }

    return {
      connected: true,
      readonly: this.db.readonly,
      memory: this.db.memory,
      open: this.db.open,
      inTransaction: this.db.inTransaction
    };
  }

  /**
   * Check if connected
   */
  isConnectedToDatabase(): boolean {
    return this.isConnected && this.db !== null && this.db.open;
  }

  /**
   * Reconnect to database
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  /**
   * Optimize database
   */
  async optimize(): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      this.db.pragma('optimize');
      this.db.pragma('vacuum');
      this.emit('optimized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db || !this.isConnected) {
        return false;
      }
      
      // Try a simple query
      const result = await this.query('SELECT 1 as test');
      return result.rows.length > 0 && result.rows[0].test === 1;
    } catch {
      return false;
    }
  }

  /**
   * Verify database integrity
   */
  async verifyIntegrity(): Promise<boolean> {
    if (!this.db || !this.isConnected) {
      return false;
    }

    try {
      const result = this.db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      return result.length === 1 && result[0]?.integrity_check === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Create database snapshot
   */
  async createSnapshot(snapshotPath: string): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      await this.db.backup(snapshotPath);
      this.emit('snapshotCreated', snapshotPath);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotPath: string): Promise<void> {
    if (!fs.existsSync(snapshotPath)) {
      throw new Error('Snapshot file not found');
    }

    try {
      await this.disconnect();
      
      // Backup current database
      if (this.config.path && fs.existsSync(this.config.path)) {
        const backupPath = `${this.config.path}.backup-${Date.now()}`;
        fs.copyFileSync(this.config.path, backupPath);
      }

      // Copy snapshot to database path
      if (this.config.path) {
        fs.copyFileSync(snapshotPath, this.config.path);
      }

      await this.connect();
      this.emit('restoredFromSnapshot', snapshotPath);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Vacuum the database
   */
  async vacuum(): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      this.db.pragma('vacuum');
      this.emit('vacuumed');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Analyze the database
   */
  async analyze(): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      this.db.pragma('analyze');
      this.emit('analyzed');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Reindex the database
   */
  async reindex(): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      this.db.exec('REINDEX');
      this.emit('reindexed');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Store metrics
   */
  async storeMetrics(metrics: any): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      await this.query(`
        INSERT INTO metrics (timestamp, data) 
        VALUES (datetime('now'), ?)
      `, [JSON.stringify(metrics)]);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(sessionId: string): Promise<any[]> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.query(`
        SELECT * FROM session_metrics 
        WHERE session_id = ? 
        ORDER BY timestamp DESC
      `, [sessionId]);
      
      return result.rows.map(row => ({
        ...row,
        data: JSON.parse(row.data || '{}')
      }));
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<any[]> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.query(`
        SELECT * FROM sessions 
        ORDER BY created_at DESC
      `);
      
      return result.rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Backup the database
   */
  async backup(backupPath: string): Promise<void> {
    if (!this.db || !this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      await this.db.backup(backupPath);
      this.emit('backed-up', { path: backupPath });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Restore the database from backup
   */
  async restore(backupPath: string): Promise<void> {
    try {
      // Close current connection if open
      if (this.isConnected) {
        await this.disconnect();
      }

      // Copy backup file to current database path
      const fs = require('fs').promises;
      await fs.copyFile(backupPath, this.config.path!);

      // Reconnect to the restored database
      await this.connect();
      this.emit('restored', { path: backupPath });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}