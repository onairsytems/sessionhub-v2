# Claude Code Auto-Accept Configuration

This feature allows Claude Code to automatically accept all prompts during SessionHub sessions, eliminating the need for manual confirmation of file edits, git operations, and Foundation updates.

## Quick Start

### 1. One-Time Setup (Recommended)

Run the setup script to configure your entire environment:

```bash
npm run claude:setup
```

This will:
- Install configuration files
- Set up environment variables
- Update shell profiles
- Configure VS Code settings
- Create launch helpers

### 2. Enable Auto-Accept

#### For Current Session
```bash
npm run claude:enable
```

#### For Specific Session
```bash
npm run claude:enable SESSION_ID
```

### 3. Check Status
```bash
npm run claude:status
```

## Features

### Automatic Acceptance Of:
- ✅ **File Operations**: Create, edit, delete, move files
- ✅ **Directory Operations**: Create, delete, recursive operations
- ✅ **Package Management**: npm install, yarn add, pip install, brew install
- ✅ **Git Operations**: All git commands including commit, push, force operations
- ✅ **Shell Commands**: Execute any shell command or script
- ✅ **Build Tools**: Run builds, tests, linting, formatting
- ✅ **System Modifications**: Environment variables, PATH changes, configs
- ✅ **Network Operations**: API calls, downloads, uploads
- ✅ **Docker Operations**: Build, run, compose commands
- ✅ **Database Operations**: Migrations, seeds, queries
- ✅ **Foundation.md Updates**: Automatic updates without prompts
- ✅ **ALL Other Operations**: Literally everything Claude needs to do

### Works In:
- Development environment (when in `/Development/sessionhub-*`)
- Production environment (when running SessionHub app)
- VS Code with Claude extension
- Terminal/CLI sessions

## Configuration

### Main Configuration File
`~/.config/claude/claude.json`

```json
{
  "autoAcceptEdits": true,
  "autoAcceptPrompts": true,
  "suppressConfirmations": true,
  "sessionHub": {
    "enabled": true,
    "acceptPatterns": {
      "fileEdits": true,
      "gitOperations": true,
      "foundationUpdates": true,
      "allPrompts": true
    }
  }
}
```

### Environment Variables
Set automatically by the setup script:

```bash
export CLAUDE_AUTO_ACCEPT_EDITS=true
export CLAUDE_AUTO_ACCEPT_PROMPTS=true
export CLAUDE_SUPPRESS_CONFIRMATIONS=true
export SESSIONHUB_AUTO_ACCEPT=true
```

## UI Settings

In SessionHub, navigate to Settings > Claude Auto-Accept to configure:
- Master enable/disable toggle
- Individual acceptance patterns
- Session-specific settings

## Command Line Usage

### Enable/Disable Shortcuts
After setup, these aliases are available in your terminal:

```bash
claude-accept-on      # Enable auto-accept
claude-accept-off     # Disable auto-accept
claude-status         # Check current status
claude-full-access    # Enable FULL ACCESS mode (auto-accept EVERYTHING)
```

### Full Access Mode (Maximum Permissions)

For sessions where Claude needs complete control:

```bash
# Enable FULL ACCESS mode - Claude can do ANYTHING
./scripts/claude-full-access.sh

# Or use the alias after setup
claude-full-access
```

**⚠️ WARNING**: Full Access mode gives Claude permission to:
- Install any packages without asking
- Create/delete any files or directories
- Execute any shell commands
- Make any git operations
- Modify system configurations
- And much more...

Use with caution and disable when not needed!

### Launch Claude with Auto-Accept
```bash
~/.sessionhub/launch-claude
```

## Integration with SessionHub

When starting a new session in SessionHub:
1. Auto-accept is automatically enabled for that session
2. The session ID is associated with the auto-accept config
3. All Claude Code operations during that session will be auto-accepted

## Logs

Activity logs are stored at:
- `~/.sessionhub/claude-auto-accept.log`
- `~/Library/Logs/SessionHub/claude-auto-accept.log` (macOS production)

## Troubleshooting

### Auto-Accept Not Working?

1. Check if enabled:
   ```bash
   npm run claude:status
   ```

2. Verify environment variables:
   ```bash
   echo $CLAUDE_AUTO_ACCEPT_ALL
   ```

3. Re-run setup:
   ```bash
   npm run claude:setup
   ```

4. Restart your terminal and Claude Code

### Reset Configuration

To completely reset:
```bash
rm -rf ~/.sessionhub/claude-*
rm -rf ~/.config/claude
npm run claude:setup
```

## Security Considerations

- Auto-accept only works within SessionHub context
- Session IDs are validated before enabling
- All operations are logged for audit trail
- Can be instantly disabled via UI or CLI

## Development vs Production

### Development
- Automatically detected when in `/Development/sessionhub-*`
- Uses local configuration files
- Integrates with development tools

### Production
- Activated when running SessionHub.app
- Uses app-specific configuration
- Respects system security settings