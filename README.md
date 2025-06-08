# SessionHub V2

[![Quality Check](https://github.com/onairsytems/sessionhub-v2/actions/workflows/quality-check.yml/badge.svg)](https://github.com/onairsytems/sessionhub-v2/actions/workflows/quality-check.yml)

> AI-Powered Development Environment - Revolutionizing Software Creation Through Self-Development

## Overview

SessionHub is an advanced AI-powered development platform that fundamentally transforms how software is created. By leveraging a unique two-actor architecture (Planning and Execution actors), SessionHub enables autonomous software development with human oversight.

### Key Features
- **Two-Actor Architecture**: Separate Planning and Execution actors for optimal task management
- **Self-Development Capability**: The system can autonomously improve itself
- **Session-Based Workflow**: Structured development through organized sessions
- **Real-Time Error Detection**: Comprehensive error monitoring and prevention
- **GitHub Integration**: Full version control and collaboration support
- **Enterprise-Ready**: Designed for production deployment and scalability

## Repository Information
- **GitHub**: [https://github.com/onairsytems/sessionhub-v2](https://github.com/onairsytems/sessionhub-v2)
- **License**: Proprietary
- **Status**: Active Development

## Current Status
- **Version**: 1.2.2
- **Phase**: Production Development
- **Architecture**: Two-Actor System Operational
- **Last Session**: 1.2.2 - Strict Build Validation
- **Foundation**: v1.2.2

## Quick Start

```bash
# Clone the repository
git clone https://github.com/onairsytems/sessionhub-v2.git
cd sessionhub-v2

# Install dependencies (automatically installs quality gates)
npm install

# Run validation
npm run validate

# Start development
npm run dev
```

## Quality Gates (MANDATORY)

SessionHub enforces strict quality standards through automated gates that **cannot be disabled**:

### Automatic Installation
Quality gates are automatically installed when you run `npm install`. This includes:
- Git hooks for pre-commit and post-commit validation
- TypeScript strict mode enforcement
- ESLint zero-tolerance configuration
- Security scanning for hardcoded secrets
- File size limits (1MB max)
- Commit message standards

### Manual Installation
If you need to reinstall the quality gates:
```bash
./scripts/install-quality-gates.sh
```

### What Gets Checked
1. **TypeScript Compilation** - All code must compile without errors
2. **ESLint Validation** - Zero warnings or errors allowed
3. **No Error Suppression** - @ts-ignore, @ts-nocheck, eslint-disable are forbidden
4. **Security Scanning** - No hardcoded secrets or credentials
5. **File Size Limits** - All source files must be under 1MB
6. **Commit Standards** - Meaningful commit messages required

### Bypass Prevention
- The `--no-verify` flag is **blocked and logged**
- All bypass attempts are recorded to `~/.sessionhub/bypass-attempts.log`
- Git commands are wrapped to enforce quality checks
- TypeScript configuration changes are monitored and prevented

### Audit Trail
All git operations are logged for security and compliance:
- Commit history: `~/.sessionhub/commit-audit.log`
- Quality violations: `~/.sessionhub/quality-violations.log`
- Bypass attempts: `~/.sessionhub/bypass-attempts.log`

### Zero Tolerance Policy
SessionHub implements a **Zero Tolerance Policy** for code quality. See [`docs/ZERO_TOLERANCE_POLICY.md`](docs/ZERO_TOLERANCE_POLICY.md) for details.

## Architecture

SessionHub employs a sophisticated two-actor architecture:

1. **Planning Actor**: Handles task orchestration, session management, and high-level decision making
2. **Execution Actor**: Performs actual code generation, file operations, and implementation tasks

This separation ensures clean boundaries, better error handling, and more predictable behavior.

## Documentation

- **Foundation Document**: [`docs/FOUNDATION.md`](docs/FOUNDATION.md) - Complete project specification
- **Architecture**: [`docs/architecture/TWO-ACTOR-ARCHITECTURE.md`](docs/architecture/TWO-ACTOR-ARCHITECTURE.md)
- **API Setup**: [`docs/API_SETUP_GUIDE.md`](docs/API_SETUP_GUIDE.md)
- **Production Guide**: [`docs/PRODUCTION_RELEASE.md`](docs/PRODUCTION_RELEASE.md)

## Development

SessionHub uses a session-based development approach:

1. Each development task is organized as a "session"
2. Sessions have clear objectives, requirements, and validation criteria
3. Progress is tracked through the Foundation document
4. All changes are version controlled with meaningful commits

## Contributing

SessionHub is currently in active development. For questions or contributions, please open an issue on GitHub.

## Technologies

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Electron, Node.js
- **Database**: Supabase
- **AI Integration**: Claude API, OpenAI
- **Build System**: Webpack, TypeScript
- **Testing**: Jest, Integration Tests

## Future Roadmap

- Enhanced self-development capabilities
- Multi-model AI support
- Advanced code generation templates
- Enterprise deployment features
- Performance optimizations for Apple Silicon

---

Built with ❤️ by OnAir Systems using Claude Code