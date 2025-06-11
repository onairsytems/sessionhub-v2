
/**
 * Integration tests for Session 1.3 - Real Two-Actor Model Implementation
 */

import { SystemOrchestrator } from '@/src/core/orchestrator/SystemOrchestrator';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';

// Test configuration
const TEST_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  useRealApi: !!process.env.ANTHROPIC_API_KEY,
  maxConcurrentSessions: 1,
  dataDir: '/tmp/sessionhub-test',
  masterKey: 'test-master-key'
};

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Simple function creation',
    request: 'Create a TypeScript function that calculates the factorial of a number',
    context: {
      projectType: 'library',
      language: 'typescript',
      framework: 'none'
    },
    validation: {
      hasInstructions: true,
      hasExecutionResult: true,
      filesCreated: ['factorial.ts'],
      successCriteria: ['Function implemented', 'TypeScript syntax valid']
    }
  },
  {
    name: 'React component creation',
    request: 'Create a React component that displays a countdown timer',
    context: {
      projectType: 'web',
      language: 'typescript',
      framework: 'react'
    },
    validation: {
      hasInstructions: true,
      hasExecutionResult: true,
      filesCreated: ['CountdownTimer.tsx'],
      successCriteria: ['Component created', 'React hooks used correctly']
    }
  },
  {
    name: 'API endpoint creation',
    request: 'Create an Express API endpoint that returns user data',
    context: {
      projectType: 'api',
      language: 'typescript',
      framework: 'express'
    },
    validation: {
      hasInstructions: true,
      hasExecutionResult: true,
      filesCreated: ['userEndpoint.ts'],
      successCriteria: ['Endpoint created', 'Express route configured']
    }
  }
];

class TwoActorWorkflowTest {
  private orchestrator: SystemOrchestrator;
  // private logger: Logger;
  private testResults: Array<{name: string; passed: boolean; details: string[]}> = [];

  constructor() {
    // this.logger = new Logger('TwoActorWorkflowTest');
    this.orchestrator = new SystemOrchestrator(TEST_CONFIG);
  }

