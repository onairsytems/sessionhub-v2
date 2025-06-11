import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,Zap,
  AlertTriangle,
  BarChart3,
  PlayCircle,} from 'lucide-react';

interface IntegrationHealth {
  integrationId: string;
  integrationName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  uptime: number;
  lastChecked: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
  consecutiveFailures: number;
  lastError?: string;
}

export const MCPIntegrationDashboard: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      // Connected to monitoring WebSocket
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'initial-health':
          setIntegrations(message.data);
          setLoading(false);
          break;
        case 'health-update':
          updateIntegrationHealth(message.data);
          break;
        case 'active-alerts':
          setActiveAlerts(message.data);
          break;
        case 'alert':
          addAlert(message.data);
          break;
        case 'test-results':
          setTestResults(message.data);
          break;
      }
    };

    ws.onclose = () => {
      // Disconnected from monitoring WebSocket
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  const updateIntegrationHealth = (health: IntegrationHealth) => {
    setIntegrations(prev => {
      const index = prev.findIndex(i => i.integrationId === health.integrationId);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = health;
        return updated;
      }
      return [...prev, health];
    });
  };

  const addAlert = (alert: any) => {
    setActiveAlerts(prev => [...prev, alert]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      case 'offline':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'offline':
        return <Clock className="w-5 h-5 text-gray-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatUptime = (uptime: number) => {
    return `${uptime.toFixed(1)}%`;
  };

  const formatResponseTime = (time: number) => {
    if (time < 1000) {
      return `${time}ms`;
    }
    return `${(time / 1000).toFixed(1)}s`;
  };

  const runBatchTest = async () => {
    try {
      // const response = await // window.electronAPI.runMCPBatchTest({
      //   type: 'test',
      //   integrationIds: integrations.map(i => i.integrationId)
      // });
      // // Batch test started
    } catch (error) {
      // Failed to start batch test
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const healthyCount = integrations.filter(i => i.status === 'healthy').length;
  const degradedCount = integrations.filter(i => i.status === 'degraded').length;
  const unhealthyCount = integrations.filter(i => i.status === 'unhealthy').length;
  const offlineCount = integrations.filter(i => i.status === 'offline').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Integration Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring and testing for MCP integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={wsConnected ? 'success' : 'destructive'}>
            {wsConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button onClick={runBatchTest} size="sm">
            <PlayCircle className="w-4 h-4 mr-2" />
            Run Batch Test
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Healthy</p>
              <p className="text-2xl font-bold text-green-500">{healthyCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Degraded</p>
              <p className="text-2xl font-bold text-yellow-500">{degradedCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unhealthy</p>
              <p className="text-2xl font-bold text-red-500">{unhealthyCount}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Offline</p>
              <p className="text-2xl font-bold text-gray-500">{offlineCount}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">Active Alerts</h2>
          <div className="space-y-2">
            {activeAlerts.slice(0, 5).map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.integrationName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{alert.message}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                  // Acknowledge alert
                }}>
                  Dismiss
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map(integration => (
          <Card key={integration.integrationId} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(integration.status)}
                <h3 className="font-semibold">{integration.integrationName}</h3>
              </div>
              <Badge className={getStatusColor(integration.status)}>
                {integration.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Uptime</span>
                <span className="font-medium">{formatUptime(integration.uptime)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Response Time</span>
                <span className="font-medium">{formatResponseTime(integration.responseTime)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Error Rate</span>
                <span className="font-medium">{integration.errorRate.toFixed(1)}%</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Throughput</span>
                <span className="font-medium">{integration.throughput.toFixed(1)} req/min</span>
              </div>

              {integration.lastError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                  <p className="text-red-600 dark:text-red-400">{integration.lastError}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1">
                <BarChart3 className="w-4 h-4 mr-1" />
                Details
              </Button>
              <Button size="sm" variant="ghost" className="flex-1">
                <Zap className="w-4 h-4 mr-1" />
                Test
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-3">Recent Test Results</h2>
          <div className="space-y-2">
            {testResults.map((result: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {result.status === 'passed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">{result.integrationName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {result.totalTests} tests • {result.duration}ms
                    </p>
                  </div>
                </div>
                <Badge variant={result.status === 'passed' ? 'success' : 'destructive'}>
                  {result.passed}/{result.totalTests} passed
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};