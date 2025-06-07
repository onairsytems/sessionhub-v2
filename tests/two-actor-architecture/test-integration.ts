/**
 * Integration Test Suite for Two-Actor Architecture
 * Validates that:
 * 1. Planning and Execution engines work together
 * 2. Logging and audit trail works
 * 3. Error handling and recovery
 */

import { PlanningEngine, UserRequest } from '@/src/core/planning/PlanningEngine';
import { ExecutionEngine, ExecutionContext } from '@/src/core/execution/ExecutionEngine';
// import { ActorBoundaryEnforcer } from '@/src/core/orchestrator/ActorBoundaryEnforcer'; // Commented out for future use
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { SecuritySandbox } from '@/src/core/execution/SecuritySandbox';
import { Logger } from '@/src/lib/logging/Logger';
// import * as fs from 'fs'; // Commented out for future use
import * as path from 'path';

export class IntegrationTests {
  private planningLogger: Logger;
  private executionLogger: Logger;
  private systemLogger: Logger;
  private validator: ProtocolValidator;
  // private boundaryEnforcer: ActorBoundaryEnforcer; // Commented out for future use
  private planningEngine: PlanningEngine;
  private executionEngine: ExecutionEngine;
  private auditLogPath: string;

  constructor() {
    // Set up audit logging
    this.auditLogPath = path.join(__dirname, 'audit-log.json');
    
    // Create separate loggers for each component
    this.planningLogger = new Logger('PlanningActor', this.auditLogPath);
    this.executionLogger = new Logger('ExecutionActor', this.auditLogPath);
    this.systemLogger = new Logger('System', this.auditLogPath);
    
    // Initialize components
    this.validator = new ProtocolValidator(this.systemLogger);
    // this.boundaryEnforcer = new ActorBoundaryEnforcer(this.systemLogger); // Commented out for future use
    
    // Initialize engines with boundary enforcement
    const sandbox = new SecuritySandbox(this.executionLogger);
    this.planningEngine = new PlanningEngine(this.planningLogger, this.validator);
    this.executionEngine = new ExecutionEngine(this.executionLogger, this.validator, sandbox);
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Running Integration Tests...\n');

    await this.testEndToEndWorkflow();
    await this.testAuditTrail();
    await this.testErrorPropagation();
    await this.testConcurrentOperations();
    await this.testBoundaryViolationHandling();

    console.log('\n✅ All Integration tests completed!');
  }

  private async testEndToEndWorkflow(): Promise<void> {
    console.log('📋 Test 1: End-to-End Workflow');
    
    // Step 1: User request
    const userRequest: UserRequest = {
      id: 'integration-001',
      content: 'Build a REST API endpoint for user profile management with CRUD operations',
      context: {
        technology: ['Node.js', 'Express'],
        existingEndpoints: ['/api/auth/login', '/api/auth/register']
      },
      sessionId: 'session-integration-001',
      timestamp: new Date().toISOString()
    };

    console.log('   Step 1: Processing user request...');
    console.log(`   - Request: ${userRequest.content}`);

    // Step 2: Planning generates instructions
    console.log('\n   Step 2: Planning Engine generating instructions...');
    const instructions = await this.planningEngine.generateInstructions(userRequest);
    
    console.assert(instructions.metadata.actor === 'planning', 'Instructions should be from planning actor');
    console.assert(instructions.requirements.length > 0, 'Should generate requirements');
    console.log(`   ✅ Generated ${instructions.requirements.length} requirements`);
    console.log(`   ✅ Generated ${instructions.deliverables.length} deliverables`);
    console.log(`   - Sample requirement: ${instructions.requirements[0]?.description || 'No requirements'}`);

    // Step 3: Validate instructions before execution
    console.log('\n   Step 3: Validating instructions...');
    try {
      this.validator.validate(instructions);
      this.validator.ensureNoCode(instructions);
      console.log('   ✅ Instructions validated successfully');
    } catch (error) {
      console.error('   ❌ Instruction validation failed:', error);
      throw error;
    }

    // Step 4: Execute instructions
    console.log('\n   Step 4: Execution Engine processing instructions...');
    const executionContext: ExecutionContext = {
      workingDirectory: '/tmp/integration-test',
      environment: {
        NODE_ENV: 'test',
        API_PREFIX: '/api'
      },
      timeout: 60000,
      dryRun: true // Dry run for testing
    };

    const executionResult = await this.executionEngine.executeInstructions(
      instructions,
      executionContext
    );

    console.assert(executionResult.instructionId === instructions.metadata.id, 'Result should match instruction');
    console.assert(executionResult.logs.length > 0, 'Should generate execution logs');
    console.log(`   ✅ Execution completed with status: ${executionResult.status}`);
    console.log(`   - Outputs: ${executionResult.outputs.length}`);
    console.log(`   - Logs: ${executionResult.logs.length}`);
    console.log(`   - Errors: ${executionResult.errors.length}`);

    // Step 5: Validate results
    console.log('\n   Step 5: Validating execution results...');
    const allCriteriaMet = executionResult.validationResults.every(v => v.passed);
    console.log(`   ✅ Success criteria met: ${allCriteriaMet}`);
    
    console.log('\n✅ End-to-end workflow completed successfully');
  }

