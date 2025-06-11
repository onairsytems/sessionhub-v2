/**
 * Interactive tutorial system for guided SessionHub learning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useRouter } from 'next/router';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  action?: {
    type: 'click' | 'type' | 'navigate' | 'highlight';
    target: string;
    value?: string;
  };
  validation?: {
    type: 'element-exists' | 'value-equals' | 'session-created';
    target: string;
    value?: string;
  };
  tips?: string[];
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  steps: TutorialStep[];
  category: string;
}

interface InteractiveTutorialProps {
  tutorialId?: string;
  onComplete?: (tutorialId: string) => void;
}

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  tutorialId,
  onComplete,
}) => {
  const router = useRouter();
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Load tutorial data
  useEffect(() => {
    if (tutorialId) {
      loadTutorial(tutorialId);
    }
  }, [tutorialId]);

  const loadTutorial = async (id: string) => {
    try {
      const tutorial = await window.sessionhub.tutorials.getTutorial(id);
      setCurrentTutorial(tutorial);
      setCurrentStepIndex(0);
    } catch (error) {
      // Handle error
    }
  };

  const currentStep = currentTutorial?.steps[currentStepIndex];

  const highlightElement = useCallback((selector: string) => {
    const element = document.querySelector(selector);
    if (element) {
      setIsHighlighting(true);
      element.classList.add('tutorial-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        element.classList.remove('tutorial-highlight');
        setIsHighlighting(false);
      }, 3000);
    }
  }, []);

  const executeAction = useCallback(async () => {
    if (!currentStep?.action) return;

    const { type, target, value } = currentStep.action;

    switch (type) {
      case 'highlight':
        highlightElement(target);
        break;
      
      case 'navigate':
        await router.push(target);
        break;
      
      case 'click':
        const clickElement = document.querySelector(target) as HTMLElement;
        clickElement?.click();
        break;
      
      case 'type':
        const inputElement = document.querySelector(target) as HTMLInputElement;
        if (inputElement && value) {
          inputElement.value = value;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
    }
  }, [currentStep, highlightElement, router]);

  const validateStep = useCallback(async (): Promise<boolean> => {
    if (!currentStep?.validation) return true;

    const { type, target, value } = currentStep.validation;

    switch (type) {
      case 'element-exists':
        return !!document.querySelector(target);
      
      case 'value-equals':
        const element = document.querySelector(target) as HTMLInputElement;
        return element?.value === value;
      
      case 'session-created':
        try {
          const result = await window.electronAPI.getUserSessions('current-user');
          if (result && typeof result === 'object' && 'sessions' in result) {
            const sessions = (result as any).sessions;
            return Array.isArray(sessions) && sessions.length > 0;
          }
          return false;
        } catch {
          return false;
        }
      
      default:
        return true;
    }
  }, [currentStep]);

  const handleNext = useCallback(async () => {
    const isValid = await validateStep();
    
    if (isValid) {
      if (currentStepIndex < (currentTutorial?.steps.length || 0) - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        // Tutorial complete
        if (currentTutorial && onComplete) {
          onComplete(currentTutorial.id);
        }
      }
    } else {
      // Show validation error
      alert('Please complete the current step before proceeding.');
    }
  }, [currentStepIndex, currentTutorial, validateStep, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    if (currentTutorial && onComplete) {
      onComplete(currentTutorial.id);
    }
  }, [currentTutorial, onComplete]);

  if (!currentTutorial || !currentStep) {
    return null;
  }

  const progress = ((currentStepIndex + 1) / currentTutorial.steps.length) * 100;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{currentTutorial.title}</h3>
            <Badge variant={
              currentTutorial.difficulty === 'beginner' ? 'success' :
              currentTutorial.difficulty === 'intermediate' ? 'warning' :
              'destructive'
            }>
              {currentTutorial.difficulty}
            </Badge>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-600 mt-1">
            Step {currentStepIndex + 1} of {currentTutorial.steps.length}
          </p>
        </div>

        {/* Current Step */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">{currentStep.title}</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {currentStep.content}
          </p>
          
          {/* Tips */}
          {currentStep.tips && currentStep.tips.length > 0 && (
            <div className="mt-3">
              <button
                className="text-sm text-blue-600 hover:text-blue-700"
                onClick={() => setShowTips(!showTips)}
              >
                {showTips ? 'Hide' : 'Show'} Tips
              </button>
              
              {showTips && (
                <ul className="mt-2 space-y-1">
                  {currentStep.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="mr-2">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              Previous
            </Button>
            
            {currentStep.action && (
              <Button
                variant="outline"
                size="sm"
                onClick={executeAction}
                disabled={isHighlighting}
              >
                Show Me
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
            >
              Skip Tutorial
            </Button>
            
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
            >
              {currentStepIndex === currentTutorial.steps.length - 1 ? 'Complete' : 'Next'}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Tutorial Highlight Styles */}
      <style jsx global>{`
        .tutorial-highlight {
          position: relative;
          z-index: 40;
          outline: 3px solid #3B82F6;
          outline-offset: 2px;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0% {
            outline-color: #3B82F6;
            outline-offset: 2px;
          }
          50% {
            outline-color: #60A5FA;
            outline-offset: 4px;
          }
          100% {
            outline-color: #3B82F6;
            outline-offset: 2px;
          }
        }
      `}</style>
    </div>
  );
};