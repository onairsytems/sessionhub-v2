/**
 * Core MCP Server Infrastructure
 * 
 * This is the main MCP server that runs locally on the user's machine.
 * It manages all MCP integrations, handles security, and provides
 * the runtime environment for executing MCP tools.
 */
import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import express, { Express, Request, Response, NextFunction } from 'express';
import { WebSocketServer } from 'ws';
import { MCPIntegrationRegistry } from './MCPIntegrationRegistry';
import { MCPSecurityManager } from './MCPSecurityManager';
import { MCPRequestHandler } from './MCPRequestHandler';
import { MCPIntegration, MCPServerConfig, MCPServerStatus } from './types';
export class MCPServer extends EventEmitter {
  private app: Express;
  private server: Server;
  private wss: WebSocketServer;
  private registry: MCPIntegrationRegistry;
  private security: MCPSecurityManager;
  private requestHandler: MCPRequestHandler;
  private status: MCPServerStatus = 'stopped';
  private config: MCPServerConfig;
  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    // Initialize core components
    this.registry = new MCPIntegrationRegistry();
    this.security = new MCPSecurityManager(config.security);
    this.requestHandler = new MCPRequestHandler(this.registry, this.security);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    // CORS for local development
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    // Request logging
    this.app.use((_req: Request, _res: Response, next: NextFunction) => {
      next();
    });
  }
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: this.status,
        uptime: process.uptime(),
        integrations: this.registry.getIntegrationCount(),
        version: this.config.version || '1.0.0'
      });
    });
    // Integration management
    this.app.get('/integrations', async (_req: Request, res: Response) => {
      try {
        const integrations = await this.registry.listIntegrations();
        res.json({ integrations });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
    this.app.post('/integrations/register', async (req: Request, res: Response) => {
      try {
        const integration = req.body as MCPIntegration;
        // Validate and sandbox the integration
        await this.security.validateIntegration(integration);
        const sandboxedIntegration = await this.security.sandboxIntegration(integration);
        // Register the integration
        const id = await this.registry.registerIntegration(sandboxedIntegration);
        res.json({ id, status: 'registered' });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    });
    this.app.delete('/integrations/:id', async (req: Request, res: Response) => {
      try {
        await this.registry.unregisterIntegration(req.params['id'] || "");
        res.json({ status: 'unregistered' });
      } catch (error) {
        res.status(404).json({ error: (error as Error).message });
      }
    });
    // Tool execution
    this.app.post('/execute', async (req: Request, res: Response) => {
      try {
        const { integrationId, tool, params } = req.body;
        // Execute in sandboxed environment
        const result = await this.requestHandler.executeToolCall(
          integrationId,
          tool,
          params
        );
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
    // Configuration
    this.app.get('/config', (_req: Request, res: Response) => {
      res.json({
        port: this.config.port,
        version: this.config.version,
        capabilities: this.getCapabilities()
      });
    });
  }
  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          const response = await this.handleWebSocketMessage(data);
          ws.send(JSON.stringify(response));
        } catch (error) {
          ws.send(JSON.stringify({ error: (error as Error).message }));
        }
      });
      ws.on('close', () => {
      });
    });
  }
  private async handleWebSocketMessage(data: any): Promise<any> {
    switch (data.type) {
      case 'subscribe':
        // Subscribe to integration events
        return { type: 'subscribed', id: data.integrationId };
      case 'execute':
        // Execute tool call
        return await this.requestHandler.executeToolCall(
          data.integrationId,
          data.tool,
          data.params
        );
      case 'list':
        // List available tools
        const integration = await this.registry.getIntegration(data.integrationId);
        return { type: 'tools', tools: integration?.tools || [] };
      default:
        throw new Error(`Unknown message type: ${data.type}`);
    }
  }
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, () => {
          this.status = 'running';
          this.emit('started');
          resolve();
        });
      } catch (error) {
        this.status = 'error';
        reject(error);
      }
    });
  }
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => {
        this.status = 'stopped';
        this.emit('stopped');
        resolve();
      });
    });
  }
  getStatus(): MCPServerStatus {
    return this.status;
  }
  getCapabilities(): string[] {
    return [
      'integration-registry',
      'sandboxed-execution',
      'websocket-streaming',
      'multi-language-sdk',
      'visual-builder',
      'marketplace-ready'
    ];
  }
  // Integration management
  async registerIntegration(integration: MCPIntegration): Promise<string> {
    await this.security.validateIntegration(integration);
    const sandboxed = await this.security.sandboxIntegration(integration);
    return this.registry.registerIntegration(sandboxed);
  }
  async unregisterIntegration(id: string): Promise<void> {
    return this.registry.unregisterIntegration(id);
  }
  async listIntegrations(): Promise<MCPIntegration[]> {
    return this.registry.listIntegrations();
  }
  // Event emitters
  override emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}