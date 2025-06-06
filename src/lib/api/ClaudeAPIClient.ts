/**
 * Claude API client for the Planning Actor
 * Integrates with Anthropic's Claude API for instruction generation
 */

import { Logger } from '@/src/lib/logging/Logger';

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

  constructor(config: ClaudeAPIConfig, logger: Logger) {
    this.logger = logger;
    this.config = {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl || 'https://api.anthropic.com/v1/messages',
      model: config.model || 'claude-3-opus-20240229',
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

Output your response as a valid JSON object following the InstructionProtocol schema.`;
  }

  /**
   * Generate strategy from user request
   */
  async generateStrategy(params: {
    request: any;
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
    } catch (error) {
      this.logger.error('Failed to generate strategy', error as Error);
      throw error;
    }
  }

  /**
   * Send request to Claude API
   */
  private async sendRequest(request: ClaudeRequest): Promise<ClaudeResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      this.logger.debug('Sending request to Claude API', {
        model: request.model,
        messageCount: request.messages.length
      });

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json() as ClaudeResponse;

      this.logger.debug('Claude API response received', {
        id: data.id,
        model: data.model,
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      });

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude API request timed out after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
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
    } catch (error) {
      this.logger.error('API key validation failed', error as Error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsage(): Promise<any> {
    // This would typically call a usage endpoint
    // For now, return mock data
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      requestCount: 0
    };
  }
}