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
- **Version**: 1.10.0
- **Document Version**: v0.6.3
- **Last Updated**: 2025-06-06 00:30:00 UTC
- **Last Session**: 0.6.1 - UI Analysis and Electron Migration
- **Next Session**: 1.0 - Production Release Preparation
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
**Platform**: Local Mac application with cloud-primary storage
**Method**: Zero-error sessions via Two-Actor Model (Chat instructs, Code implements)
**Status**: Foundation established with validation framework

## 🏛️ Architectural Principles

### The Two-Actor Model IS SessionHub

SessionHub doesn't just use the Two-Actor Model for development - it embodies it as its core architecture. As a local Mac application, SessionHub runs entirely on your machine while leveraging cloud services for intelligence and persistence:

- **Planning Actor** (Claude Chat API): Analyzes, strategizes, and generates instructions
- **Execution Actor** (Claude Code): Implements, builds, and executes tasks

This separation is fundamental to how SessionHub operates locally:

1. When users request work, SessionHub's Planning Engine (running locally) calls Claude API to create instructions
2. SessionHub's Execution Engine (local process) implements those instructions on your Mac
3. All communication happens through a strict Instruction Protocol
4. The system enforces separation - planning modules cannot execute, execution modules cannot strategize
5. Results are stored in Supabase for cross-project learning while maintaining local performance

### Architectural Implementation Roadmap

- **Session 0.4**: Core Two-Actor Architecture ✅
  - Planning Engine with Claude API integration
  - Execution Engine with Claude Code runner
  - Instruction Protocol definition
  - Architectural enforcement mechanisms

- **Session 0.5**: Orchestration & API Integration ✅
  - Complete orchestration layer
  - Real Claude API integration
  - Session management and workflow
  - Production-ready architecture

- **Session 0.6**: Local Installation & Setup
  - Mac app packaging and distribution
  - Menu bar and dock integration
  - Auto-update mechanism
  - Local security (code signing, notarization)
  - macOS permissions handling

- **Session 0.7**: Cloud-Primary Data Persistence with Local Cache
  - Supabase as primary database for all sessions
  - Local SQLite for offline work and caching
  - Sync strategy between local and cloud
  - Cross-project pattern recognition via cloud data
  - Planning Actor accesses vast cloud history

- **Session 0.8**: Mac System & Platform Integration
  - Deep macOS integration (file system, notifications)
  - Apple Silicon optimization
  - Keychain integration for credentials
  - External service connectors (GitHub, Linear, etc.)
  - Local process and shell management

### Why This Matters

This isn't just methodology - it's architecture. SessionHub will:
- Refuse to let planning components write code
- Refuse to let execution components make strategic decisions  
- Validate every instruction before execution
- Self-document through its structure

The result: A system that demonstrates its own best practices through its architecture.

## 🌐 Extended Architecture: Cloud-Primary Storage & Local Integration

### Cloud-Primary Data Persistence with Local Cache (Session 0.7)

SessionHub's local Mac app uses Supabase as its primary database, enabling the Planning Actor to learn from ALL your development history across every project and machine:

**Cloud-First Architecture**
- Supabase serves as the single source of truth for all session data
- Every session, instruction, and result synced to cloud immediately
- Local SQLite database acts as cache for offline work and performance
- Automatic sync when connection restored

**Planning Actor Intelligence Enhancement**
- Accesses complete history from Supabase when generating instructions
- Cross-project pattern recognition: "You solved this in Project X like this..."
- Learning from thousands of sessions across all your work
- Context-aware suggestions based on your entire development history

**Local Performance & Offline Capability**
- Recent sessions cached locally for instant access
- Full offline mode with local SQLite fallback
- Background sync to Supabase when online
- Intelligent cache management (LRU, size limits)

**Data Flow Architecture**
```
Local Mac App → Local Cache → Supabase (Primary) → Claude API
     ↑              ↓              ↓                    ↓
     └──────────────┴──────────────┴────────────────────┘
                    (Continuous Sync Loop)
```

**Security & Privacy**
- All data encrypted in transit and at rest
- Mac Keychain stores Supabase credentials
- Row-level security in Supabase
- Local cache encrypted with user-specific key

