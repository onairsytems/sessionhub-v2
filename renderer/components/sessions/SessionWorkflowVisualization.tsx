import React, { useState, useEffect } from 'react';
import { Session } from '@/src/models/Session';
import { Card } from '../ui/Card';
import { formatDistanceToNow } from 'date-fns';

interface SessionWorkflowVisualizationProps {
  session: Session;
  onPhaseClick?: (phase: 'planning' | 'execution' | 'review') => void;
}

interface WorkflowStep {
  phase: 'planning' | 'execution' | 'review';
  status: 'pending' | 'active' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: number;
  actor?: string;
  details?: string;
  error?: string;
}

export const SessionWorkflowVisualization: React.FC<SessionWorkflowVisualizationProps> = ({
  session,
  onPhaseClick
}) => {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [activePhase, setActivePhase] = useState<'planning' | 'execution' | 'review' | null>(null);

  useEffect(() => {
    // Build workflow steps based on session status and metadata
    const steps: WorkflowStep[] = [];

    // Planning phase
    const planningStep: WorkflowStep = {
      phase: 'planning',
      status: 'pending',
      actor: 'Planning Actor'
    };

    if (session.status !== 'pending') {
      planningStep.status = 'completed';
      planningStep.startTime = session.createdAt;
      
      if (session.metadata.planningDuration) {
        planningStep.duration = session.metadata.planningDuration;
        planningStep.endTime = new Date(
          new Date(session.createdAt).getTime() + session.metadata.planningDuration
        ).toISOString();
      }

      if (session.instructions) {
        planningStep.details = `Generated instructions with ${session.instructions.objectives?.length || 0} objectives`;
      }
    }

    if (session.status === 'planning') {
      planningStep.status = 'active';
      setActivePhase('planning');
    }

    steps.push(planningStep);

    // Execution phase
    const executionStep: WorkflowStep = {
      phase: 'execution',
      status: 'pending',
      actor: 'Execution Actor'
    };

    if (['executing', 'completed', 'failed'].includes(session.status)) {
      if (session.status === 'executing') {
        executionStep.status = 'active';
        setActivePhase('execution');
      } else {
        executionStep.status = session.status === 'completed' ? 'completed' : 'failed';
      }

      if (session.metadata['handoffTime']) {
        executionStep.startTime = session.metadata['handoffTime'] as string;
      }

      if (session.metadata.executionDuration) {
        executionStep.duration = session.metadata.executionDuration;
        if (executionStep.startTime) {
          executionStep.endTime = new Date(
            new Date(executionStep.startTime).getTime() + session.metadata.executionDuration
          ).toISOString();
        }
      }

      if (session.result) {
        executionStep.details = session.result.status === 'success'
          ? `Completed ${session.result.metrics?.tasksCompleted || 0} tasks`
          : `Failed with ${session.result.errors?.length || 0} errors`;
      }

      if (session.error && session.error.actor === 'execution') {
        executionStep.error = session.error.message;
      }
    }

    steps.push(executionStep);

    // Review phase
    const reviewStep: WorkflowStep = {
      phase: 'review',
      status: 'pending',
      actor: 'Review Process'
    };

    if (session.status === 'completed') {
      reviewStep.status = 'completed';
      if (session.completedAt) {
        reviewStep.startTime = session.completedAt;
        reviewStep.endTime = session.completedAt;
      }
      reviewStep.details = 'Session successfully completed';
    } else if (session.status === 'failed') {
      reviewStep.status = 'failed';
      if (session.completedAt) {
        reviewStep.startTime = session.completedAt;
        reviewStep.endTime = session.completedAt;
      }
      reviewStep.details = 'Session failed - review required';
      reviewStep.error = session.error?.message;
    }

    steps.push(reviewStep);

    setWorkflowSteps(steps);
  }, [session]);

  const getPhaseIcon = (phase: string, status: string) => {
    if (status === 'active') {
      return (
        <div className="animate-pulse">
          {phase === 'planning' ? '🧠' : phase === 'execution' ? '⚡' : '✓'}
        </div>
      );
    }

    switch (phase) {
      case 'planning': return '🧠';
      case 'execution': return '⚡';
      case 'review': return status === 'completed' ? '✓' : status === 'failed' ? '✗' : '👁';
      default: return '•';
    }
  };

  const getPhaseColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500 text-white border-blue-600';
      case 'completed': return 'bg-green-500 text-white border-green-600';
      case 'failed': return 'bg-red-500 text-white border-red-600';
      default: return 'bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600';
    }
  };

  const getConnectorColor = (fromStatus: string, toStatus: string) => {
    if (fromStatus === 'completed' && toStatus !== 'pending') {
      return 'bg-green-500';
    }
    if (fromStatus === 'failed' || toStatus === 'failed') {
      return 'bg-red-500';
    }
    if (fromStatus === 'active' || toStatus === 'active') {
      return 'bg-blue-500';
    }
    return 'bg-gray-300 dark:bg-gray-600';
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Session Workflow
      </h3>

      {/* Workflow visualization */}
      <div className="relative">
        <div className="flex items-center justify-between mb-8">
          {workflowSteps.map((step, index) => (
            <React.Fragment key={step.phase}>
              {/* Phase circle */}
              <div
                className="relative z-10 cursor-pointer group"
                onClick={() => onPhaseClick?.(step.phase)}
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl
                             border-2 transition-all group-hover:scale-110 ${getPhaseColor(step.status)}`}
                >
                  {getPhaseIcon(step.phase, step.status)}
                </div>
                
                {/* Phase label */}
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {step.phase}
                  </p>
                  {step.actor && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {step.actor}
                    </p>
                  )}
                </div>

                {/* Status indicator */}
                {step.status === 'active' && (
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
                )}
              </div>

              {/* Connector line */}
              {index < workflowSteps.length - 1 && (
                <div className="flex-1 mx-4 relative">
                  <div
                    className={`h-1 rounded-full transition-all ${
                      getConnectorColor(step.status, workflowSteps[index + 1]?.status || 'pending')
                    }`}
                  ></div>
                  
                  {/* Progress indicator for active transitions */}
                  {step.status === 'completed' && workflowSteps[index + 1]?.status === 'active' && (
                    <div className="absolute top-0 left-0 h-1 bg-blue-500 rounded-full animate-pulse"
                         style={{ width: '50%' }}></div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Phase details */}
        <div className="mt-12 space-y-4">
          {workflowSteps.map((step) => (
            step.status !== 'pending' && (
              <div
                key={step.phase}
                className={`border rounded-lg p-4 transition-all cursor-pointer
                           ${activePhase === step.phase ? 'ring-2 ring-blue-500' : ''}
                           ${step.status === 'failed' ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 
                             'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
                onClick={() => onPhaseClick?.(step.phase)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {step.phase} Phase
                    </h4>
                    
                    {step.details && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {step.details}
                      </p>
                    )}

                    {step.error && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        Error: {step.error}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                      {step.startTime && (
                        <span>
                          Started {formatDistanceToNow(new Date(step.startTime))} ago
                        </span>
                      )}
                      {step.duration && (
                        <span>
                          Duration: {formatDuration(step.duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    step.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    step.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                    step.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {step.status}
                  </div>
                </div>
              </div>
            )
          ))}
        </div>

        {/* Session summary */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Total Duration</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {session.metadata.totalDuration 
                  ? formatDuration(session.metadata.totalDuration)
                  : 'In progress'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Planning Time</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {session.metadata.planningDuration
                  ? formatDuration(session.metadata.planningDuration)
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Execution Time</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {session.metadata.executionDuration
                  ? formatDuration(session.metadata.executionDuration)
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Progress</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {session.metadata.progress
                  ? `${session.metadata.progress.percentage}%`
                  : '0%'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};