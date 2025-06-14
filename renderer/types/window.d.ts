declare global {
  interface Window {
    api: {
      context: {
        getProjectContext: () => Promise<unknown>;
        getAvailablePatterns: () => Promise<unknown[]>;
        analyzeProjectContext: () => Promise<unknown>;
      };
      getPatterns: () => Promise<unknown[]>;
      getProjectContext: () => Promise<unknown>;
      analyzeProjectContext: () => Promise<unknown>;
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
      // Auto-updater methods
      checkForUpdates: () => Promise<{
        checking: boolean;
        available: boolean;
        downloading: boolean;
        downloaded: boolean;
        error: Error | null;
        progress: {
          bytesPerSecond: number;
          percent: number;
          transferred: number;
          total: number;
        } | null;
        updateInfo: {
          version: string;
          releaseDate: string;
          releaseNotes?: string;
        } | null;
      }>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => void;
      onUpdateAvailable: (callback: (info: {
        version: string;
        releaseDate: string;
        releaseNotes?: string;
      }) => void) => void;
      onUpdateDownloaded: (callback: (info: {
        version: string;
        releaseDate: string;
        releaseNotes?: string;
      }) => void) => void;
      onDownloadProgress: (callback: (progress: {
        bytesPerSecond: number;
        percent: number;
        transferred: number;
        total: number;
      }) => void) => void;
      // Session Pipeline API
      executeSession: (request: unknown) => Promise<unknown>;
      importDocuments: (filePaths: string[]) => Promise<unknown>;
      importGoogleDocs: (docUrl: string) => Promise<unknown>;
      analyzeDocument: (documentMetadata: unknown) => Promise<unknown>;
      analyzeDocumentSet: (documents: unknown[]) => Promise<unknown>;
      getSession: (sessionId: string) => Promise<unknown>;
      getUserSessions: (userId: string) => Promise<unknown>;
      getSessionMetrics: () => Promise<unknown>;
      selectDocuments: () => Promise<unknown>;
      getFileInfo: (filePath: string) => Promise<unknown>;
      onSessionProgress: (callback: (data: unknown) => void) => void;
      removeSessionProgressListener: (callback: (data: unknown) => void) => void;
      // Tutorial and Help API
      settings: {
        getSettings: () => Promise<unknown>;
        saveSettings: (settings: unknown) => Promise<{ success: boolean; error?: string }>;
        testApiKey: (apiKey: string) => Promise<{ success: boolean; responseTime?: number; message: string; error?: string }>;
        testSupabase: (url: string, anonKey: string) => Promise<{ success: boolean; message: string; error?: string }>;
        exportSettings: () => Promise<{ success: boolean; data?: string; error?: string }>;
        importSettings: (jsonData: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        getStorageInfo: () => Promise<{ sessions: string; cache: string; logs: string; total: string }>;
        clearCache: () => Promise<{ success: boolean; message?: string; error?: string }>;
        getFeatureFlags: () => Promise<unknown>;
      };
      tutorials: {
        getTutorials: () => Promise<Array<{
          id: string;
          title: string;
          description: string;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          duration: string;
          category: string;
        }>>;
        getTutorial: (tutorialId: string) => Promise<{
          id: string;
          title: string;
          description: string;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          duration: string;
          steps: Array<{
            id: string;
            title: string;
            content: string;
            action?: {
              type: 'click' | 'type' | 'navigate' | 'highlight';
              target: string;
              value?: string;
            };
            validation?: {
              type: 'element-exists' | 'value-equals' | 'session-created';
              target: string;
              value?: string;
            };
            tips?: string[];
          }>;
          category: string;
        }>;
        getTutorialCategories: () => Promise<string[]>;
        completeTutorial: (tutorialId: string) => Promise<boolean>;
        getCompletedTutorials: () => Promise<string[]>;
        getHelpContent: (topic: string) => Promise<string>;
        searchHelp: (query: string) => Promise<Array<{
          file: string;
          title: string;
          snippet: string;
          line: number;
        }>>;
      };
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
        getUpdateStatus: (sessionId: string) => Promise<unknown>;
        previewUIChanges: (figmaFileKey: string) => Promise<unknown>;
        createUIPullRequest: (figmaFileKey: string, description: string) => Promise<string>;
        applyUIChanges: (sessionId: string) => Promise<void>;
        registerProject: (project: unknown) => Promise<boolean>;
        startProjectUIUpdate: (projectId: string, figmaFileKey: string) => Promise<string>;
        getEnhancementStatus: (sessionId: string) => Promise<unknown>;
        mergeUIChanges: (sessionId: string) => Promise<void>;
        getFigmaEnabledProjects: () => Promise<unknown[]>;
        watchFile: (figmaFileKey: string) => Promise<boolean>;
        getComponentsNeedingUpdate: () => Promise<string[]>;
      };
      recovery: {
        getRecoveryPoints: () => Promise<Array<{
          id: string;
          timestamp: Date;
          type: 'full' | 'incremental' | 'checkpoint';
          description: string;
          sessionId?: string;
          projectId?: string;
          size: number;
          healthy: boolean;
          checksumValid: boolean;
        }>>;
        recoverToPoint: (options: {
          targetTimestamp?: Date;
          sessionId?: string;
          projectId?: string;
          skipCorrupted?: boolean;
          attemptAutoRepair?: boolean;
          mergePartialSaves?: boolean;
        }) => Promise<{
          success: boolean;
          timestamp: Date;
          errors: string[];
          warnings: string[];
          metadata: {
            recoveryDuration: number;
            dataIntegrityScore: number;
            repairsAttempted: number;
            repairsSuccessful: number;
          };
        }>;
        detectCorruption: () => Promise<{
          fileCount: number;
          corruptedFiles: string[];
          repairableFiles: string[];
          unreparableFiles: string[];
          recommendedAction: 'auto-repair' | 'manual-recovery' | 'restore-previous';
          severity: 'low' | 'medium' | 'high' | 'critical';
        }>;
        attemptAutoRecovery: (sessionId?: string) => Promise<{
          success: boolean;
          timestamp: Date;
          errors: string[];
          warnings: string[];
          metadata: {
            recoveryDuration: number;
            dataIntegrityScore: number;
            repairsAttempted: number;
            repairsSuccessful: number;
          };
        }>;
        createCheckpoint: (data: any, description: string) => Promise<{
          id: string;
          timestamp: Date;
          type: 'full' | 'incremental' | 'checkpoint';
          description: string;
          size: number;
          healthy: boolean;
          checksumValid: boolean;
        }>;
        checkStartupHealth: () => Promise<boolean>;
        enterEmergencyMode: (options?: {
          skipUserPrompt?: boolean;
          autoSelectLatest?: boolean;
          maxRecoveryAttempts?: number;
          fallbackToFactoryReset?: boolean;
        }) => Promise<{
          success: boolean;
          mode: 'normal' | 'safe' | 'minimal' | 'factory-reset';
          recoveredSessions: number;
          dataLoss: boolean;
          warnings: string[];
          errors: string[];
          recoveryDuration: number;
        }>;
        exitEmergencyMode: () => Promise<boolean>;
        getSafeModeConfig: () => Promise<{
          disablePlugins: boolean;
          disableCloudSync: boolean;
          disableAutoSave: boolean;
          readOnlyMode: boolean;
          minimalUI: boolean;
        }>;
        getHealthStatus: () => Promise<{
          healthy: boolean;
          totalBackups: number;
          healthyBackups: number;
          corruptedBackups: number;
          lastCheckTime: Date;
          nextScheduledCheck: Date;
          issues: Array<{
            backupId: string;
            filePath: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
            type: 'corruption' | 'missing' | 'checksum-mismatch' | 'outdated' | 'size-anomaly';
            description: string;
            detectedAt: Date;
            autoFixable: boolean;
          }>;
          recommendations: string[];
        } | null>;
        checkHealthNow: () => Promise<{
          healthy: boolean;
          totalBackups: number;
          healthyBackups: number;
          corruptedBackups: number;
          lastCheckTime: Date;
          nextScheduledCheck: Date;
          issues: Array<{
            backupId: string;
            filePath: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
            type: 'corruption' | 'missing' | 'checksum-mismatch' | 'outdated' | 'size-anomaly';
            description: string;
            detectedAt: Date;
            autoFixable: boolean;
          }>;
          recommendations: string[];
        }>;
        queryLogs: (query: {
          startDate?: Date;
          endDate?: Date;
          type?: string | string[];
          severity?: 'info' | 'warning' | 'error' | 'critical';
          outcome?: 'success' | 'failure' | 'partial';
          sessionId?: string;
          limit?: number;
          offset?: number;
        }) => Promise<Array<{
          id: string;
          timestamp: Date;
          type: string;
          severity: 'info' | 'warning' | 'error' | 'critical';
          action: string;
          outcome: 'success' | 'failure' | 'partial';
          duration?: number;
          errorMessage?: string;
        }>>;
        getLogSummary: (startDate?: Date, endDate?: Date) => Promise<{
          totalEvents: number;
          successfulRecoveries: number;
          failedRecoveries: number;
          partialRecoveries: number;
          corruptionEvents: number;
          autoRepairs: number;
          emergencyModeActivations: number;
          factoryResets: number;
          lastRecoveryDate?: Date;
          lastSuccessfulRecovery?: Date;
          lastFailedRecovery?: Date;
          averageRecoveryDuration: number;
          mostCommonErrors: Array<{ error: string; count: number }>;
        }>;
        exportLogs: (outputPath: string, query?: any, format?: 'json' | 'csv') => Promise<boolean>;
        cleanupLogs: (daysToKeep: number) => Promise<boolean>;
      };
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      settings: {
        getSettings: () => Promise<unknown>;
        saveSettings: (settings: unknown) => Promise<{ success: boolean; error?: string }>;
        testApiKey: (apiKey: string) => Promise<{ success: boolean; responseTime?: number; message: string; error?: string }>;
        testSupabase: (url: string, anonKey: string) => Promise<{ success: boolean; message: string; error?: string }>;
        exportSettings: () => Promise<{ success: boolean; data?: string; error?: string }>;
        importSettings: (jsonData: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        getStorageInfo: () => Promise<{ sessions: string; cache: string; logs: string; total: string }>;
        clearCache: () => Promise<{ success: boolean; message?: string; error?: string }>;
        getFeatureFlags: () => Promise<unknown>;
      };
      api: {
        saveApiKey: (apiKey: string) => Promise<void>;
      };
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
      executeSession: (request: unknown) => Promise<unknown>;
      importDocuments: (filePaths: string[]) => Promise<unknown>;
      importGoogleDocs: (docUrl: string) => Promise<unknown>;
      analyzeDocument: (documentMetadata: unknown) => Promise<unknown>;
      analyzeDocumentSet: (documents: unknown[]) => Promise<unknown>;
      getSession: (sessionId: string) => Promise<unknown>;
      getUserSessions: (userId: string) => Promise<unknown>;
      getSessionMetrics: () => Promise<unknown>;
      selectDocuments: () => Promise<unknown>;
      getFileInfo: (filePath: string) => Promise<unknown>;
      onSessionProgress: (callback: (data: unknown) => void) => void;
      removeSessionProgressListener: (callback: (data: unknown) => void) => void;
      // Tutorial and Help API
      getTutorials: () => Promise<Array<{
        id: string;
        title: string;
        description: string;
        difficulty: 'beginner' | 'intermediate' | 'advanced';
        duration: string;
        category: string;
      }>>;
      getTutorial: (tutorialId: string) => Promise<{
        id: string;
        title: string;
        description: string;
        difficulty: 'beginner' | 'intermediate' | 'advanced';
        duration: string;
        steps: Array<{
          id: string;
          title: string;
          content: string;
          action?: {
            type: 'click' | 'type' | 'navigate' | 'highlight';
            target: string;
            value?: string;
          };
          validation?: {
            type: 'element-exists' | 'value-equals' | 'session-created';
            target: string;
            value?: string;
          };
          tips?: string[];
        }>;
        category: string;
      }>;
      getTutorialCategories: () => Promise<string[]>;
      completeTutorial: (tutorialId: string) => Promise<boolean>;
      getCompletedTutorials: () => Promise<string[]>;
      getHelpContent: (topic: string) => Promise<string>;
      searchHelp: (query: string) => Promise<Array<{
        file: string;
        title: string;
        snippet: string;
        line: number;
      }>>;
      openExternal: (url: string) => Promise<void>;
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
        listIntegrations: () => Promise<unknown[]>;
        registerIntegration: (integration: unknown) => Promise<string>;
        unregisterIntegration: (id: string) => Promise<void>;
        executeTool: (integrationId: string, tool: string, params: unknown) => Promise<unknown>;
        testTool: (integrationId: string, tool: string, params: unknown) => Promise<unknown>;
        marketplace: {
          search: (options: unknown) => Promise<unknown[]>;
          getFeatured: () => Promise<unknown[]>;
          getTrending: () => Promise<unknown[]>;
          getIntegration: (id: string) => Promise<unknown>;
          install: (integrationId: string) => Promise<string>;
          getCategories: () => Promise<unknown[]>;
        };
        onIntegrationRegistered: (callback: (integration: unknown) => void) => void;
        onIntegrationUnregistered: (callback: (integration: unknown) => void) => void;
        onError: (callback: (error: unknown) => void) => void;
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
        details?: unknown;
      }>>;
      openAPIConfiguration: () => Promise<void>;
      clearViolations: () => Promise<{ success: boolean }>;
      // Zed IDE Integration
      zed: {
        // Connection Management
        storeCredentials: (credentials: { email: string; apiToken: string }) => Promise<void>;
        testConnection: () => Promise<{
          success: boolean;
          diagnostics: {
            zedInstalled: boolean;
            zedRunning: boolean;
            mcpConfigured: boolean;
            credentialsValid: boolean;
          };
          errors: string[];
        }>;
        getConnectionHealth: () => Promise<{
          isConnected: boolean;
          isZedRunning: boolean;
          isMCPAvailable: boolean;
          lastHealthCheck: Date;
          connectionUptime: number;
          errors: string[];
        }>;
        reconnect: () => Promise<{ success: boolean }>;
        // IDE Operations
        connect: () => Promise<{ success: boolean }>;
        disconnect: () => Promise<{ success: boolean }>;
        openWorkspace: (workspacePath: string) => Promise<{ success: boolean }>;
        getWorkspaceInfo: () => Promise<unknown>;
        openFile: (filePath: string) => Promise<{ success: boolean }>;
        saveFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
        // Two-Actor Integration
        sendToExecution: (instruction: string, context: unknown) => Promise<{ success: boolean }>;
        getExecutionStatus: () => Promise<{ active: boolean; currentTask?: string }>;
        getActorStatus: () => Promise<unknown>;
        syncActors: () => Promise<{ success: boolean }>;
        // Git Operations
        getGitStatus: () => Promise<{ branch: string; changes: string[] }>;
        stageFiles: (files: string[]) => Promise<{ success: boolean }>;
        commit: (message: string) => Promise<{ success: boolean }>;
        // Quality Gates
        runLinter: () => Promise<{ passed: boolean; errors: unknown[] }>;
        runTypeCheck: () => Promise<{ passed: boolean; errors: unknown[] }>;
        openExternal: (url: string) => Promise<{ success: boolean }>;
      };
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean }>;
      };
      api: {
        on: (channel: string, callback: (...args: unknown[]) => void) => void;
        off: (channel: string, callback: (...args: unknown[]) => void) => void;
        showNotification: (options: { title: string; body: string; type?: string }) => void;
      };
      projects: {
        list: () => Promise<unknown[]>;
      };
    };
    // Add the api property for Zed components
    api: {
      zed: {
        storeCredentials: (credentials: { email: string; apiToken: string }) => Promise<void>;
        testConnection: () => Promise<unknown>;
        getConnectionHealth: () => Promise<unknown>;
        reconnect: () => Promise<{ success: boolean }>;
        connect: () => Promise<{ success: boolean }>;
        disconnect: () => Promise<{ success: boolean }>;
        openWorkspace: (workspacePath: string) => Promise<{ success: boolean }>;
        getWorkspaceInfo: () => Promise<unknown>;
        openFile: (filePath: string) => Promise<{ success: boolean }>;
        saveFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
        sendToExecution: (instruction: string, context: unknown) => Promise<{ success: boolean }>;
        getExecutionStatus: () => Promise<{ active: boolean; currentTask?: string }>;
        getActorStatus: () => Promise<unknown>;
        syncActors: () => Promise<{ success: boolean }>;
        getGitStatus: () => Promise<{ branch: string; changes: string[] }>;
        stageFiles: (files: string[]) => Promise<{ success: boolean }>;
        commit: (message: string) => Promise<{ success: boolean }>;
        runLinter: () => Promise<{ passed: boolean; errors: unknown[] }>;
        runTypeCheck: () => Promise<{ passed: boolean; errors: unknown[] }>;
      };
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean }>;
      };
      projects: {
        list: () => Promise<unknown[]>;
      };
      ai: {
        initialize: () => Promise<unknown>;
        learnFromCode: (filePath: string, content: string) => Promise<{ success: boolean }>;
        getAutocomplete: (context: unknown) => Promise<unknown[]>;
        recordAutocomplete: (suggestion: unknown, accepted: boolean) => Promise<{ success: boolean }>;
        analyzeProject: (projectPath: string) => Promise<{
          template: unknown;
          knowledge: unknown;
          recommendations: string[];
        }>;
        startSession: (sessionId: string, objectives: string[]) => Promise<{ success: boolean }>;
        updateSession: (sessionId: string, updates: unknown) => Promise<{ success: boolean }>;
        completeSession: (sessionId: string, success: boolean) => Promise<{ success: boolean }>;
        searchPatterns: (criteria: unknown) => Promise<unknown[]>;
        addPattern: (pattern: unknown) => Promise<unknown>;
        getInsights: (projectPath?: string) => Promise<unknown[]>;
        transferLearning: (fromProject: string, toProject: string) => Promise<unknown>;
        getStatus: () => Promise<unknown>;
        getMetricsSummary: (days: number) => Promise<unknown>;
        generateInsights: () => Promise<unknown>;
        getConfig: () => Promise<unknown>;
        updateConfig: (config: unknown) => Promise<unknown>;
        exportData: () => Promise<string>;
        importData: (data: string) => Promise<{ success: boolean }>;
        clearData: () => Promise<{ success: boolean }>;
      };
      selectDirectory: () => Promise<string | null>;
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
      off: (channel: string, callback: (...args: unknown[]) => void) => void;
      showNotification: (options: { title: string; body: string; type?: string }) => void;
    };
  }
}
export {};
