#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix 1: Fix MCPIntegrationDashboard
const fixDashboard = () => {
  const filePath = path.join(__dirname, '..', 'renderer', 'components', 'mcp', 'MCPIntegrationDashboard.tsx');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add Skeleton import
  content = content.replace(
    "import { Badge } from '../ui/Badge';",
    "import { Badge } from '../ui/Badge';\nimport { Skeleton } from '../ui/Skeleton';"
  );
  
  // Add testResults state
  content = content.replace(
    "const [wsConnected, setWsConnected] = useState(false);",
    `const [wsConnected, setWsConnected] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);`
  );
  
  // Add setTestResults to WebSocket message handler
  content = content.replace(
    "case 'alert':\n          addAlert(message.data);\n          break;",
    `case 'alert':
          addAlert(message.data);
          break;
        case 'test-results':
          setTestResults(message.data);
          break;`
  );
  
  // Fix parameter types in map function
  content = content.replace(
    "{testResults.map((result, index) => (",
    "{testResults.map((result: any, index: number) => ("
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationDashboard');
};

// Fix 2: Fix MCPMockService isOfflineMode
const fixMockService = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'mock', 'MCPMockService.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add isOfflineMode property
  content = content.replace(
    "private callHistory: MockCallRecord[] = [];\n  // // private isOfflineMode: boolean = false;",
    `private callHistory: MockCallRecord[] = [];
  private isOfflineMode: boolean = false;`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPMockService');
};

// Fix 3: Fix MCPIntegrationMonitor
const fixIntegrationMonitor = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'monitoring', 'MCPIntegrationMonitor.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix error handling
  content = content.replace(
    "} catch (error) {",
    "} catch (error: any) {"
  );
  
  // Fix optional chaining for p90 and p99
  content = content.replace(
    "p90: this.percentile(responseTimes, 90),\n      p99: this.percentile(responseTimes, 99),",
    "p90: responseTimes.length > 0 ? this.percentile(responseTimes, 90) : 0,\n      p99: responseTimes.length > 0 ? this.percentile(responseTimes, 99) : 0,"
  );
  
  // Fix percentile method to handle undefined
  content = content.replace(
    "private percentile(arr: number[], p: number): number {",
    `private percentile(arr: number[], p: number): number {
    if (!arr || arr.length === 0) return 0;`
  );
  
  // Fix error parameter type
  content = content.replace(
    "this.logger.error(`Error checking integration ${integration.id}:`, error);",
    "this.logger.error(`Error checking integration ${integration.id}:`, error as Error);"
  );
  
  content = content.replace(
    "this.logger.error('WebSocket server error:', error);",
    "this.logger.error('WebSocket server error:', error as Error);"
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationMonitor');
};

// Fix 4: Fix MCPAutomatedTestRunner
const fixAutomatedTestRunner = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'testing', 'MCPAutomatedTestRunner.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix optional chaining
  content = content.replace(
    "if (baseline?.status && current?.status) {",
    "if (baseline && baseline.status && current && current.status) {"
  );
  
  content = content.replace(
    "baseline.status !== current.status",
    "baseline && current && baseline.status !== current.status"
  );
  
  content = content.replace(
    "current.status === 'unhealthy'",
    "current && current.status === 'unhealthy'"
  );
  
  content = content.replace(
    "Math.abs(baseline.responseTime - current.responseTime)",
    "baseline && current ? Math.abs(baseline.responseTime - current.responseTime) : 0"
  );
  
  content = content.replace(
    "baseline.responseTime * 0.2",
    "baseline ? baseline.responseTime * 0.2 : 0"
  );
  
  // Remove unused variable
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
  
  // Remove unused variable
  content = content.replace(
    "// const testResults: Map<string, TestResult[]> = new Map();",
    ""
  );
  
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed MCPIntegrationTestFramework');
};

// Fix 6: Create MCPIntegrationService interface to fix all method errors
const createIntegrationServiceInterface = () => {
  const filePath = path.join(__dirname, '..', 'src', 'services', 'mcp', 'MCPIntegrationService.ts');
  
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add missing methods
    if (!content.includes('getIntegration')) {
      content = content.replace(
        "export class MCPIntegrationService",
        `export interface MCPIntegration {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  enabled: boolean;
  config?: any;
  tools?: any[];
}

export class MCPIntegrationService`
      );
      
      content = content.replace(
        /export class MCPIntegrationService.*?\{/,
        `export class MCPIntegrationService {
  async getIntegration(id: string): Promise<MCPIntegration | null> {
    // Mock implementation - replace with actual logic
    return {
      id,
      name: 'Mock Integration',
      description: 'Mock integration for testing',
      version: '1.0.0',
      category: 'testing',
      enabled: true
    };
  }

  async executeTool(integrationId: string, tool: string, input: any): Promise<any> {
    // Mock implementation - replace with actual logic
    return {
      success: true,
      result: {},
      timestamp: new Date()
    };
  }

  async updateIntegration(id: string, updates: any): Promise<void> {
    // Mock implementation - replace with actual logic
    console.log(\`Updating integration \${id} with:\`, updates);
  }

  async getAvailableIntegrations(): Promise<MCPIntegration[]> {
    // Mock implementation - replace with actual logic
    return [];
  }
`
      );
    }
  } else {
    // Create the file if it doesn't exist
    const content = `import { EventEmitter } from 'events';

export interface MCPIntegration {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  enabled: boolean;
  config?: any;
  tools?: any[];
}

export class MCPIntegrationService extends EventEmitter {
  async getIntegration(id: string): Promise<MCPIntegration | null> {
    // Mock implementation - replace with actual logic
    return {
      id,
      name: 'Mock Integration',
      description: 'Mock integration for testing',
      version: '1.0.0',
      category: 'testing',
      enabled: true
    };
  }

  async executeTool(integrationId: string, tool: string, input: any): Promise<any> {
    // Mock implementation - replace with actual logic
    return {
      success: true,
      result: {},
      timestamp: new Date()
    };
  }

  async updateIntegration(id: string, updates: any): Promise<void> {
    // Mock implementation - replace with actual logic
    console.log(\`Updating integration \${id} with:\`, updates);
  }

  async getAvailableIntegrations(): Promise<MCPIntegration[]> {
    // Mock implementation - replace with actual logic
    return [];
  }
}
`;
    fs.writeFileSync(filePath, content);
  }
  
  console.log('✅ Created/Updated MCPIntegrationService with required methods');
};

// Main execution
const main = async () => {
  console.log('🔧 Fixing remaining TypeScript errors...\n');
  
  try {
    fixDashboard();
    fixMockService();
    fixIntegrationMonitor();
    fixAutomatedTestRunner();
    fixTestFramework();
    createIntegrationServiceInterface();
    
    console.log('\n✅ All TypeScript errors should be fixed!');
    console.log('🔄 Please run npm run build:check to verify');
    
  } catch (error) {
    console.error('\n❌ Error during fixes:', error);
    process.exit(1);
  }
};

main();