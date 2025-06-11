import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const store = new Store();

interface IDEInfo {
  id: string;
  name: string;
  path: string;
  version?: string;
}

interface ClaudeValidationResult {
  valid: boolean;
  error?: string;
  model?: string;
  usage?: {
    remaining: number;
    limit: number;
  };
}

interface SupabaseValidationResult {
  valid: boolean;
  error?: string;
  projectId?: string;
  region?: string;
}

export function setupOnboardingHandlers() {
  ipcMain.handle('store:get', async (_event, key: string) => {
    try {
      return store.get(key);
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('store:set', async (_event, key: string, value: any) => {
    try {
      store.set(key, value);
      return true;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('validate-claude-api', async (_event, apiKey: string, model: string): Promise<ClaudeValidationResult> => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Hello'
          }]
        })
      });

      if (response.ok) {
        await response.json();
        return {
          valid: true,
          model: model,
          usage: {
            remaining: parseInt(response.headers.get('anthropic-ratelimit-requests-remaining') || '0'),
            limit: parseInt(response.headers.get('anthropic-ratelimit-requests-limit') || '0')
          }
        };
      } else {
        const error = await response.json();
        return {
          valid: false,
          error: error.error?.message || 'API validation failed'
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  });

  ipcMain.handle('validate-supabase', async (_event, config: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  }): Promise<SupabaseValidationResult> => {
    try {
      const response = await fetch(`${config.url}/rest/v1/`, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });

      if (response.ok) {
        const projectIdMatch = config.url.match(/https:\/\/([^.]+)\.supabase\.co/);
        return {
          valid: true,
          projectId: projectIdMatch?.[1] || 'unknown',
          region: 'auto-detected'
        };
      } else {
        return {
          valid: false,
          error: `Connection failed: ${response.status}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Connection error'
      };
    }
  });

  ipcMain.handle('detect-installed-ides', async (): Promise<IDEInfo[]> => {
    const ides: IDEInfo[] = [];
    
    const ideConfigs = [
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        paths: [
          '/Applications/Visual Studio Code.app',
          '/usr/local/bin/code'
        ],
        command: 'code --version'
      },
      {
        id: 'cursor',
        name: 'Cursor',
        paths: [
          '/Applications/Cursor.app',
          '/usr/local/bin/cursor'
        ],
        command: 'cursor --version'
      },
      {
        id: 'zed',
        name: 'Zed',
        paths: [
          '/Applications/Zed.app',
          '/usr/local/bin/zed'
        ],
        command: 'zed --version'
      }
    ];

    for (const ide of ideConfigs) {
      try {
        let found = false;
        let idePath = '';

        for (const checkPath of ide.paths) {
          try {
            await fs.access(checkPath);
            found = true;
            idePath = checkPath;
            break;
          } catch {
            continue;
          }
        }

        if (found) {
          let version = 'unknown';
          try {
            const { stdout } = await execAsync(ide.command);
            version = stdout.trim().split('\n')[0] || 'unknown';
          } catch {
          }

          ides.push({
            id: ide.id,
            name: ide.name,
            path: idePath,
            version
          });
        }
      } catch (error) {
        // IDE detection failed
      }
    }

    return ides;
  });

  ipcMain.handle('check-ide-availability', async (_event, ideId: string): Promise<boolean> => {
    const commands = {
      'vscode': 'code --version',
      'cursor': 'cursor --version',
      'zed': 'zed --version'
    };

    const command = commands[ideId as keyof typeof commands];
    if (!command) return false;

    try {
      await execAsync(command);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('show-notification', async (_event, options: {
    title: string;
    body: string;
    icon?: string;
  }) => {
    const { Notification } = require('electron');
    
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: false
      });
      
      notification.show();
      return true;
    }
    
    return false;
  });

  ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('get-app-version', async () => {
    const { app } = require('electron');
    return app.getVersion();
  });

  ipcMain.handle('restart-app', async () => {
    const { app } = require('electron');
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('onboarding:get-status', async () => {
    return {
      completed: store.get('onboarding.completed', false),
      userLevel: store.get('onboarding.userLevel', 'beginner'),
      selectedServices: store.get('onboarding.selectedServices', []),
      deferredServices: store.get('onboarding.deferredServices', []),
      configuredServices: {
        claude: store.get('services.claude.configured', false),
        supabase: store.get('services.supabase.configured', false),
        ide: store.get('services.ide.configured', false)
      }
    };
  });

  ipcMain.handle('onboarding:reset', async () => {
    store.delete('onboarding.completed');
    store.delete('onboarding.userLevel');
    store.delete('onboarding.selectedServices');
    store.delete('onboarding.deferredServices');
    return true;
  });

  ipcMain.handle('services:get-all-status', async () => {
    return {
      claude: {
        configured: store.get('services.claude.configured', false),
        model: store.get('services.claude.model'),
        lastValidated: store.get('services.claude.lastValidated')
      },
      supabase: {
        configured: store.get('services.supabase.configured', false),
        url: store.get('services.supabase.url'),
        projectId: store.get('services.supabase.projectId'),
        lastValidated: store.get('services.supabase.lastValidated')
      },
      ide: {
        configured: store.get('services.ide.configured', false),
        preferredIDE: store.get('services.ide.preferredIDE'),
        autoLaunch: store.get('services.ide.autoLaunch')
      }
    };
  });
}