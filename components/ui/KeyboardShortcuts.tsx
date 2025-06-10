'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/hooks/useTheme';
import { X, Search } from 'lucide-react';
import { Button } from './Button';

interface Shortcut {
  keys: string[];
  label: string;
  description?: string;
  action: () => void;
  category?: string;
  global?: boolean;
}

interface KeyboardShortcutsContextValue {
  shortcuts: Shortcut[];
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (keys: string[]) => void;
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | undefined>(undefined);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  const { toggleTheme } = useTheme();
  
  // Register global shortcuts
  useEffect(() => {
    const globalShortcuts: Shortcut[] = [
      {
        keys: ['Meta', 'k'],
        label: 'Command Palette',
        description: 'Open quick command palette',
        action: () => setShowHelp(true),
        category: 'Navigation',
        global: true
      },
      {
        keys: ['Meta', 'n'],
        label: 'New Session',
        description: 'Create a new development session',
        action: () => router.push('/sessions?action=new'),
        category: 'Sessions',
        global: true
      },
      {
        keys: ['Meta', 'p'],
        label: 'Switch Project',
        description: 'Quick switch between projects',
        action: () => router.push('/projects'),
        category: 'Navigation',
        global: true
      },
      {
        keys: ['Meta', 'Shift', 't'],
        label: 'Toggle Theme',
        description: 'Switch between light and dark theme',
        action: toggleTheme,
        category: 'Appearance',
        global: true
      },
      {
        keys: ['Meta', '/'],
        label: 'Search',
        description: 'Search documentation and help',
        action: () => router.push('/docs'),
        category: 'Navigation',
        global: true
      },
      {
        keys: ['Meta', ','],
        label: 'Settings',
        description: 'Open application settings',
        action: () => router.push('/settings'),
        category: 'Navigation',
        global: true
      },
      {
        keys: ['?'],
        label: 'Help',
        description: 'Show keyboard shortcuts',
        action: () => setShowHelp(true),
        category: 'Help',
        global: true
      }
    ];

    setShortcuts(globalShortcuts);
  }, [router, toggleTheme]);

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts(prev => [...prev.filter(s => s.keys.join('+') !== shortcut.keys.join('+')), shortcut]);
  }, []);

  const unregisterShortcut = useCallback((keys: string[]) => {
    setShortcuts(prev => prev.filter(s => s.keys.join('+') !== keys.join('+')));
  }, []);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputField = activeElement instanceof HTMLInputElement || 
                          activeElement instanceof HTMLTextAreaElement;

      // Don't trigger shortcuts when typing in input fields
      if (isInputField && event.key !== 'Escape') return;

      const pressedKeys: string[] = [];
      if (event.metaKey) pressedKeys.push('Meta');
      if (event.ctrlKey) pressedKeys.push('Control');
      if (event.altKey) pressedKeys.push('Alt');
      if (event.shiftKey) pressedKeys.push('Shift');
      
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        pressedKeys.push(key);
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => {
        if (shortcut.keys.length !== pressedKeys.length) return false;
        return shortcut.keys.every(key => pressedKeys.includes(key));
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  return (
    <KeyboardShortcutsContext.Provider value={{ shortcuts, registerShortcut, unregisterShortcut, showHelp, setShowHelp }}>
      {children}
      <KeyboardShortcutsHelp />
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}

function KeyboardShortcutsHelp() {
  const { shortcuts, showHelp, setShowHelp } = useKeyboardShortcuts();
  const [searchQuery, setSearchQuery] = useState('');

  if (!showHelp) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category || 'Other')));
  const filteredShortcuts = shortcuts.filter(shortcut => 
    shortcut.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {categories.map(category => {
            const categoryShortcuts = filteredShortcuts.filter(s => (s.category || 'Other') === category);
            if (categoryShortcuts.length === 0) return null;

            return (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded hover:bg-secondary/50"
                    >
                      <div>
                        <div className="font-medium text-sm">{shortcut.label}</div>
                        {shortcut.description && (
                          <div className="text-xs text-muted-foreground">{shortcut.description}</div>
                        )}
                      </div>
                      <kbd className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="text-xs">+</span>}
                            <span className="px-1.5 py-0.5 text-xs rounded bg-muted">
                              {formatKey(key)}
                            </span>
                          </React.Fragment>
                        ))}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t text-center text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted">?</kbd> to show this help
        </div>
      </div>
    </div>
  );
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'Meta': '⌘',
    'Control': 'Ctrl',
    'Alt': 'Alt',
    'Shift': '⇧',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '⏎',
    'Escape': 'Esc',
    ' ': 'Space'
  };
  
  return keyMap[key] || key.toUpperCase();
}

// Hook for registering component-specific shortcuts
export function useShortcut(
  keys: string[],
  action: () => void,
  options?: { 
    label?: string;
    description?: string;
    category?: string;
    enabled?: boolean;
  }
) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    if (options?.enabled !== false) {
      registerShortcut({
        keys,
        action,
        label: options?.label || keys.join('+'),
        description: options?.description,
        category: options?.category
      });

      return () => unregisterShortcut(keys);
    }
    // Return undefined when the shortcut is disabled
    return undefined;
  }, [keys, action, options, registerShortcut, unregisterShortcut]);
}