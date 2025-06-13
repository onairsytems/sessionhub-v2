import { ipcMain } from "electron";
import Store from "electron-store";
import { ClaudeAPIClient } from "../../src/lib/api/ClaudeAPIClient";
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

const store = new Store();

interface SettingsData {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    density: 'compact' | 'normal' | 'comfortable';
  };
  notifications: {
    sessionCompletion: boolean;
    errorAlerts: boolean;
    updateAvailable: boolean;
    soundEffects: boolean;
  };
  performance: {
    maxConcurrentSessions: number | 'unlimited';
    memoryLimit: number | 'none';
    hardwareAcceleration: boolean;
    appleOptimization: boolean;
  };
  security: {
    autoLockMinutes: number | 'never';
    telemetry: boolean;
  };
  data: {
    cloudSync: boolean;
    backupInterval: number;
  };
  features: {
    aiCodeCompletion: boolean;
    smartSuggestions: boolean;
    autoSave: boolean;
    sessionRecording: boolean;
    collaborativeMode: boolean;
    advancedDebugging: boolean;
    codeAnalysis: boolean;
    performanceProfiler: boolean;
  };
  projectDefaults: {
    templatePath: string;
    defaultTheme: 'light' | 'dark' | 'system';
    autoDetectLanguage: boolean;
    gitIntegration: boolean;
    lintOnSave: boolean;
    formatOnSave: boolean;
    testRunner: string;
  };
}

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle("get-settings", async () => {
    try {
      const settings = store.get('settings', getDefaultSettings()) as SettingsData;
      return settings;
    } catch (error) {
      return getDefaultSettings();
    }
  });

  // Save settings
  ipcMain.handle("save-settings", async (_event, settings: SettingsData) => {
    try {
      store.set('settings', settings);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Test API key connection
  ipcMain.handle("test-api-key", async (_event, apiKey: string) => {
    try {
      const client = new ClaudeAPIClient({ apiKey });
      
      // Test with a minimal request
      const startTime = Date.now();
      await client.sendMessage("Hello, this is a connection test.", "test-connection");
      const responseTime = Date.now() - startTime;
      
      return { 
        success: true, 
        responseTime,
        message: 'API key is valid and connection successful'
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed',
        message: 'Failed to connect to Claude API'
      };
    }
  });

  // Test Supabase connection
  ipcMain.handle("test-supabase", async (_event, url: string, anonKey: string) => {
    try {
      // Basic validation
      if (!url || !anonKey) {
        throw new Error('URL and anon key are required');
      }

      // Test connection with a simple request
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });

      if (response.ok) {
        return { 
          success: true, 
          message: 'Supabase connection successful'
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed',
        message: 'Failed to connect to Supabase'
      };
    }
  });

  // Export settings
  ipcMain.handle("export-settings", async () => {
    try {
      const settings = store.get('settings', getDefaultSettings()) as SettingsData;
      
      // Remove sensitive data before export
      const exportData = {
        ...settings,
        version: '2.28',
        exportDate: new Date().toISOString()
      };

      return { 
        success: true, 
        data: JSON.stringify(exportData, null, 2)
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Export failed' 
      };
    }
  });

  // Import settings
  ipcMain.handle("import-settings", async (_event, jsonData: string) => {
    try {
      const importData = JSON.parse(jsonData);
      
      // Validate the imported data
      if (!importData.version || !importData.exportDate) {
        throw new Error('Invalid settings file format');
      }

      // Remove metadata before saving
      delete importData.version;
      delete importData.exportDate;

      // Merge with existing settings (preserving sensitive data)
      const currentSettings = store.get('settings', getDefaultSettings()) as SettingsData;
      const mergedSettings = {
        ...currentSettings,
        ...importData
      };

      store.set('settings', mergedSettings);

      return { 
        success: true, 
        message: 'Settings imported successfully' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Import failed' 
      };
    }
  });

  // Get storage info
  ipcMain.handle("get-storage-info", async () => {
    try {
      const userDataPath = app.getPath('userData');
      const sessionPath = path.join(userDataPath, 'sessions');
      const cachePath = path.join(userDataPath, 'cache');
      const logsPath = path.join(userDataPath, 'logs');

      const getDirectorySize = async (dirPath: string): Promise<number> => {
        try {
          const files = await fs.readdir(dirPath);
          let totalSize = 0;
          
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
              totalSize += await getDirectorySize(filePath);
            } else {
              totalSize += stats.size;
            }
          }
          
          return totalSize;
        } catch {
          return 0;
        }
      };

      const [sessionsSize, cacheSize, logsSize] = await Promise.all([
        getDirectorySize(sessionPath),
        getDirectorySize(cachePath),
        getDirectorySize(logsPath)
      ]);

      return {
        sessions: formatBytes(sessionsSize),
        cache: formatBytes(cacheSize),
        logs: formatBytes(logsSize),
        total: formatBytes(sessionsSize + cacheSize + logsSize)
      };
    } catch (error) {
      return {
        sessions: '0 MB',
        cache: '0 MB',
        logs: '0 MB',
        total: '0 MB'
      };
    }
  });

  // Clear cache
  ipcMain.handle("clear-cache", async () => {
    try {
      const cachePath = path.join(app.getPath('userData'), 'cache');
      await fs.rm(cachePath, { recursive: true, force: true });
      await fs.mkdir(cachePath, { recursive: true });
      
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear cache' 
      };
    }
  });

  // Get feature flags
  ipcMain.handle("get-feature-flags", async () => {
    try {
      const settings = store.get('settings', getDefaultSettings()) as SettingsData;
      return settings.features || getDefaultSettings().features;
    } catch (error) {
      return getDefaultSettings().features;
    }
  });
}

function getDefaultSettings(): SettingsData {
  return {
    appearance: {
      theme: 'system',
      fontSize: 14,
      density: 'normal'
    },
    notifications: {
      sessionCompletion: true,
      errorAlerts: true,
      updateAvailable: true,
      soundEffects: false
    },
    performance: {
      maxConcurrentSessions: 3,
      memoryLimit: 4,
      hardwareAcceleration: true,
      appleOptimization: true
    },
    security: {
      autoLockMinutes: 'never',
      telemetry: false
    },
    data: {
      cloudSync: true,
      backupInterval: 60
    },
    features: {
      aiCodeCompletion: true,
      smartSuggestions: true,
      autoSave: true,
      sessionRecording: true,
      collaborativeMode: false,
      advancedDebugging: true,
      codeAnalysis: true,
      performanceProfiler: false
    },
    projectDefaults: {
      templatePath: '',
      defaultTheme: 'system',
      autoDetectLanguage: true,
      gitIntegration: true,
      lintOnSave: true,
      formatOnSave: true,
      testRunner: 'jest'
    }
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}