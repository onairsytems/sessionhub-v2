#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const fixes = [
  // Fix ClaudeCodeAPIClient
  {
    file: 'src/lib/api/ClaudeCodeAPIClient.ts',
    fixes: [
      {
        find: /const sessionDir = path\.join\(this\.workspaceDir, instruction\.metadata\.sessionId\);/g,
        replace: 'const _sessionDir = path.join(this.workspaceDir, instruction.metadata.sessionId);'
      },
      {
        find: /private async executeRequest\(request\)/g,
        replace: 'private async executeRequest(request: any)'
      }
    ]
  },
  
  // Fix CacheIntegration
  {
    file: 'src/services/cache/CacheIntegration.ts',
    fixes: [
      {
        find: /private formatForCache\(data\)/g,
        replace: 'private formatForCache(data: any)'
      }
    ]
  },
  
  // Fix LocalCacheService
  {
    file: 'src/services/cache/LocalCacheService.ts',
    fixes: [
      {
        find: /const size = result\.size;/g,
        replace: 'const size = (result as any).size;'
      },
      {
        find: /if \(recordCount > /g,
        replace: 'if ((recordCount as number) > '
      },
      {
        find: /private formatForCache\(data\)/g,
        replace: 'private formatForCache(data: any)'
      }
    ]
  },
  
  // Fix VerificationGates - add default for matchResult
  {
    file: 'src/core/verification/VerificationGates.ts',
    fixes: [
      {
        find: /const score = scoreMatch \? parseInt\(scoreMatch\[1\], 10\) : 0;/g,
        replace: 'const score = scoreMatch ? parseInt(scoreMatch[1] || "0", 10) : 0;'
      }
    ]
  }
];

function applyFixes() {
  console.log('🧹 Final cleanup of TypeScript errors...\n');
  
  for (const config of fixes) {
    const filePath = path.join(__dirname, '..', config.file);
    
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      for (const fix of config.fixes) {
        const newContent = content.replace(fix.find, fix.replace);
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
  
  console.log('\n✨ Cleanup complete!');
}

applyFixes();