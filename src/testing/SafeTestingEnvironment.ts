/**
 * Safe Testing Environment for SessionHub
 * Provides isolated testing environments that protect real projects and data
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';

export interface IsolationConfig {
  enableFileSystemIsolation: boolean;
  enableDatabaseIsolation: boolean;
  enableNetworkIsolation: boolean;
  enableProcessIsolation: boolean;
  temporaryDataPath?: string;
  mockExternalServices: boolean;
  preserveTestData: boolean;
}

export interface TestEnvironment {
  id: string;
  name: string;
  createdAt: Date;
  config: IsolationConfig;
  workingDirectory: string;
  databasePath?: string;
  mockServices: Map<string, any>;
  environmentVariables: Map<string, string>;
  active: boolean;
}

export interface ServiceMock {
  serviceName: string;
  implementation: any;
  callLog: Array<{
    method: string;
    args: any[];
    result: any;
    timestamp: Date;
  }>;
}

export class SafeTestingEnvironment extends EventEmitter {
  private environments: Map<string, TestEnvironment> = new Map();
  private basePath: string;
  private originalEnv: NodeJS.ProcessEnv;
  private originalCwd: string;
  private activeEnvironment?: TestEnvironment;

  constructor(basePath?: string) {
    super();
    this.basePath = basePath || path.join(os.tmpdir(), 'sessionhub-test-env');
    this.originalEnv = { ...process.env };
    this.originalCwd = process.cwd();
    this.initialize();
  }

  private initialize(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Create an isolated test environment
   */
  public createEnvironment(
    name: string, 
    config: Partial<IsolationConfig> = {}
  ): TestEnvironment {
    const defaultConfig: IsolationConfig = {
      enableFileSystemIsolation: true,
      enableDatabaseIsolation: true,
      enableNetworkIsolation: true,
      enableProcessIsolation: true,
      mockExternalServices: true,
      preserveTestData: false,
      ...config
    };

    const envId = uuidv4();
    const workingDirectory = path.join(this.basePath, envId);
    
    // Create isolated working directory
    fs.mkdirSync(workingDirectory, { recursive: true });
    
    // Set up directory structure
    this.setupDirectoryStructure(workingDirectory);

    const environment: TestEnvironment = {
      id: envId,
      name,
      createdAt: new Date(),
      config: defaultConfig,
      workingDirectory,
      mockServices: new Map(),
      environmentVariables: new Map(),
      active: false
    };

    if (defaultConfig.enableDatabaseIsolation) {
      environment.databasePath = path.join(workingDirectory, 'test-db');
      fs.mkdirSync(environment.databasePath, { recursive: true });
    }

    this.environments.set(envId, environment);
    this.emit('environment:created', environment);

    return environment;
  }

  /**
   * Activate a test environment
   */
  public activateEnvironment(environmentId: string): void {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    if (this.activeEnvironment) {
      this.deactivateEnvironment();
    }

    this.activeEnvironment = environment;
    environment.active = true;

    // Apply isolations
    if (environment.config.enableFileSystemIsolation) {
      this.applyFileSystemIsolation(environment);
    }

    if (environment.config.enableProcessIsolation) {
      this.applyProcessIsolation(environment);
    }

    if (environment.config.enableNetworkIsolation) {
      this.applyNetworkIsolation(environment);
    }

    if (environment.config.mockExternalServices) {
      this.setupServiceMocks(environment);
    }

    this.emit('environment:activated', environment);
  }

  /**
   * Deactivate the current environment
   */
  public deactivateEnvironment(): void {
    if (!this.activeEnvironment) {
      return;
    }

    // Restore original state
    this.restoreOriginalState();

    this.activeEnvironment.active = false;
    this.emit('environment:deactivated', this.activeEnvironment);
    
    if (!this.activeEnvironment.config.preserveTestData) {
      this.cleanupEnvironment(this.activeEnvironment.id);
    }

    this.activeEnvironment = undefined;
  }

  /**
   * Apply file system isolation
   */
  private applyFileSystemIsolation(environment: TestEnvironment): void {
    // Change working directory to isolated path
    process.chdir(environment.workingDirectory);

    // Override fs methods to sandbox file operations
    this.sandboxFileOperations(environment);
  }

  /**
   * Apply process isolation
   */
  private applyProcessIsolation(environment: TestEnvironment): void {
    // Backup and clear environment variables
    this.originalEnv = { ...process.env };
    
    // Set isolated environment variables
    if (process.env) {
      Object.keys(process.env).forEach(key => {
        delete process.env[key];
      });

      // Apply test environment variables
      environment.environmentVariables.forEach((value, key) => {
        process.env[key] = value;
      });
    }

    // Set test-specific environment variables
    if (process.env) {
      (process.env as any)['NODE_ENV'] = 'test';
      process.env['SESSIONHUB_TEST_ENV'] = environment.id;
      process.env['SESSIONHUB_TEST_PATH'] = environment.workingDirectory;
    }
  }

  /**
   * Apply network isolation
   */
  private applyNetworkIsolation(_environment: TestEnvironment): void {
    // This would typically involve:
    // - Mocking HTTP/HTTPS modules
    // - Intercepting network requests
    // - Routing to mock services
    
    // For now, we'll set environment variables to use mock endpoints
    if (process.env) {
      process.env['SESSIONHUB_API_ENDPOINT'] = 'http://localhost:9999/mock-api';
      process.env['SESSIONHUB_DISABLE_EXTERNAL_REQUESTS'] = 'true';
    }
  }

  /**
   * Setup service mocks
   */
  private setupServiceMocks(environment: TestEnvironment): void {
    // Mock common services
    const mockServices = [
      { name: 'SupabaseService', mock: this.createSupabaseMock() },
      { name: 'GitHubConnector', mock: this.createGitHubMock() },
      { name: 'LinearConnector', mock: this.createLinearMock() },
      { name: 'SlackConnector', mock: this.createSlackMock() }
    ];

    mockServices.forEach(({ name, mock }) => {
      environment.mockServices.set(name, mock);
    });
  }

  /**
   * Sandbox file operations
   */
  private sandboxFileOperations(environment: TestEnvironment): void {
    const sandboxPath = environment.workingDirectory;
    const isPathAllowed = (targetPath: string): boolean => {
      const resolved = path.resolve(targetPath);
      return resolved.startsWith(sandboxPath);
    };

    // Store original methods
    const originalMethods = {
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
      mkdirSync: fs.mkdirSync,
      rmSync: fs.rmSync
    };

    // Override with sandboxed versions
    (fs as any).readFileSync = (filePath: string, ...args: any[]) => {
      if (!isPathAllowed(filePath)) {
        throw new Error(`Access denied: ${filePath} is outside test environment`);
      }
      return originalMethods.readFileSync(filePath, ...args);
    };

    (fs as any).writeFileSync = (filePath: string, data: any, options?: any) => {
      if (!isPathAllowed(filePath)) {
        throw new Error(`Access denied: ${filePath} is outside test environment`);
      }
      return originalMethods.writeFileSync(filePath, data, options);
    };

    // Store originals for restoration
    (environment as any).originalFsMethods = originalMethods;
  }

  /**
   * Restore original state
   */
  private restoreOriginalState(): void {
    // Restore working directory
    process.chdir(this.originalCwd);

    // Restore environment variables
    if (process.env) {
      Object.keys(process.env).forEach(key => {
        delete process.env[key];
      });
      Object.assign(process.env, this.originalEnv);
    }

    // Restore fs methods if they were overridden
    if (this.activeEnvironment && (this.activeEnvironment as any).originalFsMethods) {
      const originals = (this.activeEnvironment as any).originalFsMethods;
      Object.keys(originals).forEach(method => {
        (fs as any)[method] = originals[method];
      });
    }
  }

  /**
   * Setup directory structure for test environment
   */
  private setupDirectoryStructure(workingDirectory: string): void {
    const directories = [
      'src',
      'tests',
      'config',
      'data',
      'logs',
      'tmp',
      '.sessionhub'
    ];

    directories.forEach(dir => {
      fs.mkdirSync(path.join(workingDirectory, dir), { recursive: true });
    });

    // Create basic config files
    const configFiles = {
      'package.json': {
        name: 'sessionhub-test',
        version: '1.0.0',
        private: true
      },
      'tsconfig.json': {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        }
      }
    };

    Object.entries(configFiles).forEach(([filename, content]) => {
      fs.writeFileSync(
        path.join(workingDirectory, filename),
        JSON.stringify(content, null, 2)
      );
    });
  }

  /**
   * Create mock services
   */
  private createSupabaseMock(): ServiceMock {
    const callLog: any[] = [];
    
    return {
      serviceName: 'SupabaseService',
      implementation: {
        from: (_table: string) => ({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: {}, error: null })
        }),
        auth: {
          signIn: jest.fn().mockResolvedValue({ user: {}, error: null }),
          signOut: jest.fn().mockResolvedValue({ error: null })
        }
      },
      callLog
    };
  }

  private createGitHubMock(): ServiceMock {
    return {
      serviceName: 'GitHubConnector',
      implementation: {
        getRepositories: jest.fn().mockResolvedValue([]),
        createIssue: jest.fn().mockResolvedValue({ id: 'mock-issue-1' }),
        getPullRequests: jest.fn().mockResolvedValue([])
      },
      callLog: []
    };
  }

  private createLinearMock(): ServiceMock {
    return {
      serviceName: 'LinearConnector',
      implementation: {
        getIssues: jest.fn().mockResolvedValue([]),
        createIssue: jest.fn().mockResolvedValue({ id: 'mock-linear-1' }),
        updateIssue: jest.fn().mockResolvedValue({ success: true })
      },
      callLog: []
    };
  }

  private createSlackMock(): ServiceMock {
    return {
      serviceName: 'SlackConnector',
      implementation: {
        sendMessage: jest.fn().mockResolvedValue({ ok: true }),
        getChannels: jest.fn().mockResolvedValue([])
      },
      callLog: []
    };
  }

  /**
   * Cleanup test environment
   */
  public cleanupEnvironment(environmentId: string): void {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      return;
    }

    if (environment.active) {
      this.deactivateEnvironment();
    }

    // Remove directory
    if (fs.existsSync(environment.workingDirectory)) {
      fs.rmSync(environment.workingDirectory, { recursive: true, force: true });
    }

    this.environments.delete(environmentId);
    this.emit('environment:cleaned', environmentId);
  }

  /**
   * Cleanup all environments
   */
  public cleanupAll(): void {
    this.environments.forEach((_, id) => {
      this.cleanupEnvironment(id);
    });
  }

  /**
   * Get environment by ID
   */
  public getEnvironment(environmentId: string): TestEnvironment | undefined {
    return this.environments.get(environmentId);
  }

  /**
   * Get all environments
   */
  public getAllEnvironments(): TestEnvironment[] {
    return Array.from(this.environments.values());
  }

  /**
   * Get active environment
   */
  public getActiveEnvironment(): TestEnvironment | undefined {
    return this.activeEnvironment;
  }

  /**
   * Create a snapshot of current environment
   */
  public createSnapshot(environmentId: string): string {
    const environment = this.environments.get(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    const snapshotId = `snapshot-${Date.now()}`;
    const snapshotPath = path.join(this.basePath, 'snapshots', snapshotId);
    
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    
    // Copy environment directory
    execSync(`cp -r "${environment.workingDirectory}" "${snapshotPath}"`);
    
    // Save metadata
    const metadata = {
      environmentId,
      snapshotId,
      createdAt: new Date(),
      environmentConfig: environment.config
    };
    
    fs.writeFileSync(
      path.join(snapshotPath, 'snapshot-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    this.emit('snapshot:created', { environmentId, snapshotId });
    
    return snapshotId;
  }

  /**
   * Restore from snapshot
   */
  public restoreSnapshot(snapshotId: string, newEnvironmentName: string): TestEnvironment {
    const snapshotPath = path.join(this.basePath, 'snapshots', snapshotId);
    
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const metadataPath = path.join(snapshotPath, 'snapshot-metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    
    // Create new environment
    const newEnv = this.createEnvironment(newEnvironmentName, metadata.environmentConfig);
    
    // Copy snapshot data
    execSync(`cp -r "${snapshotPath}"/* "${newEnv.workingDirectory}"/`);
    
    // Remove metadata file from working directory
    fs.unlinkSync(path.join(newEnv.workingDirectory, 'snapshot-metadata.json'));
    
    this.emit('snapshot:restored', { snapshotId, environmentId: newEnv.id });
    
    return newEnv;
  }
}

// Export singleton instance
let instance: SafeTestingEnvironment | null = null;

export const getSafeTestingEnvironment = (basePath?: string): SafeTestingEnvironment => {
  if (!instance) {
    instance = new SafeTestingEnvironment(basePath);
  }
  return instance;
};

export const resetSafeTestingEnvironment = (): void => {
  if (instance) {
    instance.cleanupAll();
    instance = null;
  }
};