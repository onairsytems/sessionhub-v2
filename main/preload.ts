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
  
  // Event listeners
  onNewSession: (callback: () => void) => {
    ipcRenderer.on('new-session', callback);
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as SessionHubAPI);

// Also expose to window for TypeScript
declare global {
  interface Window {
    sessionhub: SessionHubAPI;
  }
}