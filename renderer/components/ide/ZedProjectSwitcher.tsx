import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  lastOpened?: Date;
  isActive?: boolean;
}

interface ZedProjectSwitcherProps {
  onProjectSwitch?: (project: Project) => void;
}

export const ZedProjectSwitcher: React.FC<ZedProjectSwitcherProps> = ({
  onProjectSwitch
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.projects.list();
      setProjects(projectList as Project[]);
    } catch (error) {
      // Handle error silently - empty project list will be shown
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectSwitch = async (project: Project) => {
    setIsSwitching(project.id);
    
    try {
      // Measure switch time
      const startTime = performance.now();
      
      // Switch to project in Zed
      await window.electronAPI.zed.openWorkspace(project.path);
      
      const switchTime = performance.now() - startTime;
      
      // Update project as active
      const updatedProjects = projects.map(p => ({
        ...p,
        isActive: p.id === project.id,
        lastOpened: p.id === project.id ? new Date() : p.lastOpened
      }));
      setProjects(updatedProjects);
      
      // Show performance metric
      if (switchTime < 2000) {
        window.electronAPI.api.showNotification({
          title: 'Project Opened',
          body: `Switched to ${project.name} in ${Math.round(switchTime)}ms`,
          type: 'success'
        });
      }
      
      onProjectSwitch?.(project);
    } catch (error) {
      window.electronAPI.api.showNotification({
        title: 'Switch Failed',
        body: error instanceof Error ? error.message : `Failed to open ${project.name} in Zed`,
        type: 'error'
      });
    } finally {
      setIsSwitching(null);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProjectIcon = (type: string) => {
    const icons: Record<string, string> = {
      'next': '⚡',
      'react': '⚛️',
      'node': '🟢',
      'typescript': '🔷',
      'javascript': '🟨',
      'python': '🐍',
      'rust': '🦀',
      'go': '🐹'
    };
    return icons[type] || '📁';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Project Switch
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {projects.length} projects
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectSwitch(project)}
              disabled={isSwitching !== null}
              className={`
                w-full text-left p-3 rounded-md transition-all
                ${project.isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
                ${isSwitching === project.id ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getProjectIcon(project.type)}</span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {project.name}
                      </p>
                      {project.isActive && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {project.path}
                    </p>
                  </div>
                </div>
                
                {isSwitching === project.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                )}
              </div>
              
              {project.lastOpened && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-11">
                  Last opened: {new Date(project.lastOpened).toLocaleString()}
                </p>
              )}
            </button>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No projects found</p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Tip: Projects open in Zed in under 2 seconds with full workspace restoration
          </p>
        </div>
      </div>
    </Card>
  );
};