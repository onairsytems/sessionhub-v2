/**
 * @actor system
 * @responsibility IPC handlers for session orchestration and complexity management
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { SessionManager } from '@/src/core/orchestrator/SessionManager';
import { SessionComplexityAnalyzer, ComplexityScore } from '@/src/services/session/SessionComplexityAnalyzer';
import { SessionSplittingEngine } from '@/src/services/session/SessionSplittingEngine';
import { SessionOrchestrationFramework } from '@/src/services/session/SessionOrchestrationFramework';
import { SessionPatternLearningSystem } from '@/src/services/session/SessionPatternLearningSystem';
import { PatternRecognitionService } from '@/src/services/intelligence/PatternRecognitionService';
import { DatabaseService } from '@/src/database/DatabaseService';

export function registerSessionOrchestrationHandlers(): void {
  // Initialize services
  const logger = new Logger('SessionOrchestration');
  const auditLogger = new AuditLogger();
  const db = new DatabaseService();
  
  // Create a temporary session manager for orchestration
  // In production, this should be integrated with the main SessionService
  const sessionManager = new SessionManager(logger, auditLogger);
  
  const patternService = new PatternRecognitionService();
  const complexityAnalyzer = new SessionComplexityAnalyzer(logger, auditLogger, patternService);
  const splittingEngine = new SessionSplittingEngine(logger, auditLogger, complexityAnalyzer);
  const orchestrationFramework = new SessionOrchestrationFramework(logger, auditLogger, sessionManager);
  const learningSystem = new SessionPatternLearningSystem(logger, auditLogger, patternService, db);

  /**
   * Analyze session complexity
   */
  ipcMain.handle('session:analyzeComplexity', async (
    _event: IpcMainInvokeEvent,
    { content }: { content: string }
  ) => {
    try {
      const request = {
        id: `req_${Date.now()}`,
        sessionId: `session_${Date.now()}`,
        userId: 'current_user',
        content,
        context: {},
        timestamp: new Date().toISOString()
      };

      const complexityScore = await complexityAnalyzer.analyzeComplexity(request);
      
      // Get recommendations from learning system
      const recommendations = await learningSystem.getRecommendations(complexityScore);

      return {
        success: true,
        complexityScore: {
          ...complexityScore,
          recommendations
        }
      };
    } catch (error) {
      logger.error('Failed to analyze complexity', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Create split workflow from complexity analysis
   */
  ipcMain.handle('session:createSplitWorkflow', async (
    _event: IpcMainInvokeEvent,
    { complexityScore, name, description }: {
      complexityScore: unknown;
      name: string;
      description: string;
    }
  ) => {
    try {
      // Create a session for splitting
      const session = await sessionManager.createSession({
        userId: 'current_user',
        content: description,
        context: { complexity: complexityScore }
      });

      // Generate split plan
      const splitPlan = await splittingEngine.splitSession(
        session,
        complexityScore as ComplexityScore,
        {
          maxComplexityPerSplit: 40,
          preserveLogicalGrouping: true,
          prioritizeByDependency: true
        }
      );

      // Create workflow from split plan
      const workflow = await orchestrationFramework.createWorkflowFromSplitPlan(
        splitPlan,
        name,
        description
      );

      return {
        success: true,
        workflow
      };
    } catch (error) {
      logger.error('Failed to create split workflow', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get all workflows
   */
  ipcMain.handle('session:getWorkflows', async (_event: IpcMainInvokeEvent) => {
    try {
      const workflows = orchestrationFramework.getAllWorkflows();
      return {
        success: true,
        workflows
      };
    } catch (error) {
      logger.error('Failed to get workflows', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Start workflow execution
   */
  ipcMain.handle('workflow:start', async (
    _event: IpcMainInvokeEvent,
    { workflowId }: { workflowId: string }
  ) => {
    try {
      await orchestrationFramework.executeWorkflow(workflowId, {
        continueOnFailure: false,
        maxParallelSessions: 1,
        retryFailedSessions: true,
        maxRetries: 2,
        pauseBetweenSessions: 1000,
        preserveContext: true
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to start workflow', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Pause workflow execution
   */
  ipcMain.handle('workflow:pause', async (
    _event: IpcMainInvokeEvent,
    { workflowId }: { workflowId: string }
  ) => {
    try {
      await orchestrationFramework.pauseWorkflow(workflowId);
      return { success: true };
    } catch (error) {
      logger.error('Failed to pause workflow', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Resume workflow execution
   */
  ipcMain.handle('workflow:resume', async (
    _event: IpcMainInvokeEvent,
    { workflowId }: { workflowId: string }
  ) => {
    try {
      await orchestrationFramework.resumeWorkflow(workflowId);
      return { success: true };
    } catch (error) {
      logger.error('Failed to resume workflow', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Cancel workflow execution
   */
  ipcMain.handle('workflow:cancel', async (
    _event: IpcMainInvokeEvent,
    { workflowId }: { workflowId: string }
  ) => {
    try {
      await orchestrationFramework.cancelWorkflow(workflowId);
      return { success: true };
    } catch (error) {
      logger.error('Failed to cancel workflow', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get pattern learning insights
   */
  ipcMain.handle('session:getLearningInsights', async (_event: IpcMainInvokeEvent) => {
    try {
      const insights = learningSystem.getInsights() as unknown;
      const statistics = learningSystem.getPatternStatistics() as unknown;

      return {
        success: true,
        insights,
        statistics
      };
    } catch (error) {
      logger.error('Failed to get learning insights', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get complexity statistics
   */
  ipcMain.handle('session:getComplexityStatistics', async (
    _event: IpcMainInvokeEvent,
    { userId, projectId }: { userId?: string; projectId?: string }
  ) => {
    try {
      const statistics = await complexityAnalyzer.getComplexityStatistics(userId, projectId);
      return {
        success: true,
        statistics
      };
    } catch (error) {
      logger.error('Failed to get complexity statistics', error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Set up event forwarding
  orchestrationFramework.on('workflow:created', (workflow) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('workflow:created', workflow);
    });
  });

  orchestrationFramework.on('workflow:started', (workflow) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('workflow:started', workflow);
    });
  });

  orchestrationFramework.on('workflow:progress', (workflow) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('workflow:progress', {
        workflowId: workflow.id,
        progress: workflow.progress
      });
    });
  });

  orchestrationFramework.on('workflow:completed', (workflow) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('workflow:completed', { workflowId: workflow.id });
    });
  });

  orchestrationFramework.on('workflow:failed', ({ workflow, error }) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('workflow:failed', {
        workflowId: workflow.id,
        error: error.message
      });
    });
  });

  orchestrationFramework.on('session:starting', ({ workflow, sessionId }) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('session:starting', {
        workflowId: workflow.id,
        sessionId
      });
    });
  });

  orchestrationFramework.on('session:completed', ({ workflow, sessionId }) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('session:completed', {
        workflowId: workflow.id,
        sessionId
      });
    });
    
    // Learn from completed session
    const session = sessionManager.getSession(sessionId);
    if (session && session.result) {
      const complexityScore = session.metadata['complexityScore'] as ComplexityScore;
      if (complexityScore) {
        void learningSystem.learnFromSession(session, complexityScore, session.result);
      }
    }
  });

  orchestrationFramework.on('session:failed', ({ workflow, sessionId, error }) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => {
      window.webContents.send('session:failed', {
        workflowId: workflow.id,
        sessionId,
        error: error.message
      });
    });
  });

  logger.info('Session orchestration handlers registered');
}