#!/bin/bash

# Session Completion Workflow Script
# This script ensures all errors are fixed BEFORE attempting commits

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SESSION_VERSION=""
SESSION_DESCRIPTION=""
FOUNDATION_VERSION=""
COMMIT_MESSAGE=""

# Function to display usage
usage() {
    echo "Usage: $0 -v <version> -d <description> [-f <foundation-version>] [-m <commit-message>]"
    echo ""
    echo "Options:"
    echo "  -v    Session version (e.g., 0.1.5)"
    echo "  -d    Session description (e.g., 'Error-Fix-Then-Commit Workflow')"
    echo "  -f    Foundation version (defaults to session version)"
    echo "  -m    Commit message (auto-generated if not provided)"
    echo "  -h    Display this help message"
    echo ""
    echo "Example:"
    echo "  $0 -v 0.1.5 -d 'Error-Fix-Then-Commit Workflow'"
    exit 1
}

# Parse command line arguments
while getopts "v:d:f:m:h" opt; do
    case $opt in
        v) SESSION_VERSION="$OPTARG";;
        d) SESSION_DESCRIPTION="$OPTARG";;
        f) FOUNDATION_VERSION="$OPTARG";;
        m) COMMIT_MESSAGE="$OPTARG";;
        h) usage;;
        *) usage;;
    esac
done

# Validate required arguments
if [ -z "$SESSION_VERSION" ] || [ -z "$SESSION_DESCRIPTION" ]; then
    echo -e "${RED}Error: Session version and description are required${NC}"
    usage
fi

# Set defaults
if [ -z "$FOUNDATION_VERSION" ]; then
    FOUNDATION_VERSION="$SESSION_VERSION"
fi

if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Session $SESSION_VERSION: $SESSION_DESCRIPTION - Foundation v$FOUNDATION_VERSION"
fi

# Display session information
echo -e "${BLUE}=== Session Completion Workflow ===${NC}"
echo -e "Session Version: ${GREEN}$SESSION_VERSION${NC}"
echo -e "Description: ${GREEN}$SESSION_DESCRIPTION${NC}"
echo -e "Foundation Version: ${GREEN}$FOUNDATION_VERSION${NC}"
echo -e "Commit Message: ${GREEN}$COMMIT_MESSAGE${NC}"
echo ""

# Confirm before proceeding
read -p "Proceed with session completion? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Session completion cancelled${NC}"
    exit 1
fi

# Change to project directory
cd "$(dirname "$0")/.."

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Run the TypeScript completion workflow
echo -e "\n${BLUE}Starting session completion workflow...${NC}"
npx ts-node --project tsconfig.node.json scripts/complete-session.ts \
    "$SESSION_VERSION" \
    "$SESSION_DESCRIPTION" \
    "$COMMIT_MESSAGE" \
    "$FOUNDATION_VERSION"

# Check exit status
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Session $SESSION_VERSION completed successfully!${NC}"
else
    echo -e "\n${RED}❌ Session $SESSION_VERSION completion failed${NC}"
    echo -e "${YELLOW}Please fix the errors and run this script again${NC}"
    exit 1
fi