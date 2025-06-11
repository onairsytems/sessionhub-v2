import { SessionService } from '../mocks/MockSessionService';
import { ProjectManager } from '../mocks/MockProjectManager';
import { GitVersioningService } from '../mocks/MockGitVersioningService';
import { IDEAdapter } from '../../main/services/ideAdapter';
import { PlanningEngine } from '../../src/services/planning/PlanningEngine';
import { ExecutionEngine } from '../../src/services/execution/ExecutionEngine';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Real-World Scenario Tests', () => {
  let sessionService: SessionService;
  let projectManager: ProjectManager;
  let gitService: GitVersioningService;
  let ideAdapter: IDEAdapter;
  let planningEngine: PlanningEngine;
  let executionEngine: ExecutionEngine;
  
  const testWorkspace = join(__dirname, '../../test-workspace');

  beforeEach(async () => {
    // Initialize services
    sessionService = new SessionService();
    projectManager = new ProjectManager();
    gitService = new GitVersioningService();
    ideAdapter = new IDEAdapter();
    planningEngine = new PlanningEngine();
    executionEngine = new ExecutionEngine();

    // Create test workspace
    mkdirSync(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test workspace
    rmSync(testWorkspace, { recursive: true, force: true });
  });

  describe('Multi-Project Development Workflow', () => {
    it('should handle multiple projects with different tech stacks', async () => {
      // Create multiple projects
      const projects = [
        {
          name: 'Frontend App',
          type: 'next' as const,
          path: join(testWorkspace, 'frontend'),
          dependencies: { react: '^18.0.0', next: '^14.0.0' }
        },
        {
          name: 'Backend API',
          type: 'express' as const,
          path: join(testWorkspace, 'backend'),
          dependencies: { express: '^4.18.0', typescript: '^5.0.0' }
        },
        {
          name: 'Mobile App',
          type: 'react-native' as const,
          path: join(testWorkspace, 'mobile'),
          dependencies: { 'react-native': '^0.72.0' }
        }
      ];

      // Initialize projects
      for (const project of projects) {
        mkdirSync(project.path, { recursive: true });
        writeFileSync(
          join(project.path, 'package.json'),
          JSON.stringify({
            name: project.name.toLowerCase().replace(' ', '-'),
            version: '1.0.0',
            dependencies: project.dependencies
          }, null, 2)
        );

        await projectManager.importProject(project.path);
      }

      // Verify all projects imported
      const importedProjects = await projectManager.listProjects();
      expect(importedProjects).toHaveLength(3);

      // Create cross-project session
      const session = await sessionService.createSession({
        title: 'Implement Authentication Flow',
        objectives: 'Add authentication to all three applications',
        projectContext: {
          primaryProject: projects[0].path,
          relatedProjects: projects.slice(1).map(p => p.path)
        }
      });

      // Start session
      await sessionService.startSession(session.id);

      // Generate plan for multi-project feature
      const plan = await planningEngine.generatePlan({
        objective: session.objectives,
        context: {
          projects: importedProjects,
          crossProjectDependencies: true
        }
      });

      expect(plan.instructions).toContainEqual(
        expect.objectContaining({
          type: 'code',
          project: 'frontend',
          description: expect.stringContaining('authentication UI')
        })
      );

      expect(plan.instructions).toContainEqual(
        expect.objectContaining({
          type: 'code',
          project: 'backend',
          description: expect.stringContaining('auth endpoints')
        })
      );

      expect(plan.instructions).toContainEqual(
        expect.objectContaining({
          type: 'code',
          project: 'mobile',
          description: expect.stringContaining('auth screens')
        })
      );

      // Execute plan across projects
      const results = await executionEngine.executeMultiProject(plan.instructions);

      expect(results.projects.frontend.success).toBe(true);
      expect(results.projects.backend.success).toBe(true);
      expect(results.projects.mobile.success).toBe(true);

      // Verify consistency across projects
      const apiEndpoints = results.projects.backend.filesCreated
        .filter(f => f.includes('auth'))
        .map(f => f.match(/\/api\/auth\/(\w+)/)?.[1])
        .filter(Boolean) as string[];

      const frontendCalls = results.projects.frontend.filesModified
        .flatMap(f => f.content?.match(/\/api\/auth\/(\w+)/g) || [])
        .map(m => m.split('/').pop())
        .filter(Boolean) as string[];

      // Frontend should call all backend endpoints
      expect(frontendCalls.sort()).toEqual(apiEndpoints.sort());
    });

    it('should handle project switching during active session', async () => {
      // Create two projects
      const project1 = await projectManager.importProject(
        join(testWorkspace, 'project1')
      );
      const project2 = await projectManager.importProject(
        join(testWorkspace, 'project2')
      );

      // Start session in project1
      const session = await sessionService.createSession({
        title: 'Feature Development',
        objectives: 'Implement new feature',
        projectContext: project1
      });

      await sessionService.startSession(session.id);

      // Add some work to project1
      await executionEngine.execute([
        { id: '1', type: 'code', content: 'Create component' }
      ], { projectId: project1.id });

      // Switch to project2 mid-session
      await sessionService.switchProject(session.id, project2.id);

      // Continue work in project2
      await executionEngine.execute([
        { id: '2', type: 'code', content: 'Create related component' }
      ], { projectId: project2.id });

      // Complete session
      await sessionService.completeSession(session.id);

      // Verify work tracked in both projects
      const sessionData = await sessionService.getSession(session.id);
      expect(sessionData.projectsAffected).toContain(project1.id);
      expect(sessionData.projectsAffected).toContain(project2.id);
    });
  });

  describe('Complex Git Workflows', () => {
    it('should handle feature branch workflow with conflicts', async () => {
      const projectPath = join(testWorkspace, 'git-project');
      mkdirSync(projectPath);
      
      // Initialize git repo
      execSync('git init', { cwd: projectPath });
      execSync('git config user.email "test@example.com"', { cwd: projectPath });
      execSync('git config user.name "Test User"', { cwd: projectPath });

      // Create initial commit
      writeFileSync(join(projectPath, 'README.md'), '# Test Project\n');
      execSync('git add .', { cwd: projectPath });
      execSync('git commit -m "Initial commit"', { cwd: projectPath });

      // Import project
      const project = await projectManager.importProject(projectPath);

      // Create feature branch session
      const session = await sessionService.createSession({
        title: 'Add Authentication',
        objectives: 'Implement auth system',
        projectContext: project
      });

      await sessionService.startSession(session.id);

      // Create feature branch
      await gitService.createBranch('feature/auth', projectPath);

      // Make changes on feature branch
      writeFileSync(join(projectPath, 'auth.js'), 'exports.login = () => {};\n');
      await gitService.commit('Add auth module', projectPath);

      // Simulate changes on main branch (creating conflict)
      await gitService.switchBranch('main', projectPath);
      writeFileSync(join(projectPath, 'auth.js'), 'exports.authenticate = () => {};\n');
      await gitService.commit('Add different auth', projectPath);

      // Switch back to feature branch
      await gitService.switchBranch('feature/auth', projectPath);

      // Attempt merge (should detect conflict)
      const mergeResult = await gitService.mergeBranch('main', projectPath);
      expect(mergeResult.hasConflicts).toBe(true);
      expect(mergeResult.conflicts).toContain('auth.js');

      // Use AI to resolve conflict
      const resolution = await planningEngine.resolveConflict({
        file: 'auth.js',
        ours: 'exports.login = () => {};',
        theirs: 'exports.authenticate = () => {};',
        context: 'Implementing authentication system'
      });

      // Apply resolution
      writeFileSync(join(projectPath, 'auth.js'), resolution.merged);
      await gitService.commit('Resolve auth conflict', projectPath);

      // Complete merge
      const finalMerge = await gitService.completeMerge(projectPath);
      expect(finalMerge.success).toBe(true);
    });

    it('should handle collaborative development with multiple branches', async () => {
      const projectPath = join(testWorkspace, 'collab-project');
      
      // Set up project with multiple feature branches
      await setupCollaborativeProject(projectPath);

      // Import project
      const project = await projectManager.importProject(projectPath);

      // Simulate multiple developers working
      const sessions = await Promise.all([
        createDeveloperSession('Dev 1', 'feature/ui-updates', project),
        createDeveloperSession('Dev 2', 'feature/api-endpoints', project),
        createDeveloperSession('Dev 3', 'feature/database-schema', project)
      ]);

      // Each developer makes changes
      await Promise.all(sessions.map(async (session, _index) => {
        await gitService.switchBranch(session.branch, projectPath);
        
        const _changes = await executionEngine.execute([
          {
            id: `${_index}-1`,
            type: 'code',
            content: `Implement ${session.feature}`
          }
        ], { projectId: project.id });

        await gitService.commit(
          `${session.developer}: ${session.feature}`,
          projectPath
        );
      }));

      // Integrate all changes
      await gitService.switchBranch('develop', projectPath);
      
      for (const session of sessions) {
        const mergeResult = await gitService.mergeBranch(
          session.branch,
          projectPath
        );
        expect(mergeResult.success).toBe(true);
      }

      // Verify all changes integrated
      const log = execSync('git log --oneline -10', {
        cwd: projectPath,
        encoding: 'utf-8'
      });

      sessions.forEach(session => {
        expect(log).toContain(session.developer);
      });
    });
  });

  describe('IDE Integration Scenarios', () => {
    it('should coordinate with multiple IDEs', async () => {
      const project = await projectManager.importProject(
        join(testWorkspace, 'ide-project')
      );

      // Detect available IDEs
      const availableIDEs = await ideAdapter.detectIDEs();
      
      // Create session
      const session = await sessionService.createSession({
        title: 'Cross-IDE Development',
        objectives: 'Test IDE coordination',
        projectContext: project
      });

      await sessionService.startSession(session.id);

      // Open project in primary IDE
      if (availableIDEs.includes('vscode')) {
        await ideAdapter.openInIDE('vscode', project.path);
      }

      // Make changes through SessionHub
      const plan = await planningEngine.generatePlan({
        objective: 'Create a new React component',
        context: project
      });

      const results = await executionEngine.execute(plan.instructions);

      // Verify IDE picks up changes
      if (availableIDEs.includes('vscode')) {
        const ideState = await ideAdapter.getIDEState('vscode');
        expect(ideState.openFiles).toContainEqual(
          expect.stringContaining('component')
        );
      }

      // Test IDE command execution
      if (availableIDEs.includes('vscode')) {
        await ideAdapter.executeIDECommand('vscode', 'workbench.action.terminal.new');
        await ideAdapter.executeIDECommand('vscode', 'npm test');
      }
    });

    it('should handle IDE crashes gracefully', async () => {
      const project = await projectManager.importProject(
        join(testWorkspace, 'crash-test')
      );

      // Start session
      const session = await sessionService.createSession({
        title: 'IDE Crash Test',
        objectives: 'Test crash recovery',
        projectContext: project
      });

      await sessionService.startSession(session.id);

      // Simulate IDE crash
      jest.spyOn(ideAdapter, 'openInIDE').mockRejectedValueOnce(
        new Error('IDE crashed')
      );

      // Attempt to open in IDE
      await expect(ideAdapter.openInIDE('vscode', project.path))
        .rejects.toThrow('IDE crashed');

      // Session should continue without IDE
      const plan = await planningEngine.generatePlan({
        objective: 'Continue development',
        context: project
      });

      const results = await executionEngine.execute(plan.instructions);
      expect(results.success).toBe(true);

      // Attempt IDE recovery
      const recovered = await ideAdapter.recoverIDE('vscode');
      expect(recovered).toBe(true);
    });
  });

  describe('Large-Scale Refactoring', () => {
    it('should handle project-wide refactoring', async () => {
      // Create large project structure
      const projectPath = join(testWorkspace, 'large-project');
      await createLargeProject(projectPath, {
        modules: 10,
        filesPerModule: 20,
        linesPerFile: 200
      });

      const project = await projectManager.importProject(projectPath);

      // Create refactoring session
      const session = await sessionService.createSession({
        title: 'Migrate to TypeScript',
        objectives: 'Convert entire JavaScript codebase to TypeScript',
        projectContext: project
      });

      await sessionService.startSession(session.id);

      // Plan refactoring
      const plan = await planningEngine.generatePlan({
        objective: 'Migrate JavaScript project to TypeScript',
        context: {
          project,
          fileCount: 200,
          estimatedLOC: 40000
        }
      });

      expect(plan.strategy).toContain('incremental');
      expect(plan.estimatedTime).toBeGreaterThan(120); // More than 2 hours

      // Execute refactoring in batches
      const batchSize = 20;
      const batches = [];
      
      for (let i = 0; i < plan.instructions.length; i += batchSize) {
        batches.push(plan.instructions.slice(i, i + batchSize));
      }

      const results = [];
      for (const [index, batch] of batches.entries()) {
        console.log(`Processing batch ${index + 1}/${batches.length}`);
        
        const batchResult = await executionEngine.execute(batch, {
          parallel: true,
          maxConcurrency: 5
        });

        results.push(batchResult);

        // Verify incremental progress
        expect(batchResult.filesModified.length).toBeGreaterThan(0);
        expect(batchResult.success).toBe(true);
      }

      // Verify complete migration
      const jsFiles = execSync('find . -name "*.js" | wc -l', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      const tsFiles = execSync('find . -name "*.ts" | wc -l', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      expect(parseInt(jsFiles)).toBe(0);
      expect(parseInt(tsFiles)).toBeGreaterThan(150);

      // Run TypeScript compiler
      execSync('npx tsc --noEmit', { cwd: projectPath });
    });

    it('should handle database migration scenarios', async () => {
      const projectPath = join(testWorkspace, 'db-project');
      mkdirSync(projectPath);

      // Set up project with database
      await setupDatabaseProject(projectPath);

      const project = await projectManager.importProject(projectPath);

      // Create migration session
      const session = await sessionService.createSession({
        title: 'Database Schema Update',
        objectives: 'Migrate from PostgreSQL to MongoDB',
        projectContext: project
      });

      await sessionService.startSession(session.id);

      // Plan migration
      const plan = await planningEngine.generatePlan({
        objective: 'Migrate relational database to NoSQL',
        context: {
          project,
          sourceDB: 'postgresql',
          targetDB: 'mongodb',
          tables: ['users', 'products', 'orders'],
          dataSize: '10GB'
        }
      });

      // Execute migration plan
      const results = await executionEngine.execute(plan.instructions);

      // Verify migration artifacts created
      expect(results.filesCreated).toContainEqual(
        expect.stringContaining('migration-script.js')
      );
      expect(results.filesCreated).toContainEqual(
        expect.stringContaining('rollback-script.js')
      );
      expect(results.filesCreated).toContainEqual(
        expect.stringContaining('data-validation.js')
      );

      // Verify models updated
      const userModel = results.filesModified.find(f => 
        f.includes('models/user')
      );
      expect(userModel).toBeTruthy();
    });
  });
});

// Helper functions
async function setupCollaborativeProject(projectPath: string) {
  mkdirSync(projectPath, { recursive: true });
  
  execSync('git init', { cwd: projectPath });
  execSync('git config user.email "test@example.com"', { cwd: projectPath });
  execSync('git config user.name "Test User"', { cwd: projectPath });
  
  writeFileSync(join(projectPath, 'README.md'), '# Collaborative Project\n');
  execSync('git add .', { cwd: projectPath });
  execSync('git commit -m "Initial commit"', { cwd: projectPath });
  
  execSync('git checkout -b develop', { cwd: projectPath });
  execSync('git checkout -b feature/ui-updates', { cwd: projectPath });
  execSync('git checkout -b feature/api-endpoints develop', { cwd: projectPath });
  execSync('git checkout -b feature/database-schema develop', { cwd: projectPath });
  execSync('git checkout develop', { cwd: projectPath });
}

async function createDeveloperSession(developer: string, branch: string, project: any) {
  return {
    developer,
    branch,
    feature: branch.split('/')[1].replace('-', ' '),
    projectId: project.id
  };
}

async function createLargeProject(projectPath: string, config: {
  modules: number;
  filesPerModule: number;
  linesPerFile: number;
}) {
  mkdirSync(projectPath, { recursive: true });
  
  // Create package.json
  writeFileSync(
    join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'large-project',
      version: '1.0.0',
      scripts: {
        build: 'echo "Building..."',
        test: 'echo "Testing..."'
      }
    }, null, 2)
  );

  // Create modules
  for (let m = 0; m < config.modules; m++) {
    const modulePath = join(projectPath, `module-${m}`);
    mkdirSync(modulePath);

    // Create files in each module
    for (let f = 0; f < config.filesPerModule; f++) {
      const content = generateJavaScriptFile(
        `Module${m}File${f}`,
        config.linesPerFile
      );
      
      writeFileSync(
        join(modulePath, `file-${f}.js`),
        content
      );
    }

    // Create index file
    const imports = Array(config.filesPerModule)
      .fill(null)
      .map((_, i) => `const file${i} = require('./file-${i}');`)
      .join('\n');

    writeFileSync(
      join(modulePath, 'index.js'),
      `${imports}\n\nmodule.exports = { ${Array(config.filesPerModule)
        .fill(null)
        .map((_, i) => `file${i}`)
        .join(', ')} };`
    );
  }
}

