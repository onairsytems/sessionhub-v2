import { ipcMain } from 'electron';
import { SessionHubUIUpdater } from '../../src/services/figma/SessionHubUIUpdater';
import { ProjectUIEnhancer } from '../../src/services/figma/ProjectUIEnhancer';
import { FigmaMCPService } from '../../src/services/figma/FigmaMCPService';

interface Project {
  id: string;
  name: string;
  path: string;
  framework: 'react' | 'vue' | 'angular' | 'next' | 'nuxt';
  gitRepo?: string;
  figmaFileKey?: string;
}

let sessionHubUpdater: SessionHubUIUpdater | null = null;
let projectEnhancer: ProjectUIEnhancer | null = null;
let figmaService: FigmaMCPService | null = null;

export function registerFigmaHandlers(): void {
  // Check Figma connection
  ipcMain.handle('figma:check-connection', async () => {
    return figmaService !== null;
  });

  // Get API key (from secure storage)
  ipcMain.handle('figma:get-api-key', async () => {
    // TODO: Implement secure storage retrieval
    return process.env['FIGMA_API_KEY'] || '';
  });

  // Initialize Figma MCP
  ipcMain.handle('figma:initialize', async (_, apiKey: string) => {
    try {
      figmaService = new FigmaMCPService();
      await figmaService.initialize(apiKey);

      sessionHubUpdater = new SessionHubUIUpdater();
      await sessionHubUpdater.initialize(apiKey);

      projectEnhancer = new ProjectUIEnhancer();
      await projectEnhancer.initialize(apiKey);

      return true;
    } catch (error) {
      throw error;
    }
  });

  // SessionHub UI Update Handlers
  ipcMain.handle('figma:start-sessionhub-ui-update', async (_, figmaFileKey: string) => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    return await sessionHubUpdater.startUIUpdateSession(figmaFileKey);
  });

  ipcMain.handle('figma:get-update-status', async () => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    return sessionHubUpdater.getSessionStatus();
  });

  ipcMain.handle('figma:preview-ui-changes', async (_, figmaFileKey: string) => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    return await sessionHubUpdater.previewUIChanges(figmaFileKey);
  });

  ipcMain.handle('figma:create-ui-pull-request', async (_, figmaFileKey: string, description: string) => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    return await sessionHubUpdater.createUIPullRequest(figmaFileKey, description);
  });

  // Project UI Enhancement Handlers
  ipcMain.handle('figma:register-project', async (_, project: unknown) => {
    if (!projectEnhancer) {
      throw new Error('Figma not initialized');
    }
    projectEnhancer.registerProject(project as Project);
    return true;
  });

  ipcMain.handle('figma:start-project-ui-update', async (_, projectId: string, figmaFileKey: string) => {
    if (!projectEnhancer) {
      throw new Error('Figma not initialized');
    }
    return await projectEnhancer.startEnhancementSession(projectId, figmaFileKey);
  });

  ipcMain.handle('figma:get-enhancement-status', async (_, sessionId: string) => {
    if (!projectEnhancer) {
      throw new Error('Figma not initialized');
    }
    return projectEnhancer.getSessionStatus(sessionId);
  });

  ipcMain.handle('figma:merge-ui-changes', async (_, sessionId: string) => {
    if (!projectEnhancer) {
      throw new Error('Figma not initialized');
    }
    return await projectEnhancer.mergeUIChanges(sessionId);
  });

  ipcMain.handle('figma:get-figma-enabled-projects', async () => {
    if (!projectEnhancer) {
      throw new Error('Figma not initialized');
    }
    return projectEnhancer.getFigmaEnabledProjects();
  });

  // Watch Figma file for changes
  ipcMain.handle('figma:watch-file', async (_, figmaFileKey: string) => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    await sessionHubUpdater.watchFigmaFile(figmaFileKey);
    return true;
  });

  // Get components needing update
  ipcMain.handle('figma:get-components-needing-update', async () => {
    if (!sessionHubUpdater) {
      throw new Error('Figma not initialized');
    }
    return await sessionHubUpdater.getComponentsNeedingUpdate();
  });
}