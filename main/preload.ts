/**
 * Electron Preload Script
 * Provides secure bridge between main process and renderer
 */

import { contextBridge, ipcRenderer } from "electron";

// Define types for various data structures
interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: Error | null;
  progress: UpdateProgress | null;
  updateInfo: UpdateInfo | null;
}

interface FileOpenedData {
  filePath: string;
  fileType: string;
  projectPath?: string;
}

interface ProjectData {
  id: string;
  name: string;
  path: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface SessionData {
  id: string;
  userId: string;
  projectId: string;
  title?: string;
  description?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

interface SessionProgressData {
  sessionId: string;
  progress: {
    phase: string;
    status: string;
    percentage: number;
    message?: string;
  };
}

interface DocumentMetadata {
  path: string;
  name: string;
  type: string;
  size: number;
  content?: string;
}

interface MenuBarStatus {
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSync?: Date;
  error?: string;
}

interface SessionRequest {
  userId: string;
  projectId: string;
  objective: string;
  context?: Record<string, unknown>;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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
  }) => Promise<{ success: boolean; project?: ProjectData; error?: string }>;
  getProjects: () => Promise<{
    success: boolean;
    projects: ProjectData[];
    error?: string;
  }>;
  createSession: (session: {
    user_id: string;
    project_id: string;
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ success: boolean; session?: SessionData; error?: string }>;
  updateSessionStatus: (
    sessionId: string,
    status: string
  ) => Promise<{ success: boolean; session?: SessionData; error?: string }>;
  getActiveSessions: () => Promise<{
    success: boolean;
    sessions: SessionData[];
    error?: string;
  }>;
  getSessionStats: (
    sessionId?: string
  ) => Promise<{ success: boolean; stats: unknown[]; error?: string }>;

  // Event listeners
  onNewSession: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // Auto-updater
  checkForUpdates: () => Promise<UpdateStatus>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;

  // File associations
  saveProjectFile: (projectData: ProjectData, savePath?: string) => Promise<string>;

  // Preferences
  setPreference: (key: string, value: unknown) => Promise<void>;
  getPreference: (key: string) => Promise<unknown>;

  // Session state
  saveSession: (sessionData: SessionData) => Promise<void>;

  // Menu bar
  updateMenuBarStatus: (status: MenuBarStatus) => void;

  // Session Pipeline API
  executeSession: (request: SessionRequest) => Promise<APIResponse<SessionData>>;
  importDocuments: (filePaths: string[]) => Promise<APIResponse<DocumentMetadata[]>>;
  importGoogleDocs: (docUrl: string) => Promise<APIResponse<DocumentMetadata>>;
  analyzeDocument: (documentMetadata: DocumentMetadata) => Promise<APIResponse<unknown>>;
  analyzeDocumentSet: (documents: DocumentMetadata[]) => Promise<APIResponse<unknown>>;
  getSession: (sessionId: string) => Promise<APIResponse<SessionData>>;
  getUserSessions: (userId: string) => Promise<APIResponse<SessionData[]>>;
  getSessionMetrics: () => Promise<APIResponse<unknown>>;
  selectDocuments: () => Promise<string[] | null>;
  getFileInfo: (filePath: string) => Promise<DocumentMetadata>;
  onSessionProgress: (callback: (data: SessionProgressData) => void) => void;
  removeSessionProgressListener: (callback: (data: SessionProgressData) => void) => void;

  // Event handlers for navigation and file operations
  onNavigate: (callback: (path: string) => void) => void;
  onOpenProject: (callback: (data: ProjectData) => void) => void;
  onFileOpened: (callback: (data: FileOpenedData) => void) => void;
  onRestoreSession: (callback: (sessionData: SessionData) => void) => void;
  onForceSync: (callback: () => void) => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: UpdateProgress) => void) => void;
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
  installUpdate: () => void ipcRenderer.invoke("install-update"),

  // File associations
  saveProjectFile: (projectData: ProjectData, savePath?: string) => 
    ipcRenderer.invoke("save-project-file", projectData, savePath),

  // Preferences
  setPreference: (key: string, value: unknown) => 
    ipcRenderer.invoke("set-preference", key, value),
  getPreference: (key: string) => 
    ipcRenderer.invoke("get-preference", key),

  // Session state
  saveSession: (sessionData: SessionData) => 
    ipcRenderer.invoke("save-session", sessionData),

  // Menu bar
  updateMenuBarStatus: (status: MenuBarStatus) => 
    void ipcRenderer.invoke("update-menu-bar-status", status),

  // Session Pipeline API
  executeSession: (request: SessionRequest) => ipcRenderer.invoke("session:execute", request),
  importDocuments: (filePaths: string[]) => ipcRenderer.invoke("document:import", filePaths),
  importGoogleDocs: (docUrl: string) => ipcRenderer.invoke("document:importGoogleDocs", docUrl),
  analyzeDocument: (documentMetadata: DocumentMetadata) => ipcRenderer.invoke("document:analyze", documentMetadata),
  analyzeDocumentSet: (documents: DocumentMetadata[]) => ipcRenderer.invoke("document:analyzeSet", documents),
  getSession: (sessionId: string) => ipcRenderer.invoke("session:get", sessionId),
  getUserSessions: (userId: string) => ipcRenderer.invoke("session:getUserSessions", userId),
  getSessionMetrics: () => ipcRenderer.invoke("session:getMetrics"),
  selectDocuments: () => ipcRenderer.invoke("dialog:selectDocuments"),
  getFileInfo: (filePath: string) => ipcRenderer.invoke("file:getInfo", filePath),
  onSessionProgress: (callback: (data: SessionProgressData) => void) => {
    ipcRenderer.on("session:progress", (_event, data) => callback(data));
  },
  removeSessionProgressListener: (callback: (data: SessionProgressData) => void) => {
    // Create a wrapper function to match the expected signature
    const wrapper = (_event: any, data: SessionProgressData) => callback(data);
    ipcRenderer.removeListener("session:progress", wrapper);
  },

  // Event handlers
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate", (_event, path) => callback(path));
  },
  onOpenProject: (callback: (data: ProjectData) => void) => {
    ipcRenderer.on("open-project", (_event, data) => callback(data));
  },
  onFileOpened: (callback: (data: FileOpenedData) => void) => {
    ipcRenderer.on("file-opened", (_event, data) => callback(data));
  },
  onRestoreSession: (callback: (sessionData: SessionData) => void) => {
    ipcRenderer.on("restore-session", (_event, sessionData) => callback(sessionData));
  },
  onForceSync: (callback: () => void) => {
    ipcRenderer.on("force-sync", callback);
  },
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on("update-available", (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    ipcRenderer.on("update-downloaded", (_event, info) => callback(info));
  },
  onDownloadProgress: (callback: (progress: UpdateProgress) => void) => {
    ipcRenderer.on("download-progress", (_event, progress) => callback(progress));
  },

  // Context Management API
  analyzeProjectContext: (projectId: string, projectPath: string) => 
    ipcRenderer.invoke("analyze-project-context", projectId, projectPath),
  getProjectContext: (projectId: string) => 
    ipcRenderer.invoke("get-project-context", projectId),
  searchSimilarContexts: (projectId: string, limit?: number) => 
    ipcRenderer.invoke("search-similar-contexts", projectId, limit),
  getPatterns: (query?: string, projectId?: string) => 
    ipcRenderer.invoke("get-patterns", query, projectId),
  learnPattern: (pattern: {
    type: string;
    pattern: string;
    example: string;
    projectId: string;
  }) => ipcRenderer.invoke("learn-pattern", pattern),
  refreshContextCache: (projectId: string) => 
    ipcRenderer.invoke("refresh-context-cache", projectId),

  // Session Handlers
  session: {
    create: (request: unknown, metadata: unknown) => 
      ipcRenderer.invoke("session:create", request, metadata),
    get: (sessionId: string) => 
      ipcRenderer.invoke("session:get", sessionId),
    update: (sessionId: string, updates: unknown) => 
      ipcRenderer.invoke("session:update", sessionId, updates),
    delete: (sessionId: string) => 
      ipcRenderer.invoke("session:delete", sessionId),
    search: (filter: unknown) => 
      ipcRenderer.invoke("session:search", filter),
    createTemplate: (sessionId: string, templateData: unknown) => 
      ipcRenderer.invoke("session:createTemplate", sessionId, templateData),
    getTemplates: (category?: string, isPublic?: boolean) => 
      ipcRenderer.invoke("session:getTemplates", category, isPublic),
    createFromTemplate: (templateId: string, userId: string, customizations?: unknown) => 
      ipcRenderer.invoke("session:createFromTemplate", templateId, userId, customizations),
    analytics: (options: { userId?: string; projectId?: string; dateRange?: { from: Date; to: Date } }) => 
      ipcRenderer.invoke("session:analytics", options),
    export: (sessionId: string) => 
      ipcRenderer.invoke("session:export", sessionId),
    import: (exportData: string, userId: string) => 
      ipcRenderer.invoke("session:import", exportData, userId),
    handoffToPlanning: (sessionId: string) => 
      ipcRenderer.invoke("session:handoffToPlanning", sessionId),
    handoffToExecution: (sessionId: string, instructions: unknown) => 
      ipcRenderer.invoke("session:handoffToExecution", sessionId, instructions),
    complete: (sessionId: string, result: unknown) => 
      ipcRenderer.invoke("session:complete", sessionId, result),
    fail: (sessionId: string, error: unknown) => 
      ipcRenderer.invoke("session:fail", sessionId, error),
    getHistory: (sessionId: string) => 
      ipcRenderer.invoke("session:getHistory", sessionId),
    getVersion: (sessionId: string, commit: string) => 
      ipcRenderer.invoke("session:getVersion", sessionId, commit),
    compareVersions: (sessionId: string, commit1: string, commit2: string) => 
      ipcRenderer.invoke("session:compareVersions", sessionId, commit1, commit2),
    searchByContent: (searchTerm: string) => 
      ipcRenderer.invoke("session:searchByContent", searchTerm),
    getStatistics: () => 
      ipcRenderer.invoke("session:getStatistics"),
  },

  // Pipeline Handlers
  pipeline: {
    initialize: (config: unknown) => 
      ipcRenderer.invoke("pipeline:initialize", config),
    start: () => 
      ipcRenderer.invoke("pipeline:start"),
    stop: () => 
      ipcRenderer.invoke("pipeline:stop"),
    getStatus: () => 
      ipcRenderer.invoke("pipeline:getStatus"),
    getQueuedSessions: () => 
      ipcRenderer.invoke("pipeline:getQueuedSessions"),
    setGitHubCredentials: (credentials: { token: string; webhookSecret: string }) => 
      ipcRenderer.invoke("pipeline:setGitHubCredentials", credentials),
    setDeploymentKeys: (keys: { signingKey: string; verifyKey: string }) => 
      ipcRenderer.invoke("pipeline:setDeploymentKeys", keys),
    createSession: (instruction: unknown) => 
      ipcRenderer.invoke("pipeline:createSession", instruction),
    getWebhookUrl: () => 
      ipcRenderer.invoke("pipeline:getWebhookUrl"),
    triggerRecovery: () => 
      ipcRenderer.invoke("pipeline:triggerRecovery"),
    factoryReset: () => 
      ipcRenderer.invoke("pipeline:factoryReset"),
    createRecoveryCheckpoint: () => 
      ipcRenderer.invoke("pipeline:createRecoveryCheckpoint"),
    rollbackDeployment: (version: string) => 
      ipcRenderer.invoke("pipeline:rollbackDeployment", version),
    onProgress: (callback: (data: unknown) => void) => {
      ipcRenderer.on("pipeline:progress", (_event, data) => callback(data));
    },
    onEvent: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on("pipeline:deployed", handler);
      ipcRenderer.on("pipeline:sessionQueued", handler);
      ipcRenderer.on("pipeline:sessionCompleted", handler);
      ipcRenderer.on("pipeline:sessionFailed", handler);
      ipcRenderer.on("pipeline:errorOccurred", handler);
      ipcRenderer.on("pipeline:healthCheck", handler);
    },
  },

  // Admin Handlers
  admin: {
    getAllUsers: () => 
      ipcRenderer.invoke("admin:get-all-users"),
    getUserDetails: (userId: string) => 
      ipcRenderer.invoke("admin:get-user-details", userId),
    updateUserRole: (userId: string, role: string) => 
      ipcRenderer.invoke("admin:update-user-role", userId, role),
    suspendUser: (userId: string) => 
      ipcRenderer.invoke("admin:suspend-user", userId),
    activateUser: (userId: string) => 
      ipcRenderer.invoke("admin:activate-user", userId),
    getAuditLogs: (filters?: { userId?: string; action?: string; startDate?: Date; endDate?: Date }) => 
      ipcRenderer.invoke("admin:get-audit-logs", filters),
    recordMetric: (metricType: string, value: number, unit?: string, metadata?: Record<string, unknown>) => 
      ipcRenderer.invoke("admin:record-metric", metricType, value, unit, metadata),
    logEmergencyAccess: (action: string, severity: "low" | "medium" | "high" | "critical", reason: string, affectedResources?: unknown[]) => 
      ipcRenderer.invoke("admin:log-emergency-access", action, severity, reason, affectedResources),
    resolveEmergency: (emergencyLogId: string, resolutionNotes: string) => 
      ipcRenderer.invoke("admin:resolve-emergency", emergencyLogId, resolutionNotes),
    getEmergencyLogs: () => 
      ipcRenderer.invoke("admin:get-emergency-logs"),
    healthCheck: () => 
      ipcRenderer.invoke("admin:health-check"),
    batchUserOperation: (operation: "suspend" | "activate", userIds: string[]) => 
      ipcRenderer.invoke("admin:batch-user-operation", operation, userIds),
  },

  // Figma Handlers
  figma: {
    initialize: () => 
      ipcRenderer.invoke("figma:initialize"),
    analyzeDesign: (figmaFileKey: string) => 
      ipcRenderer.invoke("figma:analyze-design", figmaFileKey),
    compareWithCode: (figmaFileKey: string, componentPath: string) => 
      ipcRenderer.invoke("figma:compare-with-code", figmaFileKey, componentPath),
    updateComponentFromFigma: (figmaFileKey: string, componentPath: string) => 
      ipcRenderer.invoke("figma:update-component", figmaFileKey, componentPath),
    createUIPullRequest: (figmaFileKey: string, description: string) => 
      ipcRenderer.invoke("figma:create-ui-pull-request", figmaFileKey, description),
    registerProject: (project: unknown) => 
      ipcRenderer.invoke("figma:register-project", project),
    startProjectUIUpdate: (projectId: string, figmaFileKey: string) => 
      ipcRenderer.invoke("figma:start-project-ui-update", projectId, figmaFileKey),
    getEnhancementStatus: (sessionId: string) => 
      ipcRenderer.invoke("figma:get-enhancement-status", sessionId),
    mergeUIChanges: (sessionId: string) => 
      ipcRenderer.invoke("figma:merge-ui-changes", sessionId),
    getFigmaEnabledProjects: () => 
      ipcRenderer.invoke("figma:get-figma-enabled-projects"),
    watchFile: (figmaFileKey: string) => 
      ipcRenderer.invoke("figma:watch-file", figmaFileKey),
    getComponentsNeedingUpdate: () => 
      ipcRenderer.invoke("figma:get-components-needing-update"),
  },

  // MCP Server Handlers
  mcp: {
    server: {
      start: () => 
        ipcRenderer.invoke("mcp:server:start"),
      stop: () => 
        ipcRenderer.invoke("mcp:server:stop"),
      restart: () => 
        ipcRenderer.invoke("mcp:server:restart"),
      getStatus: () => 
        ipcRenderer.invoke("mcp:server:getStatus"),
      getIntegrations: () => 
        ipcRenderer.invoke("mcp:server:getIntegrations"),
      registerIntegration: (integration: unknown) => 
        ipcRenderer.invoke("mcp:server:registerIntegration", integration),
      unregisterIntegration: (id: string) => 
        ipcRenderer.invoke("mcp:server:unregisterIntegration", id),
    },
    tool: {
      execute: (integrationId: string, tool: string, params: unknown) => 
        ipcRenderer.invoke("mcp:tool:execute", integrationId, tool, params),
      test: (integrationId: string, tool: string, params: unknown) => 
        ipcRenderer.invoke("mcp:tool:test", integrationId, tool, params),
    },
    marketplace: {
      search: (options: unknown) => 
        ipcRenderer.invoke("mcp:marketplace:search", options),
      getFeatured: () => 
        ipcRenderer.invoke("mcp:marketplace:getFeatured"),
      getTrending: () => 
        ipcRenderer.invoke("mcp:marketplace:getTrending"),
      getIntegration: (id: string) => 
        ipcRenderer.invoke("mcp:marketplace:getIntegration", id),
      install: (integrationId: string) => 
        ipcRenderer.invoke("mcp:marketplace:install", integrationId),
      getCategories: () => 
        ipcRenderer.invoke("mcp:marketplace:getCategories"),
    },
    on: (event: string, callback: (data: unknown) => void) => {
      ipcRenderer.on(`mcp:event:${event}`, (_event, data) => callback(data));
    },
    removeListener: (event: string, callback: (data: unknown) => void) => {
      ipcRenderer.removeListener(`mcp:event:${event}`, callback);
    },
  },

  // Zed Integration Handlers
  zed: {
    connect: () => 
      ipcRenderer.invoke("zed:connect"),
    disconnect: () => 
      ipcRenderer.invoke("zed:disconnect"),
    getStatus: () => 
      ipcRenderer.invoke("zed:get-status"),
    openWorkspace: (workspacePath: string) => 
      ipcRenderer.invoke("zed:open-workspace", workspacePath),
    openFile: (filePath: string) => 
      ipcRenderer.invoke("zed:open-file", filePath),
    saveFile: (filePath: string, content: string) => 
      ipcRenderer.invoke("zed:save-file", filePath, content),
    sendToExecution: (instruction: string, context: unknown) => 
      ipcRenderer.invoke("zed:send-to-execution", instruction, context),
    getExecutionStatus: () => 
      ipcRenderer.invoke("zed:get-execution-status"),
    getActorStatus: () => 
      ipcRenderer.invoke("zed:get-actor-status"),
    syncActors: () => 
      ipcRenderer.invoke("zed:sync-actors"),
    gitStatus: () => 
      ipcRenderer.invoke("zed:git-status"),
    stageFiles: (files: string[]) => 
      ipcRenderer.invoke("zed:stage-files", files),
    commit: (message: string) => 
      ipcRenderer.invoke("zed:commit", message),
    runLinter: () => 
      ipcRenderer.invoke("zed:run-linter"),
    runTypecheck: () => 
      ipcRenderer.invoke("zed:run-typecheck"),
    openExternal: (url: string) => 
      ipcRenderer.invoke("zed:open-external", url),
    onHealthUpdate: (callback: (health: unknown) => void) => {
      ipcRenderer.on("zed:health-update", (_event, health) => callback(health));
    },
    onWorkspaceOpened: (callback: (workspace: unknown) => void) => {
      ipcRenderer.on("zed:workspace-opened", (_event, workspace) => callback(workspace));
    },
    onInstructionSent: (callback: (instruction: unknown) => void) => {
      ipcRenderer.on("actor:instruction-sent", (_event, instruction) => callback(instruction));
    },
  },

  // AI Enhancement Handlers
  ai: {
    initialize: () => 
      ipcRenderer.invoke("ai:initialize"),
    learnFromCode: (filePath: string, content: string) => 
      ipcRenderer.invoke("ai:learn-from-code", filePath, content),
    getAutocomplete: (context: unknown) => 
      ipcRenderer.invoke("ai:get-autocomplete", context),
    recordAutocomplete: (suggestion: unknown, accepted: boolean) => 
      ipcRenderer.invoke("ai:record-autocomplete", suggestion, accepted),
    analyzeProject: (projectPath: string) => 
      ipcRenderer.invoke("ai:analyze-project", projectPath),
    startSession: (sessionId: string, objectives: string[]) => 
      ipcRenderer.invoke("ai:start-session", sessionId, objectives),
    updateSession: (sessionId: string, updates: unknown) => 
      ipcRenderer.invoke("ai:update-session", sessionId, updates),
    completeSession: (sessionId: string, success: boolean) => 
      ipcRenderer.invoke("ai:complete-session", sessionId, success),
    searchPatterns: (criteria: unknown) => 
      ipcRenderer.invoke("ai:search-patterns", criteria),
    addPattern: (pattern: unknown) => 
      ipcRenderer.invoke("ai:add-pattern", pattern),
    shareInsight: (insight: unknown) => 
      ipcRenderer.invoke("ai:share-insight", insight),
    getSharedInsights: (filter: unknown) => 
      ipcRenderer.invoke("ai:get-shared-insights", filter),
    predict: (context: unknown, type: string) => 
      ipcRenderer.invoke("ai:predict", context, type),
    getCodingStyle: (projectId: string) => 
      ipcRenderer.invoke("ai:get-coding-style", projectId),
    updateCodingStyle: (projectId: string, style: unknown) => 
      ipcRenderer.invoke("ai:update-coding-style", projectId, style),
    getSuggestions: (context: unknown) => 
      ipcRenderer.invoke("ai:get-suggestions", context),
    getPerformanceMetrics: () => 
      ipcRenderer.invoke("ai:get-performance-metrics"),
    optimizeBundle: (options: unknown) => 
      ipcRenderer.invoke("ai:optimize-bundle", options),
    exportModel: (format: string) => 
      ipcRenderer.invoke("ai:export-model", format),
    importModel: (modelData: unknown) => 
      ipcRenderer.invoke("ai:import-model", modelData),
  },
} as SessionHubAPI);

// Note: Window interface declaration moved to renderer/types/window.d.ts
// to avoid conflicts with existing declarations