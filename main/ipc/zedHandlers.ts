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
    
    await connectionManager.initialize(credentials);
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
    
    await connectionManager.connect();
    return { success: true };
  });

  // IDE Adapter Operations
  ipcMain.handle('zed:connect', async () => {
    if (!zedAdapter) {
      zedAdapter = new ZedAdapter();
    }
    
    await zedAdapter.connect();
    return { success: true };
  });

  ipcMain.handle('zed:disconnect', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    await zedAdapter.disconnect();
    return { success: true };
  });

  ipcMain.handle('zed:open-workspace', async (_event, workspacePath: string) => {
    if (!zedAdapter) {
      zedAdapter = new ZedAdapter();
      await zedAdapter.connect();
    }
    
    await zedAdapter.openWorkspace(workspacePath);
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
    
    await zedAdapter.openFile(filePath);
    return { success: true };
  });

  ipcMain.handle('zed:save-file', async (_event, filePath: string, content: string) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    await zedAdapter.saveFile(filePath, content);
    return { success: true };
  });

  // Two-Actor Integration
  ipcMain.handle('zed:send-to-execution', async (_event, instruction: string, context: unknown) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    await zedAdapter.sendToExecutionActor(instruction, context as BaseProjectContext);
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
    
    const executionStatus = await zedAdapter.getExecutionStatus();
    const agentPanelStatus = await zedAdapter.getAgentPanelStatus();
    
    return {
      planning: {
        active: true, // SessionHub planning is always available
        currentTask: 'Ready'
      },
      execution: {
        active: executionStatus.active,
        currentTask: executionStatus.currentTask,
        agentPanelConnected: agentPanelStatus.connectedToMCP
      }
    };
  });

  ipcMain.handle('zed:sync-actors', async () => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    // Configure MCP connection for agent panel
    await zedAdapter.configureAgentPanel({
      mcpServerUrl: process.env['MCP_SERVER_URL'] || 'http://localhost:3001/mcp',
      authToken: process.env['SESSIONHUB_API_TOKEN'] || ''
    });
    
    return { success: true };
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
    
    await zedAdapter.stageFiles(files);
    return { success: true };
  });

  ipcMain.handle('zed:commit', async (_event, message: string) => {
    if (!zedAdapter) {
      throw new Error('Zed adapter not initialized');
    }
    
    await zedAdapter.commit(message);
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
    await shell.openExternal(url);
    return { success: true };
  });

  // Forward events from adapters to renderer
  if (connectionManager) {
    connectionManager.on('health-check', (health) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:health-update', health);
      });
    });
  }

  if (zedAdapter) {
    zedAdapter.on('workspace-opened', (workspace) => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        void window.webContents.send('zed:workspace-opened', workspace);
      });
    });

    zedAdapter.on('execution-sent', (message) => {
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
  }
}