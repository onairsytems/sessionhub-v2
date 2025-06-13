import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActorState {
  planningActive: boolean;
  executionActive: boolean;
  currentTask?: string;
  agentPanelConnected: boolean;
  lastActivity?: Date;
  violations?: number;
}

interface VisualIndicatorProps {
  position?: 'top-right' | 'bottom-right' | 'floating';
  showDetails?: boolean;
  onActorClick?: (actor: 'planning' | 'execution') => void;
}

export const ZedActorVisualIndicator: React.FC<VisualIndicatorProps> = ({
  position = 'top-right',
  showDetails = true,
  onActorClick
}) => {
  const [actorState, setActorState] = useState<ActorState>({
    planningActive: false,
    executionActive: false,
    agentPanelConnected: false,
    violations: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Listen for actor state updates
    const handleActorUpdate = (_event: unknown, state: ActorState) => {
      setActorState(state);
    };

    window.electronAPI.api.on('zed:actor-state-update', handleActorUpdate as (...args: any[]) => void);

    // Initial state fetch
    window.electronAPI.zed.getActorStatus().then((status: any) => {
      setActorState(status as ActorState);
    }).catch(() => {
      // Silently handle error
    });

    return () => {
      window.electronAPI.api.off('zed:actor-state-update', handleActorUpdate as (...args: any[]) => void);
    };
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'fixed top-4 right-4';
      case 'bottom-right':
        return 'fixed bottom-4 right-4';
      case 'floating':
        return 'fixed top-1/2 right-4 -translate-y-1/2';
      default:
        return 'fixed top-4 right-4';
    }
  };

  const handleActorClick = (actor: 'planning' | 'execution') => {
    if (onActorClick) {
      onActorClick(actor);
    }
  };

  return (
    <div className={`${getPositionClasses()} z-50`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Compact View */}
        <div 
          className="p-3 cursor-pointer flex items-center space-x-3"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            {/* Planning Actor Indicator */}
            <ActorIndicator
              type="planning"
              active={actorState.planningActive}
              connected={actorState.agentPanelConnected}
              onClick={() => handleActorClick('planning')}
            />
            
            {/* Divider */}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
            
            {/* Execution Actor Indicator */}
            <ActorIndicator
              type="execution"
              active={actorState.executionActive}
              connected={true}
              onClick={() => handleActorClick('execution')}
            />
          </div>
          
          {/* Expand/Collapse Icon */}
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-200 dark:border-gray-700"
            >
              <div className="p-4 space-y-3">
                {/* Planning Actor Details */}
                <ActorDetails
                  title="Planning Actor"
                  subtitle="AI Assistant Panel"
                  active={actorState.planningActive}
                  connected={actorState.agentPanelConnected}
                  currentTask={actorState.planningActive ? actorState.currentTask : undefined}
                  icon="🎯"
                />
                
                {/* Execution Actor Details */}
                <ActorDetails
                  title="Execution Actor"
                  subtitle="Code Editor"
                  active={actorState.executionActive}
                  connected={true}
                  currentTask={actorState.executionActive ? actorState.currentTask : undefined}
                  icon="🚀"
                />
                
                {/* Boundary Status */}
                {actorState.violations !== undefined && actorState.violations > 0 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      ⚠️ {actorState.violations} boundary violation{actorState.violations > 1 ? 's' : ''} detected
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Floating Status Pills */}
      <AnimatePresence>
        {(actorState.planningActive || actorState.executionActive) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-2 right-0 flex space-x-2"
          >
            {actorState.planningActive && (
              <StatusPill type="planning" label="Planning" />
            )}
            {actorState.executionActive && (
              <StatusPill type="execution" label="Executing" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ActorIndicatorProps {
  type: 'planning' | 'execution';
  active: boolean;
  connected: boolean;
  onClick: () => void;
}

const ActorIndicator: React.FC<ActorIndicatorProps> = ({ type, active, connected, onClick }) => {
  const getColor = () => {
    if (!connected) return 'bg-gray-400';
    if (active) return type === 'planning' ? 'bg-blue-500' : 'bg-green-500';
    return 'bg-gray-300 dark:bg-gray-600';
  };

  const getIcon = () => {
    return type === 'planning' ? '🎯' : '🚀';
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`relative w-10 h-10 rounded-full ${getColor()} flex items-center justify-center transition-colors`}
      title={`${type === 'planning' ? 'Planning' : 'Execution'} Actor`}
    >
      <span className="text-lg">{getIcon()}</span>
      {active && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white dark:border-gray-800"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      {!connected && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
      )}
    </motion.button>
  );
};

interface ActorDetailsProps {
  title: string;
  subtitle: string;
  active: boolean;
  connected: boolean;
  currentTask?: string;
  icon: string;
}

const ActorDetails: React.FC<ActorDetailsProps> = ({
  title,
  subtitle,
  active,
  connected,
  currentTask,
  icon
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{icon}</span>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">{title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {connected ? (
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-500" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {!connected ? 'Disconnected' : active ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>
      {currentTask && (
        <div className="ml-7 p-1.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300">
          {currentTask}
        </div>
      )}
    </div>
  );
};

interface StatusPillProps {
  type: 'planning' | 'execution';
  label: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ type, label }) => {
  const bgColor = type === 'planning' ? 'bg-blue-500' : 'bg-green-500';
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`${bgColor} text-white text-xs px-2 py-1 rounded-full shadow-lg`}
    >
      {label}
    </motion.div>
  );
};