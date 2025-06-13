import React, { useState, useEffect, useMemo } from 'react';
import type { SessionFilter } from '@/src/services/SessionService';
import { Session, SessionStatus } from '@/src/models/Session';
import { 
  SearchOptions, 
  FilterCriteria, 
  SortOptions, 
  SearchResult,
  SavedFilter,
  SessionTag,
  SessionFolder
} from '@/src/models/SearchFilter';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { TagManager } from './TagManager';
import { FolderManager } from './FolderManager';
import { formatDistanceToNow } from 'date-fns';
interface SessionLibraryProps {
  userId: string;
  projectId?: string;
  onSessionSelect?: (session: Session) => void;
  onSessionCreate?: () => void;
}
export const SessionLibrary: React.FC<SessionLibraryProps> = ({
  // userId,
  // projectId,
  onSessionSelect,
  onSessionCreate
}) => {
  const userId = "default-user";
  const projectId = undefined;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResult<Session> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus[]>([]);
  const [dateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  
  // Enhanced search states
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [, setTags] = useState<SessionTag[]>([]);
  const [, setFolders] = useState<SessionFolder[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Load sessions on mount
  useEffect(() => {
    void loadSessions();
    void loadOrganizationData();
  }, [userId, projectId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      if (isAdvancedMode && searchResult) {
        // Use advanced search results
        setSessions(searchResult.items);
      } else {
        // Use basic search
        const filter: SessionFilter = {
          // userId,
          // projectId,
          status: statusFilter.length > 0 ? statusFilter[0] : undefined,
          search: searchTerm || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          createdAfter: dateRange.from,
          createdBefore: dateRange.to
        };
        const result = await window.electron.invoke('session:search', filter);
        setSessions(result as Session[]);
      }
    } catch (error) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationData = async () => {
    try {
      const [tagsResult, foldersResult] = await Promise.all([
        window.electron.invoke('session:getTags'),
        window.electron.invoke('session:getFolders')
      ]);
      setTags(tagsResult as SessionTag[]);
      setFolders(foldersResult as SessionFolder[]);
    } catch (error) {
// REMOVED: console statement
    }
  };

  const handleAdvancedSearch = async (
    searchOptions: SearchOptions, 
    filterCriteria: FilterCriteria, 
    sortOptions: SortOptions
  ) => {
    setLoading(true);
    try {
      const result = await window.electron.invoke('session:advancedSearch', 
        searchOptions, filterCriteria, sortOptions) as SearchResult<Session>;
      setSearchResult(result);
      setSessions(result.items);
      setIsAdvancedMode(true);
      setShowAdvancedSearch(false);
    } catch (error) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilter = async (filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    try {
      await window.electron.invoke('session:createSavedFilter', filter);
      alert('Filter saved successfully!');
    } catch (error) {
// REMOVED: console statement
      alert('Failed to save filter. Please try again.');
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
// REMOVED: console statement
    }
  };

  const handleToggleFavorite = async (sessionId: string) => {
    try {
      await window.electron.invoke('session:toggleFavorite', sessionId);
      await loadSessions();
    } catch (error) {
// REMOVED: console statement
    }
  };

  // const handleAddTag = async (sessionId: string, tagName: string) => {
  //   try {
  //     await window.electron.invoke('session:addTag', sessionId, tagName);
  //     await loadSessions();
  //   } catch (error) {
  //     console.error('Failed to add tag:', error);
  //   }
  // };

  // const handleRemoveTag = async (sessionId: string, tagName: string) => {
  //   try {
  //     await window.electron.invoke('session:removeTag', sessionId, tagName);
  //     await loadSessions();
  //   } catch (error) {
  //     console.error('Failed to remove tag:', error);
  //   }
  // };

  const handleClearAdvancedSearch = () => {
    setIsAdvancedMode(false);
    setSearchResult(null);
    loadSessions();
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
      {/* Enhanced Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          {/* Search Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Session Library
              </h3>
              {isAdvancedMode && searchResult && (
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    Advanced Search ({searchResult.performanceMetrics?.searchTimeMs}ms)
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleClearAdvancedSearch}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagManager(true)}
              >
                🏷️ Tags
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFolderManager(true)}
              >
                📁 Folders
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedSearch(true)}
              >
                🔍 Advanced Search
              </Button>
            </div>
          </div>

          {/* Basic Search Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search input */}
            <div className="lg:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSessions()}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                           focus:ring-2 focus:ring-primary focus:border-transparent
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
              </div>
            </div>

            {/* Quick filters */}
            <div className="flex gap-2">
              <Button
                variant={showFavoritesOnly ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                ⭐ Favorites
              </Button>
            </div>

            {/* View toggle and actions */}
            <div className="flex gap-2 justify-end">
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
              >
                New Session
              </Button>
            </div>
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
      {/* Results count and facets */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Found {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          {searchResult && searchResult.totalCount > filteredSessions.length && (
            <span> (showing first {filteredSessions.length} of {searchResult.totalCount})</span>
          )}
        </div>
        {searchResult?.facets && (
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>Status:</span>
            {searchResult.facets.status.slice(0, 3).map(facet => (
              <span key={facet.value} className="bg-gray-100 px-2 py-1 rounded">
                {facet.label} ({facet.count})
              </span>
            ))}
          </div>
        )}
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
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                      {session.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(session.id);
                      }}
                      className={`text-lg hover:scale-110 transition-transform ${
                        (session.metadata as any)?.organizationMetadata?.isFavorite 
                          ? 'text-yellow-500' 
                          : 'text-gray-300 hover:text-yellow-400'
                      }`}
                    >
                      ⭐
                    </button>
                  </div>
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

      {/* Modals */}
      <AdvancedSearchPanel
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={handleAdvancedSearch}
        onSaveFilter={handleSaveFilter}
      />

      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        onTagCreated={() => loadOrganizationData()}
        onTagUpdated={() => loadOrganizationData()}
        onTagDeleted={() => loadOrganizationData()}
      />

      <FolderManager
        isOpen={showFolderManager}
        onClose={() => setShowFolderManager(false)}
        onFolderCreated={() => loadOrganizationData()}
        onFolderUpdated={() => loadOrganizationData()}
        onFolderDeleted={() => loadOrganizationData()}
      />
    </div>
  );
};