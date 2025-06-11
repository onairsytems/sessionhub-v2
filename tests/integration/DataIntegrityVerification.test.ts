import { DatabaseService } from '../../src/database/DatabaseService';
import { SupabaseService } from '../../main/services/cloud/SupabaseService';
import { LocalCacheService } from '../../main/services/cache/LocalCacheService';
import { SyncEngine } from '../../main/services/sync/SyncEngine';
import * as crypto from 'crypto';

describe('Data Integrity Verification Tests', () => {
  let dbService: DatabaseService;
  let supabaseService: SupabaseService;
  let cacheService: LocalCacheService;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    dbService = new DatabaseService();
    supabaseService = new SupabaseService();
    cacheService = new LocalCacheService();
    syncEngine = new SyncEngine();

    await dbService.initialize();
    await cacheService.initialize();
  });

  afterEach(async () => {
    await dbService.close();
    await cacheService.clear();
  });

  describe('Local Database Integrity', () => {
    it('should maintain referential integrity', async () => {
      // Create project
      const project = await dbService.createProject({
        name: 'Test Project',
        type: 'next',
        path: '/test/path'
      });

      // Create session referencing project
      const session = await dbService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectId: project.id
      });

      // Verify cascade delete protection
      await expect(dbService.deleteProject(project.id))
        .rejects.toThrow('Cannot delete project with active sessions');

      // Delete session first
      await dbService.deleteSession(session.id);
      
      // Now project deletion should succeed
      await expect(dbService.deleteProject(project.id)).resolves.toBeTruthy();
    });

    it('should enforce unique constraints', async () => {
      const project = {
        name: 'Unique Project',
        type: 'next',
        path: '/unique/path'
      };

      await dbService.createProject(project);

      // Duplicate path should fail
      await expect(dbService.createProject(project))
        .rejects.toThrow('Project with this path already exists');
    });

    it('should validate data types', async () => {
      const invalidProject = {
        name: '', // Empty name
        type: 'invalid-type', // Invalid type
        path: 'relative/path' // Invalid path format
      };

      await expect(dbService.createProject(invalidProject))
        .rejects.toThrow('Validation failed');
    });

    it('should handle transaction rollback', async () => {
      const projectsBefore = await dbService.listProjects();

      try {
        await dbService.transaction(async (tx) => {
          await tx.createProject({ name: 'P1', type: 'next', path: '/p1' });
          await tx.createProject({ name: 'P2', type: 'next', path: '/p2' });
          
          // Force error
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected
      }

      const projectsAfter = await dbService.listProjects();
      expect(projectsAfter.length).toBe(projectsBefore.length);
    });

    it('should maintain data consistency during concurrent writes', async () => {
      const project = await dbService.createProject({
        name: 'Concurrent Test',
        type: 'next',
        path: '/concurrent'
      });

      // Simulate concurrent session creation
      const promises = Array(10).fill(null).map((_, i) => 
        dbService.createSession({
          title: `Session ${i}`,
          objectives: 'Test',
          projectId: project.id
        })
      );

      const sessions = await Promise.all(promises);
      
      // Verify all sessions were created with unique IDs
      const ids = new Set(sessions.map(s => s.id));
      expect(ids.size).toBe(10);

      // Verify count matches
      const sessionCount = await dbService.countSessions({ projectId: project.id });
      expect(sessionCount).toBe(10);
    });
  });

  describe('Cloud Storage Integrity', () => {
    it('should verify data consistency between local and cloud', async () => {
      const testData = {
        id: 'test-123',
        title: 'Test Session',
        data: { foo: 'bar', nested: { value: 42 } }
      };

      // Save to cloud
      await supabaseService.saveSession(testData);

      // Save to local
      await dbService.saveSession(testData);

      // Retrieve from both
      const cloudData = await supabaseService.getSession(testData.id);
      const localData = await dbService.getSession(testData.id);

      // Verify consistency
      expect(cloudData).toEqual(localData);
      expect(cloudData.data).toEqual(testData.data);
    });

    it('should detect data corruption', async () => {
      const originalData = {
        id: 'corrupt-test',
        content: 'Original content',
        checksum: ''
      };

      // Calculate checksum
      originalData.checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(originalData.content))
        .digest('hex');

      await supabaseService.save('test-table', originalData);

      // Simulate corruption
      const corrupted = { ...originalData, content: 'Corrupted content' };
      await supabaseService.update('test-table', corrupted.id, corrupted);

      // Verify corruption detection
      const retrieved = await supabaseService.get('test-table', originalData.id);
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(retrieved.content))
        .digest('hex');

      expect(calculatedChecksum).not.toBe(originalData.checksum);
    });

    it('should handle network failures gracefully', async () => {
      // Mock network failure
      jest.spyOn(supabaseService, 'save').mockRejectedValueOnce(
        new Error('Network error')
      );

      const data = { id: 'network-test', content: 'Test' };

      // Should queue for retry
      await expect(syncEngine.syncData(data)).resolves.toBeTruthy();

      // Verify data is in retry queue
      const queue = await syncEngine.getRetryQueue();
      expect(queue).toContainEqual(expect.objectContaining({ id: data.id }));
    });

    it('should maintain data order during sync', async () => {
      const operations = [];
      
      for (let i = 0; i < 5; i++) {
        operations.push({
          type: 'create',
          timestamp: Date.now() + i,
          data: { id: `order-${i}`, order: i }
        });
      }

      // Queue operations
      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      // Execute sync
      await syncEngine.executeSyncQueue();

      // Verify order maintained
      const synced = await supabaseService.list('operations', {
        orderBy: 'timestamp'
      });

      synced.forEach((item, index) => {
        expect(item.data.order).toBe(index);
      });
    });
  });

  describe('Cache Integrity', () => {
    it('should maintain cache consistency with database', async () => {
      const project = {
        id: 'cache-test',
        name: 'Cache Test Project',
        type: 'next',
        path: '/cache/test'
      };

      // Save to database
      await dbService.createProject(project);

      // Cache should be updated
      const cached = await cacheService.get(`project:${project.id}`);
      expect(cached).toEqual(project);

      // Update database
      const updated = { ...project, name: 'Updated Name' };
      await dbService.updateProject(project.id, updated);

      // Cache should be invalidated/updated
      const cachedAfterUpdate = await cacheService.get(`project:${project.id}`);
      expect(cachedAfterUpdate.name).toBe('Updated Name');
    });

    it('should handle cache expiration', async () => {
      const data = { id: 'expire-test', value: 'test' };
      
      // Set with short TTL
      await cacheService.set('test-key', data, { ttl: 100 }); // 100ms

      // Verify cached
      expect(await cacheService.get('test-key')).toEqual(data);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(await cacheService.get('test-key')).toBeNull();
    });

    it('should prevent cache poisoning', async () => {
      const validData = { id: 'valid', trusted: true };
      
      // Save valid data
      await cacheService.set('secure-key', validData);

      // Attempt to poison cache with untrusted data
      const maliciousData = { id: 'malicious', script: '<script>alert("xss")</script>' };
      
      // Cache service should validate/sanitize
      await cacheService.set('secure-key', maliciousData);
      
      const retrieved = await cacheService.get('secure-key');
      expect(retrieved.script).not.toContain('<script>');
    });

    it('should handle cache stampede', async () => {
      let dbCalls = 0;
      
      // Mock expensive database operation
      jest.spyOn(dbService, 'getProject').mockImplementation(async (id) => {
        dbCalls++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id, name: 'Test Project' };
      });

      // Simulate multiple concurrent requests for same data
      const requests = Array(10).fill(null).map(() => 
        cacheService.getOrFetch('stampede-test', () => dbService.getProject('test-id'))
      );

      const results = await Promise.all(requests);

      // Should only call database once
      expect(dbCalls).toBe(1);
      
      // All requests should get same data
      results.forEach(result => {
        expect(result).toEqual({ id: 'test-id', name: 'Test Project' });
      });
    });
  });

  describe('Sync Integrity', () => {
    it('should handle conflict resolution', async () => {
      const baseData = {
        id: 'conflict-test',
        version: 1,
        content: 'Original content',
        updatedAt: new Date('2024-01-01')
      };

      // Save to both local and cloud
      await dbService.save(baseData);
      await supabaseService.save('data', baseData);

      // Simulate concurrent updates
      const localUpdate = {
        ...baseData,
        version: 2,
        content: 'Local update',
        updatedAt: new Date('2024-01-02')
      };

      const cloudUpdate = {
        ...baseData,
        version: 2,
        content: 'Cloud update',
        updatedAt: new Date('2024-01-03')
      };

      await dbService.save(localUpdate);
      await supabaseService.save('data', cloudUpdate);

      // Sync should detect and resolve conflict
      const resolved = await syncEngine.resolveConflict(baseData.id);

      // Later timestamp should win (cloud update)
      expect(resolved.content).toBe('Cloud update');
      expect(resolved.version).toBe(3); // Incremented after resolution
    });

    it('should maintain sync queue integrity', async () => {
      // Queue multiple operations
      const operations = [
        { type: 'create', id: '1', data: { name: 'Item 1' } },
        { type: 'update', id: '1', data: { name: 'Item 1 Updated' } },
        { type: 'delete', id: '1' }
      ];

      for (const op of operations) {
        await syncEngine.queueOperation(op);
      }

      // Process queue
      await syncEngine.processQueue();

      // Final state should reflect all operations
      const finalState = await supabaseService.get('data', '1');
      expect(finalState).toBeNull(); // Deleted
    });

    it('should verify data after sync', async () => {
      const testData = Array(10).fill(null).map((_, i) => ({
        id: `verify-${i}`,
        value: i,
        checksum: ''
      }));

      // Calculate checksums
      testData.forEach(item => {
        item.checksum = crypto
          .createHash('sha256')
          .update(JSON.stringify(item))
          .digest('hex');
      });

      // Sync data
      await syncEngine.syncBatch(testData);

      // Verify all data synced correctly
      const verificationResults = await syncEngine.verifySync(
        testData.map(d => d.id)
      );

      expect(verificationResults.success).toBe(true);
      expect(verificationResults.errors).toHaveLength(0);
      expect(verificationResults.verified).toBe(testData.length);
    });

    it('should handle partial sync failures', async () => {
      const batch = Array(5).fill(null).map((_, i) => ({
        id: `partial-${i}`,
        data: `Data ${i}`
      }));

      // Mock failure for middle item
      jest.spyOn(supabaseService, 'save')
        .mockImplementationOnce(async (table, data) => data) // Success
        .mockImplementationOnce(async (table, data) => data) // Success
        .mockRejectedValueOnce(new Error('Sync failed'))     // Failure
        .mockImplementationOnce(async (table, data) => data) // Success
        .mockImplementationOnce(async (table, data) => data); // Success

      const results = await syncEngine.syncBatch(batch);

      // Should report partial success
      expect(results.successful).toBe(4);
      expect(results.failed).toBe(1);
      expect(results.failures[0].id).toBe('partial-2');

      // Failed items should be queued for retry
      const retryQueue = await syncEngine.getRetryQueue();
      expect(retryQueue).toContainEqual(
        expect.objectContaining({ id: 'partial-2' })
      );
    });
  });

  describe('Data Migration Integrity', () => {
    it('should maintain data integrity during migrations', async () => {
      // Create test data with old schema
      const oldData = {
        id: 'migration-test',
        name: 'Test',
        // Old schema has 'description' field
        description: 'This is a test'
      };

      await dbService.save('old_table', oldData);

      // Run migration (description -> details)
      await dbService.runMigration('rename_description_to_details');

      // Verify data migrated correctly
      const migrated = await dbService.get('new_table', oldData.id);
      expect(migrated.name).toBe(oldData.name);
      expect(migrated.details).toBe(oldData.description);
      expect(migrated.description).toBeUndefined();
    });

    it('should rollback migrations on failure', async () => {
      const dataBefore = await dbService.getSchema();

      try {
        await dbService.runMigration('failing_migration');
      } catch (error) {
        // Expected to fail
      }

      const dataAfter = await dbService.getSchema();
      expect(dataAfter).toEqual(dataBefore);
    });
  });

  describe('Backup and Recovery', () => {
    it('should create consistent backups', async () => {
      // Create test data
      const projects = Array(5).fill(null).map((_, i) => ({
        name: `Project ${i}`,
        type: 'next',
        path: `/project-${i}`
      }));

      for (const project of projects) {
        await dbService.createProject(project);
      }

      // Create backup
      const backup = await dbService.createBackup();

      // Verify backup integrity
      expect(backup.checksum).toBeTruthy();
      expect(backup.timestamp).toBeInstanceOf(Date);
      expect(backup.data.projects).toHaveLength(5);

      // Verify backup can be restored
      await dbService.clear();
      await dbService.restoreBackup(backup);

      const restored = await dbService.listProjects();
      expect(restored).toHaveLength(5);
    });

    it('should verify backup integrity before restore', async () => {
      const backup = await dbService.createBackup();

      // Corrupt backup
      backup.data.corrupted = true;
      
      // Recalculate checksum to make it "valid"
      const tamperedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(backup.data))
        .digest('hex');

      backup.checksum = tamperedChecksum;

      // Should detect schema mismatch
      await expect(dbService.restoreBackup(backup))
        .rejects.toThrow('Backup validation failed');
    });
  });
});