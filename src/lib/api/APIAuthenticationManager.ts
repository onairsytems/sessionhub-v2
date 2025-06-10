/**
 * Manages API authentication for all external services
 * Integrates with CredentialManager for secure credential storage
 */

import { Logger } from '@/src/lib/logging/Logger';
import { CredentialManager } from '@/src/lib/security/CredentialManager';
import { ClaudeAPIClient } from './ClaudeAPIClient';
import { ClaudeCodeAPIClient } from './ClaudeCodeAPIClient';

export interface APICredentials {
  anthropicApiKey?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  figmaToken?: string;
  githubToken?: string;
}

export interface APIClientConfig {
  planning: {
    enabled: boolean;
    client?: ClaudeAPIClient;
  };
  execution: {
    enabled: boolean;
    client?: ClaudeCodeAPIClient;
  };
}

export class APIAuthenticationManager {
  private readonly logger: Logger;
  private readonly credentialManager: CredentialManager;
  private clients: APIClientConfig;
  private initialized = false;

  constructor(
    logger: Logger,
    credentialManager: CredentialManager
  ) {
    this.logger = logger;
    this.credentialManager = credentialManager;
    this.clients = {
      planning: { enabled: false },
      execution: { enabled: false }
    };
  }

  /**
   * Initialize API authentication with stored credentials
   */
  async initialize(): Promise<void> {
    try {
      await this.credentialManager.initialize();
      await this.loadAPICredentials();
      this.initialized = true;
      
      this.logger.info('APIAuthenticationManager initialized', {
        planningEnabled: this.clients.planning.enabled,
        executionEnabled: this.clients.execution.enabled
      });
    } catch (error: any) {
      this.logger.error('Failed to initialize APIAuthenticationManager', error as Error);
      throw error;
    }
  }

  /**
   * Store API credentials securely
   */
  async storeAPICredentials(credentials: APICredentials): Promise<void> {
    const credentialIds: string[] = [];

    try {
      // Store Anthropic API key for both planning and execution
      if (credentials.anthropicApiKey) {
        const id = await this.credentialManager.storeCredential({
          name: 'anthropic_api_key',
          type: 'api_key',
          value: credentials.anthropicApiKey,
          metadata: {
            service: 'anthropic',
            usage: 'planning_and_execution'
          }
        });
        credentialIds.push(id);
      }

      // Store other credentials
      if (credentials.supabaseUrl) {
        const id = await this.credentialManager.storeCredential({
          name: 'supabase_url',
          type: 'api_key',
          value: credentials.supabaseUrl,
          metadata: { service: 'supabase' }
        });
        credentialIds.push(id);
      }

      if (credentials.supabaseKey) {
        const id = await this.credentialManager.storeCredential({
          name: 'supabase_key',
          type: 'api_key',
          value: credentials.supabaseKey,
          metadata: { service: 'supabase' }
        });
        credentialIds.push(id);
      }

      if (credentials.figmaToken) {
        const id = await this.credentialManager.storeCredential({
          name: 'figma_token',
          type: 'token',
          value: credentials.figmaToken,
          metadata: { service: 'figma' }
        });
        credentialIds.push(id);
      }

      if (credentials.githubToken) {
        const id = await this.credentialManager.storeCredential({
          name: 'github_token',
          type: 'token',
          value: credentials.githubToken,
          metadata: { service: 'github' }
        });
        credentialIds.push(id);
      }

      // Reinitialize API clients with new credentials
      await this.loadAPICredentials();

      this.logger.info('API credentials stored successfully', {
        credentialCount: credentialIds.length,
        planningEnabled: this.clients.planning.enabled,
        executionEnabled: this.clients.execution.enabled
      });
    } catch (error: any) {
      this.logger.error('Failed to store API credentials', error as Error);
      throw error;
    }
  }

  /**
   * Get planning actor API client
   */
  getPlanningClient(): ClaudeAPIClient | null {
    if (!this.initialized) {
      throw new Error('APIAuthenticationManager not initialized');
    }
    return this.clients.planning.client || null;
  }

  /**
   * Get execution actor API client
   */
  getExecutionClient(): ClaudeCodeAPIClient | null {
    if (!this.initialized) {
      throw new Error('APIAuthenticationManager not initialized');
    }
    return this.clients.execution.client || null;
  }

  /**
   * Check if real API integration is available
   */
  isRealAPIAvailable(): { planning: boolean; execution: boolean } {
    return {
      planning: this.clients.planning.enabled,
      execution: this.clients.execution.enabled
    };
  }

