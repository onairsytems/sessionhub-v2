
/**
 * Claude API client for the Planning Actor
 * Integrates with Anthropic's Claude API for instruction generation
 */

import { Logger } from '../logging/Logger';
import { APIUsageTracker } from '../../services/usage/APIUsageTracker';

export interface ClaudeAPIConfig {
  apiKey: string;
  apiUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface ClaudeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  temperature: number;
  system?: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeAPIClient {
  private readonly logger: Logger;
  private readonly config: Required<ClaudeAPIConfig>;
  private readonly defaultSystemPrompt: string;
  private rateLimiter: Map<string, number> = new Map();
  private readonly maxRequestsPerMinute = 60;
  private usageTracker?: APIUsageTracker;
  private currentSessionId?: string;
  private currentUserId?: string;

  constructor(config: ClaudeAPIConfig, logger?: Logger) {
    this.logger = logger || new Logger('ClaudeAPIClient');
    this.config = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl || 'https://api.anthropic.com/v1/messages',
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.7,
      timeout: config.timeout || 30000
    };

    this.defaultSystemPrompt = `You are the Planning Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Analyze user requests and understand their intent
2. Generate strategic plans and approaches
3. Create detailed instructions describing WHAT to build
4. Define success criteria and validation methods

You MUST NOT:
- Write any actual code
- Include implementation details
- Make technology-specific decisions beyond constraints
- Provide code examples or snippets

Remember: You describe WHAT, the Execution Actor determines HOW.

Output your response as a valid JSON object following this exact InstructionProtocol schema:
{
  "metadata": {
    "id": "unique-id",
    "sessionId": "session-id",
    "sessionName": "descriptive-name",
    "timestamp": "ISO-8601-timestamp",
    "version": "1.0",
    "actor": "planning"
  },
  "context": {
    "description": "Context description",
    "prerequisites": ["list", "of", "prerequisites"],
    "relatedSessions": [],
    "userRequest": "Original user request"
  },
  "objectives": [{
    "id": "unique-id",
    "primary": "Main objective",
    "secondary": ["Secondary", "objectives"],
    "measurable": true
  }],
  "requirements": [{
    "id": "unique-id",
    "description": "Requirement description",
    "priority": "must|should|could",
    "acceptanceCriteria": ["Criteria 1", "Criteria 2"]
  }],
  "deliverables": [{
    "type": "file|documentation|configuration",
    "description": "What should be delivered",
    "validation": "How to validate delivery"
  }],
  "constraints": {
    "patterns": ["Patterns to follow"],
    "avoid": ["Things to avoid"],
    "timeLimit": 3600000
  },
  "successCriteria": [{
    "id": "unique-id",
    "criterion": "Success criterion",
    "validationMethod": "How to validate",
    "automated": true
  }]
}`;
  }

