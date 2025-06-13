'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowUpIcon, 
  TrashIcon, 
  CloudArrowDownIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useProject } from '@/src/contexts/ProjectContext';
import { BulkProjectOperation } from '@/src/types/project';
import { formatDistanceToNow } from 'date-fns';

export const ArchivedProjectsPage: React.FC = () => {
  const { archivedProjects, restoreProject, deleteProject, bulkOperation, isLoading, loadProjects } = useProject();
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReason, setFilterReason] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    // Load projects including archived ones
    loadProjects(true);
  }, [loadProjects]);

  useEffect(() => {
    setShowBulkActions(selectedProjects.size > 0);
  }, [selectedProjects]);

  const filteredProjects = archivedProjects.filter(project => {
    const matchesSearch = searchTerm === '' || 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesReason = filterReason === '' || 
      (project.archiveReason && project.archiveReason.toLowerCase().includes(filterReason.toLowerCase()));
    
    return matchesSearch && matchesReason;
  });

  const handleToggleSelect = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const handleBulkRestore = async () => {
    if (selectedProjects.size === 0) return;
    
    const operation: BulkProjectOperation = {
      operation: 'restore',
      projectIds: Array.from(selectedProjects)
    };
    
    await bulkOperation(operation);
    setSelectedProjects(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    if (!confirm(`Are you sure you want to permanently delete ${selectedProjects.size} project(s)?`)) {
      return;
    }
    
    const operation: BulkProjectOperation = {
      operation: 'delete',
      projectIds: Array.from(selectedProjects)
    };
    
    await bulkOperation(operation);
    setSelectedProjects(new Set());
  };

  const handleRestore = async (projectId: string) => {
    await restoreProject(projectId);
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to permanently delete this project?')) {
      return;
    }
    await deleteProject(projectId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Archived Projects</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage your archived projects. Restore or permanently delete them.
          </p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search projects</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search archived projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="sm:w-64">
          <label htmlFor="filter-reason" className="sr-only">Filter by archive reason</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="filter-reason"
              id="filter-reason"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Filter by reason..."
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedProjects.size} project(s) selected
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {selectedProjects.size === filteredProjects.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBulkRestore}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowUpIcon className="h-4 w-4 mr-1.5" />
              Restore Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <TrashIcon className="h-4 w-4 mr-1.5" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="mt-6 bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <CloudArrowDownIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No archived projects</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || filterReason ? 'Try adjusting your search or filters.' : 'Projects you archive will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProjects.map((project) => (
              <li key={project.id}>
                <div className="px-4 py-4 flex items-center sm:px-6">
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={selectedProjects.has(project.id)}
                        onChange={() => handleToggleSelect(project.id)}
                      />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                          {project.name}
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <span>{project.description}</span>
                        </div>
                        {project.archiveReason && (
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Reason: {project.archiveReason}
                          </div>
                        )}
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Archived {project.archivedAt ? formatDistanceToNow(project.archivedAt, { addSuffix: true }) : 'recently'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center sm:mt-0 sm:ml-4">
                      <button
                        onClick={() => handleRestore(project.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                      >
                        <ArrowUpIcon className="h-4 w-4 mr-1.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="ml-3 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
                      >
                        <TrashIcon className="h-4 w-4 mr-1.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};