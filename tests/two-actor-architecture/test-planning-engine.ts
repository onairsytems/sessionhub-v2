
/**
 * Test Suite for Planning Engine
 * Validates that Planning Engine:
 * 1. Can accept requests and generate valid instructions
 * 2. Rejects any code patterns
 * 3. Only generates descriptive instructions
 */

import { PlanningEngine, UserRequest } from '@/src/core/planning/PlanningEngine';
import { ProtocolValidator } from '@/src/core/protocol/ProtocolValidator';
import { Logger } from '@/src/lib/logging/Logger';

export class PlanningEngineTests {
  private logger: Logger;
  private validator: ProtocolValidator;
  private planningEngine: PlanningEngine;

  constructor() {
    this.logger = new Logger('PlanningEngineTests');
    this.validator = new ProtocolValidator(this.logger);
    this.planningEngine = new PlanningEngine(this.logger, this.validator);
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Planning Engine...\n');

    await this.testValidInstructionGeneration();
    await this.testCodeRejection();
    await this.testDescriptiveInstructions();
    await this.testComplexRequests();

    console.log('\n✅ All Planning Engine tests completed!');
  }

  private async testValidInstructionGeneration(): Promise<void> {
    console.log('📋 Test 1: Valid Instruction Generation');
    
    const request: UserRequest = {
      id: 'test-001',
      content: 'Create a user authentication system with email verification',
      timestamp: new Date().toISOString(),
      sessionId: 'session-test-001'
    };

    try {
      const instructions = await this.planningEngine.generateInstructions(request);
      
      // Validate structure
      console.assert(instructions.metadata.id !== undefined, 'Instruction ID should be defined');
      console.assert(instructions.metadata.actor === 'planning', 'Actor should be planning');
      console.assert(instructions.objectives.length > 0, 'Should have objectives');
      console.assert(instructions.requirements.length > 0, 'Should have requirements');
      console.assert(instructions.deliverables.length > 0, 'Should have deliverables');
      console.assert(instructions.successCriteria.length > 0, 'Should have success criteria');
      
      console.log('✅ Valid instructions generated successfully');
      console.log(`   - Instruction ID: ${instructions.metadata.id}`);
      console.log(`   - Objectives: ${instructions.objectives.length}`);
      console.log(`   - Requirements: ${instructions.requirements.length}`);
      console.log(`   - Success Criteria: ${instructions.successCriteria.length}`);
    } catch (error) {
      console.error('❌ Failed to generate valid instructions:', error);
      throw error;
    }
  }

  private async testCodeRejection(): Promise<void> {
    console.log('\n📋 Test 2: Code Pattern Rejection');
    
    // Test requests that try to include code
    const codeRequests: UserRequest[] = [
      {
        id: 'test-code-001',
        content: 'Create a function authenticate(email, password) { return bcrypt.compare(...) }',
        timestamp: new Date().toISOString()
      },
      {
        id: 'test-code-002',
        content: 'npm install express bcrypt jsonwebtoken',
        timestamp: new Date().toISOString()
      },
      {
        id: 'test-code-003',
        content: 'class UserAuth { constructor() { this.users = [] } }',
        timestamp: new Date().toISOString()
      }
    ];

    for (const request of codeRequests) {
      try {
        // Manually inject code into a request to test validator
        const mockInstructions = {
          metadata: {
            id: 'test',
            sessionId: 'test',
            sessionName: 'test',
            timestamp: new Date().toISOString(),
            version: '1.0' as const,
            actor: 'planning' as const
          },
          context: {
            description: request.content, // This contains code!
            prerequisites: [],
            userRequest: request.content
          },
          objectives: [],
          requirements: [],
          deliverables: [],
          constraints: {},
          successCriteria: []
        };

        // This should throw an error
        this.validator.ensureNoCode(mockInstructions);
        console.error(`❌ Failed to reject code in request: ${request.id}`);
      } catch (error) {
        console.log(`✅ Successfully rejected code pattern in ${request.id}`);
        console.log(`   - Error: ${(error as Error).message}`);
      }
    }
  }

  private async testDescriptiveInstructions(): Promise<void> {
    console.log('\n📋 Test 3: Descriptive Instructions Only');
    
    const request: UserRequest = {
      id: 'test-desc-001',
      content: 'Build a REST API for managing products with CRUD operations',
      timestamp: new Date().toISOString()
    };

    try {
      const instructions = await this.planningEngine.generateInstructions(request);
      
      // Check that requirements are descriptive
      for (const req of instructions.requirements) {
        console.assert(
          req.description.length > 10,
          'Requirement should have meaningful description'
        );
        
        // Ensure no implementation details
        const hasImplementation = [
          'npm install', 'yarn add', 'mkdir', 'create file', 'git clone'
        ].some(pattern => req.description.toLowerCase().includes(pattern));
        
        console.assert(
          !hasImplementation,
          `Requirement should not contain implementation: ${req.description}`
        );
      }
      
      // Check objectives are high-level
      for (const obj of instructions.objectives) {
        console.assert(
          !obj.primary.includes('function') && !obj.primary.includes('class'),
          'Objectives should not contain code keywords'
        );
      }
      
      console.log('✅ Instructions are properly descriptive');
      console.log('   Sample requirement:', instructions.requirements[0]?.description || 'No requirements');
      console.log('   Sample objective:', instructions.objectives[0]?.primary || 'No objectives');
    } catch (error) {
      console.error('❌ Failed descriptive instruction test:', error);
      throw error;
    }
  }

  private async testComplexRequests(): Promise<void> {
    console.log('\n📋 Test 4: Complex Request Handling');
    
    const complexRequest: UserRequest = {
      id: 'test-complex-001',
      content: 'Implement a microservices architecture with user service, product service, and order service. Include authentication, database migrations, and API gateway.',
      context: {
        relatedSessions: ['session-001', 'session-002'],
        technology: ['Node.js', 'PostgreSQL', 'Redis']
      },
      timestamp: new Date().toISOString()
    };

    try {
      const instructions = await this.planningEngine.generateInstructions(complexRequest);
      
      // Should handle complex requirements
      console.assert(
        instructions.requirements.length >= 3,
        'Complex request should generate multiple requirements'
      );
      
      // Should identify prerequisites
      console.assert(
        instructions.context.prerequisites.length > 0,
        'Should identify prerequisites from complex request'
      );
      
      // Should maintain context
      console.assert(
        instructions.context.relatedSessions?.length === 2,
        'Should preserve related sessions'
      );
      
      console.log('✅ Complex request handled successfully');
      console.log(`   - Generated ${instructions.requirements.length} requirements`);
      console.log(`   - Identified ${instructions.context.prerequisites.length} prerequisites`);
      console.log(`   - Prerequisites:`, instructions.context.prerequisites);
    } catch (error) {
      console.error('❌ Failed complex request test:', error);
      throw error;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new PlanningEngineTests();
  tests.runAllTests().catch(console.error);
}