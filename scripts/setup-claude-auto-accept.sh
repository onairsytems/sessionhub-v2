#!/bin/bash

# SessionHub Claude Code Auto-Accept Setup Script
# This script configures your environment for automatic acceptance of Claude Code prompts

set -e

echo "🚀 SessionHub Claude Code Auto-Accept Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create necessary directories
echo "📁 Creating configuration directories..."
mkdir -p ~/.sessionhub
mkdir -p ~/.config/claude

# Install the auto-accept configuration
echo "📝 Installing auto-accept configuration..."
cp claude.json ~/.config/claude/claude.json
echo -e "${GREEN}✓${NC} Configuration installed"

# Create environment file
echo "🔧 Creating environment file..."
cat > ~/.sessionhub/claude-env.sh << 'EOF'
#!/bin/bash
# Claude Code Auto-Accept Environment Variables

# Core auto-accept settings
export CLAUDE_AUTO_ACCEPT_EDITS=true
export CLAUDE_AUTO_ACCEPT_PROMPTS=true
export CLAUDE_SUPPRESS_CONFIRMATIONS=true
export CLAUDE_AUTO_ACCEPT_ALL=true

# SessionHub specific settings
export SESSIONHUB_AUTO_ACCEPT=true
export SESSIONHUB_CLAUDE_MODE=auto-accept

# Development environment detection
if [[ "$PWD" == *"/Development/sessionhub"* ]]; then
  export SESSIONHUB_ENV=development
else
  export SESSIONHUB_ENV=production
fi

# Function to enable auto-accept for current session
claude_auto_accept() {
  echo "✅ Claude Code auto-accept enabled for this session"
  export CLAUDE_SESSION_AUTO_ACCEPT=true
  export CLAUDE_BYPASS_ALL_PROMPTS=true
  export CLAUDE_NEVER_ASK_PERMISSION=true
}

# Alias for quick enable/disable
alias claude-accept-on='export CLAUDE_AUTO_ACCEPT_ALL=true && export CLAUDE_BYPASS_ALL_PROMPTS=true && echo "✅ Auto-accept enabled for ALL operations"'
alias claude-accept-off='export CLAUDE_AUTO_ACCEPT_ALL=false && export CLAUDE_BYPASS_ALL_PROMPTS=false && echo "❌ Auto-accept disabled"'
alias claude-status='echo "Claude Auto-Accept: $CLAUDE_AUTO_ACCEPT_ALL | Bypass All: $CLAUDE_BYPASS_ALL_PROMPTS"'
alias claude-full-access='export CLAUDE_MASTER_OVERRIDE=true && export CLAUDE_BYPASS_ALL_PROMPTS=true && export CLAUDE_NEVER_ASK_PERMISSION=true && echo "🚀 FULL ACCESS MODE ENABLED - Claude will accept EVERYTHING"'
EOF

chmod +x ~/.sessionhub/claude-env.sh
echo -e "${GREEN}✓${NC} Environment file created"

# Update shell profiles
echo "🐚 Updating shell profiles..."
PROFILES=(".bashrc" ".zshrc" ".bash_profile" ".profile")
PROFILE_UPDATED=false

for profile in "${PROFILES[@]}"; do
  PROFILE_PATH="$HOME/$profile"
  if [ -f "$PROFILE_PATH" ]; then
    if ! grep -q "sessionhub/claude-env.sh" "$PROFILE_PATH"; then
      echo "" >> "$PROFILE_PATH"
      echo "# SessionHub Claude Code Auto-Accept" >> "$PROFILE_PATH"
      echo "[ -f ~/.sessionhub/claude-env.sh ] && source ~/.sessionhub/claude-env.sh" >> "$PROFILE_PATH"
      echo -e "${GREEN}✓${NC} Updated $profile"
      PROFILE_UPDATED=true
    else
      echo -e "${YELLOW}⏭${NC} $profile already configured"
    fi
  fi
done

