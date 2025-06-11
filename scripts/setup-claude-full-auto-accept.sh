#!/bin/bash

# SessionHub Claude Code Full Auto-Accept Setup
# This script ensures Claude NEVER prompts during SessionHub sessions

set -e

echo "🤖 SESSIONHUB CLAUDE FULL AUTO-ACCEPT SETUP"
echo "==========================================="
echo ""

# Run the universal script first
if [ -f "/Users/jonathanhoggard/Development/claude-auto-accept-universal.sh" ]; then
  bash /Users/jonathanhoggard/Development/claude-auto-accept-universal.sh
fi

# Additional SessionHub-specific configurations
cat >> ~/.sessionhub/claude-auto-accept-env.sh << 'EOF'

# SessionHub-specific overrides
export SESSIONHUB_CLAUDE_FULL_ACCESS=true
export SESSIONHUB_NO_PROMPTS=true
export SESSIONHUB_AUTO_YES=true
export SESSIONHUB_FOUNDATION_AUTO_WRITE=true
export SESSIONHUB_GIT_AUTO_PUSH=true
export SESSIONHUB_SESSION_AUTO_COMPLETE=true

# Force all Claude operations
export CLAUDE_FORCE_OPERATION=true
export CLAUDE_NO_INTERACTION=true
export CLAUDE_ASSUME_YES=true
export CLAUDE_PROCEED_WITHOUT_PROMPT=true
EOF

# Create a SessionHub-specific launcher
cat > ~/Development/sessionhub-v2/claude-no-prompt << 'EOF'
#!/bin/bash
# Launch Claude with absolutely no prompts

# Source all auto-accept settings
source ~/.sessionhub/claude-auto-accept-env.sh

# Additional force flags
export YES=1
export FORCE=1
export AUTO_CONFIRM=1
export SKIP_PROMPT=1
export NO_INTERACTION=1

# Launch with all permissions
exec "$@"
EOF

chmod +x ~/Development/sessionhub-v2/claude-no-prompt

# Update package.json scripts
if [ -f "package.json" ]; then
  # Add auto-accept scripts
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!pkg.scripts) pkg.scripts = {};
    pkg.scripts['claude:auto-on'] = 'source ~/.sessionhub/claude-auto-accept-env.sh && echo \"✅ Auto-accept enabled\"';
    pkg.scripts['claude:auto-off'] = 'unset CLAUDE_AUTO_ACCEPT_ALL && echo \"❌ Auto-accept disabled\"';
    pkg.scripts['claude:status'] = 'env | grep CLAUDE_AUTO_ACCEPT';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  "
fi

echo ""
echo "✅ SESSIONHUB FULL AUTO-ACCEPT CONFIGURED!"
echo ""
echo "🎯 Quick commands:"
echo "  npm run claude:auto-on   - Enable auto-accept"
echo "  npm run claude:auto-off  - Disable auto-accept"
echo "  npm run claude:status    - Check status"
echo ""
echo "⚡ Auto-accept is now ACTIVE for all Claude operations!"