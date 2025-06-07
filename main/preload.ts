/**
 * Electron Preload Script
 * Provides secure bridge between main process and renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface SessionHubAPI {
  // System operations
  getSystemHealth: () => Promise<any>;
  getSelfDevelopmentStatus: () => Promise<any>;
  getProductionMetrics: () => Promise<any>;
  triggerTestIssue: () => Promise<any>;
  
  // Session management
  createNewSession: () => void;
  
  // API Configuration
  checkApiKey: () => Promise<boolean>;
  validateApiKey: (apiKey: string) => Promise<boolean>;
  saveApiKey: (apiKey: string) => Promise<void>;
  
  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => Promise<string>;
  
  // GitHub integration
  selectGitHubRepo: () => Promise<any>;
  analyzeRepository: (sessionId: string, repoInfo: any) => Promise<string>;
  
  // Supabase operations
  configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => Promise<any>;
  checkSupabaseConnection: () => Promise<any>;
  getSupabaseConfig: () => Promise<any>;
  initSupabase: () => Promise<any>;
  createProject: (project: any) => Promise<any>;
  getProjects: () => Promise<any>;
  createSession: (session: any) => Promise<any>;
  updateSessionStatus: (sessionId: string, status: string) => Promise<any>;
  getActiveSessions: () => Promise<any>;
  getSessionStats: (sessionId?: string) => Promise<any>;
  
  // Event listeners
  onNewSession: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('sessionhub', {
  // System health and monitoring
  getSystemHealth: () => ipcRenderer.invoke('get-system-health'),
  getSelfDevelopmentStatus: () => ipcRenderer.invoke('get-self-development-status'),
  getProductionMetrics: () => ipcRenderer.invoke('get-production-metrics'),
  triggerTestIssue: () => ipcRenderer.invoke('trigger-test-issue'),
  
  // Session management
  createNewSession: () => ipcRenderer.send('new-session'),
  
  // API Configuration
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
  validateApiKey: (apiKey: string) => ipcRenderer.invoke('validate-api-key', apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  
  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => 
    ipcRenderer.invoke('send-chat-message', sessionId, message),
  
  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke('select-github-repo'),
  analyzeRepository: (sessionId: string, repoInfo: any) => 
    ipcRenderer.invoke('analyze-repository', sessionId, repoInfo),
  
  // Supabase operations
  configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => 
    ipcRenderer.invoke('configure-supabase', config),
  checkSupabaseConnection: () => ipcRenderer.invoke('check-supabase-connection'),
  getSupabaseConfig: () => ipcRenderer.invoke('get-supabase-config'),
  initSupabase: () => ipcRenderer.invoke('init-supabase'),
  createProject: (project: any) => ipcRenderer.invoke('create-project', project),
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createSession: (session: any) => ipcRenderer.invoke('create-session', session),
  updateSessionStatus: (sessionId: string, status: string) => 
    ipcRenderer.invoke('update-session-status', sessionId, status),
  getActiveSessions: () => ipcRenderer.invoke('get-active-sessions'),
  getSessionStats: (sessionId?: string) => ipcRenderer.invoke('get-session-stats', sessionId),
  
  // Event listeners
  onNewSession: (callback: () => void) => {
    ipcRenderer.on('new-session', callback);
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as SessionHubAPI);

// Also expose electronAPI for compatibility
contextBridge.exposeInMainWorld('electronAPI', {
  // API Configuration
  checkApiKey: () => ipcRenderer.invoke('check-api-key'),
  validateApiKey: (apiKey: string) => ipcRenderer.invoke('validate-api-key', apiKey),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('save-api-key', apiKey),
  
  // Chat functionality
  sendChatMessage: (sessionId: string, message: string) => 
    ipcRenderer.invoke('send-chat-message', sessionId, message),
  
  // GitHub integration
  selectGitHubRepo: () => ipcRenderer.invoke('select-github-repo'),
  analyzeRepository: (sessionId: string, repoInfo: any) => 
    ipcRenderer.invoke('analyze-repository', sessionId, repoInfo),
    
  // Supabase operations (also available via electronAPI for compatibility)
  configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => 
    ipcRenderer.invoke('configure-supabase', config),
  checkSupabaseConnection: () => ipcRenderer.invoke('check-supabase-connection'),
  getSupabaseConfig: () => ipcRenderer.invoke('get-supabase-config'),
  initSupabase: () => ipcRenderer.invoke('init-supabase'),
  createProject: (project: any) => ipcRenderer.invoke('create-project', project),
  getProjects: () => ipcRenderer.invoke('get-projects'),
});

// Also expose to window for TypeScript
declare global {
  interface Window {
    sessionhub: SessionHubAPI;
    electronAPI: {
      checkApiKey: () => Promise<boolean>;
      validateApiKey: (apiKey: string) => Promise<boolean>;
      saveApiKey: (apiKey: string) => Promise<void>;
      sendChatMessage: (sessionId: string, message: string) => Promise<string>;
      selectGitHubRepo: () => Promise<any>;
      analyzeRepository: (sessionId: string, repoInfo: any) => Promise<string>;
      configureSupabase: (config: { url: string; anonKey: string; serviceKey?: string }) => Promise<any>;
      checkSupabaseConnection: () => Promise<any>;
      getSupabaseConfig: () => Promise<any>;
      initSupabase: () => Promise<any>;
      createProject: (project: any) => Promise<any>;
      getProjects: () => Promise<any>;
    };
  }
}