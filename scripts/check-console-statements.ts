#!/usr/bin/env ts-node

/**
 * SessionHub Console Statement Checker
 * Checks for console statements in production code
 * Part of the zero-tolerance quality enforcement system
 */

import { glob } from 'glob';
import * as fs from 'fs/promises';

// Patterns to search for
const PRODUCTION_PATTERNS = [
  'src/**/*.{ts,tsx}',
  'main/**/*.{ts,tsx}',
  'renderer/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'components/**/*.{ts,tsx}',
  'app/**/*.{ts,tsx}'
];

// Patterns to exclude
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-electron/**',
  '**/out/**',
  '**/.next/**',
  '**/tests/**',
  '**/*.test.{ts,tsx}',
  '**/templates/**',  // Exclude template files that generate code
  '**/*.spec.{ts,tsx}'
];

async function checkConsoleStatements(): Promise<number> {
  let totalCount = 0;
  const foundIn: string[] = [];

  for (const pattern of PRODUCTION_PATTERNS) {
    const files = await glob(pattern, {
      ignore: EXCLUDE_PATTERNS,
      cwd: process.cwd()
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Skip if it's all comments
      const lines = content.split('\n');
      let consoleCount = 0;
      
      lines.forEach((line) => {
        // Skip commented lines
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
          return;
        }
        
        // Skip lines within block comments
        if (trimmedLine.includes('/*') || trimmedLine.includes('*/')) {
          return;
        }
        
        // Skip URLs containing console
        if (line.includes('console.anthropic.com') || line.includes('console.cloud.google') || line.includes('console.aws')) {
          return;
        }
        
        // Check for console statements
        const consoleRegex = /console\s*\.\s*(log|error|warn|info|debug|trace|group|groupEnd|table|time|timeEnd|assert)/g;
        const matches = line.match(consoleRegex);
        
        if (matches && matches.length > 0) {
          consoleCount += matches.length;
        }
      });
      
      if (consoleCount > 0) {
        totalCount += consoleCount;
        foundIn.push(`${file}: ${consoleCount} console statement(s)`);
      }
    }
  }

  if (totalCount > 0) {
    console.error(`❌ Found ${totalCount} console statements in production code:`);
    foundIn.forEach(file => console.error(`   ${file}`));
    process.exit(1);
  } else {
    console.log('✅ No console statements found in production code');
    process.exit(0);
  }
}

// Run the check
checkConsoleStatements().catch(error => {
  console.error('Error checking console statements:', error);
  process.exit(1);
});