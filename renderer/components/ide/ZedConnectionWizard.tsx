import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface ZedConnectionWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'welcome' | 'credentials' | 'testing' | 'complete';

interface ConnectionTestResult {
  success: boolean;
  diagnostics: {
    zedInstalled: boolean;
    zedRunning: boolean;
    mcpConfigured: boolean;
    credentialsValid: boolean;
  };
  errors: string[];
}

export const ZedConnectionWizard: React.FC<ZedConnectionWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleCredentialsSubmit = async () => {
    if (!email || !apiToken) {
      setError('Please provide both email and API token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Store credentials
      await window.electronAPI.zed.storeCredentials({ email, apiToken });
      
      // Move to testing step
      setCurrentStep('testing');
      await runConnectionTest();
    } catch (err: any) {
      setError(err.message || 'Failed to store credentials');
      setIsLoading(false);
    }
  };

  const runConnectionTest = async () => {
    try {
      const result = await window.electronAPI.zed.testConnection();
      setTestResult(result);
      
      if (result.success) {
        // Auto-proceed to complete step after successful test
        setTimeout(() => setCurrentStep('complete'), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    await runConnectionTest();
  };

  const renderWelcomeStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Connect SessionHub to Zed
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Set up the integration between SessionHub and Zed to enable Two-Actor development with lightning-fast performance.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          What you'll need:
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Zed installed on your Mac (download from zed.dev)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Your Zed account email address</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>A Zed API token (we'll help you create one)</span>
          </li>
        </ul>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => setCurrentStep('credentials')}>
          Get Started
        </Button>
      </div>
    </div>
  );

  const renderCredentialsStep = () => (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => setCurrentStep('welcome')}
          className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Enter Your Zed Credentials
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zed Account Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API Token
            </label>
            <input
              id="apiToken"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              placeholder="zed_token_..."
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Don't have a token? 
              <button
                onClick={() => window.electronAPI.shell.openExternal('https://zed.dev/settings/tokens')}
                className="ml-1 text-blue-500 hover:text-blue-600 underline"
              >
                Create one here
              </button>
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep('welcome')}>
          Back
        </Button>
        <Button onClick={handleCredentialsSubmit} disabled={isLoading}>
          {isLoading ? 'Connecting...' : 'Connect to Zed'}
        </Button>
      </div>
    </div>
  );

  const renderTestingStep = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Testing Connection
      </h2>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 dark:text-gray-400">Running connection diagnostics...</p>
        </div>
      ) : testResult ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <DiagnosticItem
              label="Zed Installed"
              success={testResult.diagnostics.zedInstalled}
            />
            <DiagnosticItem
              label="Zed Running"
              success={testResult.diagnostics.zedRunning}
            />
            <DiagnosticItem
              label="MCP Configured"
              success={testResult.diagnostics.mcpConfigured}
            />
            <DiagnosticItem
              label="Credentials Valid"
              success={testResult.diagnostics.credentialsValid}
            />
          </div>

          {testResult.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Issues detected:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                {testResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {!testResult.success && (
            <div className="flex justify-center">
              <Button onClick={handleRetry} disabled={isLoading}>
                Retry Test
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Successfully Connected!
        </h2>

        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          SessionHub is now connected to Zed. You can start using the Two-Actor development workflow with lightning-fast performance.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          What's next?
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Create or open a project to start developing</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Use SessionHub's Planning Actor to design your approach</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Watch as the Execution Actor implements through Zed's agent panel</span>
          </li>
        </ul>
      </div>

      <div className="flex justify-center">
        <Button onClick={onComplete}>
          Start Using SessionHub
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="p-6">
        {currentStep === 'welcome' && renderWelcomeStep()}
        {currentStep === 'credentials' && renderCredentialsStep()}
        {currentStep === 'testing' && renderTestingStep()}
        {currentStep === 'complete' && renderCompleteStep()}
      </div>
    </Card>
  );
};

const DiagnosticItem: React.FC<{ label: string; success: boolean }> = ({ label, success }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    {success ? (
      <span className="flex items-center text-green-600 dark:text-green-400">
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm">Passed</span>
      </span>
    ) : (
      <span className="flex items-center text-red-600 dark:text-red-400">
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span className="text-sm">Failed</span>
      </span>
    )}
  </div>
);