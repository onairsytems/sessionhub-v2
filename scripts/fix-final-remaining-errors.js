#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Fix MCPBatchProcessor tools check
const fixBatchProcessor = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'batch', 'MCPBatchProcessor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix tools possibly undefined
  content = content.replace(
    "const tool = integration.tools.find(t => t.name === item.tool);",
    "const tool = integration.tools?.find((t: any) => t.name === item.tool);"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPBatchProcessor');
};

// Fix 2: Fix MCPMockService unused variable
const fixMockService = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'mock', 'MCPMockService.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused variable declaration
  content = content.replace(
    "private isOfflineMode: boolean = false;",
    "// private isOfflineMode: boolean = false;"
  );
  
  // But keep the usage in methods (uncomment them)
  content = content.replace(
    "// private isOfflineMode: boolean = false;",
    "private isOfflineMode: boolean = false;"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPMockService');
};

// Fix 3: Fix MCPIntegrationMonitor percentile method
const fixIntegrationMonitor = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'monitoring', 'MCPIntegrationMonitor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix percentile method to handle edge cases better
  content = content.replace(
    /private percentile\(arr: number\[\], p: number\): number \{[\s\S]*?const lower = Math\.floor\(index\);[\s\S]*?return sorted\[lower\] \+ \(sorted\[upper\] - sorted\[lower\]\) \* decimal;[\s\S]*?\}/,
    `private percentile(arr: number[], p: number): number {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const decimal = index - lower;

    if (lower >= sorted.length) return sorted[sorted.length - 1] || 0;
    if (upper >= sorted.length) return sorted[lower] || 0;
    
    const lowerValue = sorted[lower] || 0;
    const upperValue = sorted[upper] || 0;
    
    return lowerValue + (upperValue - lowerValue) * decimal;
  }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor');
};

// Fix 4: Fix MCPAutomatedTestRunner optional chaining
const fixAutomatedTestRunner = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPAutomatedTestRunner.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix all the optional chaining issues
  content = content.replace(
    "baseline && current && baseline.status !== current.status",
    "(baseline && current && baseline.status !== current.status)"
  );
  
  content = content.replace(
    "current && current.status === 'unhealthy'",
    "(current && current.status === 'unhealthy')"
  );
  
  content = content.replace(
    "baseline && current ? Math.abs(baseline.responseTime - current.responseTime) : 0",
    "(baseline && current ? Math.abs((baseline.responseTime || 0) - (current.responseTime || 0)) : 0)"
  );
  
  content = content.replace(
    "baseline ? baseline.responseTime * 0.2 : 0",
    "(baseline && baseline.responseTime ? baseline.responseTime * 0.2 : 0)"
  );
  
  // Remove unused result variable
  content = content.replace(
    /const result = await this\.runChaosTest\(/g,
    "await this.runChaosTest("
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner');
};

// Fix 5: Fix MCPIntegrationTestFramework
const fixTestFramework = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPIntegrationTestFramework.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove the entire unused variable line
  content = content.replace(
    /^\s*\/\/ const testResults: Map<string, TestResult\[\]> = new Map\(\);.*$/gm,
    ""
  );
  
  // Also remove the actual declaration if it exists
  content = content.replace(
    /^\s*const testResults: Map<string, TestResult\[\]> = new Map\(\);.*$/gm,
    ""
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing final remaining TypeScript errors...\n');
  
  try {
    fixBatchProcessor();
    fixMockService();
    fixIntegrationMonitor();
    fixAutomatedTestRunner();
    fixTestFramework();
    
    console.log('\n✅ All final TypeScript errors should be fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();