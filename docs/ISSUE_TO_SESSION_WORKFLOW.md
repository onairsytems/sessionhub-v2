# Issue-to-Session Workflow Documentation

## Overview

SessionHub's self-development pipeline automatically converts GitHub issues into executable development sessions. This document describes the complete workflow from issue creation to session completion.

## Workflow Stages

### 1. Issue Creation
Users create issues in configured GitHub repositories with specific labels.

**Requirements:**
- Repository must be in configured list
- Issue must have `sessionhub-auto` label
- Clear title and description
- Optional priority labels: `critical`, `high-priority`, `low-priority`

**Example Issue:**
```markdown
Title: Add dark mode support to settings page

Labels: sessionhub-auto, feature, high-priority

Description:
Users have requested dark mode support in the application settings.
The toggle should persist between sessions and apply immediately.

Requirements:
- Add theme toggle in settings UI
- Persist theme preference
- Apply theme without restart
- Support system theme detection
```

### 2. Issue Detection

**Webhook Reception** (Primary):
- GitHub sends webhook on issue events
- Signature verified for security
- Real-time processing

**API Polling** (Fallback):
- Polls every 5 minutes
- Catches missed webhooks
- Ensures reliability

### 3. Natural Language Processing

The `SessionConverter` analyzes issues using AI to extract:

**Objectives** - What needs to be done:
- Clear, actionable goals
- Derived from issue description
- Prioritized by importance

**Requirements** - Technical specifications:
- Implementation details
- Constraints and dependencies
- Acceptance criteria

**Categorization**:
- `bug-fix` - Fixing errors or issues
- `feature` - New functionality
- `performance` - Speed improvements
- `security` - Security patches
- `refactor` - Code improvements
- `documentation` - Docs updates
- `infrastructure` - System changes
- `ui-ux` - Interface improvements

**Complexity Estimation**:
- `simple` - < 2 hours
- `moderate` - 2-8 hours
- `complex` - > 8 hours

### 4. Session Generation

Converted issues become `SessionInstruction` objects:

```typescript
{
  id: "uuid",
  sourceType: "github-issue",
  sourceId: "repo/owner#123",
  title: "Fix: Add dark mode support",
  objectives: [
    "Implement theme toggle UI",
    "Add theme persistence",
    "Support system preferences"
  ],
  requirements: [
    "Use existing UI framework",
    "Store in localStorage",
    "No page refresh required"
  ],
  priority: "high",
  category: "feature",
  estimatedComplexity: "moderate",
  metadata: {
    githubIssueNumber: 123,
    githubRepoFullName: "owner/repo",
    labels: ["sessionhub-auto", "feature"],
    author: "username"
  },
  createdAt: "2025-06-09T10:00:00Z",
  status: "pending"
}
```

### 5. Priority Queue Management

Sessions enter a priority queue based on:

**Priority Score Calculation**:
```
Base Score:
- critical: 1000
- high: 100
- medium: 10
- low: 1

Modifiers:
- Production errors: 2x multiplier
- Affected users: +1 per user
- Security issues: Set to critical
```

**Queue Rules**:
- Higher scores execute first
- FIFO within same priority
- One session at a time
- Failed sessions can retry

### 6. Session Execution

The `PipelineOrchestrator` manages execution:

1. **Pre-execution**:
   - Update GitHub issue status
   - Create workspace
   - Load context

2. **Execution**:
   - Planning Actor creates strategy
   - Execution Actor implements
   - Validation runs continuously
   - Progress tracked in real-time

3. **Post-execution**:
   - Commit changes if successful
   - Update issue with results
   - Trigger deployment if configured
   - Clean up workspace

### 7. GitHub Integration

**Issue Updates** throughout lifecycle:

1. **Queued**:
   ```
   SessionHub Auto-Development Update
   Status: Queued for processing
   Session ID: abc-123
   Priority: high
   Category: feature
   ```

2. **In Progress**:
   ```
   SessionHub Auto-Development Update
   Status: In Progress
   SessionHub is actively working on this issue.
   ```

