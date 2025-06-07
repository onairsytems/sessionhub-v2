# SessionHub V2 Living Foundation Document

> Living document - Claude Code updates after each session
> Synced via Google Drive Desktop
> Version controlled in docs/foundation-versions/
> Version: 0.1.4 (Session 0.1.4 - EMERGENCY - Zero-Tolerance Error Policy)

## 🚨 EMERGENCY UPDATE: Zero-Tolerance Error Policy

### Critical Security Notice
**Version 0.1.4 implements MANDATORY zero-tolerance error enforcement**

This emergency update was necessary to prevent any attempts to bypass quality gates. The system now:

1. **Blocks all bypass attempts** - No --no-verify, no environment variable tricks
2. **Monitors continuously** - All git commands and config changes are logged
3. **Enforces TypeScript strict mode** - Cannot be disabled or weakened
4. **Requires zero errors** - No TypeScript errors, no ESLint warnings, no build failures
5. **Logs everything** - Full audit trail of all attempts

### Enforcement Systems
- Git wrapper script prevents bypass flags
- Pre-commit and post-commit hooks verify quality
- TypeScript guardian enforces strict configs
- Bypass monitor detects and alerts on attempts
- Build scripts require all validations to pass

### Developer Impact
- **NO WORKAROUNDS** - Fix errors, don't suppress them
- **FULL TRANSPARENCY** - All actions are logged
- **IMMEDIATE FEEDBACK** - Violations blocked in real-time
- **MANDATORY COMPLIANCE** - This policy is non-negotiable

See `/docs/ZERO_TOLERANCE_POLICY.md` for complete details.

---

## ⚠️ CRITICAL: The Two-Actor Model - Session Execution Methodology

### 🎭 Two Actors, Clear Roles

**Claude Chat = The Architect** (Instructions Only)
- Provides clear, detailed instructions
- NEVER writes actual code
- NEVER uses cat/EOF commands
- NEVER creates artifacts
- Trusts Claude Code completely

**Claude Code = The Builder** (Implementation Only)
- Receives instructions
- Writes all code
- Handles all file operations
- Executes everything in ONE script
- Reports back results

### ❌ WRONG Approach (Claude Chat Writing Code)
```
User: "Create a validation framework"
Claude Chat: "Here's the code:

cat > validator.js << 'EOF'
function validate() {
  // validation logic
}
EOF

Now run this command..."
```
**This is WRONG! Chat should NEVER write code!**

### ✅ RIGHT Approach (Claude Chat Giving Instructions)
```
User: "Create a validation framework"
Claude Chat: "I need you to execute a comprehensive script that:

1. Creates src/validation/validator.js with:
   - A BootstrapValidator class
   - Test methods for project structure
   - Git integration checks
   - Google Drive sync verification
   - Report generation

2. Creates tests/bootstrap/run-validation.sh as executable

3. Runs the validation and captures results

4. Updates Foundation document with results

5. Commits everything with descriptive message"
```
**This is RIGHT! Chat provides clear instructions, Code implements!**

## 📜 Critical Rules for Claude Chat

### The Five Golden Rules
1. **NEVER write code** - Only describe what code should do
2. **NEVER use cat/EOF** - That's Code's job
3. **NEVER create artifacts** - Everything happens in Code
4. **ALWAYS trust Claude Code** - It knows how to implement
5. **ALWAYS be the architect** - Design, don't build

### 📝 Session Request/Response Pattern

#### When User Says:
"I need Session X.Y: [Name] as a single comprehensive Claude Code script"
-OR-
"Let's start Session X.Y"

#### Claude Chat MUST Respond With:

```
claude-code "
Session X.Y: [Session Name]

OBJECTIVES:
1. [What to achieve, not how]
2. [What to achieve, not how]
3. [What to achieve, not how]

REQUIREMENTS:
- [What is needed, not technical details]
- [End result required, not specific libraries]
- [Functionality needed, not implementation]

FOUNDATION UPDATE:
- Update to version X.Y
- Add session to log
- Update next session pointer

VALIDATION:
- [How to verify success]
- [Expected outcomes]

COMMIT: 'Session X.Y: [Short Description] - Foundation vX.Y'
"
```

