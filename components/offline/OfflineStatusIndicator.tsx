/**
 * Offline Status Indicator Component
 * Shows real-time network status and sync progress
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  WifiIcon, 
  WifiOffIcon, 
  CloudOffIcon, 
  CloudIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from 'lucide-react';
import { OfflineStatus } from '@/src/services/offline/OfflineModeManager';
import { QueueStatistics } from '@/src/services/offline/OfflineOperationQueue';
import { SyncProgress } from '@/src/services/offline/OfflineSyncEngine';

interface OfflineStatusIndicatorProps {
  status: OfflineStatus;
  queueStats?: QueueStatistics;
  syncProgress?: SyncProgress;
  className?: string;
  showDetails?: boolean;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  status,
  queueStats,
  syncProgress,
  className = '',
  showDetails = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    // Pulse when status changes
    setPulseAnimation(true);
    const timer = setTimeout(() => setPulseAnimation(false), 1000);
    return () => clearTimeout(timer);
  }, [status.isOnline, status.mode]);

  const getStatusIcon = () => {
    switch (status.mode) {
      case 'online':
        return <WifiIcon className="w-5 h-5" />;
      case 'offline':
        return <WifiOffIcon className="w-5 h-5" />;
      case 'syncing':
        return <RefreshCwIcon className="w-5 h-5 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status.mode) {
      case 'online':
        return status.connectionQuality === 'excellent' ? 'text-green-500' 
             : status.connectionQuality === 'good' ? 'text-green-400'
             : status.connectionQuality === 'fair' ? 'text-yellow-500'
             : 'text-orange-500';
      case 'offline':
        return 'text-red-500';
      case 'syncing':
        return 'text-blue-500';
    }
  };

  const getBackgroundColor = () => {
    switch (status.mode) {
      case 'online':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'offline':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'syncing':
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const formatTimeSince = (date?: Date): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className={`relative ${className}`}>
      <motion.div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${getBackgroundColor()}`}
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        animate={pulseAnimation ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {status.mode === 'online' ? 'Online' : 
             status.mode === 'offline' ? 'Offline' : 'Syncing'}
          </span>
        </div>

        {/* Pending Operations Badge */}
        {status.pendingOperations > 0 && (
          <div className="ml-2 flex items-center gap-1">
            <CloudOffIcon className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {status.pendingOperations}
            </span>
          </div>
        )}

        {/* Sync Progress */}
        {status.mode === 'syncing' && syncProgress && (
          <div className="ml-2 flex items-center gap-2">
            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${syncProgress.percentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {syncProgress.percentage}%
            </span>
          </div>
        )}
      </motion.div>

      {/* Expanded Details */}
      <AnimatePresence>
        {showDetails && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50"
          >
            <div className="space-y-3">
              {/* Connection Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <WifiIcon className="w-4 h-4" />
                  Connection Status
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={getStatusColor()}>{status.mode}</span>
                  </div>
                  {status.connectionQuality && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quality:</span>
                      <span>{status.connectionQuality}</span>
                    </div>
                  )}
                  {status.networkType && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Network:</span>
                      <span>{status.networkType}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Online:</span>
                    <span>{formatTimeSince(status.lastOnline)}</span>
                  </div>
                </div>
              </div>

              {/* Queue Statistics */}
              {queueStats && queueStats.total > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CloudOffIcon className="w-4 h-4" />
                    Pending Operations
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total:</span>
                      <span>{queueStats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pending:</span>
                      <span className="text-yellow-500">{queueStats.pending}</span>
                    </div>
                    {queueStats.processing > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Processing:</span>
                        <span className="text-blue-500">{queueStats.processing}</span>
                      </div>
                    )}
                    {queueStats.failed > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Failed:</span>
                        <span className="text-red-500">{queueStats.failed}</span>
                      </div>
                    )}
                    {queueStats.completed > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Completed:</span>
                        <span className="text-green-500">{queueStats.completed}</span>
                      </div>
                    )}
                  </div>

                  {/* Priority Breakdown */}
                  {queueStats.pending > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-500">By Priority:</div>
                      <div className="flex gap-2 text-xs">
                        {queueStats.byPriority.high > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                            High: {queueStats.byPriority.high}
                          </span>
                        )}
                        {queueStats.byPriority.medium > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            Med: {queueStats.byPriority.medium}
                          </span>
                        )}
                        {queueStats.byPriority.low > 0 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            Low: {queueStats.byPriority.low}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sync Progress Details */}
              {syncProgress && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <RefreshCwIcon className="w-4 h-4 animate-spin" />
                    Sync Progress
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Phase:</span>
                      <span className="capitalize">{syncProgress.phase}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Progress:</span>
                      <span>{syncProgress.current} / {syncProgress.total}</span>
                    </div>
                    {syncProgress.currentTable && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Current:</span>
                        <span>{syncProgress.currentTable}</span>
                      </div>
                    )}
                    {syncProgress.conflicts > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Conflicts:</span>
                        <span className="text-orange-500">{syncProgress.conflicts}</span>
                      </div>
                    )}
                    {syncProgress.errors > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Errors:</span>
                        <span className="text-red-500">{syncProgress.errors}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Messages */}
              <div className="border-t pt-3">
                {status.mode === 'offline' && (
                  <div className="flex items-start gap-2 text-xs">
                    <AlertCircleIcon className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">
                        You're working offline. Changes will be synced when connection is restored.
                      </p>
                    </div>
                  </div>
                )}
                
                {status.mode === 'syncing' && (
                  <div className="flex items-start gap-2 text-xs">
                    <CloudIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">
                        Syncing your offline changes with the cloud...
                      </p>
                    </div>
                  </div>
                )}

                {status.mode === 'online' && status.pendingOperations === 0 && (
                  <div className="flex items-start gap-2 text-xs">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">
                        All changes synced. You're up to date.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};