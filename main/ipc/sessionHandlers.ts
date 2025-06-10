import { ipcMain } from 'electron';
import { SessionService, SessionFilter, SessionTemplate } from '@/src/services/SessionService';
import { SessionRequest, SessionMetadata } from '@/src/models/Session';

export function registerSessionHandlers() {
  const sessionService = SessionService.getInstance();

  // Session CRUD operations
  ipcMain.handle('session:create', async (_event, request: SessionRequest, metadata: SessionMetadata) => {
    return sessionService.createSession(request, metadata);
  });

  ipcMain.handle('session:get', async (_event, sessionId: string) => {
    return sessionService.getSession(sessionId);
  });

  ipcMain.handle('session:update', async (_event, sessionId: string, updates: any) => {
    return sessionService.updateSession(sessionId, updates);
  });

  ipcMain.handle('session:delete', async (_event, sessionId: string) => {
    return sessionService.deleteSession(sessionId);
  });

  // Session search and filtering
  ipcMain.handle('session:search', async (_event, filter: SessionFilter) => {
    return sessionService.searchSessions(filter);
  });

  // Session templates
  ipcMain.handle('session:createTemplate', async (_event, sessionId: string, templateData: Partial<SessionTemplate>) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.createTemplate(session, templateData);
  });

  ipcMain.handle('session:getTemplates', async (_event, category?: string, isPublic?: boolean) => {
    return sessionService.getTemplates(category, isPublic);
  });

  ipcMain.handle('session:createFromTemplate', async (_event, templateId: string, userId: string, customizations?: Partial<SessionRequest>) => {
    return sessionService.createSessionFromTemplate(templateId, userId, customizations);
  });

  // Session analytics
  ipcMain.handle('session:analytics', async (_event, options: { userId?: string; projectId?: string; dateRange?: { from: Date; to: Date } }) => {
    return sessionService.getAnalytics(options.userId, options.projectId, options.dateRange);
  });

  // Export/Import
  ipcMain.handle('session:export', async (_event, sessionId: string) => {
    return sessionService.exportSession(sessionId);
  });

  ipcMain.handle('session:import', async (_event, exportData: string, userId: string) => {
    return sessionService.importSession(exportData, userId);
  });

  // Session workflow handoffs
  ipcMain.handle('session:handoffToPlanning', async (_event, sessionId: string) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.handoffToPlanningActor(session);
  });

  ipcMain.handle('session:handoffToExecution', async (_event, sessionId: string, instructions: any) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.handoffToExecutionActor(session, instructions);
  });

  ipcMain.handle('session:complete', async (_event, sessionId: string, result: any) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.completeSession(session, result);
  });

  ipcMain.handle('session:fail', async (_event, sessionId: string, error: any) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.failSession(session, error);
  });

  // Git versioning
  ipcMain.handle('session:getHistory', async (_event, sessionId: string) => {
    const gitService = (sessionService as any).gitService;
    return gitService.getSessionHistory(sessionId);
  });

  ipcMain.handle('session:getVersion', async (_event, sessionId: string, commit: string) => {
    const gitService = (sessionService as any).gitService;
    return gitService.getSessionAtVersion(sessionId, commit);
  });

  ipcMain.handle('session:compareVersions', async (_event, sessionId: string, commit1: string, commit2: string) => {
    const gitService = (sessionService as any).gitService;
    return gitService.compareSessionVersions(sessionId, commit1, commit2);
  });

  ipcMain.handle('session:searchByContent', async (_event, searchTerm: string) => {
    const gitService = (sessionService as any).gitService;
    return gitService.searchSessionsByContent(searchTerm);
  });

  ipcMain.handle('session:getStatistics', async (_event) => {
    const gitService = (sessionService as any).gitService;
    return gitService.getSessionStatistics();
  });
}