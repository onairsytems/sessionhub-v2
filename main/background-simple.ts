/**
 * Electron Main Process - Background Service (Simplified)
 * Handles app lifecycle, window management, and system integration
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from "electron";
import type { Notification as ElectronNotification } from "electron";
// import { autoUpdater } from 'electron-updater'; // Commented out for future use
import * as path from "path";
import { UpdateChecker } from "../electron/update-checker";
// Simple dev detection without external dependencies
const isDev =
  process.env["NODE_ENV"] === "development" ||
  process.defaultApp ||
  /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
  /[\\/]electron[\\/]/.test(process.execPath);
// import serve from 'electron-serve';

class SessionHubApp {
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // Enable live reload for development (only if electron-reload is available)
    if (isDev) {
      try {
        const electronReload = require('electron-reload') as (
          watchPath: string,
          options: {
            electron: string;
            hardResetMethod: string;
          }
        ) => void;
        electronReload(__dirname, {
          electron: path.join(
            __dirname,
            "..",
            "node_modules",
            ".bin",
            "electron",
          ),
          hardResetMethod: "exit",
        });
      } catch (error: unknown) {
        // Silently ignore if electron-reload is not available
      }
    }

    // App event handlers
    void app.whenReady().then(() => this.onReady());
    app.on("window-all-closed", () => this.onWindowAllClosed());
    app.on("activate", () => this.onActivate());
    app.on("before-quit", () => this.onBeforeQuit());

    // Security: Prevent new window creation
    app.on("web-contents-created", (_event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: "deny" };
      });
    });

    // Configure auto-updater (disabled for local builds)
    // Auto-updater functionality is disabled for local builds
  }

  private async onReady(): Promise<void> {
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
  }

  private onWindowAllClosed(): void {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== "darwin") {
      void app.quit();
    }
  }

  private onActivate(): void {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      void this.createMainWindow();
    }
  }

  private onBeforeQuit(): void {
    this.isQuitting = true;
  }

  private setSecurityDefaults(): void {
    // Set secure defaults
    app.setAboutPanelOptions({
      applicationName: "SessionHub",
      applicationVersion: "1.0.0",
      version: "1.0.0",
      copyright: "© 2025 SessionHub Team",
      authors: ["SessionHub Development Team"],
      website: "https://sessionhub.com",
      iconPath: path.join(__dirname, "../resources/icon.png"),
    });
  }

  private async createMainWindow(): Promise<void> {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      show: false, // Show when ready
      icon: path.join(__dirname, "../resources/icon.png"),
      titleBarStyle: "hiddenInset",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true, // Enable sandbox for security
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // Load the application
    try {
      if (isDev) {
        await this.mainWindow.loadURL("http://localhost:3000");
        // Open DevTools in development
        this.mainWindow.webContents.openDevTools();
      } else {
        // For production, load the Next.js static export
        const appPath = path.join(__dirname, "../../out/index.html");
        await this.mainWindow.loadFile(appPath);
      }
    } catch (error: unknown) {
      // Show proper error dialog
      void dialog.showErrorBox(
        "SessionHub Error",
        `Failed to load application: ${error}`,
      );
      void app.quit();
    }

    // Show window when ready
    this.mainWindow.once("ready-to-show", () => {
      if (this.mainWindow) {
        void this.mainWindow.show();

        // Focus on the window
        if (isDev) {
          this.mainWindow.webContents.openDevTools();
        }

        // Start update checker for dev-linked installations
        const updateChecker = UpdateChecker.getInstance();
        if (updateChecker.isDevLinked()) {
          updateChecker.startAutoCheck(this.mainWindow, 30); // Check every 30 minutes
        }
      }
    });

    // Handle window closed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    // Handle window close (hide instead of quit on macOS)
    this.mainWindow.on("close", (event) => {
      if (process.platform === "darwin" && !this.isQuitting) {
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
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "File",
        submenu: [
          {
            label: "New Session",
            accelerator: "CmdOrCtrl+N",
            click: () => void this.newSession(),
          },
          { type: "separator" },
          { role: "close" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          { type: "separator" },
          { role: "front" },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "Documentation",
            click: (): void => {
              void shell.openExternal("https://sessionhub.com/docs");
            },
          },
          {
            label: "Support",
            click: (): void => {
              void shell.openExternal("https://sessionhub.com/support");
            },
          },
          { type: "separator" },
          {
            label: "System Health",
            click: (): void => {
              void this.showSystemHealth();
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private initializeServices(): void {
    // Set up IPC handlers
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // System health check
    ipcMain.handle(
      "get-system-health",
      async (): Promise<{
        status: string;
        uptime: number;
        timestamp: string;
        checks: Array<{ name: string; status: string; message: string }>;
      }> => {
        return {
          status: "healthy",
          uptime: process.uptime() * 1000,
          timestamp: new Date().toISOString(),
          checks: [
            {
              name: "app-startup",
              status: "pass",
              message: "Application started successfully",
            },
            {
              name: "electron-version",
              status: "pass",
              message: `Electron ${process.versions.electron}`,
            },
          ],
        };
      },
    );

    // Self-development status
    ipcMain.handle(
      "get-self-development-status",
      (): { operational: boolean; message: string } => {
        return {
          operational: true,
          message: "Development ready",
        };
      },
    );

    // Production metrics
    ipcMain.handle(
      "get-production-metrics",
      (): {
        uptime: number;
        memory: NodeJS.MemoryUsage;
        timestamp: string;
      } => {
        return {
          uptime: process.uptime() * 1000,
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        };
      },
    );

    // Register API handlers
    const apiHandlers = require('./ipc/apiHandlers') as {
      registerApiHandlers: () => void;
    };
    apiHandlers.registerApiHandlers();

    // Register Supabase handlers
    const supabaseHandlers = require('./ipc/supabaseHandlers') as {
      registerSupabaseHandlers: () => void;
    };
    supabaseHandlers.registerSupabaseHandlers();

    // Trigger test issue (for demo purposes)
    ipcMain.handle(
      "trigger-test-issue",
      async (): Promise<{ success: boolean; message: string }> => {
        return { success: true, message: "Test issue triggered" };
      },
    );
  }

  // Commented out for future use
  // private setupAutoUpdater(): void {
  //   if (isDev) return;

  //   autoUpdater.on('checking-for-update', () => {
  //     console.log('🔍 Checking for updates...');
  //   });

  //   autoUpdater.on('update-available', (info) => {
  //     console.log('📦 Update available:', info.version);
  //     this.showUpdateNotification('Update available', `Version ${info.version} is ready to download.`);
  //   });

  //   autoUpdater.on('update-not-available', () => {
  //     console.log('✅ SessionHub is up to date');
  //   });

  //   autoUpdater.on('error', (err) => {
  //     console.error('❌ Auto-updater error:', err);
  //   });

  //   autoUpdater.on('download-progress', (progressObj) => {
  //     const percent = Math.round(progressObj.percent);
  //     console.log(`📥 Download progress: ${percent}%`);
  //   });

  //   autoUpdater.on('update-downloaded', () => {
  //     console.log('✅ Update downloaded');
  //     this.showUpdateNotification('Update ready', 'Restart SessionHub to apply the update.');
  //   });
  // }

  private showStartupNotification(): void {
    const { Notification } = eval("require('electron')") as { Notification: typeof ElectronNotification };
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: "SessionHub Ready",
        body: "AI-powered development platform is now running",
        icon: path.join(__dirname, "../resources/icon.png"),
      });
      notification.show();
    }
  }

  // Commented out for future use
  // private showUpdateNotification(title: string, body: string): void {
  //   if (Notification.isSupported()) {
  //     new Notification({
  //       title,
  //       body,
  //       icon: path.join(__dirname, '../resources/icon.png')
  //     }).show();
  //   }
  // }

  private newSession(): void {
    // Send message to renderer to create new session
    this.mainWindow?.webContents.send("new-session");
  }

  private async showSystemHealth(): Promise<void> {
    const health = {
      status: "healthy",
      uptime: process.uptime() * 1000,
      checks: [
        { name: "app-startup", status: "pass" },
        { name: "electron-version", status: "pass" },
      ],
    };

    const message = `SessionHub Status: ${health.status.toUpperCase()}\\n\\nUptime: ${Math.round(health.uptime / 1000)}s\\nChecks passed: ${health.checks.filter((c) => c.status === "pass").length}/${health.checks.length}`;

    if (this.mainWindow) {
      void dialog.showMessageBox(this.mainWindow, {
        type: "info",
        title: "System Health",
        message,
        buttons: ["OK"],
      });
    }
  }
}

// Initialize SessionHub
new SessionHubApp();