## 🎯 Current Focus: Emergency Error Enforcement

### Completed Emergency Measures (v0.1.4)
- ✅ Git wrapper to prevent --no-verify
- ✅ Enhanced pre-commit hooks
- ✅ Post-commit verification
- ✅ TypeScript config guardian
- ✅ Bypass monitoring service
- ✅ Zero-tolerance documentation
- ✅ Build script enforcement

### Quality Gates Now Enforced
1. **Pre-commit**: TypeScript, ESLint, Tests, Error Detection
2. **Build-time**: Strict validation before any build
3. **Post-commit**: Verification of commit quality
4. **Continuous**: Monitoring for bypass attempts

## 📂 Project Structure

### Foundation Documentation System
```
SessionHub V2/
├── docs/
│   ├── FOUNDATION.md (Primary - this file)
│   ├── ZERO_TOLERANCE_POLICY.md (NEW - Emergency policy)
│   └── foundation-versions/
│       ├── FOUNDATION-v0.1.md
│       ├── FOUNDATION-v0.1.1.md
│       ├── FOUNDATION-v0.1.2.md
│       ├── FOUNDATION-v0.1.3.md
│       └── FOUNDATION-v0.1.4.md (this version)
```

### Security and Monitoring
```
~/.sessionhub/
├── git-audit.log           # All git commands
├── bypass-attempts.log     # Bypass attempt records
├── tsconfig-violations.log # Config change attempts
├── critical-alerts.log     # Critical security events
└── security-report.md      # Weekly security reports
```

## 🔄 Session Execution Flow

1. **User Request** → Clear session objectives
2. **Claude Chat** → Provides ONLY instructions (no code!)
3. **Claude Code** → Implements everything in one script
4. **Validation** → All quality gates must pass
5. **Foundation Update** → Document the changes
6. **Clean Commit** → No errors, proper message

## 📈 Progress Tracking

### Sessions Completed
- Session 0.1: Bootstrap Validation ✅
- Session 0.1.1: Google Drive Integration ✅
- Session 0.1.2: Comprehensive Error Detection ✅
- Session 0.1.3: Enhanced Build Validation ✅
- Session 0.1.4: EMERGENCY - Zero-Tolerance Policy ✅

### Next Priority Sessions
- Session 0.2: Two-Actor Architecture Implementation
- Session 0.3: State Management System
- Session 0.4: Production Build Pipeline

## 🛡️ Quality Standards

### Zero-Tolerance Enforcement (NEW in v0.1.4)
- **NO bypass mechanisms allowed**
- **ALL errors must be fixed**
- **EVERY commit must pass all checks**
- **CONTINUOUS monitoring active**

### Code Quality Requirements
- TypeScript strict mode (enforced)
- Zero ESLint warnings
- All tests passing
- Clean git status
- No console.logs
- No error suppressions

### Security Requirements
- No hardcoded credentials
- No bypass attempts
- Full audit trail
- Regular security reports

## 📋 Session Checklist

Before ANY session:
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings
- [ ] All tests passing
- [ ] Clean git status
- [ ] Monitoring active

During session:
- [ ] Follow Two-Actor model
- [ ] Update Foundation document
- [ ] Run all validations
- [ ] Check for bypass attempts
- [ ] Verify quality gates

After session:
- [ ] Version Foundation update
- [ ] Create session report
- [ ] Verify no errors introduced
- [ ] Check security logs
- [ ] Clean commit with message

## 🚀 Next Session Preparation

**Session 0.2: Two-Actor Architecture Implementation**
- Formalize planning/execution separation
- Create actor boundary enforcement
- Implement instruction validation
- Add execution monitoring
- Update Foundation with architecture

---

**Remember**: 
- Claude Chat = Architect (instructions only)
- Claude Code = Builder (implementation only)
- Quality Gates = Mandatory (no bypassing)
- Zero Tolerance = Enforced (all violations logged)