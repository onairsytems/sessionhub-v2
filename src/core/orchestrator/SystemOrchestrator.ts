
/**
 * @actor system
 * @responsibility Main orchestrator that coordinates all system components
 */

import { SessionManager, Session, UserRequest } from './SessionManager';
import { ActorCoordinator } from './ActorCoordinator';
import { WorkflowEngine } from './WorkflowEngine';
import { StateManager } from './StateManager';
import { SessionStateManager } from './SessionStateManager';
import { PlanningEngine } from '@/src/core/planning/PlanningEngine';
import { ExecutionEngine } from '@/src/core/execution/ExecutionEngine';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { ActorBoundaryEnforcer } from './ActorBoundaryEnforcer';
import { ErrorHandler } from './ErrorHandler';
// import { APIErrorHandler } from './APIErrorHandler';
import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { ClaudeCodeAPIClient } from '@/src/lib/api/ClaudeCodeAPIClient';
import { APIAuthenticationManager } from '@/src/lib/api/APIAuthenticationManager';
import { CredentialManager } from '@/src/lib/security/CredentialManager';
import { SecuritySandbox } from '@/src/core/execution/SecuritySandbox';
import { MacKeychainService } from '@/src/lib/security/MacKeychainService';
import { MAC_CONFIG } from '@/src/config/mac.config';
import { SupabaseService } from '@/src/services/cloud/SupabaseService';
import { ConnectionMonitor } from '@/src/services/monitoring/ConnectionMonitor';
import { PatternRecognitionService } from '@/src/services/intelligence/PatternRecognitionService';
import { ResilienceOrchestrator } from './ResilienceOrchestrator';
import { ErrorSeverity } from './EnhancedErrorHandler';
import { RecoveryService } from '@/src/services/RecoveryService';
import { MemoryOptimizationService } from '@/src/services/performance/MemoryOptimizationService';
import { PerformanceMonitor } from '@/src/services/development/PerformanceMonitor';

export interface SystemConfig {
  apiKey?: string;
  useRealApi?: boolean;
  maxConcurrentSessions?: number;
  dataDir?: string;
  masterKey?: string;
  useMacKeychain?: boolean;
  enableResilience?: boolean;
}

export interface RequestQueueItem {
  id: string;
  request: UserRequest & { content?: string };
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
  private readonly sessionStateManager: SessionStateManager;
  private readonly credentialManager: CredentialManager;
  private readonly apiAuthManager: APIAuthenticationManager;
  private readonly protocolValidator: ProtocolValidator;
  private readonly boundaryEnforcer: ActorBoundaryEnforcer;
  private readonly errorHandler: ErrorHandler;
  // // private readonly apiErrorHandler: APIErrorHandler; // Unused
  
  private planningEngine?: PlanningEngine;
  private executionEngine?: ExecutionEngine;
  private claudeApiClient?: ClaudeAPIClient;
  private claudeCodeApiClient?: ClaudeCodeAPIClient;
  private keychainService?: MacKeychainService;
  private supabaseService?: SupabaseService;
  private patternService?: PatternRecognitionService;
  private connectionMonitor: ConnectionMonitor;
  private resilienceOrchestrator?: ResilienceOrchestrator;
  private recoveryService?: RecoveryService;
  private memoryOptimization?: MemoryOptimizationService;
  private performanceMonitor?: PerformanceMonitor;
  
