#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

const PROJECT_ROOT = path.join(__dirname, '..');
const APP_NAME = 'SessionHub';
const APPLICATIONS_PATH = '/Applications';
const DIST_PATH = path.join(PROJECT_ROOT, 'dist-electron');
const DEV_APP_PATH = path.join(DIST_PATH, 'mac-universal', `${APP_NAME}.app`);
const DEPLOYED_APP_PATH = path.join(APPLICATIONS_PATH, `${APP_NAME}.app`);
const LINK_MARKER_FILE = path.join(DEPLOYED_APP_PATH, 'Contents', '.dev-linked');

interface DeployOptions {
  watch?: boolean;
  skipBuild?: boolean;
  force?: boolean;
}

class ApplicationDeployer {
  private buildInProgress = false;
  private watcher: chokidar.FSWatcher | null = null;

  async deploy(options: DeployOptions = {}): Promise<void> {
    try {
      console.log('🚀 SessionHub Deployment Script');
      console.log('================================\n');

      // Step 1: Build the application
      if (!options.skipBuild) {
        await this.buildApplication();
      }

      // Step 2: Check if app exists in dist
      if (!fs.existsSync(DEV_APP_PATH)) {
        throw new Error(`Built app not found at ${DEV_APP_PATH}. Build may have failed.`);
      }

      // Step 3: Deploy to Applications folder
      await this.deployToApplications(options.force);

      // Step 4: Create development link marker
      await this.createDevLink();

      // Step 5: Set up watcher if requested
      if (options.watch) {
        await this.setupWatcher();
      }

      console.log('\n✅ Deployment completed successfully!');
      console.log(`📁 App location: ${DEPLOYED_APP_PATH}`);
      console.log('🔗 Development link established');
      
      if (options.watch) {
        console.log('👀 Watching for changes...');
        console.log('   Press Ctrl+C to stop\n');
      }

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }
  }

  private async buildApplication(): Promise<void> {
    console.log('🔨 Building SessionHub application...');
    console.log('   This may take a few minutes...\n');

    try {
      // Run the electron distribution build
      execSync('npm run electron:dist:mac', {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });

      console.log('\n✅ Build completed successfully');
    } catch (error) {
      throw new Error('Build failed. Check the output above for errors.');
    }
  }

  private async deployToApplications(force: boolean = false): Promise<void> {
    console.log('\n📦 Deploying to Applications folder...');

    // Check if app already exists
    if (fs.existsSync(DEPLOYED_APP_PATH)) {
      if (!force && !this.isDevLinked()) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          readline.question(
            `\n⚠️  ${APP_NAME}.app already exists in Applications folder.\n` +
            '   This doesn\'t appear to be a dev-linked version.\n' +
            '   Overwrite? (y/N): ',
            resolve
          );
        });

        readline.close();

        if (answer.toLowerCase() !== 'y') {
          throw new Error('Deployment cancelled by user');
        }
      }

      // Remove existing app
      console.log('   Removing existing app...');
      execSync(`rm -rf "${DEPLOYED_APP_PATH}"`, { stdio: 'inherit' });
    }

    // Copy new app
    console.log('   Copying new app to Applications...');
    execSync(`cp -R "${DEV_APP_PATH}" "${DEPLOYED_APP_PATH}"`, { stdio: 'inherit' });

    // Set proper permissions
    console.log('   Setting permissions...');
    execSync(`chmod -R 755 "${DEPLOYED_APP_PATH}"`, { stdio: 'inherit' });
    execSync(`xattr -cr "${DEPLOYED_APP_PATH}"`, { stdio: 'inherit' });

    console.log('✅ App deployed to Applications folder');
  }

  private async createDevLink(): Promise<void> {
    // Create a marker file to indicate this is a dev-linked installation
    const markerDir = path.dirname(LINK_MARKER_FILE);
    
    if (!fs.existsSync(markerDir)) {
      fs.mkdirSync(markerDir, { recursive: true });
    }

    const linkInfo = {
      projectPath: PROJECT_ROOT,
      linkedAt: new Date().toISOString(),
      version: require(path.join(PROJECT_ROOT, 'package.json')).version
    };

    fs.writeFileSync(LINK_MARKER_FILE, JSON.stringify(linkInfo, null, 2));
    console.log('✅ Development link created');
  }

  private isDevLinked(): boolean {
    try {
      if (fs.existsSync(LINK_MARKER_FILE)) {
        const linkInfo = JSON.parse(fs.readFileSync(LINK_MARKER_FILE, 'utf-8'));
        return linkInfo.projectPath === PROJECT_ROOT;
      }
    } catch (error) {
      // Ignore errors
    }
    return false;
  }

  private async setupWatcher(): Promise<void> {
    console.log('\n🔄 Setting up automatic rebuild on changes...');

    const watchPaths = [
      path.join(PROJECT_ROOT, 'src'),
      path.join(PROJECT_ROOT, 'electron'),
      path.join(PROJECT_ROOT, 'app'),
      path.join(PROJECT_ROOT, 'public')
    ].filter(p => fs.existsSync(p));

    const ignoredPaths = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/out/**',
      '**/.next/**',
      '**/*.log',
      '**/.DS_Store'
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: ignoredPaths,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher.on('change', this.handleFileChange.bind(this));
    this.watcher.on('add', this.handleFileChange.bind(this));
    this.watcher.on('unlink', this.handleFileChange.bind(this));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping watcher...');
      if (this.watcher) {
        this.watcher.close();
      }
      process.exit(0);
    });
  }

  private async handleFileChange(filePath: string): Promise<void> {
    if (this.buildInProgress) {
      return;
    }

    const relativePath = path.relative(PROJECT_ROOT, filePath);
    console.log(`\n📝 File changed: ${relativePath}`);

    this.buildInProgress = true;

    try {
      console.log('🔄 Rebuilding and redeploying...\n');
      
      // Rebuild and redeploy
      await this.buildApplication();
      await this.deployToApplications(true);
      
      console.log('\n✅ Automatic update completed!');
      console.log('   You may need to restart the app to see changes.');
      console.log('\n👀 Watching for changes...\n');
    } catch (error) {
      console.error('❌ Automatic update failed:', error);
      console.log('\n👀 Still watching for changes...\n');
    } finally {
      this.buildInProgress = false;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: DeployOptions = {
    watch: args.includes('--watch') || args.includes('-w'),
    skipBuild: args.includes('--skip-build'),
    force: args.includes('--force') || args.includes('-f')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
SessionHub Deploy to Applications Script

Usage: npm run deploy:app [options]

Options:
  --watch, -w      Watch for changes and automatically rebuild/redeploy
  --skip-build     Skip the build step (use existing build)
  --force, -f      Force overwrite without asking
  --help, -h       Show this help message

Examples:
  npm run deploy:app                    # Build and deploy once
  npm run deploy:app --watch           # Deploy and watch for changes
  npm run deploy:app --skip-build      # Deploy existing build
    `);
    process.exit(0);
  }

  const deployer = new ApplicationDeployer();
  await deployer.deploy(options);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ApplicationDeployer };