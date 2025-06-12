import React, { useState, useEffect } from 'react';
import { Session } from '@/src/models/Session';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  User, 
  Folder, 
  Tag, 
  PlayCircle, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  Download,
  FileText,
  Settings,
  Activity,
  Target
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface SessionPreviewModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onReopen?: (session: Session, newWorkflow?: boolean) => void;
  onDuplicate?: (session: Session) => void;
  onArchive?: (session: Session) => void;
  onDelete?: (session: Session) => void;
  onExport?: (session: Session) => void;
  onEdit?: (session: Session) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Pending',
  },
  planning: {
    icon: AlertCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Planning',
  },
  validating: {
    icon: AlertCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    label: 'Validating',
  },
  executing: {
    icon: PlayCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Executing',
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
    label: 'Completed',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Failed',
  },
  cancelled: {
    icon: AlertCircle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    label: 'Cancelled',
  },
};

export function SessionPreviewModal({ 
  session, 
  isOpen, 
  onClose, 
  onReopen, 
  onDuplicate, 
  onArchive, 
  onDelete, 
  onExport,
  onEdit 
}: SessionPreviewModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && session) {
      setActiveTab('overview');
    }
  }, [isOpen, session]);

  if (!session) return null;

  const status = statusConfig[session.status as keyof typeof statusConfig];
  const StatusIcon = status?.icon || Clock;
  const progress = session.metadata?.progress?.percentage || 0;
  const isInProgress = ['planning', 'validating', 'executing'].includes(session.status);
  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const canReopen = isCompleted || isFailed || session.status === 'cancelled';

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleAction = (action: () => void) => {
    setLoading(true);
    try {
      action();
    } finally {
      setLoading(false);
    }
  };

  const getInstructionSummary = () => {
    if (!session.instructions) return null;
    
    return {
      totalSteps: (session.instructions as { steps?: unknown[] }).steps?.length || 0,
      completedSteps: session.metadata?.progress?.completedSteps || 0,
      complexity: (session.instructions as { complexity?: string }).complexity || 'medium',
      estimatedDuration: (session.instructions as { estimatedDuration?: number }).estimatedDuration || 0
    };
  };

  const instructionSummary = getInstructionSummary();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col h-full max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`p-3 rounded-lg ${status?.bgColor}`}>
              <StatusIcon className={`w-6 h-6 ${status?.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{session.name}</h1>
              <p className="text-muted-foreground mt-1">{session.description}</p>
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="secondary" className={`${status?.bgColor} ${status?.color}`}>
                  {status?.label}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
                </div>
                {session.metadata?.totalDuration && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(session.metadata.totalDuration)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            {canReopen && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(() => void onReopen?.(session, false))}
                  disabled={loading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reopen
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(() => void onReopen?.(session, true))}
                  disabled={loading}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  New Workflow
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => void onDuplicate?.(session))}
              disabled={loading}
            >
              <Copy className="w-4 h-4 mr-2" />
              Duplicate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => void onExport?.(session))}
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Progress Bar for Active Sessions */}
        {isInProgress && (
          <div className="px-6 py-3 bg-muted/50">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {session.metadata?.progress?.currentStep && (
              <p className="text-xs text-muted-foreground mt-2">
                Current step: {session.metadata.progress.currentStep}
              </p>
            )}
          </div>
        )}

        {/* Content Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="overview" className="space-y-6 mt-0">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <User className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">User ID</p>
                        <p className="font-medium">{session.userId}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Folder className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Project</p>
                        <p className="font-medium">{session.projectId}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Activity className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Retry Count</p>
                        <p className="font-medium">{session.metadata?.retryCount || 0}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Request Content */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Request Content</h3>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="whitespace-pre-wrap">{session.request.content}</p>
                  </div>
                </Card>

                {/* Tags and Organization */}
                {(session.metadata?.tags?.length || 0) > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Tags</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {session.metadata.tags?.map((tag: string) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Error Information */}
                {session.error && (
                  <Card className="p-6 border-red-200 bg-red-50 dark:bg-red-950/20">
                    <div className="flex items-center gap-2 mb-4">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Error Details</h3>
                    </div>
                    <div className="space-y-2">
                      <p><strong>Code:</strong> {session.error.code}</p>
                      <p><strong>Message:</strong> {session.error.message}</p>
                      {session.error.actor && <p><strong>Actor:</strong> {session.error.actor}</p>}
                      {session.error.phase && <p><strong>Phase:</strong> {session.error.phase}</p>}
                      <p><strong>Recoverable:</strong> {session.error.recoverable ? 'Yes' : 'No'}</p>
                    </div>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="instructions" className="space-y-6 mt-0">
                {session.instructions ? (
                  <>
                    {instructionSummary && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold text-blue-600">{instructionSummary.totalSteps}</p>
                          <p className="text-sm text-muted-foreground">Total Steps</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold text-green-600">{instructionSummary.completedSteps}</p>
                          <p className="text-sm text-muted-foreground">Completed</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold text-purple-600 capitalize">{instructionSummary.complexity}</p>
                          <p className="text-sm text-muted-foreground">Complexity</p>
                        </Card>
                        <Card className="p-4 text-center">
                          <p className="text-2xl font-bold text-orange-600">
                            {instructionSummary.estimatedDuration ? `${Math.round(instructionSummary.estimatedDuration / 60)}m` : 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">Estimated</p>
                        </Card>
                      </div>
                    )}

                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Instruction Details</h3>
                      <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm">
                          {JSON.stringify(session.instructions, null, 2)}
                        </pre>
                      </div>
                    </Card>
                  </>
                ) : (
                  <Card className="p-8 text-center">
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No instructions available for this session</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="results" className="space-y-6 mt-0">
                {session.result ? (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Execution Results</h3>
                    <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(session.result, null, 2)}
                      </pre>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No results available for this session</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="metrics" className="space-y-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {session.metadata?.planningDuration && (
                    <Card className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {formatDuration(session.metadata.planningDuration)}
                      </p>
                      <p className="text-sm text-muted-foreground">Planning Time</p>
                    </Card>
                  )}
                  {session.metadata?.executionDuration && (
                    <Card className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {formatDuration(session.metadata.executionDuration)}
                      </p>
                      <p className="text-sm text-muted-foreground">Execution Time</p>
                    </Card>
                  )}
                  {session.metadata?.totalDuration && (
                    <Card className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {formatDuration(session.metadata.totalDuration)}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Duration</p>
                    </Card>
                  )}
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Session Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.createdAt), 'PPpp')}
                        </p>
                      </div>
                    </div>
                    
                    {session.updatedAt !== session.createdAt && (
                      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Last Updated</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(session.updatedAt), 'PPpp')}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {session.completedAt && (
                      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                        <div className={`w-3 h-3 rounded-full ${
                          session.status === 'completed' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <p className="font-medium">
                            {session.status === 'completed' ? 'Completed' : 'Failed'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(session.completedAt), 'PPpp')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-6 mt-0">
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Session Metadata</h3>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(session.metadata, null, 2)}
                    </pre>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">Request Context</h3>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(session.request.context, null, 2)}
                    </pre>
                  </div>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => void onEdit?.(session))}
              disabled={loading}
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => void onArchive?.(session))}
              disabled={loading}
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction(() => void onDelete?.(session))}
              disabled={loading}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}