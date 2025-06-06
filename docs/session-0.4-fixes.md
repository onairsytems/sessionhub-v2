# Session 0.4 Architecture Fixes

## Priority 1: Critical Gaps (Required for Production)

### 1. Implement Orchestration Layer
**Components Needed**:
- `src/core/orchestrator/SessionManager.ts`
- `src/core/orchestrator/ActorCoordinator.ts`
- `src/core/orchestrator/WorkflowEngine.ts`
- `src/core/orchestrator/StateManager.ts`

**Why Critical**: Without orchestration, the system cannot coordinate between Planning and Execution actors in a production environment.

**Implementation Tasks**:
```typescript
// SessionManager: Manages session lifecycle
- Create and track sessions
- Store session state and history
- Handle session persistence

// ActorCoordinator: Coordinates actor communication
- Route requests to appropriate actors
- Manage actor lifecycle
- Handle actor failures and recovery

// WorkflowEngine: Manages instruction flow
- Queue and prioritize instructions
- Track execution progress
- Handle partial completions

// StateManager: Manages system state
- Track active sessions
- Maintain actor states
- Provide state recovery
```

### 2. Add Real Claude API Integration
**Files to Modify**:
- `src/core/planning/PlanningEngine.ts`
- `src/core/execution/ExecutionEngine.ts`

**New Files Needed**:
- `src/lib/api/ClaudeAPIClient.ts`
- `src/lib/api/ClaudeCodeClient.ts`

**Implementation Tasks**:
- Replace mock implementations with real API calls
- Add API key management
- Implement retry logic
- Add rate limiting

## Priority 2: Important Gaps (Needed for Scalability)

### 3. Extract Configuration System
**Files to Create**:
- `src/config/planning.config.ts`
- `src/config/execution.config.ts`
- `src/config/system.config.ts`
- `src/config/actors.config.ts`

**Implementation Tasks**:
```typescript
// planning.config.ts
export const PLANNING_CONFIG = {
  model: process.env.PLANNING_MODEL || 'claude-3-opus',
  temperature: 0.7,
  maxTokens: 4000,
  systemPrompt: PLANNING_SYSTEM_PROMPT
};

// execution.config.ts
export const EXECUTION_CONFIG = {
  model: process.env.EXECUTION_MODEL || 'claude-code',
  temperature: 0.3,
  maxTokens: 8000,
  systemPrompt: EXECUTION_SYSTEM_PROMPT
};
```

### 4. Create Missing Data Models
**Files to Create**:
- `src/models/ExecutionResult.ts`
- `src/models/Session.ts`
- `src/models/ActorConfig.ts`

**Implementation Tasks**:
- Define clear interfaces for all data types
- Add validation methods
- Include serialization/deserialization

### 5. Implement Protocol Sub-components
**Files to Create**:
- `src/core/protocol/InstructionSchema.ts`
- `src/core/protocol/MessageFormatter.ts`
- `src/core/protocol/CommunicationLogger.ts`

**Rationale**: Better separation of concerns and easier testing

## Priority 3: Nice to Have (Code Organization)

### 6. Split Engine Components
**Current**: Monolithic PlanningEngine and ExecutionEngine
**Proposed**: Split into focused sub-components

**Planning Components**:
- `StrategyGenerator.ts`: Generates strategic approaches
- `InstructionBuilder.ts`: Builds instruction protocols
- `ContextAnalyzer.ts`: Analyzes request context

**Execution Components**:
- `CodeGenerator.ts`: Generates code from instructions
- `TaskRunner.ts`: Executes individual tasks
- `ResultReporter.ts`: Formats and reports results

### 7. Add Build-time Validation
**Files to Create**:
- `.eslintrc.sessionhub.js`
- `scripts/validate-architecture.ts`

**Implementation**: Custom ESLint rules to enforce architectural boundaries

## Implementation Order

### Phase 1: Foundation (Session 0.5)
1. Extract configuration system
2. Create missing data models
3. Add build-time validation

### Phase 2: Integration (Session 0.6)
1. Implement orchestration layer
2. Add real Claude API integration
3. Add comprehensive error recovery

### Phase 3: Refinement (Session 0.7)
1. Split engine components
2. Implement protocol sub-components
3. Add performance monitoring

## Quick Fixes (Can be done immediately)

### 1. Update Instruction Protocol Interface
```typescript
// Current implementation uses arrays for objectives
// Update to match specification or update specification to match implementation
```

### 2. Add Missing Type Exports
```typescript
// Add to src/models/index.ts
export * from './ExecutionResult';
export * from './Session';
export * from './ActorConfig';
```

### 3. Create Configuration Stubs
```typescript
// Add placeholder configs to avoid hardcoding
const DEFAULT_CONFIG = {
  planning: { /* ... */ },
  execution: { /* ... */ }
};
```

## Validation Checklist

Before considering fixes complete:
- [ ] All orchestration components implemented
- [ ] Real Claude API integration working
- [ ] Configuration extracted to separate files
- [ ] All data models have dedicated files
- [ ] Protocol layer fully implemented
- [ ] Build-time validation in place
- [ ] All tests still pass
- [ ] Architecture documentation updated