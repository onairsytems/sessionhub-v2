import { v4 as uuidv4 } from 'uuid';
import { Session, SessionStatus, SessionRequest, SessionError, SessionMetadata } from '../models/Session';
import { SupabaseService } from './cloud/SupabaseService';
import { LocalCacheService } from './cache/LocalCacheService';
import { GitVersioningService } from './GitVersioningService';
import { SearchService } from './SearchService';
import { InstructionProtocol } from '../models/Instruction';
import { ExecutionResult } from '../models/ExecutionResult';
import { Logger } from '../lib/logging/Logger';
import { 
  SearchOptions, 
  FilterCriteria, 
  SortOptions, 
  SearchResult,
  SavedFilter,
  SessionTag,
  SessionFolder,
  OrganizationMetadata
} from '../models/SearchFilter';
// Re-export types for convenience
export type { Session, SessionStatus } from '../models/Session';
export interface SessionFilter {
  status?: SessionStatus[];
  userId?: string;
  projectId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}
export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  request: Partial<SessionRequest>;
  metadata: Partial<SessionMetadata>;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
  usageCount: number;
}
export interface SessionAnalytics {
  totalSessions: number;
  successRate: number;
  averageDuration: number;
  sessionsByStatus: Record<SessionStatus, number>;
  sessionsByDay: Array<{ date: string; count: number }>;
  commonErrors: Array<{ error: string; count: number }>;
  performanceMetrics: {
    avgPlanningTime: number;
    avgExecutionTime: number;
    avgTotalTime: number;
  };
}
export class SessionService {
  private static instance: SessionService;
  private supabase: SupabaseService;
  private cache: LocalCacheService;
  private gitService: GitVersioningService;
  private searchService: SearchService;
  private logger: Logger;
  private constructor() {
    this.logger = new Logger('SessionService');
    this.supabase = new SupabaseService(this.logger);
    this.cache = new LocalCacheService(this.logger);
    this.gitService = GitVersioningService.getInstance();
    this.searchService = SearchService.getInstance();
  }
  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }
  // Session CRUD Operations
  async createSession(request: SessionRequest, metadata: SessionMetadata): Promise<Session> {
    const session: Session = {
      id: uuidv4(),
      name: (metadata['name'] as string) || `Session ${new Date().toISOString()}`,
      description: (metadata['description'] as string) || request.content.substring(0, 100),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: request.userId,
      projectId: (metadata['projectId'] as string) || 'default',
      request,
      metadata
    };
    // Save to both local cache and Supabase
    await this.cache.upsertSession(session);
    await this.supabase.upsertSession(session);
    // Create initial Git commit for session
    await this.gitService.createSessionVersion(session, 'Session created');
    return session;
  }
  async getSession(sessionId: string): Promise<Session | null> {
    // Try cache first
    let session = await this.cache.getSession(sessionId);
    // Fallback to Supabase if not in cache
    if (!session) {
      session = await this.supabase.getSession(sessionId);
      if (session) {
        await this.cache.upsertSession(session);
      }
    }
    return session;
  }
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    // Update both storages
    await this.cache.upsertSession(updatedSession);
    await this.supabase.upsertSession(updatedSession);
    // Create Git version for significant updates
    if (updates.status || updates.instructions || updates.result) {
      const message = this.getCommitMessage(updates);
      await this.gitService.createSessionVersion(updatedSession, message);
    }
    return updatedSession;
  }
  async deleteSession(sessionId: string): Promise<void> {
    await this.cache.deleteSession(sessionId);
    await this.supabase.deleteSession(sessionId);
  }
  // Session Search and Filtering
  async searchSessions(filter: SessionFilter): Promise<Session[]> {
    let sessions = await this.cache.getUserSessions(filter.userId || '');
    // Apply filters
    if (filter.status && filter.status.length > 0) {
      sessions = sessions.filter(s => filter.status!.includes(s.status));
    }
    if (filter.projectId) {
      sessions = sessions.filter(s => s.projectId === filter.projectId);
    }
    if (filter.tags && filter.tags.length > 0) {
      sessions = sessions.filter(s => 
        s.metadata.tags?.some((tag: string) => filter.tags!.includes(tag))
      );
    }
    if (filter.dateFrom) {
      sessions = sessions.filter(s => 
        new Date(s.createdAt) >= filter.dateFrom!
      );
    }
    if (filter.dateTo) {
      sessions = sessions.filter(s => 
        new Date(s.createdAt) <= filter.dateTo!
      );
    }
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      sessions = sessions.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.request.content.toLowerCase().includes(term) ||
        s.metadata.tags?.some((tag: string) => tag.toLowerCase().includes(term))
      );
    }
    return sessions;
  }

  // Enhanced Search Methods
  async advancedSearch(
    options: SearchOptions,
    filter?: FilterCriteria,
    sort?: SortOptions
  ): Promise<SearchResult<Session>> {
    return this.searchService.search(options, filter, sort);
  }

  // Tag Management
  async createTag(tag: Omit<SessionTag, 'id' | 'sessionCount' | 'createdAt' | 'lastUsedAt'>): Promise<SessionTag> {
    return this.searchService.createTag(tag);
  }

  async getTags(): Promise<SessionTag[]> {
    return this.searchService.getTags();
  }

  async updateTag(id: string, updates: Partial<SessionTag>): Promise<SessionTag> {
    return this.searchService.updateTag(id, updates);
  }

  async deleteTag(id: string): Promise<void> {
    return this.searchService.deleteTag(id);
  }

  // Folder Management
  async createFolder(folder: Omit<SessionFolder, 'id' | 'sessionCount' | 'subfolderCount' | 'createdAt' | 'updatedAt' | 'path'>): Promise<SessionFolder> {
    return this.searchService.createFolder(folder);
  }

  async getFolders(parentId?: string): Promise<SessionFolder[]> {
    return this.searchService.getFolders(parentId);
  }

  async updateFolder(id: string, updates: Partial<SessionFolder>): Promise<SessionFolder> {
    return this.searchService.updateFolder(id, updates);
  }

  async deleteFolder(id: string): Promise<void> {
    return this.searchService.deleteFolder(id);
  }

  // Saved Filter Management
  async createSavedFilter(filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<SavedFilter> {
    return this.searchService.createSavedFilter(filter);
  }

  async getSavedFilters(): Promise<SavedFilter[]> {
    return this.searchService.getSavedFilters();
  }

  async updateSavedFilter(id: string, updates: Partial<SavedFilter>): Promise<SavedFilter> {
    return this.searchService.updateSavedFilter(id, updates);
  }

  async deleteSavedFilter(id: string): Promise<void> {
    return this.searchService.deleteSavedFilter(id);
  }

  // Organization Management
  async addSessionToFolder(sessionId: string, folderId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const orgMetadata = (session.metadata as any).organizationMetadata as OrganizationMetadata || {};
    const folders = orgMetadata.folders || [];
    
    if (!folders.includes(folderId)) {
      folders.push(folderId);
      await this.searchService.updateSessionOrganization(sessionId, { folders });
    }
  }

  async removeSessionFromFolder(sessionId: string, folderId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const orgMetadata = (session.metadata as any).organizationMetadata as OrganizationMetadata || {};
    const folders = orgMetadata.folders || [];
    
    const updatedFolders = folders.filter(id => id !== folderId);
    await this.searchService.updateSessionOrganization(sessionId, { folders: updatedFolders });
  }

  async addSessionTag(sessionId: string, tagName: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const orgMetadata = (session.metadata as any).organizationMetadata as OrganizationMetadata || {};
    const tags = orgMetadata.tags || [];
    
    if (!tags.includes(tagName)) {
      tags.push(tagName);
      await this.searchService.updateSessionOrganization(sessionId, { tags });
    }
  }

  async removeSessionTag(sessionId: string, tagName: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const orgMetadata = (session.metadata as any).organizationMetadata as OrganizationMetadata || {};
    const tags = orgMetadata.tags || [];
    
    const updatedTags = tags.filter(tag => tag !== tagName);
    await this.searchService.updateSessionOrganization(sessionId, { tags: updatedTags });
  }

  async toggleSessionFavorite(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const orgMetadata = (session.metadata as any).organizationMetadata as OrganizationMetadata || {};
    const newFavoriteState = !orgMetadata.isFavorite;
    
    await this.searchService.updateSessionOrganization(sessionId, { 
      isFavorite: newFavoriteState 
    });

    return newFavoriteState;
  }
  // Session Templates
  async createTemplate(session: Session, templateData: Partial<SessionTemplate>): Promise<SessionTemplate> {
    const template: SessionTemplate = {
      id: uuidv4(),
      name: templateData.name || session.name,
      description: templateData.description || session.description,
      category: templateData.category || 'general',
      tags: templateData.tags || session.metadata.tags || [],
      request: {
        content: session.request.content,
        context: session.request.context
      },
      metadata: {
        ...session.metadata,
        isTemplate: true
      },
      isPublic: templateData.isPublic || false,
      createdBy: session.userId,
      createdAt: new Date().toISOString(),
      usageCount: 0
    };
    await this.supabase.createSessionTemplate(template);
    return template;
  }
  async getTemplates(category?: string, isPublic?: boolean): Promise<SessionTemplate[]> {
    return this.supabase.getSessionTemplates(category, isPublic);
  }
  async createSessionFromTemplate(templateId: string, userId: string, customizations?: Partial<SessionRequest>): Promise<Session> {
    const template = await this.supabase.getSessionTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    const request: SessionRequest = {
      id: uuidv4(),
      sessionId: '', // Will be set after session creation
      userId,
      content: customizations?.content || template.request.content || '',
      context: { ...template.request.context, ...customizations?.context },
      timestamp: new Date().toISOString()
    };
    const metadata: SessionMetadata = {
      ...template.metadata,
      templateId,
      templateName: template.name
    };
    const session = await this.createSession(request, metadata);
    // Increment template usage count
    await this.supabase.incrementTemplateUsage(templateId);
    return session;
  }
  // Session Analytics
  async getAnalytics(userId?: string, projectId?: string, dateRange?: { from: Date; to: Date }): Promise<SessionAnalytics> {
    const filter: SessionFilter = {
      userId,
      projectId,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to
    };
    const sessions = await this.searchSessions(filter);
    // Calculate metrics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const successRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    const sessionsByStatus = sessions.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<SessionStatus, number>);
    // Group sessions by day
    const sessionsByDay = this.groupSessionsByDay(sessions);
    // Calculate average durations
    const durationsData = sessions
      .filter(s => s.metadata.totalDuration)
      .map(s => ({
        total: s.metadata.totalDuration || 0,
        planning: s.metadata.planningDuration || 0,
        execution: s.metadata.executionDuration || 0
      }));
    const avgTotalTime = durationsData.length > 0
      ? durationsData.reduce((sum, d) => sum + d.total, 0) / durationsData.length
      : 0;
    const avgPlanningTime = durationsData.length > 0
      ? durationsData.reduce((sum, d) => sum + d.planning, 0) / durationsData.length
      : 0;
    const avgExecutionTime = durationsData.length > 0
      ? durationsData.reduce((sum, d) => sum + d.execution, 0) / durationsData.length
      : 0;
    // Analyze common errors
    const errorMap = new Map<string, number>();
    sessions
      .filter(s => s.error)
      .forEach(s => {
        const errorKey = s.error!.code || s.error!.message;
        errorMap.set(errorKey, (errorMap.get(errorKey) || 0) + 1);
      });
    const commonErrors = Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      totalSessions,
      successRate,
      averageDuration: avgTotalTime,
      sessionsByStatus,
      sessionsByDay,
      commonErrors,
      performanceMetrics: {
        avgPlanningTime,
        avgExecutionTime,
        avgTotalTime
      }
    };
  }
  // Export/Import functionality
  async exportSession(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      session: {
        ...session,
        id: undefined, // Remove ID to allow reimport
        userId: undefined // Remove user-specific data
      }
    };
    return JSON.stringify(exportData, null, 2);
  }
  async importSession(exportData: string, userId: string): Promise<Session> {
    const data = JSON.parse(exportData);
    if (data.version !== '1.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }
    const importedSession = data.session;
    const request: SessionRequest = {
      ...importedSession.request,
      userId,
      id: uuidv4(),
      sessionId: uuidv4()
    };
    const metadata: SessionMetadata = {
      ...importedSession.metadata,
      importedAt: new Date().toISOString(),
      originalExportDate: data.exportDate
    };
    return this.createSession(request, metadata);
  }
  // Helper methods
  private getCommitMessage(updates: Partial<Session>): string {
    if (updates.status) {
      return `Session status changed to ${updates.status}`;
    }
    if (updates.instructions) {
      return 'Session instructions updated';
    }
    if (updates.result) {
      return 'Session execution completed';
    }
    return 'Session updated';
  }
  private groupSessionsByDay(sessions: Session[]): Array<{ date: string; count: number }> {
    const dayMap = new Map<string, number>();
    sessions.forEach(session => {
      const date = new Date(session.createdAt).toISOString().split('T')[0];
      if (date) {
        const currentCount = dayMap.get(date);
        dayMap.set(date, (currentCount || 0) + 1);
      }
    });
    return Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  // Session handoff workflow
  async handoffToPlanningActor(session: Session): Promise<void> {
    await this.updateSession(session.id, {
      status: 'planning',
      metadata: {
        ...session.metadata,
        handoffTime: new Date().toISOString(),
        currentActor: 'planning'
      }
    });
  }
  async handoffToExecutionActor(session: Session, instructions: InstructionProtocol): Promise<void> {
    await this.updateSession(session.id, {
      status: 'executing',
      instructions,
      metadata: {
        ...session.metadata,
        handoffTime: new Date().toISOString(),
        currentActor: 'execution',
        planningDuration: this.calculateDuration(session.createdAt)
      }
    });
  }
  async completeSession(session: Session, result: ExecutionResult): Promise<void> {
    await this.updateSession(session.id, {
      status: 'completed',
      result,
      completedAt: new Date().toISOString(),
      metadata: {
        ...session.metadata,
        executionDuration: this.calculateDuration((session.metadata['handoffTime'] as string) || session.updatedAt),
        totalDuration: this.calculateDuration(session.createdAt)
      }
    });
  }
  async failSession(session: Session, error: SessionError): Promise<void> {
    await this.updateSession(session.id, {
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
      metadata: {
        ...session.metadata,
        totalDuration: this.calculateDuration(session.createdAt)
      }
    });
  }
  private calculateDuration(fromTime: string): number {
    return Date.now() - new Date(fromTime).getTime();
  }
}