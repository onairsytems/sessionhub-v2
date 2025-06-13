import { Extension, Assistant, Editor, StatusBar, SlashCommand, Context } from '@zed-industries/extension-api';

interface ActorState {
  planningActive: boolean;
  executionActive: boolean;
  currentInstruction?: string;
  sessionHubConnected: boolean;
}

interface PlanningInstruction {
  id: string;
  content: string;
  context: {
    file?: string;
    selection?: string;
    projectPath: string;
  };
  timestamp: Date;
}

export class SessionHubTwoActorExtension implements Extension {
  private actorState: ActorState = {
    planningActive: false,
    executionActive: false,
    sessionHubConnected: false
  };
  
  private pendingInstructions: PlanningInstruction[] = [];
  private statusBar?: StatusBar;
  private sessionHubSocket?: WebSocket;

  async activate(context: Context): Promise<void> {
    // Initialize status bar
    this.statusBar = context.createStatusBarItem({
      id: 'sessionhub-actor-status',
      alignment: 'right',
      priority: 100
    });
    
    this.updateStatusBar();
    
    // Connect to SessionHub
    await this.connectToSessionHub();
    
    // Register slash commands
    this.registerSlashCommands(context);
    
    // Set up assistant interceptor
    this.setupAssistantInterceptor(context);
    
    // Set up editor boundary enforcement
    this.setupEditorBoundaries(context);
  }

