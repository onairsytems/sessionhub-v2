#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import { glob } from 'glob';

async function finalFix() {
  console.log('🔧 Running final comprehensive fix...\n');

  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**'],
    absolute: true
  });

  let totalFixes = 0;

  for (const file of files) {
    try {
      let content = await fs.readFile(file, 'utf-8');
      const originalContent = content;

      // Fix any remaining arrow function syntax issues
      content = content.replace(/=>\s*void\s*{/g, '=> {');
      
      // Fix parameter type issues
      content = content.replace(/\(([^:)]+):\s*unknown,\s*([^:)]+):\s*unknown\)/g, '($1, $2)');
      content = content.replace(/\(([^:)]+):\s*unknown\)/g, '($1)');
      
      // Fix watchFile and similar patterns
      content = content.replace(/\(([^)]+):\s*unknown,\s*\(/g, '($1, (');
      
      // Fix return type issues
      content = content.replace(/\):\s*void\s*{/g, '): void {');
      
      // Fix Promise return types
      content = content.replace(/:\s*Promise<void void>/g, ': Promise<void>');
      
      // Fix array type issues
      content = content.replace(/:\s*any\[\]\[\]/g, ': any[][]');
      
      // Replace remaining unknown with any in function parameters
      content = content.replace(/\(([^)]*)\bunknown\b([^)]*)\)/g, (_match, before, after) => {
        return `(${before}any${after})`;
      });
      
      // Fix imports
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        // Ensure imports are at the top
        const lines = content.split('\n');
        const imports: string[] = [];
        const rest: string[] = [];
        let inImportSection = true;
        
        for (const line of lines) {
          if (inImportSection && (line.startsWith('import ') || line.startsWith('import{') || line.startsWith('import*'))) {
            imports.push(line);
          } else if (line.trim() === '' && inImportSection) {
            // Keep empty lines in import section
            imports.push(line);
          } else {
            inImportSection = false;
            rest.push(line);
          }
        }
        
        // Remove duplicate imports
        const uniqueImports = [...new Set(imports)];
        
        if (imports.length !== lines.length || imports.length !== uniqueImports.length) {
          content = uniqueImports.join('\n') + '\n' + rest.join('\n');
        }
      }

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
  
  // Run final ESLint fix
  console.log('\n🔧 Running final ESLint auto-fix...');
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
  finalFix().catch(console.error);
}