### Mac System & Platform Integration (Session 0.8)

As a native Mac application, SessionHub deeply integrates with macOS while providing connectors to external services:

**Primary: Local Mac System Integration**
- **File System**: Deep Finder integration, Quick Look support, file tagging
- **macOS Notifications**: Native notification center with actions
- **Menu Bar**: Persistent status, quick actions, session monitoring
- **Dock Integration**: Progress indicators, badge counts, jump lists
- **Apple Silicon**: Native M1/M2/M3 optimization for performance
- **Keychain Services**: Secure credential storage using macOS Keychain
- **Spotlight**: Index sessions for system-wide search
- **Shortcuts App**: Automate SessionHub with Apple Shortcuts
- **Universal Clipboard**: Share between Mac, iPhone, iPad
- **Time Machine**: Automatic backup compatibility

**Secondary: External Platform Connectors**
- **GitHub**: Repository management via local app
- **Linear**: Issue tracking with native Mac UI
- **Supabase**: Already integrated as primary storage
- **Vercel**: Deployment monitoring from menu bar
- **Slack**: Native notifications and quick replies
- **VS Code/Cursor**: Direct IDE integration

**Mac-Specific Security**
- Code signing with Apple Developer ID
- Notarization for Gatekeeper approval
- App Sandbox for security isolation
- Hardened runtime protection
- TCC (Transparency, Consent, Control) compliance

**Local Process Management**
- Launch agents for background sync
- XPC services for privilege separation
- Activity Monitor integration
- Energy efficiency on battery
- Automatic Light/Dark mode support

## 🚀 Future Development Roadmap: Extended Capabilities

After the 1.0 release, SessionHub will expand with major capability enhancements that build on the core Two-Actor Model and local+cloud hybrid architecture. Each represents a major version milestone:

### 2.0: MCP (Model Context Protocol) Integration Platform
Transform SessionHub into a universal integration hub by implementing MCP support:

- **Core MCP Integrations**: Built-in support for Zapier, Figma, GitHub, Linear, and dozens of popular services
- **MCP Project Enhancement**: Ability for SessionHub to automatically add MCP capabilities to projects it creates
- **Extensible Framework**: Developer-friendly SDK for creating custom MCP integrations
- **Local MCP Server**: Runs within SessionHub on your Mac, providing secure local-first integration
- **Visual Integration Builder**: Drag-and-drop interface for connecting services without code
- **Integration Marketplace**: Share and discover community-built MCP integrations

*Architecture*: Local MCP server processes requests on your Mac, with optional cloud sync for shared integrations. The Planning Actor learns from successful integration patterns across all projects.

### 3.0: Integrated Design-to-Code Development Environment
Evolve SessionHub into a full development environment that bridges design and code:

- **IDE Interface**: Built-in code editor with syntax highlighting, IntelliSense, and debugging
- **Real-time Figma Integration**: Live sync via MCP - design changes instantly update code
- **Visual Preview**: Side-by-side design and code views with hot reloading
- **Component Generation**: Automatically generate React/Vue/Swift components from Figma
- **Iterative Workflow**: Design tweaks trigger code updates, code changes reflect in mockups
- **Local Rendering**: All preview and compilation happens on your Mac for speed

*Architecture*: Figma designs sync to local cache, Planning Actor analyzes design patterns from Supabase history, Execution Actor generates optimized code locally.

### 4.0: Enterprise Cloud Deployment Management
Position SessionHub as the control center for enterprise SaaS development:

- **Local-to-Cloud Pipeline**: Design, develop, and test enterprise platforms entirely on your Mac
- **One-Click Multi-Cloud**: Deploy to AWS, GCP, Azure, and Vercel from SessionHub's UI
- **Production Mirroring**: Local testing environment that exactly replicates production
- **Infrastructure as Code**: Automated Terraform/CloudFormation generation
- **Multi-Cloud Orchestration**: Manage resources across providers from one interface
- **GitOps Integration**: Automatic deployments triggered by git pushes
- **Rollback Management**: One-click rollback with full state preservation

