/**
 * Comprehensive help center component with search and contextual assistance
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useRouter } from 'next/router';

interface HelpTopic {
  id: string;
  title: string;
  category: string;
  content: string;
  relatedTopics?: string[];
  videoUrl?: string;
}

interface HelpSearchResult {
  file: string;
  title: string;
  snippet: string;
  line: number;
}

interface HelpCenterProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  context?: string;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({
  isOpen,
  onClose,
  initialTopic,
  context
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpSearchResult[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [commonTopics] = useState<HelpTopic[]>([
    {
      id: 'getting-started',
      title: 'Getting Started',
      category: 'Basics',
      content: 'Learn how to create your first SessionHub session...',
      relatedTopics: ['two-actor-model', 'first-session']
    },
    {
      id: 'two-actor-model',
      title: 'Two-Actor Model',
      category: 'Core Concepts',
      content: 'Understanding Planning and Execution Actors...',
      relatedTopics: ['best-practices', 'session-planning']
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      category: 'Support',
      content: 'Common issues and how to resolve them...',
      relatedTopics: ['error-codes', 'quality-gates']
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      category: 'Productivity',
      content: 'Master SessionHub with keyboard shortcuts...',
      relatedTopics: ['productivity-tips']
    }
  ]);

  // Load initial topic or context-based help
  useEffect(() => {
    if (initialTopic) {
      loadHelpTopic(initialTopic);
    } else if (context) {
      // Load contextual help based on current page/feature
      loadContextualHelp(context);
    }
  }, [initialTopic, context]);

  const loadHelpTopic = async (topicId: string) => {
    try {
      const content = await window.sessionhub.tutorials.getHelpContent(topicId);
      setSelectedTopic({
        id: topicId,
        title: topicId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: 'Help',
        content
      });
    } catch (error) {
      // Handle error
    }
  };

  const loadContextualHelp = async (ctx: string) => {
    // Map context to relevant help topics
    const contextMap: Record<string, string> = {
      'new-session': 'first-session',
      'templates': 'using-templates',
      'settings': 'configuration',
      'projects': 'project-management'
    };
    
    const topicId = contextMap[ctx] || 'getting-started';
    await loadHelpTopic(topicId);
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    try {
      const results = await window.sessionhub.tutorials.searchHelp(searchQuery);
      setSearchResults(results);
    } catch (error) {
      // Handle error
    }
  }, [searchQuery]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const openTutorial = useCallback((tutorialId: string) => {
    onClose();
    router.push(`/?tutorial=${tutorialId}`);
  }, [onClose, router]);

  const openDocumentation = useCallback((docPath: string) => {
    window.electronAPI.shell.openExternal(`https://docs.sessionhub.dev${docPath}`);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">Help Center</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 p-4 border-r dark:border-gray-700 overflow-y-auto">
            {/* Search */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Links */}
            <div className="mb-6">
              <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">Quick Links</h3>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => openTutorial('getting-started')}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    🎓 Interactive Tutorial
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openDocumentation('/user-guide')}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    📚 User Guide
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => openDocumentation('/api-reference')}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    🔧 API Reference
                  </button>
                </li>
              </ul>
            </div>

            {/* Common Topics */}
            <div>
              <h3 className="font-medium mb-2 text-gray-700 dark:text-gray-300">Common Topics</h3>
              <ul className="space-y-1">
                {commonTopics.map(topic => (
                  <li key={topic.id}>
                    <button
                      onClick={() => setSelectedTopic(topic)}
                      className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        selectedTopic?.id === topic.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                      }`}
                    >
                      {topic.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div>
                <h3 className="text-lg font-medium mb-4">Search Results</h3>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <Card key={index} className="p-4 hover:shadow-md cursor-pointer">
                      <h4 className="font-medium text-blue-600">{result.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{result.file}</p>
                      <pre className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        {result.snippet}
                      </pre>
                    </Card>
                  ))}
                </div>
              </div>
            ) : selectedTopic ? (
              <div>
                <div className="mb-4">
                  <span className="text-sm text-gray-500">{selectedTopic.category}</span>
                  <h3 className="text-2xl font-semibold mt-1">{selectedTopic.title}</h3>
                </div>

                {/* Video Tutorial */}
                {selectedTopic.videoUrl && (
                  <div className="mb-6">
                    <Card className="p-4 bg-blue-50 dark:bg-blue-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Video Tutorial Available</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Watch a walkthrough of this topic
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.electronAPI.shell.openExternal(selectedTopic.videoUrl!)}
                        >
                          Watch Video
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Content */}
                <div className="prose dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedTopic.content }} />
                </div>

                {/* Related Topics */}
                {selectedTopic.relatedTopics && (
                  <div className="mt-8 pt-6 border-t dark:border-gray-700">
                    <h4 className="font-medium mb-3">Related Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTopic.relatedTopics.map(topicId => (
                        <Button
                          key={topicId}
                          variant="outline"
                          size="sm"
                          onClick={() => loadHelpTopic(topicId)}
                        >
                          {topicId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  How can we help?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Search for a topic or browse common questions
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Can't find what you're looking for?{' '}
              <button
                onClick={() => window.electronAPI.shell.openExternal('https://github.com/sessionhub/sessionhub/issues')}
                className="text-blue-600 hover:text-blue-700"
              >
                Contact Support
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTutorial('getting-started')}
              >
                Start Tutorial
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};