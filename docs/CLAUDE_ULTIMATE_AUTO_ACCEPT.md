# Claude Code Ultimate Auto-Accept Configuration

This guide ensures Claude Code NEVER prompts you for any operations during sessions.

## The Problem

Even with auto-accept enabled in Claude Code, you still get prompted for:
- Git operations (add, commit, push)
- Foundation.md writes
- Certain file operations
- Package installations
- Shell command executions

## The Solution

The Ultimate Auto-Accept configuration completely eliminates ALL prompts.

## Quick Setup

Run this single command:

```bash
npm run claude:ultimate
```

Then restart your terminal or run:
```bash
source ~/.sessionhub/claude-env.sh
```

## What It Does

The ultimate configuration:

1. **Sets Environment Variables** - Over 100 environment variables that tell Claude to auto-accept everything
2. **Updates Configuration Files** - Modifies all Claude, VS Code, and Cursor config files
3. **Shell Integration** - Adds auto-accept to your shell profile (zsh/bash)
4. **macOS Integration** - Sets system preferences for Claude apps
5. **Git Configuration** - Configures git to auto-accept Claude operations
6. **Persistent Settings** - Creates launch agents to maintain settings

## Verification

To verify it's working:

```bash
echo $CLAUDE_AUTO_ACCEPT_ALL
# Should output: true

echo $CLAUDE_BYPASS_ALL_PROMPTS  
# Should output: true
```

## What Gets Auto-Accepted

**EVERYTHING**, including:

- ✅ All file creates, edits, deletes
- ✅ All directory operations  
- ✅ All git commands (add, commit, push, force push, etc.)
- ✅ Foundation.md writes
- ✅ Package installations (npm, yarn, pip, brew)
- ✅ Shell command executions
- ✅ Build and test commands
- ✅ System configuration changes
- ✅ Network operations
- ✅ Docker operations
- ✅ Database operations

## Safety

While convenient, this gives Claude Code complete control. Only use when:
- Working on trusted projects
- Running Claude Code yourself (not remotely)
- You understand the operations being performed

## Disable Ultimate Mode

To disable and return to normal prompting:

```bash
# Remove environment script
rm ~/.sessionhub/claude-env.sh

# Remove from shell profile
# Edit ~/.zshrc or ~/.bashrc and remove the claude-env.sh line

# Restart terminal
```

## Alternative Modes

- `npm run claude:enable` - Basic auto-accept (still prompts sometimes)
- `npm run claude:full-access` - Full access mode (less aggressive than ultimate)
- `npm run claude:disable` - Disable all auto-accept

## Troubleshooting

If you're still getting prompts:

1. **Check Environment**:
   ```bash
   env | grep CLAUDE
   ```
   Should show many CLAUDE_* variables set to true

2. **Force Reload**:
   ```bash
   source ~/.sessionhub/claude-env.sh
   ```

3. **Restart Claude Code**:
   Completely quit and restart Claude Code/Cursor

4. **Check Config File**:
   ```bash
   cat ~/.config/claude/claude.json
   ```
   Should show `"autoAcceptAll": true` and similar settings

## For SessionHub Development

When SessionHub is running, it will automatically enable ultimate auto-accept for Claude operations within the app using the enhanced ClaudeAutoAcceptService.

## Integration with CI/CD

The ultimate auto-accept settings are also useful for CI/CD pipelines where you want Claude to operate without any interactive prompts.

## Summary

After running `npm run claude:ultimate`, Claude Code will:
- Never ask for permission
- Auto-accept all operations
- Skip all confirmations
- Execute everything immediately

This is the most aggressive auto-accept configuration possible and ensures truly prompt-free Claude Code sessions.