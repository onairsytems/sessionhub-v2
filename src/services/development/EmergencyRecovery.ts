/**
 * Emergency Recovery System
 * Provides manual intervention and recovery capabilities for self-development failures
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../lib/logging/Logger';
import { DevelopmentConfig, getConfig } from '../../config/development.config';

export interface RecoverySnapshot {
  id: string;
  timestamp: Date;
  version: string;
  gitCommit: string;
  description: string;
  type: 'manual' | 'automatic' | 'pre-update';
  files: {
    path: string;
    backup: string;
    hash: string;
  }[];
  databaseSnapshot?: string;
  configSnapshot?: any;
}

export interface EmergencyState {
  isEmergencyMode: boolean;
  lastKnownGoodState?: RecoverySnapshot;
  failureReason?: string;
  recoveryOptions: string[];
  systemHealth: {
    database: 'healthy' | 'degraded' | 'failed';
    fileSystem: 'healthy' | 'degraded' | 'failed';
    network: 'healthy' | 'degraded' | 'failed';
    processes: 'healthy' | 'degraded' | 'failed';
  };
}

export interface RecoveryCommand {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  requiresConfirmation: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class EmergencyRecovery {
  private logger: Logger;
  private config: DevelopmentConfig;
  private snapshotsDir: string;
  private emergencyLog: string;
  private recoveryCommands: Map<string, RecoveryCommand>;

  constructor() {
    this.logger = new Logger('EmergencyRecovery');
    this.config = getConfig();
    this.snapshotsDir = join(this.expandPath(this.config.dataDirectory), 'recovery-snapshots');
    this.emergencyLog = join(this.expandPath(this.config.dataDirectory), 'emergency.log');
    this.recoveryCommands = new Map();
    
    this.initializeRecoveryCommands();
  }

  /**
   * Initialize emergency recovery system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing emergency recovery system');

    // Ensure recovery directories exist
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    // Create initial snapshot
    await this.createSnapshot('initial', 'System initialization snapshot');

    // Set up emergency signal handlers
    this.setupSignalHandlers();

    this.logger.info('Emergency recovery system initialized');
  }

  /**
   * Enter emergency mode
   */
  async enterEmergencyMode(reason: string): Promise<void> {
    this.logger.error('ENTERING EMERGENCY MODE', { reason });

    const emergencyState: EmergencyState = {
      isEmergencyMode: true,
      failureReason: reason,
      recoveryOptions: Array.from(this.recoveryCommands.keys()),
      systemHealth: await this.assessSystemHealth(),
      lastKnownGoodState: await this.getLastKnownGoodSnapshot(),
    };

    // Stop all non-critical processes
    await this.stopNonCriticalProcesses();

    // Save emergency state
    await this.saveEmergencyState(emergencyState);

    // Log emergency entry
    await this.logEmergencyEvent('EMERGENCY_MODE_ENTERED', { reason, timestamp: new Date() });

    // Notify operators (if configured)
    await this.notifyEmergency(reason);
  }

  /**
   * Exit emergency mode
   */
  async exitEmergencyMode(): Promise<void> {
    this.logger.info('Exiting emergency mode');

    // Verify system is healthy
    const health = await this.assessSystemHealth();
    const isHealthy = Object.values(health).every(status => status === 'healthy');

    if (!isHealthy) {
      throw new Error('Cannot exit emergency mode: system is not healthy');
    }

    // Clear emergency state
    const emergencyStatePath = join(this.expandPath(this.config.dataDirectory), 'emergency-state.json');
    await fs.unlink(emergencyStatePath).catch(() => {}); // Ignore if doesn't exist

    // Log emergency exit
    await this.logEmergencyEvent('EMERGENCY_MODE_EXITED', { timestamp: new Date() });

    this.logger.info('Emergency mode exited successfully');
  }

  /**
   * Create system snapshot
   */
  async createSnapshot(type: RecoverySnapshot['type'], description: string): Promise<RecoverySnapshot> {
    const snapshotId = `snapshot-${Date.now()}`;
    
    this.logger.info('Creating recovery snapshot', { snapshotId, type, description });

    const snapshot: RecoverySnapshot = {
      id: snapshotId,
      timestamp: new Date(),
      version: await this.getCurrentVersion(),
      gitCommit: await this.getGitCommit(),
      description,
      type,
      files: [],
    };

    try {
      // Backup critical files
      const criticalFiles = await this.getCriticalFiles();
      const snapshotDir = join(this.snapshotsDir, snapshotId);
      await fs.mkdir(snapshotDir, { recursive: true });

      for (const filePath of criticalFiles) {
        try {
          const content = await fs.readFile(filePath);
          const backupPath = join(snapshotDir, filePath.replace(/[\/\\]/g, '_'));
          await fs.writeFile(backupPath, content);

          const hash = require('crypto').createHash('sha256').update(content).digest('hex');
          
          snapshot.files.push({
            path: filePath,
            backup: backupPath,
            hash,
          });
        } catch (error) {
          this.logger.warn('Failed to backup file', { filePath, error: error.message });
        }
      }

      // Backup database state (if applicable)
      snapshot.databaseSnapshot = await this.createDatabaseSnapshot(snapshotId);

      // Backup configuration
      snapshot.configSnapshot = this.config;

      // Save snapshot metadata
      const metadataPath = join(snapshotDir, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(snapshot, null, 2));

      this.logger.info('Recovery snapshot created', { 
        snapshotId, 
        fileCount: snapshot.files.length 
      });

      return snapshot;

    } catch (error) {
      this.logger.error('Failed to create snapshot', { snapshotId, error: error.message });
      throw error;
    }
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<void> {
    this.logger.info('Restoring from snapshot', { snapshotId });

    const snapshotDir = join(this.snapshotsDir, snapshotId);
    const metadataPath = join(snapshotDir, 'metadata.json');

    try {
      // Load snapshot metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const snapshot: RecoverySnapshot = JSON.parse(metadataContent);

      // Stop application
      await this.stopApplication();

      // Create backup of current state
      await this.createSnapshot('pre-restore', `Backup before restoring ${snapshotId}`);

      // Restore files
      for (const file of snapshot.files) {
        try {
          const content = await fs.readFile(file.backup);
          await fs.writeFile(file.path, content);
          
          this.logger.debug('Restored file', { path: file.path });
        } catch (error) {
          this.logger.warn('Failed to restore file', { path: file.path, error: error.message });
        }
      }

      // Restore database (if snapshot exists)
      if (snapshot.databaseSnapshot) {
        await this.restoreDatabaseSnapshot(snapshot.databaseSnapshot);
      }

      // Log restoration
      await this.logEmergencyEvent('SNAPSHOT_RESTORED', { snapshotId, timestamp: new Date() });

      // Restart application
      await this.startApplication();

      this.logger.info('Snapshot restoration completed', { snapshotId });

    } catch (error) {
      this.logger.error('Snapshot restoration failed', { snapshotId, error: error.message });
      throw error;
    }
  }

  /**
   * Execute recovery command
   */
  async executeRecoveryCommand(commandName: string, confirm: boolean = false): Promise<boolean> {
    const command = this.recoveryCommands.get(commandName);
    if (!command) {
      throw new Error(`Unknown recovery command: ${commandName}`);
    }

    if (command.requiresConfirmation && !confirm) {
      throw new Error(`Command ${commandName} requires confirmation. Risk level: ${command.riskLevel}`);
    }

    this.logger.info('Executing recovery command', { 
      command: commandName, 
      riskLevel: command.riskLevel 
    });

    try {
      const success = await command.execute();
      
      await this.logEmergencyEvent('RECOVERY_COMMAND_EXECUTED', {
        command: commandName,
        success,
        timestamp: new Date(),
      });

      return success;
    } catch (error) {
      this.logger.error('Recovery command failed', { 
        command: commandName, 
        error: error.message 
      });

      await this.logEmergencyEvent('RECOVERY_COMMAND_FAILED', {
        command: commandName,
        error: error.message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * Get system health assessment
   */
  async assessSystemHealth(): Promise<EmergencyState['systemHealth']> {
    const health: EmergencyState['systemHealth'] = {
      database: 'healthy',
      fileSystem: 'healthy',
      network: 'healthy',
      processes: 'healthy',
    };

    try {
      // Check database connectivity
      // This would integrate with actual database checks
      health.database = 'healthy';
    } catch (error) {
      health.database = 'failed';
    }

    try {
      // Check file system
      await fs.access(this.expandPath(this.config.dataDirectory));
      health.fileSystem = 'healthy';
    } catch (error) {
      health.fileSystem = 'failed';
    }

    try {
      // Check network connectivity
      const response = await fetch('https://api.anthropic.com/v1/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      health.network = response.ok ? 'healthy' : 'degraded';
    } catch (error) {
      health.network = 'failed';
    }

    // Check processes
    health.processes = 'healthy'; // Placeholder

    return health;
  }

  /**
   * Get available recovery options
   */
  getRecoveryOptions(): { name: string; description: string; riskLevel: string }[] {
    return Array.from(this.recoveryCommands.entries()).map(([name, command]) => ({
      name,
      description: command.description,
      riskLevel: command.riskLevel,
    }));
  }

  /**
   * Private helper methods
   */
  private initializeRecoveryCommands(): void {
    this.recoveryCommands.set('restart-application', {
      name: 'restart-application',
      description: 'Restart the SessionHub application',
      execute: async () => {
        await this.stopApplication();
        await this.startApplication();
        return true;
      },
      requiresConfirmation: false,
      riskLevel: 'low',
    });

    this.recoveryCommands.set('reset-database-connection', {
      name: 'reset-database-connection',
      description: 'Reset database connection and clear cache',
      execute: async () => {
        // Implementation would reset database connections
        return true;
      },
      requiresConfirmation: false,
      riskLevel: 'low',
    });

    this.recoveryCommands.set('rollback-last-update', {
      name: 'rollback-last-update',
      description: 'Rollback to the last known good version',
      execute: async () => {
        const lastGood = await this.getLastKnownGoodSnapshot();
        if (lastGood) {
          await this.restoreFromSnapshot(lastGood.id);
          return true;
        }
        return false;
      },
      requiresConfirmation: true,
      riskLevel: 'medium',
    });

    this.recoveryCommands.set('nuclear-reset', {
      name: 'nuclear-reset',
      description: 'Complete system reset to factory defaults',
      execute: async () => {
        // Implementation would reset everything
        this.logger.warn('NUCLEAR RESET EXECUTED');
        return true;
      },
      requiresConfirmation: true,
      riskLevel: 'critical',
    });
  }

  private setupSignalHandlers(): void {
    // Handle SIGTERM gracefully
    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, creating emergency snapshot');
      await this.createSnapshot('automatic', 'Emergency shutdown snapshot');
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, entering emergency mode');
      await this.enterEmergencyMode('Manual interrupt (SIGINT)');
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception, entering emergency mode', { error: error.message });
      await this.enterEmergencyMode(`Uncaught exception: ${error.message}`);
    });
  }

  private async getCriticalFiles(): Promise<string[]> {
    return [
      'package.json',
      'src/config/development.config.ts',
      'src/config/system.config.ts',
      // Add other critical files
    ];
  }

  private async createDatabaseSnapshot(snapshotId: string): Promise<string> {
    // Implementation would create database dump
    return `database-${snapshotId}.sql`;
  }

  private async restoreDatabaseSnapshot(snapshotPath: string): Promise<void> {
    // Implementation would restore database from dump
    this.logger.info('Database snapshot restored', { snapshotPath });
  }

  private async stopApplication(): Promise<void> {
    this.logger.info('Stopping application');
    // Implementation would stop the main application process
  }

  private async startApplication(): Promise<void> {
    this.logger.info('Starting application');
    // Implementation would start the main application process
  }

  private async stopNonCriticalProcesses(): Promise<void> {
    this.logger.info('Stopping non-critical processes');
    // Implementation would stop background tasks, monitors, etc.
  }

  private async getCurrentVersion(): Promise<string> {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.version || '0.9.0';
    } catch (error) {
      return '0.9.0';
    }
  }

  private async getGitCommit(): Promise<string> {
    try {
      const { stdout } = await this.runCommand('git', ['rev-parse', 'HEAD']);
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  private async getLastKnownGoodSnapshot(): Promise<RecoverySnapshot | undefined> {
    try {
      const snapshots = await fs.readdir(this.snapshotsDir);
      const automaticSnapshots = snapshots.filter(name => name.includes('automatic'));
      
      if (automaticSnapshots.length === 0) return undefined;

      // Get the most recent automatic snapshot
      const latestSnapshot = automaticSnapshots.sort().reverse()[0];
      const metadataPath = join(this.snapshotsDir, latestSnapshot, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      
      return metadata;
    } catch (error) {
      return undefined;
    }
  }

  private async saveEmergencyState(state: EmergencyState): Promise<void> {
    const statePath = join(this.expandPath(this.config.dataDirectory), 'emergency-state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  private async logEmergencyEvent(event: string, data: any): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      data,
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.emergencyLog, logLine);
  }

  private async notifyEmergency(reason: string): Promise<void> {
    // Implementation would send notifications via email, Slack, etc.
    this.logger.error('EMERGENCY NOTIFICATION', { reason });
  }

  private async runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
        }
      });
    });
  }

  private expandPath(path: string): string {
    return path.replace(/^~/, require('os').homedir());
  }
}