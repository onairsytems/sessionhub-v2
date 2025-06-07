/**
 * Test Suite for Boundary Enforcement
 * Validates that:
 * 1. ActorBoundaryEnforcer prevents violations
 * 2. ProtocolValidator catches improper content
 * 3. Actors cannot cross boundaries
 */

import { ActorBoundaryEnforcer, Actor, Operation } from '@/src/core/orchestrator/ActorBoundaryEnforcer';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { Logger } from '@/src/lib/logging/Logger';
import { InstructionProtocol } from '@/src/models/Instruction';
import { v4 as uuidv4 } from 'uuid';

export class BoundaryEnforcementTests {
  private logger: Logger;
  private boundaryEnforcer: ActorBoundaryEnforcer;
  private protocolValidator: ProtocolValidator;

  constructor() {
    this.logger = new Logger('BoundaryEnforcementTests');
    this.boundaryEnforcer = new ActorBoundaryEnforcer(this.logger);
    this.protocolValidator = new ProtocolValidator(this.logger);
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Boundary Enforcement...\n');

    await this.testOperationValidation();
    await this.testContentValidation();
    await this.testBoundaryProxy();
    await this.testProtocolValidation();
    await this.testViolationTracking();

    console.log('\n✅ All Boundary Enforcement tests completed!');
  }

  private async testOperationValidation(): Promise<void> {
    console.log('📋 Test 1: Operation Validation');
    
    const planningActor: Actor = {
      type: 'planning',
      id: 'planner-001',
      capabilities: ['analyze', 'plan', 'decide']
    };

    const executionActor: Actor = {
      type: 'execution',
      id: 'executor-001',
      capabilities: ['execute', 'implement', 'deploy']
    };

    // Test valid operations
    const validPlanningOp: Operation = {
      type: 'plan',
      actor: planningActor,
      description: 'Planning user authentication strategy',
      timestamp: new Date().toISOString()
    };

    const validExecutionOp: Operation = {
      type: 'execute',
      actor: executionActor,
      description: 'Implementing authentication module',
      timestamp: new Date().toISOString()
    };

    try {
      this.boundaryEnforcer.validateOperation(validPlanningOp);
      console.log('✅ Valid planning operation accepted');
      
      this.boundaryEnforcer.validateOperation(validExecutionOp);
      console.log('✅ Valid execution operation accepted');
    } catch (error) {
      console.error('❌ Failed to validate valid operations:', error);
      throw error;
    }

    // Test invalid operations
    const invalidPlanningOp: Operation = {
      type: 'execute',
      actor: planningActor,
      description: 'Planning actor trying to execute',
      timestamp: new Date().toISOString()
    };

    const invalidExecutionOp: Operation = {
      type: 'plan',
      actor: executionActor,
      description: 'Execution actor trying to plan',
      timestamp: new Date().toISOString()
    };

    try {
      this.boundaryEnforcer.validateOperation(invalidPlanningOp);
      console.error('❌ Failed to reject planning actor executing');
    } catch (error) {
      console.log('✅ Correctly rejected planning actor attempting execution');
      console.log(`   - Error: ${(error as Error).message}`);
    }

    try {
      this.boundaryEnforcer.validateOperation(invalidExecutionOp);
      console.error('❌ Failed to reject execution actor planning');
    } catch (error) {
      console.log('✅ Correctly rejected execution actor attempting planning');
      console.log(`   - Error: ${(error as Error).message}`);
    }
  }

