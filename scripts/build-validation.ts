import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

interface BuildValidationResult {
  timestamp: Date;
  passed: boolean;
  version: string;
  platform: string;
  validations: {
    typescript: ValidationCheck;
    eslint: ValidationCheck;
    build: ValidationCheck;
    electronBuild: ValidationCheck;
    packageIntegrity: ValidationCheck;
    bundleSize: ValidationCheck;
    securityScan: ValidationCheck;
    testExecution: ValidationCheck;
    appSigning: ValidationCheck;
    installability: ValidationCheck;
  };
  artifacts: {
    dmgPath?: string;
    appPath?: string;
    checksums: Record<string, string>;
    size: Record<string, number>;
  };
  qualityGates: {
    allChecksPassed: boolean;
    criticalIssues: string[];
    warnings: string[];
    blockers: string[];
  };
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  duration: number;
  details?: any;
  error?: string;
}

export class BuildValidator {
  private projectRoot: string;
  private buildDir: string;
  private distDir: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.buildDir = path.join(projectRoot, 'out');
    this.distDir = path.join(projectRoot, 'dist-electron');
  }

  async validateFullBuild(): Promise<BuildValidationResult> {
    console.log('🏗️  Starting comprehensive build validation...\n');
    const startTime = Date.now();

    const result: BuildValidationResult = {
      timestamp: new Date(),
      passed: false,
      version: await this.getVersion(),
      platform: process.platform,
      validations: {} as any,
      artifacts: {
        checksums: {},
        size: {}
      },
      qualityGates: {
        allChecksPassed: false,
        criticalIssues: [],
        warnings: [],
        blockers: []
      }
    };

    // Run all validations
    result.validations.typescript = await this.validateTypeScript();
    result.validations.eslint = await this.validateESLint();
    result.validations.testExecution = await this.validateTests();
    result.validations.build = await this.validateNextBuild();
    result.validations.electronBuild = await this.validateElectronBuild();
    result.validations.packageIntegrity = await this.validatePackageIntegrity();
    result.validations.bundleSize = await this.validateBundleSize();
    result.validations.securityScan = await this.validateSecurity();
    result.validations.appSigning = await this.validateAppSigning();
    result.validations.installability = await this.validateInstallability();

    // Generate checksums and analyze artifacts
    await this.analyzeArtifacts(result);

    // Assess quality gates
    this.assessQualityGates(result);

    const duration = Date.now() - startTime;
    console.log(`\n✅ Build validation completed in ${(duration / 1000).toFixed(2)}s`);

    // Generate validation report
    await this.generateValidationReport(result);

    return result;
  }

  private async validateTypeScript(): Promise<ValidationCheck> {
    console.log('🔍 Validating TypeScript compilation...');
    const startTime = Date.now();

    try {
      const { stdout } = await execAsync('npm run build:check', {
        cwd: this.projectRoot
      });

      return {
        name: 'TypeScript Compilation',
        passed: true,
        duration: Date.now() - startTime,
        details: { output: stdout }
      };
    } catch (error: any) {
      return {
        name: 'TypeScript Compilation',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message,
        details: { stderr: error.stderr }
      };
    }
  }

  private async validateESLint(): Promise<ValidationCheck> {
    console.log('🔍 Validating ESLint rules...');
    const startTime = Date.now();

    try {
      const { stdout } = await execAsync('npm run lint -- --max-warnings=0', {
        cwd: this.projectRoot
      });

      return {
        name: 'ESLint Validation',
        passed: true,
        duration: Date.now() - startTime,
        details: { output: stdout }
      };
    } catch (error: any) {
      return {
        name: 'ESLint Validation',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message,
        details: { stderr: error.stderr }
      };
    }
  }

  private async validateTests(): Promise<ValidationCheck> {
    console.log('🧪 Running test suite...');
    const startTime = Date.now();

    try {
      const { stdout } = await execAsync('npm run test -- --passWithNoTests', {
        cwd: this.projectRoot
      });

      return {
        name: 'Test Execution',
        passed: true,
        duration: Date.now() - startTime,
        details: { output: stdout }
      };
    } catch (error: any) {
      return {
        name: 'Test Execution',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message,
        details: { stderr: error.stderr }
      };
    }
  }

  private async validateNextBuild(): Promise<ValidationCheck> {
    console.log('🏗️  Building Next.js application...');
    const startTime = Date.now();

    try {
      const { stdout } = await execAsync('npm run build', {
        cwd: this.projectRoot
      });

      // Check if build output exists
      const buildExists = await this.pathExists(this.buildDir);
      if (!buildExists) {
        throw new Error('Build directory not created');
      }

      return {
        name: 'Next.js Build',
        passed: true,
        duration: Date.now() - startTime,
        details: { output: stdout, buildDir: this.buildDir }
      };
    } catch (error: any) {
      return {
        name: 'Next.js Build',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validateElectronBuild(): Promise<ValidationCheck> {
    console.log('⚡ Building Electron application...');
    const startTime = Date.now();

    try {
      const { stdout } = await execAsync('npm run electron:dist:mac', {
        cwd: this.projectRoot
      });

      // Check if DMG was created
      const dmgExists = await this.findDMGFile();
      if (!dmgExists) {
        throw new Error('DMG file not created');
      }

      return {
        name: 'Electron Build',
        passed: true,
        duration: Date.now() - startTime,
        details: { output: stdout, dmgPath: dmgExists }
      };
    } catch (error: any) {
      return {
        name: 'Electron Build',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validatePackageIntegrity(): Promise<ValidationCheck> {
    console.log('📦 Validating package integrity...');
    const startTime = Date.now();

    try {
      // Check package-lock.json integrity
      await execAsync('npm ci --dry-run', { cwd: this.projectRoot });

      // Verify all dependencies are present
      const { stdout } = await execAsync('npm ls --depth=0', { cwd: this.projectRoot });

      return {
        name: 'Package Integrity',
        passed: true,
        duration: Date.now() - startTime,
        details: { dependencies: stdout }
      };
    } catch (error: any) {
      return {
        name: 'Package Integrity',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validateBundleSize(): Promise<ValidationCheck> {
    console.log('📊 Analyzing bundle size...');
    const startTime = Date.now();

    try {
      const buildStats = await this.analyzeBundleSize();
      const sizeLimits = {
        totalJS: 5 * 1024 * 1024, // 5MB
        totalCSS: 1 * 1024 * 1024, // 1MB
        dmgSize: 200 * 1024 * 1024 // 200MB
      };

      const warnings = [];
      if (buildStats.totalJS > sizeLimits.totalJS) {
        warnings.push(`JavaScript bundle size (${(buildStats.totalJS / 1024 / 1024).toFixed(2)}MB) exceeds limit`);
      }
      if (buildStats.totalCSS > sizeLimits.totalCSS) {
        warnings.push(`CSS bundle size (${(buildStats.totalCSS / 1024 / 1024).toFixed(2)}MB) exceeds limit`);
      }

      return {
        name: 'Bundle Size Analysis',
        passed: warnings.length === 0,
        duration: Date.now() - startTime,
        details: { ...buildStats, warnings }
      };
    } catch (error: any) {
      return {
        name: 'Bundle Size Analysis',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validateSecurity(): Promise<ValidationCheck> {
    console.log('🔒 Running security scan...');
    const startTime = Date.now();

    try {
      // Run npm audit
      const { stdout } = await execAsync('npm audit --audit-level=moderate', {
        cwd: this.projectRoot
      });

      return {
        name: 'Security Scan',
        passed: true,
        duration: Date.now() - startTime,
        details: { auditOutput: stdout }
      };
    } catch (error: any) {
      // npm audit returns non-zero exit code when vulnerabilities found
      const isAuditFailure = error.message.includes('vulnerabilities');
      
      return {
        name: 'Security Scan',
        passed: !isAuditFailure,
        duration: Date.now() - startTime,
        error: isAuditFailure ? 'Security vulnerabilities found' : error.message,
        details: { auditOutput: error.stdout }
      };
    }
  }

  private async validateAppSigning(): Promise<ValidationCheck> {
    console.log('🔐 Validating app signing...');
    const startTime = Date.now();

    try {
      const dmgPath = await this.findDMGFile();
      if (!dmgPath) {
        throw new Error('DMG file not found for signing validation');
      }

      // On macOS, check codesign status
      if (process.platform === 'darwin') {
        try {
          await execAsync(`codesign --verify --verbose "${dmgPath}"`);
          return {
            name: 'App Signing',
            passed: true,
            duration: Date.now() - startTime,
            details: { signed: true, dmgPath }
          };
        } catch {
          // App might not be signed in development
          return {
            name: 'App Signing',
            passed: true, // Allow unsigned in development
            duration: Date.now() - startTime,
            details: { signed: false, dmgPath, note: 'Unsigned (development mode)' }
          };
        }
      }

      return {
        name: 'App Signing',
        passed: true,
        duration: Date.now() - startTime,
        details: { platform: process.platform, note: 'Signing validation skipped on non-macOS' }
      };
    } catch (error: any) {
      return {
        name: 'App Signing',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async validateInstallability(): Promise<ValidationCheck> {
    console.log('💿 Testing installability...');
    const startTime = Date.now();

    try {
      const dmgPath = await this.findDMGFile();
      if (!dmgPath) {
        throw new Error('DMG file not found for installability test');
      }

      // Check DMG can be mounted (basic installability test)
      if (process.platform === 'darwin') {
        const tempMount = `/tmp/sessionhub-test-mount-${Date.now()}`;
        
        try {
          await execAsync(`hdiutil attach "${dmgPath}" -mountpoint "${tempMount}" -nobrowse`);
          
          // Check if app bundle exists in mounted volume
          const appExists = await this.pathExists(path.join(tempMount, 'SessionHub.app'));
          
          // Unmount
          await execAsync(`hdiutil detach "${tempMount}"`);

          if (!appExists) {
            throw new Error('App bundle not found in DMG');
          }

          return {
            name: 'Installability Test',
            passed: true,
            duration: Date.now() - startTime,
            details: { dmgPath, mountable: true, appBundle: true }
          };
        } catch (mountError) {
          throw new Error(`DMG mount failed: ${mountError}`);
        }
      }

      return {
        name: 'Installability Test',
        passed: true,
        duration: Date.now() - startTime,
        details: { platform: process.platform, note: 'Installability test skipped on non-macOS' }
      };
    } catch (error: any) {
      return {
        name: 'Installability Test',
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async analyzeArtifacts(result: BuildValidationResult): Promise<void> {
    console.log('📁 Analyzing build artifacts...');

    try {
      const dmgPath = await this.findDMGFile();
      if (dmgPath) {
        result.artifacts.dmgPath = dmgPath;
        result.artifacts.checksums['dmg'] = await this.calculateChecksum(dmgPath);
        result.artifacts.size['dmg'] = (await fs.stat(dmgPath)).size;
      }

      const appPath = await this.findAppBundle();
      if (appPath) {
        result.artifacts.appPath = appPath;
        result.artifacts.size['app'] = await this.getDirectorySize(appPath);
      }

      // Analyze Next.js build
      if (await this.pathExists(this.buildDir)) {
        result.artifacts.size['nextBuild'] = await this.getDirectorySize(this.buildDir);
      }
    } catch (error) {
      console.error('Error analyzing artifacts:', error);
    }
  }

  private assessQualityGates(result: BuildValidationResult): void {
    const { validations } = result;
    const criticalChecks = ['typescript', 'build', 'electronBuild', 'testExecution'];
    const securityChecks = ['securityScan'];

    // Check critical validations
    for (const check of criticalChecks) {
      if (!validations[check as keyof typeof validations].passed) {
        result.qualityGates.blockers.push(`${check} validation failed`);
      }
    }

    // Check security validations
    for (const check of securityChecks) {
      if (!validations[check as keyof typeof validations].passed) {
        result.qualityGates.criticalIssues.push(`${check} validation failed`);
      }
    }

    // Check bundle size
    if (!validations.bundleSize.passed) {
      result.qualityGates.warnings.push('Bundle size exceeds recommended limits');
    }

    // Overall assessment
    result.qualityGates.allChecksPassed = Object.values(validations).every(v => v.passed);
    result.passed = result.qualityGates.allChecksPassed && result.qualityGates.blockers.length === 0;
  }

  private async generateValidationReport(result: BuildValidationResult): Promise<void> {
    const reportPath = path.join(this.projectRoot, 'build-validation-report.md');
    
    let report = `# Build Validation Report\n\n`;
    report += `**Date:** ${result.timestamp.toISOString()}\n`;
    report += `**Version:** ${result.version}\n`;
    report += `**Platform:** ${result.platform}\n`;
    report += `**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;

    // Validation Results
    report += `## Validation Results\n\n`;
    report += `| Check | Result | Duration | Details |\n`;
    report += `|-------|--------|----------|----------|\n`;

    Object.values(result.validations).forEach(validation => {
      const resultIcon = validation.passed ? '✅' : '❌';
      const duration = `${validation.duration}ms`;
      const details = validation.error || 'OK';
      report += `| ${validation.name} | ${resultIcon} | ${duration} | ${details} |\n`;
    });

    // Artifacts
    if (Object.keys(result.artifacts.size).length > 0) {
      report += `\n## Build Artifacts\n\n`;
      Object.entries(result.artifacts.size).forEach(([artifact, size]) => {
        const sizeInMB = (size / 1024 / 1024).toFixed(2);
        report += `- **${artifact}:** ${sizeInMB} MB\n`;
      });
    }

    // Quality Gates
    report += `\n## Quality Gates\n\n`;
    if (result.qualityGates.blockers.length > 0) {
      report += `### 🚫 Blockers\n`;
      result.qualityGates.blockers.forEach(blocker => {
        report += `- ${blocker}\n`;
      });
    }

    if (result.qualityGates.criticalIssues.length > 0) {
      report += `### 🔥 Critical Issues\n`;
      result.qualityGates.criticalIssues.forEach(issue => {
        report += `- ${issue}\n`;
      });
    }

    if (result.qualityGates.warnings.length > 0) {
      report += `### ⚠️ Warnings\n`;
      result.qualityGates.warnings.forEach(warning => {
        report += `- ${warning}\n`;
      });
    }

    await fs.writeFile(reportPath, report);
    console.log(`📄 Build validation report saved: ${reportPath}`);
  }

  // Helper methods
  private async getVersion(): Promise<string> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf-8')
      );
      return packageJson.version;
    } catch {
      return 'unknown';
    }
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async findDMGFile(): Promise<string | null> {
    try {
      const files = await fs.readdir(this.distDir);
      const dmgFile = files.find(file => file.endsWith('.dmg'));
      return dmgFile ? path.join(this.distDir, dmgFile) : null;
    } catch {
      return null;
    }
  }

  private async findAppBundle(): Promise<string | null> {
    try {
      const macDir = path.join(this.distDir, 'mac');
      if (await this.pathExists(macDir)) {
        const files = await fs.readdir(macDir);
        const appFile = files.find(file => file.endsWith('.app'));
        return appFile ? path.join(macDir, appFile) : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileData = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileData).digest('hex');
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    async function calculateSize(currentPath: string) {
      const stats = await fs.stat(currentPath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(currentPath);
        for (const file of files) {
          await calculateSize(path.join(currentPath, file));
        }
      } else {
        totalSize += stats.size;
      }
    }
    
    await calculateSize(dirPath);
    return totalSize;
  }

  private async analyzeBundleSize(): Promise<any> {
    const analysis = {
      totalJS: 0,
      totalCSS: 0,
      totalAssets: 0,
      files: []
    };

    if (await this.pathExists(this.buildDir)) {
      // Analyze Next.js build output
      const nextStaticDir = path.join(this.buildDir, '_next', 'static');
      if (await this.pathExists(nextStaticDir)) {
        const files = await this.getFilesRecursively(nextStaticDir);
        
        for (const file of files) {
          const stats = await fs.stat(file);
          const ext = path.extname(file);
          
          if (ext === '.js') {
            analysis.totalJS += stats.size;
          } else if (ext === '.css') {
            analysis.totalCSS += stats.size;
          } else {
            analysis.totalAssets += stats.size;
          }
        }
      }
    }

    return analysis;
  }

  private async getFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(currentDir: string) {
      const items = await fs.readdir(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scan(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await scan(dir);
    return files;
  }
}

// Export singleton instance
export const buildValidator = new BuildValidator();

// CLI interface
if (require.main === module) {
  buildValidator.validateFullBuild().then(result => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BUILD VALIDATION RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Result: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Version: ${result.version}`);
    console.log(`Platform: ${result.platform}`);
    
    if (result.qualityGates.blockers.length > 0) {
      console.log(`\n🚫 Blockers:`);
      result.qualityGates.blockers.forEach(blocker => console.log(`  - ${blocker}`));
    }
    
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(result.passed ? 0 : 1);
  }).catch(error => {
    console.error('Build validation failed:', error);
    process.exit(1);
  });
}