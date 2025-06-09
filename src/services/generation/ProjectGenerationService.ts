import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PreGenerationValidator } from './PreGenerationValidator';
import { CodeGenerator } from './CodeGenerator';
import { PostGenerationVerifier } from './PostGenerationVerifier';
import { GitInitializer } from './GitInitializer';
import { QualityEnforcer } from './QualityEnforcer';
import { TemplateEngine } from './TemplateEngine';
import { GenerationResult, ProjectConfig, GenerationError } from './types';

export class ProjectGenerationService extends EventEmitter {
  private preValidator: PreGenerationValidator;
  private codeGenerator: CodeGenerator;
  private postVerifier: PostGenerationVerifier;
  private gitInitializer: GitInitializer;
  private qualityEnforcer: QualityEnforcer;
  private templateEngine: TemplateEngine;

  constructor() {
    super();
    this.preValidator = new PreGenerationValidator();
    this.codeGenerator = new CodeGenerator();
    this.postVerifier = new PostGenerationVerifier();
    this.gitInitializer = new GitInitializer();
    this.qualityEnforcer = new QualityEnforcer();
    this.templateEngine = new TemplateEngine();
  }

  async generateProject(config: ProjectConfig): Promise<GenerationResult> {
    const startTime = Date.now();
    const tempDir = await this.createTempDirectory(config.name);
    
    try {
      this.emit('generation:start', { config, tempDir });

      // Phase 1: Pre-generation validation
      this.emit('phase:prevalidation', { config });
      const validationResult = await this.preValidator.validate(config);
      if (!validationResult.isValid) {
        throw new GenerationError('Pre-generation validation failed', validationResult.errors);
      }

      // Phase 2: Template preparation
      this.emit('phase:template', { config });
      const template = await this.templateEngine.prepareTemplate(config);
      
      // Phase 3: Code generation with zero-error guarantee
      this.emit('phase:generation', { config, template });
      const generatedFiles = await this.codeGenerator.generate({
        config,
        template,
        outputDir: tempDir
      });

      // Phase 4: Quality enforcement
      this.emit('phase:quality', { config, tempDir });
      await this.qualityEnforcer.enforce({
        projectDir: tempDir,
        projectType: config.type,
        strictMode: true // Always enforce strict mode for zero errors
      });

      // Phase 5: Git initialization with quality gates
      this.emit('phase:git', { config, tempDir });
      await this.gitInitializer.initialize({
        projectDir: tempDir,
        projectType: config.type,
        enableHooks: true,
        includeGitIgnore: true
      });

      // Phase 6: Optional GitHub integration
      if (config.github?.enabled) {
        this.emit('phase:github', { config, tempDir });
        await this.gitInitializer.setupGitHub({
          projectDir: tempDir,
          repoName: config.github.repoName || config.name,
          private: config.github.private ?? true,
          includeActions: true
        });
      }

      // Phase 7: Post-generation verification
      this.emit('phase:verification', { config, tempDir });
      const verificationResult = await this.postVerifier.verify({
        projectDir: tempDir,
        config,
        generatedFiles
      });

      if (!verificationResult.success) {
        throw new GenerationError('Post-generation verification failed', verificationResult.errors);
      }

      // Phase 8: Move to final location
      const finalPath = path.join(config.outputDir || process.cwd(), config.name);
      await fs.move(tempDir, finalPath, { overwrite: false });

      // Phase 9: Generate quality report
      const qualityReport = await this.qualityEnforcer.generateReport(finalPath);

      const result: GenerationResult = {
        success: true,
        projectPath: finalPath,
        duration: Date.now() - startTime,
        filesGenerated: generatedFiles.length,
        qualityReport,
        gitInitialized: true,
        githubCreated: config.github?.enabled || false,
        errors: []
      };

      this.emit('generation:complete', result);
      return result;

    } catch (error) {
      // Cleanup on failure
      await fs.remove(tempDir).catch(() => {});
      
      const result: GenerationResult = {
        success: false,
        projectPath: '',
        duration: Date.now() - startTime,
        filesGenerated: 0,
        qualityReport: null,
        gitInitialized: false,
        githubCreated: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };

      this.emit('generation:failed', result);
      return result;
    }
  }

  private async createTempDirectory(projectName: string): Promise<string> {
    const tempBase = path.join(process.cwd(), '.sessionhub-temp');
    await fs.ensureDir(tempBase);
    const tempDir = path.join(tempBase, `${projectName}-${Date.now()}`);
    await fs.ensureDir(tempDir);
    return tempDir;
  }

  async getSupportedProjectTypes(): Promise<string[]> {
    return this.templateEngine.getAvailableTemplates();
  }

  async validateProjectName(name: string): Promise<{ valid: boolean; reason?: string }> {
    return this.preValidator.validateProjectName(name);
  }
}