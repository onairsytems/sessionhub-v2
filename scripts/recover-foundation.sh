#!/bin/bash

# =====================================================================
# Foundation Recovery Script
# =====================================================================
# This script recovers FOUNDATION.md from before Session 1.3 changes
# while preserving the Session 1.3 completion information
# =====================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FOUNDATION_LINK="docs/FOUNDATION.md"
FOUNDATION_PATH="/Users/jonathanhoggard/Google Drive/My Drive/SessionHub/FOUNDATION.md"
FOUNDATION_V12_PATH="docs/foundation-versions/FOUNDATION-v1.2.md"
FOUNDATION_V13_PATH="docs/foundation-versions/FOUNDATION-v1.3.md"
BACKUP_PATH="docs/FOUNDATION.md.backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${BLUE}Foundation Recovery Script${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""

# Check if we're in the correct directory
if [[ ! -L "$FOUNDATION_LINK" ]] && [[ ! -f "$FOUNDATION_PATH" ]]; then
    echo -e "${RED}Error: FOUNDATION.md not found at $FOUNDATION_PATH${NC}"
    echo "Please run this script from the sessionhub-v2 root directory"
    exit 1
fi

# Check if previous version exists
if [[ ! -f "$FOUNDATION_V12_PATH" ]]; then
    echo -e "${RED}Error: FOUNDATION-v1.2.md not found at $FOUNDATION_V12_PATH${NC}"
    echo "Cannot proceed without the previous version file"
    exit 1
fi

# Create backup of current version
echo -e "${YELLOW}Creating backup of current FOUNDATION.md...${NC}"
cp "$FOUNDATION_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓ Backup created: $BACKUP_PATH${NC}"
echo ""

# Extract Session 1.3 completion details from current version
echo -e "${YELLOW}Extracting Session 1.3 completion information...${NC}"

# Find the start and end line numbers for Session 1.3 section
SESSION_13_START=$(grep -n "### ✅ Session 1.3: Real Two-Actor Model Implementation" "$FOUNDATION_PATH" | cut -d: -f1)
SESSION_13_END=$(grep -n "^### " "$FOUNDATION_PATH" | grep -A1 "Session 1.3" | tail -1 | cut -d: -f1)

# If end not found, find the next major section marker
if [[ -z "$SESSION_13_END" || "$SESSION_13_END" == "$SESSION_13_START" ]]; then
    # Look for the summary sections or next session
    SESSION_13_END=$(tail -n +$SESSION_13_START "$FOUNDATION_PATH" | grep -n "^### \|^## \|^---" | grep -v "Session 1.3" | head -1 | cut -d: -f1)
    if [[ -n "$SESSION_13_END" ]]; then
        SESSION_13_END=$((SESSION_13_START + SESSION_13_END - 1))
    else
        # If still not found, extract to end of file
        SESSION_13_END=$(wc -l < "$FOUNDATION_PATH" | tr -d ' ')
    fi
fi

# Extract the Session 1.3 content
SESSION_13_CONTENT=$(sed -n "${SESSION_13_START},${SESSION_13_END}p" "$FOUNDATION_PATH")
echo -e "${GREEN}✓ Extracted Session 1.3 content (lines $SESSION_13_START to $SESSION_13_END)${NC}"
echo ""

# Create the recovered Foundation document
echo -e "${YELLOW}Recovering Foundation document...${NC}"

# Copy the v1.2 version as base
cp "$FOUNDATION_V12_PATH" "$FOUNDATION_PATH.tmp"

# Find where to insert Session 1.3 content (after Session 1.2 completion)
INSERT_POINT=$(grep -n "✅ Session 1.2 Complete:" "$FOUNDATION_PATH.tmp" | tail -1 | cut -d: -f1)

if [[ -z "$INSERT_POINT" ]]; then
    # If Session 1.2 complete marker not found, look for the summary sections
    INSERT_POINT=$(grep -n "^### 🎯 Quality Gate Summary\|^### 💬 Planning Interface Summary" "$FOUNDATION_PATH.tmp" | head -1 | cut -d: -f1)
    if [[ -n "$INSERT_POINT" ]]; then
        INSERT_POINT=$((INSERT_POINT - 1))
    else
        echo -e "${RED}Error: Could not find appropriate insertion point${NC}"
        exit 1
    fi
fi

