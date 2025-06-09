import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { QualityEnforcementOptions, QualityReport, QualityMetrics, QualityIssue, ProjectType } from './types';

const execAsync = promisify(exec);

export class QualityEnforcer {
  async enforce(options: QualityEnforcementOptions): Promise<void> {
    const { projectDir, projectType, strictMode, autoFix = true } = options;

    // Install dependencies first
    await this.installDependencies(projectDir, projectType);

    // Run quality checks based on project type
    if (projectType.includes('python')) {
      await this.enforcePythonQuality(projectDir, autoFix);
    } else {
      await this.enforceNodeQuality(projectDir, projectType, autoFix);
    }

    // Setup pre-commit hooks
    await this.setupPreCommitHooks(projectDir, projectType);

    // Verify zero errors in strict mode
    if (strictMode) {
      const report = await this.generateReport(projectDir);
      if (!report.passed) {
        throw new Error('Quality enforcement failed: Project has errors');
      }
    }
  }

  private async installDependencies(projectDir: string, projectType: ProjectType): Promise<void> {
    if (projectType.includes('python')) {
      // Check if poetry is available
      try {
        await execAsync('poetry --version');
        await execAsync('poetry install', { cwd: projectDir });
      } catch {
        // Fallback to pip
        await execAsync('pip install -r requirements.txt', { cwd: projectDir });
      }
    } else {
      // Node.js projects
      await execAsync('npm install', { cwd: projectDir });
    }
  }

  private async enforceNodeQuality(projectDir: string, _projectType: ProjectType, autoFix: boolean): Promise<void> {
    // Run ESLint with autofix
    if (autoFix) {
      try {
        await execAsync('npm run lint:fix', { cwd: projectDir });
      } catch {
        // Some errors might not be auto-fixable
      }
    }

    // Run Prettier
    if (autoFix) {
      try {
        await execAsync('npm run format', { cwd: projectDir });
      } catch {
        // Ignore if prettier is not configured
      }
    }

    // TypeScript check (no autofix possible)
    const { stdout: tscOutput } = await execAsync('npm run typecheck', { cwd: projectDir });
    if (tscOutput.includes('error')) {
      throw new Error('TypeScript errors found');
    }

    // Run tests to ensure they pass
    try {
      await execAsync('npm test -- --watchAll=false --passWithNoTests', { cwd: projectDir });
    } catch (error) {
      throw new Error('Tests failed');
    }
  }

  private async enforcePythonQuality(projectDir: string, autoFix: boolean): Promise<void> {
    // Run Black formatter
    if (autoFix) {
      await execAsync('black src tests', { cwd: projectDir });
    }

    // Run isort
    if (autoFix) {
      await execAsync('isort src tests', { cwd: projectDir });
    }

    // Run flake8
    const { stdout: flakeOutput } = await execAsync('flake8 src tests', { cwd: projectDir }).catch(e => e);
    if (flakeOutput && flakeOutput.length > 0) {
      throw new Error('Flake8 errors found');
    }

    // Run mypy
    const { stdout: mypyOutput } = await execAsync('mypy src tests', { cwd: projectDir }).catch(e => e);
    if (mypyOutput && mypyOutput.includes('error:')) {
      throw new Error('Mypy type errors found');
    }

    // Run tests
    try {
      await execAsync('pytest', { cwd: projectDir });
    } catch (error) {
      throw new Error('Tests failed');
    }
  }

  private async setupPreCommitHooks(projectDir: string, projectType: ProjectType): Promise<void> {
    if (projectType.includes('python')) {
      await this.setupPythonPreCommit(projectDir);
    } else {
      await this.setupNodePreCommit(projectDir);
    }
  }

