'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastActions } from '@/components/ui/Toast';
import { SessionBreadcrumb } from '@/components/ui/Breadcrumb';
import {
  CheckCircle,
  Circle,
  ArrowRight,
  MessageSquare,
  Code,
  FileText,
  Sparkles,
  Clock,
  Pause,
  Play,
  RotateCcw
} from 'lucide-react';

type SessionPhase = 'planning' | 'execution' | 'review';
type SessionStatus = 'idle' | 'active' | 'paused' | 'completed' | 'failed';

interface SessionStep {
  id: string;
  phase: SessionPhase;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  progress?: number;
  startTime?: string;
  endTime?: string;
  error?: string;
}

interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  currentPhase: SessionPhase;
  steps: SessionStep[];
  plan?: string;
  results?: Record<string, unknown>;
  startTime: string;
  endTime?: string;
  estimatedDuration?: number;
}

export default function SessionWorkflowPolished() {
  const [session, setSession] = useState<Session | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toast = useToastActions();

  // Initialize session steps
  const createSessionSteps = (): SessionStep[] => [
    {
      id: 'analyze',
      phase: 'planning',
      label: 'Analyze Requirements',
      description: 'Understanding project objectives and constraints',
      status: 'pending'
    },
    {
      id: 'plan',
      phase: 'planning',
      label: 'Create Execution Plan',
      description: 'Developing a detailed implementation strategy',
      status: 'pending'
    },
    {
      id: 'setup',
      phase: 'execution',
      label: 'Setup Environment',
      description: 'Preparing development environment and dependencies',
      status: 'pending'
    },
    {
      id: 'implement',
      phase: 'execution',
      label: 'Implement Solution',
      description: 'Building the solution according to plan',
      status: 'pending'
    },
    {
      id: 'test',
      phase: 'execution',
      label: 'Run Tests',
      description: 'Validating the implementation',
      status: 'pending'
    },
    {
      id: 'review',
      phase: 'review',
      label: 'Review Changes',
      description: 'Examining the completed work',
      status: 'pending'
    },
    {
      id: 'commit',
      phase: 'review',
      label: 'Commit & Document',
      description: 'Saving changes and updating documentation',
      status: 'pending'
    }
  ];

  const startNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      status: 'active',
      currentPhase: 'planning',
      steps: createSessionSteps(),
      startTime: new Date().toISOString(),
      estimatedDuration: 25 // minutes
    };
    
    setSession(newSession);
    toast.success('New session started', 'Good luck with your development!');
    
    // Start the first step
    setTimeout(() => {
      activateStep(newSession, 'analyze');
    }, 500);
  };

  const activateStep = (currentSession: Session, stepId: string) => {
    setIsTransitioning(true);
    
    const updatedSteps = currentSession.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, status: 'active' as const, startTime: new Date().toISOString() };
      }
      return step;
    });

    setSession({
      ...currentSession,
      steps: updatedSteps
    });

    // Simulate step execution
    setTimeout(() => {
      completeStep(currentSession, stepId);
      setIsTransitioning(false);
    }, 2000 + Math.random() * 3000); // 2-5 seconds per step
  };

  const completeStep = (currentSession: Session, stepId: string) => {
    const updatedSteps = currentSession.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, status: 'completed' as const, endTime: new Date().toISOString(), progress: 100 };
      }
      return step;
    });

    const updatedSession = { ...currentSession, steps: updatedSteps };
    setSession(updatedSession);

    // Find next step
    const nextStep = updatedSteps.find(step => step.status === 'pending');
    if (nextStep) {
      // Check if we're transitioning phases
      const currentStep = updatedSteps.find(s => s.id === stepId);
      if (currentStep && nextStep.phase !== currentStep.phase) {
        setIsTransitioning(true);
        toast.info(`Moving to ${nextStep.phase} phase`, 'Transitioning to the next phase of your session');
        
        setTimeout(() => {
          setSession({ ...updatedSession, currentPhase: nextStep.phase });
          activateStep(updatedSession, nextStep.id);
        }, 1000);
      } else {
        activateStep(updatedSession, nextStep.id);
      }
    } else {
      // Session complete
      completeSession(updatedSession);
    }
  };

  const completeSession = (currentSession: Session) => {
    setSession({
      ...currentSession,
      status: 'completed',
      endTime: new Date().toISOString()
    });
    
    toast.success('Session completed!', 'All tasks have been successfully completed');
  };

  const pauseSession = () => {
    if (session && session.status === 'active') {
      setSession({ ...session, status: 'paused' });
      toast.info('Session paused', 'You can resume anytime');
    }
  };

  const resumeSession = () => {
    if (session && session.status === 'paused') {
      setSession({ ...session, status: 'active' });
      toast.info('Session resumed', 'Continuing where you left off');
      
      // Resume the active step
      const activeStep = session.steps.find(s => s.status === 'active');
      if (activeStep) {
        activateStep(session, activeStep.id);
      }
    }
  };

  const resetSession = () => {
    setSession(null);
    toast.info('Session reset', 'Ready to start a new session');
  };

  const getPhaseProgress = (phase: SessionPhase): number => {
    if (!session) return 0;
    
    const phaseSteps = session.steps.filter(s => s.phase === phase);
    const completedSteps = phaseSteps.filter(s => s.status === 'completed').length;
    
    return (completedSteps / phaseSteps.length) * 100;
  };

  const getElapsedTime = (): string => {
    if (!session) return '00:00';
    
    const start = new Date(session.startTime);
    const end = session.endTime ? new Date(session.endTime) : new Date();
    const elapsed = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <EmptyState
          icon={Sparkles}
          title="Start a New Development Session"
          description="Create a focused work session with AI-powered planning and execution assistance"
          action={{
            label: "Start New Session",
            onClick: startNewSession,
            variant: 'primary'
          }}
        >
          <div className="grid grid-cols-3 gap-4 mt-6 mb-6">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Smart Planning</p>
            </div>
            <div className="text-center">
              <Code className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Guided Execution</p>
            </div>
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Auto Documentation</p>
            </div>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header with breadcrumb */}
      <div className="mb-6">
        <SessionBreadcrumb sessionId={session.id} sessionName={session.name} />
      </div>

      {/* Session Progress Overview */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{session.name}</CardTitle>
              <CardDescription className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {getElapsedTime()}
                </span>
                {session.estimatedDuration && (
                  <span className="text-muted-foreground">
                    Est. {session.estimatedDuration} min
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {session.status === 'active' && (
                <Button variant="ghost" size="sm" onClick={pauseSession}>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              {session.status === 'paused' && (
                <Button variant="ghost" size="sm" onClick={resumeSession}>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              {session.status === 'completed' && (
                <Button variant="ghost" size="sm" onClick={resetSession}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase Progress */}
          <div className="grid grid-cols-3 gap-4">
            {(['planning', 'execution', 'review'] as const).map((phase, index) => {
              const progress = getPhaseProgress(phase);
              const isActive = session.currentPhase === phase;
              const isPast = ['planning', 'execution', 'review'].indexOf(phase) < 
                            ['planning', 'execution', 'review'].indexOf(session.currentPhase);
              
              return (
                <div key={phase} className="relative">
                  <div className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    isActive ? 'border-primary bg-primary/5' : 
                    isPast ? 'border-green-500 bg-green-50 dark:bg-green-950' : 
                    'border-muted'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium capitalize">{phase}</h3>
                      {isPast ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : isActive ? (
                        <Circle className="w-5 h-5 text-primary animate-pulse" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  {index < 2 && (
                    <ArrowRight className={`absolute top-1/2 -right-6 transform -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${
                      isPast ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Step Details */}
          <div className="mt-8 space-y-3">
            {session.steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 ${
                  step.status === 'active' ? 'bg-primary/10 border border-primary' :
                  step.status === 'completed' ? 'bg-green-50 dark:bg-green-950' :
                  'bg-muted/30'
                }`}
              >
                <div className="flex-shrink-0">
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : step.status === 'active' ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    step.status === 'active' ? 'text-primary' : ''
                  }`}>
                    {step.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                {step.status === 'active' && (
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Processing...
                  </div>
                )}
                {step.status === 'completed' && step.startTime && step.endTime && (
                  <div className="text-sm text-muted-foreground">
                    {Math.round((new Date(step.endTime).getTime() - new Date(step.startTime).getTime()) / 1000)}s
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transition Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner size="lg" label="Transitioning to next phase..." />
          </div>
        </div>
      )}
    </div>
  );
}