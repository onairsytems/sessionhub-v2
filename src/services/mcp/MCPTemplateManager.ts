import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../lib/logging/Logger';
import { SupportedLanguage, MCPServerConfig, LanguageTemplate } from './types';
import { TypeScriptTemplate } from './templates/TypeScriptTemplate';
import { PythonTemplate } from './templates/PythonTemplate';
import { JavaScriptTemplate } from './templates/JavaScriptTemplate';
import { GoTemplate } from './templates/GoTemplate';
import { RustTemplate } from './templates/RustTemplate';
import { JavaTemplate } from './templates/JavaTemplate';

interface ServerGenerationOptions {
  language: SupportedLanguage;
  config: MCPServerConfig;
  outputPath: string;
  templateOverrides?: Record<string, any>;
}

export class MCPTemplateManager {
  private logger: Logger;
  private templates: Map<SupportedLanguage, LanguageTemplate>;

  constructor() {
    this.logger = new Logger('MCPTemplateManager');
    this.templates = new Map();
    this.initializeTemplates();
  }

  /**
   * Initialize language templates
   */
  private initializeTemplates(): void {
    // Register all language templates
    this.templates.set('typescript', new TypeScriptTemplate());
    this.templates.set('javascript', new JavaScriptTemplate());
    this.templates.set('python', new PythonTemplate());
    this.templates.set('go', new GoTemplate());
    this.templates.set('rust', new RustTemplate());
    this.templates.set('java', new JavaTemplate());
    
    // Additional languages can be added here:
    // this.templates.set('csharp', new CSharpTemplate());
    // this.templates.set('ruby', new RubyTemplate());
    // this.templates.set('php', new PHPTemplate());
    // this.templates.set('swift', new SwiftTemplate());
    // this.templates.set('kotlin', new KotlinTemplate());
    // this.templates.set('scala', new ScalaTemplate());
  }

  /**
   * Generate MCP server from template
   */
  async generateServer(options: ServerGenerationOptions): Promise<string> {
    const { language, config, outputPath, templateOverrides } = options;

    this.logger.info(`Generating MCP server for language: ${language}`, { outputPath });

    const template = this.templates.get(language);
    if (!template) {
      throw new Error(`No template available for language: ${language}`);
    }

    try {
      // Create output directory
      await fs.mkdir(outputPath, { recursive: true });

      // Generate server files
      await this.generateServerFile(outputPath, template, config, templateOverrides);
      await this.generateToolHandlers(outputPath, template, config);
      await this.generateConfigFile(outputPath, template, config);
      await this.generatePackageFile(outputPath, template, config);
      await this.generateReadme(outputPath, template, config);

      // Create directory structure
      await this.createDirectoryStructure(outputPath, template);

      this.logger.info('MCP server generated successfully at: ' + outputPath);
      return outputPath;

    } catch (error) {
      this.logger.error('Failed to generate MCP server:', error as Error);
      throw error;
    }
  }

  /**
   * Generate main server file
   */
  private async generateServerFile(
    outputPath: string,
    template: LanguageTemplate,
    config: MCPServerConfig,
    overrides?: Record<string, any>
  ): Promise<void> {
    const serverContent = this.processTemplate(template.serverTemplate, {
      ...config,
      ...overrides
    });

    const serverFileName = `server.${template.fileExtension}`;
    await fs.writeFile(path.join(outputPath, serverFileName), serverContent);
  }

  /**
   * Generate tool handler files
   */
  private async generateToolHandlers(
    outputPath: string,
    template: LanguageTemplate,
    config: MCPServerConfig
  ): Promise<void> {
    const toolsDir = path.join(outputPath, 'tools');
    await fs.mkdir(toolsDir, { recursive: true });

    for (const tool of config.tools) {
      const toolContent = this.processTemplate(template.toolTemplate, {
        tool,
        serverName: config.name
      });

      const toolFileName = `${tool.name}.${template.fileExtension}`;
      await fs.writeFile(path.join(toolsDir, toolFileName), toolContent);
    }
  }

  /**
   * Generate configuration file
   */
  private async generateConfigFile(
    outputPath: string,
    _template: LanguageTemplate,
    config: MCPServerConfig
  ): Promise<void> {
    // const configContent = this.processTemplate(template.configTemplate, config);
    await fs.writeFile(path.join(outputPath, 'mcp.config.json'), JSON.stringify(config, null, 2));
  }

