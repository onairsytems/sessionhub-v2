
/**
 * Mac-specific configuration for SessionHub local app
 */

import * as os from 'os';
import * as path from 'path';

// Mac app paths following Apple's guidelines
const homeDir = os.homedir();
const appName = 'SessionHub';

export const MAC_CONFIG = {
  // Application directories
  paths: {
    // ~/Library/Application Support/SessionHub/
    appSupport: path.join(homeDir, 'Library', 'Application Support', appName),
    
    // ~/Library/Logs/SessionHub/
    logs: path.join(homeDir, 'Library', 'Logs', appName),
    
    // ~/Library/Caches/SessionHub/
    cache: path.join(homeDir, 'Library', 'Caches', appName),
    
    // ~/Library/Preferences/
    preferences: path.join(homeDir, 'Library', 'Preferences'),
    
    // Temporary files
    temp: path.join(os.tmpdir(), appName),
    
    // Database files
    database: path.join(homeDir, 'Library', 'Application Support', appName, 'database'),
    
    // Session history
    sessions: path.join(homeDir, 'Library', 'Application Support', appName, 'sessions'),
    
    // Snapshots
    snapshots: path.join(homeDir, 'Library', 'Application Support', appName, 'snapshots')
  },
  
  // Process configuration
  process: {
    // Max concurrent sessions based on system resources
    maxConcurrentSessions: Math.max(2, Math.floor(os.cpus().length / 2)),
    
    // Memory limits (MB)
    maxMemoryPerSession: 512,
    
    // CPU usage limits (percentage)
    maxCpuPerSession: 50,
    
    // Process nice value for background operations
    backgroundNiceValue: 10
  },
  
  // Security configuration
  security: {
    // Use Mac Keychain for credentials
    useKeychain: true,
    
    // App sandbox enabled
    sandboxed: true,
    
    // Hardened runtime
    hardenedRuntime: true,
    
    // Code signing identity
    codeSigningIdentity: process.env['CODE_SIGN_IDENTITY'] || 'Developer ID Application',
    
    // Notarization
    notarize: process.env['NODE_ENV'] === 'production'
  },
  
  // UI configuration
  ui: {
    // Menu bar app
    showInMenuBar: true,
    
    // Dock icon
    showInDock: true,
    
    // Launch at login
    launchAtLogin: false,
    
    // System theme following
    followSystemTheme: true
  },
  
  // Integration configuration
  integration: {
    // Spotlight indexing
    enableSpotlight: true,
    
    // Shortcuts app support
    enableShortcuts: true,
    
    // Universal clipboard
    enableUniversalClipboard: true,
    
    // Time Machine exclusions
    excludeFromTimeMachine: ['cache', 'temp']
  },
  
  // Auto-update configuration
  autoUpdate: {
    enabled: true,
    checkInterval: 3600000, // 1 hour
    updateUrl: process.env['UPDATE_URL'] || 'https://updates.sessionhub.app'
  }
};

// Helper to ensure directories exist
export async function ensureMacDirectories(): Promise<void> {
  const fs = await import('fs/promises');
  
  for (const [_key, dirPath] of Object.entries(MAC_CONFIG.paths)) {
    if (typeof dirPath === 'string') {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}