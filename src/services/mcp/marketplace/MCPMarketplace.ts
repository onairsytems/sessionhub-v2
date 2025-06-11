/**
 * MCP Marketplace Service
 * 
 * Foundations for an MCP integration marketplace
 */
import { EventEmitter } from 'events';
import { 
  MCPIntegrationManifest
} from '../server/types';
export type { MCPIntegrationCategory } from '../server/types';
import type { MCPIntegrationCategory } from '../server/types';
export interface MarketplaceIntegration {
  id: string;
  manifest: MCPIntegrationManifest;
  publishedAt: Date;
  updatedAt: Date;
  publisher: MarketplacePublisher;
  stats: IntegrationStats;
  verified: boolean;
}
export interface MarketplacePublisher {
  id: string;
  name: string;
  email: string;
  website?: string;
  verified: boolean;
}
export interface IntegrationStats {
  downloads: number;
  stars: number;
  rating: number;
  reviews: number;
  weeklyDownloads: number;
  monthlyDownloads: number;
}
export interface MarketplaceSearchOptions {
  query?: string;
  category?: MCPIntegrationCategory;
  author?: string;
  tags?: string[];
  minRating?: number;
  verified?: boolean;
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
  limit?: number;
  offset?: number;
}
export interface MarketplaceReview {
  id: string;
  integrationId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  helpful: number;
  verified: boolean;
}
export class MCPMarketplace extends EventEmitter {
  private integrations: Map<string, MarketplaceIntegration>;
  private publishers: Map<string, MarketplacePublisher>;
  private reviews: Map<string, MarketplaceReview[]>;
  // private apiUrl: string; // Unused for now
  constructor(_apiUrl?: string) {
    super();
    this.integrations = new Map();
    this.publishers = new Map();
    this.reviews = new Map();
    // this.apiUrl = apiUrl || 'https://mcp.sessionhub.com/api/v1'; // Unused for now
    this.loadFeaturedIntegrations();
  }
  private async loadFeaturedIntegrations(): Promise<void> {
    // In production, this would fetch from the API
    // For now, we'll create some mock featured integrations
    const featured: MarketplaceIntegration[] = [
      {
        id: 'github-official',
        manifest: {
          integration: {
            name: 'GitHub Official',
            version: '2.0.0',
            description: 'Official GitHub integration with full API support',
            author: 'GitHub',
            category: 'development',
            icon: '🐙',
            tools: [],
            permissions: ['network']
          },
          installation: {
            files: [],
            dependencies: ['@octokit/rest']
          },
          marketplace: {
            featured: true,
            downloads: 150000,
            rating: 4.8,
            reviews: 3421,
            tags: ['github', 'git', 'version-control', 'official'],
            pricing: { type: 'free' }
          }
        },
        publishedAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-12-01'),
        publisher: {
          id: 'github',
          name: 'GitHub, Inc.',
          email: 'support@github.com',
          website: 'https://github.com',
          verified: true
        },
        stats: {
          downloads: 150000,
          stars: 4500,
          rating: 4.8,
          reviews: 3421,
          weeklyDownloads: 5000,
          monthlyDownloads: 20000
        },
        verified: true
      },
      {
        id: 'openai-advanced',
        manifest: {
          integration: {
            name: 'OpenAI Advanced',
            version: '3.5.0',
            description: 'Advanced OpenAI integration with GPT-4, DALL-E, and Whisper',
            author: 'AI Tools Inc.',
            category: 'ai',
            icon: '🤖',
            tools: [],
            permissions: ['network']
          },
          installation: {
            files: [],
            dependencies: ['openai']
          },
          marketplace: {
            featured: true,
            downloads: 85000,
            rating: 4.9,
            reviews: 2156,
            tags: ['openai', 'gpt-4', 'ai', 'dalle', 'whisper'],
            pricing: {
              type: 'freemium',
              features: ['Basic GPT-3.5 access free', 'GPT-4 requires premium']
            }
          }
        },
        publishedAt: new Date('2024-02-20'),
        updatedAt: new Date('2024-11-15'),
        publisher: {
          id: 'ai-tools',
          name: 'AI Tools Inc.',
          email: 'support@aitools.dev',
          website: 'https://aitools.dev',
          verified: true
        },
        stats: {
          downloads: 85000,
          stars: 3200,
          rating: 4.9,
          reviews: 2156,
          weeklyDownloads: 3500,
          monthlyDownloads: 14000
        },
        verified: true
      }
    ];
    featured.forEach(integration => {
      this.integrations.set(integration.id, integration);
      this.publishers.set(integration.publisher.id, integration.publisher);
    });
  }
  async searchIntegrations(
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceIntegration[]> {
    let results = Array.from(this.integrations.values());
    // Filter by query
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(integration => 
        integration.manifest.integration.name.toLowerCase().includes(query) ||
        integration.manifest.integration.description.toLowerCase().includes(query) ||
        integration.manifest.marketplace?.tags?.some(tag => 
          tag.toLowerCase().includes(query)
        )
      );
    }
    // Filter by category
    if (options.category) {
      results = results.filter(i => 
        i.manifest.integration.category === options.category
      );
    }
    // Filter by author
    if (options.author) {
      results = results.filter(i =>
        i.manifest.integration.author.toLowerCase().includes(options.author!.toLowerCase())
      );
    }
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(i =>
        options.tags!.some(tag =>
          i.manifest.marketplace?.tags?.includes(tag)
        )
      );
    }
    // Filter by rating
    if (options.minRating) {
      results = results.filter(i => i.stats.rating >= options.minRating!);
    }
    // Filter by verified status
    if (options.verified !== undefined) {
      results = results.filter(i => i.verified === options.verified);
    }
    // Sort results
    results.sort((a, b) => {
      switch (options.sortBy) {
        case 'downloads':
          return b.stats.downloads - a.stats.downloads;
        case 'rating':
          return b.stats.rating - a.stats.rating;
        case 'updated':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'name':
          return a.manifest.integration.name.localeCompare(b.manifest.integration.name);
        default:
          return b.stats.downloads - a.stats.downloads;
      }
    });
    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    return results.slice(offset, offset + limit);
  }
  async getIntegration(id: string): Promise<MarketplaceIntegration | null> {
    return this.integrations.get(id) || null;
  }
  async getFeaturedIntegrations(): Promise<MarketplaceIntegration[]> {
    const featured = Array.from(this.integrations.values()).filter(
      i => i.manifest.marketplace?.featured
    );
    return featured.sort((a, b) => b.stats.downloads - a.stats.downloads);
  }
  async getTrendingIntegrations(): Promise<MarketplaceIntegration[]> {
    // Calculate trending based on recent downloads growth
    const all = Array.from(this.integrations.values());
    return all
      .sort((a, b) => {
        const aGrowth = a.stats.weeklyDownloads / (a.stats.monthlyDownloads / 4);
        const bGrowth = b.stats.weeklyDownloads / (b.stats.monthlyDownloads / 4);
        return bGrowth - aGrowth;
      })
      .slice(0, 10);
  }
  async getIntegrationsByCategory(
    category: MCPIntegrationCategory
  ): Promise<MarketplaceIntegration[]> {
    return this.searchIntegrations({ category });
  }
  async getPublisher(id: string): Promise<MarketplacePublisher | null> {
    return this.publishers.get(id) || null;
  }
  async getReviews(integrationId: string): Promise<MarketplaceReview[]> {
    return this.reviews.get(integrationId) || [];
  }
  async submitReview(
    integrationId: string,
    review: Omit<MarketplaceReview, 'id' | 'createdAt'>
  ): Promise<MarketplaceReview> {
    const newReview: MarketplaceReview = {
      ...review,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    const reviews = this.reviews.get(integrationId) || [];
    reviews.push(newReview);
    this.reviews.set(integrationId, reviews);
    // Update integration stats
    const integration = this.integrations.get(integrationId);
    if (integration) {
      const allReviews = reviews;
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      integration.stats.rating = totalRating / allReviews.length;
      integration.stats.reviews = allReviews.length;
    }
    this.emit('review:submitted', newReview);
    return newReview;
  }
  async installIntegration(
    integrationId: string,
    _targetPath: string
  ): Promise<void> {
    const integration = await this.getIntegration(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }
    // Update download stats
    integration.stats.downloads++;
    integration.stats.weeklyDownloads++;
    integration.stats.monthlyDownloads++;
    this.emit('integration:installed', integration);
    // In production, this would download and install files
  }
  async publishIntegration(
    manifest: MCPIntegrationManifest,
    publisher: MarketplacePublisher
  ): Promise<string> {
    // Validate the integration
    if (!manifest.integration.name || !manifest.integration.version) {
      throw new Error('Invalid integration manifest');
    }
    // Generate ID
    const id = `${publisher.id}-${manifest.integration.name.toLowerCase().replace(/\s+/g, '-')}`;
    // Create marketplace integration
    const marketplaceIntegration: MarketplaceIntegration = {
      id,
      manifest,
      publishedAt: new Date(),
      updatedAt: new Date(),
      publisher,
      stats: {
        downloads: 0,
        stars: 0,
        rating: 0,
        reviews: 0,
        weeklyDownloads: 0,
        monthlyDownloads: 0
      },
      verified: false
    };
    this.integrations.set(id, marketplaceIntegration);
    this.publishers.set(publisher.id, publisher);
    this.emit('integration:published', marketplaceIntegration);
    return id;
  }
  async updateIntegration(
    id: string,
    manifest: MCPIntegrationManifest
  ): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }
    integration.manifest = manifest;
    integration.updatedAt = new Date();
    this.emit('integration:updated', integration);
  }
  async unpublishIntegration(id: string): Promise<void> {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error(`Integration not found: ${id}`);
    }
    this.integrations.delete(id);
    this.emit('integration:unpublished', integration);
  }
  getCategories(): Array<{ value: MCPIntegrationCategory; label: string; count: number }> {
    const categories = new Map<MCPIntegrationCategory, number>();
    this.integrations.forEach(integration => {
      const category = integration.manifest.integration.category;
      categories.set(category, (categories.get(category) || 0) + 1);
    });
    return [
      { value: 'ai', label: 'AI & ML', count: categories.get('ai') || 0 },
      { value: 'analytics', label: 'Analytics', count: categories.get('analytics') || 0 },
      { value: 'automation', label: 'Automation', count: categories.get('automation') || 0 },
      { value: 'communication', label: 'Communication', count: categories.get('communication') || 0 },
      { value: 'database', label: 'Database', count: categories.get('database') || 0 },
      { value: 'design', label: 'Design', count: categories.get('design') || 0 },
      { value: 'development', label: 'Development', count: categories.get('development') || 0 },
      { value: 'finance', label: 'Finance', count: categories.get('finance') || 0 },
      { value: 'productivity', label: 'Productivity', count: categories.get('productivity') || 0 },
      { value: 'security', label: 'Security', count: categories.get('security') || 0 },
      { value: 'storage', label: 'Storage', count: categories.get('storage') || 0 },
      { value: 'other', label: 'Other', count: categories.get('other') || 0 }
    ];
  }
}