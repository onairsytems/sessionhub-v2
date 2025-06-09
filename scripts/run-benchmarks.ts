#!/usr/bin/env ts-node

import { ScaleTestingService } from '../src/services/performance/ScaleTestingService';
import { OptimizedDocumentAnalyzer } from '../src/services/performance/OptimizedDocumentAnalyzer';
import { MemoryOptimizationService } from '../src/services/performance/MemoryOptimizationService';
import { AppleSiliconOptimization } from '../src/services/mac/AppleSiliconOptimization';
import { SQLiteOptimizationService } from '../src/services/database/SQLiteOptimizationService';
import * as fs from 'fs';
import * as path from 'path';

async function runBenchmarks() {
  console.log('🚀 SessionHub Production Benchmarks\n');
  console.log('=' .repeat(60));
  console.log('Running performance benchmarks...\n');

  const results: any = {
    timestamp: new Date().toISOString(),
    benchmarks: {},
  };

  // Initialize services
  const scaleService = ScaleTestingService.getInstance();
  const docAnalyzer = OptimizedDocumentAnalyzer.getInstance();
  const memoryService = MemoryOptimizationService.getInstance();
  const siliconService = AppleSiliconOptimization.getInstance();
  const sqliteService = SQLiteOptimizationService.getInstance();

  try {
    // 1. Apple Silicon Benchmark
    console.log('🍎 Running Apple Silicon benchmarks...');
    const siliconBench = await siliconService.runBenchmark();
    results.benchmarks.appleSilicon = siliconBench;
    console.log(`✅ Single-core: ${siliconBench.benchmarks.singleCore} ops/sec`);
    console.log(`✅ Multi-core: ${siliconBench.benchmarks.multiCore} ops/sec\n`);

    // 2. Database Performance Benchmark
    console.log('💾 Running SQLite benchmarks...');
    const dbBench = await sqliteService.runPerformanceTest();
    results.benchmarks.database = dbBench;
    console.log(`✅ Insert: ${Math.round(dbBench.insertPerformance)} ops/sec`);
    console.log(`✅ Select: ${Math.round(dbBench.selectPerformance)} ops/sec`);
    console.log(`✅ Search: ${Math.round(dbBench.searchPerformance)} ops/sec\n`);

    // 3. Document Processing Benchmark
    console.log('📄 Running document processing benchmarks...');
    const testDoc = path.join(process.cwd(), 'test-document.md');
    const testContent = 'Lorem ipsum dolor sit amet. '.repeat(100000); // ~3MB
    await fs.promises.writeFile(testDoc, testContent);
    
    const docStart = Date.now();
    const docResult = await docAnalyzer.analyzeDocument(testDoc);
    const docTime = Date.now() - docStart;
    
    results.benchmarks.documentProcessing = {
      fileSizeMB: Math.round(docResult.fileSize / 1024 / 1024 * 100) / 100,
      processingTime: docTime,
      throughputMBps: Math.round((docResult.fileSize / 1024 / 1024) / (docTime / 1000) * 100) / 100,
    };
    
    console.log(`✅ Processed ${results.benchmarks.documentProcessing.fileSizeMB}MB in ${docTime}ms`);
    console.log(`✅ Throughput: ${results.benchmarks.documentProcessing.throughputMBps}MB/s\n`);
    
    await fs.promises.unlink(testDoc);

    // 4. Memory Management Benchmark
    console.log('💪 Running memory management benchmarks...');
    memoryService.startMonitoring(100);
    
    // Allocate and deallocate memory
    const arrays: any[] = [];
    for (let i = 0; i < 50; i++) {
      arrays.push(new Array(100000).fill(Math.random()));
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const beforeOptimize = memoryService.getMemoryStats();
    
    // Force optimization
    memoryService.forceOptimize();
    arrays.length = 0; // Clear arrays
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const afterOptimize = memoryService.getMemoryStats();
    
    memoryService.stopMonitoring();
    
    results.benchmarks.memory = {
      beforeOptimization: beforeOptimize.current.heapUsed,
      afterOptimization: afterOptimize.current.heapUsed,
      reclaimed: beforeOptimize.current.heapUsed - afterOptimize.current.heapUsed,
      leakDetected: afterOptimize.leakDetection.isLeaking,
    };
    
    console.log(`✅ Memory reclaimed: ${Math.round(results.benchmarks.memory.reclaimed)}MB`);
    console.log(`✅ Leak detection: ${results.benchmarks.memory.leakDetected ? 'LEAK DETECTED' : 'No leaks'}\n`);

    // 5. Concurrent Operations Benchmark
    console.log('🔄 Running concurrent operations benchmark...');
    const concurrentResult = await scaleService.testConcurrentSessions(10);
    results.benchmarks.concurrency = {
      sessionCount: concurrentResult.details.sessionCount,
      totalTime: concurrentResult.details.totalExecutionTime,
      avgSessionTime: concurrentResult.details.averageSessionTime,
      passed: concurrentResult.passed,
    };
    
    console.log(`✅ Handled ${results.benchmarks.concurrency.sessionCount} concurrent sessions`);
    console.log(`✅ Average session time: ${Math.round(results.benchmarks.concurrency.avgSessionTime)}ms\n`);

    // Generate summary
    console.log('=' .repeat(60));
    console.log('📊 Benchmark Summary\n');
    
    const summary = {
      cpuScore: (siliconBench.benchmarks.singleCore + siliconBench.benchmarks.multiCore) / 2,
      dbScore: (dbBench.insertPerformance + dbBench.selectPerformance + dbBench.searchPerformance) / 3,
      docScore: results.benchmarks.documentProcessing.throughputMBps * 100,
      memoryScore: results.benchmarks.memory.leakDetected ? 0 : 100,
      concurrencyScore: results.benchmarks.concurrency.passed ? 100 : 0,
    };
    
    const overallScore = Object.values(summary).reduce((a, b) => a + b, 0) / Object.keys(summary).length;
    
    results.summary = summary;
    results.overallScore = Math.round(overallScore);
    
    console.log(`CPU Performance Score: ${Math.round(summary.cpuScore)}`);
    console.log(`Database Performance Score: ${Math.round(summary.dbScore)}`);
    console.log(`Document Processing Score: ${Math.round(summary.docScore)}`);
    console.log(`Memory Management Score: ${summary.memoryScore}`);
    console.log(`Concurrency Score: ${summary.concurrencyScore}`);
    console.log(`\n🏆 Overall Performance Score: ${results.overallScore}/100`);
    
    // Save results
    const reportPath = path.join(process.cwd(), 'benchmark-results.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${reportPath}`);

    // Performance recommendations
    console.log('\n📝 Performance Recommendations:');
    if (results.overallScore >= 90) {
      console.log('✅ Excellent performance! System is production-ready.');
    } else if (results.overallScore >= 70) {
      console.log('⚠️  Good performance with room for improvement.');
      if (summary.dbScore < 1000) {
        console.log('- Consider optimizing database queries');
      }
      if (summary.memoryScore < 100) {
        console.log('- Memory leak detected - investigate and fix');
      }
    } else {
      console.log('❌ Performance needs optimization before production.');
    }

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    docAnalyzer.dispose();
    memoryService.dispose();
    siliconService.dispose();
    sqliteService.close();
  }
}

// Run benchmarks
if (require.main === module) {
  runBenchmarks().catch(console.error);
}