/**
 * MCP Integration Registry
 * 
 * Manages all registered MCP integrations, handles lifecycle,
 * and provides discovery mechanisms.
 */

import { EventEmitter } from 'events';
import { MCPIntegration, MCPIntegrationManifest } from './types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export class MCPIntegrationRegistry extends EventEmitter {
  private integrations: Map<string, MCPIntegration>;
  private manifests: Map<string, MCPIntegrationManifest>;
  private storagePath: string;

  constructor(storagePath?: string) {
    super();
    this.integrations = new Map();
    this.manifests = new Map();
    this.storagePath = storagePath || path.join(
      process.env['HOME'] || '',
      '.sessionhub',
      'mcp',
      'integrations'
    );
    
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this.loadIntegrations();
    } catch (error) {
// REMOVED: console statement
    }
  }

  private async loadIntegrations(): Promise<void> {
    try {
      const files = await fs.readdir(this.storagePath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.storagePath, file),
            'utf-8'
          );
          
          const manifest: MCPIntegrationManifest = JSON.parse(content);
          const integration = manifest.integration;
          
          if (integration.id) {
            this.integrations.set(integration.id, integration);
            this.manifests.set(integration.id, manifest);
          }
        }
      }
      
// REMOVED: console statement
    } catch (error) {
// REMOVED: console statement
    }
  }

  async registerIntegration(integration: MCPIntegration): Promise<string> {
    // Generate ID if not provided
    if (!integration.id) {
      integration.id = uuidv4();
    }

    // Check for duplicate names
    const existing = Array.from(this.integrations.values()).find(
      i => i.name === integration.name && i.id !== integration.id
    );
    
    if (existing) {
      throw new Error(`Integration with name "${integration.name}" already exists`);
    }

    // Store integration
    this.integrations.set(integration.id, integration);
    
    // Create manifest
    const manifest: MCPIntegrationManifest = {
      integration,
      installation: {
        files: [],
        dependencies: []
      }
    };
    
    this.manifests.set(integration.id, manifest);
    
    // Persist to disk
    await this.saveIntegration(integration.id, manifest);
    
    // Emit event
    this.emit('integration:registered', integration);
    
// REMOVED: console statement
    
    return integration.id;
  }

  async unregisterIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // Remove from memory
    this.integrations.delete(id);
    this.manifests.delete(id);
    
    // Remove from disk
    try {
      await fs.unlink(path.join(this.storagePath, `${id}.json`));
    } catch (error) {
// REMOVED: console statement
    }
    
    // Emit event
    this.emit('integration:unregistered', integration);
    
// REMOVED: console statement
  }

  async getIntegration(id: string): Promise<MCPIntegration | undefined> {
    return this.integrations.get(id);
  }

  async getManifest(id: string): Promise<MCPIntegrationManifest | undefined> {
    return this.manifests.get(id);
  }

  async listIntegrations(): Promise<MCPIntegration[]> {
    return Array.from(this.integrations.values());
  }

  async searchIntegrations(query: {
    name?: string;
    category?: string;
    author?: string;
    tags?: string[];
  }): Promise<MCPIntegration[]> {
    let results = Array.from(this.integrations.values());
    
    if (query.name) {
      const searchTerm = query.name.toLowerCase();
      results = results.filter(i => 
        i.name.toLowerCase().includes(searchTerm) ||
        i.description.toLowerCase().includes(searchTerm)
      );
    }
    
    if (query.category) {
      results = results.filter(i => i.category === query.category);
    }
    
    if (query.author) {
      results = results.filter(i => 
        i.author.toLowerCase().includes(query.author!.toLowerCase())
      );
    }
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter(i => {
        const manifest = this.manifests.get(i.id!);
        if (!manifest?.marketplace?.tags) return false;
        
        return query.tags!.some(tag => 
          manifest.marketplace!.tags!.includes(tag)
        );
      });
    }
    
    return results;
  }

  getIntegrationCount(): number {
    return this.integrations.size;
  }

  async updateIntegration(id: string, updates: Partial<MCPIntegration>): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // Update integration
    const updated = { ...integration, ...updates, id };
    this.integrations.set(id, updated);
    
    // Update manifest
    const manifest = this.manifests.get(id);
    if (manifest) {
      manifest.integration = updated;
      this.manifests.set(id, manifest);
      await this.saveIntegration(id, manifest);
    }
    
    // Emit event
    this.emit('integration:updated', updated);
  }

  async enableIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // Emit event
    this.emit('integration:enabled', integration);
  }

  async disableIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }

    // Emit event
    this.emit('integration:disabled', integration);
  }

  private async saveIntegration(id: string, manifest: MCPIntegrationManifest): Promise<void> {
    const filePath = path.join(this.storagePath, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
  }

  // Core integrations that come pre-installed
  async registerCoreIntegrations(): Promise<void> {
    const coreIntegrations: MCPIntegration[] = [
      {
        name: 'GitHub',
        version: '1.0.0',
        description: 'GitHub integration for repositories, issues, and pull requests',
        author: 'SessionHub',
        category: 'development',
        icon: '🐙',
        tools: [
          {
            name: 'listRepositories',
            description: 'List user repositories',
            inputSchema: {
              type: 'object',
              properties: {
                page: { type: 'number', description: 'Page number' },
                perPage: { type: 'number', description: 'Items per page' }
              }
            }
          },
          {
            name: 'createIssue',
            description: 'Create a new issue',
            inputSchema: {
              type: 'object',
              properties: {
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue body' }
              },
              required: ['repo', 'title']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Linear',
        version: '1.0.0',
        description: 'Linear integration for project management',
        author: 'SessionHub',
        category: 'productivity',
        icon: '📊',
        tools: [
          {
            name: 'listIssues',
            description: 'List Linear issues',
            inputSchema: {
              type: 'object',
              properties: {
                teamId: { type: 'string', description: 'Team ID' },
                filter: { type: 'string', description: 'Filter query' }
              }
            }
          },
          {
            name: 'createIssue',
            description: 'Create a new Linear issue',
            inputSchema: {
              type: 'object',
              properties: {
                teamId: { type: 'string', description: 'Team ID' },
                title: { type: 'string', description: 'Issue title' },
                description: { type: 'string', description: 'Issue description' }
              },
              required: ['teamId', 'title']
            }
          }
        ],
        permissions: ['network']
      },
      {
        name: 'Figma',
        version: '1.0.0',
        description: 'Figma integration for design files and components',
        author: 'SessionHub',
        category: 'design',
        icon: '🎨',
        tools: [
          {
            name: 'getFile',
            description: 'Get Figma file data',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string', description: 'Figma file key' }
              },
              required: ['fileKey']
            }
          },
          {
            name: 'exportComponents',
            description: 'Export Figma components',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string', description: 'Figma file key' },
                format: { type: 'string', enum: ['svg', 'png', 'jpg'], description: 'Export format' }
              },
              required: ['fileKey', 'format']
            }
          }
        ],
        permissions: ['network']
      }
    ];

    for (const integration of coreIntegrations) {
      try {
        await this.registerIntegration(integration);
      } catch (error) {
// REMOVED: console statement
      }
    }
  }
}