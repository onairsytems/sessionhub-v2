import { FEATURES } from '../config/features';
import { Logger } from '../lib/logging/Logger';

// Mock implementations
import { MockCloudSyncService, ICloudSyncService } from './mocks/MockCloudSyncService';
import { MockAIAssistant, IAIAssistant } from './mocks/MockAIAssistant';

// TODO: [Session 0.2.0] Import real implementations when ready
// import { SupabaseCloudSync } from './cloud/SupabaseCloudSync';
// import { ClaudeAIAssistant } from './ai/ClaudeAIAssistant';

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
    if (FEATURES.CLOUD_SYNC) {
      // TODO: [Session 0.2.0] Return real SupabaseCloudSync instance
      this.logger.error('Real cloud sync not yet implemented');
      throw new Error('Real CloudSyncService not yet implemented. Enable feature flag only when ready.');
    }
    
    this.logger.info('Creating mock cloud sync service (feature disabled)');
    return new MockCloudSyncService();
  }

  /**
   * Create an AI assistant instance
   */
  static createAIAssistant(): IAIAssistant {
    if (FEATURES.AI_ASSISTANT) {
      // TODO: [Session 0.2.1] Return real ClaudeAIAssistant instance
      this.logger.error('Real AI assistant not yet implemented');
      throw new Error('Real AI Assistant not yet implemented. Enable feature flag only when ready.');
    }
    
    this.logger.info('Creating mock AI assistant (feature disabled)');
    return new MockAIAssistant();
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
   * Check if a service is available (real implementation)
   */
  static isServiceAvailable(service: 'cloudSync' | 'ai' | 'github' | 'slack'): boolean {
    switch (service) {
      case 'cloudSync':
        return FEATURES.CLOUD_SYNC;
      case 'ai':
        return FEATURES.AI_ASSISTANT;
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