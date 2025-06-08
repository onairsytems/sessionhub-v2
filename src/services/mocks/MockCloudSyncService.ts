import { Logger } from '../../lib/logging/Logger';

// TODO: [Session 0.2.0] Replace with real implementation
// This mock satisfies the interface contract while the real implementation
// is being developed in a future session

export interface SyncResult {
  success: boolean;
  timestamp: Date;
  itemsSynced?: number;
  errors?: string[];
  mockData?: boolean;
}

export interface SessionData {
  id: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ICloudSyncService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sync(data: SessionData): Promise<SyncResult>;
  isConnected(): boolean;
  getLastSyncTime(): Date | null;
}

/**
 * Mock implementation of cloud sync service
 * Provides a working implementation that satisfies types without external dependencies
 */
export class MockCloudSyncService implements ICloudSyncService {
  private logger = new Logger('MockCloudSyncService');
  private connected = false;
  private lastSyncTime: Date | null = null;

  async connect(): Promise<void> {
    // TODO: [Session 0.2.0] Implement real Supabase connection
    this.logger.info('Mock cloud sync service connecting...');
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.connected = true;
    this.logger.info('Mock cloud sync service connected');
  }

  async disconnect(): Promise<void> {
    // TODO: [Session 0.2.0] Implement real disconnect logic
    this.logger.info('Mock cloud sync service disconnecting...');
    
    this.connected = false;
    this.lastSyncTime = null;
    
    this.logger.info('Mock cloud sync service disconnected');
  }

  async sync(data: SessionData): Promise<SyncResult> {
    // TODO: [Session 0.2.0] Implement real sync with Supabase
    if (!this.connected) {
      throw new Error('Cannot sync: service not connected');
    }

    this.logger.info(`Mock syncing session data: ${data.id}`);
    
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.lastSyncTime = new Date();
    
    return {
      success: true,
      timestamp: this.lastSyncTime,
      itemsSynced: 1,
      mockData: true
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }
}