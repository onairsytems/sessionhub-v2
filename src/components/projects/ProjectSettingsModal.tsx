'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { CogIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProject } from '@/src/contexts/ProjectContext';
import { Project, ProjectSettings } from '@/src/types/project';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { getProjectSettings, updateProjectSettings } = useProject();
  const [settings, setSettings] = useState<ProjectSettings>({
    theme: 'system',
    defaultBranch: 'main',
    autoSave: true,
    sessionTimeout: 30,
    codeStyle: {
      tabSize: 2,
      useTabs: false,
      lineNumbers: true,
      wordWrap: true
    },
    aiSettings: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2048
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const currentSettings = getProjectSettings(project.id);
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [project.id, getProjectSettings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('idle');
      
      await updateProjectSettings(project.id, settings);
      
      setSaveStatus('success');
      setTimeout(() => {
        onClose();
        setSaveStatus('idle');
      }, 1500);
    } catch (error) {
      setSaveStatus('error');
      // Failed to save settings
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && !current[key]) {
          current[key] = {};
        }
        if (key) {
          current = current[key];
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        current[lastKey] = value;
      }
      return newSettings;
    });
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              Project Settings - {project.name}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* General Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Theme
                  </label>
                  <select
                    id="theme"
                    value={settings.theme || 'system'}
                    onChange={(e) => updateSetting('theme', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Default Branch
                  </label>
                  <input
                    type="text"
                    id="defaultBranch"
                    value={settings.defaultBranch || 'main'}
                    onChange={(e) => updateSetting('defaultBranch', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="autoSave"
                    checked={settings.autoSave || false}
                    onChange={(e) => updateSetting('autoSave', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="autoSave" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Enable auto-save
                  </label>
                </div>

                <div>
                  <label htmlFor="sessionTimeout" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    id="sessionTimeout"
                    value={settings.sessionTimeout || 30}
                    onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
                    min="5"
                    max="240"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Code Style Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Code Style</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="tabSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tab Size
                  </label>
                  <select
                    id="tabSize"
                    value={settings.codeStyle?.tabSize || 2}
                    onChange={(e) => updateSetting('codeStyle.tabSize', parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value={2}>2 spaces</option>
                    <option value={4}>4 spaces</option>
                    <option value={8}>8 spaces</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useTabs"
                    checked={settings.codeStyle?.useTabs || false}
                    onChange={(e) => updateSetting('codeStyle.useTabs', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useTabs" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Use tabs instead of spaces
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="lineNumbers"
                    checked={settings.codeStyle?.lineNumbers !== false}
                    onChange={(e) => updateSetting('codeStyle.lineNumbers', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="lineNumbers" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Show line numbers
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="wordWrap"
                    checked={settings.codeStyle?.wordWrap !== false}
                    onChange={(e) => updateSetting('codeStyle.wordWrap', e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="wordWrap" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Enable word wrap
                  </label>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">AI Settings</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="aiModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    AI Model
                  </label>
                  <select
                    id="aiModel"
                    value={settings.aiSettings?.model || 'gpt-4'}
                    onChange={(e) => updateSetting('aiSettings.model', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Temperature ({settings.aiSettings?.temperature || 0.7})
                  </label>
                  <input
                    type="range"
                    id="temperature"
                    value={settings.aiSettings?.temperature || 0.7}
                    onChange={(e) => updateSetting('aiSettings.temperature', parseFloat(e.target.value))}
                    min="0"
                    max="2"
                    step="0.1"
                    className="mt-1 block w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    id="maxTokens"
                    value={settings.aiSettings?.maxTokens || 2048}
                    onChange={(e) => updateSetting('aiSettings.maxTokens', parseInt(e.target.value))}
                    min="256"
                    max="8192"
                    step="256"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {saveStatus === 'success' && (
            <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Settings saved successfully!
              </p>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                Failed to save settings. Please try again.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <CogIcon className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};