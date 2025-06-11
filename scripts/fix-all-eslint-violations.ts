#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface FileToFix {
  path: string;
  fixes: Array<{
    line: number;
    column: number;
    rule: string;
    message: string;
    fix?: string;
  }>;
}

const filesToFix: FileToFix[] = [
  {
    path: 'main/ipc/contextHandlers.ts',
    fixes: [
      { line: 58, column: 19, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' }
    ]
  },
  {
    path: 'main/ipc/mcpServerHandlers.ts', 
    fixes: [
      { line: 67, column: 36, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' }
    ]
  },
  {
    path: 'main/ipc/onboardingHandlers.ts',
    fixes: [
      { line: 43, column: 66, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' }
    ]
  },
  {
    path: 'main/ipc/sessionOrchestrationHandlers.ts',
    fixes: [
      { line: 77, column: 24, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' },
      { line: 334, column: 9, rule: '@typescript-eslint/no-floating-promises', message: 'Add void operator', fix: 'void' }
    ]
  },
  {
    path: 'main/ipc/sessionPipelineHandlers.ts',
    fixes: [
      { line: 17, column: 39, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' }
    ]
  },
  {
    path: 'main/services/AutoUpdateService.ts',
    fixes: [
      { line: 11, column: 9, rule: 'no-console', message: 'Remove console.log', fix: 'remove' }
    ]
  },
  {
    path: 'main/services/ClaudeAutoAcceptService.ts',
    fixes: [
      { line: 0, column: 0, rule: 'no-console', message: 'Remove all console statements', fix: 'remove-all' }
    ]
  },
  {
    path: 'main/services/RuntimeActorMonitor.ts',
    fixes: [
      { line: 0, column: 0, rule: 'no-console', message: 'Remove all console statements', fix: 'remove-all' }
    ]
  },
  {
    path: 'renderer/components/ActorStatusDashboard.tsx',
    fixes: [
      { line: 0, column: 0, rule: 'no-console', message: 'Remove all console statements', fix: 'remove-all' }
    ]
  },
  {
    path: 'renderer/hooks/useSessionPipeline.ts',
    fixes: [
      { line: 1, column: 1, rule: '@typescript-eslint/triple-slash-reference', message: 'Replace with import', fix: 'import' },
      { line: 16, column: 28, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' },
      { line: 25, column: 28, rule: '@typescript-eslint/no-explicit-any', message: 'Replace any with unknown', fix: 'unknown' }
    ]
  },
  {
    path: 'renderer/types/window.d.ts',
    fixes: [
      { line: 0, column: 0, rule: '@typescript-eslint/no-explicit-any', message: 'Replace all any with proper types', fix: 'types' }
    ]
  }
];

// Helper function to remove console statements
function removeConsoleStatements(content: string): string {
  // Remove console.log, console.error, console.warn, etc.
  return content.replace(/console\.(log|error|warn|info|debug|trace)\([^)]*\);?\s*/g, '');
}

// Helper function to replace any with unknown
function replaceAnyWithUnknown(content: string): string {
  return content.replace(/: any\b/g, ': unknown');
}

// Helper function to add void operator to promises
function addVoidToPromise(line: string): string {
  if (line.trim().startsWith('window.') && !line.trim().startsWith('void ')) {
    return line.replace(/^(\s*)/, '$1void ');
  }
  return line;
}

// Fix files
filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file.path} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  file.fixes.forEach(fix => {
    if (fix.fix === 'remove-all') {
      const newContent = removeConsoleStatements(content);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    } else if (fix.fix === 'types') {
      const newContent = replaceAnyWithUnknown(content);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    } else if (fix.fix === 'import' && fix.line === 1) {
      // Replace triple-slash reference with import
      content = content.replace(/\/\/\/\s*<reference\s+path="\.\.\/types\/window\.d\.ts"\s*\/>/g, '');
      modified = true;
    } else if (fix.fix === 'void' && fix.line > 0) {
      const lines = content.split('\n');
      if (lines[fix.line - 1]) {
        lines[fix.line - 1] = addVoidToPromise(lines[fix.line - 1]!);
        content = lines.join('\n');
        modified = true;
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file.path}`);
  }
});

console.log('ESLint violation fixes completed!');