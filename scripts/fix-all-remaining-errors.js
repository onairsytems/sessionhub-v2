#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Fix MCPIntegrationManager
const fixIntegrationManager = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'core', 'MCPIntegrationManager.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix unused logger
  content = content.replace(
    "const logger = new Logger('MCPIntegrationManager');",
    "// const logger = new Logger('MCPIntegrationManager');"
  );
  
  // Fix unused parameters
  content = content.replace(
    "async executeTool(integrationId: string, tool: string, input: any): Promise<any> {",
    "async executeTool(integrationId: string, _tool: string, _input: any): Promise<any> {"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationManager');
};

// Fix 2: Fix MCPMockService isOfflineMode
const fixMockService = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'mock', 'MCPMockService.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Comment out isOfflineMode if not used
  const lines = content.split('\n');
  const modifiedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('private isOfflineMode: boolean = false;') && !line.trim().startsWith('//')) {
      // Check if it's used later in the file
      const restOfFile = lines.slice(i + 1).join('\n');
      if (!restOfFile.includes('this.isOfflineMode')) {
        modifiedLines.push('  // ' + line.trim());
      } else {
        modifiedLines.push(line);
      }
    } else {
      modifiedLines.push(line);
    }
  }
  
  content = modifiedLines.join('\n');
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPMockService');
};

// Fix 3: Fix MCPIntegrationMonitor percentile method
const fixIntegrationMonitor = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'monitoring', 'MCPIntegrationMonitor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace the entire percentile method with a more robust version
  const percentileMethod = `private percentile(arr: number[], p: number): number {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0] || 0;
    
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const decimal = index - lower;

    if (lower >= sorted.length) return sorted[sorted.length - 1] || 0;
    if (upper >= sorted.length) return sorted[lower] || 0;
    
    const lowerValue = sorted[lower];
    const upperValue = sorted[upper];
    
    if (lowerValue === undefined) return 0;
    if (upperValue === undefined) return lowerValue;
    
    return lowerValue + (upperValue - lowerValue) * decimal;
  }`;
  
  // Replace the percentile method
  content = content.replace(
    /private percentile\(arr: number\[\], p: number\): number \{[\s\S]*?\n  \}/,
    percentileMethod
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor');
};

// Fix 4: Fix MCPAutomatedTestRunner
const fixAutomatedTestRunner = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPAutomatedTestRunner.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix the compareHealthMetrics method
  content = content.replace(
    /private compareHealthMetrics\([\s\S]*?\): void \{[\s\S]*?\n  \}/,
    `private compareHealthMetrics(
    baseline: IntegrationHealth | undefined,
    current: IntegrationHealth | undefined
  ): void {
    if (!baseline || !current) {
      return;
    }

    // Status change detection
    if (baseline.status && current.status && baseline.status !== current.status) {
      this.emit('health-status-changed', {
        integration: current.integrationId,
        oldStatus: baseline.status,
        newStatus: current.status,
      });
    }

    // Critical failure detection
    if (current.status === 'unhealthy') {
      this.emit('critical-failure', {
        integration: current.integrationId,
        health: current,
      });
    }

    // Performance degradation detection
    if (baseline.responseTime && current.responseTime) {
      const responseDiff = Math.abs(baseline.responseTime - current.responseTime);
      const threshold = baseline.responseTime * 0.2;
      
      if (responseDiff > threshold) {
        this.emit('performance-degradation', {
          integration: current.integrationId,
          baseline: baseline.responseTime,
          current: current.responseTime,
          difference: responseDiff,
        });
      }
    }
  }`
  );
  
  // Remove unused result variable in runChaosScenarios
  content = content.replace(
    "const result = await this.runChaosTest(",
    "await this.runChaosTest("
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner');
};

// Fix 5: Fix MCPIntegrationTestFramework
const fixTestFramework = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPIntegrationTestFramework.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove unused testResults variable completely
  content = content.replace(
    /^\s*const testResults: Map<string, TestResult\[\]> = new Map\(\);.*$/gm,
    ""
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing all remaining TypeScript errors...\n');
  
  try {
    fixIntegrationManager();
    fixMockService();
    fixIntegrationMonitor();
    fixAutomatedTestRunner();
    fixTestFramework();
    
    console.log('\n✅ All remaining TypeScript errors should be fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();