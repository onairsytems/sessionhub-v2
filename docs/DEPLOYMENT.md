# SessionHub Deployment to Applications

This document describes the deployment system for SessionHub to the macOS Applications folder.

## Quick Start

### One-Time Deployment
```bash
npm run deploy:app
```

### Deployment with Auto-Update Watch
```bash
npm run deploy:app:watch
```

### Using the Quick Deploy Script
```bash
./scripts/quick-deploy.sh         # One-time deployment
./scripts/quick-deploy.sh --watch # With auto-update
```

## Features

### 1. **One-Click Deployment**
- Builds the application for production
- Validates code quality and passes all checks
- Copies the built app to `/Applications`
- Sets proper permissions and attributes

### 2. **Development Linking**
- Creates a `.dev-linked` marker file in the deployed app
- Tracks the source project path and version
- Enables automatic update detection

### 3. **Auto-Update Watch Mode**
- Watches source files for changes
- Automatically rebuilds when code changes
- Redeploys to Applications folder
- No manual intervention required

### 4. **Update Checker Integration**
- Built into the Electron app
- Checks for updates every 30 minutes
- Notifies users when updates are available
- One-click update from within the app

## Commands

### NPM Scripts
- `npm run deploy:app` - Build and deploy to Applications
- `npm run deploy:app:watch` - Deploy with file watching
- `npm run deploy:quick` - Deploy existing build (skip rebuild)

### Command Options
- `--watch, -w` - Enable file watching for auto-updates
- `--skip-build` - Use existing build (faster deployment)
- `--force, -f` - Force overwrite without confirmation
- `--help, -h` - Show help information

## How It Works

### Deployment Process
1. **Build Phase**
   - Runs production build with all validations
   - Creates universal macOS binary
   - Packages with electron-builder

2. **Deployment Phase**
   - Checks for existing installation
   - Prompts for confirmation if not dev-linked
   - Copies app to `/Applications`
   - Sets executable permissions
   - Removes quarantine attributes

3. **Linking Phase**
   - Creates `.dev-linked` marker file
   - Stores project path and version info
   - Enables update detection

### Auto-Update Mechanism
1. **File Watching**
   - Monitors `src/`, `electron/`, `app/`, `public/`
   - Ignores build outputs and dependencies
   - Debounces rapid changes

2. **Automatic Rebuild**
   - Triggers on file changes
   - Runs full build process
   - Validates code quality

3. **Seamless Deployment**
   - Overwrites existing app
   - Preserves dev-link marker
   - Updates timestamp for tracking

### Update Detection in App
1. **Version Checking**
   - Compares deployed vs source versions
   - Checks build timestamps
   - Runs every 30 minutes

2. **User Notification**
   - Shows update dialog
   - Displays version information
   - Offers one-click update

3. **Update Process**
   - Runs deployment script
   - Shows progress to user
   - Restarts app when complete

## Development Workflow

### Initial Setup
1. Clone the SessionHub repository
2. Run `npm install` to install dependencies
3. Run `npm run deploy:app` for first deployment

### Daily Development
1. Start watch mode: `npm run deploy:app:watch`
2. Make code changes in your editor
3. Save files - app automatically rebuilds
4. Restart deployed app to see changes

### Testing Updates
1. Deploy app: `npm run deploy:app`
2. Make changes to code
3. App will notify about available update
4. Click "Update Now" to test the flow

## Troubleshooting

### Build Fails
- Check TypeScript errors: `npm run build:check`
- Ensure git working directory is clean
- Run tests: `npm test`

### Deployment Fails
- Quit SessionHub if running
- Check Applications folder permissions
- Try with force flag: `npm run deploy:app -- --force`

### Auto-Update Not Working
- Verify `.dev-linked` file exists in app
- Check file watcher is running
- Look for errors in terminal output

### Update Checker Not Appearing
- Ensure app was deployed with this system
- Check if running dev-linked version
- Look in DevTools console for errors

## Security Notes

- Only dev-linked apps can auto-update
- Manual confirmation required for non-linked apps
- No automatic code execution without user consent
- Updates only from local development directory

## Future Enhancements

- Code signing for distribution
- Notarization for macOS Gatekeeper
- Delta updates for faster deployment
- Multiple deployment targets
- Rollback functionality