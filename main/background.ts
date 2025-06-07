
/**
 * Electron Main Process - Background Service
 * Handles app lifecycle, window management, and system integration
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import isDev from 'electron-is-dev';
import serve from 'electron-serve';

// Import SessionHub services
import { productionMonitor } from '../src/services/production/ProductionMonitor';
import { selfDevelopmentProduction } from '../src/services/production/SelfDevelopmentProduction';
import { PRODUCTION_CONFIG } from '../src/config/production.config';

// Configure auto-updater for production
if (!isDev) {
  serve({ directory: 'app' });
  autoUpdater.checkForUpdatesAndNotify();
}

class SessionHubApp {
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // Enable live reload for development
    if (isDev) {
      require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
      });
    }

    // App event handlers
    app.whenReady().then(() => this.onReady());
    app.on('window-all-closed', () => this.onWindowAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.onBeforeQuit());

    // Security: Prevent new window creation
    app.on('web-contents-created', (_event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url)
        return { action: 'deny' };
      });
    });

    // Configure auto-updater
    this.setupAutoUpdater();
  }

  private async onReady(): Promise<void> {
    console.log('🚀 SessionHub starting...');

    // Set app security
    this.setSecurityDefaults();

    // Create application menu
    this.createMenu();

    // Create main window
    await this.createMainWindow();

    // Initialize SessionHub services
    this.initializeServices();

    // Show startup notification
    this.showStartupNotification();

    console.log('✅ SessionHub ready');
  }

  private onWindowAllClosed(): void {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      void app.quit();
    }
  }

  private onActivate(): void {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createMainWindow();
    }
  }

  private onBeforeQuit(): void {
    this.isQuitting = true;
  }

  private setSecurityDefaults(): void {
    // Set secure defaults
    app.setAboutPanelOptions({
      applicationName: 'SessionHub',
      applicationVersion: '1.0.0',
      version: '1.0.0',
      copyright: '© 2025 SessionHub Team',
      authors: ['SessionHub Development Team'],
      website: 'https://sessionhub.com',
      iconPath: path.join(__dirname, '../resources/icon.png')
    });
  }

  private async createMainWindow(): Promise<void> {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      show: false,
      icon: path.join(__dirname, '../resources/icon.png'),
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Load the application
    if (isDev) {
      await this.mainWindow.loadURL('http://localhost:3000');
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadURL('app://./index.html');
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        void this.mainWindow.show()
        
        // Focus on the window
        if (isDev) {
          this.mainWindow.webContents.openDevTools();
        }
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window close (hide instead of quit on macOS)
    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin' && !this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'New Session',
            accelerator: 'CmdOrCtrl+N',
            click: () => voidthis.newSession()
          },
          { type: 'separator' },
          { role: 'close' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => voidshell.openExternal('https://sessionhub.com/docs')
          },
          {
            label: 'Support',
            click: () => voidshell.openExternal('https://sessionhub.com/support')
          },
          { type: 'separator' },
          {
            label: 'System Health',
            click: () => voidthis.showSystemHealth()
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private initializeServices(): void {
    console.log('🔧 Initializing SessionHub services...');

    // Start production monitoring
    productionMonitor.performHealthChecks();
    
    // Initialize self-development system
    const selfDevStatus = selfDevelopmentProduction.getSelfDevelopmentStatus();
    console.log('🤖 Self-development status:', selfDevStatus.operational ? 'OPERATIONAL' : 'OFFLINE');

    // Set up IPC handlers
    this.setupIpcHandlers();

    console.log('✅ SessionHub services initialized');
  }

  private setupIpcHandlers(): void {
    // System health check
    ipcMain.handle('get-system-health', async () => {
      return await productionMonitor.performHealthChecks();
    });

    // Self-development status
    ipcMain.handle('get-self-development-status', () => {
      return selfDevelopmentProduction.getSelfDevelopmentStatus();
    });

    // Trigger test issue (for demo purposes)
    ipcMain.handle('trigger-test-issue', async () => {
      await selfDevelopmentProduction.triggerTestIssue();
      return { success: true, message: 'Test issue triggered' };
    });

    // Get production metrics
    ipcMain.handle('get-production-metrics', () => {
      return productionMonitor.getMetricsSummary();
    });
  }

  private setupAutoUpdater(): void {
    if (isDev) return;

    // Configure auto-updater
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: PRODUCTION_CONFIG.deployment.autoUpdater.updateServer
    });

    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('📦 Update available:', info.version);
      this.showUpdateNotification('Update available', `Version ${info.version} is ready to download.`);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('✅ SessionHub is up to date');
    });

    autoUpdater.on('error', (err) => {
      console.error('❌ Auto-updater error:', err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      console.log(`📥 Download progress: ${percent}%`);
    });

    autoUpdater.on('update-downloaded', () => {
      console.log('✅ Update downloaded');
      this.showUpdateNotification('Update ready', 'Restart SessionHub to apply the update.');
    });
  }

  private showStartupNotification(): void {
    if (Notification.isSupported()) {
      new Notification({
        title: 'SessionHub Ready',
        body: 'AI-powered development platform is now running',
        icon: path.join(__dirname, '../resources/icon.png')
      }).show();
    }
  }

  private showUpdateNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(__dirname, '../resources/icon.png')
      }).show();
    }
  }

  private newSession(): void {
    // Send message to renderer to create new session
    this.mainWindow?.webContents.send('new-session');
  }

  private async showSystemHealth(): Promise<void> {
    const health = await productionMonitor.performHealthChecks();
    const message = `SessionHub Status: ${health.status.toUpperCase()}\n\nUptime: ${Math.round(health.uptime / 1000)}s\nChecks passed: ${health.checks.filter(c => c.status === 'pass').length}/${health.checks.length}`;
    
    void dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'System Health',
      message,
      buttons: ['OK']
    })
  }
}

// Initialize SessionHub
new SessionHubApp();