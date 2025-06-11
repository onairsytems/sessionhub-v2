import { Session } from '../../../src/models/SessionCompat';
import { BaseProjectContext } from '../../../src/models/ProjectContext';
// import { Instruction } from '../../../src/models/Instruction';
import { ExecutionResult } from '../../../src/models/ExecutionResult';

describe('Session Model', () => {
  let mockProjectContext: ProjectContext;

  beforeEach(() => {
    mockProjectContext = {
      id: 'test-project',
      name: 'Test Project',
      type: 'next',
      path: '/test/path',
      dependencies: {},
      config: {}
    };
  });

  describe('constructor', () => {
    it('should create a session with required fields', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.id).toBeDefined();
      expect(session.title).toBe('Test Session');
      expect(session.objectives).toBe('Test objectives');
      expect(session.projectContext).toEqual(mockProjectContext);
      expect(session.status).toBe('draft');
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for different sessions', () => {
      const session1 = new Session({
        title: 'Session 1',
        objectives: 'Objectives 1',
        projectContext: mockProjectContext
      });

      const session2 = new Session({
        title: 'Session 2',
        objectives: 'Objectives 2',
        projectContext: mockProjectContext
      });

      expect(session1.id).not.toBe(session2.id);
    });

    it('should initialize with empty arrays for results', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.executionResults).toEqual([]);
      expect(session.actorInteractions).toEqual([]);
    });
  });

  describe('validation', () => {
    it('should validate required title', () => {
      expect(() => {
        new Session({
          title: '',
          objectives: 'Test objectives',
          projectContext: mockProjectContext
        });
      }).toThrow('Title is required');
    });

    it('should validate required objectives', () => {
      expect(() => {
        new Session({
          title: 'Test Session',
          objectives: '',
          projectContext: mockProjectContext
        });
      }).toThrow('Objectives are required');
    });

    it('should validate required project context', () => {
      expect(() => {
        new Session({
          title: 'Test Session',
          objectives: 'Test objectives',
          projectContext: null as any
        });
      }).toThrow('Project context is required');
    });

    it('should validate title length', () => {
      expect(() => {
        new Session({
          title: 'a'.repeat(256),
          objectives: 'Test objectives',
          projectContext: mockProjectContext
        });
      }).toThrow('Title must be less than 255 characters');
    });
  });

  describe('status transitions', () => {
    it('should transition from draft to active', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.canTransitionTo('active')).toBe(true);
      
      session.transitionTo('active');
      
      expect(session.status).toBe('active');
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('should transition from active to completed', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');
      expect(session.canTransitionTo('completed')).toBe(true);
      
      session.transitionTo('completed');
      
      expect(session.status).toBe('completed');
      expect(session.completedAt).toBeInstanceOf(Date);
    });

    it('should not allow invalid transitions', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.canTransitionTo('completed')).toBe(false);
      
      expect(() => {
        session.transitionTo('completed');
      }).toThrow('Cannot transition from draft to completed');
    });

    it('should not transition completed session', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');
      session.transitionTo('completed');

      expect(session.canTransitionTo('active')).toBe(false);
      expect(() => {
        session.transitionTo('active');
      }).toThrow('Cannot transition from completed state');
    });
  });

  describe('planning operations', () => {
    it('should add planning result', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      const planningResult = {
        instructions: [
          { id: '1', type: 'code' as const, content: 'Write code' },
          { id: '2', type: 'test' as const, content: 'Write tests' }
        ],
        strategy: 'Test-driven development',
        estimatedTime: 60
      };

      session.addPlanningResult(planningResult);

      expect(session.planningResult).toEqual(planningResult);
    });

    it('should not add planning to completed session', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');
      session.transitionTo('completed');

      const planningResult = {
        instructions: [],
        strategy: 'Test',
        estimatedTime: 30
      };

      expect(() => {
        session.addPlanningResult(planningResult);
      }).toThrow('Cannot modify completed session');
    });

    it('should not add planning to draft session', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      const planningResult = {
        instructions: [],
        strategy: 'Test',
        estimatedTime: 30
      };

      expect(() => {
        session.addPlanningResult(planningResult);
      }).toThrow('Session must be active to add planning');
    });
  });

  describe('execution operations', () => {
    it('should add execution result after planning', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      // Add planning first
      session.addPlanningResult({
        instructions: [{ id: '1', type: 'code', content: 'Test' }],
        strategy: 'Test',
        estimatedTime: 30
      });

      const executionResult: ExecutionResult = {
        success: true,
        filesModified: ['file1.ts'],
        testsRun: 5,
        testsPassed: 5,
        output: 'Success'
      };

      session.addExecutionResult(executionResult);

      expect(session.executionResults).toHaveLength(1);
      expect(session.executionResults[0]).toEqual(executionResult);
    });

    it('should not add execution without planning', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      const executionResult: ExecutionResult = {
        success: true,
        filesModified: [],
        testsRun: 0,
        testsPassed: 0,
        output: 'Test'
      };

      expect(() => {
        session.addExecutionResult(executionResult);
      }).toThrow('Cannot execute without planning');
    });

    it('should track multiple execution results', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      session.addPlanningResult({
        instructions: [{ id: '1', type: 'code', content: 'Test' }],
        strategy: 'Test',
        estimatedTime: 30
      });

      const result1: ExecutionResult = {
        success: true,
        filesModified: ['file1.ts'],
        testsRun: 5,
        testsPassed: 5,
        output: 'First'
      };

      const result2: ExecutionResult = {
        success: false,
        filesModified: ['file2.ts'],
        testsRun: 3,
        testsPassed: 1,
        output: 'Second',
        error: 'Test failure'
      };

      session.addExecutionResult(result1);
      session.addExecutionResult(result2);

      expect(session.executionResults).toHaveLength(2);
      expect(session.executionResults[0]).toEqual(result1);
      expect(session.executionResults[1]).toEqual(result2);
    });
  });

  describe('metrics calculation', () => {
    it('should calculate duration for completed session', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');
      
      // Simulate time passing
      const startTime = session.startedAt!.getTime();
      session.completedAt = new Date(startTime + 3600000); // 1 hour later
      
      expect(session.getDuration()).toBe(3600000);
    });

    it('should return null duration for incomplete session', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.getDuration()).toBeNull();

      session.transitionTo('active');
      expect(session.getDuration()).toBeNull();
    });

    it('should calculate execution success rate', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      session.addPlanningResult({
        instructions: [{ id: '1', type: 'code', content: 'Test' }],
        strategy: 'Test',
        estimatedTime: 30
      });

      // Add mix of successful and failed executions
      session.addExecutionResult({
        success: true,
        filesModified: [],
        testsRun: 5,
        testsPassed: 5,
        output: 'Success 1'
      });

      session.addExecutionResult({
        success: true,
        filesModified: [],
        testsRun: 3,
        testsPassed: 3,
        output: 'Success 2'
      });

      session.addExecutionResult({
        success: false,
        filesModified: [],
        testsRun: 2,
        testsPassed: 0,
        output: 'Failure',
        error: 'Error'
      });

      expect(session.getSuccessRate()).toBe(66.67);
    });

    it('should return 0 success rate with no executions', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      expect(session.getSuccessRate()).toBe(0);
    });

    it('should aggregate test statistics', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      session.addPlanningResult({
        instructions: [{ id: '1', type: 'code', content: 'Test' }],
        strategy: 'Test',
        estimatedTime: 30
      });

      session.addExecutionResult({
        success: true,
        filesModified: ['file1.ts'],
        testsRun: 10,
        testsPassed: 9,
        output: 'Result 1'
      });

      session.addExecutionResult({
        success: true,
        filesModified: ['file2.ts', 'file3.ts'],
        testsRun: 5,
        testsPassed: 5,
        output: 'Result 2'
      });

      const stats = session.getTestStatistics();

      expect(stats.totalTests).toBe(15);
      expect(stats.passedTests).toBe(14);
      expect(stats.failedTests).toBe(1);
      expect(stats.passRate).toBe(93.33);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      const json = session.toJSON();

      expect(json).toMatchObject({
        id: session.id,
        title: 'Test Session',
        objectives: 'Test objectives',
        status: 'active',
        projectContext: mockProjectContext,
        createdAt: expect.any(String),
        startedAt: expect.any(String)
      });
    });

    it('should deserialize from JSON', () => {
      const originalSession = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      originalSession.transitionTo('active');

      const json = originalSession.toJSON();
      const deserializedSession = Session.fromJSON(json);

      expect(deserializedSession.id).toBe(originalSession.id);
      expect(deserializedSession.title).toBe(originalSession.title);
      expect(deserializedSession.status).toBe(originalSession.status);
      expect(deserializedSession.createdAt).toEqual(originalSession.createdAt);
    });

    it('should preserve all data through serialization', () => {
      const session = new Session({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      session.transitionTo('active');

      session.addPlanningResult({
        instructions: [{ id: '1', type: 'code', content: 'Test' }],
        strategy: 'Test strategy',
        estimatedTime: 45
      });

      session.addExecutionResult({
        success: true,
        filesModified: ['file.ts'],
        testsRun: 10,
        testsPassed: 10,
        output: 'Success'
      });

      const json = session.toJSON();
      const restored = Session.fromJSON(json);

      expect(restored.planningResult).toEqual(session.planningResult);
      expect(restored.executionResults).toEqual(session.executionResults);
    });
  });
});