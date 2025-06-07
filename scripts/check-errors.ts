#!/usr/bin/env ts-node

/**
 * Check for errors in the entire project
 */

import { createErrorDetectionSystem } from '../src/core/error-detection';

async function checkErrors() {
  console.log('🔍 Starting error detection...\n');

  const errorSystem = createErrorDetectionSystem({
    enableRealTime: false,
    enableBuildValidation: true,
    strictMode: true
  });

  try {
    const result = await errorSystem.validate();
    
    console.log('\n📊 Error Detection Summary');
    console.log('========================');
    console.log(`Total Errors: ${result.totalErrors}`);
    console.log(`Build Can Proceed: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`Duration: ${result.duration}ms`);
    
    if (result.errorsBySeverity) {
      console.log('\n📈 Errors by Severity:');
      Object.entries(result.errorsBySeverity).forEach(([severity, count]) => {
        console.log(`  ${severity}: ${count}`);
      });
    }
    
    if (result.errorsByCategory) {
      console.log('\n📁 Errors by Category:');
      Object.entries(result.errorsByCategory).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    }
    
    if (!result.success && result.errors) {
      console.log('\n❌ Critical Errors (first 10):');
      result.errors.slice(0, 10).forEach(error => {
        console.log(`\n  ${error.filePath}:${error.line}:${error.column}`);
        console.log(`  ${error.code}: ${error.message}`);
        if (error.suggestion) {
          console.log(`  💡 ${error.suggestion}`);
        }
      });
      
      if (result.errors.length > 10) {
        console.log(`\n  ... and ${result.errors.length - 10} more errors`);
      }
    }
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Error detection failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkErrors();
}