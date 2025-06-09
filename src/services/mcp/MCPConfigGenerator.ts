import { Logger } from '../../lib/logging/Logger';
import { 
  MCPServerConfig, 
  MCPTool, 
  MCPIntegration,
  ProjectAnalysis,
  SupportedLanguage,
  APIEndpoint,
  DatabaseSchema
} from './types';

interface ConfigGenerationOptions {
  projectPath: string;
  language: SupportedLanguage;
  projectAnalysis: ProjectAnalysis;
  customTools?: MCPTool[];
  integrations?: string[];
}

export class MCPConfigGenerator {
  private logger: Logger;
  private availableIntegrations: string[] = [
    'openai',
    'anthropic',
    'github',
    'gitlab',
    'stripe',
    'paypal',
    'aws',
    'gcp',
    'azure',
    'vercel',
    'netlify',
    'docker',
    'kubernetes',
    'postgres',
    'mysql',
    'mongodb',
    'redis',
    'elasticsearch',
    'slack',
    'discord',
    'zapier'
  ];

  constructor() {
    this.logger = new Logger('MCPConfigGenerator');
  }

  /**
   * Generate MCP configuration based on project analysis
   */
  async generate(options: ConfigGenerationOptions): Promise<MCPServerConfig> {
    const { projectPath, language, projectAnalysis, customTools = [], integrations = [] } = options;

    this.logger.info('Generating MCP configuration for:', { projectPath, language });

    // Generate base configuration
    const config: MCPServerConfig = {
      name: this.generateProjectName(projectPath),
      version: '1.0.0',
      description: `MCP server for ${path.basename(projectPath)} (${language} project)`,
      tools: [],
      integrations: [],
      resources: [],
      prompts: []
    };

    // Generate tools from API endpoints
    if (projectAnalysis.apiEndpoints && projectAnalysis.apiEndpoints.length > 0) {
      const apiTools = this.generateToolsFromAPI(projectAnalysis.apiEndpoints);
      config.tools.push(...apiTools);
    }

    // Generate tools from database schemas
    if (projectAnalysis.databaseSchemas && projectAnalysis.databaseSchemas.length > 0) {
      const dbTools = this.generateToolsFromDatabase(projectAnalysis.databaseSchemas);
      config.tools.push(...dbTools);
    }

    // Add custom tools
    config.tools.push(...customTools);

    // Generate standard project tools
    const standardTools = this.generateStandardTools(language, projectAnalysis);
    config.tools.push(...standardTools);

    // Configure integrations
    const configuredIntegrations = this.configureIntegrations(integrations, projectAnalysis);
    config.integrations = configuredIntegrations;

    // Generate resources
    config.resources = this.generateResources(projectAnalysis);

    // Generate prompts
    config.prompts = this.generatePrompts(language, projectAnalysis);

    this.logger.info('Generated MCP configuration:', config);
    return config;
  }

  /**
   * Generate tools from API endpoints
   */
  private generateToolsFromAPI(endpoints: APIEndpoint[]): MCPTool[] {
    return endpoints.map(endpoint => ({
      name: this.generateToolName(endpoint.path, endpoint.method),
      description: endpoint.description || `${endpoint.method} ${endpoint.path}`,
      inputSchema: {
        type: 'object',
        properties: this.generateParameterSchema(endpoint.parameters),
        required: this.getRequiredParameters(endpoint.parameters)
      },
      handler: `handle${this.toPascalCase(this.generateToolName(endpoint.path, endpoint.method))}`
    }));
  }