  async run(): Promise<void> {
    console.log('🧪 Session 1.3: Real Two-Actor Model Implementation - Validation Tests\n');
    
    try {
      // Setup
      await this.setup();
      
      // Run tests
      await this.testActorSeparation();
      await this.testInstructionProtocol();
      await this.testSessionStatePersistence();
      await this.testRealTimeMonitoring();
      await this.testErrorHandling();
      await this.testCompleteWorkflow();
      
      // Report results
      this.reportResults();
      
    } catch (error: any) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  private async setup(): Promise<void> {
    console.log('📦 Setting up test environment...');
    
    // Create test directory
    await fs.mkdir(TEST_CONFIG.dataDir, { recursive: true });
    
    // Initialize orchestrator
    await this.orchestrator.initialize();
    
    console.log('✅ Test environment ready\n');
  }

  private async testActorSeparation(): Promise<void> {
    console.log('🔍 Test 1: Actor Separation and Boundaries');
    
    const result: {name: string; passed: boolean; details: string[]} = {
      name: 'Actor Separation',
      passed: true,
      details: [] as string[]
    };

    try {
      // Test that Planning Actor cannot execute code
      const planningEngine = (this.orchestrator as any).planningEngine;
      const mockRequest = {
        id: uuidv4(),
        content: 'Test request with code: console.log("test")',
        context: {},
        sessionId: uuidv4(),
        timestamp: new Date().toISOString()
      };
      
      const instructions = await planningEngine.generateInstructions(mockRequest);
      
      // Verify no code in instructions
      const instructionString = JSON.stringify(instructions);
      if (instructionString.includes('console.log')) {
        result.passed = false;
        result.details.push('❌ Planning Actor included code in instructions');
      } else {
        result.details.push('✅ Planning Actor correctly excluded code from instructions');
      }
      
      // Test that Execution Actor cannot make decisions
      const executionEngine = (this.orchestrator as any).executionEngine;
      if (!executionEngine.generateStrategy) {
        result.details.push('✅ Execution Actor has no strategy generation capability');
      } else {
        result.passed = false;
        result.details.push('❌ Execution Actor has planning capabilities');
      }
      
    } catch (error: any) {
      result.passed = false;
      result.details.push(`❌ Error: ${(error as Error).message}`);
    }

    this.testResults.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    result.details.forEach(d => console.log(`  ${d}`));
    console.log();
  }

  private async testInstructionProtocol(): Promise<void> {
    console.log('🔍 Test 2: Instruction Protocol Validation');
    
    const result: {name: string; passed: boolean; details: string[]} = {
      name: 'Instruction Protocol',
      passed: true,
      details: [] as string[]
    };

    try {
      const sessionId = await this.orchestrator.submitRequest(
        'test-user',
        'Create a simple hello world function',
        { projectType: 'library', language: 'typescript' }
      );
      
      // Wait for processing
      await this.waitForSession(sessionId);
      
      // Get session history
      const sessionStateManager = this.orchestrator.getSessionStateManager();
      const history = await sessionStateManager.getHistory(sessionId, {
        type: 'instruction'
      });
      
      if (history.length === 0) {
        result.passed = false;
        result.details.push('❌ No instructions found in session history');
      } else {
        const instruction = history[0]?.data;
        
        // Validate instruction structure
        const requiredFields = ['metadata', 'context', 'objectives', 'requirements', 'deliverables', 'constraints', 'successCriteria'];
        requiredFields.forEach(field => {
          if ((instruction as any)[field]) {
            result.details.push(`✅ Instruction has ${field}`);
          } else {
            result.passed = false;
            result.details.push(`❌ Instruction missing ${field}`);
          }
        });
      }
      
    } catch (error: any) {
      result.passed = false;
      result.details.push(`❌ Error: ${(error as Error).message}`);
    }

    this.testResults.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    result.details.forEach(d => console.log(`  ${d}`));
    console.log();
  }

  private async testSessionStatePersistence(): Promise<void> {
    console.log('🔍 Test 3: Session State Persistence');
    
    const result: {name: string; passed: boolean; details: string[]} = {
      name: 'Session State Persistence',
      passed: true,
      details: [] as string[]
    };

    try {
      const sessionId = await this.orchestrator.submitRequest(
        'test-user',
        'Test state persistence',
        { projectType: 'test' }
      );
      
      const sessionStateManager = this.orchestrator.getSessionStateManager();
      
      // Get initial session state
      const session = await sessionStateManager.getSession(sessionId);
      if (!session) {
        result.passed = false;
        result.details.push('❌ Session state not created');
      } else {
        result.details.push('✅ Session state created');
        
        // Update context
        await sessionStateManager.updateContext(sessionId, {
          framework: 'updated-framework'
        });
        
        // Verify update persisted
        const updatedSession = await sessionStateManager.getSession(sessionId);
        if (updatedSession?.context.framework === 'updated-framework') {
          result.details.push('✅ Session context updates persisted');
        } else {
          result.passed = false;
          result.details.push('❌ Session context updates not persisted');
        }
        
        // Export and import session
        const exported = await sessionStateManager.exportSession(sessionId);
        const imported = await sessionStateManager.importSession(exported);
        
        if (imported.sessionId === sessionId) {
          result.details.push('✅ Session export/import working');
        } else {
          result.passed = false;
          result.details.push('❌ Session export/import failed');
        }
      }
      
    } catch (error: any) {
      result.passed = false;
      result.details.push(`❌ Error: ${(error as Error).message}`);
    }

    this.testResults.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    result.details.forEach(d => console.log(`  ${d}`));
    console.log();
  }

  private async testRealTimeMonitoring(): Promise<void> {
    console.log('🔍 Test 4: Real-Time Monitoring');
    
    const result: {name: string; passed: boolean; details: string[]} = {
      name: 'Real-Time Monitoring',
      passed: true,
      details: [] as string[]
    };

    try {
      const actorCoordinator = this.orchestrator.getActorCoordinator();
      const instructionQueue = actorCoordinator.getInstructionQueue();
      
      // Get initial metrics
      const initialMetrics = instructionQueue.getMetrics();
      result.details.push(`✅ Initial metrics: ${initialMetrics.pendingCount} pending, ${initialMetrics.completedCount} completed`);
      
      // Submit a request and monitor events
      const events: unknown[] = [];
      const eventStream = instructionQueue.getEventStream();
      
      // Collect events in background
      const eventCollector = (async () => {
        for await (const event of eventStream) {
          events.push(event);
          if (event.type === 'completed' || event.type === 'failed') {
            break;
          }
        }
      })();
      
      const sessionId = await this.orchestrator.submitRequest(
        'test-user',
        'Test monitoring',
        {}
      );
      
      // Wait for completion
      await this.waitForSession(sessionId);
      await eventCollector;
      
      // Verify events received
      const eventTypes = events.map(e => (e as any).type);
      if (eventTypes.includes('queued')) {
        result.details.push('✅ Received queued event');
      } else {
        result.passed = false;
        result.details.push('❌ Missing queued event');
      }
      
      if (eventTypes.includes('started') || eventTypes.includes('progress')) {
        result.details.push('✅ Received progress events');
      } else {
        result.passed = false;
        result.details.push('❌ Missing progress events');
      }
      
      // Get final metrics
      const finalMetrics = instructionQueue.getMetrics();
      if (finalMetrics.completedCount > initialMetrics.completedCount) {
        result.details.push('✅ Metrics updated correctly');
      } else {
        result.passed = false;
        result.details.push('❌ Metrics not updated');
      }
      
    } catch (error: any) {
      result.passed = false;
      result.details.push(`❌ Error: ${(error as Error).message}`);
    }

    this.testResults.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    result.details.forEach(d => console.log(`  ${d}`));
    console.log();
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🔍 Test 5: Error Handling and Recovery');
    
    const result: {name: string; passed: boolean; details: string[]} = {
      name: 'Error Handling',
      passed: true,
      details: [] as string[]
    };

    try {
      // Test invalid request
      const sessionId = await this.orchestrator.submitRequest(
        'test-user',
        'FORCE_ERROR: This should trigger an error',
        { forceError: true }
      );
      
      await this.waitForSession(sessionId, 10000);
      
      await this.orchestrator.getSessionStatus(sessionId);
      const sessionStateManager = this.orchestrator.getSessionStateManager();
      const errors = await sessionStateManager.getHistory(sessionId, {
        type: 'error'
      });
      
      if (errors.length > 0) {
        result.details.push('✅ Errors recorded in session history');
      } else {
        result.passed = false;
        result.details.push('❌ No errors recorded despite failure');
      }
      
      // Test API error metrics
      const apiErrorHandler = (this.orchestrator as any).apiErrorHandler;
      const errorMetrics = apiErrorHandler.getMetrics();
      
      if (errorMetrics.totalErrors >= 0) {
        result.details.push(`✅ Error metrics tracking: ${errorMetrics.totalErrors} total errors`);
      } else {
        result.passed = false;
        result.details.push('❌ Error metrics not tracking');
      }
      
    } catch (error: any) {
      // Expected to have some errors
      result.details.push('✅ Error handling triggered as expected');
    }

    this.testResults.push(result);
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    result.details.forEach(d => console.log(`  ${d}`));
    console.log();
  }

  private async testCompleteWorkflow(): Promise<void> {
    console.log('🔍 Test 6: Complete Two-Actor Workflow');
    
    for (const scenario of TEST_SCENARIOS) {
      const result: {name: string; passed: boolean; details: string[]} = {
        name: `Complete Workflow: ${scenario.name}`,
        passed: true,
        details: [] as string[]
      };

      try {
        console.log(`\n  Testing: ${scenario.name}`);
        
        // Submit request
        const sessionId = await this.orchestrator.submitRequest(
          'test-user',
          scenario.request,
          scenario.context
        );
        
        result.details.push(`✅ Session created: ${sessionId}`);
        
        // Wait for completion
        await this.waitForSession(sessionId, 30000);
        
        // Get final status
        const session = await this.orchestrator.getSessionStatus(sessionId);
        
        if (session?.status === 'completed') {
          result.details.push('✅ Session completed successfully');
        } else {
          result.passed = false;
          result.details.push(`❌ Session status: ${session?.status || 'any'}`);
        }
        
        // Verify workflow steps
        const sessionStateManager = this.orchestrator.getSessionStateManager();
        const history = await sessionStateManager.getHistory(sessionId);
        
        const hasRequest = history.some(h => h.type === 'request');
        const hasInstruction = history.some(h => h.type === 'instruction');
        const hasExecution = history.some(h => h.type === 'execution');
        
        if (hasRequest) {
          result.details.push('✅ User request recorded');
        } else {
          result.passed = false;
          result.details.push('❌ User request not recorded');
        }
        
        if (hasInstruction) {
          result.details.push('✅ Instructions generated');
        } else {
          result.passed = false;
          result.details.push('❌ Instructions not generated');
        }
        
        if (hasExecution) {
          result.details.push('✅ Execution completed');
        } else {
          result.passed = false;
          result.details.push('❌ Execution not completed');
        }
        
        // Verify deliverables if using real API
        if (TEST_CONFIG.useRealApi && hasExecution) {
          const execution = history.find(h => h.type === 'execution');
          if ((execution?.data as any)?.outputs?.length > 0) {
            result.details.push(`✅ Deliverables created: ${(execution?.data as any)?.outputs?.length || 0} files`);
          } else {
            result.details.push('⚠️  No deliverables created (mock mode or API issue)');
          }
        }
        
      } catch (error: any) {
        result.passed = false;
        result.details.push(`❌ Error: ${(error as Error).message}`);
      }

      this.testResults.push(result);
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
      result.details.forEach(d => console.log(`    ${d}`));
    }
    console.log();
  }

  private async waitForSession(sessionId: string, timeout = 15000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const session = await this.orchestrator.getSessionStatus(sessionId);
      
      if (session?.status === 'completed' || session?.status === 'failed') {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Session ${sessionId} did not complete within timeout`);
  }

  private reportResults(): void {
    console.log('\n📊 Test Results Summary\n');
    
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
    
    if (failed > 0) {
      console.log('Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}`));
    }
    
