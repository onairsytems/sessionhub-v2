import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { 
  IZedAdapter, 
  WorkspaceInfo, 
  FileOperation, 
  IDEConnectionStatus,
  ZedWorkspaceConfig 
} from '../../interfaces/IIDEAdapter';
import { BaseProjectContext } from '../../models/ProjectContext';
import { ZedConnectionManager } from './ZedConnectionManager';
import { ZedAgentPanelAdapter } from './ZedAgentPanelAdapter';
import { ZedSlashCommandHandler } from './ZedSlashCommandHandler';
import { ZedInstructionFlowService } from './ZedInstructionFlowService';
import { ZedBoundaryEnforcer } from './ZedBoundaryEnforcer';
import { ZedActorSyncService } from './ZedActorSyncService';
import * as chokidar from 'chokidar';

const execAsync = promisify(exec);

export class ZedAdapter extends EventEmitter implements IZedAdapter {
  private connectionManager: ZedConnectionManager;
  private agentPanelAdapter: ZedAgentPanelAdapter;
  private slashCommandHandler: ZedSlashCommandHandler;
  private instructionFlowService: ZedInstructionFlowService;
  private boundaryEnforcer: ZedBoundaryEnforcer;
  private actorSyncService: ZedActorSyncService;
  private activeWorkspace: WorkspaceInfo | null = null;
  private fileWatcher?: chokidar.FSWatcher;
  private mcpServerUrl?: string;
  private authToken?: string;

  constructor() {
    super();
    this.connectionManager = new ZedConnectionManager({
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      healthCheckInterval: 10000
    });

    // Initialize Two-Actor components
    this.agentPanelAdapter = new ZedAgentPanelAdapter();
    this.instructionFlowService = new ZedInstructionFlowService(this.agentPanelAdapter);
    this.boundaryEnforcer = new ZedBoundaryEnforcer();
    this.slashCommandHandler = new ZedSlashCommandHandler(this.agentPanelAdapter);
    this.actorSyncService = new ZedActorSyncService(
      this.agentPanelAdapter,
      this.instructionFlowService,
      this.boundaryEnforcer
    );

    // Forward connection events
    this.connectionManager.on('connected', () => this.emit('connected'));
    this.connectionManager.on('disconnected', () => this.emit('disconnected'));
    this.connectionManager.on('connection-failed', (error) => this.emit('connection-failed', error));
    this.connectionManager.on('health-check', (health) => this.emit('health-check', health));

    // Set up Two-Actor event handling
    this.setupTwoActorEventHandlers();
  }

  private setupTwoActorEventHandlers(): void {
    // Handle slash command executions
    this.slashCommandHandler.on('execute-plan', async (data) => {
      const flowId = await this.instructionFlowService.createFlow(data.instruction);
      await this.instructionFlowService.executeFlow(flowId);
    });

    // Handle boundary violations
    this.boundaryEnforcer.on('violation-detected', (violation) => {
      this.emit('boundary-violation', violation);
    });

    // Handle actor sync updates
    this.actorSyncService.on('state-updated', (state) => {
      this.emit('actor-state-update', state);
    });

    // Handle instruction flow events
    this.instructionFlowService.on('flow-completed', (flow) => {
      this.emit('execution-complete', {
        flowId: flow.id,
        duration: flow.completedAt!.getTime() - flow.createdAt.getTime()
      });
    });
  }

  async connect(): Promise<void> {
    // Retrieve stored credentials or prompt for new ones
    let credentials = await this.connectionManager.retrieveCredentials();
    
    if (!credentials) {
      throw new Error('No Zed credentials found. Please configure credentials first.');
    }

    await this.connectionManager.initialize(credentials);
    
    // Initialize Two-Actor components
    await this.agentPanelAdapter.initialize();
    this.actorSyncService.startSync();
  }

  async disconnect(): Promise<void> {
    await this.connectionManager.disconnect();
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = undefined;
    }
    