  /**
   * Generate package/dependency file
   */
  private async generatePackageFile(
    outputPath: string,
    template: LanguageTemplate,
    config: MCPServerConfig
  ): Promise<void> {
    if (template.packageTemplate) {
      const packageContent = this.processTemplate(template.packageTemplate, config);
      const packageFileName = this.getPackageFileName(template.language);
      await fs.writeFile(path.join(outputPath, packageFileName), packageContent);
    }
  }

  /**
   * Generate README file
   */
  private async generateReadme(
    outputPath: string,
    template: LanguageTemplate,
    config: MCPServerConfig
  ): Promise<void> {
    const readmeContent = this.generateReadmeContent(template, config);
    await fs.writeFile(path.join(outputPath, 'README.md'), readmeContent);
  }

  /**
   * Create directory structure for the server
   */
  private async createDirectoryStructure(
    outputPath: string,
    template: LanguageTemplate
  ): Promise<void> {
    const directories = ['tools', 'resources', 'tests', 'docs'];
    
    for (const dir of directories) {
      await fs.mkdir(path.join(outputPath, dir), { recursive: true });
    }

    // Create language-specific directories
    switch (template.language) {
      case 'typescript':
      case 'javascript':
        await fs.mkdir(path.join(outputPath, 'src'), { recursive: true });
        break;
      case 'python':
        await fs.mkdir(path.join(outputPath, 'src'), { recursive: true });
        await fs.writeFile(path.join(outputPath, 'src', '__init__.py'), '');
        break;
      case 'java':
        await fs.mkdir(path.join(outputPath, 'src/main/java'), { recursive: true });
        await fs.mkdir(path.join(outputPath, 'src/test/java'), { recursive: true });
        break;
      // Add more language-specific structures as needed
    }
  }

  /**
   * Process template with data
   */
  private processTemplate(template: string, data: any): string {
    // Simple template processing - replace {{variable}} with data
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Get package file name for language
   */
  private getPackageFileName(language: SupportedLanguage): string {
    const packageFiles: Record<string, string> = {
      'typescript': 'package.json',
      'javascript': 'package.json',
      'python': 'requirements.txt',
      'java': 'pom.xml',
      'csharp': 'project.csproj',
      'go': 'go.mod',
      'rust': 'Cargo.toml',
      'ruby': 'Gemfile',
      'php': 'composer.json',
      'swift': 'Package.swift',
      'kotlin': 'build.gradle.kts',
      'scala': 'build.sbt'
    };

    return packageFiles[language] || 'dependencies.txt';
  }

  /**
   * Generate README content
   */
  private generateReadmeContent(template: LanguageTemplate, config: MCPServerConfig): string {
    return `# ${config.name} MCP Server

${config.description || 'MCP server generated by SessionHub'}

## Installation

\`\`\`bash
${template.buildCommand || '# Build command not specified'}
\`\`\`

## Running the Server

\`\`\`bash
${template.runCommand || '# Run command not specified'}
\`\`\`

## Available Tools

${config.tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Configuration

The server configuration is stored in \`mcp.config.json\`.

## Testing

Run the tests with:

\`\`\`bash
${this.getTestCommand(template.language)}
\`\`\`

## Documentation

See the \`docs\` directory for detailed documentation.

---

Generated by SessionHub MCP Generator
`;
  }

  /**
   * Get test command for language
   */
  private getTestCommand(language: SupportedLanguage): string {
    const testCommands: Record<string, string> = {
      'typescript': 'npm test',
      'javascript': 'npm test',
      'python': 'pytest',
      'java': 'mvn test',
      'csharp': 'dotnet test',
      'go': 'go test ./...',
      'rust': 'cargo test',
      'ruby': 'rspec',
      'php': 'phpunit',
      'swift': 'swift test',
      'kotlin': 'gradle test',
      'scala': 'sbt test'
    };

    return testCommands[language] || 'run tests';
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return this.templates.has(language as SupportedLanguage);
  }

  /**
   * Get template for language
   */
  getTemplate(language: SupportedLanguage): LanguageTemplate | undefined {
    return this.templates.get(language);
  }
}