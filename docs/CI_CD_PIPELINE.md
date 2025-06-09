# SessionHub CI/CD Pipeline Documentation

## Overview

SessionHub uses a comprehensive CI/CD pipeline built on GitHub Actions to ensure code quality, automate testing, and streamline deployment. The pipeline enforces strict quality gates and provides automated release management with multiple deployment channels.

## Pipeline Architecture

### 1. **Continuous Integration**

Every push and pull request triggers quality checks:

- **Quality Gates** (`quality-gates.yml`)
  - TypeScript compilation with zero tolerance for errors
  - ESLint with zero warnings allowed
  - Security audit for dependencies
  - Two-Actor Model compliance validation
  - Error detection system integration

- **Build Verification** (`quality-check.yml`)
  - Multi-platform build testing (macOS, Linux, Windows)
  - Parallel builds to ensure cross-platform compatibility
  - Build artifact validation

- **Test Automation**
  - Unit tests with Jest
  - Integration tests for core functionality
  - Architecture compliance tests
  - Smoke tests on built artifacts

### 2. **Continuous Deployment**

The deployment pipeline (`production-deployment.yml`) provides:

- **Automated Builds**
  - Platform-specific packaging (DMG, EXE, AppImage)
  - Code signing for macOS with notarization
  - Build manifest generation with metadata

- **Release Channels**
  - **Beta Channel**: Automatic deployment from `develop` branch
  - **Production Channel**: Manual approval required for `main` branch
  - Staged rollouts with monitoring

- **Deployment Verification**
  - Smoke tests on all platforms
  - Update server health checks
  - Download link verification
  - Error rate monitoring
  - Rollback capability verification

### 3. **Release Management**

- **Semantic Versioning** (`semantic-release.yml`)
  - Automatic version bumping based on commit messages
  - Follows conventional commit format
  - Changelog generation from commits

- **Pull Request Automation** (`pr-automation.yml`)
  - Auto-labeling by PR type and size
  - Conventional commit format enforcement
  - Automated PR summaries and checklists
  - Dependabot auto-merge for minor updates

## Workflow Triggers

### Push Events
- **Main Branch**: Triggers production deployment pipeline
- **Develop Branch**: Triggers beta deployment
- **Feature Branches**: Runs quality gates only

### Pull Requests
- All quality gates must pass
- Automated testing and build verification
- PR automation for better developer experience

### Tags
- Version tags (v*) trigger production releases
- Requires manual approval in production environment

### Manual Dispatch
- Deployment can be triggered manually
- Choice of deployment environment and channel

## Quality Gates

All deployments must pass:

1. **Code Quality**
   - Zero TypeScript errors
   - Zero ESLint violations
   - No console.log statements

2. **Testing**
   - All unit tests passing
   - Integration tests successful
   - Architecture compliance verified

3. **Security**
   - Dependency audit passed
   - Code signing successful
   - No exposed secrets

4. **Build Verification**
   - Successful builds on all platforms
   - Valid build manifests
   - Artifact integrity verified

## Deployment Process

### Beta Releases

1. Code pushed to `develop` branch
2. Quality gates run automatically
3. If passed, build artifacts created
4. Beta release created with pre-release flag
5. Update server notified
6. Deployment verification runs

### Production Releases

1. Semantic release creates version tag
2. Quality gates run with strict validation
3. Manual approval required in GitHub
4. Production build with code signing
5. GitHub release created
6. Update channels updated
7. Post-deployment monitoring

## Monitoring & Rollback

### Deployment Monitoring
- Real-time error rate tracking
- Download success metrics
- Update server health checks
- User feedback integration

### Rollback Procedures
- Automatic rollback on critical failures
- Manual rollback capability
- Previous version availability
- Update channel reversion

## Environment Variables

Required secrets in GitHub:

```yaml
# Apple Code Signing (macOS)
APPLE_ID                # Developer Apple ID
APPLE_ID_PASSWORD       # App-specific password
APPLE_TEAM_ID          # Team identifier
CSC_LINK               # Certificate base64
CSC_KEY_PASSWORD       # Certificate password

# Windows Code Signing
WIN_CSC_LINK           # Windows certificate
WIN_CSC_KEY_PASSWORD   # Windows cert password

# GitHub
GITHUB_TOKEN           # Auto-provided by Actions
```

## Local Development

To test the CI/CD pipeline locally:

```bash
# Run quality gates
npm run quality:check

# Run all tests
npm test
npm run test:integration
npm run test:two-actor

# Build for current platform
npm run electron:build
npm run electron:dist

# Run smoke tests
npm run test:smoke

# Verify deployment
npm run deploy:verify
```

## Commit Message Format

Follow conventional commits for automatic versioning:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `BREAKING CHANGE:` - Breaking changes (major version bump)
- `chore:` - Maintenance tasks (no version bump)
- `docs:` - Documentation updates (no version bump)

Examples:
```
feat(auth): add OAuth2 integration
fix(ui): resolve button alignment issue
feat!: redesign configuration API
BREAKING CHANGE: config format changed
```

## Best Practices

1. **Always run quality checks locally** before pushing
2. **Write meaningful commit messages** for better changelogs
3. **Add tests** for new features and bug fixes
4. **Update documentation** when changing deployment process
5. **Monitor deployments** after releases
6. **Use feature flags** for gradual rollouts

## Troubleshooting

### Build Failures
- Check TypeScript compilation errors
- Verify all dependencies are installed
- Ensure environment variables are set

### Deployment Issues
- Verify code signing certificates are valid
- Check update server connectivity
- Review deployment verification logs

### Test Failures
- Run tests locally to reproduce
- Check for environment-specific issues
- Review test logs in GitHub Actions

## Future Enhancements

- [ ] Add performance testing to pipeline
- [ ] Implement canary deployments
- [ ] Add automated rollback triggers
- [ ] Integrate with error tracking services
- [ ] Add deployment notifications
- [ ] Implement feature flag management