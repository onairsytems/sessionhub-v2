'use client';

import React, { useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle,
  FileCode,
  GitBranch,
  Calendar,
  TrendingUp,
  BarChart3,
  Code,
  ArrowUp,
  ArrowDown,
  Edit,
  Archive,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Project, ProjectActivity } from '@/src/types/project';
import { ProjectService } from '@/src/services/ProjectService';
import { formatDistanceToNow, format } from 'date-fns';

interface ProjectDashboardProps {
  project: Project;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onExport?: () => void;
  onDuplicate?: () => void;
  onSettings?: () => void;
}

const activityIcons: Record<ProjectActivity['type'], React.ReactNode> = {
  created: <Calendar className="w-4 h-4 text-green-500" />,
  updated: <Edit className="w-4 h-4 text-blue-500" />,
  session_started: <Activity className="w-4 h-4 text-purple-500" />,
  session_completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  file_changed: <FileCode className="w-4 h-4 text-yellow-500" />,
  milestone_reached: <TrendingUp className="w-4 h-4 text-indigo-500" />
};

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ 
  project, 
  onEdit, 
  onArchive, 
  onDelete 
}) => {
  const projectService = ProjectService.getInstance();
  const metrics = useMemo(() => projectService.getProjectMetrics(project.id), [project.id]);
  const recentActivities = useMemo(() => projectService.getRecentActivities(project.id, 5), [project.id]);

  if (!metrics) return null;

  const successRate = metrics.totalSessions > 0 
    ? Math.round((metrics.completedSessions / metrics.totalSessions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {project.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {project.metadata.technology}
              </span>
              {project.metadata.framework && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {project.metadata.framework}
                </span>
              )}
              {project.metadata.tags?.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={onEdit}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              title="Edit project"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={onArchive}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              title="Archive project"
            >
              <Archive className="w-5 h-5" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              title="Delete project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {project.metadata.repository && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={project.metadata.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <GitBranch className="w-4 h-4" />
              View Repository
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sessions</span>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.totalSessions}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {metrics.completedSessions} completed
          </p>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</span>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {successRate}%
          </div>
          <div className="flex items-center gap-4 text-xs mt-1">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle className="w-3 h-3" />
              {metrics.completedSessions}
            </span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="w-3 h-3" />
              {metrics.failedSessions}
            </span>
          </div>
        </div>

        {/* Avg Session Duration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Duration</span>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(metrics.averageSessionDuration / 1000 / 60)} min
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            per session
          </p>
        </div>

        {/* Code Changes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Code Changes</span>
            <Code className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <ArrowUp className="w-4 h-4 text-green-500" />
              <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                +{metrics.linesOfCodeAdded}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDown className="w-4 h-4 text-red-500" />
              <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                -{metrics.linesOfCodeRemoved}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {metrics.filesModified} files modified
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        
        {recentActivities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No recent activity to display
          </p>
        ) : (
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1">
                  {activityIcons[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Created</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-1">
              {format(project.createdAt, 'PPP')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Updated</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-1">
              {format(project.updatedAt, 'PPP')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Accessed</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-1">
              {format(project.lastAccessedAt, 'PPP')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</dt>
            <dd className="text-sm mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                project.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                project.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                project.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {project.status}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};