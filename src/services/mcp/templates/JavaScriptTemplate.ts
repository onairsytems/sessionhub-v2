import { LanguageTemplate } from '../types';

export class JavaScriptTemplate implements LanguageTemplate {
  language = 'javascript' as const;
  fileExtension = 'js';
  buildCommand = 'npm install';
  runCommand = 'npm start';

  serverTemplate = `#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';

// Tool handlers
{{#tools}}
import { handle{{toPascalCase(name)}} } from './tools/{{name}}.js';
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

// Register tool list handler
server.setRequestHandler('tools/list', async () => {
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

// Register tool call handler
server.setRequestHandler('tools/call', async (request) => {
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
// REMOVED: console statement
}

main().catch(console.error);
`;

  toolTemplate = `/**
 * {{tool.name}} tool handler
 */

export async function handle{{toPascalCase(tool.name)}}(args) {
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
import { handle{{toPascalCase(tool.name)}} } from '../tools/{{tool.name}}.js';

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
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "jest",
    "lint": "eslint . --ext .js",
    "format": "prettier --write '**/*.js'"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "devDependencies": {
    "eslint": "^8.0.0",
    "jest": "^29.0.0",
    "prettier": "^3.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
`;
}