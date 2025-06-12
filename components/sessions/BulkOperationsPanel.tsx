import React, { useState } from 'react';
import { Session } from '@/src/models/Session';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Modal } from '@/components/ui/modal';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Archive, 
  Trash2, 
  Download, 
  Copy, 
  CheckSquare, 
  AlertTriangle,
  X,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { BulkOperationProgress, UndoableOperation } from '@/src/services/session/SessionOperationsService';

interface BulkOperationsPanelProps {
  sessions: Session[];
  selectedSessionIds: string[];
  onSelectionChange: (sessionIds: string[]) => void;
  onBulkArchive?: (sessionIds: string[]) => Promise<void>;
  onBulkDelete?: (sessionIds: string[]) => Promise<void>;
  onBulkExport?: (sessionIds: string[]) => Promise<void>;
  onBulkDuplicate?: (sessionIds: string[]) => Promise<void>;
  onUndo?: (operationId: string) => Promise<void>;
  undoableOperations?: UndoableOperation[];
  className?: string;
}

interface OperationState {
  type: 'archive' | 'delete' | 'export' | 'duplicate' | null;
  progress: BulkOperationProgress | null;
  isRunning: boolean;
  isPaused: boolean;
  results: {
    succeeded: string[];
    failed: Array<{ id: string; error: string }>;
  } | null;
}

