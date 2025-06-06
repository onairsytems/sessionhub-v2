# SessionHub V2 Living Foundation Document

> Living document - Claude Code updates after each session
> Synced via Google Drive Desktop
> Version controlled in docs/foundation-versions/

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
- [What should work when done]
- [Expected outcomes]

COMMIT: 'Session X.Y: [Name] - Foundation vX.Y'
"
```

#### Example - Session 0.3 Response:

❌ **WRONG** (Too Specific):
- Create Next.js 14 with TypeScript configuration
- Install shadcn/ui component library
- Configure ESLint and Prettier

✅ **RIGHT** (Goal-Oriented):
- Create a modern web application for SessionHub
- Set up a UI component system
- Ensure code quality tools are in place

#### Remember:
- NO technical specifications (Claude Code chooses best tech)
- NO library names (unless absolutely critical to the mission)
- NO configuration details (implementation details)
- NO file paths (Code determines structure)
- ONLY objectives and requirements

Implementation details are Claude Code's responsibility. Specifying technologies limits Claude Code's ability to choose the best solution.

### Session Instruction Template
```
I need Session X.Y: [Name] as a comprehensive script that:

1. [High-level objective 1]
   - [Specific requirement]
   - [Expected outcome]

2. [High-level objective 2]
   - [Specific requirement]
   - [Expected outcome]

3. Updates Foundation document with:
   - [What to update]
   - [New information to add]

4. Validates all changes work correctly

5. Commits with message: "Session X.Y: [Description]"
```

## Document Metadata
- **Version**: 1.3.0
- **Document Version**: v0.3
- **Last Updated**: 2025-06-06 19:00:00 UTC
- **Last Session**: 0.3 - UI Foundation
- **Next Session**: 0.4 - Core Two-Actor Architecture
- **Version History**: docs/foundation-versions/VERSION-INDEX.md
- **Location**: ~/Google Drive/My Drive/SessionHub/FOUNDATION.md
- **Validation Status**: ✅ All systems operational

## 📚 Version Control
This document is version controlled:
- **Current**: FOUNDATION.md (always latest)
- **History**: docs/foundation-versions/FOUNDATION-v{X.Y}.md
- **Rollback**: Copy any version back to Google Drive location
- **Compare**: Use git diff to see changes between versions

## 🚀 Quick Start for New Chat

### Load and Verify Version
```bash
# First command in every new chat:
claude-code "
cd ~/Development/sessionhub-v2
echo 'Current Foundation version:' && head -20 docs/FOUNDATION.md | grep -E 'Version|Session'
echo '' && echo 'Version history:' && ls -la docs/foundation-versions/
echo '' && git log --oneline -5
"
```

### Run Bootstrap Validation
```bash
# Verify system integrity:
claude-code "
cd ~/Development/sessionhub-v2
./tests/bootstrap/run-validation.sh
"
```

## 📋 Project Overview
**Mission**: Build a personal development velocity platform that achieves speed through perfection
**Method**: Zero-error sessions via Two-Actor Model (Chat instructs, Code implements)
**Status**: Foundation established with validation framework

## 🏛️ Architectural Principles

### The Two-Actor Model IS SessionHub

SessionHub doesn't just use the Two-Actor Model for development - it embodies it as its core architecture:

- **Planning Actor** (Claude Chat API): Analyzes, strategizes, and generates instructions
- **Execution Actor** (Claude Code): Implements, builds, and executes tasks

This separation is fundamental to how SessionHub operates:

1. When users request work, SessionHub's Planning Engine (using Claude API) creates instructions
2. SessionHub's Execution Engine (using Claude Code) implements those instructions
3. All communication happens through a strict Instruction Protocol
4. The system enforces separation - planning modules cannot execute, execution modules cannot strategize

### Architectural Implementation Roadmap

- **Session 0.4**: Core Two-Actor Architecture
  - Planning Engine with Claude API integration
  - Execution Engine with Claude Code runner
  - Instruction Protocol definition
  - Architectural enforcement mechanisms

- **Session 0.5**: Protocol & Validation  
  - Protocol validators and formatters
  - Runtime enforcement
  - Architectural tests

### Why This Matters

This isn't just methodology - it's architecture. SessionHub will:
- Refuse to let planning components write code
- Refuse to let execution components make strategic decisions  
- Validate every instruction before execution
- Self-document through its structure

The result: A system that demonstrates its own best practices through its architecture.

## 🎯 Example: How Session 0.2 Should Have Been Written

### The Instructions (What Chat Should Say):
```
claude-code "
Session 0.2: Bootstrap Validation

OBJECTIVES:
1. Create a comprehensive validation system for SessionHub
2. Ensure all core systems are functioning correctly
3. Establish automated validation that can run before each session

REQUIREMENTS:
- Validation framework that tests project integrity
- Ability to verify Git repository health
- Confirmation that Google Drive sync is working
- Version control system validation
- Clear reporting of validation results

FOUNDATION UPDATE:
- Update to version 0.2
- Add validation framework documentation
- Include new quick start commands

VALIDATION:
- All tests should pass when validation runs
- Clear success/failure reporting
- Exit codes reflect validation status

