'use client';

import { useState, useEffect, useMemo } from 'react';
import { Grid3X3, List, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import SessionCard from '@/components/library/SessionCard';
import EmptyState from '@/components/library/EmptyState';
import { Session } from '@/src/models/Session';
import { useRouter } from 'next/navigation';

type ViewMode = 'grid' | 'list';

const ITEMS_PER_PAGE = 24;
const VIEW_MODE_KEY = 'sessionLibrary.viewMode';

export default function SessionLibrary() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Load view preference
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_MODE_KEY);
    if (savedView === 'list' || savedView === 'grid') {
      setViewMode(savedView);
    }
  }, []);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        const mockSessions: Session[] = Array.from({ length: 50 }, (_, i) => ({
          id: `session-${i + 1}`,
          name: `Session ${i + 1}`,
          description: `Description for session ${i + 1}`,
          status: ['pending', 'planning', 'executing', 'completed', 'failed'][
            Math.floor(Math.random() * 5)
          ] as Session['status'],
          userId: 'user-1',
          projectId: 'project-1',
          request: {
            id: `request-${i + 1}`,
            sessionId: `session-${i + 1}`,
            userId: 'user-1',
            content: `Request content for session ${i + 1}`,
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            context: {}
          },
          instructions: undefined,
          result: undefined,
          error: undefined,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            progress: {
              completedSteps: Math.floor(Math.random() * 10),
              totalSteps: 10,
              percentage: Math.random() * 100,
              currentStep: `Step ${Math.floor(Math.random() * 10) + 1}`
            },
            planningDuration: Math.floor(Math.random() * 300000),
            executionDuration: Math.floor(Math.random() * 600000),
            totalDuration: Math.floor(Math.random() * 900000),
            tags: ['tag1', 'tag2'],
          },
        }));
        setSessions(mockSessions);
      } catch (error) {
        // Handle error appropriately in production
      } finally {
        setLoading(false);
      }
    };

    void loadSessions();
  }, []);

  // Filter sessions based on search
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (session) =>
        session.name.toLowerCase().includes(query) ||
        session.description?.toLowerCase().includes(query) ||
        session.status.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // Paginate sessions
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredSessions.slice(start, end);
  }, [filteredSessions, currentPage]);

  const totalPages = Math.ceil(filteredSessions.length / ITEMS_PER_PAGE);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleNewSession = () => {
    router.push('/sessions/new');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Session Library</h1>
          <Button onClick={handleNewSession}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleViewModeChange('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleViewModeChange('list')}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          message={searchQuery ? 'No sessions found matching your search.' : 'No sessions yet.'}
          action={
            !searchQuery && (
              <Button onClick={handleNewSession}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Session
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Session Grid/List */}
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-4'
            }
          >
            {paginatedSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                viewMode={viewMode}
                onClick={() => handleSessionClick(session.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    if (page === currentPage - 2 || page === currentPage + 2) return '...';
                    return false;
                  })
                  .map((page, index) => {
                    if (typeof page === 'string' && page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[2.5rem]"
                      >
                        {page}
                      </Button>
                    );
                  })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}