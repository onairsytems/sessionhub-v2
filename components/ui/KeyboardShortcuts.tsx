/**
 * Keyboard Shortcuts Component
 * Provides global keyboard shortcuts throughout the application
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Card } from './Card';
import { useTheme } from '../../lib/hooks/useTheme';

interface Shortcut {
  keys: string[];
  label: string;
  description: string;
  action: () => void;
  category: string;
  global?: boolean;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  // Register global shortcuts
  useEffect(() => {
    const globalShortcuts: Shortcut[] = [
      {
        keys: ['Meta', 'k'],
        label: 'Command Palette',
        description: 'Open quick command palette',
        action: () => {},
        category: 'Navigation',
        global: true
      },
      {
        keys: ['Meta', 'n'],
        label: 'New Session',
        description: 'Create a new development session',
        action: () => void router.push('/sessions?action=new'),
        category: 'Sessions',
        global: true
      },
      {
        keys: ['Meta', 'p'],
        label: 'Switch Project',
        description: 'Quick switch between projects',
        action: () => {},
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
        action: () => void router.push('/docs'),
        category: 'Navigation',
        global: true
      },
      {
        keys: ['Meta', ','],
        label: 'Settings',
        description: 'Open application settings',
        action: () => void router.push('/settings'),
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
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || 
                      activeElement?.tagName === 'TEXTAREA' || 
                      (activeElement as HTMLElement)?.contentEditable === 'true';

      if (isTyping && e.key !== '?') return;

      shortcuts.forEach(shortcut => {
        const match = shortcut.keys.every(key => {
          switch (key) {
            case 'Meta':
              return e.metaKey;
            case 'Ctrl':
              return e.ctrlKey;
            case 'Alt':
              return e.altKey;
            case 'Shift':
              return e.shiftKey;
            default:
              return e.key.toLowerCase() === key.toLowerCase();
          }
        });

        if (match) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    (acc[shortcut.category] as Shortcut[]).push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <>
      {/* Context API for child components */}
      <KeyboardShortcutContext.Provider value={{ registerShortcut, unregisterShortcut }}>
        {/* Children would go here */}
      </KeyboardShortcutContext.Provider>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">{category}</h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div key={index} className="flex justify-between items-center py-2">
                        <div className="flex-1">
                          <div className="font-medium">{shortcut.label}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {shortcut.description}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              {keyIndex > 0 && <span className="text-gray-400">+</span>}
                              <kbd className="px-2 py-1 text-sm font-mono bg-gray-100 dark:bg-gray-800 rounded">
                                {key === 'Meta' ? '⌘' : key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// Context for registering shortcuts from child components
export const KeyboardShortcutContext = React.createContext<{
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (keys: string[]) => void;
}>({
  registerShortcut: () => {},
  unregisterShortcut: () => {}
});

export const useKeyboardShortcut = () => React.useContext(KeyboardShortcutContext);