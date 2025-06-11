import { ipcMain } from "electron";
import { SupabaseService } from "../../src/services/cloud/SupabaseService";
import { Logger } from "../../src/lib/logging/Logger";
import { SessionStatus } from "../../src/models/Session";

const logger = new Logger("SupabaseHandlers");
const supabaseService = new SupabaseService(logger);

export function registerSupabaseHandlers(): void {
  // Configure Supabase credentials
  ipcMain.handle(
    "configure-supabase",
    async (
      _event,
      config: {
        url: string;
        anonKey: string;
        serviceKey?: string;
      },
    ) => {
      try {
        await supabaseService.configureCredentials(
          config.url,
          config.anonKey,
          config.serviceKey,
        );
        await supabaseService.initialize();
        return { success: true };
      } catch (error: unknown) {
        logger.error("Failed to configure Supabase", error as Error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Check Supabase connection status
  ipcMain.handle("check-supabase-connection", async () => {
    try {
      if (!supabaseService.isInitialized()) {
        // Try to initialize with existing credentials
        await supabaseService.initialize();
      }

      return {
        isConnected: supabaseService.isServiceOnline(),
        isInitialized: supabaseService.isInitialized(),
      };
    } catch (error: unknown) {
      return {
        isConnected: false,
        isInitialized: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Get Supabase configuration (without sensitive keys)
  ipcMain.handle("get-supabase-config", async () => {
    try {
      const config = await supabaseService.exportConfiguration();
      return {
        hasConfig: !!config.url,
        url: config.url,
        hasServiceKey: config.hasServiceKey,
      };
    } catch (error: unknown) {
      return {
        hasConfig: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Create a project
  ipcMain.handle(
    "create-project",
    async (
      _event,
      project: {
        name: string;
        path: string;
        type: string;
        metadata?: Record<string, unknown>;
      },
    ) => {
      try {
        const result = await supabaseService.createProject({
          ...project,
          type: project.type as "nextjs" | "react" | "node" | "python" | "java" | "other"
        });
        return { success: true, project: result };
      } catch (error: unknown) {
        logger.error("Failed to create project", error as Error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get all projects
  ipcMain.handle("get-projects", async () => {
    try {
      const projects = await supabaseService.getProjects();
      return { success: true, projects };
    } catch (error: unknown) {
      logger.error("Failed to get projects", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        projects: [],
      };
    }
  });

  // Create a session
  ipcMain.handle(
    "create-session",
    async (
      _event,
      session: {
        user_id: string;
        project_id: string;
        title?: string;
        description?: string;
        metadata?: Record<string, unknown>;
      },
    ) => {
      try {
        // Convert to Session format
        const sessionData = {
          name: session.title || 'Untitled Session',
          description: session.description || '',
          status: 'pending' as const,
          userId: session.user_id,
          projectId: session.project_id,
          request: {
            id: '',  // Will be set by service
            sessionId: '', // Will be set by service
            userId: session.user_id,
            content: session.description || '',
            context: {},
            timestamp: new Date().toISOString()
          },
          metadata: session.metadata || {}
        };
        const result = await supabaseService.createSession(sessionData);
        return { success: true, session: result };
      } catch (error: unknown) {
        logger.error("Failed to create session", error as Error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Update session status
  ipcMain.handle(
    "update-session-status",
    async (_event, sessionId: string, status: string) => {
      try {
        // Map the status to SessionStatus
        const statusMap: Record<string, SessionStatus> = {
          'active': 'executing',
          'completed': 'completed',
          'paused': 'pending',
          'cancelled': 'cancelled'
        };
        
        const sessionStatus = statusMap[status] || 'pending';
        
        const result = await supabaseService.updateSession(sessionId, {
          status: sessionStatus,
        });
        return { success: true, session: result };
      } catch (error: unknown) {
        logger.error("Failed to update session", error as Error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Get active sessions
  ipcMain.handle("get-active-sessions", async () => {
    try {
      const sessions = await supabaseService.getActiveSessions();
      return { success: true, sessions };
    } catch (error: unknown) {
      logger.error("Failed to get active sessions", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sessions: [],
      };
    }
  });

  // Get session statistics
  ipcMain.handle("get-session-stats", async (_event, sessionId?: string) => {
    try {
      const stats = await supabaseService.getSessionStatistics(sessionId);
      return { success: true, stats };
    } catch (error: unknown) {
      logger.error("Failed to get session statistics", error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stats: [],
      };
    }
  });

  // Initialize Supabase on app start
  ipcMain.handle("init-supabase", async () => {
    try {
      await supabaseService.initialize();
      return { success: true };
    } catch (error: unknown) {
      logger.warn(
        "Supabase initialization failed - credentials may not be configured",
        error as Error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