# Create VS Code settings if VS Code is installed
if command -v code &> /dev/null || [ -d "/Applications/Visual Studio Code.app" ]; then
  echo "💻 Configuring VS Code..."
  VSCODE_SETTINGS_DIR="$HOME/.config/Code/User"
  
  # Also check common macOS location
  if [ ! -d "$VSCODE_SETTINGS_DIR" ] && [ -d "$HOME/Library/Application Support/Code/User" ]; then
    VSCODE_SETTINGS_DIR="$HOME/Library/Application Support/Code/User"
  fi
  
  if [ -d "$VSCODE_SETTINGS_DIR" ]; then
    SETTINGS_FILE="$VSCODE_SETTINGS_DIR/settings.json"
    
    if [ -f "$SETTINGS_FILE" ]; then
      # Backup existing settings
      cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup"
      
      # Add Claude settings using Node.js to properly handle JSON
      node -e "
        const fs = require('fs');
        const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
        settings['claude.autoAcceptEdits'] = true;
        settings['claude.suppressConfirmations'] = true;
        settings['claude.autoAcceptAllPrompts'] = true;
        fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
      " && echo -e "${GREEN}✓${NC} VS Code settings updated"
    else
      # Create new settings file
      cat > "$SETTINGS_FILE" << 'EOF'
{
  "claude.autoAcceptEdits": true,
  "claude.suppressConfirmations": true,
  "claude.autoAcceptAllPrompts": true
}
EOF
      echo -e "${GREEN}✓${NC} VS Code settings created"
    fi
  fi
fi

# Create launch helper script
echo "🚀 Creating launch helper..."
cat > ~/.sessionhub/launch-claude << 'EOF'
#!/bin/bash
# Launch Claude Code with auto-accept enabled

source ~/.sessionhub/claude-env.sh

echo "🚀 Launching Claude Code with auto-accept enabled..."
echo "   Environment: $SESSIONHUB_ENV"
echo "   Auto-Accept: $CLAUDE_AUTO_ACCEPT_ALL"

# Launch Claude Code based on platform
if command -v claude &> /dev/null; then
  claude "$@"
elif [ -d "/Applications/Claude.app" ]; then
  open -a "Claude" "$@"
elif [ -d "/Applications/Cursor.app" ]; then
  # If using Cursor editor with Claude
  open -a "Cursor" "$@"
else
  echo "❌ Claude Code not found. Please install it first."
  echo "   Visit: https://claude.ai/download"
  exit 1
fi
EOF

chmod +x ~/.sessionhub/launch-claude
echo -e "${GREEN}✓${NC} Launch helper created"

# Create a desktop shortcut for macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🖥️  Creating macOS app shortcut..."
  
  # Create a simple AppleScript app
  osascript -e 'tell application "Script Editor"
    set newDoc to make new document
    set text of newDoc to "do shell script \"source ~/.sessionhub/claude-env.sh && open -a Claude\""
    compile newDoc
    save newDoc as application in POSIX file "~/Desktop/Claude Auto-Accept.app"
    close newDoc
  end tell' 2>/dev/null && echo -e "${GREEN}✓${NC} Desktop shortcut created" || echo -e "${YELLOW}⚠${NC} Could not create desktop shortcut"
fi

# Set up for SessionHub integration
echo "🔗 Setting up SessionHub integration..."
ts-node scripts/claude-auto-accept.ts setup
echo -e "${GREEN}✓${NC} SessionHub integration configured"

# Final instructions
echo ""
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "🎯 Quick Start:"
echo "   • Restart your terminal or run: source ~/.sessionhub/claude-env.sh"
echo "   • Launch Claude with auto-accept: ~/.sessionhub/launch-claude"
echo "   • Or use the desktop shortcut (macOS)"
echo ""
echo "⚙️  Commands available:"
echo "   • claude-accept-on   - Enable auto-accept"
echo "   • claude-accept-off  - Disable auto-accept"
echo "   • claude-status      - Check current status"
echo ""
echo "📝 Configuration file: ~/.config/claude/claude.json"
echo "📊 Logs: ~/.sessionhub/claude-auto-accept.log"
echo ""

if [ "$PROFILE_UPDATED" = true ]; then
  echo -e "${YELLOW}⚠️  Please restart your terminal for changes to take effect${NC}"
fi