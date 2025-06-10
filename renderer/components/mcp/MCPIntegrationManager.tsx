/**
 * MCP Integration Manager
 * 
 * Main interface for managing MCP integrations
 */

import React, { useState, useEffect } from 'react';
import { MCPIntegration } from '../../../src/services/mcp/server/types';
import { MCPIntegrationBuilder } from './MCPIntegrationBuilder';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export const MCPIntegrationManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<MCPIntegration[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<MCPIntegration | undefined>();
  const [serverStatus, setServerStatus] = useState<'running' | 'stopped' | 'error'>('stopped');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Load integrations
  useEffect(() => {
    loadIntegrations();
    checkServerStatus();
  }, []);

  const loadIntegrations = async () => {
    try {
      const result = await window.electronAPI.mcp.listIntegrations();
      setIntegrations(result);
    } catch (error) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const checkServerStatus = async () => {
    try {
      const status = await window.electronAPI.mcp.getServerStatus();
      setServerStatus(status.running ? 'running' : 'stopped');
    } catch (error) {
      setServerStatus('error');
    }
  };

  const handleStartServer = async () => {
    try {
      await window.electronAPI.mcp.startServer();
      setServerStatus('running');
      await loadIntegrations();
    } catch (error) {
// REMOVED: console statement
      setServerStatus('error');
    }
  };

  const handleStopServer = async () => {
    try {
      await window.electronAPI.mcp.stopServer();
      setServerStatus('stopped');
    } catch (error) {
// REMOVED: console statement
    }
  };

  const handleSaveIntegration = async (integration: MCPIntegration) => {
    try {
      await window.electronAPI.mcp.registerIntegration(integration);
      await loadIntegrations();
      setShowBuilder(false);
      setEditingIntegration(undefined);
    } catch (error) {
// REMOVED: console statement
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) {
      return;
    }

    try {
      await window.electronAPI.mcp.unregisterIntegration(id);
      await loadIntegrations();
    } catch (error) {
// REMOVED: console statement
    }
  };

  const handleTestIntegration = async (integration: MCPIntegration) => {
    try {
      // Test the first tool of the integration
      if (integration.tools.length > 0) {
        const tool = integration.tools[0];
        if (tool) {
          const result = await window.electronAPI.mcp.testTool(
            integration.id!,
            tool.name,
            {}
          );
          
          alert(`Test successful!\n\nResult: ${JSON.stringify(result, null, 2)}`);
        }
      }
    } catch (error) {
      alert(`Test failed: ${(error as Error).message}`);
    }
  };

  const filteredIntegrations = integrations.filter(integration =>
    integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    integration.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categorizedIntegrations = filteredIntegrations.reduce((acc, integration) => {
    const category = integration.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(integration);
    return acc;
  }, {} as Record<string, MCPIntegration[]>);

  if (showBuilder) {
    return (
      <MCPIntegrationBuilder
        onSave={handleSaveIntegration}
        onCancel={() => {
          setShowBuilder(false);
          setEditingIntegration(undefined);
        }}
        existingIntegration={editingIntegration}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MCP Integrations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage and create Model Context Protocol integrations
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Server Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              serverStatus === 'running' ? 'bg-green-500' :
              serverStatus === 'stopped' ? 'bg-gray-400' :
              'bg-red-500'
            }`} />
            <span className="text-sm font-medium">
              Server {serverStatus}
            </span>
          </div>
          
          {serverStatus === 'stopped' ? (
            <Button onClick={handleStartServer} size="sm">
              Start Server
            </Button>
          ) : serverStatus === 'running' ? (
            <Button onClick={handleStopServer} size="sm" variant="secondary">
              Stop Server
            </Button>
          ) : null}
          
          <Button onClick={() => setShowBuilder(true)}>
            Create Integration
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search integrations..."
          className="w-full px-4 py-2 pl-10 border rounded-lg"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Integrations */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span>Loading integrations...</span>
          </div>
        </div>
      ) : Object.keys(categorizedIntegrations).length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-medium mb-2">No integrations found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'Try a different search term' : 'Get started by creating your first integration'}
          </p>
          {!searchTerm && (
            <Button onClick={() => setShowBuilder(true)}>
              Create Your First Integration
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(categorizedIntegrations).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold mb-4 capitalize">
                {category.replace('_', ' ')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((integration) => (
                  <Card
                    key={integration.id}
                    className="p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {integration.icon && (
                          <span className="text-2xl">{integration.icon}</span>
                        )}
                        <div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-sm text-gray-500">v{integration.version}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteIntegration(integration.id!)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {integration.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span>{integration.tools.length} tools</span>
                        <span>•</span>
                        <span>by {integration.author}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleTestIntegration(integration)}
                          className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => {
                            setEditingIntegration(integration);
                            setShowBuilder(true);
                          }}
                          className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    
                    {/* Permissions */}
                    {integration.permissions.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-1">
                          {integration.permissions.map(perm => (
                            <span
                              key={perm}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}