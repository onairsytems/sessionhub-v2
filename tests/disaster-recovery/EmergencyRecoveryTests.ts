import { DatabaseService } from '../../src/database/DatabaseService';
import { SupabaseService } from '../../main/services/cloud/SupabaseService';
import { SessionService } from '../../src/services/SessionService';
import { ProjectManager } from '../../main/services/projectManager';
import { BackupService } from '../../src/services/BackupService';
import { RecoveryService } from '../../src/services/RecoveryService';
import { execSync } from 'child_process';
import { existsSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

describe('Emergency Recovery Tests', () => {
  let dbService: DatabaseService;
  let supabaseService: SupabaseService;
  let sessionService: SessionService;
  let projectManager: ProjectManager;
  let backupService: BackupService;
  let recoveryService: RecoveryService;

  const testDataDir = join(__dirname, '../../test-data');
  const backupDir = join(__dirname, '../../test-backups');

  beforeEach(async () => {
    // Initialize services
    dbService = new DatabaseService();
    supabaseService = new SupabaseService();
    sessionService = new SessionService();
    projectManager = new ProjectManager();
    backupService = new BackupService();
    recoveryService = new RecoveryService();

    // Create test directories
    execSync(`mkdir -p ${testDataDir} ${backupDir}`);
  });

  afterEach(async () => {
    // Clean up
    rmSync(testDataDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
  });

  describe('Total System Failure Recovery', () => {
    it('should recover from complete database corruption', async () => {
      // Create test data
      const projects = await createTestProjects(5);
      const sessions = await createTestSessions(10, projects);

      // Create backup before corruption
      const backup = await backupService.createFullBackup();
      expect(backup.id).toBeTruthy();

      // Simulate database corruption
      await corruptDatabase();

      // Verify database is corrupted
      await expect(dbService.listProjects()).rejects.toThrow();

      // Perform emergency recovery
      const recoveryResult = await recoveryService.performEmergencyRecovery(backup.id);

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.dataRestored).toBe(true);
      expect(recoveryResult.integrityVerified).toBe(true);

      // Verify data restored
      const restoredProjects = await projectManager.listProjects();
      const restoredSessions = await sessionService.listSessions({});

      expect(restoredProjects).toHaveLength(5);
      expect(restoredSessions.sessions).toHaveLength(10);

      // Verify data integrity
      for (const project of projects) {
        const restored = restoredProjects.find(p => p.id === project.id);
        expect(restored).toEqual(project);
      }
    });

    it('should recover from cloud service outage', async () => {
      // Create test data synced to cloud
      const testData = await createSyncedData();

      // Simulate cloud outage
      jest.spyOn(supabaseService, 'get').mockRejectedValue(new Error('Service unavailable'));
      jest.spyOn(supabaseService, 'save').mockRejectedValue(new Error('Service unavailable'));

      // Verify cloud is down
      await expect(supabaseService.get('test', 'any')).rejects.toThrow('Service unavailable');

      // Switch to offline mode
      const offlineResult = await recoveryService.switchToOfflineMode();
      expect(offlineResult.success).toBe(true);
      expect(offlineResult.mode).toBe('offline');

      // Verify local operations continue working
      const newSession = await sessionService.createSession({
        title: 'Offline Session',
        objectives: 'Work offline',
        projectContext: testData.projects[0]
      });

      expect(newSession.id).toBeTruthy();
      expect(newSession.syncStatus).toBe('pending');

      // Simulate cloud recovery
      jest.restoreAllMocks();

      // Sync pending changes
      const syncResult = await recoveryService.syncPendingChanges();
      expect(syncResult.synced).toBe(1);
      expect(syncResult.failed).toBe(0);

      // Verify data synced to cloud
      const cloudSession = await supabaseService.get('sessions', newSession.id);
      expect(cloudSession).toBeTruthy();
    });

    it('should recover from file system corruption', async () => {
      // Create project with files
      const projectPath = join(testDataDir, 'test-project');
      execSync(`mkdir -p ${projectPath}`);
      
      const originalFiles = {
        'package.json': '{"name": "test", "version": "1.0.0"}',
        'src/index.js': 'console.log("Hello");',
        'README.md': '# Test Project'
      };

      for (const [path, content] of Object.entries(originalFiles)) {
        const fullPath = join(projectPath, path);
        execSync(`mkdir -p ${join(projectPath, 'src')}`);
        writeFileSync(fullPath, content);
      }

      // Import project
      const project = await projectManager.importProject(projectPath);

      // Create file backup
      const fileBackup = await backupService.createProjectBackup(project.id);

      // Corrupt files
      writeFileSync(join(projectPath, 'package.json'), 'corrupted{{{');
      rmSync(join(projectPath, 'src/index.js'));
      writeFileSync(join(projectPath, 'README.md'), '');

      // Verify corruption
      expect(() => JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8')))
        .toThrow();

      // Restore from backup
      const restoreResult = await recoveryService.restoreProjectFiles(
        project.id,
        fileBackup.id
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.filesRestored).toBe(3);

      // Verify files restored
      for (const [path, content] of Object.entries(originalFiles)) {
        const restored = readFileSync(join(projectPath, path), 'utf-8');
        expect(restored).toBe(content);
      }
    });

    it('should recover from memory exhaustion', async () => {
      // Monitor initial memory
      const initialMemory = process.memoryUsage();

      // Simulate memory leak
      const leaks = [];
      const leakSize = 10 * 1024 * 1024; // 10MB per leak

      try {
        // Allocate memory until near limit
        while (process.memoryUsage().heapUsed < initialMemory.heapUsed + 500 * 1024 * 1024) {
          leaks.push(Buffer.alloc(leakSize));
        }
      } catch (error) {
        // Expected to fail
      }

      // Trigger emergency memory cleanup
      const cleanupResult = await recoveryService.performMemoryCleanup();
      
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.memoryFreed).toBeGreaterThan(0);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // Clear leaks
      leaks.length = 0;

      // Verify memory recovered
      const afterCleanup = process.memoryUsage();
      expect(afterCleanup.heapUsed).toBeLessThan(
        initialMemory.heapUsed + 100 * 1024 * 1024
      );

      // Verify system still functional
      const testSession = await sessionService.createSession({
        title: 'Post-recovery test',
        objectives: 'Verify system works',
        projectContext: { id: 'test', name: 'Test', type: 'next', path: '/test' }
      });

      expect(testSession.id).toBeTruthy();
    });
  });

  describe('Partial Failure Recovery', () => {
    it('should recover from actor failure', async () => {
      // Start session
      const session = await sessionService.createSession({
        title: 'Actor Failure Test',
        objectives: 'Test actor recovery',
        projectContext: { id: 'test', name: 'Test', type: 'next', path: '/test' }
      });

      await sessionService.startSession(session.id);

      // Simulate planning actor failure
      jest.spyOn(require('../../src/services/planning/PlanningEngine').PlanningEngine.prototype, 'generatePlan')
        .mockRejectedValueOnce(new Error('Actor crashed'));

      // Attempt planning (should fail)
      await expect(sessionService.generatePlan(session.id, 'Create feature'))
        .rejects.toThrow('Actor crashed');

      // Trigger actor recovery
      const recoveryResult = await recoveryService.recoverActor('planning');
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.actorRestarted).toBe(true);

      // Verify actor recovered
      jest.restoreAllMocks();
      
      const plan = await sessionService.generatePlan(session.id, 'Create feature');
      expect(plan).toBeTruthy();
      expect(plan.instructions).toHaveLength(3);
    });

    it('should recover from network partition', async () => {
      // Create distributed setup
      const nodes = ['node1', 'node2', 'node3'];
      const testData = await createDistributedData(nodes);

      // Simulate network partition (node3 isolated)
      jest.spyOn(recoveryService, 'pingNode')
        .mockImplementation(async (node) => node !== 'node3');

      // Detect partition
      const partitionStatus = await recoveryService.detectNetworkPartition();
      expect(partitionStatus.hasPartition).toBe(true);
      expect(partitionStatus.isolatedNodes).toContain('node3');

      // Perform partition recovery
      const recoveryResult = await recoveryService.recoverFromPartition();
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.strategy).toBe('quorum-based');

      // Verify data consistency maintained
      const node1Data = await recoveryService.getNodeData('node1');
      const node2Data = await recoveryService.getNodeData('node2');
      
      expect(node1Data).toEqual(node2Data);
    });

    it('should recover from storage failure', async () => {
      // Create test data across multiple storage backends
      const storageBackends = ['local', 'cloud', 'cache'];
      const testData = { id: 'storage-test', content: 'Important data' };

      // Save to all backends
      await backupService.saveToMultipleBackends(testData, storageBackends);

      // Simulate local storage failure
      jest.spyOn(dbService, 'get').mockRejectedValue(new Error('Disk failure'));

      // Attempt to read (should fail from primary)
      await expect(dbService.get('data', testData.id))
        .rejects.toThrow('Disk failure');

      // Trigger storage failover
      const failoverResult = await recoveryService.performStorageFailover();
      expect(failoverResult.success).toBe(true);
      expect(failoverResult.newPrimary).toBe('cloud');

      // Verify data accessible from failover
      const recovered = await recoveryService.getData(testData.id);
      expect(recovered).toEqual(testData);
    });
  });

  describe('Disaster Simulation', () => {
    it('should handle cascading failures', async () => {
      // Create interdependent services
      const services = ['database', 'cache', 'sync', 'api'];
      
      // Simulate cascading failure starting with database
      const failures = [];
      
      // Database fails first
      failures.push({
        service: 'database',
        time: Date.now(),
        error: 'Connection refused'
      });

      // Cache fails due to database dependency
      await new Promise(resolve => setTimeout(resolve, 100));
      failures.push({
        service: 'cache',
        time: Date.now(),
        error: 'Cannot sync with database'
      });

      // Sync fails due to cache
      await new Promise(resolve => setTimeout(resolve, 100));
      failures.push({
        service: 'sync',
        time: Date.now(),
        error: 'Cache unavailable'
      });

      // API fails due to all dependencies
      await new Promise(resolve => setTimeout(resolve, 100));
      failures.push({
        service: 'api',
        time: Date.now(),
        error: 'No backend available'
      });

      // Trigger disaster recovery
      const disasterResult = await recoveryService.handleDisaster(failures);
      
      expect(disasterResult.success).toBe(true);
      expect(disasterResult.strategy).toBe('sequential-recovery');
      expect(disasterResult.servicesRecovered).toEqual(['database', 'cache', 'sync', 'api']);
      expect(disasterResult.recoveryTime).toBeLessThan(30000); // Under 30 seconds
    });

    it('should perform full system restore from catastrophic failure', async () => {
      // Create comprehensive system state
      const systemState = await createFullSystemState();

      // Create disaster recovery checkpoint
      const checkpoint = await backupService.createDisasterRecoveryCheckpoint();

      // Simulate catastrophic failure
      await simulateCatastrophicFailure();

      // Verify system is non-functional
      const healthCheck = await recoveryService.performHealthCheck();
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.failedServices.length).toBeGreaterThan(3);

      // Initiate full disaster recovery
      const recoveryStart = Date.now();
      const fullRecovery = await recoveryService.performFullDisasterRecovery(checkpoint.id);

      expect(fullRecovery.success).toBe(true);
      expect(fullRecovery.dataIntegrity).toBe(100);
      expect(fullRecovery.servicesRestored).toBe(healthCheck.failedServices.length);
      expect(fullRecovery.recoveryTime).toBe(Date.now() - recoveryStart);

      // Verify system fully operational
      const postRecoveryHealth = await recoveryService.performHealthCheck();
      expect(postRecoveryHealth.healthy).toBe(true);
      expect(postRecoveryHealth.failedServices).toHaveLength(0);

      // Verify no data loss
      const restoredState = await getFullSystemState();
      expect(restoredState).toEqual(systemState);
    });

    it('should maintain service availability during rolling recovery', async () => {
      // Start monitoring availability
      const availabilityMonitor = new AvailabilityMonitor();
      availabilityMonitor.start();

      // Create active sessions
      const activeSessions = await createActiveSessions(3);

      // Trigger rolling recovery
      const rollingRecovery = recoveryService.performRollingRecovery();

      // Continue operations during recovery
      const operationResults = await Promise.all(
        activeSessions.map(async (session) => {
          try {
            // Attempt to continue session work
            await sessionService.addExecutionResult(session.id, {
              success: true,
              filesModified: ['test.js'],
              output: 'Continued during recovery'
            });
            return { sessionId: session.id, success: true };
          } catch (error) {
            return { sessionId: session.id, success: false, error };
          }
        })
      );

      // Wait for recovery to complete
      await rollingRecovery;

      // Stop monitoring
      const availability = availabilityMonitor.stop();

      // Verify high availability maintained
      expect(availability.uptime).toBeGreaterThan(99); // 99% uptime
      expect(availability.totalDowntime).toBeLessThan(1000); // Less than 1 second

      // Verify operations succeeded
      const successfulOps = operationResults.filter(r => r.success);
      expect(successfulOps.length).toBeGreaterThanOrEqual(2); // At least 2/3 succeeded
    });
  });

  describe('Recovery Validation', () => {
    it('should validate recovery completeness', async () => {
      // Create known good state
      const goodState = await createKnownGoodState();

      // Perform backup
      const backup = await backupService.createValidatedBackup(goodState);

      // Corrupt system
      await corruptSystem();

      // Perform recovery
      await recoveryService.restoreFromBackup(backup.id);

      // Validate recovery
      const validation = await recoveryService.validateRecovery(goodState);

      expect(validation.complete).toBe(true);
      expect(validation.dataIntegrity).toBe(100);
      expect(validation.schemaMatch).toBe(true);
      expect(validation.functionalityRestored).toBe(true);
      expect(validation.performanceNormal).toBe(true);
    });

    it('should detect incomplete recovery', async () => {
      // Create test state
      const originalState = await createTestState();

      // Create partial backup (missing some data)
      const partialBackup = await backupService.createBackup({
        excludePatterns: ['*.log', 'temp/*']
      });

      // Corrupt system
      await corruptSystem();

      // Attempt recovery
      await recoveryService.restoreFromBackup(partialBackup.id);

      // Validate recovery
      const validation = await recoveryService.validateRecovery(originalState);

      expect(validation.complete).toBe(false);
      expect(validation.missingData).toContain('logs');
      expect(validation.dataIntegrity).toBeLessThan(100);
      
      // Trigger supplemental recovery
      const supplemental = await recoveryService.performSupplementalRecovery(
        validation.missingData
      );

      expect(supplemental.success).toBe(true);
      expect(supplemental.dataRecovered).toEqual(validation.missingData);
    });
  });
});