# Insert Session 1.3 content
{
    head -n "$INSERT_POINT" "$FOUNDATION_PATH.tmp"
    echo ""
    echo "$SESSION_13_CONTENT"
    tail -n +$((INSERT_POINT + 1)) "$FOUNDATION_PATH.tmp"
} > "$FOUNDATION_PATH.new"

# Update version number to v1.3
sed -i '' 's/Foundation Version.*: v1\.2/Foundation Version: v1.3/g' "$FOUNDATION_PATH.new"
sed -i '' 's/Document Version.*: v1\.2/Document Version: v1.3/g' "$FOUNDATION_PATH.new"
sed -i '' 's/Last Session.*: 1\.2.*/Last Session: 1.3 - Real Two-Actor Model Implementation (COMPLETED)/g' "$FOUNDATION_PATH.new"
sed -i '' 's/Next Session.*: 1\.3.*/Next Session: 1.4 - Production Deployment Pipeline/g' "$FOUNDATION_PATH.new"

# Add the Two-Actor Model summary if not present
if ! grep -q "### 🎭 Two-Actor Model Summary" "$FOUNDATION_PATH.new"; then
    # Append the summary at the end before the final version line
    {
        cat "$FOUNDATION_PATH.new"
        echo ""
        echo "### 🎭 Two-Actor Model Summary"
        echo "- **Planning Actor**: Claude Chat API integrated ✅"
        echo "- **Execution Actor**: Claude Code API integrated ✅"
        echo "- **Boundary Enforcement**: Strict separation maintained ✅"
        echo "- **Session Persistence**: Full state management ✅"
        echo "- **Real-Time Monitoring**: Event streaming operational ✅"
        echo "- **Error Recovery**: Retry and circuit breaker patterns ✅"
        echo "- **Progress Tracking**: Live UI updates ✅"
        echo "- **Architecture Status**: FULLY OPERATIONAL ✅"
        echo ""
    } > "$FOUNDATION_PATH.new2"
    mv "$FOUNDATION_PATH.new2" "$FOUNDATION_PATH.new"
fi

# Append the final version information
{
    echo ""
    echo "### 🚀 Next Steps"
    echo "- **Session 1.4**: Production deployment pipeline"
    echo "- **Session 1.5**: Advanced MCP integrations"
    echo "- **Session 1.6**: Multi-session orchestration"
    echo "- **Session 2.0**: Public release preparation"
    echo ""
    echo "---"
    echo "**Foundation Version**: v1.3"
    echo "**Last Session**: 1.3 - Real Two-Actor Model Implementation (COMPLETED)"
    echo "**Next Session**: 1.4 - Production Deployment Pipeline"
    echo "**Architecture**: TWO-ACTOR MODEL FULLY OPERATIONAL ✅"
} >> "$FOUNDATION_PATH.new"

# Replace the original file
mv "$FOUNDATION_PATH.new" "$FOUNDATION_PATH"
rm -f "$FOUNDATION_PATH.tmp"

echo -e "${GREEN}✓ Foundation document recovered successfully${NC}"
echo ""

# Save the recovered version as v1.3
echo -e "${YELLOW}Saving recovered version as FOUNDATION-v1.3.md...${NC}"
cp "$FOUNDATION_PATH" "$FOUNDATION_V13_PATH"
echo -e "${GREEN}✓ Version saved: $FOUNDATION_V13_PATH${NC}"
echo ""

# Show summary of changes
echo -e "${BLUE}Recovery Summary:${NC}"
echo "- Original v1.2 content restored from: $FOUNDATION_V12_PATH"
echo "- Session 1.3 completion information preserved and appended"
echo "- Version updated to v1.3"
echo "- Backup of previous state saved to: $BACKUP_PATH"
echo "- New v1.3 version saved to: $FOUNDATION_V13_PATH"
echo ""

# Show diff summary
echo -e "${BLUE}Changes made:${NC}"
echo "- Restored all content from v1.2"
echo "- Added Session 1.3 completion section"
echo "- Updated version numbers and metadata"
echo "- Added Two-Actor Model summary section"
echo ""

echo -e "${GREEN}✅ Foundation recovery complete!${NC}"
echo ""
echo "To review the changes, you can run:"
echo "  diff \"$BACKUP_PATH\" \"$FOUNDATION_PATH\""
echo ""
echo "To see what was added from Session 1.3:"
echo "  diff \"$FOUNDATION_V12_PATH\" \"$FOUNDATION_PATH\""