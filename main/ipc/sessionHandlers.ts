import { ipcMain } from 'electron';
import { SessionService, SessionFilter, SessionTemplate } from '@/src/services/SessionService';
import { SessionRequest, SessionMetadata, Session, SessionError } from '@/src/models/Session';
import { InstructionProtocol } from '@/src/models/Instruction';
import { ExecutionResult } from '@/src/models/ExecutionResult';
import { Logger } from '@/src/lib/logging/Logger';

const logger = new Logger('SessionHandlers');

export function registerSessionHandlers() {
  const sessionService = SessionService.getInstance();

  // Session CRUD operations
  ipcMain.handle('session:create', async (_event, request: SessionRequest, metadata: SessionMetadata) => {
    return sessionService.createSession(request, metadata);
  });

  ipcMain.handle('session:get', async (_event, sessionId: string) => {
    return sessionService.getSession(sessionId);
  });

  ipcMain.handle('session:update', async (_event, sessionId: string, updates: unknown) => {
    return sessionService.updateSession(sessionId, updates as Partial<Session>);
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

  ipcMain.handle('session:handoffToExecution', async (_event, sessionId: string, instructions: unknown) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.handoffToExecutionActor(session, instructions as InstructionProtocol);
  });

  ipcMain.handle('session:complete', async (_event, sessionId: string, result: unknown) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.completeSession(session, result as ExecutionResult);
  });

  ipcMain.handle('session:fail', async (_event, sessionId: string, error: unknown) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.failSession(session, error as SessionError);
  });

  // Git versioning - Note: These methods access private gitService property
  // In a real implementation, these should be exposed as public methods on SessionService
  ipcMain.handle('session:getHistory', async (_event, sessionId: string) => {
    // Placeholder since gitService is private
    logger.info('Session history requested', { sessionId });
    return { message: 'Git service access is private - needs public API' };
  });

  ipcMain.handle('session:getVersion', async (_event, sessionId: string, commit: string) => {
    // Placeholder since gitService is private
    logger.info('Session version requested', { sessionId, commit });
    return { message: 'Git service access is private - needs public API' };
  });

  ipcMain.handle('session:compareVersions', async (_event, sessionId: string, commit1: string, commit2: string) => {
    // Placeholder since gitService is private
    logger.info('Session version comparison requested', { sessionId, commit1, commit2 });
    return { message: 'Git service access is private - needs public API' };
  });

  ipcMain.handle('session:searchByContent', async (_event, searchTerm: string) => {
    // Placeholder since gitService is private
    logger.info('Session content search requested', { searchTerm });
    return { message: 'Git service access is private - needs public API' };
  });

  ipcMain.handle('session:getStatistics', async (_event) => {
    // Placeholder since gitService is private
    logger.info('Session statistics requested');
    return { message: 'Git service access is private - needs public API' };
  });
}