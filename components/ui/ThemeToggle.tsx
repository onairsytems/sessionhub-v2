
'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from './Button';
import { useTheme } from '@/lib/hooks/useTheme';

export function ThemeToggle() : void {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 text-gray-900 dark:text-gray-100" />
      ) : (
        <Sun className="h-5 w-5 text-gray-900 dark:text-gray-100" />
      )}
    </Button>
  );
}