import { ProjectGenerationService } from '@/src/services/generation/ProjectGenerationService';
import { ProjectType, ProjectConfig } from '@/src/services/generation/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Zero-Error Project Generation', () => {
  const testDir = path.join(process.cwd(), '.test-generation');
  const generationService = new ProjectGenerationService();

  beforeAll(async () => {
    await fs.ensureDir(testDir);
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  afterEach(async () => {
    // Clean up generated projects
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.remove(path.join(testDir, file));
    }
  });

  describe('React TypeScript Project', () => {
    it('should generate a React TypeScript project with zero errors', async () => {
      const config: ProjectConfig = {
        name: 'test-react-app',
        type: ProjectType.REACT_TYPESCRIPT,
        outputDir: testDir,
        features: {
          testing: true,
          linting: true,
          prettier: true,
          husky: true
        }
      };

      const result = await generationService.generateProject(config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.gitInitialized).toBe(true);

      // Verify project structure
      const projectPath = result.projectPath;
      expect(await fs.pathExists(projectPath)).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'package.json'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'tsconfig.json'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, '.git'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, '.gitignore'))).toBe(true);

      // Verify zero TypeScript errors
      const { stdout: tscOutput } = await execAsync('npm run typecheck', { cwd: projectPath });
      expect(tscOutput).not.toContain('error');

      // Verify zero ESLint errors
      const { stdout: lintOutput } = await execAsync('npm run lint', { cwd: projectPath });
      expect(lintOutput).not.toContain('error');

      // Verify tests pass
      await expect(
        execAsync('npm test -- --watchAll=false', { cwd: projectPath })
      ).resolves.not.toThrow();

      // Verify build succeeds
      await expect(
        execAsync('npm run build', { cwd: projectPath })
      ).resolves.not.toThrow();
    }, 120000); // 2 minute timeout for full generation and validation
  });

  describe('Next.js Project', () => {
    it('should generate a Next.js project with zero errors', async () => {
      const config: ProjectConfig = {
        name: 'test-nextjs-app',
        type: ProjectType.NEXTJS,
        outputDir: testDir,
        features: {
          linting: true,
          prettier: true
        }
      };

      const result = await generationService.generateProject(config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const projectPath = result.projectPath;

      // Verify Next.js specific files
      expect(await fs.pathExists(path.join(projectPath, 'next.config.js'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'src/pages'))).toBe(true);

      // Verify zero errors
      const { stdout: lintOutput } = await execAsync('npm run lint', { cwd: projectPath });
      expect(lintOutput).not.toContain('error');

      const { stdout: tscOutput } = await execAsync('npm run typecheck', { cwd: projectPath });
      expect(tscOutput).not.toContain('error');
    }, 120000);
  });

  describe('Express TypeScript Project', () => {
    it('should generate an Express TypeScript project with zero errors', async () => {
      const config: ProjectConfig = {
        name: 'test-express-api',
        type: ProjectType.EXPRESS_TYPESCRIPT,
        outputDir: testDir,
        features: {
          testing: true,
          docker: true
        }
      };

      const result = await generationService.generateProject(config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const projectPath = result.projectPath;

      // Verify Express specific files
      expect(await fs.pathExists(path.join(projectPath, 'src/index.ts'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'Dockerfile'))).toBe(true);

      // Verify zero errors
      const { stdout: tscOutput } = await execAsync('npm run typecheck', { cwd: projectPath });
      expect(tscOutput).not.toContain('error');

      // Verify tests pass
      await expect(
        execAsync('npm test', { cwd: projectPath })
      ).resolves.not.toThrow();
    }, 120000);
  });

  describe('Python FastAPI Project', () => {
    it('should generate a Python FastAPI project with zero errors', async () => {
      const config: ProjectConfig = {
        name: 'test-fastapi-app',
        type: ProjectType.PYTHON_FASTAPI,
        outputDir: testDir,
        features: {
          testing: true,
          docker: true,
          cicd: true
        }
      };

      const result = await generationService.generateProject(config);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const projectPath = result.projectPath;

      // Verify Python project structure
      expect(await fs.pathExists(path.join(projectPath, 'pyproject.toml'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'src/main.py'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, 'tests'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, '.github/workflows/ci.yml'))).toBe(true);

      // Note: Python quality checks would require Python environment
      // In a real test environment, we would run:
      // - mypy src tests
      // - flake8 src tests
      // - pytest
    }, 120000);
  });

  describe('Git Integration', () => {
    it('should initialize Git repository with quality hooks', async () => {
      const config: ProjectConfig = {
        name: 'test-git-hooks',
        type: ProjectType.REACT_TYPESCRIPT,
        outputDir: testDir
      };

      const result = await generationService.generateProject(config);
      const projectPath = result.projectPath;

      // Verify Git initialization
      expect(await fs.pathExists(path.join(projectPath, '.git'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, '.git/hooks/pre-commit'))).toBe(true);
      expect(await fs.pathExists(path.join(projectPath, '.git/hooks/commit-msg'))).toBe(true);

      // Verify initial commit exists
      const { stdout } = await execAsync('git log --oneline', { cwd: projectPath });
      expect(stdout).toContain('initial project setup');
    }, 60000);
  });

  describe('Quality Dashboard', () => {
    it('should track generated projects in dashboard', async () => {
      const dashboard = (generationService as any).dashboard;
      const initialData = await dashboard.getDashboardData();
      const initialCount = initialData.totalProjectsGenerated;

      // Generate a project
      const config: ProjectConfig = {
        name: 'test-dashboard-tracking',
        type: ProjectType.REACT_TYPESCRIPT,
        outputDir: testDir
      };

      await generationService.generateProject(config);

      // Check dashboard was updated
      const updatedData = await dashboard.getDashboardData();
      expect(updatedData.totalProjectsGenerated).toBe(initialCount + 1);
      expect(updatedData.zeroErrorRate).toBe(100);
      expect(updatedData.recentProjects[0].name).toBe('test-dashboard-tracking');
      expect(updatedData.recentProjects[0].passed).toBe(true);
    }, 60000);
  });

  describe('Error Prevention', () => {
    it('should reject invalid project configurations', async () => {
      const config: ProjectConfig = {
        name: '.invalid-name', // Invalid name starting with dot
        type: ProjectType.REACT_TYPESCRIPT,
        outputDir: testDir
      };

      const result = await generationService.generateProject(config);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Project name cannot start with a dot');
    });

    it('should prevent Python projects from having incompatible features', async () => {
      const config: ProjectConfig = {
        name: 'test-python-husky',
        type: ProjectType.PYTHON_FASTAPI,
        outputDir: testDir,
        features: {
          husky: true // Husky is not compatible with Python
        }
      };

      const result = await generationService.generateProject(config);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Husky is not compatible'))).toBe(true);
    });
  });
});

