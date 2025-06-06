# SessionHub Two-Actor Architecture Design

## 🏛️ Core Architectural Principle

SessionHub is built on the **Two-Actor Model** where:
- **Planning Actor** (Claude Chat API): Strategic thinking, analysis, and instruction generation
- **Execution Actor** (Claude Code): Implementation, code generation, and task completion

This separation is not just methodology - it's the fundamental architecture.

## 🗺️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SessionHub Core                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐      │
│  │   Planning Engine   │         │  Execution Engine   │      │
│  │                     │         │                     │      │
│  │ • Analyze Request   │         │ • Parse Instructions│      │
│  │ • Generate Strategy │         │ • Implement Code    │      │
│  │ • Create Instructions│        │ • Execute Tasks     │      │
│  │ • Define Success    │         │ • Report Results    │      │
│  │                     │         │                     │      │
│  │  [Claude Chat API]  │         │  [Claude Code]      │      │
│  └──────────┬──────────┘         └──────────▲──────────┘      │
│             │                                │                  │
│             ▼                                │                  │
│  ┌──────────────────────────────────────────┴──────────┐      │
│  │              Instruction Protocol Layer              │      │
│  │                                                      │      │
│  │  • Validates instruction format                      │      │
│  │  • Ensures no code in instructions                   │      │
│  │  • Enforces actor separation                         │      │
│  │  • Logs all communications                           │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Flow: Planning → Instructions → Protocol Validation → Execution
```

## 📁 Core Directory Structure

```
src/
├── core/
│   ├── planning/              # Planning Actor components
│   │   ├── PlanningEngine.ts
│   │   ├── StrategyGenerator.ts
│   │   ├── InstructionBuilder.ts
│   │   └── ContextAnalyzer.ts
│   │
│   ├── execution/             # Execution Actor components
│   │   ├── ExecutionEngine.ts
│   │   ├── CodeGenerator.ts
│   │   ├── TaskRunner.ts
│   │   └── ResultReporter.ts
│   │
│   ├── protocol/              # Instruction Protocol
│   │   ├── InstructionSchema.ts
│   │   ├── ProtocolValidator.ts
│   │   ├── MessageFormatter.ts
│   │   └── CommunicationLogger.ts
│   │
│   └── orchestrator/          # System Orchestration
│       ├── SessionManager.ts
│       ├── ActorCoordinator.ts
│       ├── WorkflowEngine.ts
│       └── StateManager.ts
│
├── models/                    # Data models
│   ├── Instruction.ts
│   ├── ExecutionResult.ts
│   ├── Session.ts
│   └── ActorConfig.ts
│
└── config/                    # Actor configuration
    ├── planning.config.ts
    ├── execution.config.ts
    └── system.config.ts
```

## 📋 Instruction Protocol Schema

```typescript
interface InstructionProtocol {
  metadata: {
    id: string;
    sessionId: string;
    sessionName: string;
    timestamp: string;
    version: "1.0";
  };
  
  context: {
    description: string;
    prerequisites: string[];
    relatedSessions?: string[];
  };
  
  objectives: {
    primary: string;
    secondary?: string[];
  };
  
  requirements: Array<{
    id: string;
    description: string;
    priority: "must" | "should" | "could";
    details?: string[];
  }>;
  
  deliverables: Array<{
    type: "file" | "directory" | "config" | "documentation";
    path: string;
    description: string;
    validation?: string;
  }>;
  
  constraints: {
    technology?: string[];
    patterns?: string[];
    dependencies?: string[];
    avoid?: string[];
  };
  
  successCriteria: Array<{
    criterion: string;
    validationMethod: string;
  }>;
}
```

## 💻 Implementation Patterns

### Planning Engine

```typescript
/**
 * @actor planning
 * @responsibility Generates instructions from user requests
 * @forbidden Cannot write code, only describe what code should do
 */
export class PlanningEngine {
  constructor(
    private readonly claudeApi: ClaudeAPIClient,
    private readonly protocolValidator: ProtocolValidator
  ) {}

  async generateInstructions(request: UserRequest): Promise<InstructionProtocol> {
    // Analyze request context
    const context = await this.analyzeContext(request);
    
    // Generate strategic plan
    const strategy = await this.claudeApi.generateStrategy({
      request,
      context,
      systemPrompt: PLANNING_SYSTEM_PROMPT
    });
    
    // Build instruction protocol
    const instructions = this.buildInstructions(strategy);
    
    // Validate no code in instructions
    this.protocolValidator.ensureNoCode(instructions);
    
    return instructions;
  }
  
