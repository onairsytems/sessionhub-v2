/**
 * Menu Bar Service
 * Manages the persistent menu bar (tray) application for macOS
 */

import { Tray, Menu, nativeImage, app, shell, BrowserWindow } from 'electron';
import * as path from 'path';
import { EventEmitter } from 'events';

interface MenuBarStatus {
  connected: boolean;
  sessionActive: boolean;
  updateAvailable: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
}

export class MenuBarService extends EventEmitter {
  private tray: Tray | null = null;
  private status: MenuBarStatus = {
    connected: true,
    sessionActive: false,
    updateAvailable: false,
    syncStatus: 'idle'
  };
  private contextMenu: Menu | null = null;
  private mainWindow: BrowserWindow | null = null;
  private statusInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the menu bar service
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.createTray();
    this.updateMenu();
    
    // Start status monitoring
    this.startStatusMonitoring();
  }

  /**
   * Update the menu bar status
   */
  public updateStatus(updates: Partial<MenuBarStatus>): void {
    this.status = { ...this.status, ...updates };
    this.updateTrayIcon();
    this.updateMenu();
  }

  /**
   * Show a temporary status message
   */
  public showStatusMessage(message: string, duration = 3000): void {
    if (!this.tray) return;
    
    const originalTitle = this.tray.getTitle();
    this.tray.setTitle(message);
    
    setTimeout(() => {
      if (this.tray) {
        this.tray.setTitle(originalTitle);
      }
    }, duration);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    
    this.removeAllListeners();
  }

  private createTray(): void {
    // Create tray icon
    const iconPath = this.getIconPath('default');
    const icon = nativeImage.createFromPath(iconPath);
    
    // Make icon smaller for menu bar (16x16 or 22x22 depending on macOS version)
    const trayIcon = icon.resize({ width: 16, height: 16 });
    trayIcon.setTemplateImage(true);
    
    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('SessionHub - AI Development Platform');
    
    // Click behavior - show/hide main window
    this.tray.on('click', () => {
      this.toggleMainWindow();
    });
    
    // Right-click shows menu
    this.tray.on('right-click', () => {
      if (this.contextMenu) {
        this.tray?.popUpContextMenu(this.contextMenu);
      }
    });
  }

  private updateTrayIcon(): void {
    if (!this.tray) return;
    
    let iconName = 'default';
    
    if (!this.status.connected) {
      iconName = 'disconnected';
    } else if (this.status.syncStatus === 'error') {
      iconName = 'error';
    } else if (this.status.syncStatus === 'syncing') {
      iconName = 'syncing';
    } else if (this.status.sessionActive) {
      iconName = 'active';
    } else if (this.status.updateAvailable) {
      iconName = 'update';
    }
    
    const iconPath = this.getIconPath(iconName);
    const icon = nativeImage.createFromPath(iconPath);
    const trayIcon = icon.resize({ width: 16, height: 16 });
    trayIcon.setTemplateImage(true);
    
    this.tray.setImage(trayIcon);
  }

  private getIconPath(_name: string): string {
    // In production, these would be different icons
    // For now, using the same icon with different states handled by macOS template images
    return path.join(__dirname, '../../../resources/icon.png');
  }

  private updateMenu(): void {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
      {
        label: this.status.sessionActive ? '● Session Active' : '○ No Active Session',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show SessionHub',
        click: () => this.showMainWindow()
      },
      {
        label: 'New Session',
        accelerator: 'Cmd+N',
        click: () => this.createNewSession()
      },
      { type: 'separator' },
      {
        label: 'Quick Actions',
        submenu: [
          {
            label: 'Open Recent Project',
            submenu: this.getRecentProjects()
          },
          {
            label: 'Claude Auto-Accept',
            type: 'checkbox',
            checked: false, // This would be connected to actual state
            click: (menuItem) => {
              this.emit('toggle-auto-accept', menuItem.checked);
            }
          },
          { type: 'separator' },
          {
            label: 'View Costs',
            click: () => this.openSection('costs')
          },
          {
            label: 'MCP Builder',
            click: () => this.openSection('mcp')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Status',
        submenu: [
          {
            label: `Sync: ${this.status.syncStatus}`,
            enabled: false
          },
          {
            label: this.status.connected ? 'Connected' : 'Disconnected',
            enabled: false
          },
          { type: 'separator' },
          {
            label: 'Force Sync',
            enabled: this.status.syncStatus !== 'syncing',
            click: () => this.emit('force-sync')
          }
        ]
      },
      { type: 'separator' },
      {
        label: this.status.updateAvailable ? 'Update Available...' : 'Check for Updates',
        click: () => this.emit('check-updates')
      },
      {
        label: 'Preferences...',
        accelerator: 'Cmd+,',
        click: () => this.openSection('settings')
      },
      { type: 'separator' },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => shell.openExternal('https://sessionhub.com/docs')
          },
          {
            label: 'Report Issue',
            click: () => shell.openExternal('https://github.com/sessionhub/issues')
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Quit SessionHub',
        accelerator: 'Cmd+Q',
        click: () => app.quit()
      }
    ];
    
    this.contextMenu = Menu.buildFromTemplate(menuTemplate);
  }

  private toggleMainWindow(): void {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showMainWindow();
    }
  }

  private showMainWindow(): void {
    if (!this.mainWindow) return;
    
    this.mainWindow.show();
    this.mainWindow.focus();
    
    // Bring to front on macOS
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  }

  private createNewSession(): void {
    this.showMainWindow();
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      void this.mainWindow.webContents.send('new-session');
    }
  }

  private openSection(section: string): void {
    this.showMainWindow();
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      void this.mainWindow.webContents.send('navigate', `/${section}`);
    }
  }

  private getRecentProjects(): Electron.MenuItemConstructorOptions[] {
    // This would be populated from actual project history
    const recentProjects = [
      { name: 'SessionHub', path: '/Users/dev/sessionhub' },
      { name: 'MCP Server', path: '/Users/dev/mcp-server' },
      { name: 'Claude Integration', path: '/Users/dev/claude-integration' }
    ];
    
    if (recentProjects.length === 0) {
      return [{ label: 'No Recent Projects', enabled: false }];
    }
    
    return recentProjects.map(project => ({
      label: project.name,
      click: () => this.emit('open-project', project.path)
    }));
  }

  private startStatusMonitoring(): void {
    // Update status every 30 seconds
    this.statusInterval = setInterval(() => {
      this.emit('status-check');
    }, 30000);
  }
}

// Export singleton instance
export const menuBarService = new MenuBarService();