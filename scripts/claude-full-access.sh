#!/bin/bash

# Claude Code FULL ACCESS Mode
# This script enables auto-accept for EVERY POSSIBLE OPERATION
# Use with caution - Claude will have full control over your system

set -e

echo "🚀 CLAUDE CODE FULL ACCESS MODE ACTIVATOR"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will give Claude Code permission to:"
echo "   • Create, edit, and delete ANY files and directories"
echo "   • Install ANY packages (npm, yarn, pip, brew, etc.)"
echo "   • Execute ANY shell commands"
echo "   • Make ANY git operations (including force push)"
echo "   • Modify system configurations"
echo "   • Run builds, tests, and deployments"
echo "   • Make network requests and API calls"
echo "   • Run Docker containers"
echo "   • Modify environment variables"
echo ""
echo "Continue? (yes/no)"
read -r response

if [[ "$response" != "yes" ]]; then
    echo "❌ Aborted. No changes made."
    exit 0
fi

echo ""
echo "🔧 Setting up FULL ACCESS mode..."

# Create master config directory
mkdir -p ~/.sessionhub
mkdir -p ~/.config/claude

# Create the ultimate auto-accept configuration
cat > ~/.config/claude/claude-full-access.json << 'EOF'
{
  "version": "3.0-FULL-ACCESS",
  "mode": "UNRESTRICTED",
  "autoAccept": {
    "masterOverride": true,
    "acceptEverything": true,
    "neverPrompt": true,
    "skipAllConfirmations": true,
    "trustLevel": "MAXIMUM",
    "restrictions": "NONE"
  },
  "permissions": {
    "fileSystem": {
      "create": "ANY",
      "read": "ANY",
      "write": "ANY",
      "delete": "ANY",
      "execute": "ANY",
      "chmod": "ANY",
      "chown": "ANY"
    },
    "packages": {
      "npm": "UNRESTRICTED",
      "yarn": "UNRESTRICTED",
      "pip": "UNRESTRICTED",
      "brew": "UNRESTRICTED",
      "apt": "UNRESTRICTED",
      "cargo": "UNRESTRICTED",
      "gem": "UNRESTRICTED",
      "go": "UNRESTRICTED"
    },
    "shell": {
      "execute": "ANY_COMMAND",
      "sudo": "WITH_CAUTION",
      "background": "ALLOWED",
      "pipes": "ALLOWED",
      "redirects": "ALLOWED"
    },
    "git": {
      "all": "UNRESTRICTED",
      "force": "ALLOWED",
      "reset": "ALLOWED",
      "clean": "ALLOWED"
    },
    "network": {
      "http": "UNRESTRICTED",
      "https": "UNRESTRICTED",
      "ssh": "ALLOWED",
      "ports": "ANY"
    },
    "system": {
      "env": "MODIFY",
      "path": "MODIFY",
      "config": "MODIFY",
      "services": "CONTROL"
    }
  },
  "bypass": {
    "confirmations": true,
    "warnings": true,
    "errors": false,
    "security": false
  }
}
EOF

# Create environment setup script
cat > ~/.sessionhub/claude-full-access-env.sh << 'EOF'
#!/bin/bash
# Claude Code FULL ACCESS Environment

# Master controls
export CLAUDE_FULL_ACCESS_MODE=true
export CLAUDE_MASTER_OVERRIDE=true
export CLAUDE_BYPASS_ALL_PROMPTS=true
export CLAUDE_NEVER_ASK_PERMISSION=true
export CLAUDE_TRUST_LEVEL=MAXIMUM
export CLAUDE_ACCEPT_EVERYTHING=true

# Specific permissions (all set to true)
export CLAUDE_ACCEPT_FILE_CREATE=true
export CLAUDE_ACCEPT_FILE_EDIT=true
export CLAUDE_ACCEPT_FILE_DELETE=true
export CLAUDE_ACCEPT_DIR_CREATE=true
export CLAUDE_ACCEPT_DIR_DELETE=true
export CLAUDE_ACCEPT_DIR_RECURSIVE=true
export CLAUDE_ACCEPT_PERMISSIONS=true
export CLAUDE_ACCEPT_OWNERSHIP=true

