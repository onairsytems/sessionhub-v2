#!/usr/bin/env node
/**
 * MCP Integration Testing Demo
 * Demonstrates all Session 2.9 capabilities
 */

import { MCPIntegrationTestFramework } from '../../src/services/mcp/testing/MCPIntegrationTestFramework';
import { MCPBatchProcessor } from '../../src/services/mcp/batch/MCPBatchProcessor';
import { MCPIntegrationMonitor } from '../../src/services/mcp/monitoring/MCPIntegrationMonitor';
import { MCPMockService } from '../../src/services/mcp/mock/MCPMockService';
import { MCPResultsAggregator } from '../../src/services/mcp/reporting/MCPResultsAggregator';
import { MCPAlertManager } from '../../src/services/mcp/alerts/MCPAlertManager';

class MCPIntegrationDemo {
  private testFramework: MCPIntegrationTestFramework;
  private batchProcessor: MCPBatchProcessor;
  private monitor: MCPIntegrationMonitor;
  private mockService: MCPMockService;
  private aggregator: MCPResultsAggregator;
  private alertManager: MCPAlertManager;

  constructor() {
    console.log('🚀 Initializing MCP Integration Testing Demo');
    console.log('=' .repeat(50));
    
    // Initialize all services
    this.testFramework = new MCPIntegrationTestFramework();
    this.batchProcessor = new MCPBatchProcessor();
    this.monitor = new MCPIntegrationMonitor();
    this.mockService = new MCPMockService({
      scenarios: [],
      latencyRange: { min: 50, max: 200 },
      errorRate: 0.01,
      offlineMode: false
    });
    this.aggregator = new MCPResultsAggregator();
    this.alertManager = new MCPAlertManager();
  }