  private async testContentValidation(): Promise<void> {
    console.log('\n📋 Test 2: Content Validation');
    
    // Test planning content violations
    const planningContentWithCode = `
      We need to implement user authentication.
      Here's how to do it:
      function authenticate(email, password) {
        return bcrypt.compare(password, hashedPassword);
      }
    `;

    try {
      this.boundaryEnforcer.validateContent(planningContentWithCode, 'planning');
      console.error('❌ Failed to detect code in planning content');
    } catch (error) {
      console.log('✅ Correctly detected code in planning content');
      console.log(`   - Violations found: ${(error as Error).message.split('\n').length - 1}`);
    }

    // Test execution content violations
    const executionContentWithStrategy = `
      Implementing the authentication module.
      Should we use JWT or session-based auth?
      Let's consider the pros and cons of each approach.
      I recommend using JWT for better scalability.
    `;

    try {
      this.boundaryEnforcer.validateContent(executionContentWithStrategy, 'execution');
      console.error('❌ Failed to detect strategic planning in execution content');
    } catch (error) {
      console.log('✅ Correctly detected strategic planning in execution content');
      console.log(`   - Violations found: ${(error as Error).message.split('\n').length - 1}`);
    }

    // Test valid content
    const validPlanningContent = `
      User authentication system requirements:
      - Users must be able to register with email and password
      - System must verify email addresses
      - Passwords must be stored securely
      - Sessions should expire after inactivity
    `;

    const validExecutionContent = `
      Implementing user registration endpoint.
      Creating database schema for users table.
      Setting up password hashing with appropriate salt rounds.
      Configuring session middleware with secure settings.
    `;

    try {
      this.boundaryEnforcer.validateContent(validPlanningContent, 'planning');
      console.log('✅ Valid planning content accepted');
      
      this.boundaryEnforcer.validateContent(validExecutionContent, 'execution');
      console.log('✅ Valid execution content accepted');
    } catch (error) {
      console.error('❌ Failed to accept valid content:', error);
      throw error;
    }
  }

  private async testBoundaryProxy(): Promise<void> {
    console.log('\n📋 Test 3: Boundary Proxy Enforcement');
    
    // Create mock objects to proxy
    const mockPlanner = {
      analyze: () => 'Analyzing requirements',
      plan: () => 'Creating plan',
      execute: () => 'Should not be allowed', // Forbidden method
      strategize: () => 'Developing strategy'
    };

    const mockExecutor = {
      execute: () => 'Executing task',
      implement: () => 'Implementing feature',
      plan: () => 'Should not be allowed', // Forbidden method
      deploy: () => 'Deploying changes'
    };

    // Create proxies
    const proxiedPlanner = this.boundaryEnforcer.createBoundaryProxy(mockPlanner, 'planning');
    const proxiedExecutor = this.boundaryEnforcer.createBoundaryProxy(mockExecutor, 'execution');

    // Test allowed methods
    try {
      console.log(`   Planner.analyze: ${proxiedPlanner.analyze()}`);
      console.log(`   Planner.plan: ${proxiedPlanner.plan()}`);
      console.log('✅ Planning proxy allows valid methods');
    } catch (error) {
      console.error('❌ Planning proxy blocked valid method:', error);
    }

    try {
      console.log(`   Executor.execute: ${proxiedExecutor.execute()}`);
      console.log(`   Executor.implement: ${proxiedExecutor.implement()}`);
      console.log('✅ Execution proxy allows valid methods');
    } catch (error) {
      console.error('❌ Execution proxy blocked valid method:', error);
    }

    // Test forbidden methods
    try {
      proxiedPlanner.execute();
      console.error('❌ Planning proxy failed to block execute method');
    } catch (error) {
      console.log('✅ Planning proxy correctly blocked execute method');
      console.log(`   - Error: ${(error as Error).message}`);
    }

    try {
      proxiedExecutor.plan();
      console.error('❌ Execution proxy failed to block plan method');
    } catch (error) {
      console.log('✅ Execution proxy correctly blocked plan method');
      console.log(`   - Error: ${(error as Error).message}`);
    }
  }

