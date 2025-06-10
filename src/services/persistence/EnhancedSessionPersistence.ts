/**
 * @actor system
 * @responsibility Enhanced session persistence with app restart survival
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session } from '@/src/models/Session';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface PersistedSessionData {
  id: string;
  session: Session;
  checkpoints: SessionCheckpoint[];
  workspaceData: WorkspaceMetadata;
  searchIndices: SearchIndex[];
  templates: SessionTemplate[];
  timestamp: string;
  version: string;
}

export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  phase: string;
  state: any;
  timestamp: string;
  canRestore: boolean;
  description: string;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  description: string;
  projectPath: string;
  tags: string[];
  categories: string[];
  customFields: Record<string, any>;
  sessions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchIndex {
  id: string;
  type: 'session' | 'project' | 'integration' | 'template';
  entityId: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  pattern: any;
  metadata: Record<string, any>;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UndoRedoState {
  sessionId: string;
  states: any[];
  currentIndex: number;
  maxStates: number;
}

export class EnhancedSessionPersistence extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly dataDir: string;
  private readonly sessionsDir: string;
  private readonly workspacesDir: string;
  private readonly searchIndicesDir: string;
  private readonly templatesDir: string;
  private readonly undoRedoDir: string;
  private readonly backupsDir: string;
  
  private readonly version = '2.5.0';
  private readonly maxUndoStates = 50;
  private readonly autoSaveInterval = 30000; // 30 seconds
  private readonly searchUpdateBatch: SearchIndex[] = [];
  
  private autoSaveTimer?: NodeJS.Timeout;
  private activeSessions = new Map<string, PersistedSessionData>();
  private workspaces = new Map<string, WorkspaceMetadata>();
  private searchIndices = new Map<string, SearchIndex>();
  private templates = new Map<string, SessionTemplate>();
  private undoRedoStates = new Map<string, UndoRedoState>();

  constructor(logger: Logger, auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger;
    
    // Use auditLogger for persistence operations
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'enhanced-session-persistence' },
      operation: { type: 'initialization', description: 'EnhancedSessionPersistence initialized' },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: this.generateId('init') }
    });
    
    this.dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.workspacesDir = path.join(this.dataDir, 'workspaces');
    this.searchIndicesDir = path.join(this.dataDir, 'search');
    this.templatesDir = path.join(this.dataDir, 'templates');
    this.undoRedoDir = path.join(this.dataDir, 'undo-redo');
    this.backupsDir = path.join(this.dataDir, 'backups');
    
    this.initializeDirectories();
    this.startAutoSave();
    this.setupProcessHandlers();
  }

  /**
   * Initialize all persistence directories
   */
  private async initializeDirectories(): Promise<void> {
    const directories = [
      this.dataDir,
      this.sessionsDir,
      this.workspacesDir,
      this.searchIndicesDir,
      this.templatesDir,
      this.undoRedoDir,
      this.backupsDir
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    this.logger.info('Enhanced persistence directories initialized', {
      dataDir: this.dataDir,
      version: this.version
    });

    // Load existing data
    await this.loadAllData();
  }

  /**
   * Start automatic session saving
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      await this.saveAllActiveSessions();
      await this.flushSearchIndices();
    }, this.autoSaveInterval);
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    const handleShutdown = async () => {
      this.logger.info('Shutting down enhanced persistence service');
      await this.saveAllActiveSessions();
      await this.flushSearchIndices();
      await this.createBackup();
      
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
      }
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
    process.on('beforeExit', handleShutdown);
  }

  /**
   * Persist session with enhanced metadata
   */
  async persistSession(session: Session, workspaceId?: string): Promise<void> {
    const sessionData: PersistedSessionData = {
      id: session.id,
      session,
      checkpoints: [],
      workspaceData: workspaceId ? this.workspaces.get(workspaceId)! : this.createDefaultWorkspace(session),
      searchIndices: await this.generateSearchIndices(session),
      templates: [],
      timestamp: new Date().toISOString(),
      version: this.version
    };

    this.activeSessions.set(session.id, sessionData);

    // Save to disk
    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeFile(
      sessionPath,
      JSON.stringify(sessionData, null, 2),
      'utf-8'
    );

    // Update search indices
    await this.updateSearchIndices(session);

    // Create undo state
    await this.createUndoState(session.id, session);

    this.emit('sessionPersisted', session.id);
    
    this.logger.info('Session persisted with enhanced data', {
      sessionId: session.id,
      workspaceId: workspaceId,
      searchIndicesCount: sessionData.searchIndices.length
    });
  }

  /**
   * Restore session with full context
   */
  async restoreSession(sessionId: string): Promise<PersistedSessionData | null> {
    // Check memory first
    let sessionData = this.activeSessions.get(sessionId);
    
    if (!sessionData) {
      // Load from disk
      const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);
      
      try {
        await fs.access(sessionPath);
        const content = await fs.readFile(sessionPath, 'utf-8');
        sessionData = JSON.parse(content) as PersistedSessionData;
        
        if (sessionData) {
          this.activeSessions.set(sessionId, sessionData);
        }
      } catch {
        return null;
      }
    }

    if (sessionData) {
      this.emit('sessionRestored', sessionId);
      
      this.logger.info('Session restored with full context', {
        sessionId,
        checkpointsCount: sessionData.checkpoints.length,
        version: sessionData.version
      });
    }

    return sessionData || null;
  }

  /**
   * Create session checkpoint
   */
  async createCheckpoint(
    sessionId: string,
    phase: string,
    state: any,
    description: string
  ): Promise<SessionCheckpoint> {
    const checkpoint: SessionCheckpoint = {
      id: this.generateId('ckpt'),
      sessionId,
      phase,
      state,
      timestamp: new Date().toISOString(),
      canRestore: true,
      description
    };

    const sessionData = this.activeSessions.get(sessionId);
    if (sessionData) {
      sessionData.checkpoints.push(checkpoint);
      
      // Keep only recent checkpoints
      if (sessionData.checkpoints.length > 20) {
        sessionData.checkpoints = sessionData.checkpoints.slice(-20);
      }
      
      await this.persistSession(sessionData.session);
    }

    this.logger.info('Checkpoint created', {
      sessionId,
      checkpointId: checkpoint.id,
      phase,
      description
    });

    return checkpoint;
  }

  /**
   * Create or update workspace
   */
  async createWorkspace(
    name: string,
    description: string,
    projectPath: string,
    metadata: Partial<WorkspaceMetadata> = {}
  ): Promise<WorkspaceMetadata> {
    const workspace: WorkspaceMetadata = {
      id: this.generateId('ws'),
      name,
      description,
      projectPath,
      tags: metadata.tags || [],
      categories: metadata.categories || [],
      customFields: metadata.customFields || {},
      sessions: metadata.sessions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspace.id, workspace);

    // Save to disk
    const workspacePath = path.join(this.workspacesDir, `${workspace.id}.json`);
    await fs.writeFile(
      workspacePath,
      JSON.stringify(workspace, null, 2),
      'utf-8'
    );

    this.logger.info('Workspace created', {
      workspaceId: workspace.id,
      name,
      projectPath
    });

    return workspace;
  }

  /**
   * Universal search across all data
   */
  async search(
    query: string,
    filters: {
      types?: ('session' | 'project' | 'integration' | 'template')[];
      tags?: string[];
      dateRange?: { start: string; end: string };
      limit?: number;
    } = {}
  ): Promise<SearchIndex[]> {
    const results: SearchIndex[] = [];
    const queryLower = query.toLowerCase();
    const limit = filters.limit || 100;

    for (const [, index] of this.searchIndices) {
      // Type filter
      if (filters.types && !filters.types.includes(index.type)) {
        continue;
      }

      // Content match
      if (!index.content.toLowerCase().includes(queryLower)) {
        continue;
      }

      // Tag filter
      if (filters.tags && filters.tags.length > 0) {
        const indexTags = index.metadata['tags'] || [];
        if (!filters.tags.some(tag => indexTags.includes(tag))) {
          continue;
        }
      }

      // Date range filter
      if (filters.dateRange) {
        const indexDate = new Date(index.timestamp);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        
        if (indexDate < startDate || indexDate > endDate) {
          continue;
        }
      }

      results.push(index);

      if (results.length >= limit) {
        break;
      }
    }

    // Sort by relevance (basic scoring)
    results.sort((a, b) => {
      const aScore = this.calculateRelevanceScore(a, queryLower);
      const bScore = this.calculateRelevanceScore(b, queryLower);
      return bScore - aScore;
    });

    this.logger.info('Search completed', {
      query,
      resultsCount: results.length,
      filters
    });

    return results;
  }

  /**
   * Create session template
   */
  async createTemplate(
    name: string,
    description: string,
    category: string,
    pattern: any,
    metadata: Record<string, any> = {}
  ): Promise<SessionTemplate> {
    const template: SessionTemplate = {
      id: this.generateId('tpl'),
      name,
      description,
      category,
      pattern,
      metadata,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(template.id, template);

    // Save to disk
    const templatePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(
      templatePath,
      JSON.stringify(template, null, 2),
      'utf-8'
    );

    this.logger.info('Template created', {
      templateId: template.id,
      name,
      category
    });

    return template;
  }

  /**
   * Apply template to create new session
   */
  async applyTemplate(templateId: string, customizations: any = {}): Promise<Session> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Merge template pattern with customizations
    const sessionData = {
      ...template.pattern,
      ...customizations,
      id: this.generateId('sess'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Increment usage count
    template.usageCount++;
    template.updatedAt = new Date().toISOString();
    await this.persistTemplate(template);

    this.logger.info('Template applied', {
      templateId,
      newSessionId: sessionData.id,
      usageCount: template.usageCount
    });

    return sessionData as Session;
  }

  /**
   * Create undo state
   */
  async createUndoState(sessionId: string, state: any): Promise<void> {
    let undoRedoState = this.undoRedoStates.get(sessionId);
    
    if (!undoRedoState) {
      undoRedoState = {
        sessionId,
        states: [],
        currentIndex: -1,
        maxStates: this.maxUndoStates
      };
    }

    // Add new state
    undoRedoState.states.push({
      state: JSON.parse(JSON.stringify(state)),
      timestamp: new Date().toISOString()
    });

    // Update current index
    undoRedoState.currentIndex = undoRedoState.states.length - 1;

    // Trim old states
    if (undoRedoState.states.length > undoRedoState.maxStates) {
      undoRedoState.states.shift();
      undoRedoState.currentIndex--;
    }

    this.undoRedoStates.set(sessionId, undoRedoState);

    // Save to disk
    const undoPath = path.join(this.undoRedoDir, `${sessionId}.json`);
    await fs.writeFile(
      undoPath,
      JSON.stringify(undoRedoState, null, 2),
      'utf-8'
    );
  }

  /**
   * Undo last action
   */
  async undo(sessionId: string): Promise<any | null> {
    const undoRedoState = this.undoRedoStates.get(sessionId);
    if (!undoRedoState || undoRedoState.currentIndex <= 0) {
      return null;
    }

    undoRedoState.currentIndex--;
    const previousState = undoRedoState.states[undoRedoState.currentIndex];

    this.logger.info('Undo performed', {
      sessionId,
      newIndex: undoRedoState.currentIndex
    });

    return previousState ? previousState.state : null;
  }

  /**
   * Redo last undone action
   */
  async redo(sessionId: string): Promise<any | null> {
    const undoRedoState = this.undoRedoStates.get(sessionId);
    if (!undoRedoState || undoRedoState.currentIndex >= undoRedoState.states.length - 1) {
      return null;
    }

    undoRedoState.currentIndex++;
    const nextState = undoRedoState.states[undoRedoState.currentIndex];

    this.logger.info('Redo performed', {
      sessionId,
      newIndex: undoRedoState.currentIndex
    });

    return nextState ? nextState.state : null;
  }

  /**
   * Export session data for backup/sharing
   */
  async exportSession(sessionId: string): Promise<string> {
    const sessionData = await this.restoreSession(sessionId);
    if (!sessionData) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const exportData = {
      ...sessionData,
      exportedAt: new Date().toISOString(),
      exportVersion: this.version
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import session data
   */
  async importSession(importData: string): Promise<PersistedSessionData> {
    const data = JSON.parse(importData) as PersistedSessionData;
    
    // Generate new ID to avoid conflicts
    const newSessionId = this.generateId('sess');
    data.session.id = newSessionId;
    data.id = newSessionId;

    await this.persistSession(data.session);
    
    this.logger.info('Session imported', {
      originalId: data.id,
      newId: newSessionId
    });

    return data;
  }

  /**
   * Create backup of all data
   */
  async createBackup(): Promise<string> {
    const backupId = this.generateId('backup');
    const backupPath = path.join(this.backupsDir, `${backupId}.json`);
    
    const backupData = {
      id: backupId,
      timestamp: new Date().toISOString(),
      version: this.version,
      sessions: Array.from(this.activeSessions.values()),
      workspaces: Array.from(this.workspaces.values()),
      templates: Array.from(this.templates.values()),
      searchIndices: Array.from(this.searchIndices.values())
    };

    await fs.writeFile(
      backupPath,
      JSON.stringify(backupData, null, 2),
      'utf-8'
    );

    this.logger.info('Backup created', {
      backupId,
      sessionsCount: backupData.sessions.length,
      workspacesCount: backupData.workspaces.length
    });

    return backupId;
  }

  /**
   * Get performance statistics
   */
  async getStatistics(): Promise<any> {
    const stats = {
      sessions: {
        total: this.activeSessions.size,
        active: Array.from(this.activeSessions.values()).filter(s => 
          s.session.status === 'executing' || s.session.status === 'planning'
        ).length
      },
      workspaces: {
        total: this.workspaces.size
      },
      templates: {
        total: this.templates.size,
        totalUsage: Array.from(this.templates.values()).reduce((sum, t) => sum + t.usageCount, 0)
      },
      searchIndices: {
        total: this.searchIndices.size
      },
      storage: await this.calculateStorageSize()
    };

    return stats;
  }

  // Private helper methods

  private async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadSessions(),
      this.loadWorkspaces(),
      this.loadTemplates(),
      this.loadSearchIndices()
    ]);
  }

  private async loadSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.sessionsDir, file), 'utf-8');
          const sessionData = JSON.parse(content) as PersistedSessionData;
          this.activeSessions.set(sessionData.id, sessionData);
        }
      }
      
      this.logger.info('Sessions loaded', { count: this.activeSessions.size });
    } catch (error) {
      this.logger.error('Failed to load sessions', error as Error);
    }
  }

  private async loadWorkspaces(): Promise<void> {
    try {
      const files = await fs.readdir(this.workspacesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.workspacesDir, file), 'utf-8');
          const workspace = JSON.parse(content) as WorkspaceMetadata;
          this.workspaces.set(workspace.id, workspace);
        }
      }
      
      this.logger.info('Workspaces loaded', { count: this.workspaces.size });
    } catch (error) {
      this.logger.error('Failed to load workspaces', error as Error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const files = await fs.readdir(this.templatesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
          const template = JSON.parse(content) as SessionTemplate;
          this.templates.set(template.id, template);
        }
      }
      
      this.logger.info('Templates loaded', { count: this.templates.size });
    } catch (error) {
      this.logger.error('Failed to load templates', error as Error);
    }
  }

  private async loadSearchIndices(): Promise<void> {
    try {
      const files = await fs.readdir(this.searchIndicesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.searchIndicesDir, file), 'utf-8');
          const indices = JSON.parse(content) as SearchIndex[];
          indices.forEach(index => this.searchIndices.set(index.id, index));
        }
      }
      
      this.logger.info('Search indices loaded', { count: this.searchIndices.size });
    } catch (error) {
      this.logger.error('Failed to load search indices', error as Error);
    }
  }

  private async saveAllActiveSessions(): Promise<void> {
    for (const [sessionId, sessionData] of this.activeSessions) {
      try {
        await this.persistSession(sessionData.session);
      } catch (error) {
        this.logger.error('Failed to auto-save session', error as Error, { sessionId });
      }
    }
  }

  private async flushSearchIndices(): Promise<void> {
    if (this.searchUpdateBatch.length === 0) return;

    const batchPath = path.join(this.searchIndicesDir, `batch-${Date.now()}.json`);
    await fs.writeFile(
      batchPath,
      JSON.stringify(this.searchUpdateBatch, null, 2),
      'utf-8'
    );

    this.searchUpdateBatch.length = 0;
  }

  private createDefaultWorkspace(session: Session): WorkspaceMetadata {
    return {
      id: this.generateId('ws'),
      name: `Workspace for ${session.name}`,
      description: 'Auto-generated workspace',
      projectPath: session.metadata.projectPath || '',
      tags: session.metadata.tags || [],
      categories: [],
      customFields: {},
      sessions: [session.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private async generateSearchIndices(session: Session): Promise<SearchIndex[]> {
    const indices: SearchIndex[] = [];

    // Session content index
    indices.push({
      id: this.generateId('idx'),
      type: 'session',
      entityId: session.id,
      content: `${session.name} ${session.description} ${session.request.content}`,
      metadata: {
        tags: session.metadata.tags,
        status: session.status,
        projectId: session.projectId
      },
      timestamp: new Date().toISOString()
    });

    return indices;
  }

  private async updateSearchIndices(session: Session): Promise<void> {
    const newIndices = await this.generateSearchIndices(session);
    
    // Remove old indices for this session
    for (const [id, index] of this.searchIndices) {
      if (index.type === 'session' && index.entityId === session.id) {
        this.searchIndices.delete(id);
      }
    }

    // Add new indices
    newIndices.forEach(index => {
      this.searchIndices.set(index.id, index);
      this.searchUpdateBatch.push(index);
    });
  }

  private calculateRelevanceScore(index: SearchIndex, query: string): number {
    let score = 0;
    const content = index.content.toLowerCase();

    // Exact match bonus
    if (content.includes(query)) {
      score += 10;
    }

    // Word match bonus
    const queryWords = query.split(' ');
    for (const word of queryWords) {
      if (content.includes(word)) {
        score += 5;
      }
    }

    // Recency bonus
    const ageInDays = (Date.now() - new Date(index.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - ageInDays);

    return score;
  }

  private async persistTemplate(template: SessionTemplate): Promise<void> {
    const templatePath = path.join(this.templatesDir, `${template.id}.json`);
    await fs.writeFile(
      templatePath,
      JSON.stringify(template, null, 2),
      'utf-8'
    );
  }

  private async calculateStorageSize(): Promise<any> {
    let totalSize = 0;
    const directories = [
      this.sessionsDir,
      this.workspacesDir,
      this.templatesDir,
      this.searchIndicesDir,
      this.undoRedoDir,
      this.backupsDir
    ];

    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const stats = await fs.stat(path.join(dir, file));
          totalSize += stats.size;
        }
      } catch {
        // Directory might not exist
      }
    }

    return {
      totalBytes: totalSize,
      totalMB: (totalSize / (1024 * 1024)).toFixed(2),
      totalGB: (totalSize / (1024 * 1024 * 1024)).toFixed(3)
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}