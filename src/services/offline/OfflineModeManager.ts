/**
 * Offline Mode Manager
 * Central service for managing offline state and coordinating offline functionality
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { ConnectionMonitor, ConnectionHealth } from '../monitoring/ConnectionMonitor';

export interface OfflineStatus {
  isOnline: boolean;
  mode: 'online' | 'offline' | 'syncing';
  lastOnline?: Date;
  pendingOperations: number;
  syncProgress?: {
    current: number;
    total: number;
    percentage: number;
  };
  networkType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface OfflineCapabilities {
  canCreateSessions: boolean;
  canEditSessions: boolean;
  canViewHistory: boolean;
  canAccessPatterns: boolean;
  canRunCode: boolean;
}

export class OfflineModeManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly connectionMonitor: ConnectionMonitor;
  private isOnline: boolean = true;
  private lastOnline?: Date;
  private syncInProgress: boolean = false;
  private pendingOperations: number = 0;
  private networkCheckInterval?: NodeJS.Timeout;
  private readonly NETWORK_CHECK_INTERVAL = 5000; // 5 seconds
  private connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';

  constructor(connectionMonitor: ConnectionMonitor) {
    super();
    this.logger = new Logger('OfflineModeManager');
    this.connectionMonitor = connectionMonitor;
    this.initialize();
  }

  private initialize(): void {
    // Monitor connection status changes
    this.connectionMonitor.on('healthUpdate', (health: ConnectionHealth) => {
      this.updateOnlineStatus(health);
    });

    // Start network monitoring
    this.startNetworkMonitoring();

    // Monitor browser online/offline events if available
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnlineEvent());
      window.addEventListener('offline', () => this.handleOfflineEvent());
    }

    // Check initial status
    const health = this.connectionMonitor.getHealth();
    this.updateOnlineStatus(health);
  }

  private startNetworkMonitoring(): void {
    // Regular network quality checks
    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkQuality();
    }, this.NETWORK_CHECK_INTERVAL);

    // Initial check
    this.checkNetworkQuality();
  }

  private async checkNetworkQuality(): Promise<void> {
    try {
      // Ping test to measure latency
      const startTime = Date.now();
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = Date.now() - startTime;

      // Update connection quality based on latency
      if (latency < 100) {
        this.connectionQuality = 'excellent';
      } else if (latency < 300) {
        this.connectionQuality = 'good';
      } else if (latency < 1000) {
        this.connectionQuality = 'fair';
      } else {
        this.connectionQuality = 'poor';
      }

      if (!response.ok && this.isOnline) {
        this.handleOfflineEvent();
      }
    } catch (error) {
      // Network request failed - likely offline
      if (this.isOnline) {
        this.handleOfflineEvent();
      }
    }
  }

  private updateOnlineStatus(health: ConnectionHealth): void {
    const wasOnline = this.isOnline;
    this.isOnline = health.overall !== 'offline';

    if (wasOnline !== this.isOnline) {
      if (this.isOnline) {
        this.handleOnlineEvent();
      } else {
        this.handleOfflineEvent();
      }
    }

    // Update connection quality based on service health
    if (health.overall === 'healthy') {
      this.connectionQuality = 'excellent';
    } else if (health.overall === 'degraded') {
      this.connectionQuality = 'fair';
    }
  }

  private handleOnlineEvent(): void {
    this.logger.info('Network connection restored');
    this.isOnline = true;
    this.lastOnline = new Date();
    
    this.emit('online');
    this.emit('statusChanged', this.getStatus());

    // Trigger sync if there are pending operations
    if (this.pendingOperations > 0) {
      this.emit('syncRequired');
    }
  }

  private handleOfflineEvent(): void {
    this.logger.info('Network connection lost');
    this.isOnline = false;
    
    this.emit('offline');
    this.emit('statusChanged', this.getStatus());
  }

  /**
   * Get current offline status
   */
  getStatus(): OfflineStatus {
    let mode: 'online' | 'offline' | 'syncing';
    if (this.syncInProgress) {
      mode = 'syncing';
    } else if (this.isOnline) {
      mode = 'online';
    } else {
      mode = 'offline';
    }

    return {
      isOnline: this.isOnline,
      mode,
      lastOnline: this.lastOnline,
      pendingOperations: this.pendingOperations,
      networkType: this.detectNetworkType(),
      connectionQuality: this.connectionQuality
    };
  }

  /**
   * Get offline capabilities based on current state
   */
  getCapabilities(): OfflineCapabilities {
    return {
      canCreateSessions: true, // Always available offline
      canEditSessions: true,   // Always available offline
      canViewHistory: true,    // Local cache available
      canAccessPatterns: true, // Local patterns cached
      canRunCode: this.isOnline // Requires API connection
    };
  }

  /**
   * Update pending operations count
   */
  updatePendingOperations(count: number): void {
    this.pendingOperations = count;
    this.emit('pendingOperationsChanged', count);
    this.emit('statusChanged', this.getStatus());
  }

  /**
   * Set sync progress
   */
  setSyncProgress(current: number, total: number): void {
    this.syncInProgress = current < total;
    
    const status = this.getStatus();
    if (this.syncInProgress) {
      status.syncProgress = {
        current,
        total,
        percentage: Math.round((current / total) * 100)
      };
    }

    this.emit('syncProgress', status.syncProgress);
    this.emit('statusChanged', status);
  }

  /**
   * Start sync process
   */
  startSync(): void {
    this.syncInProgress = true;
    this.emit('syncStarted');
    this.emit('statusChanged', this.getStatus());
  }

  /**
   * End sync process
   */
  endSync(success: boolean, error?: Error): void {
    this.syncInProgress = false;
    
    if (success) {
      this.pendingOperations = 0;
      this.emit('syncCompleted');
    } else {
      this.emit('syncFailed', error);
    }

    this.emit('statusChanged', this.getStatus());
  }

  /**
   * Force offline mode (for testing)
   */
  forceOffline(): void {
    this.isOnline = false;
    this.emit('offline');
    this.emit('statusChanged', this.getStatus());
  }

  /**
   * Force online mode (for testing)
   */
  forceOnline(): void {
    this.isOnline = true;
    this.lastOnline = new Date();
    this.emit('online');
    this.emit('statusChanged', this.getStatus());
  }

  /**
   * Detect network type (simplified)
   */
  private detectNetworkType(): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection?.effectiveType) {
        // Map effective types to our categories
        if (connection.effectiveType === '4g') return 'cellular';
        if (connection.effectiveType === 'wifi') return 'wifi';
      }
    }
    return 'unknown';
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnlineEvent());
      window.removeEventListener('offline', () => this.handleOfflineEvent());
    }

    this.removeAllListeners();
  }

  /**
   * Get time since last online
   */
  getTimeSinceLastOnline(): number | null {
    if (!this.lastOnline) return null;
    return Date.now() - this.lastOnline.getTime();
  }

  /**
   * Check if sync is recommended based on pending operations and time
   */
  shouldSync(): boolean {
    if (!this.isOnline || this.syncInProgress) return false;
    
    // Sync if we have pending operations
    if (this.pendingOperations > 0) return true;

    // Sync if we've been offline for more than 5 minutes
    const timeSinceOnline = this.getTimeSinceLastOnline();
    if (timeSinceOnline && timeSinceOnline > 5 * 60 * 1000) return true;

    return false;
  }
}