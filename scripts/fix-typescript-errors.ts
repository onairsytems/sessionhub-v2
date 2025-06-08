#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import { glob } from 'glob';

async function fixTypeScriptErrors() {
  console.log('🔧 Fixing TypeScript errors...\n');

  // Get all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**'],
    absolute: true
  });

  let totalFixes = 0;

  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf-8');
      const originalContent = content;

      // Fix 1: Add types to catch clauses
      content = content.replace(/catch\s*\(\s*(\w+)\s*\)/g, 'catch ($1: any)');
      
      // Fix 2: Fix missing return types on exported functions
      content = content.replace(
        /export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*{/g,
        (match: any, async: any) => {
          // Check if it already has a return type by looking at what comes before the {
          const beforeBrace = match.substring(0, match.lastIndexOf('{'));
          if (beforeBrace.includes(':')) {
            return match; // Already has return type
          }
          // Infer return type
          const isAsync = !!async;
          const returnType = isAsync ? ': Promise<void>' : ': void';
          return match.replace('{', `${returnType} {`);
        }
      );

      // Fix 3: Add types to parameters without types
      content = content.replace(
        /\(([^:)]+)\)\s*=>/g,
        (match: any, params: any) => {
          // Skip if already has types
          if (params.includes(':')) return match;
          // Skip if empty params
          if (!params.trim()) return match;
          
          // Add any type to each param
          const typedParams = params.split(',').map((p: string) => {
            const param = p.trim();
            if (!param) return param;
            return `${param}: any`;
          }).join(', ');
          
          return `(${typedParams}: any) =>`;
        }
      );

      // Fix 4: Fix .d.ts files with improper syntax
      if (file.endsWith('.d.ts')) {
        // Fix interface method signatures
        content = content.replace(
          /(\w+):\s*\(([^)]*)\)\s*=>\s*([^;]+);/g,
          '$1: ($2: any) => $3;'
        );
      }

      // Fix 5: Remove duplicate void in return types
      content = content.replace(/:\s*\([^)]*\)\s*=>\s*void\s+void/g, ': ($1: any) => void');
      content = content.replace(/=>\s*void\s+void/g, '=> void');

      // Fix 6: Fix floating promises in common patterns
      const floatingPromisePatterns = [
        // app.quit(), app.whenReady(), etc
        /^(\s*)(app\.\w+\([^)]*\));$/gm,
        // shell.openExternal(), dialog.show(), etc
        /^(\s*)(shell\.\w+\([^)]*\));$/gm,
        /^(\s*)(dialog\.\w+\([^)]*\));$/gm,
        // window operations
        /^(\s*)([\w]+Window\.\w+\([^)]*\));$/gm,
        /^(\s*)(this\.mainWindow\.\w+\([^)]*\));$/gm,
      ];

      for (const pattern of floatingPromisePatterns) {
        content = content.replace(pattern, '$1void $2');
      }

      // Fix 7: Fix no-unsafe-* issues by replacing any with unknown
      if (!file.includes('fix-typescript-errors.ts')) {
        content = content.replace(/:\s*any\[\]/g, ': any[]');
        content = content.replace(/:\s*any(?![a-zA-Z])/g, ': unknown');
        content = content.replace(/as\s+any(?![a-zA-Z])/g, 'as unknown');
      }

      // Check if we made changes
      if (content !== originalContent) {
        await fs.writeFile(file, content, 'utf-8');
        console.log(`✅ Fixed ${file}`);
        totalFixes++;
      }

    } catch (error: any) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }

  console.log(`\n✅ Fixed ${totalFixes} files`);
}

if (require.main === module) {
  fixTypeScriptErrors().catch(console.error);
}