#!/usr/bin/env ts-node

/**
 * Git Working Directory Cleanliness Check
 * Ensures no uncommitted changes before builds
 */

import { execSync } from 'child_process';

function checkGitStatus(): void {
  console.log('🔍 Checking Git working directory status...\n');
  
  try {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    
    if (status.trim()) {
      console.error('❌ ERROR: Git working directory is not clean!');
      console.error('\nUncommitted changes:');
      console.error(status);
      console.error('\nPlease commit or stash all changes before building.');
      process.exit(1);
    }
    
    // Check for untracked files
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });
    
    if (untracked.trim()) {
      console.error('❌ ERROR: Untracked files found!');
      console.error('\nUntracked files:');
      console.error(untracked);
      console.error('\nPlease add files to .gitignore or commit them before building.');
      process.exit(1);
    }
    
    console.log('✅ Git working directory is clean!');
  } catch (error) {
    console.error('❌ ERROR: Failed to check Git status');
    console.error(error);
    process.exit(1);
  }
}

// Run the check
checkGitStatus();