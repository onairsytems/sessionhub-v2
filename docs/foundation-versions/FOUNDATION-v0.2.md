# SessionHub V2 Living Foundation Document

> Living document - Claude Code updates after each session
> Synced via Google Drive Desktop
> Version controlled in docs/foundation-versions/

## ⚠️ CRITICAL: Session Execution Methodology
**Each session MUST be delivered as ONE comprehensive Claude Code script**
- NO multiple copy-paste operations
- NO artifact creation in chat
- ONE script that does everything for the session
- Chat is for planning only, execution is one command

## Document Metadata
- **Version**: 1.2.0
- **Document Version**: v0.2
- **Last Updated**: 2025-06-06 16:15:00 UTC
- **Last Session**: 0.2 - Bootstrap Validation
- **Next Session**: 0.3 - UI Foundation
- **Version History**: docs/foundation-versions/VERSION-INDEX.md
- **Location**: ~/Google Drive/My Drive/SessionHub/FOUNDATION.md
- **Validation Status**: ✅ All systems operational

## 📚 Version Control
This document is version controlled:
- **Current**: FOUNDATION.md (always latest)
- **History**: docs/foundation-versions/FOUNDATION-v{X.Y}.md
- **Rollback**: Copy any version back to Google Drive location
- **Compare**: Use git diff to see changes between versions

## 🚀 Quick Start for New Chat

### Load and Verify Version
```bash
# First command in every new chat:
claude-code "
cd ~/Development/sessionhub-v2
echo 'Current Foundation version:' && head -20 docs/FOUNDATION.md | grep -E 'Version|Session'
echo '' && echo 'Version history:' && ls -la docs/foundation-versions/
echo '' && git log --oneline -5
"
```

### Run Bootstrap Validation
```bash
# Verify system integrity:
claude-code "
cd ~/Development/sessionhub-v2
./tests/bootstrap/run-validation.sh
"
```

### Session Execution Pattern
```bash
# Request format:
"I need Session X.Y as a single comprehensive Claude Code script"

# Claude provides ONE script that includes:
# 1. All file operations
# 2. Validation
# 3. Git commit
# 4. Foundation document update
# 5. VERSION SNAPSHOT (new!)
```

## 📋 Project Overview
**Mission**: Build a personal development velocity platform that achieves speed through perfection
**Method**: Zero-error sessions via single comprehensive scripts
**Status**: Foundation established with validation framework

## 🎯 Session Script Template (With Versioning)

Every session script now includes version control:

```bash
claude-code "
# Session X.Y: [Name]
echo '🚀 Starting Session X.Y: [Name]'

cd ~/Development/sessionhub-v2

# Create version snapshot BEFORE changes
cp ~/Google\ Drive/My\ Drive/SessionHub/FOUNDATION.md docs/foundation-versions/FOUNDATION-v{X.Y-1}.md

# [... all session operations ...]

# Update Foundation document
cat > ~/Google\ Drive/My\ Drive/SessionHub/FOUNDATION.md << 'ENDFILE'
[Updated foundation content]
ENDFILE

# Create version snapshot AFTER changes
cp ~/Google\ Drive/My\ Drive/SessionHub/FOUNDATION.md docs/foundation-versions/FOUNDATION-v{X.Y}.md

# Update version index
cat >> docs/foundation-versions/VERSION-INDEX.md << 'ENDFILE'
### v{X.Y} - [Session Name]
- **Date**: $(date -u +'%Y-%m-%d %H:%M:%S UTC')
- **Session**: X.Y - [Session Name]
- **Key Changes**: [List key changes]
- **Status**: Complete ✅
ENDFILE

# Commit everything including version
git add -A
git commit -m 'Session X.Y: [Name] - Foundation v{X.Y}'

echo '✅ Session X.Y Complete! Foundation version v{X.Y} saved.'
"
```

## 🏗️ Current State

### Completed Sessions
1. **Session 0.1**: Project Initialization ✅
   - Foundation Version: v0.1
   - Single script execution
   - Version control established

2. **Session 0.2**: Bootstrap Validation ✅
   - Foundation Version: v0.2
   - Validation framework created
   - All systems verified operational

### Next Session: 0.3 - UI Foundation
Request: "I need Session 0.3: UI Foundation as a single comprehensive Claude Code script"

**The script will**:
1. Snapshot current version (v0.2)
2. Create Next.js 14 app with App Router
3. Set up Tailwind CSS and shadcn/ui
4. Create base layout and navigation
5. Update Foundation to v0.3
6. Save new version snapshot
7. Commit everything

## 🧪 Validation Framework

### Bootstrap Validator
Located at: `src/validation/validator.js`

**Tests**:
- Project Structure ✅
- Git Integration ✅
- Google Drive Sync ✅
- Version Control ✅
- Foundation Integrity ✅

### Running Validation
```bash
# Quick validation check
./tests/bootstrap/run-validation.sh

# Or directly
node src/validation/validator.js
```

### Validation Report
Generated at: `tests/bootstrap/validation-report.md`

## 📊 Version Control Benefits

1. **History**: See how decisions evolved
2. **Rollback**: Restore previous states easily
3. **Comparison**: `git diff` between versions
4. **Debugging**: Track when changes were introduced
5. **Learning**: Review your journey

## 🔄 Version Management Commands

### View Version History
```bash
claude-code "
cd ~/Development/sessionhub-v2
ls -la docs/foundation-versions/
cat docs/foundation-versions/VERSION-INDEX.md
"
```

### Compare Versions
```bash
claude-code "
cd ~/Development/sessionhub-v2
diff docs/foundation-versions/FOUNDATION-v0.1.md docs/foundation-versions/FOUNDATION-v0.2.md
"
```

### Rollback to Previous Version
```bash
claude-code "
cd ~/Development/sessionhub-v2
# Rollback to v0.1
cp docs/foundation-versions/FOUNDATION-v0.1.md ~/Google\ Drive/My\ Drive/SessionHub/FOUNDATION.md
echo 'Rolled back to version 0.1'
"
```

## 📝 Session Log

### Session 0.1: Project Initialization ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.1
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.1.md

### Session 0.2: Bootstrap Validation ✅
- **Date**: 2025-06-06
- **Foundation Version**: v0.2
- **Version Saved**: Yes
- **Location**: docs/foundation-versions/FOUNDATION-v0.2.md
- **Key Achievement**: Validation framework operational

## 🚨 Version Control Rules

1. **Before Each Session**: Previous version is automatically saved
2. **After Each Session**: New version is created
3. **Version Naming**: Always matches session number
4. **No Manual Editing**: Only update via session scripts
5. **Git Tracks Everything**: Both current and all versions

## ✅ Enhanced Checklist

Starting a session:
- [ ] Check current version with quick start command
- [ ] Run bootstrap validation to ensure integrity
- [ ] Verify version history is intact
- [ ] Request single comprehensive script
- [ ] Script will handle versioning automatically

After completion:
- [ ] New version file exists in foundation-versions/
- [ ] VERSION-INDEX.md is updated
- [ ] Git commit includes version info
- [ ] Google Drive has latest version
- [ ] Run validation to confirm success

## 🎓 The Power of Version Control

With this system you can:
- **Track Progress**: See evolution session by session
- **Learn from History**: Review past decisions
- **Experiment Safely**: Easy rollback if needed
- **Share Journey**: Complete documented history
- **Debug Issues**: Pinpoint when problems started
- **Validate Integrity**: Ensure zero-error methodology

---
**Version**: v0.2 | **Session**: 0.2 | **Next**: 0.3

**Remember**: Every session creates a permanent snapshot of progress!