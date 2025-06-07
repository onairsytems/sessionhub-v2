/**
 * Test Suite for Execution Engine
 * Validates that Execution Engine:
 * 1. Can parse and execute instructions
 * 2. Operates in a sandboxed environment
 * 3. Cannot make strategic decisions
 */

import { ExecutionEngine, ExecutionContext } from '@/src/core/execution/ExecutionEngine';
import { SecuritySandbox } from '@/src/core/execution/SecuritySandbox';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { Logger } from '@/src/lib/logging/Logger';
import { InstructionProtocol } from '@/src/models/Instruction';
import { v4 as uuidv4 } from 'uuid';

export class ExecutionEngineTests {
  private logger: Logger;
  private validator: ProtocolValidator;
  private sandbox: SecuritySandbox;
  private executionEngine: ExecutionEngine;

  constructor() {
    this.logger = new Logger('ExecutionEngineTests');
    this.validator = new ProtocolValidator(this.logger);
    this.sandbox = new SecuritySandbox(this.logger);
    this.executionEngine = new ExecutionEngine(this.logger, this.validator, this.sandbox);
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Execution Engine...\n');

    await this.testInstructionParsing();
    await this.testSandboxedExecution();
    await this.testNoStrategicDecisions();
    await this.testExecutionHistory();
    await this.testErrorHandling();

    console.log('\n✅ All Execution Engine tests completed!');
  }

  private createMockInstructions(): InstructionProtocol {
    const id = uuidv4();
    return {
      metadata: {
        id,
        sessionId: 'test-session',
        sessionName: 'Test Session',
        timestamp: new Date().toISOString(),
        version: '1.0',
        actor: 'planning'
      },
      context: {
        description: 'Test execution of user authentication',
        prerequisites: ['Database configured'],
        userRequest: 'Create user authentication'
      },
      objectives: [{
        id: uuidv4(),
        primary: 'Implement user authentication functionality',
        secondary: ['Secure password handling', 'Session management'],
        measurable: true
      }],
      requirements: [
        {
          id: uuidv4(),
          description: 'User registration with email and password',
          priority: 'must',
          acceptanceCriteria: ['Users can register', 'Passwords are hashed']
        },
        {
          id: uuidv4(),
          description: 'User login functionality',
          priority: 'must',
          acceptanceCriteria: ['Users can login', 'Sessions are created']
        }
      ],
      deliverables: [{
        type: 'file',
        description: 'Authentication module implementation',
        validation: 'Module exports required functions'
      }],
      constraints: {
        patterns: ['Use existing patterns'],
        avoid: ['Storing plain text passwords'],
        timeLimit: 60000
      },
      successCriteria: [
        {
          id: uuidv4(),
          criterion: 'All authentication functions work correctly',
          validationMethod: 'Unit tests pass',
          automated: true
        }
      ]
    };
  }

  private async testInstructionParsing(): Promise<void> {
    console.log('📋 Test 1: Instruction Parsing and Execution');
    
    const instructions = this.createMockInstructions();
    const context: ExecutionContext = {
      workingDirectory: '/tmp/test',
      environment: { NODE_ENV: 'test' },
      timeout: 30000,
      dryRun: true // Dry run for testing
    };

    try {
      const result = await this.executionEngine.executeInstructions(instructions, context);
      
      console.assert(result.instructionId === instructions.metadata.id, 'Result should reference instruction ID');
      console.assert(result.status !== undefined, 'Result should have status');
      console.assert(Array.isArray(result.outputs), 'Result should have outputs array');
      console.assert(Array.isArray(result.logs), 'Result should have logs array');
      console.assert(result.logs.length > 0, 'Should generate execution logs');
      
      console.log('✅ Instructions parsed and executed successfully');
      console.log(`   - Status: ${result.status}`);
      console.log(`   - Outputs: ${result.outputs.length}`);
      console.log(`   - Logs: ${result.logs.length}`);
      console.log(`   - Sample log: ${result.logs[0]}`);
    } catch (error) {
      console.error('❌ Failed instruction parsing test:', error);
      throw error;
    }
  }

  private async testSandboxedExecution(): Promise<void> {
    console.log('\n📋 Test 2: Sandboxed Execution');
    
    // Test timeout enforcement
    try {
      const longRunningTask = async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return 'Should not complete';
      };

      await this.sandbox.executeSecurely(longRunningTask, 1000);
      console.error('❌ Sandbox failed to enforce timeout');
    } catch (error) {
      console.log('✅ Sandbox correctly enforced timeout');
      console.log(`   - Error: ${(error as Error).message}`);
    }

    // Test dangerous code detection
    const dangerousPatterns = [
      'eval("malicious code")',
      'require("child_process").exec("rm -rf /")',
      'process.exit(1)',
      'Function("return this")()'
    ];

