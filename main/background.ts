/**
 * Electron Main Process - Background Service
 * Handles app lifecycle, window management, and system integration
 */
import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from "electron";
import type { Notification as ElectronNotification } from "electron";
import { autoUpdater } from "electron-updater";
import * as path from "path";
import isDev from "electron-is-dev";
import serve from "electron-serve";
// Import SessionHub services
import { productionMonitor } from "../src/services/production/ProductionMonitor";
import { selfDevelopmentProduction } from "../src/services/production/SelfDevelopmentProduction";
import { claudeAutoAcceptService } from "./services/ClaudeAutoAcceptService";
import { autoUpdateService } from "./services/AutoUpdateService";
import { menuBarService } from "./services/mac/MenuBarService";
import { appLifecycleService } from "./services/AppLifecycleService";
import { fileAssociationService } from "./services/mac/FileAssociationService";
import { productionOptimizations } from "../src/config/production-optimizations";
import { EmergencyRecoverySystem } from "../src/services/pipeline/EmergencyRecoverySystem";
// Import IPC handlers
import { registerFigmaHandlers } from "./ipc/figmaHandlers";
import { registerAdminHandlers } from "./ipc/adminHandlers";
import { registerSessionPipelineHandlers } from "./ipc/sessionPipelineHandlers";
import { registerContextHandlers } from "./ipc/contextHandlers";
import { registerSessionHandlers } from "./ipc/sessionHandlers";
import { registerPipelineHandlers } from "./ipc/pipelineHandlers";
import { registerMCPServerHandlers } from "./ipc/mcpServerHandlers";
import { registerZedHandlers } from "./ipc/zedHandlers";
import { registerAIHandlers } from "./ipc/aiHandlers";
import { setupOnboardingHandlers } from "./ipc/onboardingHandlers";
import { registerTutorialHandlers } from "./ipc/tutorialHandlers";
// Configure auto-updater for production
if (!isDev) {
  serve({ directory: "app" });
  void autoUpdater.checkForUpdatesAndNotify();
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
      require("electron-reload")(__dirname, {
        electron: path.join(
          __dirname,
          "..",
          "node_modules",
          ".bin",
          "electron",
        ),
        hardResetMethod: "exit",
      });
    }
    // App event handlers
    void app.whenReady().then(() => this.onReady());
    app.on("window-all-closed", () => this.onWindowAllClosed());
    app.on("activate", () => this.onActivate());
    app.on("before-quit", () => void this.onBeforeQuit());
    // Security: Prevent new window creation
    app.on("web-contents-created", (_event, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url).catch(() => {
          // Handle error silently
        });
        return { action: "deny" };
      });
    });
    // Auto-updater will be initialized after window creation
  }
  private async onReady(): Promise<void> {
// REMOVED: console statement
    // Check for recovery needs before anything else
    const recovery = EmergencyRecoverySystem.getInstance();
    const recoverySuccess = await recovery.checkAndRecover();
    if (!recoverySuccess) {
      app.quit();
      return;
    }
    // Initialize app lifecycle service
    await appLifecycleService.initialize();
    // Set app security
    this.setSecurityDefaults();
    // Create application menu
    this.createMenu();
    // Create main window
    await this.createMainWindow();
    // Initialize SessionHub services
    await this.initializeServices();
    // Initialize Mac-specific features
    this.initializeMacFeatures();
    // Initialize auto-updater after window is ready
    this.setupAutoUpdater();
    // Show startup notification
    this.showStartupNotification();
// REMOVED: console statement
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
      this.createMainWindow().catch(() => {
        // Handle window creation error silently
      });
    }
  }
  private async onBeforeQuit(): Promise<void> {
    this.isQuitting = true;
    // Clear crash marker for clean shutdown
    const recovery = EmergencyRecoverySystem.getInstance();
    recovery.clearCrashMarker();
    // Shutdown production optimizations
    if (!isDev) {
      await productionOptimizations.shutdown();
    }
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
    // Check for saved window state
    const savedState = appLifecycleService.getWindowState('main');
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: savedState?.bounds.width || 1200,
      height: savedState?.bounds.height || 800,
      x: savedState?.bounds.x,
      y: savedState?.bounds.y,
      minWidth: 800,
      minHeight: 600,
      show: false,
      icon: path.join(__dirname, "../resources/icon.png"),
      titleBarStyle: "hiddenInset",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });
    // Register window with lifecycle service
    appLifecycleService.registerWindow(this.mainWindow);
    // Load the application
    if (isDev) {
      await this.mainWindow.loadURL("http://localhost:3000");
      // Open DevTools in development
      this.mainWindow.webContents.openDevTools();
    } else {
      await this.mainWindow.loadURL("app://./index.html");
    }
    // Show window when ready
    this.mainWindow.once("ready-to-show", () => {
      if (this.mainWindow) {
        void this.mainWindow.show();
        // Focus on the window
        if (isDev) {
          this.mainWindow.webContents.openDevTools();
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
            click: () => void shell.openExternal("https://sessionhub.com/docs"),
          },
          {
            label: "Support",
            click: () => void shell.openExternal("https://sessionhub.com/support"),
          },
          { type: "separator" },
          {
            label: "System Health",
            click: () => void this.showSystemHealth(),
          },
        ],
      },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
  private async initializeServices(): Promise<void> {
// REMOVED: console statement
    // Initialize production optimizations
    if (!isDev) {
      await productionOptimizations.initialize();
    }
    // Start production monitoring
    void productionMonitor.performHealthChecks();
    // Initialize self-development system
    selfDevelopmentProduction.getSelfDevelopmentStatus();
// REMOVED: console statement
    // Initialize self-development pipeline
    const pipelineConfig = {
      github: {
        webhookSecret: process.env['GITHUB_WEBHOOK_SECRET'] || '',
        apiToken: '', // Will be loaded from credential manager
        repos: ['sessionhub/sessionhub-v2'],
        labelFilter: ['sessionhub-auto']
      },
      production: {
        errorThreshold: 5,
        monitoringInterval: 60000
      },
      deployment: {
        autoDeployEnabled: !isDev,
        requiresApproval: true,
        signatureKeyPath: path.join(app.getPath('userData'), 'keys', 'deploy.key'),
        updateChannels: ['stable', 'beta', 'alpha']
      },
      emergency: {
        recoveryEndpoint: 'http://localhost:3000/recovery',
        fallbackVersion: '1.0.0'
      }
    };
    // Initialize pipeline through IPC when ready
    setTimeout(() => {
      this.mainWindow?.webContents.send('pipeline:initialize', pipelineConfig);
    }, 5000);
    // Initialize Claude auto-accept service
    void claudeAutoAcceptService.initialize();
    // Set up IPC handlers
    this.setupIpcHandlers();
// REMOVED: console statement
  }
  private initializeMacFeatures(): void {
    if (process.platform !== 'darwin') return;
    // Initialize menu bar
    if (this.mainWindow) {
      menuBarService.initialize(this.mainWindow);
      // Initialize file associations
      fileAssociationService.initialize(this.mainWindow);
    }
    // Set up menu bar event handlers
    menuBarService.on('check-updates', () => {
      void autoUpdateService.checkForUpdates();
    });
    menuBarService.on('force-sync', () => {
      this.mainWindow?.webContents.send('force-sync');
    });
    menuBarService.on('toggle-auto-accept', (enabled: boolean) => void (async () => {
      if (enabled) {
        await claudeAutoAcceptService.enable();
      } else {
        await claudeAutoAcceptService.disable();
      }
    })());
    menuBarService.on('open-project', (projectPath: string) => {
      this.mainWindow?.webContents.send('open-project', { projectPath });
    });
    // Set up file association handlers
    fileAssociationService.on('open-project', (data) => {
      this.mainWindow?.webContents.send('file-opened', data);
    });
    fileAssociationService.on('open-session', (data) => {
      this.mainWindow?.webContents.send('file-opened', data);
    });
    fileAssociationService.on('open-template', (data) => {
      this.mainWindow?.webContents.send('file-opened', data);
    });
    // Set up lifecycle handlers
    appLifecycleService.on('should-create-window', () => {
      void this.createMainWindow();
    });
    appLifecycleService.on('open-file', (filePath: string) => {
      void fileAssociationService.openFile(filePath);
    });
    appLifecycleService.on('open-url', (url: string) => {
      fileAssociationService.handleDeepLink(url);
    });
    appLifecycleService.on('crash-recovery-needed', (lastSession) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('restore-session', lastSession);
      }
    });
    // Energy efficiency handlers
    appLifecycleService.on('on-battery', () => {
      // Switch to efficiency mode when on battery
      if (!isDev) {
        void productionOptimizations.optimizeForWorkload('development');
      }
      // Reduce update check frequency
      autoUpdateService.destroy();
      menuBarService.updateStatus({ syncStatus: 'idle' });
    });
    appLifecycleService.on('on-ac', () => {
      // Resume normal operations
      if (this.mainWindow) {
        autoUpdateService.initialize(this.mainWindow);
      }
    });
  }
  private setupIpcHandlers(): void {
    // Register Figma handlers
    registerFigmaHandlers();
    // Register Admin handlers
    registerAdminHandlers();
    // Register Session Pipeline handlers
    registerSessionPipelineHandlers();
    // Register Context handlers
    registerContextHandlers();
    // Register Session handlers
    registerSessionHandlers();
    // Register Pipeline handlers
    registerPipelineHandlers();
    // Register MCP Server handlers
    registerMCPServerHandlers();
    // Register Zed IDE handlers
    registerZedHandlers();
    // Register AI Enhancement handlers
    registerAIHandlers();
    // Register Onboarding handlers
    setupOnboardingHandlers();
    // Register Tutorial and Help handlers
    registerTutorialHandlers();
    // System health check
    ipcMain.handle("get-system-health", async () => {
      return await productionMonitor.performHealthChecks();
    });
    // Self-development status
    ipcMain.handle("get-self-development-status", () => {
      return selfDevelopmentProduction.getSelfDevelopmentStatus();
    });
    // Trigger test issue (for demo purposes)
    ipcMain.handle("trigger-test-issue", async () => {
      await selfDevelopmentProduction.triggerTestIssue();
      return { success: true, message: "Test issue triggered" };
    });
    // Get production metrics
    ipcMain.handle("get-production-metrics", () => {
      return productionMonitor.getMetricsSummary();
    });
    // Update handlers
    ipcMain.handle("check-for-updates", async () => {
      await autoUpdateService.checkForUpdates();
      return autoUpdateService.getStatus();
    });
    ipcMain.handle("download-update", async () => {
      await autoUpdateService.downloadUpdate();
    });
    ipcMain.handle("install-update", () => {
      autoUpdateService.quitAndInstall();
    });
    // File association handlers
    ipcMain.handle("save-project-file", async (_event, projectData, savePath) => {
      return await fileAssociationService.saveProjectFile(projectData, savePath);
    });
    // Preferences handlers
    ipcMain.handle("set-preference", async (_event, key, value) => {
      await appLifecycleService.setPreference(key, value);
    });
    ipcMain.handle("get-preference", (_event, key) => {
      return appLifecycleService.getPreference(key);
    });
    // Session state handlers
    ipcMain.handle("save-session", async (_event, sessionData) => {
      await appLifecycleService.saveSession(sessionData);
    });
    // Menu bar status handlers
    ipcMain.handle("update-menu-bar-status", (_event, status) => {
      menuBarService.updateStatus(status);
    });
  }
  private setupAutoUpdater(): void {
    if (isDev) return;
    // Initialize auto-update service when window is ready
    if (this.mainWindow) {
      autoUpdateService.initialize(this.mainWindow);
    }
    // Handle update events
    autoUpdateService.on('update-available', () => {
      menuBarService.updateStatus({ updateAvailable: true });
    });
    autoUpdateService.on('update-downloaded', () => {
      menuBarService.showStatusMessage('Update ready - restart to apply');
    });
    autoUpdateService.on('error', (_error) => {
      // Log but don't show to user unless critical
      // console.error('Update error:', error);
    });
  }
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
  private newSession(): void {
    // Send message to renderer to create new session
    this.mainWindow?.webContents.send("new-session");
  }
  private async showSystemHealth(): Promise<void> {
    const health = await productionMonitor.performHealthChecks();
    const message = `SessionHub Status: ${health.status.toUpperCase()}\n\nUptime: ${Math.round(health.uptime / 1000)}s\nChecks passed: ${health.checks.filter((c) => c.status === "pass").length}/${health.checks.length}`;
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
