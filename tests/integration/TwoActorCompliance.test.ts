import { RuntimeActorMonitor } from '../../main/services/RuntimeActorMonitor';
import { PlanningEngine } from '../../src/services/planning/PlanningEngine';
import { ExecutionEngine } from '../../src/services/execution/ExecutionEngine';
import { ActorBoundaryValidator } from '../../src/validation/ActorBoundaryValidator';

describe('Two-Actor Model Compliance Tests', () => {
  let monitor: RuntimeActorMonitor;
  let planningEngine: PlanningEngine;
  let executionEngine: ExecutionEngine;
  let boundaryValidator: ActorBoundaryValidator;

  beforeEach(() => {
    monitor = new RuntimeActorMonitor();
    planningEngine = new PlanningEngine();
    executionEngine = new ExecutionEngine();
    boundaryValidator = new ActorBoundaryValidator();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('Actor Boundary Enforcement', () => {
    it('should prevent planning actor from executing code', async () => {
      monitor.start();

      const violation = await planningEngine.attemptExecution(`
        const fs = require('fs');
        fs.writeFileSync('test.txt', 'data');
      `);

      expect(violation).toBeNull();
      
      const violations = monitor.getViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('boundary');
      expect(violations[0]?.actor).toBe('planning');
      expect(violations[0]?.operation).toBe('code_execution');
    });

    it('should prevent execution actor from planning', async () => {
      monitor.start();

      const violation = await executionEngine.attemptPlanning({
        objective: 'Create a new feature',
        context: {}
      });

      expect(violation).toBeNull();
      
      const violations = monitor.getViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('boundary');
      expect(violations[0]?.actor).toBe('execution');
      expect(violations[0]?.operation).toBe('strategy_generation');
    });

    it('should allow planning actor to generate strategies', async () => {
      monitor.start();

      const plan = await planningEngine.generatePlan({
        objective: 'Create a REST API',
        context: { projectType: 'express' }
      });

      expect(plan).toBeDefined();
      expect(plan.instructions).toHaveLength(5);
      expect(monitor.getViolations()).toHaveLength(0);
    });

    it('should allow execution actor to execute code', async () => {
      monitor.start();

      const instructions = [
        { id: '1', type: 'code' as const, content: 'Create Express server' },
        { id: '2', type: 'test' as const, content: 'Write unit tests' }
      ];

      const result = await executionEngine.execute(instructions);

      expect(result.success).toBe(true);
      expect(result.filesModified.length).toBeGreaterThan(0);
      expect(monitor.getViolations()).toHaveLength(0);
    });
  });

  describe('API Endpoint Isolation', () => {
    it('should enforce correct API usage for planning', async () => {
      const apiCall = {
        endpoint: '/api/claude/chat',
        actor: 'planning',
        payload: { message: 'Generate a plan' }
      };

      const isValid = await boundaryValidator.validateAPICall(apiCall);
      expect(isValid).toBe(true);
    });

    it('should enforce correct API usage for execution', async () => {
      const apiCall = {
        endpoint: '/api/claude/code',
        actor: 'execution',
        payload: { instructions: [] }
      };

      const isValid = await boundaryValidator.validateAPICall(apiCall);
      expect(isValid).toBe(true);
    });

    it('should block planning actor from code API', async () => {
      const apiCall = {
        endpoint: '/api/claude/code',
        actor: 'planning',
        payload: { instructions: [] }
      };

      const isValid = await boundaryValidator.validateAPICall(apiCall);
      expect(isValid).toBe(false);
    });

    it('should block execution actor from chat API', async () => {
      const apiCall = {
        endpoint: '/api/claude/chat',
        actor: 'execution',
        payload: { message: 'Generate a plan' }
      };

      const isValid = await boundaryValidator.validateAPICall(apiCall);
      expect(isValid).toBe(false);
    });
  });

  describe('Content Validation', () => {
    it('should detect execution keywords in planning output', async () => {
      const planningOutput = {
        actor: 'planning',
        content: 'Execute this code: console.log("test")',
        type: 'strategy'
      };

      const violations = await boundaryValidator.validateContent(planningOutput);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.reason).toContain('execution keyword');
    });

    it('should detect planning keywords in execution output', async () => {
      const executionOutput = {
        actor: 'execution',
        content: 'Based on analysis, I recommend the following strategy...',
        type: 'result'
      };

      const violations = await boundaryValidator.validateContent(executionOutput);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.reason).toContain('planning keyword');
    });

    it('should allow valid planning content', async () => {
      const planningOutput = {
        actor: 'planning',
        content: 'The architecture should include three main components...',
        type: 'strategy'
      };

      const violations = await boundaryValidator.validateContent(planningOutput);
      expect(violations).toHaveLength(0);
    });

    it('should allow valid execution content', async () => {
      const executionOutput = {
        actor: 'execution',
        content: 'Created file server.js with Express configuration',
        type: 'result'
      };

      const violations = await boundaryValidator.validateContent(executionOutput);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Runtime Monitoring', () => {
    it('should track all actor operations', async () => {
      monitor.start();

      // Simulate various operations
      await planningEngine.generatePlan({ objective: 'Test', context: {} });
      await executionEngine.execute([]);
      
      const operations = monitor.getOperations();
      expect(operations).toHaveLength(2);
      expect(operations[0]?.actor).toBe('planning');
      expect(operations[1]?.actor).toBe('execution');
    });

    it('should generate audit trail', async () => {
      monitor.start();

      await planningEngine.generatePlan({ objective: 'Test', context: {} });
      
      const auditTrail = monitor.getAuditTrail();
      expect(auditTrail).toBeDefined();
      expect(auditTrail.events).toHaveLength(1);
      expect(auditTrail.events?.[0]).toMatchObject({
        timestamp: expect.any(Date),
        actor: 'planning',
        operation: 'generate_plan',
        success: true
      });
    });

    it('should block operations after violation threshold', async () => {
      monitor.start();
      monitor.setViolationThreshold(3);

      // Generate violations
      for (let _i = 0; _i < 3; _i++) {
        await planningEngine.attemptExecution('code');
      }

      // Next operation should be blocked
      const result = await planningEngine.generatePlan({
        objective: 'Test',
        context: {}
      });

      expect(result).toBeNull();
      expect(monitor.isBlocked('planning')).toBe(true);
    });

    it('should emit violation events', async () => {
      monitor.start();

      const violations: any[] = [];
      monitor.on('violation', (violation) => {
        violations.push(violation);
      });

      await executionEngine.attemptPlanning({ objective: 'Test', context: {} });

      expect(violations).toHaveLength(1);
      expect(violations[0]?.actor).toBe('execution');
    });
  });

  describe('Session Isolation', () => {
    it('should maintain actor boundaries across sessions', async () => {
      const session1 = await createSession('session-1');
      const session2 = await createSession('session-2');

      // Operations in session 1
      await planningEngine.generatePlan({
        objective: 'Session 1 task',
        context: { sessionId: 'session-1' }
      });

      // Verify isolation
      const session1Operations = monitor.getOperationsBySession('session-1');
      const session2Operations = monitor.getOperationsBySession('session-2');

      expect(session1Operations).toHaveLength(1);
      expect(session2Operations).toHaveLength(0);
    });

    it('should track violations per session', async () => {
      monitor.start();

      // Violation in session 1
      await planningEngine.attemptExecution('code', { sessionId: 'session-1' });

      const session1Violations = monitor.getViolationsBySession('session-1');
      const session2Violations = monitor.getViolationsBySession('session-2');

      expect(session1Violations).toHaveLength(1);
      expect(session2Violations).toHaveLength(0);
    });
  });

  describe('Performance Impact', () => {
    it('should not significantly impact operation performance', async () => {
      const withoutMonitoring = await measurePerformance(async () => {
        await planningEngine.generatePlan({ objective: 'Test', context: {} });
      });

      monitor.start();
      
      const withMonitoring = await measurePerformance(async () => {
        await planningEngine.generatePlan({ objective: 'Test', context: {} });
      });

      // Monitoring should add less than 10% overhead
      const overhead = (withMonitoring - withoutMonitoring) / withoutMonitoring;
      expect(overhead).toBeLessThan(0.1);
    });

    it('should handle high-frequency operations', async () => {
      monitor.start();

      const operations = 1000;
      const start = Date.now();

      for (let _i = 0; _i < operations; _i++) {
        await planningEngine.validateOperation('plan_generation');
      }

      const duration = Date.now() - start;
      const opsPerSecond = operations / (duration / 1000);

      expect(opsPerSecond).toBeGreaterThan(10000); // Should handle 10k+ ops/sec
    });
  });

  describe('Error Recovery', () => {
    it('should recover from actor failures', async () => {
      monitor.start();

      // Simulate actor failure
      jest.spyOn(planningEngine, 'generatePlan').mockRejectedValueOnce(
        new Error('Actor failure')
      );

      await expect(planningEngine.generatePlan({ objective: 'Test', context: {} }))
        .rejects.toThrow('Actor failure');

      // Should still track the failed operation
      const operations = monitor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0]?.success).toBe(false);
      expect(operations[0]?.error).toBe('Actor failure');
    });

    it('should handle monitor failures gracefully', async () => {
      monitor.start();

      // Simulate monitor failure
      jest.spyOn(monitor, 'trackOperation').mockImplementationOnce(() => {
        throw new Error('Monitor failure');
      });

      // Operation should still succeed
      const result = await planningEngine.generatePlan({
        objective: 'Test',
        context: {}
      });

      expect(result).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should allow customizing violation thresholds', () => {
      monitor.setViolationThreshold(5);
      expect(monitor.getConfiguration().violationThreshold).toBe(5);
    });

    it('should allow customizing monitoring rules', () => {
      const customRules = {
        planning: {
          forbidden: ['execute', 'run', 'eval'],
          allowed: ['plan', 'strategy', 'design']
        },
        execution: {
          forbidden: ['analyze', 'recommend', 'suggest'],
          allowed: ['create', 'modify', 'delete']
        }
      };

      monitor.setRules(customRules);
      expect(monitor.getConfiguration().rules).toEqual(customRules);
    });

    it('should validate configuration changes', () => {
      expect(() => {
        monitor.setViolationThreshold(-1);
      }).toThrow('Invalid violation threshold');

      expect(() => {
        monitor.setRules({} as any);
      }).toThrow('Invalid rules configuration');
    });
  });
});

// Helper functions
async function createSession(id: string) {
  return {
    id,
    title: `Session ${id}`,
    status: 'active',
    createdAt: new Date()
  };
}

async function measurePerformance(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}