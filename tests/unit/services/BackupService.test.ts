import { BackupService, Backup, BackupRestoreResult } from '../../../src/services/BackupService';
import { Session } from '../../../src/models/Session';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const mockSession: Session = {
  id: 'test-session-1',
  name: 'Test Session',
  description: 'A test session for backup validation',
  status: 'completed',
  createdAt: '2025-06-11T00:00:00.000Z',
  updatedAt: '2025-06-11T01:00:00.000Z',
  completedAt: '2025-06-11T01:00:00.000Z',
  userId: 'test-user',
  projectId: 'test-project',
  request: {
    id: 'req-1',
    sessionId: 'test-session-1',
    userId: 'test-user',
    content: 'Test request content',
    context: {},
    timestamp: '2025-06-11T00:00:00.000Z'
  },
  metadata: {
    tags: ['test'],
    environment: 'test'
  }
};

describe('BackupService', () => {
  let backupService: BackupService;
  let testBackupDir: string;

  beforeEach(() => {
    backupService = new BackupService();
    testBackupDir = path.join(os.homedir(), 'Library', 'Application Support', 'SessionHub', 'backups');
  });

  afterEach(async () => {
    try {
      await fs.mkdir(testBackupDir, { recursive: true });
      const files = await fs.readdir(testBackupDir);
      for (const file of files) {
        if (file.includes('test') || file.includes('backup-') || file.includes('session-') || file.includes('project-') || file.includes('dr-') || file.includes('validated-')) {
          try {
            await fs.unlink(path.join(testBackupDir, file));
          } catch (unlinkError) {
            // File might not exist
          }
        }
      }
    } catch (error) {
      // Directory might not exist or files might not exist
    }
  });

  describe('createFullBackup', () => {
    it('should create a full backup with sessions', async () => {
      const sessions = [mockSession];
      const backup = await backupService.createFullBackup(sessions);

      expect(backup.id).toMatch(/^backup-\d+$/);
      expect(backup.metadata.type).toBe('full');
      expect(backup.metadata.sessionCount).toBe(1);
      expect(backup.data.sessions).toEqual(sessions);
      expect(backup.filePath).toBeDefined();
      expect(backup.checksum).toBeDefined();
    });

    it('should create a backup file on disk', async () => {
      const sessions = [mockSession];
      const backup = await backupService.createFullBackup(sessions);

      expect(backup.filePath).toBeDefined();
      
      let fileExists = false;
      try {
        await fs.access(backup.filePath!);
        fileExists = true;
      } catch (error) {
        fileExists = false;
      }
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(backup.filePath!, 'utf8');
      const parsedContent = JSON.parse(fileContent);
      expect(parsedContent.sessions).toEqual(sessions);
    });
  });

  describe('createProjectBackup', () => {
    it('should create a project backup with filtered sessions', async () => {
      const sessions = [
        mockSession,
        { ...mockSession, id: 'session-2', projectId: 'other-project' }
      ];
      
      const backup = await backupService.createProjectBackup('test-project', sessions);

      expect(backup.metadata.type).toBe('project');
      expect(backup.metadata.projectId).toBe('test-project');
      expect(backup.metadata.sessionCount).toBe(1);
      expect(backup.data.sessions).toHaveLength(1);
      expect(backup.data.sessions[0].projectId).toBe('test-project');
    });
  });

  describe('createSessionBackup', () => {
    it('should create a single session backup', async () => {
      const backup = await backupService.createSessionBackup(mockSession);

      expect(backup.metadata.type).toBe('session');
      expect(backup.metadata.sessionCount).toBe(1);
      expect(backup.data.session).toEqual(mockSession);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore sessions from a backup', async () => {
      const sessions = [mockSession];
      const originalBackup = await backupService.createFullBackup(sessions);
      
      const restoreResult = await backupService.restoreFromBackup(originalBackup.id);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.sessionsRestored).toBe(1);
      expect(restoreResult.errors).toHaveLength(0);
      expect(restoreResult.backupInfo.data.sessions).toEqual(sessions);
    });

    it('should handle missing backup files', async () => {
      const restoreResult = await backupService.restoreFromBackup('nonexistent-backup');

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.sessionsRestored).toBe(0);
      expect(restoreResult.errors).toContain('Backup file not found for ID: nonexistent-backup');
    });
  });

  describe('listBackups', () => {
    it('should list all available backups', async () => {
      const sessions = [mockSession];
      const backup1 = await backupService.createFullBackup(sessions);
      const backup2 = await backupService.createProjectBackup('test-project', sessions);

      const backups = await backupService.listBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
      
      const backupIds = backups.map(b => b.id);
      expect(backupIds).toContain(backup1.id);
      expect(backupIds).toContain(backup2.id);
    });
  });

  describe('verifyBackupIntegrity', () => {
    it('should verify backup integrity correctly', async () => {
      const sessions = [mockSession];
      const backup = await backupService.createFullBackup(sessions);

      const isValid = await backupService.verifyBackupIntegrity(backup.id);
      expect(isValid).toBe(true);
    });

    it('should return false for nonexistent backups', async () => {
      const isValid = await backupService.verifyBackupIntegrity('nonexistent-backup');
      expect(isValid).toBe(false);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should not delete recent backups', async () => {
      const sessions = [mockSession];
      await backupService.createFullBackup(sessions);

      const deletedCount = await backupService.cleanupOldBackups();
      expect(deletedCount).toBe(0);
    });
  });

  describe('createDisasterRecoveryCheckpoint', () => {
    it('should create disaster recovery checkpoint with system info', async () => {
      const sessions = [mockSession];
      const backup = await backupService.createDisasterRecoveryCheckpoint(sessions);

      expect(backup.metadata.type).toBe('disaster-recovery');
      expect(backup.data.type).toBe('disaster-recovery');
      expect(backup.data.systemInfo).toBeDefined();
      expect(backup.data.systemInfo.platform).toBeDefined();
      expect(backup.data.systemInfo.arch).toBeDefined();
      expect(backup.data.systemInfo.nodeVersion).toBeDefined();
    });
  });
});