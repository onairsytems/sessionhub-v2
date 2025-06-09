import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';

export type ActorType = 'planning' | 'execution' | 'idle';

interface ActorStatusIndicatorProps {
  activeActor: ActorType;
  currentTask?: string;
  violationCount?: number;
}

export const ActorStatusIndicator: React.FC<ActorStatusIndicatorProps> = ({
  activeActor,
  currentTask,
  violationCount = 0
}) => {
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    if (activeActor !== 'idle') {
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [activeActor, currentTask]);

  const getActorInfo = () => {
    switch (activeActor) {
      case 'planning':
        return {
          icon: '🧠',
          title: 'Planning Actor Active',
          description: 'Analyzing request and creating instructions',
          color: 'bg-blue-500',
          borderColor: 'border-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950'
        };
      case 'execution':
        return {
          icon: '⚡',
          title: 'Execution Actor Active',
          description: 'Implementing code and completing tasks',
          color: 'bg-green-500',
          borderColor: 'border-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950'
        };
      case 'idle':
        return {
          icon: '💤',
          title: 'System Idle',
          description: 'Waiting for instructions',
          color: 'bg-gray-400',
          borderColor: 'border-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950'
        };
    }
  };

  const actorInfo = getActorInfo();

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Card 
        className={`
          p-3 border-2 transition-all duration-300
          ${actorInfo.borderColor} ${actorInfo.bgColor}
          ${pulseAnimation ? 'scale-105' : 'scale-100'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`relative ${activeActor !== 'idle' ? 'animate-pulse' : ''}`}>
            <span className="text-2xl">{actorInfo.icon}</span>
            {activeActor !== 'idle' && (
              <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${actorInfo.color} animate-ping`} />
            )}
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{actorInfo.title}</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {currentTask || actorInfo.description}
            </p>
          </div>

          {violationCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900 rounded">
              <span className="text-xs">⚠️</span>
              <span className="text-xs font-medium">{violationCount}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// Mini version for header/toolbar
export const ActorStatusBadge: React.FC<{ activeActor: ActorType }> = ({ activeActor }) => {
  const getBadgeInfo = () => {
    switch (activeActor) {
      case 'planning':
        return { icon: '🧠', label: 'Planning', color: 'bg-blue-500' };
      case 'execution':
        return { icon: '⚡', label: 'Execution', color: 'bg-green-500' };
      case 'idle':
        return { icon: '💤', label: 'Idle', color: 'bg-gray-400' };
    }
  };

  const badgeInfo = getBadgeInfo();

  return (
    <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium
      ${badgeInfo.color} ${activeActor !== 'idle' ? 'animate-pulse' : ''}
    `}>
      <span>{badgeInfo.icon}</span>
      <span>{badgeInfo.label}</span>
    </div>
  );
};

// Hook for managing actor status
export const useActorStatus = () => {
  const [activeActor, setActiveActor] = useState<ActorType>('idle');
  const [currentTask, setCurrentTask] = useState<string>();
  const [taskHistory, setTaskHistory] = useState<Array<{
    actor: ActorType;
    task: string;
    timestamp: Date;
    duration?: number;
  }>>([]);

  const startPlanningTask = (task: string) => {
    setActiveActor('planning');
    setCurrentTask(task);
    
    const startTime = Date.now();
    setTaskHistory(prev => [...prev, {
      actor: 'planning',
      task,
      timestamp: new Date(),
      duration: undefined
    }]);

    return () => {
      // Return a function to end the task
      const duration = Date.now() - startTime;
      setTaskHistory(prev => {
        const newHistory = [...prev];
        const lastTask = newHistory[newHistory.length - 1];
        if (lastTask && !lastTask.duration) {
          lastTask.duration = duration;
        }
        return newHistory;
      });
      setActiveActor('idle');
      setCurrentTask(undefined);
    };
  };

  const startExecutionTask = (task: string) => {
    setActiveActor('execution');
    setCurrentTask(task);
    
    const startTime = Date.now();
    setTaskHistory(prev => [...prev, {
      actor: 'execution',
      task,
      timestamp: new Date(),
      duration: undefined
    }]);

    return () => {
      // Return a function to end the task
      const duration = Date.now() - startTime;
      setTaskHistory(prev => {
        const newHistory = [...prev];
        const lastTask = newHistory[newHistory.length - 1];
        if (lastTask && !lastTask.duration) {
          lastTask.duration = duration;
        }
        return newHistory;
      });
      setActiveActor('idle');
      setCurrentTask(undefined);
    };
  };

  const reset = () => {
    setActiveActor('idle');
    setCurrentTask(undefined);
  };

  return {
    activeActor,
    currentTask,
    taskHistory,
    startPlanningTask,
    startExecutionTask,
    reset
  };
};