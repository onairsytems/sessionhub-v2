/**
 * MCP Integration SDK
 * 
 * Developer SDK for creating custom MCP integrations
 */

import { 
  MCPIntegration, 
  MCPTool, 
  MCPPermission,
  MCPIntegrationCategory,
  MCPSchema,
  MCPExecutionContext,
  MCPExecutionResult
} from '../server/types';

export interface IntegrationBuilder {
  setName(name: string): IntegrationBuilder;
  setVersion(version: string): IntegrationBuilder;
  setDescription(description: string): IntegrationBuilder;
  setAuthor(author: string): IntegrationBuilder;
  setCategory(category: MCPIntegrationCategory): IntegrationBuilder;
  setIcon(icon: string): IntegrationBuilder;
  addTool(tool: MCPTool): IntegrationBuilder;
  addPermission(permission: MCPPermission): IntegrationBuilder;
  setConfig(config: any): IntegrationBuilder;
  build(): MCPIntegration;
}

export interface ToolBuilder {
  setName(name: string): ToolBuilder;
  setDescription(description: string): ToolBuilder;
  setInputSchema(schema: MCPSchema): ToolBuilder;
  setOutputSchema(schema: MCPSchema): ToolBuilder;
  addExample(name: string, input: any, output: any): ToolBuilder;
  setRateLimit(requests: number, windowInSeconds: number): ToolBuilder;
  build(): MCPTool;
}

export class MCPIntegrationSDK {
  /**
   * Create a new integration builder
   */
  static createIntegration(): IntegrationBuilder {
    let integration: Partial<MCPIntegration> = {
      tools: [],
      permissions: []
    };

    const builder: IntegrationBuilder = {
      setName(name: string) {
        integration.name = name;
        return builder;
      },
      
      setVersion(version: string) {
        integration.version = version;
        return builder;
      },
      
      setDescription(description: string) {
        integration.description = description;
        return builder;
      },
      
      setAuthor(author: string) {
        integration.author = author;
        return builder;
      },
      
      setCategory(category: MCPIntegrationCategory) {
        integration.category = category;
        return builder;
      },
      
      setIcon(icon: string) {
        integration.icon = icon;
        return builder;
      },
      
      addTool(tool: MCPTool) {
        integration.tools!.push(tool);
        return builder;
      },
      
      addPermission(permission: MCPPermission) {
        if (!integration.permissions!.includes(permission)) {
          integration.permissions!.push(permission);
        }
        return builder;
      },
      
      setConfig(config: any) {
        integration.config = config;
        return builder;
      },
      
      build(): MCPIntegration {
        if (!integration.name || !integration.version || !integration.description || !integration.author) {
          throw new Error('Missing required fields: name, version, description, or author');
        }
        
        if (!integration.tools || integration.tools.length === 0) {
          throw new Error('At least one tool is required');
        }
        
        return integration as MCPIntegration;
      }
    };

    return builder;
  }

  /**
   * Create a new tool builder
   */
  static createTool(): ToolBuilder {
    let tool: Partial<MCPTool> = {
      inputSchema: { type: 'object', properties: {} },
      examples: []
    };

    const builder: ToolBuilder = {
      setName(name: string) {
        tool.name = name;
        return builder;
      },
      
      setDescription(description: string) {
        tool.description = description;
        return builder;
      },
      
      setInputSchema(schema: MCPSchema) {
        tool.inputSchema = schema;
        return builder;
      },
      
      setOutputSchema(schema: MCPSchema) {
        tool.outputSchema = schema;
        return builder;
      },
      
      addExample(name: string, input: any, output: any) {
        if (!tool.examples) tool.examples = [];
        tool.examples.push({ name, input, output });
        return builder;
      },
      
      setRateLimit(requests: number, windowInSeconds: number) {
        tool.rateLimit = { requests, window: windowInSeconds };
        return builder;
      },
      
      build(): MCPTool {
        if (!tool.name || !tool.description) {
          throw new Error('Missing required fields: name or description');
        }
        
        return tool as MCPTool;
      }
    };

    return builder;
  }

  /**
   * Schema builder helpers
   */
  static schema = {
    object(properties: Record<string, any>, required?: string[]): MCPSchema {
      return {
        type: 'object',
        properties,
        required
      };
    },
    
    array(items: MCPSchema): MCPSchema {
      return {
        type: 'array',
        items
      };
    },
    
    string(description?: string, enumValues?: string[], pattern?: string): any {
      const schema: any = { type: 'string' };
      if (description) schema.description = description;
      if (enumValues) schema.enum = enumValues;
      if (pattern) schema.pattern = pattern;
      return schema;
    },
    
    number(description?: string, min?: number, max?: number): any {
      const schema: any = { type: 'number' };
      if (description) schema.description = description;
      if (min !== undefined) schema.minimum = min;
      if (max !== undefined) schema.maximum = max;
      return schema;
    },
    
    boolean(description?: string): any {
      const schema: any = { type: 'boolean' };
      if (description) schema.description = description;
      return schema;
    }
  };

