#!/usr/bin/env ts-node

/**
 * Check for errors in the entire project
 */

import { createErrorDetectionSystem } from '../src/core/error-detection';
import { BuildValidation } from '../src/core/error-detection/types';

async function checkErrors() {
  console.log('🔍 Starting error detection...\n');

  const errorSystem = createErrorDetectionSystem({
    enableRealTime: false,
    enableBuildValidation: true,
    strictMode: true
  });

  try {
    const startTime = Date.now();
    const result: BuildValidation = await errorSystem.validate();
    const duration = Date.now() - startTime;
    
    console.log('\n📊 Error Detection Summary');
    console.log('========================');
    console.log(`Total Errors: ${result.blockingErrors.length}`);
    console.log(`Total Warnings: ${result.warnings.length}`);
    console.log(`Build Can Proceed: ${result.canBuild ? '✅ YES' : '❌ NO'}`);
    console.log(`Duration: ${duration}ms`);
    
    // Count errors by severity
    const errorsBySeverity = {
      error: result.blockingErrors.length,
      warning: result.warnings.length
    };
    
    console.log('\n📈 Errors by Severity:');
    Object.entries(errorsBySeverity).forEach(([severity, count]) => {
      console.log(`  ${severity}: ${count}`);
    });
    
    // Count errors by category
    const errorsByCategory: Record<string, number> = {};
    [...result.blockingErrors, ...result.warnings].forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
    });
    
    if (Object.keys(errorsByCategory).length > 0) {
      console.log('\n📁 Errors by Category:');
      Object.entries(errorsByCategory).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    }
    
    if (!result.canBuild && result.blockingErrors.length > 0) {
      console.log('\n❌ Critical Errors (first 10):');
      result.blockingErrors.slice(0, 10).forEach((error: any) => {
        console.log(`\n  ${error.filePath}:${error.line}:${error.column}`);
        console.log(`  ${error.code}: ${error.message}`);
        if (error.suggestion) {
          console.log(`  💡 ${error.suggestion}`);
        }
      });
      
      if (result.blockingErrors.length > 10) {
        console.log(`\n  ... and ${result.blockingErrors.length - 10} more errors`);
      }
    }
    
    process.exit(result.canBuild ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Error detection failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkErrors();
}