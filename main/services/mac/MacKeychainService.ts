import { execSync } from 'child_process';
import { safeStorage } from 'electron';

export class MacKeychainService {
  private serviceName: string;

  constructor(serviceName: string = 'SessionHub') {
    this.serviceName = serviceName;
  }

  /**
   * Store a credential in the Mac Keychain
   */
  async setCredential(service: string, account: string, password: string): Promise<void> {
    try {
      // Use Electron's safeStorage for encryption
      const encryptedPassword = safeStorage.encryptString(password);
      
      // Store in keychain using security command
      const command = `security add-generic-password -a "${account}" -s "${this.serviceName}-${service}" -w "${encryptedPassword.toString('base64')}" -U`;
      
      execSync(command);
    } catch (error: any) {
      if (error.status === 45) {
        // Item already exists, update it
        const deleteCommand = `security delete-generic-password -a "${account}" -s "${this.serviceName}-${service}"`;
        execSync(deleteCommand);
        
        // Try adding again
        const command = `security add-generic-password -a "${account}" -s "${this.serviceName}-${service}" -w "${safeStorage.encryptString(password).toString('base64')}" -U`;
        execSync(command);
      } else {
        throw error;
      }
    }
  }

  /**
   * Retrieve a credential from the Mac Keychain
   */
  async getCredential(service: string, account: string): Promise<string | null> {
    try {
      const command = `security find-generic-password -a "${account}" -s "${this.serviceName}-${service}" -w`;
      const encryptedBase64 = execSync(command, { encoding: 'utf8' }).trim();
      
      // Decrypt the password
      const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      
      return decrypted;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a credential from the Mac Keychain
   */
  async deleteCredential(service: string, account: string): Promise<void> {
    try {
      const command = `security delete-generic-password -a "${account}" -s "${this.serviceName}-${service}"`;
      execSync(command);
    } catch (error) {
      // Ignore errors if item doesn't exist
    }
  }

  /**
   * Check if a credential exists
   */
  async hasCredential(service: string, account: string): Promise<boolean> {
    try {
      const command = `security find-generic-password -a "${account}" -s "${this.serviceName}-${service}"`;
      execSync(command);
      return true;
    } catch (error) {
      return false;
    }
  }
}