*Architecture*: Local simulation of cloud environments, with actual deployments managed through secure API connections. All deployment history stored in Supabase for pattern learning.

### 5.0: Intelligent Project Cost Estimator
Provide real-time cost intelligence for every project decision:

- **Live Cost Calculation**: See infrastructure costs update as you design
- **Multi-Provider Comparison**: Side-by-side AWS vs GCP vs Azure vs Vercel pricing
- **Scaling Projections**: Model costs at 1K, 10K, 100K, 1M users
- **Service Substitution**: AI suggests cheaper alternatives with same functionality
- **Budget Forecasting**: Monthly and annual projections with seasonality
- **Cost Alerts**: Notifications when approaching budget thresholds
- **Billing API Integration**: Pull actual costs from cloud providers

*Architecture*: Local cost modeling with cloud pricing data cached, Planning Actor learns cost patterns from all SessionHub projects to improve estimates.

### 6.0: Cross-Project Pattern Recognition and Learning
Unlock the full potential of collective development intelligence:

- **Pattern Mining**: AI analyzes all projects in Supabase to identify successful patterns
- **Solution Suggestions**: "3 similar projects solved this with pattern X"
- **Code Recommendations**: Proven snippets from your past successes
- **Architecture Templates**: Blueprints derived from high-performing projects
- **Performance Insights**: "Projects using pattern A are 40% faster"
- **Team Patterns**: Learn from how your team collaborates best
- **Failure Prevention**: "5 projects failed with this approach, try Y instead"
- **Evolution Tracking**: See how solutions improve over time

*Architecture*: Planning Actor gains access to anonymized patterns from entire SessionHub community (with consent), while keeping your code private. Local analysis with cloud-powered insights.

### Integration Philosophy
Each capability expansion maintains SessionHub's core principles:
- **Local-First**: Your Mac is the control center, cloud enhances but never requires
- **Two-Actor Separation**: Planning analyzes and suggests, Execution implements locally
- **Privacy by Design**: Your code stays local unless you explicitly share
- **Speed Through Intelligence**: Collective learning makes every project faster
- **Zero-Error Goal**: Pattern recognition helps avoid known pitfalls

These capabilities transform SessionHub from a development assistant into a comprehensive development platform while maintaining its Mac-native, local-first architecture.

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

4. **Session 0.4**: Core Two-Actor Architecture ✅
   - Foundation Version: v0.4
   - Planning and Execution engines implemented
   - Strict boundary enforcement
   - Complete test suite

5. **Session 0.5**: Orchestration & API Integration ✅
   - Foundation Version: v0.5
   - Complete orchestration system
   - Claude API integration
   - Production-ready architecture

6. **Session 0.6.1**: UI Analysis and Electron Migration ✅
   - Foundation Version: v0.6.1
   - Analyzed and migrated Next.js UI to Electron
   - Implemented native Mac menu bar with standard shortcuts
   - Added connection status indicators for local/cloud sync
   - Created native notifications and dock badge support
   - Configured auto-updater functionality
   - Updated all UI messaging to reflect local Mac app nature
   - Enhanced security with code signing and notarization setup

### Session 0.5: Orchestration & API Integration ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.5
- **Key Achievements**:
  - Complete orchestration layer implementation
  - SessionManager for session lifecycle management
  - ActorCoordinator for Planning/Execution communication
  - WorkflowEngine for step-by-step instruction flow
  - StateManager for persistent system state
  - Claude API integration with secure credential management
  - SystemOrchestrator tying everything together
  - Request queue with priority processing
  - Comprehensive monitoring and metrics
  - End-to-end integration tests

