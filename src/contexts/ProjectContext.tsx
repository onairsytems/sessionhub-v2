'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Project, 
  ProjectCreateInput, 
  ProjectUpdateInput, 
  ProjectActivity,
  ProjectContext as IProjectContext,
  ProjectExport,
  ProjectSettings,
  BulkProjectOperation
} from '@/src/types/project';
import { ProjectService } from '@/src/services/ProjectService';

const ProjectContext = createContext<IProjectContext | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: React.ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectService = ProjectService.getInstance();

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = useCallback(async (includeArchived: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const allProjects = projectService.getAllProjects(includeArchived);
      setProjects(allProjects.filter(p => p.status !== 'archived'));
      setArchivedProjects(allProjects.filter(p => p.status === 'archived'));
      
      const current = projectService.getCurrentProject();
      setCurrentProject(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [projectService]);

  const createProject = useCallback(async (input: ProjectCreateInput): Promise<Project> => {
    try {
      setError(null);
      const project = await projectService.createProject(input);
      
      // Reload projects to update state
      await loadProjects();
      
      // Auto-switch to new project
      await switchProject(project.id);
      
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const updateProject = useCallback(async (id: string, input: ProjectUpdateInput): Promise<Project> => {
    try {
      setError(null);
      const project = await projectService.updateProject(id, input);
      
      // Reload projects to update state
      await loadProjects();
      
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await projectService.deleteProject(id);
      
      // Reload projects to update state
      await loadProjects();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const switchProject = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await projectService.switchProject(id);
      
      const project = projectService.getCurrentProject();
      setCurrentProject(project);
      
      // Add activity for project switch
      projectService.addActivity(id, {
        type: 'updated',
        description: 'Project switched to active'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService]);

  const archiveProject = useCallback(async (id: string, reason?: string): Promise<void> => {
    try {
      setError(null);
      await projectService.archiveProject(id, reason);
      
      // Reload projects to update state
      await loadProjects(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const restoreProject = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await projectService.restoreProject(id);
      
      // Reload projects to update state
      await loadProjects(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const exportProject = useCallback(async (id: string, format?: 'json' | 'zip' | 'tar.gz'): Promise<ProjectExport> => {
    try {
      setError(null);
      const exportData = await projectService.exportProject(id, format);
      
      // Create download link
      const exportKey = `sessionhub_export_${exportData.id}`;
      const storedData = localStorage.getItem(exportKey);
      if (storedData) {
        const blob = new Blob([storedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-export-${exportData.projectId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      return exportData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService]);

  const importProject = useCallback(async (file: File): Promise<Project> => {
    try {
      setError(null);
      const project = await projectService.importProject(file);
      
      // Reload projects to update state
      await loadProjects();
      
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const duplicateProject = useCallback(async (
    id: string, 
    newName: string, 
    options?: { includeSessions?: boolean; includeSettings?: boolean }
  ): Promise<Project> => {
    try {
      setError(null);
      const project = await projectService.duplicateProject(id, newName, options);
      
      // Reload projects to update state
      await loadProjects();
      
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate project';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const bulkOperation = useCallback(async (operation: BulkProjectOperation): Promise<void> => {
    try {
      setError(null);
      await projectService.bulkOperation(operation);
      
      // Reload projects to update state
      await loadProjects(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to perform bulk operation';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, loadProjects]);

  const getProjectSettings = useCallback((id: string): ProjectSettings | undefined => {
    return projectService.getProjectSettings(id);
  }, [projectService]);

  const updateProjectSettings = useCallback(async (id: string, settings: Partial<ProjectSettings>): Promise<void> => {
    try {
      setError(null);
      await projectService.updateProjectSettings(id, settings);
      
      // Update local state if this is the current project
      if (currentProject && currentProject.id === id) {
        const updated = projectService.getCurrentProject();
        setCurrentProject(updated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project settings';
      setError(message);
      throw new Error(message);
    }
  }, [projectService, currentProject]);

  const addActivity = useCallback((
    projectId: string, 
    activity: Omit<ProjectActivity, 'id' | 'projectId' | 'timestamp'>
  ): void => {
    projectService.addActivity(projectId, activity);
    
    // Update local state if this is the current project
    if (currentProject && currentProject.id === projectId) {
      const updated = projectService.getCurrentProject();
      setCurrentProject(updated);
    }
  }, [projectService, currentProject]);

  const getRecentActivities = useCallback((projectId: string, limit?: number): ProjectActivity[] => {
    return projectService.getRecentActivities(projectId, limit);
  }, [projectService]);

  const value: IProjectContext = {
    currentProject,
    projects,
    archivedProjects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    switchProject,
    archiveProject,
    restoreProject,
    loadProjects,
    exportProject,
    importProject,
    duplicateProject,
    bulkOperation,
    getProjectSettings,
    updateProjectSettings,
    addActivity,
    getRecentActivities
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};