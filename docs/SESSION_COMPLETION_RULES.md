# Session Completion Rules

> Defining what "session complete" means in a zero-error context
> Version: 0.1.9
> Last Updated: Session 0.1.9 - Quality Gates + Session Harmony

## Core Principles

### 1. Self-Contained Sessions
Every session MUST be self-contained and functional:
- **Builds successfully** - Zero TypeScript errors, zero ESLint violations
- **Tests pass** - All existing tests continue to pass
- **Features work** - Implemented features are fully functional
- **No broken paths** - All code paths either work or are properly gated

### 2. Incremental Development Support
Sessions can build incrementally while maintaining quality:
- **Feature flags** - Disable incomplete features at runtime
- **Proper interfaces** - Define contracts for future implementation
- **Mock implementations** - Satisfy types while awaiting real implementation
- **Explicit TODOs** - Document future work without triggering errors

## Approved Patterns for Incomplete Features

### Feature Flags
```typescript
// src/config/features.ts
export const FEATURES = {
  // Completed features
  ERROR_DETECTION: true,
  TWO_ACTOR_MODEL: true,
  
  // In-progress features (disabled until complete)
  CLOUD_SYNC: false,
  AI_ASSISTANT: false,
  VOICE_COMMANDS: false,
} as const;

// Usage in code
if (FEATURES.CLOUD_SYNC) {
  await syncToCloud(data);
} else {
  // Feature not yet available
  logger.info('Cloud sync not yet implemented');
}
```

### Interface-First Development
```typescript
// Define the contract first
export interface ICloudSyncService {
  connect(): Promise<void>;
  sync(data: SessionData): Promise<SyncResult>;
  disconnect(): Promise<void>;
}

// Mock implementation for current session
export class MockCloudSyncService implements ICloudSyncService {
  async connect(): Promise<void> {
    // TODO: [Session 0.2.0] Implement real cloud connection
    logger.debug('Mock cloud sync connected');
  }
  
  async sync(data: SessionData): Promise<SyncResult> {
    // TODO: [Session 0.2.0] Implement real sync logic
    return { success: true, mockData: true };
  }
  
  async disconnect(): Promise<void> {
    logger.debug('Mock cloud sync disconnected');
  }
}

// Service factory handles feature flags
export function createCloudSyncService(): ICloudSyncService {
  if (FEATURES.CLOUD_SYNC) {
    // Will be implemented in future session
    throw new Error('Real CloudSyncService not yet implemented');
  }
  return new MockCloudSyncService();
}
```

### Placeholder UI Components
```typescript
// Disabled feature with proper messaging
export function VoiceCommandButton() {
  if (!FEATURES.VOICE_COMMANDS) {
    return (
      <Button disabled title="Coming in version 0.2.0">
        <MicrophoneIcon className="opacity-50" />
        Voice Commands (Coming Soon)
      </Button>
    );
  }
  
  // Real implementation will go here
  return <ActiveVoiceCommandButton />;
}
```

### Abstract Base Classes for Extension
```typescript
// Base class defines the contract
export abstract class BaseConnector {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract isConnected(): boolean;
  
  // Shared implementation
  protected logger = new Logger(this.constructor.name);
  
  protected handleError(error: Error): never {
    this.logger.error('Connector error:', error);
    throw error;
  }
}

// Future sessions extend the base
export class SlackConnector extends BaseConnector {
  // TODO: [Session 0.2.1] Implement Slack integration
  connect(): Promise<void> {
    throw new Error('Slack connector not yet implemented');
  }
  
  disconnect(): Promise<void> {
    throw new Error('Slack connector not yet implemented');
  }
  
  isConnected(): boolean {
    return false;
  }
}
```

## TODO Comment Standards

### Approved TODO Format
```typescript
// TODO: [Session X.Y.Z] Brief description of what needs to be done
// Example:
// TODO: [Session 0.2.0] Implement real-time synchronization with Supabase

// Multi-line TODOs for complex items
// TODO: [Session 0.3.0] Voice command integration
//   - Set up speech recognition API
//   - Create command parser
//   - Integrate with existing command system
```

### TODO Rules
1. **Always include session number** - Links work to specific sessions
2. **Be specific** - Describe what needs to be done, not just "implement this"
3. **No error-triggering TODOs** - Don't use TODO in a way that breaks types
4. **Group related TODOs** - Keep TODOs for same feature together

## Session Practices