  /**
   * Test harness for integration development
   */
  static createTestHarness(integration: MCPIntegration) {
    return {
      async testTool(toolName: string, params: any): Promise<MCPExecutionResult> {
        const tool = integration.tools.find(t => t.name === toolName);
        if (!tool) {
          throw new Error(`Tool not found: ${toolName}`);
        }

        // Simulate execution
        const context: MCPExecutionContext = {
          integrationId: integration.id || 'test',
          tool: toolName,
          params,
          timestamp: Date.now()
        };

        try {
          // Here you would implement the actual tool logic
          const result = await this.executeToolLogic(tool, params);
          
          return {
            success: true,
            data: result,
            metrics: {
              startTime: context.timestamp,
              endTime: Date.now(),
              duration: Date.now() - context.timestamp
            }
          };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: 'EXECUTION_ERROR',
              message: error.message
            }
          };
        }
      },

      async executeToolLogic(tool: MCPTool, params: any): Promise<any> {
        // This is where the actual tool implementation would go
        // For testing, return mock data
        return {
          tool: tool.name,
          params,
          result: 'Mock result'
        };
      }
    };
  }

  /**
   * Validation helpers
   */
  static validate = {
    integration(integration: MCPIntegration): string[] {
      const errors: string[] = [];
      
      if (!integration.name) errors.push('Name is required');
      if (!integration.version) errors.push('Version is required');
      if (!integration.description) errors.push('Description is required');
      if (!integration.author) errors.push('Author is required');
      if (!integration.tools || integration.tools.length === 0) {
        errors.push('At least one tool is required');
      }
      
      // Validate version format
      if (integration.version && !/^\d+\.\d+\.\d+$/.test(integration.version)) {
        errors.push('Version must be in semver format (e.g., 1.0.0)');
      }
      
      // Validate tools
      integration.tools?.forEach((tool, index) => {
        const toolErrors = this.tool(tool);
        toolErrors.forEach(error => errors.push(`Tool ${index}: ${error}`));
      });
      
      return errors;
    },
    
    tool(tool: MCPTool): string[] {
      const errors: string[] = [];
      
      if (!tool.name) errors.push('Name is required');
      if (!tool.description) errors.push('Description is required');
      if (!tool.inputSchema) errors.push('Input schema is required');
      
      // Validate schema
      if (tool.inputSchema) {
        const schemaErrors = this.schema(tool.inputSchema);
        schemaErrors.forEach(error => errors.push(`Input schema: ${error}`));
      }
      
      return errors;
    },
    
    schema(schema: MCPSchema): string[] {
      const errors: string[] = [];
      
      if (!schema.type) errors.push('Type is required');
      
      if (schema.type === 'object' && schema.required) {
        // Check that required fields exist in properties
        schema.required.forEach(field => {
          if (!schema.properties || !(field in schema.properties)) {
            errors.push(`Required field "${field}" not found in properties`);
          }
        });
      }
      
      return errors;
    }
  };
}

// Example usage:
/*
const myIntegration = MCPIntegrationSDK.createIntegration()
  .setName('My Custom Integration')
  .setVersion('1.0.0')
  .setDescription('A custom integration for demonstration')
  .setAuthor('John Doe')
  .setCategory('automation')
  .setIcon('🚀')
  .addPermission('network')
  .addTool(
    MCPIntegrationSDK.createTool()
      .setName('doSomething')
      .setDescription('Does something useful')
      .setInputSchema(
        MCPIntegrationSDK.schema.object({
          message: MCPIntegrationSDK.schema.string('The message to process'),
          count: MCPIntegrationSDK.schema.number('Number of times to process', 1, 10)
        }, ['message'])
      )
      .setRateLimit(100, 60)
      .build()
  )
  .build();

// Validate the integration
const errors = MCPIntegrationSDK.validate.integration(myIntegration);
if (errors.length > 0) {
// REMOVED: console statement
}

// Test the integration
const harness = MCPIntegrationSDK.createTestHarness(myIntegration);
const result = await harness.testTool('doSomething', { message: 'Hello', count: 3 });
// REMOVED: console statement
*/