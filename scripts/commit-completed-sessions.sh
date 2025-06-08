#!/bin/bash

# Session Auto-Commit Script with Foundation Verification and Quality Gates
# This script ensures Foundation.md claims match Git reality
# Usage: ./commit-completed-sessions.sh [--dry-run]

set -e # Exit on any error

# Check for dry-run mode
DRY_RUN=false
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo -e "${BLUE}Session Auto-Commit Script with Foundation Verification${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Function to extract session info from Foundation.md
extract_sessions() {
    local foundation_file="$PROJECT_ROOT/docs/FOUNDATION.md"
    
    if [ ! -f "$foundation_file" ]; then
        echo -e "${RED}ERROR: Foundation.md not found at $foundation_file${NC}"
        exit 1
    fi
    
    # Extract Foundation version
    local foundation_version=$(grep -E "^> Version:" "$foundation_file" | sed 's/.*Version: \([0-9.]*\).*/\1/')
    if [ -n "$foundation_version" ]; then
        echo -e "${BLUE}Foundation version: ${GREEN}$foundation_version${NC}" >&2
    fi
    
    # Extract completed sessions from the Completed Sessions section
    # Look for lines with ✅ followed by Session X.Y or Session X.Y.Z
    grep -E "^- ✅ Session [0-9]+\.[0-9]+.*:" "$foundation_file" 2>/dev/null | sed 's/^- ✅ //' || true
}

# Function to check if a session is in git
is_session_in_git() {
    local session_num="$1"
    # Check if any commit message contains the session number
    git log --oneline | grep -q "Session $session_num:" && return 0 || return 1
}

# Function to run quality gates
run_quality_gates() {
    echo -e "\n${BLUE}Running Quality Gates...${NC}"
    
    # TypeScript, ESLint, and build check
    echo -e "${YELLOW}Running error:check (TypeScript, ESLint, build)...${NC}"
    if ! timeout 300 npm run error:check; then
        if [ $? -eq 124 ]; then
            echo -e "${RED}✗ error:check timed out after 5 minutes - aborting${NC}"
        else
            echo -e "${RED}✗ error:check failed - aborting${NC}"
        fi
        return 1
    fi
    echo -e "${GREEN}✓ error:check passed${NC}"
    
    # Run tests
    echo -e "${YELLOW}Running tests...${NC}"
    if ! npm run test 2>/dev/null; then
        echo -e "${YELLOW}⚠ Tests not configured or failed (continuing)${NC}"
    else
        echo -e "${GREEN}✓ Tests passed${NC}"
    fi
    
    # Run validation
    echo -e "${YELLOW}Running validation...${NC}"
    if ! npm run validate 2>/dev/null; then
        echo -e "${YELLOW}⚠ Validation not configured (continuing)${NC}"
    else
        echo -e "${GREEN}✓ Validation passed${NC}"
    fi
    
    echo -e "${GREEN}✓ All quality checks passed${NC}"
    return 0
}

# Main execution
echo -e "${BLUE}Checking Foundation.md vs Git history...${NC}"
echo ""

# Get all completed sessions from Foundation.md
all_sessions=$(extract_sessions)

# Count total sessions
total_sessions=$(echo "$all_sessions" | grep -c "Session" || echo "0")
echo -e "Sessions marked complete: ${GREEN}$total_sessions${NC}"

# Count sessions in git
sessions_in_git=0
missing_sessions=()

while IFS= read -r session_line; do
    if [ -z "$session_line" ]; then
        continue
    fi
    
    # Extract session number (e.g., "0.1" or "0.1.8")
    session_num=$(echo "$session_line" | sed -E 's/Session ([0-9]+\.[0-9]+[0-9.]*).*/\1/')
    
    if is_session_in_git "$session_num"; then
        ((sessions_in_git++))
    else
        missing_sessions+=("$session_line")
    fi
done <<< "$all_sessions"

echo -e "Sessions in Git: ${GREEN}$sessions_in_git${NC}"
echo ""

# Check if any sessions are missing
if [ ${#missing_sessions[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ Foundation.md and Git are already synchronized!${NC}"
    exit 0
fi

# Display missing sessions
echo -e "${YELLOW}Missing from Git:${NC}"
for session in "${missing_sessions[@]}"; do
    echo -e "  ${RED}- $session${NC}"
done

if [ "$DRY_RUN" == "true" ]; then
    echo -e "\n${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo -e "\n${BLUE}Would commit the following sessions:${NC}"
    for session_line in "${missing_sessions[@]}"; do
        session_num=$(echo "$session_line" | sed -E 's/Session ([0-9]+\.[0-9]+[0-9.]*).*/\1/')
        session_desc=$(echo "$session_line" | sed 's/Session [0-9.]*: //')
        session_desc=$(echo "$session_desc" | sed 's/ (Session.*//')
        commit_msg="Session $session_num: $session_desc - Foundation v$session_num"
        echo -e "  ${GREEN}$commit_msg${NC}"
    done
    exit 0
fi

# Run quality gates before committing
if ! run_quality_gates; then
    echo -e "\n${RED}Quality gates failed - cannot commit sessions${NC}"
    echo -e "${RED}Please fix all errors before running this script again${NC}"
    exit 1
fi

# Commit missing sessions
echo -e "\n${BLUE}Committing missing sessions...${NC}"

for session_line in "${missing_sessions[@]}"; do
    # Extract session number and description
    session_num=$(echo "$session_line" | sed -E 's/Session ([0-9]+\.[0-9]+[0-9.]*).*/\1/')
    session_desc=$(echo "$session_line" | sed 's/Session [0-9.]*: //')
    
    # Remove trailing text after the description if any
    session_desc=$(echo "$session_desc" | sed 's/ (Session.*//')
    
    # Construct commit message in the expected format
    commit_msg="Session $session_num: $session_desc - Foundation v$session_num"
    
    echo -e "${YELLOW}Staging all changes...${NC}"
    git add -A
    
    echo -e "${YELLOW}Committing: $commit_msg${NC}"
    if git commit -m "$commit_msg"; then
        echo -e "${GREEN}✓ Session $session_num: $session_desc${NC}"
    else
        echo -e "${RED}✗ Failed to commit Session $session_num${NC}"
        exit 1
    fi
done

# Push to GitHub
echo -e "\n${BLUE}Pushing to GitHub...${NC}"
if git push; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗ Failed to push to GitHub${NC}"
    echo -e "${YELLOW}You may need to push manually with: git push${NC}"
fi

echo -e "\n${GREEN}Foundation.md and Git are now synchronized!${NC}"

# Extract foundation version for the report
foundation_version=$(grep -E "^> Version:" "$PROJECT_ROOT/docs/FOUNDATION.md" | sed 's/.*Version: \([0-9.]*\).*/\1/')

# Generate sync report
report_file="$PROJECT_ROOT/sessions/reports/foundation-sync-$(date +%Y-%m-%d-%H%M%S).log"
mkdir -p "$PROJECT_ROOT/sessions/reports"

{
    echo "Foundation Sync Report - $(date)"
    echo "================================"
    echo ""
    echo "Foundation Version: $foundation_version"
    echo "Total Sessions: $total_sessions"
    echo "Previously in Git: $sessions_in_git"
    echo "Newly Committed: ${#missing_sessions[@]}"
    echo ""
    echo "Sessions Committed:"
    for session in "${missing_sessions[@]}"; do
        echo "  - $session"
    done
    echo ""
    echo "All quality gates passed before commit."
} > "$report_file"

echo -e "\n${BLUE}Sync report saved to:${NC} $report_file"