  // Planning NEVER includes actual code
  private buildInstructions(strategy: Strategy): InstructionProtocol {
    return {
      metadata: this.generateMetadata(),
      context: strategy.context,
      objectives: strategy.objectives,
      requirements: strategy.requirements.map(req => ({
        id: generateId(),
        description: req.description, // Describes WHAT, not HOW
        priority: req.priority,
        details: req.details
      })),
      deliverables: strategy.deliverables,
      constraints: strategy.constraints,
      successCriteria: strategy.successCriteria
    };
  }
}
```

### Execution Engine

```typescript
/**
 * @actor execution
 * @responsibility Implements instructions into working code
 * @forbidden Cannot make strategic decisions, only implement
 */
export class ExecutionEngine {
  constructor(
    private readonly claudeCode: ClaudeCodeClient,
    private readonly protocolValidator: ProtocolValidator
  ) {}

  async executeInstructions(instructions: InstructionProtocol): Promise<ExecutionResult> {
    // Validate instructions are properly formatted
    this.protocolValidator.validate(instructions);
    
    // Parse instructions into implementation tasks
    const tasks = this.parseInstructions(instructions);
    
    // Execute each task
    const results = await this.claudeCode.executeTasks({
      tasks,
      systemPrompt: EXECUTION_SYSTEM_PROMPT
    });
    
    // Compile and validate results
    return this.compileResults(results, instructions.successCriteria);
  }
  
  // Execution ONLY implements what instructions specify
  private parseInstructions(instructions: InstructionProtocol): ExecutionTask[] {
    return instructions.requirements.map(req => ({
      type: 'implement',
      requirement: req,
      deliverables: instructions.deliverables.filter(d => 
        this.isRelatedToRequirement(d, req)
      ),
      constraints: instructions.constraints
    }));
  }
}
```

### Protocol Validator

```typescript
/**
 * @actor system
 * @responsibility Enforces actor separation at runtime
 */
export class ProtocolValidator {
  private readonly codePatterns = [
    /function\s+\w+\s*\(/,
    /class\s+\w+/,
    /const\s+\w+\s*=/,
    /import\s+.*from/,
    /<[^>]+>/,  // HTML/JSX
    /```[a-z]*\n[\s\S]*?```/  // Code blocks
  ];

  ensureNoCode(instructions: InstructionProtocol): void {
    const instructionText = JSON.stringify(instructions);
    
    for (const pattern of this.codePatterns) {
      if (pattern.test(instructionText)) {
        throw new ArchitecturalViolation(
          'Planning Actor attempted to include code in instructions'
        );
      }
    }
  }
  
  validate(instructions: InstructionProtocol): void {
    // Validate schema
    if (!this.isValidSchema(instructions)) {
      throw new ValidationError('Invalid instruction schema');
    }
    
    // Ensure no code contamination
    this.ensureNoCode(instructions);
    
    // Validate all requirements are descriptive
    this.validateRequirementsAreDescriptive(instructions.requirements);
  }
}
```

## 🛡️ Enforcement Mechanisms

### 1. Type Safety

```typescript
// Separate types prevent mixing
type PlanningInput = UserRequest;
type PlanningOutput = InstructionProtocol;
type ExecutionInput = InstructionProtocol;
type ExecutionOutput = ExecutionResult;

// Type guards enforce boundaries
function isPlanningActor<T>(actor: T): actor is PlanningEngine {
  return actor instanceof PlanningEngine;
}

function isExecutionActor<T>(actor: T): actor is ExecutionEngine {
  return actor instanceof ExecutionEngine;
}
```

### 2. Runtime Validation

```typescript
class ActorBoundaryEnforcer {
  validateActorBoundary(actor: Actor, operation: Operation): void {
    if (isPlanningActor(actor) && operation.type === 'execute') {
      throw new BoundaryViolation('Planning actor cannot execute code');
    }
    
    if (isExecutionActor(actor) && operation.type === 'strategize') {
      throw new BoundaryViolation('Execution actor cannot make strategic decisions');
    }
  }
}
```

### 3. Architectural Tests

```typescript
describe('Two-Actor Architecture', () => {
  test('Planning Engine never outputs code', async () => {
    const engine = new PlanningEngine(mockApi, validator);
    const instructions = await engine.generateInstructions(mockRequest);
    
    expect(() => validator.ensureNoCode(instructions)).not.toThrow();
  });
  
  test('Execution Engine never makes strategic decisions', async () => {
    const engine = new ExecutionEngine(mockCode, validator);
    const result = await engine.executeInstructions(mockInstructions);
    
    expect(result).not.toHaveProperty('strategy');
    expect(result).not.toHaveProperty('plan');
  });
});
```

### 4. Build-time Checks

```javascript
// eslint-config-sessionhub
module.exports = {
  rules: {
    'no-code-in-planning': {
      files: ['src/core/planning/**/*.ts'],
      forbidden: ['fs.writeFile', 'child_process', 'eval']
    },
    'no-strategy-in-execution': {
      files: ['src/core/execution/**/*.ts'],
      forbidden: ['analyzeBestApproach', 'decideTechnology', 'planArchitecture']
    }
  }
};
```

## 📖 Component Documentation

```typescript
/**
 * @component PlanningEngine
 * @actor planning
 * @layer core
 * 
 * The PlanningEngine is responsible for analyzing user requests and
 * generating structured instructions. It embodies the Planning Actor
 * in the Two-Actor Model.
 * 
 * Capabilities:
 * - Analyze user requests for context and intent
 * - Generate strategic approaches
 * - Create detailed instructions without implementation
 * 
 * Restrictions:
 * - MUST NOT generate or include actual code
 * - MUST NOT make implementation decisions
 * - MUST NOT access execution layer directly
 * 
 * @example
 * const planner = new PlanningEngine(claudeApi, validator);
 * const instructions = await planner.generateInstructions({
 *   request: "Create a validation framework",
 *   context: { session: "0.2" }
 * });
 */
```

## ⚙️ Configuration

```typescript
// src/config/actors.config.ts

export const PLANNING_ACTOR_CONFIG = {
  model: "claude-3-opus",
  systemPrompt: `You are the Planning Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Analyze user requests and understand their intent
2. Generate strategic plans and approaches
3. Create detailed instructions describing WHAT to build
4. Define success criteria and validation methods

You MUST NOT:
- Write any actual code
- Include implementation details
- Make technology-specific decisions beyond constraints
- Provide code examples or snippets

Remember: You describe WHAT, the Execution Actor determines HOW.`,
  
  temperature: 0.7,
  maxTokens: 4000
};

export const EXECUTION_ACTOR_CONFIG = {
  model: "claude-code",
  systemPrompt: `You are the Execution Actor in SessionHub's Two-Actor Architecture.

Your role is to:
1. Receive instructions from the Planning Actor
2. Implement the requirements into working code
3. Follow all constraints and patterns specified
4. Report results and any issues encountered

You MUST NOT:
- Question or modify the strategic approach
- Add features not specified in instructions
- Make architectural decisions
- Change the plan

Remember: You implement exactly what the instructions specify.`,
  
  temperature: 0.3,
  maxTokens: 8000
};
```

## 🏛️ Architectural Principles

### Immutable Principles

1. **SEPARATION**: Planning and Execution are completely separate actors with no shared code
2. **PLANNING**: Planning Actor only creates instructions describing what to build
3. **EXECUTION**: Execution Actor only implements what instructions specify
4. **PROTOCOL**: All communication happens through the Instruction Protocol
5. **NO_MIXING**: Actors cannot share responsibilities or cross boundaries

### Principle Enforcement

```typescript
class ArchitecturalPrinciples {
  static readonly PRINCIPLES = {
    SEPARATION: 'Actors must be completely independent',
    PLANNING: 'Planning only describes what to build',
    EXECUTION: 'Execution only implements instructions',
    PROTOCOL: 'All communication via Instruction Protocol',
    NO_MIXING: 'No shared responsibilities between actors'
  } as const;
  
