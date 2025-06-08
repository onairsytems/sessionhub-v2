/**
 * AI Assistant Interface
 * Defines the contract for AI assistant implementations
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  message: string;
  timestamp: string;
  sessionId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

export interface SuggestionResponse {
  suggestions: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>;
  timestamp: string;
}

export interface IAIAssistant {
  initialize(): Promise<void>;
  sendMessage(message: string, sessionId: string): Promise<ChatResponse>;
  getSuggestions(context: string): Promise<SuggestionResponse>;
  analyzeCode(code: string, language: string): Promise<string>;
  generateCode(prompt: string, language: string): Promise<string>;
  clearHistory(sessionId: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}