  async runDemo(): Promise<void> {
    try {
      console.log('\n1️⃣ Testing Mock Service Capabilities');
      await this.demonstrateMockService();

      console.log('\n2️⃣ Testing Batch Processing (100+ items)');
      await this.demonstrateBatchProcessing();

      console.log('\n3️⃣ Testing Real-Time Monitoring');
      await this.demonstrateMonitoring();

      console.log('\n4️⃣ Testing Integration Framework');
      await this.demonstrateTestFramework();

      console.log('\n5️⃣ Testing Alert Management');
      await this.demonstrateAlertManagement();

      console.log('\n6️⃣ Generating Comprehensive Report');
      await this.generateReport();

      console.log('\n✅ Demo completed successfully!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  private async demonstrateMockService(): Promise<void> {
    console.log('   • Enabling offline mode for testing');
    this.mockService.enableOfflineMode();

    console.log('   • Testing GitHub integration mock');
    const githubResult = await this.mockService.executeTool(
      'github',
      'list-repos',
      { owner: 'test-user' }
    );
    console.log(`   ✓ GitHub mock response: ${githubResult.data.length} repos`);

    console.log('   • Testing Linear integration mock');
    const linearResult = await this.mockService.executeTool(
      'linear',
      'list-issues',
      { teamId: 'test-team' }
    );
    console.log(`   ✓ Linear mock response: ${linearResult.data.length} issues`);

    console.log('   • Testing error scenario');
    try {
      await this.mockService.executeTool(
        'github',
        'invalid-tool',
        {}
      );
    } catch (error: any) {
      console.log(`   ✓ Error handling works: ${error.message}`);
    }
  }

  private async demonstrateBatchProcessing(): Promise<void> {
    console.log('   • Creating batch with 150 operations');
    
    const operations = Array.from({ length: 150 }, (_, i) => ({
      id: `op-${i}`,
      integrationId: i % 2 === 0 ? 'github' : 'linear',
      type: 'test' as const,
      metadata: { index: i }
    }));

    const batchId = await this.batchProcessor.createBatchOperation(
      'test' as const,
      operations,
      {
        concurrency: 10,
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        continueOnError: true,
        rollbackOnFailure: false,
        progressReportInterval: 5000,
        memoryLimit: 500
      }
    );

    console.log(`   ✓ Batch created: ${batchId}`);

    // Monitor progress
    const progressInterval = setInterval(async () => {
      const operation = await this.batchProcessor.getOperationStatus(batchId);
      if (operation) {
        const progress = operation.progress;
        console.log(`   • Progress: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
        
        if (operation.status === 'completed' || operation.status === 'failed') {
          clearInterval(progressInterval);
        }
      }
    }, 2000);

    // Start processing
    console.log('   • Starting batch processing...');
    await this.batchProcessor.processBatchOperation(batchId);
    
    clearInterval(progressInterval);

    // Get final results
    const results = await this.batchProcessor.getOperationResults(batchId);
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`   ✓ Batch completed: ${successful} successful, ${failed} failed`);

    // Check memory usage
    const memUsage = process.memoryUsage();
    console.log(`   • Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  private async demonstrateMonitoring(): Promise<void> {
    console.log('   • Starting monitoring service');
    await this.monitor.startMonitoring();

    console.log('   • Simulating integration activity');
    
    // Simulate various metrics
    const integrations = ['github', 'linear', 'figma', 'slack'];
    
    for (let i = 0; i < 20; i++) {
      const integration = integrations[i % integrations.length];
      const responseTime = Math.random() * 500 + 50;
      const success = Math.random() > 0.1;
      
      await this.monitor.recordMetric(integration, {
        responseTime,
        success,
        timestamp: new Date()
      });
    }

    console.log('   • Checking integration health');
    for (const integration of integrations) {
      const health = await this.monitor.getIntegrationHealth(integration);
      console.log(`   ✓ ${integration}: ${health.status} (uptime: ${(health.uptime * 100).toFixed(1)}%)`);
    }

    // Get dashboard data
    const dashboardData = await this.monitor.getDashboardData();
    console.log(`   • Active integrations: ${dashboardData.integrations.length}`);
    console.log(`   • Active alerts: ${dashboardData.alerts.length}`);
  }

  private async demonstrateTestFramework(): Promise<void> {
    console.log('   • Running integration tests');

    const testConfig = {
      integration: {
        id: 'github',
        name: 'GitHub',
        tools: [
          { name: 'list-repos', description: 'List repositories' },
          { name: 'create-issue', description: 'Create an issue' }
        ]
      },
      testCases: [
        {
          id: 'test-1',
          name: 'List repositories',
          description: 'Test listing user repositories',
          type: 'integration' as const,
          tool: 'list-repos',
          input: { owner: 'test-user' },
          timeout: 5000
        },
        {
          id: 'test-2',
          name: 'Create issue',
          description: 'Test creating a new issue',
          type: 'integration' as const,
          tool: 'create-issue',
          input: { 
            repo: 'test-repo',
            title: 'Test Issue',
            body: 'This is a test issue'
          },
          timeout: 5000
        }
      ],
      performanceThresholds: {
        maxResponseTime: 1000,
        minThroughput: 10,
        maxMemoryUsage: 100,
        maxCpuUsage: 50
      }
    };

    const report = await this.testFramework.runIntegrationTests(testConfig);
    
    console.log(`   ✓ Tests completed: ${report.passed}/${report.totalTests} passed`);
    console.log(`   • Average response time: ${report.averageResponseTime.toFixed(2)}ms`);
    console.log(`   • Performance score: ${report.performanceScore}/100`);
    console.log(`   • Reliability: ${(report.reliability * 100).toFixed(1)}%`);
  }

  private async demonstrateAlertManagement(): Promise<void> {
    console.log('   • Configuring alert rules');
    
    this.alertManager.configure({
      alerts: [
        {
          id: 'high-response-time',
          name: 'High Response Time',
          integration: 'github',
          condition: 'responseTime > 1000',
          severity: 'warning',
          channels: ['console'],
          enabled: true
        },
        {
          id: 'integration-down',
          name: 'Integration Down',
          integration: '*',
          condition: 'status === "unhealthy"',
          severity: 'critical',
          channels: ['console'],
          enabled: true
        }
      ],
      channels: {
        console: {
          type: 'console',
          config: {}
        }
      },
      throttle: {
        maxAlertsPerHour: 100,
        cooldownMinutes: 5
      }
    });

    console.log('   • Triggering test alerts');
    
    // Simulate high response time
    await this.alertManager.checkAlert({
      alertId: 'high-response-time',
      integration: 'github',
      metrics: {
        responseTime: 1500,
        status: 'healthy'
      }
    });

    // Check active alerts
    const activeAlerts = this.alertManager.getActiveAlerts();
    console.log(`   ✓ Active alerts: ${activeAlerts.length}`);
    
    if (activeAlerts.length > 0) {
      console.log(`   • Alert: ${activeAlerts[0].name} - ${activeAlerts[0].message}`);
    }
  }

  private async generateReport(): Promise<void> {
    console.log('   • Aggregating test results');
    
    // Create sample test results
    const testResults = [
      {
        integrationId: 'github',
        testId: 'perf-test-1',
        timestamp: new Date(),
        results: {
          totalTests: 10,
          passed: 9,
          failed: 1,
          averageResponseTime: 234,
          performanceScore: 85,
          reliability: 0.9
        }
      },
      {
        integrationId: 'linear',
        testId: 'perf-test-2',
        timestamp: new Date(),
        results: {
          totalTests: 8,
          passed: 8,
          failed: 0,
          averageResponseTime: 189,
          performanceScore: 92,
          reliability: 1.0
        }
      }
    ];

    // Add results to aggregator
    for (const result of testResults) {
      this.aggregator.addTestResult(result);
    }

    // Generate reports in multiple formats
    const formats = ['json', 'html', 'csv'];
    
    for (const format of formats) {
      const report = await this.aggregator.generateReport({
        format: format as any,
        includeDetails: true,
        includeTrends: true,
        includeRecommendations: true
      });
      
      console.log(`   ✓ Generated ${format.toUpperCase()} report (${report.data.length} bytes)`);
    }

    // Get aggregated data
    const aggregatedData = this.aggregator.getAggregatedData();
    console.log(`   • Total test runs: ${aggregatedData.totalRuns}`);
    console.log(`   • Overall pass rate: ${(aggregatedData.overallPassRate * 100).toFixed(1)}%`);
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    
    try {
      await this.monitor.stopMonitoring();
      await this.batchProcessor.cleanup();
      console.log('   ✓ Cleanup completed');
    } catch (error) {
      console.error('   ❌ Cleanup error:', error);
    }
  }
}

// Run the demo
if (require.main === module) {
  const demo = new MCPIntegrationDemo();
  demo.runDemo().catch(console.error);
}

export { MCPIntegrationDemo };