  static enforce(operation: Operation): void {
    // Runtime enforcement of principles
    Object.entries(this.PRINCIPLES).forEach(([principle, rule]) => {
      if (!this.validates(operation, principle)) {
        throw new PrincipleViolation(`${principle}: ${rule}`);
      }
    });
  }
}
```

## 🗓️ Implementation Roadmap

### Session 0.4: Core Two-Actor Architecture
- [ ] Implement PlanningEngine with Claude API integration
- [ ] Implement ExecutionEngine with Claude Code integration
- [ ] Create Instruction Protocol with full schema validation
- [ ] Build ActorCoordinator for system orchestration
- [ ] Implement enforcement mechanisms and boundary checks
- [ ] Create foundational architectural tests

### Session 0.5: Protocol & Validation
- [ ] Enhanced protocol validation system
- [ ] Runtime enforcement middleware
- [ ] Comprehensive architectural test suite
- [ ] Build-time validation rules
- [ ] Performance monitoring for actor communication
- [ ] Protocol versioning system

## 🎯 Benefits

### Clear Boundaries
- Each actor has a single, well-defined responsibility
- No ambiguity about what code belongs where
- Easy to understand and maintain

### Independent Testing
- Planning logic can be tested without execution
- Execution can be tested with mock instructions
- Protocol validation tested independently

### Scalability
- Actors can be scaled independently
- Different models can be used for each actor
- Easy to add new actors for specialized tasks

### Maintainability
- Changes to planning don't affect execution
- New strategies don't require execution changes
- Protocol provides stable interface

### Self-Documenting
- Architecture enforces clear documentation
- Code structure reflects actor boundaries
- Intentions are explicit in instructions

---

**Note**: This document serves as the blueprint for implementing SessionHub's Two-Actor Architecture in Sessions 0.4 and 0.5. The architecture described here will be the foundation for all future development, ensuring that SessionHub not only uses the Two-Actor Model but embodies it in every aspect of its design.