  /**
   * Validate all stored API credentials
   */
  async validateCredentials(): Promise<{
    anthropic: { valid: boolean; error?: string };
    supabase: { valid: boolean; error?: string };
    figma: { valid: boolean; error?: string };
    github: { valid: boolean; error?: string };
  }> {
    const results = {
      anthropic: { valid: false, error: undefined as string | undefined },
      supabase: { valid: false, error: undefined as string | undefined },
      figma: { valid: false, error: undefined as string | undefined },
      github: { valid: false, error: undefined as string | undefined }
    };

    // Validate Anthropic API key
    if (this.clients.planning.client) {
      try {
        const isValid = await this.clients.planning.client.validateApiKey();
        results.anthropic.valid = isValid;
        if (!isValid) {
          results.anthropic.error = 'API key validation failed';
        }
      } catch (error: any) {
        results.anthropic.error = (error as Error).message;
      }
    } else {
      results.anthropic.error = 'No API key configured';
    }

    // TODO: Add validation for other services when implemented
    
    this.logger.info('API credential validation completed', results);
    return results;
  }

  /**
   * Remove specific API credentials
   */
  async removeCredentials(service: 'anthropic' | 'supabase' | 'figma' | 'github'): Promise<void> {
    try {
      const serviceNameMap = {
        anthropic: 'anthropic_api_key',
        supabase: ['supabase_url', 'supabase_key'],
        figma: 'figma_token',
        github: 'github_token'
      };

      const names = Array.isArray(serviceNameMap[service]) 
        ? serviceNameMap[service] as string[]
        : [serviceNameMap[service] as string];

      for (const name of names) {
        const credential = await this.credentialManager.getCredentialByName(name);
        if (credential) {
          await this.credentialManager.deleteCredential(credential.id);
        }
      }

      // Reinitialize clients
      await this.loadAPICredentials();

      this.logger.info('API credentials removed', { service });
    } catch (error: any) {
      this.logger.error('Failed to remove API credentials', error as Error);
      throw error;
    }
  }

  /**
   * Get credential status summary
   */
  getCredentialStatus(): {
    anthropic: boolean;
    supabase: boolean;
    figma: boolean;
    github: boolean;
  } {
    return {
      anthropic: this.clients.planning.enabled || this.clients.execution.enabled,
      supabase: false, // TODO: implement when Supabase integration is added
      figma: false, // TODO: implement when Figma integration is added
      github: false // TODO: implement when GitHub integration is added
    };
  }

  /**
   * Load API credentials and initialize clients
   */
  private async loadAPICredentials(): Promise<void> {
    try {
      // Load Anthropic API key
      const anthropicCred = await this.credentialManager.getCredentialByName('anthropic_api_key');
      
      if (anthropicCred) {
        // Initialize Planning Actor client
        this.clients.planning.client = new ClaudeAPIClient(
          { 
            apiKey: anthropicCred.value,
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            maxTokens: 4000
          },
          this.logger
        );
        this.clients.planning.enabled = true;

        // Initialize Execution Actor client
        this.clients.execution.client = new ClaudeCodeAPIClient(
          { 
            apiKey: anthropicCred.value,
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.3,
            maxTokens: 8000
          },
          this.logger
        );
        this.clients.execution.enabled = true;

        this.logger.info('Anthropic API clients initialized');
      } else {
        this.clients.planning.enabled = false;
        this.clients.execution.enabled = false;
        this.clients.planning.client = undefined;
        this.clients.execution.client = undefined;
        this.logger.info('No Anthropic API key found, using mock implementations');
      }

      // TODO: Load other service credentials when implemented
      
    } catch (error: any) {
      this.logger.error('Failed to load API credentials', error as Error);
      // Don't throw here - allow fallback to mock implementations
    }
  }

  /**
   * Refresh API clients (useful after credential updates)
   */
  async refreshClients(): Promise<void> {
    await this.loadAPICredentials();
    this.logger.info('API clients refreshed');
  }

  /**
   * Get usage statistics for API calls
   */
  async getUsageStatistics(): Promise<{
    planning: any;
    execution: any;
  }> {
    const stats = {
      planning: null,
      execution: null
    };

    if (this.clients.planning.client) {
      try {
        stats.planning = await this.clients.planning.client.getUsage();
      } catch (error: any) {
        this.logger.warn('Failed to get planning usage stats', error as Error);
      }
    }

    // Execution client doesn't have usage method yet - would need to be implemented
    
    return stats;
  }
}