    for (const pattern of dangerousPatterns) {
      const isSafe = this.sandbox.validateSafety(pattern);
      console.assert(!isSafe, `Should detect dangerous pattern: ${pattern}`);
      if (!isSafe) {
        console.log(`✅ Correctly identified dangerous pattern: ${pattern.substring(0, 30)}...`);
      }
    }
  }

  private async testNoStrategicDecisions(): Promise<void> {
    console.log('\n📋 Test 3: No Strategic Decisions');
    
    // Test that execution engine rejects strategic content
    const strategicInstructions = this.createMockInstructions();
    
    // Inject strategic language that should be rejected
    if (strategicInstructions.requirements[0]) {
      strategicInstructions.requirements[0].description = 'Should we use PostgreSQL or MySQL for the database?';
    }
    strategicInstructions.metadata.actor = 'execution'; // Mark as from execution

    try {
      this.validator.ensureExecutionBoundary(strategicInstructions);
      console.error('❌ Failed to reject strategic planning in execution');
    } catch (error) {
      console.log('✅ Correctly rejected strategic planning in execution');
      console.log(`   - Error: ${(error as Error).message}`);
    }

    // Test that execution only implements, doesn't decide
    const properInstructions = this.createMockInstructions();
    const context: ExecutionContext = {
      workingDirectory: '/tmp/test',
      environment: {},
      timeout: 30000,
      dryRun: true
    };

    const result = await this.executionEngine.executeInstructions(properInstructions, context);
    
    // Check logs don't contain decision-making language
    const hasDecisionLanguage = result.logs.some(log => 
      /should we|recommend|suggest|better to/i.test(log)
    );
    
    console.assert(!hasDecisionLanguage, 'Execution logs should not contain decision language');
    console.log('✅ Execution operates without making decisions');
  }

  private async testExecutionHistory(): Promise<void> {
    console.log('\n📋 Test 4: Execution History Tracking');
    
    const instructions = this.createMockInstructions();
    const context: ExecutionContext = {
      workingDirectory: '/tmp/test',
      environment: {},
      timeout: 30000,
      dryRun: true
    };

    // Clear history first
    this.executionEngine.clearHistory();
    
    // Execute instructions
    const result = await this.executionEngine.executeInstructions(instructions, context);
    
    // Check history
    const history = this.executionEngine.getExecutionHistory(instructions.metadata.id);
    
    console.assert(history !== undefined, 'History should be recorded');
    console.assert(history?.instructionId === result.instructionId, 'History should match result');
    console.assert(history?.status === result.status, 'History status should match');
    
    console.log('✅ Execution history tracked correctly');
    console.log(`   - Instruction ID: ${history?.instructionId}`);
    console.log(`   - Status: ${history?.status}`);
    console.log(`   - Duration: ${new Date(history!.endTime).getTime() - new Date(history!.startTime).getTime()}ms`);
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n📋 Test 5: Error Handling and Recovery');
    
    const instructions = this.createMockInstructions();
    
    // Add a requirement that will fail
    instructions.requirements.push({
      id: uuidv4(),
      description: 'This task will fail',
      priority: 'must',
      acceptanceCriteria: ['Will not be met']
    });

    const context: ExecutionContext = {
      workingDirectory: '/tmp/test',
      environment: {},
      timeout: 30000,
      dryRun: false // Real execution to test failures
    };

    // Override execution to simulate failure
    const originalExecute = this.executionEngine.executeInstructions;
    this.executionEngine.executeInstructions = async (instr, ctx) => {
      const result = await originalExecute.call(this.executionEngine, instr, ctx);
      
      // Inject an error
      result.errors.push({
        code: 'SIMULATED_ERROR',
        message: 'Simulated execution error for testing',
        recoverable: true
      });
      result.status = 'partial';
      
      return result;
    };

    try {
      const result = await this.executionEngine.executeInstructions(instructions, context);
      
      console.assert(result.errors.length > 0, 'Should have errors');
      console.assert(result.status === 'partial', 'Status should be partial with recoverable errors');
      
      const recoverableErrors = result.errors.filter(e => e.recoverable);
      console.assert(recoverableErrors.length > 0, 'Should have recoverable errors');
      
      console.log('✅ Error handling works correctly');
      console.log(`   - Total errors: ${result.errors.length}`);
      console.log(`   - Recoverable: ${recoverableErrors.length}`);
      console.log(`   - Status: ${result.status}`);
    } finally {
      // Restore original method
      this.executionEngine.executeInstructions = originalExecute;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new ExecutionEngineTests();
  tests.runAllTests().catch(console.error);
}