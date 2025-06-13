'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project, ProjectUpdateInput, ProjectStatus } from '@/src/types/project';
import { useProject } from '@/src/contexts/ProjectContext';

interface ProjectEditModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

export const ProjectEditModal: React.FC<ProjectEditModalProps> = ({ project, isOpen, onClose }) => {
  const { updateProject } = useProject();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState<ProjectUpdateInput>({
    name: project.name,
    description: project.description,
    status: project.status,
    metadata: {
      framework: project.metadata.framework,
      repository: project.metadata.repository,
      tags: project.metadata.tags || []
    }
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: project.name,
        description: project.description,
        status: project.status,
        metadata: {
          framework: project.metadata.framework,
          repository: project.metadata.repository,
          tags: project.metadata.tags || []
        }
      });
      setTagInput('');
      setErrors({});
    }
  }, [isOpen, project]);

  const handleInputChange = (field: keyof ProjectUpdateInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  };

  const handleMetadataChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value
      }
    }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      const currentTags = formData.metadata?.tags || [];
      if (!currentTags.includes(tag)) {
        handleMetadataChange('tags', [...currentTags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = formData.metadata?.tags || [];
    handleMetadataChange('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name && formData.name.trim().length < 3) {
      newErrors['name'] = 'Project name must be at least 3 characters';
    }

    if (formData.description && formData.description.trim().length < 10) {
      newErrors['description'] = 'Project description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setIsUpdating(true);
      
      // Only send changed fields
      const updates: ProjectUpdateInput = {};
      if (formData.name !== project.name) updates.name = formData.name;
      if (formData.description !== project.description) updates.description = formData.description;
      if (formData.status !== project.status) updates.status = formData.status;
      
      // Check metadata changes
      const metadataUpdates: any = {};
      if (formData.metadata?.framework !== project.metadata.framework) {
        metadataUpdates.framework = formData.metadata?.framework;
      }
      if (formData.metadata?.repository !== project.metadata.repository) {
        metadataUpdates.repository = formData.metadata?.repository;
      }
      if (JSON.stringify(formData.metadata?.tags) !== JSON.stringify(project.metadata.tags)) {
        metadataUpdates.tags = formData.metadata?.tags;
      }
      
      if (Object.keys(metadataUpdates).length > 0) {
        updates.metadata = metadataUpdates;
      }

      if (Object.keys(updates).length > 0) {
        await updateProject(project.id, updates);
      }
      
      onClose();
    } catch (error) {
      setErrors({ ['submit']: error instanceof Error ? error.message : 'Failed to update project' });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Project</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              disabled={isUpdating}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['name'] ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isUpdating}
            />
            {errors['name'] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['name']}</p>
            )}
          </div>

          {/* Project Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['description'] ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isUpdating}
            />
            {errors['description'] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['description']}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              id="status"
              value={formData.status || project.status}
              onChange={(e) => handleInputChange('status', e.target.value as ProjectStatus)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isUpdating}
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Framework */}
          <div>
            <label htmlFor="framework" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Framework
            </label>
            <input
              type="text"
              id="framework"
              value={formData.metadata?.framework || ''}
              onChange={(e) => handleMetadataChange('framework', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., Express, Django, Spring Boot"
              disabled={isUpdating}
            />
          </div>

          {/* Repository URL */}
          <div>
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository URL
            </label>
            <input
              type="url"
              id="repository"
              value={formData.metadata?.repository || ''}
              onChange={(e) => handleMetadataChange('repository', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="https://github.com/username/repo"
              disabled={isUpdating}
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tags (press Enter to add)
            </label>
            <input
              type="text"
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Add tags..."
              disabled={isUpdating}
            />
            {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.metadata.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                      disabled={isUpdating}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errors['submit'] && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors['submit']}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUpdating ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};