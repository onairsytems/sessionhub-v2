declare global {
  interface Window {
    sessionhub: {
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
      createNewSession: () => void;
      checkApiKey: () => Promise<boolean>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      saveApiKey: (apiKey: string) => Promise<void>;
      sendChatMessage: (sessionId: string, message: string) => Promise<string>;
      selectGitHubRepo: () => Promise<{
        url: string;
        name: string;
        owner: string;
        defaultBranch: string;
      } | null>;
      analyzeRepository: (sessionId: string,
        repoInfo: {
          url: string;
          name: string;
          owner: string;
          defaultBranch: string;
        },
      ) => Promise<string>;
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
      updateSessionStatus: (sessionId: string,
        status: string,
      ) => Promise<{ success: boolean; session?: unknown; error?: string }>;
      getActiveSessions: () => Promise<{
        success: boolean;
        sessions: unknown[];
        error?: string;
      }>;
      getSessionStats: (sessionId?: string,
      ) => Promise<{ success: boolean; stats: unknown[]; error?: string }>;
      onNewSession: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    electron: {
      onSessionProgress: (callback: (event: { type: string; data: unknown }) => void,
      ) => Promise<() => void>;
      getSessionStatus: (sessionId: string,
      ) => Promise<{ state: string } | null>;
    };
    electronAPI: {
      checkApiKey: () => Promise<boolean>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      saveApiKey: (apiKey: string) => Promise<void>;
      sendChatMessage: (sessionId: string, message: string) => Promise<string>;
      selectGitHubRepo: () => Promise<{
        url: string;
        name: string;
        owner: string;
        defaultBranch: string;
      } | null>;
      analyzeRepository: (sessionId: string,
        repoInfo: {
          url: string;
          name: string;
          owner: string;
          defaultBranch: string;
        },
      ) => Promise<string>;
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
    };
  }
}

export {};
