/**
 * Connection Monitor Service
 * Monitors the status of all external service connections in real-time
 */

import { Logger } from '@/src/lib/logging/Logger';
import { EventEmitter } from 'events';

export interface ServiceStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastChecked: Date;
  lastConnected?: Date;
  error?: string;
  latency?: number;
  metadata?: Record<string, any>;
}

export interface ConnectionHealth {
  overall: 'healthy' | 'degraded' | 'offline';
  services: Map<string, ServiceStatus>;
  timestamp: Date;
}

export class ConnectionMonitor extends EventEmitter {
  private readonly logger: Logger;
  private services: Map<string, ServiceStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds
  private serviceCheckers: Map<string, () => Promise<boolean>> = new Map();

  constructor() {
    super();
    this.logger = new Logger('ConnectionMonitor');
  }

  /**
   * Register a service for monitoring
   */
  registerService(
    name: string, 
    checkFunction: () => Promise<boolean>,
    metadata?: Record<string, any>
  ): void {
    this.serviceCheckers.set(name, checkFunction);
    this.services.set(name, {
      name,
      status: 'disconnected',
      lastChecked: new Date(),
      metadata
    });
    
    this.logger.info('Service registered for monitoring', { service: name });
    
    // Perform initial check
    this.checkService(name);
  }

  /**
   * Start monitoring all registered services
   */
  start(): void {
    if (this.checkInterval) {
      return; // Already running
    }

    this.logger.info('Starting connection monitoring');
    
    // Initial check for all services
    this.checkAllServices();
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllServices();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.logger.info('Stopped connection monitoring');
  }

  /**
   * Get current connection health
   */
  getHealth(): ConnectionHealth {
    const connectedCount = Array.from(this.services.values())
      .filter(s => s.status === 'connected').length;
    const totalCount = this.services.size;
    
    let overall: 'healthy' | 'degraded' | 'offline';
    if (connectedCount === totalCount) {
      overall = 'healthy';
    } else if (connectedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'offline';
    }
    
    return {
      overall,
      services: new Map(this.services),
      timestamp: new Date()
    };
  }

  /**
   * Get status for a specific service
   */
  getServiceStatus(name: string): ServiceStatus | undefined {
    return this.services.get(name);
  }

  /**
   * Force check a specific service
   */
  async checkService(name: string): Promise<ServiceStatus | undefined> {
    const checker = this.serviceCheckers.get(name);
    if (!checker) {
      this.logger.warn('No checker registered for service', { service: name });
      return undefined;
    }

    const currentStatus = this.services.get(name);
    if (!currentStatus) {
      return undefined;
    }

    const previousStatus = currentStatus.status;
    const startTime = Date.now();
    
    try {
      currentStatus.status = 'connecting';
      this.emit('statusChange', name, currentStatus);
      
      const isConnected = await checker();
      const latency = Date.now() - startTime;
      
      currentStatus.status = isConnected ? 'connected' : 'disconnected';
      currentStatus.lastChecked = new Date();
      currentStatus.latency = latency;
      currentStatus.error = undefined;
      
      if (isConnected) {
        currentStatus.lastConnected = new Date();
      }
      
      if (previousStatus !== currentStatus.status) {
        this.logger.info('Service status changed', {
          service: name,
          previousStatus,
          newStatus: currentStatus.status,
          latency
        });
        
        this.emit('statusChange', name, currentStatus);
        
        if (currentStatus.status === 'connected') {
          this.emit('connected', name);
        } else {
          this.emit('disconnected', name);
        }
      }
    } catch (error) {
      currentStatus.status = 'error';
      currentStatus.lastChecked = new Date();
      currentStatus.error = (error as Error).message;
      currentStatus.latency = Date.now() - startTime;
      
      this.logger.error('Service check failed', error as Error, { service: name });
      
      if (previousStatus !== 'error') {
        this.emit('statusChange', name, currentStatus);
        this.emit('error', name, error);
      }
    }
    
    this.services.set(name, currentStatus);
    return currentStatus;
  }

  /**
   * Check all registered services
   */
  private async checkAllServices(): Promise<void> {
    const promises = Array.from(this.serviceCheckers.keys()).map(name => 
      this.checkService(name)
    );
    
    await Promise.allSettled(promises);
    
    // Emit overall health status
    const health = this.getHealth();
    this.emit('healthUpdate', health);
  }

  /**
   * Register standard service checkers
   */
  registerStandardServices(services: {
    claudeApi?: { validateApiKey: () => Promise<boolean> };
    supabaseService?: { isServiceOnline: () => boolean };
    patternService?: any;
  }): void {
    if (services.claudeApi) {
      this.registerService('Claude API', async () => {
        try {
          return await services.claudeApi!.validateApiKey();
        } catch {
          return false;
        }
      }, { type: 'ai', provider: 'anthropic' });
    }

    if (services.supabaseService) {
      this.registerService('Supabase', async () => {
        return services.supabaseService!.isServiceOnline();
      }, { type: 'database', provider: 'supabase' });
    }

    if (services.patternService) {
      this.registerService('Pattern Recognition', async () => {
        return services.patternService!.isInitialized;
      }, { type: 'intelligence', internal: true });
    }
  }

  /**
   * Get connection statistics
   */
  getStatistics(): {
    totalServices: number;
    connected: number;
    disconnected: number;
    errors: number;
    averageLatency: number;
    uptime: Record<string, number>;
  } {
    const services = Array.from(this.services.values());
    const connected = services.filter(s => s.status === 'connected');
    
    const averageLatency = connected.length > 0
      ? connected.reduce((sum, s) => sum + (s.latency || 0), 0) / connected.length
      : 0;
    
    const uptime: Record<string, number> = {};
    for (const [name, status] of this.services) {
      if (status.lastConnected) {
        const connectedTime = status.status === 'connected' 
          ? Date.now() - status.lastConnected.getTime()
          : 0;
        uptime[name] = connectedTime;
      } else {
        uptime[name] = 0;
      }
    }
    
    return {
      totalServices: services.length,
      connected: services.filter(s => s.status === 'connected').length,
      disconnected: services.filter(s => s.status === 'disconnected').length,
      errors: services.filter(s => s.status === 'error').length,
      averageLatency: Math.round(averageLatency),
      uptime
    };
  }

  /**
   * Export connection history
   */
  exportHistory(): Array<{
    service: string;
    status: string;
    timestamp: string;
    latency?: number;
    error?: string;
  }> {
    const history: any[] = [];
    
    for (const [name, status] of this.services) {
      history.push({
        service: name,
        status: status.status,
        timestamp: status.lastChecked.toISOString(),
        latency: status.latency,
        error: status.error
      });
    }
    
    return history;
  }
}