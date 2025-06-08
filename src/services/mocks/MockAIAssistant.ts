import { Logger } from '../../lib/logging/Logger';

// TODO: [Session 0.2.1] Replace with real Claude API implementation
// This mock provides a working AI assistant interface for development

export interface AIResponse {
  content: string;
  confidence: number;
  suggestions?: string[];
  mockResponse?: boolean;
}

export interface AIRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
}

export interface IAIAssistant {
  initialize(): Promise<void>;
  query(request: AIRequest): Promise<AIResponse>;
  isReady(): boolean;
  shutdown(): Promise<void>;
}

/**
 * Mock AI Assistant implementation
 * Provides canned responses for common queries during development
 */
export class MockAIAssistant implements IAIAssistant {
  private logger = new Logger('MockAIAssistant');
  private ready = false;
  
  // Canned responses for common queries
  private responses: Record<string, AIResponse> = {
    'help': {
      content: 'I can help you with session management, error detection, and code quality. What would you like to know?',
      confidence: 1.0,
      suggestions: [
        'How do I create a new session?',
        'Show me recent errors',
        'What are the quality gates?'
      ],
      mockResponse: true
    },
    'error': {
      content: 'To view errors, check the Error Detection panel. TypeScript and ESLint errors are shown in real-time.',
      confidence: 0.9,
      mockResponse: true
    },
    'session': {
      content: 'Sessions track your development work. Use the Session Manager to create, view, and manage sessions.',
      confidence: 0.95,
      mockResponse: true
    }
  };

  async initialize(): Promise<void> {
    // TODO: [Session 0.2.1] Initialize real Claude API connection
    this.logger.info('Initializing mock AI assistant...');
    
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.ready = true;
    this.logger.info('Mock AI assistant ready');
  }

  async query(request: AIRequest): Promise<AIResponse> {
    // TODO: [Session 0.2.1] Implement real Claude API query
    if (!this.ready) {
      throw new Error('AI Assistant not initialized');
    }

    this.logger.info(`Mock AI query: ${request.prompt}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find best matching response
    const lowercasePrompt = request.prompt.toLowerCase();
    for (const [key, response] of Object.entries(this.responses)) {
      if (lowercasePrompt.includes(key)) {
        return response;
      }
    }
    
    // Default response
    return {
      content: `I understand you're asking about "${request.prompt}". This feature will be fully implemented in version 0.2.1.`,
      confidence: 0.5,
      mockResponse: true
    };
  }

  isReady(): boolean {
    return this.ready;
  }

  async shutdown(): Promise<void> {
    // TODO: [Session 0.2.1] Cleanup real API connections
    this.logger.info('Shutting down mock AI assistant...');
    this.ready = false;
  }
}