  private async connectToSessionHub(): Promise<void> {
    try {
      // Connect to SessionHub's WebSocket server
      this.sessionHubSocket = new WebSocket('ws://localhost:3456/zed-integration');
      
      this.sessionHubSocket.onopen = () => {
        this.actorState.sessionHubConnected = true;
        this.updateStatusBar();
        this.sendMessage({
          type: 'zed-connected',
          extensionVersion: '1.0.0'
        });
      };
      
      this.sessionHubSocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleSessionHubMessage(message);
      };
      
      this.sessionHubSocket.onclose = () => {
        this.actorState.sessionHubConnected = false;
        this.updateStatusBar();
        // Attempt reconnection after 5 seconds
        setTimeout(() => this.connectToSessionHub(), 5000);
      };
    } catch (error) {
// REMOVED: console statement
    }
  }

  private registerSlashCommands(context: Context): void {
    // /session_plan - Create a planning session
    context.registerSlashCommand({
      name: 'session_plan',
      run: async (assistant: Assistant, args: string) => {
        this.actorState.planningActive = true;
        this.updateStatusBar();
        
        // Prevent code generation in response
        assistant.setResponseMode('planning-only');
        
        const instruction: PlanningInstruction = {
          id: this.generateId(),
          content: args,
          context: {
            file: assistant.getCurrentFile(),
            selection: assistant.getSelection(),
            projectPath: assistant.getWorkspacePath()
          },
          timestamp: new Date()
        };
        
        this.pendingInstructions.push(instruction);
        
        // Send to SessionHub for planning
        this.sendMessage({
          type: 'planning-request',
          instruction
        });
        
        return {
          content: `🎯 Planning session initiated for: "${args}"\n\n` +
                  `The Planning Actor is now analyzing your request and will generate a structured plan.\n` +
                  `Use /session_execute when ready to implement the plan.`,
          metadata: { actorType: 'planning' }
        };
      }
    });

    // /session_execute - Execute the current plan
    context.registerSlashCommand({
      name: 'session_execute',
      run: async (assistant: Assistant) => {
        if (this.pendingInstructions.length === 0) {
          return {
            content: '⚠️ No pending plans to execute. Use /session_plan first.',
            metadata: { actorType: 'execution' }
          };
        }
        
        const instruction = this.pendingInstructions.shift()!;
        this.actorState.executionActive = true;
        this.actorState.currentInstruction = instruction.content;
        this.updateStatusBar();
        
        // Send to execution actor
        this.sendMessage({
          type: 'execution-request',
          instruction,
          allowCodeGeneration: true
        });
        
        return {
          content: `🚀 Executing plan: "${instruction.content}"\n\n` +
                  `The Execution Actor is now implementing the plan in the editor.`,
          metadata: { actorType: 'execution' }
        };
      }
    });

    // /session_status - Check actor status
    context.registerSlashCommand({
      name: 'session_status',
      run: async () => {
        const status = {
          sessionHub: this.actorState.sessionHubConnected ? '✅ Connected' : '❌ Disconnected',
          planning: this.actorState.planningActive ? '🎯 Active' : '⏸️ Idle',
          execution: this.actorState.executionActive ? '🚀 Active' : '⏸️ Idle',
          pendingPlans: this.pendingInstructions.length
        };
        
        return {
          content: `**SessionHub Two-Actor Status**\n\n` +
                  `SessionHub: ${status.sessionHub}\n` +
                  `Planning Actor: ${status.planning}\n` +
                  `Execution Actor: ${status.execution}\n` +
                  `Pending Plans: ${status.pendingPlans}`,
          metadata: { actorType: 'status' }
        };
      }
    });

    // /session_sync - Synchronize actors
    context.registerSlashCommand({
      name: 'session_sync',
      run: async () => {
        this.sendMessage({
          type: 'sync-request',
          state: this.actorState
        });
        
        return {
          content: '🔄 Synchronizing actors with SessionHub...',
          metadata: { actorType: 'sync' }
        };
      }
    });
  }

  private setupAssistantInterceptor(context: Context): void {
    // Intercept assistant responses to enforce planning-only mode
    context.onAssistantResponse((response, metadata) => {
      // If in planning mode, prevent code generation
      if (metadata.actorType === 'planning' || this.actorState.planningActive) {
        // Remove code blocks from response
        response.content = this.removeCodeBlocks(response.content);
        
        // Add planning actor indicator
        response.content = `[Planning Actor] ${response.content}`;
      }
      
      return response;
    });
  }

  private setupEditorBoundaries(context: Context): void {
    // Monitor editor changes to ensure they come from execution actor
    context.onEditorChange((editor: Editor, change) => {
      if (!this.actorState.executionActive && change.source !== 'execution-actor') {
        // Log boundary violation
        this.sendMessage({
          type: 'boundary-violation',
          details: {
            actor: 'unknown',
            action: 'editor-change',
            file: editor.getFilePath()
          }
        });
      }
    });
  }

  private handleSessionHubMessage(message: any): void {
    switch (message.type) {
      case 'actor-update':
        this.actorState = { ...this.actorState, ...message.state };
        this.updateStatusBar();
        break;
        
      case 'planning-response':
        // Handle planning response
        if (message.plan) {
          this.showNotification(`Plan ready: ${message.plan.summary}`);
        }
        this.actorState.planningActive = false;
        this.updateStatusBar();
        break;
        
      case 'execution-complete':
        this.actorState.executionActive = false;
        this.actorState.currentInstruction = undefined;
        this.updateStatusBar();
        this.showNotification('Execution completed successfully');
        break;
        
      case 'sync-response':
        this.showNotification('Actors synchronized');
        break;
    }
  }

  private updateStatusBar(): void {
    if (!this.statusBar) return;
    
    const parts: string[] = [];
    
    if (!this.actorState.sessionHubConnected) {
      parts.push('🔌 Disconnected');
    } else {
      if (this.actorState.planningActive) {
        parts.push('🎯 Planning');
      }
      if (this.actorState.executionActive) {
        parts.push('🚀 Executing');
      }
      if (!this.actorState.planningActive && !this.actorState.executionActive) {
        parts.push('✅ Ready');
      }
    }
    
    this.statusBar.text = `SessionHub: ${parts.join(' | ')}`;
    this.statusBar.tooltip = this.actorState.currentInstruction || 'Two-Actor System Ready';
    this.statusBar.show();
  }

  private sendMessage(message: any): void {
    if (this.sessionHubSocket?.readyState === WebSocket.OPEN) {
      this.sessionHubSocket.send(JSON.stringify(message));
    }
  }

  private removeCodeBlocks(content: string): string {
    // Remove code blocks to enforce planning-only responses
    return content.replace(/```[\s\S]*?```/g, '[Code generation blocked in Planning Actor]');
  }

  private generateId(): string {
    return `inst-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private showNotification(message: string): void {
    // Show notification in Zed's UI
// REMOVED: console statement
  }

  async deactivate(): void {
    if (this.sessionHubSocket) {
      this.sessionHubSocket.close();
    }
    if (this.statusBar) {
      this.statusBar.dispose();
    }
  }
}

export function activate(context: Context): Extension {
  return new SessionHubTwoActorExtension();
}