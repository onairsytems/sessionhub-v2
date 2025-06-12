import { app, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface DevLinkInfo {
  projectPath: string;
  linkedAt: string;
  version: string;
}

export class UpdateChecker {
  private static instance: UpdateChecker;
  private devLinkPath: string;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.devLinkPath = path.join(app.getPath('exe'), '..', '..', '.dev-linked');
  }

  static getInstance(): UpdateChecker {
    if (!UpdateChecker.instance) {
      UpdateChecker.instance = new UpdateChecker();
    }
    return UpdateChecker.instance;
  }

  isDevLinked(): boolean {
    try {
      return fs.existsSync(this.devLinkPath);
    } catch {
      return false;
    }
  }

  getDevLinkInfo(): DevLinkInfo | null {
    try {
      if (this.isDevLinked()) {
        const content = fs.readFileSync(this.devLinkPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
// REMOVED: console statement
    }
    return null;
  }

  async checkForUpdates(window: BrowserWindow): Promise<void> {
    if (!this.isDevLinked()) {
      return;
    }

    const linkInfo = this.getDevLinkInfo();
    if (!linkInfo) {
      return;
    }

    try {
      // Check if the source project has been updated
      const sourcePackageJson = path.join(linkInfo.projectPath, 'package.json');
      if (!fs.existsSync(sourcePackageJson)) {
// REMOVED: console statement
        return;
      }

      const sourcePackage = JSON.parse(fs.readFileSync(sourcePackageJson, 'utf-8'));
      
      // Check if versions differ
      if (sourcePackage.version !== linkInfo.version) {
        this.notifyUpdateAvailable(window, linkInfo.version, sourcePackage.version);
      }

      // Check build timestamp
      const distPath = path.join(linkInfo.projectPath, 'dist-electron', 'mac-universal', 'SessionHub.app');
      if (fs.existsSync(distPath)) {
        const distStats = fs.statSync(distPath);
        const linkStats = fs.statSync(this.devLinkPath);
        
        if (distStats.mtime > linkStats.mtime) {
          this.notifyUpdateAvailable(window, 'build', 'newer build');
        }
      }
    } catch (error) {
// REMOVED: console statement
    }
  }

  private async notifyUpdateAvailable(
    window: BrowserWindow,
    currentVersion: string,
    newVersion: string
  ): Promise<void> {
    const response = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version of SessionHub is available!',
      detail: `Current: ${currentVersion}\nAvailable: ${newVersion}\n\nWould you like to update now?`,
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      // Trigger update
      await this.performUpdate(window);
    }
  }

  private async performUpdate(window: BrowserWindow): Promise<void> {
    const linkInfo = this.getDevLinkInfo();
    if (!linkInfo) {
      return;
    }

    try {
      // Show progress
      window.webContents.send('update-status', { status: 'updating', message: 'Updating SessionHub...' });

      // Run the deploy script
      const { exec } = require('child_process');
      
      exec(`cd "${linkInfo.projectPath}" && npm run deploy:quick`, (error: any) => {
        if (error) {
// REMOVED: console statement
          dialog.showErrorBox('Update Failed', 'Failed to update SessionHub. Please update manually.');
          return;
        }

        // Restart the app
        dialog.showMessageBox(window, {
          type: 'info',
          title: 'Update Complete',
          message: 'SessionHub has been updated successfully!',
          detail: 'The application will now restart.',
          buttons: ['OK']
        }).then(() => {
          app.relaunch();
          app.exit(0);
        });
      });
    } catch (error) {
// REMOVED: console statement
      dialog.showErrorBox('Update Failed', 'Failed to update SessionHub. Please update manually.');
    }
  }

  startAutoCheck(window: BrowserWindow, intervalMinutes: number = 30): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Initial check
    this.checkForUpdates(window);

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdates(window);
    }, intervalMinutes * 60 * 1000);
  }

  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}