# Local Cache Service

The LocalCacheService provides a high-performance SQLite-based cache for Supabase data, enabling offline functionality and faster data access in SessionHub.

## Features

- **Local SQLite Database**: Uses better-sqlite3 for synchronous, high-performance operations
- **Schema Mirroring**: Automatically mirrors the Supabase schema locally
- **Offline Support**: Full CRUD operations work offline with automatic sync when online
- **LRU Eviction**: Manages cache size with Least Recently Used eviction strategy
- **TTL Support**: Configurable time-to-live for cached records
- **Sync Tracking**: Tracks all local changes for reliable synchronization
- **Migration System**: Built-in schema migration support for updates
- **Performance Monitoring**: Cache hit/miss rates and statistics

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Application   │────▶│ CachedDataService│────▶│ SupabaseService │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                           │
                                ▼                           ▼
                        ┌──────────────────┐        ┌──────────────┐
                        │LocalCacheService │        │   Supabase   │
                        └──────────────────┘        └──────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  SQLite (Local)  │
                        └──────────────────┘
```

## Usage

### Basic Setup

```typescript
import { LocalCacheService } from './LocalCacheService';
import { SupabaseService } from '../cloud/SupabaseService';
import { Logger } from '@/src/lib/logging/Logger';

// Create services
const logger = new Logger('MyApp');
const supabaseService = new SupabaseService(logger);
const cacheService = new LocalCacheService(logger, {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  maxRecords: 10000,
  ttlSeconds: 3600, // 1 hour
  syncIntervalSeconds: 300, // 5 minutes
  enableAutoSync: true
});

// Initialize
await supabaseService.initialize();
await cacheService.initialize(supabaseService);
```

### Using the Integrated Service

```typescript
import { getCachedDataService } from './CacheIntegration';

// Get the singleton service
const dataService = getCachedDataService();
await dataService.initialize();

// All operations use cache automatically
const project = await dataService.createProject({
  name: 'My Project',
  path: '/path/to/project',
  type: 'nextjs'
});

// Fast cached read
const cached = await dataService.getProject(project.id);

// Force refresh from Supabase
const fresh = await dataService.getProject(project.id, true);
```

### Offline Operations

```typescript
// Check online status
if (!dataService.isOnline()) {
  console.log('Working offline');
  
  // All operations still work offline
  await dataService.updateProject(project.id, {
    name: 'Updated Offline'
  });
  
  // Check pending syncs
  const status = await dataService.getStatus();
  console.log(`${status.offlineQueueSize} operations pending sync`);
}

// Force sync when back online
if (dataService.isOnline()) {
  await dataService.forceSyncAll();
}
```

### Cache Management

```typescript
// Get cache statistics
const stats = await cacheService.getCacheStats();
console.log('Cache stats:', {
  size: stats.totalSize,
  records: stats.recordCounts,
  hitRate: stats.cacheHitRate,
  pendingSyncs: stats.pendingSyncs
});

// Export cache for backup
const backup = await cacheService.exportCache();
fs.writeFileSync('cache-backup.json', JSON.stringify(backup));

// Import cache from backup
const backupData = JSON.parse(fs.readFileSync('cache-backup.json', 'utf8'));
await cacheService.importCache(backupData);

// Clear cache
await cacheService.clearCache();

// Optimize database
await cacheService.optimize();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSizeBytes` | number | 100MB | Maximum cache size in bytes |
| `maxRecords` | number | 10000 | Maximum records per table |
| `ttlSeconds` | number | 3600 | Time-to-live for cached records |
| `syncIntervalSeconds` | number | 300 | Auto-sync interval |
| `enableAutoSync` | boolean | true | Enable automatic syncing |
| `cachePath` | string | userData/cache | Custom cache directory |

## Database Schema

The cache mirrors the Supabase schema with additional cache metadata:

```sql
-- Each table includes these cache fields:
cached_at TEXT DEFAULT (datetime('now')),
ttl_expires_at TEXT,
version INTEGER DEFAULT 1
```

### Sync Queue

Tracks all pending synchronization operations:

```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY,
  record_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT CHECK (operation IN ('create', 'update', 'delete')),
  local_version INTEGER NOT NULL,
  sync_status TEXT CHECK (sync_status IN ('pending', 'syncing', 'synced', 'conflict', 'error')),
  last_sync_attempt TEXT,
  sync_error TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## Performance Considerations

1. **Write Performance**: SQLite with WAL mode provides fast writes
2. **Read Performance**: Local reads are instant with no network latency
3. **Memory Usage**: Uses SQLite's page cache (20MB by default)
4. **Disk Usage**: Automatic LRU eviction prevents unbounded growth

## Error Handling

The service handles various error scenarios:

- **Network Failures**: Operations queue for later sync
- **Sync Conflicts**: Tracked in sync_queue for resolution
- **Cache Corruption**: Automatic recovery or clear/rebuild
- **Size Limits**: LRU eviction maintains size constraints

## Migration System

Add new migrations to the `migrations` array:

```typescript
const migrations: Migration[] = [
  {
    version: 2,
    name: 'add_custom_field',
    up: 'ALTER TABLE projects ADD COLUMN custom_field TEXT;',
    down: 'ALTER TABLE projects DROP COLUMN custom_field;'
  }
];
```

## Testing

Run the test suite:

```bash
npm test src/services/cache/LocalCacheService.test.ts
```

## Troubleshooting

### Cache not syncing
1. Check online status: `dataService.isOnline()`
2. Check sync queue: `await dataService.getStatus()`
3. Force sync: `await dataService.forceSyncAll()`

### Performance issues
1. Check cache size: `stats.totalSize`
2. Optimize database: `await cacheService.optimize()`
3. Adjust TTL settings for your use case

### Disk space issues
1. Reduce `maxSizeBytes` configuration
2. Clear old data: `await cacheService.clearCache()`
3. Enable more aggressive LRU eviction