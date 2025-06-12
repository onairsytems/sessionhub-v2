/**
 * @actor system
 * @responsibility Emergency recovery mode for startup when primary data is corrupted
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { PointInTimeRecoveryService } from './PointInTimeRecoveryService';
import { BackupService } from '../BackupService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface EmergencyRecoveryOptions {
  skipUserPrompt?: boolean;
  autoSelectLatest?: boolean;
  maxRecoveryAttempts?: number;
  fallbackToFactoryReset?: boolean;
}

export interface EmergencyRecoveryResult {
  success: boolean;
  mode: 'normal' | 'safe' | 'minimal' | 'factory-reset';
  recoveredSessions: number;
  dataLoss: boolean;
  warnings: string[];
  errors: string[];
  recoveryDuration: number;
}

export interface SafeModeConfig {
  disablePlugins: boolean;
  disableCloudSync: boolean;
  disableAutoSave: boolean;
  readOnlyMode: boolean;
  minimalUI: boolean;
}

export class EmergencyRecoveryMode {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly recoveryService: PointInTimeRecoveryService;
  private readonly configPath: string;
  private readonly safeModeConfigPath: string;
  private isInEmergencyMode = false;
  private recoveryAttempts = 0;

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    recoveryService: PointInTimeRecoveryService,
    _backupService: BackupService
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.recoveryService = recoveryService;
    
    this.configPath = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'SessionHub',
      'config.json'
    );
    
    this.safeModeConfigPath = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'SessionHub',
      'safe-mode.json'
    );
  }

  /**
   * Check if emergency recovery is needed on startup
   */
  async checkStartupHealth(): Promise<boolean> {
    try {
      // Check if safe mode flag exists
      const safeModeExists = await this.checkSafeModeFlag();
      if (safeModeExists) {
        this.logger.warn('Safe mode flag detected - entering emergency recovery');
        return false;
      }

      // Check primary config file
      const configHealthy = await this.checkConfigHealth();
      if (!configHealthy) {
        this.logger.error('Primary configuration corrupted');
        return false;
      }

      // Check database integrity
      const dbHealthy = await this.checkDatabaseHealth();
      if (!dbHealthy) {
        this.logger.error('Database integrity check failed');
        return false;
      }

      // Check for crash flags
      const crashDetected = await this.checkCrashFlags();
      if (crashDetected) {
        this.logger.warn('Previous crash detected');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Startup health check failed', error as Error);
      return false;
    }
  }

  /**
   * Enter emergency recovery mode
   */
  async enterEmergencyMode(options: EmergencyRecoveryOptions = {}): Promise<EmergencyRecoveryResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    
    this.isInEmergencyMode = true;
    this.recoveryAttempts++;

    try {
      this.logger.warn('Entering emergency recovery mode', {
        attempt: this.recoveryAttempts,
        options
      });

      // Create safe mode flag
      await this.createSafeModeFlag();

      // Detect corruption severity
      const corruptionReport = await this.recoveryService.detectCorruption();
      const severity = corruptionReport.severity;

      this.logger.info('Corruption assessment complete', {
        severity,
        corruptedFiles: corruptionReport.corruptedFiles.length,
        repairableFiles: corruptionReport.repairableFiles.length
      });

      // Determine recovery strategy based on severity
      let recoveryResult;
      let mode: 'normal' | 'safe' | 'minimal' | 'factory-reset' = 'safe';

      if (severity === 'low' || severity === 'medium') {
        // Attempt normal recovery
        recoveryResult = await this.attemptNormalRecovery(options);
        if (recoveryResult.success) {
          mode = 'normal';
        }
      }

      if (!recoveryResult?.success && severity !== 'critical') {
        // Fall back to safe mode recovery
        recoveryResult = await this.attemptSafeModeRecovery(options);
        if (recoveryResult.success) {
          mode = 'safe';
          warnings.push('Application will start in safe mode with limited functionality');
        }
      }

      if (!recoveryResult?.success) {
        // Fall back to minimal recovery
        recoveryResult = await this.attemptMinimalRecovery(options);
        if (recoveryResult.success) {
          mode = 'minimal';
          warnings.push('Application will start with minimal functionality');
        }
      }

      if (!recoveryResult?.success && options.fallbackToFactoryReset) {
        // Last resort: factory reset
        recoveryResult = await this.performFactoryReset();
        mode = 'factory-reset';
        warnings.push('All user data has been reset to factory defaults');
      }

      if (!recoveryResult?.success) {
        throw new Error('All recovery attempts failed');
      }

      // Log recovery event
      await this.auditLogger.log({
        action: 'emergency_recovery',
        actorType: 'system',
        actorId: 'emergency-recovery',
        details: {
          mode,
          severity,
          recoveryAttempts: this.recoveryAttempts,
          duration: Date.now() - startTime,
          dataLoss: mode === 'factory-reset'
        }
      });

      return {
        success: true,
        mode,
        recoveredSessions: recoveryResult.recoveredData?.sessions?.length || 0,
        dataLoss: mode === 'factory-reset',
        warnings,
        errors,
        recoveryDuration: Date.now() - startTime
      };

    } catch (error) {
      this.logger.error('Emergency recovery failed', error as Error);
      errors.push((error as Error).message);

      return {
        success: false,
        mode: 'minimal',
        recoveredSessions: 0,
        dataLoss: true,
        warnings,
        errors,
        recoveryDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Exit emergency recovery mode
   */
  async exitEmergencyMode(): Promise<void> {
    if (!this.isInEmergencyMode) {
      return;
    }

    try {
      // Remove safe mode flag
      await this.removeSafeModeFlag();
      
      // Clear recovery attempts counter
      this.recoveryAttempts = 0;
      
      // Create recovery checkpoint
      await this.recoveryService.createRecoveryCheckpoint(
        { timestamp: new Date(), mode: 'normal' },
        'Emergency recovery completed successfully'
      );

      this.isInEmergencyMode = false;
      this.logger.info('Exited emergency recovery mode');
    } catch (error) {
      this.logger.error('Failed to exit emergency mode cleanly', error as Error);
    }
  }

  /**
   * Get safe mode configuration
   */
  async getSafeModeConfig(): Promise<SafeModeConfig> {
    try {
      const config = await fs.readFile(this.safeModeConfigPath, 'utf8');
      return JSON.parse(config);
    } catch {
      // Return default safe mode config
      return {
        disablePlugins: true,
        disableCloudSync: true,
        disableAutoSave: false,
        readOnlyMode: false,
        minimalUI: false
      };
    }
  }

  /**
   * Private helper methods
   */
  private async checkSafeModeFlag(): Promise<boolean> {
    try {
      await fs.access(path.join(os.tmpdir(), 'sessionhub-safe-mode.flag'));
      return true;
    } catch {
      return false;
    }
  }

  private async createSafeModeFlag(): Promise<void> {
    await fs.writeFile(
      path.join(os.tmpdir(), 'sessionhub-safe-mode.flag'),
      JSON.stringify({ timestamp: new Date(), pid: process.pid })
    );
  }

  private async removeSafeModeFlag(): Promise<void> {
    try {
      await fs.unlink(path.join(os.tmpdir(), 'sessionhub-safe-mode.flag'));
    } catch {
      // Ignore if doesn't exist
    }
  }

  private async checkConfigHealth(): Promise<boolean> {
    try {
      const config = await fs.readFile(this.configPath, 'utf8');
      JSON.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // Check if database file exists and is not corrupted
      const dbPath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'SessionHub',
        'database.sqlite'
      );
      
      const stats = await fs.stat(dbPath);
      return stats.size > 0;
    } catch {
      return false;
    }
  }

  private async checkCrashFlags(): Promise<boolean> {
    try {
      const crashFlagPath = path.join(os.tmpdir(), 'sessionhub-crash.flag');
      await fs.access(crashFlagPath);
      
      // Remove old crash flag
      await fs.unlink(crashFlagPath);
      return true;
    } catch {
      return false;
    }
  }

  private async attemptNormalRecovery(_options: EmergencyRecoveryOptions): Promise<any> {
    this.logger.info('Attempting normal recovery');
    
    return await this.recoveryService.recoverToPoint({
      skipCorrupted: true,
      attemptAutoRepair: true,
      mergePartialSaves: true
    });
  }

  private async attemptSafeModeRecovery(_options: EmergencyRecoveryOptions): Promise<any> {
    this.logger.info('Attempting safe mode recovery');
    
    // Create safe mode configuration
    const safeModeConfig: SafeModeConfig = {
      disablePlugins: true,
      disableCloudSync: true,
      disableAutoSave: false,
      readOnlyMode: false,
      minimalUI: false
    };

    await fs.writeFile(
      this.safeModeConfigPath,
      JSON.stringify(safeModeConfig, null, 2)
    );

    // Attempt recovery with limited functionality
    return await this.recoveryService.recoverToPoint({
      skipCorrupted: true,
      attemptAutoRepair: true,
      mergePartialSaves: false
    });
  }

  private async attemptMinimalRecovery(_options: EmergencyRecoveryOptions): Promise<any> {
    this.logger.info('Attempting minimal recovery');
    
    // Create minimal mode configuration
    const minimalConfig: SafeModeConfig = {
      disablePlugins: true,
      disableCloudSync: true,
      disableAutoSave: true,
      readOnlyMode: true,
      minimalUI: true
    };

    await fs.writeFile(
      this.safeModeConfigPath,
      JSON.stringify(minimalConfig, null, 2)
    );

    // Create minimal startup data
    return {
      success: true,
      recoveredData: {
        sessions: [],
        config: {
          version: '1.0.0',
          minimalMode: true
        }
      }
    };
  }

  private async performFactoryReset(): Promise<any> {
    this.logger.warn('Performing factory reset');
    
    try {
      // Backup current data before reset
      const backupPath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'SessionHub',
        'pre-reset-backup'
      );
      
      await fs.mkdir(backupPath, { recursive: true });
      
      // Move existing data to backup
      const dataFiles = ['database.sqlite', 'config.json', 'sessions.json'];
      for (const file of dataFiles) {
        try {
          await fs.rename(
            path.join(os.homedir(), 'Library', 'Application Support', 'SessionHub', file),
            path.join(backupPath, `${file}.${Date.now()}.backup`)
          );
        } catch {
          // File might not exist
        }
      }

      // Create fresh configuration
      const defaultConfig = {
        version: '1.0.0',
        firstRun: true,
        resetAt: new Date().toISOString()
      };

      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));

      return {
        success: true,
        recoveredData: {
          sessions: [],
          config: defaultConfig
        }
      };
    } catch (error) {
      this.logger.error('Factory reset failed', error as Error);
      return { success: false };
    }
  }
}