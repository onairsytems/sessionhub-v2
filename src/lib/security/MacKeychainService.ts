/**
 * Mac Keychain integration for secure credential storage
 * Uses native macOS Keychain Services for storing sensitive data
 */

import { Logger } from '@/src/lib/logging/Logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface KeychainItem {
  service: string;
  account: string;
  password: string;
  label?: string;
  comment?: string;
}

export class MacKeychainService {
  private readonly logger: Logger;
  private readonly serviceName: string = 'SessionHub';
  
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Store a credential in Mac Keychain
   */
  async setCredential(
    account: string,
    password: string,
    label?: string
  ): Promise<void> {
    try {
      // First, try to delete any existing item
      await this.deleteCredential(account).catch(() => {});
      
      // Build the security command
      const args = [
        'add-generic-password',
        '-s', this.serviceName,
        '-a', account,
        '-w', password,
        '-T', '', // Allow access from this app
        '-U' // Update if exists
      ];
      
      if (label) {
        args.push('-l', label);
      }
      
      const command = `security ${args.map(arg => this.escapeShellArg(arg)).join(' ')}`;
      await execAsync(command);
      
      this.logger.info('Credential stored in Mac Keychain', { account });
    } catch (error) {
      this.logger.error('Failed to store credential in Keychain', error as Error);
      throw error;
    }
  }

  /**
   * Retrieve a credential from Mac Keychain
   */
  async getCredential(account: string): Promise<string | null> {
    try {
      const command = `security find-generic-password -s "${this.serviceName}" -a "${account}" -w`;
      const { stdout } = await execAsync(command);
      
      return stdout.trim();
    } catch (error) {
      // Item not found is not an error
      if ((error as any).code === 44) {
        return null;
      }
      
      this.logger.error('Failed to retrieve credential from Keychain', error as Error);
      throw error;
    }
  }

  /**
   * Delete a credential from Mac Keychain
   */
  async deleteCredential(account: string): Promise<void> {
    try {
      const command = `security delete-generic-password -s "${this.serviceName}" -a "${account}"`;
      await execAsync(command);
      
      this.logger.info('Credential deleted from Mac Keychain', { account });
    } catch (error) {
      // Item not found is not an error
      if ((error as any).code !== 44) {
        this.logger.error('Failed to delete credential from Keychain', error as Error);
        throw error;
      }
    }
  }

  /**
   * List all credentials for SessionHub
   */
  async listCredentials(): Promise<string[]> {
    try {
      const command = `security dump-keychain | grep -B 4 -A 4 '"${this.serviceName}"' | grep '"acct"' | cut -d '"' -f 4`;
      const { stdout } = await execAsync(command);
      
      return stdout
        .split('\n')
        .filter(line => line.trim())
        .filter((value, index, self) => self.indexOf(value) === index); // unique
    } catch (error) {
      this.logger.error('Failed to list credentials from Keychain', error as Error);
      return [];
    }
  }

  /**
   * Check if running in a sandboxed environment
   */
  isSandboxed(): boolean {
    // Check for Mac App Store sandbox
    return process.env['APP_SANDBOX_CONTAINER_ID'] !== undefined;
  }

  /**
   * Request Keychain access (for first-time setup)
   */
  async requestKeychainAccess(): Promise<boolean> {
    try {
      // Try to access keychain to trigger permission dialog
      await this.getCredential('test-access');
      return true;
    } catch (error) {
      // If we get a permission error, user needs to grant access
      if ((error as any).code === 1) {
        this.logger.warn('Keychain access denied - user needs to grant permission');
        return false;
      }
      return true;
    }
  }

  /**
   * Escape shell arguments to prevent injection
   */
  private escapeShellArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
  }

  /**
   * Store API keys with proper naming convention
   */
  async storeAPIKey(service: string, apiKey: string): Promise<void> {
    const account = `${service}-api-key`;
    const label = `${this.serviceName} ${service} API Key`;
    await this.setCredential(account, apiKey, label);
  }

  /**
   * Retrieve API key
   */
  async getAPIKey(service: string): Promise<string | null> {
    const account = `${service}-api-key`;
    return this.getCredential(account);
  }

  /**
   * Migrate from file-based credentials to Keychain
   */
  async migrateFromFileCredentials(
    fileCredentials: Array<{name: string; value: string}>
  ): Promise<void> {
    for (const cred of fileCredentials) {
      try {
        await this.setCredential(cred.name, cred.value);
        this.logger.info('Migrated credential to Keychain', { name: cred.name });
      } catch (error) {
        this.logger.error('Failed to migrate credential', error as Error, { 
          name: cred.name 
        });
      }
    }
  }
}