import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, AlertCircle, Key, User, Zap, Shield, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from './ui/Card';

type Step = 'welcome' | 'api-key' | 'preferences' | 'complete';
type UserLevel = 'beginner' | 'intermediate' | 'advanced';
type UseCase = 'web-development' | 'data-science' | 'automation' | 'general' | 'other';

interface OnboardingState {
  currentStep: Step;
  apiKey: string;
  apiKeyValid: boolean;
  apiKeyValidating: boolean;
  apiKeyError: string;
  userLevel: UserLevel;
  primaryUseCase: UseCase;
  setupComplete: boolean;
}

const STEPS: Step[] = ['welcome', 'api-key', 'preferences', 'complete'];

export const OnboardingWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'welcome',
    apiKey: '',
    apiKeyValid: false,
    apiKeyValidating: false,
    apiKeyError: '',
    userLevel: 'beginner',
    primaryUseCase: 'general',
    setupComplete: false
  });

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepIndex = STEPS.indexOf(state.currentStep);
    setProgress((stepIndex / (STEPS.length - 1)) * 100);
  }, [state.currentStep]);

  const validateApiKey = useCallback(async (key: string) => {
    if (!key || key.length < 10) {
      setState(prev => ({ ...prev, apiKeyError: 'Please enter a valid API key' }));
      return false;
    }

    setState(prev => ({ ...prev, apiKeyValidating: true, apiKeyError: '' }));

    try {
      const result = await window.electron.invoke('validate-claude-api', key, 'claude-3-opus-20240229') as { valid: boolean; error?: string; model?: string };
      
      if (result.valid) {
        await window.electron.invoke('store:set', 'services.claude.apiKey', key);
        await window.electron.invoke('store:set', 'services.claude.configured', true);
        await window.electron.invoke('store:set', 'services.claude.model', result.model);
        await window.electron.invoke('store:set', 'services.claude.lastValidated', new Date().toISOString());
        
        setState(prev => ({ ...prev, apiKeyValid: true, apiKeyValidating: false }));
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          apiKeyValid: false, 
          apiKeyValidating: false,
          apiKeyError: result.error || 'Invalid API key' 
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        apiKeyValidating: false,
        apiKeyError: 'Failed to validate API key. Please check your connection.' 
      }));
      return false;
    }
  }, []);

  const handleNext = useCallback(async () => {
    const currentIndex = STEPS.indexOf(state.currentStep);
    
    if (state.currentStep === 'api-key') {
      const isValid = await validateApiKey(state.apiKey);
      if (!isValid) return;
    }
    
    if (currentIndex < STEPS.length - 1) {
      setState(prev => ({ ...prev, currentStep: STEPS[currentIndex + 1] as Step }));
    }
  }, [state.currentStep, state.apiKey, validateApiKey]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState(prev => ({ ...prev, currentStep: STEPS[currentIndex - 1] as Step }));
    }
  }, [state.currentStep]);

  const handleComplete = useCallback(async () => {
    await window.electron.invoke('store:set', 'onboarding.completed', true);
    await window.electron.invoke('store:set', 'onboarding.userLevel', state.userLevel);
    await window.electron.invoke('store:set', 'onboarding.primaryUseCase', state.primaryUseCase);
    await window.electron.invoke('store:set', 'onboarding.completedAt', new Date().toISOString());
    
    setState(prev => ({ ...prev, setupComplete: true }));
    setTimeout(onComplete, 1500);
  }, [state.userLevel, state.primaryUseCase, onComplete]);

  const renderStep = () => {
    switch (state.currentStep) {
      case 'welcome':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome to SessionHub
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Your AI-powered development assistant that helps you build better software, faster.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <Card className="p-4 text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Two-Actor Model</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Intelligent planning meets precise execution
                </p>
              </Card>

              <Card className="p-4 text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Secure & Private</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your code and data stay on your machine
                </p>
              </Card>

              <Card className="p-4 text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Always Improving</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Self-updating with continuous enhancements
                </p>
              </Card>
            </div>

            <div className="flex justify-center pt-6">
              <Button onClick={handleNext} size="lg" className="group">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case 'api-key':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Key className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Connect to Claude API
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Enter your Anthropic API key to enable AI-powered features
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="sk-ant-api03-..."
                    value={state.apiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(prev => ({ ...prev, apiKey: e.target.value, apiKeyError: '' }))}
                    className={state.apiKeyError ? 'border-red-500' : ''}
                    disabled={state.apiKeyValidating}
                  />
                  {state.apiKeyValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                  {state.apiKeyValid && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                </div>
                {state.apiKeyError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {state.apiKeyError}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">How to get an API key:</h3>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Visit console.anthropic.com</li>
                  <li>Sign up or log in to your account</li>
                  <li>Navigate to API Keys section</li>
                  <li>Create a new key and copy it here</li>
                </ol>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.electron.invoke('open-external-url', 'https://console.anthropic.com')}
                  className="mt-2"
                >
                  Open Anthropic Console
                </Button>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={!state.apiKey || state.apiKeyValidating}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 'preferences':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Personalize Your Experience
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Help us tailor SessionHub to your needs
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Your Experience Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as UserLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setState(prev => ({ ...prev, userLevel: level }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        state.userLevel === level
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-sm font-medium capitalize text-gray-900 dark:text-white">
                        {level}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {level === 'beginner' && 'New to coding'}
                        {level === 'intermediate' && '1-3 years'}
                        {level === 'advanced' && '3+ years'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Primary Use Case
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'web-development', label: 'Web Development', icon: '🌐' },
                    { id: 'data-science', label: 'Data Science & ML', icon: '📊' },
                    { id: 'automation', label: 'Automation & Scripts', icon: '⚙️' },
                    { id: 'general', label: 'General Programming', icon: '💻' },
                    { id: 'other', label: 'Other', icon: '🔧' }
                  ].map((useCase) => (
                    <button
                      key={useCase.id}
                      onClick={() => setState(prev => ({ ...prev, primaryUseCase: useCase.id as UseCase }))}
                      className={`w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${
                        state.primaryUseCase === useCase.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl">{useCase.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{useCase.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between max-w-md mx-auto pt-4">
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto flex items-center justify-center"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                You're All Set!
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                SessionHub is ready to help you build amazing things. Let's get started!
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                Quick Tips to Get Started:
              </h3>
              <ul className="text-sm text-green-800 dark:text-green-200 space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Press ⌘+N to create a new session</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Use natural language to describe what you want to build</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>SessionHub will plan and execute your ideas</span>
                </li>
              </ul>
            </div>

            {!state.setupComplete && (
              <Button onClick={handleComplete} size="lg" className="mt-6">
                Start Using SessionHub
              </Button>
            )}
            
            {state.setupComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Launching SessionHub...
              </motion.div>
            )}
          </motion.div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`text-xs font-medium capitalize ${
                  STEPS.indexOf(state.currentStep) >= index
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {step.replace('-', ' ')}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <Card className="p-8 shadow-xl">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </Card>

        {/* Skip Option */}
        {state.currentStep !== 'complete' && (
          <div className="text-center mt-4">
            <button
              onClick={onComplete}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Skip setup (configure later in settings)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};