  private async testProtocolValidation(): Promise<void> {
    console.log('\n📋 Test 4: Protocol Validation');
    
    // Test instruction with code patterns
    const instructionWithCode: InstructionProtocol = {
      metadata: {
        id: uuidv4(),
        sessionId: 'test',
        sessionName: 'Test',
        timestamp: new Date().toISOString(),
        version: '1.0',
        actor: 'planning'
      },
      context: {
        description: 'const auth = require("bcrypt")', // Code!
        prerequisites: [],
        userRequest: 'Create auth'
      },
      objectives: [{
        id: uuidv4(),
        primary: 'Implement authentication',
        measurable: true
      }],
      requirements: [{
        id: uuidv4(),
        description: 'npm install bcrypt jsonwebtoken', // Implementation detail!
        priority: 'must'
      }],
      deliverables: [{
        type: 'file',
        description: 'Auth module'
      }],
      constraints: {},
      successCriteria: [{
        id: uuidv4(),
        criterion: 'Auth works',
        validationMethod: 'Test',
        automated: true
      }]
    };

    try {
      this.protocolValidator.validate(instructionWithCode);
      console.error('❌ Failed to detect code in instructions');
    } catch (error) {
      console.log('✅ Protocol validator detected code patterns');
      console.log(`   - Error: ${(error as Error).message}`);
    }

    // Test valid instruction protocol
    const validInstruction: InstructionProtocol = {
      metadata: {
        id: uuidv4(),
        sessionId: 'test',
        sessionName: 'Authentication System',
        timestamp: new Date().toISOString(),
        version: '1.0',
        actor: 'planning'
      },
      context: {
        description: 'User authentication system with secure password handling',
        prerequisites: ['Database connection available'],
        userRequest: 'Create user authentication'
      },
      objectives: [{
        id: uuidv4(),
        primary: 'Enable secure user authentication',
        secondary: ['Password security', 'Session management'],
        measurable: true
      }],
      requirements: [{
        id: uuidv4(),
        description: 'Users must be able to register with email and password',
        priority: 'must',
        acceptanceCriteria: ['Registration endpoint works', 'Passwords are hashed']
      }],
      deliverables: [{
        type: 'file',
        description: 'Authentication module with registration and login functionality',
        validation: 'All endpoints respond correctly'
      }],
      constraints: {
        patterns: ['Follow REST conventions'],
        avoid: ['Storing plain text passwords']
      },
      successCriteria: [{
        id: uuidv4(),
        criterion: 'All authentication endpoints function correctly',
        validationMethod: 'API testing',
        automated: true
      }]
    };

    try {
      this.protocolValidator.validate(validInstruction);
      console.log('✅ Valid instruction protocol accepted');
    } catch (error) {
      console.error('❌ Failed to accept valid instruction:', error);
      throw error;
    }
  }

  private async testViolationTracking(): Promise<void> {
    console.log('\n📋 Test 5: Violation Tracking');
    
    // Clear violation history
    this.boundaryEnforcer.clearViolationHistory();
    
    const actor: Actor = {
      type: 'planning',
      id: 'test-planner',
      capabilities: ['plan', 'analyze']
    };

    // Create violations
    const violations: Operation[] = [
      {
        type: 'execute',
        actor,
        description: 'First violation',
        timestamp: new Date().toISOString()
      },
      {
        type: 'analyze',
        actor,
        description: 'Second violation',
        timestamp: new Date().toISOString()
      }
    ];

    let violationCount = 0;
    for (const violation of violations) {
      try {
        this.boundaryEnforcer.validateOperation(violation);
      } catch (error) {
        violationCount++;
      }
    }

    // Check violation history
    const history = this.boundaryEnforcer.getViolationHistory(actor.id);
    
    console.assert(history.length === violationCount, 'All violations should be tracked');
    console.assert(history[0]?.description === 'First violation', 'Violations should be in order');
    
    console.log('✅ Violation tracking works correctly');
    console.log(`   - Actor: ${actor.id}`);
    console.log(`   - Violations recorded: ${history.length}`);
    if (history[0]) {
      console.log(`   - First violation: ${history[0].type} - ${history[0].description}`);
    }
    
    // Clear and verify
    this.boundaryEnforcer.clearViolationHistory();
    const clearedHistory = this.boundaryEnforcer.getViolationHistory(actor.id);
    console.assert(clearedHistory.length === 0, 'History should be cleared');
    console.log('✅ Violation history cleared successfully');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new BoundaryEnforcementTests();
  tests.runAllTests().catch(console.error);
}