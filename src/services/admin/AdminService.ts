import { Logger } from '../../lib/logging/Logger';
import { SupabaseService } from '../cloud/SupabaseService';

export interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  fullName?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  totalSessions: number;
  systemHealth: {
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: number;
    apiResponseTime?: number;
  };
  recentErrors: number;
  apiResponseTime: number;
}

export interface SystemHealthMetric {
  id: string;
  metricType: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
  recordedAt: Date;
}

export interface EmergencyAccessLog {
  id: string;
  adminId: string;
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  affectedResources?: any[];
  createdAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export class AdminServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AdminServiceError';
  }
}

export class AdminService {
  private static instance: AdminService;
  private logger: Logger;

  private constructor(
    private supabaseService: SupabaseService
  ) {
    this.logger = new Logger('AdminService');
  }

  static getInstance(supabaseService: SupabaseService): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService(supabaseService);
    }
    return AdminService.instance;
  }

  async checkAdminRole(userId?: string): Promise<boolean> {
    try {
      const targetUserId = userId || (await this.supabaseService.getCurrentUser())?.id;
      if (!targetUserId) {
        return false;
      }

      const { data, error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .select('role')
        .eq('id', targetUserId)
        .single();

      if (error) {
        this.logger.error('Failed to check admin role', error as Error);
        return false;
      }

      return data?.role === 'admin' || data?.role === 'super_admin';
    } catch (error) {
      this.logger.error('Error checking admin role', error as Error);
      return false;
    }
  }

  async checkSuperAdminRole(userId?: string): Promise<boolean> {
    try {
      const targetUserId = userId || (await this.supabaseService.getCurrentUser())?.id;
      if (!targetUserId) {
        return false;
      }

      const { data, error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .select('role')
        .eq('id', targetUserId)
        .single();

      if (error) {
        this.logger.error('Failed to check super admin role', error as Error);
        return false;
      }

      return data?.role === 'super_admin';
    } catch (error) {
      this.logger.error('Error checking super admin role', error as Error);
      return false;
    }
  }

  async requireAdminRole(): Promise<void> {
    const isAdmin = await this.checkAdminRole();
    if (!isAdmin) {
      throw new AdminServiceError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
    }
  }

  async requireSuperAdminRole(): Promise<void> {
    const isSuperAdmin = await this.checkSuperAdminRole();
    if (!isSuperAdmin) {
      throw new AdminServiceError('Super admin access required', 'SUPER_ADMIN_ACCESS_REQUIRED');
    }
  }

  async getAllUsers(): Promise<UserProfile[]> {
    await this.requireAdminRole();

    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new AdminServiceError('Failed to fetch users', 'FETCH_USERS_ERROR');
      }

      await this.logAdminAction('VIEW_ALL_USERS', 'user_list');

      return data.map(this.mapUserProfile);
    } catch (error) {
      this.logger.error('Failed to get all users', error as Error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    await this.requireAdminRole();

    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new AdminServiceError('Failed to fetch user', 'FETCH_USER_ERROR');
      }

      await this.logAdminAction('VIEW_USER', 'user', userId);

      return this.mapUserProfile(data);
    } catch (error) {
      this.logger.error('Failed to get user by ID', error as Error);
      throw error;
    }
  }

  async updateUserRole(userId: string, role: 'user' | 'admin' | 'super_admin'): Promise<void> {
    await this.requireSuperAdminRole();

    try {
      const { error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new AdminServiceError('Failed to update user role', 'UPDATE_ROLE_ERROR');
      }

      await this.logAdminAction('UPDATE_USER_ROLE', 'user', userId, { newRole: role });
    } catch (error) {
      this.logger.error('Failed to update user role', error as Error);
      throw error;
    }
  }

  async suspendUser(userId: string): Promise<void> {
    await this.requireAdminRole();

    try {
      const { error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new AdminServiceError('Failed to suspend user', 'SUSPEND_USER_ERROR');
      }

      await this.logAdminAction('SUSPEND_USER', 'user', userId);
    } catch (error) {
      this.logger.error('Failed to suspend user', error as Error);
      throw error;
    }
  }

  async activateUser(userId: string): Promise<void> {
    await this.requireAdminRole();

    try {
      const { error } = await this.supabaseService.getClient()
        .from('user_profiles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw new AdminServiceError('Failed to activate user', 'ACTIVATE_USER_ERROR');
      }

      await this.logAdminAction('ACTIVATE_USER', 'user', userId);
    } catch (error) {
      this.logger.error('Failed to activate user', error as Error);
      throw error;
    }
  }

  async getSystemStats(): Promise<SystemStats> {
    await this.requireAdminRole();

    try {
      const client = this.supabaseService.getClient();

      // Get user counts
      const { count: totalUsers } = await client
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      const { count: activeUsers } = await client
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get project count
      const { count: totalProjects } = await client
        .from('projects')
        .select('*', { count: 'exact', head: true });

      // Get session count
      const { count: totalSessions } = await client
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      // Get recent system health metrics
      const { data: healthMetrics } = await client
        .from('system_health_metrics')
        .select('*')
        .gte('recorded_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false });

      const systemHealth = this.aggregateHealthMetrics(healthMetrics || []);

      // Get recent error count (last 24 hours)
      const { count: recentErrors } = await client
        .from('admin_audit_logs')
        .select('*', { count: 'exact', head: true })
        .ilike('action', '%error%')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      await this.logAdminAction('VIEW_SYSTEM_STATS', 'system');

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalProjects: totalProjects || 0,
        totalSessions: totalSessions || 0,
        systemHealth,
        recentErrors: recentErrors || 0,
        apiResponseTime: systemHealth.apiResponseTime || 0
      };
    } catch (error) {
      this.logger.error('Failed to get system stats', error as Error);
      throw error;
    }
  }

  async getAuditLogs(filters?: {
    adminId?: string;
    action?: string;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AdminAuditLog[]> {
    await this.requireAdminRole();

    try {
      let query = this.supabaseService.getClient()
        .from('admin_audit_logs')
        .select('*');

      if (filters?.adminId) {
        query = query.eq('admin_id', filters.adminId);
      }
      if (filters?.action) {
        query = query.ilike('action', `%${filters.action}%`);
      }
      if (filters?.targetType) {
        query = query.eq('target_type', filters.targetType);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      query = query.order('created_at', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new AdminServiceError('Failed to fetch audit logs', 'FETCH_AUDIT_LOGS_ERROR');
      }

      return data.map(this.mapAuditLog);
    } catch (error) {
      this.logger.error('Failed to get audit logs', error as Error);
      throw error;
    }
  }

  async recordSystemMetric(
    metricType: string,
    value: number,
    unit?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService.getClient()
        .from('system_health_metrics')
        .insert({
          metric_type: metricType,
          value,
          unit,
          metadata,
          recorded_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('Failed to record system metric', error as Error);
      }
    } catch (error) {
      this.logger.error('Error recording system metric', error as Error);
    }
  }

  async logEmergencyAccess(
    action: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    reason: string,
    affectedResources?: any[]
  ): Promise<string> {
    await this.requireAdminRole();

    try {
      const currentUser = await this.supabaseService.getCurrentUser();
      if (!currentUser) {
        throw new AdminServiceError('No authenticated user', 'NO_AUTH_USER');
      }

      const { data, error } = await this.supabaseService.getClient()
        .from('emergency_access_logs')
        .insert({
          admin_id: currentUser.id,
          action,
          severity,
          reason,
          affected_resources: affectedResources || []
        })
        .select()
        .single();

      if (error) {
        throw new AdminServiceError('Failed to log emergency access', 'LOG_EMERGENCY_ERROR');
      }

      // Also log in audit trail
      await this.logAdminAction(`EMERGENCY_${action}`, 'emergency', data.id, {
        severity,
        reason
      });

      return data.id;
    } catch (error) {
      this.logger.error('Failed to log emergency access', error as Error);
      throw error;
    }
  }

  async resolveEmergencyAccess(
    emergencyLogId: string,
    resolutionNotes: string
  ): Promise<void> {
    await this.requireAdminRole();

    try {
      const { error } = await this.supabaseService.getClient()
        .from('emergency_access_logs')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', emergencyLogId);

      if (error) {
        throw new AdminServiceError('Failed to resolve emergency access', 'RESOLVE_EMERGENCY_ERROR');
      }

      await this.logAdminAction('RESOLVE_EMERGENCY', 'emergency', emergencyLogId);
    } catch (error) {
      this.logger.error('Failed to resolve emergency access', error as Error);
      throw error;
    }
  }

  private async logAdminAction(
    action: string,
    targetType?: string,
    targetId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const currentUser = await this.supabaseService.getCurrentUser();
      if (!currentUser) {
        return;
      }

      const { error } = await this.supabaseService.getClient()
        .from('admin_audit_logs')
        .insert({
          admin_id: currentUser.id,
          action,
          target_type: targetType,
          target_id: targetId,
          details: details || {},
          created_at: new Date().toISOString()
        });

      if (error) {
        this.logger.error('Failed to log admin action', error as Error);
      }
    } catch (error) {
      this.logger.error('Error logging admin action', error as Error);
    }
  }

  private mapUserProfile(data: any): UserProfile {
    return {
      id: data.id,
      email: data.email,
      role: data.role,
      fullName: data.full_name,
      isActive: data.is_active,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      metadata: data.metadata
    };
  }

  private mapAuditLog(data: any): AdminAuditLog {
    return {
      id: data.id,
      adminId: data.admin_id,
      action: data.action,
      targetType: data.target_type,
      targetId: data.target_id,
      details: data.details,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      createdAt: new Date(data.created_at)
    };
  }

  private aggregateHealthMetrics(metrics: any[]): SystemStats['systemHealth'] {
    const result: SystemStats['systemHealth'] = {};
    
    const metricTypes = ['cpu', 'memory', 'disk', 'apiResponseTime'];
    
    for (const type of metricTypes) {
      const typeMetrics = metrics.filter(m => m.metric_type === type);
      if (typeMetrics.length > 0) {
        const avgValue = typeMetrics.reduce((sum, m) => sum + m.value, 0) / typeMetrics.length;
        result[type as keyof SystemStats['systemHealth']] = avgValue;
      }
    }

    // Add uptime if available
    const uptimeMetric = metrics.find(m => m.metric_type === 'uptime');
    if (uptimeMetric) {
      result.uptime = uptimeMetric.value;
    }

    return result;
  }
}

// Export singleton instance getter
export const getAdminService = (supabaseService: SupabaseService): AdminService => {
  return AdminService.getInstance(supabaseService);
};