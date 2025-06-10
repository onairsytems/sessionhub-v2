import { EventEmitter } from 'events';
import { SessionInstruction, PipelineConfig, PipelineStatus } from './types';
import { GitHubWebhookReceiver } from './GitHubWebhookReceiver';
import { SessionConverter } from './SessionConverter';
import { SessionExecutionPipeline } from '../session/SessionExecutionPipeline';
import { ProductionMonitoringService } from '../production/ProductionMonitor';
import { SelfDevelopmentAuditor } from '../development/SelfDevelopmentAuditor';
import { DeploymentManager } from './DeploymentManager';
import { Queue } from '../../lib/queue/Queue';
import { Logger } from '../../lib/logging/Logger';
import { AuditLogger } from '../../lib/logging/AuditLogger';
import { ClaudeAPIClient } from '../../lib/api/ClaudeAPIClient';

export class PipelineOrchestrator extends EventEmitter {
  private webhookReceiver: GitHubWebhookReceiver;
  private sessionConverter: SessionConverter;
  private sessionPipeline: SessionExecutionPipeline;
  private productionMonitor: ProductionMonitoringService;
  private deploymentManager: DeploymentManager;
  private auditor: SelfDevelopmentAuditor;
  private sessionQueue: Queue<SessionInstruction>;
  private isRunning: boolean = false;
  private currentSession?: SessionInstruction;
  private config: PipelineConfig;
  private logger: Logger;
  private auditLogger: AuditLogger;
  private claudeClient: ClaudeAPIClient;

  constructor(config: PipelineConfig) {
    super();
    this.config = config;
    this.logger = new Logger('PipelineOrchestrator');
    this.auditLogger = new AuditLogger();
    this.claudeClient = new ClaudeAPIClient({ 
      apiKey: process.env['CLAUDE_API_KEY'] || ''
    }, this.logger);
    this.webhookReceiver = new GitHubWebhookReceiver(config);
    this.sessionConverter = new SessionConverter();
    this.sessionPipeline = new SessionExecutionPipeline(this.logger, this.auditLogger, this.claudeClient);
    this.productionMonitor = new ProductionMonitoringService();
    this.deploymentManager = new DeploymentManager(config.deployment);
    this.auditor = new SelfDevelopmentAuditor();
    this.sessionQueue = new Queue<SessionInstruction>();
    
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
// REMOVED: console statement
      return;
    }

    try {
// REMOVED: console statement
      
      // Start all components
      await this.webhookReceiver.start();
      await this.productionMonitor.start();
      await this.deploymentManager.initialize();
      
      this.isRunning = true;
      
      // Start processing queue
      this.processQueue();

      await this.auditor.logEvent({
        type: 'session_started',
        actor: 'system',
        action: 'started',
        target: 'orchestrator',
        details: {
          config: {
            repos: this.config.github.repos,
            autoDeployEnabled: this.config.deployment.autoDeployEnabled,
          },
        },
        risk: 'low',
        context: {}
      });

// REMOVED: console statement
    } catch (error) {
// REMOVED: console statement
      await this.auditor.logEvent({
        type: 'session_failed',
        actor: 'system',
        action: 'start_failed',
        target: 'orchestrator',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        risk: 'medium',
        context: {}
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

// REMOVED: console statement
    
    this.isRunning = false;
    
    await this.webhookReceiver.stop();
    await this.productionMonitor.stop();
    
    await this.auditor.logEvent({
      type: 'session_completed',
      actor: 'system',
      action: 'stopped',
      target: 'orchestrator',
      details: {},
      risk: 'low',
      context: {}
    });
    
// REMOVED: console statement
  }

  private setupEventHandlers(): void {
    // Handle GitHub issues
    this.webhookReceiver.on('issue', async (data) => {
      try {
        const instruction = await this.sessionConverter.convertIssueToSession(
          data.issue,
          data.repository
        );
        await this.queueSession(instruction);
        
        // Update GitHub issue
        await this.webhookReceiver.updateIssueStatus(
          data.repository.full_name,
          data.issue.number,
          'Queued for processing',
          `Session ID: ${instruction.id}\nPriority: ${instruction.priority}\nCategory: ${instruction.category}`
        );
      } catch (error) {
// REMOVED: console statement
      }
    });

    // Handle production errors
    this.productionMonitor.on('criticalError', async (error: any) => {
      try {
        const instruction = await this.sessionConverter.convertProductionErrorToSession({
          message: error.message,
          stack: error.stack,
          affectedUsers: error.metrics?.affectedUsers,
          frequency: error.metrics?.frequency,
          component: error.component,
        });
        await this.queueSession(instruction);
      } catch (err) {
// REMOVED: console statement
      }
    });

    // Handle session completion
    this.sessionPipeline.on('sessionCompleted', async (result: any) => {
      await this.handleSessionCompletion(result);
    });

    // Handle deployment events
    this.deploymentManager.on('deploymentCompleted', async (deployment) => {
      await this.auditor.logEvent({
        type: 'update_deployed',
        actor: 'system',
        action: 'completed',
        target: deployment.version,
        details: {
          channel: deployment.channel,
          platform: deployment.platform,
        },
        risk: 'medium',
        context: {}
      });
    });
  }

  private async queueSession(instruction: SessionInstruction): Promise<void> {
    // Add to queue with priority
    await this.sessionQueue.enqueue(instruction, this.getPriorityScore(instruction));
    
    await this.auditor.logEvent({
      type: 'session_created',
      actor: 'planning',
      action: 'session_queued',
      target: instruction.id,
      details: {
        title: instruction.title,
        priority: instruction.priority,
        queueLength: this.sessionQueue.size(),
      },
      risk: 'low',
      context: { sessionId: instruction.id }
    });

    this.emit('sessionQueued', instruction);
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we're already processing a session
        if (this.currentSession) {
          await this.sleep(5000);
          continue;
        }

        // Get next session from queue
        const instruction = await this.sessionQueue.dequeue();
        if (!instruction) {
          await this.sleep(10000);
          continue;
        }

        // Process the session
        await this.executeSession(instruction);
      } catch (error) {
// REMOVED: console statement
        await this.sleep(30000); // Wait before retrying
      }
    }
  }