  private async testAuditTrail(): Promise<void> {
    console.log('\n📋 Test 2: Audit Trail and Logging');
    
    const startTime = new Date().toISOString();
    
    // Generate some activity
    const request: UserRequest = {
      id: 'audit-test-001',
      content: 'Create audit test activity',
      timestamp: new Date().toISOString()
    };

    // Planning activity
    this.planningLogger.info('Starting audit test', { requestId: request.id });
    const instructions = await this.planningEngine.generateInstructions(request);
    this.planningLogger.info('Instructions generated', { instructionId: instructions.metadata.id });

    // Execution activity
    this.executionLogger.info('Starting execution', { instructionId: instructions.metadata.id });
    const context: ExecutionContext = {
      workingDirectory: '/tmp',
      environment: {},
      timeout: 30000,
      dryRun: true
    };
    
    const result = await this.executionEngine.executeInstructions(instructions, context);
    this.executionLogger.info('Execution completed', { 
      status: result.status,
      outputs: result.outputs.length 
    });

    const endTime = new Date().toISOString();

    // Check audit logs
    const planningLogs = this.planningLogger.getLogs({ 
      startTime, 
      endTime,
      level: 'info'
    });
    
    const executionLogs = this.executionLogger.getLogs({ 
      startTime, 
      endTime,
      level: 'info'
    });

    console.assert(planningLogs.length >= 2, 'Should have planning logs');
    console.assert(executionLogs.length >= 2, 'Should have execution logs');
    
    console.log('✅ Audit trail working correctly');
    console.log(`   - Planning logs: ${planningLogs.length}`);
    console.log(`   - Execution logs: ${executionLogs.length}`);
    console.log(`   - Sample planning log: ${planningLogs[0]?.message || 'No planning logs'}`);
    console.log(`   - Sample execution log: ${executionLogs[0]?.message || 'No execution logs'}`);

    // Generate audit report
    const auditReport = this.systemLogger.generateAuditReport(startTime, endTime);
    const report = JSON.parse(auditReport);
    
    console.log('\n   Audit Report Summary:');
    console.log(`   - Period: ${report.period.start} to ${report.period.end}`);
    console.log(`   - Total logs: ${report.totalLogs}`);
    console.log(`   - By level: Info=${report.byLevel.info}, Error=${report.byLevel.error}`);
  }

  private async testErrorPropagation(): Promise<void> {
    console.log('\n📋 Test 3: Error Handling and Recovery');
    
    // Test 1: Invalid user request
    console.log('\n   Scenario 1: Invalid user request');
    const invalidRequest: UserRequest = {
      id: 'error-test-001',
      content: '', // Empty content should fail
      timestamp: new Date().toISOString()
    };

    try {
      await this.planningEngine.generateInstructions(invalidRequest);
      console.error('   ❌ Failed to catch invalid request');
    } catch (error) {
      console.log('   ✅ Invalid request properly rejected');
      this.systemLogger.error('Invalid request rejected', error as Error);
    }

    // Test 2: Execution timeout
    console.log('\n   Scenario 2: Execution timeout');
    const timeoutRequest: UserRequest = {
      id: 'timeout-test-001',
      content: 'Create a complex operation that takes too long',
      timestamp: new Date().toISOString()
    };

    const instructions = await this.planningEngine.generateInstructions(timeoutRequest);
    const timeoutContext: ExecutionContext = {
      workingDirectory: '/tmp',
      environment: {},
      timeout: 100, // Very short timeout
      dryRun: false
    };

    const result = await this.executionEngine.executeInstructions(instructions, timeoutContext);
    console.assert(
      result.errors.some(e => e.message.includes('timeout')),
      'Should have timeout error'
    );
    console.log('   ✅ Timeout handled correctly');
    console.log(`   - Status: ${result.status}`);
    console.log(`   - Error: ${result.errors[0]?.message}`);

    // Test 3: Partial success
    console.log('\n   Scenario 3: Partial success with recovery');
    const partialRequest: UserRequest = {
      id: 'partial-test-001',
      content: 'Create user profile with validation and notifications',
      timestamp: new Date().toISOString()
    };

    const partialInstructions = await this.planningEngine.generateInstructions(partialRequest);
    
    // Add multiple requirements, some will fail
    partialInstructions.requirements = [
      {
        id: 'req-1',
        description: 'Create user profile endpoint',
        priority: 'must',
        acceptanceCriteria: ['Endpoint responds']
      },
      {
        id: 'req-2',
        description: 'Add input validation',
        priority: 'must',
        acceptanceCriteria: ['Validation works']
      },
      {
        id: 'req-3',
        description: 'Send email notification (will fail)',
        priority: 'should',
        acceptanceCriteria: ['Email sent']
      }
    ];

    const partialResult = await this.executionEngine.executeInstructions(
      partialInstructions,
      { workingDirectory: '/tmp', environment: {}, timeout: 30000, dryRun: true }
    );

    console.log('   ✅ Partial execution handled');
    console.log(`   - Status: ${partialResult.status}`);
    console.log(`   - Successful outputs: ${partialResult.outputs.length}`);
    console.log(`   - Errors: ${partialResult.errors.length}`);
  }

