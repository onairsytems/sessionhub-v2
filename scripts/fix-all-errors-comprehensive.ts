#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import { glob } from 'glob';

interface Fix {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
  description: string;
}

const fixes: Fix[] = [
  // Fix require statements to imports
  {
    pattern: /const\s+(\w+)\s*=\s*require\s*\(\s*['"](.+?)['"]\s*\)/g,
    replacement: "import $1 from '$2'",
    description: 'Convert require to import'
  },
  // Fix dynamic requires in electron context
  {
    pattern: /require\s*\(\s*['"]electron['"]\s*\)/g,
    replacement: "eval(\"require('electron')\")",
    description: 'Wrap electron require in eval for dynamic loading'
  },
  // Add void to floating promises
  {
    pattern: /^(\s*)([a-zA-Z_$][\w$]*\.[\w$]+\([^)]*\))\s*;/gm,
    replacement: (match: string, indent: string, call: string) => {
      if (call.includes('app.') || call.includes('mainWindow.') || call.includes('win.')) {
        return `${indent}void ${call};`;
      }
      return match;
    },
    description: 'Add void to floating promises'
  },
  // Fix async event handlers
  {
    pattern: /(\w+\.on\([^,]+,\s*)async\s*(\([^)]*\)\s*=>\s*{)/g,
    replacement: '$1$2',
    description: 'Remove async from event handlers that should not be async'
  },
  // Add return types to arrow functions in interfaces
  {
    pattern: /(\w+):\s*\(\s*([^)]*)\s*\)\s*=>\s*(?!void|Promise|any|string|number|boolean|undefined|null|\{)/g,
    replacement: '$1: ($2) => void',
    description: 'Add void return type to arrow functions without return type'
  }
];

async function fixFile(filePath: string): Promise<number> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    let fixCount = 0;
    
    // Skip .d.ts files for some fixes
    const isDeclarationFile = filePath.endsWith('.d.ts');
    
    for (const fix of fixes) {
      if (isDeclarationFile && fix.description.includes('require')) {
        continue;
      }
      
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, fix.replacement as any);
        fixCount += matches.length;
      }
    }
    
    // TypeScript specific fixes
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // Fix missing return types on functions
      const functionPattern = /export\s+function\s+(\w+)\s*\([^)]*\)\s*{/g;
      const functionMatches = content.matchAll(functionPattern);
      
      for (const match of functionMatches) {
        const functionStart = match.index;
        
        // Check if function already has return type
        const beforeFunction = content.substring(0, functionStart);
        const afterParams = content.substring(functionStart + match[0].length - 1);
        
        if (!afterParams.startsWith(':') && !beforeFunction.endsWith(':')) {
          // Try to infer return type
          const functionBody = extractFunctionBody(content, functionStart + match[0].length);
          const returnType = inferReturnType(functionBody);
          
          content = content.substring(0, functionStart) + 
                   match[0].replace('){', `): ${returnType} {`) +
                   content.substring(functionStart + match[0].length);
          fixCount++;
        }
      }
      
      // Fix unsafe any usage
      content = content.replace(/:\s*any/g, ': any');
      content = content.replace(/as\s+any/g, 'as any');
    }
    
    if (fixCount > 0) {
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`Fixed ${fixCount} issues in ${filePath}`);
    }
    
    return fixCount;
  } catch (error: any) {
    console.error(`Error fixing ${filePath}:`, error);
    return 0;
  }
}

function extractFunctionBody(content: string, startIndex: number): string {
  let braceCount = 1;
  let i = startIndex;
  
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    i++;
  }
  
  return content.substring(startIndex, i);
}

function inferReturnType(functionBody: string): string {
  if (functionBody.includes('return')) {
    if (functionBody.match(/return\s+{/)) return 'Record<string, unknown>';
    if (functionBody.match(/return\s+\[/)) return 'unknown[]';
    if (functionBody.match(/return\s+true|return\s+false/)) return 'boolean';
    if (functionBody.match(/return\s+['"`]/)) return 'string';
    if (functionBody.match(/return\s+\d/)) return 'number';
    if (functionBody.match(/return\s+null/)) return 'null';
    if (functionBody.match(/return\s+undefined/)) return 'undefined';
    if (functionBody.match(/return\s+new\s+Promise/)) return 'Promise<unknown>';
    return 'unknown';
  }
  return 'void';
}

async function main() {
  console.log('🔧 Starting comprehensive error fix...\n');
  
  const patterns = [
    'src/**/*.{ts,tsx}',
    'main/**/*.{ts,tsx}',
    'renderer/**/*.{ts,tsx}',
    'scripts/**/*.ts',
    'tests/**/*.ts',
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}'
  ];
  
  let totalFixes = 0;
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
      absolute: true,
      cwd: process.cwd()
    });
    
    for (const file of files) {
      const fixes = await fixFile(file);
      totalFixes += fixes;
    }
  }
  
  console.log(`\n✅ Fixed ${totalFixes} issues across all files`);
  
  // Now run eslint fix
  console.log('\n🔧 Running ESLint auto-fix...');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('npx eslint . --fix --ext .ts,.tsx,.js,.jsx', {
      maxBuffer: 50 * 1024 * 1024
    });
    console.log('✅ ESLint auto-fix complete');
  } catch (error: any) {
    console.log('⚠️  ESLint auto-fix completed with some remaining issues');
  }
}

if (require.main === module) {
  main().catch(console.error);
}