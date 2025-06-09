import { FigmaMCPService } from './FigmaMCPService';
import { Logger } from '../../lib/logging/Logger';
import { execSync } from 'child_process';
import * as path from 'path';

interface Project {
  id: string;
  name: string;
  path: string;
  framework: 'react' | 'vue' | 'angular' | 'next' | 'nuxt';
  gitRepo?: string;
  figmaFileKey?: string;
}

interface UIEnhancementSession {
  id: string;
  projectId: string;
  figmaFileKey: string;
  status: 'analyzing' | 'generating' | 'deploying' | 'completed' | 'failed';
  changes?: any;
  deploymentUrl?: string;
}

export class ProjectUIEnhancer {
  private logger: Logger;
  private figmaService: FigmaMCPService;
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, UIEnhancementSession> = new Map();

  constructor() {
    this.logger = new Logger('ProjectUIEnhancer');
    this.figmaService = new FigmaMCPService();
  }

  /**
   * Initialize with Figma API
   */
  async initialize(figmaApiKey: string): Promise<void> {
    await this.figmaService.initialize(figmaApiKey);
  }

  /**
   * Register a project for UI enhancement
   */
  registerProject(project: Project): void {
    this.projects.set(project.id, project);
    this.logger.info(`Registered project: ${project.name}`);
  }

  /**
   * Start UI enhancement session for a project
   */
  async startEnhancementSession(
    projectId: string,
    figmaFileKey: string
  ): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const sessionId = `enhance-${projectId}-${Date.now()}`;
    const session: UIEnhancementSession = {
      id: sessionId,
      projectId,
      figmaFileKey,
      status: 'analyzing'
    };

    this.sessions.set(sessionId, session);
    this.logger.info(`Starting enhancement session ${sessionId} for ${project.name}`);

    // Run enhancement workflow async
    this.runEnhancementWorkflow(sessionId, project, figmaFileKey).catch(error => {
      this.logger.error(`Enhancement session ${sessionId} failed:`, error);
      session.status = 'failed';
    });

