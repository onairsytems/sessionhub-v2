'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProject } from '@/src/contexts/ProjectContext';
import { Project } from '@/src/types/project';
import { useRouter } from 'next/navigation';

interface ProjectDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectDuplicateModal: React.FC<ProjectDuplicateModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { duplicateProject } = useProject();
  const router = useRouter();
  const [newName, setNewName] = useState(`${project.name} (Copy)`);
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeSessions, setIncludeSessions] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState('');

  const handleDuplicate = async () => {
    if (!newName.trim()) {
      setError('Please enter a name for the duplicated project');
      return;
    }

    try {
      setIsDuplicating(true);
      setError('');
      
      const duplicatedProject = await duplicateProject(
        project.id, 
        newName.trim(),
        { includeSettings, includeSessions }
      );
      
      // Navigate to the new project
      router.push(`/projects/${duplicatedProject.id}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate project');
      // Duplication failed
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleClose = () => {
    setNewName(`${project.name} (Copy)`);
    setIncludeSettings(true);
    setIncludeSessions(false);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              Duplicate Project
            </Dialog.Title>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a copy of "{project.name}" with a new name and selected options.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Project Name
              </label>
              <input
                type="text"
                id="project-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter project name"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Duplication Options
              </label>
              
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="include-settings"
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="include-settings" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Include project settings
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Copy all project-specific configurations and preferences
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="include-sessions"
                    type="checkbox"
                    checked={includeSessions}
                    onChange={(e) => setIncludeSessions(e.target.checked)}
                    disabled
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="include-sessions" className="text-sm font-medium text-gray-400 dark:text-gray-500">
                    Include sessions (Coming Soon)
                  </label>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Copy all session data and history
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <DocumentDuplicateIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    What will be duplicated:
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Project metadata and description</li>
                      <li>Technology and framework information</li>
                      <li>Tags and categories</li>
                      {includeSettings && <li>All project-specific settings</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              onClick={handleClose}
              disabled={isDuplicating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleDuplicate}
              disabled={isDuplicating || !newName.trim()}
            >
              {isDuplicating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Duplicating...
                </>
              ) : (
                <>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
                  Duplicate Project
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};