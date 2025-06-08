/**
 * Real Claude AI Assistant implementation
 * Provides actual AI-powered assistance using Claude API
 */

import { IAIAssistant, ChatMessage, ChatResponse, SuggestionResponse } from '@/src/interfaces/IAIAssistant';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';
import { Logger } from '@/src/lib/logging/Logger';
import { CredentialManager } from '@/src/lib/security/CredentialManager';
import { MacKeychainService } from '@/src/lib/security/MacKeychainService';

export class ClaudeAIAssistant implements IAIAssistant {
  private readonly logger: Logger;
  private claudeClient: ClaudeAPIClient | null = null;
  private credentialManager: CredentialManager;
  private keychainService: MacKeychainService;
  private isInitialized = false;
  private messageHistory: Map<string, ChatMessage[]> = new Map();
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  constructor() {
    this.logger = new Logger('ClaudeAIAssistant');
    this.credentialManager = new CredentialManager(this.logger);
    this.keychainService = new MacKeychainService(this.logger);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize credential manager
      await this.credentialManager.initialize();

      // Try to get API key from keychain first
      let apiKey = await this.keychainService.getAPIKey('claude');
      
      if (!apiKey) {
        // Fall back to credential manager
        const credential = await this.credentialManager.getCredentialByName('claude-api-key');
        apiKey = credential?.value || null;
      }

      if (!apiKey) {
        // Try environment variable as last resort
        apiKey = process.env['CLAUDE_API_KEY'] || null;
      }

      if (!apiKey) {
        throw new Error('Claude API key not found. Please configure it in Settings.');
      }

      // Initialize Claude client with real API key
      this.claudeClient = new ClaudeAPIClient(
        {
          apiKey,
          model: 'claude-3-opus-20240229',
          maxTokens: 4000,
          temperature: 0.7,
          timeout: 30000
        },
        this.logger
      );

      // Validate the API key
      const isValid = await this.claudeClient.validateApiKey();
      if (!isValid) {
        throw new Error('Invalid Claude API key');
      }

      this.isInitialized = true;
      this.logger.info('Claude AI Assistant initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Claude AI Assistant', error as Error);
      throw error;
    }
  }

  async sendMessage(message: string, sessionId: string): Promise<ChatResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      // Get session history
      const history = this.messageHistory.get(sessionId) || [];
      
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      history.push(userMessage);

      // Send to Claude API
      const response = await this.retryWithBackoff(async () => {
        return await this.claudeClient!.sendMessage(message, sessionId, history);
      });

      // Add assistant response to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      history.push(assistantMessage);

      // Update history (keep last 20 messages for context)
      this.messageHistory.set(sessionId, history.slice(-20));

      // Calculate usage statistics
      const usage = await this.claudeClient.getUsage();

      return {
        message: response,
        timestamp: new Date().toISOString(),
        sessionId,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalCost: usage.totalCost
        }
      };
    } catch (error) {
      this.logger.error('Failed to send message to Claude', error as Error);
      throw error;
    }
  }

  async getSuggestions(context: string): Promise<SuggestionResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      const prompt = `Based on the following context, provide 3-5 actionable suggestions for improving the code or architecture. Focus on best practices, performance improvements, and potential issues.

Context:
${context}

Provide suggestions in JSON format:
{
  "suggestions": [
    {"title": "...", "description": "...", "priority": "high|medium|low", "category": "performance|security|architecture|code-quality"},
    ...
  ]
}`;

      const response = await this.retryWithBackoff(async () => {
        return await this.claudeClient!.sendMessage(prompt, 'suggestions', []);
      });

      // Parse suggestions from response
      let suggestions = [];
      try {
        const parsed = JSON.parse(response);
        suggestions = parsed.suggestions || [];
      } catch {
        // Fallback: Create a single suggestion from the response
        suggestions = [{
          title: 'AI Suggestion',
          description: response,
          priority: 'medium',
          category: 'general'
        }];
      }

      return {
        suggestions,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get suggestions from Claude', error as Error);
      throw error;
    }
  }

  async analyzeCode(code: string, language: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      const prompt = `Analyze the following ${language} code and provide insights on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Suggestions for improvement

Code:
\`\`\`${language}
${code}
\`\`\`

Provide a comprehensive analysis focusing on actionable improvements.`;

      const response = await this.retryWithBackoff(async () => {
        return await this.claudeClient!.sendMessage(prompt, 'code-analysis', []);
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to analyze code with Claude', error as Error);
      throw error;
    }
  }

  async generateCode(prompt: string, language: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }

    try {
      const codePrompt = `Generate ${language} code for the following requirement:

${prompt}

Requirements:
- Use modern best practices and patterns
- Include proper error handling
- Add relevant comments for complex logic
- Ensure the code is production-ready
- Follow common style conventions for ${language}

Return only the code without additional explanation.`;

      const response = await this.retryWithBackoff(async () => {
        return await this.claudeClient!.sendMessage(codePrompt, 'code-generation', []);
      });

      // Extract code from response if wrapped in code blocks
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      return codeMatch ? codeMatch[1]!.trim() : response;
    } catch (error) {
      this.logger.error('Failed to generate code with Claude', error as Error);
      throw error;
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    this.messageHistory.delete(sessionId);
    this.logger.info('Cleared chat history', { sessionId });
  }

  async disconnect(): Promise<void> {
    this.claudeClient = null;
    this.isInitialized = false;
    this.messageHistory.clear();
    this.logger.info('Claude AI Assistant disconnected');
  }

  isConnected(): boolean {
    return this.isInitialized && this.claudeClient !== null;
  }

  /**
   * Configure API key and store securely
   */
  async configureAPIKey(apiKey: string): Promise<void> {
    try {
      // Store in Mac Keychain for secure storage
      await this.keychainService.storeAPIKey('claude', apiKey);
      
      // Also store in credential manager as backup
      await this.credentialManager.storeCredential({
        name: 'claude-api-key',
        type: 'api_key',
        value: apiKey,
        metadata: {
          service: 'claude',
          model: 'claude-3-opus-20240229'
        }
      });

      // Reinitialize with new key
      this.isInitialized = false;
      await this.initialize();

      this.logger.info('Claude API key configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure Claude API key', error as Error);
      throw error;
    }
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(): Promise<{
    totalTokens: number;
    totalCost: number;
    requestCount: number;
    averageTokensPerRequest: number;
  }> {
    if (!this.claudeClient) {
      return {
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        averageTokensPerRequest: 0
      };
    }

    const usage = await this.claudeClient.getUsage();
    const totalTokens = usage.inputTokens + usage.outputTokens;
    const requestCount = usage.requestCount || 1;

    return {
      totalTokens,
      totalCost: usage.totalCost,
      requestCount,
      averageTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0
    };
  }

  /**
   * Retry helper with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (retryCount >= this.maxRetries) {
        throw error;
      }

      // Check if error is retryable
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = this.retryDelay * Math.pow(2, retryCount);
      this.logger.warn(`Retrying Claude API call after ${delay}ms`, {
        attempt: retryCount + 1,
        maxRetries: this.maxRetries,
        error: error.message
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Rate limit errors
    if (error.status === 429) {
      return true;
    }

    // Server errors (5xx)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    return false;
  }

  /**
   * Export chat history for a session
   */
  async exportChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return this.messageHistory.get(sessionId) || [];
  }

  /**
   * Import chat history for a session
   */
  async importChatHistory(sessionId: string, history: ChatMessage[]): Promise<void> {
    this.messageHistory.set(sessionId, history);
    this.logger.info('Imported chat history', { sessionId, messageCount: history.length });
  }
}