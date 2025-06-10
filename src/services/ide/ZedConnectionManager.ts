import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface ZedCredentials {
  apiToken: string;
  email: string;
  userId?: string;
}

export interface ZedConnectionConfig {
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  healthCheckInterval: number;
}

export interface ConnectionHealth {
  isConnected: boolean;
  isZedRunning: boolean;
  isMCPAvailable: boolean;
  lastHealthCheck: Date;
  connectionUptime: number;
  errors: string[];
}

export class ZedConnectionManager extends EventEmitter {
  private credentials: ZedCredentials | null = null;
  private config: ZedConnectionConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionStartTime?: Date;

  constructor(config?: Partial<ZedConnectionConfig>) {
    super();
    this.config = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      healthCheckInterval: 10000,
      ...config
    };
  }

  async initialize(credentials: ZedCredentials): Promise<void> {
    this.credentials = credentials;
    await this.storeCredentials(credentials);
    await this.connect();
    this.startHealthCheck();
  }

  private async storeCredentials(credentials: ZedCredentials): Promise<void> {
    // Store in macOS Keychain for security
    const { apiToken, email } = credentials;
    
    try {
      // Store API token
      await execAsync(
        `security add-generic-password -a "sessionhub-zed" -s "zed-api-token" -w "${apiToken}" -U`
      );
      
      // Store email
      await execAsync(
        `security add-generic-password -a "sessionhub-zed" -s "zed-email" -w "${email}" -U`
      );
    } catch (error) {
      // Update existing if already exists
      await execAsync(
        `security delete-generic-password -a "sessionhub-zed" -s "zed-api-token" 2>/dev/null || true`
      );
      await execAsync(
        `security add-generic-password -a "sessionhub-zed" -s "zed-api-token" -w "${apiToken}"`
      );
      
      await execAsync(
        `security delete-generic-password -a "sessionhub-zed" -s "zed-email" 2>/dev/null || true`
      );
      await execAsync(
        `security add-generic-password -a "sessionhub-zed" -s "zed-email" -w "${email}"`
      );
    }
  }

  async retrieveCredentials(): Promise<ZedCredentials | null> {
    try {
      const { stdout: apiToken } = await execAsync(
        `security find-generic-password -a "sessionhub-zed" -s "zed-api-token" -w`
      );
      
      const { stdout: email } = await execAsync(
        `security find-generic-password -a "sessionhub-zed" -s "zed-email" -w`
      );
      
      return {
        apiToken: apiToken.trim(),
        email: email.trim()
      };
    } catch (error) {
      return null;
    }
  }

  async connect(): Promise<void> {
    try {
      // Check if Zed is installed
      const isInstalled = await this.isZedInstalled();
      if (!isInstalled) {
        throw new Error('Zed is not installed. Please install Zed from https://zed.dev');
      }

      // Check if Zed is running
      const isRunning = await this.isZedRunning();
      if (!isRunning) {
        await this.launchZed();
      }

      // Validate MCP connection
      await this.validateMCPConnection();

      this.isConnected = true;
      this.connectionStartTime = new Date();
      this.reconnectAttempts = 0;
      this.emit('connected');
    } catch (error) {
      this.isConnected = false;
      this.emit('connection-failed', error);
      
      if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
      
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.stopHealthCheck();
    this.emit('disconnected');
  }

  private async isZedInstalled(): Promise<boolean> {
    try {
      // Check common installation paths
      const paths = [
        '/Applications/Zed.app',
        '/Applications/Zed Preview.app',
        path.join(process.env['HOME'] || '', 'Applications/Zed.app')
      ];
      
      for (const appPath of paths) {
        try {
          await fs.access(appPath);
          return true;
        } catch {}
      }
      
      // Check if zed CLI is available
      const { stdout } = await execAsync('which zed');
      return !!stdout.trim();
    } catch {
      return false;
    }
  }

  private async isZedRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('pgrep -x Zed || pgrep -x "Zed Preview"');
      const pids = stdout.trim().split('\n').filter(Boolean);
      if (pids.length > 0) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async launchZed(): Promise<void> {
    try {
      // Try to launch Zed using the CLI
      await execAsync('zed');
      
      // Wait for Zed to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify it's running
      const isRunning = await this.isZedRunning();
      if (!isRunning) {
        throw new Error('Failed to launch Zed');
      }
    } catch (error) {
      // Try alternative launch method
      try {
        await execAsync('open -a "Zed"');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch {
        await execAsync('open -a "Zed Preview"');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  private async validateMCPConnection(): Promise<void> {
    // This would validate that the MCP server is accessible from Zed
    // For now, we'll implement a basic check
    try {
      // Check if MCP configuration exists
      const mcpConfigPath = path.join(
        process.env['HOME'] || '',
        '.config/zed/mcp.json'
      );
      
      await fs.access(mcpConfigPath);
    } catch (error) {
      // MCP config doesn't exist, we'll need to create it
      await this.setupMCPConfiguration();
    }
  }

  private async setupMCPConfiguration(): Promise<void> {
    const mcpConfig = {
      servers: {
        sessionhub: {
          transport: 'stdio',
          command: 'node',
          args: [
            path.join(process.cwd(), 'dist/mcp-server/index.js')
          ],
          env: {
            SESSIONHUB_API_TOKEN: this.credentials?.apiToken || ''
          }
        }
      }
    };

    const configDir = path.join(process.env['HOME'] || '', '.config/zed');
    await fs.mkdir(configDir, { recursive: true });
    
    const mcpConfigPath = path.join(configDir, 'mcp.json');
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect().catch(error => {
        this.emit('reconnect-failed', error);
      });
    }, this.config.reconnectInterval);
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      const health = await this.getConnectionHealth();
      this.emit('health-check', health);
      
      if (!health.isConnected && this.config.autoReconnect) {
        await this.connect().catch(() => {});
      }
    }, this.config.healthCheckInterval);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  async getConnectionHealth(): Promise<ConnectionHealth> {
    const errors: string[] = [];
    
    const isZedRunning = await this.isZedRunning();
    if (!isZedRunning) {
      errors.push('Zed is not running');
    }
    
    let isMCPAvailable = false;
    try {
      await this.validateMCPConnection();
      isMCPAvailable = true;
    } catch (error) {
      errors.push('MCP connection unavailable');
    }
    
    const connectionUptime = this.connectionStartTime
      ? Date.now() - this.connectionStartTime.getTime()
      : 0;
    
    return {
      isConnected: this.isConnected && isZedRunning,
      isZedRunning,
      isMCPAvailable,
      lastHealthCheck: new Date(),
      connectionUptime,
      errors
    };
  }

  async testConnection(): Promise<{
    success: boolean;
    diagnostics: {
      zedInstalled: boolean;
      zedRunning: boolean;
      mcpConfigured: boolean;
      credentialsValid: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    
    const zedInstalled = await this.isZedInstalled();
    if (!zedInstalled) {
      errors.push('Zed is not installed');
    }
    
    const zedRunning = await this.isZedRunning();
    if (!zedRunning && zedInstalled) {
      errors.push('Zed is not running');
    }
    
    let mcpConfigured = false;
    try {
      await this.validateMCPConnection();
      mcpConfigured = true;
    } catch {
      errors.push('MCP is not configured');
    }
    
    const credentialsValid = this.credentials !== null;
    if (!credentialsValid) {
      errors.push('No credentials configured');
    }
    
    return {
      success: errors.length === 0,
      diagnostics: {
        zedInstalled,
        zedRunning,
        mcpConfigured,
        credentialsValid
      },
      errors
    };
  }
}