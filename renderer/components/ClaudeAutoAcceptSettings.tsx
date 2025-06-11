import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Settings, 
  CheckCircle, 
 
  Info,
  Terminal,
  GitBranch,
  FileText,
  Zap
} from 'lucide-react';

interface ClaudeAutoAcceptSettings {
  enabled: boolean;
  sessionId?: string;
  acceptFileEdits: boolean;
  acceptGitOperations: boolean;
  acceptFoundationUpdates: boolean;
  acceptAllPrompts: boolean;
}

export function ClaudeAutoAcceptSettings() {
  const [settings, setSettings] = useState<ClaudeAutoAcceptSettings>({
    enabled: true,
    acceptFileEdits: true,
    acceptGitOperations: true,
    acceptFoundationUpdates: true,
    acceptAllPrompts: true
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await window.electronAPI.claude.getAutoAcceptSettings();
      setSettings(savedSettings);
    } catch (error) {
      // Failed to load settings, use defaults
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await window.electronAPI.claude.setAutoAcceptSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      // Failed to save settings
    } finally {
      setLoading(false);
    }
  };

  const toggleSetting = (key: keyof ClaudeAutoAcceptSettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };


  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold">Claude Code Auto-Accept</h2>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Saved
              </span>
            )}
            <Button
              onClick={() => void saveSettings()}
              disabled={loading}
              size="sm"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Automatic Acceptance for Claude Code</p>
            <p>
              When enabled, Claude Code will automatically accept prompts for file edits, 
              git operations, and Foundation updates without requiring manual confirmation.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium">Auto-Accept Enabled</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Master switch for all auto-accept features
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleSetting('enabled')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enabled 
                  ? 'bg-green-600' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Individual Settings */}
          <div className={`space-y-3 ${!settings.enabled ? 'opacity-50' : ''}`}>
            {/* File Edits */}
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-sm">File Edits</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Automatically accept file creation and modification
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('acceptFileEdits')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.acceptFileEdits 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.acceptFileEdits ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Git Operations */}
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <GitBranch className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-sm">Git Operations</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Automatically accept git commits and pushes
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('acceptGitOperations')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.acceptGitOperations 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.acceptGitOperations ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Foundation Updates */}
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-sm">Foundation Updates</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Automatically accept Foundation.md updates
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('acceptFoundationUpdates')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.acceptFoundationUpdates 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.acceptFoundationUpdates ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* All Prompts */}
            <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-sm">All Other Prompts</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Automatically accept all other confirmation prompts
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleSetting('acceptAllPrompts')}
                disabled={!settings.enabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.acceptAllPrompts 
                    ? 'bg-blue-600' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.acceptAllPrompts ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {settings.sessionId && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Active for session: <span className="font-mono">{settings.sessionId}</span>
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium mb-2">Quick Setup</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Run this command in your terminal to set up auto-accept system-wide:
          </p>
          <div className="bg-gray-900 dark:bg-gray-950 p-3 rounded-lg">
            <code className="text-xs text-gray-100">
              ./scripts/setup-claude-auto-accept.sh
            </code>
          </div>
        </div>
      </div>
    </Card>
  );
}