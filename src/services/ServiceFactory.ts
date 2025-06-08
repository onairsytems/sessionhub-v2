import { FEATURES } from '../config/features';
import { Logger } from '../lib/logging/Logger';

// Interfaces
import { ICloudSyncService } from '../interfaces/ICloudSyncService';
import { IAIAssistant } from '../interfaces/IAIAssistant';

// Mock adapters - REMOVED in Session 1.6

// Real implementations
import { ClaudeAIAssistant } from './ai/ClaudeAIAssistant';
import { SupabaseCloudSync } from './cloud/SupabaseCloudSync';

/**
 * Service Factory
 * 
 * Creates appropriate service implementations based on feature flags.
 * Returns mock implementations for features under development.
 * 
 * This pattern allows us to:
 * 1. Develop against interfaces without external dependencies
 * 2. Switch to real implementations via feature flags
 * 3. Maintain zero-error builds during incremental development
 */
export class ServiceFactory {
  private static logger = new Logger('ServiceFactory');

  /**
   * Create a cloud sync service instance
   */
  static createCloudSyncService(): ICloudSyncService {
    this.logger.info('Creating real Supabase cloud sync service');
    return new SupabaseCloudSync();
  }

  /**
   * Create an AI assistant instance
   */
  static createAIAssistant(): IAIAssistant {
    this.logger.info('Creating real Claude AI assistant');
    return new ClaudeAIAssistant();
  }

  /**
   * Create a GitHub integration service
   */
  static createGitHubIntegration(): IGitHubIntegration {
    if (FEATURES.GITHUB_INTEGRATION) {
      // TODO: [Session 0.2.3] Return real GitHub integration
      throw new Error('GitHub integration not yet implemented');
    }
    
    // Return a minimal mock that satisfies the interface
    return new MockGitHubIntegration();
  }

  /**
   * Check if a service is available (all real implementations now)
   */
  static isServiceAvailable(service: 'cloudSync' | 'ai' | 'github' | 'slack'): boolean {
    switch (service) {
      case 'cloudSync':
        return true; // Real Supabase implementation
      case 'ai':
        return true; // Real Claude API implementation
      case 'github':
        return FEATURES.GITHUB_INTEGRATION;
      case 'slack':
        return FEATURES.SLACK_INTEGRATION;
      default:
        return false;
    }
  }
}

// Placeholder interfaces for future services
// TODO: [Session 0.2.3] Move to proper interface files
interface IGitHubIntegration {
  connect(token: string): Promise<void>;
  createIssue(title: string, body: string): Promise<number>;
  disconnect(): Promise<void>;
}

class MockGitHubIntegration implements IGitHubIntegration {
  async connect(_token: string): Promise<void> {
    // Mock implementation
  }
  
  async createIssue(_title: string, _body: string): Promise<number> {
    return Math.floor(Math.random() * 1000);
  }
  
  async disconnect(): Promise<void> {
    // Mock implementation
  }
}