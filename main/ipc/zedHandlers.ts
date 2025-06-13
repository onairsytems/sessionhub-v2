import { ipcMain, shell, BrowserWindow } from 'electron';
import { ZedAdapter } from '../../src/services/ide/ZedAdapter';
import { ZedConnectionManager } from '../../src/services/ide/ZedConnectionManager';
import { BaseProjectContext } from '../../src/models/ProjectContext';

let zedAdapter: ZedAdapter | null = null;
let connectionManager: ZedConnectionManager | null = null;

export function registerZedHandlers() {
  // Connection Management
  ipcMain.handle('zed:store-credentials', async (_event, credentials) => {
    if (!connectionManager) {
      connectionManager = new ZedConnectionManager();
    }
    
    void connectionManager.initialize(credentials);
    return { success: true };
  });

  ipcMain.handle('zed:test-connection', async () => {
    if (!connectionManager) {
      connectionManager = new ZedConnectionManager();
    }
    
    return await connectionManager.testConnection();
  });

  ipcMain.handle('zed:get-connection-health', async () => {
    if (!connectionManager) {
      throw new Error('Connection manager not initialized');
    }
    
    return await connectionManager.getConnectionHealth();
  });

  ipcMain.handle('zed:reconnect', async () => {
    if (!connectionManager) {
      throw new Error('Connection manager not initialized');
    }
    
    void connectionManager.connect();
    return { success: true };
  });

  // IDE Adapter Operations
  ipcMain.handle('zed:connect', async () => {
    if (!zedAdapter) {
      zedAdapter = new ZedAdapter();
    }
    
    void zedAdapter.connect();
    return { success: true };
  });

  ipcMain.handle('zed:disconnect', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.disconnect();
    return { success: true };
  });

  ipcMain.handle('zed:open-workspace', async (_event, workspacePath: string) => {
    if (!zedAdapter) {
      zedAdapter = new ZedAdapter();
      void zedAdapter.connect();
    }
    
    void zedAdapter.openWorkspace(workspacePath);
    return { success: true };
  });

  ipcMain.handle('zed:get-workspace-info', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.getActiveWorkspace();
  });

  ipcMain.handle('zed:open-file', async (_event, filePath: string) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.openFile(filePath);
    return { success: true };
  });

  ipcMain.handle('zed:save-file', async (_event, filePath: string, content: string) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.saveFile(filePath, content);
    return { success: true };
  });

  // Two-Actor Integration
  ipcMain.handle('zed:send-to-execution', async (_event, instruction: string, context: unknown) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.sendToExecutionActor(instruction, context as BaseProjectContext);
    return { success: true };
  });

  ipcMain.handle('zed:get-execution-status', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.getExecutionStatus();
  });

  ipcMain.handle('zed:get-actor-status', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.getActorStatus();
  });

  ipcMain.handle('zed:sync-actors', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    await zedAdapter.syncActors();
    return { success: true };
  });

  // New Two-Actor handlers
  ipcMain.handle('zed:handle-slash-command', async (_event, command: string, args: string, context: any) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.handleSlashCommand(command, args, context);
  });

  ipcMain.handle('zed:get-boundary-violations', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return zedAdapter.getBoundaryViolations();
  });

  ipcMain.handle('zed:get-flow-metrics', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return zedAdapter.getInstructionFlowMetrics();
  });

  ipcMain.handle('zed:enforce-assistant-response', async (_event, response: any) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.enforceAssistantResponse(response);
  });

  // Git Operations
  ipcMain.handle('zed:git-status', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.getGitStatus();
  });

  ipcMain.handle('zed:stage-files', async (_event, files: string[]) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.stageFiles(files);
    return { success: true };
  });

  ipcMain.handle('zed:commit', async (_event, message: string) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    void zedAdapter.commit(message);
    return { success: true };
  });

  // Quality Gates
  ipcMain.handle('zed:run-linter', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.runLinter();
  });

  ipcMain.handle('zed:run-typecheck', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    return await zedAdapter.runTypeCheck();
  });

  // Utility
  ipcMain.handle('zed:open-external', async (_event, url: string) => {
    void shell.openExternal(url);
    return { success: true };
  });

  // Forward events from adapters to renderer
  if (connectionManager) {
    connectionManager.on('health-check', (health: unknown) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:health-update', health);
      });
    });
  }

  if (zedAdapter) {
    zedAdapter.on('workspace-opened', (workspace: unknown) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:workspace-opened', workspace);
      });
    });

    zedAdapter.on('execution-sent', (message: { instruction: string }) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('actor:instruction-sent', {
          id: Date.now().toString(),
          type: 'execution',
          content: message.instruction,
          timestamp: new Date(),
          status: 'sent'
        });
      });
    });

    // Forward Two-Actor events
    zedAdapter.on('actor-state-update', (state: any) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:actor-state-update', state);
      });
    });

    zedAdapter.on('boundary-violation', (violation: any) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:boundary-violation', violation);
      });
    });

    zedAdapter.on('execution-complete', (data: any) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:execution-complete', data);
      });
    });
  }
}