
'use client';

import { useState, useEffect } from 'react';
import { ApiConfiguration } from './ApiConfiguration';
import { PlanningChat } from './PlanningChat';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckCircle, Circle, ArrowRight, PlayCircle, MessageSquare, Code } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  status: 'configuring' | 'planning' | 'executing' | 'completed';
  plan?: string;
  results?: unknown;
}

export function SessionWorkflow() : void {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      const hasKey = await window.electronAPI.checkApiKey();
      setHasApiKey(hasKey);
    } catch (error) {
      console.error('Failed to check API key:', error);
    } finally {
      setIsCheckingApiKey(false);
    }
  };

  const createNewSession = () => {
    const session: Session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      status: 'planning',
    };
    setCurrentSession(session);
  };

  const handlePlanComplete = (plan: string) => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        status: 'executing',
        plan,
      });
    }
  };

  const handleExecutionComplete = (results) => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        status: 'completed',
        results,
      });
    }
  };

  if (isCheckingApiKey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading SessionHub...</p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return <ApiConfiguration onComplete={() => setHasApiKey(true)} />;
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">SessionHub</h1>
          
          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-4">Welcome to SessionHub</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create a new session to start planning and building your project with the Two-Actor Model.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium">1. Planning Phase</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Discuss your requirements with the Planning Actor
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Code className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">2. Execution Phase</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The Execution Actor implements your plan
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="font-medium">3. Review Results</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    See what was built and test your application
                  </p>
                </div>
              </div>
            </div>
            
            <Button onClick={createNewSession} size="lg" className="w-full">
              <PlayCircle className="h-5 w-5 mr-2" />
              Start New Session
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className={`flex items-center gap-2 ${
                currentSession.status === 'planning' ? 'text-blue-600' : 'text-green-600'
              }`}>
                {currentSession.status === 'planning' ? (
                  <Circle className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span className="font-medium">Planning</span>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className={`flex items-center gap-2 ${
                currentSession.status === 'executing' ? 'text-blue-600' :
                currentSession.status === 'completed' ? 'text-green-600' :
                'text-gray-400'
              }`}>
                {currentSession.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="font-medium">Execution</span>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className={`flex items-center gap-2 ${
                currentSession.status === 'completed' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <Circle className="h-5 w-5" />
                <span className="font-medium">Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {currentSession.status === 'planning' && (
          <PlanningChat
            sessionId={currentSession.id}
            sessionName={currentSession.name}
            onPlanComplete={handlePlanComplete}
          />
        )}
        
        {currentSession.status === 'executing' && (
          <div className="p-8">
            <Card className="max-w-4xl mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">Executing Plan</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The Execution Actor is now implementing your plan...
              </p>
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {currentSession.plan}
                  </pre>
                </div>
                <Button onClick={() => handleExecutionComplete({ success: true })}>
                  Complete Execution (Demo)
                </Button>
              </div>
            </Card>
          </div>
        )}
        
        {currentSession.status === 'completed' && (
          <div className="p-8">
            <Card className="max-w-4xl mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">Session Complete!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your project has been successfully built.
              </p>
              <div className="space-y-4">
                <Button onClick={() => setCurrentSession(null)} variant="primary">
                  Start New Session
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}