  private readonly config: SystemConfig;
  private readonly requestQueue: RequestQueueItem[] = [];
  private isProcessing: boolean = false;
  constructor(config: SystemConfig = {}) {
    this.config = config;
    const sysConfig = config as SystemConfig;
    
    // Initialize logging
    this.logger = new Logger('SystemOrchestrator');
    this.auditLogger = new AuditLogger();
    
    // Initialize security with Mac-specific paths
    const credentialsPath = sysConfig.dataDir 
      ? `${sysConfig.dataDir}/credentials`
      : MAC_CONFIG.paths.appSupport + '/credentials';
      
    this.credentialManager = new CredentialManager(
      this.logger,
      sysConfig.masterKey,
      credentialsPath
    );
    
    // Initialize API Authentication Manager
    this.apiAuthManager = new APIAuthenticationManager(
      this.logger,
      this.credentialManager
    );
    
    // Initialize Mac Keychain service if enabled
    if (sysConfig.useMacKeychain !== false && process.platform === 'darwin') {
      this.keychainService = new MacKeychainService(this.logger);
    }
    
    // Initialize core components
    this.protocolValidator = new ProtocolValidator(this.logger);
    this.boundaryEnforcer = new ActorBoundaryEnforcer(this.logger);
    this.errorHandler = new ErrorHandler(this.logger, this.auditLogger);
    // this.apiErrorHandler = new APIErrorHandler(this.logger, this.auditLogger);
    
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
    
    // Initialize session state manager
    this.sessionStateManager = new SessionStateManager(
      this.logger,
      this.supabaseService
    );
    
    // Initialize connection monitor
    this.connectionMonitor = new ConnectionMonitor();
  }

  /**
   * Initialize the system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing SystemOrchestrator');
    
    try {
      // Initialize credential manager
      await this.credentialManager.initialize();
      
      // Initialize API Authentication Manager
      await this.apiAuthManager.initialize();
      
      // Initialize state manager
      await this.stateManager.initialize();
      
      // Initialize Supabase service
      try {
        this.supabaseService = new SupabaseService(this.logger);
        await this.supabaseService.initialize();
      } catch (error) {
        this.logger.warn('Supabase initialization failed, continuing without cloud sync', error as Error);
      }
      
      // Initialize pattern recognition service
      this.patternService = new PatternRecognitionService(this.supabaseService);
      
      // Initialize resilience components if enabled
      if ((this.config as SystemConfig).enableResilience !== false) {
        await this.initializeResilience();
      }
      
      // Get API clients from authentication manager
      this.claudeApiClient = this.apiAuthManager.getPlanningClient() || undefined;
      this.claudeCodeApiClient = this.apiAuthManager.getExecutionClient() || undefined;
      
      // Initialize actor engines
      await this.initializeActors();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
      // Start request processing
      this.startRequestProcessor();
      
      this.logger.info('SystemOrchestrator initialized successfully');
    } catch (error: any) {
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
    const requestId = this.generateRequestId();
    const request: UserRequest & { content?: string } = {
      id: requestId,
      sessionId: '', // Will be set by SessionManager
      userId,
      content: requestContent,
      context: context || {},
      timestamp: new Date().toISOString()
    };

    // Create session
    const session = await this.sessionManager.createSession({
      userId,
      content: requestContent,
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
   * Process a user request (alias for submitRequest)
   */
  async processRequest(
    userId: string,
    requestContent: string,
    context?: Record<string, any>
  ): Promise<string> {
    return this.submitRequest(userId, requestContent, context);
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
      session.metadata['queuePosition'] = 
        this.requestQueue.findIndex(item => item.id === sessionId) + 1;
    }

    // Add workflow progress
    const workflow = this.workflowEngine.getWorkflowBySessionId(sessionId);
    if (workflow) {
      session.metadata['progress'] = this.workflowEngine.getProgress(workflow.id);
    }

