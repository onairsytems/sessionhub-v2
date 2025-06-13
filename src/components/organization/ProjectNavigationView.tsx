/**
 * @actor user
 * @responsibility Project-based session filtering and navigation interface
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Project,
  ProjectStatus,
  SessionOrganizationSystem,
  OrganizationMetrics
} from '@/src/services/organization/SessionOrganizationSystem';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectItem
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  MoreVertical,
  Plus,
  Archive,
  Trash2,
  Settings,
  Clock,
  Calendar,
  GitBranch,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  BarChart
} from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';

interface ProjectNavigationViewProps {
  organizationSystem: SessionOrganizationSystem;
  onSessionSelect?: (sessionId: string) => void;
  onProjectSelect?: (projectId: string) => void;
  onCreateProject?: () => void;
}


const statusIcons: Record<ProjectStatus, React.ReactNode> = {
  active: <Zap className="w-4 h-4 text-green-500" />,
  paused: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  completed: <CheckCircle className="w-4 h-4 text-blue-500" />,
  archived: <Archive className="w-4 h-4 text-gray-500" />,
  abandoned: <XCircle className="w-4 h-4 text-red-500" />
};

const priorityColors: Record<string, string> = {
  critical: 'text-red-500 border-red-500',
  high: 'text-orange-500 border-orange-500',
  medium: 'text-yellow-500 border-yellow-500',
  low: 'text-green-500 border-green-500'
};

export const ProjectNavigationView: React.FC<ProjectNavigationViewProps> = ({
  organizationSystem,
  onSessionSelect,
  onProjectSelect,
  onCreateProject
}) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'sessions'>('updated');
  const [metrics, setMetrics] = useState<OrganizationMetrics | null>(null);
  const [projectSessions, setProjectSessions] = useState<Map<string, string[]>>(new Map());
  const [activeTab, setActiveTab] = useState('projects');

  useEffect(() => {
    loadProjects();
    loadMetrics();
  }, [statusFilter, sortBy]);

  useEffect(() => {
    const handleProjectUpdate = () => {
      loadProjects();
      loadMetrics();
    };

    organizationSystem.on('projectCreated', handleProjectUpdate);
    organizationSystem.on('projectUpdated', handleProjectUpdate);
    organizationSystem.on('projectDeleted', handleProjectUpdate);
    organizationSystem.on('sessionAssociated', handleProjectUpdate);

    return () => {
      organizationSystem.off('projectCreated', handleProjectUpdate);
      organizationSystem.off('projectUpdated', handleProjectUpdate);
      organizationSystem.off('projectDeleted', handleProjectUpdate);
      organizationSystem.off('sessionAssociated', handleProjectUpdate);
    };
  }, [organizationSystem]);

  const loadProjects = async () => {
    try {
      const projectList = await organizationSystem.searchProjects({
        status: statusFilter === 'all' ? undefined : statusFilter,
        sortBy,
        includeArchived: statusFilter === 'archived'
      });
      setProjects(projectList);

      // Load sessions for each project
      const sessionMap = new Map<string, string[]>();
      for (const project of projectList) {
        const sessions = await organizationSystem.getProjectSessions(project.id);
        sessionMap.set(project.id, sessions);
      }
      setProjectSessions(sessionMap);
    } catch (error) {
      toast({
        title: 'Failed to load projects',
        description: (error as Error).message
      });
    }
  };

  const loadMetrics = async () => {
    try {
      const metricsData = await organizationSystem.getOrganizationMetrics();
      setMetrics(metricsData);
    } catch (error) {
      // Failed to load metrics
    }
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query) ||
      project.metadata.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (onProjectSelect) {
      onProjectSelect(projectId);
    }
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      await organizationSystem.archiveProject(projectId);
      toast({
        title: 'Project archived',
        description: 'The project has been archived successfully'
      });
    } catch (error) {
      toast({
        title: 'Failed to archive project',
        description: (error as Error).message
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await organizationSystem.deleteProject(projectId);
      toast({
        title: 'Project deleted',
        description: 'The project has been deleted successfully'
      });
    } catch (error) {
      toast({
        title: 'Failed to delete project',
        description: (error as Error).message
      });
    }
  };

  const renderProjectItem = (project: Project) => {
    const isExpanded = expandedProjects.has(project.id);
    const isSelected = selectedProjectId === project.id;
    const sessions = projectSessions.get(project.id) || [];

    return (
      <div key={project.id} className="mb-2">
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
            isSelected ? "bg-accent" : "hover:bg-accent/50"
          )}
          onClick={() => handleProjectClick(project.id)}
        >
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleProjectExpanded(project.id);
              }}
              className="p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{project.name}</span>
                {statusIcons[project.status]}
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", priorityColors[project.metadata.priority])}
                >
                  {project.metadata.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {sessions.length} sessions
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(project.updatedAt).toLocaleDateString()}
                </span>
                {project.metadata.deadline && (
                  <span className="flex items-center gap-1 text-orange-500">
                    <Calendar className="w-3 h-3" />
                    Due {new Date(project.metadata.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" />
                Project Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <GitBranch className="w-4 h-4 mr-2" />
                View Repository
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleArchiveProject(project.id)}
                disabled={project.status === 'archived'}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteProject(project.id)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {isExpanded && sessions.length > 0 && (
          <div className="ml-8 mt-1 space-y-1">
            {sessions.map((sessionId) => (
              <div
                key={sessionId}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent/30 cursor-pointer text-sm"
                onClick={() => onSessionSelect && onSessionSelect(sessionId)}
              >
                <FileText className="w-3 h-3" />
                <span className="truncate">{sessionId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMetricsCard = () => {
    if (!metrics) return null;

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeProjects} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.averageSessionsPerProject.toFixed(1)} per project
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization Coverage</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.organizationCoverage.toFixed(0)}%</div>
            <Progress value={metrics.organizationCoverage} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unorganized Sessions</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.unorganizedSessions}</div>
            <p className="text-xs text-muted-foreground">
              Need organization
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="flex-1 flex flex-col mt-4">
          <div className="space-y-4 mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={onCreateProject} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Select 
                value={statusFilter} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as ProjectStatus)}
                className="w-[150px]"
              >
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </Select>
              
              <Select 
                value={sortBy} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as 'name' | 'updated' | 'sessions')}
                className="w-[150px]"
              >
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="updated">Sort by Updated</SelectItem>
                <SelectItem value="sessions">Sort by Sessions</SelectItem>
              </Select>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="pr-4">
              {filteredProjects.length > 0 ? (
                filteredProjects.map(renderProjectItem)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No projects found matching your search' : 'No projects yet'}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="metrics" className="mt-4">
          {renderMetricsCard()}
          
          {metrics && metrics.mostActiveProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Most Active Projects</CardTitle>
                <CardDescription>Projects with the most sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.mostActiveProjects.map((item, index) => (
                    <div key={item.project.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{item.project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.sessionCount} sessions
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleProjectClick(item.project.id)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest project and session updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Activity timeline coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};