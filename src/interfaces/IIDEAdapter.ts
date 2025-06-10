import { BaseProjectContext } from '../models/ProjectContext';

export interface WorkspaceInfo {
  rootPath: string;
  name: string;
  settings?: Record<string, any>;
}

export interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'rename';
  path: string;
  content?: string;
  newPath?: string;
}

export interface IDEConnectionStatus {
  connected: boolean;
  version?: string;
  apiAvailable: boolean;
  lastError?: string;
  lastCheckTime: Date;
}

export interface ZedWorkspaceConfig {
  projectPath: string;
  settings?: {
    theme?: string;
    fontSize?: number;
    formatOnSave?: boolean;
    telemetry?: boolean;
  };
  extensions?: string[];
}

export interface IIDEAdapter {
  // Connection Management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): Promise<IDEConnectionStatus>;
  validateCredentials(): Promise<boolean>;
  
  // Workspace Management
  openWorkspace(workspacePath: string): Promise<void>;
  closeWorkspace(): Promise<void>;
  getActiveWorkspace(): Promise<WorkspaceInfo | null>;
  switchWorkspace(workspacePath: string): Promise<void>;
  
  // File Operations
  openFile(filePath: string): Promise<void>;
  saveFile(filePath: string, content: string): Promise<void>;
  createFile(filePath: string, content: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
  
  // Real-time Synchronization
  watchFileChanges(callback: (change: FileOperation) => void): void;
  unwatchFileChanges(): void;
  
  // Two-Actor Integration
  sendToExecutionActor(instruction: string, context: BaseProjectContext): Promise<void>;
  getExecutionStatus(): Promise<{ active: boolean; currentTask?: string }>;
  
  // Git Operations
  getGitStatus(): Promise<{ branch: string; changes: string[] }>;
  stageFiles(files: string[]): Promise<void>;
  commit(message: string): Promise<void>;
  
  // Quality Gates
  runLinter(): Promise<{ passed: boolean; errors: any[] }>;
  runTypeCheck(): Promise<{ passed: boolean; errors: any[] }>;
  
  // IDE-Specific Features
  getIDEName(): string;
  getIDEVersion(): Promise<string>;
  supportsFeature(feature: string): boolean;
}

export interface IZedAdapter extends IIDEAdapter {
  // Zed-specific methods
  configureAgentPanel(config: { mcpServerUrl: string; authToken: string }): Promise<void>;
  getAgentPanelStatus(): Promise<{ active: boolean; connectedToMCP: boolean }>;
  createZedWorkspace(config: ZedWorkspaceConfig): Promise<void>;
  installZedExtension(extensionId: string): Promise<void>;
}