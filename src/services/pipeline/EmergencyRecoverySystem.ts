import { app, dialog, shell } from 'electron';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { createHash } from 'crypto';
import { SelfDevelopmentAuditor } from '../development/SelfDevelopmentAuditor';
export class EmergencyRecoverySystem {
  private static instance: EmergencyRecoverySystem;
  private recoveryPath: string;
  private auditor: SelfDevelopmentAuditor;
  private isInRecoveryMode: boolean = false;
  private constructor() {
    this.recoveryPath = path.join(app.getPath('userData'), 'recovery');
    this.auditor = new SelfDevelopmentAuditor();
    this.ensureRecoveryDirectory();
  }
  static getInstance(): EmergencyRecoverySystem {
    if (!EmergencyRecoverySystem.instance) {
      EmergencyRecoverySystem.instance = new EmergencyRecoverySystem();
    }
    return EmergencyRecoverySystem.instance;
  }
  private ensureRecoveryDirectory(): void {
    if (!existsSync(this.recoveryPath)) {
      execSync(`mkdir -p "${this.recoveryPath}"`);
    }
  }
  async checkAndRecover(): Promise<boolean> {
    try {
      // Check if app crashed on last run
      const crashMarker = path.join(this.recoveryPath, '.crash_marker');
      const hasCrashed = existsSync(crashMarker);
      if (hasCrashed) {
        await this.auditor.logEvent({
          type: 'emergency_mode_entered',
          actor: 'system',
          action: 'crash_detected',
          target: 'recovery_system',
          details: {
            crashMarker: true,
          },
          risk: 'critical',
          context: {}
        });
        // Show recovery dialog
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'SessionHub Recovery',
          message: 'SessionHub didn\'t shut down properly. Would you like to recover?',
          buttons: ['Recover', 'Reset to Factory', 'Continue Anyway'],
          defaultId: 0,
          cancelId: 2,
        });
        switch (result.response) {
          case 0: // Recover
            return await this.performRecovery();
          case 1: // Reset to Factory
            return await this.factoryReset();
          case 2: // Continue Anyway
            this.clearCrashMarker();
            return true;
        }
      }
      // Set crash marker for next run
      this.setCrashMarker();
      return true;
    } catch (error) {
      await this.auditor.logEvent({
        type: 'recovery' as any,
        actor: 'system',
        action: 'check_failed',
        target: 'system',
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
      return false;
    }
  }
  private async performRecovery(): Promise<boolean> {
    this.isInRecoveryMode = true;
    try {
      const steps = [
        { name: 'Validate Installation', fn: () => this.validateInstallation() },
        { name: 'Check Dependencies', fn: () => this.checkDependencies() },
        { name: 'Restore Configuration', fn: () => this.restoreConfiguration() },
        { name: 'Clear Cache', fn: () => this.clearCache() },
        { name: 'Repair Database', fn: () => this.repairDatabase() },
      ];
      const results: any[] = [];
      for (const step of steps) {
        try {
          const result = await step.fn();
          results.push({ step: step.name, success: true, result });
        } catch (error) {
          results.push({ step: step.name, success: false, error: (error as Error).message });
        }
      }
      const allSuccess = results.every(r => r.success);
      await this.auditor.logEvent({
        type: 'recovery' as any,
        actor: 'system',
        action: 'completed',
        target: 'system',
        details: {
        success: allSuccess,
        },
        risk: 'low',
        context: {}
      });
      if (allSuccess) {
        this.clearCrashMarker();
        dialog.showMessageBox({
          type: 'info',
          title: 'Recovery Complete',
          message: 'SessionHub has been successfully recovered.',
          buttons: ['OK'],
        });
      } else {
        const failedSteps = results.filter(r => !r.success).map(r => r.step);
        dialog.showMessageBox({
          type: 'warning',
          title: 'Partial Recovery',
          message: `Recovery completed with errors in: ${failedSteps.join(', ')}`,
          buttons: ['OK'],
        });
      }
      return allSuccess;
    } finally {
      this.isInRecoveryMode = false;
    }
  }
  private async validateInstallation(): Promise<void> {
    const requiredFiles = [
      'package.json',
      'main/background.js',
      'renderer/index.html',
    ];
    const appPath = app.getAppPath();
    for (const file of requiredFiles) {
      const filePath = path.join(appPath, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    // Verify checksums if available
    const checksumFile = path.join(this.recoveryPath, 'checksums.json');
    if (existsSync(checksumFile)) {
      const checksums = JSON.parse(readFileSync(checksumFile, 'utf-8'));
      for (const [file, expectedChecksum] of Object.entries(checksums)) {
        const filePath = path.join(appPath, file);
        if (existsSync(filePath)) {
          const actualChecksum = this.calculateChecksum(filePath);
          if (actualChecksum !== expectedChecksum) {
          }
        }
      }
    }
  }
  private async checkDependencies(): Promise<void> {
    try {
      // Check node modules
      const nodeModulesPath = path.join(app.getAppPath(), 'node_modules');
      if (!existsSync(nodeModulesPath)) {
        execSync('npm install', { cwd: app.getAppPath() });
      }
      // Verify critical dependencies
      const criticalDeps = ['electron', 'react', 'next'];
      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!existsSync(depPath)) {
          throw new Error(`Critical dependency missing: ${dep}`);
        }
      }
    } catch (error) {
      throw new Error(`Dependency check failed: ${(error as Error).message}`);
    }
  }
  private async restoreConfiguration(): Promise<void> {
    const configBackup = path.join(this.recoveryPath, 'config.backup.json');
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (existsSync(configBackup)) {
      try {
        const backup = readFileSync(configBackup, 'utf-8');
        writeFileSync(configPath, backup);
      } catch (error) {
      }
    }
    // Create default config if none exists
    if (!existsSync(configPath)) {
      const defaultConfig = {
        version: app.getVersion(),
        theme: 'system',
        autoUpdate: true,
        telemetry: false,
      };
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    }
  }
  private async clearCache(): Promise<void> {
    const cacheDirectories = [
      path.join(app.getPath('userData'), 'Cache'),
      path.join(app.getPath('userData'), 'GPUCache'),
      path.join(app.getPath('userData'), 'Code Cache'),
    ];
    for (const dir of cacheDirectories) {
      if (existsSync(dir)) {
        try {
          execSync(`rm -rf "${dir}"`);
        } catch (error) {
        }
      }
    }
  }
  private async repairDatabase(): Promise<void> {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
    if (existsSync(dbPath)) {
      try {
        // Create backup
        const backupPath = path.join(this.recoveryPath, `database.backup.${Date.now()}.sqlite`);
        execSync(`cp "${dbPath}" "${backupPath}"`);
        // Run integrity check
        execSync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`, { encoding: 'utf-8' });
        // Vacuum database
        execSync(`sqlite3 "${dbPath}" "VACUUM;"`, { encoding: 'utf-8' });
      } catch (error) {
        // Create new database if repair fails
        execSync(`rm -f "${dbPath}"`);
      }
    }
  }
  private async factoryReset(): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Factory Reset',
      message: 'This will delete all user data and settings. Are you sure?',
      buttons: ['Cancel', 'Reset'],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response === 1) {
      try {
        // Backup important data first
        await this.createEmergencyBackup();
        // Clear user data
        const userDataPath = app.getPath('userData');
        const itemsToKeep = ['recovery', 'logs'];
        const items = execSync(`ls "${userDataPath}"`, { encoding: 'utf-8' }).split('\n').filter(Boolean);
        for (const item of items) {
          if (!itemsToKeep.includes(item)) {
            execSync(`rm -rf "${path.join(userDataPath, item)}"`);
          }
        }
        await this.auditor.logEvent({
        type: 'recovery' as any,
        actor: 'system',
        action: 'factory_reset',
        target: 'system',
        details: {
        timestamp: new Date().toISOString(),
        },
        risk: 'low',
        context: {}
      });
        dialog.showMessageBox({
          type: 'info',
          title: 'Reset Complete',
          message: 'Factory reset completed. Please restart SessionHub.',
          buttons: ['OK'],
        });
        app.quit();
        return true;
      } catch (error) {
        dialog.showErrorBox('Reset Failed', `Factory reset failed: ${(error as Error).message}`);
        return false;
      }
    }
    return false;
  }
  private async createEmergencyBackup(): Promise<void> {
    const backupDir = path.join(this.recoveryPath, 'emergency_backup', Date.now().toString());
    execSync(`mkdir -p "${backupDir}"`);
    const itemsToBackup = [
      'config.json',
      'database.sqlite',
      'credentials.encrypted',
    ];
    for (const item of itemsToBackup) {
      const sourcePath = path.join(app.getPath('userData'), item);
      if (existsSync(sourcePath)) {
        const destPath = path.join(backupDir, item);
        execSync(`cp "${sourcePath}" "${destPath}"`);
      }
    }
  }
  async createRecoveryCheckpoint(): Promise<void> {
    try {
      // Backup current configuration
      const configPath = path.join(app.getPath('userData'), 'config.json');
      if (existsSync(configPath)) {
        const backupPath = path.join(this.recoveryPath, 'config.backup.json');
        execSync(`cp "${configPath}" "${backupPath}"`);
      }
      // Create checksums of critical files
      const checksums: Record<string, string> = {};
      const criticalFiles = ['package.json', 'main/background.js'];
      for (const file of criticalFiles) {
        const filePath = path.join(app.getAppPath(), file);
        if (existsSync(filePath)) {
          checksums[file] = this.calculateChecksum(filePath);
        }
      }
      writeFileSync(
        path.join(this.recoveryPath, 'checksums.json'),
        JSON.stringify(checksums, null, 2)
      );
      await this.auditor.logEvent({
        type: 'recovery' as any,
        actor: 'system',
        action: 'checkpoint_created',
        target: 'system',
        details: {
        filesBackedUp: Object.keys(checksums).length,
        },
        risk: 'low',
        context: {}
      });
    } catch (error) {
    }
  }
  private calculateChecksum(filePath: string): string {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  }
  private setCrashMarker(): void {
    const crashMarker = path.join(this.recoveryPath, '.crash_marker');
    writeFileSync(crashMarker, new Date().toISOString());
  }
  clearCrashMarker(): void {
    const crashMarker = path.join(this.recoveryPath, '.crash_marker');
    if (existsSync(crashMarker)) {
      execSync(`rm -f "${crashMarker}"`);
    }
  }
  isRecovering(): boolean {
    return this.isInRecoveryMode;
  }
  async openRecoveryConsole(): Promise<void> {
    const recoveryUrl = `file://${path.join(app.getAppPath(), 'recovery.html')}`;
    await shell.openExternal(recoveryUrl);
  }
}