"use client";

import { useState, useEffect } from "react";
import { Card } from "./ui/Card";
import {
  CheckCircle,
  Circle,
  Loader,
  AlertCircle,
  FileText,
  Brain,
  Code,
  Eye,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";

interface SessionProgress {
  phase: string;
  step: string;
  progress: number;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface SessionProgressTrackerProps {
  sessionId: string;
  progress: SessionProgress[];
  isActive: boolean;
}

const phaseIcons: Record<string, JSX.Element> = {
  initializing: <Circle className="h-5 w-5" />,
  importing: <FileText className="h-5 w-5" />,
  analyzing: <Brain className="h-5 w-5" />,
  planning: <Brain className="h-5 w-5" />,
  executing: <Code className="h-5 w-5" />,
  reviewing: <Eye className="h-5 w-5" />,
  completed: <CheckCircle className="h-5 w-5" />
};

const phaseColors: Record<string, string> = {
  initializing: "text-gray-500",
  importing: "text-blue-500",
  analyzing: "text-purple-500",
  planning: "text-indigo-500",
  executing: "text-green-500",
  reviewing: "text-orange-500",
  completed: "text-green-600"
};

export function SessionProgressTracker({ 
  sessionId: _sessionId, 
  progress, 
  isActive 
}: SessionProgressTrackerProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    if (progress.length > 0) {
      const latest = progress[progress.length - 1]!;
      setCurrentPhase(latest.phase);
      setOverallProgress(latest.progress);
      
      // Auto-expand current phase
      setExpandedPhases(prev => new Set(prev).add(latest.phase));
    }
  }, [progress]);

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phase)) {
        newSet.delete(phase);
      } else {
        newSet.add(phase);
      }
      return newSet;
    });
  };

  const getPhaseProgress = (phase: string): SessionProgress[] => {
    return progress.filter(p => p.phase === phase);
  };

  const getPhaseStatus = (phase: string): 'pending' | 'active' | 'completed' => {
    const phaseProgress = getPhaseProgress(phase);
    if (phaseProgress.length === 0) return 'pending';
    
    const latestProgress = phaseProgress[phaseProgress.length - 1]?.progress ?? 0;
    if (phase === currentPhase && isActive) return 'active';
    if (latestProgress === 100 || progress.some(p => p.phase === 'completed')) {
      return 'completed';
    }
    
    return 'pending';
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const phases = [
    'initializing',
    'importing',
    'analyzing', 
    'planning',
    'executing',
    'reviewing',
    'completed'
  ];

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Session Progress</h3>
        <div className="relative">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">{overallProgress}% complete</p>
        </div>
      </div>

      <div className="space-y-3">
        {phases.map((phase) => {
          const status = getPhaseStatus(phase);
          const phaseProgress = getPhaseProgress(phase);
          const isExpanded = expandedPhases.has(phase);
          const hasProgress = phaseProgress.length > 0;

          return (
            <div key={phase} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              <button
                onClick={() => hasProgress && togglePhase(phase)}
                className={`w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !hasProgress ? 'cursor-default' : ''
                }`}
                disabled={!hasProgress}
              >
                <div className="flex items-center gap-3">
                  <div className={`${phaseColors[phase]} ${
                    status === 'active' ? 'animate-pulse' : ''
                  }`}>
                    {status === 'active' ? (
                      <Loader className="h-5 w-5 animate-spin" />
                    ) : (
                      phaseIcons[phase]
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium capitalize">{phase}</p>
                    {hasProgress && (
                      <p className="text-sm text-gray-500">
                        {phaseProgress[phaseProgress.length - 1]?.message ?? ''}
                      </p>
                    )}
                  </div>
                </div>
                {hasProgress && (
                  <div className="flex items-center gap-2">
                    {status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                )}
              </button>

              {isExpanded && hasProgress && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="space-y-2">
                    {phaseProgress.map((item, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <Clock className="h-3 w-3 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-700 dark:text-gray-300">
                            {item.step}: {item.message}
                          </p>
                          {item.details && (
                            <div className="mt-1 text-xs text-gray-500">
                              {Object.entries(item.details).map(([key, value]) => (
                                <span key={key} className="mr-3">
                                  {key}: {typeof value === 'object' ? JSON.stringify(value) : value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isActive && overallProgress === 100 && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Session completed successfully!
            </p>
          </div>
        </div>
      )}

      {!isActive && overallProgress < 100 && progress.some(p => p.details?.['error']) && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Session encountered an error
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}