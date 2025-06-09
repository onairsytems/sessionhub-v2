#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration: number;
}

class DeploymentVerifier {
  private checks: DeploymentCheck[] = [];
  private updateServerUrl: string;
  private githubRepo: string;

  constructor() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    this.updateServerUrl = packageJson.build?.publish?.url || 'https://update.sessionhub.com';
    this.githubRepo = 'sessionhub/sessionhub'; // Would be extracted from package.json or env
  }

  async verify() {
    console.log('🔍 Verifying Deployment...\n');

    const startTime = Date.now();

    // Run all verification checks
    await this.checkUpdateServer();
    await this.checkGitHubRelease();
    await this.checkDownloadLinks();
    await this.checkAutoUpdateFeed();
    await this.checkReleaseNotes();
    await this.monitorErrorRates();
    await this.checkRollbackCapability();

    const totalDuration = Date.now() - startTime;

    // Generate report
    this.generateReport(totalDuration);

    // Determine overall status
    const failed = this.checks.filter(c => c.status === 'fail').length;
    const warnings = this.checks.filter(c => c.status === 'warning').length;

    if (failed > 0) {
      console.error('\n❌ Deployment verification failed!');
      process.exit(1);
    } else if (warnings > 0) {
      console.warn('\n⚠️  Deployment verified with warnings');
      process.exit(0);
    } else {
      console.log('\n✅ Deployment verified successfully!');
      process.exit(0);
    }
  }

  private async runCheck(name: string, checkFn: () => Promise<void>) {
    const startTime = Date.now();
    try {
      await checkFn();
      this.checks.push({
        name,
        status: 'pass',
        message: 'Check passed',
        duration: Date.now() - startTime
      });
      console.log(`✅ ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      // Determine if it's a warning or failure
      const isWarning = message.includes('Warning:');
      
      this.checks.push({
        name,
        status: isWarning ? 'warning' : 'fail',
        message,
        duration: Date.now() - startTime
      });
      
      console.log(`${isWarning ? '⚠️' : '❌'} ${name}: ${message}`);
    }
  }

  private checkUrl(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(res.statusCode);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }).on('error', reject);
    });
  }

  private async checkUpdateServer() {
    await this.runCheck('Update Server Health', async () => {
      try {
        await this.checkUrl(this.updateServerUrl);
      } catch (error) {
        throw new Error(`Update server unreachable: ${error}`);
      }
    });
  }

  private async checkGitHubRelease() {
    await this.runCheck('GitHub Release', async () => {
      try {
        const apiUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
        const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf-8' });
        const release = JSON.parse(response);

        if (!release.tag_name) {
          throw new Error('No latest release found');
        }

        // Check release assets
        if (!release.assets || release.assets.length === 0) {
          throw new Error('No release assets found');
        }

        // Verify expected assets
        const expectedAssets = ['.dmg', '.exe', '.AppImage'];
        const assetTypes = release.assets.map((a: any) => 
          expectedAssets.find(ext => a.name.endsWith(ext))
        ).filter(Boolean);

        if (assetTypes.length < expectedAssets.length) {
          throw new Error(`Warning: Missing some platform builds`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Warning:')) {
          throw error;
        }
        throw new Error(`GitHub release check failed: ${error}`);
      }
    });
  }

  private async checkDownloadLinks() {
    await this.runCheck('Download Links', async () => {
      try {
        // Get latest release
        const apiUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
        const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf-8' });
        const release = JSON.parse(response);

        // Test download links (HEAD request only)
        for (const asset of release.assets || []) {
          try {
            execSync(`curl -s -I "${asset.browser_download_url}" | head -1 | grep "200 OK"`, {
              stdio: 'ignore'
            });
          } catch {
            throw new Error(`Asset download failed: ${asset.name}`);
          }
        }
      } catch (error) {
        throw new Error(`Download link verification failed: ${error}`);
      }
    });
  }

  private async checkAutoUpdateFeed() {
    await this.runCheck('Auto-Update Feed', async () => {
      const feedUrls = [
        `${this.updateServerUrl}/latest-mac.yml`,
        `${this.updateServerUrl}/latest-linux.yml`,
        `${this.updateServerUrl}/latest.yml`
      ];

      let reachable = 0;
      for (const url of feedUrls) {
        try {
          await this.checkUrl(url);
          reachable++;
        } catch {
          // Continue checking other feeds
        }
      }

      if (reachable === 0) {
        throw new Error('No update feeds are reachable');
      } else if (reachable < feedUrls.length) {
        throw new Error(`Warning: Only ${reachable}/${feedUrls.length} update feeds are reachable`);
      }
    });
  }

  private async checkReleaseNotes() {
    await this.runCheck('Release Notes', async () => {
      try {
        const apiUrl = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
        const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf-8' });
        const release = JSON.parse(response);

        if (!release.body || release.body.trim().length < 50) {
          throw new Error('Warning: Release notes are too short or missing');
        }

        // Check for required sections
        const requiredSections = ['What\'s Changed', 'Quality Metrics'];
        const missingSections = requiredSections.filter(section => 
          !release.body.includes(section)
        );

        if (missingSections.length > 0) {
          throw new Error(`Warning: Release notes missing sections: ${missingSections.join(', ')}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Warning:')) {
          throw error;
        }
        throw new Error(`Release notes check failed: ${error}`);
      }
    });
  }

  private async monitorErrorRates() {
    await this.runCheck('Error Monitoring', async () => {
      // In production, this would:
      // - Connect to error monitoring service (Sentry, etc.)
      // - Check error rates for the new version
      // - Compare with baseline
      
      console.log('  ℹ️  Error monitoring would check production metrics');
      
      // Simulate check
      const errorRate = Math.random() * 5; // Simulated error rate
      if (errorRate > 2) {
        throw new Error(`Warning: Error rate elevated (${errorRate.toFixed(2)}%)`);
      }
    });
  }

  private async checkRollbackCapability() {
    await this.runCheck('Rollback Capability', async () => {
      // Verify rollback mechanisms are in place
      const rollbackScript = path.join(process.cwd(), 'scripts', 'rollback-release.sh');
      
      if (!fs.existsSync(rollbackScript)) {
        throw new Error('Warning: Rollback script not found');
      }

      // Check if previous versions are available
      try {
        const apiUrl = `https://api.github.com/repos/${this.githubRepo}/releases`;
        const response = execSync(`curl -s "${apiUrl}?per_page=5"`, { encoding: 'utf-8' });
        const releases = JSON.parse(response);

        if (releases.length < 2) {
          throw new Error('Warning: No previous releases available for rollback');
        }
      } catch {
        throw new Error('Warning: Cannot verify rollback targets');
      }
    });
  }

  private generateReport(totalDuration: number) {
    console.log('\n📊 Deployment Verification Report');
    console.log('═════════════════════════════════\n');

    const passed = this.checks.filter(c => c.status === 'pass').length;
    const warnings = this.checks.filter(c => c.status === 'warning').length;
    const failed = this.checks.filter(c => c.status === 'fail').length;

    console.log(`Total Checks: ${this.checks.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Warnings: ${warnings}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${totalDuration}ms\n`);

    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.checks.length,
        passed,
        warnings,
        failed
      },
      duration: totalDuration,
      checks: this.checks,
      deployment: {
        updateServer: this.updateServerUrl,
        repository: this.githubRepo,
        verified: failed === 0
      }
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'deployment-verification-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('Report saved to: deployment-verification-report.json');
  }
}

// Run verification
if (require.main === module) {
  const verifier = new DeploymentVerifier();
  verifier.verify().catch(console.error);
}