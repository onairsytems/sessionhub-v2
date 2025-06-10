/**
 * MCP Integration Builder
 * 
 * Visual interface for creating MCP integrations without code
 */

import React, { useState, useCallback } from 'react';
import { MCPIntegration, MCPTool, MCPPermission, MCPIntegrationCategory } from '../../../src/services/mcp/server/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface IntegrationBuilderProps {
  onSave: (integration: MCPIntegration) => void;
  onCancel: () => void;
  existingIntegration?: MCPIntegration;
}

const CATEGORIES: { value: MCPIntegrationCategory; label: string; icon: string }[] = [
  { value: 'ai', label: 'AI & ML', icon: '🤖' },
  { value: 'analytics', label: 'Analytics', icon: '📊' },
  { value: 'automation', label: 'Automation', icon: '⚡' },
  { value: 'communication', label: 'Communication', icon: '💬' },
  { value: 'database', label: 'Database', icon: '🗄️' },
  { value: 'design', label: 'Design', icon: '🎨' },
  { value: 'development', label: 'Development', icon: '💻' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'productivity', label: 'Productivity', icon: '📈' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'storage', label: 'Storage', icon: '💾' },
  { value: 'other', label: 'Other', icon: '📦' }
];

const PERMISSIONS: { value: MCPPermission; label: string; description: string }[] = [
  { value: 'network', label: 'Network', description: 'Make HTTP requests' },
  { value: 'filesystem', label: 'File System', description: 'Read/write files' },
  { value: 'process', label: 'Process', description: 'Execute system commands' },
  { value: 'system', label: 'System', description: 'Access system information' },
  { value: 'clipboard', label: 'Clipboard', description: 'Read/write clipboard' },
  { value: 'notification', label: 'Notification', description: 'Show notifications' }
];

export const MCPIntegrationBuilder: React.FC<IntegrationBuilderProps> = ({
  onSave,
  onCancel,
  existingIntegration
}) => {
  const [integration, setIntegration] = useState<Partial<MCPIntegration>>({
    name: '',
    version: '1.0.0',
    description: '',
    author: '',
    category: 'other',
    tools: [],
    permissions: [],
    ...existingIntegration
  });

  const [currentTool, setCurrentTool] = useState<Partial<MCPTool>>({
    name: '',
    description: '',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  });

  const [showToolEditor, setShowToolEditor] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateIntegration = useCallback((updates: Partial<MCPIntegration>) => {
    setIntegration(prev => ({ ...prev, ...updates }));
  }, []);

  const addTool = useCallback(() => {
    if (!currentTool.name || !currentTool.description) {
      setErrors({
        toolName: !currentTool.name ? 'Tool name is required' : '',
        toolDescription: !currentTool.description ? 'Tool description is required' : ''
      });
      return;
    }

    const newTool: MCPTool = {
      name: currentTool.name,
      description: currentTool.description,
      inputSchema: currentTool.inputSchema || { type: 'object', properties: {} }
    };

    updateIntegration({
      tools: [...(integration.tools || []), newTool]
    });

    setCurrentTool({
      name: '',
      description: '',
      inputSchema: { type: 'object', properties: {} }
    });
    setShowToolEditor(false);
    setErrors({});
  }, [currentTool, integration.tools, updateIntegration]);

  const removeTool = useCallback((index: number) => {
    updateIntegration({
      tools: integration.tools?.filter((_, i) => i !== index)
    });
  }, [integration.tools, updateIntegration]);

  const togglePermission = useCallback((permission: MCPPermission) => {
    const currentPermissions = integration.permissions || [];
    const hasPermission = currentPermissions.includes(permission);
    
    updateIntegration({
      permissions: hasPermission
        ? currentPermissions.filter(p => p !== permission)
        : [...currentPermissions, permission]
    });
  }, [integration.permissions, updateIntegration]);

  const validateIntegration = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!integration.name) newErrors['name'] = 'Name is required';
    if (!integration.description) newErrors['description'] = 'Description is required';
    if (!integration.author) newErrors['author'] = 'Author is required';
    if (!integration.tools || integration.tools.length === 0) {
      newErrors['tools'] = 'At least one tool is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [integration]);

  const handleSave = useCallback(() => {
    if (validateIntegration()) {
      onSave(integration as MCPIntegration);
    }
  }, [integration, onSave, validateIntegration]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Create MCP Integration</h2>

      {/* Basic Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Integration Name
            </label>
            <input
              type="text"
              value={integration.name}
              onChange={(e) => updateIntegration({ name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g., My Awesome Integration"
            />
            {errors['name'] && (
              <p className="text-red-500 text-sm mt-1">{errors['name']}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={integration.description}
              onChange={(e) => updateIntegration({ description: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
              placeholder="Describe what your integration does..."
            />
            {errors['description'] && (
              <p className="text-red-500 text-sm mt-1">{errors['description']}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Author
              </label>
              <input
                type="text"
                value={integration.author}
                onChange={(e) => updateIntegration({ author: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Your name or organization"
              />
              {errors['author'] && (
                <p className="text-red-500 text-sm mt-1">{errors['author']}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Version
              </label>
              <input
                type="text"
                value={integration.version}
                onChange={(e) => updateIntegration({ version: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="1.0.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Category
            </label>
            <select
              value={integration.category}
              onChange={(e) => updateIntegration({ category: e.target.value as MCPIntegrationCategory })}
              className="w-full px-3 py-2 border rounded-md"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Tools */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Tools</h3>
          <Button onClick={() => setShowToolEditor(true)} size="sm">
            Add Tool
          </Button>
        </div>

        {errors['tools'] && (
          <p className="text-red-500 text-sm mb-4">{errors['tools']}</p>
        )}

        {integration.tools && integration.tools.length > 0 ? (
          <div className="space-y-3">
            {integration.tools.map((tool, index) => (
              <div
                key={index}
                className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{tool.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tool.description}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTool(index)}
                    className="ml-4 text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No tools added yet. Click "Add Tool" to create your first tool.
          </p>
        )}
      </Card>

      {/* Permissions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Permissions</h3>
        
        <div className="space-y-3">
          {PERMISSIONS.map(perm => (
            <label
              key={perm.value}
              className="flex items-start space-x-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={integration.permissions?.includes(perm.value) || false}
                onChange={() => togglePermission(perm.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{perm.label}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {perm.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Integration
        </Button>
      </div>

      {/* Tool Editor Modal */}
      {showToolEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Tool</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tool Name
                </label>
                <input
                  type="text"
                  value={currentTool.name}
                  onChange={(e) => setCurrentTool(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., sendMessage"
                />
                {errors['toolName'] && (
                  <p className="text-red-500 text-sm mt-1">{errors['toolName']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={currentTool.description}
                  onChange={(e) => setCurrentTool(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="What does this tool do?"
                />
                {errors['toolDescription'] && (
                  <p className="text-red-500 text-sm mt-1">{errors['toolDescription']}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowToolEditor(false);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
              <Button onClick={addTool}>
                Add Tool
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};