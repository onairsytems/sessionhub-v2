import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { MCPServerConfig, MCPTool, SupportedLanguage } from './types';

interface TestGenerationOptions {
  mcpConfig: MCPServerConfig;
  language: SupportedLanguage;
  outputPath: string;
}

interface TestCase {
  name: string;
  description: string;
  tool: string;
  input: any;
  expectedOutput?: any;
  expectError?: boolean;
}

export class MCPTestGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MCPTestGenerator');
  }

  /**
   * Generate tests for MCP server
   */
  async generate(options: TestGenerationOptions): Promise<void> {
    const { mcpConfig, language, outputPath } = options;

    this.logger.info('Generating MCP tests:', { language, outputPath });

    try {
      // Create test directory
      await fs.mkdir(outputPath, { recursive: true });

      // Generate test cases for each tool
      const testCases = this.generateTestCases(mcpConfig);

      // Generate test files based on language
      switch (language) {
        case 'typescript':
        case 'javascript':
          await this.generateJavaScriptTests(mcpConfig, testCases, outputPath, language);
          break;
        case 'python':
          await this.generatePythonTests(mcpConfig, testCases, outputPath);
          break;
        case 'go':
          await this.generateGoTests(mcpConfig, testCases, outputPath);
          break;
        case 'rust':
          await this.generateRustTests(mcpConfig, testCases, outputPath);
          break;
        case 'java':
          await this.generateJavaTests(mcpConfig, testCases, outputPath);
          break;
        default:
          this.logger.warn(`Test generation not yet implemented for ${language}`);
      }

      // Generate integration tests
      await this.generateIntegrationTests(mcpConfig, outputPath, language);

      // Generate test runner configuration
      await this.generateTestConfig(mcpConfig, outputPath, language);

      this.logger.info('Tests generated successfully');

    } catch (error) {
      this.logger.error('Failed to generate tests:', error as Error);
      throw error;
    }
  }

  /**
   * Generate test cases for all tools
   */
  private generateTestCases(config: MCPServerConfig): TestCase[] {
    const testCases: TestCase[] = [];

    for (const tool of config.tools) {
      // Generate success test cases
      testCases.push(...this.generateSuccessTestCases(tool));

      // Generate error test cases
      testCases.push(...this.generateErrorTestCases(tool));

      // Generate edge case tests
      testCases.push(...this.generateEdgeCaseTests(tool));
    }

    return testCases;
  }

  /**
   * Generate success test cases
   */
  private generateSuccessTestCases(tool: MCPTool): TestCase[] {
    const cases: TestCase[] = [];

    // Basic success case
    cases.push({
      name: `${tool.name}_success_basic`,
      description: `Test ${tool.name} with valid basic input`,
      tool: tool.name,
      input: this.generateValidInput(tool.inputSchema),
      expectedOutput: {
        content: [{
          type: 'text',
          text: expect.stringContaining('success')
        }]
      }
    });

    // With all optional parameters
    if (this.hasOptionalParameters(tool.inputSchema)) {
      cases.push({
        name: `${tool.name}_success_all_params`,
        description: `Test ${tool.name} with all parameters`,
        tool: tool.name,
        input: this.generateCompleteInput(tool.inputSchema),
        expectedOutput: {
          content: [{
            type: 'text',
            text: expect.any(String)
          }]
        }
      });
    }

    return cases;
  }

  /**
   * Generate error test cases
   */
  private generateErrorTestCases(tool: MCPTool): TestCase[] {
    const cases: TestCase[] = [];

    // Missing required parameters
    if (tool.inputSchema.required && tool.inputSchema.required.length > 0) {
      cases.push({
        name: `${tool.name}_error_missing_required`,
        description: `Test ${tool.name} with missing required parameters`,
        tool: tool.name,
        input: {},
        expectError: true
      });
    }

    // Invalid parameter types
    cases.push({
      name: `${tool.name}_error_invalid_types`,
      description: `Test ${tool.name} with invalid parameter types`,
      tool: tool.name,
      input: this.generateInvalidTypeInput(tool.inputSchema),
      expectError: true
    });

    return cases;
  }

  /**
   * Generate edge case tests
   */
  private generateEdgeCaseTests(tool: MCPTool): TestCase[] {
    const cases: TestCase[] = [];

    // Empty strings for string parameters
    const stringParams = this.getStringParameters(tool.inputSchema);
    if (stringParams.length > 0) {
      const input = this.generateValidInput(tool.inputSchema);
      stringParams.forEach(param => {
        input[param] = '';
      });

      cases.push({
        name: `${tool.name}_edge_empty_strings`,
        description: `Test ${tool.name} with empty string values`,
        tool: tool.name,
        input,
        expectError: false
      });
    }

    // Large values
    cases.push({
      name: `${tool.name}_edge_large_values`,
      description: `Test ${tool.name} with large input values`,
      tool: tool.name,
      input: this.generateLargeInput(tool.inputSchema),
      expectError: false
    });

    return cases;
  }

  /**
   * Generate JavaScript/TypeScript tests
   */
  private async generateJavaScriptTests(
    config: MCPServerConfig,
    testCases: TestCase[],
    outputPath: string,
    language: 'typescript' | 'javascript'
  ): Promise<void> {
    const ext = language === 'typescript' ? 'ts' : 'js';
    const importPath = language === 'typescript' ? '../src/server' : '../server';

    // Generate main test suite
    const testContent = `import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPTestClient } from './helpers/test-client';
import { spawn } from 'child_process';
import path from 'path';

describe('${config.name} MCP Server', () => {
  let client: MCPTestClient;
  let serverProcess: any;

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('node', [path.join(__dirname, '${importPath}.${ext === 'ts' ? 'js' : ext}')]);
    
    // Initialize test client
    client = new MCPTestClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    serverProcess.kill();
  });

  describe('Server Connection', () => {
    it('should connect successfully', async () => {
      const info = await client.getServerInfo();
      expect(info.name).toBe('${config.name}');
      expect(info.version).toBe('${config.version}');
    });

    it('should list all tools', async () => {
      const tools = await client.listTools();
      expect(tools).toHaveLength(${config.tools.length});
      ${config.tools.map(tool => `expect(tools).toContainEqual(expect.objectContaining({ name: '${tool.name}' }));`).join('\n      ')}
    });
  });

${this.generateJestTestCases(testCases)}
});`;

    await fs.writeFile(path.join(outputPath, `server.test.${ext}`), testContent);

    // Generate test client helper
    await this.generateTestClient(outputPath, language);
  }

  /**
   * Generate Jest test cases
   */
  private generateJestTestCases(testCases: TestCase[]): string {
    const groupedCases = this.groupTestCasesByTool(testCases);
    let content = '';

    for (const [tool, cases] of Object.entries(groupedCases)) {
      content += `
  describe('Tool: ${tool}', () => {
${cases.map(testCase => `
    it('${testCase.description}', async () => {
      ${testCase.expectError ? `
      await expect(client.callTool('${testCase.tool}', ${JSON.stringify(testCase.input)}))
        .rejects.toThrow();` : `
      const result = await client.callTool('${testCase.tool}', ${JSON.stringify(testCase.input)});
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);`}
    });`).join('\n')}
  });
`;
    }

    return content;
  }

  /**
   * Generate Python tests
   */
  private async generatePythonTests(
    config: MCPServerConfig,
    testCases: TestCase[],
    outputPath: string
  ): Promise<void> {
    const testContent = `import pytest
import asyncio
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from test_client import MCPTestClient


class Test${this.toPascalCase(config.name)}Server:
    """Test suite for ${config.name} MCP server."""
    
    @pytest.fixture(scope="class")
    async def client(self):
        """Create and connect test client."""
        client = MCPTestClient()
        await client.connect()
        yield client
        await client.disconnect()
    
    @pytest.mark.asyncio
    async def test_server_info(self, client):
        """Test server information."""
        info = await client.get_server_info()
        assert info["name"] == "${config.name}"
        assert info["version"] == "${config.version}"
    
    @pytest.mark.asyncio
    async def test_list_tools(self, client):
        """Test listing available tools."""
        tools = await client.list_tools()
        assert len(tools) == ${config.tools.length}
        tool_names = [tool["name"] for tool in tools]
        ${config.tools.map(tool => `assert "${tool.name}" in tool_names`).join('\n        ')}

${this.generatePytestTestCases(testCases)}
`;

    await fs.writeFile(path.join(outputPath, 'test_server.py'), testContent);

    // Generate test client
    await this.generatePythonTestClient(outputPath);
  }

  /**
   * Generate pytest test cases
   */
  private generatePytestTestCases(testCases: TestCase[]): string {
    const groupedCases = this.groupTestCasesByTool(testCases);
    let content = '';

    for (const [tool, cases] of Object.entries(groupedCases)) {
      content += `
    class TestTool${this.toPascalCase(tool)}:
        """Tests for ${tool} tool."""
        
${cases.map(testCase => `
        @pytest.mark.asyncio
        async def test_${testCase.name}(self, client):
            """${testCase.description}"""
            ${testCase.expectError ? `
            with pytest.raises(Exception):
                await client.call_tool("${testCase.tool}", ${JSON.stringify(testCase.input)})` : `
            result = await client.call_tool("${testCase.tool}", ${JSON.stringify(testCase.input)})
            assert result is not None
            assert "content" in result
            assert isinstance(result["content"], list)`}
`).join('')}`;
    }

    return content;
  }

  /**
   * Generate Go tests
   */
  private async generateGoTests(
    config: MCPServerConfig,
    testCases: TestCase[],
    outputPath: string
  ): Promise<void> {
    const testContent = `package main

import (
    "testing"
    "encoding/json"
    
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestServerInfo(t *testing.T) {
    client := NewTestClient(t)
    defer client.Close()
    
    info, err := client.GetServerInfo()
    require.NoError(t, err)
    
    assert.Equal(t, "${config.name}", info.Name)
    assert.Equal(t, "${config.version}", info.Version)
}

func TestListTools(t *testing.T) {
    client := NewTestClient(t)
    defer client.Close()
    
    tools, err := client.ListTools()
    require.NoError(t, err)
    
    assert.Len(t, tools, ${config.tools.length})
    
    toolNames := make(map[string]bool)
    for _, tool := range tools {
        toolNames[tool.Name] = true
    }
    
    ${config.tools.map(tool => `assert.True(t, toolNames["${tool.name}"])`).join('\n    ')}
}

${this.generateGoTestCases(testCases)}
`;

    await fs.writeFile(path.join(outputPath, 'server_test.go'), testContent);
  }

  /**
   * Generate Rust tests
   */
  private async generateRustTests(
    config: MCPServerConfig,
    testCases: TestCase[],
    outputPath: string
  ): Promise<void> {
    const testContent = `#[cfg(test)]
mod tests {
    use super::*;
    use ${config.name.replace(/-/g, '_')}::*;

    #[test]
    fn test_server_info() {
        let server = MCPServer::new();
        assert_eq!(server.name(), "${config.name}");
        assert_eq!(server.version(), "${config.version}");
    }

    #[test]
    fn test_list_tools() {
        let server = MCPServer::new();
        let tools = server.list_tools();
        assert_eq!(tools.len(), ${config.tools.length});
    }

${this.generateRustTestCases(testCases)}
}`;

    await fs.writeFile(path.join(outputPath, 'tests.rs'), testContent);
  }

  /**
   * Generate Java tests
   */
  private async generateJavaTests(
    config: MCPServerConfig,
    testCases: TestCase[],
    outputPath: string
  ): Promise<void> {
    const testContent = `package com.sessionhub.mcp.tests;

import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import com.sessionhub.mcp.*;

public class MCPServerTest {
    
    private MCPServer server;
    
    @BeforeEach
    void setUp() {
        server = new MCPServer();
    }
    
    @Test
    void testServerInfo() {
        assertEquals("${config.name}", server.getName());
        assertEquals("${config.version}", server.getVersion());
    }
    
    @Test
    void testListTools() {
        var tools = server.listTools();
        assertEquals(${config.tools.length}, tools.size());
    }

${this.generateJavaTestCases(testCases)}
}`;

    await fs.writeFile(path.join(outputPath, 'MCPServerTest.java'), testContent);
  }

  /**
   * Generate integration tests
   */
  private async generateIntegrationTests(
    config: MCPServerConfig,
    outputPath: string,
    language: SupportedLanguage
  ): Promise<void> {
    // Generate integration test that tests multiple tools together
    const integrationTest = this.generateIntegrationTestContent(config, language);
    const filename = this.getIntegrationTestFilename(language);
    
    await fs.writeFile(path.join(outputPath, filename), integrationTest);
  }

  /**
   * Generate test configuration
   */
  private async generateTestConfig(
    _config: MCPServerConfig,
    outputPath: string,
    language: SupportedLanguage
  ): Promise<void> {
    const configs: Record<string, string> = {
      'typescript': this.generateJestConfig(),
      'javascript': this.generateJestConfig(),
      'python': this.generatePytestConfig(),
      'go': this.generateGoTestConfig(),
      'rust': this.generateCargoTestConfig(),
      'java': this.generateMavenTestConfig()
    };

    const configContent = configs[language];
    if (configContent) {
      const configFile = this.getTestConfigFilename(language);
      await fs.writeFile(path.join(outputPath, '..', configFile), configContent);
    }
  }

  // Helper methods
  private generateValidInput(schema: any): any {
    const input: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        if (schema.required?.includes(key)) {
          input[key] = this.generateValueForType(prop.type || 'string');
        }
      }
    }
    
    return input;
  }

  private generateCompleteInput(schema: any): any {
    const input: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        input[key] = this.generateValueForType(prop.type || 'string');
      }
    }
    
    return input;
  }

  private generateInvalidTypeInput(schema: any): any {
    const input: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        if (schema.required?.includes(key)) {
          // Generate wrong type
          input[key] = this.generateWrongTypeValue(prop.type || 'string');
        }
      }
    }
    
    return input;
  }

  private generateLargeInput(schema: any): any {
    const input: any = {};
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        if (schema.required?.includes(key)) {
          input[key] = this.generateLargeValue(prop.type || 'string');
        }
      }
    }
    
    return input;
  }

  private generateValueForType(type: string): any {
    switch (type) {
      case 'string': return 'test_value';
      case 'number': return 42;
      case 'boolean': return true;
      case 'object': return { key: 'value' };
      case 'array': return ['item1', 'item2'];
      default: return 'default_value';
    }
  }

  private generateWrongTypeValue(type: string): any {
    switch (type) {
      case 'string': return 123; // number instead of string
      case 'number': return 'not_a_number';
      case 'boolean': return 'true'; // string instead of boolean
      case 'object': return 'not_an_object';
      case 'array': return 'not_an_array';
      default: return null;
    }
  }

  private generateLargeValue(type: string): any {
    switch (type) {
      case 'string': return 'x'.repeat(10000);
      case 'number': return Number.MAX_SAFE_INTEGER;
      case 'boolean': return true;
      case 'object': return Object.fromEntries(Array(100).fill(0).map((_, i) => [`key${i}`, `value${i}`]));
      case 'array': return Array(1000).fill('item');
      default: return null;
    }
  }

  private hasOptionalParameters(schema: any): boolean {
    if (!schema.properties || !schema.required) return true;
    return Object.keys(schema.properties).length > schema.required.length;
  }

  private getStringParameters(schema: any): string[] {
    const params: string[] = [];
    
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
        if (prop && (prop as any).type === 'string') {
          params.push(key);
        }
      }
    }
    
    return params;
  }

  private groupTestCasesByTool(testCases: TestCase[]): Record<string, TestCase[]> {
    const grouped: Record<string, TestCase[]> = {};
    
    for (const testCase of testCases) {
      if (!grouped[testCase.tool]) {
        grouped[testCase.tool] = [];
      }
      grouped[testCase.tool]!.push(testCase);
    }
    
    return grouped;
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private async generateTestClient(outputPath: string, language: 'typescript' | 'javascript'): Promise<void> {
    const ext = language === 'typescript' ? 'ts' : 'js';
    const clientContent = `import { spawn } from 'child_process';
import { Readable, Writable } from 'stream';

export class MCPTestClient {
  private process: any;
  private stdin: Writable;
  private stdout: Readable;
  private messageId = 0;

  async connect() {
    // Implementation depends on MCP protocol specifics
  }

  async disconnect() {
    if (this.process) {
      this.process.kill();
    }
  }

  async getServerInfo() {
    return this.sendRequest('server/info', {});
  }

  async listTools() {
    return this.sendRequest('tools/list', {});
  }

  async callTool(name${language === 'typescript' ? ': string' : ''}, args${language === 'typescript' ? ': any' : ''}) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  private async sendRequest(method${language === 'typescript' ? ': string' : ''}, params${language === 'typescript' ? ': any' : ''}) {
    // Implementation of JSON-RPC communication
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    // Send request and await response
    // This is a simplified implementation
    return {};
  }
}`;

    await fs.mkdir(path.join(outputPath, 'helpers'), { recursive: true });
    await fs.writeFile(path.join(outputPath, 'helpers', `test-client.${ext}`), clientContent);
  }

  private async generatePythonTestClient(outputPath: string): Promise<void> {
    const clientContent = `import asyncio
import json
from typing import Any, Dict, List


class MCPTestClient:
    """Test client for MCP server."""
    
    def __init__(self):
        self.process = None
        self.reader = None
        self.writer = None
        self.message_id = 0
    
    async def connect(self):
        """Connect to MCP server."""
        # Start server process and establish communication
        pass
    
    async def disconnect(self):
        """Disconnect from MCP server."""
        if self.process:
            self.process.terminate()
            await self.process.wait()
    
    async def get_server_info(self) -> Dict[str, Any]:
        """Get server information."""
        return await self._send_request("server/info", {})
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """List available tools."""
        return await self._send_request("tools/list", {})
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool."""
        return await self._send_request("tools/call", {
            "name": name,
            "arguments": arguments
        })
    
    async def _send_request(self, method: str, params: Dict[str, Any]) -> Any:
        """Send JSON-RPC request."""
        self.message_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": method,
            "params": params
        }
        
        # Send request and await response
        # This is a simplified implementation
        return {}
`;

    await fs.writeFile(path.join(outputPath, 'test_client.py'), clientContent);
  }

  private generateGoTestCases(testCases: TestCase[]): string {
    const groupedCases = this.groupTestCasesByTool(testCases);
    let content = '';

    for (const [tool, cases] of Object.entries(groupedCases)) {
      for (const testCase of cases) {
        content += `
func Test${this.toPascalCase(tool)}_${this.toPascalCase(testCase.name)}(t *testing.T) {
    client := NewTestClient(t)
    defer client.Close()
    
    args := json.RawMessage(\`${JSON.stringify(testCase.input)}\`)
    
    ${testCase.expectError ? `
    _, err := client.CallTool("${testCase.tool}", args)
    assert.Error(t, err)` : `
    result, err := client.CallTool("${testCase.tool}", args)
    require.NoError(t, err)
    
    assert.NotNil(t, result)
    assert.NotEmpty(t, result.Content)`}
}
`;
      }
    }

    return content;
  }

  /**
   * Generate Rust test cases
   */
  private generateRustTestCases(testCases: TestCase[]): string {
    const groupedCases = this.groupTestCasesByTool(testCases);
    let content = '';

    for (const [, cases] of Object.entries(groupedCases)) {
      for (const testCase of cases) {
        content += `
    #[test]
    fn test_${testCase.name}() {
        let server = MCPServer::new();
        let args = serde_json::json!(${JSON.stringify(testCase.input)});
        
        ${testCase.expectError ? `
        let result = server.call_tool("${testCase.tool}", args);
        assert!(result.is_err());` : `
        let result = server.call_tool("${testCase.tool}", args).unwrap();
        assert!(!result.content.is_empty());`}
    }
`;
      }
    }

    return content;
  }

  /**
   * Generate Java test cases
   */
  private generateJavaTestCases(testCases: TestCase[]): string {
    const groupedCases = this.groupTestCasesByTool(testCases);
    let content = '';

    for (const [tool, cases] of Object.entries(groupedCases)) {
      content += `
    static class ${this.toPascalCase(tool)}Tests {
`;
      for (const testCase of cases) {
        content += `
        @Test
        void test${this.toPascalCase(testCase.name)}() {
            var args = new ObjectMapper().readTree("""
                ${JSON.stringify(testCase.input, null, 16)}
                """);
            
            ${testCase.expectError ? `
            assertThrows(Exception.class, () -> {
                server.callTool("${testCase.tool}", args);
            });` : `
            var result = server.callTool("${testCase.tool}", args);
            assertNotNull(result);
            assertFalse(result.getContent().isEmpty());`}
        }
`;
      }
      content += `    }
`;
    }

    return content;
  }

  private generateIntegrationTestContent(config: MCPServerConfig, language: SupportedLanguage): string {
    const templates: Record<string, string> = {
      'typescript': `// Integration tests for ${config.name}
describe('Integration Tests', () => {
  it('should handle multiple tool calls in sequence', async () => {
    // Test workflow using multiple tools
  });
});`,
      'javascript': `// Integration tests for ${config.name}
describe('Integration Tests', () => {
  it('should handle multiple tool calls in sequence', async () => {
    // Test workflow using multiple tools
  });
});`,
      'python': `"""Integration tests for ${config.name}"""

class TestIntegration:
    def test_workflow(self, client):
        """Test complete workflow using multiple tools."""
        pass`,
      'go': `func TestIntegrationWorkflow(t *testing.T) {
    // Test complete workflow
}`,
      'rust': `#[test]
fn test_integration_workflow() {
    // Test complete workflow
}`,
      'java': `@Test
public void testIntegrationWorkflow() {
    // Test complete workflow
}`
    };

    return templates[language] || '// Integration tests';
  }

  private getIntegrationTestFilename(language: SupportedLanguage): string {
    const filenames: Record<string, string> = {
      'typescript': 'integration.test.ts',
      'javascript': 'integration.test.js',
      'python': 'test_integration.py',
      'go': 'integration_test.go',
      'rust': 'integration_tests.rs',
      'java': 'IntegrationTest.java'
    };

    return filenames[language] || 'integration_test.txt';
  }

  private getTestConfigFilename(language: SupportedLanguage): string {
    const filenames: Record<string, string> = {
      'typescript': 'jest.config.js',
      'javascript': 'jest.config.js',
      'python': 'pytest.ini',
      'go': 'go.mod',
      'rust': 'Cargo.toml',
      'java': 'pom.xml'
    };

    return filenames[language] || 'test.config';
  }

  private generateJestConfig(): string {
    return `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.[jt]s'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.test.{js,ts}',
  ],
};`;
  }

  private generatePytestConfig(): string {
    return `[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
`;
  }

  private generateGoTestConfig(): string {
    return `// Add to existing go.mod
require (
    github.com/stretchr/testify v1.8.4
)`;
  }

  private generateCargoTestConfig(): string {
    return `[dev-dependencies]
tokio-test = "0.4"
mockall = "0.11"
`;
  }

  private generateMavenTestConfig(): string {
    return `<!-- Add to existing pom.xml -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>3.0.0</version>
</plugin>`;
  }
}