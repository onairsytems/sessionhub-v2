import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ActorStatus {
  planning: {
    active: boolean;
    currentTask?: string;
    lastInstruction?: string;
  };
  execution: {
    active: boolean;
    currentTask?: string;
    progress?: number;
    agentPanelConnected: boolean;
  };
}

interface Instruction {
  id: string;
  type: 'planning' | 'execution';
  content: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'completed' | 'failed';
}

export const ZedTwoActorSync: React.FC = () => {
  const [actorStatus, setActorStatus] = useState<ActorStatus>({
    planning: { active: false },
    execution: { active: false, agentPanelConnected: false }
  });
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Initial status check
    checkActorStatus();

    // Listen for actor updates
    const handlePlanningUpdate = (_event: any, status: any) => {
      setActorStatus(prev => ({
        ...prev,
        planning: status
      }));
    };

    const handleExecutionUpdate = (_event: any, status: any) => {
      setActorStatus(prev => ({
        ...prev,
        execution: status
      }));
    };

    const handleInstructionSent = (_event: any, instruction: Instruction) => {
      setInstructions(prev => [instruction, ...prev].slice(0, 10)); // Keep last 10
    };

    window.electronAPI.api.on('actor:planning-update', handlePlanningUpdate);
    window.electronAPI.api.on('actor:execution-update', handleExecutionUpdate);
    window.electronAPI.api.on('actor:instruction-sent', handleInstructionSent);

    // Poll for status updates
    const interval = setInterval(checkActorStatus, 3000);

    return () => {
      clearInterval(interval);
      window.electronAPI.api.off('actor:planning-update', handlePlanningUpdate);
      window.electronAPI.api.off('actor:execution-update', handleExecutionUpdate);
      window.electronAPI.api.off('actor:instruction-sent', handleInstructionSent);
    };
  }, []);

  const checkActorStatus = async () => {
    try {
      const status = await window.electronAPI.zed.getActorStatus();
      setActorStatus(status);
    } catch (error) {
      // Silently handle error - status will remain unchanged
      // The UI will show the last known state
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await window.electronAPI.zed.syncActors();
      window.electronAPI.api.showNotification({
        title: 'Actors Synchronized',
        body: 'Planning and Execution actors are now in sync',
        type: 'success'
      });
    } catch (error) {
      window.electronAPI.api.showNotification({
        title: 'Sync Failed',
        body: error instanceof Error ? error.message : 'Failed to synchronize actors',
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getActorStatusColor = (active: boolean, connected?: boolean) => {
    if (active && (connected === undefined || connected)) return 'bg-green-500';
    if (active) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Two-Actor Synchronization
            </h3>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync Actors'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ActorCard
              title="Planning Actor"
              subtitle="SessionHub"
              active={actorStatus.planning.active}
              currentTask={actorStatus.planning.currentTask}
              statusColor={getActorStatusColor(actorStatus.planning.active)}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
            />

            <ActorCard
              title="Execution Actor"
              subtitle="Zed Agent Panel"
              active={actorStatus.execution.active}
              currentTask={actorStatus.execution.currentTask}
              statusColor={getActorStatusColor(
                actorStatus.execution.active,
                actorStatus.execution.agentPanelConnected
              )}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              }
              progress={actorStatus.execution.progress}
              warning={!actorStatus.execution.agentPanelConnected ? 'Agent panel not connected' : undefined}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>How it works:</strong> Planning Actor in SessionHub generates strategies, 
              then sends instructions to Execution Actor running in Zed's agent panel for implementation.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent Instructions
          </h4>
          
          {instructions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No instructions sent yet
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {instructions.map((instruction) => (
                <InstructionItem key={instruction.id} instruction={instruction} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

interface ActorCardProps {
  title: string;
  subtitle: string;
  active: boolean;
  currentTask?: string;
  statusColor: string;
  icon: React.ReactNode;
  progress?: number;
  warning?: string;
}

const ActorCard: React.FC<ActorCardProps> = ({
  title,
  subtitle,
  active,
  currentTask,
  statusColor,
  icon,
  progress,
  warning
}) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
          {icon}
        </div>
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className={`w-3 h-3 rounded-full ${statusColor} ${active ? 'animate-pulse' : ''}`} />
    </div>

    {currentTask && (
      <div className="mt-3 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-700 dark:text-gray-300">{currentTask}</p>
      </div>
    )}

    {progress !== undefined && (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )}

    {warning && (
      <div className="mt-2 flex items-center text-xs text-yellow-600 dark:text-yellow-400">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {warning}
      </div>
    )}
  </div>
);

const InstructionItem: React.FC<{ instruction: Instruction }> = ({ instruction }) => {
  const getStatusIcon = () => {
    switch (instruction.status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'sent':
        return (
          <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-start space-x-2 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
          {instruction.content}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {instruction.type === 'planning' ? 'Planning → Execution' : 'Execution'} • 
          {new Date(instruction.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};