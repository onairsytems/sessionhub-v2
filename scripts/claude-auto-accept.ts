#!/usr/bin/env ts-node

/**
 * Claude Code Auto-Accept Configuration
 * Automatically accepts all prompts during Claude Code sessions
 * Works in both development and production environments
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface AutoAcceptConfig {
  enabled: boolean;
  sessionId?: string;
  environment: 'development' | 'production';
  masterOverride: boolean;
  acceptPatterns: {
    fileEdits: boolean;
    gitOperations: boolean;
    foundationUpdates: boolean;
    allPrompts: boolean;
    // Enhanced operations
    directoryOperations: boolean;
    packageInstallations: boolean;
    shellCommands: boolean;
    buildOperations: boolean;
    systemOperations: boolean;
    networkOperations: boolean;
    dockerOperations: boolean;
    databaseOperations: boolean;
  };
  advancedSettings: {
    npmOperations: boolean;
    yarnOperations: boolean;
    pipOperations: boolean;
    brewOperations: boolean;
    allowSudo: boolean;
    allowSystemModifications: boolean;
    skipAllConfirmations: boolean;
    trustAllOperations: boolean;
  };
  logFile?: string;
}

class ClaudeAutoAcceptManager {
  private configPath: string;
  private config: AutoAcceptConfig = {
    enabled: false,
    environment: 'development',
    masterOverride: false,
    acceptPatterns: {
      fileEdits: false,
      gitOperations: false,
      foundationUpdates: false,
      allPrompts: false,
      directoryOperations: false,
      packageInstallations: false,
      shellCommands: false,
      buildOperations: false,
      systemOperations: false,
      networkOperations: false,
      dockerOperations: false,
      databaseOperations: false
    },
    advancedSettings: {
      npmOperations: false,
      yarnOperations: false,
      pipOperations: false,
      brewOperations: false,
      allowSudo: false,
      allowSystemModifications: false,
      skipAllConfirmations: false,
      trustAllOperations: false
    }
  };
  
  constructor() {
    // Config location that works for both dev and prod
    this.configPath = path.join(os.homedir(), '.sessionhub', 'claude-auto-accept.json');
  }
  
  async initialize(): Promise<void> {
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    // Load or create config
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch {
      // Create default config with ALL operations enabled
      this.config = {
        enabled: true,
        environment: this.detectEnvironment(),
        masterOverride: true,
        acceptPatterns: {
          fileEdits: true,
          gitOperations: true,
          foundationUpdates: true,
          allPrompts: true,
          directoryOperations: true,
          packageInstallations: true,
          shellCommands: true,
          buildOperations: true,
          systemOperations: true,
          networkOperations: true,
          dockerOperations: true,
          databaseOperations: true
        },
        advancedSettings: {
          npmOperations: true,
          yarnOperations: true,
          pipOperations: true,
          brewOperations: true,
          allowSudo: false, // Sudo requires manual confirmation for safety
          allowSystemModifications: true,
          skipAllConfirmations: true,
          trustAllOperations: true
        },
        logFile: path.join(configDir, 'claude-auto-accept.log')
      };
      await this.saveConfig();
    }
  }
  
  private detectEnvironment(): 'development' | 'production' {
    // Check if we're in development directory
    const cwd = process.cwd();
    if (cwd.includes('/Development/sessionhub')) {
      return 'development';
    }
    
    // Check if running from installed app
    if (process.execPath.includes('SessionHub.app')) {
      return 'production';
    }
    
    return 'development';
  }
  
  async saveConfig(): Promise<void> {
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2)
    );
  }
  
  async enableAutoAccept(sessionId?: string): Promise<void> {
    this.config.enabled = true;
    this.config.sessionId = sessionId;
    await this.saveConfig();
    
    // Set environment variables for Claude Code
    await this.setClaudeEnvironment();
    
    console.log('✅ Claude Code auto-accept enabled');
    console.log(`📁 Config saved to: ${this.configPath}`);
    console.log(`🔧 Environment: ${this.config.environment}`);
    
    if (sessionId) {
      console.log(`📝 Session ID: ${sessionId}`);
    }
    
    await this.logActivity('Auto-accept enabled');
  }
  
  async disableAutoAccept(): Promise<void> {
    this.config.enabled = false;
    delete this.config.sessionId;
    await this.saveConfig();
    
    console.log('❌ Claude Code auto-accept disabled');
    await this.logActivity('Auto-accept disabled');
  }
  
  private async setClaudeEnvironment(): Promise<void> {
    // Create claude.json configuration
    const claudeConfigPath = path.join(os.homedir(), '.config', 'claude', 'claude.json');
    const claudeConfigDir = path.dirname(claudeConfigPath);
    
    await fs.mkdir(claudeConfigDir, { recursive: true });
    
    // Create comprehensive config that covers EVERYTHING
    const claudeConfig = {
      autoAcceptEdits: true,
      autoAcceptPrompts: true,
      suppressConfirmations: true,
      masterOverride: this.config.masterOverride,
      acceptAll: {
        fileOperations: true,
        directoryOperations: true,
        packageManagement: true,
        shellExecution: true,
        gitOperations: true,
        buildTools: true,
        systemModifications: true,
        networkRequests: true,
        databaseOperations: true,
        dockerOperations: true,
        environmentChanges: true
      },
      sessionHub: {
        autoAccept: this.config.enabled,
        sessionId: this.config.sessionId,
        acceptPatterns: this.config.acceptPatterns,
        advancedSettings: this.config.advancedSettings
      },
      // Specific operation permissions
      operations: {
        npm: { install: true, update: true, audit: true, publish: true },
        yarn: { add: true, install: true, upgrade: true },
        pip: { install: true, upgrade: true },
        brew: { install: true, update: true, upgrade: true },
        apt: { install: true, update: true, upgrade: true },
        git: { all: true },
        mkdir: { recursive: true, force: true },
        rm: { recursive: true, force: true },
        chmod: { all: true },
        chown: { all: true },
        ln: { symbolic: true, force: true },
        curl: { all: true },
        wget: { all: true },
        docker: { all: true },
        kubectl: { all: true }
      },
      trustLevel: 'maximum',
      bypassAllPrompts: true,
      neverAskPermission: true
    };
    
    await fs.writeFile(
      claudeConfigPath,
      JSON.stringify(claudeConfig, null, 2)
    );
    
    // Also set comprehensive environment variables
    const envFile = path.join(os.homedir(), '.sessionhub', 'claude-env.sh');
    const envContent = `#!/bin/bash
# Claude Code Auto-Accept Environment Variables - FULL PERMISSIONS

# Core auto-accept settings
export CLAUDE_AUTO_ACCEPT_EDITS=true
export CLAUDE_AUTO_ACCEPT_PROMPTS=true
export CLAUDE_SUPPRESS_CONFIRMATIONS=true
export CLAUDE_AUTO_ACCEPT_ALL=true
export CLAUDE_MASTER_OVERRIDE=true

# File and directory operations
export CLAUDE_ACCEPT_FILE_CREATE=true
export CLAUDE_ACCEPT_FILE_EDIT=true
export CLAUDE_ACCEPT_FILE_DELETE=true
export CLAUDE_ACCEPT_DIR_CREATE=true
export CLAUDE_ACCEPT_DIR_DELETE=true
export CLAUDE_ACCEPT_PERMISSIONS=true

# Package management
export CLAUDE_ACCEPT_NPM_INSTALL=true
export CLAUDE_ACCEPT_YARN_ADD=true
export CLAUDE_ACCEPT_PIP_INSTALL=true
export CLAUDE_ACCEPT_BREW_INSTALL=true
export CLAUDE_ACCEPT_APT_INSTALL=true
export CLAUDE_ACCEPT_PACKAGE_UPDATES=true

# Shell and system
export CLAUDE_ACCEPT_SHELL_COMMANDS=true
export CLAUDE_ACCEPT_SCRIPT_EXECUTION=true
export CLAUDE_ACCEPT_ENV_CHANGES=true
export CLAUDE_ACCEPT_PATH_MODIFICATIONS=true
export CLAUDE_ACCEPT_SYSTEM_CONFIG=true

# Git operations
export CLAUDE_ACCEPT_GIT_ALL=true
export CLAUDE_ACCEPT_GIT_COMMIT=true
export CLAUDE_ACCEPT_GIT_PUSH=true
export CLAUDE_ACCEPT_GIT_FORCE=true

# Build and development
export CLAUDE_ACCEPT_BUILD_COMMANDS=true
export CLAUDE_ACCEPT_TEST_EXECUTION=true
export CLAUDE_ACCEPT_LINT_FIX=true
export CLAUDE_ACCEPT_FORMAT=true

# Network and external
export CLAUDE_ACCEPT_API_CALLS=true
export CLAUDE_ACCEPT_DOWNLOADS=true
export CLAUDE_ACCEPT_UPLOADS=true

# Docker and containers
export CLAUDE_ACCEPT_DOCKER_OPS=true
export CLAUDE_ACCEPT_CONTAINER_RUN=true

# SessionHub specific
export SESSIONHUB_AUTO_ACCEPT=${this.config.enabled}
export SESSIONHUB_SESSION_ID="${this.config.sessionId || ''}"
export SESSIONHUB_TRUST_LEVEL=maximum

# Ultimate override - accept EVERYTHING
export CLAUDE_BYPASS_ALL_PROMPTS=true
export CLAUDE_NEVER_ASK_PERMISSION=true
`;
    
    await fs.writeFile(envFile, envContent);
    await fs.chmod(envFile, '755');
  }
  
  private async logActivity(message: string): Promise<void> {
    if (!this.config.logFile) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.appendFile(this.config.logFile, logEntry);
    } catch {
      // Create log file if it doesn't exist
      await fs.writeFile(this.config.logFile, logEntry);
    }
  }
  
  async getStatus(): Promise<void> {
    console.log('🔍 Claude Code Auto-Accept Status');
    console.log('═══════════════════════════════════');
    console.log(`Enabled: ${this.config.enabled ? '✅' : '❌'}`);
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Config Path: ${this.configPath}`);
    
    if (this.config.sessionId) {
      console.log(`Session ID: ${this.config.sessionId}`);
    }
    
    console.log('\n📋 Accept Patterns:');
    console.log(`  File Edits: ${this.config.acceptPatterns.fileEdits ? '✅' : '❌'}`);
    console.log(`  Git Operations: ${this.config.acceptPatterns.gitOperations ? '✅' : '❌'}`);
    console.log(`  Foundation Updates: ${this.config.acceptPatterns.foundationUpdates ? '✅' : '❌'}`);
    console.log(`  All Prompts: ${this.config.acceptPatterns.allPrompts ? '✅' : '❌'}`);
    
    // Check if Claude Code is configured
    await this.checkClaudeIntegration();
  }
  
  private async checkClaudeIntegration(): Promise<void> {
    console.log('\n🔗 Claude Code Integration:');
    
    // Check for claude.json
    const claudeConfigPath = path.join(os.homedir(), '.config', 'claude', 'claude.json');
    try {
      const config = await fs.readFile(claudeConfigPath, 'utf-8');
      const parsed = JSON.parse(config);
      console.log(`  Config File: ✅ (auto-accept: ${parsed.autoAcceptEdits})`);
    } catch {
      console.log('  Config File: ❌ Not found');
    }
    
    // Check environment variables
    const envVars = [
      'CLAUDE_AUTO_ACCEPT_EDITS',
      'CLAUDE_AUTO_ACCEPT_PROMPTS',
      'CLAUDE_SUPPRESS_CONFIRMATIONS'
    ];
    
    console.log('  Environment Variables:');
    for (const varName of envVars) {
      const value = process.env[varName];
      console.log(`    ${varName}: ${value ? '✅' : '❌'}`);
    }
  }
  
  async setupDevelopmentEnvironment(): Promise<void> {
    console.log('🛠️  Setting up development environment...');
    
    // Create shell profile additions
    const profileAdditions = `
# SessionHub Claude Code Auto-Accept
if [ -f ~/.sessionhub/claude-env.sh ]; then
  source ~/.sessionhub/claude-env.sh
fi
`;
    
    // Add to common shell profiles
    const profiles = ['.bashrc', '.zshrc', '.bash_profile'];
    const homeDir = os.homedir();
    
    for (const profile of profiles) {
      const profilePath = path.join(homeDir, profile);
      try {
        const content = await fs.readFile(profilePath, 'utf-8');
        if (!content.includes('SessionHub Claude Code Auto-Accept')) {
          await fs.appendFile(profilePath, profileAdditions);
          console.log(`  ✅ Updated ${profile}`);
        } else {
          console.log(`  ⏭️  ${profile} already configured`);
        }
      } catch {
        // Profile doesn't exist, skip
      }
    }
    
    // Create VS Code settings
    const vscodeSettingsPath = path.join(
      homeDir,
      '.config',
      'Code',
      'User',
      'settings.json'
    );
    
    try {
      const settingsDir = path.dirname(vscodeSettingsPath);
      await fs.mkdir(settingsDir, { recursive: true });
      
      let settings = {};
      try {
        const existing = await fs.readFile(vscodeSettingsPath, 'utf-8');
        settings = JSON.parse(existing);
      } catch {
        // No existing settings
      }
      
      // Add Claude Code settings
      (settings as any)['claude.autoAcceptEdits'] = true;
      (settings as any)['claude.suppressConfirmations'] = true;
      
      await fs.writeFile(
        vscodeSettingsPath,
        JSON.stringify(settings, null, 2)
      );
      console.log('  ✅ Updated VS Code settings');
    } catch (err) {
      console.log('  ⚠️  Could not update VS Code settings:', (err as Error).message);
    }
    
    console.log('\n✅ Development environment setup complete!');
    console.log('💡 Restart your terminal for changes to take effect');
  }
  
  async createLaunchScript(): Promise<void> {
    // Create a launch script that ensures auto-accept is enabled
    const scriptPath = path.join(os.homedir(), '.sessionhub', 'launch-claude.sh');
    const scriptContent = `#!/bin/bash
# Launch Claude Code with auto-accept enabled

# Source environment variables
if [ -f ~/.sessionhub/claude-env.sh ]; then
  source ~/.sessionhub/claude-env.sh
fi

# Enable auto-accept for this session
echo "🚀 Launching Claude Code with auto-accept enabled..."
${process.execPath} ${__filename} enable

# Launch Claude Code (adjust path as needed)
if command -v claude &> /dev/null; then
  claude "$@"
elif [ -d "/Applications/Claude.app" ]; then
  open -a "Claude" "$@"
else
  echo "❌ Claude Code not found. Please install it first."
  exit 1
fi
`;
    
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, '755');
    
    console.log(`✅ Created launch script: ${scriptPath}`);
    console.log('💡 Use this script to launch Claude Code with auto-accept enabled');
  }
}

// CLI Interface
async function main() {
  const manager = new ClaudeAutoAcceptManager();
  await manager.initialize();
  
  const command = process.argv[2];
  const sessionId = process.argv[3];
  
  switch (command) {
    case 'enable':
      await manager.enableAutoAccept(sessionId);
      break;
      
    case 'disable':
      await manager.disableAutoAccept();
      break;
      
    case 'status':
      await manager.getStatus();
      break;
      
    case 'setup':
      await manager.setupDevelopmentEnvironment();
      await manager.createLaunchScript();
      break;
      
    case 'launch':
      await manager.enableAutoAccept();
      await manager.createLaunchScript();
      break;
      
    default:
      console.log('Claude Code Auto-Accept Manager');
      console.log('================================');
      console.log('Usage:');
      console.log('  enable [sessionId]  - Enable auto-accept (optionally for specific session)');
      console.log('  disable            - Disable auto-accept');
      console.log('  status             - Show current status');
      console.log('  setup              - Setup development environment');
      console.log('  launch             - Create launch script');
      break;
  }
}

// Export for use in SessionHub
export { ClaudeAutoAcceptManager };
export type { AutoAcceptConfig };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}