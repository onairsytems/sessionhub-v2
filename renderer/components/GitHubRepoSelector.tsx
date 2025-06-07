'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { GitBranch, Search, ExternalLink, Loader } from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  language: string;
  updated_at: string;
}

interface GitHubRepoSelectorProps {
  onSelect: (repo: Repository) => void;
  onClose: () => void;
}

export function GitHubRepoSelector({ onSelect, onClose }: GitHubRepoSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const searchRepositories = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // In a real implementation, this would call GitHub API
      // For now, return mock data
      const mockRepos: Repository[] = [
        {
          id: 1,
          name: 'my-project',
          full_name: 'user/my-project',
          description: 'A sample project for demonstration',
          html_url: 'https://github.com/user/my-project',
          private: false,
          default_branch: 'main',
          language: 'TypeScript',
          updated_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'another-repo',
          full_name: 'user/another-repo',
          description: 'Another repository with React code',
          html_url: 'https://github.com/user/another-repo',
          private: false,
          default_branch: 'main',
          language: 'JavaScript',
          updated_at: new Date().toISOString(),
        },
      ];

      setRepositories(mockRepos);
    } catch (err) {
      setError('Failed to search repositories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (repo: Repository) => {
    onSelect(repo);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Import GitHub Repository
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Search for a repository to import and analyze
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchRepositories()}
              placeholder="Search repositories..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={searchRepositories} disabled={isLoading || !searchQuery.trim()}>
              {isLoading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {repositories.map((repo) => (
              <button
                key={repo.id}
                onClick={() => handleSelect(repo)}
                className="w-full p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-left transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {repo.full_name}
                    </h3>
                    {repo.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{repo.language}</span>
                      <span>Branch: {repo.default_branch}</span>
                      <span>
                        Updated: {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {repositories.length === 0 && !isLoading && searchQuery && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No repositories found. Try a different search term.
            </p>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}