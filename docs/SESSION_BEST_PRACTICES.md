# Session Development Best Practices

> Guidelines for successful incremental development with zero-tolerance quality gates
> Version: 0.1.9
> Last Updated: Session 0.1.9

## Core Philosophy

Sessions enable incremental development while maintaining production-quality code at every step. Each session should leave the codebase better than it found it, with no broken functionality or incomplete features exposed to users.

## Planning a Session

### 1. Define Clear Objectives
Before starting any session:
- **Write specific goals** - What will be accomplished?
- **Set boundaries** - What's included and what's not?
- **Identify dependencies** - What must exist first?
- **Define success criteria** - How will you know it's complete?

Example:
```markdown
Session 0.2.0: Cloud Synchronization Foundation
GOALS:
- Create ICloudSyncService interface
- Implement MockCloudSyncService
- Add feature flag for cloud sync
- Create UI placeholder with "coming soon" message

NOT INCLUDED:
- Actual Supabase integration
- Real-time sync logic
- Conflict resolution

SUCCESS:
- All code compiles with zero errors
- Mock service satisfies all interfaces
- Feature flag properly gates functionality
```

### 2. Use Feature Flags Liberally
Feature flags are your best friend for incremental development:

```typescript
// Always start with flag disabled
export const FEATURES = {
  MY_NEW_FEATURE: false, // TODO: [Session X.Y.Z] Enable when complete
};

// Gate all code paths
if (FEATURES.MY_NEW_FEATURE) {
  // Real implementation
  await performRealAction();
} else {
  // Mock or placeholder
  logger.debug('Feature not yet available');
}
```

### 3. Design Extensible Interfaces
Think about future needs when creating interfaces:

```typescript
// Version your interfaces when needed
export interface IDataServiceV1 {
  getData(): Promise<Data>;
}

export interface IDataServiceV2 extends IDataServiceV1 {
  getData(options?: GetDataOptions): Promise<Data>;
  clearCache(): Promise<void>;
}

// Use generics for flexibility
export interface IConnector<TConfig = any, TData = any> {
  connect(config: TConfig): Promise<void>;
  disconnect(): Promise<void>;
  send(data: TData): Promise<void>;
}
```

## During Development

### 1. Implement Mock-First
Always create a working mock before the real implementation:

```typescript
// 1. Define the interface
export interface IEmailService {
  send(to: string, subject: string, body: string): Promise<boolean>;
}

// 2. Create mock implementation
export class MockEmailService implements IEmailService {
  async send(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`Mock email: ${subject} to ${to}`);
    return true;
  }
}

// 3. Use dependency injection
class NotificationManager {
  constructor(
    private emailService: IEmailService = new MockEmailService()
  ) {}
}
```

### 2. Handle All Code Paths
Never leave a code path that could error:

```typescript
// Bad - throws in production
if (FEATURES.ADVANCED_SEARCH) {
  return await performAdvancedSearch(query);
}
// Execution continues with undefined result!

// Good - all paths handled
if (FEATURES.ADVANCED_SEARCH) {
  return await performAdvancedSearch(query);
} else {
  // Return sensible default
  return await performBasicSearch(query);
}
```

### 3. Use Proper TODO Format
TODOs should be actionable and traceable:

```typescript
// Bad - no context
// TODO: Implement this

// Good - links to future session
// TODO: [Session 0.2.1] Implement real-time updates using WebSocket
//   - Connect to Supabase realtime
//   - Handle connection drops
//   - Implement exponential backoff
```

### 4. Progressive Enhancement
Build features in layers:

```typescript
// Phase 1: Basic structure
export class DataSync {
  async sync(): Promise<void> {
    // TODO: [Session 0.2.0] Basic sync
    throw new Error('Not implemented');
  }
}

// Phase 2: Mock implementation
export class DataSync {
  async sync(): Promise<void> {
    // TODO: [Session 0.3.0] Real sync
    console.log('Mock sync completed');
  }
}

// Phase 3: Real implementation
export class DataSync {
  async sync(): Promise<void> {
    const data = await this.gatherLocalChanges();
    await this.uploadToCloud(data);
    await this.downloadRemoteChanges();
  }
}
```

## Testing Strategies

### 1. Test Against Interfaces
Write tests against interfaces, not implementations:

```typescript
describe('CloudSyncService', () => {
  let service: ICloudSyncService;
  
  beforeEach(() => {
    // Can swap implementations easily
    service = ServiceFactory.createCloudSyncService();
  });
  
  it('should connect successfully', async () => {
    await expect(service.connect()).resolves.not.toThrow();
    expect(service.isConnected()).toBe(true);
  });
});
```

