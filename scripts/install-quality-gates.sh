#!/bin/bash

# SessionHub Quality Gates Installation Script
# This script installs and configures all quality enforcement mechanisms
# It ensures that quality gates persist through restarts and new clones

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}SessionHub Quality Gates Installation${NC}"
echo -e "${BLUE}=====================================${NC}"

# Function to print success messages
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error messages
error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Function to print info messages
info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    error "This script must be run from the SessionHub project root"
fi

# 1. Install Husky if not already installed
info "Setting up Husky for Git hooks..."
cd "$PROJECT_ROOT"
if [ ! -d ".husky" ]; then
    npx husky install
    success "Husky installed"
else
    success "Husky already installed"
fi

# 2. Copy git hooks from .githooks to .husky
info "Installing Git hooks..."
mkdir -p "$PROJECT_ROOT/.githooks"

# Create the pre-commit hook
cat > "$PROJECT_ROOT/.githooks/pre-commit" << 'EOF'
#!/bin/bash

# SessionHub Pre-Commit Hook
# Enforces quality standards before allowing commits

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Running SessionHub quality checks...${NC}"

# Detect bypass attempts
if [ "${HUSKY_SKIP_HOOKS:-0}" = "1" ] || [ "${SKIP_HOOKS:-0}" = "1" ]; then
    echo -e "${RED}ERROR: Attempt to bypass quality gates detected!${NC}"
    echo "Quality gates are mandatory and cannot be disabled."
    exit 1
fi

# Run TypeScript compilation
echo "→ Checking TypeScript compilation..."
npm run build:check || {
    echo -e "${RED}TypeScript compilation failed!${NC}"
    echo "Fix all TypeScript errors before committing."
    exit 1
}

# Run ESLint
echo "→ Running ESLint..."
npm run lint || {
    echo -e "${RED}ESLint check failed!${NC}"
    echo "Fix all linting errors before committing."
    exit 1
}

# Check for error suppression patterns
echo "→ Checking for error suppression..."
if grep -r "@ts-ignore\|@ts-nocheck\|@ts-expect-error\|eslint-disable" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ renderer/ main/ 2>/dev/null; then
    echo -e "${RED}Error suppression detected!${NC}"
    echo "Remove all @ts-ignore, @ts-nocheck, @ts-expect-error, and eslint-disable comments."
    exit 1
fi

# Check file sizes
echo "→ Checking file sizes..."
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read file; do
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ $size -gt 1048576 ]; then
        echo -e "${RED}File too large: $file ($(($size / 1024))KB)${NC}"
        echo "Files must be smaller than 1MB"
        exit 1
    fi
done

echo -e "${GREEN}✓ All quality checks passed!${NC}"
EOF

# Create the post-commit hook
cat > "$PROJECT_ROOT/.githooks/post-commit" << 'EOF'
#!/bin/bash

# SessionHub Post-Commit Hook
# Verifies quality after commit and logs for audit

set -euo pipefail

# Create audit log directory
AUDIT_DIR="$HOME/.sessionhub"
mkdir -p "$AUDIT_DIR"

# Log the commit
echo "[$(date)] Commit: $(git log -1 --pretty=format:'%H %s')" >> "$AUDIT_DIR/commit-audit.log"

# Verify TypeScript still compiles
npm run build:check --silent || {
    echo "WARNING: TypeScript compilation failed after commit!"
    echo "This commit may have introduced errors."
}
EOF

# Make hooks executable
chmod +x "$PROJECT_ROOT/.githooks/pre-commit"
chmod +x "$PROJECT_ROOT/.githooks/post-commit"

# Copy to .husky directory
cp "$PROJECT_ROOT/.githooks/pre-commit" "$PROJECT_ROOT/.husky/pre-commit"
cp "$PROJECT_ROOT/.githooks/post-commit" "$PROJECT_ROOT/.husky/post-commit"

success "Git hooks installed"

# 3. Install the git wrapper globally
info "Installing Git wrapper..."
WRAPPER_PATH="$PROJECT_ROOT/scripts/git-wrapper.sh"

# Ensure the wrapper exists
if [ ! -f "$WRAPPER_PATH" ]; then
    error "Git wrapper not found at $WRAPPER_PATH"
fi

# Add to shell configuration
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    error "No .zshrc or .bashrc found. Please manually add the git alias."
fi

# Check if alias already exists
if grep -q "alias git=" "$SHELL_CONFIG"; then
    info "Git alias already exists in $SHELL_CONFIG"
else
    echo "" >> "$SHELL_CONFIG"
    echo "# SessionHub Quality Gates" >> "$SHELL_CONFIG"
    echo "alias git='$WRAPPER_PATH'" >> "$SHELL_CONFIG"
    success "Git wrapper alias added to $SHELL_CONFIG"
    info "Please run 'source $SHELL_CONFIG' or restart your terminal"
fi

# 4. Create the zero-tolerance environment file
info "Setting up zero-tolerance environment..."
cat > "$PROJECT_ROOT/.env.zero-tolerance" << 'EOF'
# Zero Tolerance Quality Enforcement
ZERO_TOLERANCE=1
SKIP_PREFLIGHT_CHECK=false
DISABLE_ESLINT_PLUGIN=false
NODE_ENV=development
EOF

success "Zero-tolerance environment configured"

# 5. Create audit directories
info "Creating audit directories..."
mkdir -p "$HOME/.sessionhub"
touch "$HOME/.sessionhub/git-audit.log"
touch "$HOME/.sessionhub/commit-audit.log"
touch "$HOME/.sessionhub/bypass-attempts.log"
success "Audit directories created"

# 6. Install global Node scripts
info "Installing Node.js quality scripts..."
npm install --save-dev husky
success "Node dependencies installed"

# 7. Set up TypeScript configuration guardian
info "Setting up TypeScript guardian..."
if [ -f "$PROJECT_ROOT/scripts/tsconfig-guardian.ts" ]; then
    # Create a watch script
    cat > "$PROJECT_ROOT/scripts/watch-tsconfig.sh" << 'EOF'
#!/bin/bash
# Watch TypeScript configuration for changes
node scripts/tsconfig-guardian.ts --watch &
echo $! > "$HOME/.sessionhub/tsconfig-guardian.pid"
echo "TypeScript configuration guardian started (PID: $!)"
EOF
    chmod +x "$PROJECT_ROOT/scripts/watch-tsconfig.sh"
    success "TypeScript guardian configured"
fi

# 8. Final verification
info "Verifying installation..."

# Check Husky
if [ -d ".husky" ] && [ -f ".husky/pre-commit" ]; then
    success "Husky hooks verified"
else
    error "Husky installation failed"
fi

# Check git wrapper
if [ -f "$WRAPPER_PATH" ] && [ -x "$WRAPPER_PATH" ]; then
    success "Git wrapper verified"
else
    error "Git wrapper not properly installed"
fi

# Check environment file
if [ -f "$PROJECT_ROOT/.env.zero-tolerance" ]; then
    success "Zero-tolerance environment verified"
else
    error "Zero-tolerance environment not configured"
fi

echo ""
echo -e "${GREEN}✨ Quality gates installation complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run 'source $SHELL_CONFIG' to activate the git wrapper"
echo "2. Run 'npm run validate:strict' to verify all quality checks pass"
echo "3. All future commits will be subject to quality enforcement"
echo ""
echo -e "${BLUE}Quality gates are now mandatory and cannot be disabled.${NC}"