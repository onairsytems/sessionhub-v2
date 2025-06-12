/**
 * @actor system
 * @responsibility IPC handlers for recovery operations
 */

import { ipcMain } from 'electron';
import { Logger } from '../../src/lib/logging/Logger';
import { AuditLogger } from '../../src/lib/logging/AuditLogger';
import { BackupService } from '../../src/services/BackupService';
import { IncrementalBackupService } from '../../src/services/autosave/IncrementalBackupService';
import { ChangeDetectionService } from '../../src/services/autosave/ChangeDetectionService';
import { PointInTimeRecoveryService, RecoveryOptions } from '../../src/services/recovery/PointInTimeRecoveryService';
import { EmergencyRecoveryMode } from '../../src/services/recovery/EmergencyRecoveryMode';
import { BackupHealthMonitor } from '../../src/services/monitoring/BackupHealthMonitor';
import { RecoveryLogger, RecoveryLogQuery } from '../../src/services/recovery/RecoveryLogger';
import * as path from 'path';
import * as os from 'os';

let recoveryService: PointInTimeRecoveryService;
let emergencyRecovery: EmergencyRecoveryMode;
let healthMonitor: BackupHealthMonitor;
let recoveryLogger: RecoveryLogger;

export function registerRecoveryHandlers(): void {
  const logger = new Logger('RecoveryService');
  const auditLogger = new AuditLogger(logger);
  const backupService = new BackupService();
  const changeDetection = new ChangeDetectionService(logger);
  const incrementalBackup = new IncrementalBackupService(
    logger,
    auditLogger,
    changeDetection
  );

  // Initialize services
  recoveryService = new PointInTimeRecoveryService(
    logger,
    auditLogger,
    backupService,
    incrementalBackup
  );

  emergencyRecovery = new EmergencyRecoveryMode(
    logger,
    auditLogger,
    recoveryService,
    backupService
  );

  const backupDirs = [
    path.join(os.homedir(), 'Library', 'Application Support', 'SessionHub', 'backups'),
    path.join(process.cwd(), 'data', 'backups'),
    path.join(process.cwd(), 'data', 'incremental-backups')
  ];

  healthMonitor = new BackupHealthMonitor(
    logger,
    auditLogger,
    backupDirs
  );

  recoveryLogger = new RecoveryLogger(logger);

  // Start backup health monitoring
  healthMonitor.startMonitoring().catch(error => {
    logger.error('Failed to start backup health monitoring', error);
  });

  /**
   * Get available recovery points
   */
  ipcMain.handle('recovery:getRecoveryPoints', async () => {
    try {
      const points = await recoveryService.scanForRecoveryPoints();
      
      await recoveryLogger.log({
        type: 'recovery-started',
        severity: 'info',
        action: 'Scanning for recovery points',
        details: { filesAffected: points.length },
        outcome: 'success'
      });

      return points;
    } catch (error) {
      await recoveryLogger.log({
        type: 'recovery-failed',
        severity: 'error',
        action: 'Failed to scan recovery points',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Perform point-in-time recovery
   */
  ipcMain.handle('recovery:recoverToPoint', async (_event, options: RecoveryOptions) => {
    try {
      const result = await recoveryService.recoverToPoint(options);
      
      await recoveryLogger.log({
        type: 'recovery-completed',
        severity: result.success ? 'info' : 'error',
        action: 'Point-in-time recovery',
        details: {
          recoveryPointId: result.recoveryPoint?.id,
          integrityScore: result.metadata.dataIntegrityScore,
          repairsAttempted: result.metadata.repairsAttempted,
          repairsSuccessful: result.metadata.repairsSuccessful,
          warningCount: result.warnings.length,
          errorCount: result.errors.length
        },
        outcome: result.success ? 'success' : 'failure',
        duration: result.metadata.recoveryDuration,
        errorMessage: result.errors.join('; ')
      });

      return result;
    } catch (error) {
      await recoveryLogger.log({
        type: 'recovery-failed',
        severity: 'critical',
        action: 'Point-in-time recovery failed',
        details: options as any,
        outcome: 'failure',
        errorMessage: (error as Error).message,
        stackTrace: (error as Error).stack
      });
      throw error;
    }
  });

  /**
   * Detect corruption
   */
  ipcMain.handle('recovery:detectCorruption', async () => {
    try {
      const report = await recoveryService.detectCorruption();
      
      await recoveryLogger.log({
        type: 'corruption-detected',
        severity: report.severity === 'critical' ? 'critical' : 
                  report.severity === 'high' ? 'error' : 
                  report.severity === 'medium' ? 'warning' : 'info',
        action: 'Corruption detection scan',
        details: {
          filesAffected: report.corruptedFiles.length,
          repairsAttempted: report.repairableFiles.length
        },
        outcome: report.corruptedFiles.length === 0 ? 'success' : 'partial'
      });

      return report;
    } catch (error) {
      await recoveryLogger.log({
        type: 'integrity-check',
        severity: 'error',
        action: 'Corruption detection failed',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Attempt automatic recovery
   */
  ipcMain.handle('recovery:attemptAutoRecovery', async (_event, sessionId?: string) => {
    try {
      const result = await recoveryService.attemptAutoRecovery(sessionId);
      
      await recoveryLogger.log({
        type: 'auto-repair-completed',
        severity: result.success ? 'info' : 'warning',
        action: 'Automatic recovery attempt',
        details: {
          sessionId,
          integrityScore: result.metadata.dataIntegrityScore,
          repairsAttempted: result.metadata.repairsAttempted,
          repairsSuccessful: result.metadata.repairsSuccessful
        },
        outcome: result.success ? 'success' : 'failure',
        duration: result.metadata.recoveryDuration
      });

      return result;
    } catch (error) {
      await recoveryLogger.log({
        type: 'auto-repair-attempted',
        severity: 'error',
        action: 'Automatic recovery failed',
        details: { sessionId },
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Create recovery checkpoint
   */
  ipcMain.handle('recovery:createCheckpoint', async (_event, data: any, description: string) => {
    try {
      const checkpoint = await recoveryService.createRecoveryCheckpoint(data, description);
      
      await recoveryLogger.log({
        type: 'checkpoint-created',
        severity: 'info',
        action: 'Recovery checkpoint created',
        details: {
          recoveryPointId: checkpoint.id,
          dataSize: checkpoint.size
        },
        outcome: 'success'
      });

      return checkpoint;
    } catch (error) {
      await recoveryLogger.log({
        type: 'checkpoint-created',
        severity: 'error',
        action: 'Failed to create recovery checkpoint',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Check startup health
   */
  ipcMain.handle('recovery:checkStartupHealth', async () => {
    try {
      const healthy = await emergencyRecovery.checkStartupHealth();
      
      if (!healthy) {
        await recoveryLogger.log({
          type: 'emergency-mode-entered',
          severity: 'warning',
          action: 'Startup health check failed',
          details: {},
          outcome: 'failure'
        });
      }

      return healthy;
    } catch (error) {
      await recoveryLogger.log({
        type: 'health-check',
        severity: 'error',
        action: 'Startup health check error',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Enter emergency recovery mode
   */
  ipcMain.handle('recovery:enterEmergencyMode', async (_event, options: any) => {
    try {
      const result = await emergencyRecovery.enterEmergencyMode(options);
      
      await recoveryLogger.log({
        type: result.mode === 'factory-reset' ? 'factory-reset-performed' : 'safe-mode-activated',
        severity: result.success ? 'warning' : 'critical',
        action: `Entered ${result.mode} mode`,
        details: {
          filesAffected: result.recoveredSessions,
          dataSize: 0,
          warningCount: result.warnings.length,
          errorCount: result.errors.length,
          metadata: { dataLoss: result.dataLoss, mode: result.mode }
        },
        outcome: result.success ? 'success' : 'failure',
        duration: result.recoveryDuration
      });

      return result;
    } catch (error) {
      await recoveryLogger.log({
        type: 'emergency-mode-entered',
        severity: 'critical',
        action: 'Failed to enter emergency mode',
        details: options,
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Exit emergency recovery mode
   */
  ipcMain.handle('recovery:exitEmergencyMode', async () => {
    try {
      await emergencyRecovery.exitEmergencyMode();
      
      await recoveryLogger.log({
        type: 'emergency-mode-exited',
        severity: 'info',
        action: 'Exited emergency recovery mode',
        details: {},
        outcome: 'success'
      });

      return true;
    } catch (error) {
      await recoveryLogger.log({
        type: 'emergency-mode-exited',
        severity: 'error',
        action: 'Failed to exit emergency mode',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Get safe mode configuration
   */
  ipcMain.handle('recovery:getSafeModeConfig', async () => {
    try {
      return await emergencyRecovery.getSafeModeConfig();
    } catch (error) {
      throw error;
    }
  });

  /**
   * Get backup health status
   */
  ipcMain.handle('recovery:getHealthStatus', async () => {
    try {
      const status = healthMonitor.getHealthStatus();
      
      if (status && !status.healthy) {
        await recoveryLogger.log({
          type: 'health-check',
          severity: 'warning',
          action: 'Backup health check',
          details: {
            filesAffected: status.corruptedBackups,
            warningCount: status.issues.length
          },
          outcome: 'partial'
        });
      }

      return status;
    } catch (error) {
      throw error;
    }
  });

  /**
   * Force health check
   */
  ipcMain.handle('recovery:checkHealthNow', async () => {
    try {
      const status = await healthMonitor.checkNow();
      
      await recoveryLogger.log({
        type: 'health-check',
        severity: status.healthy ? 'info' : 'warning',
        action: 'Manual health check performed',
        details: {
          filesAffected: status.totalBackups,
          warningCount: status.issues.length
        },
        outcome: status.healthy ? 'success' : 'partial'
      });

      return status;
    } catch (error) {
      await recoveryLogger.log({
        type: 'health-check',
        severity: 'error',
        action: 'Manual health check failed',
        details: {},
        outcome: 'failure',
        errorMessage: (error as Error).message
      });
      throw error;
    }
  });

  /**
   * Query recovery logs
   */
  ipcMain.handle('recovery:queryLogs', async (_event, query: RecoveryLogQuery) => {
    try {
      return await recoveryLogger.query(query);
    } catch (error) {
      throw error;
    }
  });

  /**
   * Get recovery log summary
   */
  ipcMain.handle('recovery:getLogSummary', async (_event, startDate?: Date, endDate?: Date) => {
    try {
      return await recoveryLogger.getSummary(startDate, endDate);
    } catch (error) {
      throw error;
    }
  });

  /**
   * Export recovery logs
   */
  ipcMain.handle('recovery:exportLogs', async (_event, outputPath: string, query?: RecoveryLogQuery, format?: 'json' | 'csv') => {
    try {
      await recoveryLogger.exportLogs(outputPath, query, format);
      return true;
    } catch (error) {
      throw error;
    }
  });

  /**
   * Clean up old recovery logs
   */
  ipcMain.handle('recovery:cleanupLogs', async (_event, daysToKeep: number) => {
    try {
      await recoveryLogger.cleanup(daysToKeep);
      return true;
    } catch (error) {
      throw error;
    }
  });

  // Clean up on app quit
  process.on('beforeExit', () => {
    healthMonitor.stopMonitoring();
    recoveryLogger.stop();
  });
}