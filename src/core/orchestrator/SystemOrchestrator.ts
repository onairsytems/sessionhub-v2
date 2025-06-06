/**
 * @actor system
 * @responsibility Main orchestrator that coordinates all system components
 */

import { SessionManager, Session, UserRequest } from './SessionManager';
import { ActorCoordinator } from './ActorCoordinator';
import { WorkflowEngine } from './WorkflowEngine';
import { StateManager } from './StateManager';
import { PlanningEngine } from '@/src/core/planning/PlanningEngine';
import { ExecutionEngine } from '@/src/core/execution/ExecutionEngine';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { ActorBoundaryEnforcer } from './ActorBoundaryEnforcer';
import { ErrorHandler } from './ErrorHandler';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { CredentialManager } from '@/src/lib/security/CredentialManager';
import { SecuritySandbox } from '@/src/core/execution/SecuritySandbox';
import { MacKeychainService } from '@/src/lib/security/MacKeychainService';
import { MAC_CONFIG } from '@/src/config/mac.config';

export interface SystemConfig {
  apiKey?: string;
  useRealApi?: boolean;
  maxConcurrentSessions?: number;
  dataDir?: string;
  masterKey?: string;
  useMacKeychain?: boolean;
}

export interface RequestQueueItem {
  id: string;
  request: UserRequest;
  priority: number;
  createdAt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export class SystemOrchestrator {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly sessionManager: SessionManager;
  private readonly actorCoordinator: ActorCoordinator;
  private readonly workflowEngine: WorkflowEngine;
  private readonly stateManager: StateManager;
  private readonly credentialManager: CredentialManager;
  private readonly protocolValidator: ProtocolValidator;
  private readonly boundaryEnforcer: ActorBoundaryEnforcer;
  private readonly errorHandler: ErrorHandler;
  
  private planningEngine?: PlanningEngine;
  private executionEngine?: ExecutionEngine;
  private claudeApiClient?: ClaudeAPIClient;
  private keychainService?: MacKeychainService;
  
  private readonly requestQueue: RequestQueueItem[] = [];
  private isProcessing: boolean = false;
  private readonly config: SystemConfig;

  constructor(config: SystemConfig = {}) {
    this.config = config;
    
    // Initialize logging
    this.logger = new Logger('SystemOrchestrator');
    this.auditLogger = new AuditLogger();
    
    // Initialize security with Mac-specific paths
    const credentialsPath = config.dataDir 
      ? `${config.dataDir}/credentials`
      : MAC_CONFIG.paths.appSupport + '/credentials';
      
    this.credentialManager = new CredentialManager(
      this.logger,
      config.masterKey,
      credentialsPath
    );
    
    // Initialize Mac Keychain service if enabled
    if (config.useMacKeychain !== false && process.platform === 'darwin') {
      this.keychainService = new MacKeychainService(this.logger);
    }
    
    // Initialize core components
    this.protocolValidator = new ProtocolValidator(this.logger);
    this.boundaryEnforcer = new ActorBoundaryEnforcer(this.logger);
    this.errorHandler = new ErrorHandler(this.logger, this.auditLogger);
    
    // Initialize orchestration components
    this.sessionManager = new SessionManager(this.logger, this.auditLogger);
    this.actorCoordinator = new ActorCoordinator(
      this.logger,
      this.auditLogger,
      this.protocolValidator,
      this.boundaryEnforcer,
      this.errorHandler
    );
    this.workflowEngine = new WorkflowEngine(this.logger, this.auditLogger);
    
    // Use Mac-specific data directory
    const stateDir = config.dataDir || MAC_CONFIG.paths.appSupport;
    this.stateManager = new StateManager(this.logger, stateDir);
  }

  /**
   * Initialize the system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing SystemOrchestrator');
    
    try {
      // Initialize credential manager
      await this.credentialManager.initialize();
      
      // Initialize state manager
      await this.stateManager.initialize();
      
      // Setup API client if configured
      if (this.config.useRealApi) {
        await this.setupClaudeAPI();
      }
      
      // Initialize actor engines
      await this.initializeActors();
      
      // Start request processing
      this.startRequestProcessor();
      
      this.logger.info('SystemOrchestrator initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SystemOrchestrator', error as Error);
      throw error;
    }
  }

  /**
   * Submit a request to the system
   */
  async submitRequest(
    userId: string,
    requestContent: string,
    context?: Record<string, any>
  ): Promise<string> {
    const request: UserRequest = {
      id: this.generateRequestId(),
      userId,
      content: requestContent,
      context: context || {},
      timestamp: new Date().toISOString()
    };

    // Create session
    const session = await this.sessionManager.createSession({
      userId,
      request: requestContent,
      context: context || {}
    });

    // Add to queue
    const queueItem: RequestQueueItem = {
      id: session.id,
      request: {
        ...request,
        sessionId: session.id
      },
      priority: this.calculatePriority(request),
      createdAt: new Date().toISOString(),
      status: 'queued'
    };

    this.requestQueue.push(queueItem);
    this.requestQueue.sort((a, b) => b.priority - a.priority);

    this.logger.info('Request submitted', {
      sessionId: session.id,
      userId,
      queuePosition: this.requestQueue.findIndex(item => item.id === session.id) + 1
    });

    // Update metrics
    this.stateManager.updateMetrics({
      totalRequests: this.stateManager.getState().metrics.totalRequests + 1
    });

    return session.id;
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<Session | null> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return null;

    // Add queue position if still queued
    const queueItem = this.requestQueue.find(item => item.id === sessionId);
    if (queueItem && queueItem.status === 'queued') {
      session.metadata.queuePosition = 
        this.requestQueue.findIndex(item => item.id === sessionId) + 1;
    }

    // Add workflow progress
    const workflow = this.workflowEngine.getWorkflowBySessionId(sessionId);
    if (workflow) {
      session.metadata.progress = this.workflowEngine.getProgress(workflow.id);
    }

    return session;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<any> {
    const actorHealth = await this.actorCoordinator.healthCheck();
    const metrics = this.stateManager.getState().metrics;
    const queueStatus = {
      length: this.requestQueue.length,
      processing: this.requestQueue.filter(item => item.status === 'processing').length,
      queued: this.requestQueue.filter(item => item.status === 'queued').length
    };

    return {
      status: actorHealth.healthy ? 'healthy' : 'degraded',
      uptime: metrics.uptime,
      actors: actorHealth.actors,
      queue: queueStatus,
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: metrics.successfulRequests / metrics.totalRequests * 100,
        averageResponseTime: metrics.averageResponseTime
      }
    };
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<any> {
    return {
      system: this.stateManager.getState().metrics,
      sessions: this.sessionManager.getMetrics(),
      actors: this.actorCoordinator.getActorMetrics(),
      workflows: this.workflowEngine.getMetrics(),
      errors: this.errorHandler.getErrorStats()
    };
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SystemOrchestrator');
    
    // Stop processing new requests
    this.isProcessing = false;
    
    // Wait for active operations to complete
    const activeSessions = this.sessionManager.getActiveSessions();
    if (activeSessions.length > 0) {
      this.logger.info(`Waiting for ${activeSessions.length} active sessions to complete`);
      // In production, would wait with timeout
    }
    
    // Save state
    await this.stateManager.shutdown();
    
    this.logger.info('SystemOrchestrator shutdown complete');
  }

  private async setupClaudeAPI(): Promise<void> {
    let apiKey = this.config.apiKey;
    
    // Try Mac Keychain first
    if (!apiKey && this.keychainService) {
      apiKey = await this.keychainService.getAPIKey('claude') || undefined;
    }
    
    // Try to get API key from credential manager if not provided
    if (!apiKey) {
      const credential = await this.credentialManager.getCredentialByName('claude-api-key');
      if (credential) {
        apiKey = credential.value;
      } else if (process.env.ANTHROPIC_API_KEY) {
        apiKey = process.env.ANTHROPIC_API_KEY;
        
        // Store in both credential manager and keychain
        await this.credentialManager.storeCredential({
          name: 'claude-api-key',
          type: 'api_key',
          value: apiKey
        });
        
        if (this.keychainService) {
          await this.keychainService.storeAPIKey('claude', apiKey);
        }
      }
    }
    
    if (!apiKey) {
      this.logger.warn('No Claude API key configured, using mock implementation');
      return;
    }
    
    this.claudeApiClient = new ClaudeAPIClient({ apiKey }, this.logger);
    
    // Validate API key
    const isValid = await this.claudeApiClient.validateApiKey();
    if (!isValid) {
      this.logger.error('Invalid Claude API key');
      this.claudeApiClient = undefined;
    }
  }

  private async initializeActors(): Promise<void> {
    // Initialize Planning Engine
    this.planningEngine = new PlanningEngine(
      this.logger,
      this.protocolValidator,
      this.claudeApiClient
    );
    
    // Initialize Execution Engine
    const sandbox = new SecuritySandbox(this.logger);
    this.executionEngine = new ExecutionEngine(this.logger, sandbox);
    
    // Initialize actor coordinator with engines
    await this.actorCoordinator.initialize(
      this.planningEngine,
      this.executionEngine
    );
  }

  private startRequestProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.canProcessRequest()) {
        this.processNextRequest();
      }
    }, 1000); // Check every second
  }

  private canProcessRequest(): boolean {
    return this.sessionManager.canStartNewSession() &&
           this.actorCoordinator.areActorsAvailable() &&
           this.requestQueue.some(item => item.status === 'queued');
  }

  private async processNextRequest(): Promise<void> {
    const nextItem = this.requestQueue.find(item => item.status === 'queued');
    if (!nextItem) return;
    
    this.isProcessing = true;
    nextItem.status = 'processing';
    
    try {
      const session = this.sessionManager.getSession(nextItem.id);
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Create workflow
      const workflow = this.workflowEngine.createWorkflow(session.id);
      
      // Update session status
      await this.sessionManager.updateSession(session.id, { status: 'planning' });
      
      // Start workflow
      await this.workflowEngine.startStep(workflow.id, 'request', nextItem.request);
      await this.workflowEngine.completeStep(workflow.id, 'request');
      
      // Process through actors
      await this.workflowEngine.startStep(workflow.id, 'planning');
      const result = await this.actorCoordinator.processRequest(session, nextItem.request);
      
      // Complete workflow steps
      await this.workflowEngine.completeStep(workflow.id, 'planning', result.instructions);
      await this.workflowEngine.startStep(workflow.id, 'validation');
      await this.workflowEngine.completeStep(workflow.id, 'validation');
      await this.workflowEngine.startStep(workflow.id, 'execution');
      await this.workflowEngine.completeStep(workflow.id, 'execution', result.executionResult);
      await this.workflowEngine.startStep(workflow.id, 'result');
      await this.workflowEngine.completeStep(workflow.id, 'result', result);
      
      // Complete session
      await this.sessionManager.completeSession(session.id, result.executionResult);
      
      // Update metrics
      this.stateManager.updateMetrics({
        successfulRequests: this.stateManager.getState().metrics.successfulRequests + 1,
        averageResponseTime: result.duration
      });
      
      // Update queue item
      nextItem.status = 'completed';
      
    } catch (error) {
      await this.errorHandler.handleError(error as Error, {
        actor: 'orchestrator',
        operation: 'processRequest',
        severity: 'high'
      });
      
      // Fail the session
      if (nextItem.id) {
        await this.sessionManager.failSession(nextItem.id, (error as Error).message);
      }
      
      // Update metrics
      this.stateManager.updateMetrics({
        failedRequests: this.stateManager.getState().metrics.failedRequests + 1
      });
      
      nextItem.status = 'failed';
    } finally {
      this.isProcessing = false;
      
      // Save state
      await this.stateManager.saveState();
    }
  }

  private calculatePriority(request: UserRequest): number {
    // Basic priority calculation
    let priority = 50; // Base priority
    
    // Adjust based on context
    if (request.context?.priority === 'high') priority += 20;
    if (request.context?.priority === 'low') priority -= 20;
    
    // Could add more sophisticated logic here
    
    return priority;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}