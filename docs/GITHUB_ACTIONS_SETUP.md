# GitHub Actions Setup Guide

This guide helps you configure GitHub Actions for the SessionHub CI/CD pipeline.

## Required GitHub Secrets

Navigate to your repository Settings → Secrets and variables → Actions, then add:

### Apple Code Signing (macOS)

1. **APPLE_ID**
   - Your Apple Developer account email
   - Example: `developer@company.com`

2. **APPLE_ID_PASSWORD**
   - App-specific password (not your Apple ID password)
   - Generate at: https://appleid.apple.com/account/manage
   - Security → App-Specific Passwords → Generate

3. **APPLE_TEAM_ID**
   - Your Apple Developer Team ID
   - Find at: https://developer.apple.com/account
   - Look for Team ID in membership details

4. **CSC_LINK**
   - Base64 encoded Developer ID certificate
   - Export from Keychain Access as .p12
   - Convert: `base64 -i certificate.p12 -o certificate.txt`
   - Copy contents of certificate.txt

5. **CSC_KEY_PASSWORD**
   - Password used when exporting the .p12 certificate

### Windows Code Signing (Optional)

6. **WIN_CSC_LINK**
   - Base64 encoded Windows code signing certificate

7. **WIN_CSC_KEY_PASSWORD**
   - Windows certificate password

## GitHub Environments

### Create Production Environment

1. Go to Settings → Environments
2. Click "New environment"
3. Name: `production`
4. Configure protection rules:
   - ✅ Required reviewers (add team members)
   - ✅ Restrict deployment branches: `main`, `v*`

## Repository Settings

### Branch Protection

1. Go to Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - Status checks:
     - `quality-checks`
     - `architecture-compliance`
     - `build`

### Actions Permissions

1. Go to Settings → Actions → General
2. Actions permissions: "Allow all actions"
3. Workflow permissions:
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create pull requests

## Testing the Pipeline

### 1. Test Quality Gates

```bash
# Create a test branch
git checkout -b test/ci-pipeline

# Make a small change
echo "// Test" >> src/index.ts

# Commit and push
git add .
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline

# Create PR and verify checks run
```

### 2. Test Beta Release

```bash
# Merge to develop branch
git checkout develop
git merge test/ci-pipeline
git push origin develop

# Watch Actions tab for beta release
```

### 3. Test Production Release

```bash
# Create version tag
git tag v1.0.1
git push origin v1.0.1

# Approve deployment in GitHub UI
```

## Monitoring

### Check Workflow Status
- Navigate to Actions tab
- Filter by workflow name
- Click on runs to see details

### Download Artifacts
- Click on completed workflow run
- Scroll to Artifacts section
- Download build artifacts

### View Deployment Status
- Check Environments page
- View deployment history
- Monitor rollback status

## Troubleshooting

### Certificate Issues

If code signing fails:
1. Verify certificate hasn't expired
2. Check base64 encoding is correct
3. Ensure password matches
4. Try re-exporting certificate

### Build Failures

Common issues:
1. **TypeScript errors**: Run `npm run validate:strict` locally
2. **Test failures**: Run `npm test` locally
3. **Missing dependencies**: Run `npm ci` locally

### Deployment Issues

If deployment fails:
1. Check GitHub environment approval
2. Verify secrets are set correctly
3. Check update server configuration
4. Review deployment logs

## Update Server Setup

The pipeline expects an update server at `https://update.sessionhub.com`.

### Required Endpoints

- `/latest-mac.yml` - macOS update feed
- `/latest-linux.yml` - Linux update feed
- `/latest.yml` - Generic update feed

### Server Configuration

Use a static file server or CDN to host:
- Release artifacts (DMG, EXE, AppImage)
- Update manifest files (YML)
- Release notes

## Next Steps

1. Configure all required secrets
2. Set up production environment
3. Configure branch protection
4. Run test deployments
5. Set up update server
6. Monitor first production release