# Package management (all allowed)
export CLAUDE_ACCEPT_NPM_INSTALL=true
export CLAUDE_ACCEPT_NPM_GLOBAL=true
export CLAUDE_ACCEPT_YARN_ADD=true
export CLAUDE_ACCEPT_YARN_GLOBAL=true
export CLAUDE_ACCEPT_PIP_INSTALL=true
export CLAUDE_ACCEPT_PIP_UPGRADE=true
export CLAUDE_ACCEPT_BREW_INSTALL=true
export CLAUDE_ACCEPT_BREW_CASK=true
export CLAUDE_ACCEPT_APT_INSTALL=true
export CLAUDE_ACCEPT_PACKAGE_UPDATES=true
export CLAUDE_ACCEPT_PACKAGE_AUDIT_FIX=true

# Shell and system (all allowed)
export CLAUDE_ACCEPT_SHELL_COMMANDS=true
export CLAUDE_ACCEPT_SCRIPT_EXECUTION=true
export CLAUDE_ACCEPT_BACKGROUND_JOBS=true
export CLAUDE_ACCEPT_PROCESS_KILL=true
export CLAUDE_ACCEPT_ENV_CHANGES=true
export CLAUDE_ACCEPT_PATH_MODIFICATIONS=true
export CLAUDE_ACCEPT_SYSTEM_CONFIG=true
export CLAUDE_ACCEPT_SERVICE_CONTROL=true

# Git operations (all allowed)
export CLAUDE_ACCEPT_GIT_ALL=true
export CLAUDE_ACCEPT_GIT_COMMIT=true
export CLAUDE_ACCEPT_GIT_PUSH=true
export CLAUDE_ACCEPT_GIT_FORCE=true
export CLAUDE_ACCEPT_GIT_RESET=true
export CLAUDE_ACCEPT_GIT_CLEAN=true
export CLAUDE_ACCEPT_GIT_SUBMODULES=true

# Build and development (all allowed)
export CLAUDE_ACCEPT_BUILD_COMMANDS=true
export CLAUDE_ACCEPT_TEST_EXECUTION=true
export CLAUDE_ACCEPT_LINT_FIX=true
export CLAUDE_ACCEPT_FORMAT=true
export CLAUDE_ACCEPT_COMPILE=true
export CLAUDE_ACCEPT_BUNDLE=true
export CLAUDE_ACCEPT_DEPLOY=true

# Network and external (all allowed)
export CLAUDE_ACCEPT_API_CALLS=true
export CLAUDE_ACCEPT_DOWNLOADS=true
export CLAUDE_ACCEPT_UPLOADS=true
export CLAUDE_ACCEPT_WEBHOOKS=true
export CLAUDE_ACCEPT_SSH_OPERATIONS=true

# Docker and containers (all allowed)
export CLAUDE_ACCEPT_DOCKER_ALL=true
export CLAUDE_ACCEPT_DOCKER_BUILD=true
export CLAUDE_ACCEPT_DOCKER_RUN=true
export CLAUDE_ACCEPT_DOCKER_COMPOSE=true
export CLAUDE_ACCEPT_CONTAINER_EXEC=true

# Database operations (all allowed)
export CLAUDE_ACCEPT_DB_MIGRATIONS=true
export CLAUDE_ACCEPT_DB_SEEDS=true
export CLAUDE_ACCEPT_DB_QUERIES=true
export CLAUDE_ACCEPT_DB_SCHEMA_CHANGES=true

# Ultimate overrides
export CLAUDE_SKIP_ALL_PROMPTS=true
export CLAUDE_AUTO_YES_TO_ALL=true
export CLAUDE_DISABLE_CONFIRMATIONS=true
export CLAUDE_FORCE_OPERATIONS=true

