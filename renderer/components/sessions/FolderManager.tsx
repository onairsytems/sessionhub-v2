import React, { useState, useEffect } from 'react';
import { SessionFolder } from '@/src/models/SearchFilter';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface FolderManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated?: (folder: SessionFolder) => void;
  onFolderUpdated?: (folder: SessionFolder) => void;
  onFolderDeleted?: (folderId: string) => void;
}

export const FolderManager: React.FC<FolderManagerProps> = ({
  isOpen,
  onClose,
  onFolderCreated,
  onFolderUpdated,
  onFolderDeleted
}) => {
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SessionFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderParent, setNewFolderParent] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');

  useEffect(() => {
    if (isOpen) {
      loadFolders();
    }
  }, [isOpen]);

  const loadFolders = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke('session:getFolders');
      setFolders(result as SessionFolder[]);
    } catch (error) {
      console.error('Failed to load folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folder = {
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        parentId: newFolderParent || undefined,
        color: newFolderColor,
        icon: newFolderIcon
      };

      const result = await window.electron.invoke('session:createFolder', folder);
      const createdFolder = result as SessionFolder;
      
      setFolders([...folders, createdFolder]);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderParent('');
      setNewFolderColor('#3B82F6');
      setNewFolderIcon('📁');
      
      onFolderCreated?.(createdFolder);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleUpdateFolder = async (folder: SessionFolder) => {
    try {
      const updates = {
        name: folder.name,
        description: folder.description,
        color: folder.color,
        icon: folder.icon
      };

      const result = await window.electron.invoke('session:updateFolder', folder.id, updates);
      const updatedFolder = result as SessionFolder;
      
      setFolders(folders.map(f => f.id === folder.id ? updatedFolder : f));
      setEditingFolder(null);
      
      onFolderUpdated?.(updatedFolder);
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert('Failed to update folder. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const hasSubfolders = folders.some(f => f.parentId === folderId);
    const confirmMessage = hasSubfolders
      ? 'This folder contains subfolders. Deleting it will also delete all subfolders and remove sessions from this folder. Are you sure?'
      : `This folder contains ${folder.sessionCount} sessions. Deleting it will remove sessions from this folder. Are you sure?`;

    if (!confirm(confirmMessage)) return;

    try {
      await window.electron.invoke('session:deleteFolder', folderId);
      setFolders(folders.filter(f => f.id !== folderId && f.parentId !== folderId));
      
      onFolderDeleted?.(folderId);
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('Failed to delete folder. Please try again.');
    }
  };

  const buildFolderTree = (parentId?: string): SessionFolder[] => {
    return folders
      .filter(f => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const renderFolderTree = (parentId?: string, level = 0): JSX.Element[] => {
    const folderNodes = buildFolderTree(parentId);
    
    return folderNodes.map(folder => (
      <div key={folder.id}>
        <div
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          style={{ marginLeft: `${level * 20}px` }}
        >
          {editingFolder?.id === folder.id ? (
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <select
                  value={editingFolder.icon}
                  onChange={(e) => setEditingFolder({ ...editingFolder, icon: e.target.value })}
                  className="w-12 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                >
                  {['📁', '📂', '🗂️', '📋', '📊', '⚙️', '🔧', '🎯', '💼', '📈'].map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editingFolder.name}
                  onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                />
                <input
                  type="color"
                  value={editingFolder.color || '#3B82F6'}
                  onChange={(e) => setEditingFolder({ ...editingFolder, color: e.target.value })}
                  className="w-8 h-8 rounded border"
                />
              </div>
              <input
                type="text"
                value={editingFolder.description || ''}
                onChange={(e) => setEditingFolder({ ...editingFolder, description: e.target.value })}
                placeholder="Description..."
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleUpdateFolder(editingFolder)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingFolder(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-3">
                <span className="text-lg">{folder.icon}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {folder.name}
                  </div>
                  {folder.description && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {folder.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {folder.sessionCount} sessions • {folder.subfolderCount} subfolders
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingFolder(folder)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
        {renderFolderTree(folder.id, level + 1)}
      </div>
    ));
  };

  const predefinedColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  const availableIcons = ['📁', '📂', '🗂️', '📋', '📊', '⚙️', '🔧', '🎯', '💼', '📈'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Manage Folders
            </h2>
            <Button variant="ghost" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Create New Folder */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Create New Folder
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Folder Name *
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Parent Folder
                  </label>
                  <select
                    value={newFolderParent}
                    onChange={(e) => setNewFolderParent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Root (No Parent)</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>
                        {folder.path.join(' / ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icon
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={newFolderIcon}
                      onChange={(e) => setNewFolderIcon(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {availableIcons.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                    <span className="text-2xl">{newFolderIcon}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={newFolderColor}
                      onChange={(e) => setNewFolderColor(e.target.value)}
                      className="w-10 h-10 rounded border border-gray-300"
                    />
                    <div className="flex space-x-2">
                      {predefinedColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewFolderColor(color)}
                          className={`w-6 h-6 rounded border-2 ${
                            newFolderColor === color ? 'border-gray-600' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="w-full"
              >
                Create Folder
              </Button>
            </div>
          </Card>

          {/* Existing Folders */}
          <Card className="p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Folder Structure ({folders.length} folders)
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : folders.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No folders created yet. Create your first folder above!
              </p>
            ) : (
              <div className="space-y-3">
                {renderFolderTree()}
              </div>
            )}
          </Card>

          {/* Folder Usage Tips */}
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Folder Organization Tips
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Use folders to group related sessions by project, client, or workflow</li>
              <li>• Create subfolders for better organization (e.g., "Client A" → "Project 1", "Project 2")</li>
              <li>• Choose meaningful colors and icons to quickly identify folder types</li>
              <li>• Sessions can be in multiple folders for flexible organization</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};