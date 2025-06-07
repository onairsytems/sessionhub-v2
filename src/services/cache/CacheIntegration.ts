/**
 * Cache Integration Module
 * Provides a unified interface that combines Supabase and local cache
 * for optimal performance and offline support
 */

import { LocalCacheService } from './LocalCacheService';
import { SupabaseService, Project, Session, Instruction } from '../cloud/SupabaseService';
import { Logger } from '@/src/lib/logging/Logger';

export interface DataServiceConfig {
  enableCache?: boolean;
  cacheConfig?: {
    maxSizeBytes?: number;
    maxRecords?: number;
    ttlSeconds?: number;
    syncIntervalSeconds?: number;
  };
  supabaseConfig?: {
    url?: string;
    anonKey?: string;
  };
}

export class CachedDataService {
  private readonly logger: Logger;
  private readonly supabaseService: SupabaseService;
  private readonly cacheService: LocalCacheService;
  private readonly config: DataServiceConfig;
  private initialized = false;

  constructor(logger: Logger, config?: DataServiceConfig) {
    this.logger = logger;
    this.config = config || {};
    
    // Initialize services
    this.supabaseService = new SupabaseService(logger);
    this.cacheService = new LocalCacheService(logger, config?.cacheConfig);
  }

  /**
   * Initialize the data service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize Supabase
      await this.supabaseService.initialize(this.config.supabaseConfig);
      
      // Initialize cache with Supabase integration if caching is enabled
      if (this.config.enableCache !== false) {
        await this.cacheService.initialize(this.supabaseService);
      }
      
      this.initialized = true;
      this.logger.info('Cached data service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize cached data service', error as Error);
      
      // Try to initialize cache in offline mode
      if (this.config.enableCache !== false) {
        try {
          await this.cacheService.initialize();
          this.logger.info('Running in offline mode with local cache only');
        } catch (cacheError) {
          this.logger.error('Failed to initialize cache', cacheError as Error);
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if online (Supabase is available)
   */
  isOnline(): boolean {
    return this.supabaseService.isServiceOnline();
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    online: boolean;
    cacheEnabled: boolean;
    cacheStats?: any;
    offlineQueueSize?: number;
  }> {
    const status: any = {
      initialized: this.initialized,
      online: this.isOnline(),
      cacheEnabled: this.config.enableCache !== false && this.cacheService.isInitialized()
    };

    if (status.cacheEnabled) {
      status.cacheStats = await this.cacheService.getCacheStats();
      status.offlineQueueSize = await this.cacheService.getOfflineQueueSize();
    }

    return status;
  }

  // Project operations

