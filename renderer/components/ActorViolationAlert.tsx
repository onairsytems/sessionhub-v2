import React, { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export interface ActorViolation {
  id: string;
  timestamp: Date;
  type: 'code-in-planning' | 'planning-in-execution';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  pattern: string;
  context: string;
  actor: 'planning' | 'execution';
  suggestion?: string;
}

interface ActorViolationAlertProps {
  violation: ActorViolation | null;
  onDismiss: () => void;
  onViewDocs: () => void;
}

export const ActorViolationAlert: React.FC<ActorViolationAlertProps> = ({
  violation,
  onDismiss,
  onViewDocs
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (violation) {
      setIsVisible(true);
    }
  }, [violation]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300); // Wait for animation
  };

  if (!violation || !isVisible) return null;

  const getSeverityStyles = () => {
    switch (violation.severity) {
      case 'CRITICAL':
        return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'HIGH':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'LOW':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  const getSeverityIcon = () => {
    switch (violation.severity) {
      case 'CRITICAL':
      case 'HIGH':
        return '🚨';
      case 'MEDIUM':
        return '⚠️';
      case 'LOW':
        return 'ℹ️';
    }
  };

  const getViolationTitle = () => {
    switch (violation.type) {
      case 'code-in-planning':
        return 'Planning Actor tried to write code!';
      case 'planning-in-execution':
        return 'Execution Actor tried to make strategic decisions!';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-md transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <Card className={`p-4 border-2 ${getSeverityStyles()}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{getSeverityIcon()}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">
              Actor Boundary Violation
            </h3>
            <p className="text-sm font-medium mb-2">
              {getViolationTitle()}
            </p>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Actor:</span>{' '}
                <span className="capitalize">{violation.actor}</span>
              </div>
              
              <div>
                <span className="font-medium">Pattern Detected:</span>{' '}
                <code className="bg-black/10 dark:bg-white/10 px-1 rounded">
                  {violation.pattern}
                </code>
              </div>
              
              {violation.context && (
                <div>
                  <span className="font-medium">Context:</span>
                  <pre className="mt-1 p-2 bg-black/10 dark:bg-white/10 rounded text-xs overflow-x-auto">
                    {violation.context}
                  </pre>
                </div>
              )}
              
              {violation.suggestion && (
                <div className="mt-2 p-2 bg-green-100 dark:bg-green-900 rounded">
                  <span className="font-medium">Suggestion:</span>{' '}
                  {violation.suggestion}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="primary"
                onClick={onViewDocs}
                className="text-sm px-3 py-1"
              >
                View Guidelines
              </Button>
              <Button
                variant="secondary"
                onClick={handleDismiss}
                className="text-sm px-3 py-1"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// Hook for managing actor violations
export const useActorViolations = () => {
  const [currentViolation, setCurrentViolation] = useState<ActorViolation | null>(null);
  const [violationHistory, setViolationHistory] = useState<ActorViolation[]>([]);

  const reportViolation = (violation: Omit<ActorViolation, 'id' | 'timestamp'>) => {
    const newViolation: ActorViolation = {
      ...violation,
      id: `violation-${Date.now()}`,
      timestamp: new Date()
    };

    setCurrentViolation(newViolation);
    setViolationHistory(prev => [...prev, newViolation]);

    // Auto-dismiss low severity after 10 seconds
    if (violation.severity === 'LOW') {
      setTimeout(() => {
        setCurrentViolation(null);
      }, 10000);
    }
  };

  const dismissViolation = () => {
    setCurrentViolation(null);
  };

  const clearHistory = () => {
    setViolationHistory([]);
  };

  return {
    currentViolation,
    violationHistory,
    reportViolation,
    dismissViolation,
    clearHistory
  };
};