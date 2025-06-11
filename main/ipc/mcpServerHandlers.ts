/**
 * MCP Server IPC Handlers
 * 
 * Handles all IPC communication for the MCP server infrastructure
 */
import { ipcMain } from 'electron';
import { MCPServerService } from '../../src/services/mcp/server/MCPServerService';
import { MCPMarketplace, MarketplaceSearchOptions } from '../../src/services/mcp/marketplace/MCPMarketplace';
import { MCPIntegration } from '../../src/services/mcp/server/types';
let mcpServer: MCPServerService | null = null;
let marketplace: MCPMarketplace | null = null;
export function registerMCPServerHandlers(): void {
  // Initialize services
  mcpServer = new MCPServerService();
  marketplace = new MCPMarketplace();
  // Server management
  ipcMain.handle('mcp:server:start', async () => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    return mcpServer.start();
  });
  ipcMain.handle('mcp:server:stop', async () => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    return mcpServer.stop();
  });
  ipcMain.handle('mcp:server:status', async () => {
    if (!mcpServer) {
      return { running: false };
    }
    return mcpServer.getStatus();
  });
  // Integration management
  ipcMain.handle('mcp:integrations:list', async () => {
    if (!mcpServer) {
      return [];
    }
    return mcpServer.listIntegrations();
  });
  ipcMain.handle('mcp:integrations:register', async (_event, integration: MCPIntegration) => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    return mcpServer.registerIntegration(integration);
  });
  ipcMain.handle('mcp:integrations:unregister', async (_event, id: string) => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    return mcpServer.unregisterIntegration(id);
  });
  // Tool execution
  ipcMain.handle('mcp:tool:execute', async (_event, integrationId: string, tool: string, params: unknown) => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    return mcpServer.executeToolCall(integrationId, tool, params);
  });
  ipcMain.handle('mcp:tool:test', async (_event, integrationId: string, tool: string, params: unknown) => {
    if (!mcpServer) {
      throw new Error('MCP Server not initialized');
    }
    // Execute with test flag
    return mcpServer.executeToolCall(integrationId, tool, {
      ...(params as Record<string, unknown>),
      _test: true
    });
  });
  // Marketplace
  ipcMain.handle('mcp:marketplace:search', async (_event, options: unknown) => {
    if (!marketplace) {
      throw new Error('Marketplace not initialized');
    }
    return marketplace.searchIntegrations(options as MarketplaceSearchOptions);
  });
  ipcMain.handle('mcp:marketplace:getFeatured', async () => {
    if (!marketplace) {
      throw new Error('Marketplace not initialized');
    }
    return marketplace.getFeaturedIntegrations();
  });
  ipcMain.handle('mcp:marketplace:getTrending', async () => {
    if (!marketplace) {
      throw new Error('Marketplace not initialized');
    }
    return marketplace.getTrendingIntegrations();
  });
  ipcMain.handle('mcp:marketplace:getIntegration', async (_event, id: string) => {
    if (!marketplace) {
      throw new Error('Marketplace not initialized');
    }
    return marketplace.getIntegration(id);
  });
  ipcMain.handle('mcp:marketplace:install', async (_event, integrationId: string) => {
    if (!marketplace || !mcpServer) {
      throw new Error('Services not initialized');
    }
    // Get integration from marketplace
    const marketplaceIntegration = await marketplace.getIntegration(integrationId);
    if (!marketplaceIntegration) {
      throw new Error('Integration not found in marketplace');
    }
    // Install to local server
    const integration = marketplaceIntegration.manifest.integration;
    const id = await mcpServer.registerIntegration(integration);
    // Update marketplace stats
    await marketplace.installIntegration(integrationId, process.env['HOME'] || '');
    return id;
  });
  ipcMain.handle('mcp:marketplace:getCategories', async () => {
    if (!marketplace) {
      throw new Error('Marketplace not initialized');
    }
    return marketplace.getCategories();
  });
  // Event forwarding
  if (mcpServer) {
    mcpServer.on('integration:registered', (integration) => {
      const g = global as { mainWindow?: { webContents: { send: (channel: string, data: unknown) => void } } };
      g.mainWindow?.webContents.send('mcp:event:integration:registered', integration);
    });
    mcpServer.on('integration:unregistered', (integration) => {
      const g = global as { mainWindow?: { webContents: { send: (channel: string, data: unknown) => void } } };
      g.mainWindow?.webContents.send('mcp:event:integration:unregistered', integration);
    });
    mcpServer.on('error', (error) => {
      const g = global as { mainWindow?: { webContents: { send: (channel: string, data: unknown) => void } } };
      g.mainWindow?.webContents.send('mcp:event:error', error);
    });
  }
  // Auto-start server in development
  if (process.env['NODE_ENV'] === 'development') {
    setTimeout(() => void (async () => {
      try {
        await mcpServer?.start();
      } catch (error) {
      }
    })(), 2000);
  }
}
// Export for use in main process
export function getMCPServer(): MCPServerService | null {
  return mcpServer;
}
export function getMCPMarketplace(): MCPMarketplace | null {
  return marketplace;
}