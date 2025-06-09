import { EventEmitter } from 'events';
import { ProjectGenerationService } from './ProjectGenerationService';
import { QualityDashboard } from './QualityDashboard';
import { ProjectConfig, GenerationResult, ProjectType } from './types';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { SessionStateManager } from '@/src/core/orchestrator/SessionStateManager';

export interface GenerationRequest {
  sessionId: string;
  userId: string;
  config: ProjectConfig;
  requestId: string;
  timestamp: string;
}

export interface GenerationSession {
  id: string;
  request: GenerationRequest;
  startTime: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  result?: GenerationResult;
  error?: string;
}

export class ProjectGenerationOrchestrator extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly generationService: ProjectGenerationService;
  private readonly dashboard: QualityDashboard;
  private readonly activeSessions: Map<string, GenerationSession> = new Map();
  private sessionStateManager?: SessionStateManager;

  constructor(dataDir?: string) {
    super();
    this.logger = new Logger('ProjectGenerationOrchestrator');
    this.auditLogger = new AuditLogger();
    this.generationService = new ProjectGenerationService();
    this.dashboard = new QualityDashboard(dataDir);

    // Forward generation events
    this.generationService.on('generation:start', (data) => {
      this.emit('generation:start', data);
    });

    this.generationService.on('phase:prevalidation', (data) => {
      this.emit('phase:prevalidation', data);
    });

    this.generationService.on('phase:template', (data) => {
      this.emit('phase:template', data);
    });

    this.generationService.on('phase:generation', (data) => {
      this.emit('phase:generation', data);
    });

    this.generationService.on('phase:quality', (data) => {
      this.emit('phase:quality', data);
    });

    this.generationService.on('phase:git', (data) => {
      this.emit('phase:git', data);
    });

    this.generationService.on('phase:github', (data) => {
      this.emit('phase:github', data);
    });

    this.generationService.on('phase:verification', (data) => {
      this.emit('phase:verification', data);
    });

    this.generationService.on('generation:complete', (result) => {
      this.emit('generation:complete', result);
    });

    this.generationService.on('generation:failed', (result) => {
      this.emit('generation:failed', result);
    });
  }

  /**
   * Set the session state manager for integration with main system
   */
  setSessionStateManager(manager: SessionStateManager): void {
    this.sessionStateManager = manager;
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.dashboard.initialize();
    this.logger.info('Project Generation Orchestrator initialized');
  }

  /**
   * Process a project generation request
   */
  async processGenerationRequest(request: GenerationRequest): Promise<GenerationResult> {
    const session: GenerationSession = {
      id: request.sessionId,
      request,
      startTime: Date.now(),
      status: 'pending'
    };

    this.activeSessions.set(session.id, session);

    try {
      // Update session status
      session.status = 'generating';
      await this.updateSessionState(session.id, 'generating');

      // Log audit event
      this.auditLogger.logEvent({
        actor: { type: 'execution' as const, id: request.userId },
        operation: {
          type: 'project_generation_started',
          description: `Starting generation of ${request.config.type} project: ${request.config.name}`,
          input: {
            projectType: request.config.type,
            features: request.config.features
          }
        },
        result: {
          status: 'success',
          duration: 0
        },
        metadata: {
          sessionId: session.id,
          correlationId: request.requestId
        }
      });

      // Generate the project
      const result = await this.generationService.generateProject(request.config);

      // Update session
      session.status = 'completed';
      session.result = result;

      // Record in dashboard
      await this.dashboard.recordProjectGeneration(
        request.config.name,
        request.config.type,
        result.qualityReport,
        result.duration,
        result.filesGenerated,
        result.gitInitialized,
        result.githubCreated
      );

      // Update session state
      await this.updateSessionState(session.id, 'completed', result);

      // Log audit event
      this.auditLogger.logEvent({
        actor: { type: 'execution' as const, id: request.userId },
        operation: {
          type: 'project_generation_completed',
          description: `Completed generation of ${request.config.type} project: ${request.config.name}`,
          output: {
            success: result.success,
            filesGenerated: result.filesGenerated,
            projectPath: result.projectPath
          }
        },
        result: {
          status: 'success',
          duration: result.duration
        },
        metadata: {
          sessionId: session.id,
          correlationId: request.requestId
        }
      });

      this.logger.info('Project generation completed', {
        sessionId: session.id,
        projectName: request.config.name,
        duration: result.duration
      });

      return result;

    } catch (error) {
      // Update session
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);

      // Update session state
      await this.updateSessionState(session.id, 'failed', undefined, session.error);

      // Log audit event
      this.auditLogger.logEvent({
        actor: { type: 'execution' as const, id: request.userId },
        operation: {
          type: 'project_generation_failed',
          description: `Failed to generate ${request.config.type} project: ${request.config.name}`
        },
        result: {
          status: 'failure',
          duration: Date.now() - session.startTime,
          error: session.error
        },
        metadata: {
          sessionId: session.id,
          correlationId: request.requestId
        }
      });

      this.logger.error('Project generation failed', error as Error, {
        sessionId: session.id,
        projectName: request.config.name
      });

      throw error;

    } finally {
      // Clean up session after a delay
      setTimeout(() => {
        this.activeSessions.delete(session.id);
      }, 300000); // 5 minutes
    }
  }

  /**
   * Get generation session status
   */
  getSessionStatus(sessionId: string): GenerationSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): GenerationSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get dashboard data
   */
  async getDashboardData() {
    return this.dashboard.getDashboardData();
  }

  /**
   * Export dashboard report
   */
  async exportDashboard(outputPath: string): Promise<void> {
    await this.dashboard.exportDashboard(outputPath);
  }

  /**
   * Get supported project types
   */
  async getSupportedProjectTypes(): Promise<string[]> {
    return this.generationService.getSupportedProjectTypes();
  }

  /**
   * Validate project name
   */
  async validateProjectName(name: string): Promise<{ valid: boolean; reason?: string }> {
    return this.generationService.validateProjectName(name);
  }

  /**
   * Create a generation request from user input
   */
  createGenerationRequest(
    sessionId: string,
    userId: string,
    userRequest: string,
    context?: Record<string, any>
  ): GenerationRequest | null {
    // Parse user request to extract project configuration
    const config = this.parseUserRequest(userRequest, context);
    
    if (!config) {
      return null;
    }

    return {
      sessionId,
      userId,
      config,
      requestId: this.generateRequestId(),
      timestamp: new Date().toISOString()
    };
  }

  private parseUserRequest(request: string, context?: Record<string, any>): ProjectConfig | null {
    // Extract project type from request
    const projectType = this.detectProjectType(request);
    if (!projectType) return null;

    // Extract project name
    const projectName = this.extractProjectName(request) || `my-${projectType}-app`;

    // Determine features
    const features = {
      testing: request.includes('test') || request.includes('testing'),
      linting: true, // Always include linting for zero-error guarantee
      prettier: true, // Always include prettier for consistency
      husky: !projectType.includes('python'), // Husky for Node.js projects
      docker: request.includes('docker') || request.includes('container'),
      cicd: request.includes('ci') || request.includes('github actions'),
      documentation: true // Always include documentation
    };

    // Check for GitHub integration
    const github = {
      enabled: request.includes('github') || request.includes('repository'),
      private: request.includes('private'),
      description: context?.['description']
    };

    return {
      name: projectName,
      type: projectType,
      description: context?.['description'],
      author: context?.['author'],
      license: context?.['license'] || 'MIT',
      features,
      github: github.enabled ? github : undefined,
      outputDir: context?.['outputDir']
    };
  }

  private detectProjectType(request: string): ProjectType | null {
    const lowercased = request.toLowerCase();

    if (lowercased.includes('react') && lowercased.includes('typescript')) {
      return ProjectType.REACT_TYPESCRIPT;
    }
    if (lowercased.includes('react')) {
      return ProjectType.REACT_JAVASCRIPT;
    }
    if (lowercased.includes('next') || lowercased.includes('nextjs')) {
      return ProjectType.NEXTJS;
    }
    if (lowercased.includes('vue')) {
      return ProjectType.VUEJS;
    }
    if (lowercased.includes('express') && lowercased.includes('typescript')) {
      return ProjectType.EXPRESS_TYPESCRIPT;
    }
    if (lowercased.includes('express')) {
      return ProjectType.EXPRESS_JAVASCRIPT;
    }
    if (lowercased.includes('fastapi') || lowercased.includes('fast api')) {
      return ProjectType.PYTHON_FASTAPI;
    }
    if (lowercased.includes('django')) {
      return ProjectType.PYTHON_DJANGO;
    }
    if (lowercased.includes('electron')) {
      return ProjectType.ELECTRON;
    }
    if (lowercased.includes('cli')) {
      return ProjectType.NODEJS_CLI;
    }

    return null;
  }

  private extractProjectName(request: string): string | null {
    // Look for patterns like "called X", "named X", "project X"
    const patterns = [
      /called\s+["']?([a-zA-Z0-9-_]+)["']?/i,
      /named\s+["']?([a-zA-Z0-9-_]+)["']?/i,
      /project\s+["']?([a-zA-Z0-9-_]+)["']?/i,
      /app\s+["']?([a-zA-Z0-9-_]+)["']?/i,
      /create\s+["']?([a-zA-Z0-9-_]+)["']?/i
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async updateSessionState(
    sessionId: string,
    status: string,
    result?: GenerationResult,
    error?: string
  ): Promise<void> {
    if (!this.sessionStateManager) return;

    try {
      const session = await this.sessionStateManager.getSession(sessionId);
      if (session) {
        session.metadata['generationStatus'] = status;
        session.metadata['generationResult'] = result;
        session.metadata['generationError'] = error;
        session.metadata['lastUpdated'] = new Date().toISOString();
        
        // Update the session status if generation failed
        if (status === 'failed') {
          await this.sessionStateManager.updateStatus(sessionId, 'failed');
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update session state', error as Error);
    }
  }

  private generateRequestId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}