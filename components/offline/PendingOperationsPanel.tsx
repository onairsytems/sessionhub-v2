/**
 * Pending Operations Panel Component
 * Shows detailed view of pending offline operations
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudOffIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TrendingUpIcon,
  XIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon
} from 'lucide-react';
import { QueuedOperation } from '@/src/services/offline/OfflineOperationQueue';
import { formatDistanceToNow } from 'date-fns';

interface PendingOperationsPanelProps {
  operations: QueuedOperation[];
  onRetry?: (operationId: string) => void;
  onCancel?: (operationId: string) => void;
  onClearCompleted?: () => void;
  onProcessQueue?: () => void;
  isProcessing?: boolean;
  className?: string;
}

export const PendingOperationsPanel: React.FC<PendingOperationsPanelProps> = ({
  operations,
  onRetry,
  onCancel,
  onClearCompleted,
  onProcessQueue,
  isProcessing = false,
  className = ''
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed' | 'completed'>('all');

  const filteredOperations = operations.filter(op => {
    if (filter === 'all') return true;
    return op.status === filter;
  });

  const getStatusIcon = (status: QueuedOperation['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <RefreshCwIcon className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'low':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getOperationDescription = (op: QueuedOperation): string => {
    switch (op.type) {
      case 'api_call':
        return `API: ${op.metadata.method} ${op.metadata.endpoint}`;
      case 'database_sync':
        return `Sync: ${op.operation}`;
      case 'file_sync':
        return `File: ${op.operation}`;
      default:
        return op.operation;
    }
  };

  const stats = {
    total: operations.length,
    pending: operations.filter(op => op.status === 'pending').length,
    processing: operations.filter(op => op.status === 'processing').length,
    failed: operations.filter(op => op.status === 'failed').length,
    completed: operations.filter(op => op.status === 'completed').length
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudOffIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold">Pending Operations</h3>
            <span className="text-sm text-gray-500">({stats.total})</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Process Queue Button */}
            {stats.pending > 0 && onProcessQueue && (
              <button
                onClick={onProcessQueue}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <PauseIcon className="w-4 h-4" />
                    Processing...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Process Queue
                  </>
                )}
              </button>
            )}

            {/* Clear Completed Button */}
            {stats.completed > 0 && onClearCompleted && (
              <button
                onClick={onClearCompleted}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <TrashIcon className="w-4 h-4" />
                Clear Completed
              </button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-3 h-3 text-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Pending: {stats.pending}
            </span>
          </div>
          {stats.processing > 0 && (
            <div className="flex items-center gap-1">
              <RefreshCwIcon className="w-3 h-3 text-blue-500 animate-spin" />
              <span className="text-gray-600 dark:text-gray-400">
                Processing: {stats.processing}
              </span>
            </div>
          )}
          {stats.failed > 0 && (
            <div className="flex items-center gap-1">
              <XCircleIcon className="w-3 h-3 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Failed: {stats.failed}
              </span>
            </div>
          )}
          {stats.completed > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="w-3 h-3 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Completed: {stats.completed}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          {(['all', 'pending', 'failed', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`text-sm font-medium capitalize pb-2 border-b-2 transition-colors ${
                filter === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Operations List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredOperations.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CloudOffIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No {filter !== 'all' ? filter : ''} operations</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredOperations.map(operation => (
              <motion.div
                key={operation.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                onClick={() => setSelectedOperation(
                  selectedOperation === operation.id ? null : operation.id
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(operation.status)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getOperationDescription(operation)}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className={`px-2 py-0.5 rounded ${getPriorityColor(operation.metadata.priority)}`}>
                          {operation.metadata.priority}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(operation.metadata.timestamp), { addSuffix: true })}
                        </span>
                        {operation.metadata.retryCount > 0 && (
                          <span className="flex items-center gap-1">
                            <TrendingUpIcon className="w-3 h-3" />
                            Retry {operation.metadata.retryCount}/{operation.metadata.maxRetries}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {operation.status === 'failed' && onRetry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(operation.id);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Retry operation"
                      >
                        <RefreshCwIcon className="w-4 h-4" />
                      </button>
                    )}
                    {operation.status !== 'completed' && onCancel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel(operation.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Cancel operation"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {selectedOperation === operation.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700"
                    >
                      {/* Error Message */}
                      {operation.error && (
                        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded">
                          <div className="flex items-start gap-2">
                            <AlertCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {operation.error}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Operation Details */}
                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-gray-500">Type:</span>
                          <span className="ml-2 font-mono">{operation.type}</span>
                        </div>
                        {operation.metadata.sessionId && (
                          <div>
                            <span className="text-gray-500">Session:</span>
                            <span className="ml-2 font-mono">{operation.metadata.sessionId}</span>
                          </div>
                        )}
                        {operation.metadata.userId && (
                          <div>
                            <span className="text-gray-500">User:</span>
                            <span className="ml-2 font-mono">{operation.metadata.userId}</span>
                          </div>
                        )}
                      </div>

                      {/* Payload Preview */}
                      {operation.payload && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                            View Payload
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                            {JSON.stringify(operation.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};