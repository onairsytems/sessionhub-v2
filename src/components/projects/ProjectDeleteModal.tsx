'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Project } from '@/src/types/project';
import { useProject } from '@/src/contexts/ProjectContext';

interface ProjectDeleteModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectDeleteModal: React.FC<ProjectDeleteModalProps> = ({ project, isOpen, onClose }) => {
  const { deleteProject } = useProject();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== project.name) {
      setError('Please type the project name correctly to confirm deletion');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await deleteProject(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmText('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Project</h2>
          </div>

          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{project.name}</strong>? 
              This action cannot be undone.
            </p>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This will permanently delete:
              </p>
              <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                <li>All project data and settings</li>
                <li>{project.sessionCount} associated sessions</li>
                <li>{project.activities.length} activity logs</li>
                <li>Any project-specific configurations</li>
              </ul>
            </div>

            <div>
              <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>{project.name}</strong> to confirm deletion:
              </label>
              <input
                type="text"
                id="confirmDelete"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  setError(null);
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={project.name}
                disabled={isDeleting}
              />
              {error && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== project.name}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};