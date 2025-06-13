'use client';

import { useState, useEffect, useCallback } from 'react';
import { QueueEvent, SessionQueueManagerClient } from '@/src/services/queue/SessionQueueManagerClient';

interface UseQueueUpdatesReturn {
  connected: boolean;
  lastUpdate: Date | null;
  error: string | null;
}

export function useQueueUpdates(
  onEvent?: (event: QueueEvent) => void
): UseQueueUpdatesReturn {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectToUpdates = useCallback(() => {
    const queueManager = SessionQueueManagerClient.getInstance();
    
    try {
      setConnected(true);
      setError(null);

      // Listen to queue events
      const handleEvent = (event: QueueEvent) => {
        setLastUpdate(new Date());
        if (onEvent) {
          onEvent(event);
        }
      };

      queueManager.on('queue-event', handleEvent);

      return () => {
        queueManager.off('queue-event', handleEvent);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to queue updates');
      setConnected(false);
      return () => {};
    }
  }, [onEvent]);

  useEffect(() => {
    const cleanup = connectToUpdates();
    return cleanup;
  }, [connectToUpdates]);

  return {
    connected,
    lastUpdate,
    error
  };
}