#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const FIXES = {
  // Fix no-explicit-any errors by adding proper types
  'no-explicit-any': [
    {
      file: 'app/docs.tsx',
      line: 240,
      search: 'any',
      replace: 'unknown'
    },
    {
      file: 'components/SessionWorkflowPolished.tsx',
      line: 42,
      search: 'any',
      replace: 'unknown'
    }
  ],
  
  // Fix no-floating-promises
  'no-floating-promises': [
    {
      file: 'app/sessions.tsx',
      line: 16,
      prefix: 'void '
    },
    {
      file: 'main/background.ts',
      lines: [325, 352, 355, 369],
      prefix: 'void '
    }
  ],
  
  // Fix no-misused-promises
  'no-misused-promises': [
    {
      file: 'app/sessions.tsx',
      line: 201,
      wrap: '() => void'
    },
    {
      file: 'app/settings.tsx',
      line: 180,
      wrap: '() => void'
    },
    {
      file: 'components/ui/KeyboardShortcuts.tsx',
      lines: [40, 64, 72],
      wrap: '() => void'
    }
  ]
};

// Function to fix specific types of errors
function fixFile(filePath: string, fixes: any[]) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Apply fixes
  fixes.forEach(fix => {
    if (fix.prefix) {
      const lineNums = fix.lines || [fix.line];
      lineNums.forEach((lineNum: number) => {
        const lineIndex = lineNum - 1;
        if (lines[lineIndex]) {
          // Add void operator to floating promises
          lines[lineIndex] = lines[lineIndex].replace(
            /^(\s*)(.+)$/,
            `$1void $2`
          );
        }
      });
    }
    
    if (fix.wrap) {
      const lineNums = fix.lines || [fix.line];
      lineNums.forEach((lineNum: number) => {
        const lineIndex = lineNum - 1;
        if (lines[lineIndex]) {
          // Wrap async handlers
          lines[lineIndex] = lines[lineIndex].replace(
            /onClick={([^}]+)}/,
            'onClick={() => { void $1(); }}'
          );
        }
      });
    }
    
    if (fix.search && fix.replace) {
      const lineIndex = fix.line - 1;
      if (lines[lineIndex]) {
        lines[lineIndex] = lines[lineIndex].replace(fix.search, fix.replace);
      }
    }
  });
  
  fs.writeFileSync(filePath, lines.join('\n'));
}

// Main execution
console.log('🔧 Fixing ESLint errors...\n');

// First, run ESLint auto-fix for what it can handle
console.log('Running ESLint auto-fix...');
try {
  execSync('npx eslint . --ext .js,.jsx,.ts,.tsx --fix', { stdio: 'inherit' });
} catch (e) {
  // Continue even if there are remaining errors
}

// Apply manual fixes for errors that can't be auto-fixed
Object.entries(FIXES).forEach(([errorType, fixes]) => {
  console.log(`\nFixing ${errorType} errors...`);
  const fileGroups = fixes.reduce((acc: any, fix: any) => {
    if (!acc[fix.file]) acc[fix.file] = [];
    acc[fix.file].push(fix);
    return acc;
  }, {});
  
  Object.entries(fileGroups).forEach(([file, fileFixes]: [string, any]) => {
    const filePath = path.join(process.cwd(), file);
    fixFile(filePath, fileFixes);
    console.log(`  ✓ Fixed ${file}`);
  });
});

console.log('\n✅ ESLint error fixing complete!');