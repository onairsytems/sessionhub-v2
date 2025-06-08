#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/services/cache/LocalCacheService.ts');

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix all property access on unknown types
  content = content.replace(/result\.size/g, '(result as any).size');
  content = content.replace(/row\.ttl_expires_at/g, '(row as any).ttl_expires_at');
  content = content.replace(/metadata\.version/g, '(metadata as any).version');
  content = content.replace(/value\.value/g, '(value as any).value');
  content = content.replace(/stats\.oldest/g, '(stats as any).oldest');
  content = content.replace(/result\.count/g, '(result as any).count');
  
  // Fix recordCount comparisons
  content = content.replace(/if \(recordCount > /g, 'if ((recordCount as number) > ');
  
  // Fix count comparisons
  content = content.replace(/while \(count > /g, 'while ((count as number) > ');
  
  // Fix pendingSyncs.length
  content = content.replace(/pendingSyncs\.length/g, '(pendingSyncs as any[]).length');
  
  // Fix data.length
  content = content.replace(/data\.length > 0/g, '(data as any[]).length > 0');
  
  // Fix parameter types
  content = content.replace(/private formatForCache\(data\)/g, 'private formatForCache(data: any)');
  content = content.replace(/\.map\(row => /g, '.map((row: any) => ');
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed LocalCacheService TypeScript errors');
} catch (error) {
  console.error('❌ Error fixing LocalCacheService:', error.message);
}