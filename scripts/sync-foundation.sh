#!/bin/bash

# CRITICAL: This script ensures Foundation.md is ALWAYS saved to BOTH locations
# The Google Drive local sync folder is the PRIMARY reference location

set -e  # Exit on any error

echo "=== Foundation.md Sync Script ==="
echo ""

# Define the two required locations
REPO_PATH="/Users/jonathanhoggard/Development/sessionhub-v2/docs/FOUNDATION.md"
GDRIVE_PATH="/Users/jonathanhoggard/Library/CloudStorage/GoogleDrive-jonathan@onairsystems.org/My Drive/SessionHub/FOUNDATION.md"

# Check which file is newer (if both exist)
if [ -f "$REPO_PATH" ] && [ -f "$GDRIVE_PATH" ]; then
    if [ "$REPO_PATH" -nt "$GDRIVE_PATH" ]; then
        echo "Repository version is newer. Syncing to Google Drive..."
        cp "$REPO_PATH" "$GDRIVE_PATH"
        echo "✅ Copied from repo to Google Drive"
    elif [ "$GDRIVE_PATH" -nt "$REPO_PATH" ]; then
        echo "Google Drive version is newer. Syncing to repository..."
        cp "$GDRIVE_PATH" "$REPO_PATH"
        echo "✅ Copied from Google Drive to repo"
    else
        echo "✅ Both files are already in sync"
    fi
elif [ -f "$REPO_PATH" ]; then
    echo "Only repository version exists. Copying to Google Drive..."
    cp "$REPO_PATH" "$GDRIVE_PATH"
    echo "✅ Copied to Google Drive"
elif [ -f "$GDRIVE_PATH" ]; then
    echo "Only Google Drive version exists. Copying to repository..."
    cp "$GDRIVE_PATH" "$REPO_PATH"
    echo "✅ Copied to repository"
else
    echo "❌ ERROR: Foundation.md not found in either location!"
    exit 1
fi

# Also save versioned copy if updating
if [ -f "$REPO_PATH" ]; then
    # Extract version from document
    VERSION=$(grep -m1 "Document Version" "$REPO_PATH" | sed 's/.*v\([0-9.]*\).*/\1/')
    if [ ! -z "$VERSION" ]; then
        VERSION_PATH="/Users/jonathanhoggard/Development/sessionhub-v2/docs/foundation-versions/FOUNDATION-v${VERSION}.md"
        if [ ! -f "$VERSION_PATH" ] || [ "$REPO_PATH" -nt "$VERSION_PATH" ]; then
            cp "$REPO_PATH" "$VERSION_PATH"
            echo "✅ Saved version $VERSION to foundation-versions/"
        fi
    fi
fi

echo ""
echo "Sync complete! Foundation.md is available at:"
echo "  1. $REPO_PATH"
echo "  2. $GDRIVE_PATH"
echo ""
echo "Remember: ALWAYS update BOTH locations!"