/**
 * Electron Preload Script
 * Provides secure bridge between main process and renderer
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const {
  contextBridge,
  ipcRenderer,
}: {
  contextBridge: typeof import("electron").contextBridge;
  ipcRenderer: typeof import("electron").ipcRenderer;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require("electron");

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
    },
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
    status: string,
  ) => Promise<{ success: boolean; session?: unknown; error?: string }>;
  getActiveSessions: () => Promise<{
    success: boolean;
    sessions: unknown[];
    error?: string;
  }>;
  getSessionStats: (
    sessionId?: string,
  ) => Promise<{ success: boolean; stats: unknown[]; error?: string }>;

  // Event listeners
  onNewSession: (callback: () => void) => void;
  removeAllListeners: () => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("sessionhub", {
  // System health and monitoring
  getSystemHealth: () => ipcRenderer.invoke("get-system-health"),
  getSelfDevelopmentStatus: () =>
    ipcRenderer.invoke("get-self-development-status"),
  getProductionMetrics: () => ipcRenderer.invoke("get-production-metrics"),
  triggerTestIssue: () => ipcRenderer.invoke("trigger-test-issue"),

  // Session management
  createNewSession: () => ipcRenderer.send("new-session"),

  // API Configuration
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke("validate-api-key", apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),

  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) =>
    ipcRenderer.invoke("send-chat-message", sessionId, message),

  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke("select-github-repo"),
  analyzeRepository: (
    sessionId: string,
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
  checkSupabaseConnection: () =>
    ipcRenderer.invoke("check-supabase-connection"),
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
  updateSessionStatus: (sessionId: string, status: string) =>
    ipcRenderer.invoke("update-session-status", sessionId, status),
  getActiveSessions: () => ipcRenderer.invoke("get-active-sessions"),
  getSessionStats: (sessionId?: string) =>
    ipcRenderer.invoke("get-session-stats", sessionId),

  // Event listeners
  onNewSession: (callback: () => void) => {
    ipcRenderer.on("new-session", callback);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
} as SessionHubAPI);

// Also expose electronAPI for compatibility
contextBridge.exposeInMainWorld("electronAPI", {
  // API Configuration
  checkApiKey: () => ipcRenderer.invoke("check-api-key"),
  validateApiKey: (apiKey: string) =>
    ipcRenderer.invoke("validate-api-key", apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),

  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) =>
    ipcRenderer.invoke("send-chat-message", sessionId, message),

  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke("select-github-repo"),
  analyzeRepository: (
    sessionId: string,
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
  checkSupabaseConnection: () =>
    ipcRenderer.invoke("check-supabase-connection"),
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
  getSessionStatus: (sessionId: string) =>
    ipcRenderer.invoke("get-session-status", sessionId),
});

// Export empty object to make this a module
export {};
