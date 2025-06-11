#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Fix Logger getInstance issue
const fixLoggerUsage = () => {
  const files = [
    'src/services/mcp/batch/MCPBatchProcessor.ts',
    'src/services/mcp/monitoring/MCPIntegrationMonitor.ts',
    'src/services/mcp/testing/MCPIntegrationTestFramework.ts',
    'src/services/mcp/testing/MCPAutomatedTestRunner.ts',
    'src/services/mcp/reporting/MCPResultsAggregator.ts'
  ];

  files.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Fix Logger.getInstance() to new Logger()
    content = content.replace(
      /this\.logger = Logger\.getInstance\(\);/g,
      'this.logger = new Logger();'
    );
    
    fs.writeFileSync(filePath, content);
  });
  
  console.log('✅ Fixed Logger usage');
};

// Fix 2: Fix MCPBatchProcessor specific issues
const fixBatchProcessorIssues = () => {
  const filePath = 'src/services/mcp/batch/MCPBatchProcessor.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused imports
  content = content.replace(
    /import { MCPIntegrationSDK } from '.*?';\n/g,
    ''
  );
  
  content = content.replace(
    /\ntype MCPIntegration = any; \/\/ TODO: Define proper type\n/g,
    ''
  );
  
  // Fix Queue import
  content = content.replace(
    /import { Queue } from 'bull';/,
    "import Queue from 'bull';"
  );
  
  // Add startTime back to processItem
  content = content.replace(
    /private async processItem\(item: BatchItem, operation: BatchOperation\): Promise<BatchResult> {\n    \/\/ const startTime = Date\.now\(\); \/\/ Unused/,
    'private async processItem(item: BatchItem, operation: BatchOperation): Promise<BatchResult> {\n    const startTime = Date.now();'
  );
  
  // Fix Promise.allSettled type narrowing
  content = content.replace(
    /for \(let i = 0; i < chunkResults\.length; i\+\+\) {[\s\S]*?}/g,
    `for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const item = chunk[i];

        if (result && result.status === 'fulfilled') {
          results.push(result.value);
          operation.progress.completed++;
        } else if (result && result.status === 'rejected') {
          const errorResult: BatchResult = {
            itemId: item?.id || 'unknown',
            status: 'failed',
            duration: 0,
            error: result.reason?.message || 'Unknown error',
            timestamp: new Date(),
          };
          results.push(errorResult);
          operation.progress.failed++;

          if (!config.continueOnError) {
            throw new Error(\`Item \${item?.id || 'unknown'} failed: \${result.reason?.message || 'Unknown error'}\`);
          }
        }
      }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPBatchProcessor issues');
};

// Fix 3: Fix MCPIntegrationMonitor issues
const fixMonitorIssues = () => {
  const filePath = 'src/services/mcp/monitoring/MCPIntegrationMonitor.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused import
  content = content.replace(
    /import { MCPIntegrationSDK } from '.*?';\n/g,
    ''
  );
  
  // Fix integration.id issue
  content = content.replace(
    /this\.startIntegrationMonitoring\(integration\.id\);/g,
    'this.startIntegrationMonitoring((integration as any).id || integration);'
  );
  
  // Fix error handling
  content = content.replace(
    /this\.logger\.error\('Health check failed for.*?', error\);/g,
    'this.logger.error(`Health check failed for ${integrationId}:`, error as Error);'
  );
  
  content = content.replace(
    /this\.logger\.error\('Failed to.*?', error as Error\);/g,
    'this.logger.error(arguments[0], error as Error);'
  );
  
  // Fix optional chaining
  content = content.replace(
    /if \(responseTimes\) responseTimes\.push\(responseTime\);/,
    'responseTimes.push(responseTime);'
  );
  
  content = content.replace(
    /if \(responseTimes\.length > 1000\) {/,
    'if (responseTimes && responseTimes.length > 1000) {'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor issues');
};

// Fix 4: Fix test runner issues
const fixTestRunnerIssues = () => {
  const filePath = 'src/services/mcp/testing/MCPAutomatedTestRunner.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused import
  content = content.replace(
    /import { MCPBatchProcessor, BatchOperation } from/,
    'import { MCPBatchProcessor } from'
  );
  
  // Fix error handling
  content = content.replace(
    /this\.logger\.error\('Automated test run failed:', error\);/,
    'this.logger.error(\'Automated test run failed:\', error as Error);'
  );
  
  content = content.replace(
    /result\.summary = `Test run failed: \${error\.message}`;/,
    'result.summary = `Test run failed: ${(error as Error).message}`;'
  );
  
  // Remove unused startTime
  content = content.replace(
    /const startTime = Date\.now\(\);/g,
    '// const startTime = Date.now();'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner issues');
};

// Fix 5: Fix results aggregator issues
const fixResultsAggregatorIssues = () => {
  const filePath = 'src/services/mcp/reporting/MCPResultsAggregator.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix error handling
  content = content.replace(
    /this\.logger\.error\('Results aggregation failed:', error\);/,
    'this.logger.error(\'Results aggregation failed:\', error as Error);'
  );
  
  // Remove unused variables
  content = content.replace(
    /const historicalPoints: HistoricalDataPoint\[\] = \[\];/,
    '// const historicalPoints: HistoricalDataPoint[] = [];'
  );
  
  content = content.replace(
    /private async generatePDFReport\(results: AggregatedResults, reportDir: string\)/,
    'private async generatePDFReport(_results: AggregatedResults, _reportDir: string)'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPResultsAggregator issues');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing remaining errors...\n');
  
  try {
    fixLoggerUsage();
    fixBatchProcessorIssues();
    fixMonitorIssues();
    fixTestRunnerIssues();
    fixResultsAggregatorIssues();
    
    console.log('\n✅ All remaining errors fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();