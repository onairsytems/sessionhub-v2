/**
 * Session Inspector for SessionHub
 * Provides deep visibility into planning and execution processes for validation
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface SessionState {
  id: string;
  name: string;
  phase: 'planning' | 'execution' | 'validation' | 'completed';
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'completed' | 'failed';
  planningSteps: PlanningStep[];
  executionSteps: ExecutionStep[];
  validationResults: ValidationResult[];
  metrics: SessionMetrics;
  events: SessionEvent[];
  errors: ErrorRecord[];
}

export interface PlanningStep {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  input?: any;
  output?: any;
  dependencies: string[];
  validations: StepValidation[];
}

export interface ExecutionStep {
  id: string;
  planningStepId: string;
  name: string;
  command?: string;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  logs: LogEntry[];
  resourceUsage?: ResourceUsage;
  artifacts: string[];
}

export interface ValidationResult {
  id: string;
  type: 'syntax' | 'logic' | 'integration' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  timestamp: number;
  resolved: boolean;
}

export interface SessionMetrics {
  totalDuration?: number;
  planningDuration?: number;
  executionDuration?: number;
  validationDuration?: number;
  stepCount: number;
  successfulSteps: number;
  failedSteps: number;
  skippedSteps: number;
  errorCount: number;
  warningCount: number;
  memoryPeakUsage?: number;
  cpuPeakUsage?: number;
}

export interface SessionEvent {
  timestamp: number;
  type: string;
  category: 'system' | 'user' | 'planning' | 'execution' | 'validation';
  message: string;
  data?: any;
}

export interface ErrorRecord {
  timestamp: number;
  type: string;
  message: string;
  stack?: string;
  context?: any;
  resolved: boolean;
}

export interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export interface StepValidation {
  name: string;
  passed: boolean;
  message?: string;
  details?: any;
}

export interface ResourceUsage {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
}

export interface InspectionOptions {
  captureSystemMetrics: boolean;
  captureNetworkActivity: boolean;
  captureFileSystemChanges: boolean;
  verboseLogging: boolean;
  realTimeUpdates: boolean;
  persistInspectionData: boolean;
  inspectionDataPath?: string;
}

export class SessionInspector extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private activeSession?: SessionState;
  private options: InspectionOptions;
  private metricsInterval?: NodeJS.Timeout;
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();

  constructor(options: Partial<InspectionOptions> = {}) {
    super();
    this.options = {
      captureSystemMetrics: true,
      captureNetworkActivity: true,
      captureFileSystemChanges: true,
      verboseLogging: false,
      realTimeUpdates: true,
      persistInspectionData: true,
      inspectionDataPath: './inspection-data',
      ...options
    };

    this.initialize();
  }

  private initialize(): void {
    if (this.options.persistInspectionData && this.options.inspectionDataPath) {
      fs.mkdirSync(this.options.inspectionDataPath, { recursive: true });
    }

    if (this.options.captureSystemMetrics) {
      this.startMetricsCapture();
    }
  }

  /**
   * Start inspecting a new session
   */
  public startSession(sessionId: string, sessionName: string): SessionState {
    const session: SessionState = {
      id: sessionId,
      name: sessionName,
      phase: 'planning',
      startTime: Date.now(),
      status: 'active',
      planningSteps: [],
      executionSteps: [],
      validationResults: [],
      metrics: {
        stepCount: 0,
        successfulSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        errorCount: 0,
        warningCount: 0
      },
      events: [],
      errors: []
    };

    this.sessions.set(sessionId, session);
    this.activeSession = session;

    this.recordEvent(session, {
      type: 'session-start',
      category: 'system',
      message: `Session ${sessionName} started`
    });

    if (this.options.realTimeUpdates) {
      this.emit('session:start', session);
    }

    return session;
  }

  /**
   * Record a planning step
   */
  public recordPlanningStep(
    sessionId: string,
    step: Omit<PlanningStep, 'timestamp' | 'validations'>
  ): PlanningStep {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const planningStep: PlanningStep = {
      ...step,
      timestamp: Date.now(),
      validations: []
    };

    session.planningSteps.push(planningStep);
    session.metrics.stepCount++;

    this.recordEvent(session, {
      type: 'planning-step',
      category: 'planning',
      message: `Planning step: ${step.name}`,
      data: { stepId: step.id }
    });

    if (this.options.realTimeUpdates) {
      this.emit('planning:step', { session, step: planningStep });
    }

    return planningStep;
  }

  /**
   * Record an execution step
   */
  public recordExecutionStep(
    sessionId: string,
    step: Omit<ExecutionStep, 'timestamp' | 'logs' | 'artifacts'>
  ): ExecutionStep {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const executionStep: ExecutionStep = {
      ...step,
      timestamp: Date.now(),
      logs: [],
      artifacts: []
    };

    session.executionSteps.push(executionStep);

    if (session.phase === 'planning') {
      session.phase = 'execution';
    }

    this.recordEvent(session, {
      type: 'execution-step',
      category: 'execution',
      message: `Execution step: ${step.name}`,
      data: { stepId: step.id, status: step.status }
    });

    if (this.options.realTimeUpdates) {
      this.emit('execution:step', { session, step: executionStep });
    }

    return executionStep;
  }

  /**
   * Update step status
   */
  public updateStepStatus(
    sessionId: string,
    stepId: string,
    status: 'completed' | 'failed' | 'skipped',
    result?: any
  ): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    // Update planning step
    const planningStep = session.planningSteps.find(s => s.id === stepId);
    if (planningStep) {
      // PlanningStep doesn't have 'skipped' status, convert to 'failed'
      planningStep.status = status === 'skipped' ? 'failed' : status;
      planningStep.duration = Date.now() - planningStep.timestamp;
      if (result) planningStep.output = result;
    }

    // Update execution step
    const executionStep = session.executionSteps.find(s => s.id === stepId);
    if (executionStep) {
      executionStep.status = status;
      executionStep.duration = Date.now() - executionStep.timestamp;
      if (result) executionStep.result = result;

      // Update metrics
      if (status === 'completed') {
        session.metrics.successfulSteps++;
      } else if (status === 'failed') {
        session.metrics.failedSteps++;
      } else if (status === 'skipped') {
        session.metrics.skippedSteps++;
      }
    }

    if (this.options.realTimeUpdates) {
      this.emit('step:update', { session, stepId, status });
    }
  }

  /**
   * Record a validation result
   */
  public recordValidation(
    sessionId: string,
    validation: Omit<ValidationResult, 'id' | 'timestamp' | 'resolved'>
  ): ValidationResult {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result: ValidationResult = {
      ...validation,
      id: `val-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false
    };

    session.validationResults.push(result);

    if (validation.severity === 'error' || validation.severity === 'critical') {
      session.metrics.errorCount++;
    } else if (validation.severity === 'warning') {
      session.metrics.warningCount++;
    }

    this.recordEvent(session, {
      type: 'validation-result',
      category: 'validation',
      message: validation.message,
      data: { severity: validation.severity, type: validation.type }
    });

    if (this.options.realTimeUpdates) {
      this.emit('validation:result', { session, validation: result });
    }

    return result;
  }

  /**
   * Add log entry to a step
   */
  public addStepLog(
    sessionId: string,
    stepId: string,
    log: Omit<LogEntry, 'timestamp'>
  ): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const step = session.executionSteps.find(s => s.id === stepId);
    if (!step) return;

    const logEntry: LogEntry = {
      ...log,
      timestamp: Date.now()
    };

    step.logs.push(logEntry);

    if (this.options.verboseLogging || log.level === 'error') {
      this.recordEvent(session, {
        type: 'step-log',
        category: 'execution',
        message: log.message,
        data: { stepId, level: log.level }
      });
    }
  }

  /**
   * Record an error
   */
  public recordError(
    sessionId: string,
    error: Error | string,
    context?: any
  ): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const errorRecord: ErrorRecord = {
      timestamp: Date.now(),
      type: error instanceof Error ? error.constructor.name : 'Error',
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      resolved: false
    };

    session.errors.push(errorRecord);
    session.metrics.errorCount++;

    this.recordEvent(session, {
      type: 'error',
      category: 'system',
      message: errorRecord.message,
      data: { type: errorRecord.type, context }
    });

    if (this.options.realTimeUpdates) {
      this.emit('error:recorded', { session, error: errorRecord });
    }
  }

  /**
   * Complete session inspection
   */
  public completeSession(sessionId: string, status: 'completed' | 'failed' = 'completed'): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    session.endTime = Date.now();
    session.status = status;
    session.phase = 'completed';

    // Calculate final metrics
    session.metrics.totalDuration = session.endTime - session.startTime;
    session.metrics.planningDuration = this.calculatePhaseDuration(session, 'planning');
    session.metrics.executionDuration = this.calculatePhaseDuration(session, 'execution');
    session.metrics.validationDuration = this.calculatePhaseDuration(session, 'validation');

    this.recordEvent(session, {
      type: 'session-complete',
      category: 'system',
      message: `Session ${session.name} completed with status: ${status}`,
      data: { metrics: session.metrics }
    });

    if (this.options.persistInspectionData) {
      this.persistSessionData(session);
    }

    if (this.options.realTimeUpdates) {
      this.emit('session:complete', session);
    }

    if (this.activeSession?.id === sessionId) {
      this.activeSession = undefined;
    }
  }

  /**
   * Generate inspection report
   */
  public generateReport(sessionId: string): InspectionReport {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const report: InspectionReport = {
      sessionId: session.id,
      sessionName: session.name,
      status: session.status,
      duration: session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime,
      summary: {
        totalSteps: session.metrics.stepCount,
        successfulSteps: session.metrics.successfulSteps,
        failedSteps: session.metrics.failedSteps,
        skippedSteps: session.metrics.skippedSteps,
        errors: session.metrics.errorCount,
        warnings: session.metrics.warningCount
      },
      phases: {
        planning: {
          duration: session.metrics.planningDuration || 0,
          steps: session.planningSteps.length,
          completed: session.planningSteps.filter(s => s.status === 'completed').length
        },
        execution: {
          duration: session.metrics.executionDuration || 0,
          steps: session.executionSteps.length,
          completed: session.executionSteps.filter(s => s.status === 'completed').length
        },
        validation: {
          duration: session.metrics.validationDuration || 0,
          results: session.validationResults.length,
          criticalIssues: session.validationResults.filter(v => v.severity === 'critical').length
        }
      },
      timeline: this.generateTimeline(session),
      recommendations: this.generateRecommendations(session)
    };

    return report;
  }

  /**
   * Get real-time session status
   */
  public getSessionStatus(sessionId: string): SessionStatus {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentStep = this.getCurrentStep(session);
    const progress = this.calculateProgress(session);

    return {
      sessionId: session.id,
      phase: session.phase,
      status: session.status,
      currentStep: currentStep ? {
        id: currentStep.id,
        name: currentStep.name,
        status: currentStep.status,
        duration: Date.now() - currentStep.timestamp
      } : undefined,
      progress,
      metrics: session.metrics,
      recentEvents: session.events.slice(-10)
    };
  }

  // Helper methods

  private getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  private recordEvent(session: SessionState, event: Omit<SessionEvent, 'timestamp'>): void {
    const sessionEvent: SessionEvent = {
      ...event,
      timestamp: Date.now()
    };
    session.events.push(sessionEvent);
  }

  private calculatePhaseDuration(session: SessionState, phase: string): number {
    const phaseEvents = session.events.filter(e => 
      e.category === phase || e.type.startsWith(phase)
    );
    
    if (phaseEvents.length < 2) return 0;
    
    const start = phaseEvents[0]?.timestamp || 0;
    const end = phaseEvents[phaseEvents.length - 1]?.timestamp || 0;
    
    return end - start;
  }

  private getCurrentStep(session: SessionState): PlanningStep | ExecutionStep | undefined {
    // Check execution steps first
    const runningExecution = session.executionSteps.find(s => s.status === 'running');
    if (runningExecution) return runningExecution;

    // Check planning steps
    const inProgressPlanning = session.planningSteps.find(s => s.status === 'in-progress');
    if (inProgressPlanning) return inProgressPlanning;

    return undefined;
  }

  private calculateProgress(session: SessionState): number {
    if (session.metrics.stepCount === 0) return 0;
    
    const completed = session.metrics.successfulSteps + 
                     session.metrics.failedSteps + 
                     session.metrics.skippedSteps;
    
    return Math.round((completed / session.metrics.stepCount) * 100);
  }

  private generateTimeline(session: SessionState): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Add planning steps
    session.planningSteps.forEach(step => {
      events.push({
        timestamp: step.timestamp,
        type: 'planning',
        name: step.name,
        status: step.status,
        duration: step.duration
      });
    });

    // Add execution steps
    session.executionSteps.forEach(step => {
      events.push({
        timestamp: step.timestamp,
        type: 'execution',
        name: step.name,
        status: step.status,
        duration: step.duration
      });
    });

    // Add validation results
    session.validationResults.forEach(validation => {
      events.push({
        timestamp: validation.timestamp,
        type: 'validation',
        name: validation.message,
        status: validation.severity === 'error' || validation.severity === 'critical' ? 'failed' : 'completed'
      });
    });

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  private generateRecommendations(session: SessionState): string[] {
    const recommendations: string[] = [];

    if (session.metrics.failedSteps > 0) {
      recommendations.push(`${session.metrics.failedSteps} steps failed. Review error logs for details.`);
    }

    if (session.metrics.errorCount > 5) {
      recommendations.push('High error count detected. Consider improving error handling.');
    }

    const criticalValidations = session.validationResults.filter(v => v.severity === 'critical');
    if (criticalValidations.length > 0) {
      recommendations.push(`${criticalValidations.length} critical validation issues found. Address these before production deployment.`);
    }

    if (session.metrics.memoryPeakUsage && session.metrics.memoryPeakUsage > 1024 * 1024 * 1024) {
      recommendations.push('High memory usage detected. Consider optimizing memory-intensive operations.');
    }

    return recommendations;
  }

  private persistSessionData(session: SessionState): void {
    if (!this.options.inspectionDataPath) return;

    const filename = `session-${session.id}-${Date.now()}.json`;
    const filepath = path.join(this.options.inspectionDataPath, filename);

    fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
  }

  private startMetricsCapture(): void {
    this.metricsInterval = setInterval(() => {
      if (!this.activeSession) return;

      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Update peak usage
      if (!this.activeSession.metrics.memoryPeakUsage || 
          usage.heapUsed > this.activeSession.metrics.memoryPeakUsage) {
        this.activeSession.metrics.memoryPeakUsage = usage.heapUsed;
      }

      // Record resource usage for current step
      const currentStep = this.getCurrentStep(this.activeSession);
      if (currentStep && 'logs' in currentStep) {
        (currentStep as ExecutionStep).resourceUsage = {
          memory: {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
          }
        };
      }
    }, 1000);
  }

  public cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.fileWatchers.forEach(watcher => watcher.close());
    this.fileWatchers.clear();

    this.sessions.clear();
    this.activeSession = undefined;
  }
}

// Type definitions for reports

export interface InspectionReport {
  sessionId: string;
  sessionName: string;
  status: string;
  duration: number;
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
    errors: number;
    warnings: number;
  };
  phases: {
    planning: {
      duration: number;
      steps: number;
      completed: number;
    };
    execution: {
      duration: number;
      steps: number;
      completed: number;
    };
    validation: {
      duration: number;
      results: number;
      criticalIssues: number;
    };
  };
  timeline: TimelineEvent[];
  recommendations: string[];
}

export interface SessionStatus {
  sessionId: string;
  phase: string;
  status: string;
  currentStep?: {
    id: string;
    name: string;
    status: string;
    duration: number;
  };
  progress: number;
  metrics: SessionMetrics;
  recentEvents: SessionEvent[];
}

export interface TimelineEvent {
  timestamp: number;
  type: string;
  name: string;
  status?: string;
  duration?: number;
}

// Export singleton helpers
let inspectorInstance: SessionInspector | null = null;

export const getSessionInspector = (options?: Partial<InspectionOptions>): SessionInspector => {
  if (!inspectorInstance) {
    inspectorInstance = new SessionInspector(options);
  }
  return inspectorInstance;
};

export const resetSessionInspector = (): void => {
  if (inspectorInstance) {
    inspectorInstance.cleanup();
    inspectorInstance = null;
  }
};