  private async setupNodePreCommit(projectDir: string): Promise<void> {
    // Install husky
    await execAsync('npm install --save-dev husky lint-staged', { cwd: projectDir });
    
    // Initialize husky
    await execAsync('npx husky install', { cwd: projectDir });
    
    // Add pre-commit hook
    await execAsync('npx husky add .husky/pre-commit "npx lint-staged"', { cwd: projectDir });

    // Configure lint-staged
    const packageJsonPath = path.join(projectDir, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    packageJson['lint-staged'] = {
      '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
      '*.{json,css,md}': ['prettier --write']
    };

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  private async setupPythonPreCommit(projectDir: string): Promise<void> {
    // Create pre-commit config
    const preCommitConfig = {
      repos: [
        {
          repo: 'https://github.com/pre-commit/pre-commit-hooks',
          rev: 'v4.4.0',
          hooks: [
            { id: 'trailing-whitespace' },
            { id: 'end-of-file-fixer' },
            { id: 'check-yaml' },
            { id: 'check-added-large-files' }
          ]
        },
        {
          repo: 'https://github.com/psf/black',
          rev: '22.12.0',
          hooks: [{ id: 'black' }]
        },
        {
          repo: 'https://github.com/pycqa/isort',
          rev: '5.11.4',
          hooks: [{ id: 'isort' }]
        },
        {
          repo: 'https://github.com/pycqa/flake8',
          rev: '6.0.0',
          hooks: [{ id: 'flake8' }]
        },
        {
          repo: 'https://github.com/pre-commit/mirrors-mypy',
          rev: 'v0.991',
          hooks: [{ id: 'mypy' }]
        }
      ]
    };

    await fs.writeFile(
      path.join(projectDir, '.pre-commit-config.yaml'),
      `# Pre-commit hooks for code quality
${JSON.stringify(preCommitConfig, null, 2).replace(/"/g, '').replace(/,\n/g, '\n')}`
    );

    // Install pre-commit
    try {
      await execAsync('pip install pre-commit', { cwd: projectDir });
      await execAsync('pre-commit install', { cwd: projectDir });
    } catch {
      // pre-commit might not be available globally
    }
  }

  async generateReport(projectDir: string): Promise<QualityReport> {
    const projectType = await this.detectProjectType(projectDir);
    const metrics: QualityMetrics = {
      typeScriptErrors: 0,
      eslintErrors: 0,
      eslintWarnings: 0,
      prettierIssues: 0,
      testsPassing: true,
      buildSuccessful: true,
      dependencyVulnerabilities: 0
    };
    const issues: QualityIssue[] = [];

    if (projectType.includes('python')) {
      // Python quality checks
      try {
        await execAsync('mypy src tests', { cwd: projectDir });
      } catch (error: any) {
        const errorCount = (error.stdout?.match(/error:/g) || []).length;
        metrics.typeScriptErrors = errorCount; // Using same field for type errors
        issues.push({
          severity: 'error',
          category: 'Type Checking',
          message: `Found ${errorCount} type errors`
        });
      }

      try {
        await execAsync('flake8 src tests', { cwd: projectDir });
      } catch (error: any) {
        const errorCount = error.stdout?.split('\n').filter((line: string) => line.trim()).length || 0;
        metrics.eslintErrors = errorCount; // Using same field for linting errors
        issues.push({
          severity: 'error',
          category: 'Linting',
          message: `Found ${errorCount} linting errors`
        });
      }
    } else {
      // Node.js quality checks
      try {
        await execAsync('npm run typecheck', { cwd: projectDir });
      } catch (error: any) {
        const errorMatch = error.stdout?.match(/Found (\d+) error/);
        if (errorMatch) {
          metrics.typeScriptErrors = parseInt(errorMatch[1]);
          issues.push({
            severity: 'error',
            category: 'TypeScript',
            message: `Found ${metrics.typeScriptErrors} TypeScript errors`
          });
        }
      }

      try {
        const { stdout } = await execAsync('npm run lint -- --format json', { cwd: projectDir });
        const results = JSON.parse(stdout);
        for (const result of results) {
          metrics.eslintErrors += result.errorCount;
          metrics.eslintWarnings += result.warningCount;
        }
        if (metrics.eslintErrors > 0) {
          issues.push({
            severity: 'error',
            category: 'ESLint',
            message: `Found ${metrics.eslintErrors} ESLint errors`
          });
        }
      } catch {
        // ESLint might not support JSON output
      }
    }

    // Test execution
    try {
      if (projectType.includes('python')) {
        await execAsync('pytest', { cwd: projectDir });
      } else {
        await execAsync('npm test -- --watchAll=false --passWithNoTests', { cwd: projectDir });
      }
    } catch {
      metrics.testsPassing = false;
      issues.push({
        severity: 'error',
        category: 'Testing',
        message: 'Tests are failing'
      });
    }

    // Build check
    try {
      if (!projectType.includes('python')) {
        await execAsync('npm run build', { cwd: projectDir });
      }
    } catch {
      metrics.buildSuccessful = false;
      issues.push({
        severity: 'error',
        category: 'Build',
        message: 'Build failed'
      });
    }

    const passed = metrics.typeScriptErrors === 0 && 
                   metrics.eslintErrors === 0 && 
                   metrics.testsPassing && 
                   metrics.buildSuccessful;

    return {
      projectType: projectType as ProjectType,
      timestamp: new Date(),
      metrics,
      issues,
      passed
    };
  }

  private async detectProjectType(projectDir: string): Promise<ProjectType> {
    const hasPackageJson = await fs.pathExists(path.join(projectDir, 'package.json'));
    const hasPyprojectToml = await fs.pathExists(path.join(projectDir, 'pyproject.toml'));

    if (hasPyprojectToml) {
      const content = await fs.readFile(path.join(projectDir, 'pyproject.toml'), 'utf8');
      if (content.includes('fastapi')) return ProjectType.PYTHON_FASTAPI;
      if (content.includes('django')) return ProjectType.PYTHON_DJANGO;
    }

    if (hasPackageJson) {
      const packageJson = await fs.readJson(path.join(projectDir, 'package.json'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.next) return ProjectType.NEXTJS;
      if (deps.react && deps.typescript) return ProjectType.REACT_TYPESCRIPT;
      if (deps.react) return ProjectType.REACT_JAVASCRIPT;
      if (deps.express && deps.typescript) return ProjectType.EXPRESS_TYPESCRIPT;
      if (deps.express) return ProjectType.EXPRESS_JAVASCRIPT;
      if (deps.electron) return ProjectType.ELECTRON;
    }

    return ProjectType.NODEJS_CLI;
  }
}