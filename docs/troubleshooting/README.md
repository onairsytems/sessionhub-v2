# SessionHub Troubleshooting Guide

This guide helps you resolve common issues quickly and get back to productive development.

## Quick Diagnostics

Before diving into specific issues, run these diagnostic checks:

```bash
# Check SessionHub version
sessionhub --version

# Verify API configuration
sessionhub config check

# Test API connectivity
sessionhub test api

# Check system resources
sessionhub diagnostics
```

## Common Issues

### 1. Session Failures

#### Planning Actor Timeout

**Symptoms:**
- Session stuck at "Planning" stage
- No progress after 5+ minutes
- Timeout error message

**Solutions:**
1. **Simplify your request**
   ```
   Instead of: "Build a complete e-commerce platform"
   Try: "Create a product listing page with search"
   ```

2. **Check API key**
   ```bash
   # Verify API key is valid
   sessionhub config validate anthropic
   ```

3. **Break into smaller sessions**
   - Session 1: Database schema
   - Session 2: API endpoints
   - Session 3: Frontend components

#### Execution Actor Errors

**Symptoms:**
- Execution fails immediately
- "Cannot find module" errors
- Permission denied errors

**Solutions:**
1. **Verify project setup**
   ```bash
   # Ensure you're in a git repository
   git status
   
   # Check Node modules (for JS projects)
   npm install
   ```

2. **Check file permissions**
   ```bash
   # Fix permissions
   chmod -R 755 .
   ```

3. **Clear SessionHub cache**
   ```bash
   sessionhub cache clear
   ```

### 2. Quality Gate Failures

#### TypeScript Errors

**Symptoms:**
- "TypeScript compilation failed"
- Red error badges in UI
- Session marked as failed

**Solutions:**
1. **Update TypeScript config**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "skipLibCheck": true,
       "allowJs": true
     }
   }
   ```

2. **Install missing types**
   ```bash
   npm install --save-dev @types/node @types/react
   ```

3. **Use template with TypeScript**
   - Select TypeScript-enabled templates
   - Include type definitions in request

#### ESLint Violations

**Symptoms:**
- "ESLint check failed"
- Style violation errors
- Formatting issues

**Solutions:**
1. **Auto-fix violations**
   ```bash
   npm run lint:fix
   ```

2. **Update ESLint config**
   ```javascript
   // .eslintrc.js
   module.exports = {
     rules: {
       // Adjust rules as needed
     }
   };
   ```

3. **Include in session request**
   ```
   "Follow project ESLint rules and conventions"
   ```

### 3. API Connection Issues

#### Authentication Failures

**Symptoms:**
- "Invalid API key" error
- 401 Unauthorized responses
- Cannot connect to Anthropic

**Solutions:**
1. **Verify API key**
   - Go to Settings > API Configuration
   - Re-enter your Anthropic API key
   - Test connection

2. **Check API limits**
   - Verify your API plan
   - Check rate limits
   - Monitor usage

3. **Network issues**
   ```bash
   # Test connectivity
   curl https://api.anthropic.com/v1/health
   ```

### 4. IDE Integration Problems

#### VS Code Not Opening

**Symptoms:**
- Files don't open in IDE
- "Cannot find VS Code" error
- Wrong application opens

**Solutions:**
1. **Configure IDE path**
   ```bash
   # Set VS Code as default
   sessionhub config set ide vscode
   
   # Custom path
   sessionhub config set ide.path "/Applications/Visual Studio Code.app"
   ```

2. **Install command line tools**
   - In VS Code: Cmd+Shift+P
   - Run: "Shell Command: Install 'code' command"

### 5. Performance Issues

#### Slow Session Execution

**Symptoms:**
- Sessions take unusually long
- UI becomes unresponsive
- High CPU/memory usage

**Solutions:**
1. **Optimize requests**
   - Be specific and concise
   - Avoid overly complex requirements
   - Use session templates

2. **Clear cache and logs**
   ```bash
   sessionhub maintenance run
   ```

3. **Check system resources**
   - Close unnecessary applications
   - Free up disk space
   - Restart SessionHub

### 6. Project Detection Issues

#### Project Not Found

**Symptoms:**
- "No project detected" error
- Cannot create sessions
- Empty project list

**Solutions:**
1. **Initialize git repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Check project structure**
   - Ensure package.json exists (for Node projects)
   - Verify project type detection

3. **Manual project setup**
   - Click "Add Project Manually"
   - Select project directory
   - Choose project type

## Advanced Troubleshooting

### Debug Mode

Enable detailed logging:
```bash
# Start with debug logging
sessionhub --debug

# View logs
tail -f ~/Library/Logs/SessionHub/debug.log
```

### Reset SessionHub

Complete reset (use with caution):
```bash
# Backup your data first!
sessionhub backup create

# Reset to defaults
sessionhub reset --confirm

# Restore from backup
sessionhub backup restore
```

### Manual Recovery

If SessionHub won't start:
1. **Safe mode**
   ```bash
   sessionhub --safe-mode
   ```

2. **Clear preferences**
   ```bash
   rm -rf ~/Library/Preferences/com.sessionhub.app.plist
   ```

3. **Reinstall**
   - Download latest version
   - Completely uninstall first
   - Fresh installation

## Error Reference

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| SH001 | API key invalid | Re-enter API key in settings |
| SH002 | Network timeout | Check internet connection |
| SH003 | Project not found | Initialize git repository |
| SH004 | Planning failed | Simplify request |
| SH005 | Execution failed | Check error details |
| SH006 | Quality gate failed | Fix TypeScript/ESLint errors |
| SH007 | Out of memory | Restart SessionHub |
| SH008 | Permission denied | Check file permissions |
| SH009 | Invalid template | Update template library |
| SH010 | Cache corrupted | Clear cache |

## Getting Help

### Self-Service Resources

1. **Documentation**
   - User Guide: `/docs/user-guide`
   - API Reference: `/docs/api-reference`
   - Video Tutorials: Built-in tutorial system

2. **Diagnostic Tools**
   ```bash
   # Generate diagnostic report
   sessionhub diagnostics report
   
   # Check specific component
   sessionhub check [component]
   ```

3. **Community Support**
   - GitHub Issues: Report bugs
   - Discussions: Ask questions
   - Discord: Real-time help

### Contacting Support

For unresolved issues:
1. Generate diagnostic report
2. Include session logs
3. Describe steps to reproduce
4. Submit via GitHub Issues

## Preventive Measures

### Best Practices

1. **Keep SessionHub Updated**
   - Enable auto-updates
   - Check for updates regularly

2. **Regular Maintenance**
   ```bash
   # Weekly maintenance
   sessionhub maintenance weekly
   ```

3. **Monitor Resources**
   - Check disk space
   - Monitor API usage
   - Review session history

4. **Use Templates**
   - Proven patterns
   - Fewer errors
   - Faster execution

### Health Checks

Run periodic health checks:
```bash
# Full system check
sessionhub health check --full

# Quick check
sessionhub health check
```

## FAQ

**Q: Why did my session fail with no error message?**
A: Check the debug logs at `~/Library/Logs/SessionHub/`. Enable debug mode for more details.

**Q: Can I resume a failed session?**
A: Yes, use `sessionhub session resume [session-id]` or click "Resume" in the UI.

**Q: How do I report a bug?**
A: Use `sessionhub bug report` to generate a report with logs and system info.

**Q: Is my data secure?**
A: SessionHub stores data locally. API keys are encrypted. No code is sent to external servers except the AI API.

---

Still need help? Visit our [GitHub Issues](https://github.com/sessionhub/sessionhub/issues) page.