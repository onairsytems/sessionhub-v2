import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { MCPServerConfig, MCPTool, MCPIntegration } from './types';

interface DocumentationOptions {
  mcpConfig: MCPServerConfig;
  outputPath: string;
  format: 'markdown' | 'html' | 'json';
}

export class MCPDocumentationGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MCPDocumentationGenerator');
  }

  /**
   * Generate documentation for MCP server
   */
  async generate(options: DocumentationOptions): Promise<void> {
    const { mcpConfig, outputPath, format } = options;

    this.logger.info('Generating MCP documentation:', { outputPath, format });

    try {
      // Create output directory
      await fs.mkdir(outputPath, { recursive: true });

      switch (format) {
        case 'markdown':
          await this.generateMarkdownDocs(mcpConfig, outputPath);
          break;
        case 'html':
          await this.generateHtmlDocs(mcpConfig, outputPath);
          break;
        case 'json':
          await this.generateJsonDocs(mcpConfig, outputPath);
          break;
      }

      this.logger.info('Documentation generated successfully');

    } catch (error) {
      this.logger.error('Failed to generate documentation:', error as Error);
      throw error;
    }
  }

  /**
   * Generate Markdown documentation
   */
  private async generateMarkdownDocs(
    config: MCPServerConfig,
    outputPath: string
  ): Promise<void> {
    // Generate main README
    const readmeContent = this.generateReadme(config);
    await fs.writeFile(path.join(outputPath, 'README.md'), readmeContent);

    // Generate API reference
    const apiContent = this.generateAPIReference(config);
    await fs.writeFile(path.join(outputPath, 'API.md'), apiContent);

    // Generate tool documentation
    for (const tool of config.tools) {
      const toolDoc = this.generateToolDocumentation(tool);
      await fs.writeFile(
        path.join(outputPath, `tools/${tool.name}.md`),
        toolDoc
      );
    }

    // Generate integration guides
    if (config.integrations && config.integrations.length > 0) {
      const integrationsDoc = this.generateIntegrationsDocumentation(config.integrations);
      await fs.writeFile(path.join(outputPath, 'INTEGRATIONS.md'), integrationsDoc);
    }

    // Generate configuration guide
    const configGuide = this.generateConfigurationGuide(config);
    await fs.writeFile(path.join(outputPath, 'CONFIGURATION.md'), configGuide);
  }

  /**
   * Generate main README
   */
  private generateReadme(config: MCPServerConfig): string {
    return `# ${config.name} MCP Server

${config.description || 'MCP server for enhanced development capabilities'}

## Overview

This Model Context Protocol (MCP) server provides ${config.tools.length} tools for integration with AI assistants.

## Quick Start

### Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install  # or appropriate command for your language

# Build the server
npm run build
\`\`\`

### Configuration

1. Add the server to your MCP client configuration:

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
\`\`\`

2. Restart your MCP client to load the server.

## Available Tools

${config.tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Documentation

- [API Reference](./API.md)
- [Configuration Guide](./CONFIGURATION.md)
${config.integrations && config.integrations.length > 0 ? '- [Integration Guide](./INTEGRATIONS.md)' : ''}

## Examples

### Using the \`${config.tools[0]?.name || 'example'}\` tool:

\`\`\`json
{
  "tool": "${config.tools[0]?.name || 'example'}",
  "arguments": ${JSON.stringify(config.tools[0]?.inputSchema.properties || {}, null, 2)}
}
\`\`\`

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.

---

Generated by SessionHub MCP Generator v${config.version}
`;
  }

  /**
   * Generate API reference
   */
  private generateAPIReference(config: MCPServerConfig): string {
    let content = `# API Reference

## Server Information

- **Name**: ${config.name}
- **Version**: ${config.version}
- **Protocol**: Model Context Protocol (MCP)

## Tools

`;

    for (const tool of config.tools) {
      content += `### ${tool.name}

${tool.description}

#### Input Schema

\`\`\`json
${JSON.stringify(tool.inputSchema, null, 2)}
\`\`\`

#### Example Request

\`\`\`json
{
  "tool": "${tool.name}",
  "arguments": ${this.generateExampleArguments(tool.inputSchema)}
}
\`\`\`

#### Example Response

\`\`\`json
{
  "content": [
    {
      "type": "text",
      "text": "Operation completed successfully"
    }
  ]
}
\`\`\`

---

`;
    }

    if (config.resources && config.resources.length > 0) {
      content += `## Resources

`;
      for (const resource of config.resources) {
        content += `### ${resource.name}

- **URI**: ${resource.uri}
- **Description**: ${resource.description || 'N/A'}
- **MIME Type**: ${resource.mimeType || 'N/A'}

`;
      }
    }

    if (config.prompts && config.prompts.length > 0) {
      content += `## Prompts

`;
      for (const prompt of config.prompts) {
        content += `### ${prompt.name}

${prompt.description || 'N/A'}

**Arguments**:
${prompt.arguments?.map(arg => `- **${arg.name}**: ${arg.description || 'N/A'}${arg.required ? ' (required)' : ''}`).join('\n') || 'None'}

`;
      }
    }

    return content;
  }

  /**
   * Generate tool documentation
   */
  private generateToolDocumentation(tool: MCPTool): string {
    return `# ${tool.name}

## Description

${tool.description}

## Input Schema

\`\`\`json
${JSON.stringify(tool.inputSchema, null, 2)}
\`\`\`

## Parameters

${this.generateParameterDocumentation(tool.inputSchema)}

## Examples

### Basic Usage

\`\`\`json
{
  "tool": "${tool.name}",
  "arguments": ${this.generateExampleArguments(tool.inputSchema)}
}
\`\`\`

### Advanced Usage

${this.generateAdvancedExamples(tool)}

## Error Handling

The tool will return an error in the following cases:

${this.generateErrorCases(tool.inputSchema)}

## Best Practices

${this.generateBestPractices(tool)}
`;
  }

  /**
   * Generate integrations documentation
   */
  private generateIntegrationsDocumentation(integrations: MCPIntegration[]): string {
    let content = `# Integration Guide

## Available Integrations

`;

    for (const integration of integrations) {
      content += `### ${integration.name}

**Type**: ${integration.type}

#### Configuration

\`\`\`json
${JSON.stringify(integration.config, null, 2)}
\`\`\`

#### Setup Instructions

${this.generateIntegrationSetup(integration)}

#### Usage Examples

${this.generateIntegrationExamples(integration)}

---

`;
    }

    return content;
  }

  /**
   * Generate configuration guide
   */
  private generateConfigurationGuide(config: MCPServerConfig): string {
    return `# Configuration Guide

## Server Configuration

The MCP server can be configured through the \`mcp.config.json\` file:

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

## Environment Variables

The following environment variables can be used to configure the server:

- \`MCP_SERVER_PORT\`: Port for the server (if applicable)
- \`MCP_LOG_LEVEL\`: Logging level (debug, info, warn, error)
- \`MCP_TIMEOUT\`: Request timeout in milliseconds

## Client Configuration

### Claude Desktop

Add to your Claude configuration:

\`\`\`json
{
  "mcpServers": {
    "${config.name}": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
\`\`\`

### Other MCP Clients

Refer to your MCP client's documentation for specific configuration instructions.

## Advanced Configuration

### Custom Tool Settings

Tools can be configured with additional settings:

\`\`\`json
{
  "tools": {
    "toolName": {
      "timeout": 30000,
      "retries": 3,
      "customOption": "value"
    }
  }
}
\`\`\`

### Security Configuration

Configure security settings:

\`\`\`json
{
  "security": {
    "allowedOrigins": ["*"],
    "apiKeyRequired": false,
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
\`\`\`
`;
  }

  /**
   * Generate HTML documentation
   */
  private async generateHtmlDocs(
    config: MCPServerConfig,
    outputPath: string
  ): Promise<void> {
    // Generate a simple HTML documentation
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name} - MCP Server Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2c3e50; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .tool { border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 5px; }
        .parameter { margin-left: 20px; }
    </style>
