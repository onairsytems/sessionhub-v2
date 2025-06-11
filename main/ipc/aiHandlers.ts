/**
 * IPC handlers for AI Enhancement features
 * Session 2.8 Implementation
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AIEnhancementManager } from '../../src/services/ai';
import type { 
  AutocompleteContext,
  AutocompleteSuggestion,
  PatternSearchCriteria,
  AIEnhancementConfig 
} from '../../src/services/ai';
let aiManager: AIEnhancementManager | null = null;
export function registerAIHandlers(): void {
  // Initialize AI Manager
  ipcMain.handle('ai:initialize', async () => {
    if (!aiManager) {
      aiManager = new AIEnhancementManager();
      await aiManager.initialize();
    }
    return aiManager.getStatus();
  });
  // Learning from code
  ipcMain.handle('ai:learn-from-code', async (
    _event: IpcMainInvokeEvent,
    filePath: string,
    content: string
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.learnFromCode(filePath, content);
    return { success: true };
  });
  // Autocomplete
  ipcMain.handle('ai:get-autocomplete', async (
    _event: IpcMainInvokeEvent,
    context: AutocompleteContext
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.getAutocompleteSuggestions(context);
  });
  ipcMain.handle('ai:record-autocomplete', async (
    _event: IpcMainInvokeEvent,
    suggestion: unknown,
    accepted: boolean
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.recordAutocompleteUsage(suggestion as AutocompleteSuggestion, accepted);
    return { success: true };
  });
  // Project analysis
  ipcMain.handle('ai:analyze-project', async (
    _event: IpcMainInvokeEvent,
    projectPath: string
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.analyzeProject(projectPath);
  });
  // Session tracking
  ipcMain.handle('ai:start-session', async (
    _event: IpcMainInvokeEvent,
    sessionId: string,
    objectives: string[]
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.startSession(sessionId, objectives);
    return { success: true };
  });
  ipcMain.handle('ai:update-session', async (
    _event: IpcMainInvokeEvent,
    sessionId: string,
    updates: unknown
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.updateSession(sessionId, updates);
    return { success: true };
  });
  ipcMain.handle('ai:complete-session', async (
    _event: IpcMainInvokeEvent,
    sessionId: string,
    success: boolean
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.completeSession(sessionId, success);
    return { success: true };
  });
  // Pattern library
  ipcMain.handle('ai:search-patterns', async (
    _event: IpcMainInvokeEvent,
    criteria: PatternSearchCriteria
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.searchPatterns(criteria);
  });
  ipcMain.handle('ai:add-pattern', async (
    _event: IpcMainInvokeEvent,
    pattern: unknown
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.addPattern(pattern);
  });
  // Cross-project intelligence
  ipcMain.handle('ai:get-insights', async (
    _event: IpcMainInvokeEvent,
    projectPath?: string
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.getProjectInsights(projectPath);
  });
  ipcMain.handle('ai:transfer-learning', async (
    _event: IpcMainInvokeEvent,
    fromProject: string,
    toProject: string
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.transferLearning(fromProject, toProject);
  });
  // Status and reports
  ipcMain.handle('ai:get-status', async () => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return aiManager.getStatus();
  });
  ipcMain.handle('ai:get-metrics-summary', async (
    _event: IpcMainInvokeEvent,
    days: number
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.getMetricsSummary(days);
  });
  ipcMain.handle('ai:generate-insights', async () => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.generateInsightReport();
  });
  // Configuration
  ipcMain.handle('ai:get-config', async () => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return aiManager.getConfig();
  });
  ipcMain.handle('ai:update-config', async (
    _event: IpcMainInvokeEvent,
    config: Partial<AIEnhancementConfig>
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    aiManager.updateConfig(config);
    return aiManager.getConfig();
  });
  // Data management
  ipcMain.handle('ai:export-data', async () => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    return await aiManager.exportLearningData();
  });
  ipcMain.handle('ai:import-data', async (
    _event: IpcMainInvokeEvent,
    data: string
  ) => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.importLearningData(data);
    return { success: true };
  });
  ipcMain.handle('ai:clear-data', async () => {
    if (!aiManager) throw new Error('AI Manager not initialized');
    await aiManager.clearLearningData();
    return { success: true };
  });
}
export function getAIManager(): AIEnhancementManager | null {
  return aiManager;
}