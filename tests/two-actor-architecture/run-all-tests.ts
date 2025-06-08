#!/usr/bin/env node

/**
 * Test Runner for Two-Actor Architecture Validation
 * Runs all test suites and provides a comprehensive report
 */

import { PlanningEngineTests } from './test-planning-engine';
import { ExecutionEngineTests } from './test-execution-engine';
import { BoundaryEnforcementTests } from './test-boundary-enforcement';
import { IntegrationTests } from './test-integration';

interface TestSuite {
  name: string;
  runner: () => Promise<void>;
}

class TwoActorArchitectureTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Planning Engine Tests',
      runner: () => new PlanningEngineTests().runAllTests()
    },
    {
      name: 'Execution Engine Tests',
      runner: () => new ExecutionEngineTests().runAllTests()
    },
    {
      name: 'Boundary Enforcement Tests',
      runner: () => new BoundaryEnforcementTests().runAllTests()
    },
    {
      name: 'Integration Tests',
      runner: () => new IntegrationTests().runAllTests()
    }
  ];

  async runAllTests(): Promise<void> {
    console.log('🎯 Two-Actor Architecture Validation Test Suite');
    console.log('=' .repeat(60));
    console.log('This test suite validates the implementation of the Two-Actor Model');
    console.log('ensuring strict separation between Planning and Execution actors.\n');

    const results: { suite: string; success: boolean; error?: Error }[] = [];
    const startTime = Date.now();

    for (const suite of this.testSuites) {
      console.log('\n' + '='.repeat(60));
      console.log(`🏃 Running: ${suite.name}`);
      console.log('='.repeat(60) + '\n');

      try {
        await suite.runner();
        results.push({ suite: suite.name, success: true });
      } catch (error: any) {
        console.error(`\n❌ ${suite.name} failed:`, error);
        results.push({ 
          suite: suite.name, 
          success: false, 
          error: error as Error 
        });
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Print summary report
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY REPORT');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\nTotal Test Suites: ${results.length}`);
    console.log(`✅ Passed: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    console.log('\nDetailed Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.suite}`);
      if (result.error) {
        console.log(`     Error: ${result.error.message}`);
      }
    });

    // Architecture validation summary
    console.log('\n' + '='.repeat(60));
    console.log('🏛️  TWO-ACTOR ARCHITECTURE VALIDATION');
    console.log('='.repeat(60));
    
    if (failed === 0) {
      console.log('\n✅ All validations PASSED!');
      console.log('\nThe Two-Actor Architecture implementation correctly:');
      console.log('  1. ✅ Separates Planning and Execution responsibilities');
      console.log('  2. ✅ Prevents code patterns in planning instructions');
      console.log('  3. ✅ Ensures execution cannot make strategic decisions');
      console.log('  4. ✅ Enforces strict boundaries between actors');
      console.log('  5. ✅ Maintains comprehensive audit trails');
      console.log('  6. ✅ Handles errors and partial failures gracefully');
      console.log('  7. ✅ Supports concurrent operations without contamination');
      console.log('\n🎉 The Two-Actor Model is properly enforced!');
    } else {
      console.log('\n❌ Some validations FAILED!');
      console.log('\nThe following aspects need attention:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.suite}: ${result.error?.message}`);
      });
      console.log('\n⚠️  The Two-Actor Model implementation needs fixes.');
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  try {
    const runner = new TwoActorArchitectureTestRunner();
    await runner.runAllTests();
  } catch (error: any) {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}