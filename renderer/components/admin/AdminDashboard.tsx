import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SystemMonitor } from './SystemMonitor';
import { UserManagement } from './UserManagement';
import { AuditLog } from './AuditLog';
import { EmergencyPanel } from './EmergencyPanel';

interface AdminDashboardProps {
  onClose?: () => void;
}

interface AdminAccessResult {
  success: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

interface SystemStatsResult {
  success: boolean;
  stats?: {
    totalUsers?: number;
    activeUsers?: number;
    totalProjects?: number;
    totalSessions?: number;
    recentErrors?: number;
  };
}

interface HealthCheckResult {
  success: boolean;
  overallHealth?: boolean;
  healthChecks?: {
    database?: boolean;
    authentication?: boolean;
    services?: boolean;
  };
}

type TabType = 'overview' | 'users' | 'system' | 'audit' | 'emergency';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [systemStats, setSystemStats] = useState<SystemStatsResult['stats']>(undefined);

  useEffect(() => {
    void checkAdminAccess();
    loadSystemStats();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const adminResult = await window.electron.invoke('admin:check-access') as AdminAccessResult;
      const superAdminResult = await window.electron.invoke('admin:check-super-access') as AdminAccessResult;
      
      setIsAdmin(adminResult.success && (adminResult.isAdmin ?? false));
      setIsSuperAdmin(superAdminResult.success && (superAdminResult.isSuperAdmin ?? false));
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      const result = await window.electron.invoke('admin:get-system-stats') as SystemStatsResult;
      if (result.success && result.stats) {
        setSystemStats(result.stats);
      }
    } catch (error) {
    }
  };

  const performHealthCheck = async () => {
    try {
      const result = await window.electron.invoke('admin:health-check') as HealthCheckResult;
      if (result.success && result.healthChecks) {
        alert(`System Health: ${result.overallHealth ? 'Healthy' : 'Issues Detected'}\n\nDatabase: ${result.healthChecks.database ? '✓' : '✗'}\nAuthentication: ${result.healthChecks.authentication ? '✓' : '✗'}\nServices: ${result.healthChecks.services ? '✓' : '✗'}`);
      }
    } catch (error) {
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You do not have administrator privileges to access this area.</p>
          <Button onClick={() => void onClose?.()} variant="primary">Close</Button>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '📊' },
    { id: 'users' as TabType, label: 'Users', icon: '👥' },
    { id: 'system' as TabType, label: 'System', icon: '🖥️' },
    { id: 'audit' as TabType, label: 'Audit Log', icon: '📋' },
    ...(isSuperAdmin ? [{ id: 'emergency' as TabType, label: 'Emergency', icon: '🚨' }] : [])
  ];

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => void performHealthCheck()} variant="secondary">
              Health Check
            </Button>
            <Button onClick={() => void loadSystemStats()} variant="secondary">
              Refresh
            </Button>
            <Button onClick={() => void onClose?.()} variant="ghost">
              ✕
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-6 mt-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 pb-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {systemStats?.totalUsers || 0}
              </p>
              <p className="text-sm text-green-600 mt-2">
                {systemStats?.activeUsers || 0} active
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Projects</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {systemStats?.totalProjects || 0}
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Sessions</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {systemStats?.totalSessions || 0}
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Errors</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {systemStats?.recentErrors || 0}
              </p>
              <p className="text-sm text-gray-500 mt-2">Last 24 hours</p>
            </Card>
          </div>
        )}

        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'system' && <SystemMonitor />}
        {activeTab === 'audit' && <AuditLog />}
        {activeTab === 'emergency' && isSuperAdmin && <EmergencyPanel />}
      </div>
    </div>
  );
};