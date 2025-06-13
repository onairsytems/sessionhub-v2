import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { SessionExecutionPipeline, SessionExecutionRequest } from '@/src/services/session/SessionExecutionPipeline';
import { DocumentImportService } from '@/src/services/document/DocumentImportService';
import { DocumentAnalysisService, DocumentMetadata } from '@/src/services/document/DocumentAnalysisService';
import * as path from 'path';

let sessionPipeline: SessionExecutionPipeline | null = null;
let documentImport: DocumentImportService | null = null;
let documentAnalysis: DocumentAnalysisService | null = null;
let logger: Logger | null = null;
let auditLogger: AuditLogger | null = null;

// Progress event emitter map - removed as it's not being used

function initializeServices() {
  if (!logger) {
    logger = new Logger('SessionPipelineHandlers');
    auditLogger = new AuditLogger();
  }

  if (!documentImport) {
    if (auditLogger) {
      documentImport = new DocumentImportService(logger, auditLogger);
    }
  }

  if (!documentAnalysis) {
    const claudeClient = new ClaudeAPIClient({ apiKey: process.env['ANTHROPIC_API_KEY'] || '' }, logger);
    if (auditLogger) {
      documentAnalysis = new DocumentAnalysisService(logger, auditLogger, claudeClient);
    }
  }

  if (!sessionPipeline) {
    const claudeClient = new ClaudeAPIClient({ apiKey: process.env['ANTHROPIC_API_KEY'] || '' }, logger);
    if (auditLogger) {
      sessionPipeline = new SessionExecutionPipeline(logger, auditLogger, claudeClient);
    }
  }
}

export function registerSessionPipelineHandlers() {
  initializeServices();

  // Execute a complete session
  ipcMain.handle('session:execute', async (
    event: IpcMainInvokeEvent,
    request: SessionExecutionRequest
  ) => {
    try {
      initializeServices();

      // Subscribe to progress updates
      const sessionId = `session_${Date.now()}`;
      if (sessionPipeline) {
        sessionPipeline.subscribeToProgress(sessionId, (progress) => {
          void event.sender.send('session:progress', { sessionId, progress });
        });

        // Execute session
        const result = await sessionPipeline.executeSession(request);

        // Unsubscribe from progress
        sessionPipeline.unsubscribeFromProgress(sessionId);
        
        return { success: true, session: result };
      } else {
        throw new Error('Session pipeline not initialized');
      }
    } catch (error) {
      logger?.error('Session execution failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Import documents
  ipcMain.handle('document:import', async (
    _event: IpcMainInvokeEvent,
    filePaths: string[]
  ) => {
    try {
      initializeServices();

      const results = await Promise.all(
        filePaths.map(filePath => {
          if (!documentImport) throw new Error('Document import service not initialized');
          return documentImport.importFromFile(filePath);
        })
      );

      return { success: true, results };
    } catch (error) {
      logger?.error('Document import failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Import from Google Docs
  ipcMain.handle('document:importGoogleDocs', async (
    _event: IpcMainInvokeEvent,
    docUrl: string
  ) => {
    try {
      initializeServices();

      if (!documentImport) throw new Error('Document import service not initialized');
      const result = await documentImport.importFromGoogleDocs(docUrl);
      return { success: true, result };
    } catch (error) {
      logger?.error('Google Docs import failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Analyze document
  ipcMain.handle('document:analyze', async (
    _event: IpcMainInvokeEvent,
    documentMetadata: unknown
  ) => {
    try {
      initializeServices();

      if (!documentAnalysis) throw new Error('Document analysis service not initialized');
      const analysis = await documentAnalysis.analyzeDocument(documentMetadata as DocumentMetadata);
      return { success: true, analysis };
    } catch (error) {
      logger?.error('Document analysis failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Analyze multiple documents
  ipcMain.handle('document:analyzeSet', async (
    _event: IpcMainInvokeEvent,
    documents: unknown[]
  ) => {
    try {
      initializeServices();

      if (!documentAnalysis) throw new Error('Document analysis service not initialized');
      const analysis = await documentAnalysis.analyzeDocumentSet(documents as DocumentMetadata[]);
      return { success: true, analysis };
    } catch (error) {
      logger?.error('Document set analysis failed', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get session by ID
  ipcMain.handle('session:get', async (
    _event: IpcMainInvokeEvent,
    sessionId: string
  ) => {
    try {
      initializeServices();

      if (!sessionPipeline) throw new Error('Session pipeline not initialized');
      const session = sessionPipeline.getSession(sessionId);
      return { success: true, session };
    } catch (error) {
      logger?.error('Failed to get session', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get user sessions
  ipcMain.handle('session:getUserSessions', async (
    _event: IpcMainInvokeEvent,
    userId: string
  ) => {
    try {
      initializeServices();

      if (!sessionPipeline) throw new Error('Session pipeline not initialized');
      const sessions = sessionPipeline.getUserSessions(userId);
      return { success: true, sessions };
    } catch (error) {
      logger?.error('Failed to get user sessions', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get pipeline metrics
  ipcMain.handle('session:getMetrics', async () => {
    try {
      initializeServices();

      const defaultMetrics = { totalSessions: 0, successRate: 0, averageDuration: 0 };
      const metrics = sessionPipeline ? (sessionPipeline.getMetrics() as { totalSessions: number; successRate: number; averageDuration: number }) : defaultMetrics;
      return { success: true, metrics };
    } catch (error) {
      logger?.error('Failed to get metrics', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // File dialog for document selection
  ipcMain.handle('dialog:selectDocuments', async (_event: IpcMainInvokeEvent) => {
    const { dialog } = await import('electron');
    
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      return { success: true, filePaths: result.filePaths };
    }
    
    return { success: false, filePaths: [] };
  });

  // Handle file drop
  ipcMain.handle('file:getInfo', async (
    _event: IpcMainInvokeEvent,
    filePath: string
  ) => {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const fileType = path.extname(filePath).toLowerCase().slice(1);

      return {
        success: true,
        fileInfo: {
          name: fileName,
          type: fileType,
          size: stats.size,
          path: filePath
        }
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}