export function BulkOperationsPanel({
  sessions,
  selectedSessionIds,
  onSelectionChange,
  onBulkArchive,
  onBulkDelete,
  onBulkExport,
  onBulkDuplicate,
  onUndo,
  undoableOperations = [],
  className = ''
}: BulkOperationsPanelProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<'archive' | 'delete' | 'export' | 'duplicate' | null>(null);
  const [operationState, setOperationState] = useState<OperationState>({
    type: null,
    progress: null,
    isRunning: false,
    isPaused: false,
    results: null
  });
  const [showResults, setShowResults] = useState(false);

  const selectedSessions = sessions.filter(session => selectedSessionIds.includes(session.id));
  const hasSelection = selectedSessionIds.length > 0;
  const isAllSelected = sessions.length > 0 && selectedSessionIds.length === sessions.length;
  const isSomeSelected = selectedSessionIds.length > 0 && selectedSessionIds.length < sessions.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sessions.map(session => session.id));
    }
  };

  const handleSessionToggle = (sessionId: string) => {
    if (selectedSessionIds.includes(sessionId)) {
      onSelectionChange(selectedSessionIds.filter(id => id !== sessionId));
    } else {
      onSelectionChange([...selectedSessionIds, sessionId]);
    }
  };

  const handleBulkOperation = (type: 'archive' | 'delete' | 'export' | 'duplicate') => {
    if (!hasSelection) return;

    if (type === 'delete' || type === 'archive') {
      setPendingOperation(type);
      setShowConfirmDialog(true);
    } else {
      void executeBulkOperation(type);
    }
  };

  const handleConfirmOperation = () => {
    if (pendingOperation) {
      void executeBulkOperation(pendingOperation);
    }
    setShowConfirmDialog(false);
    setPendingOperation(null);
  };

  const executeBulkOperation = async (type: 'archive' | 'delete' | 'export' | 'duplicate') => {
    if (!hasSelection) return;

    setOperationState({
      type,
      progress: {
        total: selectedSessionIds.length,
        completed: 0,
        failed: 0,
        inProgress: 0
      },
      isRunning: true,
      isPaused: false,
      results: null
    });

    try {
      const results: { succeeded: string[]; failed: Array<{ id: string; error: string }> } = {
        succeeded: [],
        failed: []
      };

      // Progress callback removed - using simplified approach

      switch (type) {
        case 'archive':
          if (onBulkArchive) {
            void onBulkArchive(selectedSessionIds);
            results.succeeded.push(...selectedSessionIds);
          }
          break;
        case 'delete':
          if (onBulkDelete) {
            void onBulkDelete(selectedSessionIds);
            results.succeeded.push(...selectedSessionIds);
          }
          break;
        case 'export':
          if (onBulkExport) {
            void onBulkExport(selectedSessionIds);
            results.succeeded.push(...selectedSessionIds);
          }
          break;
        case 'duplicate':
          if (onBulkDuplicate) {
            void onBulkDuplicate(selectedSessionIds);
            results.succeeded.push(...selectedSessionIds);
          }
          break;
      }

      setOperationState(prev => ({
        ...prev,
        isRunning: false,
        results
      }));

      setShowResults(true);
      
      // Clear selection after successful operation
      onSelectionChange([]);
    } catch (error) {
      setOperationState(prev => ({
        ...prev,
        isRunning: false,
        results: {
          succeeded: [],
          failed: selectedSessionIds.map(id => ({
            id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }))
        }
      }));
      setShowResults(true);
    }
  };

  const handlePauseResume = () => {
    setOperationState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  };

  const handleCancelOperation = () => {
    setOperationState({
      type: null,
      progress: null,
      isRunning: false,
      isPaused: false,
      results: null
    });
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'archive': return <Archive className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'export': return <Download className="w-4 h-4" />;
      case 'duplicate': return <Copy className="w-4 h-4" />;
      default: return null;
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'archive': return 'text-blue-600';
      case 'delete': return 'text-red-600';
      case 'export': return 'text-green-600';
      case 'duplicate': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selection Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isAllSelected}
                onChange={handleSelectAll}
                indeterminate={isSomeSelected}
                className="mr-2"
              />
              <span className="text-sm font-medium">
                {hasSelection ? (
                  `${selectedSessionIds.length} selected`
                ) : (
                  'Select sessions'
                )}
              </span>
            </div>
            
            {hasSelection && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedSessionIds.length} of {sessions.length} sessions
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectionChange([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>

          {/* Bulk Action Buttons */}
          {hasSelection && !operationState.isRunning && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkOperation('archive')}
                disabled={operationState.isRunning}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive ({selectedSessionIds.length})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkOperation('export')}
                disabled={operationState.isRunning}
              >
                <Download className="w-4 h-4 mr-2" />
                Export ({selectedSessionIds.length})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkOperation('duplicate')}
                disabled={operationState.isRunning}
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate ({selectedSessionIds.length})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkOperation('delete')}
                disabled={operationState.isRunning}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedSessionIds.length})
              </Button>
            </div>
          )}
        </div>

        {/* Operation Progress */}
        {operationState.isRunning && operationState.progress && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getOperationIcon(operationState.type || '')}
                <span className="font-medium capitalize">
                  {operationState.type}ing sessions...
                </span>
                {operationState.isPaused && (
                  <Badge variant="outline" className="text-yellow-600">
                    Paused
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePauseResume}
                >
                  {operationState.isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelOperation}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {operationState.progress.completed} of {operationState.progress.total} completed
                </span>
                <span>
                  {Math.round((operationState.progress.completed / operationState.progress.total) * 100)}%
                </span>
              </div>
              <Progress 
                value={(operationState.progress.completed / operationState.progress.total) * 100} 
                className="w-full"
              />
              {operationState.progress.currentItem && (
                <p className="text-xs text-muted-foreground">
                  Processing: {operationState.progress.currentItem}
                </p>
              )}
              {operationState.progress.failed > 0 && (
                <p className="text-xs text-red-600">
                  {operationState.progress.failed} failed
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Session Selection List */}
      {sessions.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Sessions</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map(session => (
              <div
                key={session.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handleSessionToggle(session.id)}
              >
                <Checkbox
                  checked={selectedSessionIds.includes(session.id)}
                  onChange={() => handleSessionToggle(session.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.description}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {session.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Undo Operations */}
      {undoableOperations.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Recent Operations (Undoable)</h3>
          <div className="space-y-2">
            {undoableOperations.slice(0, 5).map(operation => (
              <div
                key={operation.operationId}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {getOperationIcon(operation.type)}
                  <span className="text-sm capitalize">{operation.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {operation.sessionSnapshots.length} sessions
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onUndo?.(operation.operationId)}
                  className="text-blue-600 hover:bg-blue-50"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Undo
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Modal isOpen={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Confirm Bulk Operation</h3>
              <p className="text-sm text-muted-foreground">
                This action cannot be easily undone
              </p>
            </div>
          </div>
          
          <div className="mb-6">
            <p className="text-sm">
              Are you sure you want to <strong>{pendingOperation}</strong> the following{' '}
              <strong>{selectedSessionIds.length}</strong> sessions?
            </p>
            
            <div className="mt-3 p-3 bg-muted/50 rounded-lg max-h-32 overflow-y-auto">
              {selectedSessions.map(session => (
                <div key={session.id} className="text-xs text-muted-foreground py-1">
                  • {session.name}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmOperation}
              className={getOperationColor(pendingOperation || '')}
            >
              {pendingOperation === 'delete' ? 'Delete' : 'Archive'} Sessions
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results Dialog */}
      <Modal isOpen={showResults} onClose={() => setShowResults(false)}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              operationState.results?.failed.length === 0 ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <CheckSquare className={`w-6 h-6 ${
                operationState.results?.failed.length === 0 ? 'text-green-600' : 'text-yellow-600'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Operation Complete</h3>
              <p className="text-sm text-muted-foreground">
                {operationState.results?.succeeded.length || 0} succeeded, {operationState.results?.failed.length || 0} failed
              </p>
            </div>
          </div>
          
          {operationState.results && (
            <div className="space-y-4">
              {operationState.results.succeeded.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2">
                    Successful ({operationState.results.succeeded.length})
                  </h4>
                  <div className="bg-green-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {operationState.results.succeeded.map(sessionId => (
                      <div key={sessionId} className="text-xs text-green-800 py-1">
                        • {sessions.find(s => s.id === sessionId)?.name || sessionId}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {operationState.results.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">
                    Failed ({operationState.results.failed.length})
                  </h4>
                  <div className="bg-red-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {operationState.results.failed.map(({ id, error }) => (
                      <div key={id} className="text-xs text-red-800 py-1">
                        • {sessions.find(s => s.id === id)?.name || id}: {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button onClick={() => setShowResults(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}