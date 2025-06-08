# SessionHub Git Hooks

This directory contains version-controlled Git hooks that enforce quality standards for the SessionHub project.

## Hooks Included

### pre-commit
- Runs TypeScript compilation checks
- Executes ESLint validation
- Scans for error suppression patterns (@ts-ignore, etc.)
- Checks file sizes (max 1MB)
- Performs security scans for hardcoded secrets
- Validates TypeScript configuration

### post-commit
- Verifies TypeScript compilation after commit
- Performs security scan on committed files
- Checks for large files
- Updates commit metrics
- Generates commit reports
- Maintains audit trail

### commit-msg
- Validates commit message quality
- Enforces minimum/maximum length requirements
- Encourages conventional commit format
- Prevents generic commit messages
- Logs all commit attempts

## Installation

These hooks are automatically installed when you run:
```bash
npm install
```

Or manually install with:
```bash
./scripts/install-quality-gates.sh
```

## Important Notes

- **These hooks are mandatory** and cannot be bypassed
- Attempts to skip hooks (--no-verify) will be blocked and logged
- All commits are audited to `~/.sessionhub/`
- Hooks are automatically kept in sync with this directory

## Troubleshooting

If hooks are not working:
1. Run `./scripts/install-quality-gates.sh`
2. Ensure Husky is installed: `npx husky install`
3. Check hook permissions: `ls -la .husky/`
4. View audit logs: `cat ~/.sessionhub/quality-checks.log`