</head>
<body>
    <h1>${config.name}</h1>
    <p>${config.description || 'MCP server for enhanced development capabilities'}</p>
    
    <h2>Available Tools</h2>
    ${config.tools.map(tool => `
    <div class="tool">
        <h3>${tool.name}</h3>
        <p>${tool.description}</p>
        <h4>Input Schema</h4>
        <pre><code>${JSON.stringify(tool.inputSchema, null, 2)}</code></pre>
    </div>
    `).join('')}
</body>
</html>`;

    await fs.writeFile(path.join(outputPath, 'index.html'), htmlContent);
  }

  /**
   * Generate JSON documentation
   */
  private async generateJsonDocs(
    config: MCPServerConfig,
    outputPath: string
  ): Promise<void> {
    const jsonDoc = {
      server: {
        name: config.name,
        version: config.version,
        description: config.description
      },
      tools: config.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        examples: this.generateExampleArguments(tool.inputSchema, true)
      })),
      integrations: config.integrations,
      resources: config.resources,
      prompts: config.prompts
    };

    await fs.writeFile(
      path.join(outputPath, 'documentation.json'),
      JSON.stringify(jsonDoc, null, 2)
    );
  }

  // Helper methods
  private generateExampleArguments(schema: any, parse = false): string {
    const example: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        if (prop.type === 'string') {
          example[key] = prop.description || 'example string';
        } else if (prop.type === 'number') {
          example[key] = 42;
        } else if (prop.type === 'boolean') {
          example[key] = true;
        } else if (prop.type === 'object') {
          example[key] = {};
        } else if (prop.type === 'array') {
          example[key] = [];
        }
      }
    }

    return parse ? example : JSON.stringify(example, null, 2);
  }

  private generateParameterDocumentation(schema: any): string {
    if (!schema.properties) return 'No parameters required.';

    let doc = '';
    for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
      const required = schema.required?.includes(key) ? ' **(required)**' : '';
      doc += `- **${key}**${required}: ${prop.description || 'No description'} (${prop.type})\n`;
    }
    return doc;
  }

  private generateAdvancedExamples(tool: MCPTool): string {
    // Generate more complex examples based on tool type
    return `\`\`\`json
{
  "tool": "${tool.name}",
  "arguments": {
    // Complex example with all parameters
    ${Object.entries(tool.inputSchema.properties || {})
      .map(([key]) => `"${key}": "advanced value"`)
      .join(',\n    ')}
  }
}
\`\`\``;
  }

  private generateErrorCases(schema: any): string {
    let cases = '- Missing required parameters\n';
    cases += '- Invalid parameter types\n';
    cases += '- Out of range values\n';
    
    if (schema.required && schema.required.length > 0) {
      cases += `- Missing any of: ${schema.required.join(', ')}\n`;
    }
    
    return cases;
  }

  private generateBestPractices(_tool: MCPTool): string {
    return `1. Always validate input parameters before calling the tool
2. Handle errors gracefully and provide meaningful error messages
3. Use appropriate timeout values for long-running operations
4. Consider rate limiting for resource-intensive tools
5. Log tool usage for debugging and monitoring`;
  }

  private generateIntegrationSetup(integration: MCPIntegration): string {
    const setupSteps: Record<string, string> = {
      'openai': '1. Set OPENAI_API_KEY environment variable\n2. Configure model preferences in config',
      'github': '1. Create GitHub personal access token\n2. Set GITHUB_TOKEN environment variable',
      'aws': '1. Configure AWS credentials\n2. Set AWS_REGION environment variable',
      'database': '1. Set database connection string\n2. Configure connection pool settings'
    };

    return setupSteps[integration.type] || '1. Configure integration-specific settings\n2. Set required environment variables';
  }

  private generateIntegrationExamples(integration: MCPIntegration): string {
    return `\`\`\`javascript
// Example usage with ${integration.name}
const result = await callTool({
  tool: 'integrated_tool_name',
  arguments: {
    integration: '${integration.name}',
    // Tool-specific arguments
  }
});
\`\`\``;
  }
}