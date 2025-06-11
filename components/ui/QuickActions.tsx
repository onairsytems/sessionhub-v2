'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button';
import { useKeyboardShortcut } from './KeyboardShortcuts';
import { useToastActions } from './Toast';
import {
  Command,
  Search,
  Plus,
  FileText,
  Settings,
  HelpCircle,
  Zap,
  GitBranch,
  Terminal,
  Cloud,
  Shield,
  Package,
  BarChart
} from 'lucide-react';
interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: 'navigation' | 'session' | 'settings' | 'help';
  action: () => void;
  keywords: string[];
}
export function QuickActionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToastActions();
  const { registerShortcut } = useKeyboardShortcut();
  const quickActions: QuickAction[] = [
    // Navigation
    {
      id: 'home',
      label: 'Go to Dashboard',
      icon: BarChart,
      category: 'navigation',
      action: () => router.push('/'),
      keywords: ['home', 'dashboard', 'main']
    },
    {
      id: 'sessions',
      label: 'View Sessions',
      icon: Terminal,
      category: 'navigation',
      action: () => router.push('/sessions'),
      keywords: ['sessions', 'work', 'history']
    },
    {
      id: 'architecture',
      label: 'Architecture Overview',
      icon: GitBranch,
      category: 'navigation',
      action: () => router.push('/architecture'),
      keywords: ['architecture', 'system', 'design']
    },
    {
      id: 'docs',
      label: 'Documentation',
      icon: FileText,
      category: 'navigation',
      action: () => router.push('/docs'),
      keywords: ['docs', 'documentation', 'help', 'guide']
    },
    // Session Actions
    {
      id: 'new-session',
      label: 'New Session',
      description: 'Start a new development session',
      icon: Plus,
      category: 'session',
      action: () => {
        router.push('/sessions?action=new');
        toast.success('Starting new session');
      },
      keywords: ['new', 'create', 'start', 'session']
    },
    {
      id: 'import-project',
      label: 'Import Project',
      description: 'Import an existing codebase',
      icon: Package,
      category: 'session',
      action: () => {
        toast.info('Opening project import wizard');
      },
      keywords: ['import', 'project', 'codebase']
    },
    // Settings
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      category: 'settings',
      action: () => router.push('/settings'),
      keywords: ['settings', 'preferences', 'config']
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      description: 'Manage your API credentials',
      icon: Shield,
      category: 'settings',
      action: () => router.push('/settings?section=api-keys'),
      keywords: ['api', 'keys', 'credentials', 'claude']
    },
    {
      id: 'cloud-sync',
      label: 'Cloud Sync',
      description: 'Configure cloud synchronization',
      icon: Cloud,
      category: 'settings',
      action: () => router.push('/settings?section=data'),
      keywords: ['cloud', 'sync', 'backup', 'supabase']
    },
    // Help
    {
      id: 'help',
      label: 'Help Center',
      icon: HelpCircle,
      category: 'help',
      action: () => router.push('/docs'),
      keywords: ['help', 'support', 'question']
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: Command,
      category: 'help',
      action: () => {
        setIsOpen(false);
        // Trigger keyboard shortcuts help
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      },
      keywords: ['keyboard', 'shortcuts', 'hotkeys']
    }
  ];
  // Filter actions based on search
  const filteredActions = quickActions.filter(action => {
    const query = searchQuery.toLowerCase();
    return (
      action.label.toLowerCase().includes(query) ||
      action.description?.toLowerCase().includes(query) ||
      action.keywords.some(keyword => keyword.includes(query))
    );
  });
  // Group actions by category
  const groupedActions = filteredActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    (acc[action.category] as QuickAction[]).push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredActions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredActions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredActions[selectedIndex]) {
            filteredActions[selectedIndex].action();
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredActions]);
  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);
  // Focus input when menu opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);
  // Register global shortcut
  useEffect(() => {
    registerShortcut({
      keys: ['Meta', 'k'],
      label: 'Quick Actions',
      description: 'Open quick command palette',
      action: () => setIsOpen(true),
      category: 'Navigation',
      global: true
    });
  }, [registerShortcut]);
  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Command className="w-4 h-4" />
        <span className="hidden sm:inline">Quick Actions</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs rounded bg-muted">⌘K</kbd>
      </Button>
    );
  }
  const categoryLabels = {
    navigation: 'Navigation',
    session: 'Sessions',
    settings: 'Settings',
    help: 'Help & Support'
  };
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl mx-4">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-transparent border-0 focus:outline-none text-lg"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-muted"
            >
              <kbd className="text-xs px-1.5 py-0.5 rounded bg-muted">ESC</kbd>
            </button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No actions found for "{searchQuery}"
            </div>
          ) : (
            Object.entries(groupedActions).map(([category, actions]) => (
              <div key={category} className="mb-4">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </div>
                {actions.map((action) => {
                  const Icon = action.icon;
                  const globalIndex = filteredActions.indexOf(action);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        action.action();
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded text-left transition-colors ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{action.label}</div>
                        {action.description && (
                          <div className={`text-xs ${
                            isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                          }`}>
                            {action.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="text-xs px-1.5 py-0.5 rounded bg-primary-foreground/20">
                          ⏎
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted">⏎</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted">ESC</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Quick Actions
          </div>
        </div>
      </div>
    </div>
  );
}