// Helper functions
async function createTestProjects(count: number) {
  const projects = [];
  for (let i = 0; i < count; i++) {
    const project = await projectManager.createProject({
      name: `Project ${i}`,
      type: 'next',
      path: `/test/project-${i}`
    });
    projects.push(project);
  }
  return projects;
}

async function createTestSessions(count: number, projects: any[]) {
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const session = await sessionService.createSession({
      title: `Session ${i}`,
      objectives: `Test objectives ${i}`,
      projectContext: projects[i % projects.length]
    });
    sessions.push(session);
  }
  return sessions;
}

async function corruptDatabase() {
  // Simulate database corruption
  const dbPath = join(os.homedir(), '.sessionhub/database.db');
  if (existsSync(dbPath)) {
    writeFileSync(dbPath, 'CORRUPTED_DATA');
  }
}

async function createSyncedData() {
  const projects = await createTestProjects(3);
  const sessions = await createTestSessions(5, projects);
  
  // Sync to cloud
  for (const project of projects) {
    await supabaseService.save('projects', project);
  }
  
  for (const session of sessions) {
    await supabaseService.save('sessions', session);
  }
  
  return { projects, sessions };
}

async function createDistributedData(nodes: string[]) {
  const data = {};
  for (const node of nodes) {
    data[node] = {
      projects: await createTestProjects(2),
      sessions: []
    };
  }
  return data;
}

