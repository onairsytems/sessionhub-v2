import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPGeneratorEngine } from '../../src/services/mcp/MCPGeneratorEngine';
import { MCPIntegrationService } from '../../src/services/mcp/MCPIntegrationService';

describe('MCP Generator Integration Tests', () => {
  const testProjectsDir = path.join(__dirname, 'test-projects');
  const outputDir = path.join(__dirname, 'test-output');
  
  beforeAll(async () => {
    // Create test directories
    await fs.mkdir(testProjectsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test directories
    await fs.rm(testProjectsDir, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  describe('MCPGeneratorEngine', () => {
    let generator: MCPGeneratorEngine;

    beforeAll(() => {
      generator = new MCPGeneratorEngine();
    });

    it('should detect supported languages', () => {
      const languages = generator.getSupportedLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
      expect(languages).toContain('java');
    });

    it('should generate MCP server for TypeScript project', async () => {
      // Create a simple TypeScript project
      const projectPath = path.join(testProjectsDir, 'ts-project');
      await fs.mkdir(projectPath, { recursive: true });
      
      // Create package.json
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify({
          name: 'test-ts-project',
          version: '1.0.0',
          dependencies: {
            express: '^4.18.0'
          }
        }, null, 2)
      );

      // Create tsconfig.json
      await fs.writeFile(
        path.join(projectPath, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'es2020',
            module: 'commonjs'
          }
        }, null, 2)
      );

      // Create a simple TypeScript file
      await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(projectPath, 'src', 'index.ts'),
        `import express from 'express';
const app = express();
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});`
      );

      // Generate MCP server
      const result = await generator.generateMCPIntegration(projectPath, {
        outputPath: path.join(outputDir, 'ts-mcp-server')
      });

      // Verify result
      expect(result).toBeDefined();
      expect(result.name).toBe('test_ts_project');
      expect((result as any).language).toBe('typescript');
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify generated files
      const serverFile = path.join((result as any).serverPath || '', 'server.ts');
      expect(await fileExists(serverFile)).toBe(true);

      const packageFile = path.join((result as any).serverPath || '', 'package.json');
      expect(await fileExists(packageFile)).toBe(true);

      const configFile = path.join((result as any).serverPath || '', 'mcp.config.json');
      expect(await fileExists(configFile)).toBe(true);
    });

    it('should generate MCP server for Python project', async () => {
      // Create a simple Python project
      const projectPath = path.join(testProjectsDir, 'py-project');
      await fs.mkdir(projectPath, { recursive: true });
      
      // Create requirements.txt
      await fs.writeFile(
        path.join(projectPath, 'requirements.txt'),
        'flask>=2.0.0\nsqlalchemy>=1.4.0'
      );

      // Create a simple Python file
      await fs.writeFile(
        path.join(projectPath, 'app.py'),
        `from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/api/items')
def get_items():
    return jsonify({'items': []})`
      );

      // Generate MCP server
      const result = await generator.generateMCPIntegration(projectPath, {
        outputPath: path.join(outputDir, 'py-mcp-server')
      });

      // Verify result
      expect(result).toBeDefined();
      expect((result as any).language).toBe('python');
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify generated files
      const serverFile = path.join((result as any).serverPath || '', 'server.py');
      expect(await fileExists(serverFile)).toBe(true);

      const requirementsFile = path.join((result as any).serverPath || '', 'requirements.txt');
      expect(await fileExists(requirementsFile)).toBe(true);
    });

    it('should handle multiple languages in the same project', async () => {
      // Create a mixed language project
      const projectPath = path.join(testProjectsDir, 'mixed-project');
      await fs.mkdir(projectPath, { recursive: true });
      
      // Add both TypeScript and Python files
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'mixed-project' })
      );
      
      await fs.writeFile(
        path.join(projectPath, 'requirements.txt'),
        'flask>=2.0.0'
      );

      await fs.writeFile(
        path.join(projectPath, 'index.ts'),
        'console.log("TypeScript");'
      );

      await fs.writeFile(
        path.join(projectPath, 'main.py'),
        'print("Python")'
      );

      // Generate MCP server - should detect primary language
      const result = await generator.generateMCPIntegration(projectPath, {
        outputPath: path.join(outputDir, 'mixed-mcp-server')
      });

      // Should pick one primary language
      expect(result).toBeDefined();
      expect(['typescript', 'python']).toContain((result as any).language);
    });
  });

  describe('MCPIntegrationService', () => {
    let integrationService: MCPIntegrationService;

    beforeAll(() => {
      integrationService = new MCPIntegrationService();
    });

    it('should create MCP session', async () => {
      const projectPath = path.join(testProjectsDir, 'session-test');
      await fs.mkdir(projectPath, { recursive: true });
      
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'session-test' })
      );

      const sessionId = await integrationService.createMCPSession(projectPath);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      // Check session status
      const status = integrationService.getMCPSessionStatus(sessionId);
      expect(status).toBeDefined();
      expect(['planning', 'generating', 'testing', 'completed']).toContain(status?.status);
    });

    it('should list supported languages', () => {
      const languages = integrationService.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
    });

    it('should list available integrations', () => {
      const integrations = integrationService.getAvailableIntegrations();
      expect(Array.isArray(integrations)).toBe(true);
      expect(integrations).toContain('github');
      expect(integrations).toContain('openai');
      expect(integrations).toContain('aws');
    });
  });
});

// Helper function to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}