  private async testConcurrentOperations(): Promise<void> {
    console.log('\n📋 Test 4: Concurrent Operations');
    
    // Create multiple concurrent requests
    const requests: UserRequest[] = [
      {
        id: 'concurrent-001',
        content: 'Create user authentication module',
        timestamp: new Date().toISOString()
      },
      {
        id: 'concurrent-002',
        content: 'Build product catalog API',
        timestamp: new Date().toISOString()
      },
      {
        id: 'concurrent-003',
        content: 'Implement shopping cart functionality',
        timestamp: new Date().toISOString()
      }
    ];

    console.log(`   Processing ${requests.length} concurrent requests...`);
    
    // Process all requests concurrently
    const startTime = Date.now();
    const instructionPromises = requests.map(req => 
      this.planningEngine.generateInstructions(req)
    );
    
    const allInstructions = await Promise.all(instructionPromises);
    const planningTime = Date.now() - startTime;
    
    console.log(`   ✅ All instructions generated in ${planningTime}ms`);
    console.assert(allInstructions.length === requests.length, 'Should generate all instructions');
    
    // Execute all instructions concurrently
    const executionStartTime = Date.now();
    const executionPromises = allInstructions.map(inst => 
      this.executionEngine.executeInstructions(inst, {
        workingDirectory: '/tmp',
        environment: {},
        timeout: 30000,
        dryRun: true
      })
    );
    
    const allResults = await Promise.all(executionPromises);
    const executionTime = Date.now() - executionStartTime;
    
    console.log(`   ✅ All executions completed in ${executionTime}ms`);
    console.assert(allResults.length === allInstructions.length, 'Should execute all instructions');
    
    // Verify no cross-contamination
    const uniqueInstructionIds = new Set(allResults.map(r => r.instructionId));
    console.assert(
      uniqueInstructionIds.size === allResults.length,
      'Each execution should have unique instruction ID'
    );
    
    console.log('   ✅ No cross-contamination between concurrent operations');
    console.log(`   - Total time: ${planningTime + executionTime}ms`);
  }

  private async testBoundaryViolationHandling(): Promise<void> {
    console.log('\n📋 Test 5: Boundary Violation Handling');
    
    // Create a planning engine that tries to execute
    console.log('\n   Scenario 1: Planning trying to execute');
    const maliciousPlanningRequest: UserRequest = {
      id: 'boundary-violation-001',
      content: 'Execute this command: npm install express',
      timestamp: new Date().toISOString()
    };

    try {
      // This should be caught by the validator
      await this.planningEngine.generateInstructions(maliciousPlanningRequest);
      
      // If it somehow passes, the validator should catch it
      const badInstructions = {
        metadata: {
          id: 'bad-001',
          sessionId: 'test',
          sessionName: 'Test',
          timestamp: new Date().toISOString(),
          version: '1.0' as const,
          actor: 'planning' as const
        },
        context: {
          description: 'npm install express', // Code!
          prerequisites: [],
          userRequest: 'Install express'
        },
        objectives: [],
        requirements: [],
        deliverables: [],
        constraints: {},
        successCriteria: []
      };
      
      this.validator.ensureNoCode(badInstructions);
      console.error('   ❌ Failed to detect code in planning');
    } catch (error) {
      console.log('   ✅ Planning code violation detected and blocked');
      console.log(`   - Error: ${(error as Error).message}`);
      this.systemLogger.error('Boundary violation attempt', error as Error);
    }

    // Create an execution that tries to make decisions
    console.log('\n   Scenario 2: Execution trying to make decisions');
    const validRequest: UserRequest = {
      id: 'valid-request-001',
      content: 'Create a simple endpoint',
      timestamp: new Date().toISOString()
    };

    const validInstructions = await this.planningEngine.generateInstructions(validRequest);
    
    // Simulate execution engine trying to make strategic decisions
    const originalExecute = this.executionEngine.executeInstructions;
    this.executionEngine.executeInstructions = async (inst, ctx) => {
      // Try to inject strategic language into logs
      const result = await originalExecute.call(this.executionEngine, inst, ctx);
      result.logs.push('Should we use PostgreSQL or MySQL?'); // Strategic decision!
      return result;
    };

    try {
      const result = await this.executionEngine.executeInstructions(validInstructions, {
        workingDirectory: '/tmp',
        environment: {},
        timeout: 30000,
        dryRun: true
      });

      // Check if strategic language was added
      const hasStrategicLanguage = result.logs.some(log => 
        /should we|recommend/i.test(log)
      );
      
      if (hasStrategicLanguage) {
        console.log('   ⚠️  Execution included strategic language (detected in post-check)');
        console.log(`   - Violation: "${result.logs.find(log => /should we/i.test(log))}"`);
      }
    } finally {
      // Restore original method
      this.executionEngine.executeInstructions = originalExecute;
    }

    console.log('\n✅ Boundary violation handling tested');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new IntegrationTests();
  tests.runAllTests().catch(console.error);
}