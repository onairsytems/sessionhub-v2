'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Code, Rocket, Search, Terminal, Zap, HelpCircle, ExternalLink } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export default function DocsPage() {
  const [selectedSection, setSelectedSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const docSections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: Rocket,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Welcome to SessionHub</h3>
          <p className="text-muted-foreground">
            SessionHub is your intelligent development session manager powered by Claude AI.
            Get started with these simple steps:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Configure your API keys in Settings</li>
            <li>Create your first project or import existing ones</li>
            <li>Start a new session with clear objectives</li>
            <li>Let Claude help plan and execute your tasks</li>
            <li>Review and commit your changes</li>
          </ol>
          <div className="mt-6 p-4 bg-secondary rounded-lg">
            <p className="text-sm">
              <strong>Pro tip:</strong> Use keyboard shortcuts (⌘K) to quickly navigate between features.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'sessions',
      title: 'Working with Sessions',
      icon: Terminal,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Session Workflow</h3>
          <p className="text-muted-foreground">
            Sessions are the core of SessionHub. Each session represents a focused work period with clear objectives.
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Planning Phase</h4>
              <p className="text-sm text-muted-foreground">
                Define your objectives and let Claude analyze your codebase to create an execution plan.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Execution Phase</h4>
              <p className="text-sm text-muted-foreground">
                Claude implements the plan while you monitor progress and provide guidance.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Review Phase</h4>
              <p className="text-sm text-muted-foreground">
                Review changes, run tests, and commit your work with confidence.
              </p>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Session Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Save time with pre-configured session templates for common tasks like bug fixes,
                feature development, refactoring, and documentation updates.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      id: 'mcp-integration',
      title: 'MCP Integration',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Model Context Protocol</h3>
          <p className="text-muted-foreground">
            Extend Claude's capabilities with MCP servers for specialized tools and integrations.
          </p>
          
          <div className="grid gap-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Available MCP Servers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>File System</strong>: Advanced file operations</li>
                  <li>• <strong>Git</strong>: Version control integration</li>
                  <li>• <strong>Database</strong>: Query and manage databases</li>
                  <li>• <strong>API Testing</strong>: HTTP request tools</li>
                  <li>• <strong>Custom Tools</strong>: Build your own MCP servers</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Creating Custom MCP Servers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Build custom tools that integrate seamlessly with Claude:
                </p>
                <pre className="text-xs bg-muted p-2 rounded">
{`// Example MCP server
export const server = {
  name: 'my-tool',
  methods: {
    doSomething: async (params) => {
      // Your custom logic
    }
  }
}`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      icon: Code,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <p className="text-muted-foreground">
            Master these shortcuts to navigate SessionHub like a pro:
          </p>
          
          <div className="grid gap-2 mt-4">
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">Quick command palette</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘K</kbd>
            </div>
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">New session</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘N</kbd>
            </div>
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">Switch project</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘P</kbd>
            </div>
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">Toggle theme</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘⇧T</kbd>
            </div>
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">Search documentation</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘/</kbd>
            </div>
            <div className="flex justify-between p-2 rounded bg-secondary">
              <span className="text-sm">Settings</span>
              <kbd className="text-xs px-2 py-1 rounded bg-background">⌘,</kbd>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            Customize shortcuts in Settings → Keyboard Shortcuts
          </p>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: HelpCircle,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Common Issues</h3>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Claude API Connection Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  If Claude isn't responding:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Check your API key in Settings</li>
                  <li>Verify your internet connection</li>
                  <li>Check the Claude API status page</li>
                  <li>Try regenerating your API key</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Session Not Progressing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  If a session seems stuck:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Check the activity log for errors</li>
                  <li>Ensure file permissions are correct</li>
                  <li>Try pausing and resuming the session</li>
                  <li>Review the execution plan for issues</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Performance Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  For optimal performance:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>Close unnecessary applications</li>
                  <li>Limit concurrent sessions</li>
                  <li>Clear the cache in Settings</li>
                  <li>Update to the latest version</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = docSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ((section.content as React.ReactElement).props.children?.toString() || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentSection = filteredSections.find(s => s.id === selectedSection) || filteredSections[0];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about using SessionHub effectively
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
              />
            </div>
            
            <nav className="space-y-1">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t">
              <a
                href="https://github.com/sessionhub/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentSection && <currentSection.icon className="w-5 h-5" />}
                {currentSection?.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentSection?.content}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}