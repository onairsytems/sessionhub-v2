declare global {
  interface Window {
    api: {
      context: {
        getProjectContext: () => Promise<any>;
        getAvailablePatterns: () => Promise<any[]>;
        analyzeProjectContext: () => Promise<any>;
      };
      getPatterns: () => Promise<any[]>;
      getProjectContext: () => Promise<any>;
      analyzeProjectContext: () => Promise<any>;
    };
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
    };
    electron: {
      onSessionProgress: (callback: (event: { type: string; data: unknown }) => void,
      ) => Promise<() => void>;
      getSessionStatus: (sessionId: string,
      ) => Promise<{ state: string } | null>;
      figma: {
        checkConnection: () => Promise<boolean>;
        getApiKey: () => Promise<string>;
        initialize: (apiKey: string) => Promise<boolean>;
        startSessionHubUIUpdate: (figmaFileKey: string) => Promise<string>;
        getUpdateStatus: (sessionId: string) => Promise<any>;
        previewUIChanges: (figmaFileKey: string) => Promise<any>;
        createUIPullRequest: (figmaFileKey: string, description: string) => Promise<string>;
        applyUIChanges: (sessionId: string) => Promise<void>;
        registerProject: (project: any) => Promise<boolean>;
        startProjectUIUpdate: (projectId: string, figmaFileKey: string) => Promise<string>;
        getEnhancementStatus: (sessionId: string) => Promise<any>;
        mergeUIChanges: (sessionId: string) => Promise<void>;
        getFigmaEnabledProjects: () => Promise<any[]>;
        watchFile: (figmaFileKey: string) => Promise<boolean>;
        getComponentsNeedingUpdate: () => Promise<string[]>;
      };
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
    electronAPI: {
      claude: {
        getAutoAcceptSettings: () => Promise<{
          enabled: boolean;
          sessionId?: string;
          acceptFileEdits: boolean;
          acceptGitOperations: boolean;
          acceptFoundationUpdates: boolean;
          acceptAllPrompts: boolean;
        }>;
        setAutoAcceptSettings: (settings: {
          enabled: boolean;
          sessionId?: string;
          acceptFileEdits: boolean;
          acceptGitOperations: boolean;
          acceptFoundationUpdates: boolean;
          acceptAllPrompts: boolean;
        }) => Promise<{ success: boolean }>;
        enableForSession: (sessionId: string) => Promise<{ success: boolean }>;
      };
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
      // MCP Server API
      mcp: {
        startServer: () => Promise<void>;
        stopServer: () => Promise<void>;
        getServerStatus: () => Promise<{
          running: boolean;
          port?: number;
          integrations?: number;
          uptime?: number;
        }>;
        listIntegrations: () => Promise<any[]>;
        registerIntegration: (integration: any) => Promise<string>;
        unregisterIntegration: (id: string) => Promise<void>;
        executeTool: (integrationId: string, tool: string, params: any) => Promise<any>;
        testTool: (integrationId: string, tool: string, params: any) => Promise<any>;
        marketplace: {
          search: (options: any) => Promise<any[]>;
          getFeatured: () => Promise<any[]>;
          getTrending: () => Promise<any[]>;
          getIntegration: (id: string) => Promise<any>;
          install: (integrationId: string) => Promise<string>;
          getCategories: () => Promise<any[]>;
        };
        onIntegrationRegistered: (callback: (integration: any) => void) => void;
        onIntegrationUnregistered: (callback: (integration: any) => void) => void;
        onError: (callback: (error: any) => void) => void;
      };
      // Actor Status API
      getRealAPIStatus: () => Promise<{
        operational: boolean;
        message: string;
        lastCheck: string;
      }>;
      getViolations: () => Promise<Array<{
        id: string;
        type: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
        message: string;
        timestamp: string;
        actor: string;
      }>>;
      getActivities: () => Promise<Array<{
        id: string;
        actor: string;
        action: string;
        timestamp: string;
        details?: any;
      }>>;
      openAPIConfiguration: () => Promise<void>;
      clearViolations: () => Promise<{ success: boolean }>;
    };
  }
}

export {};