    // Shutdown Two-Actor components
    this.actorSyncService.stopSync();
    await this.agentPanelAdapter.shutdown();
  }

  async getConnectionStatus(): Promise<IDEConnectionStatus> {
    const health = await this.connectionManager.getConnectionHealth();
    const version = health.isZedRunning ? await this.getIDEVersion() : undefined;

    return {
      connected: health.isConnected,
      version,
      apiAvailable: health.isMCPAvailable,
      lastError: health.errors[0],
      lastCheckTime: health.lastHealthCheck
    };
  }

  async validateCredentials(): Promise<boolean> {
    const test = await this.connectionManager.testConnection();
    return test.diagnostics.credentialsValid;
  }

  async openWorkspace(workspacePath: string): Promise<void> {
    try {
      // Ensure the path exists
      await fs.access(workspacePath);

      // Open workspace in Zed
      await execAsync(`zed "${workspacePath}"`);
      
      // Wait for Zed to open
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.activeWorkspace = {
        rootPath: workspacePath,
        name: path.basename(workspacePath)
      };

      this.emit('workspace-opened', this.activeWorkspace);
    } catch (error) {
      throw new Error(`Failed to open workspace: ${error}`);
    }
  }

  async closeWorkspace(): Promise<void> {
    // Zed doesn't have a direct API to close workspaces
    // We'll clear our internal state
    this.activeWorkspace = null;
    this.emit('workspace-closed');
  }

  async getActiveWorkspace(): Promise<WorkspaceInfo | null> {
    return this.activeWorkspace;
  }

  async switchWorkspace(workspacePath: string): Promise<void> {
    // Zed opens new workspaces in new windows by default
    // This provides fast switching
    await this.openWorkspace(workspacePath);
  }

  async openFile(filePath: string): Promise<void> {
    try {
      await execAsync(`zed "${filePath}"`);
    } catch (error) {
      throw new Error(`Failed to open file: ${error}`);
    }
  }

  async saveFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      this.emit('file-saved', filePath);
    } catch (error) {
      throw new Error(`Failed to save file: ${error}`);
    }
  }

  async createFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      this.emit('file-created', filePath);
    } catch (error) {
      throw new Error(`Failed to create file: ${error}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.emit('file-deleted', filePath);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await fs.rename(oldPath, newPath);
      this.emit('file-renamed', { oldPath, newPath });
    } catch (error) {
      throw new Error(`Failed to rename file: ${error}`);
    }
  }

  watchFileChanges(callback: (change: FileOperation) => void): void {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace to watch');
    }

    this.fileWatcher = chokidar.watch(this.activeWorkspace.rootPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    this.fileWatcher
      .on('add', (filePath) => {
        callback({ type: 'create', path: filePath });
      })
      .on('change', (filePath) => {
        callback({ type: 'update', path: filePath });
      })
      .on('unlink', (filePath) => {
        callback({ type: 'delete', path: filePath });
      });
  }

  unwatchFileChanges(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }
  }

  async sendToExecutionActor(instruction: string, context: BaseProjectContext): Promise<void> {
    // Send instruction through MCP to Zed's agent panel
    if (!this.mcpServerUrl || !this.authToken) {
      throw new Error('MCP server not configured');
    }

    // This would communicate with Zed's agent panel via MCP
    const message = {
      type: 'execution-instruction',
      instruction,
      context: {
        projectPath: context.structure.rootPath,
        projectType: context.projectType,
        projectId: context.projectId
      }
    };

    // Implementation would send this to Zed's MCP endpoint
    this.emit('execution-sent', message);
  }

  async getExecutionStatus(): Promise<{ active: boolean; currentTask?: string }> {
    // Query Zed's agent panel for current execution status
    // This is a simplified implementation
    return {
      active: false,
      currentTask: undefined
    };
  }

  async getGitStatus(): Promise<{ branch: string; changes: string[] }> {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace');
    }

    try {
      const { stdout: branch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.activeWorkspace.rootPath }
      );

      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: this.activeWorkspace.rootPath }
      );

      const changes = status
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3));

      return {
        branch: branch.trim(),
        changes
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`);
    }
  }

  async stageFiles(files: string[]): Promise<void> {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace');
    }

    try {
      for (const file of files) {
        await execAsync(
          `git add "${file}"`,
          { cwd: this.activeWorkspace.rootPath }
        );
      }
    } catch (error) {
      throw new Error(`Failed to stage files: ${error}`);
    }
  }

  async commit(message: string): Promise<void> {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace');
    }

    try {
      await execAsync(
        `git commit -m "${message}"`,
        { cwd: this.activeWorkspace.rootPath }
      );
    } catch (error) {
      throw new Error(`Failed to commit: ${error}`);
    }
  }

  async runLinter(): Promise<{ passed: boolean; errors: any[] }> {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace');
    }

    try {
      await execAsync(
        'npm run lint',
        { cwd: this.activeWorkspace.rootPath }
      );

      return {
        passed: true,
        errors: []
      };
    } catch (error: any) {
      // Parse lint errors from stdout/stderr
      return {
        passed: false,
        errors: [error.message]
      };
    }
  }

  async runTypeCheck(): Promise<{ passed: boolean; errors: any[] }> {
    if (!this.activeWorkspace) {
      throw new Error('No active workspace');
    }

    try {
      await execAsync(
        'npm run build:check',
        { cwd: this.activeWorkspace.rootPath }
      );

      return {
        passed: true,
        errors: []
      };
    } catch (error: any) {
      // Parse TypeScript errors from stdout/stderr
      return {
        passed: false,
        errors: [error.message]
      };
    }
  }

  getIDEName(): string {
    return 'Zed';
  }

  async getIDEVersion(): Promise<string> {
    try {
      // Zed doesn't have a direct version command yet
      // We'll check the app bundle for version info
      const plistPath = '/Applications/Zed.app/Contents/Info.plist';
      const { stdout } = await execAsync(
        `defaults read "${plistPath}" CFBundleShortVersionString 2>/dev/null || echo "unknown"`
      );
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  supportsFeature(feature: string): boolean {
    const supportedFeatures = [
      'mcp-integration',
      'agent-panel',
      'fast-launch',
      'collaborative-editing',
      'gpu-acceleration',
      'native-performance',
      'workspace-restoration',
      'language-servers',
      'git-integration'
    ];

    return supportedFeatures.includes(feature);
  }

  // Zed-specific methods
  async configureAgentPanel(config: { mcpServerUrl: string; authToken: string }): Promise<void> {
    this.mcpServerUrl = config.mcpServerUrl;
    this.authToken = config.authToken;

    // Configure Zed's MCP settings
    const mcpConfig = {
      servers: {
        sessionhub: {
          transport: 'stdio',
          command: 'node',
          args: [path.join(process.cwd(), 'dist/mcp-server/index.js')],
          env: {
            SESSIONHUB_API_TOKEN: config.authToken,
            MCP_SERVER_URL: config.mcpServerUrl
          }
        }
      }
    };

    const configPath = path.join(process.env['HOME'] || '', '.config/zed/mcp.json');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(mcpConfig, null, 2));
  }

  async getAgentPanelStatus(): Promise<{ active: boolean; connectedToMCP: boolean }> {
    // Check if agent panel is active and connected
    const health = await this.connectionManager.getConnectionHealth();
    
    return {
      active: health.isZedRunning,
      connectedToMCP: health.isMCPAvailable
    };
  }

  async createZedWorkspace(config: ZedWorkspaceConfig): Promise<void> {
    const { projectPath, settings } = config;
    
    // Create workspace directory
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create Zed workspace settings
    if (settings) {
      const settingsPath = path.join(projectPath, '.zed/settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    }
    
    // Open the workspace
    await this.openWorkspace(projectPath);
  }

  async installZedExtension(extensionId: string): Promise<void> {
    // Zed extension installation would be handled here
    // Currently Zed doesn't have a public extension API
    this.emit('extension-install-requested', extensionId);
  }

  // Two-Actor specific methods
  async getActorStatus(): Promise<any> {
    return this.actorSyncService.getSyncState();
  }

  async syncActors(): Promise<void> {
    await this.actorSyncService.forceSyc();
  }

  async handleSlashCommand(command: string, args: string, context: any): Promise<any> {
    return this.slashCommandHandler.handleCommand(command, args, context);
  }

  getBoundaryViolations(): any {
    return this.boundaryEnforcer.getViolationStats();
  }

  getInstructionFlowMetrics(): any {
    return this.instructionFlowService.getExecutionMetrics();
  }

  async enforceAssistantResponse(response: any): Promise<any> {
    return this.boundaryEnforcer.enforceAssistantBoundaries(response);
  }
}