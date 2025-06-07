
/**
 * SessionVerificationEngine - Ensures sessions are actually executed, not just documented
 * 
 * CRITICAL: This engine prevents the "documentation without implementation" problem
 * by verifying that every planned session results in actual code changes.
 */

import { Logger } from '@/src/lib/logging/Logger';
import { Session, ExecutionResult } from '../orchestrator/SessionManager';
import { InstructionProtocol } from '@/src/models/Instruction';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export interface VerificationResult {
  sessionId: string;
  verified: boolean;
  evidenceFound: Evidence[];
  missingDeliverables: string[];
  unexpectedChanges: string[];
  verificationScore: number; // 0-100
  timestamp: string;
}

export interface Evidence {
  type: 'file_created' | 'file_modified' | 'test_passed' | 'build_success' | 'git_commit';
  path?: string;
  description: string;
  verified: boolean;
  timestamp: string;
}

export interface SessionContract {
  sessionId: string;
  plannedDeliverables: PlannedDeliverable[];
  requiredEvidence: RequiredEvidence[];
  acceptanceCriteria: AcceptanceCriteria[];
}

export interface PlannedDeliverable {
  type: 'file' | 'feature' | 'fix' | 'documentation';
  path?: string;
  description: string;
  required: boolean;
}

export interface RequiredEvidence {
  type: 'file_exists' | 'test_passes' | 'build_succeeds' | 'no_errors';
  description: string;
  command?: string;
}

export interface AcceptanceCriteria {
  description: string;
  verificationMethod: 'automated' | 'manual';
  command?: string;
  expectedResult?: string;
}

