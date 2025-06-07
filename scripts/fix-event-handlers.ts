#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import { glob } from 'glob';

async function fixEventHandlers() {
  console.log('🔧 Fixing malformed event handlers...\n');

  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**'],
    absolute: true
  });

  let totalFixes = 0;

  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf-8');
      const originalContent = content;

      // Fix malformed event handlers like on('event', (param) => {
      content = content.replace(/\.on\(['"]([^'"]+)['"]\s*:\s*unknown,\s*\(([^)]*)\s*:\s*unknown\)\s*=>/g, '.on(\'$1\', ($2) =>');
      
      // Fix process.on with similar pattern
      content = content.replace(/process\.on\(['"]([^'"]+)['"]\s*:\s*unknown,\s*\(\)\s*=>/g, 'process.on(\'$1\', () =>');
      
      // Fix patterns like .on('event', () =>
      content = content.replace(/\.on\(['"]([^'"]+)['"]\s*:\s*unknown,\s*\(\)\s*=>/g, '.on(\'$1\', () =>');
      
      // Fix patterns with parameters
      content = content.replace(/\.on\(['"]([^'"]+)['"]\s*:\s*unknown,\s*\(([^:)]+)\s*:\s*unknown\)\s*=>/g, '.on(\'$1\', ($2) =>');

      if (content !== originalContent) {
        await fs.writeFile(file, content, 'utf-8');
        console.log(`✅ Fixed ${file}`);
        totalFixes++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }

  console.log(`\n✅ Fixed ${totalFixes} files`);
}

if (require.main === module) {
  fixEventHandlers().catch(console.error);
}