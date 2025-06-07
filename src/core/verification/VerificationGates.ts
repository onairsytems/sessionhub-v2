
/**
 * VerificationGates - Enforcement points that prevent unverified sessions from proceeding
 * 
 * These gates are integrated at critical points in the SessionHub workflow to ensure
 * that documentation always results in implementation.
 */

import { SessionVerificationEngine, VerificationResult } from './SessionVerificationEngine';
import { Session } from '../orchestrator/SessionManager';
import { Logger } from '@/src/lib/logging/Logger';

export class VerificationGates {
  private readonly verificationEngine: SessionVerificationEngine;
  private readonly logger: Logger;
  private strictMode: boolean;

  constructor(
    verificationEngine: SessionVerificationEngine,
    logger: Logger,
    strictMode: boolean = true
  ) {
    this.verificationEngine = verificationEngine;
    this.logger = logger;
    this.strictMode = strictMode;
  }

  /**
   * Gate 1: Pre-deployment verification
   * Blocks any deployment if the session isn't verified
   */
  async preDeploymentGate(sessionId: string): Promise<void> {
    const canDeploy = await this.verificationEngine.enforceVerification(sessionId);
    
    if (!canDeploy) {
      const error = new Error(
        `DEPLOYMENT BLOCKED: Session ${sessionId} has not been verified. ` +
        `The planned changes were not fully implemented.`
      );
      this.logger.error('Pre-deployment gate FAILED', error, { sessionId });
      throw error;
    }

    this.logger.info('Pre-deployment gate PASSED', { sessionId });
  }

  /**
   * Gate 2: Session completion verification
   * Prevents marking a session as "completed" without verification
   */
  async sessionCompletionGate(
    session: Session,
    verificationResult: VerificationResult
  ): Promise<void> {
    if (!verificationResult.verified) {
      const error = new Error(
        `SESSION COMPLETION BLOCKED: Session ${session.id} cannot be marked as completed. ` +
        `Verification score: ${verificationResult.verificationScore}/100. ` +
        `Missing deliverables: ${verificationResult.missingDeliverables.join(', ')}`
      );
      
      this.logger.error('Session completion gate FAILED', error, {
        sessionId: session.id,
        score: verificationResult.verificationScore,
        missing: verificationResult.missingDeliverables
      });

      // In strict mode, throw error. Otherwise, just log warning
      if (this.strictMode) {
        throw error;
      } else {
        this.logger.warn('Session completed despite verification failure (strict mode disabled)', {
          sessionId: session.id
        });
      }
    }

    this.logger.info('Session completion gate PASSED', {
      sessionId: session.id,
      score: verificationResult.verificationScore
    });
  }

  /**
   * Gate 3: Quality gate for session output
   * Ensures minimum quality standards are met
   */
  async qualityGate(
    sessionId: string,
    minScore: number = 80
  ): Promise<void> {
    const report = await this.verificationEngine.generateVerificationReport(sessionId);
    
    // Extract score from report (this is a simple implementation)
    const scoreMatch = report.match(/Score: (\d+)\/100/);
    const score = scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1], 10) : 0;

    if (score < minScore) {
      const error = new Error(
        `QUALITY GATE FAILED: Session ${sessionId} does not meet minimum quality standards. ` +
        `Score: ${score}/${minScore} required.`
      );
      
      this.logger.error('Quality gate FAILED', error, {
        sessionId,
        score,
        requiredScore: minScore
      });

      throw error;
    }

    this.logger.info('Quality gate PASSED', {
      sessionId,
      score,
      requiredScore: minScore
    });
  }

  /**
   * Gate 4: Continuous verification gate
   * Runs periodically to ensure sessions remain verified over time
   */
  async continuousVerificationGate(sessionIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const sessionId of sessionIds) {
      try {
        const verified = await this.verificationEngine.enforceVerification(sessionId);
        results.set(sessionId, verified);
        
        if (!verified) {
          this.logger.warn('Continuous verification failed for session', {
            sessionId,
            action: 'Session may need re-verification or correction'
          });
        }
      } catch (error) {
        this.logger.error('Error during continuous verification', error as Error, {
          sessionId
        });
        results.set(sessionId, false);
      }
    }

    return results;
  }

  /**
   * Gate 5: Rollback gate
   * If verification fails after deployment, trigger rollback
   */
  async rollbackGate(
    sessionId: string,
    deploymentId: string
  ): Promise<boolean> {
    try {
      await this.verificationEngine.enforceVerification(sessionId);
      return false; // No rollback needed
    } catch (error) {
      this.logger.error('Rollback gate triggered - verification failed post-deployment', error as Error, {
        sessionId,
        deploymentId
      });
      
      // In a real implementation, this would trigger actual rollback procedures
      this.logger.warn('ROLLBACK REQUIRED', {
        sessionId,
        deploymentId,
        reason: 'Post-deployment verification failed'
      });
      
      return true; // Rollback needed
    }
  }

  /**
   * Enable or disable strict mode
   * Useful for development vs production environments
   */
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
    this.logger.info('Verification gates strict mode updated', { strictMode: enabled });
  }

  /**
   * Get gate status for monitoring
   */
  getGateStatus(): {
    strictMode: boolean;
    gates: string[];
  } {
    return {
      strictMode: this.strictMode,
      gates: [
        'preDeploymentGate',
        'sessionCompletionGate',
        'qualityGate',
        'continuousVerificationGate',
        'rollbackGate'
      ]
    };
  }
}