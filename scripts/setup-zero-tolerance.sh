#!/bin/bash

# SessionHub Zero-Tolerance Setup Script
# This script sets up the enforcement mechanisms

echo "🔒 Setting up SessionHub Zero-Tolerance Error Policy..."

# Create the audit log directory
mkdir -p "$HOME/.sessionhub"

# Create alias for git to use our wrapper
SHELL_RC=""
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ]; then
    # Check if alias already exists
    if ! grep -q "alias git=" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# SessionHub Zero-Tolerance Git Wrapper" >> "$SHELL_RC"
        echo "alias git='$PWD/scripts/git-wrapper.sh'" >> "$SHELL_RC"
        echo "✅ Git wrapper alias added to $SHELL_RC"
        echo "   Please run: source $SHELL_RC"
    else
        echo "⚠️  Git alias already exists in $SHELL_RC"
    fi
fi

# Ensure git hooks are enabled
git config core.hooksPath .husky/_

# Set up environment variables to prevent hook skipping
echo "Setting up environment protection..."
cat > .env.zero-tolerance << 'EOF'
# Zero-Tolerance Environment Variables
export HUSKY=1
export HUSKY_SKIP_HOOKS=0
export SKIP_PREFLIGHT_CHECK=0
export CI=0
EOF

echo ""
echo "✅ Zero-Tolerance setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: source $SHELL_RC"
echo "2. Run: source .env.zero-tolerance"
echo "3. Add 'source .env.zero-tolerance' to your shell profile"
echo ""
echo "The system will now:"
echo "- Block all --no-verify attempts"
echo "- Log all git commands to ~/.sessionhub/git-audit.log"
echo "- Prevent hook configuration changes"
echo "- Alert on force push attempts"