// Integration test to verify zero-error generation end-to-end
describe('End-to-End Zero-Error Validation', () => {
  it('should maintain 100% zero-error rate across multiple project types', async () => {
    const testDir = path.join(process.cwd(), '.e2e-test-generation');
    await fs.ensureDir(testDir);

    const service = new ProjectGenerationService();
    const projectTypes = [
      ProjectType.REACT_TYPESCRIPT,
      ProjectType.NEXTJS,
      ProjectType.EXPRESS_TYPESCRIPT,
      ProjectType.PYTHON_FASTAPI
    ];

    const results = [];

    for (const type of projectTypes) {
      const config: ProjectConfig = {
        name: `e2e-test-${type}`,
        type,
        outputDir: testDir,
        features: {
          testing: true,
          linting: true,
          prettier: true
        }
      };

      const result = await service.generateProject(config);
      results.push(result);

      // Clean up to save space
      if (result.success) {
        await fs.remove(result.projectPath);
      }
    }

    // Verify all projects generated successfully
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(projectTypes.length);

    // Verify zero-error rate is 100%
    const dashboard = (service as any).dashboard;
    const dashboardData = await dashboard.getDashboardData();
    expect(dashboardData.zeroErrorRate).toBe(100);

    await fs.remove(testDir);
  }, 300000); // 5 minute timeout for all projects
});