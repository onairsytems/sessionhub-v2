/**
 * Hook for AI Enhancement features
 * Session 2.8 Implementation
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  AutocompleteSuggestion,
  AutocompleteContext,
  LearningStatus,
  PatternSearchCriteria,
  CodePattern
} from '../../src/services/ai';

// AI API Interface
interface AIApi {
  initialize: () => Promise<LearningStatus>;
  learnFromCode: (filePath: string, content: string) => Promise<{ success: boolean }>;
  getAutocomplete: (context: AutocompleteContext) => Promise<AutocompleteSuggestion[]>;
  recordAutocomplete: (suggestion: AutocompleteSuggestion, accepted: boolean) => Promise<{ success: boolean }>;
  analyzeProject: (projectPath: string) => Promise<{
    template: unknown;
    knowledge: unknown;
    recommendations: string[];
  }>;
  startSession: (sessionId: string, objectives: string[]) => Promise<{ success: boolean }>;
  updateSession: (sessionId: string, updates: unknown) => Promise<{ success: boolean }>;
  completeSession: (sessionId: string, success: boolean) => Promise<{ success: boolean }>;
  searchPatterns: (criteria: PatternSearchCriteria) => Promise<CodePattern[]>;
  addPattern: (pattern: Omit<CodePattern, 'id' | 'metadata'>) => Promise<CodePattern>;
  getInsights: (projectPath?: string) => Promise<any[]>;
  transferLearning: (fromProject: string, toProject: string) => Promise<unknown>;
  getStatus: () => Promise<LearningStatus>;
  getMetricsSummary: (days: number) => Promise<unknown>;
  generateInsights: () => Promise<unknown>;
  exportData: () => Promise<string>;
  importData: (data: string) => Promise<{ success: boolean }>;
  clearData: () => Promise<{ success: boolean }>;
}

// Window API Interface
interface WindowWithAI {
  api?: {
    ai?: AIApi;
  };
}

export function useAIEnhancement() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Type guard for AI API
  const hasAIAPI = (window: Window): window is Window & WindowWithAI => {
    return !!(window as WindowWithAI).api?.ai;
  };
  
  // Get AI API safely
  const getAIAPI = (): AIApi | null => {
    if (hasAIAPI(window)) {
      return (window as any).api?.ai || null;
    }
    return null;
  };
  
  // Initialize AI on mount
  useEffect(() => {
    void initializeAI();
  }, []);
  
  const initializeAI = async () => {
    try {
      setLoading(true);
      setError(null);
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      const aiStatus = await aiAPI.initialize();
      setStatus(aiStatus);
      setIsInitialized(true);
    } catch (err) {
      setError('Failed to initialize AI enhancement');
    } finally {
      setLoading(false);
    }
  };
  // Learn from code
  const learnFromCode = useCallback(async (filePath: string, content: string) => {
    if (!isInitialized) {
      await initializeAI();
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      await aiAPI.learnFromCode(filePath, content);
      // Refresh status
      const newStatus = await aiAPI.getStatus();
      setStatus(newStatus);
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  // Get autocomplete suggestions
  const getAutocompleteSuggestions = useCallback(async (
    context: AutocompleteContext
  ): Promise<AutocompleteSuggestion[]> => {
    if (!isInitialized) {
      return [];
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        return [];
      }
      return await aiAPI.getAutocomplete(context) || [];
    } catch (err) {
      return [];
    }
  }, [isInitialized]);
  // Record autocomplete usage
  const recordAutocompleteUsage = useCallback(async (
    suggestion: AutocompleteSuggestion,
    accepted: boolean
  ) => {
    if (!isInitialized) return;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return;
      await aiAPI.recordAutocomplete(suggestion, accepted);
    } catch (err) {
      // Silent error handling
    }
  }, [isInitialized]);
  // Analyze project
  const analyzeProject = useCallback(async (projectPath: string) => {
    if (!isInitialized) {
      await initializeAI();
    }
    try {
      setLoading(true);
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      const analysis = await aiAPI.analyzeProject(projectPath);
      return analysis;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isInitialized]);
  // Session tracking
  const startSession = useCallback(async (sessionId: string, objectives: string[]) => {
    if (!isInitialized) return;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return;
      await aiAPI.startSession(sessionId, objectives);
    } catch (err) {
      // Silent error handling
    }
  }, [isInitialized]);
  
  const updateSession = useCallback(async (sessionId: string, updates: unknown) => {
    if (!isInitialized) return;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return;
      await aiAPI.updateSession(sessionId, updates);
    } catch (err) {
      // Silent error handling
    }
  }, [isInitialized]);
  
  const completeSession = useCallback(async (sessionId: string, success: boolean) => {
    if (!isInitialized) return;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return;
      await aiAPI.completeSession(sessionId, success);
      // Refresh status
      const newStatus = await aiAPI.getStatus();
      setStatus(newStatus);
    } catch (err) {
      // Silent error handling
    }
  }, [isInitialized]);
  // Pattern library
  const searchPatterns = useCallback(async (
    criteria: PatternSearchCriteria
  ): Promise<CodePattern[]> => {
    if (!isInitialized) return [];
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return [];
      return await aiAPI.searchPatterns(criteria) || [];
    } catch (err) {
      return [];
    }
  }, [isInitialized]);
  
  const addPattern = useCallback(async (pattern: Omit<CodePattern, 'id' | 'metadata'>) => {
    if (!isInitialized) {
      throw new Error('AI not initialized');
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      const newPattern = await aiAPI.addPattern(pattern);
      // Refresh status
      const newStatus = await aiAPI.getStatus();
      setStatus(newStatus);
      return newPattern;
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  // Get insights
  const getInsights = useCallback(async (projectPath?: string) => {
    if (!isInitialized) return [];
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return [];
      return await aiAPI.getInsights(projectPath) || [];
    } catch (err) {
      return [];
    }
  }, [isInitialized]);
  // Transfer learning
  const transferLearning = useCallback(async (fromProject: string, toProject: string) => {
    if (!isInitialized) {
      throw new Error('AI not initialized');
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      return await aiAPI.transferLearning(fromProject, toProject);
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  // Metrics and reports
  const getMetricsSummary = useCallback(async (days: number = 30) => {
    if (!isInitialized) return null;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return null;
      return await aiAPI.getMetricsSummary(days);
    } catch (err) {
      return null;
    }
  }, [isInitialized]);
  
  const generateInsightReport = useCallback(async () => {
    if (!isInitialized) return null;
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) return null;
      return await aiAPI.generateInsights();
    } catch (err) {
      return null;
    }
  }, [isInitialized]);
  // Data management
  const exportData = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('AI not initialized');
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      return await aiAPI.exportData();
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  
  const importData = useCallback(async (data: string) => {
    if (!isInitialized) {
      throw new Error('AI not initialized');
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      await aiAPI.importData(data);
      // Refresh status
      const newStatus = await aiAPI.getStatus();
      setStatus(newStatus);
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  
  const clearData = useCallback(async () => {
    if (!isInitialized) {
      throw new Error('AI not initialized');
    }
    try {
      const aiAPI = getAIAPI();
      if (!aiAPI) {
        throw new Error('AI API not available');
      }
      await aiAPI.clearData();
      // Refresh status
      const newStatus = await aiAPI.getStatus();
      setStatus(newStatus);
    } catch (err) {
      throw err;
    }
  }, [isInitialized]);
  return {
    // State
    isInitialized,
    status,
    loading,
    error,
    // Methods
    initializeAI,
    learnFromCode,
    getAutocompleteSuggestions,
    recordAutocompleteUsage,
    analyzeProject,
    startSession,
    updateSession,
    completeSession,
    searchPatterns,
    addPattern,
    getInsights,
    transferLearning,
    getMetricsSummary,
    generateInsightReport,
    exportData,
    importData,
    clearData
  };
}