/**
 * Self-Update Pipeline
 * Secure mechanism for SessionHub to build and deploy its own updates
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash, createSign, createVerify } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { Logger } from '../../lib/logging/Logger';
import { DevelopmentConfig, getConfig } from '../../config/development.config';

export interface UpdateManifest {
  version: string;
  buildTimestamp: Date;
  gitCommit: string;
  gitBranch: string;
  files: {
    path: string;
    hash: string;
    size: number;
  }[];
  signature: string;
  metadata: {
    buildDuration: number;
    testsPass: boolean;
    performanceDeltas: Record<string, number>;
  };
}

export interface UpdateProgress {
  stage: 'building' | 'testing' | 'packaging' | 'signing' | 'deploying' | 'complete' | 'failed';
  progress: number; // 0-100
  message: string;
  error?: Error;
}

export class SelfUpdatePipeline {
  private logger: Logger;
  private config: DevelopmentConfig;
  private buildDir: string;
  private distDir: string;
  private privateKeyPath: string;
  private publicKeyPath: string;

  constructor() {
    this.logger = new Logger('SelfUpdatePipeline');
    this.config = getConfig();
    this.buildDir = join(process.cwd(), '.build');
    this.distDir = join(process.cwd(), 'dist');
    this.privateKeyPath = join(process.cwd(), 'certs', 'update-signing.key');
    this.publicKeyPath = join(process.cwd(), 'certs', 'update-signing.pub');
  }

  /**
   * Build a new version of SessionHub
   */
  async buildUpdate(progressCallback?: (progress: UpdateProgress) => void): Promise<UpdateManifest> {
    this.logger.info('Starting self-update build process');
    
    const startTime = Date.now();
    const gitCommit = await this.getGitCommit();
    const gitBranch = await this.getGitBranch();
    const version = await this.getNextVersion();

    try {
      // Clean build directory
      this.reportProgress(progressCallback, {
        stage: 'building',
        progress: 10,
        message: 'Cleaning build directory'
      });
      
      await this.cleanBuildDir();

      // Install dependencies
      this.reportProgress(progressCallback, {
        stage: 'building',
        progress: 20,
        message: 'Installing dependencies'
      });
      
      await this.runCommand('npm', ['ci'], process.cwd());

      // Build TypeScript
      this.reportProgress(progressCallback, {
        stage: 'building',
        progress: 40,
        message: 'Compiling TypeScript'
      });
      
      await this.runCommand('npm', ['run', 'build'], process.cwd());

      // Run tests
      this.reportProgress(progressCallback, {
        stage: 'testing',
        progress: 60,
        message: 'Running test suite'
      });
      
      const testsPass = await this.runTests();

      // Package application
      this.reportProgress(progressCallback, {
        stage: 'packaging',
        progress: 80,
        message: 'Packaging application'
      });
      
      await this.packageApplication();

      // Create manifest
      this.reportProgress(progressCallback, {
        stage: 'signing',
        progress: 90,
        message: 'Creating update manifest'
      });
      
      const files = await this.catalogFiles();
      const buildDuration = Date.now() - startTime;

      const manifest: Omit<UpdateManifest, 'signature'> = {
        version,
        buildTimestamp: new Date(),
        gitCommit,
        gitBranch,
        files,
        metadata: {
          buildDuration,
          testsPass,
          performanceDeltas: await this.measurePerformanceDeltas(),
        },
      };

      // Sign manifest
      const signature = await this.signManifest(manifest);
      const signedManifest: UpdateManifest = { ...manifest, signature };

      // Save manifest
      await this.saveManifest(signedManifest);

      this.reportProgress(progressCallback, {
        stage: 'complete',
        progress: 100,
        message: `Build complete: ${version}`
      });

      this.logger.info('Self-update build completed successfully', {
        version,
        buildDuration,
        testsPass,
        fileCount: files.length,
      });

      return signedManifest;

    } catch (error) {
      this.reportProgress(progressCallback, {
        stage: 'failed',
        progress: 0,
        message: `Build failed: ${error.message}`,
        error: error as Error,
      });

      this.logger.error('Self-update build failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deploy an update to production
   */
  async deployUpdate(manifest: UpdateManifest, progressCallback?: (progress: UpdateProgress) => void): Promise<void> {
    this.logger.info('Starting update deployment', { version: manifest.version });

    try {
      // Verify signature
      this.reportProgress(progressCallback, {
        stage: 'deploying',
        progress: 10,
        message: 'Verifying update signature'
      });

      const isValid = await this.verifyManifest(manifest);
      if (!isValid) {
        throw new Error('Update signature verification failed');
      }

      // Backup current version
      this.reportProgress(progressCallback, {
        stage: 'deploying',
        progress: 30,
        message: 'Creating backup of current version'
      });

      await this.createBackup();

      // Copy new files
      this.reportProgress(progressCallback, {
        stage: 'deploying',
        progress: 60,
        message: 'Installing new files'
      });

      await this.installFiles(manifest);

      // Verify installation
      this.reportProgress(progressCallback, {
        stage: 'deploying',
        progress: 80,
        message: 'Verifying installation'
      });

      await this.verifyInstallation(manifest);

      // Update version info
      this.reportProgress(progressCallback, {
        stage: 'deploying',
        progress: 90,
        message: 'Updating version information'
      });

      await this.updateVersionInfo(manifest);

      this.reportProgress(progressCallback, {
        stage: 'complete',
        progress: 100,
        message: `Update deployed: ${manifest.version}`
      });

      this.logger.info('Update deployment completed successfully', {
        version: manifest.version,
        fileCount: manifest.files.length,
      });

    } catch (error) {
      this.reportProgress(progressCallback, {
        stage: 'failed',
        progress: 0,
        message: `Deployment failed: ${error.message}`,
        error: error as Error,
      });

      this.logger.error('Update deployment failed', { error: error.message });
      
      // Attempt rollback
      await this.rollbackUpdate();
      throw error;
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackUpdate(): Promise<void> {
    this.logger.info('Rolling back to previous version');

    const backupDir = join(process.cwd(), '.backup');
    
    try {
      // Check if backup exists
      const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
      if (!backupExists) {
        throw new Error('No backup found for rollback');
      }

      // Stop current instance
      await this.stopApplication();

      // Restore files from backup
      await this.runCommand('cp', ['-r', join(backupDir, '*'), process.cwd()]);

      // Restart application
      await this.startApplication();

      this.logger.info('Rollback completed successfully');
    } catch (error) {
      this.logger.error('Rollback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify update manifest signature
   */
  async verifyManifest(manifest: UpdateManifest): Promise<boolean> {
    try {
      const publicKey = await fs.readFile(this.publicKeyPath, 'utf-8');
      const verifier = createVerify('RSA-SHA256');
      
      // Create manifest without signature for verification
      const { signature, ...manifestData } = manifest;
      const manifestJson = JSON.stringify(manifestData, null, 2);
      
      verifier.update(manifestJson);
      const isValid = verifier.verify(publicKey, signature, 'base64');

      this.logger.info('Manifest signature verification', { isValid });
      return isValid;
    } catch (error) {
      this.logger.error('Manifest verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async cleanBuildDir(): Promise<void> {
    await fs.rm(this.buildDir, { recursive: true, force: true });
    await fs.mkdir(this.buildDir, { recursive: true });
  }

  private async runCommand(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => stdout += data.toString());
      child.stderr?.on('data', (data) => stderr += data.toString());

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`));
        }
      });
    });
  }

  private async runTests(): Promise<boolean> {
    try {
      await this.runCommand('npm', ['test'], process.cwd());
      return true;
    } catch (error) {
      this.logger.warn('Tests failed', { error: error.message });
      return false;
    }
  }

  private async packageApplication(): Promise<void> {
    // Use electron-builder to package the application
    await this.runCommand('npm', ['run', 'dist'], process.cwd());
  }

  private async catalogFiles(): Promise<UpdateManifest['files']> {
    const files: UpdateManifest['files'] = [];
    
    const addFiles = async (dir: string, basePath = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          await addFiles(fullPath, relativePath);
        } else {
          const content = await fs.readFile(fullPath);
          const hash = createHash('sha256').update(content).digest('hex');
          
          files.push({
            path: relativePath,
            hash,
            size: content.length,
          });
        }
      }
    };

    await addFiles(this.distDir);
    return files;
  }

  private async signManifest(manifest: Omit<UpdateManifest, 'signature'>): Promise<string> {
    const privateKey = await fs.readFile(this.privateKeyPath, 'utf-8');
    const signer = createSign('RSA-SHA256');
    
    const manifestJson = JSON.stringify(manifest, null, 2);
    signer.update(manifestJson);
    
    return signer.sign(privateKey, 'base64');
  }

  private async saveManifest(manifest: UpdateManifest): Promise<void> {
    const manifestPath = join(this.distDir, 'update-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private async createBackup(): Promise<void> {
    const backupDir = join(process.cwd(), '.backup');
    await fs.rm(backupDir, { recursive: true, force: true });
    await this.runCommand('cp', ['-r', process.cwd(), backupDir]);
  }

  private async installFiles(manifest: UpdateManifest): Promise<void> {
    for (const file of manifest.files) {
      const sourcePath = join(this.distDir, file.path);
      const targetPath = join(process.cwd(), file.path);
      
      // Ensure target directory exists
      await fs.mkdir(join(targetPath, '..'), { recursive: true });
      
      // Copy file
      await fs.copyFile(sourcePath, targetPath);
      
      // Verify hash
      const content = await fs.readFile(targetPath);
      const hash = createHash('sha256').update(content).digest('hex');
      
      if (hash !== file.hash) {
        throw new Error(`File hash mismatch: ${file.path}`);
      }
    }
  }

  private async verifyInstallation(manifest: UpdateManifest): Promise<void> {
    // Verify all files are present and have correct hashes
    for (const file of manifest.files) {
      const filePath = join(process.cwd(), file.path);
      const content = await fs.readFile(filePath);
      const hash = createHash('sha256').update(content).digest('hex');
      
      if (hash !== file.hash) {
        throw new Error(`Installation verification failed: ${file.path}`);
      }
    }
  }

  private async updateVersionInfo(manifest: UpdateManifest): Promise<void> {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    packageJson.version = manifest.version;
    packageJson.buildTimestamp = manifest.buildTimestamp;
    packageJson.gitCommit = manifest.gitCommit;
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  private async stopApplication(): Promise<void> {
    // Implementation depends on how the application is running
    // For now, this is a placeholder
    this.logger.info('Stopping application for update');
  }

  private async startApplication(): Promise<void> {
    // Implementation depends on how the application is running
    // For now, this is a placeholder
    this.logger.info('Starting application after update');
  }

  private async getGitCommit(): Promise<string> {
    try {
      const commit = await this.runCommand('git', ['rev-parse', 'HEAD'], process.cwd());
      return commit.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  private async getGitBranch(): Promise<string> {
    try {
      const branch = await this.runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], process.cwd());
      return branch.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  private async getNextVersion(): Promise<string> {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const currentVersion = packageJson.version || '0.9.0';
      
      // Simple version increment for development
      const parts = currentVersion.split('.');
      parts[2] = (parseInt(parts[2]) + 1).toString();
      
      return parts.join('.');
    } catch (error) {
      return '0.9.1';
    }
  }

  private async measurePerformanceDeltas(): Promise<Record<string, number>> {
    // Placeholder for performance measurement
    // This would compare startup time, memory usage, etc.
    return {
      startupTime: 0,
      memoryUsage: 0,
      buildSize: 0,
    };
  }

  private reportProgress(callback: ((progress: UpdateProgress) => void) | undefined, progress: UpdateProgress): void {
    if (callback) {
      callback(progress);
    }
  }
}