  /**
   * Generate strategy from user request
   */
  async generateStrategy(params: {
    request: unknown;
    context: any;
    systemPrompt?: string;
  }): Promise<any> {
    const { request, context, systemPrompt } = params;

    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: `Generate a strategic plan for the following request:

User Request: ${JSON.stringify(request, null, 2)}

Context: ${JSON.stringify(context, null, 2)}

Important details for the response:
- Use the request.id as the sessionId
- Use the request.timestamp for the timestamp
- Generate unique UUIDs for all id fields (use format: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx")
- Ensure all arrays have at least one item
- Follow the exact schema structure provided in the system prompt

Please analyze this request and generate a comprehensive instruction protocol that describes what needs to be built without including any implementation details or code.`
      }
    ];

    try {
      const response = await this.sendRequest({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt || this.defaultSystemPrompt
      });

      const content = response.content[0]?.text;
      if (!content) {
        throw new Error('Empty response from Claude API');
      }

      // Parse JSON response
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // If not valid JSON, extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse strategy response as JSON');
      }
    } catch (error: any) {
      this.logger.error('Failed to generate strategy', error as Error);
      throw error;
    }
  }

  /**
   * Send request to Claude API with rate limiting and retry logic
   */
  private async sendRequest(request: ClaudeRequest): Promise<ClaudeResponse> {
    await this.checkRateLimit();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      this.logger.debug('Sending request to Claude API', {
        model: request.model,
        messageCount: request.messages.length
      });

      const response = await this.makeRequestWithRetry(request, controller.signal);
      
      const data = await response.json() as ClaudeResponse;

      this.logger.debug('Claude API response received', {
        id: data.id,
        model: data.model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      });

      // Track usage if tracker is available
      if (this.usageTracker && this.currentSessionId && this.currentUserId) {
        await this.usageTracker.trackUsage({
          sessionId: this.currentSessionId,
          model: data.model,
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          requestType: 'planning',
          userId: this.currentUserId
        });
      }

      return data;
    } catch (error: any) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude API request timed out after ${this.config.timeout}ms`);
      }
      this.logger.error('Claude API request failed', error as Error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make API request with retry logic
   */
  private async makeRequestWithRetry(
    request: ClaudeRequest, 
    signal: AbortSignal,
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(request),
          signal
        });

        if (response.ok) {
          return response;
        }

        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('retry-after') || '60');
          this.logger.warn(`Rate limited, waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`);
          await this.delay(retryAfter * 1000);
          continue;
        }

        if (response.status >= 500 && attempt < maxRetries) {
          // Server error - retry with exponential backoff
          const backoffDelay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`Server error ${response.status}, retrying in ${backoffDelay}ms`);
          await this.delay(backoffDelay);
          continue;
        }

        // Client error or final attempt - throw error
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      } catch (error: any) {
        lastError = error as Error;
        if (attempt === maxRetries || error.name === 'AbortError') {
          throw error;
        }
        
        // Wait before retry
        const backoffDelay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Request failed, retrying in ${backoffDelay}ms`, error as Error);
        await this.delay(backoffDelay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check rate limit before making request
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    // Clean old entries
    for (const [timestamp] of this.rateLimiter.entries()) {
      if (parseInt(timestamp) < windowStart) {
        this.rateLimiter.delete(timestamp);
      }
    }
    
    // Check if we're at the limit
    if (this.rateLimiter.size >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...Array.from(this.rateLimiter.keys()).map(k => parseInt(k)));
      const waitTime = oldestRequest + 60000 - now;
      
      this.logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await this.delay(waitTime);
      return this.checkRateLimit();
    }
    
    // Record this request
    this.rateLimiter.set(now.toString(), now);
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.sendRequest({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0
      });
      return true;
    } catch (error: any) {
      this.logger.error('API key validation failed', error as Error);
      return false;
    }
  }

  /**
   * Send a chat message (simpler interface for chat)
   */
  async sendMessage(message: string, _sessionId: string, history: any[] = []): Promise<string> {
    const messages: ClaudeMessage[] = history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Add the new message
    messages.push({
      role: 'user',
      content: message
    });

    try {
      const response = await this.sendRequest({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: `You are the Planning Actor for SessionHub, helping users plan their development projects. 
Be helpful, clear, and focused on understanding requirements and creating strategic plans.
Do not write code - only describe what needs to be built.`
      });

      return response.content[0]?.text || 'No response generated';
    } catch (error: any) {
      this.logger.error('Failed to send chat message', error as Error);
      throw error;
    }
  }

  /**
   * Configure usage tracking
   */
  setUsageTracker(tracker: APIUsageTracker, sessionId: string, userId: string): void {
    this.usageTracker = tracker;
    this.currentSessionId = sessionId;
    this.currentUserId = userId;
  }

  /**
   * Remove usage tracker
   */
  clearUsageTracker(): void {
    this.usageTracker = undefined;
    this.currentSessionId = undefined;
    this.currentUserId = undefined;
  }

  /**
   * Get usage statistics
   */
  async getUsage(): Promise<any> {
    if (this.usageTracker && this.currentUserId) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return await this.usageTracker.getUsageMetrics(this.currentUserId, startOfDay, now);
    }

    // Fallback to mock data if no tracker
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0,
      costByModel: {},
      tokensByModel: {},
      timeRange: { start: new Date(), end: new Date() }
    };
  }
}