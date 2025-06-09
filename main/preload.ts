/**
 * Electron Preload Script
 * Provides secure bridge between main process and renderer
 */

import { contextBridge, ipcRenderer } from "electron";

// Define the API interface
interface SessionHubAPI {
  // System operations
  getSystemHealth: () => Promise<{
    status: string;
    uptime: number;
    timestamp: string;
    checks: Array<{ name: string; status: string; message: string }>;
  }>;
  getSelfDevelopmentStatus: () => Promise<{
    operational: boolean;
    message: string;
  }>;
  getProductionMetrics: () => Promise<{
    uptime: number;
    memory: NodeJS.MemoryUsage;
    timestamp: string;
  }>;
  triggerTestIssue: () => Promise<{ success: boolean; message: string }>;

  // Session management
  createNewSession: () => void;

  // API Configuration
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (apiKey: string) => Promise<boolean>;
  saveApiKey: (apiKey: string) => Promise<void>;

  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => Promise<string>;

  // GitHub integration
  selectGitHubRepo: () => Promise<{
    url: string;
    name: string;
    owner: string;
    defaultBranch: string;
  } | null>;
  analyzeRepository: (
    sessionId: string,
    repoInfo: {
      url: string;
      name: string;
      owner: string;
      defaultBranch: string;
    }
  ) => Promise<string>;