### 2. Test Feature Flags
Ensure your code works with features both enabled and disabled:

```typescript
describe('with feature flag disabled', () => {
  beforeEach(() => {
    FEATURES.CLOUD_SYNC = false;
  });
  
  it('should show placeholder UI', () => {
    render(<SyncButton />);
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});
```

## Common Patterns

### 1. Service Factory Pattern
Centralize service creation based on feature flags:

```typescript
export class ServiceFactory {
  static createSyncService(): ISyncService {
    if (FEATURES.CLOUD_SYNC) {
      return new CloudSyncService();
    }
    return new LocalSyncService();
  }
}
```

### 2. Null Object Pattern
Provide no-op implementations instead of null checks:

```typescript
class NullLogger implements ILogger {
  log(message: string): void {
    // Do nothing
  }
}

// Usage - no null checks needed
const logger = config.enableLogging ? new FileLogger() : new NullLogger();
logger.log('Always safe to call');
```

### 3. Builder Pattern for Complex Objects
Make it easy to construct valid test objects:

```typescript
class SessionBuilder {
  private session: Partial<Session> = {
    id: generateId(),
    timestamp: new Date(),
    status: 'pending'
  };
  
  withData(data: any): this {
    this.session.data = data;
    return this;
  }
  
  build(): Session {
    return this.session as Session;
  }
}

// Usage
const testSession = new SessionBuilder()
  .withData({ test: true })
  .build();
```

## Session Completion Checklist

Before marking any session complete:

- [ ] **All TypeScript errors resolved** - `npm run typecheck` passes
- [ ] **All ESLint violations fixed** - `npm run lint` passes  
- [ ] **All tests passing** - `npm test` passes
- [ ] **Build completes** - `npm run build` succeeds
- [ ] **Feature flags set correctly** - Incomplete features disabled
- [ ] **All code paths handled** - No throws without feature flags
- [ ] **Mocks satisfy interfaces** - Type checking passes
- [ ] **TODOs follow format** - Include session numbers
- [ ] **Documentation updated** - README, FOUNDATION, etc.
- [ ] **No console.log statements** - Use proper logging
- [ ] **No commented code** - Delete or document why

## Anti-Patterns to Avoid

### 1. Partial Implementations Without Flags
```typescript
// Bad - breaks without feature flag
export class EmailService {
  async send(email: Email): Promise<void> {
    throw new Error('Not implemented yet');
  }
}
```

### 2. Mixing Real and Mock Code
```typescript
// Bad - hard to test and maintain
export class DataService {
  async getData(): Promise<Data> {
    if (process.env.USE_MOCK) {
      return { mock: true };
    }
    return await fetch('/api/data');
  }
}
```

### 3. Feature Flags in Multiple Places
```typescript
// Bad - flag checks scattered
if (FEATURES.DARK_MODE) {
  element.classList.add('dark');
}
// ... later in same component
if (FEATURES.DARK_MODE) {
  color = darkColors;
}

// Good - centralized
const theme = FEATURES.DARK_MODE ? darkTheme : lightTheme;
applyTheme(element, theme);
```

### 4. Overly Broad Interfaces
```typescript
// Bad - too many responsibilities
interface IDoEverything {
  syncData(): Promise<void>;
  validateUser(): Promise<boolean>;
  sendEmail(): Promise<void>;
  generateReport(): Promise<Report>;
}

// Good - focused interfaces
interface IDataSync {
  sync(): Promise<void>;
}

interface IEmailSender {
  send(email: Email): Promise<void>;
}
```

## Incremental Delivery Strategy

### Phase 1: Foundation (Current Session)
- Interfaces defined
- Mock implementations
- Feature flags created
- Basic UI placeholders

### Phase 2: Basic Implementation
- Real service connections
- Basic functionality
- Error handling
- Feature flag still disabled

### Phase 3: Enhanced Features  
- Advanced functionality
- Performance optimizations
- Full error recovery
- Enable in development

### Phase 4: Production Ready
- Monitoring added
- Documentation complete
- Feature flag enabled
- User guides updated

## Summary

Successful session development requires:
1. **Clear planning** - Know what you're building
2. **Feature flags** - Control what users see
3. **Interface-first design** - Plan for extension
4. **Mock implementations** - Keep everything working
5. **Comprehensive testing** - Verify both paths
6. **Clean completion** - Leave no broken code

Remember: Every session should result in a fully functional, error-free codebase that's ready for production, even if some features are behind flags or using mocks.