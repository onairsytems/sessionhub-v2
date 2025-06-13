import { v4 as uuidv4 } from 'uuid';
import { 
  Project, 
  ProjectCreateInput, 
  ProjectUpdateInput, 
  ProjectActivity,
  ProjectFilter,
  ProjectDashboardMetrics,
  ProjectSettings,
  ProjectExport,
  BulkProjectOperation,
  ProjectExportMetadata
} from '@/src/types/project';

export class ProjectService {
  private static instance: ProjectService;
  private projects: Map<string, Project> = new Map();
  private currentProjectId: string | null = null;
  private projectSettings: Map<string, ProjectSettings> = new Map();
  private storageKey = 'sessionhub_projects';
  private currentProjectKey = 'sessionhub_current_project';
  private settingsKey = 'sessionhub_project_settings';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  // Project CRUD Operations
  async createProject(input: ProjectCreateInput): Promise<Project> {
    const now = new Date();
    const project: Project = {
      id: uuidv4(),
      name: input.name,
      description: input.description,
      status: 'active',
      metadata: {
        technology: input.technology,
        framework: input.framework,
        repository: input.repository,
        tags: input.tags || [],
        dependencies: []
      },
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      sessionCount: 0,
      activities: []
    };

    // Add creation activity
    this.addActivityToProject(project, {
      type: 'created',
      description: `Project "${project.name}" created`
    });

    this.projects.set(project.id, project);
    this.saveToStorage();
    
    return project;
  }

  async updateProject(id: string, input: ProjectUpdateInput): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const updatedProject: Project = {
      ...project,
      name: input.name ?? project.name,
      description: input.description ?? project.description,
      status: input.status ?? project.status,
      metadata: {
        ...project.metadata,
        ...input.metadata
      },
      updatedAt: new Date()
    };

    // Add update activity
    this.addActivityToProject(updatedProject, {
      type: 'updated',
      description: `Project updated`,
      metadata: { changes: Object.keys(input) }
    });

    this.projects.set(id, updatedProject);
    this.saveToStorage();
    
