export type ProjectTechnology = 
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'nodejs'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'other';

export type ProjectStatus = 'active' | 'archived' | 'completed' | 'paused';

export interface ProjectMetadata {
  technology: ProjectTechnology;
  framework?: string;
  repository?: string;
  dependencies?: string[];
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: 'created' | 'updated' | 'session_started' | 'session_completed' | 'file_changed' | 'milestone_reached';
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  workspacePath?: string;
  sessionCount: number;
  activities: ProjectActivity[];
  archivedAt?: Date;
  archiveReason?: string;
  settings?: ProjectSettings;
  exportMetadata?: ProjectExportMetadata;
}

export interface ProjectCreateInput {
  name: string;
  description: string;
  technology: ProjectTechnology;
  framework?: string;
  repository?: string;
  tags?: string[];
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Partial<ProjectMetadata>;
}

export interface ProjectContext {
  currentProject: Project | null;
  projects: Project[];
  archivedProjects: Project[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createProject: (input: ProjectCreateInput) => Promise<Project>;
  updateProject: (id: string, input: ProjectUpdateInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  archiveProject: (id: string, reason?: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  loadProjects: (includeArchived?: boolean) => Promise<void>;
  
  // Export/Import
  exportProject: (id: string, format?: 'json' | 'zip' | 'tar.gz') => Promise<ProjectExport>;
  importProject: (file: File) => Promise<Project>;
  
  // Duplication
  duplicateProject: (id: string, newName: string, options?: { includeSessions?: boolean; includeSettings?: boolean }) => Promise<Project>;
  
  // Bulk operations
  bulkOperation: (operation: BulkProjectOperation) => Promise<void>;
  
  // Settings
  getProjectSettings: (id: string) => ProjectSettings | undefined;
  updateProjectSettings: (id: string, settings: Partial<ProjectSettings>) => Promise<void>;
  
  // Activity tracking
  addActivity: (projectId: string, activity: Omit<ProjectActivity, 'id' | 'projectId' | 'timestamp'>) => void;
  getRecentActivities: (projectId: string, limit?: number) => ProjectActivity[];
}

export interface ProjectDashboardMetrics {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageSessionDuration: number;
  lastActivityDate: Date;
  filesModified: number;
  linesOfCodeAdded: number;
  linesOfCodeRemoved: number;
}

export interface ProjectFilter {
  status?: ProjectStatus[];
  technology?: ProjectTechnology[];
  tags?: string[];
  searchTerm?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessedAt';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}

export interface ProjectSettings {
  theme?: 'light' | 'dark' | 'system';
  defaultBranch?: string;
  autoSave?: boolean;
  sessionTimeout?: number;
  codeStyle?: {
    tabSize?: number;
    useTabs?: boolean;
    lineNumbers?: boolean;
    wordWrap?: boolean;
  };
  aiSettings?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  customSettings?: Record<string, any>;
}

export interface ProjectExportMetadata {
  exportDate?: Date;
  exportFormat?: 'json' | 'zip' | 'tar.gz';
  fileSize?: number;
  checksum?: string;
  includedSessions?: boolean;
  includedSettings?: boolean;
  version?: string;
}

export interface ProjectExport {
  id: string;
  projectId: string;
  exportDate: Date;
  exportFormat: 'json' | 'zip' | 'tar.gz';
  fileSize?: number;
  checksum?: string;
  metadata?: Record<string, any>;
}

export interface ProjectImport {
  id: string;
  originalProjectId?: string;
  newProjectId: string;
  importDate: Date;
  importSource?: string;
  importFormat?: 'json' | 'zip' | 'tar.gz';
  metadata?: Record<string, any>;
}

export interface ProjectDuplicate {
  id: string;
  sourceProjectId: string;
  duplicateProjectId: string;
  duplicatedAt: Date;
  includeSessions: boolean;
  includeSettings: boolean;
  metadata?: Record<string, any>;
}

export interface BulkProjectOperation {
  operation: 'archive' | 'restore' | 'delete' | 'export';
  projectIds: string[];
  options?: {
    archiveReason?: string;
    exportFormat?: 'json' | 'zip' | 'tar.gz';
  };
}