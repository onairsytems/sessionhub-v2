
/**
 * Development Environment Manager
 * Handles isolation and coordination between development and production instances
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { DevelopmentConfig, getConfig, validateConfig } from '../../config/development.config';
import { Logger } from '../../lib/logging/Logger';

export interface InstanceInfo {
  id: string;
  pid?: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastUpdate: Date;
  version: string;
  config: DevelopmentConfig;
}

export class DevelopmentEnvironment {
  private logger: Logger;
  private config: DevelopmentConfig;
  private lockFile: string;
  private statusFile: string;

  constructor() {
    this.logger = new Logger('DevelopmentEnvironment');
    this.config = getConfig();
    this.lockFile = join(this.expandPath(this.config.dataDirectory), 'instance.lock');
    this.statusFile = join(this.expandPath(this.config.dataDirectory), 'status.json');
  }

  /**
   * Initialize development environment
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing development environment', { 
      instanceId: this.config.instanceId 
    });

    // Validate configuration
    const configErrors = validateConfig(this.config);
    if (configErrors.length > 0) {
      throw new Error(`Configuration errors: ${configErrors.join(', ')}`);
    }

    // Create data directory
    await this.ensureDataDirectory();

    // Check for existing instance
    const existingInstance = await this.getInstanceInfo();
    if (existingInstance && existingInstance.status === 'running') {
      throw new Error(`Instance ${existingInstance.id} is already running (PID: ${existingInstance.pid})`);
    }

    // Create lock file
    await this.createLockFile();

    // Initialize status
    await this.updateStatus('starting');

    this.logger.info('Development environment initialized successfully');
  }

  /**
   * Start development instance
   */
  async startInstance(): Promise<ChildProcess> {
    this.logger.info('Starting development instance');

    const electronPath = this.findElectronPath();
    const mainScript = join(process.cwd(), 'main', 'background.ts');

    const child = spawn(electronPath, [mainScript], {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        SESSIONHUB_INSTANCE: 'dev',
        SESSIONHUB_DATA_DIR: this.expandPath(this.config.dataDirectory),
        SESSIONHUB_IPC_PORT: this.config.ipcPorts.main.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Monitor process
    child.on('spawn', () => {
      this.logger.info('Development instance started', { pid: child.pid });
      this.updateStatus('running', child.pid);
    });

    child.on('error', (error) => {
      this.logger.error('Development instance error', error);
      this.updateStatus('error');
    });

    child.on('exit', (code, signal) => {
      this.logger.info('Development instance exited', { code, signal });
      this.updateStatus('stopped');
      this.removeLockFile();
    });

    // Pipe logs
    child.stdout?.on('data', (data) => {
      this.logger.debug('DEV-OUT', { message: data.toString().trim() });
    });

    child.stderr?.on('data', (data) => {
      this.logger.warn('DEV-ERR', { message: data.toString().trim() });
    });

    return child;
  }

  /**
   * Stop development instance
   */
  async stopInstance(): Promise<void> {
    const instance = await this.getInstanceInfo();
    if (!instance || instance.status !== 'running' || !instance.pid) {
      this.logger.warn('No running instance to stop');
      return;
    }

    this.logger.info('Stopping development instance', { pid: instance.pid });

    try {
      process.kill(instance.pid, 'SIGTERM');
      
      // Wait for graceful shutdown
      await this.waitForStop(instance.pid, 10000);
      
      this.logger.info('Development instance stopped gracefully');
    } catch (error: any) {
      this.logger.warn('Graceful stop failed, forcing termination', { error });
      
      try {
        process.kill(instance.pid, 'SIGKILL');
      } catch (killError) {
        this.logger.error('Failed to force stop instance', killError as Error);
      }
    }

    await this.updateStatus('stopped');
    await this.removeLockFile();
  }

  /**
   * Get current instance information
   */
  async getInstanceInfo(): Promise<InstanceInfo | null> {
    try {
      const statusData = await fs.readFile(this.statusFile, 'utf-8');
      return JSON.parse(statusData);
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Check if development instance is isolated from production
   */
  async verifyIsolation(): Promise<boolean> {
    const devConfig = this.config;
    
    // Check data directory isolation
    const devDataDir = this.expandPath(devConfig.dataDirectory);
    const prodDataDir = this.expandPath('~/Library/Application Support/SessionHub');
    
    if (devDataDir === prodDataDir) {
      this.logger.error('Data directories are not isolated');
      return false;
    }

    // Check port isolation
    const prodPorts = [9001, 9002, 9003];
    const devPorts = Object.values(devConfig.ipcPorts);
    
    const portConflicts = devPorts.filter(port => prodPorts.includes(port));
    if (portConflicts.length > 0) {
      this.logger.error('Port conflicts detected', undefined, { conflicts: portConflicts });
      return false;
    }

    // Check Supabase project isolation
    if (devConfig.supabase.projectId === 'sessionhub') {
      this.logger.error('Using production Supabase project in development');
      return false;
    }

    this.logger.info('Instance isolation verified');
    return true;
  }

  /**
   * Clean up development environment
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up development environment');

    await this.stopInstance();
    
    // Optional: Remove data directory
    const shouldCleanData = process.env['SESSIONHUB_CLEAN_DATA'] === 'true';
    if (shouldCleanData) {
      const dataDir = this.expandPath(this.config.dataDirectory);
      await fs.rm(dataDir, { recursive: true, force: true });
      this.logger.info('Development data directory removed');
    }
  }

  /**
   * Private helper methods
   */
  private async ensureDataDirectory(): Promise<void> {
    const dataDir = this.expandPath(this.config.dataDirectory);
    await fs.mkdir(dataDir, { recursive: true });
  }

  private async createLockFile(): Promise<void> {
    const lockData = {
      pid: process.pid,
      instanceId: this.config.instanceId,
      timestamp: new Date().toISOString(),
    };
    
    await fs.writeFile(this.lockFile, JSON.stringify(lockData, null, 2));
  }

  private async removeLockFile(): Promise<void> {
    try {
      await fs.unlink(this.lockFile);
    } catch (error: any) {
      // Ignore if file doesn't exist
    }
  }

  private async updateStatus(status: InstanceInfo['status'], pid?: number): Promise<void> {
    const statusData: InstanceInfo = {
      id: this.config.instanceId,
      pid,
      status,
      lastUpdate: new Date(),
      version: process.env['npm_package_version'] || '0.9.0',
      config: this.config,
    };

    await fs.writeFile(this.statusFile, JSON.stringify(statusData, null, 2));
  }

  private async waitForStop(pid: number, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = 100;
      let elapsed = 0;

      const check = () => {
        try {
          process.kill(pid, 0); // Check if process exists
          elapsed += checkInterval;
          
          if (elapsed >= timeout) {
            reject(new Error(`Process ${pid} did not stop within ${timeout}ms`));
          } else {
            setTimeout(check, checkInterval);
          }
        } catch (error: any) {
          // Process no longer exists
          resolve();
        }
      };

      check();
    });
  }

  private expandPath(path: string): string {
    return path.replace(/^~/, homedir());
  }

  private findElectronPath(): string {
    // Try common electron paths
    // const candidates = [ // Commented out for future use
    //   'npx electron',
    //   './node_modules/.bin/electron',
    //   'electron',
    // ];

    // For now, return the npx version
    // In production, this should be the bundled electron
    return 'npx';
  }
}