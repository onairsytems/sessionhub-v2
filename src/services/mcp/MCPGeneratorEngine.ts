import { Logger } from '../../lib/logging/Logger';
import { LanguageDetector } from './LanguageDetector';
import { MCPTemplateManager } from './MCPTemplateManager';
import { MCPConfigGenerator } from './MCPConfigGenerator';
import { MCPDocumentationGenerator } from './MCPDocumentationGenerator';
import { MCPTestGenerator } from './MCPTestGenerator';
import { ProjectAnalyzer } from './ProjectAnalyzer';
import { SupportedLanguage, MCPGenerationOptions, MCPServerConfig } from './types';

export class MCPGeneratorEngine {
  private logger: Logger;
  private languageDetector: LanguageDetector;
  private templateManager: MCPTemplateManager;
  private configGenerator: MCPConfigGenerator;
  private documentationGenerator: MCPDocumentationGenerator;
  private testGenerator: MCPTestGenerator;
  private projectAnalyzer: ProjectAnalyzer;

  constructor() {
    this.logger = new Logger('MCPGeneratorEngine');
    this.languageDetector = new LanguageDetector();
    this.templateManager = new MCPTemplateManager();
    this.configGenerator = new MCPConfigGenerator();
    this.documentationGenerator = new MCPDocumentationGenerator();
    this.testGenerator = new MCPTestGenerator();
    this.projectAnalyzer = new ProjectAnalyzer();
  }

  /**
   * Generate MCP integration for a project
   */
  async generateMCPIntegration(
    projectPath: string,
    options: MCPGenerationOptions = {}
  ): Promise<MCPServerConfig> {
    try {
      this.logger.info('Starting MCP generation for project:', { projectPath });

      // Step 1: Detect project language(s)
      const detectedLanguages = await this.languageDetector.detectLanguages(projectPath);
      const primaryLanguage = options.language || detectedLanguages[0];

      if (!primaryLanguage) {
        throw new Error('Unable to detect project language');
      }

      this.logger.info('Detected primary language:', { primaryLanguage });

      // Step 2: Analyze project structure
      const projectAnalysis = await this.projectAnalyzer.analyze(projectPath, primaryLanguage);
      this.logger.info('Project analysis complete:', projectAnalysis);

      // Step 3: Generate MCP configuration
      const mcpConfig = await this.configGenerator.generate({
        projectPath,
        language: primaryLanguage,
        projectAnalysis,
        customTools: options.customTools,
        integrations: options.integrations
      });

      // Step 4: Generate MCP server from template
      const serverPath = await this.templateManager.generateServer({
        language: primaryLanguage,
        config: mcpConfig,
        outputPath: options.outputPath || `${projectPath}/.mcp`,
        templateOverrides: options.templateOverrides
      });

      // Step 5: Generate documentation
      if (options.generateDocs !== false) {
        await this.documentationGenerator.generate({
          mcpConfig,
          outputPath: `${serverPath}/docs`,
          format: options.docFormat || 'markdown'
        });
      }

      // Step 6: Generate tests
      if (options.generateTests !== false) {
        await this.testGenerator.generate({
          mcpConfig,
          language: primaryLanguage,
          outputPath: `${serverPath}/tests`
        });
      }

      // Step 7: Create integration manifest
      const manifest = {
        name: mcpConfig.name,
        version: mcpConfig.version,
        language: primaryLanguage,
        serverPath,
        tools: mcpConfig.tools,
        integrations: mcpConfig.integrations,
        generatedAt: new Date().toISOString()
      };

      this.logger.info('MCP generation complete:', manifest);
      return manifest;

    } catch (error) {
      this.logger.error('MCP generation failed:', error as Error);
      throw error;
    }
  }

  /**
   * Validate generated MCP server
   */
  async validateMCPServer(_serverPath: string): Promise<boolean> {
    try {
      // TODO: Implement validation logic
      return true;
    } catch (error) {
      this.logger.error('MCP validation failed:', error as Error);
      return false;
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return this.templateManager.getSupportedLanguages();
  }

  /**
   * Get available integrations
   */
  getAvailableIntegrations(): string[] {
    return this.configGenerator.getAvailableIntegrations();
  }
}