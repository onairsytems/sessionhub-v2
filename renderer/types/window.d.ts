
declare global {
  interface Window {
    sessionhub: {
      getSystemHealth: () => Promise<any>;
      getSelfDevelopmentStatus: () => Promise<any>;
      getProductionMetrics: () => Promise<any>;
      triggerTestIssue: () => Promise<any>;
      createNewSession: () => void;
      checkApiKey: () => Promise<boolean>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      saveApiKey: (apiKey: string) => Promise<void>;
      sendChatMessage: (sessionId: string, message: string) => Promise<string>;
      selectGitHubRepo: () => Promise<any>;
      analyzeRepository: (sessionId: string, repoInfo: any) => Promise<string>;
      configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => Promise<any>;
      checkSupabaseConnection: () => Promise<any>;
      getSupabaseConfig: () => Promise<any>;
      initSupabase: () => Promise<any>;
      createProject: (project: any) => Promise<any>;
      getProjects: () => Promise<any>;
      createSession: (session: any) => Promise<any>;
      updateSessionStatus: (sessionId: string, status: string) => Promise<any>;
      getActiveSessions: () => Promise<any>;
      getSessionStats: (sessionId?: string) => Promise<any>;
      onNewSession: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    electron: {
      onSessionProgress: (callback: (event: any) => void) => Promise<() => void>;
      getSessionStatus: (sessionId: string) => Promise<any>;
    };
    electronAPI: {
      checkApiKey: () => Promise<boolean>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      saveApiKey: (apiKey: string) => Promise<void>;
      sendChatMessage: (sessionId: string, message: string) => Promise<string>;
      selectGitHubRepo: () => Promise<any>;
      analyzeRepository: (sessionId: string, repoInfo: any) => Promise<string>;
      configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => Promise<any>;
      checkSupabaseConnection: () => Promise<any>;
      getSupabaseConfig: () => Promise<any>;
      initSupabase: () => Promise<any>;
      createProject: (project: any) => Promise<any>;
      getProjects: () => Promise<any>;
    };
  }
}

export {};