/**
 * @actor system
 * @responsibility Session organization framework for project-based categorization
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session } from '@/src/models/Session';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  type: ProjectType;
  framework?: string;
  language?: string;
  status: ProjectStatus;
  sessions: string[]; // Session IDs
  templateId?: string;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

export type ProjectType = 
  | 'web-app'
  | 'api'
  | 'mobile'
  | 'desktop'
  | 'library'
  | 'cli'
  | 'fullstack'
  | 'microservice'
  | 'data-science'
  | 'machine-learning'
  | 'blockchain'
  | 'game'
  | 'iot'
  | 'documentation'
  | 'other';

export type ProjectStatus = 
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'
  | 'abandoned';

export interface ProjectMetadata {
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  team: string[];
  client?: string;
  deadline?: string;
  repository?: {
    type: 'git' | 'svn' | 'mercurial';
    url: string;
    branch?: string;
  };
  dependencies: string[];
  relatedProjects: string[];
  documentation: {
    readme?: string;
    wiki?: string;
    apiDocs?: string;
  };
  metrics: {
    totalSessions: number;
    completedSessions: number;
    totalHours: number;
    linesOfCode: number;
    filesModified: number;
    testsWritten: number;
    bugsFixed: number;
    featuresImplemented: number;
  };
}

export interface ProjectSettings {
  autoOrganize: boolean;
  sessionNamingPattern: string;
  defaultSessionTags: string[];
  codeStyle?: {
    formatter: 'prettier' | 'eslint' | 'black' | 'rustfmt';
    linter: string;
    rules?: Record<string, any>;
  };
  buildCommand?: string;
  testCommand?: string;
  runCommand?: string;
  environmentVariables?: Record<string, string>;
}

export interface SessionOrganizationRule {
  id: string;
  name: string;
  description: string;
  type: 'path' | 'content' | 'metadata' | 'mixed';
  conditions: OrganizationCondition[];
  projectId: string;
  priority: number;
  enabled: boolean;
}

export interface OrganizationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'exists';
  value: any;
  caseSensitive?: boolean;
}

export interface SessionProjectAssociation {
  sessionId: string;
  projectId: string;
  associationType: 'automatic' | 'manual' | 'suggested';
  confidence: number;
  reason: string;
  createdAt: string;
}

export interface ProjectSearchCriteria {
  query?: string;
  type?: ProjectType;
  status?: ProjectStatus;
  framework?: string;
  language?: string;
  tags?: string[];
  team?: string[];
  client?: string;
  hasDeadline?: boolean;
  sortBy?: 'name' | 'updated' | 'created' | 'sessions' | 'priority';
  includeArchived?: boolean;
}

export interface SessionSearchCriteria {
  query?: string;
  projectId?: string;
  status?: string;
  actor?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  hasErrors?: boolean;
  minDuration?: number;
  maxDuration?: number;
  sortBy?: 'date' | 'duration' | 'name' | 'project';
}

export interface OrganizationMetrics {
  totalProjects: number;
  activeProjects: number;
  totalSessions: number;
  organizedSessions: number;
  unorganizedSessions: number;
  averageSessionsPerProject: number;
  mostActiveProjects: Array<{
    project: Project;
    sessionCount: number;
    lastActivity: string;
  }>;
  organizationCoverage: number; // Percentage of sessions organized
}

export class SessionOrganizationSystem extends EventEmitter {
  private readonly logger: Logger;
  // private readonly _auditLogger: AuditLogger;
  // Removed unused auditLogger
  private readonly projectsDir: string;
  private readonly rulesDir: string;
  private readonly associationsDir: string;
  private readonly indexDir: string;
  
  private projects = new Map<string, Project>();
  private organizationRules = new Map<string, SessionOrganizationRule>();
  private associations = new Map<string, SessionProjectAssociation>();
  private sessionIndex = new Map<string, string>(); // sessionId -> projectId
  private projectIndex = new Map<string, Set<string>>(); // projectId -> Set<sessionId>
  
  constructor(
    logger: Logger,
    _auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    // this._auditLogger = auditLogger;
    
    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.projectsDir = path.join(dataDir, 'projects');
    this.rulesDir = path.join(dataDir, 'organization-rules');
    this.associationsDir = path.join(dataDir, 'session-associations');
    this.indexDir = path.join(dataDir, 'organization-index');
    
    this.initializeOrganizationSystem();
  }

  /**
   * Initialize the organization system
   */
  private async initializeOrganizationSystem(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.projectsDir, { recursive: true }),
      fs.mkdir(this.rulesDir, { recursive: true }),
      fs.mkdir(this.associationsDir, { recursive: true }),
      fs.mkdir(this.indexDir, { recursive: true })
    ]);

    await this.loadAllData();
    await this.buildIndexes();

    this.logger.info('Session organization system initialized', {
      projects: this.projects.size,
      rules: this.organizationRules.size,
      associations: this.associations.size
    });
  }

  /**
   * Create a new project
   */
  async createProject(
    name: string,
    description: string,
    projectPath: string,
    type: ProjectType,
    metadata?: Partial<ProjectMetadata>
  ): Promise<Project> {
    const project: Project = {
      id: this.generateId('proj'),
      name,
      description,
      path: projectPath,
      type,
      status: 'active',
      sessions: [],
      metadata: {
        tags: metadata?.tags || [],
        priority: metadata?.priority || 'medium',
        team: metadata?.team || [],
        client: metadata?.client,
        deadline: metadata?.deadline,
        repository: metadata?.repository,
        dependencies: metadata?.dependencies || [],
        relatedProjects: metadata?.relatedProjects || [],
        documentation: metadata?.documentation || {},
        metrics: {
          totalSessions: 0,
          completedSessions: 0,
          totalHours: 0,
          linesOfCode: 0,
          filesModified: 0,
          testsWritten: 0,
          bugsFixed: 0,
          featuresImplemented: 0
        }
      },
      settings: {
        autoOrganize: true,
        sessionNamingPattern: '{{date}}-{{type}}-{{description}}',
        defaultSessionTags: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    };

    this.projects.set(project.id, project);
    this.projectIndex.set(project.id, new Set());
    await this.persistProject(project);

    // Create default organization rules for the project
    await this.createDefaultRulesForProject(project);

    this.emit('projectCreated', project);

    this.logger.info('Project created', {
      projectId: project.id,
      name: project.name,
      type: project.type
    });

    return project;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'createdAt'>>
  ): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    Object.assign(project, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await this.persistProject(project);

    this.emit('projectUpdated', project);

    this.logger.info('Project updated', {
      projectId,
      updates: Object.keys(updates)
    });

    return project;
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const project = this.projects.get(projectId);
    if (project) {
      project.lastAccessedAt = new Date().toISOString();
      await this.persistProject(project);
    }
    return project || null;
  }

  /**
   * Search projects
   */
  async searchProjects(criteria: ProjectSearchCriteria): Promise<Project[]> {
    let projects = Array.from(this.projects.values());

    // Filter by status
    if (!criteria.includeArchived) {
      projects = projects.filter(p => p.status !== 'archived');
    }

    // Apply filters
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      projects = projects.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (criteria.type) {
      projects = projects.filter(p => p.type === criteria.type);
    }

    if (criteria.status) {
      projects = projects.filter(p => p.status === criteria.status);
    }

    if (criteria.framework) {
      projects = projects.filter(p => p.framework === criteria.framework);
    }

    if (criteria.language) {
      projects = projects.filter(p => p.language === criteria.language);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      projects = projects.filter(p =>
        criteria.tags!.some(tag => p.metadata.tags.includes(tag))
      );
    }

    if (criteria.team && criteria.team.length > 0) {
      projects = projects.filter(p =>
        criteria.team!.some(member => p.metadata.team.includes(member))
      );
    }

    if (criteria.client) {
      projects = projects.filter(p => p.metadata.client === criteria.client);
    }

    if (criteria.hasDeadline) {
      projects = projects.filter(p => !!p.metadata.deadline);
    }

    // Sort
    switch (criteria.sortBy) {
      case 'name':
        projects.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'updated':
        projects.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        break;
      case 'created':
        projects.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'sessions':
        projects.sort((a, b) => b.sessions.length - a.sessions.length);
        break;
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        projects.sort((a, b) => 
          priorityOrder[a.metadata.priority] - priorityOrder[b.metadata.priority]
        );
        break;
    }

    return projects;
  }

  /**
   * Organize session under appropriate project
   */
  async organizeSession(session: Session): Promise<SessionProjectAssociation | null> {
    // Try automatic organization first
    const automaticAssociation = await this.findProjectForSession(session);
    
    if (automaticAssociation && automaticAssociation.confidence > 0.7) {
      await this.associateSessionWithProject(
        session.id,
        automaticAssociation.projectId,
        'automatic',
        automaticAssociation.confidence,
        automaticAssociation.reason
      );
      
      return automaticAssociation;
    }

    // If automatic organization has low confidence, suggest it
    if (automaticAssociation && automaticAssociation.confidence > 0.3) {
      automaticAssociation.associationType = 'suggested';
      this.emit('sessionOrganizationSuggested', {
        session,
        suggestion: automaticAssociation
      });
      
      return automaticAssociation;
    }

    // No suitable project found
    this.emit('sessionOrganizationFailed', {
      session,
      reason: 'No matching project found'
    });

    return null;
  }

  /**
   * Manually associate session with project
   */
  async associateSessionWithProject(
    sessionId: string,
    projectId: string,
    associationType: 'automatic' | 'manual' | 'suggested' = 'manual',
    confidence: number = 1.0,
    reason: string = 'Manual association'
  ): Promise<SessionProjectAssociation> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Remove from previous project if exists
    const previousProjectId = this.sessionIndex.get(sessionId);
    if (previousProjectId && previousProjectId !== projectId) {
      const previousProject = this.projects.get(previousProjectId);
      if (previousProject) {
        previousProject.sessions = previousProject.sessions.filter(id => id !== sessionId);
        await this.persistProject(previousProject);
      }
      this.projectIndex.get(previousProjectId)?.delete(sessionId);
    }

    // Add to new project
    if (!project.sessions.includes(sessionId)) {
      project.sessions.push(sessionId);
      project.metadata.metrics.totalSessions++;
      await this.persistProject(project);
    }

    // Update indexes
    this.sessionIndex.set(sessionId, projectId);
    this.projectIndex.get(projectId)?.add(sessionId);

    // Create association
    const association: SessionProjectAssociation = {
      sessionId,
      projectId,
      associationType,
      confidence,
      reason,
      createdAt: new Date().toISOString()
    };

    this.associations.set(sessionId, association);
    await this.persistAssociation(association);

    this.emit('sessionAssociated', {
      sessionId,
      projectId,
      association
    });

    this.logger.info('Session associated with project', {
      sessionId,
      projectId,
      associationType,
      confidence
    });

    return association;
  }

  /**
   * Get sessions for project
   */
  async getProjectSessions(
    projectId: string,
    criteria?: Partial<SessionSearchCriteria>
  ): Promise<string[]> {
    const project = this.projects.get(projectId);
    if (!project) {
      return [];
    }

    let sessionIds = project.sessions;

    // Apply additional filters if provided
    if (criteria) {
      // This would integrate with the session persistence system
      // For now, return all project sessions
      void criteria;
    }

    return sessionIds;
  }

  /**
   * Get project for session
   */
  async getSessionProject(sessionId: string): Promise<Project | null> {
    const projectId = this.sessionIndex.get(sessionId);
    if (!projectId) {
      return null;
    }

    return this.projects.get(projectId) || null;
  }

  /**
   * Search sessions across all projects
   */
  async searchSessions(criteria: SessionSearchCriteria): Promise<Array<{
    sessionId: string;
    projectId: string;
    projectName: string;
  }>> {
    const results: Array<{
      sessionId: string;
      projectId: string;
      projectName: string;
    }> = [];

    // If searching within specific project
    if (criteria.projectId) {
      const project = this.projects.get(criteria.projectId);
      if (project) {
        const sessionIds = await this.getProjectSessions(criteria.projectId, criteria);
        for (const sessionId of sessionIds) {
          results.push({
            sessionId,
            projectId: project.id,
            projectName: project.name
          });
        }
      }
    } else {
      // Search across all projects
      for (const [projectId, sessionIds] of this.projectIndex) {
        const project = this.projects.get(projectId);
        if (!project) continue;

        for (const sessionId of sessionIds) {
          // Apply filters (would integrate with session data)
          results.push({
            sessionId,
            projectId: project.id,
            projectName: project.name
          });
        }
      }
    }

    return results;
  }

  /**
   * Create organization rule
   */
  async createOrganizationRule(
    name: string,
    description: string,
    projectId: string,
    conditions: OrganizationCondition[],
    priority: number = 50
  ): Promise<SessionOrganizationRule> {
    const rule: SessionOrganizationRule = {
      id: this.generateId('rule'),
      name,
      description,
      type: this.determineRuleType(conditions),
      conditions,
      projectId,
      priority,
      enabled: true
    };

    this.organizationRules.set(rule.id, rule);
    await this.persistRule(rule);

    this.emit('organizationRuleCreated', rule);

    this.logger.info('Organization rule created', {
      ruleId: rule.id,
      name: rule.name,
      projectId
    });

    return rule;
  }

  /**
   * Get organization metrics
   */
  async getOrganizationMetrics(): Promise<OrganizationMetrics> {
    const activeProjects = Array.from(this.projects.values())
      .filter(p => p.status === 'active');

    const totalSessions = Array.from(this.projectIndex.values())
      .reduce((sum, sessionIds) => sum + sessionIds.size, 0);

    const mostActiveProjects = Array.from(this.projects.values())
      .map(project => ({
        project,
        sessionCount: project.sessions.length,
        lastActivity: project.updatedAt
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);

    return {
      totalProjects: this.projects.size,
      activeProjects: activeProjects.length,
      totalSessions,
      organizedSessions: this.associations.size,
      unorganizedSessions: totalSessions - this.associations.size,
      averageSessionsPerProject: totalSessions / Math.max(this.projects.size, 1),
      mostActiveProjects,
      organizationCoverage: (this.associations.size / Math.max(totalSessions, 1)) * 100
    };
  }

  /**
   * Archive project
   */
  async archiveProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    project.status = 'archived';
    project.updatedAt = new Date().toISOString();
    await this.persistProject(project);

    this.emit('projectArchived', project);

    this.logger.info('Project archived', {
      projectId,
      name: project.name
    });
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) {
      return;
    }

    // Remove all session associations
    for (const sessionId of project.sessions) {
      this.sessionIndex.delete(sessionId);
      this.associations.delete(sessionId);
    }

    // Remove project
    this.projects.delete(projectId);
    this.projectIndex.delete(projectId);

    // Delete files
    const projectFile = path.join(this.projectsDir, `${projectId}.json`);
    await fs.unlink(projectFile).catch(() => {});

    // Delete related rules
    const rulesToDelete = Array.from(this.organizationRules.values())
      .filter(rule => rule.projectId === projectId);
    
    for (const rule of rulesToDelete) {
      this.organizationRules.delete(rule.id);
      const ruleFile = path.join(this.rulesDir, `${rule.id}.json`);
      await fs.unlink(ruleFile).catch(() => {});
    }

    this.emit('projectDeleted', projectId);

    this.logger.info('Project deleted', {
      projectId,
      name: project.name,
      sessionsRemoved: project.sessions.length
    });
  }

  // Private helper methods

  private async findProjectForSession(session: Session): Promise<SessionProjectAssociation | null> {
    const candidates: Array<{
      projectId: string;
      confidence: number;
      reasons: string[];
    }> = [];

    // Check all enabled rules
    const enabledRules = Array.from(this.organizationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      const matches = await this.evaluateRule(rule, session);
      if (matches) {
        const existing = candidates.find(c => c.projectId === rule.projectId);
        if (existing) {
          existing.confidence = Math.min(1, existing.confidence + 0.2);
          existing.reasons.push(`Matches rule: ${rule.name}`);
        } else {
          candidates.push({
            projectId: rule.projectId,
            confidence: 0.8,
            reasons: [`Matches rule: ${rule.name}`]
          });
        }
      }
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    if (candidates.length > 0) {
      const best = candidates[0];
      if (best) {
        return {
          sessionId: session.id,
          projectId: best.projectId,
          associationType: 'automatic',
          confidence: best.confidence,
          reason: best.reasons.join('; '),
          createdAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  private async evaluateRule(rule: SessionOrganizationRule, session: Session): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!await this.evaluateCondition(condition, session)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: OrganizationCondition, session: Session): Promise<boolean> {
    let fieldValue: any;

    // Extract field value based on path
    if (condition.field.startsWith('metadata.')) {
      const metadataField = condition.field.substring(9);
      fieldValue = (session.metadata as any)[metadataField];
    } else if (condition.field === 'workingDirectory') {
      fieldValue = session.metadata['workingDirectory'];
    } else {
      fieldValue = (session as any)[condition.field];
    }

    // Evaluate based on operator
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      
      case 'contains':
        if (typeof fieldValue === 'string') {
          return condition.caseSensitive 
            ? fieldValue.includes(condition.value)
            : fieldValue.toLowerCase().includes(condition.value.toLowerCase());
        }
        return false;
      
      case 'startsWith':
        if (typeof fieldValue === 'string') {
          return condition.caseSensitive
            ? fieldValue.startsWith(condition.value)
            : fieldValue.toLowerCase().startsWith(condition.value.toLowerCase());
        }
        return false;
      
      case 'endsWith':
        if (typeof fieldValue === 'string') {
          return condition.caseSensitive
            ? fieldValue.endsWith(condition.value)
            : fieldValue.toLowerCase().endsWith(condition.value.toLowerCase());
        }
        return false;
      
      case 'regex':
        if (typeof fieldValue === 'string') {
          const regex = new RegExp(condition.value, condition.caseSensitive ? '' : 'i');
          return regex.test(fieldValue);
        }
        return false;
      
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      
      default:
        return false;
    }
  }

  private determineRuleType(conditions: OrganizationCondition[]): SessionOrganizationRule['type'] {
    const types = new Set<string>();

    for (const condition of conditions) {
      if (condition.field.includes('path') || condition.field === 'workingDirectory') {
        types.add('path');
      } else if (condition.field.startsWith('metadata.')) {
        types.add('metadata');
      } else {
        types.add('content');
      }
    }

    if (types.size > 1) {
      return 'mixed';
    }

    return types.values().next().value as SessionOrganizationRule['type'];
  }

  private async createDefaultRulesForProject(project: Project): Promise<void> {
    // Rule 1: Match by working directory
    await this.createOrganizationRule(
      `Working Directory - ${project.name}`,
      `Organize sessions in ${project.path}`,
      project.id,
      [
        {
          field: 'workingDirectory',
          operator: 'startsWith',
          value: project.path,
          caseSensitive: false
        }
      ],
      90
    );

    // Rule 2: Match by project name in content
    await this.createOrganizationRule(
      `Project Name - ${project.name}`,
      `Organize sessions mentioning ${project.name}`,
      project.id,
      [
        {
          field: 'content',
          operator: 'contains',
          value: project.name,
          caseSensitive: false
        }
      ],
      50
    );
  }

  private async loadAllData(): Promise<void> {
    await Promise.all([
      this.loadProjects(),
      this.loadRules(),
      this.loadAssociations()
    ]);
  }

  private async loadProjects(): Promise<void> {
    try {
      const files = await fs.readdir(this.projectsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.projectsDir, file),
            'utf-8'
          );
          const project = JSON.parse(content) as Project;
          this.projects.set(project.id, project);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load projects', error as Error);
    }
  }

  private async loadRules(): Promise<void> {
    try {
      const files = await fs.readdir(this.rulesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.rulesDir, file),
            'utf-8'
          );
          const rule = JSON.parse(content) as SessionOrganizationRule;
          this.organizationRules.set(rule.id, rule);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load rules', error as Error);
    }
  }

  private async loadAssociations(): Promise<void> {
    try {
      const files = await fs.readdir(this.associationsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.associationsDir, file),
            'utf-8'
          );
          const association = JSON.parse(content) as SessionProjectAssociation;
          this.associations.set(association.sessionId, association);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load associations', error as Error);
    }
  }

  private async buildIndexes(): Promise<void> {
    // Build session index
    for (const [sessionId, association] of this.associations) {
      this.sessionIndex.set(sessionId, association.projectId);
    }

    // Build project index
    for (const project of this.projects.values()) {
      const sessionSet = new Set<string>();
      for (const sessionId of project.sessions) {
        sessionSet.add(sessionId);
      }
      this.projectIndex.set(project.id, sessionSet);
    }
  }

  private async persistProject(project: Project): Promise<void> {
    const projectPath = path.join(this.projectsDir, `${project.id}.json`);
    await fs.writeFile(projectPath, JSON.stringify(project, null, 2), 'utf-8');
  }

  private async persistRule(rule: SessionOrganizationRule): Promise<void> {
    const rulePath = path.join(this.rulesDir, `${rule.id}.json`);
    await fs.writeFile(rulePath, JSON.stringify(rule, null, 2), 'utf-8');
  }

  private async persistAssociation(association: SessionProjectAssociation): Promise<void> {
    const associationPath = path.join(this.associationsDir, `${association.sessionId}.json`);
    await fs.writeFile(associationPath, JSON.stringify(association, null, 2), 'utf-8');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}