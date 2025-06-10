/**
 * @actor system
 * @responsibility Comprehensive project workspace organization with metadata and hierarchical structure
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
// import { Session } from '@/src/models/Session';
import { WorkspaceMetadata } from '../persistence/EnhancedSessionPersistence';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface ProjectStructure {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  relativePath: string;
  size?: number;
  modifiedAt: string;
  children?: ProjectStructure[];
  metadata?: Record<string, any>;
}

export interface WorkspaceHierarchy {
  id: string;
  parentId?: string;
  children: string[];
  level: number;
  path: string[];
}

export interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  autoSave: boolean;
  syncEnabled: boolean;
  backupFrequency: 'none' | 'daily' | 'weekly' | 'monthly';
  retentionPolicy: {
    sessions: number; // days
    logs: number; // days
    backups: number; // count
  };
  indexingEnabled: boolean;
  searchableFileTypes: string[];
  excludePatterns: string[];
}

export interface WorkspaceAnalytics {
  workspaceId: string;
  sessionCount: number;
  averageSessionDuration: number;
  mostUsedTemplates: string[];
  errorRate: number;
  successRate: number;
  topCategories: string[];
  timeMetrics: {
    totalTime: number;
    activeTime: number;
    planningTime: number;
    executionTime: number;
  };
  generatedAt: string;
}

export interface WorkspaceTag {
  id: string;
  name: string;
  color: string;
  description: string;
  category: string;
  usageCount: number;
  createdAt: string;
}

export class WorkspaceManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly workspacesDir: string;
  private readonly settingsDir: string;
  private readonly analyticsDir: string;
  
  private workspaces = new Map<string, WorkspaceMetadata>();
  private hierarchies = new Map<string, WorkspaceHierarchy>();
  private settings = new Map<string, WorkspaceSettings>();
  private analytics = new Map<string, WorkspaceAnalytics>();
  private tags = new Map<string, WorkspaceTag>();
  
  private analyticsUpdateInterval = 300000; // 5 minutes
  private analyticsTimer?: NodeJS.Timeout;

  constructor(logger: Logger, auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger;
    
    // Use auditLogger for workspace operations
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'workspace-manager' },
      operation: { type: 'initialization', description: 'WorkspaceManager initialized' },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: this.generateId('init') }
    });
    
    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.workspacesDir = path.join(dataDir, 'workspaces');
    this.settingsDir = path.join(dataDir, 'workspace-settings');
    this.analyticsDir = path.join(dataDir, 'workspace-analytics');
    
    this.initializeWorkspaceManager();
    this.startAnalyticsUpdates();
  }

  /**
   * Initialize workspace manager
   */
  private async initializeWorkspaceManager(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.workspacesDir, { recursive: true }),
      fs.mkdir(this.settingsDir, { recursive: true }),
      fs.mkdir(this.analyticsDir, { recursive: true })
    ]);

    await this.loadAllWorkspaces();
    await this.loadAllSettings();
    await this.loadAllAnalytics();
    await this.loadTags();
    
    this.startAnalyticsUpdates();
    
    this.logger.info('Workspace manager initialized', {
      workspacesCount: this.workspaces.size,
      settingsCount: this.settings.size
    });
  }

  /**
   * Create new workspace with full metadata
   */
  async createWorkspace(
    name: string,
    description: string,
    projectPath: string,
    options: {
      tags?: string[];
      categories?: string[];
      customFields?: Record<string, any>;
      parentId?: string;
      autoAnalyze?: boolean;
    } = {}
  ): Promise<WorkspaceMetadata> {
    const workspaceId = this.generateId('ws');
    
    // Analyze project structure if path exists
    let projectStructure: ProjectStructure | undefined;
    if (projectPath && await this.pathExists(projectPath)) {
      projectStructure = await this.analyzeProjectStructure(projectPath);
    }

    const workspace: WorkspaceMetadata = {
      id: workspaceId,
      name,
      description,
      projectPath,
      tags: options.tags || [],
      categories: options.categories || [],
      customFields: {
        ...options.customFields,
        projectStructure,
        createdBy: 'system',
        lastAnalyzed: new Date().toISOString()
      },
      sessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create hierarchy if parent specified
    if (options.parentId) {
      await this.createHierarchy(workspaceId, options.parentId);
    }

    // Create default settings
    await this.createDefaultSettings(workspaceId);

    this.workspaces.set(workspaceId, workspace);
    await this.persistWorkspace(workspace);
    
    // Initialize analytics
    if (options.autoAnalyze !== false) {
      await this.initializeAnalytics(workspaceId);
    }

    this.emit('workspaceCreated', workspace);
    
    this.logger.info('Workspace created', {
      workspaceId,
      name,
      projectPath,
      hasStructure: !!projectStructure
    });

    return workspace;
  }

  /**
   * Get workspace with full context
   */
  async getWorkspace(workspaceId: string): Promise<WorkspaceMetadata | null> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return null;
    }

    // Refresh project structure if needed
    if (workspace.projectPath && workspace.customFields?.['lastAnalyzed']) {
      const lastAnalyzed = new Date(workspace.customFields['lastAnalyzed'] as string);
      const now = new Date();
      const hoursSinceAnalysis = (now.getTime() - lastAnalyzed.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceAnalysis > 24) { // Re-analyze daily
        workspace.customFields['projectStructure'] = await this.analyzeProjectStructure(workspace.projectPath);
        workspace.customFields['lastAnalyzed'] = now.toISOString();
        await this.persistWorkspace(workspace);
      }
    }

    return workspace;
  }

  /**
   * Update workspace metadata
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<WorkspaceMetadata>
  ): Promise<WorkspaceMetadata> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const updatedWorkspace: WorkspaceMetadata = {
      ...workspace,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.workspaces.set(workspaceId, updatedWorkspace);
    await this.persistWorkspace(updatedWorkspace);

    this.emit('workspaceUpdated', updatedWorkspace);
    
    this.logger.info('Workspace updated', {
      workspaceId,
      fields: Object.keys(updates)
    });

    return updatedWorkspace;
  }

  /**
   * Add session to workspace
   */
  async addSessionToWorkspace(workspaceId: string, sessionId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.sessions.includes(sessionId)) {
      workspace.sessions.push(sessionId);
      workspace.updatedAt = new Date().toISOString();
      
      await this.persistWorkspace(workspace);
      
      // Update analytics
      await this.updateAnalyticsForSession(workspaceId, sessionId);
    }
  }

  /**
   * Remove session from workspace
   */
  async removeSessionFromWorkspace(workspaceId: string, sessionId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return;
    }

    const index = workspace.sessions.indexOf(sessionId);
    if (index !== -1) {
      workspace.sessions.splice(index, 1);
      workspace.updatedAt = new Date().toISOString();
      
      await this.persistWorkspace(workspace);
    }
  }

  /**
   * Get workspaces by criteria
   */
  async getWorkspaces(filters: {
    tags?: string[];
    categories?: string[];
    projectType?: string;
    search?: string;
    parentId?: string;
    limit?: number;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sessionCount';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<WorkspaceMetadata[]> {
    let workspaces = Array.from(this.workspaces.values());

    // Apply filters
    if (filters.tags && filters.tags.length > 0) {
      workspaces = workspaces.filter(ws => 
        filters.tags!.some(tag => ws.tags.includes(tag))
      );
    }

    if (filters.categories && filters.categories.length > 0) {
      workspaces = workspaces.filter(ws => 
        filters.categories!.some(cat => ws.categories.includes(cat))
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      workspaces = workspaces.filter(ws =>
        ws.name.toLowerCase().includes(searchLower) ||
        ws.description.toLowerCase().includes(searchLower) ||
        ws.projectPath.toLowerCase().includes(searchLower)
      );
    }

    if (filters.parentId) {
      const hierarchy = this.hierarchies.get(filters.parentId);
      if (hierarchy) {
        workspaces = workspaces.filter(ws => hierarchy.children.includes(ws.id));
      }
    }

    // Sort
    if (filters.sortBy) {
      workspaces.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sortBy) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'createdAt':
            aValue = new Date(a.createdAt);
            bValue = new Date(b.createdAt);
            break;
          case 'updatedAt':
            aValue = new Date(a.updatedAt);
            bValue = new Date(b.updatedAt);
            break;
          case 'sessionCount':
            aValue = a.sessions.length;
            bValue = b.sessions.length;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return filters.sortOrder === 'desc' ? 1 : -1;
        if (aValue > bValue) return filters.sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // Apply limit
    if (filters.limit) {
      workspaces = workspaces.slice(0, filters.limit);
    }

    return workspaces;
  }

  /**
   * Get workspace hierarchy
   */
  async getWorkspaceHierarchy(workspaceId: string): Promise<WorkspaceHierarchy | null> {
    return this.hierarchies.get(workspaceId) || null;
  }

  /**
   * Create workspace hierarchy
   */
  async createHierarchy(childId: string, parentId: string): Promise<WorkspaceHierarchy> {
    const parentHierarchy = this.hierarchies.get(parentId);
    const parentLevel = parentHierarchy ? parentHierarchy.level : 0;
    const parentPath = parentHierarchy ? parentHierarchy.path : [];

    const hierarchy: WorkspaceHierarchy = {
      id: childId,
      parentId,
      children: [],
      level: parentLevel + 1,
      path: [...parentPath, parentId]
    };

    // Update parent's children
    if (parentHierarchy) {
      parentHierarchy.children.push(childId);
      await this.persistHierarchy(parentHierarchy);
    }

    this.hierarchies.set(childId, hierarchy);
    await this.persistHierarchy(hierarchy);

    this.logger.info('Hierarchy created', {
      childId,
      parentId,
      level: hierarchy.level
    });

    return hierarchy;
  }

  /**
   * Get workspace settings
   */
  async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
    return this.settings.get(workspaceId) || null;
  }

  /**
   * Update workspace settings
   */
  async updateWorkspaceSettings(
    workspaceId: string,
    updates: Partial<WorkspaceSettings>
  ): Promise<WorkspaceSettings> {
    let settings = this.settings.get(workspaceId);
    
    if (!settings) {
      settings = await this.createDefaultSettings(workspaceId);
    }

    const updatedSettings = { ...settings, ...updates };
    this.settings.set(workspaceId, updatedSettings);
    await this.persistSettings(updatedSettings);

    this.logger.info('Workspace settings updated', {
      workspaceId,
      fields: Object.keys(updates)
    });

    return updatedSettings;
  }

  /**
   * Get workspace analytics
   */
  async getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalytics | null> {
    return this.analytics.get(workspaceId) || null;
  }

  /**
   * Create or update workspace tag
   */
  async createTag(
    name: string,
    color: string,
    description: string,
    category: string
  ): Promise<WorkspaceTag> {
    const tagId = this.generateId('tag');
    
    const tag: WorkspaceTag = {
      id: tagId,
      name,
      color,
      description,
      category,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };

    this.tags.set(tagId, tag);
    await this.persistTags();

    this.logger.info('Tag created', { tagId, name, category });

    return tag;
  }

  /**
   * Get all tags
   */
  async getTags(category?: string): Promise<WorkspaceTag[]> {
    let tags = Array.from(this.tags.values());
    
    if (category) {
      tags = tags.filter(tag => tag.category === category);
    }

    return tags.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Apply tag to workspace
   */
  async applyTagToWorkspace(workspaceId: string, tagId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    const tag = this.tags.get(tagId);
    
    if (!workspace || !tag) {
      throw new Error('Workspace or tag not found');
    }

    if (!workspace.tags.includes(tag.name)) {
      workspace.tags.push(tag.name);
      workspace.updatedAt = new Date().toISOString();
      
      tag.usageCount++;
      
      await Promise.all([
        this.persistWorkspace(workspace),
        this.persistTags()
      ]);
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return;
    }

    // Remove from hierarchy
    const hierarchy = this.hierarchies.get(workspaceId);
    if (hierarchy && hierarchy.parentId) {
      const parentHierarchy = this.hierarchies.get(hierarchy.parentId);
      if (parentHierarchy) {
        const index = parentHierarchy.children.indexOf(workspaceId);
        if (index !== -1) {
          parentHierarchy.children.splice(index, 1);
          await this.persistHierarchy(parentHierarchy);
        }
      }
    }

    // Clean up files
    const workspaceFile = path.join(this.workspacesDir, `${workspaceId}.json`);
    const settingsFile = path.join(this.settingsDir, `${workspaceId}.json`);
    const analyticsFile = path.join(this.analyticsDir, `${workspaceId}.json`);

    await Promise.all([
      fs.unlink(workspaceFile).catch(() => {}),
      fs.unlink(settingsFile).catch(() => {}),
      fs.unlink(analyticsFile).catch(() => {})
    ]);

    // Remove from memory
    this.workspaces.delete(workspaceId);
    this.hierarchies.delete(workspaceId);
    this.settings.delete(workspaceId);
    this.analytics.delete(workspaceId);

    this.emit('workspaceDeleted', workspaceId);
    
    this.logger.info('Workspace deleted', { workspaceId });
  }

  // Private helper methods

  private async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
    const stats = await fs.stat(projectPath);
    const name = path.basename(projectPath);
    
    const structure: ProjectStructure = {
      id: this.generateId('struct'),
      name,
      type: stats.isDirectory() ? 'folder' : 'file',
      path: projectPath,
      relativePath: name,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      metadata: {
        permissions: stats.mode,
        isSymlink: stats.isSymbolicLink()
      }
    };

    if (stats.isDirectory()) {
      try {
        const entries = await fs.readdir(projectPath);
        structure.children = [];
        
        for (const entry of entries.slice(0, 100)) { // Limit to avoid huge structures
          const entryPath = path.join(projectPath, entry);
          try {
            const entryStructure = await this.analyzeProjectStructure(entryPath);
            entryStructure.relativePath = entry;
            structure.children.push(entryStructure);
          } catch {
            // Skip entries that can't be read
          }
        }
      } catch {
        // Directory can't be read
      }
    }

    return structure;
  }

  private async createDefaultSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const settings: WorkspaceSettings = {
      id: this.generateId('settings'),
      workspaceId,
      autoSave: true,
      syncEnabled: true,
      backupFrequency: 'weekly',
      retentionPolicy: {
        sessions: 90,
        logs: 30,
        backups: 10
      },
      indexingEnabled: true,
      searchableFileTypes: ['.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt'],
      excludePatterns: ['node_modules', '.git', 'dist', 'build', '.next']
    };

    this.settings.set(workspaceId, settings);
    await this.persistSettings(settings);

    return settings;
  }

  private async initializeAnalytics(workspaceId: string): Promise<void> {
    const analytics: WorkspaceAnalytics = {
      workspaceId,
      sessionCount: 0,
      averageSessionDuration: 0,
      mostUsedTemplates: [],
      errorRate: 0,
      successRate: 0,
      topCategories: [],
      timeMetrics: {
        totalTime: 0,
        activeTime: 0,
        planningTime: 0,
        executionTime: 0
      },
      generatedAt: new Date().toISOString()
    };

    this.analytics.set(workspaceId, analytics);
    await this.persistAnalytics(analytics);
  }

  private async updateAnalyticsForSession(workspaceId: string, sessionId: string): Promise<void> {
    void sessionId; // Avoid unused parameter warning
    // This would integrate with session data to update analytics
    // Implementation depends on how sessions are stored and accessed
    const analytics = this.analytics.get(workspaceId);
    if (analytics) {
      analytics.sessionCount++;
      analytics.generatedAt = new Date().toISOString();
      await this.persistAnalytics(analytics);
    }
  }

  private startAnalyticsUpdates(): void {
    this.analyticsTimer = setInterval(async () => {
      await this.updateAllAnalytics();
    }, this.analyticsUpdateInterval);
  }

  /**
   * Cleanup method to clear analytics timer
   */
  public cleanup(): void {
    if (this.analyticsTimer) {
      clearInterval(this.analyticsTimer);
      this.analyticsTimer = undefined;
    }
  }

  private async updateAllAnalytics(): Promise<void> {
    for (const workspaceId of this.workspaces.keys()) {
      try {
        await this.updateAnalyticsForSession(workspaceId, ''); // Placeholder
      } catch (error) {
        this.logger.error('Failed to update analytics', error as Error, { workspaceId });
      }
    }
  }

  private async loadAllWorkspaces(): Promise<void> {
    try {
      const files = await fs.readdir(this.workspacesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.workspacesDir, file), 'utf-8');
          const workspace = JSON.parse(content) as WorkspaceMetadata;
          this.workspaces.set(workspace.id, workspace);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load workspaces', error as Error);
    }
  }

  private async loadAllSettings(): Promise<void> {
    try {
      const files = await fs.readdir(this.settingsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.settingsDir, file), 'utf-8');
          const settings = JSON.parse(content) as WorkspaceSettings;
          this.settings.set(settings.workspaceId, settings);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load settings', error as Error);
    }
  }

  private async loadAllAnalytics(): Promise<void> {
    try {
      const files = await fs.readdir(this.analyticsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.analyticsDir, file), 'utf-8');
          const analytics = JSON.parse(content) as WorkspaceAnalytics;
          this.analytics.set(analytics.workspaceId, analytics);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load analytics', error as Error);
    }
  }

  private async loadTags(): Promise<void> {
    try {
      const tagsFile = path.join(this.workspacesDir, 'tags.json');
      await fs.access(tagsFile);
      const content = await fs.readFile(tagsFile, 'utf-8');
      const tags = JSON.parse(content) as WorkspaceTag[];
      tags.forEach(tag => this.tags.set(tag.id, tag));
    } catch {
      // Tags file doesn't exist yet
    }
  }

  private async persistWorkspace(workspace: WorkspaceMetadata): Promise<void> {
    const workspacePath = path.join(this.workspacesDir, `${workspace.id}.json`);
    await fs.writeFile(workspacePath, JSON.stringify(workspace, null, 2), 'utf-8');
  }

  private async persistHierarchy(hierarchy: WorkspaceHierarchy): Promise<void> {
    const hierarchyPath = path.join(this.workspacesDir, `hierarchy-${hierarchy.id}.json`);
    await fs.writeFile(hierarchyPath, JSON.stringify(hierarchy, null, 2), 'utf-8');
  }

  private async persistSettings(settings: WorkspaceSettings): Promise<void> {
    const settingsPath = path.join(this.settingsDir, `${settings.workspaceId}.json`);
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  private async persistAnalytics(analytics: WorkspaceAnalytics): Promise<void> {
    const analyticsPath = path.join(this.analyticsDir, `${analytics.workspaceId}.json`);
    await fs.writeFile(analyticsPath, JSON.stringify(analytics, null, 2), 'utf-8');
  }

  private async persistTags(): Promise<void> {
    const tagsPath = path.join(this.workspacesDir, 'tags.json');
    const tags = Array.from(this.tags.values());
    await fs.writeFile(tagsPath, JSON.stringify(tags, null, 2), 'utf-8');
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}