function generateJavaScriptFile(className: string, lines: number): string {
  const methods = Math.floor(lines / 10);
  let content = `// ${className}.js\n\n`;
  
  content += `class ${className} {\n`;
  content += `  constructor() {\n    this.data = [];\n  }\n\n`;
  
  for (let i = 0; i < methods; i++) {
    content += `  method${i}(param) {\n`;
    content += `    // Method implementation\n`;
    content += `    console.log('Executing method${i}');\n`;
    content += `    return param * 2;\n`;
    content += `  }\n\n`;
  }
  
  content += `}\n\nmodule.exports = ${className};`;
  
  return content;
}

async function setupDatabaseProject(projectPath: string) {
  mkdirSync(join(projectPath, 'models'), { recursive: true });
  mkdirSync(join(projectPath, 'migrations'), { recursive: true });
  
  // Create sample models
  writeFileSync(
    join(projectPath, 'models/user.js'),
    `const { Model } = require('sequelize');
    
class User extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: { type: DataTypes.INTEGER, primaryKey: true },
      email: { type: DataTypes.STRING, unique: true },
      name: DataTypes.STRING
    }, { sequelize, modelName: 'User' });
  }
}

module.exports = User;`
  );

  writeFileSync(
    join(projectPath, 'package.json'),
    JSON.stringify({
      name: 'db-project',
      version: '1.0.0',
      dependencies: {
        sequelize: '^6.0.0',
        pg: '^8.0.0'
      }
    }, null, 2)
  );
}