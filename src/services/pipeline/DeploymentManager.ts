import { EventEmitter } from 'events';
import { createHash, createSign, createVerify } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { DeploymentPackage } from './types';
import { SelfDevelopmentAuditor } from '../development/SelfDevelopmentAuditor';
// import { BuildValidator } from '../../core/error-detection/BuildValidator'; // Removed unused
import { SecurityValidator } from '../../core/error-detection/SecurityValidator';
// import { ErrorDetectionEngine } from '../../core/error-detection/ErrorDetectionEngine'; // Removed unused
import { CredentialManager } from '../../lib/security/CredentialManager';
import { app } from 'electron';
export class DeploymentManager extends EventEmitter {
  private auditor: SelfDevelopmentAuditor;
  // private buildValidator: BuildValidator; // Removed unused
  private securityValidator: SecurityValidator;
  private credentialManager: CredentialManager;
  private deploymentHistory: DeploymentPackage[] = [];
  private isDeploying: boolean = false;
  private currentVersion: string;
  constructor(private config: any) {
    super();
    this.auditor = new SelfDevelopmentAuditor();
    // const errorEngine = new ErrorDetectionEngine({}, {} as any, {} as any); // Removed unused
    // this.buildValidator = new BuildValidator(errorEngine); // Removed unused
    this.securityValidator = new SecurityValidator();
    this.credentialManager = new CredentialManager({} as any);
    this.currentVersion = app.getVersion();
  }
  async initialize(): Promise<void> {
    // Ensure deployment directories exist
    const deployDir = path.join(app.getPath('userData'), 'deployments');
    if (!existsSync(deployDir)) {
      await mkdir(deployDir, { recursive: true });
    }
    // Load deployment history
    await this.loadDeploymentHistory();
    await this.auditor.logEvent({
      type: 'configuration_changed',
      actor: 'system',
      action: 'initialize_deployment_manager',
      target: 'deployment_manager',
      details: {
        currentVersion: this.currentVersion,
        deploymentCount: this.deploymentHistory.length,
      },
      risk: 'low',
      context: {}
    });
  }
  async createDeployment(options: {
    sessionId: string;
    commits: any[];
    urgency: 'immediate' | 'scheduled';
  }): Promise<DeploymentPackage> {
    if (this.isDeploying) {
      throw new Error('Deployment already in progress');
    }
    this.isDeploying = true;
    try {
      // Build the application
      const buildResult = await this.buildApplication();
      if (!buildResult.success) {
        throw new Error(`Build failed: ${buildResult.error}`);
      }
      // Validate the build
      const validationResult = await this.validateBuild(buildResult.outputPath || '');
      if (!validationResult.valid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }
      // Create deployment package
      const deploymentPackage = await this.createPackage({
        version: this.generateVersion(),
        buildPath: buildResult.outputPath || '',
        commits: options.commits,
        channel: this.determineChannel(options.urgency),
      });
      // Sign the package
      await this.signPackage(deploymentPackage);
      // Create delta package if possible
      if (this.deploymentHistory.length > 0) {
        await this.createDeltaPackage(deploymentPackage);
      }
      // Record deployment
      this.deploymentHistory.push(deploymentPackage);
      await this.saveDeploymentHistory();
      await this.auditor.logEvent({
        type: 'update_built',
        actor: 'system',
        action: 'create_deployment_package',
        target: deploymentPackage.version,
        details: {
          size: deploymentPackage.size,
          channel: deploymentPackage.channel,
          sessionId: options.sessionId,
        },
        risk: 'medium',
        context: { sessionId: options.sessionId }
      });
      // Deploy based on urgency
      if (options.urgency === 'immediate' && this.config.autoDeployEnabled) {
        await this.deploy(deploymentPackage);
      } else {
      }
      this.emit('deploymentCreated', deploymentPackage);
      return deploymentPackage;
    } catch (error) {
      await this.auditor.logEvent({
        type: 'session_failed',
        actor: 'system',
        action: 'deployment_creation_failed',
        target: 'deployment',
        details: {
          error: error instanceof Error ? (error as Error).message : String(error),
          sessionId: options.sessionId,
        },
        risk: 'high',
        context: { sessionId: options.sessionId }
      });
      throw error;
    } finally {
      this.isDeploying = false;
    }
  }
  private async buildApplication(): Promise<{ success: boolean; outputPath?: string; error?: string }> {
    try {
      // Run build command
      execSync('npm run build', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      // Run electron-builder
      execSync('npm run dist', {
        cwd: process.cwd(),
        stdio: 'inherit',
      });
      const outputPath = path.join(process.cwd(), 'dist');
      return {
        success: true,
        outputPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? (error as Error).message : String(error),
      };
    }
  }
  private async validateBuild(buildPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    // Security validation
    const securityResult = await this.securityValidator.validate(buildPath);
    if (!securityResult.success) {
      errors.push(...securityResult.errors);
    }
    // Build validation - for now just check if the build path exists
    try {
      const stats = await require('fs/promises').stat(buildPath);
      if (!stats.isDirectory()) {
        errors.push('Build path is not a directory');
      }
    } catch (e) {
      errors.push('Build path does not exist');
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  private async createPackage(options: {
    version: string;
    buildPath: string;
    commits: any[];
    channel: 'stable' | 'beta' | 'alpha';
  }): Promise<DeploymentPackage> {
    const platform = process.platform as 'darwin' | 'win32' | 'linux';
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    // Calculate checksum
    const checksum = await this.calculateChecksum(options.buildPath);
    // Generate release notes
    const releaseNotes = this.generateReleaseNotes(options.commits);
    const deploymentPackage: DeploymentPackage = {
      version: options.version,
      channel: options.channel,
      platform,
      architecture: arch,
      signature: '', // Will be set by signPackage
      checksum,
      size: await this.getDirectorySize(options.buildPath),
      releaseNotes,
      criticalUpdate: options.channel === 'stable' && this.hasCriticalFixes(options.commits),
      minSystemVersion: this.getMinSystemVersion(platform),
    };
    return deploymentPackage;
  }
  private async signPackage(deploymentPackage: DeploymentPackage): Promise<void> {
    try {
      // Get signing key
      const privateKey = await this.credentialManager.getCredential('deployment_signing_key');
      if (!privateKey) {
        throw new Error('Deployment signing key not found');
      }
      // Create signature
      const dataToSign = JSON.stringify({
        version: deploymentPackage.version,
        channel: deploymentPackage.channel,
        checksum: deploymentPackage.checksum,
        platform: deploymentPackage.platform,
        architecture: deploymentPackage.architecture,
      });
      const sign = createSign('RSA-SHA256');
      sign.update(dataToSign);
      deploymentPackage.signature = sign.sign(privateKey.value, 'base64');
      await this.auditor.logEvent({
        type: 'code_modified',
        actor: 'system',
        action: 'sign_deployment_package',
        target: deploymentPackage.version,
        details: {
          algorithm: 'RSA-SHA256',
        },
        risk: 'low',
        context: {}
      });
    } catch (error) {
      throw new Error(`Failed to sign package: ${error instanceof Error ? (error as Error).message : String(error)}`);
    }
  }
  async verifyPackage(deploymentPackage: DeploymentPackage): Promise<boolean> {
    try {
      // Get public key
      const publicKey = await this.credentialManager.getCredential('deployment_verify_key');
      if (!publicKey) {
        throw new Error('Deployment verification key not found');
      }
      // Verify signature
      const dataToVerify = JSON.stringify({
        version: deploymentPackage.version,
        channel: deploymentPackage.channel,
        checksum: deploymentPackage.checksum,
        platform: deploymentPackage.platform,
        architecture: deploymentPackage.architecture,
      });
      const verify = createVerify('RSA-SHA256');
      verify.update(dataToVerify);
      const isValid = verify.verify(publicKey.value, deploymentPackage.signature, 'base64');
      await this.auditor.logEvent({
        type: 'security_scan_completed',
        actor: 'system',
        action: 'verify_package',
        target: deploymentPackage.version,
        details: {
          valid: isValid,
        },
        risk: 'low',
        context: {}
      });
      return isValid;
    } catch (error) {
      return false;
    }
  }
  private async createDeltaPackage(deploymentPackage: DeploymentPackage): Promise<void> {
    // Find the most recent compatible deployment
    const previousDeployment = this.deploymentHistory
      .filter(d => 
        d.platform === deploymentPackage.platform &&
        d.architecture === deploymentPackage.architecture &&
        d.version < deploymentPackage.version
      )
      .sort((a, b) => b.version.localeCompare(a.version))[0];
    if (previousDeployment) {
      // TODO: Implement actual delta generation
      deploymentPackage.deltaFrom = previousDeployment.version;
    }
  }
  private async deploy(deploymentPackage: DeploymentPackage): Promise<void> {
    try {
      // Verify package before deployment
      const isValid = await this.verifyPackage(deploymentPackage);
      if (!isValid) {
        throw new Error('Package signature verification failed');
      }
      // TODO: Implement actual deployment mechanism
      // This would involve:
      // 1. Uploading to update server
      // 2. Updating release channels
      // 3. Notifying clients
      await this.auditor.logEvent({
        type: 'update_deployed',
        actor: 'system',
        action: 'deploy_package',
        target: deploymentPackage.version,
        details: {
          channel: deploymentPackage.channel,
          auto: true,
        },
        risk: 'high',
        context: {}
      });
      this.emit('deploymentCompleted', deploymentPackage);
    } catch (error) {
      await this.auditor.logEvent({
        type: 'session_failed',
        actor: 'system',
        action: 'deployment_failed',
        target: deploymentPackage.version,
        details: {
          error: error instanceof Error ? (error as Error).message : String(error),
        },
        risk: 'critical',
        context: {}
      });
      throw error;
    }
  }
  async rollback(version: string): Promise<void> {
    const deployment = this.deploymentHistory.find(d => d.version === version);
    if (!deployment) {
      throw new Error(`Deployment version ${version} not found`);
    }
    try {
      // TODO: Implement actual rollback mechanism
      await this.auditor.logEvent({
        type: 'update_rolled_back',
        actor: 'system',
        action: 'rollback_deployment',
        target: version,
        details: {
          fromVersion: this.currentVersion,
        },
        risk: 'critical',
        context: {}
      });
      this.currentVersion = version;
      this.emit('rollbackCompleted', deployment);
    } catch (error) {
      await this.auditor.logEvent({
        type: 'session_failed',
        actor: 'system',
        action: 'rollback_failed',
        target: version,
        details: {
          error: error instanceof Error ? (error as Error).message : String(error),
        },
        risk: 'critical',
        context: {}
      });
      throw error;
    }
  }
  private generateVersion(): string {
    const now = new Date();
    const major = now.getFullYear() - 2000;
    const minor = now.getMonth() + 1;
    const patch = now.getDate() * 100 + now.getHours();
    return `${major}.${minor}.${patch}`;
  }
  private determineChannel(urgency: 'immediate' | 'scheduled'): 'stable' | 'beta' | 'alpha' {
    if (urgency === 'immediate') {
      return 'beta'; // Immediate fixes go to beta first
    }
    return 'stable';
  }
  private async calculateChecksum(filePath: string): Promise<string> {
    // TODO: Implement proper checksum calculation for directory
    const hash = createHash('sha256');
    hash.update(filePath);
    return hash.digest('hex');
  }
  private async getDirectorySize(_dirPath: string): Promise<number> {
    // TODO: Implement actual directory size calculation
    return 100 * 1024 * 1024; // 100MB placeholder
  }
  private generateReleaseNotes(commits: any[]): string {
    const notes = ['## Release Notes\n'];
    commits.forEach(commit => {
      notes.push(`- ${commit.message}`);
    });
    notes.push('\n### Automated Deployment');
    notes.push('This release was automatically generated and deployed by SessionHub.');
    return notes.join('\n');
  }
  private hasCriticalFixes(commits: any[]): boolean {
    return commits.some(commit => 
      commit.message.toLowerCase().includes('critical') ||
      commit.message.toLowerCase().includes('security')
    );
  }
  private getMinSystemVersion(platform: string): string {
    switch (platform) {
      case 'darwin':
        return '10.15'; // macOS Catalina
      case 'win32':
        return '10'; // Windows 10
      default:
        return '';
    }
  }
  private async loadDeploymentHistory(): Promise<void> {
    try {
      const historyPath = path.join(app.getPath('userData'), 'deployments', 'history.json');
      if (existsSync(historyPath)) {
        const data = await readFile(historyPath, 'utf-8');
        this.deploymentHistory = JSON.parse(data);
      }
    } catch (error) {
    }
  }
  private async saveDeploymentHistory(): Promise<void> {
    try {
      const historyPath = path.join(app.getPath('userData'), 'deployments', 'history.json');
      await writeFile(historyPath, JSON.stringify(this.deploymentHistory, null, 2));
    } catch (error) {
    }
  }
  getLastDeployment(): { version: string; timestamp: Date; status: 'success' | 'failure' } | undefined {
    if (this.deploymentHistory.length === 0) {
      return undefined;
    }
    const last = this.deploymentHistory[this.deploymentHistory.length - 1];
    return {
      version: last?.version || 'unknown',
      timestamp: new Date(), // TODO: Add timestamp to DeploymentPackage
      status: 'success',
    };
  }
  getStatus(): 'ready' | 'deploying' | 'blocked' {
    if (this.isDeploying) {
      return 'deploying';
    }
    if (!this.config.autoDeployEnabled) {
      return 'blocked';
    }
    return 'ready';
  }
}