    return updatedProject;
  }

  async deleteProject(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    // If this is the current project, clear it
    if (this.currentProjectId === id) {
      this.currentProjectId = null;
    }

    this.projects.delete(id);
    this.saveToStorage();
  }

  async archiveProject(id: string, reason?: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const archivedProject: Project = {
      ...project,
      status: 'archived',
      archivedAt: new Date(),
      archiveReason: reason,
      updatedAt: new Date()
    };

    // Add archive activity
    this.addActivityToProject(archivedProject, {
      type: 'updated',
      description: `Project archived${reason ? `: ${reason}` : ''}`,
      metadata: { archived: true, reason }
    });

    this.projects.set(id, archivedProject);
    this.saveToStorage();
  }

  async restoreProject(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    if (project.status !== 'archived') {
      throw new Error(`Project ${id} is not archived`);
    }

    const restoredProject: Project = {
      ...project,
      status: 'active',
      archivedAt: undefined,
      archiveReason: undefined,
      updatedAt: new Date()
    };

    // Add restore activity
    this.addActivityToProject(restoredProject, {
      type: 'updated',
      description: 'Project restored from archive',
      metadata: { restored: true }
    });

    this.projects.set(id, restoredProject);
    this.saveToStorage();
  }

  // Project Selection
  async switchProject(id: string): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    this.currentProjectId = id;
    
    // Update last accessed time
    const updatedProject = {
      ...project,
      lastAccessedAt: new Date()
    };
    this.projects.set(id, updatedProject);
    
    this.saveToStorage();
  }

  getCurrentProject(): Project | null {
    if (!this.currentProjectId) return null;
    return this.projects.get(this.currentProjectId) || null;
  }

  // Project Listing and Filtering
  getAllProjects(includeArchived: boolean = false): Project[] {
    const projects = Array.from(this.projects.values());
    if (includeArchived) {
      return projects;
    }
    return projects.filter(p => p.status !== 'archived');
  }

  getArchivedProjects(): Project[] {
    return Array.from(this.projects.values()).filter(p => p.status === 'archived');
  }

  getFilteredProjects(filter: ProjectFilter): Project[] {
    let projects = this.getAllProjects(filter.includeArchived || false);

    // Apply filters
    if (filter.status && filter.status.length > 0) {
      projects = projects.filter(p => filter.status!.includes(p.status));
    }

    if (filter.technology && filter.technology.length > 0) {
      projects = projects.filter(p => filter.technology!.includes(p.metadata.technology));
    }

    if (filter.tags && filter.tags.length > 0) {
      projects = projects.filter(p => 
        p.metadata.tags?.some((tag: string) => filter.tags!.includes(tag))
      );
    }

    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      projects = projects.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.description.toLowerCase().includes(term)
      );
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'updatedAt';
    const sortOrder = filter.sortOrder || 'desc';
    
    projects.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Project];
      let bValue: any = b[sortBy as keyof Project];
      
      if (aValue instanceof Date) aValue = aValue.getTime();
      if (bValue instanceof Date) bValue = bValue.getTime();
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return projects;
  }

  // Activity Management
  addActivity(projectId: string, activity: Omit<ProjectActivity, 'id' | 'projectId' | 'timestamp'>): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    this.addActivityToProject(project, activity);
    this.projects.set(projectId, project);
    this.saveToStorage();
  }

  private addActivityToProject(project: Project, activity: Omit<ProjectActivity, 'id' | 'projectId' | 'timestamp'>): void {
    const newActivity: ProjectActivity = {
      id: uuidv4(),
      projectId: project.id,
      timestamp: new Date(),
      ...activity
    };

    project.activities.push(newActivity);
    
    // Keep only last 100 activities per project
    if (project.activities.length > 100) {
      project.activities = project.activities.slice(-100);
    }
  }

  getRecentActivities(projectId: string, limit: number = 10): ProjectActivity[] {
    const project = this.projects.get(projectId);
    if (!project) return [];

    return project.activities
      .slice(-limit)
      .reverse();
  }

  // Dashboard Metrics
  getProjectMetrics(projectId: string): ProjectDashboardMetrics | null {
    const project = this.projects.get(projectId);
    if (!project) return null;

    // These would be calculated from actual session data in a real implementation
    return {
      totalSessions: project.sessionCount,
      completedSessions: Math.floor(project.sessionCount * 0.8),
      failedSessions: Math.floor(project.sessionCount * 0.1),
      averageSessionDuration: 45 * 60 * 1000, // 45 minutes in ms
      lastActivityDate: project.activities.length > 0 
        ? project.activities[project.activities.length - 1]!.timestamp 
        : project.createdAt,
      filesModified: Math.floor(Math.random() * 50),
      linesOfCodeAdded: Math.floor(Math.random() * 1000),
      linesOfCodeRemoved: Math.floor(Math.random() * 300)
    };
  }

  // Storage Management methods are defined at the end of the class

  // Session Integration
  incrementSessionCount(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.sessionCount++;
    project.updatedAt = new Date();
    this.projects.set(projectId, project);
    this.saveToStorage();
  }

  // Export/Import functionality
  async exportProject(id: string, format: 'json' | 'zip' | 'tar.gz' = 'json'): Promise<ProjectExport> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const exportData = {
      project,
      settings: this.projectSettings.get(id),
      exportMetadata: {
        exportDate: new Date(),
        exportFormat: format,
        version: '2.26C',
        includedSettings: true
      } as ProjectExportMetadata
    };

    // Create export record
    const projectExport: ProjectExport = {
      id: uuidv4(),
      projectId: id,
      exportDate: new Date(),
      exportFormat: format,
      metadata: exportData.exportMetadata
    };

    // Update project with export metadata
    project.exportMetadata = exportData.exportMetadata;
    this.projects.set(id, project);
    this.saveToStorage();

    // Add export activity
    this.addActivity(id, {
      type: 'updated',
      description: `Project exported as ${format}`,
      metadata: { exportId: projectExport.id, format }
    });

    // In a real implementation, this would create actual files
    // For now, we'll store the export data in memory/localStorage
    const exportKey = `sessionhub_export_${projectExport.id}`;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(exportKey, JSON.stringify(exportData));
    }

    return projectExport;
  }

  async importProject(file: File): Promise<Project> {
    // Read file content
    const content = await file.text();
    const importData = JSON.parse(content);

    if (!importData.project) {
      throw new Error('Invalid import file: missing project data');
    }

    const sourceProject = importData.project as Project;
    const now = new Date();

    // Create new project based on imported data
    const newProject: Project = {
      ...sourceProject,
      id: uuidv4(),
      name: `${sourceProject.name} (Imported)`,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      archivedAt: undefined,
      archiveReason: undefined,
      activities: []
    };

    // Add import activity
    this.addActivityToProject(newProject, {
      type: 'created',
      description: `Project imported from ${sourceProject.name}`,
      metadata: { 
        originalProjectId: sourceProject.id,
        importDate: now
      }
    });

    // Import settings if available
    if (importData.settings) {
      this.projectSettings.set(newProject.id, importData.settings);
    }

    this.projects.set(newProject.id, newProject);
    this.saveToStorage();

    return newProject;
  }

  // Duplication
  async duplicateProject(
    id: string, 
    newName: string, 
    options?: { includeSessions?: boolean; includeSettings?: boolean }
  ): Promise<Project> {
    const sourceProject = this.projects.get(id);
    if (!sourceProject) {
      throw new Error(`Project with id ${id} not found`);
    }

    const now = new Date();
    const duplicatedProject: Project = {
      ...sourceProject,
      id: uuidv4(),
      name: newName,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
      sessionCount: 0,
      activities: [],
      archivedAt: undefined,
      archiveReason: undefined
    };

    // Add duplication activity
    this.addActivityToProject(duplicatedProject, {
      type: 'created',
      description: `Project duplicated from "${sourceProject.name}"`,
      metadata: { sourceProjectId: id }
    });

    // Duplicate settings if requested
    if (options?.includeSettings) {
      const sourceSettings = this.projectSettings.get(id);
      if (sourceSettings) {
        this.projectSettings.set(duplicatedProject.id, { ...sourceSettings });
      }
    }

    this.projects.set(duplicatedProject.id, duplicatedProject);
    this.saveToStorage();

    return duplicatedProject;
  }

  // Bulk operations
  async bulkOperation(operation: BulkProjectOperation): Promise<void> {
    switch (operation.operation) {
      case 'archive':
        for (const projectId of operation.projectIds) {
          await this.archiveProject(projectId, operation.options?.archiveReason);
        }
        break;
      
      case 'restore':
        for (const projectId of operation.projectIds) {
          await this.restoreProject(projectId);
        }
        break;
      
      case 'delete':
        for (const projectId of operation.projectIds) {
          await this.deleteProject(projectId);
        }
        break;
      
      case 'export':
        for (const projectId of operation.projectIds) {
          await this.exportProject(projectId, operation.options?.exportFormat || 'json');
        }
        break;
    }
  }

  // Settings management
  getProjectSettings(id: string): ProjectSettings | undefined {
    return this.projectSettings.get(id);
  }

  async updateProjectSettings(id: string, settings: Partial<ProjectSettings>): Promise<void> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }

    const currentSettings = this.projectSettings.get(id) || {};
    const updatedSettings: ProjectSettings = {
      ...currentSettings,
      ...settings
    };

    this.projectSettings.set(id, updatedSettings);
    
    // Update project to trigger save
    project.updatedAt = new Date();
    project.settings = updatedSettings;
    this.projects.set(id, project);
    
    this.saveToStorage();

    // Add settings update activity
    this.addActivity(id, {
      type: 'updated',
      description: 'Project settings updated',
      metadata: { settingsUpdated: Object.keys(settings) }
    });
  }

  // Update storage methods to include settings
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Load projects
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.projects = new Map(
            data.projects.map((p: any) => [
              p.id, 
              {
                ...p,
                createdAt: new Date(p.createdAt),
                updatedAt: new Date(p.updatedAt),
                lastAccessedAt: new Date(p.lastAccessedAt),
                archivedAt: p.archivedAt ? new Date(p.archivedAt) : undefined,
                activities: p.activities.map((a: any) => ({
                  ...a,
                  timestamp: new Date(a.timestamp)
                }))
              }
            ])
          );
        }

        // Load settings
        const settingsStored = localStorage.getItem(this.settingsKey);
        if (settingsStored) {
          const settingsData = JSON.parse(settingsStored);
          this.projectSettings = new Map(Object.entries(settingsData));
        }

        // Load current project
        const currentProject = localStorage.getItem(this.currentProjectKey);
        if (currentProject) {
          this.currentProjectId = currentProject;
        }
      }
    } catch (error) {
      // Failed to load projects from storage
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Save projects
        const data = {
          projects: Array.from(this.projects.values())
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        
        // Save settings
        const settingsData: Record<string, ProjectSettings> = {};
        this.projectSettings.forEach((settings, projectId) => {
          settingsData[projectId] = settings;
        });
        localStorage.setItem(this.settingsKey, JSON.stringify(settingsData));
        
        // Save current project
        if (this.currentProjectId) {
          localStorage.setItem(this.currentProjectKey, this.currentProjectId);
        } else {
          localStorage.removeItem(this.currentProjectKey);
        }
      }
    } catch (error) {
      // Failed to save projects to storage
    }
  }
}