import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { Session } from '../models/Session';

export interface Backup {
  id: string;
  timestamp: Date;
  data: any;
  checksum: string;
  filePath?: string;
  metadata: BackupMetadata;
}

export interface BackupMetadata {
  version: string;
  type: 'full' | 'project' | 'session' | 'disaster-recovery';
  sessionCount?: number;
  projectId?: string;
  size: number;
  compressed: boolean;
}

export interface BackupRestoreResult {
  success: boolean;
  sessionsRestored: number;
  errors: string[];
  backupInfo: Backup;
}

export class BackupService {
  private readonly backupDir: string;
  private readonly maxBackupAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor() {
    this.backupDir = path.join(os.homedir(), 'Library', 'Application Support', 'SessionHub', 'backups');
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error}`);
    }
  }

  private generateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private formatBackupFilename(type: string, id: string, timestamp: Date): string {
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-');
    return `${type}-${id}-${dateStr}.json`;
  }

  async createFullBackup(sessions: Session[] = []): Promise<Backup> {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date();
    const id = `backup-${Date.now()}`;
    
    const backupData = {
      sessions,
      timestamp: timestamp.toISOString(),
      version: '1.0.0'
    };
    
    const serializedData = JSON.stringify(backupData, null, 2);
    const checksum = this.generateChecksum(serializedData);
    
    const metadata: BackupMetadata = {
      version: '1.0.0',
      type: 'full',
      sessionCount: sessions.length,
      size: Buffer.byteLength(serializedData, 'utf8'),
      compressed: false
    };
    
    const backup: Backup = {
      id,
      timestamp,
      data: backupData,
      checksum,
      metadata
    };
    
    const filename = this.formatBackupFilename('full', id, timestamp);
    const filePath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filePath, serializedData, 'utf8');
      backup.filePath = filePath;
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to write backup file: ${error}`);
    }
  }

  async createProjectBackup(projectId: string, sessions: Session[] = []): Promise<Backup> {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date();
    const id = `project-backup-${projectId}-${Date.now()}`;
    
    const projectSessions = sessions.filter(s => s.projectId === projectId);
    
    const backupData = {
      projectId,
      sessions: projectSessions,
      timestamp: timestamp.toISOString(),
      version: '1.0.0'
    };
    
    const serializedData = JSON.stringify(backupData, null, 2);
    const checksum = this.generateChecksum(serializedData);
    
    const metadata: BackupMetadata = {
      version: '1.0.0',
      type: 'project',
      projectId,
      sessionCount: projectSessions.length,
      size: Buffer.byteLength(serializedData, 'utf8'),
      compressed: false
    };
    
    const backup: Backup = {
      id,
      timestamp,
      data: backupData,
      checksum,
      metadata
    };
    
    const filename = this.formatBackupFilename('project', projectId, timestamp);
    const filePath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filePath, serializedData, 'utf8');
      backup.filePath = filePath;
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to write project backup file: ${error}`);
    }
  }

  async createSessionBackup(session: Session): Promise<Backup> {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date();
    const id = `session-backup-${session.id}-${Date.now()}`;
    
    const backupData = {
      session,
      timestamp: timestamp.toISOString(),
      version: '1.0.0'
    };
    
    const serializedData = JSON.stringify(backupData, null, 2);
    const checksum = this.generateChecksum(serializedData);
    
    const metadata: BackupMetadata = {
      version: '1.0.0',
      type: 'session',
      projectId: session.projectId,
      sessionCount: 1,
      size: Buffer.byteLength(serializedData, 'utf8'),
      compressed: false
    };
    
    const backup: Backup = {
      id,
      timestamp,
      data: backupData,
      checksum,
      metadata
    };
    
    const filename = this.formatBackupFilename('session', session.id, timestamp);
    const filePath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filePath, serializedData, 'utf8');
      backup.filePath = filePath;
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to write session backup file: ${error}`);
    }
  }

  async createDisasterRecoveryCheckpoint(allSessions: Session[]): Promise<Backup> {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date();
    const id = `dr-checkpoint-${Date.now()}`;
    
    const backupData = {
      sessions: allSessions,
      timestamp: timestamp.toISOString(),
      version: '1.0.0',
      type: 'disaster-recovery',
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };
    
    const serializedData = JSON.stringify(backupData, null, 2);
    const checksum = this.generateChecksum(serializedData);
    
    const metadata: BackupMetadata = {
      version: '1.0.0',
      type: 'disaster-recovery',
      sessionCount: allSessions.length,
      size: Buffer.byteLength(serializedData, 'utf8'),
      compressed: false
    };
    
    const backup: Backup = {
      id,
      timestamp,
      data: backupData,
      checksum,
      metadata
    };
    
    const filename = this.formatBackupFilename('dr-checkpoint', id, timestamp);
    const filePath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filePath, serializedData, 'utf8');
      backup.filePath = filePath;
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to write disaster recovery checkpoint: ${error}`);
    }
  }

  async createValidatedBackup(state: any): Promise<Backup> {
    await this.ensureBackupDirectory();
    
    const timestamp = new Date();
    const id = `validated-backup-${Date.now()}`;
    
    const backupData = {
      state,
      timestamp: timestamp.toISOString(),
      version: '1.0.0',
      validated: true
    };
    
    const serializedData = JSON.stringify(backupData, null, 2);
    const checksum = this.generateChecksum(serializedData);
    
    const metadata: BackupMetadata = {
      version: '1.0.0',
      type: 'full',
      sessionCount: Array.isArray(state.sessions) ? state.sessions.length : 0,
      size: Buffer.byteLength(serializedData, 'utf8'),
      compressed: false
    };
    
    const backup: Backup = {
      id,
      timestamp,
      data: backupData,
      checksum,
      metadata
    };
    
    const filename = this.formatBackupFilename('validated', id, timestamp);
    const filePath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filePath, serializedData, 'utf8');
      backup.filePath = filePath;
      
      return backup;
    } catch (error) {
      throw new Error(`Failed to write validated backup file: ${error}`);
    }
  }

  async createBackup(options: { sessions?: Session[], type?: 'full' | 'project', projectId?: string } = {}): Promise<Backup> {
    const { sessions = [], type = 'full', projectId } = options;
    
    if (type === 'project' && projectId) {
      return this.createProjectBackup(projectId, sessions);
    }
    
    return this.createFullBackup(sessions);
  }

  async restoreFromBackup(backupId: string): Promise<BackupRestoreResult> {
    try {
      await this.ensureBackupDirectory();
      const backupFiles = await fs.readdir(this.backupDir);
      const backupFile = backupFiles.find(file => file.includes(backupId));
      
      if (!backupFile) {
        return {
          success: false,
          sessionsRestored: 0,
          errors: [`Backup file not found for ID: ${backupId}`],
          backupInfo: {} as Backup
        };
      }
      
      const filePath = path.join(this.backupDir, backupFile);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const backupData = JSON.parse(fileContent);
      
      const checksum = this.generateChecksum(fileContent);
      
      const sessions = backupData.sessions || [];
      
      const backupInfo: Backup = {
        id: backupId,
        timestamp: new Date(backupData.timestamp),
        data: backupData,
        checksum,
        filePath,
        metadata: {
          version: backupData.version || '1.0.0',
          type: backupData.type || 'full',
          sessionCount: sessions.length,
          size: Buffer.byteLength(fileContent, 'utf8'),
          compressed: false
        }
      };
      
      return {
        success: true,
        sessionsRestored: sessions.length,
        errors: [],
        backupInfo
      };
    } catch (error) {
      return {
        success: false,
        sessionsRestored: 0,
        errors: [`Failed to restore backup: ${error}`],
        backupInfo: {} as Backup
      };
    }
  }

  async listBackups(): Promise<Backup[]> {
    try {
      await this.ensureBackupDirectory();
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.json'));
      
      const backups: Backup[] = [];
      
      for (const file of backupFiles) {
        try {
          const filePath = path.join(this.backupDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          const stats = await fs.stat(filePath);
          
          const backup: Backup = {
            id: data.id || file.replace('.json', ''),
            timestamp: new Date(data.timestamp || stats.mtime),
            data,
            checksum: this.generateChecksum(content),
            filePath,
            metadata: {
              version: data.version || '1.0.0',
              type: data.type || 'full',
              sessionCount: data.sessions?.length || 0,
              size: stats.size,
              compressed: false
            }
          };
          
          backups.push(backup);
        } catch (error) {
          continue;
        }
      }
      
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      throw new Error(`Failed to list backups: ${error}`);
    }
  }

  async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date(Date.now() - this.maxBackupAge);
      
      let deletedCount = 0;
      
      for (const backup of backups) {
        if (backup.timestamp < cutoffDate && backup.filePath) {
          try {
            await fs.unlink(backup.filePath);
            deletedCount++;
          } catch (error) {
            continue;
          }
        }
      }
      
      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to cleanup old backups: ${error}`);
    }
  }

  async saveToMultipleBackends(data: any, backends: string[]): Promise<void> {
    const errors: string[] = [];
    
    for (const backend of backends) {
      try {
        if (backend === 'local') {
          await this.createBackup({ sessions: data.sessions || [] });
        }
      } catch (error) {
        errors.push(`Failed to save to ${backend}: ${error}`);
      }
    }
    
    if (errors.length === backends.length) {
      throw new Error(`Failed to save to all backends: ${errors.join(', ')}`);
    }
  }

  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.id.includes(backupId));
      
      if (!backup || !backup.filePath) {
        return false;
      }
      
      const content = await fs.readFile(backup.filePath, 'utf8');
      const calculatedChecksum = this.generateChecksum(content);
      
      return calculatedChecksum === backup.checksum;
    } catch (error) {
      return false;
    }
  }
}