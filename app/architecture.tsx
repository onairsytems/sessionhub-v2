'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileText, GitBranch, Layers, Package, Settings, Shield, Activity, Server } from 'lucide-react';

export default function ArchitecturePage() {
  const [selectedView, setSelectedView] = useState<'overview' | 'components' | 'data-flow' | 'security'>('overview');

  const architectureComponents = [
    {
      name: 'Electron Main Process',
      description: 'Handles system integration, file access, and IPC communication',
      icon: Server,
      technologies: ['TypeScript', 'Electron', 'Node.js']
    },
    {
      name: 'React Renderer',
      description: 'Modern UI built with Next.js and React for responsive interfaces',
      icon: Layers,
      technologies: ['React 18', 'Next.js 13', 'Tailwind CSS']
    },
    {
      name: 'Supabase Backend',
      description: 'Cloud storage for sessions, settings, and collaborative features',
      icon: Package,
      technologies: ['PostgreSQL', 'Real-time', 'Auth']
    },
    {
      name: 'Claude Integration',
      description: 'AI-powered session planning and execution assistance',
      icon: Activity,
      technologies: ['Claude API', 'MCP Protocol', 'Auto-accept']
    }
  ];

  const securityFeatures = [
    'End-to-end encryption for sensitive data',
    'Secure API key storage in system keychain',
    'Sandboxed execution environment',
    'Role-based access control',
    'Audit logging for all actions',
    'Regular security updates'
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">System Architecture</h1>
        <p className="text-muted-foreground">
          Explore SessionHub's technical architecture and design decisions
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={selectedView === 'overview' ? 'primary' : 'ghost'}
          onClick={() => setSelectedView('overview')}
        >
          <FileText className="w-4 h-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={selectedView === 'components' ? 'primary' : 'ghost'}
          onClick={() => setSelectedView('components')}
        >
          <Layers className="w-4 h-4 mr-2" />
          Components
        </Button>
        <Button
          variant={selectedView === 'data-flow' ? 'primary' : 'ghost'}
          onClick={() => setSelectedView('data-flow')}
        >
          <GitBranch className="w-4 h-4 mr-2" />
          Data Flow
        </Button>
        <Button
          variant={selectedView === 'security' ? 'primary' : 'ghost'}
          onClick={() => setSelectedView('security')}
        >
          <Shield className="w-4 h-4 mr-2" />
          Security
        </Button>
      </div>

      {selectedView === 'overview' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Architecture Overview</CardTitle>
              <CardDescription>
                SessionHub is built on a modern, scalable architecture designed for reliability and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <h3>Key Principles</h3>
                <ul>
                  <li><strong>Separation of Concerns</strong>: Clear boundaries between UI, business logic, and data layers</li>
                  <li><strong>Type Safety</strong>: Full TypeScript coverage with strict type checking</li>
                  <li><strong>Performance First</strong>: Optimized for M4 Pro and Apple Silicon</li>
                  <li><strong>Security by Design</strong>: Built-in security measures at every layer</li>
                  <li><strong>Extensibility</strong>: Plugin architecture for MCP servers and custom tools</li>
                </ul>
                
                <h3>Technology Stack</h3>
                <ul>
                  <li><strong>Frontend</strong>: React 18, Next.js 13, Tailwind CSS</li>
                  <li><strong>Desktop</strong>: Electron with TypeScript</li>
                  <li><strong>Backend</strong>: Supabase (PostgreSQL, Real-time, Auth)</li>
                  <li><strong>AI Integration</strong>: Claude API with MCP protocol</li>
                  <li><strong>Build Tools</strong>: Vite, ESBuild, Electron Builder</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'components' && (
        <div className="grid gap-4 md:grid-cols-2">
          {architectureComponents.map((component) => {
            const Icon = component.icon;
            return (
              <Card key={component.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    {component.name}
                  </CardTitle>
                  <CardDescription>{component.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {component.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedView === 'data-flow' && (
        <Card>
          <CardHeader>
            <CardTitle>Data Flow Architecture</CardTitle>
            <CardDescription>
              Understanding how data moves through SessionHub
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Session Lifecycle</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>User initiates session from UI or command line</li>
                  <li>Planning actor analyzes requirements and creates execution plan</li>
                  <li>Execution actor implements the plan with real-time progress updates</li>
                  <li>Results are validated and stored in Supabase</li>
                  <li>Session artifacts are synced across devices</li>
                </ol>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">IPC Communication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Secure inter-process communication between Electron main and renderer:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Typed IPC handlers for all operations</li>
                  <li>Automatic error handling and recovery</li>
                  <li>Progress streaming for long-running operations</li>
                  <li>Context isolation for security</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">State Management</h3>
                <p className="text-sm text-muted-foreground">
                  Local-first architecture with cloud sync:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>React Context for UI state</li>
                  <li>SQLite for local session storage</li>
                  <li>Supabase for cloud backup and sync</li>
                  <li>Optimistic updates with conflict resolution</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedView === 'security' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Architecture</CardTitle>
              <CardDescription>
                Built with security as a core principle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {securityFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Security</CardTitle>
              <CardDescription>
                Protecting your API keys and sensitive data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  API keys are never stored in plain text. SessionHub uses the system keychain
                  (Keychain on macOS) to securely store sensitive credentials.
                </p>
                <p>
                  All communication with external services uses TLS encryption, and API keys
                  are only transmitted over secure channels.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Settings className="w-4 h-4" />
                  <span className="text-foreground">
                    Configure security settings in <a href="/settings" className="text-primary hover:underline">Settings → Security</a>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}