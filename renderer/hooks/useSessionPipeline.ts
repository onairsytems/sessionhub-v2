import { useState, useCallback, useEffect } from 'react';

interface SessionDocument {
  source: { type: 'file' | 'url' | 'google-docs'; path: string };
  metadata?: any;
  analysis?: any;
  importResult?: any;
}

interface SessionExecutionRequest {
  userId: string;
  projectId: string;
  description: string;
  documents?: SessionDocument[];
  context?: Record<string, any>;
}

interface SessionProgress {
  phase: string;
  step: string;
  progress: number;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface Session {
  id: string;
  name: string;
  status: string;
  documents?: SessionDocument[];
  documentAnalysis?: any;
  progress?: SessionProgress[];
}

export function useSessionPipeline() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<SessionProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Listen for progress updates
  useEffect(() => {
    const handleProgress = (data: { sessionId: string; progress: SessionProgress }) => {
      setProgress(prev => [...prev, data.progress]);
    };

    window.electronAPI.onSessionProgress(handleProgress);

    return () => {
      window.electronAPI.removeSessionProgressListener(handleProgress);
    };
  }, []);

  const executeSession = useCallback(async (request: SessionExecutionRequest) => {
    setIsExecuting(true);
    setError(null);
    setProgress([]);

    try {
      const result = await window.electronAPI.executeSession(request);
      
      if (result.success) {
        setCurrentSession(result.session);
        return result.session;
      } else {
        setError(result.error || 'Session execution failed');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const importDocuments = useCallback(async (filePaths: string[]) => {
    try {
      const result = await window.electronAPI.importDocuments(filePaths);
      
      if (result.success) {
        return result.results;
      } else {
        setError(result.error || 'Document import failed');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const importFromGoogleDocs = useCallback(async (docUrl: string) => {
    try {
      const result = await window.electronAPI.importGoogleDocs(docUrl);
      
      if (result.success) {
        return result.result;
      } else {
        setError(result.error || 'Google Docs import failed');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const analyzeDocument = useCallback(async (documentMetadata: any) => {
    try {
      const result = await window.electronAPI.analyzeDocument(documentMetadata);
      
      if (result.success) {
        return result.analysis;
      } else {
        setError(result.error || 'Document analysis failed');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const analyzeDocumentSet = useCallback(async (documents: any[]) => {
    try {
      const result = await window.electronAPI.analyzeDocumentSet(documents);
      
      if (result.success) {
        return result.analysis;
      } else {
        setError(result.error || 'Document set analysis failed');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const getSession = useCallback(async (sessionId: string) => {
    try {
      const result = await window.electronAPI.getSession(sessionId);
      
      if (result.success) {
        return result.session;
      } else {
        setError(result.error || 'Failed to get session');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const getUserSessions = useCallback(async (userId: string) => {
    try {
      const result = await window.electronAPI.getUserSessions(userId);
      
      if (result.success) {
        return result.sessions;
      } else {
        setError(result.error || 'Failed to get user sessions');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const getMetrics = useCallback(async () => {
    try {
      const result = await window.electronAPI.getSessionMetrics();
      
      if (result.success) {
        return result.metrics;
      } else {
        setError(result.error || 'Failed to get metrics');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const selectDocuments = useCallback(async () => {
    try {
      const result = await window.electronAPI.selectDocuments();
      
      if (result.success && result.filePaths.length > 0) {
        return result.filePaths;
      } else {
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const getFileInfo = useCallback(async (filePath: string) => {
    try {
      const result = await window.electronAPI.getFileInfo(filePath);
      
      if (result.success) {
        return result.fileInfo;
      } else {
        setError(result.error || 'Failed to get file info');
        return null;
      }
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  return {
    // State
    isExecuting,
    currentSession,
    progress,
    error,
    
    // Actions
    executeSession,
    importDocuments,
    importFromGoogleDocs,
    analyzeDocument,
    analyzeDocumentSet,
    getSession,
    getUserSessions,
    getMetrics,
    selectDocuments,
    getFileInfo,
    
    // Utilities
    clearError: () => setError(null),
    clearProgress: () => setProgress([])
  };
}