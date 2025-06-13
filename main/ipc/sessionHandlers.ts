import { ipcMain } from 'electron';
import SessionService, { SessionFilter } from '@/src/services/SessionService';
import { SessionRequest, SessionMetadata, Session } from '@/src/models/Session';
// import { InstructionProtocol } from '@/src/models/Instruction';
// import { ExecutionResult } from '@/src/models/ExecutionResult';
import { Logger } from '@/src/lib/logging/Logger';

interface SessionTemplate {
  name: string;
  description: string;
  content: any;
}

const logger = new Logger({ component: 'SessionHandlers' });

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
    return sessionService.createTemplate(templateData.name || "", templateData.description || "", session);
  });

  ipcMain.handle('session:getTemplates', async (_event) => {
    return sessionService.getTemplates();
  });

  ipcMain.handle('session:createFromTemplate', async (_event, templateId: string, data: any) => {
    return sessionService.createSessionFromTemplate(templateId, data);
  });

  // Session analytics
  ipcMain.handle('session:analytics', async (_event, _userId?: string) => {
    return sessionService.getAnalytics();
  });

  // Export/Import
  ipcMain.handle('session:export', async (_event, sessionId: string) => {
    return sessionService.exportSession(sessionId);
  });

  ipcMain.handle('session:import', async (_event, data: any) => {
    return sessionService.importSession(data);
  });

  // Session workflow handoffs
  ipcMain.handle('session:handoffToPlanning', async (_event, sessionId: string) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.handoffToPlanningActor(sessionId);
  });

  ipcMain.handle('session:handoffToExecution', async (_event, sessionId: string) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.handoffToExecutionActor(sessionId);
  });

  ipcMain.handle('session:complete', async (_event, sessionId: string) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.completeSession(sessionId);
  });

  ipcMain.handle('session:fail', async (_event, sessionId: string, error: unknown) => {
    const session = await sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return sessionService.failSession(sessionId, String(error));
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