export class SessionVerificationEngine {
  private readonly logger: Logger;
  private readonly contracts: Map<string, SessionContract> = new Map();
  private readonly verificationHistory: Map<string, VerificationResult[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a contract for a session based on its instructions
   * This happens BEFORE execution to establish what MUST be delivered
   */
  async createSessionContract(
    session: Session,
    instructions: InstructionProtocol
  ): Promise<SessionContract> {
    const contract: SessionContract = {
      sessionId: session.id,
      plannedDeliverables: this.extractPlannedDeliverables(instructions),
      requiredEvidence: this.defineRequiredEvidence(instructions),
      acceptanceCriteria: this.defineAcceptanceCriteria(instructions)
    };

    this.contracts.set(session.id, contract);
    
    this.logger.info('Session contract created', {
      sessionId: session.id,
      deliverables: contract.plannedDeliverables.length,
      evidence: contract.requiredEvidence.length,
      criteria: contract.acceptanceCriteria.length
    });

    // Store contract in persistent storage to ensure it can't be "lost"
    await this.persistContract(contract);

    return contract;
  }

  /**
   * Verify that a session actually delivered what it promised
   * This happens AFTER execution to validate implementation
   */
  async verifySession(
    session: Session,
    executionResult: ExecutionResult
  ): Promise<VerificationResult> {
    const contract = this.contracts.get(session.id);
    if (!contract) {
      throw new Error(`No contract found for session ${session.id} - cannot verify!`);
    }

    const evidence: Evidence[] = [];
    const missingDeliverables: string[] = [];
    const unexpectedChanges: string[] = [];

    // 1. Verify all planned deliverables exist
    for (const deliverable of contract.plannedDeliverables) {
      const verified = await this.verifyDeliverable(deliverable, executionResult);
      if (!verified && deliverable.required) {
        missingDeliverables.push(deliverable.description);
      }
      evidence.push({
        type: 'file_created',
        path: deliverable.path,
        description: `Deliverable: ${deliverable.description}`,
        verified,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Check for required evidence
    for (const req of contract.requiredEvidence) {
      const verified = await this.checkEvidence(req);
      evidence.push({
        type: req.type === 'file_exists' ? 'file_created' : 'test_passed',
        description: req.description,
        verified,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Verify acceptance criteria
    let criteriaScore = 0;
    for (const criteria of contract.acceptanceCriteria) {
      const verified = await this.verifyCriteria(criteria);
      if (verified) criteriaScore++;
    }

    // 4. Check for unexpected changes (files modified but not in contract)
    const gitChanges = await this.getGitChanges();
    for (const change of gitChanges) {
      const isExpected = contract.plannedDeliverables.some(
        d => d.path && change.includes(d.path)
      );
      if (!isExpected) {
        unexpectedChanges.push(change);
      }
    }

    // Calculate verification score
    const deliverableScore = (contract.plannedDeliverables.length - missingDeliverables.length) 
      / contract.plannedDeliverables.length * 40;
    const evidenceScore = evidence.filter(e => e.verified).length / evidence.length * 30;
    const criteriaScorePercent = criteriaScore / contract.acceptanceCriteria.length * 30;
    const verificationScore = Math.round(deliverableScore + evidenceScore + criteriaScorePercent);

    const result: VerificationResult = {
      sessionId: session.id,
      verified: verificationScore >= 80 && missingDeliverables.length === 0,
      evidenceFound: evidence,
      missingDeliverables,
      unexpectedChanges,
      verificationScore,
      timestamp: new Date().toISOString()
    };

    // Store verification result
    if (!this.verificationHistory.has(session.id)) {
      this.verificationHistory.set(session.id, []);
    }
    this.verificationHistory.get(session.id)!.push(result);

    // Log critical failures
    if (!result.verified) {
      this.logger.error('Session verification FAILED', new Error('Verification failed'), {
        sessionId: session.id,
        score: verificationScore,
        missing: missingDeliverables.length,
        unexpected: unexpectedChanges.length
      });
    }

    return result;
  }

  /**
   * Block deployment if session isn't properly verified
   */
  async enforceVerification(sessionId: string): Promise<boolean> {
    const history = this.verificationHistory.get(sessionId);
    if (!history || history.length === 0) {
      this.logger.error('No verification history found', new Error('Missing verification'), {
        sessionId
      });
      return false;
    }

    const latestVerification = history[history.length - 1];
    if (!latestVerification || !latestVerification.verified) {
      this.logger.error('Session not verified - blocking deployment', new Error('Verification failed'), {
        sessionId,
        score: latestVerification?.verificationScore,
        missing: latestVerification?.missingDeliverables
      });
      return false;
    }

    return true;
  }

  /**
   * Generate verification report for transparency
   */
  async generateVerificationReport(sessionId: string): Promise<string> {
    const contract = this.contracts.get(sessionId);
    const history = this.verificationHistory.get(sessionId);
    
    if (!contract || !history) {
      return `No verification data found for session ${sessionId}`;
    }

    const latestResult = history[history.length - 1];
    
    return `
# Session Verification Report
Session ID: ${sessionId}
Timestamp: ${latestResult?.timestamp || 'N/A'}
Status: ${latestResult?.verified ? '✅ VERIFIED' : '❌ FAILED'}
Score: ${latestResult?.verificationScore || 0}/100

## Planned Deliverables
${contract.plannedDeliverables.map(d => 
  `- ${d.description} ${latestResult?.missingDeliverables?.includes(d.description) ? '❌' : '✅'}`
).join('\n')}

## Evidence Found
${latestResult?.evidenceFound?.map(e => 
  `- ${e.description}: ${e.verified ? '✅' : '❌'}`
).join('\n') || 'None'}

## Missing Deliverables
${!latestResult?.missingDeliverables || latestResult.missingDeliverables.length === 0 ? 'None' : latestResult.missingDeliverables.join('\n')}

## Unexpected Changes
${!latestResult?.unexpectedChanges || latestResult.unexpectedChanges.length === 0 ? 'None' : latestResult.unexpectedChanges.join('\n')}
    `.trim();
  }

  // Private helper methods

  private extractPlannedDeliverables(instructions: InstructionProtocol): PlannedDeliverable[] {
    const deliverables: PlannedDeliverable[] = [];
    
    // Parse instructions to extract what should be created/modified
    if (instructions.requirements) {
      for (const requirement of instructions.requirements) {
        if (requirement.description.includes('create') || requirement.description.includes('implement') || requirement.description.includes('fix')) {
          deliverables.push({
            type: 'file',
            description: requirement.description,
            required: true
          });
        }
      }
    }
    
    // Also check deliverables if specified
    if (instructions.deliverables) {
      for (const deliverable of instructions.deliverables) {
        deliverables.push({
          type: 'file',
          description: deliverable.description,
          required: true
        });
      }
    }

    return deliverables;
  }

  private defineRequiredEvidence(_instructions: InstructionProtocol): RequiredEvidence[] {
    return [
      {
        type: 'build_succeeds',
        description: 'Project builds without errors',
        command: 'npm run build'
      },
      {
        type: 'no_errors',
        description: 'TypeScript compilation succeeds',
        command: 'npm run validate'
      }
    ];
  }

  private defineAcceptanceCriteria(_instructions: InstructionProtocol): AcceptanceCriteria[] {
    return [
      {
        description: 'All tests pass',
        verificationMethod: 'automated',
        command: 'npm test',
        expectedResult: 'exit 0'
      }
    ];
  }

  private async verifyDeliverable(
    deliverable: PlannedDeliverable,
    result: ExecutionResult
  ): Promise<boolean> {
    // Check if deliverable was reported in execution result
    const reported = result.deliverables.some(
      d => d.status !== 'failed' && 
      (deliverable.path ? d.path === deliverable.path : true)
    );

    // Also check file system if path is provided
    if (deliverable.path) {
      try {
        await fs.access(deliverable.path);
        return true;
      } catch {
        return false;
      }
    }

    return reported;
  }

  private async checkEvidence(evidence: RequiredEvidence): Promise<boolean> {
    if (evidence.command) {
      try {
        execSync(evidence.command, { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private async verifyCriteria(criteria: AcceptanceCriteria): Promise<boolean> {
    if (criteria.verificationMethod === 'automated' && criteria.command) {
      try {
        const result = execSync(criteria.command, { stdio: 'pipe' });
        if (criteria.expectedResult === 'exit 0') {
          return true;
        }
        return result.toString().includes(criteria.expectedResult || '');
      } catch {
        return false;
      }
    }
    return false;
  }

  private async getGitChanges(): Promise<string[]> {
    try {
      const changes = execSync('git diff --name-only HEAD~1', { stdio: 'pipe' })
        .toString()
        .split('\n')
        .filter(f => f.length > 0);
      return changes;
    } catch {
      return [];
    }
  }

  private async persistContract(contract: SessionContract): Promise<void> {
    const contractPath = path.join(
      process.cwd(),
      '.sessionhub',
      'contracts',
      `${contract.sessionId}.json`
    );
    
    await fs.mkdir(path.dirname(contractPath), { recursive: true });
    await fs.writeFile(contractPath, JSON.stringify(contract, null, 2));
  }
}