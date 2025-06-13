#!/usr/bin/env ts-node

/**
 * Simple error check that doesn't trigger recursive builds
 * Just checks for TypeScript errors without building
 */

import { execSync } from 'child_process';

console.log("🔍 Checking for TypeScript errors...");

try {
  // Just run TypeScript compiler in check mode
  execSync('npx tsc --noEmit', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log("✅ No TypeScript errors found!");
  process.exit(0);
} catch (error) {
  console.error("❌ TypeScript errors found!");
  process.exit(1);
}