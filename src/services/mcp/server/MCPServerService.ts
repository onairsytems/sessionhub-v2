/**
 * MCP Server Service
 * 
 * Main service that manages the MCP server lifecycle and integrates
 * with the SessionHub application.
 */
import { MCPServer } from './MCPServer';
import { MCPServerConfig, MCPIntegration } from './types';
import { EventEmitter } from 'events';
import * as path from 'path';
// import * as fs from 'fs/promises'; // Unused for now
export class MCPServerService extends EventEmitter {
  private server: MCPServer | null = null;
  private config: MCPServerConfig;
  private isRunning: boolean = false;
  constructor() {
    super();
    this.config = this.loadConfig();
  }
  private loadConfig(): MCPServerConfig {
    return {
      port: process.env['MCP_SERVER_PORT'] ? parseInt(process.env['MCP_SERVER_PORT']) : 7345,
      version: '1.0.0',
      security: {
        enableSandbox: process.env['NODE_ENV'] === 'production',
        maxExecutionTime: 30000,
        allowedDomains: [
          'api.github.com',
          'api.linear.app',
          'api.figma.com',
          'api.openai.com',
          'api.anthropic.com',
          'api.stripe.com',
          'hooks.zapier.com'
        ],
        blockedDomains: [
          'localhost',
          '127.0.0.1',
          '0.0.0.0'
        ],
        requireSignature: false // Will enable in production
      },
      storage: {
        type: 'sqlite',
        path: path.join(
          process.env['HOME'] || '',
          '.sessionhub',
          'mcp',
          'integrations.db'
        )
      },
      marketplace: {
        enabled: true,
        url: 'https://mcp.sessionhub.com'
      }
    };
  }
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('MCP Server is already running');
    }
    try {
      // Create server instance
      this.server = new MCPServer(this.config);
      // Set up event listeners
      this.setupEventListeners();
      // Start the server
      await this.server.start();
      // Register core integrations
      await this.registerCoreIntegrations();
      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }
    try {
      await this.server.stop();
      this.server = null;
      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  private setupEventListeners(): void {
    if (!this.server) return;
    this.server.on('integration:registered', (integration) => {
      this.emit('integration:registered', integration);
    });
    this.server.on('integration:unregistered', (integration) => {
      this.emit('integration:unregistered', integration);
    });
    this.server.on('error', (error) => {
      this.emit('error', error);
    });
  }
  private async registerCoreIntegrations(): Promise<void> {
    if (!this.server) return;
    const coreIntegrations: MCPIntegration[] = [
      {
        name: 'GitHub',
        version: '1.0.0',
        description: 'GitHub integration for repositories, issues, and pull requests',
        author: 'SessionHub',
        category: 'development',
        icon: '🐙',
        tools: [
          {
            name: 'listRepositories',
            description: 'List user repositories',
            inputSchema: {
              type: 'object',
              properties: {
                page: { type: 'number', description: 'Page number' },
                perPage: { type: 'number', description: 'Items per page' }
              }
            }
          },
          {
            name: 'createIssue',
            description: 'Create a new issue',
            inputSchema: {
              type: 'object',
              properties: {
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue body' }
              },
              required: ['repo', 'title']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Linear',
        version: '1.0.0',
        description: 'Linear integration for project management',
        author: 'SessionHub',
        category: 'productivity',
        icon: '📊',
        tools: [
          {
            name: 'listIssues',
            description: 'List Linear issues',
            inputSchema: {
              type: 'object',
              properties: {
                teamId: { type: 'string', description: 'Team ID' },
                filter: { type: 'string', description: 'Filter query' }
              }
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Figma',
        version: '1.0.0',
        description: 'Figma integration for design files',
        author: 'SessionHub',
        category: 'design',
        icon: '🎨',
        tools: [
          {
            name: 'getFile',
            description: 'Get Figma file data',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string', description: 'Figma file key' }
              },
              required: ['fileKey']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Zapier',
        version: '1.0.0',
        description: 'Zapier webhook integration',
        author: 'SessionHub',
        category: 'automation',
        icon: '⚡',
        tools: [
          {
            name: 'triggerWebhook',
            description: 'Trigger a Zapier webhook',
            inputSchema: {
              type: 'object',
              properties: {
                webhookUrl: { type: 'string', description: 'Webhook URL' },
                data: { type: 'object', description: 'Data to send' }
              },
              required: ['webhookUrl', 'data']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'OpenAI',
        version: '1.0.0',
        description: 'OpenAI API integration',
        author: 'SessionHub',
        category: 'ai',
        icon: '🤖',
        tools: [
          {
            name: 'complete',
            description: 'Generate text completion',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Input prompt' },
                model: { type: 'string', description: 'Model to use', default: 'gpt-3.5-turbo' },
                maxTokens: { type: 'number', description: 'Max tokens to generate' }
              },
              required: ['prompt']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Anthropic',
        version: '1.0.0',
        description: 'Anthropic Claude API integration',
        author: 'SessionHub',
        category: 'ai',
        icon: '🧠',
        tools: [
          {
            name: 'complete',
            description: 'Generate text with Claude',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string', description: 'Input prompt' },
                model: { type: 'string', description: 'Model to use', default: 'claude-3-opus-20240229' },
                maxTokens: { type: 'number', description: 'Max tokens to generate' }
              },
              required: ['prompt']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Stripe',
        version: '1.0.0',
        description: 'Stripe payment integration',
        author: 'SessionHub',
        category: 'finance',
        icon: '💳',
        tools: [
          {
            name: 'createPaymentIntent',
            description: 'Create a payment intent',
            inputSchema: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'Amount in cents' },
                currency: { type: 'string', description: 'Currency code', default: 'usd' },
                description: { type: 'string', description: 'Payment description' }
              },
              required: ['amount']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Slack',
        version: '1.0.0',
        description: 'Slack messaging integration',
        author: 'SessionHub',
        category: 'communication',
        icon: '💬',
        tools: [
          {
            name: 'sendMessage',
            description: 'Send a message to Slack',
            inputSchema: {
              type: 'object',
              properties: {
                channel: { type: 'string', description: 'Channel ID or name' },
                text: { type: 'string', description: 'Message text' },
                attachments: { type: 'array', description: 'Message attachments' }
              },
              required: ['channel', 'text']
            }
          }
        ],
        permissions: ['network']
      }
    ];
    for (const integration of coreIntegrations) {
      try {
        await this.server.registerIntegration(integration);
      } catch (error) {
      }
    }
  }
  async getStatus(): Promise<{
    running: boolean;
    port?: number;
    integrations?: number;
    uptime?: number;
  }> {
    if (!this.server || !this.isRunning) {
      return { running: false };
    }
    const integrations = await this.server.listIntegrations();
    return {
      running: true,
      port: this.config.port,
      integrations: integrations.length,
      uptime: process.uptime()
    };
  }
  async registerIntegration(integration: MCPIntegration): Promise<string> {
    if (!this.server) {
      throw new Error('MCP Server is not running');
    }
    return this.server.registerIntegration(integration);
  }
  async unregisterIntegration(id: string): Promise<void> {
    if (!this.server) {
      throw new Error('MCP Server is not running');
    }
    return this.server.unregisterIntegration(id);
  }
  async listIntegrations(): Promise<MCPIntegration[]> {
    if (!this.server) {
      return [];
    }
    return this.server.listIntegrations();
  }
  async executeToolCall(
    integrationId: string,
    tool: string,
    params: any
  ): Promise<any> {
    if (!this.server) {
      throw new Error('MCP Server is not running');
    }
    const response = await fetch(`http://localhost:${this.config.port}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        integrationId,
        tool,
        params
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Execution failed');
    }
    return result.result;
  }
  getServerUrl(): string {
    return `http://localhost:${this.config.port}`;
  }
  getWebSocketUrl(): string {
    return `ws://localhost:${this.config.port}`;
  }
}