  /**
   * Generate tools from database schemas
   */
  private generateToolsFromDatabase(schemas: DatabaseSchema[]): MCPTool[] {
    const tools: MCPTool[] = [];

    for (const schema of schemas) {
      for (const table of schema.tables) {
        // Generate CRUD tools for each table
        tools.push(
          {
            name: `query_${table.name}`,
            description: `Query records from ${table.name} table`,
            inputSchema: {
              type: 'object',
              properties: {
                where: { type: 'object', description: 'Query conditions' },
                limit: { type: 'number', description: 'Maximum number of records' },
                offset: { type: 'number', description: 'Number of records to skip' },
                orderBy: { type: 'string', description: 'Field to order by' }
              }
            }
          },
          {
            name: `create_${table.name}`,
            description: `Create a new record in ${table.name} table`,
            inputSchema: {
              type: 'object',
              properties: this.generateTableSchema(table),
              required: this.getRequiredColumns(table)
            }
          },
          {
            name: `update_${table.name}`,
            description: `Update records in ${table.name} table`,
            inputSchema: {
              type: 'object',
              properties: {
                where: { type: 'object', description: 'Query conditions', required: true },
                data: { type: 'object', properties: this.generateTableSchema(table) }
              },
              required: ['where', 'data']
            }
          },
          {
            name: `delete_${table.name}`,
            description: `Delete records from ${table.name} table`,
            inputSchema: {
              type: 'object',
              properties: {
                where: { type: 'object', description: 'Query conditions' }
              },
              required: ['where']
            }
          }
        );
      }
    }

    return tools;
  }

  /**
   * Generate standard tools based on language and project type
   */
  private generateStandardTools(_language: SupportedLanguage, analysis: ProjectAnalysis): MCPTool[] {
    const tools: MCPTool[] = [];

    // File system tools
    tools.push(
      {
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write contents to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to project root' },
            content: { type: 'string', description: 'File content' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to project root' }
          },
          required: ['path']
        }
      }
    );

    // Build/run tools based on detected build system
    if (analysis.buildTools && analysis.buildTools.length > 0) {
      tools.push({
        name: 'run_build',
        description: 'Build the project',
        inputSchema: {
          type: 'object',
          properties: {
            target: { type: 'string', description: 'Build target (optional)' }
          }
        }
      });
    }

