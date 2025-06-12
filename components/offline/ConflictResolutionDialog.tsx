/**
 * Conflict Resolution Dialog Component
 * Interactive UI for resolving sync conflicts
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangleIcon,
  GitBranchIcon,
  CheckIcon,
  XIcon,
  CodeIcon,
  ClockIcon,
  UserIcon,
  ServerIcon,
  MergeIcon
} from 'lucide-react';
import { ConflictItem } from '@/src/services/offline/ConflictResolutionService';
import { formatDistanceToNow } from 'date-fns';
import { DiffViewer } from './DiffViewer';

interface ConflictResolutionDialogProps {
  conflict: ConflictItem;
  onResolve: (resolution: 'local' | 'remote' | 'merge' | 'custom', customValue?: unknown) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  conflict,
  onResolve,
  onCancel,
  isOpen
}) => {
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge' | 'custom' | null>(
    conflict.suggestedResolution || null
  );
  const [customValue, setCustomValue] = useState<string>('');
  const [showDiff, setShowDiff] = useState(true);

  const handleResolve = () => {
    if (!selectedResolution) return;

    if (selectedResolution === 'custom') {
      try {
        const parsedValue = JSON.parse(customValue) as unknown;
        onResolve('custom', parsedValue);
      } catch {
        onResolve('custom', customValue);
      }
    } else {
      onResolve(selectedResolution);
    }
  };

  const getSeverityColor = (severity: ConflictItem['severity']) => {
    switch (severity) {
      case 'low':
        return 'text-yellow-600 bg-yellow-100';
      case 'medium':
        return 'text-orange-600 bg-orange-100';
      case 'high':
        return 'text-red-600 bg-red-100';
    }
  };

  const formatValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                      <AlertTriangleIcon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Resolve Sync Conflict</h2>
                      <p className="text-sm text-gray-500">
                        {conflict.table} - {conflict.field || 'Record'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onCancel}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Conflict Info */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Detected:</span>
                      <span>{formatDistanceToNow(conflict.conflictDetectedAt, { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GitBranchIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Severity:</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(conflict.severity)}`}>
                        {conflict.severity}
                      </span>
                    </div>
                    {conflict.autoResolvable && (
                      <div className="col-span-2 flex items-center gap-2">
                        <CheckIcon className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">
                          Auto-resolvable using {conflict.mergeStrategy} strategy
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Diff View Toggle */}
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Compare Changes</h3>
                  <button
                    onClick={() => setShowDiff(!showDiff)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showDiff ? 'Hide' : 'Show'} Differences
                  </button>
                </div>

                {/* Diff Viewer */}
                {showDiff && (
                  <div className="mb-6">
                    <DiffViewer
                      localValue={formatValue(conflict.localValue)}
                      remoteValue={formatValue(conflict.remoteValue)}
                      baseValue={conflict.baseValue ? formatValue(conflict.baseValue) : undefined}
                      type={typeof conflict.localValue === 'object' ? 'json' : 'text'}
                    />
                  </div>
                )}

                {/* Resolution Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold mb-3">Choose Resolution</h3>

                  {/* Local Version */}
                  <label className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedResolution === 'local' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="resolution"
                        value="local"
                        checked={selectedResolution === 'local'}
                        onChange={() => setSelectedResolution('local')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Keep Local Version</span>
                          <span className="text-xs text-gray-500">
                            ({formatDistanceToNow(conflict.localTimestamp, { addSuffix: true })})
                          </span>
                        </div>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                          {formatValue(conflict.localValue)}
                        </pre>
                      </div>
                    </div>
                  </label>

                  {/* Remote Version */}
                  <label className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedResolution === 'remote' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="resolution"
                        value="remote"
                        checked={selectedResolution === 'remote'}
                        onChange={() => setSelectedResolution('remote')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ServerIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Keep Remote Version</span>
                          <span className="text-xs text-gray-500">
                            ({formatDistanceToNow(conflict.remoteTimestamp, { addSuffix: true })})
                          </span>
                        </div>
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                          {formatValue(conflict.remoteValue)}
                        </pre>
                      </div>
                    </div>
                  </label>

                  {/* Merge Option */}
                  {conflict.autoResolvable && (
                    <label className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedResolution === 'merge' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                    }`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="resolution"
                          value="merge"
                          checked={selectedResolution === 'merge'}
                          onChange={() => setSelectedResolution('merge')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MergeIcon className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">Auto-Merge</span>
                            <span className="text-xs text-gray-500">
                              (using {conflict.mergeStrategy} strategy)
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Automatically merge changes using the {conflict.mergeStrategy} strategy
                          </p>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Custom Value */}
                  <label className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedResolution === 'custom' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="resolution"
                        value="custom"
                        checked={selectedResolution === 'custom'}
                        onChange={() => setSelectedResolution('custom')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CodeIcon className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Custom Value</span>
                        </div>
                        <textarea
                          value={customValue}
                          onChange={(e) => setCustomValue(e.target.value)}
                          placeholder="Enter custom value (JSON for objects/arrays)"
                          className="w-full h-24 px-3 py-2 text-sm border rounded bg-white dark:bg-gray-900 dark:border-gray-700"
                          disabled={selectedResolution !== 'custom'}
                        />
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!selectedResolution}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resolve Conflict
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};