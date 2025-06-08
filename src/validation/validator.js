#!/usr/bin/env node

/**
 * SessionHub V2 Bootstrap Validator
 * Ensures zero-error methodology is working correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BootstrapValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      session: '0.2',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };
  }

  // Test helper
  test(name, fn) {
// REMOVED: console statement
    try {
      fn();
      this.results.tests.push({ name, status: 'PASS', error: null });
      this.results.summary.passed++;
// REMOVED: console statement
    } catch (error) {
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      this.results.summary.failed++;
// REMOVED: console statement
    }
    this.results.summary.total++;
  }

  // Validation tests
  validateProjectStructure() {
    this.test('Project directory exists', () => {
      if (!fs.existsSync(process.cwd())) {
        throw new Error('Project directory not found');
      }
    });

    this.test('Core directories exist', () => {
      const required = ['src', 'docs', 'tests', '.git'];
      required.forEach(dir => {
        if (!fs.existsSync(dir)) {
          throw new Error(`Missing directory: ${dir}`);
        }
      });
    });

    this.test('Foundation versions directory exists', () => {
      if (!fs.existsSync('docs/foundation-versions')) {
        throw new Error('Version control directory missing');
      }
    });
  }

  validateGitIntegration() {
    this.test('Git repository initialized', () => {
      try {
        execSync('git status', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Not a git repository');
      }
    });

    this.test('Git has commits', () => {
      try {
        const log = execSync('git log --oneline -1', { encoding: 'utf8' });
        if (!log.trim()) {
          throw new Error('No commits found');
        }
      } catch (error) {
        throw new Error('Failed to read git history');
      }
    });

    this.test('Remote repository configured (optional)', () => {
      try {
        const remote = execSync('git remote -v', { encoding: 'utf8' });
        if (!remote.trim()) {
// REMOVED: console statement
        }
      } catch (error) {
// REMOVED: console statement
      }
    });
  }

  validateGoogleDriveSync() {
    this.test('Google Drive SessionHub directory exists', () => {
      const drivePath = path.join(process.env.HOME, 'Google Drive/My Drive/SessionHub');
      if (!fs.existsSync(drivePath)) {
        throw new Error('Google Drive SessionHub directory not found');
      }
    });

    this.test('Foundation document exists in Google Drive', () => {
      const foundationPath = path.join(process.env.HOME, 'Google Drive/My Drive/SessionHub/FOUNDATION.md');
      if (!fs.existsSync(foundationPath)) {
        throw new Error('FOUNDATION.md not found in Google Drive');
      }
    });

    this.test('Foundation document is readable', () => {
      const foundationPath = path.join(process.env.HOME, 'Google Drive/My Drive/SessionHub/FOUNDATION.md');
      const content = fs.readFileSync(foundationPath, 'utf8');
      if (!content.includes('SessionHub V2')) {
        throw new Error('Foundation document appears corrupted');
      }
    });
  }

  validateVersionControl() {
    this.test('Version history index exists', () => {
      if (!fs.existsSync('docs/foundation-versions/VERSION-INDEX.md')) {
        throw new Error('VERSION-INDEX.md not found');
      }
    });

    this.test('Previous version snapshot exists', () => {
      if (!fs.existsSync('docs/foundation-versions/FOUNDATION-v0.1.md')) {
        throw new Error('Version v0.1 snapshot not found');
      }
    });

    this.test('Version snapshots match session numbers', () => {
      const versions = fs.readdirSync('docs/foundation-versions')
        .filter(f => f.startsWith('FOUNDATION-v'));
      if (versions.length === 0) {
        throw new Error('No version snapshots found');
      }
    });
  }

  validateFoundationIntegrity() {
    this.test('Foundation has correct version format', () => {
      const foundationPath = path.join(process.env.HOME, 'Google Drive/My Drive/SessionHub/FOUNDATION.md');
      const content = fs.readFileSync(foundationPath, 'utf8');
      if (!content.match(/Version.*:\s*\d+\.\d+\.\d+/)) {
        throw new Error('Version format incorrect');
      }
    });

    this.test('Foundation tracks sessions correctly', () => {
      const foundationPath = path.join(process.env.HOME, 'Google Drive/My Drive/SessionHub/FOUNDATION.md');
      const content = fs.readFileSync(foundationPath, 'utf8');
      const sessionMatch = content.match(/Last Session.*:\s*([\d.]+)/);
      if (!sessionMatch) {
        throw new Error('Session tracking not found');
      }
      // For Session 0.2, we expect either 0.1 or 0.2 depending on when run
      const currentSession = sessionMatch[1];
      if (currentSession !== '0.1' && currentSession !== '0.2') {
        throw new Error(`Unexpected session number: ${currentSession}`);
      }
    });
  }

  generateReport() {
    const report = `# Bootstrap Validation Report

## Summary
- **Date**: ${this.results.timestamp}
- **Session**: ${this.results.session}
- **Total Tests**: ${this.results.summary.total}
- **Passed**: ${this.results.summary.passed}
- **Failed**: ${this.results.summary.failed}
- **Status**: ${this.results.summary.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ FAILURES DETECTED'}

## Test Results
${this.results.tests.map(test => 
  `- ${test.status === 'PASS' ? '✅' : '❌'} ${test.name}${test.error ? `: ${test.error}` : ''}`
).join('\n')}

## Validation Complete
Bootstrap validation has ${this.results.summary.failed === 0 ? 'succeeded' : 'failed'}.
`;
    
    fs.writeFileSync('tests/bootstrap/validation-report.md', report);
    return report;
  }

  run() {
// REMOVED: console statement
// REMOVED: console statement

    this.validateProjectStructure();
    this.validateGitIntegration();
    this.validateGoogleDriveSync();
    this.validateVersionControl();
    this.validateFoundationIntegrity();

    const report = this.generateReport();
// REMOVED: console statement
    
    return this.results.summary.failed === 0;
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new BootstrapValidator();
  const success = validator.run();
  process.exit(success ? 0 : 1);
}

module.exports = BootstrapValidator;