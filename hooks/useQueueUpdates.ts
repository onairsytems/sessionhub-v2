import { useState, useEffect, useCallback } from 'react';
import { QueueEvent, SessionQueueManager } from '@/src/services/queue/SessionQueueManager';

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

  const connectToUpdates = useCallback(async () => {
    const queueManager = SessionQueueManager.getInstance();
    let isSubscribed = true;

    try {
      setConnected(true);
      setError(null);

      const eventStream = queueManager.streamQueueUpdates();
      
      for await (const event of eventStream) {
        if (!isSubscribed) break;
        
        setLastUpdate(new Date());
        
        if (onEvent) {
          onEvent(event);
        }
      }
    } catch (err) {
      if (isSubscribed) {
        setError(err instanceof Error ? err.message : 'Failed to connect to queue updates');
        setConnected(false);
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [onEvent]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const connect = async () => {
      cleanup = await connectToUpdates();
    };

    connect();

    return () => {
      if (cleanup) cleanup();
    };
  }, [connectToUpdates]);

  return {
    connected,
    lastUpdate,
    error
  };
}