    return session;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<any> {
    const actorHealth = await this.actorCoordinator.healthCheck();
    const metrics = this.stateManager.getState().metrics;
    const connectionHealth = this.connectionMonitor.getHealth();
    const connectionStats = this.connectionMonitor.getStatistics();
    
    const queueStatus = {
      length: this.requestQueue.length,
      processing: this.requestQueue.filter(item => item.status === 'processing').length,
      queued: this.requestQueue.filter(item => item.status === 'queued').length
    };

    // Include resilience status if available
    const resilienceStatus = this.resilienceOrchestrator?.getStatus();

    // Determine overall status based on actors, connections, and resilience
    let overallStatus: 'healthy' | 'degraded' | 'offline' | 'recovering';
    if (resilienceStatus?.overall === 'recovering') {
      overallStatus = 'recovering';
    } else if (resilienceStatus?.overall === 'critical' || connectionHealth.overall === 'offline') {
      overallStatus = 'offline';
    } else if (actorHealth.healthy && connectionHealth.overall === 'healthy' && 
               (!resilienceStatus || resilienceStatus.overall === 'healthy')) {
      overallStatus = 'healthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      uptime: metrics.uptime,
      actors: actorHealth.actors,
      connections: {
        status: connectionHealth.overall,
        services: Object.fromEntries(connectionHealth.services),
        statistics: connectionStats
      },
      queue: queueStatus,
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: metrics.totalRequests > 0 
          ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)
          : 0,
        averageResponseTime: metrics.averageResponseTime
      },
      resilience: resilienceStatus
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
   * Get session state manager
   */
  getSessionStateManager(): SessionStateManager {
    return this.sessionStateManager;
  }

  /**
   * Get actor coordinator
   */
  getActorCoordinator(): ActorCoordinator {
    return this.actorCoordinator;
  }

  /**
   * Get API authentication manager
   */
  getAPIAuthenticationManager(): APIAuthenticationManager {
    return this.apiAuthManager;
  }

  /**
   * Get real API availability status
   */
  getRealAPIStatus(): { planning: boolean; execution: boolean } {
    return this.apiAuthManager.isRealAPIAvailable();
  }

  /**
   * Configure API credentials
   */
  async configureAPICredentials(credentials: {
    anthropicApiKey?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
    figmaToken?: string;
    githubToken?: string;
  }): Promise<void> {
    await this.apiAuthManager.storeAPICredentials(credentials);
    
    // Refresh API clients
    this.claudeApiClient = this.apiAuthManager.getPlanningClient() || undefined;
    this.claudeCodeApiClient = this.apiAuthManager.getExecutionClient() || undefined;
    
    // Reinitialize actors with new clients
    await this.initializeActors();
    
    this.logger.info('API credentials configured and actors reinitialized', {
      planningEnabled: !!this.claudeApiClient,
      executionEnabled: !!this.claudeCodeApiClient
    });
  }