### Session 0.6.1: UI Analysis and Electron Migration ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.6.1
- **Key Achievements**:
  - Enhanced Electron configuration with native Mac features
  - Implemented native Mac menu bar with File, Edit, View, Window, Help menus
  - Added connection status component showing Supabase/Claude API status
  - Created dock menu with quick actions and recent projects
  - Integrated auto-updater with user notifications
  - Updated all UI text to reflect local Mac app paradigm
  - Added deep linking support (sessionhub:// protocol)
  - Configured Mac app security (entitlements, code signing ready)
  - Native notifications and dock badge functionality
  - Updated package.json and electron-builder.yml for production builds

### Next Session: 1.0 - Production Release Preparation
Request: "I need Session 0.6: Local Mac App Installation & Setup as a comprehensive script"

**The script will implement**:
1. Mac app bundle creation and packaging
2. Code signing and notarization process
3. Menu bar and dock integration
4. Auto-update mechanism (Sparkle framework)
5. Local installation and first-run experience
6. macOS permissions setup (file access, notifications)

### Future Sessions:

**Session 0.7: Cloud-Primary Data Persistence**
- Supabase database schema for session history
- Local SQLite cache implementation
- Sync engine between local and cloud
- Offline mode handling
- Cross-project pattern recognition queries
- Planning Actor cloud history integration

**Session 0.8: Mac System Integration**
- Deep macOS integration features
- Apple Silicon optimization
- Keychain Services for credentials
- Spotlight and Shortcuts support
- External platform connectors
- Menu bar app functionality

**Session 1.0: Production Release Preparation**
- Final testing and optimization
- App Store submission preparation
- Documentation and user guides
- Marketing website launch
- Beta program completion
- Official release

## 🔄 SessionHub Self-Development Workflow

After 1.0 release, SessionHub will use itself for all ongoing development, creating a powerful self-improvement loop. This isn't just dogfooding - it's the ultimate validation of the Two-Actor Model.

### SessionHub Developing SessionHub

The production SessionHub instance becomes the primary development tool for its own evolution:

- **Production Instance**: Stable version used by all users
- **Development Instance**: Parallel installation for testing changes
- **Two-Actor Enforcement**: Every update follows Planning/Execution separation
- **Session-Based Development**: Each bug fix or feature is a formal session
- **Infinite Improvement**: SessionHub learns from developing itself

### Development Workflow

**1. Production Issue Detection**
- User bug reports flow into SessionHub's issue tracker
- Performance monitoring identifies bottlenecks automatically
- Error collection system aggregates crash reports
- Planning Actor analyzes patterns across all issues
- Priority scoring based on user impact and frequency

**2. Development Session Creation**
- New session initiated in development SessionHub instance
- Planning Actor reviews issue data from Supabase
- Comprehensive instructions generated for fix/feature
- Execution Actor implements changes in development branch
- All code changes maintain architectural boundaries

**3. Safe Testing Pipeline**
- Changes validated in development instance first
- Automated test suite runs on every change
- Beta testing with volunteer projects
- Performance benchmarks compared to production
- Rollback points created at each milestone

**4. Production Update Process**
- SessionHub packages its own updates using electron-builder
- Auto-updater downloads updates in background
- Users prompted during low-activity periods
- Previous version retained for instant rollback
- Update applied with zero data loss or downtime
- Post-update validation confirms success

**5. Version Management**
- Production runs latest stable (e.g., 1.0.0)
- Development runs ahead (e.g., 1.1.0-dev)
- Each session increments minor version
- Major versions for new capabilities
- Git tags mark every production release
- Changelog auto-generated from sessions

### Self-Improvement Features

**Automatic Optimization**
- SessionHub monitors its own performance metrics
- Memory usage, CPU patterns, response times tracked
- Planning Actor suggests optimization sessions
- Successful optimizations propagate to all users
- Performance regression alerts trigger fix sessions

**Learning From Usage**
- Every project provides telemetry (with consent)
- Common error patterns identified across users
- Frequently used workflows get optimization priority
- Unused features marked for removal or improvement
- UI/UX improvements based on actual usage data

**Architecture Evolution**
- Planning Actor analyzes architectural patterns
- Suggests refactoring when patterns emerge
- Gradual migration to better architectures
- Backward compatibility maintained
- Documentation updates with each change

### Emergency Procedures

**Hot-Fix Workflow**
1. Critical bug detection triggers emergency session
2. Minimal fix developed in isolation
3. Fast-track testing on affected systems
4. Immediate release through update channel
5. Full fix developed in next regular session

**Recovery Options**
- Direct Claude Chat access for manual intervention
- Command-line rollback to any version
- Diagnostic mode bypasses normal startup
- Recovery console for database repairs
- Safe mode disables problematic features

**Manual Override**
- Break glass: Direct file system access
- SQL console for Supabase corrections
- Process manager for killing stuck operations
- Log aggregation for forensic analysis
- Remote assistance capability (with consent)

### Continuous Improvement Loop

**Data-Driven Development**
1. Every SessionHub project generates usage data
2. Patterns identified across thousands of sessions
3. Most successful patterns become defaults
4. Failed patterns trigger warning systems
5. Planning Actor learns from entire ecosystem

**Regular Optimization Sessions**
- Weekly: Performance and bug fix sessions
- Monthly: Feature improvement sessions
- Quarterly: Architecture review sessions
- Yearly: Major capability planning sessions
- Continuous: Security update sessions

**Enforced Best Practices**
- Two-Actor Model validated on every change
- Code review by Planning Actor before merge
- Execution Actor cannot modify architecture
- All changes tracked in Supabase
- Audit trail for every modification

### Technical Implementation

**Development Environment Isolation**
- Separate ~/Library/Application Support/SessionHub-Dev
- Different port numbers for IPC
- Isolated Supabase development project
- Independent Claude API quota
- Separate crash reporting channel

**Update Distribution**
- GitHub Releases for version control
- Auto-updater checks hourly
- Delta updates for bandwidth efficiency
- Cryptographic signatures on all updates
- Rollback packages cached locally

**Telemetry and Privacy**
- Opt-in anonymous usage statistics
- No code or project data collected
- Only performance and error metrics
- Local aggregation before transmission
- User controls in preferences

### The Infinite Loop Advantage

By using itself for development, SessionHub creates unique advantages:

1. **Ultimate Dogfooding**: Every bug is found by the developers first
2. **Rapid Iteration**: Changes tested in real development scenarios
3. **Pattern Learning**: SessionHub learns from its own development
4. **Quality Assurance**: If it breaks SessionHub, it never ships
5. **Feature Validation**: Only useful features survive self-use

This self-development capability transforms SessionHub from a static tool into a living, evolving platform that improves with every session, learning from both its users and itself.

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

## 🏛️ Two-Actor Architecture Implementation

### Core Components (Session 0.4)
- **PlanningEngine**: Generates instructions from user requests
  - Analyzes context and requirements
  - Builds structured instruction protocols
  - Validates no code patterns are included
  
- **ExecutionEngine**: Executes instructions safely
  - Parses and validates instruction protocols
  - Runs in sandboxed environment with timeouts
  - Cannot make strategic decisions
  
- **ActorBoundaryEnforcer**: Prevents boundary violations
  - Validates operations match actor type
  - Detects forbidden patterns in content
  - Creates boundary proxies for runtime enforcement
  
- **ProtocolValidator**: Ensures proper communication
  - Validates instruction protocol structure
  - Detects code patterns in planning
  - Detects strategic language in execution
  
- **Logger & AuditLogger**: Comprehensive tracking
  - All operations are logged with correlation IDs
  - Immutable audit trail for compliance
  - Performance metrics and error tracking
  
- **ErrorHandler**: Graceful failure management
  - Severity-based error classification
  - Recovery strategies (retry, rollback, compensate)
  - Critical error alerting

### Architecture Validation
Comprehensive test suite proves:
- Planning cannot include code
- Execution cannot make decisions
- Boundaries are enforced at runtime
- All operations are auditable
- Errors are handled gracefully

## 🎯 Local App Orchestration Architecture (Session 0.5)

### SystemOrchestrator
The main process running on your Mac that coordinates all components:
- Manages session lifecycle within the local app
- Coordinates Planning and Execution as separate local processes
- Handles request queuing in local memory
- Monitors system resources and performance
- Connects to cloud services (Claude API, Supabase)

### Local Process Components
- **SessionManager**: Tracks sessions in the Mac app
  - Manages concurrent session limits based on Mac resources
  - Syncs session history to Supabase
  - Handles local state persistence

- **ActorCoordinator**: Manages local process communication
  - Routes requests between Planning and Execution processes
  - Uses XPC for secure inter-process communication
  - Monitors process health and restarts if needed

- **WorkflowEngine**: Manages instruction flow locally
  - Tracks progress with native progress indicators
  - Updates menu bar and dock badges
  - Provides real-time status updates

- **StateManager**: Local and cloud state management
  - Saves state to ~/Library/Application Support/SessionHub
  - Syncs critical state to Supabase
  - Handles app restart and crash recovery

### Cloud Service Integration
- **ClaudeAPIClient**: Connects to Anthropic's Claude API
  - Uses Mac Keychain for API key storage
  - Respects system proxy settings
  - Handles offline mode gracefully

- **SupabaseSync**: Manages cloud persistence
  - Background sync of sessions to cloud
  - Pulls historical data for Planning Actor
  - Handles conflict resolution

### Mac App Features
- Menu bar presence with quick actions
- Native notifications via Notification Center
- Dock integration with progress badges
- Launch at login option
- Energy-efficient background processing
- Automatic Light/Dark mode switching

## 🎨 UI Architecture

### Native Mac App Architecture (Session 0.6.1)
- **Platform**: Electron with Next.js renderer
- **Main Process**: Native Mac integration, menu bar, dock
- **Renderer Process**: React/Next.js UI running in Chromium
- **IPC Bridge**: Secure communication via contextBridge
- **Native Features**: Notifications, file system, Keychain

### Technology Stack
- **Framework**: Next.js 14 in Electron renderer
- **Desktop**: Electron 34 with native Mac APIs
- **Styling**: Tailwind CSS with custom design system
- **Components**: Custom UI component library
- **Icons**: Heroicons (migrated from Lucide)
- **Theme**: Light/Dark mode following macOS preference

### Native Mac Features
- **Menu Bar**: Full native menu with keyboard shortcuts
- **Dock Integration**: Badge counts, progress indicators
- **Connection Status**: Real-time cloud service indicators
- **Notifications**: Native macOS notification center
- **Deep Linking**: sessionhub:// protocol support
- **Auto Updates**: Electron-updater with user notifications

### Component Inventory
- **Button**: Primary, Secondary, Ghost, Destructive variants
- **Card**: Container with Header, Content, Footer sections
- **ThemeToggle**: Sun/Moon icon toggle with persistence
- **Navigation**: Responsive nav with mobile menu
- **ConnectionStatus**: Shows Supabase/Claude API status
- **EmptyState**: Welcome screen for new users

### Design System
- **Colors**: Extended palette with primary blues and neutral grays
- **Typography**: System font stack following macOS
- **Animations**: Fade-in, slide-in, bounce-in effects
- **Responsive**: Adaptive to window resizing
- **Mac Styling**: Vibrancy, traffic light position

### Key Features
- ✅ SessionHub running as native Mac application
- ✅ Clear messaging about local app nature
- ✅ Cloud services shown as external connections
- ✅ Offline capability indicators
- ✅ Native file system access
- ✅ Mac Keychain integration for credentials
- ✅ Code signing and notarization ready

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

### Session 0.4: Core Two-Actor Architecture ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.4
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.4.md
- **Key Achievements**:
  - Core architecture implementing Two-Actor Model
  - PlanningEngine generates instructions without code
  - ExecutionEngine executes in sandboxed environment
  - InstructionProtocol for structured communication
  - ActorBoundaryEnforcer prevents violations
  - ProtocolValidator ensures separation
  - Comprehensive logging and audit system
  - Error handling with recovery strategies
  - Complete test suite validating architecture

### Session 0.5: Orchestration & API Integration ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.5
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.5.md
- **Key Achievements**:
  - SessionManager manages complete session lifecycle
  - ActorCoordinator orchestrates Planning/Execution actors
  - WorkflowEngine tracks instruction flow through phases
  - StateManager persists system state with snapshots
  - ClaudeAPIClient integrates with Anthropic API
  - CredentialManager secures API keys with encryption
  - SystemOrchestrator provides unified interface
  - Request queue with priority-based processing
  - Monitoring system with health checks and metrics
  - Integration tests validate end-to-end flow

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
**Version**: v0.5 | **Session**: 0.5 | **Next**: 0.6

**Remember**: Every session follows the Two-Actor Model for perfect execution!