# SessionHub Emergency Recovery Procedures

## Overview

SessionHub includes comprehensive emergency recovery capabilities to ensure system resilience and data protection. These procedures are designed to recover from various failure scenarios without requiring normal application startup.

## Recovery Triggers

### Automatic Recovery Detection
- **Crash Marker**: System automatically detects improper shutdown
- **Startup Check**: Recovery check runs on every application start
- **User Prompt**: Dialog presents recovery options when issues detected

### Manual Recovery Triggers
- **Command Line**: `sessionhub --recover`
- **Safe Mode**: `sessionhub --safe-mode`
- **Factory Reset**: `sessionhub --factory-reset`

## Recovery Procedures

### 1. Standard Recovery
When SessionHub detects a crash or corruption:

1. **Validation Phase**
   - Verify installation integrity
   - Check required files exist
   - Validate file checksums if available

2. **Dependency Check**
   - Ensure node_modules present
   - Verify critical dependencies
   - Reinstall if necessary

3. **Configuration Restoration**
   - Restore from backup if available
   - Create default config if missing
   - Preserve user preferences when possible

4. **Cache Clearing**
   - Remove GPU cache
   - Clear code cache
   - Delete temporary files

5. **Database Repair**
   - Run integrity check
   - Vacuum database
   - Create new database if unrepairable

### 2. Factory Reset
Complete system reset with data backup:

1. **Emergency Backup**
   - Save configuration
   - Backup database
   - Preserve credentials

2. **Data Removal**
   - Clear all user data
   - Reset preferences
   - Remove cached content

3. **Fresh Start**
   - Initialize default configuration
   - Create new database
   - Restart application

### 3. Emergency Recovery Console
Web-based recovery interface for advanced troubleshooting:

- Access via: `http://localhost:3000/recovery`
- Provides system diagnostics
- Manual recovery controls
- Log file access

## Recovery Components

### EmergencyRecoverySystem
- **Location**: `src/services/pipeline/EmergencyRecoverySystem.ts`
- **Singleton Pattern**: Ensures single recovery instance
- **Crash Detection**: Automatic failure detection
- **Recovery Steps**: Modular recovery procedures

### Recovery Files
- **Crash Marker**: `~/.sessionhub/recovery/.crash_marker`
- **Config Backup**: `~/.sessionhub/recovery/config.backup.json`
- **Checksums**: `~/.sessionhub/recovery/checksums.json`
- **Emergency Backups**: `~/.sessionhub/recovery/emergency_backup/`

## Recovery Workflows

### Crash Recovery Flow
```
App Start → Check Crash Marker → Show Recovery Dialog
    ↓
User Choice:
- Recover → Run Recovery Steps → Clear Marker → Continue
- Factory Reset → Backup → Reset → Restart
- Continue Anyway → Clear Marker → Normal Start
```

### Manual Recovery Flow
```
Command Line Flag → Skip Normal Start → Enter Recovery Mode
    ↓
Run Selected Recovery:
- Standard → Execute Recovery Steps
- Safe Mode → Limited Functionality
- Factory Reset → Complete Reset
```

## Best Practices

### Prevention
1. **Regular Checkpoints**: Create recovery checkpoints after major changes
2. **Configuration Backups**: Automatic backup of critical settings
3. **Database Maintenance**: Regular integrity checks and optimization

### During Recovery
1. **User Communication**: Clear progress indicators
2. **Data Preservation**: Always backup before destructive operations
3. **Audit Trail**: Log all recovery actions

### Post-Recovery
1. **Verification**: Ensure system functionality
2. **User Notification**: Inform about recovery results
3. **Checkpoint Creation**: Save known-good state

## Command Line Options

```bash
# Standard recovery
sessionhub --recover

# Safe mode (minimal features)
sessionhub --safe-mode

# Factory reset with confirmation
sessionhub --factory-reset

# Skip recovery checks
sessionhub --skip-recovery

# Create recovery checkpoint
sessionhub --create-checkpoint
```

## API Endpoints

### IPC Handlers
- `pipeline:triggerRecovery` - Initiate recovery
- `pipeline:factoryReset` - Perform factory reset
- `pipeline:createRecoveryCheckpoint` - Save recovery point

### Recovery Status
- `recovery:getStatus` - Check recovery state
- `recovery:getLastRecovery` - Get recovery history
- `recovery:validateSystem` - Run system checks

## Troubleshooting

### Recovery Fails
1. Check logs in `~/.sessionhub/logs/`
2. Try safe mode: `sessionhub --safe-mode`
3. Manual file verification
4. Last resort: Complete reinstall

### Data Loss Prevention
1. Emergency backups saved automatically
2. Located in `~/.sessionhub/recovery/emergency_backup/`
3. Timestamped folders preserve history
4. Manual restore possible

### Recovery Loop
If stuck in recovery loop:
1. Delete crash marker manually
2. Start with `--skip-recovery`
3. Investigate root cause
4. Create new checkpoint when stable

## Integration with Self-Development Pipeline

The emergency recovery system integrates with the self-development pipeline:

1. **Automatic Issue Creation**: Recovery failures can trigger GitHub issues
2. **Self-Healing**: System attempts automatic fixes for known issues
3. **Deployment Rollback**: Can revert to previous version if needed
4. **Audit Integration**: All recovery actions logged for analysis

## Security Considerations

1. **Credential Protection**: Encrypted credentials preserved during recovery
2. **Backup Encryption**: Emergency backups use same encryption as main data
3. **Access Control**: Recovery console requires authentication
4. **Audit Logging**: All recovery actions tracked for security

Remember: The emergency recovery system is your safety net. Regular checkpoints and proper shutdown procedures minimize the need for recovery.