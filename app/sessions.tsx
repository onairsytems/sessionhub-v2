'use client';

import React, { useState, useEffect } from 'react';
import { SessionLibrary } from '@/renderer/components/sessions/SessionLibrary';
import { SessionWorkflowVisualization } from '@/renderer/components/sessions/SessionWorkflowVisualization';
import { SessionAnalyticsDashboard } from '@/renderer/components/sessions/SessionAnalyticsDashboard';
import { Session } from '@/src/models/Session';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function SessionsPage() {
  const [view, setView] = useState<'library' | 'analytics' | 'templates'>('library');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [userId] = useState<string>('default-user'); // TODO: Get from auth
  const [projectId] = useState<string | undefined>();

  useEffect(() => {
    // Load current project if available
    void loadCurrentProject();
  }, []);

  const loadCurrentProject = async () => {
    try {
      // TODO: Get current project from context
      // For now, we'll leave it undefined to show all sessions
    } catch (error) {
      // Error loading current project - handle silently
    }
  };

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
  };

  const handleSessionCreate = async () => {
    // TODO: Open session creation dialog
  };

  const handleBackToList = () => {
    setSelectedSession(null);
  };

  if (selectedSession) {
    // Show session detail view
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
          >
            ← Back to Sessions
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {selectedSession.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedSession.description}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-medium capitalize">{selectedSession.status}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium">
                  {new Date(selectedSession.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Duration</p>
                <p className="font-medium">
                  {selectedSession.metadata.totalDuration
                    ? `${Math.round(selectedSession.metadata.totalDuration / 1000 / 60)}m`
                    : 'In progress'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Project</p>
                <p className="font-medium">{selectedSession.projectId || 'None'}</p>
              </div>
            </div>
          </Card>

          <SessionWorkflowVisualization
            session={selectedSession}
            onPhaseClick={(_phase) => {
              // TODO: Show phase details
            }}
          />

          {/* Session details tabs */}
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Session Details</h3>
              
              {/* Request */}
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Original Request
                </h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedSession.request.content}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              {selectedSession.instructions && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Generated Instructions
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                    <p className="text-sm">
                      {selectedSession.instructions.requirements?.length || 0} requirements defined
                    </p>
                  </div>
                </div>
              )}

              {/* Result */}
              {selectedSession.result && (
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Execution Result
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-4">
                    <p className="text-sm">
                      {selectedSession.result.status === 'success'
                        ? 'Successfully completed'
                        : selectedSession.result.status === 'partial'
                        ? 'Partially completed'
                        : 'Failed to complete'}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {selectedSession.error && (
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
                    Error Details
                  </h4>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded p-4">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {selectedSession.error.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Sessions
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your development sessions, view analytics, and create from templates
        </p>
      </div>

      {/* View tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setView('library')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              view === 'library'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Session Library
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              view === 'analytics'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setView('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              view === 'templates'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates
          </button>
        </nav>
      </div>

      {/* Content */}
      {view === 'library' && (
        <SessionLibrary
          userId={userId}
          projectId={projectId}
          onSessionSelect={handleSessionSelect}
          onSessionCreate={() => void handleSessionCreate()}
        />
      )}

      {view === 'analytics' && (
        <SessionAnalyticsDashboard
          userId={userId}
          projectId={projectId}
        />
      )}

      {view === 'templates' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Session Templates</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Session templates feature coming soon. You'll be able to save successful sessions as templates
            and reuse them for similar tasks.
          </p>
        </Card>
      )}
    </div>
  );
}