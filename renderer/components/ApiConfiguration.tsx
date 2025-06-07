
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Key, AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface ApiConfigurationProps {
  onComplete: () => void;
}

export function ApiConfiguration({ onComplete }: ApiConfigurationProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [isValid, setIsValid] = useState(false);

  const checkExistingApiKey = useCallback(async () => {
    try {
      const hasKey = await window.electronAPI.checkApiKey();
      if (hasKey) {
        onComplete();
      }
    } catch (err) {
      console.error('Error checking API key:', err);
    }
  }, [onComplete]);

  useEffect(() => {
    // Check if API key already exists
    checkExistingApiKey();
  }, [checkExistingApiKey]);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Claude API key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const isValid = await window.electronAPI.validateApiKey(apiKey);
      
      if (isValid) {
        await window.electronAPI.saveApiKey(apiKey);
        setIsValid(true);
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setError('Failed to validate API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Key className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Welcome to SessionHub</h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
            To get started, please enter your Claude API key. This will be stored securely in your Mac&apos;s Keychain.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Claude API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isValidating || isValid}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {isValid && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm">API key validated successfully!</p>
              </div>
            )}

            <Button
              onClick={validateApiKey}
              disabled={isValidating || isValid || !apiKey.trim()}
              fullWidth
              className="mt-6"
            >
              {isValidating ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : isValid ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Success!
                </>
              ) : (
                'Continue'
              )}
            </Button>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
              Your API key will be stored securely and never shared. You can get your key from{' '}
              <a
                href="https://console.anthropic.com/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}