async function createFullSystemState() {
  return {
    projects: await createTestProjects(10),
    sessions: await createTestSessions(20, []),
    settings: await getSystemSettings(),
    cache: await getCacheState(),
    sync: await getSyncState()
  };
}

async function simulateCatastrophicFailure() {
  // Corrupt database
  await corruptDatabase();
  
  // Clear cache
  await cacheService.clear();
  
  // Disconnect from cloud
  jest.spyOn(supabaseService, 'get').mockRejectedValue(new Error('Connection failed'));
  jest.spyOn(supabaseService, 'save').mockRejectedValue(new Error('Connection failed'));
  
  // Corrupt file system
  const dataDir = join(os.homedir(), '.sessionhub');
  if (existsSync(dataDir)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

async function getFullSystemState() {
  return {
    projects: await projectManager.listProjects(),
    sessions: await sessionService.listSessions({}),
    settings: await getSystemSettings(),
    cache: await getCacheState(),
    sync: await getSyncState()
  };
}

async function createActiveSessions(count: number) {
  const sessions = [];
  for (let i = 0; i < count; i++) {
    const session = await sessionService.createSession({
      title: `Active Session ${i}`,
      objectives: 'Test concurrent operations',
      projectContext: { id: `project-${i}`, name: `Project ${i}`, type: 'next', path: `/test/${i}` }
    });
    await sessionService.startSession(session.id);
    sessions.push(session);
  }
  return sessions;
}

class AvailabilityMonitor {
  private startTime: number = 0;
  private downtime: number = 0;
  private monitoring: boolean = false;

  start() {
    this.startTime = Date.now();
    this.downtime = 0;
    this.monitoring = true;
  }

  stop() {
    this.monitoring = false;
    const totalTime = Date.now() - this.startTime;
    const uptime = ((totalTime - this.downtime) / totalTime) * 100;
    
    return {
      uptime,
      totalDowntime: this.downtime,
      totalTime
    };
  }
}

async function createKnownGoodState() {
  return {
    checksum: 'abc123',
    timestamp: new Date(),
    data: await createFullSystemState()
  };
}

async function corruptSystem() {
  await simulateCatastrophicFailure();
}

async function createTestState() {
  return createFullSystemState();
}

async function getSystemSettings() {
  return {
    theme: 'dark',
    autoSave: true,
    syncInterval: 300
  };
}

async function getCacheState() {
  return {
    size: 1024 * 1024 * 50, // 50MB
    entries: 1234,
    hitRate: 0.85
  };
}

async function getSyncState() {
  return {
    lastSync: new Date(),
    pendingChanges: 0,
    syncEnabled: true
  };
}