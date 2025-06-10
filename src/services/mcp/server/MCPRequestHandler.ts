/**
 * MCP Request Handler
 * 
 * Handles execution of MCP tool calls with proper error handling,
 * rate limiting, and metrics collection.
 */

import { MCPIntegrationRegistry } from './MCPIntegrationRegistry';
import { MCPSecurityManager } from './MCPSecurityManager';
import { 
  MCPExecutionContext, 
  MCPExecutionResult, 
  MCPError,
  MCPExecutionMetrics,
  MCPTool,
  MCPRateLimit
} from './types';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class MCPRequestHandler {
  private registry: MCPIntegrationRegistry;
  private security: MCPSecurityManager;
  private rateLimits: Map<string, RateLimitEntry>;
  private executionHandlers: Map<string, Function>;

  constructor(
    registry: MCPIntegrationRegistry,
    security: MCPSecurityManager
  ) {
    this.registry = registry;
    this.security = security;
    this.rateLimits = new Map();
    this.executionHandlers = new Map();
    
    this.setupCoreHandlers();
  }

  private setupCoreHandlers(): void {
    // Register handlers for core integrations
    this.registerHandler('GitHub', this.createGitHubHandler());
    this.registerHandler('Linear', this.createLinearHandler());
    this.registerHandler('Figma', this.createFigmaHandler());
    this.registerHandler('Zapier', this.createZapierHandler());
  }

  registerHandler(integrationName: string, handler: Function): void {
    this.executionHandlers.set(integrationName, handler);
  }

  async executeToolCall(
    integrationId: string,
    toolName: string,
    params: any
  ): Promise<MCPExecutionResult> {
    const startTime = Date.now();
    const context: MCPExecutionContext = {
      integrationId,
      tool: toolName,
      params,
      timestamp: startTime
    };

    try {
      // Get integration
      const integration = await this.registry.getIntegration(integrationId);
      if (!integration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }

      // Find tool
      const tool = integration.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Check rate limits
      this.checkRateLimit(integrationId, toolName, tool.rateLimit);

      // Validate input
      this.validateInput(params, tool);

      // Check permissions
      if (params._requiresPermission) {
        const permission = params._requiresPermission;
        if (!this.security.checkPermission(integration, permission)) {
          throw new Error(`Permission denied: ${permission}`);
        }
      }

      // Execute tool
      let result: any;
      const handler = this.executionHandlers.get(integration.name);
      
      if (handler) {
        // Use custom handler
        result = await handler(toolName, params, context);
      } else if (integration.sandboxConfig) {
        // Execute in sandbox
        result = await this.executeInSandbox(integration, tool, params);
      } else {
        // Default execution
        result = await this.defaultExecute(integration, tool, params);
      }

      // Validate output
      if (tool.outputSchema) {
        this.validateOutput(result, tool);
      }

      const endTime = Date.now();
      const metrics: MCPExecutionMetrics = {
        startTime,
        endTime,
        duration: endTime - startTime
      };

      return {
        success: true,
        data: result,
        metrics
      };
    } catch (error: any) {
      const endTime = Date.now();
      const metrics: MCPExecutionMetrics = {
        startTime,
        endTime,
        duration: endTime - startTime
      };

      const mcpError: MCPError = {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message || 'Unknown error',
        details: error.details || {}
      };

      return {
        success: false,
        error: mcpError,
        metrics
      };
    }
  }

  private checkRateLimit(
    integrationId: string,
    toolName: string,
    limit?: MCPRateLimit
  ): void {
    if (!limit) return;

    const key = `${integrationId}:${toolName}`;
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + (limit.window * 1000)
      });
      return;
    }

    if (entry.count >= limit.requests) {
      const waitTime = Math.ceil((entry.resetTime - now) / 1000);
      throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds`);
    }

    entry.count++;
  }

  private validateInput(params: any, tool: MCPTool): void {
    const schema = tool.inputSchema;
    
    if (schema.type === 'object') {
      // Check required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in params)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          if (key in params) {
            this.validateProperty(params[key], prop, key);
          }
        }
      }
    }
  }

  private validateProperty(value: any, schema: any, name: string): void {
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (schema.type && actualType !== schema.type) {
      throw new Error(`Invalid type for ${name}: expected ${schema.type}, got ${actualType}`);
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      throw new Error(`Invalid value for ${name}: must be one of ${schema.enum.join(', ')}`);
    }

    // Number validations
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        throw new Error(`Value for ${name} must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        throw new Error(`Value for ${name} must be <= ${schema.maximum}`);
      }
    }

    // String pattern validation
    if (schema.type === 'string' && schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        throw new Error(`Value for ${name} does not match pattern: ${schema.pattern}`);
      }
    }
  }

  private validateOutput(output: any, tool: MCPTool): void {
    // Similar to input validation but for output
    if (!tool.outputSchema) return;
    
    // Basic type checking
    const actualType = Array.isArray(output) ? 'array' : typeof output;
    if (tool.outputSchema.type && actualType !== tool.outputSchema.type) {
// REMOVED: console statement
    }
  }

  private async executeInSandbox(
    integration: any,
    tool: MCPTool,
    params: any
  ): Promise<any> {
    // Execute in sandboxed environment
    const code = `
      // Sandboxed execution for ${tool.name}
      const result = await executeToolInSandbox(params);
      return result;
    `;

    return this.security.executeInSandbox(
      code,
      { params, tool },
      integration.sandboxConfig
    );
  }

  private async defaultExecute(
    _integration: any,
    tool: MCPTool,
    params: any
  ): Promise<any> {
    // Default mock implementation
    
    // Return mock data based on tool
    switch (tool.name) {
      case 'listRepositories':
        return {
          repositories: [
            { id: 1, name: 'sessionhub-v2', description: 'Main repository' }
          ]
        };
      
      case 'createIssue':
        return {
          id: Math.floor(Math.random() * 1000),
          title: params.title,
          body: params.body || '',
          state: 'open',
          created_at: new Date().toISOString()
        };
      
      default:
        return { success: true, tool: tool.name, params };
    }
  }

  // Handler implementations for core integrations
  private createGitHubHandler(): Function {
    return async (toolName: string, params: any) => {
      switch (toolName) {
        case 'listRepositories':
          // In production, this would use the GitHub API
          return {
            repositories: [
              { id: 1, name: 'sessionhub-v2', stars: 100 },
              { id: 2, name: 'mcp-server', stars: 50 }
            ],
            page: params.page || 1,
            total: 2
          };
        
        case 'createIssue':
          return {
            id: Date.now(),
            number: Math.floor(Math.random() * 1000),
            title: params.title,
            body: params.body,
            state: 'open',
            html_url: `https://github.com/${params.repo}/issues/${Date.now()}`
          };
        
        default:
          throw new Error(`Unknown GitHub tool: ${toolName}`);
      }
    };
  }

  private createLinearHandler(): Function {
    return async (toolName: string, params: any) => {
      switch (toolName) {
        case 'listIssues':
          return {
            issues: [
              { id: '1', title: 'Implement MCP Server', state: 'in_progress' }
            ]
          };
        
        case 'createIssue':
          return {
            id: Date.now().toString(),
            title: params.title,
            description: params.description,
            state: 'backlog'
          };
        
        default:
          throw new Error(`Unknown Linear tool: ${toolName}`);
      }
    };
  }

  private createFigmaHandler(): Function {
    return async (toolName: string, params: any) => {
      switch (toolName) {
        case 'getFile':
          return {
            name: 'Design System',
            lastModified: new Date().toISOString(),
            version: '1.0.0',
            pages: []
          };
        
        case 'exportComponents':
          return {
            components: [],
            format: params.format,
            exported: 0
          };
        
        default:
          throw new Error(`Unknown Figma tool: ${toolName}`);
      }
    };
  }

  private createZapierHandler(): Function {
    return async (toolName: string, params: any) => {
      return {
        success: true,
        tool: toolName,
        integration: 'Zapier',
        params
      };
    };
  }

  // Cleanup old rate limit entries
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimits.entries()) {
      if (entry.resetTime < now) {
        this.rateLimits.delete(key);
      }
    }
  }
}