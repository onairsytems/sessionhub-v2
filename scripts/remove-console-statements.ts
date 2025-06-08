#!/usr/bin/env ts-node

/**
 * SessionHub Console Statement Removal Script
 * Removes all console statements from production code
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface RemovalResult {
  file: string;
  removedCount: number;
  lines: number[];
}

async function removeConsoleStatements(): Promise<void> {
  console.log('🔍 Scanning for console statements in production code...\n');
  
  // Define patterns to search
  const patterns = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx'
  ];
  
  // Directories to exclude
  const excludeDirs = [
    'node_modules',
    'dist',
    'dist-electron',
    'out',
    '.next',
    'scripts',
    'tests',
    '.husky'
  ];
  
  const results: RemovalResult[] = [];
  let totalRemoved = 0;
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: excludeDirs.map(dir => `${dir}/**`),
      absolute: true,
      cwd: process.cwd()
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const removedLines: number[] = [];
      let modified = false;
      
      const newLines = lines.map((line, index) => {
        // Simple console statement detection
        if (line.match(/console\.(log|error|warn|debug|info|trace|assert|dir|table|time|timeEnd|group|groupEnd)\s*\(/)) {
          // Check if it's not in a comment
          const trimmed = line.trim();
          if (!trimmed.startsWith('//') && !trimmed.startsWith('*')) {
            removedLines.push(index + 1);
            modified = true;
            
            // Handle multi-line console statements
            let openParens = (line.match(/\(/g) || []).length;
            let closeParens = (line.match(/\)/g) || []).length;
            
            if (openParens > closeParens) {
              // Multi-line console statement - comment out instead of removing
              return '// ' + line + ' // REMOVED: console statement';
            } else {
              // Single line - can safely remove
              return '// REMOVED: console statement';
            }
          }
        }
        return line;
      });
      
      if (modified) {
        fs.writeFileSync(file, newLines.join('\n'));
        const relPath = path.relative(process.cwd(), file);
        results.push({
          file: relPath,
          removedCount: removedLines.length,
          lines: removedLines
        });
        totalRemoved += removedLines.length;
      }
    }
  }
  
  // Print results
  if (results.length > 0) {
    console.log('📝 Console statements removed:\n');
    results.forEach(result => {
      console.log(`  ${result.file}:`);
      console.log(`    - Removed ${result.removedCount} console statement(s) on line(s): ${result.lines.join(', ')}`);
    });
    console.log(`\n✅ Total console statements removed: ${totalRemoved}`);
  } else {
    console.log('✅ No console statements found in production code!');
  }
}

// Run the script
removeConsoleStatements().catch(console.error);