### 1. Define Clear Boundaries
Each session should have:
- **Clear objectives** - What will be accomplished
- **Defined scope** - What's included and what's not
- **Success criteria** - How to know when it's complete
- **Dependencies** - What must exist before starting

### 2. Use Dependency Injection
```typescript
// Makes testing and mocking easier
export class SessionManager {
  constructor(
    private planning: IPlanningEngine,
    private execution: IExecutionEngine,
    private storage: IStorageService = new MockStorageService(), // Default mock
  ) {}
}
```

### 3. Create Integration Points
```typescript
// Define clear integration points for future features
export interface IIntegrationPoint {
  id: string;
  version: string;
  connect(service: IExternalService): Promise<void>;
}

// Registry for future integrations
export class IntegrationRegistry {
  private integrations = new Map<string, IIntegrationPoint>();
  
  register(integration: IIntegrationPoint): void {
    this.integrations.set(integration.id, integration);
  }
  
  // Future sessions can add integrations without modifying core code
}
```

### 4. Version Interfaces
```typescript
// Allow for interface evolution
export interface ISessionDataV1 {
  id: string;
  timestamp: Date;
  data: unknown;
}

export interface ISessionDataV2 extends ISessionDataV1 {
  version: '2';
  metadata: Record<string, unknown>;
  tags: string[];
}

// Type guard for version checking
export function isV2SessionData(data: ISessionDataV1): data is ISessionDataV2 {
  return 'version' in data && data.version === '2';
}
```

## Quality Gate Adjustments

### Allowed Patterns
The following patterns are allowed when properly implemented:

1. **Feature flags** that disable incomplete code paths
2. **Mock implementations** that satisfy interfaces
3. **TODO comments** in the approved format
4. **Placeholder UI** that indicates future functionality
5. **Abstract classes** awaiting concrete implementation
6. **Versioned interfaces** for future extension

### Still Prohibited
The following remain strictly prohibited:

1. **Type suppressions** - No @ts-ignore, @ts-expect-error, etc.
2. **Any types** - Must use proper types or unknowns
3. **Console statements** - Use proper logging
4. **Broken code paths** - All paths must handle all cases
5. **Failing tests** - All tests must pass
6. **Build errors** - Zero tolerance for compilation errors

## Session Completion Checklist

Before marking a session as complete:

- [ ] All TypeScript errors resolved
- [ ] All ESLint violations fixed
- [ ] All tests passing
- [ ] Build completes successfully
- [ ] Feature flags set appropriately
- [ ] Mock implementations satisfy interfaces
- [ ] TODOs follow approved format
- [ ] Documentation updated
- [ ] Foundation document updated
- [ ] Git commit follows standards

## Progressive Enhancement Strategy

### Phase 1: Interface Definition
- Define all interfaces
- Create mock implementations
- Set feature flags to false
- Ensure everything compiles

### Phase 2: Basic Implementation
- Implement core functionality
- Replace mocks with real code
- Keep feature flag false
- Add unit tests

### Phase 3: Integration
- Connect to real services
- Add integration tests
- Enable feature flag in dev
- Monitor for issues

### Phase 4: Production Ready
- Enable feature flag
- Add monitoring
- Document usage
- Update user guides

## Examples of Good Session Boundaries

### Good: Add Error Reporting UI
```typescript
// Session adds complete, working feature
// - New ErrorReportView component ✓
// - Integration with ErrorDetectionEngine ✓
// - Tests for new component ✓
// - Feature flag not needed (complete feature) ✓
```

### Good: Prepare for Cloud Sync
```typescript
// Session creates foundation without breaking anything
// - ICloudSyncService interface ✓
// - MockCloudSyncService implementation ✓
// - Feature flag CLOUD_SYNC = false ✓
// - TODO: [Session 0.2.0] Implement real sync ✓
```

### Bad: Partial Implementation
```typescript
// Session leaves broken code paths
// - CloudSyncService partially implemented ✗
// - Some methods throw "not implemented" ✗
// - No feature flag protection ✗
// - Tests failing due to incomplete code ✗
```

## Conclusion

Session completion in a zero-error context means:
1. **Everything builds** - No compilation or lint errors
2. **Everything runs** - No runtime errors in implemented features  
3. **Everything is explicit** - Unimplemented features are clearly marked
4. **Everything is testable** - Mocks allow testing of integrated code
5. **Everything is extensible** - Clear patterns for future work

This approach enables rapid, incremental development while maintaining the zero-defect standard that SessionHub requires.