3. **Completed**:
   ```
   SessionHub Auto-Development Update
   Status: Completed
   The issue has been resolved.
   Commits: abc123, def456
   ```

4. **Failed**:
   ```
   SessionHub Auto-Development Update
   Status: Failed
   The session failed: [error details]
   ```

### 8. Production Error Integration

Production errors automatically create sessions:

**Error Detection**:
- Monitoring threshold exceeded
- Critical error patterns
- User impact metrics

**Session Creation**:
- Higher priority than issues
- Includes stack traces
- Affected user count
- Frequency data

### 9. Deployment Pipeline

Successful sessions can trigger deployments:

**Automatic Deployment**:
- Critical fixes deploy immediately
- Features deploy to beta channel
- Requires cryptographic signing
- Rollback capability included

**Manual Approval**:
- Non-critical changes queued
- Admin review required
- Batch deployments supported

## Configuration

### Pipeline Configuration
```typescript
{
  github: {
    webhookSecret: "secret",
    apiToken: "token",
    repos: ["owner/repo1", "owner/repo2"],
    labelFilter: ["sessionhub-auto"]
  },
  production: {
    errorThreshold: 5,
    monitoringInterval: 60000
  },
  deployment: {
    autoDeployEnabled: true,
    requiresApproval: false,
    signatureKeyPath: "/path/to/key",
    updateChannels: ["stable", "beta"]
  }
}
```

### Label Configuration

**Required Labels**:
- `sessionhub-auto` - Enables automatic processing

**Priority Labels**:
- `critical` - Immediate attention
- `urgent` - High priority
- `high-priority` - Above normal
- `low-priority` - Below normal

**Category Labels** (optional):
- `bug` - Categorize as bug-fix
- `enhancement` - New feature
- `security` - Security issue

## Security Considerations

1. **Webhook Verification**:
   - HMAC-SHA256 signatures
   - Constant-time comparison
   - IP allowlisting optional

2. **API Authentication**:
   - Encrypted token storage
   - Mac Keychain integration
   - Token rotation supported

3. **Execution Sandbox**:
   - Isolated environments
   - Limited permissions
   - Resource constraints

## Monitoring & Debugging

### Audit Trail
All operations logged:
- Issue reception
- Conversion process
- Session execution
- Deployment actions

### Status Monitoring
```typescript
// Get pipeline status
const status = await getPipelineStatus();
// Returns:
{
  isRunning: true,
  currentSession: { ... },
  queueLength: 3,
  lastDeployment: { ... },
  health: {
    github: "connected",
    production: "healthy",
    deployment: "ready"
  }
}
```

### Debugging Tools
- Webhook test endpoint
- Manual session creation
- Queue inspection
- Execution logs

## Best Practices

1. **Issue Writing**:
   - Clear, actionable titles
   - Detailed descriptions
   - Include acceptance criteria
   - Add relevant labels

2. **Priority Management**:
   - Reserve 'critical' for emergencies
   - Use priority labels consistently
   - Consider user impact

3. **Session Design**:
   - Keep sessions focused
   - One issue per session
   - Clear success criteria
   - Testable outcomes

4. **Monitoring**:
   - Watch queue length
   - Monitor failure rates
   - Track execution times
   - Review audit logs

## Troubleshooting

### Issues Not Processing
1. Check label presence
2. Verify repository configuration
3. Test webhook connectivity
4. Check API credentials

### Sessions Failing
1. Review issue clarity
2. Check complexity estimation
3. Verify requirements feasible
4. Examine error logs

### Deployment Issues
1. Verify signing keys
2. Check deployment permissions
3. Review package integrity
4. Test rollback procedures

## Future Enhancements

1. **Machine Learning**:
   - Improve categorization accuracy
   - Better time estimation
   - Pattern recognition

2. **Advanced Workflows**:
   - Multi-issue sessions
   - Dependency handling
   - Parallel execution

3. **Enhanced Integration**:
   - Slack notifications
   - JIRA synchronization
   - CI/CD pipelines