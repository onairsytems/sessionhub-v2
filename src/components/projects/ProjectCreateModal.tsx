'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ProjectCreateInput, ProjectTechnology } from '@/src/types/project';
import { useProject } from '@/src/contexts/ProjectContext';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const technologies: { value: ProjectTechnology; label: string }[] = [
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'other', label: 'Other' }
];

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose }) => {
  const { createProject } = useProject();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ProjectCreateInput>({
    name: '',
    description: '',
    technology: 'react',
    framework: '',
    repository: '',
    tags: []
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof ProjectCreateInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: '' }));
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      if (!formData.tags?.includes(tag)) {
        handleInputChange('tags', [...(formData.tags || []), tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags?.filter(tag => tag !== tagToRemove) || []);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors['name'] = 'Project name is required';
    } else if (formData.name.length < 3) {
      newErrors['name'] = 'Project name must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors['description'] = 'Project description is required';
    } else if (formData.description.length < 10) {
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
      setIsCreating(true);
      await createProject(formData);
      onClose();
      // Reset form
      setFormData({
        name: '',
        description: '',
        technology: 'react',
        framework: '',
        repository: '',
        tags: []
      });
      setTagInput('');
      setErrors({});
    } catch (error) {
      setErrors({ ['submit']: error instanceof Error ? error.message : 'Failed to create project' });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Project</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              disabled={isCreating}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['name'] ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="My Awesome Project"
              disabled={isCreating}
            />
            {errors['name'] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['name']}</p>
            )}
          </div>

          {/* Project Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['description'] ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe your project..."
              disabled={isCreating}
            />
            {errors['description'] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['description']}</p>
            )}
          </div>

          {/* Technology Selection */}
          <div>
            <label htmlFor="technology" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Primary Technology *
            </label>
            <select
              id="technology"
              value={formData.technology}
              onChange={(e) => handleInputChange('technology', e.target.value as ProjectTechnology)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              disabled={isCreating}
            >
              {technologies.map(tech => (
                <option key={tech.value} value={tech.value}>
                  {tech.label}
                </option>
              ))}
            </select>
          </div>

          {/* Framework */}
          <div>
            <label htmlFor="framework" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Framework (optional)
            </label>
            <input
              type="text"
              id="framework"
              value={formData.framework || ''}
              onChange={(e) => handleInputChange('framework', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., Express, Django, Spring Boot"
              disabled={isCreating}
            />
          </div>

          {/* Repository URL */}
          <div>
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Repository URL (optional)
            </label>
            <input
              type="url"
              id="repository"
              value={formData.repository || ''}
              onChange={(e) => handleInputChange('repository', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="https://github.com/username/repo"
              disabled={isCreating}
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
              disabled={isCreating}
            />
            {formData.tags && formData.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                      disabled={isCreating}
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
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};