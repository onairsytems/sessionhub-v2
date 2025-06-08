
/**
 * Secure credential management for API keys and sensitive data
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '@/src/lib/logging/Logger';

export interface Credential {
  id: string;
  name: string;
  type: 'api_key' | 'token' | 'password' | 'certificate';
  value: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface EncryptedCredential {
  id: string;
  name: string;
  type: Credential['type'];
  encryptedValue: string;
  iv: string;
  authTag: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export class CredentialManager {
  private readonly logger: Logger;
  private readonly credentialsPath: string;
  private encryptionKey: Buffer;
  private credentials: Map<string, EncryptedCredential> = new Map();
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    logger: Logger,
    masterKey?: string,
    credentialsPath?: string
  ) {
    this.logger = logger;
    
    // Use Mac app directory if not specified
    if (!credentialsPath) {
      this.credentialsPath = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'SessionHub',
        'credentials'
      );
    } else {
      this.credentialsPath = credentialsPath;
    }
    
    // Use provided master key or generate from environment
    this.encryptionKey = this.deriveEncryptionKey(
      masterKey || process.env['SESSIONHUB_MASTER_KEY'] || 'default-dev-key-change-in-production'
    );
  }

  /**
   * Initialize the credential manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure credentials directory exists
      await fs.mkdir(this.credentialsPath, { recursive: true });
      
      // Load existing credentials
      await this.loadCredentials();
      
      this.logger.info('CredentialManager initialized', {
        credentialsPath: this.credentialsPath,
        credentialCount: this.credentials.size
      });
    } catch (error: any) {
      this.logger.error('Failed to initialize CredentialManager', error as Error);
      throw error;
    }
  }

  /**
   * Store a credential securely
   */
  async storeCredential(credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateCredentialId();
    const now = new Date().toISOString();

    const fullCredential: Credential = {
      ...credential,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Encrypt the credential
    const encrypted = this.encryptCredential(fullCredential);
    this.credentials.set(id, encrypted);

    // Save to disk
    await this.saveCredential(encrypted);

    this.logger.info('Credential stored', {
      id,
      name: credential.name,
      type: credential.type
    });

    return id;
  }

  /**
   * Retrieve a credential
   */
  async getCredential(id: string): Promise<Credential | null> {
    const encrypted = this.credentials.get(id);
    if (!encrypted) {
      return null;
    }

    // Check expiration
    if (encrypted.expiresAt && new Date(encrypted.expiresAt) < new Date()) {
      this.logger.warn('Credential expired', { id, expiresAt: encrypted.expiresAt });
      await this.deleteCredential(id);
      return null;
    }

    return this.decryptCredential(encrypted);
  }

  /**
   * Get credential by name
   */
  async getCredentialByName(name: string): Promise<Credential | null> {
    for (const encrypted of this.credentials.values()) {
      if (encrypted.name === name) {
        return this.getCredential(encrypted.id);
      }
    }
    return null;
  }

  /**
   * Update a credential
   */
  async updateCredential(
    id: string,
    updates: Partial<Omit<Credential, 'id' | 'createdAt'>>
  ): Promise<void> {
    const existing = await this.getCredential(id);
    if (!existing) {
      throw new Error(`Credential not found: ${id}`);
    }

    const updated: Credential = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const encrypted = this.encryptCredential(updated);
    this.credentials.set(id, encrypted);
    await this.saveCredential(encrypted);

    this.logger.info('Credential updated', { id, name: updated.name });
  }

  /**
   * Delete a credential
   */
  async deleteCredential(id: string): Promise<void> {
    if (!this.credentials.has(id)) {
      throw new Error(`Credential not found: ${id}`);
    }

    this.credentials.delete(id);
    
    // Delete from disk
    const filePath = path.join(this.credentialsPath, `${id}.json`);
    await fs.unlink(filePath).catch(() => {});

    this.logger.info('Credential deleted', { id });
  }

  /**
   * List all credentials (without values)
   */
  listCredentials(): Array<Omit<Credential, 'value'>> {
    const list: Array<Omit<Credential, 'value'>> = [];
    
    for (const encrypted of this.credentials.values()) {
      list.push({
        id: encrypted.id,
        name: encrypted.name,
        type: encrypted.type,
        metadata: encrypted.metadata,
        createdAt: encrypted.createdAt,
        updatedAt: encrypted.updatedAt,
        expiresAt: encrypted.expiresAt
      });
    }
    
    return list;
  }

  /**
   * Rotate encryption key
   */
  async rotateEncryptionKey(newMasterKey: string): Promise<void> {
    this.logger.info('Starting encryption key rotation');
    
    // Decrypt all credentials with old key
    const decryptedCredentials: Credential[] = [];
    for (const encrypted of this.credentials.values()) {
      const decrypted = this.decryptCredential(encrypted);
      decryptedCredentials.push(decrypted);
    }
    
    // Update encryption key
    this.encryptionKey = this.deriveEncryptionKey(newMasterKey);
    
    // Re-encrypt all credentials with new key
    this.credentials.clear();
    for (const credential of decryptedCredentials) {
      const encrypted = this.encryptCredential(credential);
      this.credentials.set(credential.id, encrypted);
      await this.saveCredential(encrypted);
    }
    
    this.logger.info('Encryption key rotation complete', {
      credentialCount: decryptedCredentials.length
    });
  }

  /**
   * Validate credentials
   */
  async validateCredentials(): Promise<{
    valid: number;
    expired: number;
    errors: number;
  }> {
    let valid = 0;
    let expired = 0;
    let errors = 0;
    
    for (const [id, encrypted] of this.credentials.entries()) {
      try {
        // Check if expired
        if (encrypted.expiresAt && new Date(encrypted.expiresAt) < new Date()) {
          expired++;
          continue;
        }
        
        // Try to decrypt
        this.decryptCredential(encrypted);
        valid++;
      } catch (error: any) {
        errors++;
        this.logger.error('Failed to validate credential', error as Error, { id });
      }
    }
    
    return { valid, expired, errors };
  }

  private encryptCredential(credential: Credential): EncryptedCredential {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(credential.value, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      id: credential.id,
      name: credential.name,
      type: credential.type,
      encryptedValue: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      metadata: credential.metadata,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      expiresAt: credential.expiresAt
    };
  }

  private decryptCredential(encrypted: EncryptedCredential): Credential {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encrypted.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.encryptedValue, 'base64')),
      decipher.final()
    ]);
    
    return {
      id: encrypted.id,
      name: encrypted.name,
      type: encrypted.type,
      value: decrypted.toString('utf8'),
      metadata: encrypted.metadata,
      createdAt: encrypted.createdAt,
      updatedAt: encrypted.updatedAt,
      expiresAt: encrypted.expiresAt
    };
  }

  private deriveEncryptionKey(masterKey: string): Buffer {
    // Derive a 32-byte key from the master key
    return crypto.pbkdf2Sync(masterKey, 'sessionhub-salt', 100000, 32, 'sha256');
  }

  private async loadCredentials(): Promise<void> {
    try {
      const files = await fs.readdir(this.credentialsPath);
      const credentialFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of credentialFiles) {
        try {
          const filePath = path.join(this.credentialsPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const encrypted = JSON.parse(content) as EncryptedCredential;
          this.credentials.set(encrypted.id, encrypted);
        } catch (error: any) {
          this.logger.error('Failed to load credential file', error as Error, { file });
        }
      }
    } catch (error: any) {
      if ((error).code === 'ENOENT') {
        this.logger.info('No credentials directory found, starting fresh');
      } else {
        throw error;
      }
    }
  }

  private async saveCredential(encrypted: EncryptedCredential): Promise<void> {
    const filePath = path.join(this.credentialsPath, `${encrypted.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), 'utf-8');
  }

  private generateCredentialId(): string {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export credentials (encrypted)
   */
  async exportCredentials(): Promise<string> {
    const credentials = Array.from(this.credentials.values());
    return JSON.stringify(credentials, null, 2);
  }

  /**
   * Import credentials (encrypted)
   */
  async importCredentials(encryptedData: string): Promise<void> {
    const credentials = JSON.parse(encryptedData) as EncryptedCredential[];
    
    for (const encrypted of credentials) {
      // Validate we can decrypt it
      try {
        this.decryptCredential(encrypted);
        this.credentials.set(encrypted.id, encrypted);
        await this.saveCredential(encrypted);
      } catch (error: any) {
        this.logger.error('Failed to import credential', error as Error, {
          id: encrypted.id,
          name: encrypted.name
        });
      }
    }
  }
}