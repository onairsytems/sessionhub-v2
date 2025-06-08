#!/usr/bin/env ts-node

/**
 * Start real-time error monitoring
 */

import { createErrorDetectionSystem } from '../src/core/error-detection';

async function startMonitor() {
  console.log('🚀 Starting real-time error monitoring...\n');

  const errorSystem = createErrorDetectionSystem({
    enableRealTime: true,
    enableBuildValidation: true,
    strictMode: true
  });

  // Set up event handlers
  errorSystem.monitor.on('errors', (event) => {
    console.log(`\n❌ Errors detected in ${event.filePath}:`);
    event.errors?.forEach((error: any) => {
      const icon = error.severity === 'error' ? '🔴' : error.severity === 'warning' ? '🟡' : 'ℹ️';
      console.log(`  ${icon} ${error.line}:${error.column} - ${error.message}`);
      if (error.suggestion) {
        console.log(`     💡 ${error.suggestion}`);
      }
    });
  });

  errorSystem.monitor.on('errors-fixed', (event) => {
    console.log(`\n✅ All errors fixed in ${event.filePath}`);
  });

  errorSystem.monitor.on('auto-fix', (event) => {
    console.log(`\n🔧 Auto-fixed ${event.fixedCount} errors in ${event.filePath}`);
  });

  errorSystem.monitor.on('feedback', (feedback) => {
    console.log(`\n${feedback.message}`);
  });

  try {
    await errorSystem.start();
    
    console.log('✅ Real-time monitoring active');
    console.log('👀 Watching files in: src/, app/, pages/, components/');
    console.log('🛑 Press Ctrl+C to stop\n');

    // Keep process running
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping error monitor...');
      await errorSystem.stop();
      
      // Show final summary
      const summary = errorSystem.monitor.getErrorSummary();
      console.log('\n📊 Final Summary:');
      console.log(`  Total files checked: ${summary.totalFiles}`);
      console.log(`  Files with errors: ${summary.filesWithErrors}`);
      console.log(`  Total errors: ${summary.totalErrors}`);
      
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ Failed to start monitoring:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  startMonitor();
}