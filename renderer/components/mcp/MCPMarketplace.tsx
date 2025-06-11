/**
 * MCP Integration Marketplace
 * 
 * Browse and install community MCP integrations
 */
import React, { useState, useEffect } from 'react';
import { MCPIntegration } from '../../../src/services/mcp/server/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
interface MCPMarketplaceIntegration extends MCPIntegration {
  stats: {
    downloads: number;
    rating: number;
    reviews: number;
  };
  tags: string[];
}
interface MCPMarketplaceProps {
  onInstall?: (integration: MCPMarketplaceIntegration) => void;
}
export const MCPMarketplace: React.FC<MCPMarketplaceProps> = ({ onInstall }) => {
  const [integrations, setIntegrations] = useState<MCPMarketplaceIntegration[]>([]);
  const [featured, setFeatured] = useState<MCPMarketplaceIntegration[]>([]);
  const [trending, setTrending] = useState<MCPMarketplaceIntegration[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  useEffect(() => {
    void loadMarketplace();
  }, []);
  const loadMarketplace = async () => {
    try {
      setLoading(true);
      const [allIntegrations, featuredList, trendingList, categoryList] = await Promise.all([
        window.electronAPI.mcp.marketplace.search({ category: selectedCategory }),
        window.electronAPI.mcp.marketplace.getFeatured(),
        window.electronAPI.mcp.marketplace.getTrending(),
        window.electronAPI.mcp.marketplace.getCategories()
      ]);
      setIntegrations(allIntegrations as MCPMarketplaceIntegration[]);
      setFeatured(featuredList as MCPMarketplaceIntegration[]);
      setTrending(trendingList as MCPMarketplaceIntegration[]);
      setCategories(categoryList as string[]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  const handleSearch = async () => {
    try {
      setLoading(true);
      const results = await window.electronAPI.mcp.marketplace.search({
        term: searchTerm,
        category: selectedCategory === 'all' ? undefined : selectedCategory
      });
      setIntegrations(results as MCPMarketplaceIntegration[]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  const handleInstall = async (integration: MCPMarketplaceIntegration) => {
    if (!integration.id) {
      alert('Invalid integration: missing ID');
      return;
    }
    try {
      setInstalling(integration.id);
      await window.electronAPI.mcp.marketplace.install(integration.id);
      alert(`Successfully installed ${integration.name}!`);
      window.location.reload();
    } catch (error) {
      alert(`Failed to install: ${(error as Error).message}`);
    } finally {
      setInstalling(null);
    }
  };
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:ring-2 focus:ring-primary focus:border-transparent
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     focus:ring-2 focus:ring-primary focus:border-transparent
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <Button onClick={() => void handleSearch()}>Search</Button>
        </div>
      </div>
      {/* Featured Section */}
      {featured.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Featured Integrations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map(integration => (
              <Card
                key={integration.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onInstall && onInstall(integration)}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {integration.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        by {integration.author}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 
                                   text-xs font-medium rounded-full">
                      Featured
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {integration.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {integration.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        ⭐ {integration.stats.rating.toFixed(1)}
                      </span>
                      <span>{formatNumber(integration.stats.downloads)} downloads</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" onClick={() => handleInstall(integration)}>
                        Install
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Trending Section */}
      {trending.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Trending Integrations</h3>
          <div className="space-y-2">
            {trending.map(integration => (
              <Card
                key={integration.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onInstall && onInstall(integration)}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        {integration.name}
                      </h4>
                      <span className="text-sm text-gray-500">by {integration.author}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {integration.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        ⭐ {integration.stats.rating.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(integration.stats.downloads)} downloads
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" onClick={() => handleInstall(integration)}>
                        Install
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* All Integrations */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {selectedCategory === 'all' ? 'All Integrations' : `${selectedCategory} Integrations`}
        </h3>
        {integrations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No integrations found. Try a different search or category.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map(integration => (
              <Card
                key={integration.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onInstall && onInstall(integration)}
              >
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {integration.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      by {integration.author}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {integration.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {integration.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {integration.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{integration.tags.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>⭐ {integration.stats.rating.toFixed(1)}</span>
                      <span>{formatNumber(integration.stats.downloads)} downloads</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={() => handleInstall(integration)}
                        disabled={installing === integration.id}
                      >
                        {installing === integration.id ? 'Installing...' : 'Install'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export { MCPMarketplace as MCPMarketplaceUI };