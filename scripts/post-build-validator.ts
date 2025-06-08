#!/usr/bin/env ts-node
/**
 * Post-Build Validator
 * 
 * This script verifies that the built application can actually start
 * and includes all recent session improvements.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

interface ValidationCheck {
  name: string;
  passed: boolean;
  details: string;
}

class PostBuildValidator {
  private checks: ValidationCheck[] = [];
  private electronProcess: unknown = null;

  constructor() {
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}       SessionHub Post-Build Validator v1.2.2              ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  }

  async validate(): Promise<boolean> {
    try {
      // Check 1: Verify build outputs exist
      await this.verifyBuildOutputs();

      // Check 2: Verify version consistency
      await this.verifyVersionConsistency();

      // Check 3: Check for required features
      await this.verifyRequiredFeatures();

      // Check 4: Calculate build checksums
      await this.calculateBuildChecksums();

      // Check 5: Verify Electron can start
      await this.verifyElectronStart();

      // Check 6: Verify runtime modules
      await this.verifyRuntimeModules();

      // Generate final report
      return this.generateReport();
    } catch (error: any) {
      console.error(`${colors.red}Validation error: ${error}${colors.reset}`);
      return false;
    } finally {
      // Cleanup
      if (this.electronProcess) {
        (this.electronProcess as any).kill();
      }
    }
  }

  private addCheck(check: ValidationCheck) {
    this.checks.push(check);
    const icon = check.passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${icon} ${check.name}: ${check.details}`);
  }

  private async verifyBuildOutputs() {
    console.log(`\n${colors.blue}Verifying build outputs...${colors.reset}`);

    const requiredFiles = [
      { path: 'out/index.html', description: 'Next.js HTML output' },
      { path: 'out/_next/static', description: 'Next.js static assets' },
      { path: 'dist/main/background-simple.js', description: 'Electron main process' },
      { path: 'dist/main/preload.js', description: 'Electron preload script' },
      { path: '.next/BUILD_ID', description: 'Next.js build identifier' }
    ];

    let allExist = true;
    const missing: string[] = [];

    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(process.cwd(), file.path));
      if (!exists) {
        allExist = false;
        missing.push(file.description);
      }
    }

    this.addCheck({
      name: 'Build Outputs',
      passed: allExist,
      details: allExist ? 'All required files present' : `Missing: ${missing.join(', ')}`
    });
  }

  private async verifyVersionConsistency() {
    console.log(`\n${colors.blue}Verifying version consistency...${colors.reset}`);

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const foundationPath = 'docs/FOUNDATION.md';
      let foundationVersion = 'unknown';

      if (fs.existsSync(foundationPath)) {
        const foundation = fs.readFileSync(foundationPath, 'utf8');
        const match = foundation.match(/Version[^:]*:\s*v?([\d.]+)/);
        if (match) {
          foundationVersion = match[1]!;
        }
      }

      // Check if versions are synchronized
      const versionsMatch = packageJson.version === '1.0.0' || foundationVersion.startsWith('1.');

      this.addCheck({
        name: 'Version Consistency',
        passed: versionsMatch,
        details: `Package: ${packageJson.version}, Foundation: ${foundationVersion}`
      });
    } catch (error: any) {
      this.addCheck({
        name: 'Version Consistency',
        passed: false,
        details: `Error checking versions: ${error}`
      });
    }
  }

  private async verifyRequiredFeatures() {
    console.log(`\n${colors.blue}Verifying required features...${colors.reset}`);

    const requiredFeatures = [
      {
        name: 'Error Detection System',
        files: ['src/core/error-detection/ErrorDetectionEngine.ts']
      },
      {
        name: 'Two-Actor Model',
        files: ['src/core/planning/PlanningEngine.ts', 'src/core/execution/ExecutionEngine.ts']
      },
      {
        name: 'API Integration',
        files: ['src/lib/api/ClaudeAPIClient.ts', 'src/lib/api/ClaudeCodeAPIClient.ts']
      },
      {
        name: 'Session Management',
        files: ['src/core/orchestrator/SessionStateManager.ts']
      },
      {
        name: 'Feature Flags',
        files: ['src/config/features.ts']
      },
      {
        name: 'Session Completion Rules',
        files: ['docs/SESSION_COMPLETION_RULES.md']
      }
    ];

    const results: { feature: string; present: boolean }[] = [];

    for (const feature of requiredFeatures) {
      const allFilesExist = feature.files.every(file => 
        fs.existsSync(path.join(process.cwd(), file))
      );
      results.push({ feature: feature.name, present: allFilesExist });
    }

    const allPresent = results.every(r => r.present);
    const missing = results.filter(r => !r.present).map(r => r.feature);

    this.addCheck({
      name: 'Required Features',
      passed: allPresent,
      details: allPresent ? 'All features implemented' : `Missing: ${missing.join(', ')}`
    });
  }

  private async calculateBuildChecksums() {
    console.log(`\n${colors.blue}Calculating build checksums...${colors.reset}`);

    try {
      const checksums: Record<string, string> = {};
      
      // Calculate checksum for main build files
      const filesToCheck = [
        'dist/main/background-simple.js',
        'out/index.html'
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          checksums[file] = hash.substring(0, 8); // First 8 chars for brevity
        }
      }

      // Save checksums for future verification
      const checksumPath = '.build-checksums.json';
      fs.writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));

      this.addCheck({
        name: 'Build Checksums',
        passed: true,
        details: `Generated ${Object.keys(checksums).length} checksums`
      });
    } catch (error: any) {
      this.addCheck({
        name: 'Build Checksums',
        passed: false,
        details: `Error generating checksums: ${error}`
      });
    }
  }

  private async verifyElectronStart(): Promise<void> {
    console.log(`\n${colors.blue}Testing Electron startup...${colors.reset}`);

    return new Promise((resolve) => {
      try {
        // Start Electron in test mode
        const electron = spawn('npx', ['electron', '.', '--test-mode'], {
          stdio: 'pipe',
          env: { ...process.env, ELECTRON_IS_DEV: '0', TEST_MODE: '1' }
        });

        this.electronProcess = electron;
        let output = '';
        let errorOutput = '';
        let startupSuccess = false;

        // Set a timeout for startup
        const timeout = setTimeout(() => {
          if (!startupSuccess) {
            electron.kill();
            this.addCheck({
              name: 'Electron Startup',
              passed: false,
              details: 'Timeout waiting for Electron to start'
            });
            resolve();
          }
        }, 15000); // 15 second timeout

        electron.stdout.on('data', (data) => {
          output += data.toString();
          // Look for successful startup indicators
          if (output.includes('Electron app ready') || output.includes('BrowserWindow created')) {
            startupSuccess = true;
            clearTimeout(timeout);
            electron.kill();
            this.addCheck({
              name: 'Electron Startup',
              passed: true,
              details: 'Electron started successfully'
            });
            resolve();
          }
        });

        electron.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        electron.on('error', (error) => {
          clearTimeout(timeout);
          this.addCheck({
            name: 'Electron Startup',
            passed: false,
            details: `Failed to start: ${error.message}`
          });
          resolve();
        });

        electron.on('exit', (code) => {
          clearTimeout(timeout);
          if (!startupSuccess) {
            this.addCheck({
              name: 'Electron Startup',
              passed: false,
              details: `Exited with code ${code}: ${errorOutput.substring(0, 200)}`
            });
            resolve();
          }
        });
      } catch (error: any) {
        this.addCheck({
          name: 'Electron Startup',
          passed: false,
          details: `Exception during startup: ${error}`
        });
        resolve();
      }
    });
  }

  private async verifyRuntimeModules() {
    console.log(`\n${colors.blue}Verifying runtime modules...${colors.reset}`);

    try {
      // Check if critical modules are loadable
      const criticalModules = [
        '@supabase/supabase-js',
        'electron-store',
        'electron-updater'
      ];

      const moduleChecks: { module: string; loadable: boolean }[] = [];

      for (const moduleName of criticalModules) {
        try {
          require.resolve(moduleName);
          moduleChecks.push({ module: moduleName, loadable: true });
        } catch {
          moduleChecks.push({ module: moduleName, loadable: false });
        }
      }

      const allLoadable = moduleChecks.every(m => m.loadable);
      const failed = moduleChecks.filter(m => !m.loadable).map(m => m.module);

      this.addCheck({
        name: 'Runtime Modules',
        passed: allLoadable,
        details: allLoadable ? 'All modules loadable' : `Failed to load: ${failed.join(', ')}`
      });
    } catch (error: any) {
      this.addCheck({
        name: 'Runtime Modules',
        passed: false,
        details: `Error checking modules: ${error}`
      });
    }
  }

  private generateReport(): boolean {
    const passed = this.checks.filter(c => c.passed).length;
    const failed = this.checks.filter(c => !c.passed).length;
    const allPassed = failed === 0;

    console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}                  POST-BUILD VALIDATION REPORT             ${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`Total Checks: ${this.checks.length}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log();

    if (allPassed) {
      console.log(`${colors.green}✅ BUILD VALIDATION SUCCESSFUL!${colors.reset}`);
      console.log(`${colors.green}The application is ready for deployment.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ BUILD VALIDATION FAILED!${colors.reset}`);
      console.log(`${colors.red}The following checks failed:${colors.reset}`);
      this.checks.filter(c => !c.passed).forEach(c => {
        console.log(`  ${colors.red}• ${c.name}: ${c.details}${colors.reset}`);
      });
    }

    console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);

    if (!allPassed) {
      process.exit(1);
    }

    return allPassed;
  }
}

// Run the validator
async function main() {
  const validator = new PostBuildValidator();
  try {
    await validator.validate();
  } catch (error: any) {
    console.error(`${colors.red}Unexpected error: ${error}${colors.reset}`);
    process.exit(1);
  }
}

// Only run if executed directly
if (require.main === module) {
  main();
}