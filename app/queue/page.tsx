'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { QueueState, SessionQueueManagerClient } from '@/src/services/queue/SessionQueueManagerClient';
import { SessionPriority } from '@/src/models/Session';
import { QueueControls } from '@/components/queue/QueueControls';
import { QueueMetricsPanel } from '@/components/queue/QueueMetricsPanel';
import { QueuedSessionItem } from '@/components/queue/QueuedSessionItem';
import { useQueueUpdates } from '@/hooks/useQueueUpdates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, AlertCircle } from 'lucide-react';

export default function QueueManagementPage() {
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');

  const queueManager = SessionQueueManagerClient.getInstance();
  const { connected, lastUpdate } = useQueueUpdates((event) => {
    if (event.type === 'state-changed' || event.type === 'metrics-updated') {
      void loadQueueState();
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const loadQueueState = useCallback(async () => {
    try {
      const state = queueManager.getQueueState();
      setQueueState(state);
      setError(null);
    } catch (err) {
      setError('Failed to load queue state');
    } finally {
      setIsLoading(false);
    }
  }, [queueManager]);

  useEffect(() => {
    void loadQueueState();
  }, [loadQueueState]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || !queueState) {
      return;
    }

    const oldIndex = queueState.sessions.findIndex(s => s.id === active.id);
    const newIndex = queueState.sessions.findIndex(s => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSessions = arrayMove(queueState.sessions, oldIndex, newIndex);
      setQueueState({ ...queueState, sessions: newSessions });
      
      try {
        await queueManager.moveSession(active.id as string, newIndex + 1);
      } catch (err) {
        void loadQueueState(); // Reload to sync state
      }
    }
  };

  const handlePriorityChange = useCallback(async (sessionId: string, priority: SessionPriority) => {
    try {
      await queueManager.updatePriority(sessionId, priority);
    } catch (err) {
      // Priority update failed, state will sync on next update
    }
  }, [queueManager]);

  const handleSelectSession = (sessionId: string, selected: boolean) => {
    const newSelection = new Set(selectedSessions);
    if (selected) {
      newSelection.add(sessionId);
    } else {
      newSelection.delete(sessionId);
    }
    setSelectedSessions(newSelection);
  };

  const handleSelectAll = () => {
    if (!queueState) return;
    
    if (selectedSessions.size === queueState.sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(queueState.sessions.map(s => s.id)));
    }
  };

  const handleBulkCancel = async () => {
    if (selectedSessions.size === 0) return;
    
    try {
      await queueManager.cancelMultipleSessions(Array.from(selectedSessions));
      setSelectedSessions(new Set());
    } catch (err) {
      // Cancel failed, state will sync on next update
    }
  };

  const pendingSessions = queueState?.sessions.filter(s => s.status === 'pending') || [];
  const activeSessions = queueState?.sessions.filter(s => s.status === 'executing') || [];
  const pausedSessions = queueState?.sessions.filter(s => s.status === 'paused') || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Session Queue Management</h1>
          <p className="text-muted-foreground">
            Manage and monitor session execution queue in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="default" className="bg-green-500">
              Live Updates
            </Badge>
          ) : (
            <Badge variant="secondary">
              Disconnected
            </Badge>
          )}
          {lastUpdate && (
            <span className="text-sm text-muted-foreground">
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {queueState && (
        <>
          <QueueControls 
            isPaused={queueState.isPaused}
            selectedCount={selectedSessions.size}
            totalCount={queueState.sessions.length}
            onPause={() => { void queueManager.pauseQueue(); }}
            onResume={() => { void queueManager.resumeQueue(); }}
            onSelectAll={handleSelectAll}
            onCancelSelected={() => { void handleBulkCancel(); }}
          />

          <QueueMetricsPanel metrics={queueState.metrics} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending ({pendingSessions.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({activeSessions.length})
              </TabsTrigger>
              <TabsTrigger value="paused">
                Paused ({pausedSessions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Sessions</CardTitle>
                  <CardDescription>
                    Sessions waiting to be processed. Drag to reorder.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingSessions.length === 0 ? (
                    <Alert>
                      <InfoIcon className="h-4 w-4" />
                      <AlertDescription>
                        No pending sessions in the queue.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragEnd={(event) => { void handleDragEnd(event); }}
                    >
                      <SortableContext
                        items={pendingSessions.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ScrollArea className="h-[500px] pr-4">
                          <div className="space-y-2">
                            {pendingSessions.map((session) => (
                              <QueuedSessionItem
                                key={session.id}
                                session={session}
                                isSelected={selectedSessions.has(session.id)}
                                onSelect={(selected) => handleSelectSession(session.id, selected)}
                                onPriorityChange={(priority) => { void handlePriorityChange(session.id, priority); }}
                                onCancel={() => void queueManager.cancelSession(session.id)}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      </SortableContext>
                    </DndContext>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="active" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Sessions currently being processed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeSessions.length === 0 ? (
                    <Alert>
                      <InfoIcon className="h-4 w-4" />
                      <AlertDescription>
                        No active sessions at the moment.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-2">
                        {activeSessions.map((session) => (
                          <QueuedSessionItem
                            key={session.id}
                            session={session}
                            isSelected={false}
                            onSelect={() => {}}
                            onPriorityChange={() => {}}
                            onCancel={() => void queueManager.cancelSession(session.id)}
                            disableDrag
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paused" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Paused Sessions</CardTitle>
                  <CardDescription>
                    Sessions that have been temporarily paused.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pausedSessions.length === 0 ? (
                    <Alert>
                      <InfoIcon className="h-4 w-4" />
                      <AlertDescription>
                        No paused sessions in the queue.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-2">
                        {pausedSessions.map((session) => (
                          <QueuedSessionItem
                            key={session.id}
                            session={session}
                            isSelected={selectedSessions.has(session.id)}
                            onSelect={(selected) => handleSelectSession(session.id, selected)}
                            onPriorityChange={(priority) => { void handlePriorityChange(session.id, priority); }}
                            onCancel={() => void queueManager.cancelSession(session.id)}
                            disableDrag
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}