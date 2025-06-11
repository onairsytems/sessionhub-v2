/**
 * Claude Code Auto-Accept Service
 * Manages automatic acceptance of Claude Code prompts within SessionHub
 */

import { app, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ClaudeAutoAcceptSettings {
  enabled: boolean;
  sessionId?: string;
  masterOverride: boolean;
  // Basic operations
  acceptFileEdits: boolean;
  acceptGitOperations: boolean;
  acceptFoundationUpdates: boolean;
  acceptAllPrompts: boolean;
  // Extended operations
  acceptDirectoryOperations: boolean;
  acceptPackageInstallations: boolean;
  acceptShellCommands: boolean;
  acceptBuildOperations: boolean;
  acceptSystemModifications: boolean;
  acceptNetworkOperations: boolean;
  acceptDockerOperations: boolean;
  acceptDatabaseOperations: boolean;
  // Ultimate control
  bypassAllPrompts: boolean;
  neverAskPermission: boolean;
}

export class ClaudeAutoAcceptService {
  private configPath: string;
  private settings: ClaudeAutoAcceptSettings;
  private claudeConfigPath: string;
  
  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'claude-auto-accept.json');
    this.claudeConfigPath = path.join(app.getPath('home'), '.config', 'claude', 'claude.json');
    
    // Default settings - EVERYTHING enabled
    this.settings = {
      enabled: true,
      masterOverride: true,
      acceptFileEdits: true,
      acceptGitOperations: true,
      acceptFoundationUpdates: true,
      acceptAllPrompts: true,
      acceptDirectoryOperations: true,
      acceptPackageInstallations: true,
      acceptShellCommands: true,
      acceptBuildOperations: true,
      acceptSystemModifications: true,
      acceptNetworkOperations: true,
      acceptDockerOperations: true,
      acceptDatabaseOperations: true,
      bypassAllPrompts: true,
      neverAskPermission: true
    };
  }
  
  async initialize(): Promise<void> {
    // Load saved settings
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.settings = { ...this.settings, ...JSON.parse(data) };
    } catch {
      // Save default settings if none exist
      await this.saveSettings();
    }
    
    // Apply settings
    if (this.settings.enabled) {
      await this.applyAutoAcceptSettings();
    }
    
    // Setup IPC handlers
    this.setupIPCHandlers();
  }
  
  private setupIPCHandlers(): void {
    ipcMain.handle('claude:get-auto-accept-settings', () => {
      return this.settings;
    });
    
    ipcMain.handle('claude:set-auto-accept-settings', async (_, settings: ClaudeAutoAcceptSettings) => {
      this.settings = settings;
      await this.saveSettings();
      
      if (settings.enabled) {
        await this.applyAutoAcceptSettings();
      } else {
        await this.removeAutoAcceptSettings();
      }
      
      return { success: true };
    });
    
    ipcMain.handle('claude:enable-for-session', async (_, sessionId: string) => {
      this.settings.enabled = true;
      this.settings.sessionId = sessionId;
      await this.saveSettings();
      await this.applyAutoAcceptSettings();
      
      return { success: true };
    });
  }
  
  private async saveSettings(): Promise<void> {
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.settings, null, 2)
    );
  }
  
  private async applyAutoAcceptSettings(): Promise<void> {
    // Set ALL environment variables for comprehensive auto-accept
    process.env['CLAUDE_AUTO_ACCEPT_EDITS'] = 'true';
    process.env['CLAUDE_AUTO_ACCEPT_PROMPTS'] = 'true';
    process.env['CLAUDE_SUPPRESS_CONFIRMATIONS'] = 'true';
    process.env['CLAUDE_AUTO_ACCEPT_ALL'] = 'true';
    process.env['CLAUDE_MASTER_OVERRIDE'] = String(this.settings.masterOverride);
    process.env['CLAUDE_BYPASS_ALL_PROMPTS'] = String(this.settings.bypassAllPrompts);
    process.env['CLAUDE_NEVER_ASK_PERMISSION'] = String(this.settings.neverAskPermission);
    
    // File and directory operations
    process.env['CLAUDE_ACCEPT_FILE_CREATE'] = 'true';
    process.env['CLAUDE_ACCEPT_FILE_EDIT'] = 'true';
    process.env['CLAUDE_ACCEPT_FILE_DELETE'] = 'true';
    process.env['CLAUDE_ACCEPT_DIR_CREATE'] = 'true';
    process.env['CLAUDE_ACCEPT_DIR_DELETE'] = 'true';
    process.env['CLAUDE_ACCEPT_PERMISSIONS'] = 'true';
    
    // Package management
    process.env['CLAUDE_ACCEPT_NPM_INSTALL'] = 'true';
    process.env['CLAUDE_ACCEPT_YARN_ADD'] = 'true';
    process.env['CLAUDE_ACCEPT_PIP_INSTALL'] = 'true';
    process.env['CLAUDE_ACCEPT_BREW_INSTALL'] = 'true';
    process.env['CLAUDE_ACCEPT_PACKAGE_UPDATES'] = 'true';
    
    // Shell and system
    process.env['CLAUDE_ACCEPT_SHELL_COMMANDS'] = 'true';
    process.env['CLAUDE_ACCEPT_SCRIPT_EXECUTION'] = 'true';
    process.env['CLAUDE_ACCEPT_ENV_CHANGES'] = 'true';
    process.env['CLAUDE_ACCEPT_SYSTEM_CONFIG'] = 'true';
    
    // Git operations
    process.env['CLAUDE_ACCEPT_GIT_ALL'] = 'true';
    
    // Build and development
    process.env['CLAUDE_ACCEPT_BUILD_COMMANDS'] = 'true';
    process.env['CLAUDE_ACCEPT_TEST_EXECUTION'] = 'true';
    
    // Network and containers
    process.env['CLAUDE_ACCEPT_API_CALLS'] = 'true';
    process.env['CLAUDE_ACCEPT_DOCKER_OPS'] = 'true';
    
    // SessionHub specific
    process.env['SESSIONHUB_AUTO_ACCEPT'] = String(this.settings.enabled);
    process.env['SESSIONHUB_TRUST_LEVEL'] = 'maximum';
    
    if (this.settings.sessionId) {
      process.env['SESSIONHUB_SESSION_ID'] = this.settings.sessionId;
    }
    
    // Update Claude configuration file
    await this.updateClaudeConfig();
    
    // For macOS, also set system-wide preferences
    if (process.platform === 'darwin') {
      await this.setMacOSPreferences();
    }
  }
  
  private async removeAutoAcceptSettings(): Promise<void> {
    delete process.env['CLAUDE_AUTO_ACCEPT_EDITS'];
    delete process.env['CLAUDE_AUTO_ACCEPT_PROMPTS'];
    delete process.env['CLAUDE_SUPPRESS_CONFIRMATIONS'];
    delete process.env['SESSIONHUB_AUTO_ACCEPT'];
    delete process.env['SESSIONHUB_SESSION_ID'];
  }
  
  private async updateClaudeConfig(): Promise<void> {
    // Ensure config directory exists
    const configDir = path.dirname(this.claudeConfigPath);
    await fs.mkdir(configDir, { recursive: true });
    
    let config: Record<string, unknown> = {};
    
    // Load existing config if present
    try {
      const data = await fs.readFile(this.claudeConfigPath, 'utf-8');
      config = JSON.parse(data) as Record<string, unknown>;
    } catch {
      // Start with empty config
    }
    
    // Update with our settings
    config['autoAcceptEdits'] = this.settings.acceptFileEdits;
    config['autoAcceptPrompts'] = this.settings.acceptAllPrompts;
    config['suppressConfirmations'] = true;
    config['sessionHub'] = {
      enabled: this.settings.enabled,
      sessionId: this.settings.sessionId,
      acceptPatterns: {
        fileEdits: this.settings.acceptFileEdits,
        gitOperations: this.settings.acceptGitOperations,
        foundationUpdates: this.settings.acceptFoundationUpdates,
        allPrompts: this.settings.acceptAllPrompts
      }
    };
    
    // Save updated config
    await fs.writeFile(
      this.claudeConfigPath,
      JSON.stringify(config, null, 2)
    );
  }
  
  public async enable(): Promise<void> {
    this.settings.enabled = true;
    await this.saveSettings();
    await this.applyAutoAcceptSettings();
  }
  
  public async disable(): Promise<void> {
    this.settings.enabled = false;
    await this.saveSettings();
    await this.removeAutoAcceptSettings();
  }
  
  private async setMacOSPreferences(): Promise<void> {
    // Use macOS defaults system to set preferences
    const commands = [
      `defaults write com.anthropic.claude AutoAcceptEdits -bool ${this.settings.acceptFileEdits}`,
      `defaults write com.anthropic.claude AutoAcceptPrompts -bool ${this.settings.acceptAllPrompts}`,
      `defaults write com.anthropic.claude SuppressConfirmations -bool true`
    ];
    
    for (const cmd of commands) {
      try {
        await execAsync(cmd);
      } catch {
        // Ignore errors - Claude might not be installed
      }
    }
  }
  
  async enableForCurrentSession(sessionId: string): Promise<void> {
    this.settings.enabled = true;
    this.settings.sessionId = sessionId;
    await this.saveSettings();
    await this.applyAutoAcceptSettings();
    
    // Log this activation
    await this.logActivity(`Auto-accept enabled for session: ${sessionId}`);
  }
  
  async disableAutoAccept(): Promise<void> {
    this.settings.enabled = false;
    delete this.settings.sessionId;
    await this.saveSettings();
    await this.removeAutoAcceptSettings();
    
    await this.logActivity('Auto-accept disabled');
  }
  
  private async logActivity(message: string): Promise<void> {
    const logPath = path.join(app.getPath('userData'), 'claude-auto-accept.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.appendFile(logPath, logEntry);
    } catch {
      await fs.writeFile(logPath, logEntry);
    }
  }
  
  getSettings(): ClaudeAutoAcceptSettings {
    return { ...this.settings };
  }
  
  async checkClaudeInstallation(): Promise<{
    installed: boolean;
    path?: string;
    version?: string;
  }> {
    try {
      // Check for Claude CLI
      const { stdout: cliPath } = await execAsync('which claude');
      if (cliPath.trim()) {
        const { stdout: version } = await execAsync('claude --version');
        return {
          installed: true,
          path: cliPath.trim(),
          version: version.trim()
        };
      }
    } catch {
      // CLI not found, check for app
    }
    
    // Check for Claude app on macOS
    if (process.platform === 'darwin') {
      try {
        await fs.access('/Applications/Claude.app');
        return {
          installed: true,
          path: '/Applications/Claude.app'
        };
      } catch {
        // App not found
      }
    }
    
    return { installed: false };
  }
}

// Export singleton instance
export const claudeAutoAcceptService = new ClaudeAutoAcceptService();