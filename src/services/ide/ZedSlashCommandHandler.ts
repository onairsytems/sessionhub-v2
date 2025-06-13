import { EventEmitter } from 'events';
import { Logger } from '../../lib/logging/Logger';
import { ZedAgentPanelAdapter, PlanningRequest } from './ZedAgentPanelAdapter';
import { BaseProjectContext } from '../../models/ProjectContext';

export interface SlashCommand {
  name: string;
  description: string;
  handler: (args: string, context: CommandContext) => Promise<CommandResponse>;
  requiresActiveProject?: boolean;
  actorType: 'planning' | 'execution' | 'both';
}

export interface CommandContext {
  projectContext?: BaseProjectContext;
  currentFile?: string;
  selection?: string;
  workspacePath: string;
}

export interface CommandResponse {
  content: string;
  metadata?: {
    actorType: string;
    requiresExecution?: boolean;
    planId?: string;
  };
}

export class ZedSlashCommandHandler extends EventEmitter {
  private logger: Logger;
  private commands: Map<string, SlashCommand> = new Map();
  private agentPanelAdapter: ZedAgentPanelAdapter;

  constructor(agentPanelAdapter: ZedAgentPanelAdapter) {
    super();
    this.logger = new Logger('ZedSlashCommandHandler');
    this.agentPanelAdapter = agentPanelAdapter;
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    // /session_plan - Create a planning session
    this.registerCommand({
      name: 'session_plan',
      description: 'Create a planning session for code generation',
      actorType: 'planning',
      handler: async (args: string, context: CommandContext) => {
        if (!args.trim()) {
          return {
            content: '⚠️ Please provide a description of what you want to plan.\n\n' +
                    'Example: `/session_plan create a new React component for user profile`',
            metadata: { actorType: 'planning' }
          };
        }

        const request: PlanningRequest = {
          id: this.generateRequestId(),
          instruction: args,
          context: {
            file: context.currentFile,
            selection: context.selection,
            projectPath: context.workspacePath
          },
          timestamp: new Date()
        };

        try {
          // Queue the planning request
          await this.agentPanelAdapter.queueInstruction(request);
          
          // Process immediately if not busy
          if (!this.agentPanelAdapter.isPlanningActive()) {
            const response = await this.agentPanelAdapter.processPlanningRequest(request);
            
            return {
              content: this.formatPlanningResponse(response.plan),
              metadata: {
                actorType: 'planning',
                requiresExecution: true,
                planId: response.id
              }
            };
          } else {
            return {
              content: `🎯 Planning request queued. Position in queue: ${this.agentPanelAdapter.getPendingInstructionCount()}\n\n` +
                      `Your request: "${args}" will be processed shortly.`,
              metadata: { actorType: 'planning' }
            };
          }
        } catch (error) {
          this.logger.error('Planning request failed:', error as Error);
          return {
            content: `❌ Planning failed: ${(error as Error).message}`,
            metadata: { actorType: 'planning' }
          };
        }
      }
    });

    // /session_execute - Execute the current plan
    this.registerCommand({
      name: 'session_execute',
      description: 'Execute the current plan in the editor',
      actorType: 'execution',
      handler: async (_args: string, context: CommandContext) => {
        const nextInstruction = await this.agentPanelAdapter.getNextInstruction();
        
        if (!nextInstruction) {
          return {
            content: '⚠️ No pending plans to execute.\n\n' +
                    'Use `/session_plan` to create a new plan first.',
            metadata: { actorType: 'execution' }
          };
        }

        // Emit execution request
        this.emit('execute-plan', {
          instruction: nextInstruction,
          context
        });

        return {
          content: `🚀 Executing plan: "${nextInstruction.instruction}"\n\n` +
                  `The Execution Actor is now implementing the plan in the editor.\n` +
                  `You can monitor progress in the status bar.`,
          metadata: {
            actorType: 'execution',
            planId: nextInstruction.id
          }
        };
      }
    });

    // /session_status - Check the status of current actor operations
    this.registerCommand({
      name: 'session_status',
      description: 'Check the status of current actor operations',
      actorType: 'both',
      handler: async () => {
        const status = this.agentPanelAdapter.getStatus();
        
        let content = '**🎭 Two-Actor System Status**\n\n';
        
        // Connection status
        content += `**Connection:** ${status.connected ? '✅ Connected' : '❌ Disconnected'}\n\n`;
        
        // Planning Actor status
        content += '**🎯 Planning Actor**\n';
        if (status.planningActive) {
          content += `Status: Active\n`;
          if (status.currentRequest) {
            content += `Current Task: "${status.currentRequest.instruction}"\n`;
            content += `Started: ${new Date(status.currentRequest.timestamp).toLocaleTimeString()}\n`;
          }
        } else {
          content += `Status: Idle\n`;
        }
        content += `Pending Instructions: ${status.pendingInstructions}\n\n`;
        
        // Last planning response
        if (status.lastResponse) {
          content += '**📋 Last Plan**\n';
          content += `Summary: ${status.lastResponse.plan.summary}\n`;
          content += `Complexity: ${status.lastResponse.plan.complexity}\n`;
          content += `Estimated Time: ${status.lastResponse.plan.estimatedTime} minutes\n`;
          content += `Steps: ${status.lastResponse.plan.steps.length}\n\n`;
        }
        
        // Execution Actor info would come from execution service
        content += '**🚀 Execution Actor**\n';
        content += 'Status: Ready (Editor Domain)\n';
        
        return {
          content,
          metadata: { actorType: 'both' }
        };
      }
    });

    // /session_sync - Synchronize actors between SessionHub and Zed
    this.registerCommand({
      name: 'session_sync',
      description: 'Synchronize actors between SessionHub and Zed',
      actorType: 'both',
      handler: async (_args: string, context: CommandContext) => {
        try {
          if (context.projectContext) {
            await this.agentPanelAdapter.syncWithSessionHub(context.projectContext);
          }
          
          this.emit('sync-requested', {
            timestamp: new Date(),
            context
          });
          
          return {
            content: '🔄 Synchronization initiated!\n\n' +
                    'Actors are being synchronized between SessionHub and Zed.\n' +
                    'Check the status bar for real-time updates.',
            metadata: { actorType: 'both' }
          };
        } catch (error) {
          return {
            content: `❌ Synchronization failed: ${(error as Error).message}`,
            metadata: { actorType: 'both' }
          };
        }
      }
    });

    // /session_boundary - Show actor boundary information
    this.registerCommand({
      name: 'session_boundary',
      description: 'Display Two-Actor boundary enforcement rules',
      actorType: 'both',
      handler: async () => {
        return {
          content: `**🛡️ Two-Actor Boundary Enforcement**\n\n` +
                  `**Planning Actor (AI Assistant Panel)**\n` +
                  `✅ Can: Generate plans, analyze requirements, suggest approaches\n` +
                  `❌ Cannot: Generate code, modify files, execute commands\n\n` +
                  `**Execution Actor (Code Editor)**\n` +
                  `✅ Can: Write code, modify files, run commands\n` +
                  `❌ Cannot: Access planning context directly\n\n` +
                  `**Boundary Rules:**\n` +
                  `1. Planning Actor responses have code blocks removed\n` +
                  `2. Execution Actor only acts on approved plans\n` +
                  `3. All actor transitions are logged and audited\n` +
                  `4. Violations trigger alerts and are prevented\n\n` +
                  `This separation ensures clear responsibility and traceability.`,
          metadata: { actorType: 'both' }
        };
      }
    });

    // /session_help - Show available commands
    this.registerCommand({
      name: 'session_help',
      description: 'Show available SessionHub commands',
      actorType: 'both',
      handler: async () => {
        let content = '**📚 SessionHub Two-Actor Commands**\n\n';
        
        for (const [name, command] of this.commands) {
          content += `**/${name}**\n`;
          content += `${command.description}\n`;
          content += `Actor: ${command.actorType}\n\n`;
        }
        
        content += '**Tips:**\n';
        content += '• Use `/session_plan` to create structured plans\n';
        content += '• Use `/session_execute` to implement approved plans\n';
        content += '• Check `/session_status` to monitor progress\n';
        content += '• The status bar shows real-time actor states\n';
        
        return {
          content,
          metadata: { actorType: 'both' }
        };
      }
    });
  }

  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);
    this.logger.info(`Registered slash command: /${command.name}`);
  }

  async handleCommand(
    commandName: string, 
    args: string, 
    context: CommandContext
  ): Promise<CommandResponse> {
    const command = this.commands.get(commandName);
    
    if (!command) {
      return {
        content: `❌ Unknown command: /${commandName}\n\nUse /session_help to see available commands.`,
        metadata: { actorType: 'both' }
      };
    }

    if (command.requiresActiveProject && !context.projectContext) {
      return {
        content: `⚠️ This command requires an active project context.`,
        metadata: { actorType: command.actorType }
      };
    }

    try {
      return await command.handler(args, context);
    } catch (error) {
      this.logger.error(`Command /${commandName} failed:`, error as Error);
      return {
        content: `❌ Command failed: ${(error as Error).message}`,
        metadata: { actorType: command.actorType }
      };
    }
  }

  private formatPlanningResponse(plan: any): string {
    let content = `**🎯 Planning Complete**\n\n`;
    content += `**Summary:** ${plan.summary}\n`;
    content += `**Complexity:** ${plan.complexity}\n`;
    content += `**Estimated Time:** ${plan.estimatedTime} minutes\n\n`;
    
    content += `**📋 Implementation Steps:**\n`;
    for (const step of plan.steps) {
      content += `${step.order}. **${step.description}**\n`;
      content += `   Action: ${step.action}`;
      if (step.target) {
        content += ` → ${step.target}`;
      }
      content += '\n';
      if (step.validation) {
        content += `   ✓ ${step.validation}\n`;
      }
      content += '\n';
    }
    
    content += `**Next Step:** Use \`/session_execute\` to implement this plan in the editor.`;
    
    return content;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getAvailableCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }
}