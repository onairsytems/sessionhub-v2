#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function fixVoidVoid() {
  console.log('Fixing "void" syntax errors...');
  
  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', { 
    ignore: ['node_modules/**', 'dist/**', 'out/**', 'dist-electron/**'],
    cwd: process.cwd()
  });
  
  let totalFixed = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Fix "void" patterns
      content = content.replace(/void\s+void/g, 'void');
      
      // Fix "Promise<" patterns
      content = content.replace(/void\s+Promise</g, 'Promise<');
      
      // Fix ") => Promise<" patterns
      content = content.replace(/\)\s*=>\s*void\s+Promise</g, ') => Promise<');
      
      // Fix ": () => Promise<" patterns
      content = content.replace(/:\s*\(\)\s*=>\s*void\s+Promise</g, ': () => Promise<');
      
      // Fix ": (args) => Promise<" patterns
      content = content.replace(/:\s*\([^)]*\)\s*=>\s*void\s+Promise</g, (match) => {
        return match.replace('=> Promise<', '=> Promise<');
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Fixed: ${file}`);
        totalFixed++;
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
  
  console.log(`\nFixed ${totalFixed} files with void syntax errors.`);
}

fixVoidVoid().catch(console.error);