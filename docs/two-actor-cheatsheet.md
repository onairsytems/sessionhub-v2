# Two-Actor Model Cheatsheet & Violation Detection Guide

## 🚨 Quick Reference: Actor Boundaries

### Planning Actor (Claude Chat API)
**✅ ALLOWED:**
- Strategic thinking and analysis
- Breaking down problems into steps
- Describing WHAT needs to be done
- Defining objectives and requirements
- Creating high-level instructions
- Analyzing context and prerequisites
- Setting success criteria

**❌ FORBIDDEN:**
- Writing ANY code (no matter how small)
- Using code blocks or snippets
- Specifying exact implementation details
- Using cat/EOF commands
- Creating file content directly
- Making technical implementation decisions

### Execution Actor (Claude Code)
**✅ ALLOWED:**
- Writing all code
- Implementing solutions
- Making technical decisions
- Choosing libraries and frameworks
- Creating files and directories
- Running commands and tests
- Reporting results

**❌ FORBIDDEN:**
- Strategic planning
- Analyzing business requirements
- Making architectural decisions
- Defining project scope
- Setting objectives
- Creating instruction protocols

## 🔍 Violation Detection Patterns

### Planning Actor Violations

#### 1. Code Generation Detection
```regex
# Detects code blocks
/```[\s\S]*?```/g

# Detects function definitions
/function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|class\s+\w+/g

# Detects cat/EOF patterns
/cat\s*>\s*[\w\/.]+\s*<<\s*['"]?EOF/g
```

**Example Violation:**
```
❌ "Create a validator function like this:
function validate(data) {
  return data != null;
}"
```

**Correct Pattern:**
```
✅ "Create a validator function that:
- Accepts a data parameter
- Returns true if data is not null
- Returns false otherwise"
```

#### 2. Implementation Detail Detection
```regex
# Detects npm/yarn commands
/npm\s+(install|i)\s+|yarn\s+add/g

# Detects specific library mentions
/import\s+.*from\s+['"]|require\s*\(['"]|using\s+\w+\s+from/g

# Detects file path specifications
/src\/\w+\/\w+\.(ts|js|tsx|jsx)/g
```

**Example Violation:**
```
❌ "Install React with npm install react react-dom"
```

**Correct Pattern:**
```
✅ "Set up a modern UI framework for building user interfaces"
```

### Execution Actor Violations

#### 1. Strategic Planning Detection
```regex
# Detects planning language
/should\s+we|might\s+consider|recommend|strategy|approach/gi

# Detects analysis patterns
/analyze|evaluate|assess|determine\s+whether/gi

# Detects architectural decisions
/architecture|design\s+pattern|system\s+design/gi
```

**Example Violation:**
```
❌ // Should we use microservices architecture here?
❌ // I recommend using Redux for state management
```

**Correct Pattern:**
```
✅ // Implementing microservices architecture
✅ // Using Redux for state management
```

#### 2. Objective Setting Detection
```regex
# Detects objective language
/objective|goal|purpose|aim\s+is\s+to/gi

# Detects requirement analysis
/requirement|must\s+have|should\s+have|nice\s+to\s+have/gi
```

## 📊 Violation Severity Levels

### CRITICAL (Block Immediately)
- Planning Actor writing code
- Execution Actor refusing to implement
- Cross-actor role assumption
- Protocol bypass attempts

### HIGH (Requires Correction)
- Planning Actor specifying exact libraries
- Execution Actor asking strategic questions
- Unclear actor boundaries in instructions
- Mixed responsibilities in single message

### MEDIUM (Warning)
- Planning Actor being too specific
- Execution Actor providing recommendations
- Minor boundary overlaps
- Ambiguous instructions

### LOW (Advisory)
- Style inconsistencies
- Verbose instructions
- Redundant validations
- Minor protocol deviations

## 🛡️ Runtime Enforcement Checklist

### Pre-Execution Validation
- [ ] No code patterns in planning instructions
- [ ] No strategic decisions in execution code
- [ ] Clear actor identification
- [ ] Protocol format compliance
- [ ] Boundary enforcement active

### During Execution Monitoring
- [ ] Actor role adherence
- [ ] No boundary crossings
- [ ] Proper communication flow
- [ ] Protocol validation passing
- [ ] Violation logging active

### Post-Execution Verification
- [ ] Results match objectives
- [ ] No role violations occurred
- [ ] Audit trail complete
- [ ] Performance metrics captured
- [ ] Success criteria met

## 🚦 Visual Indicators

### Planning Mode Active
```
🧠 PLANNING MODE
├─ Strategic Analysis
├─ Instruction Generation
└─ No Code Generation
```

### Execution Mode Active
```
⚡ EXECUTION MODE
├─ Code Implementation
├─ Task Completion
└─ No Strategic Planning
```

### Violation Detected
```
🚨 BOUNDARY VIOLATION
├─ Actor: [Planning/Execution]
├─ Type: [Code in Planning/Strategy in Execution]
├─ Severity: [CRITICAL/HIGH/MEDIUM/LOW]
└─ Action: [Blocked/Corrected/Warned]
```

## 🔧 Quick Fixes

### Common Planning Actor Fixes
1. **Remove code blocks** → Replace with descriptions
2. **Remove specific libraries** → Use capability descriptions
3. **Remove file paths** → Use component descriptions
4. **Remove commands** → Describe desired outcomes

### Common Execution Actor Fixes
1. **Remove questions** → Make decisions
2. **Remove recommendations** → Implement directly
3. **Remove analysis** → Execute tasks
4. **Remove planning** → Follow instructions

## 📋 Validation Commands

### Check Planning Instructions
```typescript
validatePlanningInstructions(instruction: string): ValidationResult {
  const violations = [];
  
  // Check for code patterns
  if (containsCodePatterns(instruction)) {
    violations.push({
      type: 'CODE_IN_PLANNING',
      severity: 'CRITICAL'
    });
  }
  
  // Check for implementation details
  if (containsImplementationDetails(instruction)) {
    violations.push({
      type: 'IMPLEMENTATION_DETAILS',
      severity: 'HIGH'
    });
  }
  
  return { valid: violations.length === 0, violations };
}
```

### Check Execution Code
```typescript
validateExecutionCode(code: string): ValidationResult {
  const violations = [];
  
  // Check for strategic planning
  if (containsStrategicPlanning(code)) {
    violations.push({
      type: 'STRATEGY_IN_EXECUTION',
      severity: 'HIGH'
    });
  }
  
  // Check for requirements analysis
  if (containsRequirementsAnalysis(code)) {
    violations.push({
      type: 'ANALYSIS_IN_EXECUTION',
      severity: 'MEDIUM'
    });
  }
  
  return { valid: violations.length === 0, violations };
}
```

## 🎯 Remember

1. **Planning Actor**: Architect who draws blueprints, never holds a hammer
2. **Execution Actor**: Builder who constructs, never questions the blueprint
3. **Clear Boundaries**: No overlap, no exceptions, no compromises
4. **Enforce Always**: Every instruction, every execution, every time

---

*This cheatsheet is part of SessionHub's Two-Actor Model enforcement system. For detailed architecture documentation, see TWO-ACTOR-ARCHITECTURE.md*