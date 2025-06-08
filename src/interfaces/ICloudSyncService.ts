/**
 * Cloud Sync Service Interface
 * Defines the contract for cloud synchronization implementations
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'disconnected';

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  conflicts: SyncConflict[];
  timestamp: string;
  error?: string;
}

export interface SyncConflict {
  itemId: string;
  itemType: string;
  localVersion: any;
  remoteVersion: any;
  resolution: 'local' | 'remote' | 'merge' | 'pending';
}

export interface ICloudSyncService {
  initialize(): Promise<void>;
  sync(): Promise<SyncResult>;
  resolveConflict(conflict: SyncConflict, resolution: 'local' | 'remote' | 'merge'): Promise<void>;
  getStatus(): SyncStatus;
  getLastSyncTime(): Date | null;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}