  // Supabase operations
  configureSupabase: (config: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  checkSupabaseConnection: () => Promise<{
    isConnected: boolean;
    isInitialized: boolean;
    error?: string;
  }>;
  getSupabaseConfig: () => Promise<{
    hasConfig: boolean;
    url?: string;
    hasServiceKey?: boolean;
    error?: string;
  }>;
  initSupabase: () => Promise<{ success: boolean; error?: string }>;
  createProject: (project: {
    name: string;
    path: string;
    type: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ success: boolean; project?: unknown; error?: string }>;
  getProjects: () => Promise<{
    success: boolean;
    projects: unknown[];
    error?: string;
  }>;
  createSession: (session: {
    user_id: string;
    project_id: string;
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ success: boolean; session?: unknown; error?: string }>;
  updateSessionStatus: (
    sessionId: string,
    status: string
  ) => Promise<{ success: boolean; session?: unknown; error?: string }>;
  getActiveSessions: () => Promise<{
    success: boolean;
    sessions: unknown[];
    error?: string;
  }>;
  getSessionStats: (
    sessionId?: string
  ) => Promise<{ success: boolean; stats: unknown[]; error?: string }>;

  // Event listeners
  onNewSession: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // Auto-updater
  checkForUpdates: () => Promise<{
    checking: boolean;
    available: boolean;
    downloading: boolean;
    downloaded: boolean;
    error: Error | null;
    progress: any | null;
    updateInfo: any | null;
  }>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;

  // File associations
  saveProjectFile: (projectData: any, savePath?: string) => Promise<string>;

  // Preferences
  setPreference: (key: string, value: any) => Promise<void>;
  getPreference: (key: string) => Promise<any>;

  // Session state
  saveSession: (sessionData: any) => Promise<void>;

  // Menu bar
  updateMenuBarStatus: (status: any) => void;

  // Event handlers for navigation and file operations
  onNavigate: (callback: (path: string) => void) => void;
  onOpenProject: (callback: (data: any) => void) => void;
  onFileOpened: (callback: (data: any) => void) => void;
  onRestoreSession: (callback: (sessionData: any) => void) => void;
  onForceSync: (callback: () => void) => void;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onDownloadProgress: (callback: (progress: any) => void) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("sessionhub", {
  // System health and monitoring
  getSystemHealth: () => ipcRenderer.invoke("get-system-health"),
  getSelfDevelopmentStatus: () => ipcRenderer.invoke("get-self-development-status"),
  getProductionMetrics: () => ipcRenderer.invoke("get-production-metrics"),
  triggerTestIssue: () => ipcRenderer.invoke("trigger-test-issue"),

  // Session management
  createNewSession: () => ipcRenderer.send("new-session"),

  // API Configuration
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) => ipcRenderer.invoke("validate-api-key", apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),

  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => ipcRenderer.invoke("send-chat-message", sessionId, message),

  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke("select-github-repo"),
  analyzeRepository: (sessionId: string,
    repoInfo: {
      url: string;
      name: string;
      owner: string;
      defaultBranch: string;
    },
  ) => ipcRenderer.invoke("analyze-repository", sessionId, repoInfo),

  // Supabase operations
  configureSupabase: (config: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  }) => ipcRenderer.invoke("configure-supabase", config),
  checkSupabaseConnection: () => ipcRenderer.invoke("check-supabase-connection"),
  getSupabaseConfig: () => ipcRenderer.invoke("get-supabase-config"),
  initSupabase: () => ipcRenderer.invoke("init-supabase"),
  createProject: (project: {
    name: string;
    path: string;
    type: string;
    metadata?: Record<string, unknown>;
  }) => ipcRenderer.invoke("create-project", project),
  getProjects: () => ipcRenderer.invoke("get-projects"),
  createSession: (session: {
    user_id: string;
    project_id: string;
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) => ipcRenderer.invoke("create-session", session),
  updateSessionStatus: (sessionId: string, status: string) => ipcRenderer.invoke("update-session-status", sessionId, status),
  getActiveSessions: () => ipcRenderer.invoke("get-active-sessions"),
  getSessionStats: (sessionId?: string) => ipcRenderer.invoke("get-session-stats", sessionId),

  // Event listeners
  onNewSession: (callback: () => void) => {
    ipcRenderer.on("new-session", callback);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  // File associations
  saveProjectFile: (projectData: any, savePath?: string) => 
    ipcRenderer.invoke("save-project-file", projectData, savePath),

  // Preferences
  setPreference: (key: string, value: any) => 
    ipcRenderer.invoke("set-preference", key, value),
  getPreference: (key: string) => 
    ipcRenderer.invoke("get-preference", key),

  // Session state
  saveSession: (sessionData: any) => 
    ipcRenderer.invoke("save-session", sessionData),

  // Menu bar
  updateMenuBarStatus: (status: any) => 
    ipcRenderer.invoke("update-menu-bar-status", status),

  // Event handlers
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate", (_event, path) => callback(path));
  },
  onOpenProject: (callback: (data: any) => void) => {
    ipcRenderer.on("open-project", (_event, data) => callback(data));
  },
  onFileOpened: (callback: (data: any) => void) => {
    ipcRenderer.on("file-opened", (_event, data) => callback(data));
  },
  onRestoreSession: (callback: (sessionData: any) => void) => {
    ipcRenderer.on("restore-session", (_event, sessionData) => callback(sessionData));
  },
  onForceSync: (callback: () => void) => {
    ipcRenderer.on("force-sync", callback);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on("download-progress", (_event, progress) => callback(progress));
  },
} as SessionHubAPI);

// Also expose electronAPI for compatibility
contextBridge.exposeInMainWorld("electronAPI", {
  // Claude Auto-Accept API
  claude: {
    getAutoAcceptSettings: () => ipcRenderer.invoke('claude:get-auto-accept-settings'),
    setAutoAcceptSettings: (settings: any) => ipcRenderer.invoke('claude:set-auto-accept-settings', settings),
    enableForSession: (sessionId: string) => ipcRenderer.invoke('claude:enable-for-session', sessionId),
  },
  
  // API Configuration
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) => ipcRenderer.invoke("validate-api-key", apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),

  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => ipcRenderer.invoke("send-chat-message", sessionId, message),

  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke("select-github-repo"),
  analyzeRepository: (sessionId: string,
    repoInfo: {
      url: string;
      name: string;
      owner: string;
      defaultBranch: string;
    },
  ) => ipcRenderer.invoke("analyze-repository", sessionId, repoInfo),

  // Supabase operations (also available via electronAPI for compatibility)
  configureSupabase: (config: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  }) => ipcRenderer.invoke("configure-supabase", config),
  checkSupabaseConnection: () => ipcRenderer.invoke("check-supabase-connection"),
  getSupabaseConfig: () => ipcRenderer.invoke("get-supabase-config"),
  initSupabase: () => ipcRenderer.invoke("init-supabase"),
  createProject: (project: {
    name: string;
    path: string;
    type: string;
    metadata?: Record<string, unknown>;
  }) => ipcRenderer.invoke("create-project", project),
  getProjects: () => ipcRenderer.invoke("get-projects"),
});

// Expose electron API for session progress
contextBridge.exposeInMainWorld("electron", {
  onSessionProgress: (callback: () => void) => {
    return new Promise<() => void>((resolve) => {
      ipcRenderer.on("session-progress", callback);
      resolve(() => ipcRenderer.removeAllListeners("session-progress"));
    });
  },
  getSessionStatus: (sessionId: string) => ipcRenderer.invoke("get-session-status", sessionId),
  
  // Figma MCP Integration
  figma: {
    checkConnection: () => ipcRenderer.invoke("figma:check-connection"),
    getApiKey: () => ipcRenderer.invoke("figma:get-api-key"),
    initialize: (apiKey: string) => ipcRenderer.invoke("figma:initialize", apiKey),
    
    // SessionHub UI Update
    startSessionHubUIUpdate: (figmaFileKey: string) => 
      ipcRenderer.invoke("figma:start-sessionhub-ui-update", figmaFileKey),
    getUpdateStatus: (sessionId: string) => 
      ipcRenderer.invoke("figma:get-update-status", sessionId),
    previewUIChanges: (figmaFileKey: string) => 
      ipcRenderer.invoke("figma:preview-ui-changes", figmaFileKey),
    createUIPullRequest: (figmaFileKey: string, description: string) => 
      ipcRenderer.invoke("figma:create-ui-pull-request", figmaFileKey, description),
    applyUIChanges: (sessionId: string) => 
      ipcRenderer.invoke("figma:apply-ui-changes", sessionId),
    
    // Project UI Enhancement
    registerProject: (project: any) => 
      ipcRenderer.invoke("figma:register-project", project),
    startProjectUIUpdate: (projectId: string, figmaFileKey: string) => 
      ipcRenderer.invoke("figma:start-project-ui-update", projectId, figmaFileKey),
    getEnhancementStatus: (sessionId: string) => 
      ipcRenderer.invoke("figma:get-enhancement-status", sessionId),
    mergeUIChanges: (sessionId: string) => 
      ipcRenderer.invoke("figma:merge-ui-changes", sessionId),
    getFigmaEnabledProjects: () => 
      ipcRenderer.invoke("figma:get-figma-enabled-projects"),
    
    // Watch and Components
    watchFile: (figmaFileKey: string) => 
      ipcRenderer.invoke("figma:watch-file", figmaFileKey),
    getComponentsNeedingUpdate: () => 
      ipcRenderer.invoke("figma:get-components-needing-update"),
  },
});

// Export empty object to make this a module
export {};
