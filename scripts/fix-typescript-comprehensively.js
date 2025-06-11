#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: MCPIntegrationManager - prefix unused variables with underscore
const fixIntegrationManager = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'core', 'MCPIntegrationManager.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Change logger to _logger to indicate it's intentionally unused
  content = content.replace(
    /const logger = new Logger\('MCPIntegrationManager'\);/g,
    "const _logger = new Logger('MCPIntegrationManager');"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationManager');
};

// Fix 2: MCPMockService - prefix unused variable with underscore
const fixMockService = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'mock', 'MCPMockService.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Change isOfflineMode to _isOfflineMode to indicate it's intentionally unused for now
  content = content.replace(
    /private isOfflineMode: boolean = false;/g,
    "private _isOfflineMode: boolean = false;"
  );
  
  // Update all references to use _isOfflineMode
  content = content.replace(
    /this\.isOfflineMode/g,
    "this._isOfflineMode"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPMockService');
};

// Fix 3: MCPIntegrationMonitor - fix percentile method completely
const fixIntegrationMonitor = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'monitoring', 'MCPIntegrationMonitor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find and replace the percentile method
  const startIndex = content.indexOf('private percentile(arr: number[], p: number): number {');
  if (startIndex !== -1) {
    let braceCount = 0;
    let endIndex = startIndex;
    let foundStart = false;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (content[i] === '}' && foundStart) {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    const newMethod = `private percentile(arr: number[], p: number): number {
    if (!arr || arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0] ?? 0;
    
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower >= sorted.length - 1) {
      return sorted[sorted.length - 1] ?? 0;
    }
    
    const lowerValue = sorted[lower];
    const upperValue = sorted[upper];
    
    if (lowerValue === undefined || upperValue === undefined) {
      return lowerValue ?? upperValue ?? 0;
    }
    
    const decimal = index - lower;
    return lowerValue + (upperValue - lowerValue) * decimal;
  }`;
    
    content = content.substring(0, startIndex) + newMethod + content.substring(endIndex);
  }
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor');
};

// Fix 4: MCPAutomatedTestRunner - fix all issues
const fixAutomatedTestRunner = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPAutomatedTestRunner.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix undefined 'result' references (should be 'results')
  content = content.replace(
    /duration: result\.duration,/g,
    "duration: results.duration,"
  );
  
  content = content.replace(
    /endTime: result\.endTime/g,
    "endTime: results.endTime"
  );
  
  // Fix compareHealthMetrics to handle undefined properly
  const compareHealthMethod = `private compareHealthMetrics(
    baseline: IntegrationHealth | undefined,
    current: IntegrationHealth | undefined
  ): void {
    // Early return if either is undefined
    if (!baseline || !current) {
      return;
    }

    // Status change detection
    if (baseline.status !== current.status) {
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
    const responseDiff = Math.abs((baseline.responseTime || 0) - (current.responseTime || 0));
    const threshold = (baseline.responseTime || 1) * 0.2;
    
    if (responseDiff > threshold) {
      this.emit('performance-degradation', {
        integration: current.integrationId,
        baseline: baseline.responseTime,
        current: current.responseTime,
        difference: responseDiff,
      });
    }
  }`;
  
  // Replace the compareHealthMetrics method
  const methodStart = content.indexOf('private compareHealthMetrics(');
  if (methodStart !== -1) {
    let braceCount = 0;
    let endIndex = methodStart;
    let foundStart = false;
    
    for (let i = methodStart; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (content[i] === '}' && foundStart) {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    content = content.substring(0, methodStart) + compareHealthMethod + content.substring(endIndex);
  }
  
  // Fix unused 'result' parameter
  content = content.replace(
    /private async sendWebhookNotification\(result: TestRunResult\): Promise<void>/g,
    "private async sendWebhookNotification(_result: TestRunResult): Promise<void>"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPAutomatedTestRunner');
};

// Fix 5: MCPIntegrationTestFramework - remove unused variable
const fixTestFramework = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPIntegrationTestFramework.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find and remove the testResults declaration
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('const testResults: Map<string, TestResult[]>') &&
           !trimmed.startsWith('// const testResults: Map<string, TestResult[]>');
  });
  
  content = filteredLines.join('\n');
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing TypeScript errors comprehensively...\n');
  
  try {
    fixIntegrationManager();
    fixMockService();
    fixIntegrationMonitor();
    fixAutomatedTestRunner();
    fixTestFramework();
    
    console.log('\n✅ All TypeScript errors should be fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();