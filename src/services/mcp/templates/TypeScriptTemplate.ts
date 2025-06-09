import { LanguageTemplate } from '../types';

export class TypeScriptTemplate implements LanguageTemplate {
  language = 'typescript' as const;
  fileExtension = 'ts';
  buildCommand = 'npm run build';
  runCommand = 'npm start';

  serverTemplate = `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

// Tool handlers
{{#tools}}
import { handle{{toPascalCase(name)}} } from './tools/{{name}}';
{{/tools}}

const server = new Server(
  {
    name: '{{name}}',
    version: '{{version}}'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {{#tools}}
      {
        name: '{{name}}',
        description: '{{description}}',
        inputSchema: {{JSON.stringify(inputSchema)}}
      },
      {{/tools}}
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      {{#tools}}
      case '{{name}}':
        return await handle{{toPascalCase(name)}}(args);
      {{/tools}}
      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: \`Error: \${error.message}\`
        }
      ]
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('{{name}} MCP server running on stdio');
}

main().catch(console.error);
`;

  toolTemplate = `import { ToolResult } from '@modelcontextprotocol/sdk/types.js';

export async function handle{{toPascalCase(tool.name)}}(args: any): Promise<ToolResult> {
  try {
    // TODO: Implement {{tool.name}} tool logic
    
    return {
      content: [
        {
          type: 'text',
          text: '{{tool.name}} executed successfully'
        }
      ]
    };
  } catch (error) {
    throw new Error(\`Failed to execute {{tool.name}}: \${error.message}\`);
  }
}
`;

  testTemplate = `import { describe, it, expect, jest } from '@jest/globals';
import { handle{{toPascalCase(tool.name)}} } from '../tools/{{tool.name}}';

describe('{{tool.name}} tool', () => {
  it('should execute successfully', async () => {
    const args = {
      // TODO: Add test arguments
    };

    const result = await handle{{toPascalCase(tool.name)}}(args);
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  it('should handle errors gracefully', async () => {
    const args = {
      // Invalid arguments
    };

    await expect(handle{{toPascalCase(tool.name)}}(args)).rejects.toThrow();
  });
});
`;

  configTemplate = `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "tools": {{JSON.stringify(tools, null, 2)}},
  "integrations": {{JSON.stringify(integrations, null, 2)}}
}
`;

  packageTemplate = `{
  "name": "{{name}}-mcp-server",
  "version": "{{version}}",
  "description": "{{description}}",
  "main": "dist/server.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx src/server.ts",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
`;
}