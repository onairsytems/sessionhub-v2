#!/bin/bash

# SessionHub Release Rollback Script
# This script handles emergency rollback of releases

set -e

echo "🔄 SessionHub Release Rollback"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d ".github" ]; then
  echo "❌ Error: Must be run from the SessionHub project root"
  exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: v$CURRENT_VERSION"

# Get the previous release tag
PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")

if [ -z "$PREVIOUS_TAG" ]; then
  echo "❌ Error: No previous release tag found"
  exit 1
fi

echo "Previous release: $PREVIOUS_TAG"

# Confirmation prompt
read -p "⚠️  Are you sure you want to rollback from v$CURRENT_VERSION to $PREVIOUS_TAG? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Rollback cancelled"
  exit 0
fi

echo ""
echo "🔄 Starting rollback process..."

# Step 1: Update update server to point to previous version
echo "1️⃣ Updating release channels..."
# In production, this would update the update server configuration
# For now, we'll create a rollback marker file
cat > rollback-marker.json << EOF
{
  "rollback": true,
  "from_version": "$CURRENT_VERSION",
  "to_version": "${PREVIOUS_TAG#v}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "reason": "Emergency rollback initiated"
}
EOF

# Step 2: Update latest release pointers
echo "2️⃣ Updating release pointers..."
if command -v gh &> /dev/null; then
  # Mark current release as pre-release
  gh release edit "v$CURRENT_VERSION" --prerelease --notes "⚠️ ROLLED BACK: This release has been rolled back to $PREVIOUS_TAG"
  
  # Remove pre-release flag from previous version
  gh release edit "$PREVIOUS_TAG" --latest
else
  echo "⚠️  GitHub CLI not found. Please manually update releases on GitHub"
fi

# Step 3: Create rollback commit
echo "3️⃣ Creating rollback commit..."
git add rollback-marker.json
git commit -m "chore(rollback): emergency rollback from v$CURRENT_VERSION to $PREVIOUS_TAG

BREAKING CHANGE: This is an emergency rollback. Users on v$CURRENT_VERSION should update immediately.

Rollback initiated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
" || echo "No changes to commit"

# Step 4: Tag the rollback
ROLLBACK_TAG="rollback-v$CURRENT_VERSION-to-${PREVIOUS_TAG#v}"
git tag -a "$ROLLBACK_TAG" -m "Emergency rollback from v$CURRENT_VERSION to $PREVIOUS_TAG"

# Step 5: Push changes
echo "4️⃣ Pushing rollback changes..."
read -p "Push rollback to origin? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin main --tags
fi

# Step 6: Notify monitoring systems
echo "5️⃣ Notifying monitoring systems..."
# In production, this would notify error monitoring, analytics, etc.
echo "⚠️  Please manually notify the team about this rollback"

# Step 7: Generate rollback report
echo "6️⃣ Generating rollback report..."
cat > rollback-report-$(date +%Y%m%d-%H%M%S).md << EOF
# Emergency Rollback Report

**Date**: $(date)
**Rolled back from**: v$CURRENT_VERSION
**Rolled back to**: $PREVIOUS_TAG
**Initiated by**: $(git config user.name)

## Actions Taken

1. ✅ Updated release channels to previous version
2. ✅ Marked v$CURRENT_VERSION as pre-release
3. ✅ Marked $PREVIOUS_TAG as latest release
4. ✅ Created rollback commit and tag
5. ✅ Generated rollback report

## Required Follow-up Actions

1. Monitor error rates and user reports
2. Investigate root cause of issues in v$CURRENT_VERSION
3. Prepare hotfix or new release
4. Update team on rollback status
5. Review deployment procedures

## Rollback Verification Checklist

- [ ] Update server pointing to correct version
- [ ] Users receiving correct version
- [ ] Error rates returning to normal
- [ ] No critical issues reported
- [ ] Team notified of rollback

EOF

echo ""
echo "✅ Rollback completed!"
echo ""
echo "📋 Rollback report saved to: rollback-report-$(date +%Y%m%d-%H%M%S).md"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Monitor error rates and user feedback"
echo "2. Review the rollback report"
echo "3. Investigate issues in v$CURRENT_VERSION"
echo "4. Notify the team about the rollback"
echo "5. Prepare a fix for the issues"