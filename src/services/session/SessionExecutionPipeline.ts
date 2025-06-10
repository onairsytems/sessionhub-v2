/**
 * @actor system
 * @responsibility Orchestrate end-to-end session execution with document analysis
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { SecuritySandbox } from '@/src/core/execution/SecuritySandbox';
import { SessionManager, Session, UserRequest, ExecutionResult } from '@/src/core/orchestrator/SessionManager';
import { WorkflowEngine } from '@/src/core/orchestrator/WorkflowEngine';
import { PlanningEngine } from '@/src/core/planning/PlanningEngine';
import { ExecutionEngine } from '@/src/core/execution/ExecutionEngine';
import { DocumentImportService, ImportResult } from '../document/DocumentImportService';
import { DocumentAnalysisService, DocumentAnalysis, DocumentMetadata } from '../document/DocumentAnalysisService';
// import { PatternRecognitionService } from '../intelligence/PatternRecognitionService';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { InstructionProtocol } from '@/src/models/Instruction';
import { EventEmitter } from 'events';

export interface SessionDocument {
  source: { type: 'file' | 'url' | 'google-docs'; path: string };
  metadata?: DocumentMetadata;
  analysis?: DocumentAnalysis;
  importResult?: ImportResult;
}

export interface SessionExecutionRequest {
  userId: string;
  projectId: string;
  description: string;
  documents?: SessionDocument[];
  context?: Record<string, any>;
}

export interface SessionProgress {
  phase: 'initializing' | 'importing' | 'analyzing' | 'planning' | 'executing' | 'reviewing' | 'completed';
  step: string;
  progress: number; // 0-100
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface EnhancedSession extends Session {
  documents?: SessionDocument[];
  documentAnalysis?: DocumentAnalysis;
  progress?: SessionProgress[];
}

export class SessionExecutionPipeline extends EventEmitter {
  private readonly logger: Logger;
  // private readonly _auditLogger: AuditLogger;
  private readonly protocolValidator: ProtocolValidator;
  private readonly securitySandbox: SecuritySandbox;
  private readonly sessionManager: SessionManager;
  private readonly workflowEngine: WorkflowEngine;
  private readonly planningEngine: PlanningEngine;
  private readonly executionEngine: ExecutionEngine;
  private readonly documentImport: DocumentImportService;
  private readonly documentAnalysis: DocumentAnalysisService;
  // private readonly patternRecognition: PatternRecognitionService;
  private readonly progressCallbacks: Map<string, (progress: SessionProgress) => void> = new Map();

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    claudeClient: ClaudeAPIClient
  ) {
    super();
    this.logger = logger;
    // this._auditLogger = auditLogger;
    
    // Initialize all services
    this.protocolValidator = new ProtocolValidator(logger);
    this.securitySandbox = new SecuritySandbox(logger);
    this.sessionManager = new SessionManager(logger, auditLogger);
    this.workflowEngine = new WorkflowEngine(logger, auditLogger);
    this.planningEngine = new PlanningEngine(logger, this.protocolValidator, claudeClient);
    this.executionEngine = new ExecutionEngine(logger, this.protocolValidator, this.securitySandbox);
    this.documentImport = new DocumentImportService(logger, auditLogger);
    this.documentAnalysis = new DocumentAnalysisService(logger, auditLogger, claudeClient);
    // this.patternRecognition = new PatternRecognitionService();
  }

  /**
   * Execute a complete session from request to completion
   */
  async executeSession(request: SessionExecutionRequest): Promise<EnhancedSession> {
    const startTime = Date.now();
    let session: EnhancedSession | null = null;

    try {
      // Initialize session
      session = await this.initializeSession(request);
      
      // Import and analyze documents if provided
      if (request.documents && request.documents.length > 0) {
        await this.importAndAnalyzeDocuments(session, request.documents);
      }

      // Execute planning phase
      const instructions = await this.executePlanningPhase(session);
      
      // Execute implementation phase
      const result = await this.executeImplementationPhase(session, instructions);
      
      // Complete session with review
      await this.completeSession(session, result);

      this.logger.info('Session execution completed', {
        sessionId: session.id,
        duration: Date.now() - startTime,
        status: session.status
      });

      return session;
    } catch (error) {
      this.logger.error('Session execution failed', error as Error, {
        sessionId: session?.id
      });

      if (session) {
        await this.handleSessionFailure(session, error as Error);
      }

      throw error;
    }
  }

  /**
   * Initialize a new session
   */
  private async initializeSession(request: SessionExecutionRequest): Promise<EnhancedSession> {
    this.logger.info('Initializing session', { userId: request.userId });

    const userRequest: Omit<UserRequest, 'id' | 'sessionId' | 'timestamp'> = {
      userId: request.userId,
      content: request.description,
      context: {
        projectId: request.projectId,
        ...request.context
      }
    };

    const session = await this.sessionManager.createSession(userRequest) as EnhancedSession;
    session.documents = request.documents || [];
    session.progress = [];

    await this.updateProgress(session, this.createProgress({
      phase: 'initializing',
      step: 'Session created',
      progress: 10,
      message: 'Session initialized successfully'
    }));

    return session;
  }

  /**
   * Import and analyze documents
   */
  private async importAndAnalyzeDocuments(
    session: EnhancedSession,
    documents: SessionDocument[]
  ): Promise<void> {
    this.logger.info('Starting document import and analysis', {
      sessionId: session.id,
      documentCount: documents.length
    });

    await this.updateProgress(session, this.createProgress({
      phase: 'importing',
      step: 'Importing documents',
      progress: 15,
      message: `Importing ${documents.length} document(s)...`
    }));

    // Import all documents
    const importPromises = documents.map(async (doc, index) => {
      const result = await this.documentImport.importFromFile(doc.source.path);
      doc.importResult = result;
      
      if (result.success && result.document) {
        doc.metadata = result.document;
        
        await this.updateProgress(session, this.createProgress({
          phase: 'importing',
          step: `Document ${index + 1} imported`,
          progress: 15 + (10 * (index + 1) / documents.length),
          message: `Imported: ${result.document.name}`
        }));
      }
    });

    await Promise.all(importPromises);

    // Analyze imported documents
    await this.updateProgress(session, this.createProgress({
      phase: 'analyzing',
      step: 'Analyzing documents',
      progress: 30,
      message: 'Extracting requirements and patterns from documents...'
    }));

    const successfulImports = documents
      .filter(d => d.importResult?.success && d.metadata)
      .map(d => d.metadata!);

    if (successfulImports.length > 0) {
      const analysis = await this.documentAnalysis.analyzeDocumentSet(
        successfulImports,
        { sessionId: session.id }
      );

      session.documentAnalysis = analysis;

      // Add analysis to each document
      documents.forEach(doc => {
        if (doc.metadata) {
          doc.analysis = analysis;
        }
      });

      await this.updateProgress(session, this.createProgress({
        phase: 'analyzing',
        step: 'Analysis complete',
        progress: 40,
        message: `Extracted ${analysis.requirements.length} requirements and ${analysis.suggestedQuestions.length} clarifying questions`,
        details: {
          requirementCount: analysis.requirements.length,
          ambiguityCount: analysis.ambiguities.length,
          confidenceScore: analysis.confidenceScore
        }
      }));
    }

    // Update session with documents
    await this.sessionManager.updateSession(session.id, {
      metadata: {
        ...session.metadata,
        documentsImported: successfulImports.length,
        documentAnalysisComplete: true
      }
    });
  }

  /**
   * Execute planning phase with document context
   */
  private async executePlanningPhase(session: EnhancedSession): Promise<InstructionProtocol> {
    this.logger.info('Starting planning phase', { sessionId: session.id });

    await this.updateProgress(session, this.createProgress({
      phase: 'planning',
      step: 'Generating plan',
      progress: 45,
      message: 'Planning Actor is analyzing requirements and generating instructions...'
    }));

    // Prepare context with document analysis
    const planningContext: Record<string, any> = {
      ...session.request!.context,
      documentAnalysis: session.documentAnalysis,
      patterns: []
    };

    // Add design guidance if visual documents were analyzed
    if (session.documentAnalysis?.designGuidance) {
      planningContext['designGuidance'] = session.documentAnalysis.designGuidance;
    }

    // Add planning context to the request
    const enhancedRequest = {
      ...session.request!,
      context: planningContext
    };
    
    // Generate instructions
    const instructions = await this.planningEngine.generateInstructions(enhancedRequest);

    await this.sessionManager.updateSession(session.id, {
      status: 'planning',
      instructions
    });

    await this.updateProgress(session, this.createProgress({
      phase: 'planning',
      step: 'Planning complete',
      progress: 60,
      message: `Generated ${instructions.requirements.length} requirements for execution`,
      details: {
        requirementCount: instructions.requirements.length,
        objectiveCount: instructions.objectives.length
      }
    }));

    return instructions;
  }

  /**
   * Execute implementation phase
   */
  private async executeImplementationPhase(
    session: EnhancedSession,
    instructions: InstructionProtocol
  ): Promise<ExecutionResult> {
    this.logger.info('Starting execution phase', { sessionId: session.id });

    await this.updateProgress(session, this.createProgress({
      phase: 'executing',
      step: 'Starting execution',
      progress: 65,
      message: 'Execution Actor is implementing the plan...'
    }));

    await this.sessionManager.updateSession(session.id, {
      status: 'executing'
    });

    // Track execution progress
    let completedTasks = 0;
    const totalTasks = instructions.requirements.length;

    // Execute with progress tracking
    const result = await this.executionEngine.executeInstructions(instructions, {
      workingDirectory: process.cwd(),
      environment: process.env as Record<string, string>,
      timeout: 300000, // 5 minutes
      dryRun: false
    });

    // Convert from Instruction.ExecutionResult to SessionManager.ExecutionResult
    const sessionResult: ExecutionResult = {
      sessionId: session.id,
      status: result.status === 'success' ? 'success' : result.status === 'partial' ? 'partial' : 'failure',
      deliverables: result.outputs.map(output => ({
        type: output.type,
        path: output.path || '',
        status: result.status === 'success' ? 'created' : 'failed'
      })),
      logs: result.logs,
      errors: result.errors.map(e => e.message),
      metrics: {
        duration: new Date(result.endTime).getTime() - new Date(result.startTime).getTime(),
        tasksCompleted: result.status === 'success' ? totalTasks : completedTasks,
        tasksFailed: result.errors.length
      }
    };
    
    return sessionResult;
  }

  /**
   * Complete session with review
   */
  private async completeSession(
    session: EnhancedSession,
    result: ExecutionResult
  ): Promise<void> {
    this.logger.info('Completing session', { sessionId: session.id });

    await this.updateProgress(session, this.createProgress({
      phase: 'reviewing',
      step: 'Verifying results',
      progress: 95,
      message: 'Reviewing and verifying implementation...'
    }));

    // Complete session with verification
    await this.sessionManager.completeSession(session.id, result);

    await this.updateProgress(session, this.createProgress({
      phase: 'completed',
      step: 'Session complete',
      progress: 100,
      message: 'Session completed successfully!',
      details: {
        deliverables: result.deliverables.length,
        duration: result.metrics.duration,
        successRate: (result.metrics.tasksCompleted / (result.metrics.tasksCompleted + result.metrics.tasksFailed)) * 100
      }
    }));
  }

  /**
   * Handle session failure
   */
  private async handleSessionFailure(session: EnhancedSession, error: Error): Promise<void> {
    await this.sessionManager.failSession(session.id, error.message);

    await this.updateProgress(session, this.createProgress({
      phase: session.status as any,
      step: 'Session failed',
      progress: -1,
      message: `Error: ${error.message}`,
      details: {
        error: error.message,
        stack: error.stack
      }
    }));
  }

  /**
   * Update session progress
   */
  private createProgress(data: Omit<SessionProgress, 'timestamp'>): SessionProgress {
    return {
      ...data,
      timestamp: new Date().toISOString()
    };
  }

  private async updateProgress(session: EnhancedSession, progress: SessionProgress): Promise<void> {
    progress.timestamp = new Date().toISOString();
    
    if (!session.progress) {
      session.progress = [];
    }
    
    session.progress.push(progress);

    // Notify callbacks
    const callback = this.progressCallbacks.get(session.id);
    if (callback) {
      callback(progress);
    }

    this.logger.debug('Session progress update', {
      sessionId: session.id,
      phase: progress.phase,
      progress: progress.progress
    });
  }

  /**
   * Subscribe to session progress updates
   */
  subscribeToProgress(sessionId: string, callback: (progress: SessionProgress) => void): void {
    this.progressCallbacks.set(sessionId, callback);
  }

  /**
   * Unsubscribe from session progress updates
   */
  unsubscribeFromProgress(sessionId: string): void {
    this.progressCallbacks.delete(sessionId);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): EnhancedSession | undefined {
    return this.sessionManager.getSession(sessionId) as EnhancedSession;
  }

  /**
   * Get sessions for user
   */
  getUserSessions(userId: string): EnhancedSession[] {
    return this.sessionManager.getUserSessions(userId) as EnhancedSession[];
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): any {
    return {
      sessions: this.sessionManager.getMetrics(),
      workflow: this.workflowEngine.getMetrics(),
      planning: {},
      execution: {}
    };
  }
}