  private async executeSession(instruction: SessionInstruction): Promise<void> {
    this.currentSession = instruction;
    instruction.status = 'in-progress';

    try {
// REMOVED: console statement
      
      await this.auditor.logEvent({
        type: 'session_started',
        actor: 'execution',
        action: 'session_started',
        target: instruction.id,
        details: {
          title: instruction.title,
          sourceType: instruction.sourceType,
        },
        risk: 'medium',
        context: { sessionId: instruction.id }
      });

      // Update GitHub issue if applicable
      if (instruction.sourceType === 'github-issue' && instruction.metadata.githubRepoFullName) {
        await this.webhookReceiver.updateIssueStatus(
          instruction.metadata.githubRepoFullName,
          instruction.metadata.githubIssueNumber!,
          'In Progress',
          `SessionHub is actively working on this issue.`
        );
      }

      // Execute the session
      const result = await this.sessionPipeline.executeSession({
        userId: instruction.metadata?.['userId'] || 'system',
        projectId: instruction.metadata?.['projectId'] || 'default',
        description: instruction.description || instruction.title,
        context: {
          objectives: instruction.objectives,
          requirements: instruction.requirements,
          validation: this.generateValidationCriteria(instruction),
          metadata: instruction.metadata,
        }
      });

      instruction.status = result.result?.status === 'success' ? 'completed' : 'failed';
      
      await this.auditor.logEvent({
        type: 'session_completed',
        actor: 'execution',
        action: 'session_completed',
        target: instruction.id,
        details: {
          success: result.result?.status === 'success',
          duration: result.result?.metrics?.duration || 0,
          deliverables: result.result?.deliverables?.length || 0,
        },
        risk: 'low',
        context: { sessionId: instruction.id }
      });

    } catch (error) {
// REMOVED: console statement
      instruction.status = 'failed';
      
      await this.auditor.logEvent({
        type: 'session_failed',
        actor: 'execution',
        action: 'session_failed',
        target: instruction.id,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        risk: 'high',
        context: { sessionId: instruction.id }
      });
    } finally {
      this.currentSession = undefined;
    }
  }

  private async handleSessionCompletion(result: any): Promise<void> {
    const instruction = this.currentSession;
    if (!instruction) return;

    // Update GitHub issue
    if (instruction.sourceType === 'github-issue' && instruction.metadata.githubRepoFullName) {
      const status = result.success ? 'Completed' : 'Failed';
      const details = result.success
        ? `The issue has been resolved.\nCommits: ${result.commits?.map((c: any) => c.hash).join(', ')}`
        : `The session failed: ${result.error}`;

      await this.webhookReceiver.updateIssueStatus(
        instruction.metadata.githubRepoFullName,
        instruction.metadata.githubIssueNumber!,
        status,
        details
      );
    }

    // Trigger deployment if configured
    if (result.success && this.config.deployment.autoDeployEnabled) {
      try {
        await this.deploymentManager.createDeployment({
          sessionId: instruction.id,
          commits: result.commits,
          urgency: instruction.priority === 'critical' ? 'immediate' : 'scheduled',
        });
      } catch (error) {
// REMOVED: console statement
      }
    }
  }

  private generateValidationCriteria(instruction: SessionInstruction): string[] {
    const criteria: string[] = [];

    // Basic validation
    criteria.push('Code compiles without errors');
    criteria.push('All tests pass');
    criteria.push('No new linting errors');

    // Category-specific validation
    switch (instruction.category) {
      case 'bug-fix':
        criteria.push('Bug is reproducible before fix');
        criteria.push('Bug is not reproducible after fix');
        criteria.push('Regression tests added');
        break;
      case 'security':
        criteria.push('Security vulnerability is patched');
        criteria.push('Security tests added');
        criteria.push('No new security warnings');
        break;
      case 'performance':
        criteria.push('Performance benchmarks show improvement');
        criteria.push('No regression in other areas');
        break;
    }

    return criteria;
  }

  private getPriorityScore(instruction: SessionInstruction): number {
    const priorityScores = {
      critical: 1000,
      high: 100,
      medium: 10,
      low: 1,
    };
    
    let score = priorityScores[instruction.priority];
    
    // Boost score for production errors
    if (instruction.sourceType === 'production-error') {
      score *= 2;
    }
    
    // Boost score based on affected users
    if (instruction.metadata.affectedUsers) {
      score += instruction.metadata.affectedUsers;
    }
    
    return score;
  }

  async getStatus(): Promise<PipelineStatus> {
    return {
      isRunning: this.isRunning,
      currentSession: this.currentSession,
      queueLength: this.sessionQueue.size(),
      lastDeployment: this.deploymentManager.getLastDeployment(),
      health: {
        github: this.webhookReceiver.isListening ? 'connected' : 'disconnected',
        production: await this.productionMonitor.getHealth().then(h => {
          // Map 'unhealthy' to 'critical' for pipeline status
          return h.status === 'unhealthy' ? 'critical' : h.status as 'healthy' | 'degraded' | 'critical';
        }),
        deployment: this.deploymentManager.getStatus(),
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}