COMMIT: 'Session 0.2: Bootstrap Validation - Foundation v0.2'
"
```

Notice: NO mention of specific files, class names, or technical implementation. Claude Code determines the best way to implement these objectives.

### NOT This (What Chat Should Never Do):
```
Here's the validation code:
cat > validator.js << 'EOF'
class Validator {
  // ... actual code ...
}
EOF
```

## 🏗️ Current State

### Completed Sessions
1. **Session 0.1**: Project Initialization ✅
   - Foundation Version: v0.1
   - Single script execution
   - Version control established

2. **Session 0.2**: Bootstrap Validation ✅
   - Foundation Version: v0.2
   - Validation framework created
   - All systems verified operational

3. **Session 0.3**: UI Foundation ✅
   - Foundation Version: v0.3
   - Modern web interface created with Next.js 14
   - Component system with Button, Card, ThemeToggle
   - Light/Dark theme with persistence
   - Fully responsive design
   - SessionHub logo integrated
   - Navigation system implemented

### Next Session: 0.4 - Core Two-Actor Architecture
Request: "I need Session 0.4: Core Two-Actor Architecture as a comprehensive script"

**The script will implement**:
1. Planning Engine with Claude API integration
2. Execution Engine with Claude Code integration
3. Instruction Protocol with schema validation
4. Actor separation enforcement
5. System orchestration layer

## 🧪 Validation Framework

### Bootstrap Validator
Located at: `src/validation/validator.js`

**Tests**:
- Project Structure ✅
- Git Integration ✅
- Google Drive Sync ✅
- Version Control ✅
- Foundation Integrity ✅

### Running Validation
```bash
# Quick validation check
./tests/bootstrap/run-validation.sh

# Or directly
node src/validation/validator.js
```

### Validation Report
Generated at: `tests/bootstrap/validation-report.md`

## 🎨 UI Architecture

### Technology Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **Components**: Custom UI component library
- **Icons**: Lucide React
- **Theme**: Light/Dark mode with system preference detection

### Component Inventory
- **Button**: Primary, Secondary, Ghost, Destructive variants
- **Card**: Container with Header, Content, Footer sections
- **ThemeToggle**: Sun/Moon icon toggle with persistence
- **Navigation**: Responsive nav with mobile menu

### Design System
- **Colors**: Extended palette with primary blues and neutral grays
- **Typography**: Inter font family
- **Animations**: Fade-in, slide-in, bounce-in effects
- **Responsive**: Mobile-first with breakpoints at sm, md, lg, xl

### Key Features
- ✅ SessionHub logo displayed prominently
- ✅ Theme persistence via localStorage
- ✅ Smooth theme transitions
- ✅ Mobile-responsive navigation
- ✅ Accessible components with ARIA labels
- ✅ Tailwind dark mode with class strategy

## 📊 Version Control Benefits

1. **History**: See how decisions evolved
2. **Rollback**: Restore previous states easily
3. **Comparison**: `git diff` between versions
4. **Debugging**: Track when changes were introduced
5. **Learning**: Review your journey

## 🔄 Version Management Commands

### View Version History
```bash
claude-code "
cd ~/Development/sessionhub-v2
ls -la docs/foundation-versions/
cat docs/foundation-versions/VERSION-INDEX.md
"
```

### Compare Versions
```bash
claude-code "
cd ~/Development/sessionhub-v2
diff docs/foundation-versions/FOUNDATION-v0.1.md docs/foundation-versions/FOUNDATION-v0.2.md
"
```

### Rollback to Previous Version
```bash
claude-code "
cd ~/Development/sessionhub-v2
# Rollback to v0.1
cp docs/foundation-versions/FOUNDATION-v0.1.md ~/Google\ Drive/My\ Drive/SessionHub/FOUNDATION.md
echo 'Rolled back to version 0.1'
"
```

## 📝 Session Log

### Session 0.1: Project Initialization ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.1
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.1.md

### Session 0.2: Bootstrap Validation ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.2
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.2.md
- **Key Achievement**: Validation framework operational

### Foundation Update: Architectural Principles Added
- **Date**: 2025-06-06
- **Version**: 1.2.2
- **Key Addition**: Documented Two-Actor Model as core SessionHub architecture
- **Impact**: Defined Sessions 0.4 and 0.5 for architectural implementation

### Foundation Update: Session Request/Response Pattern Added
- **Date**: 2025-06-06  
- **Version**: 1.2.3
- **Key Addition**: Clear session request/response pattern for Claude Chat
- **Impact**: Ensures proper separation of objectives from implementation
- **Key Principle**: NO technical specifications in instructions

### Session 0.3: UI Foundation ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.3
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.3.md
- **Key Achievements**: 
  - Next.js 14 web application with TypeScript
  - Custom component library (Button, Card, ThemeToggle)
  - Light/Dark theme with persistence
  - Responsive navigation system
  - SessionHub logo integration
  - Professional design with animations

## 🚨 Version Control Rules

1. **Before Each Session**: Previous version is automatically saved
2. **After Each Session**: New version is created
3. **Version Naming**: Always matches session number
4. **No Manual Editing**: Only update via session scripts
5. **Git Tracks Everything**: Both current and all versions

## ✅ Enhanced Checklist

Starting a session:
- [ ] Check current version with quick start command
- [ ] Run bootstrap validation to ensure integrity
- [ ] Verify version history is intact
- [ ] Request instructions using the Two-Actor Model
- [ ] Let Claude Code handle ALL implementation

After completion:
- [ ] New version file exists in foundation-versions/
- [ ] VERSION-INDEX.md is updated
- [ ] Git commit includes version info
- [ ] Google Drive has latest version
- [ ] Run validation to confirm success

## 🎓 The Power of the Two-Actor Model

**Why This Works**:
- **Clear Separation**: No confusion about who does what
- **Better Quality**: Each actor focuses on their strength
- **Faster Execution**: No back-and-forth corrections
- **Zero Errors**: Instructions are clear, implementation is precise
- **Perfect History**: Every session is reproducible

**Remember**: 
- Claude Chat = Architect (instructions only)
- Claude Code = Builder (implementation only)
- Never mix the roles!

---
**Version**: v0.2 | **Session**: 0.2 | **Next**: 0.3

**Remember**: Every session follows the Two-Actor Model for perfect execution!