  /**
   * Create a project
   */
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'last_accessed'>): Promise<Project> {
    if (!this.initialized) throw new Error('Service not initialized');

    // Use cache if available
    if (this.cacheService.isInitialized()) {
      return this.cacheService.createProject(project);
    }

    // Fall back to direct Supabase
    return this.supabaseService.createProject(project);
  }

  /**
   * Get a project by ID
   */
  async getProject(id: string, forceRefresh = false): Promise<Project | null> {
    if (!this.initialized) throw new Error('Service not initialized');

    // Use cache if available
    if (this.cacheService.isInitialized()) {
      return this.cacheService.getProject(id, forceRefresh);
    }

    // Fall back to direct Supabase
    return this.supabaseService.getProject(id);
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    if (!this.initialized) throw new Error('Service not initialized');

    // Use cache if available
    if (this.cacheService.isInitialized()) {
      return this.cacheService.getProjects();
    }

    // Fall back to direct Supabase
    return this.supabaseService.getProjects();
  }

  /**
   * Update a project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    if (!this.initialized) throw new Error('Service not initialized');

    // Use cache if available
    if (this.cacheService.isInitialized()) {
      return this.cacheService.updateProject(id, updates);
    }

    // Fall back to direct Supabase
    return this.supabaseService.updateProject(id, updates);
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Service not initialized');

    // Use cache if available
    if (this.cacheService.isInitialized()) {
      return this.cacheService.deleteProject(id);
    }

    // Fall back to direct Supabase
    return this.supabaseService.deleteProject(id);
  }

  // Session operations

  /**
   * Create a session
   */
  async createSession(session: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<Session> {
    if (!this.initialized) throw new Error('Service not initialized');

    // For now, delegate to Supabase directly
    // TODO: Implement caching for sessions
    return this.supabaseService.createSession(session);
  }

  /**
   * Get sessions for a project
   */
  async getProjectSessions(projectId: string): Promise<Session[]> {
    if (!this.initialized) throw new Error('Service not initialized');

    // For now, delegate to Supabase directly
    // TODO: Implement caching for sessions
    return this.supabaseService.getProjectSessions(projectId);
  }

  /**
   * Update a session
   */
  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    if (!this.initialized) throw new Error('Service not initialized');

    return this.supabaseService.updateSession(id, updates);
  }

  // Instruction operations

  /**
   * Create an instruction
   */
  async createInstruction(instruction: Omit<Instruction, 'id' | 'created_at'>): Promise<Instruction> {
    if (!this.initialized) throw new Error('Service not initialized');

    return this.supabaseService.createInstruction(instruction);
  }

  /**
   * Get instructions for a session
   */
  async getSessionInstructions(sessionId: string): Promise<Instruction[]> {
    if (!this.initialized) throw new Error('Service not initialized');

    return this.supabaseService.getSessionInstructions(sessionId);
  }

  // Cache management operations

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    if (this.cacheService.isInitialized()) {
      await this.cacheService.clearCache();
    }
  }

  /**
   * Force sync all pending changes
   */
  async forceSyncAll(): Promise<void> {
    if (this.cacheService.isInitialized()) {
      await this.cacheService.forceSyncAll();
    }
  }

  /**
   * Export cache data
   */
  async exportCache(): Promise<any> {
    if (!this.cacheService.isInitialized()) {
      throw new Error('Cache not initialized');
    }
    return this.cacheService.exportCache();
  }

  /**
   * Import cache data
   */
  async importCache(data: any): Promise<void> {
    if (!this.cacheService.isInitialized()) {
      throw new Error('Cache not initialized');
    }
    await this.cacheService.importCache(data);
  }

  /**
   * Optimize cache
   */
  async optimizeCache(): Promise<void> {
    if (this.cacheService.isInitialized()) {
      await this.cacheService.optimize();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.cacheService.cleanup();
    await this.supabaseService.cleanup();
    this.initialized = false;
  }
}

// Singleton instance with default configuration
let cachedDataService: CachedDataService | null = null;

/**
 * Get or create the singleton cached data service
 */
export function getCachedDataService(config?: DataServiceConfig): CachedDataService {
  if (!cachedDataService) {
    const logger = new Logger('CachedDataService');
    cachedDataService = new CachedDataService(logger, {
      enableCache: true,
      cacheConfig: {
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
        maxRecords: 10000,
        ttlSeconds: 3600, // 1 hour
        syncIntervalSeconds: 300, // 5 minutes
      },
      ...config
    });
  }
  return cachedDataService;
}

// Example usage
export async function exampleUsage() {
  // Get the service
  const dataService = getCachedDataService();
  
  // Initialize
  await dataService.initialize();
  
  // Check status
  const status = await dataService.getStatus();
  console.log('Service status:', status);
  
  // Create a project - will be cached locally and synced
  const project = await dataService.createProject({
    name: 'My Project',
    path: '/path/to/project',
    type: 'nextjs'
  });
  
  // Get project - will use cache for fast access
  const retrieved = await dataService.getProject(project.id!);
  console.log('Retrieved project:', retrieved);
  
  // Force refresh from Supabase
  const refreshed = await dataService.getProject(project.id!, true);
  console.log('Refreshed project:', refreshed);
  
  // Work offline - operations will be queued
  if (!dataService.isOnline()) {
    console.log('Working offline - changes will sync when online');
    
    await dataService.updateProject(project.id!, {
      name: 'Updated Offline'
    });
    
    // Check offline queue
    const queueStatus = await dataService.getStatus();
    console.log('Offline queue size:', queueStatus.offlineQueueSize);
  }
  
  // Force sync when back online
  if (dataService.isOnline()) {
    await dataService.forceSyncAll();
  }
  
  // Clean up
  await dataService.cleanup();
}

// Export types for convenience
export type { Project, Session, Instruction, ExecutionResult, Pattern } from '../cloud/SupabaseService';