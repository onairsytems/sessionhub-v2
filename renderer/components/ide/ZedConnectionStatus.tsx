import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface ConnectionHealth {
  isConnected: boolean;
  isZedRunning: boolean;
  isMCPAvailable: boolean;
  lastHealthCheck: Date;
  connectionUptime: number;
  errors: string[];
}

export const ZedConnectionStatus: React.FC = () => {
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Get initial status
    checkHealth();

    // Set up health check polling
    const interval = setInterval(checkHealth, 5000);

    // Listen for health updates
    const handleHealthUpdate = (healthData: ConnectionHealth) => {
      setHealth(healthData);
    };

    window.electronAPI.api.on('zed:health-update', handleHealthUpdate as any);

    return () => {
      clearInterval(interval);
      window.electronAPI.api.off('zed:health-update', handleHealthUpdate as any);
    };
  }, []);

  const checkHealth = async () => {
    try {
      const healthData = await window.electronAPI.zed.getConnectionHealth();
      setHealth(healthData);
    } catch (error) {
      // Handle error silently - health state will remain unchanged
      // The UI will continue to show the last known state
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await window.electronAPI.zed.reconnect();
    } catch (error) {
      // Show user-friendly error notification
      window.electronAPI.api.showNotification({
        title: 'Reconnection Failed',
        body: error instanceof Error ? error.message : 'Unable to reconnect to Zed',
        type: 'error'
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!health) {
    return (
      <Card className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (health.isConnected && health.isMCPAvailable) return 'bg-green-500';
    if (health.isConnected || health.isZedRunning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (health.isConnected && health.isMCPAvailable) return 'Connected';
    if (health.isConnected) return 'Partial Connection';
    if (health.isZedRunning) return 'Zed Running (Not Connected)';
    return 'Disconnected';
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Zed Connection
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {getStatusText()}
              </p>
            </div>
          </div>
          
          {!health.isConnected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleReconnect()}
              disabled={isReconnecting}
            >
              {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <StatusItem
            label="Zed"
            value={health.isZedRunning ? 'Running' : 'Not Running'}
            success={health.isZedRunning}
          />
          <StatusItem
            label="MCP"
            value={health.isMCPAvailable ? 'Available' : 'Unavailable'}
            success={health.isMCPAvailable}
          />
          <StatusItem
            label="Uptime"
            value={health.connectionUptime > 0 ? formatUptime(health.connectionUptime) : 'N/A'}
            success={health.connectionUptime > 0}
          />
        </div>

        {health.errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-2">
            <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">
              Issues:
            </p>
            <ul className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
              {health.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Last checked: {new Date(health.lastHealthCheck).toLocaleTimeString()}
        </div>
      </div>
    </Card>
  );
};

const StatusItem: React.FC<{ label: string; value: string; success: boolean }> = ({
  label,
  value,
  success
}) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded p-2">
    <p className="text-gray-600 dark:text-gray-400">{label}</p>
    <p className={`font-medium ${success ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
      {value}
    </p>
  </div>
);