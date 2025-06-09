import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { VerificationOptions, VerificationResult, ProjectConfig } from './types';

const execAsync = promisify(exec);

export class PostGenerationVerifier {
  async verify(options: VerificationOptions): Promise<VerificationResult> {
    const { projectDir, config, generatedFiles } = options;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verify all expected files were generated
      const fileVerification = await this.verifyFiles(projectDir, generatedFiles);
      errors.push(...fileVerification.errors);

      // Verify project structure
      const structureVerification = await this.verifyProjectStructure(projectDir, config);
      errors.push(...structureVerification.errors);
      warnings.push(...structureVerification.warnings);

      // Verify dependencies are installable
      const depVerification = await this.verifyDependencies(projectDir, config);
      errors.push(...depVerification.errors);

      // Verify build/compile works
      const buildVerification = await this.verifyBuild(projectDir, config);
      errors.push(...buildVerification.errors);

      // Verify tests pass
      const testVerification = await this.verifyTests(projectDir, config);
      errors.push(...testVerification.errors);

      // Verify Git initialization
      const gitVerification = await this.verifyGitSetup(projectDir);
      errors.push(...gitVerification.errors);

      // Verify zero quality issues
      const qualityVerification = await this.verifyQuality(projectDir, config);
      errors.push(...qualityVerification.errors);

      return {
        success: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        errors: [...errors, error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private async verifyFiles(projectDir: string, expectedFiles: string[]): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    for (const file of expectedFiles) {
      const filePath = path.join(projectDir, file);
      if (!(await fs.pathExists(filePath))) {
        errors.push(`Expected file not found: ${file}`);
      }
    }

    return { errors };
  }

  private async verifyProjectStructure(projectDir: string, config: ProjectConfig): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for essential files based on project type
    const essentialFiles = this.getEssentialFiles(config.type);
    
    for (const file of essentialFiles) {
      const filePath = path.join(projectDir, file);
      if (!(await fs.pathExists(filePath))) {
        errors.push(`Essential file missing: ${file}`);
      }
    }

    // Check for proper directory structure
    const essentialDirs = this.getEssentialDirectories(config.type);
    
    for (const dir of essentialDirs) {
      const dirPath = path.join(projectDir, dir);
      if (!(await fs.pathExists(dirPath))) {
        warnings.push(`Expected directory missing: ${dir}`);
      }
    }

    return { errors, warnings };
  }

  private async verifyDependencies(projectDir: string, config: ProjectConfig): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    try {
      if (config.type.includes('python')) {
        // Verify Python dependencies
        const hasRequirements = await fs.pathExists(path.join(projectDir, 'requirements.txt'));
        const hasPyproject = await fs.pathExists(path.join(projectDir, 'pyproject.toml'));
        
        if (!hasRequirements && !hasPyproject) {
          errors.push('No dependency file found (requirements.txt or pyproject.toml)');
        }
      } else {
        // Verify Node.js dependencies
        const packageJsonPath = path.join(projectDir, 'package.json');
        if (!(await fs.pathExists(packageJsonPath))) {
          errors.push('package.json not found');
        } else {
          const packageJson = await fs.readJson(packageJsonPath);
          if (!packageJson.name || !packageJson.version) {
            errors.push('Invalid package.json: missing name or version');
          }
        }
      }
    } catch (error) {
      errors.push(`Dependency verification failed: ${error}`);
    }

    return { errors };
  }

  private async verifyBuild(projectDir: string, config: ProjectConfig): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    try {
      if (config.type.includes('python')) {
        // Python projects don't typically have a build step
        // Just verify syntax
        await execAsync('python -m py_compile src/**/*.py', { cwd: projectDir, shell: 'true' as any });
      } else {
        // Try to run build command
        const packageJson = await fs.readJson(path.join(projectDir, 'package.json'));
        if (packageJson.scripts?.build) {
          const { stderr } = await execAsync('npm run build', { cwd: projectDir });
          if (stderr && stderr.includes('error')) {
            errors.push('Build failed with errors');
          }
        }
      }
    } catch (error) {
      errors.push(`Build verification failed: ${error}`);
    }

    return { errors };
  }

  private async verifyTests(projectDir: string, config: ProjectConfig): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    try {
      if (config.type.includes('python')) {
        // Check if tests exist
        const testsExist = await fs.pathExists(path.join(projectDir, 'tests'));
        if (testsExist) {
          try {
            await execAsync('pytest --tb=short', { cwd: projectDir });
          } catch (error: any) {
            if (error.code !== 5) { // pytest returns 5 when no tests are found
              errors.push('Tests failed to run');
            }
          }
        }
      } else {
        // Node.js tests
        const packageJson = await fs.readJson(path.join(projectDir, 'package.json'));
        if (packageJson.scripts?.test) {
          try {
            await execAsync('npm test -- --watchAll=false --passWithNoTests', { cwd: projectDir });
          } catch {
            errors.push('Tests failed to run');
          }
        }
      }
    } catch (error) {
      // Tests might not be configured, which is okay
    }

    return { errors };
  }

  private async verifyGitSetup(projectDir: string): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    const gitDir = path.join(projectDir, '.git');
    if (!(await fs.pathExists(gitDir))) {
      errors.push('Git repository not initialized');
    }

    // Check for .gitignore
    const gitignorePath = path.join(projectDir, '.gitignore');
    if (!(await fs.pathExists(gitignorePath))) {
      errors.push('.gitignore file missing');
    }

    return { errors };
  }

  private async verifyQuality(projectDir: string, config: ProjectConfig): Promise<{ errors: string[] }> {
    const errors: string[] = [];

    try {
      if (config.type.includes('python')) {
        // Run Python quality checks
        const checks = [
          { cmd: 'black --check src tests', name: 'Black formatting' },
          { cmd: 'isort --check-only src tests', name: 'Import sorting' },
          { cmd: 'flake8 src tests', name: 'Flake8 linting' },
          { cmd: 'mypy src tests', name: 'Type checking' }
        ];

        for (const check of checks) {
          try {
            await execAsync(check.cmd, { cwd: projectDir });
          } catch {
            errors.push(`${check.name} check failed`);
          }
        }
      } else {
        // Run Node.js quality checks
        const packageJson = await fs.readJson(path.join(projectDir, 'package.json'));
        
        if (packageJson.scripts?.lint) {
          try {
            await execAsync('npm run lint', { cwd: projectDir });
          } catch {
            errors.push('ESLint check failed');
          }
        }

        if (packageJson.scripts?.typecheck) {
          try {
            await execAsync('npm run typecheck', { cwd: projectDir });
          } catch {
            errors.push('TypeScript check failed');
          }
        }
      }
    } catch (error) {
      errors.push(`Quality verification failed: ${error}`);
    }

    return { errors };
  }

  private getEssentialFiles(projectType: string): string[] {
    const common = ['README.md', '.gitignore'];

    if (projectType.includes('python')) {
      return [...common, 'pyproject.toml', 'requirements.txt'];
    } else {
      return [...common, 'package.json', 'tsconfig.json'];
    }
  }

  private getEssentialDirectories(projectType: string): string[] {
    if (projectType.includes('python')) {
      return ['src', 'tests'];
    } else if (projectType === 'nextjs') {
      return ['src', 'public'];
    } else {
      return ['src', 'public'];
    }
  }
}