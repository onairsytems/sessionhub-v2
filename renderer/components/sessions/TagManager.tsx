import React, { useState, useEffect } from 'react';
import { SessionTag } from '@/src/models/SearchFilter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTagCreated?: (tag: SessionTag) => void;
  onTagUpdated?: (tag: SessionTag) => void;
  onTagDeleted?: (tagId: string) => void;
}

export const TagManager: React.FC<TagManagerProps> = ({
  isOpen,
  onClose,
  onTagCreated,
  onTagUpdated,
  onTagDeleted
}) => {
  const [tags, setTags] = useState<SessionTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<SessionTag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagDescription, setNewTagDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen]);

  const loadTags = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke('session:getTags');
      setTags(result as SessionTag[]);
    } catch (error) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const tag = {
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim() || undefined
      };

      const result = await window.electron.invoke('session:createTag', tag);
      const createdTag = result as SessionTag;
      
      setTags([...tags, createdTag]);
      setNewTagName('');
      setNewTagColor('#3B82F6');
      setNewTagDescription('');
      
      onTagCreated?.(createdTag);
    } catch (error) {
// REMOVED: console statement
      alert('Failed to create tag. Please try again.');
    }
  };

  const handleUpdateTag = async (tag: SessionTag) => {
    try {
      const updates = {
        name: tag.name,
        color: tag.color,
        description: tag.description
      };

      const result = await window.electron.invoke('session:updateTag', tag.id, updates);
      const updatedTag = result as SessionTag;
      
      setTags(tags.map(t => t.id === tag.id ? updatedTag : t));
      setEditingTag(null);
      
      onTagUpdated?.(updatedTag);
    } catch (error) {
// REMOVED: console statement
      alert('Failed to update tag. Please try again.');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag? This will remove it from all sessions.')) {
      return;
    }

    try {
      await window.electron.invoke('session:deleteTag', tagId);
      setTags(tags.filter(t => t.id !== tagId));
      
      onTagDeleted?.(tagId);
    } catch (error) {
// REMOVED: console statement
      alert('Failed to delete tag. Please try again.');
    }
  };

  const predefinedColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Manage Tags
            </h2>
            <Button variant="ghost" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Create New Tag */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Create New Tag
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tag Name *
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300"
                  />
                  <div className="flex space-x-2">
                    {predefinedColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-6 h-6 rounded border-2 ${
                          newTagColor === color ? 'border-gray-600' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTagDescription}
                  onChange={(e) => setNewTagDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="w-full"
              >
                Create Tag
              </Button>
            </div>
          </Card>

          {/* Existing Tags */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Existing Tags ({tags.length})
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : tags.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No tags created yet. Create your first tag above!
              </p>
            ) : (
              <div className="space-y-3">
                {tags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    {editingTag?.id === tag.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                        />
                        <div className="flex items-center space-x-2">
                          <input
                            type="color"
                            value={editingTag.color || '#3B82F6'}
                            onChange={(e) => setEditingTag({ ...editingTag, color: e.target.value })}
                            className="w-6 h-6 rounded border"
                          />
                          <input
                            type="text"
                            value={editingTag.description || ''}
                            onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                            placeholder="Description..."
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateTag(editingTag)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTag(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: tag.color || '#3B82F6' }}
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {tag.name}
                            </div>
                            {tag.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {tag.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              Used in {tag.sessionCount} sessions
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTag(tag)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTag(tag.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};