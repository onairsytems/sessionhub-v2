import { ipcMain } from 'electron';
import { SupabaseService } from '../../src/services/cloud/SupabaseService';
import { getAdminService } from '../../src/services/admin/AdminService';
import { Logger } from '../../src/lib/logging/Logger';

const logger = new Logger('AdminHandlers');

export function registerAdminHandlers(): void {
  const serviceLogger = new Logger('SupabaseService');
  const supabaseService = new SupabaseService(serviceLogger);
  const adminService = getAdminService(supabaseService);

  // Check admin access
  ipcMain.handle('admin:check-access', async () => {
    try {
      const isAdmin = await adminService.checkAdminRole();
      return { success: true, isAdmin };
    } catch (error) {
      logger.error('Failed to check admin access', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Check super admin access
  ipcMain.handle('admin:check-super-access', async () => {
    try {
      const isSuperAdmin = await adminService.checkSuperAdminRole();
      return { success: true, isSuperAdmin };
    } catch (error) {
      logger.error('Failed to check super admin access', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get all users
  ipcMain.handle('admin:get-all-users', async () => {
    try {
      const users = await adminService.getAllUsers();
      return { success: true, users };
    } catch (error) {
      logger.error('Failed to get all users', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get user by ID
  ipcMain.handle('admin:get-user', async (_event, userId: string) => {
    try {
      const user = await adminService.getUserById(userId);
      return { success: true, user };
    } catch (error) {
      logger.error('Failed to get user', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update user role
  ipcMain.handle('admin:update-user-role', async (_event, userId: string, role: 'user' | 'admin' | 'super_admin') => {
    try {
      await adminService.updateUserRole(userId, role);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update user role', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Suspend user
  ipcMain.handle('admin:suspend-user', async (_event, userId: string) => {
    try {
      await adminService.suspendUser(userId);
      return { success: true };
    } catch (error) {
      logger.error('Failed to suspend user', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Activate user
  ipcMain.handle('admin:activate-user', async (_event, userId: string) => {
    try {
      await adminService.activateUser(userId);
      return { success: true };
    } catch (error) {
      logger.error('Failed to activate user', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get system stats
  ipcMain.handle('admin:get-system-stats', async () => {
    try {
      const stats = await adminService.getSystemStats();
      return { success: true, stats };
    } catch (error) {
      logger.error('Failed to get system stats', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get audit logs
  ipcMain.handle('admin:get-audit-logs', async (_event, filters?: {
    adminId?: string;
    action?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) => {
    try {
      const parsedFilters = filters ? {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined
      } : undefined;

      const logs = await adminService.getAuditLogs(parsedFilters);
      return { success: true, logs };
    } catch (error) {
      logger.error('Failed to get audit logs', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Record system metric
  ipcMain.handle('admin:record-metric', async (_event, metricType: string, value: number, unit?: string, metadata?: Record<string, unknown>) => {
    try {
      await adminService.recordSystemMetric(metricType, value, unit, metadata);
      return { success: true };
    } catch (error) {
      logger.error('Failed to record system metric', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Log emergency access
  ipcMain.handle('admin:log-emergency-access', async (_event, action: string, severity: 'low' | 'medium' | 'high' | 'critical', reason: string, affectedResources?: unknown[]) => {
    try {
      const logId = await adminService.logEmergencyAccess(action, severity, reason, affectedResources);
      return { success: true, logId };
    } catch (error) {
      logger.error('Failed to log emergency access', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Resolve emergency access
  ipcMain.handle('admin:resolve-emergency', async (_event, emergencyLogId: string, resolutionNotes: string) => {
    try {
      await adminService.resolveEmergencyAccess(emergencyLogId, resolutionNotes);
      return { success: true };
    } catch (error) {
      logger.error('Failed to resolve emergency access', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get emergency access logs
  ipcMain.handle('admin:get-emergency-logs', async () => {
    try {
      // Only super admins can view emergency logs
      const isSuperAdmin = await adminService.checkSuperAdminRole();
      if (!isSuperAdmin) {
        throw new Error('Super admin access required');
      }

      const { data, error } = await supabaseService.getClient()
        .from('emergency_access_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, logs: data };
    } catch (error) {
      logger.error('Failed to get emergency logs', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // System health check
  ipcMain.handle('admin:health-check', async () => {
    try {
      const isAdmin = await adminService.checkAdminRole();
      if (!isAdmin) {
        throw new Error('Admin access required');
      }

      // Perform health checks
      const healthChecks = {
        database: false,
        authentication: false,
        services: false
      };

      // Check database connection
      try {
        const { error } = await supabaseService.getClient()
          .from('user_profiles')
          .select('count')
          .limit(1);
        healthChecks.database = !error;
      } catch {
        healthChecks.database = false;
      }

      // Check authentication
      const currentUser = await supabaseService.getCurrentUser();
      healthChecks.authentication = !!currentUser;

      // Services are considered healthy if we got this far
      healthChecks.services = true;

      // Record health metrics
      const overallHealth = Object.values(healthChecks).every(v => v);
      await adminService.recordSystemMetric('system_health', overallHealth ? 100 : 50, '%', healthChecks);

      return { success: true, healthChecks, overallHealth };
    } catch (error) {
      logger.error('Failed to perform health check', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Batch user operations
  ipcMain.handle('admin:batch-user-operation', async (_event, operation: 'suspend' | 'activate', userIds: string[]) => {
    try {
      await adminService.requireAdminRole();

      const results = [];
      for (const userId of userIds) {
        try {
          if (operation === 'suspend') {
            await adminService.suspendUser(userId);
          } else {
            await adminService.activateUser(userId);
          }
          results.push({ userId, success: true });
        } catch (error) {
          results.push({ userId, success: false, error: (error as Error).message });
        }
      }

      return { success: true, results };
    } catch (error) {
      logger.error('Failed to perform batch operation', error as Error);
      return { success: false, error: (error as Error).message };
    }
  });

  logger.info('Admin handlers registered');
}