  /**
   * Validate all API credentials
   */
  async validateAPICredentials(): Promise<{
    anthropic: { valid: boolean; error?: string };
    supabase: { valid: boolean; error?: string };
    figma: { valid: boolean; error?: string };
    github: { valid: boolean; error?: string };
  }> {
    return this.apiAuthManager.validateCredentials();
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(): unknown {
    return this.actorCoordinator.getQueueMetrics();
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down SystemOrchestrator');
    
    // Stop processing new requests
    this.isProcessing = false;
    
    // Stop connection monitoring
    this.connectionMonitor.stop();
    
    // Wait for active operations to complete
    const activeSessions = this.sessionManager.getActiveSessions();
    if (activeSessions.length > 0) {
      this.logger.info(`Waiting for ${activeSessions.length} active sessions to complete`);
      // In production, would wait with timeout
    }
    
    // Cleanup services
    if (this.supabaseService) {
      await this.supabaseService.cleanup();
    }
    
    // Save state
    await this.stateManager.shutdown();
    
    this.logger.info('SystemOrchestrator shutdown complete');
  }


  private async initializeActors(): Promise<void> {
    // Initialize Planning Engine with pattern service
    this.planningEngine = new PlanningEngine(
      this.logger,
      this.protocolValidator,
      this.claudeApiClient,
      this.patternService
    );
    
    // Initialize Execution Engine
    const sandbox = new SecuritySandbox(this.logger);
    this.executionEngine = new ExecutionEngine(
      this.logger, 
      this.protocolValidator, 
      sandbox,
      this.claudeCodeApiClient
    );
    
    // Initialize actor coordinator with engines
    await this.actorCoordinator.initialize(
      this.planningEngine,
      this.executionEngine
    );
  }

  /**
   * Initialize resilience components
   */
  private async initializeResilience(): Promise<void> {
    this.logger.info('Initializing resilience components');
    
    try {
      // Initialize supporting services
      this.recoveryService = new RecoveryService(
        this.logger,
        this.stateManager,
        this.sessionStateManager
      );
      
      this.memoryOptimization = new MemoryOptimizationService(this.logger);
      this.performanceMonitor = new PerformanceMonitor();
      
      // Initialize resilience orchestrator
      this.resilienceOrchestrator = new ResilienceOrchestrator(
        this.logger,
        this.auditLogger,
        this.recoveryService,
        this.memoryOptimization,
        this.connectionMonitor,
        this.performanceMonitor,
        {
          enableHealthMonitoring: true,
          enablePredictiveFailureDetection: true,
          enableAutomaticRecovery: true,
          enableTelemetryCollection: true
        }
      );
      
      // Start resilience monitoring
      await this.resilienceOrchestrator.start();
      
      // Listen for resilience events
      this.resilienceOrchestrator.on('criticalHealth', (status) => {
        this.logger.error('Critical system health detected', undefined, status);
      });
      
      this.resilienceOrchestrator.on('failurePredicted', (prediction) => {
        this.logger.warn('Failure predicted', prediction);
      });
      
      this.resilienceOrchestrator.on('recoveryCompleted', (result) => {
        this.logger.info('Recovery completed', result);
      });
      
      this.logger.info('Resilience components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize resilience components', error as Error);
      // Continue without resilience features
    }
  }

  private setupConnectionMonitoring(): void {
    // Register services for monitoring
    this.connectionMonitor.registerStandardServices({
      claudeApi: this.claudeApiClient,
      supabaseService: this.supabaseService,
      patternService: this.patternService
    });

    // Listen for connection events
    this.connectionMonitor.on('statusChange', (service: string, status: any) => {
      this.logger.info('Service connection status changed', { service, status: status.status });
    });

    this.connectionMonitor.on('error', (service: string, error: Error) => {
      this.logger.error('Service connection error', error, { service });
    });

    // Start monitoring
    this.connectionMonitor.start();
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
      
      // Create session state
      const sessionContext = {
        projectPath: session.metadata['projectPath'] || process.cwd(),
        projectType: nextItem.request.context?.['projectType'] || 'web',
        language: nextItem.request.context?.['language'] || 'typescript',
        framework: nextItem.request.context?.['framework'],
        environment: nextItem.request.context?.['environment'] || {},
        userPreferences: nextItem.request.context?.['preferences'] || {},
        apiKeys: {
          claudeChatConfigured: !!this.claudeApiClient,
          claudeCodeConfigured: !!this.claudeCodeApiClient
        }
      };
      
      await this.sessionStateManager.createSession(session.id, sessionContext);
      
      // Record user request in session history
      // Convert SessionManager.UserRequest to PlanningEngine.UserRequest format
      const planningUserRequest = {
        id: nextItem.request.id,
        content: nextItem.request.content,
        context: nextItem.request.context,
        sessionId: nextItem.request.sessionId,
        timestamp: new Date().toISOString()
      };
      await this.sessionStateManager.recordUserRequest(session.id, planningUserRequest);
      
      // Create workflow
      const workflow = this.workflowEngine.createWorkflow(session.id);
      
      // Update session status
      await this.sessionManager.updateSession(session.id, { status: 'planning' });
      await this.sessionStateManager.updateStatus(session.id, 'active');
      
      // Start workflow
      await this.workflowEngine.startStep(workflow.id, 'request', nextItem.request);
      await this.workflowEngine.completeStep(workflow.id, 'request');
      
      // Process through actors
      await this.workflowEngine.startStep(workflow.id, 'planning');
      const result = await this.actorCoordinator.processRequest(session, nextItem.request);
      
      // Record instructions in session history
      await this.sessionStateManager.recordInstructions(
        session.id, 
        result.instructions, 
        nextItem.request.id
      );
      
      // Complete workflow steps
      await this.workflowEngine.completeStep(workflow.id, 'planning', result.instructions);
      await this.workflowEngine.startStep(workflow.id, 'validation');
      await this.workflowEngine.completeStep(workflow.id, 'validation');
      await this.workflowEngine.startStep(workflow.id, 'execution');
      await this.workflowEngine.completeStep(workflow.id, 'execution', result.executionResult);
      await this.workflowEngine.startStep(workflow.id, 'result');
      await this.workflowEngine.completeStep(workflow.id, 'result', result);
      
      // Record execution result in session history
      // Convert SessionManager.ExecutionResult to Instruction.ExecutionResult format
      const instructionExecutionResult = {
        instructionId: result.instructions.metadata.id,
        status: result.executionResult.status,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        outputs: result.executionResult.deliverables.map(d => ({
          type: d.type as any,
          data: { path: d.path, status: d.status }
        })),
        errors: result.executionResult.errors.map(e => ({
          code: 'EXECUTION_ERROR',
          message: e,
          details: {}
        })),
        logs: result.executionResult.logs,
        validationResults: []
      };
      await this.sessionStateManager.recordExecutionResult(
        session.id,
        instructionExecutionResult,
        result.instructions.metadata.id
      );
      
      // Complete session
      await this.sessionManager.completeSession(session.id, result.executionResult);
      await this.sessionStateManager.updateStatus(session.id, 'completed');
      
      // Update metrics
      this.stateManager.updateMetrics({
        successfulRequests: this.stateManager.getState().metrics.successfulRequests + 1,
        averageResponseTime: result.duration
      });
      
      // Update queue item
      nextItem.status = 'completed';
      
    } catch (error: any) {
      // Use resilience orchestrator if available
      if (this.resilienceOrchestrator) {
        await this.resilienceOrchestrator.handleError(error as Error, {
          actor: 'orchestrator',
          operation: 'processRequest',
          severity: ErrorSeverity.HIGH,
          recoverable: true,
          retryable: true
        });
      } else {
        await this.errorHandler.handleError(error as Error, {
          actor: 'orchestrator',
          operation: 'processRequest'
        });
      }
      
      // Record error in session history
      if (nextItem.id) {
        await this.sessionStateManager.recordError(
          nextItem.id,
          error as Error,
          'system'
        );
      }
      
      // Fail the session
      if (nextItem.id) {
        await this.sessionManager.failSession(nextItem.id, (error as Error).message);
        await this.sessionStateManager.updateStatus(nextItem.id, 'failed');
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

  private calculatePriority(request: UserRequest & { content?: string }): number {
    // Basic priority calculation
    let priority = 50; // Base priority
    
    // Adjust based on context
    if (request.context?.['priority'] === 'high') priority += 20;
    if (request.context?.['priority'] === 'low') priority -= 20;
    
    // Could add more sophisticated logic here
    
    return priority;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Keychain helpers
  async getKeychainCredential(account: string): Promise<string | null> {
    if (this.keychainService) {
      return this.keychainService.getCredential(account);
    }
    return null;
  }

  /**
   * Get resilience statistics
   */
  getResilienceStats(): any {
    if (!this.resilienceOrchestrator) {
      return null;
    }
    return this.resilienceOrchestrator.getStats();
  }

  /**
   * Get failure predictions
   */
  getFailurePredictions(): any {
    if (!this.resilienceOrchestrator) {
      return [];
    }
    return this.resilienceOrchestrator.getPredictions();
  }

  /**
   * Trigger manual recovery for a component
   */
  async triggerRecovery(component: string): Promise<void> {
    if (!this.resilienceOrchestrator) {
      throw new Error('Resilience features not enabled');
    }
    await this.resilienceOrchestrator.triggerRecovery(component);
  }

  /**
   * Update resilience configuration
   */
  updateResilienceConfig(config: any): void {
    if (!this.resilienceOrchestrator) {
      throw new Error('Resilience features not enabled');
    }
    this.resilienceOrchestrator.updateConfig(config);
  }

  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<any> {
    if (!this.resilienceOrchestrator) {
      return this.getHealthStatus();
    }
    return await this.resilienceOrchestrator.checkHealth();
  }
}