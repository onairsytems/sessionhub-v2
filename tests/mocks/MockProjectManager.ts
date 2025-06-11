import { BaseProjectContext, ProjectType } from '../../src/models/ProjectContext';

interface ProjectContextCompat extends Partial<BaseProjectContext> {
  id: string;
  name: string;
  type: string;
  path: string;
  dependencies?: Record<string, string>;
  config?: Record<string, any>;
}

export class ProjectManager {
  private projects: Map<string, ProjectContextCompat> = new Map();
  private projectCounter = 0;

  async createProject(data: {
    name: string;
    type: string;
    path: string;
  }): Promise<ProjectContextCompat> {
    const project: ProjectContextCompat = {
      id: `project-${++this.projectCounter}`,
      name: data.name,
      type: data.type as any,
      path: data.path,
      dependencies: {},
      config: {}
    };
    this.projects.set(project.id, project);
    return project;
  }

  async importProject(path: string): Promise<ProjectContextCompat> {
    const name = path.split('/').pop() || 'Imported Project';
    const project: ProjectContextCompat = {
      id: `imported-${++this.projectCounter}`,
      name,
      type: 'next',
      path,
      dependencies: {},
      config: {}
    };
    this.projects.set(project.id, project);
    return project;
  }

  async listProjects(): Promise<ProjectContextCompat[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: string): Promise<ProjectContextCompat | null> {
    return this.projects.get(id) || null;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async updateProject(id: string, updates: Partial<ProjectContextCompat>): Promise<ProjectContextCompat> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Project ${id} not found`);
    }
    const updated = { ...project, ...updates };
    this.projects.set(id, updated);
    return updated;
  }
}