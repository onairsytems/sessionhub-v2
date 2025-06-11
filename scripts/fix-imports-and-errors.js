#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Update imports in batch processor
const fixBatchProcessorImport = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'batch', 'MCPBatchProcessor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(
    "import { MCPIntegrationService } from '../MCPIntegrationService';",
    "import { MCPIntegrationService } from '../core/MCPIntegrationManager';"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPBatchProcessor import');
};

// Fix 2: Update imports in monitoring
const fixMonitoringImport = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'monitoring', 'MCPIntegrationMonitor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(
    "import { MCPIntegrationService } from '../MCPIntegrationService';",
    "import { MCPIntegrationService } from '../core/MCPIntegrationManager';"
  );
  
  // Fix optional chaining
  content = content.replace(
    /const percentageChange = \(\(current\.value - baseline\.value\) \/ baseline\.value\) \* 100;/g,
    'const percentageChange = baseline?.value ? ((current.value - baseline.value) / baseline.value) * 100 : 0;'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor import');
};

// Fix 3: Update imports in test framework
const fixTestFrameworkImport = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPIntegrationTestFramework.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(
    "import { MCPIntegrationService } from '../MCPIntegrationService';",
    "import { MCPIntegrationService } from '../core/MCPIntegrationManager';"
  );
  
  // Remove unused testResults
  content = content.replace(
    '// const testResults: Map<string, TestResult[]> = new Map();',
    ''
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework import');
};

// Fix 4: Update imports in automated test runner
const fixTestRunnerImport = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPAutomatedTestRunner.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(
    "import { MCPIntegrationService } from '../MCPIntegrationService';",
    "import { MCPIntegrationService } from '../core/MCPIntegrationManager';"
  );
  
  // Remove unused result variable
  content = content.replace(
    /const result = await this\.testFramework\.runIntegrationTests\(/g,
    'await this.testFramework.runIntegrationTests('
  );
  
  // Fix optional chaining for comparisons
  content = content.replace(
    /if \(baseline\.status === 'passed' && current\.status === 'failed'\) {/g,
    "if (baseline?.status === 'passed' && current?.status === 'failed') {"
  );
  
  content = content.replace(
    /if \(baseline\.responseTime && current\.responseTime\) {/g,
    'if (baseline?.responseTime && current?.responseTime) {'
  );
  
  content = content.replace(
    /if \(baseline\.throughput && current\.throughput\) {/g,
    'if (baseline?.throughput && current?.throughput) {'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner import');
};

// Fix 5: Fix dashboard import
const fixDashboardImport = () => {
  const filePath = path.join(__dirname, '..', 'renderer', 'components', 'mcp', 'MCPIntegrationDashboard.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Update Skeleton import path
  content = content.replace(
    "import { Skeleton } from '../ui/Skeleton';",
    "import { Skeleton } from '../../../components/ui/Skeleton';"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationDashboard import');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing imports and remaining errors...\n');
  
  try {
    fixBatchProcessorImport();
    fixMonitoringImport();
    fixTestFrameworkImport();
    fixTestRunnerImport();
    fixDashboardImport();
    
    console.log('\n✅ All imports and errors fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();