    return sessionId;
  }

  /**
   * Run the enhancement workflow
   */
  private async runEnhancementWorkflow(
    sessionId: string,
    project: Project,
    figmaFileKey: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;

    try {
      // Step 1: Analyze project UI
      this.updateSessionStatus(sessionId, 'analyzing');
      const analysis = await this.figmaService.analyzeProjectUI(project.id, figmaFileKey);
      
      this.logger.info(`Analysis complete for ${project.name}:`, {
        components: analysis.currentImplementation.length,
        differences: analysis.differences.length
      });

      // Step 2: Generate UI updates
      this.updateSessionStatus(sessionId, 'generating');
      const changes = await this.figmaService.generateProjectUIUpdates(
        project.id,
        figmaFileKey
      );
      
      session.changes = changes;

      // Step 3: Deploy to staging
      this.updateSessionStatus(sessionId, 'deploying');
      const deploymentUrl = await this.deployToStaging(project, changes);
      session.deploymentUrl = deploymentUrl;

      // Step 4: Complete
      this.updateSessionStatus(sessionId, 'completed');
      this.logger.info(`Enhancement session ${sessionId} completed. Preview: ${deploymentUrl}`);

    } catch (error) {
      session.status = 'failed';
      throw error;
    }
  }

  /**
   * Deploy changes to staging environment
   */
  private async deployToStaging(project: Project, changes: any): Promise<string> {
    const stagingBranch = `figma-ui-update-${Date.now()}`;
    
    // Navigate to project directory
    const originalDir = process.cwd();
    process.chdir(project.path);

    try {
      // Create staging branch
      execSync(`git checkout -b ${stagingBranch}`);

      // Apply changes
      for (const change of changes.files) {
        await this.applyFileChange(change);
      }

      // Commit changes
      execSync('git add -A');
      execSync(`git commit -m "UI Update from Figma: ${changes.summary}"`);

      // Deploy based on framework
      const deploymentUrl = await this.deployFrameworkProject(project, stagingBranch);

      // Return to original directory
      process.chdir(originalDir);

      return deploymentUrl;

    } catch (error) {
      // Cleanup
      execSync('git checkout main');
      execSync(`git branch -D ${stagingBranch}`);
      process.chdir(originalDir);
      throw error;
    }
  }

  /**
   * Deploy project based on framework
   */
  private async deployFrameworkProject(project: Project, branch: string): Promise<string> {
    switch (project.framework) {
      case 'next':
      case 'react':
        // Deploy to Vercel
        return await this.deployToVercel(project, branch);
      
      case 'nuxt':
      case 'vue':
        // Deploy to Netlify
        return await this.deployToNetlify(project, branch);
      
      default:
        // Generic deployment
        return await this.deployGeneric(project, branch);
    }
  }

  /**
   * Deploy to Vercel
   */
  private async deployToVercel(_project: Project, branch: string): Promise<string> {
    try {
      // Push branch
      execSync(`git push origin ${branch}`);

      // Deploy using Vercel CLI
      const output = execSync('vercel --yes', { encoding: 'utf-8' });
      
      // Extract deployment URL
      const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
      return urlMatch ? urlMatch[0] : 'Deployment URL not found';

    } catch (error) {
      throw new Error(`Vercel deployment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Deploy to Netlify
   */
  private async deployToNetlify(_project: Project, _branch: string): Promise<string> {
    try {
      // Build project
      execSync('npm run build');

      // Deploy using Netlify CLI
      const output = execSync('netlify deploy --prod', { encoding: 'utf-8' });
      
      // Extract deployment URL
      const urlMatch = output.match(/https:\/\/[^\s]+\.netlify\.app/);
      return urlMatch ? urlMatch[0] : 'Deployment URL not found';

    } catch (error) {
      throw new Error(`Netlify deployment failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generic deployment
   */
  private async deployGeneric(_project: Project, branch: string): Promise<string> {
    // Build project
    execSync('npm run build');
    
    // Return local preview URL
    return `http://localhost:3000/preview/${branch}`;
  }

  /**
   * Apply file change to project
   */
  private async applyFileChange(change: any): Promise<void> {
    const fs = require('fs').promises;
    
    switch (change.action) {
      case 'create':
      case 'update':
        await fs.mkdir(path.dirname(change.path), { recursive: true });
        await fs.writeFile(change.path, change.content);
        break;
      
      case 'delete':
        await fs.unlink(change.path);
        break;
    }
  }

  /**
   * Merge UI changes to main branch
   */
  async mergeUIChanges(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'completed') {
      throw new Error('Session not ready for merge');
    }

    const project = this.projects.get(session.projectId)!;
    
    // Navigate to project
    const originalDir = process.cwd();
    process.chdir(project.path);

    try {
      // Create PR or merge directly
      if (project.gitRepo) {
        // Create PR
        execSync(`gh pr create --title "UI Update from Figma" --body "Session: ${sessionId}"`);
      } else {
        // Direct merge
        execSync('git checkout main');
        execSync(`git merge --no-ff figma-ui-update-* -m "Merge UI updates from Figma"`);
      }

      process.chdir(originalDir);

    } catch (error) {
      process.chdir(originalDir);
      throw error;
    }
  }

  /**
   * Get all projects with Figma connections
   */
  getFigmaEnabledProjects(): Project[] {
    return Array.from(this.projects.values())
      .filter(p => p.figmaFileKey);
  }

  /**
   * Batch update multiple projects
   */
  async batchUpdateProjects(figmaUpdates: Array<{ projectId: string; figmaFileKey: string }>): Promise<string[]> {
    const sessionIds: string[] = [];

    for (const update of figmaUpdates) {
      try {
        const sessionId = await this.startEnhancementSession(
          update.projectId,
          update.figmaFileKey
        );
        sessionIds.push(sessionId);

        // Add delay between projects
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        this.logger.error(`Failed to update project ${update.projectId}:`, error as Error);
      }
    }

    return sessionIds;
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): UIEnhancementSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): UIEnhancementSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'completed' && s.status !== 'failed');
  }

  /**
   * Helper methods
   */
  private updateSessionStatus(
    sessionId: string,
    status: UIEnhancementSession['status']
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      this.logger.info(`Session ${sessionId} status: ${status}`);
    }
  }
}