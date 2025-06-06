# Two-Actor Architecture Validation Tests

This test suite validates the implementation of the Two-Actor Model from Session 0.4, ensuring strict separation between Planning and Execution actors.

## Test Structure

### 1. Planning Engine Tests (`test-planning-engine.ts`)
Validates that the Planning Engine:
- ✅ Accepts requests and generates valid instructions
- ✅ Rejects any code patterns in instructions
- ✅ Only generates descriptive, high-level instructions
- ✅ Handles complex requests appropriately

### 2. Execution Engine Tests (`test-execution-engine.ts`)
Validates that the Execution Engine:
- ✅ Parses and executes instructions correctly
- ✅ Operates in a sandboxed environment with timeouts
- ✅ Cannot make strategic decisions
- ✅ Tracks execution history
- ✅ Handles errors gracefully

### 3. Boundary Enforcement Tests (`test-boundary-enforcement.ts`)
Validates that boundaries are enforced:
- ✅ ActorBoundaryEnforcer prevents operation violations
- ✅ Content validation catches improper patterns
- ✅ Boundary proxy blocks forbidden methods
- ✅ ProtocolValidator ensures proper instruction format
- ✅ Violations are tracked for audit

### 4. Integration Tests (`test-integration.ts`)
Validates the complete system:
- ✅ End-to-end workflow from request to execution
- ✅ Comprehensive audit trail and logging
- ✅ Error propagation and recovery
- ✅ Concurrent operations without contamination
- ✅ Boundary violation handling

## Running the Tests

### Run all tests:
```bash
npx ts-node tests/two-actor-architecture/run-all-tests.ts
```

### Run individual test suites:
```bash
# Planning Engine tests only
npx ts-node tests/two-actor-architecture/test-planning-engine.ts

# Execution Engine tests only
npx ts-node tests/two-actor-architecture/test-execution-engine.ts

# Boundary Enforcement tests only
npx ts-node tests/two-actor-architecture/test-boundary-enforcement.ts

# Integration tests only
npx ts-node tests/two-actor-architecture/test-integration.ts
```

## Expected Results

When all tests pass, you should see:

```
✅ All validations PASSED!

The Two-Actor Architecture implementation correctly:
  1. ✅ Separates Planning and Execution responsibilities
  2. ✅ Prevents code patterns in planning instructions
  3. ✅ Ensures execution cannot make strategic decisions
  4. ✅ Enforces strict boundaries between actors
  5. ✅ Maintains comprehensive audit trails
  6. ✅ Handles errors and partial failures gracefully
  7. ✅ Supports concurrent operations without contamination

🎉 The Two-Actor Model is properly enforced!
```

## Key Validations

### Planning Actor Restrictions
- Cannot include code patterns (functions, classes, npm commands)
- Cannot execute or implement anything
- Must only generate descriptive instructions

### Execution Actor Restrictions
- Cannot make strategic decisions
- Cannot use planning language (should we, recommend, consider)
- Must only implement what instructions specify

### Boundary Enforcement
- Method calls are intercepted and validated
- Content is scanned for violations
- All violations are logged for audit

### Protocol Validation
- Instructions must follow the defined structure
- No implementation details in requirements
- Success criteria must be measurable

## Architecture Principles Validated

1. **Separation of Concerns**: Planning thinks, Execution does
2. **Immutable Instructions**: Planning output cannot be modified
3. **Audit Trail**: All operations are logged
4. **Security**: Execution runs in sandboxed environment
5. **Error Handling**: Graceful degradation with partial success
6. **Scalability**: Concurrent operations without interference