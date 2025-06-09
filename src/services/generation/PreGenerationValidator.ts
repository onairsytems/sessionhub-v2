import { ProjectConfig, ValidationResult, ProjectType } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class PreGenerationValidator {
  private projectNameRegex = /^[a-z0-9-_]+$/i;
  private reservedNames = ['node_modules', 'dist', 'build', '.git', '.github'];

  async validate(config: ProjectConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate project name
    const nameValidation = await this.validateProjectName(config.name);
    if (!nameValidation.valid) {
      errors.push(nameValidation.reason || 'Invalid project name');
    }

    // Validate project type
    if (!this.isValidProjectType(config.type)) {
      errors.push(`Invalid project type: ${config.type}`);
    }

    // Validate output directory
    if (config.outputDir) {
      const dirValidation = await this.validateOutputDirectory(config.outputDir);
      if (!dirValidation.valid) {
        errors.push(dirValidation.reason || 'Invalid output directory');
      }
    }

    // Check for conflicting paths
    const targetPath = path.join(config.outputDir || process.cwd(), config.name);
    if (await fs.pathExists(targetPath)) {
      errors.push(`Directory already exists: ${targetPath}`);
    }

    // Validate GitHub configuration
    if (config.github?.enabled) {
      const githubValidation = this.validateGitHubConfig(config);
      errors.push(...githubValidation.errors);
      warnings.push(...githubValidation.warnings);
    }

    // Validate feature compatibility
    const featureValidation = this.validateFeatures(config);
    errors.push(...featureValidation.errors);
    warnings.push(...featureValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async validateProjectName(name: string): Promise<{ valid: boolean; reason?: string }> {
    if (!name || name.trim().length === 0) {
      return { valid: false, reason: 'Project name cannot be empty' };
    }

    if (name.length > 214) {
      return { valid: false, reason: 'Project name too long (max 214 characters)' };
    }

    if (!this.projectNameRegex.test(name)) {
      return { valid: false, reason: 'Project name can only contain letters, numbers, hyphens, and underscores' };
    }

    if (this.reservedNames.includes(name.toLowerCase())) {
      return { valid: false, reason: `"${name}" is a reserved name` };
    }

    if (name.startsWith('.') || name.startsWith('-')) {
      return { valid: false, reason: 'Project name cannot start with a dot or hyphen' };
    }

    return { valid: true };
  }

  private async validateOutputDirectory(dir: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const resolvedPath = path.resolve(dir);
      const exists = await fs.pathExists(resolvedPath);
      
      if (!exists) {
        // Try to create it to verify we have permissions
        await fs.ensureDir(resolvedPath);
        await fs.remove(resolvedPath);
      } else {
        // Check if we can write to it
        const testFile = path.join(resolvedPath, '.sessionhub-test');
        try {
          await fs.writeFile(testFile, '');
          await fs.remove(testFile);
        } catch {
          return { valid: false, reason: 'No write permission for output directory' };
        }
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid output directory path' };
    }
  }

  private isValidProjectType(type: ProjectType): boolean {
    return Object.values(ProjectType).includes(type);
  }

  private validateGitHubConfig(config: ProjectConfig): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.github) return { errors, warnings };

    if (config.github.repoName) {
      const repoNameValidation = this.validateGitHubRepoName(config.github.repoName);
      if (!repoNameValidation.valid) {
        errors.push(repoNameValidation.reason || 'Invalid GitHub repository name');
      }
    }

    if (config.github.topics && config.github.topics.length > 20) {
      warnings.push('GitHub allows maximum 20 topics per repository');
    }

    return { errors, warnings };
  }

  private validateGitHubRepoName(name: string): { valid: boolean; reason?: string } {
    if (name.length > 100) {
      return { valid: false, reason: 'GitHub repository name too long (max 100 characters)' };
    }

    if (!/^[a-z0-9._-]+$/i.test(name)) {
      return { valid: false, reason: 'GitHub repository name can only contain alphanumeric characters, dots, underscores, and hyphens' };
    }

    return { valid: true };
  }

  private validateFeatures(config: ProjectConfig): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.features) return { errors, warnings };

    // Python projects shouldn't have husky
    if (config.type.startsWith('python-') && config.features.husky) {
      errors.push('Husky is not compatible with Python projects');
    }

    // Testing requires appropriate framework
    if (config.features.testing) {
      switch (config.type) {
        case ProjectType.REACT_TYPESCRIPT:
        case ProjectType.REACT_JAVASCRIPT:
        case ProjectType.NEXTJS:
          // React Testing Library + Jest
          break;
        case ProjectType.PYTHON_FASTAPI:
        case ProjectType.PYTHON_DJANGO:
          // pytest
          break;
        default:
          warnings.push('Testing framework will be auto-selected based on project type');
      }
    }

    return { errors, warnings };
  }
}