/**
 * App Lifecycle Service
 * Manages application lifecycle, state persistence, and crash recovery
 */

import { app, BrowserWindow, crashReporter, powerMonitor } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

interface AppState {
  windows: WindowState[];
  lastSession: SessionState | null;
  preferences: Record<string, any>;
  crashCount: number;
  lastCrashTime: number | null;
}

interface WindowState {
  id: string;
  bounds: Electron.Rectangle;
  isMaximized: boolean;
  isFullScreen: boolean;
  url: string;
}

interface SessionState {
  id: string;
  projectPath: string;
  activeFiles: string[];
  timestamp: number;
}

export class AppLifecycleService extends EventEmitter {
  private appState: AppState = {
    windows: [],
    lastSession: null,
    preferences: {},
    crashCount: 0,
    lastCrashTime: null
  };

  private statePath: string;
  private saveStateInterval: NodeJS.Timeout | null = null;
  private isQuitting = false;
  private windows = new Map<number, BrowserWindow>();

  constructor() {
    super();
    this.statePath = path.join(app.getPath('userData'), 'app-state.json');
    this.setupLifecycleHandlers();
    this.setupCrashReporter();
    this.setupPowerMonitor();
  }

  /**
   * Initialize the lifecycle service
   */
  public async initialize(): Promise<void> {
    // Load previous state
    await this.loadState();

    // Check for crash recovery
    if (this.shouldRecoverFromCrash()) {
      this.emit('crash-recovery-needed', this.appState.lastSession);
    }

    // Start periodic state saving
    this.startStateSaving();

    // Set up auto-launch if enabled
    await this.setupAutoLaunch();
  }

  /**
   * Register a window for lifecycle management
   */
  public registerWindow(window: BrowserWindow): void {
    const id = window.id;
    this.windows.set(id, window);

    // Track window state changes
    window.on('resize', () => this.saveWindowState(window));
    window.on('move', () => this.saveWindowState(window));
    window.on('maximize', () => this.saveWindowState(window));
    window.on('unmaximize', () => this.saveWindowState(window));
    window.on('enter-full-screen', () => this.saveWindowState(window));
    window.on('leave-full-screen', () => this.saveWindowState(window));

    // Handle window close
    window.on('close', (event) => {
      if (!this.isQuitting && process.platform === 'darwin') {
        event.preventDefault();
        window.hide();
        // Keep app running in background
        app.dock.hide();
      }
    });

    window.on('closed', () => {
      this.windows.delete(id);
    });

    // Save initial state
    this.saveWindowState(window);
  }

  /**
   * Save current session state
   */
  public async saveSession(session: SessionState): Promise<void> {
    this.appState.lastSession = session;
    await this.saveState();
  }

  /**
   * Get saved window state
   */
  public getWindowState(id: string): WindowState | undefined {
    return this.appState.windows.find(w => w.id === id);
  }

  /**
   * Set user preference
   */
  public async setPreference(key: string, value: any): Promise<void> {
    this.appState.preferences[key] = value;
    await this.saveState();
  }

  /**
   * Get user preference
   */
  public getPreference(key: string): any {
    return this.appState.preferences[key];
  }

  /**
   * Prepare for app quit
   */
  public async prepareForQuit(): Promise<void> {
    this.isQuitting = true;
    
    // Save final state
    await this.saveState();
    
    // Clean up
    if (this.saveStateInterval) {
      clearInterval(this.saveStateInterval);
      this.saveStateInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.saveStateInterval) {
      clearInterval(this.saveStateInterval);
      this.saveStateInterval = null;
    }
    this.removeAllListeners();
  }

  private setupLifecycleHandlers(): void {
    // Handle app activation (macOS)
    app.on('activate', () => {
      if (this.windows.size === 0) {
        this.emit('should-create-window');
      } else {
        // Show first window
        const firstWindow = this.windows.values().next().value;
        if (firstWindow && !firstWindow.isVisible()) {
          firstWindow.show();
          app.dock.show();
        }
      }
    });

    // Handle open file (macOS)
    app.on('open-file', (event, filePath) => {
      event.preventDefault();
      this.emit('open-file', filePath);
    });

    // Handle open URL (deep linking)
    app.on('open-url', (event, url) => {
      event.preventDefault();
      this.emit('open-url', url);
    });

    // Handle before quit
    app.on('before-quit', async (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        await this.prepareForQuit();
        app.quit();
      }
    });

