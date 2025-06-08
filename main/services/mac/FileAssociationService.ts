/**
 * File Association and Deep Linking Service
 * Handles file associations and sessionhub:// protocol links
 */

import { app, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

interface FileAssociation {
  extension: string;
  mimeType: string;
  description: string;
  icon?: string;
}

interface DeepLink {
  protocol: string;
  action: string;
  params: Record<string, string>;
}

export class FileAssociationService extends EventEmitter {
  private readonly PROTOCOL = 'sessionhub';
  private readonly FILE_ASSOCIATIONS: FileAssociation[] = [
    {
      extension: '.shub',
      mimeType: 'application/x-sessionhub-project',
      description: 'SessionHub Project'
    },
    {
      extension: '.shubsession',
      mimeType: 'application/x-sessionhub-session',
      description: 'SessionHub Session'
    },
    {
      extension: '.shubtemplate',
      mimeType: 'application/x-sessionhub-template',
      description: 'SessionHub Template'
    }
  ];

  private pendingFileOpen: string | null = null;
  private pendingDeepLink: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    this.setupHandlers();
  }

  /**
   * Initialize the file association service
   */
  public initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    
    // Register as default protocol handler
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(this.PROTOCOL, process.execPath, [path.resolve(process.argv[1] || '')]);
      }
    } else {
      app.setAsDefaultProtocolClient(this.PROTOCOL);
    }

    // Process any pending files or links
    if (this.pendingFileOpen) {
      this.handleFileOpen(this.pendingFileOpen);
      this.pendingFileOpen = null;
    }

    if (this.pendingDeepLink) {
      this.handleDeepLink(this.pendingDeepLink);
      this.pendingDeepLink = null;
    }
  }

  /**
   * Open a SessionHub file
   */
  public async openFile(filePath: string): Promise<void> {
    try {
      // Validate file exists
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Not a valid file');
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      const association = this.FILE_ASSOCIATIONS.find(a => a.extension === ext);
      
      if (!association) {
        throw new Error('Unsupported file type');
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Handle based on file type
      switch (ext) {
        case '.shub':
          await this.openProject(data, filePath);
          break;
        case '.shubsession':
          await this.openSession(data, filePath);
          break;
        case '.shubtemplate':
          await this.openTemplate(data, filePath);
          break;
      }

      // Add to recent files
      app.addRecentDocument(filePath);
      
    } catch (error) {
      this.showFileError(filePath, error as Error);
    }
  }

  /**
   * Handle a deep link
   */
  public handleDeepLink(url: string): void {
    if (!this.mainWindow) {
      this.pendingDeepLink = url;
      return;
    }

    try {
      const parsed = this.parseDeepLink(url);
      
      // Show main window
      this.mainWindow.show();
      this.mainWindow.focus();

      // Handle different actions
      switch (parsed.action) {
        case 'open':
          this.handleOpenAction(parsed.params);
          break;
        case 'new':
          this.handleNewAction(parsed.params);
          break;
        case 'share':
          this.handleShareAction(parsed.params);
          break;
        case 'settings':
          this.navigateTo('/settings');
          break;
        default:
          this.navigateTo('/');
      }
      
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Create a SessionHub project file
   */
  public async saveProjectFile(projectData: any, savePath?: string): Promise<string> {
    const defaultPath = path.join(app.getPath('documents'), 'SessionHub Projects');
    
    // Ensure directory exists
    await fs.mkdir(defaultPath, { recursive: true });

    // Show save dialog if no path provided
    if (!savePath && this.mainWindow) {
      const result = await dialog.showSaveDialog(this.mainWindow, {
        title: 'Save SessionHub Project',
        defaultPath: path.join(defaultPath, `${projectData.name || 'project'}.shub`),
        filters: [
          { name: 'SessionHub Project', extensions: ['shub'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        throw new Error('Save canceled');
      }

      savePath = result.filePath;
    }

    if (!savePath) {
      throw new Error('No save path provided');
    }

    // Add metadata
    const fileData = {
      ...projectData,
      _metadata: {
        version: '1.0',
        created: new Date().toISOString(),
        appVersion: app.getVersion()
      }
    };

    // Save file
    await fs.writeFile(savePath, JSON.stringify(fileData, null, 2), 'utf-8');
    
    // Add to recent documents
    app.addRecentDocument(savePath);
    
    return savePath;
  }

  private setupHandlers(): void {
    // Handle file open events
    app.on('open-file', (event, filePath) => {
      event.preventDefault();
      
      if (this.mainWindow) {
        this.handleFileOpen(filePath);
      } else {
        // Store for later if app is still starting
        this.pendingFileOpen = filePath;
      }
    });

    // Handle protocol links
    app.on('open-url', (event, url) => {
      event.preventDefault();
      
      if (url.startsWith(`${this.PROTOCOL}://`)) {
        if (this.mainWindow) {
          this.handleDeepLink(url);
        } else {
          // Store for later if app is still starting
          this.pendingDeepLink = url;
        }
      }
    });

    // Windows/Linux file association
    if (process.platform === 'win32' || process.platform === 'linux') {
      const filePath = process.argv.find(arg => 
        this.FILE_ASSOCIATIONS.some(a => arg.endsWith(a.extension))
      );
      
      if (filePath) {
        this.pendingFileOpen = filePath;
      }
    }
  }

  private async handleFileOpen(filePath: string): Promise<void> {
    // Bring window to front
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    await this.openFile(filePath);
  }

  private parseDeepLink(url: string): DeepLink {
    const urlObj = new URL(url);
    const action = urlObj.hostname || 'open';
    const params: Record<string, string> = {};

    // Parse query parameters
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Parse path parameters
    if (urlObj.pathname && urlObj.pathname !== '/') {
      params['path'] = urlObj.pathname.substring(1);
    }

    return { protocol: this.PROTOCOL, action, params };
  }

  private async openProject(data: any, filePath: string): Promise<void> {
    this.emit('open-project', {
      data,
      filePath,
      type: 'project'
    });

    // Navigate to project view
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('open-project', { data, filePath });
    }
  }

  private async openSession(data: any, filePath: string): Promise<void> {
    this.emit('open-session', {
      data,
      filePath,
      type: 'session'
    });

    // Navigate to session view
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('open-session', { data, filePath });
    }
  }

  private async openTemplate(data: any, filePath: string): Promise<void> {
    this.emit('open-template', {
      data,
      filePath,
      type: 'template'
    });

    // Navigate to template view
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('open-template', { data, filePath });
    }
  }

  private handleOpenAction(params: Record<string, string>): void {
    if (params['project']) {
      this.navigateTo(`/projects/${params['project']}`);
    } else if (params['session']) {
      this.navigateTo(`/sessions/${params['session']}`);
    } else if (params['path']) {
      this.navigateTo(params['path']);
    }
  }

  private handleNewAction(params: Record<string, string>): void {
    if (params['type'] === 'project') {
      this.mainWindow?.webContents.send('new-project', params);
    } else if (params['type'] === 'session') {
      this.mainWindow?.webContents.send('new-session', params);
    }
  }

  private handleShareAction(params: Record<string, string>): void {
    this.mainWindow?.webContents.send('import-shared', params);
  }

  private navigateTo(path: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('navigate', path);
    }
  }

  private showFileError(filePath: string, error: Error): void {
    if (!this.mainWindow) return;

    dialog.showErrorBox(
      'Failed to Open File',
      `Could not open "${path.basename(filePath)}":\n${error.message}`
    );
  }
}

// Export singleton instance
export const fileAssociationService = new FileAssociationService();