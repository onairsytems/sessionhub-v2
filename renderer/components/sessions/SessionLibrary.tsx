import React, { useState, useEffect, useMemo } from 'react';
import { SessionFilter } from '@/src/services/SessionService';
import { Session, SessionStatus } from '@/src/models/Session';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDistanceToNow } from 'date-fns';
interface SessionLibraryProps {
  userId: string;
  projectId?: string;
  onSessionSelect?: (session: Session) => void;
  onSessionCreate?: () => void;
}
export const SessionLibrary: React.FC<SessionLibraryProps> = ({
  userId,
  projectId,
  onSessionSelect,
  onSessionCreate
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus[]>([]);
  const [dateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  // Load sessions on mount
  useEffect(() => {
    void loadSessions();
  }, [userId, projectId]);
  const loadSessions = async () => {
    setLoading(true);
    try {
      const filter: SessionFilter = {
        userId,
        projectId,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        searchTerm: searchTerm || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        dateFrom: dateRange.from,
        dateTo: dateRange.to
      };
      const result = await window.electron.invoke('session:search', filter);
      setSessions(result as Session[]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  // Filter sessions based on search criteria
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !session.name.toLowerCase().includes(term) &&
          !session.description.toLowerCase().includes(term) &&
          !session.request.content.toLowerCase().includes(term)
        ) {
          return false;
        }
      }
      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(session.status)) {
        return false;
      }
      // Tag filter
      if (selectedTags.length > 0) {
        const sessionTags = session.metadata.tags || [];
        if (!selectedTags.some(tag => sessionTags.includes(tag))) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, searchTerm, statusFilter, selectedTags]);
  // Extract all unique tags from sessions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    sessions.forEach(session => {
      session.metadata.tags?.forEach((tag: string) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [sessions]);
  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      case 'planning': return 'text-blue-600 bg-blue-50';
      case 'executing': return 'text-purple-600 bg-purple-50';
      case 'cancelled': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  const getStatusIcon = (status: SessionStatus) => {
    switch (status) {
      case 'completed': return '✓';
      case 'failed': return '✗';
      case 'pending': return '⏳';
      case 'planning': return '🧠';
      case 'executing': return '⚡';
      case 'cancelled': return '⚠️';
      default: return '•';
    }
  };
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await window.electron.invoke('session:delete', sessionId);
      await loadSessions();
    } catch (error) {
    }
  };
  const handleExportSession = async (sessionId: string) => {
    try {
      const exportData = await window.electron.invoke('session:export', sessionId) as string;
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search input */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadSessions()}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       focus:ring-2 focus:ring-primary focus:border-transparent
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          {/* View toggle */}
          <div className="flex gap-2">
            <Button
              variant={view === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
            >
              Grid
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              List
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSessionCreate?.()}
              className="ml-auto"
            >
              New Session
            </Button>
          </div>
        </div>
        {/* Status filters */}
        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by status:
          </div>
          <div className="flex flex-wrap gap-2">
            {(['pending', 'planning', 'executing', 'completed', 'failed', 'cancelled'] as SessionStatus[])
              .map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(prev =>
                      prev.includes(status)
                        ? prev.filter(s => s !== status)
                        : [...prev, status]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter.includes(status)
                      ? getStatusColor(status)
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {getStatusIcon(status)} {status}
                </button>
              ))}
          </div>
        </div>
        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by tags:
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadSessions()}
          >
            Search
          </Button>
        </div>
      </div>
      {/* Results count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Found {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
      </div>
      {/* Session list/grid */}
      {filteredSessions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No sessions found matching your criteria.
          </p>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(session => (
            <Card
              key={session.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onSessionSelect && onSessionSelect(session)}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                    {session.name}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                    {getStatusIcon(session.status)} {session.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {session.description}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                  <span>{formatDistanceToNow(new Date(session.createdAt))} ago</span>
                  {session.metadata.totalDuration && (
                    <span>{Math.round(session.metadata.totalDuration / 1000 / 60)}m</span>
                  )}
                </div>
                {session.metadata.tags && session.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {session.metadata.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {session.metadata.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{session.metadata.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportSession(session.id)}
                  >
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map(session => (
            <Card
              key={session.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSessionSelect && onSessionSelect(session)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {session.name}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {getStatusIcon(session.status)} {session.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {session.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{formatDistanceToNow(new Date(session.createdAt))} ago</span>
                    {session.metadata.totalDuration && (
                      <span>{Math.round(session.metadata.totalDuration / 1000 / 60)}m</span>
                    )}
                    {session.metadata.tags && session.metadata.tags.length > 0 && (
                      <span>{session.metadata.tags.length} tags</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExportSession(session.id)}
                  >
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};