    // Handle will quit
    app.on('will-quit', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
      }
    });

    // Handle window all closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  private setupCrashReporter(): void {
    crashReporter.start({
      productName: 'SessionHub',
      companyName: 'SessionHub',
      submitURL: 'https://crash.sessionhub.com/submit',
      uploadToServer: false, // For now, store locally
      ignoreSystemCrashHandler: true,
      compress: true,
      extra: {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      }
    });
  }

  private setupPowerMonitor(): void {
    // Monitor power events for energy efficiency
    powerMonitor.on('suspend', () => {
      this.emit('system-suspend');
      // Pause background operations
    });

    powerMonitor.on('resume', () => {
      this.emit('system-resume');
      // Resume background operations
    });

    powerMonitor.on('on-battery', () => {
      this.emit('on-battery');
      // Reduce background activity
    });

    powerMonitor.on('on-ac', () => {
      this.emit('on-ac');
      // Resume normal activity
    });

    // Monitor idle time
    setInterval(() => {
      const idleTime = powerMonitor.getSystemIdleTime();
      if (idleTime > 300) { // 5 minutes
        this.emit('system-idle', idleTime);
      }
    }, 60000); // Check every minute
  }

  private async setupAutoLaunch(): Promise<void> {
    const autoLaunchEnabled = this.appState.preferences['autoLaunch'] ?? false;
    
    app.setLoginItemSettings({
      openAtLogin: autoLaunchEnabled,
      openAsHidden: true,
      args: ['--hidden']
    });
  }

  private saveWindowState(window: BrowserWindow): void {
    const bounds = window.getBounds();
    const state: WindowState = {
      id: window.id.toString(),
      bounds,
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
      url: window.webContents.getURL()
    };

    // Update or add window state
    const index = this.appState.windows.findIndex(w => w.id === state.id);
    if (index >= 0) {
      this.appState.windows[index] = state;
    } else {
      this.appState.windows.push(state);
    }
  }

  private startStateSaving(): void {
    // Save state every 30 seconds
    this.saveStateInterval = setInterval(() => {
      this.saveState().catch(() => {
        // Handle save error silently
      });
    }, 30000);
  }

  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      const savedState = JSON.parse(data) as AppState;
      
      // Merge with default state
      this.appState = {
        ...this.appState,
        ...savedState,
        crashCount: savedState.crashCount || 0,
        lastCrashTime: savedState.lastCrashTime || null
      };
    } catch (error) {
      // No saved state or error reading - use defaults
    }
  }

  private async saveState(): Promise<void> {
    try {
      // Clean up window states for closed windows
      this.appState.windows = this.appState.windows.filter(w => 
        Array.from(this.windows.keys()).includes(parseInt(w.id))
      );
      
      const data = JSON.stringify(this.appState, null, 2);
      await fs.writeFile(this.statePath, data, 'utf-8');
    } catch (error) {
      this.emit('error', error);
    }
  }

  private shouldRecoverFromCrash(): boolean {
    if (!this.appState.lastCrashTime) return false;
    
    const timeSinceLastCrash = Date.now() - this.appState.lastCrashTime;
    const recentCrash = timeSinceLastCrash < 60000; // Within last minute
    
    if (recentCrash) {
      this.appState.crashCount++;
      this.appState.lastCrashTime = Date.now();
      
      // Don't recover if crashing repeatedly
      if (this.appState.crashCount > 3) {
        this.appState.crashCount = 0;
        return false;
      }
      
      return true;
    } else {
      // Reset crash count if it's been a while
      this.appState.crashCount = 0;
      return false;
    }
  }
}

// Export singleton instance
export const appLifecycleService = new AppLifecycleService();