#!/usr/bin/env ts-node

/**
 * SessionHub Quality Metrics Dashboard
 * Real-time quality enforcement metrics
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface QualityMetrics {
  timestamp: string;
  typescript: {
    errors: number;
    warnings: number;
    status: 'pass' | 'fail';
  };
  eslint: {
    errors: number;
    warnings: number;
    status: 'pass' | 'fail';
  };
  console: {
    count: number;
    status: 'pass' | 'fail';
  };
  git: {
    isClean: boolean;
    uncommittedFiles: number;
    status: 'pass' | 'fail';
  };
  overall: {
    status: 'pass' | 'fail';
    compliance: number;
  };
}

async function collectMetrics(): Promise<QualityMetrics> {
  const metrics: QualityMetrics = {
    timestamp: new Date().toISOString(),
    typescript: { errors: 0, warnings: 0, status: 'pass' },
    eslint: { errors: 0, warnings: 0, status: 'pass' },
    console: { count: 0, status: 'pass' },
    git: { isClean: true, uncommittedFiles: 0, status: 'pass' },
    overall: { status: 'pass', compliance: 100 }
  };
  
  console.log('📊 SessionHub Quality Metrics Dashboard');
  console.log('=====================================\n');
  
  // 1. TypeScript Check
  console.log('🔍 TypeScript Compilation...');
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8' });
    console.log('✅ TypeScript: No errors\n');
  } catch (error: any) {
    const output = error.stdout || error.message;
    const errorMatches = output.match(/Found (\d+) error/);
    if (errorMatches) {
      metrics.typescript.errors = parseInt(errorMatches[1]);
      metrics.typescript.status = 'fail';
    }
    console.log(`❌ TypeScript: ${metrics.typescript.errors} errors\n`);
  }
  
  // 2. ESLint Check
  console.log('🔍 ESLint Analysis...');
  try {
    execSync('npm run lint', { encoding: 'utf-8' });
    console.log('✅ ESLint: No violations\n');
  } catch (error: any) {
    const output = error.stdout || error.message || '';
    const errorMatch = output.match(/(\d+)\s+errors?/);
    const warningMatch = output.match(/(\d+)\s+warnings?/);
    
    if (errorMatch) {
      metrics.eslint.errors = parseInt(errorMatch[1]);
      metrics.eslint.status = 'fail';
    }
    if (warningMatch) {
      metrics.eslint.warnings = parseInt(warningMatch[1]);
    }
    
    console.log(`❌ ESLint: ${metrics.eslint.errors} errors, ${metrics.eslint.warnings} warnings\n`);
  }
  
  // 3. Console Statement Check
  console.log('🔍 Console Statement Check...');
  const consoleCount = await countConsoleStatements();
  metrics.console.count = consoleCount;
  if (consoleCount > 0) {
    metrics.console.status = 'fail';
    console.log(`❌ Console Statements: ${consoleCount} found\n`);
  } else {
    console.log('✅ Console Statements: None found\n');
  }
  
  // 4. Git Status Check
  console.log('🔍 Git Working Directory...');
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (gitStatus.trim()) {
      metrics.git.isClean = false;
      metrics.git.uncommittedFiles = gitStatus.split('\n').filter(line => line.trim()).length;
      metrics.git.status = 'fail';
      console.log(`❌ Git: ${metrics.git.uncommittedFiles} uncommitted files\n`);
    } else {
      console.log('✅ Git: Working directory is clean\n');
    }
  } catch (error) {
    metrics.git.status = 'fail';
    console.log('❌ Git: Unable to check status\n');
  }
  
  // Calculate overall compliance
  const checks = [
    metrics.typescript.status === 'pass',
    metrics.eslint.status === 'pass',
    metrics.console.status === 'pass',
    metrics.git.status === 'pass'
  ];
  const passedChecks = checks.filter(check => check).length;
  metrics.overall.compliance = Math.round((passedChecks / checks.length) * 100);
  metrics.overall.status = passedChecks === checks.length ? 'pass' : 'fail';
  
  // Display summary
  console.log('📊 Quality Metrics Summary');
  console.log('=========================');
  console.log(`TypeScript:      ${metrics.typescript.status === 'pass' ? '✅' : '❌'} ${metrics.typescript.errors} errors`);
  console.log(`ESLint:          ${metrics.eslint.status === 'pass' ? '✅' : '❌'} ${metrics.eslint.errors} errors`);
  console.log(`Console:         ${metrics.console.status === 'pass' ? '✅' : '❌'} ${metrics.console.count} statements`);
  console.log(`Git Status:      ${metrics.git.status === 'pass' ? '✅' : '❌'} ${metrics.git.uncommittedFiles} uncommitted`);
  console.log(`\nOverall Status:  ${metrics.overall.status === 'pass' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Compliance:      ${metrics.overall.compliance}%`);
  
  // Save metrics to file
  const metricsPath = path.join(process.cwd(), 'quality-metrics.json');
  let history = [];
  if (fs.existsSync(metricsPath)) {
    try {
      history = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    } catch (e) {
      history = [];
    }
  }
  history.push(metrics);
  // Keep last 100 entries
  if (history.length > 100) {
    history = history.slice(-100);
  }
  fs.writeFileSync(metricsPath, JSON.stringify(history, null, 2));
  
  return metrics;
}

async function countConsoleStatements(): Promise<number> {
  const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
  const excludeDirs = ['node_modules', 'dist', 'dist-electron', 'out', '.next', 'scripts', 'tests', '.husky'];
  let count = 0;
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: excludeDirs.map(dir => `${dir}/**`),
      absolute: true,
      cwd: process.cwd()
    });
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(/console\.(log|error|warn|debug|info|trace|assert|dir|table|time|timeEnd|group|groupEnd)\s*\(/g);
      if (matches) {
        // Filter out commented lines
        const lines = content.split('\n');
        matches.forEach(() => {
          lines.forEach(line => {
            if (line.match(/console\./) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              count++;
            }
          });
        });
      }
    }
  }
  
  return count;
}

// Run metrics collection
collectMetrics().catch(console.error);