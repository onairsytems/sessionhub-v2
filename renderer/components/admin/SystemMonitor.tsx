import React, { useEffect, useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SystemMetric {
  cpu?: number;
  memory?: number;
  disk?: number;
  apiResponseTime?: number;
  uptime?: number;
}

interface HealthCheck {
  database: boolean;
  authentication: boolean;
  services: boolean;
}

interface SystemStatsResponse {
  success: boolean;
  stats?: {
    systemHealth?: SystemMetric;
  };
}

interface HealthCheckResponse {
  success: boolean;
  healthChecks?: HealthCheck;
}

export const SystemMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetric>({});
  const [healthChecks, setHealthChecks] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    void loadSystemData();

    if (autoRefresh) {
      intervalRef.current = setInterval(loadSystemData, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const loadSystemData = async () => {
    try {
      // Get system stats
      const statsResult = await window.electron.invoke('admin:get-system-stats') as SystemStatsResponse;
      if (statsResult.success && statsResult.stats?.systemHealth) {
        setMetrics(statsResult.stats.systemHealth);
      }

      // Get health checks
      const healthResult = await window.electron.invoke('admin:health-check') as HealthCheckResponse;
      if (healthResult.success && healthResult.healthChecks) {
        setHealthChecks(healthResult.healthChecks);
      }

      // Record current metrics
      await recordMetrics();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const recordMetrics = async () => {
    try {
      // Get process memory usage
      const memoryUsage = (window.performance as any).memory;
      if (memoryUsage) {
        const memoryPercent = (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100;
        await window.electron.invoke('admin:record-metric', 'memory', memoryPercent, '%');
      }

      // Record API response time (mock for now)
      const apiResponseTime = Math.random() * 100 + 50; // 50-150ms
      await window.electron.invoke('admin:record-metric', 'apiResponseTime', apiResponseTime, 'ms');
    } catch (error) {
    }
  };

  const getMetricColor = (value: number, type: string) => {
    if (type === 'apiResponseTime') {
      if (value < 100) return 'text-green-600';
      if (value < 500) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (value < 60) return 'text-green-600';
      if (value < 80) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '< 1m';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">System Monitoring</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-refresh</span>
            </label>
            <Button onClick={() => void loadSystemData()} variant="secondary">
              Refresh Now
            </Button>
          </div>
        </div>
      </Card>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Database</h4>
              <p className="text-2xl font-semibold mt-2">
                {healthChecks?.database ? (
                  <span className="text-green-600">Healthy</span>
                ) : (
                  <span className="text-red-600">Error</span>
                )}
              </p>
            </div>
            <div className={`text-4xl ${healthChecks?.database ? 'text-green-600' : 'text-red-600'}`}>
              {healthChecks?.database ? '✓' : '✗'}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Authentication</h4>
              <p className="text-2xl font-semibold mt-2">
                {healthChecks?.authentication ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-red-600">Inactive</span>
                )}
              </p>
            </div>
            <div className={`text-4xl ${healthChecks?.authentication ? 'text-green-600' : 'text-red-600'}`}>
              {healthChecks?.authentication ? '✓' : '✗'}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Services</h4>
              <p className="text-2xl font-semibold mt-2">
                {healthChecks?.services ? (
                  <span className="text-green-600">Running</span>
                ) : (
                  <span className="text-red-600">Down</span>
                )}
              </p>
            </div>
            <div className={`text-4xl ${healthChecks?.services ? 'text-green-600' : 'text-red-600'}`}>
              {healthChecks?.services ? '✓' : '✗'}
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">CPU Usage</h4>
          <p className={`text-3xl font-bold mt-2 ${getMetricColor(metrics.cpu || 0, 'cpu')}`}>
            {metrics.cpu ? `${metrics.cpu.toFixed(1)}%` : 'N/A'}
          </p>
          <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.cpu || 0}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Memory Usage</h4>
          <p className={`text-3xl font-bold mt-2 ${getMetricColor(metrics.memory || 0, 'memory')}`}>
            {metrics.memory ? `${metrics.memory.toFixed(1)}%` : 'N/A'}
          </p>
          <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.memory || 0}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Disk Usage</h4>
          <p className={`text-3xl font-bold mt-2 ${getMetricColor(metrics.disk || 0, 'disk')}`}>
            {metrics.disk ? `${metrics.disk.toFixed(1)}%` : 'N/A'}
          </p>
          <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.disk || 0}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">API Response</h4>
          <p className={`text-3xl font-bold mt-2 ${getMetricColor(metrics.apiResponseTime || 0, 'apiResponseTime')}`}>
            {metrics.apiResponseTime ? `${metrics.apiResponseTime.toFixed(0)}ms` : 'N/A'}
          </p>
          <div className="mt-3 text-sm text-gray-500">
            Average response time
          </div>
        </Card>
      </div>

      {/* System Info */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Uptime:</span>
            <span className="ml-2 font-medium">{formatUptime(metrics.uptime)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Platform:</span>
            <span className="ml-2 font-medium">{process.platform}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Node Version:</span>
            <span className="ml-2 font-medium">{process.version}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Electron Version:</span>
            <span className="ml-2 font-medium">{process.versions.electron}</span>
          </div>
        </div>
      </Card>

      {/* Alert Thresholds */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Alert Thresholds</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span className="text-sm">CPU usage above 80%</span>
            <span className="text-xs text-yellow-600 dark:text-yellow-400">Warning</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span className="text-sm">Memory usage above 90%</span>
            <span className="text-xs text-red-600 dark:text-red-400">Critical</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span className="text-sm">API response time above 500ms</span>
            <span className="text-xs text-yellow-600 dark:text-yellow-400">Warning</span>
          </div>
        </div>
      </Card>
    </div>
  );
};