echo "🚀 FULL ACCESS MODE ACTIVE - Claude has unrestricted permissions!"
EOF

chmod +x ~/.sessionhub/claude-full-access-env.sh

# Update shell profiles to source full access env
SHELL_PROFILE=""
if [[ -f ~/.zshrc ]]; then
    SHELL_PROFILE=~/.zshrc
elif [[ -f ~/.bashrc ]]; then
    SHELL_PROFILE=~/.bashrc
elif [[ -f ~/.bash_profile ]]; then
    SHELL_PROFILE=~/.bash_profile
fi

if [[ -n "$SHELL_PROFILE" ]]; then
    # Add full access sourcing
    if ! grep -q "claude-full-access-env.sh" "$SHELL_PROFILE"; then
        echo "" >> "$SHELL_PROFILE"
        echo "# Claude Code FULL ACCESS Mode (comment out to disable)" >> "$SHELL_PROFILE"
        echo "[ -f ~/.sessionhub/claude-full-access-env.sh ] && source ~/.sessionhub/claude-full-access-env.sh" >> "$SHELL_PROFILE"
    fi
fi

# Copy main config to Claude's expected location
cp ~/.config/claude/claude-full-access.json ~/.config/claude/claude.json

# Create a desktop shortcut for macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    cat > ~/Desktop/Claude-Full-Access.command << 'EOF'
#!/bin/bash
source ~/.sessionhub/claude-full-access-env.sh
echo "Claude Code launched with FULL ACCESS permissions"
open -a "Claude" || open -a "Cursor" || claude
EOF
    chmod +x ~/Desktop/Claude-Full-Access.command
fi

# Set up VS Code for full access
VSCODE_SETTINGS=""
if [[ -d "$HOME/Library/Application Support/Code/User" ]]; then
    VSCODE_SETTINGS="$HOME/Library/Application Support/Code/User/settings.json"
elif [[ -d "$HOME/.config/Code/User" ]]; then
    VSCODE_SETTINGS="$HOME/.config/Code/User/settings.json"
fi

if [[ -n "$VSCODE_SETTINGS" ]] && [[ -f "$VSCODE_SETTINGS" ]]; then
    # Backup current settings
    cp "$VSCODE_SETTINGS" "$VSCODE_SETTINGS.backup-pre-full-access"
    
    # Add full access settings using node
    node -e "
        const fs = require('fs');
        const settings = JSON.parse(fs.readFileSync('$VSCODE_SETTINGS', 'utf8'));
        settings['claude.autoAcceptEdits'] = true;
        settings['claude.suppressConfirmations'] = true;
        settings['claude.autoAcceptAllPrompts'] = true;
        settings['claude.trustLevel'] = 'maximum';
        settings['claude.bypassAllPrompts'] = true;
        settings['claude.neverAskPermission'] = true;
        fs.writeFileSync('$VSCODE_SETTINGS', JSON.stringify(settings, null, 2));
    "
fi

# Run the TypeScript configurator
echo ""
echo "🔧 Running advanced configuration..."
ts-node scripts/claude-auto-accept.ts enable FULL_ACCESS_MODE

# Final setup
echo ""
echo "✅ FULL ACCESS MODE SETUP COMPLETE!"
echo ""
echo "🎯 Quick Commands:"
echo "   claude-full-access    - Enable full access mode"
echo "   claude-accept-off     - Disable auto-accept"
echo "   claude-status         - Check current status"
echo ""
echo "⚡ To activate immediately in this terminal:"
echo "   source ~/.sessionhub/claude-full-access-env.sh"
echo ""
echo "🔄 Or restart your terminal for the changes to take effect"
echo ""
echo "⚠️  Remember: Claude now has permission to perform ANY operation!"
echo "   Use 'claude-accept-off' to disable when not needed."