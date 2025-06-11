#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Fix MCPBatchProcessor remaining issues
const fixMCPBatchProcessor = () => {
  const filePath = 'src/services/mcp/batch/MCPBatchProcessor.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused imports
  content = content.replace(
    /import { MCPIntegrationSDK } from '\.\.\/sdk\/MCPIntegrationSDK';\n/,
    ''
  );
  
  // Remove unused type declaration
  content = content.replace(
    /type MCPIntegration = any; \/\/ TODO: Define proper type\n/,
    ''
  );
  
  // Fix Logger.getInstance()
  content = content.replace(
    /this\.logger = Logger\.getInstance\(\);/,
    'this.logger = new Logger(\'MCPBatchProcessor\');'
  );
  
  // Fix Queue import - need to use default export
  content = content.replace(
    /import { Queue } from 'bull';/,
    "import Queue from 'bull';"
  );
  
  // Add startTime to processItem method
  content = content.replace(
    /private async processItem\(item: BatchItem, operation: BatchOperation\): Promise<BatchResult> {\n    \/\/ const startTime = Date\.now\(\); \/\/ Unused/,
    'private async processItem(item: BatchItem, operation: BatchOperation): Promise<BatchResult> {\n    const startTime = Date.now();'
  );
  
  // Fix Promise.allSettled type narrowing
  content = content.replace(
    /for \(let i = 0; i < chunkResults\.length; i\+\+\) {/,
    'for (let i = 0; i < chunkResults.length; i++) {\n        if (!chunkResults[i] || !chunk[i]) continue;'
  );
  
  content = content.replace(
    /if \(result\.status === 'fulfilled'\) {/,
    'if (result && result.status === \'fulfilled\') {'
  );
  
  content = content.replace(
    /const errorResult: BatchResult = {\n            itemId: item\.id,/,
    'const errorResult: BatchResult = {\n            itemId: item ? item.id : \'unknown\','
  );
  
  content = content.replace(
    /error: result\.reason\.message,/,
    'error: result && \'reason\' in result ? (result.reason as any).message : \'Unknown error\','
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPBatchProcessor final issues');
};

// Fix 2: Fix MCPIntegrationMonitor remaining issues
const fixMCPIntegrationMonitor = () => {
  const filePath = 'src/services/mcp/monitoring/MCPIntegrationMonitor.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused import
  content = content.replace(
    /import { MCPIntegrationSDK } from '\.\.\/sdk\/MCPIntegrationSDK';\n/,
    ''
  );
  
  // Fix Logger.getInstance()
  content = content.replace(
    /this\.logger = Logger\.getInstance\(\);/,
    'this.logger = new Logger(\'MCPIntegrationMonitor\');'
  );
  
  // Fix integration.id issue
  content = content.replace(
    /for \(const integration of integrations\) {\n      await this\.initializeHealthCheck\(integration\);\n      this\.startIntegrationMonitoring\(integration\.id\);/,
    'for (const integration of integrations) {\n      if (typeof integration === \'string\') {\n        await this.initializeHealthCheck({ id: integration, name: integration } as any);\n        this.startIntegrationMonitoring(integration);\n      } else {\n        await this.initializeHealthCheck(integration);\n        this.startIntegrationMonitoring(integration.id);\n      }'
  );
  
  // Fix error type assertions
  content = content.replace(
    /this\.logger\.error\('Health check failed for.*?', error\);/g,
    'this.logger.error(`Health check failed for ${integrationId}:`, error as Error);'
  );
  
  content = content.replace(
    /this\.logger\.error\('Failed to fetch active sessions from cloud', error as Error\);/g,
    'this.logger.error(\'Failed to fetch active sessions from cloud\', error as Error);'
  );
  
  // Add null check for responseTimes
  content = content.replace(
    /const sorted = \[\.\.\.responseTimes\]\.sort/,
    'const sorted = responseTimes ? [...responseTimes].sort'
  );
  
  content = content.replace(
    /metrics\.averageResponseTime = sorted\.reduce/,
    'metrics.averageResponseTime = sorted ? sorted.reduce'
  );
  
  content = content.replace(
    /\/ sorted\.length;/,
    '/ sorted.length : 0;'
  );
  
  content = content.replace(
    /metrics\.p95ResponseTime = sorted\[/g,
    'metrics.p95ResponseTime = sorted ? sorted['
  );
  
  content = content.replace(
    /\] \|\| 0;/g,
    '] || 0 : 0;'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor final issues');
};

// Fix 3: Fix MCPResultsAggregator remaining issues
const fixMCPResultsAggregator = () => {
  const filePath = 'src/services/mcp/reporting/MCPResultsAggregator.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix Logger.getInstance()
  content = content.replace(
    /this\.logger = Logger\.getInstance\(\);/,
    'this.logger = new Logger(\'MCPResultsAggregator\');'
  );
  
  // Fix error type assertion
  content = content.replace(
    /this\.logger\.error\('Results aggregation failed:', error\);/,
    'this.logger.error(\'Results aggregation failed:\', error as Error);'
  );
  
  // Remove unused variables
  content = content.replace(
    /const historicalPoints: HistoricalDataPoint\[\] = \[\];/,
    '// const historicalPoints: HistoricalDataPoint[] = []; // Unused'
  );
  
  content = content.replace(
    /private async generatePDFReport\(results: AggregatedResults, reportDir: string\)/,
    'private async generatePDFReport(_results: AggregatedResults, _reportDir: string)'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPResultsAggregator final issues');
};

// Fix 4: Fix MCPAutomatedTestRunner remaining issues
const fixMCPAutomatedTestRunner = () => {
  const filePath = 'src/services/mcp/testing/MCPAutomatedTestRunner.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused import
  content = content.replace(
    /import { MCPIntegrationTestFramework, TestConfig, IntegrationTestReport } from '\.\/MCPIntegrationTestFramework';\nimport { MCPBatchProcessor, BatchOperation } from/,
    'import { MCPIntegrationTestFramework, TestConfig, IntegrationTestReport } from \'./MCPIntegrationTestFramework\';\nimport { MCPBatchProcessor } from'
  );
  
  // Fix Logger.getInstance()
  content = content.replace(
    /this\.logger = Logger\.getInstance\(\);/,
    'this.logger = new Logger(\'MCPAutomatedTestRunner\');'
  );
  
  // Fix error type assertions
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
    '// const startTime = Date.now(); // Unused in this context'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner final issues');
};

// Fix 5: Fix MCPIntegrationTestFramework remaining issues  
const fixMCPIntegrationTestFramework = () => {
  const filePath = 'src/services/mcp/testing/MCPIntegrationTestFramework.ts';
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix Logger.getInstance()
  content = content.replace(
    /this\.logger = Logger\.getInstance\(\);/,
    'this.logger = new Logger(\'MCPIntegrationTestFramework\');'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework final issues');
};

// Main execution
const main = async () => {
  console.log('🔧 Starting final Session 2.9 error fixes...\n');
  
  try {
    fixMCPBatchProcessor();
    fixMCPIntegrationMonitor();
    fixMCPResultsAggregator();
    fixMCPAutomatedTestRunner();
    fixMCPIntegrationTestFramework();
    
    console.log('\n✅ All final Session 2.9 error fixes completed!');
    console.log('🔄 Please run npm run build:check to verify the fixes');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();