/**
 * @actor ui
 * @responsibility User interface for managing multi-session workflows with progress tracking
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, AlertCircle, CheckCircle, Clock, Zap, GitBranch } from 'lucide-react';
import { SessionWorkflow, WorkflowProgress } from '@/src/services/session/SessionOrchestrationFramework';
import { ComplexityScore } from '@/src/services/session/SessionComplexityAnalyzer';
import { SplitSession } from '@/src/services/session/SessionSplittingEngine';

interface SessionSequenceManagerProps {
  onCreateWorkflow?: (workflow: SessionWorkflow) => void;
  onWorkflowAction?: (action: 'start' | 'pause' | 'resume' | 'cancel', workflowId: string) => void;
}

interface WorkflowWithComplexity extends SessionWorkflow {
  complexityScore?: ComplexityScore;
  splits?: SplitSession[];
}

export const SessionSequenceManager: React.FC<SessionSequenceManagerProps> = ({
  onCreateWorkflow,
  onWorkflowAction
}) => {
  const [workflows, setWorkflows] = useState<WorkflowWithComplexity[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [complexityAnalysis, setComplexityAnalysis] = useState<ComplexityScore | null>(null);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
    
    // Set up event listeners using the available API
    if (window.electronAPI?.api) {
      const wrappedHandleWorkflowCreated = (...args: unknown[]) => {
        if (args[0] && typeof args[1] === 'object') {
          handleWorkflowCreated(args[0], args[1] as WorkflowWithComplexity);
        }
      };
      
      const wrappedHandleWorkflowProgress = (...args: unknown[]) => {
        if (args[0] && typeof args[1] === 'object') {
          handleWorkflowProgress(args[0], args[1] as { workflowId: string; progress: WorkflowProgress });
        }
      };
      
      const wrappedHandleWorkflowCompleted = (...args: unknown[]) => {
        if (args[0] && typeof args[1] === 'object') {
          handleWorkflowCompleted(args[0], args[1] as { workflowId: string });
        }
      };
      
      const wrappedHandleWorkflowFailed = (...args: unknown[]) => {
        if (args[0] && typeof args[1] === 'object') {
          handleWorkflowFailed(args[0], args[1] as { workflowId: string; error: string });
        }
      };

      window.electronAPI.api.on('workflow:created', wrappedHandleWorkflowCreated);
      window.electronAPI.api.on('workflow:progress', wrappedHandleWorkflowProgress);
      window.electronAPI.api.on('workflow:completed', wrappedHandleWorkflowCompleted);
      window.electronAPI.api.on('workflow:failed', wrappedHandleWorkflowFailed);
      
      return () => {
        window.electronAPI.api.off('workflow:created', wrappedHandleWorkflowCreated);
        window.electronAPI.api.off('workflow:progress', wrappedHandleWorkflowProgress);
        window.electronAPI.api.off('workflow:completed', wrappedHandleWorkflowCompleted);
        window.electronAPI.api.off('workflow:failed', wrappedHandleWorkflowFailed);
      };
    }
    
    // Return empty cleanup function if API not available
    return () => {};
  }, []);

  const loadWorkflows = async () => {
    try {
      const result = await window.electron?.invoke('session:getWorkflows') as { success: boolean; workflows: WorkflowWithComplexity[] };
      if (result?.success) {
        setWorkflows(result.workflows);
      }
    } catch (error) {
      // Handle error silently - logged in backend
    }
  };

  const handleWorkflowCreated = (_event: any, workflow: WorkflowWithComplexity) => {
    setWorkflows(prev => [...prev, workflow]);
    if (onCreateWorkflow) {
      onCreateWorkflow(workflow);
    }
  };

  const handleWorkflowProgress = (_event: any, update: { workflowId: string; progress: WorkflowProgress }) => {
    setWorkflows(prev => prev.map(w => 
      w.id === update.workflowId 
        ? { ...w, progress: update.progress }
        : w
    ));
  };

  const handleWorkflowCompleted = (_event: any, { workflowId }: { workflowId: string }) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId 
        ? { ...w, state: { ...w.state, status: 'completed' } }
        : w
    ));
  };

  const handleWorkflowFailed = (_event: any, { workflowId, error }: { workflowId: string; error: string }) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId 
        ? { ...w, state: { ...w.state, status: 'failed' }, metadata: { ...w.metadata, error } }
        : w
    ));
  };

  const analyzeSessionComplexity = async (content: string) => {
    setIsAnalyzing(true);
    try {
      const result = await window.electron?.invoke('session:analyzeComplexity', { content }) as { success: boolean; complexityScore: ComplexityScore };
      if (result?.success) {
        setComplexityAnalysis(result.complexityScore);
      }
    } catch (error) {
      // Handle error silently - logged in backend
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createSplitWorkflow = async () => {
    if (!complexityAnalysis || !complexityAnalysis.splitRecommended) return;
    
    try {
      const result = await window.electron?.invoke('session:createSplitWorkflow', {
        complexityScore: complexityAnalysis,
        name: 'Split Session Workflow',
        description: 'Automatically split complex session into manageable parts'
      }) as { success: boolean; workflow: WorkflowWithComplexity };
      
      if (result?.success) {
        setWorkflows(prev => [...prev, result.workflow]);
        setComplexityAnalysis(null);
      }
    } catch (error) {
      // Handle error silently - logged in backend
    }
  };

  const handleWorkflowAction = (action: 'start' | 'pause' | 'resume' | 'cancel', workflowId: string) => {
    if (onWorkflowAction) {
      onWorkflowAction(action, workflowId);
    }
    
    // Also send to backend
    window.electron?.invoke(`workflow:${action}`, { workflowId });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getComplexityColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    if (score < 85) return 'text-orange-600';
    return 'text-red-600';
  };

  const renderWorkflowCard = (workflow: WorkflowWithComplexity) => {
    const isSelected = selectedWorkflow === workflow.id;
    const progress = workflow.progress;
    const isActive = ['running', 'paused'].includes(workflow.state.status);

    return (
      <div
        key={workflow.id}
        className={`border rounded-lg p-4 mb-4 cursor-pointer transition-all ${
          isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setSelectedWorkflow(isSelected ? null : workflow.id)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(workflow.state.status)}
              <h3 className="font-semibold text-lg">{workflow.name}</h3>
              {workflow.sessions.length > 1 && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <GitBranch className="w-4 h-4" />
                  {workflow.sessions.length} sessions
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>
          </div>
          
          {isActive && (
            <div className="flex gap-2">
              {workflow.state.status === 'running' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWorkflowAction('pause', workflow.id);
                  }}
                  className="p-2 hover:bg-gray-100 rounded"
                  title="Pause workflow"
                >
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWorkflowAction('resume', workflow.id);
                  }}
                  className="p-2 hover:bg-gray-100 rounded"
                  title="Resume workflow"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleWorkflowAction('cancel', workflow.id);
                }}
                className="p-2 hover:bg-gray-100 rounded text-red-600"
                title="Cancel workflow"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{progress.completedSessions} of {progress.totalSessions} sessions</span>
            <span>{Math.round(progress.percentComplete)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
          {progress.failedSessions > 0 && (
            <p className="text-sm text-red-600 mt-1">
              {progress.failedSessions} session{progress.failedSessions > 1 ? 's' : ''} failed
            </p>
          )}
        </div>

        {/* Expanded Details */}
        {isSelected && (
          <div className="border-t pt-3 mt-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium capitalize">{workflow.state.status}</p>
              </div>
              <div>
                <p className="text-gray-600">Current Session</p>
                <p className="font-medium">
                  {workflow.state.currentSession || 'None'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Started</p>
                <p className="font-medium">
                  {progress.startTime 
                    ? new Date(progress.startTime).toLocaleString() 
                    : 'Not started'}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Est. Time Remaining</p>
                <p className="font-medium">
                  {progress.estimatedTimeRemaining > 0 
                    ? `${Math.round(progress.estimatedTimeRemaining)} min` 
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Session List */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Sessions</h4>
              <div className="space-y-1">
                {workflow.sessions.map((sessionId, index) => {
                  const isCompleted = workflow.state.completedSessions.includes(sessionId);
                  const isFailed = workflow.state.failedSessions.includes(sessionId);
                  const isCurrent = workflow.state.currentSession === sessionId;
                  
                  return (
                    <div
                      key={sessionId}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        isCurrent ? 'bg-blue-50' : ''
                      }`}
                    >
                      {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {isFailed && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {isCurrent && <Play className="w-4 h-4 text-blue-500 animate-pulse" />}
                      {!isCompleted && !isFailed && !isCurrent && 
                        <Clock className="w-4 h-4 text-gray-400" />}
                      <span className={isCurrent ? 'font-medium' : ''}>
                        Session {index + 1}: {sessionId}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            {workflow.state.status === 'pending' && (
              <div className="mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWorkflowAction('start', workflow.id);
                  }}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                >
                  Start Workflow
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Session Sequence Manager</h1>
        <p className="text-gray-600">
          Manage complex multi-session workflows with intelligent orchestration
        </p>
      </div>

      {/* Complexity Analyzer */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Session Complexity Analyzer
        </h2>
        
        <textarea
          className="w-full p-3 border rounded-lg mb-4"
          rows={4}
          placeholder="Paste your session request here to analyze complexity..."
          onChange={(e) => {
            if (e.target.value.length > 50) {
              analyzeSessionComplexity(e.target.value);
            }
          }}
        />

        {isAnalyzing && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Analyzing complexity...</p>
          </div>
        )}

        {complexityAnalysis && (
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Complexity Analysis</h3>
                <p className={`text-2xl font-bold ${getComplexityColor(complexityAnalysis.overall)}`}>
                  {complexityAnalysis.overall}/100
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Estimated Memory</p>
                <p className="text-lg font-medium">{complexityAnalysis.estimatedMemoryUsage} MB</p>
              </div>
            </div>

            {/* Component Scores */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {Object.entries(complexityAnalysis.components).map(([key, value]) => (
                <div key={key} className="text-center">
                  <p className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>

            {/* Recommendation */}
            <div className="border-t pt-4">
              <p className="font-medium mb-2">Recommendation</p>
              <p className="text-sm text-gray-600 mb-2">
                Session Size: <span className="font-medium capitalize">
                  {complexityAnalysis.recommendation.sessionSize}
                </span>
              </p>
              <ul className="text-sm space-y-1">
                {complexityAnalysis.recommendation.reasoning.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {complexityAnalysis.splitRecommended && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="font-medium text-yellow-800 mb-2">
                  Session Splitting Recommended
                </p>
                <p className="text-sm text-yellow-700 mb-3">
                  This session is too complex for reliable execution. 
                  We recommend splitting it into {complexityAnalysis.suggestedSplits?.length || 3} smaller sessions.
                </p>
                <button
                  onClick={createSplitWorkflow}
                  className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
                >
                  Create Split Workflow
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflows List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Active Workflows</h2>
        
        {workflows.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No workflows created yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Analyze a complex session above to create your first workflow
            </p>
          </div>
        ) : (
          <div>
            {workflows.map(workflow => renderWorkflowCard(workflow))}
          </div>
        )}
      </div>
    </div>
  );
};