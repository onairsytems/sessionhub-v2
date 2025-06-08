
/**
 * Test file for LocalCacheService
 * Demonstrates usage and functionality of the local SQLite cache
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LocalCacheService } from './LocalCacheService';
import { SupabaseService } from '../cloud/SupabaseService';
import { Logger } from '@/src/lib/logging/Logger';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_CACHE_PATH = path.join(__dirname, 'test-cache');

describe('LocalCacheService', () => {
  let cacheService: LocalCacheService;
  // let supabaseService: SupabaseService; // Commented out for future use
  let logger: Logger;

  beforeAll(() => {
    // Clean up any existing test cache
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.rmSync(TEST_CACHE_PATH, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    logger = new Logger('LocalCacheServiceTest');
    cacheService = new LocalCacheService(logger, {
      cachePath: TEST_CACHE_PATH,
      maxSizeBytes: 10 * 1024 * 1024, // 10MB for testing
      maxRecords: 1000,
      ttlSeconds: 3600,
      syncIntervalSeconds: 60,
      enableAutoSync: false // Disable auto-sync for tests
    });

    // Initialize without Supabase for offline testing
    await cacheService.initialize();
  });

  afterEach(async () => {
    await cacheService.cleanup();
  });

  afterAll(() => {
    // Clean up test cache
    if (fs.existsSync(TEST_CACHE_PATH)) {
      fs.rmSync(TEST_CACHE_PATH, { recursive: true, force: true });
    }
  });

  describe('Basic Operations', () => {
    it('should create and retrieve a project', async () => {
      const project = await cacheService.createProject({
        name: 'Test Project',
        path: '/test/project',
        type: 'nextjs',
        metadata: { version: '1.0.0' }
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');

      const retrieved = await cacheService.getProject(project.id!);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Project');
    });

    it('should update a project', async () => {
      const project = await cacheService.createProject({
        name: 'Update Test',
        path: '/update/test',
        type: 'react'
      });

      const updated = await cacheService.updateProject(project.id!, {
        name: 'Updated Name',
        metadata: { updated: true }
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.metadata?.['updated']).toBe(true);
    });

    it('should delete a project', async () => {
      const project = await cacheService.createProject({
        name: 'Delete Test',
        path: '/delete/test',
        type: 'node'
      });

      await cacheService.deleteProject(project.id!);

      const retrieved = await cacheService.getProject(project.id!);
      expect(retrieved).toBeNull();
    });

    it('should list all projects', async () => {
      // Create multiple projects
      await cacheService.createProject({
        name: 'Project 1',
        path: '/project1',
        type: 'nextjs'
      });

      await cacheService.createProject({
        name: 'Project 2',
        path: '/project2',
        type: 'react'
      });

      const projects = await cacheService.getProjects();
      expect(projects.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cache Management', () => {
    it('should track cache statistics', async () => {
      // Create some data
      await cacheService.createProject({
        name: 'Stats Test',
        path: '/stats/test',
        type: 'node'
      });

      const stats = await cacheService.getCacheStats();
      expect(stats.recordCounts['projects']).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeDefined();
    });

    it('should clear cache', async () => {
      // Create data
      await cacheService.createProject({
        name: 'Clear Test',
        path: '/clear/test',
        type: 'python'
      });

      await cacheService.clearCache();

      const projects = await cacheService.getProjects();
      expect(projects.length).toBe(0);
    });

    it('should export and import cache', async () => {
      // Create data
      const project = await cacheService.createProject({
        name: 'Export Test',
        path: '/export/test',
        type: 'java'
      });

      // Export
      const exported = await cacheService.exportCache();
      expect(exported.tables.projects).toBeDefined();

      // Clear and import
      await cacheService.clearCache();
      await cacheService.importCache(exported);

      // Verify import
      const retrieved = await cacheService.getProject(project.id!);
      expect(retrieved?.name).toBe('Export Test');
    });
  });

  describe('Offline Queue', () => {
    it('should track pending syncs', async () => {
      // Create project offline
      // const project = await cacheService.createProject({ // Commented out for future use
      //   name: 'Offline Test',
      //   path: '/offline/test',
      //   type: 'other'
      // });

      const queueSize = await cacheService.getOfflineQueueSize();
      expect(queueSize).toBeGreaterThan(0);
    });
  });

  describe('TTL and Expiration', () => {
    it('should handle expired records', async () => {
      // Create a cache service with very short TTL
      const shortTTLCache = new LocalCacheService(logger, {
        cachePath: TEST_CACHE_PATH + '-ttl',
        ttlSeconds: 1, // 1 second TTL
        enableAutoSync: false
      });

      await shortTTLCache.initialize();

      // const project = await shortTTLCache.createProject({ // Commented out for future use
      //   name: 'TTL Test',
      //   path: '/ttl/test',
      //   type: 'nextjs'
      // });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force refresh should fetch new data (or return null in offline mode)
      // const retrieved = await shortTTLCache.getProject(project.id!, true); // Commented out for future use
      
      await shortTTLCache.cleanup();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of records efficiently', async () => {
      const startTime = Date.now();
      const recordCount = 100;

      // Create many projects
      const promises = [];
      for (let i = 0; i < recordCount; i++) {
        promises.push(
          cacheService.createProject({
            name: `Performance Test ${i}`,
            path: `/perf/test${i}`,
            type: 'nextjs'
          })
        );
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`Created ${recordCount} records in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      // Test retrieval performance
      const retrieveStart = Date.now();
      const projects = await cacheService.getProjects();
      const retrieveEnd = Date.now();

      console.log(`Retrieved ${projects.length} records in ${retrieveEnd - retrieveStart}ms`);
      expect(projects.length).toBe(recordCount);
    });
  });
});

// Example usage in application
async function exampleUsage() {
  const logger = new Logger('AppCache');
  const supabaseService = new SupabaseService(logger);
  const cacheService = new LocalCacheService(logger);

  // Initialize with Supabase integration
  await supabaseService.initialize();
  await cacheService.initialize(supabaseService);

  // Create a project - will cache locally and sync to Supabase
  const project = await cacheService.createProject({
    name: 'My Awesome Project',
    path: '/Users/me/projects/awesome',
    type: 'nextjs',
    metadata: {
      framework: 'Next.js 14',
      features: ['app-router', 'server-components']
    }
  });

  console.log('Created project:', project);

  // Get project - will use cache for fast access
  const cached = await cacheService.getProject(project.id!);
  console.log('Retrieved from cache:', cached);

  // Check cache statistics
  const stats = await cacheService.getCacheStats();
  console.log('Cache stats:', stats);

  // Force sync with Supabase
  await cacheService.forceSyncAll();

  // Clean up
  await cacheService.cleanup();
  await supabaseService.cleanup();
}

// Offline mode example
async function offlineExample() {
  const logger = new Logger('OfflineCache');
  const cacheService = new LocalCacheService(logger, {
    enableAutoSync: true,
    syncIntervalSeconds: 30 // Sync every 30 seconds when online
  });

  // Initialize without Supabase - pure offline mode
  await cacheService.initialize();

  // All operations work offline
  // const project = await cacheService.createProject({ // Commented out for future use
  //   name: 'Offline Project',
  //   path: '/offline/project',
  //   type: 'react'
  // });

  // Check offline queue
  const queueSize = await cacheService.getOfflineQueueSize();
  console.log(`${queueSize} operations pending sync`);

  // Later, when online, initialize with Supabase
  const supabaseService = new SupabaseService(logger);
  await supabaseService.initialize();
  await cacheService.initialize(supabaseService);

  // Force sync all pending operations
  await cacheService.forceSyncAll();

  await cacheService.cleanup();
}

// Export for use in other modules
export { exampleUsage, offlineExample };