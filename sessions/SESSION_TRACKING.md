# Session Tracking System

## Overview

This directory contains all session-related tracking and reporting data for the SessionHub development process.

## Directory Structure

- `completed/` - Contains history.log with completed session records
- `reports/` - Individual session completion reports with detailed logs
- `library/` - Reusable session templates and patterns

## Session Workflow

1. **Start Session**: Run `scripts/complete-session.sh` with session details
2. **Fix Errors**: The workflow will identify and fix all errors before proceeding
3. **Validate**: All quality checks must pass (TypeScript, ESLint, Build, Tests)
4. **Commit**: Only after zero errors, the session is committed
5. **Track**: Session is logged in history.log with status

## History Log Format

Each line in `completed/history.log` contains:
```
<version>|<status>|<timestamp>|<report-path>
```

Example:
```
0.1.5|COMPLETED|2025-06-07T10:30:00.000Z|sessions/reports/session-2025-06-07T10-30-00-000Z.log
```

## Session Report Format

Each session report in `reports/` contains:
- Session metadata (version, description, foundation version)
- Step-by-step execution log
- Error details and fixes applied
- Final status and duration

## Usage

To complete a session:
```bash
./scripts/complete-session.sh -v 0.1.5 -d "Description of changes"
```

To view session history:
```bash
cat sessions/completed/history.log
```

To review a specific session:
```bash
cat sessions/reports/session-*.log
```

## Error-Fix-Then-Commit Policy

As of Session 0.1.5, all sessions must follow the Error-Fix-Then-Commit workflow:
1. No commits are allowed with existing errors
2. All errors must be fixed before commit attempts
3. The workflow enforces this automatically
4. Manual commits that bypass the workflow are prohibited