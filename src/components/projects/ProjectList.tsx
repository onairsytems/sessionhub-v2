'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Folder, 
  Clock, 
  Archive, 
  CheckCircle, 
  PauseCircle,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Activity,
  MoreVertical,
  Download,
  Copy,
  Settings,
  Trash2
} from 'lucide-react';
import { ProjectStatus, ProjectFilter } from '@/src/types/project';
import { useProject } from '@/src/contexts/ProjectContext';
import { ProjectService } from '@/src/services/ProjectService';
import { formatDistanceToNow } from 'date-fns';

interface ProjectListProps {
  onCreateClick: () => void;
  onEditClick?: (projectId: string) => void;
  onDeleteClick?: (projectId: string) => void;
  onExportClick?: (projectId: string) => void;
  onDuplicateClick?: (projectId: string) => void;
  onSettingsClick?: (projectId: string) => void;
  onArchiveClick?: (projectId: string) => void;
}

const statusIcons: Record<ProjectStatus, React.ReactNode> = {
  active: <Activity className="w-4 h-4 text-green-500" />,
  archived: <Archive className="w-4 h-4 text-gray-400" />,
  completed: <CheckCircle className="w-4 h-4 text-blue-500" />,
  paused: <PauseCircle className="w-4 h-4 text-yellow-500" />
};

const statusLabels: Record<ProjectStatus, string> = {
  active: 'Active',
  archived: 'Archived',
  completed: 'Completed',
  paused: 'Paused'
};

export const ProjectList: React.FC<ProjectListProps> = ({ 
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onExportClick,
  onDuplicateClick,
  onSettingsClick,
  onArchiveClick
}) => {
  const { projects, currentProject, switchProject, isLoading, archiveProject } = useProject();
  const [filter, setFilter] = useState<ProjectFilter>({
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    includeArchived: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const projectService = ProjectService.getInstance();

  const filteredProjects = useMemo(() => {
    return projectService.getFilteredProjects(filter);
  }, [projects, filter, projectService]);

  const handleProjectClick = async (projectId: string, e?: React.MouseEvent) => {
    // Don't switch project if clicking on dropdown or its children
    if (e && (e.target as HTMLElement).closest('.project-dropdown')) {
      return;
    }
    if (currentProject?.id !== projectId) {
      await switchProject(projectId);
    }
  };

  const handleDropdownClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setDropdownOpenId(dropdownOpenId === projectId ? null : projectId);
  };

  const handleArchive = async (projectId: string) => {
    if (onArchiveClick) {
      onArchiveClick(projectId);
    } else {
      await archiveProject(projectId);
    }
    setDropdownOpenId(null);
  };

  const handleFilterChange = (newFilter: Partial<ProjectFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
  };

  // Click outside handler for dropdown
  useEffect(() => {
    return; // Add return for all paths
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.project-dropdown')) {
        setDropdownOpenId(null);
      }
    };

    if (dropdownOpenId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [dropdownOpenId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h2>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects..."
              value={filter.searchTerm || ''}
              onChange={(e) => handleFilterChange({ searchTerm: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filter.status?.[0] || 'all'}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange({
                      status: value === 'all' ? undefined : [value as ProjectStatus]
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">All Status</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={filter.sortBy || 'updatedAt'}
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="name">Name</option>
                  <option value="createdAt">Created Date</option>
                  <option value="updatedAt">Updated Date</option>
                  <option value="lastAccessedAt">Last Accessed</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order
                </label>
                <select
                  value={filter.sortOrder || 'desc'}
                  onChange={(e) => handleFilterChange({ sortOrder: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No projects found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {filter.searchTerm ? 'Try adjusting your search or filters' : 'Get started by creating your first project'}
          </p>
          {!filter.searchTerm && (
            <button
              onClick={onCreateClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={(e) => handleProjectClick(project.id, e)}
              className={`p-6 border rounded-lg cursor-pointer transition-all hover:shadow-lg relative ${
                currentProject?.id === project.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {project.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcons[project.status]}
                  <div className="relative project-dropdown">
                    <button
                      onClick={(e) => handleDropdownClick(e, project.id)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    {dropdownOpenId === project.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        {onEditClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditClick(project.id);
                              setDropdownOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            Edit Project
                          </button>
                        )}
                        {onDuplicateClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateClick(project.id);
                              setDropdownOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </button>
                        )}
                        {onExportClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportClick(project.id);
                              setDropdownOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Export
                          </button>
                        )}
                        {onSettingsClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSettingsClick(project.id);
                              setDropdownOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            Settings
                          </button>
                        )}
                        {project.status !== 'archived' && (
                          <>
                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchive(project.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </button>
                          </>
                        )}
                        {onDeleteClick && (
                          <>
                            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(project.id);
                                setDropdownOpenId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {project.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {project.metadata.technology}
                  </span>
                  {project.metadata.framework && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                      {project.metadata.framework}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(project.updatedAt, { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>{project.sessionCount} sessions</span>
                  </div>
                </div>
              </div>

              {currentProject?.id === project.id && (
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Current Project</span>
                    <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};