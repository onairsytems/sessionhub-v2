/**
 * Auto-Update Service
 * Handles automatic updates with background downloads and user notifications
 */

import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { dialog, BrowserWindow, Notification } from 'electron';
import * as path from 'path';
import isDev from 'electron-is-dev';
import { EventEmitter } from 'events';

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: Error | null;
  progress: ProgressInfo | null;
  updateInfo: UpdateInfo | null;
}

export class AutoUpdateService extends EventEmitter {
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: null,
    updateInfo: null
  };

  private mainWindow: BrowserWindow | null = null;
  private isInitialized = false;
  private updateCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupAutoUpdater();
  }

  /**
   * Initialize the auto-update service
   */
  public initialize(mainWindow: BrowserWindow): void {
    if (isDev || this.isInitialized) return;

    this.mainWindow = mainWindow;
    this.isInitialized = true;

    // Configure auto-updater
    autoUpdater.autoDownload = false; // We'll control downloads manually
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    // Set update feed URL
    const feedURL = process.env['UPDATE_SERVER_URL'] || 'https://update.sessionhub.com';
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedURL,
      channel: 'stable'
    });

    // Check for updates on startup
    this.checkForUpdates();

    // Set up periodic update checks (every 4 hours)
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }

  /**
   * Manually check for updates
   */
  public async checkForUpdates(): Promise<void> {
    if (isDev || this.status.checking || this.status.downloading) return;

    try {
      this.status.checking = true;
      this.emit('checking-for-update');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.handleError(error as Error);
    } finally {
      this.status.checking = false;
    }
  }

  /**
   * Download the available update
   */
  public async downloadUpdate(): Promise<void> {
    if (!this.status.available || this.status.downloading || this.status.downloaded) return;

    try {
      this.status.downloading = true;
      this.emit('download-started');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.handleError(error as Error);
      this.status.downloading = false;
    }
  }

  /**
   * Install the downloaded update and restart
   */
  public quitAndInstall(): void {
    if (!this.status.downloaded) return;

    // Save app state before quitting
    this.emit('before-quit-for-update');

    // Quit and install
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Get current update status
   */
  public getStatus(): UpdateStatus {
    return { ...this.status };
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    this.removeAllListeners();
  }

  private setupAutoUpdater(): void {
    // Update checking
    autoUpdater.on('checking-for-update', () => {
      this.status.checking = true;
      this.emit('checking-for-update');
    });

    // Update available
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.status.checking = false;
      this.status.available = true;
      this.status.updateInfo = info;
      this.emit('update-available', info);
      
      // Show notification
      this.showUpdateAvailableNotification(info);
      
      // Send to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-available', info);
      }
    });

    // No update available
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.status.checking = false;
      this.status.available = false;
      this.emit('update-not-available', info);
    });

    // Download progress
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.status.progress = progress;
      this.emit('download-progress', progress);
      
      // Send progress to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('download-progress', progress);
      }
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.status.downloading = false;
      this.status.downloaded = true;
      this.status.updateInfo = info;
      this.emit('update-downloaded', info);
      
      // Show notification
      this.showUpdateReadyNotification(info);
      
      // Send to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('update-downloaded', info);
      }
    });

    // Error handling
    autoUpdater.on('error', (error: Error) => {
      this.handleError(error);
    });
  }

  private showUpdateAvailableNotification(info: UpdateInfo): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: 'Update Available',
      body: `SessionHub ${info.version} is available. Click to download.`,
      icon: path.join(__dirname, '../../resources/icon.png'),
      actions: [
        { type: 'button', text: 'Download' },
        { type: 'button', text: 'Later' }
      ]
    });

    notification.on('click', () => {
      this.downloadUpdate();
    });

    notification.on('action', (_event, index) => {
      if (index === 0) {
        this.downloadUpdate();
      } else {
        // User postponed update
      }
    });

    notification.show();
  }

  private showUpdateReadyNotification(info: UpdateInfo): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    const dialogOpts = {
      type: 'info' as const,
      buttons: ['Restart Now', 'Later'],
      title: 'Application Update',
      message: `SessionHub ${info.version} has been downloaded`,
      detail: 'The update will be installed when you restart the application. Would you like to restart now?',
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, dialogOpts).then((result) => {
      if (result.response === 0) {
        this.quitAndInstall();
      }
    });
  }

  private handleError(error: Error): void {
    this.status.error = error;
    this.status.checking = false;
    this.status.downloading = false;
    this.emit('error', error);

    // Log error but don't show to user unless critical
    if (error.message.includes('net::') || error.message.includes('ENOTFOUND')) {
      // Network errors - silent fail
      return;
    }

    // Show error notification for other errors
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Update Error',
        body: 'Failed to check for updates. Please try again later.',
        icon: path.join(__dirname, '../../resources/icon.png')
      });
      notification.show();
    }
  }
}

// Export singleton instance
export const autoUpdateService = new AutoUpdateService();