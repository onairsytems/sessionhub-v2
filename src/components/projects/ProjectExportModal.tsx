'use client';

import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { CloudArrowDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useProject } from '@/src/contexts/ProjectContext';
import { Project } from '@/src/types/project';

interface ProjectExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ProjectExportModal: React.FC<ProjectExportModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  const { exportProject } = useProject();
  const [exportFormat, setExportFormat] = useState<'json' | 'zip' | 'tar.gz'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus('idle');
      
      await exportProject(project.id, exportFormat);
      
      setExportStatus('success');
      setTimeout(() => {
        onClose();
        setExportStatus('idle');
      }, 2000);
    } catch (error) {
      setExportStatus('error');
      // Export failed
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
              Export Project
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Export "{project.name}" to download a backup copy with all project data and settings.
            </p>
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Export Format
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'json')}
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    JSON
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    Human-readable format, ideal for version control
                  </span>
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                  value="zip"
                  checked={exportFormat === 'zip'}
                  onChange={(e) => setExportFormat(e.target.value as 'zip')}
                  disabled
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-400 dark:text-gray-500">
                    ZIP (Coming Soon)
                  </span>
                  <span className="block text-sm text-gray-400 dark:text-gray-500">
                    Compressed archive with all project files
                  </span>
                </span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                  value="tar.gz"
                  checked={exportFormat === 'tar.gz'}
                  onChange={(e) => setExportFormat(e.target.value as 'tar.gz')}
                  disabled
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-400 dark:text-gray-500">
                    TAR.GZ (Coming Soon)
                  </span>
                  <span className="block text-sm text-gray-400 dark:text-gray-500">
                    Compressed archive for Unix/Linux systems
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CloudArrowDownIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Export includes:
                  </h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Project metadata and configuration</li>
                      <li>All project-specific settings</li>
                      <li>Activity history</li>
                      <li>Session references (IDs only)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {exportStatus === 'success' && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                Export completed successfully! The download should start automatically.
              </p>
            </div>
          )}

          {exportStatus === 'error' && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-800 dark:text-red-200">
                Export failed. Please try again.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <CloudArrowDownIcon className="h-4 w-4 mr-2" />
                  Export Project
                </>
              )}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};