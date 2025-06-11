#!/usr/bin/env ts-node

import { testOrchestrator } from '../tests/comprehensive/TestOrchestrator';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function runTests() {
  console.log('🚀 SessionHub Comprehensive Testing & Security Audit');
  console.log('=' .repeat(60));
  console.log('Session 2.10: Production Readiness Validation\n');

  // Ensure test results directory exists
  const resultsDir = join(__dirname, '../test-results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  // Clean previous test results
  try {
    execSync('rm -rf test-results/*', { cwd: join(__dirname, '..') });
  } catch {}

  // Install dependencies if needed
  console.log('📦 Checking dependencies...');
  try {
    execSync('npm list playwright', { stdio: 'ignore' });
  } catch {
    console.log('Installing missing test dependencies...');
    execSync('npm install --save-dev playwright @playwright/test axe-core', { stdio: 'inherit' });
  }

  // Run comprehensive tests
  try {
    const result = await testOrchestrator.runComprehensiveTests();

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Overall Score: ${result.score}/100`);
    console.log(`✅ Tests Passed: ${result.passed ? 'YES' : 'NO'}`);
    console.log(`🏭 Production Ready: ${result.productionReadiness ? 'YES' : 'NO'}`);
    
    console.log('\n📋 Test Suite Results:');
    result.suites.forEach(suite => {
      const icon = suite.passed ? '✅' : '❌';
      console.log(`  ${icon} ${suite.category}: ${suite.testsPassed}/${suite.testsRun} passed`);
    });
    
    console.log('\n🔐 Security Audit:');
    console.log(`  Score: ${result.security.score}/100`);
    console.log(`  Critical Issues: ${result.security.criticalVulnerabilities}`);
    console.log(`  High Issues: ${result.security.highVulnerabilities}`);
    
    console.log('\n⚡ Performance Validation:');
    console.log(`  Score: ${result.performance.score}/100`);
    console.log(`  Enterprise Ready: ${result.performance.enterpriseReady ? 'YES' : 'NO'}`);
    
    console.log('\n📈 Code Coverage:');
    console.log(`  Overall: ${result.coverage.overall}%`);
    console.log(`  Statements: ${result.coverage.statements}%`);
    console.log(`  Branches: ${result.coverage.branches}%`);
    console.log(`  Functions: ${result.coverage.functions}%`);
    console.log(`  Lines: ${result.coverage.lines}%`);
    
    console.log('\n🚦 Quality Gates:');
    Object.entries(result.qualityGates).forEach(([gate, passed]) => {
      const icon = passed ? '✅' : '❌';
      console.log(`  ${icon} ${gate}`);
    });
    
    console.log('\n📄 Reports generated in: test-results/');
    console.log('  - comprehensive-test-report.md');
    console.log('  - security-audit-report.md');
    console.log('  - performance-validation-report.md');
    
    if (result.productionReadiness) {
      console.log('\n🎉 CONGRATULATIONS! SessionHub is PRODUCTION READY! 🎉');
      console.log('All tests passed, security validated, and performance verified.');
    } else {
      console.log('\n⚠️  SessionHub is NOT production ready.');
      console.log('Please review the reports and address all issues.');
    }
    
    console.log('\n' + '='.repeat(60));
    
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});