#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import { glob } from 'glob';

async function fixVoidPromise() {
  console.log('🔧 Fixing void Promise issues...\n');

  const files = await glob('**/*.{ts,tsx,d.ts}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**'],
    absolute: true
  });

  let totalFixes = 0;

  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf-8');
      const originalContent = content;

      // Fix "void Promise" pattern
      content = content.replace(/:\s*\([^)]*\)\s*=>\s*void\s+Promise</g, ': ($1) => Promise<');
      content = content.replace(/=>\s*void\s+Promise</g, '=> Promise<');
      
      // Fix specific patterns
      content = content.replace(/\)\s*=>\s*void\s+Promise<([^>]+)>/g, ') => Promise<$1>');
      
      // Fix parameter issues like () => void
      content = content.replace(/\(\$\d+\)\s*=>\s*void/g, '() => void');
      
      // Fix patterns like () =>
      content = content.replace(/\(\s*:\s*any\s*\)/g, '()');
      content = content.replace(/,\s*:\s*any/g, '');
      
      // Fix unknown: unknown patterns
      content = content.replace(/\[(\w+):\s*unknown,\s*(\w+)\]:\s*unknown/g, '[$1, $2]');

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
  fixVoidPromise().catch(console.error);
}