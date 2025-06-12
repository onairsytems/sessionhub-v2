/**
 * Extended cache interface for offline sync operations
 */

import { LocalCacheService } from '@/src/services/cache/LocalCacheService';

declare module '@/src/services/cache/LocalCacheService' {
  interface LocalCacheService {
    // Generic cache operations for sync engine
    get(table: string, id: string): Promise<any>;
    set(table: string, id: string, data: any, options?: { skipSync?: boolean }): Promise<void>;
    delete(table: string, id: string): Promise<void>;
    markAsSynced(table: string, id: string): Promise<void>;
    getPendingSyncItems(table: string): Promise<any[]>;
  }
}