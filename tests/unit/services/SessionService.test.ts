import { SessionService } from '../../mocks/MockSessionService';
import { Session } from '../../../src/models/SessionCompat';
import { BaseProjectContext } from '../../../src/models/ProjectContext';
import { ExecutionResult } from '../../../src/models/ExecutionResult';

interface MockProjectContext extends Partial<BaseProjectContext> {
  id: string;
  name: string;
  type: string;
  path: string;
}

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockProjectContext: MockProjectContext;

  beforeEach(() => {
    sessionService = new SessionService();
    mockProjectContext = {
      id: 'test-project',
      name: 'Test Project',
      type: 'next',
      path: '/test/path',
      dependencies: {},
      config: {}
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with valid input', async () => {
      const sessionData = {
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      };

      const session = await sessionService.createSession(sessionData);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.title).toBe(sessionData.title);
      expect(session.objectives).toBe(sessionData.objectives);
      expect(session.status).toBe('draft');
      expect(session.projectContext).toEqual(mockProjectContext);
    });

    it('should throw error for invalid session data', async () => {
      const invalidData = {
        title: '', // Empty title
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      };

      await expect(sessionService.createSession(invalidData))
        .rejects.toThrow('Session title is required');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionService.createSession({
        title: 'Session 1',
        objectives: 'Objectives 1',
        projectContext: mockProjectContext
      });

      const session2 = await sessionService.createSession({
        title: 'Session 2',
        objectives: 'Objectives 2',
        projectContext: mockProjectContext
      });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('startSession', () => {
    it('should transition session from draft to active', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      const startedSession = await sessionService.startSession(session.id);

      expect(startedSession.status).toBe('active');
      expect(startedSession.startedAt).toBeDefined();
    });

    it('should not start already active session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      await expect(sessionService.startSession(session.id))
        .rejects.toThrow('Session is already active');
    });

    it('should throw error for non-existent session', async () => {
      await expect(sessionService.startSession('non-existent-id'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('completeSession', () => {
    it('should transition session from active to completed', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);
      const completedSession = await sessionService.completeSession(session.id);

      expect(completedSession.status).toBe('completed');
      expect(completedSession.completedAt).toBeDefined();
    });

    it('should calculate session duration', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      const startedSession = await sessionService.startSession(session.id);
      
      // Simulate some time passing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const completedSession = await sessionService.completeSession(session.id);

      expect(completedSession.duration).toBeGreaterThan(0);
    });

    it('should not complete draft session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await expect(sessionService.completeSession(session.id))
        .rejects.toThrow('Cannot complete session that is not active');
    });
  });

  describe('addPlanningResult', () => {
    it('should add planning result to active session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      const planningResult = {
        instructions: ['Step 1', 'Step 2'],
        strategy: 'Test strategy',
        estimatedTime: 30
      };

      const updatedSession = await sessionService.addPlanningResult(
        session.id,
        planningResult
      );

      expect(updatedSession.planningResult).toEqual(planningResult);
    });

    it('should not add planning result to completed session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);
      await sessionService.completeSession(session.id);

      const planningResult = {
        instructions: ['Step 1'],
        strategy: 'Test strategy',
        estimatedTime: 30
      };

      await expect(sessionService.addPlanningResult(session.id, planningResult))
        .rejects.toThrow('Cannot modify completed session');
    });
  });

  describe('addExecutionResult', () => {
    it('should add execution result to session with planning', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      const planningResult = {
        instructions: ['Step 1'],
        strategy: 'Test strategy',
        estimatedTime: 30
      };

      await sessionService.addPlanningResult(session.id, planningResult);

      const executionResult: ExecutionResult = {
        success: true,
        filesModified: ['file1.ts', 'file2.ts'],
        testsRun: 10,
        testsPassed: 10,
        output: 'Execution completed successfully'
      };

      const updatedSession = await sessionService.addExecutionResult(
        session.id,
        executionResult
      );

      expect(updatedSession.executionResults).toHaveLength(1);
      expect(updatedSession.executionResults[0]).toEqual(executionResult);
    });

    it('should require planning before execution', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      const executionResult: ExecutionResult = {
        success: true,
        filesModified: [],
        testsRun: 0,
        testsPassed: 0,
        output: 'Test output'
      };

      await expect(sessionService.addExecutionResult(session.id, executionResult))
        .rejects.toThrow('Cannot execute without planning result');
    });
  });

  describe('getSessionMetrics', () => {
    it('should calculate session metrics correctly', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      // Add planning
      await sessionService.addPlanningResult(session.id, {
        instructions: ['Step 1', 'Step 2'],
        strategy: 'Test strategy',
        estimatedTime: 30
      });

      // Add multiple execution results
      await sessionService.addExecutionResult(session.id, {
        success: true,
        filesModified: ['file1.ts'],
        testsRun: 10,
        testsPassed: 9,
        output: 'First execution'
      });

      await sessionService.addExecutionResult(session.id, {
        success: true,
        filesModified: ['file2.ts', 'file3.ts'],
        testsRun: 5,
        testsPassed: 5,
        output: 'Second execution'
      });

      await sessionService.completeSession(session.id);

      const metrics = await sessionService.getSessionMetrics(session.id);

      expect(metrics).toEqual({
        duration: expect.any(Number),
        totalExecutions: 2,
        successfulExecutions: 2,
        filesModified: 3,
        testsRun: 15,
        testsPassed: 14,
        testPassRate: 93.33
      });
    });
  });

  describe('listSessions', () => {
    it('should list all sessions with pagination', async () => {
      // Create multiple sessions
      for (let i = 0; i < 15; i++) {
        await sessionService.createSession({
          title: `Session ${i}`,
          objectives: `Objectives ${i}`,
          projectContext: mockProjectContext
        });
      }

      const page1 = await sessionService.listSessions({ page: 1, limit: 10 });
      expect(page1.sessions).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.hasMore).toBe(true);

      const page2 = await sessionService.listSessions({ page: 2, limit: 10 });
      expect(page2.sessions).toHaveLength(5);
      expect(page2.hasMore).toBe(false);
    });

    it('should filter sessions by status', async () => {
      // Create sessions with different statuses
      const draft = await sessionService.createSession({
        title: 'Draft Session',
        objectives: 'Draft objectives',
        projectContext: mockProjectContext
      });

      const active = await sessionService.createSession({
        title: 'Active Session',
        objectives: 'Active objectives',
        projectContext: mockProjectContext
      });
      await sessionService.startSession(active.id);

      const completed = await sessionService.createSession({
        title: 'Completed Session',
        objectives: 'Completed objectives',
        projectContext: mockProjectContext
      });
      await sessionService.startSession(completed.id);
      await sessionService.completeSession(completed.id);

      const activeSessions = await sessionService.listSessions({ status: 'active' });
      expect(activeSessions.sessions).toHaveLength(1);
      expect(activeSessions.sessions[0].status).toBe('active');

      const completedSessions = await sessionService.listSessions({ status: 'completed' });
      expect(completedSessions.sessions).toHaveLength(1);
      expect(completedSessions.sessions[0].status).toBe('completed');
    });

    it('should filter sessions by project', async () => {
      const project1Context = { ...mockProjectContext, id: 'project-1' };
      const project2Context = { ...mockProjectContext, id: 'project-2' };

      await sessionService.createSession({
        title: 'Project 1 Session',
        objectives: 'Objectives',
        projectContext: project1Context
      });

      await sessionService.createSession({
        title: 'Project 2 Session',
        objectives: 'Objectives',
        projectContext: project2Context
      });

      const project1Sessions = await sessionService.listSessions({ projectId: 'project-1' });
      expect(project1Sessions.sessions).toHaveLength(1);
      expect(project1Sessions.sessions[0].projectContext.id).toBe('project-1');
    });
  });

  describe('deleteSession', () => {
    it('should delete draft session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.deleteSession(session.id);

      await expect(sessionService.getSession(session.id))
        .rejects.toThrow('Session not found');
    });

    it('should not delete active session', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);

      await expect(sessionService.deleteSession(session.id))
        .rejects.toThrow('Cannot delete active session');
    });

    it('should allow deleting completed session with confirmation', async () => {
      const session = await sessionService.createSession({
        title: 'Test Session',
        objectives: 'Test objectives',
        projectContext: mockProjectContext
      });

      await sessionService.startSession(session.id);
      await sessionService.completeSession(session.id);

      // Should require confirmation for completed sessions
      await expect(sessionService.deleteSession(session.id))
        .rejects.toThrow('Confirmation required to delete completed session');

      // Delete with confirmation
      await sessionService.deleteSession(session.id, { confirm: true });

      await expect(sessionService.getSession(session.id))
        .rejects.toThrow('Session not found');
    });
  });
});