    // Test tools if test framework detected
    if (analysis.testFrameworks && analysis.testFrameworks.length > 0) {
      tools.push({
        name: 'run_tests',
        description: 'Run project tests',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Test file pattern (optional)' },
            watch: { type: 'boolean', description: 'Run in watch mode' }
          }
        }
      });
    }

    return tools;
  }

  /**
   * Configure integrations based on project dependencies
   */
  private configureIntegrations(
    requestedIntegrations: string[],
    analysis: ProjectAnalysis
  ): MCPIntegration[] {
    const integrations: MCPIntegration[] = [];

    // Auto-detect integrations from dependencies
    const detectedIntegrations = this.detectIntegrations(analysis.dependencies);
    const allIntegrations = [...new Set([...requestedIntegrations, ...detectedIntegrations])];

    for (const integration of allIntegrations) {
      if (this.availableIntegrations.includes(integration)) {
        integrations.push({
          name: integration,
          type: this.getIntegrationType(integration),
          config: this.getIntegrationConfig(integration, analysis)
        });
      }
    }

    return integrations;
  }

  /**
   * Generate resources based on project structure
   */
  private generateResources(analysis: ProjectAnalysis): any[] {
    const resources: any[] = [];

    // Add source directories as resources
    for (const srcDir of analysis.structure.sourceDirectories) {
      resources.push({
        uri: `file://${srcDir}`,
        name: path.basename(srcDir),
        description: `Source directory`,
        mimeType: 'text/directory'
      });
    }

    // Add config files as resources
    for (const configFile of analysis.structure.configFiles) {
      resources.push({
        uri: `file://${configFile}`,
        name: path.basename(configFile),
        description: `Configuration file`,
        mimeType: this.getMimeType(configFile)
      });
    }

    return resources;
  }

  /**
   * Generate prompts for common tasks
   */
  private generatePrompts(_language: SupportedLanguage, _analysis: ProjectAnalysis): any[] {
    return [
      {
        name: 'analyze_code',
        description: 'Analyze code quality and suggest improvements',
        arguments: [
          { name: 'file_path', description: 'Path to file to analyze', required: true }
        ]
      },
      {
        name: 'generate_documentation',
        description: 'Generate documentation for code',
        arguments: [
          { name: 'file_path', description: 'Path to file to document', required: true },
          { name: 'format', description: 'Documentation format (markdown, jsdoc, etc.)' }
        ]
      },
      {
        name: 'refactor_code',
        description: 'Suggest refactoring improvements',
        arguments: [
          { name: 'file_path', description: 'Path to file to refactor', required: true },
          { name: 'pattern', description: 'Refactoring pattern to apply' }
        ]
      }
    ];
  }

  // Helper methods
  private generateProjectName(projectPath: string): string {
    return path.basename(projectPath).replace(/[^a-zA-Z0-9]/g, '_');
  }

  private generateToolName(path: string, method: string): string {
    const cleanPath = path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
    return `${method.toLowerCase()}_${cleanPath}`;
  }

  private toPascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private generateParameterSchema(parameters: any): Record<string, any> {
    if (!parameters) return {};
    // TODO: Implement parameter schema generation
    return {};
  }

  private getRequiredParameters(parameters: any): string[] {
    if (!parameters) return [];
    // TODO: Implement required parameter detection
    return [];
  }

  private generateTableSchema(table: any): Record<string, any> {
    const schema: Record<string, any> = {};
    for (const column of table.columns) {
      schema[column.name] = {
        type: this.mapDatabaseType(column.type),
        description: `${column.name} field`
      };
    }
    return schema;
  }

  private getRequiredColumns(table: any): string[] {
    return table.columns
      .filter((col: any) => !col.nullable && !col.primaryKey)
      .map((col: any) => col.name);
  }

  private mapDatabaseType(dbType: string): string {
    const typeMap: Record<string, string> = {
      'varchar': 'string',
      'text': 'string',
      'int': 'number',
      'integer': 'number',
      'float': 'number',
      'double': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'date': 'string',
      'datetime': 'string',
      'timestamp': 'string',
      'json': 'object',
      'jsonb': 'object'
    };
    return typeMap[dbType.toLowerCase()] || 'string';
  }

  private detectIntegrations(dependencies: string[]): string[] {
    const integrations: string[] = [];
    const dependencyMap: Record<string, string> = {
      'openai': 'openai',
      '@anthropic-ai': 'anthropic',
      'stripe': 'stripe',
      'aws-sdk': 'aws',
      '@google-cloud': 'gcp',
      'azure': 'azure',
      'pg': 'postgres',
      'mysql': 'mysql',
      'mongodb': 'mongodb',
      'redis': 'redis'
    };

    for (const dep of dependencies) {
      for (const [key, integration] of Object.entries(dependencyMap)) {
        if (dep.includes(key)) {
          integrations.push(integration);
        }
      }
    }

    return integrations;
  }

  private getIntegrationType(integration: string): string {
    const typeMap: Record<string, string> = {
      'openai': 'ai',
      'anthropic': 'ai',
      'github': 'vcs',
      'gitlab': 'vcs',
      'stripe': 'payment',
      'paypal': 'payment',
      'aws': 'cloud',
      'gcp': 'cloud',
      'azure': 'cloud',
      'postgres': 'database',
      'mysql': 'database',
      'mongodb': 'database',
      'redis': 'cache',
      'elasticsearch': 'search',
      'slack': 'communication',
      'discord': 'communication',
      'zapier': 'automation'
    };
    return typeMap[integration] || 'other';
  }

  private getIntegrationConfig(integration: string, analysis: ProjectAnalysis): Record<string, any> {
    // Generate integration-specific configuration
    const config: Record<string, any> = {};

    // Check for environment variables
    if (analysis.environmentVariables) {
      const relevantVars = analysis.environmentVariables.filter(v => 
        v.toUpperCase().includes(integration.toUpperCase())
      );
      if (relevantVars.length > 0) {
        config['environmentVariables'] = relevantVars;
      }
    }

    return config;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.xml': 'application/xml',
      '.toml': 'text/toml',
      '.ini': 'text/ini',
      '.env': 'text/plain'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  getAvailableIntegrations(): string[] {
    return this.availableIntegrations;
  }
}

// Import path module
import * as path from 'path';