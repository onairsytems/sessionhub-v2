#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the current MCPBatchProcessor content
const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'batch', 'MCPBatchProcessor.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Check if the file has duplicate content from line 265
const lines = content.split('\n');
let foundDuplicate = false;
let duplicateIndex = -1;

// Look for the duplicate pattern
for (let i = 260; i < lines.length && i < 280; i++) {
  if (lines[i].includes('} else {') && 
      lines[i+1] && lines[i+1].includes('const errorResult: BatchResult = {') &&
      lines[i+5] && lines[i+5].includes('itemId: item ? item.id :')) {
    foundDuplicate = true;
    duplicateIndex = i+5;
    break;
  }
}

if (foundDuplicate && duplicateIndex > 0) {
  // Remove the duplicate section (lines from duplicateIndex to duplicateIndex+15)
  lines.splice(duplicateIndex, 15);
  
  // Write the fixed content
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('✅ Fixed duplicate code in MCPBatchProcessor.ts');
} else {
  console.log('⚠️  No duplicate found, checking structure...');
  
  // Alternative fix: look for the malformed section
  const fixedContent = content.replace(
    /}\s*}\s*else\s*{\s*const errorResult/gs,
    '} else {\n          const errorResult'
  );
  
  fs.writeFileSync(filePath, fixedContent);
  console.log('✅ Fixed structure in MCPBatchProcessor.ts');
}