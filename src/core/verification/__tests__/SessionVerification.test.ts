
/**
 * Tests for Session Verification System
 * These tests ensure that sessions cannot be marked complete without actual implementation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SessionVerificationEngine } from '../SessionVerificationEngine';
import { VerificationGates } from '../VerificationGates';
import { SessionManager, Session, ExecutionResult } from '../../orchestrator/SessionManager';
import { Logger } from '@/src/lib/logging/Logger';
// Removed unused AuditLogger import

describe('Session Verification System', () => {
  let verificationEngine: SessionVerificationEngine;
  let verificationGates: VerificationGates;
  let sessionManager: SessionManager;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
        sessionManager = SessionManager.getInstance() // logger, auditLogger);
    verificationEngine = new SessionVerificationEngine(logger);
    verificationGates = new VerificationGates(verificationEngine, logger, true);
  });

  describe('Documentation Without Implementation Prevention', () => {
    it('should FAIL to complete a session that only has documentation', async () => {
      // Create a session that promises to create files
      const session: Session = {
        id: 'test-session-1',
        name: 'Create User Authentication',
        description: 'Implement user authentication system',
        status: 'executing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'test-user',
        projectId: 'test-project',
        request: {
          id: 'req-1',
          sessionId: 'test-session-1',
          userId: 'test-user',
          content: 'Create user authentication system',
          context: {
            constraints: {
              timeLimit: 300000,
              technology: ['typescript', 'react']
            }
          },
          timestamp: new Date().toISOString()
        },
        instructions: {
          metadata: {
            id: "instr-1",
            sessionId: "test-session-1",
            sessionName: "Create user authentication",
            timestamp: new Date().toISOString(),
            version: "1.0" as const,
            actor: "planning" as const
          },
          context: {
            description: "User authentication implementation",
            prerequisites: [],
            userRequest: "Create user authentication system"
          },
          objectives: [{
            id: "obj-1",
            primary: "Create user authentication",
            measurable: true
          }],
          requirements: [{
            id: "req-1",
            description: "Implement secure user authentication",
            priority: "must" as const,
            acceptanceCriteria: ["Users can register and login"]
          }],
          deliverables: [{
            type: "file" as const,
            description: "User authentication service",
            validation: "Service handles registration and login"
          }],
          constraints: {
            patterns: ["Follow existing project patterns"],
            avoid: ["Breaking changes"],
            timeLimit: 300000
          },
          successCriteria: [{
            id: "sc-1",
            criterion: "Authentication system is functional",
            validationMethod: "Functional testing",
            automated: true
          }]
        },
        metadata: {
          context: {
            description: 'User authentication implementation',
            prerequisites: [],
            userRequest: {
              id: 'req-1',
              content: 'Create user authentication',
              context: {},
              sessionId: 'test-session-1',
              timestamp: new Date().toISOString()
            }
          },
          objectives: [{
            id: 'obj-1',
            primary: 'Create user authentication',
            measurable: true
          }],
          requirements: [],
          deliverables: [],
          constraints: {
            timeLimit: 300000,
            technology: ['typescript', 'react'],
            patterns: ['authentication']
          },
          successCriteria: []
        }
      };

      // Add session to manager
      await sessionManager.createSession({
        userId: session.userId,
        content: session.description,
        context: { projectId: session.projectId }
      });

      // Create contract
      await verificationEngine.createSessionContract(session, session.instructions!);

      // Simulate ACTUAL implementation
      const executionResult: ExecutionResult = {
        sessionId: session.id,
        status: 'success',
        deliverables: [
          {
            type: 'code',
            path: 'src/services/UserService.ts',
            status: 'created'
          }
        ],
        logs: ['Created UserService.ts with full implementation'],
        errors: [],
        metrics: {
          duration: 2000,
          tasksCompleted: 1,
          tasksFailed: 0
        }
      };

      // Mock file existence check
      jest.spyOn(verificationEngine as any, 'verifyDeliverable')
        .mockResolvedValue(true);

      // This should succeed
      const verification = await verificationEngine.verifySession(session, executionResult);
      expect(verification.verified).toBe(true);
      expect(verification.missingDeliverables).toHaveLength(0);
    });
  });

  describe('Verification Gates', () => {
    it('should block deployment of unverified sessions', async () => {
      const sessionId = 'unverified-session';
      
      // Attempt deployment without verification
      await expect(
        verificationGates.preDeploymentGate(sessionId)
      ).rejects.toThrow(/DEPLOYMENT BLOCKED/);
    });

    it('should enforce quality standards', async () => {
      const sessionId = 'low-quality-session';
      
      // Mock a low-quality session
      jest.spyOn(verificationEngine, 'generateVerificationReport')
        .mockResolvedValue('Score: 60/100');

      // Should fail quality gate (default minimum is 80)
      await expect(
        verificationGates.qualityGate(sessionId)
      ).rejects.toThrow(/QUALITY GATE FAILED/);
    });

    it('should trigger rollback for failed post-deployment verification', async () => {
      const sessionId = 'failed-deployment';
      const deploymentId = 'deploy-123';

      // Mock failed verification
      jest.spyOn(verificationEngine, 'enforceVerification')
        .mockRejectedValue(new Error('Verification failed'));

      // Should trigger rollback
      const needsRollback = await verificationGates.rollbackGate(sessionId, deploymentId);
      expect(needsRollback).toBe(true);
    });
  });

  describe('Continuous Verification', () => {
    it('should periodically verify completed sessions remain valid', async () => {
      const sessionIds = ['session-1', 'session-2', 'session-3'];

      // Mock mixed results
      jest.spyOn(verificationEngine, 'enforceVerification')
        .mockImplementation(async (sessionId) => {
          return sessionId !== 'session-2'; // session-2 fails
        });

      const results = await verificationGates.continuousVerificationGate(sessionIds);
      
      expect(results.get('session-1')).toBe(true);
      expect(results.get('session-2')).toBe(false);
      expect(results.get('session-3')).toBe(true);
    });
  });
});