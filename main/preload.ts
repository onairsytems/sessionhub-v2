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

  // Session Pipeline API
  executeSession: (request: any) => Promise<any>;
  importDocuments: (filePaths: string[]) => Promise<any>;
  importGoogleDocs: (docUrl: string) => Promise<any>;
  analyzeDocument: (documentMetadata: any) => Promise<any>;
  analyzeDocumentSet: (documents: any[]) => Promise<any>;
  getSession: (sessionId: string) => Promise<any>;
  getUserSessions: (userId: string) => Promise<any>;
  getSessionMetrics: () => Promise<any>;
  selectDocuments: () => Promise<any>;
  getFileInfo: (filePath: string) => Promise<any>;
  onSessionProgress: (callback: (data: any) => void) => void;
  removeSessionProgressListener: (callback: (data: any) => void) => void;

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

  // Session Pipeline API
  executeSession: (request: any) => ipcRenderer.invoke("session:execute", request),
  importDocuments: (filePaths: string[]) => ipcRenderer.invoke("document:import", filePaths),
  importGoogleDocs: (docUrl: string) => ipcRenderer.invoke("document:importGoogleDocs", docUrl),
  analyzeDocument: (documentMetadata: any) => ipcRenderer.invoke("document:analyze", documentMetadata),
  analyzeDocumentSet: (documents: any[]) => ipcRenderer.invoke("document:analyzeSet", documents),
  getSession: (sessionId: string) => ipcRenderer.invoke("session:get", sessionId),
  getUserSessions: (userId: string) => ipcRenderer.invoke("session:getUserSessions", userId),
  getSessionMetrics: () => ipcRenderer.invoke("session:getMetrics"),
  selectDocuments: () => ipcRenderer.invoke("dialog:selectDocuments"),
  getFileInfo: (filePath: string) => ipcRenderer.invoke("file:getInfo", filePath),
  onSessionProgress: (callback: (data: any) => void) => {
    ipcRenderer.on("session:progress", (_event, data) => callback(data));
  },
  removeSessionProgressListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener("session:progress", callback);
  },

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

  // Context Management API
  analyzeProjectContext: (projectId: string, projectPath: string) => 
    ipcRenderer.invoke("analyze-project-context", projectId, projectPath),
  getProjectContext: (projectId: string) => 
    ipcRenderer.invoke("get-project-context", projectId),
  searchSimilarContexts: (projectId: string, limit?: number) => 
    ipcRenderer.invoke("search-similar-contexts", projectId, limit),
  getPatterns: (projectId?: string) => 
    ipcRenderer.invoke("get-patterns", projectId),
  learnPattern: (pattern: {
    type: string;
    pattern: string;
    example: string;
    projectId: string;
  }) => ipcRenderer.invoke("learn-pattern", pattern),
  refreshContextCache: (projectId: string) => 
    ipcRenderer.invoke("refresh-context-cache", projectId),
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
  
  // Session Pipeline API (also available via electronAPI)
  executeSession: (request: any) => ipcRenderer.invoke("session:execute", request),
  importDocuments: (filePaths: string[]) => ipcRenderer.invoke("document:import", filePaths),
  importGoogleDocs: (docUrl: string) => ipcRenderer.invoke("document:importGoogleDocs", docUrl),
  analyzeDocument: (documentMetadata: any) => ipcRenderer.invoke("document:analyze", documentMetadata),
  analyzeDocumentSet: (documents: any[]) => ipcRenderer.invoke("document:analyzeSet", documents),
  getSession: (sessionId: string) => ipcRenderer.invoke("session:get", sessionId),
  getUserSessions: (userId: string) => ipcRenderer.invoke("session:getUserSessions", userId),
  getSessionMetrics: () => ipcRenderer.invoke("session:getMetrics"),
  selectDocuments: () => ipcRenderer.invoke("dialog:selectDocuments"),
  getFileInfo: (filePath: string) => ipcRenderer.invoke("file:getInfo", filePath),
  onSessionProgress: (callback: (data: any) => void) => {
    ipcRenderer.on("session:progress", (_event, data) => callback(data));
  },
  removeSessionProgressListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener("session:progress", callback);
  },

  // MCP Server API
  mcp: {
    // Server management
    startServer: () => ipcRenderer.invoke("mcp:server:start"),
    stopServer: () => ipcRenderer.invoke("mcp:server:stop"),
    getServerStatus: () => ipcRenderer.invoke("mcp:server:status"),
    
    // Integration management
    listIntegrations: () => ipcRenderer.invoke("mcp:integrations:list"),
    registerIntegration: (integration: any) => 
      ipcRenderer.invoke("mcp:integrations:register", integration),
    unregisterIntegration: (id: string) => 
      ipcRenderer.invoke("mcp:integrations:unregister", id),
    
    // Tool execution
    executeTool: (integrationId: string, tool: string, params: any) => 
      ipcRenderer.invoke("mcp:tool:execute", integrationId, tool, params),
    testTool: (integrationId: string, tool: string, params: any) => 
      ipcRenderer.invoke("mcp:tool:test", integrationId, tool, params),
    
    // Marketplace
    marketplace: {
      search: (options: any) => ipcRenderer.invoke("mcp:marketplace:search", options),
      getFeatured: () => ipcRenderer.invoke("mcp:marketplace:getFeatured"),
      getTrending: () => ipcRenderer.invoke("mcp:marketplace:getTrending"),
      getIntegration: (id: string) => ipcRenderer.invoke("mcp:marketplace:getIntegration", id),
      install: (integrationId: string) => ipcRenderer.invoke("mcp:marketplace:install", integrationId),
      getCategories: () => ipcRenderer.invoke("mcp:marketplace:getCategories"),
    },
    
    // Events
    onIntegrationRegistered: (callback: (integration: any) => void) => {
      ipcRenderer.on("mcp:event:integration:registered", (_event, integration) => callback(integration));
    },
    onIntegrationUnregistered: (callback: (integration: any) => void) => {
      ipcRenderer.on("mcp:event:integration:unregistered", (_event, integration) => callback(integration));
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on("mcp:event:error", (_event, error) => callback(error));
    },
  },
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

  // Zed IDE Integration
  zed: {
    // Connection Management
    storeCredentials: (credentials: { email: string; apiToken: string }) =>
      ipcRenderer.invoke("zed:store-credentials", credentials),
    testConnection: () => ipcRenderer.invoke("zed:test-connection"),
    getConnectionHealth: () => ipcRenderer.invoke("zed:get-connection-health"),
    reconnect: () => ipcRenderer.invoke("zed:reconnect"),
    
    // IDE Operations
    connect: () => ipcRenderer.invoke("zed:connect"),
    disconnect: () => ipcRenderer.invoke("zed:disconnect"),
    openWorkspace: (workspacePath: string) => 
      ipcRenderer.invoke("zed:open-workspace", workspacePath),
    getWorkspaceInfo: () => ipcRenderer.invoke("zed:get-workspace-info"),
    openFile: (filePath: string) => ipcRenderer.invoke("zed:open-file", filePath),
    saveFile: (filePath: string, content: string) => 
      ipcRenderer.invoke("zed:save-file", filePath, content),
    
    // Two-Actor Integration
    sendToExecution: (instruction: string, context: any) =>
      ipcRenderer.invoke("zed:send-to-execution", instruction, context),
    getExecutionStatus: () => ipcRenderer.invoke("zed:get-execution-status"),
    getActorStatus: () => ipcRenderer.invoke("zed:get-actor-status"),
    syncActors: () => ipcRenderer.invoke("zed:sync-actors"),
    
    // Git Operations
    getGitStatus: () => ipcRenderer.invoke("zed:git-status"),
    stageFiles: (files: string[]) => ipcRenderer.invoke("zed:stage-files", files),
    commit: (message: string) => ipcRenderer.invoke("zed:commit", message),
    
    // Quality Gates
    runLinter: () => ipcRenderer.invoke("zed:run-linter"),
    runTypeCheck: () => ipcRenderer.invoke("zed:run-typecheck"),
    
    // Utility
    openExternal: (url: string) => ipcRenderer.invoke("zed:open-external", url),
  },
  
  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("zed:open-external", url),
  },
  
  // Generic API operations
  api: {
    on: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(channel, callback);
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, callback);
    },
    showNotification: (options: { title: string; body: string; type?: string }) => {
      ipcRenderer.send("show-notification", options);
    },
  },
  
  // Project operations (needed by ZedProjectSwitcher)
  projects: {
    list: () => ipcRenderer.invoke("get-projects"),
  },
});

// Export empty object to make this a module
export {};
