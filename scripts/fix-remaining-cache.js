#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const fixes = [
  // LocalCacheService fixes
  {
    file: 'src/services/cache/LocalCacheService.ts',
    replacements: [
      // Line 549
      { find: /row\.ttl_expires_at && new Date\(row\.ttl_expires_at\)/g, replace: '(row as any).ttl_expires_at && new Date((row as any).ttl_expires_at)' },
      // Line 666
      { find: /metadata\.version \|\| '1\.0\.0'/g, replace: '(metadata as any).version || "1.0.0"' },
      // Line 880
      { find: /const count = pendingSyncs\.length;/g, replace: 'const count = (pendingSyncs as any[]).length;' },
      // Line 887
      { find: /pendingSyncs\.forEach/g, replace: '(pendingSyncs as any[]).forEach' },
      // Line 894
      { find: /JSON\.parse\(value\.value\)/g, replace: 'JSON.parse((value as any).value)' },
      // Line 907-908
      { find: /oldestRecord\?.oldest/g, replace: '(oldestRecord as any)?.oldest' },
      // Line 946
      { find: /if \(data\.length === 0\)/g, replace: 'if ((data as any[]).length === 0)' },
      // Line 955
      { find: /private formatForCache\(data\)/g, replace: 'private formatForCache(data: any)' },
      // Line 1010
      { find: /\.map\(row => this\.deserialize/g, replace: '.map((row: any) => this.deserialize' }
    ]
  },
  
  // ClaudeCodeAPIClient - remove unused sessionDir
  {
    file: 'src/lib/api/ClaudeCodeAPIClient.ts',
    replacements: [
      { find: /const sessionDir = path\.join\(this\.workspaceDir, sessionId\);\n\s*\n\s*try \{/g, replace: 'try {' }
    ]
  },
  
  // Test file - fix remaining context issue
  {
    file: 'src/core/verification/__tests__/SessionVerification.test.ts',
    replacements: [
      { find: /context: \{[\s\S]*?successCriteria: \[\][\s\S]*?\}[\s\S]*?metadata: \{\}/g, replace: 'metadata: {}' }
    ]
  }
];

console.log('🧹 Fixing remaining cache and test issues...\n');

for (const config of fixes) {
  const filePath = path.join(__dirname, '..', config.file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const replacement of config.replacements) {
      const newContent = content.replace(replacement.find, replacement.replace);
      if (newContent !== content) {
        content = newContent;
        modified = true;
        console.log(`  ✓ Applied fix in ${config.file}`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`  ✅ ${config.file} updated`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${config.file}:`, error.message);
  }
}

console.log('\n✨ Done!');