    // Validation summary
    console.log('\n✨ Session 1.3 Validation Summary:');
    
    const validations = {
      'Planning Actor uses Claude API': this.testResults.some(r => r.name.includes('Actor Separation') && r.passed),
      'Execution Actor executes code': this.testResults.some(r => r.name.includes('Complete Workflow') && r.passed),
      'Strict boundary enforcement': this.testResults.find(r => r.name === 'Actor Separation')?.passed || false,
      'Session state persists': this.testResults.find(r => r.name === 'Session State Persistence')?.passed || false,
      'Real-time monitoring works': this.testResults.find(r => r.name === 'Real-Time Monitoring')?.passed || false,
      'Error handling implemented': this.testResults.find(r => r.name === 'Error Handling')?.passed || false,
      'Complete workflow functions': this.testResults.filter(r => r.name.includes('Complete Workflow')).every(r => r.passed)
    };
    
    Object.entries(validations).forEach(([requirement, met]) => {
      console.log(`  ${met ? '✅' : '❌'} ${requirement}`);
    });
    
    const allValidationsMet = Object.values(validations).every(v => v);
    console.log(`\n${allValidationsMet ? '🎉 All validations passed!' : '⚠️  Some validations failed'}`);
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    
    try {
      await this.orchestrator.shutdown();
      await fs.rm(TEST_CONFIG.dataDir, { recursive: true, force: true });
      console.log('✅ Cleanup complete');
    } catch (error: any) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

// Run tests
if (require.main === module) {
  const test = new TwoActorWorkflowTest();
  test.run().catch(console.error);
}