#!/usr/bin/env ts-node

/**
 * Session Completion Workflow Script
 * 
 * This script implements the Error-Fix-Then-Commit workflow to ensure
 * all errors are fixed BEFORE attempting any commits.
 * 
 * Workflow:
 * 1. Implement session features
 * 2. Run full TypeScript check and fix ALL errors
 * 3. Run ESLint and fix ALL violations
 * 4. Verify build completes successfully
 * 5. Only then attempt git commit
 * 6. Update Foundation document
 * 7. Push to GitHub
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ErrorDetectionEngine } from '../src/core/error-detection/ErrorDetectionEngine';
import { Logger } from '../src/lib/logging/Logger';
// import { AuditLogger } from '../src/lib/logging/AuditLogger';

const logger = new Logger('SessionCompletion');
// const auditLogger = new AuditLogger();

interface SessionInfo {
  version: string;
  description: string;
  commitMessage: string;
  foundationVersion: string;
}

interface WorkflowStep {
  name: string;
  description: string;
  command?: string;
  action?: () => Promise<boolean>;
  critical: boolean;
  fixable?: boolean;
}

class SessionCompletionWorkflow {
  private sessionInfo: SessionInfo;
  private sessionLogPath: string;
  private startTime: Date;
  private errorDetector: ErrorDetectionEngine;

  constructor(sessionInfo: SessionInfo) {
    this.sessionInfo = sessionInfo;
    this.startTime = new Date();
    this.sessionLogPath = path.join(
      process.cwd(),
      'sessions',
      'reports',
      `session-${this.startTime.toISOString().replace(/:/g, '-')}.log`
    );
    this.errorDetector = new ErrorDetectionEngine();
  }

  async run(): Promise<void> {
    await this.initializeSession();
    
    const steps: WorkflowStep[] = [
      {
        name: 'Check Git Status',
        description: 'Verify git repository state',
        action: () => voidthis.checkGitStatus(),
        critical: true
      },
      {
        name: 'TypeScript Check',
        description: 'Run TypeScript compiler checks',
        action: () => voidthis.runTypeScriptCheck(),
        critical: true,
        fixable: true
      },
      {
        name: 'ESLint Check',
        description: 'Run ESLint checks',
        action: () => voidthis.runESLintCheck(),
        critical: true,
        fixable: true
      },
      {
        name: 'Build Verification',
        description: 'Verify build completes successfully',
        action: () => voidthis.runBuildVerification(),
        critical: true
      },
      {
        name: 'Test Suite',
        description: 'Run test suite',
        action: () => voidthis.runTests(),
        critical: false
      },
      {
        name: 'Update Foundation',
        description: 'Update Foundation document',
        action: () => voidthis.updateFoundation(),
        critical: true
      },
      {
        name: 'Git Commit',
        description: 'Create git commit with session changes',
        action: () => voidthis.createCommit(),
        critical: true
      },
      {
        name: 'Push to GitHub',
        description: 'Push changes to GitHub',
        action: () => voidthis.pushToGitHub(),
        critical: true
      }
    ];

    let allStepsPassed = true;

    for (const step of steps) {
      logger.info(`Starting: ${step.name}`);
      this.logToSession(`\n=== ${step.name} ===`);
      this.logToSession(step.description);

      try {
        const success = step.command 
          ? await this.runCommand(step.command)
          : await step.action!();

        if (success) {
          logger.info(`✅ ${step.name} completed successfully`);
          this.logToSession(`✅ ${step.name} completed successfully`);
        } else {
          logger.error(`❌ ${step.name} failed`);
          this.logToSession(`❌ ${step.name} failed`);
          
          if (step.critical) {
            if (step.fixable) {
              logger.info(`Attempting to fix errors for: ${step.name}`);
              const fixed = await this.attemptAutoFix(step.name);
              if (!fixed) {
                allStepsPassed = false;
                break;
              }
            } else {
              allStepsPassed = false;
              break;
            }
          }
        }
      } catch (error) {
        logger.error(`Error in ${step.name}: ${error}`);
        this.logToSession(`Error in ${step.name}: ${error}`);
        if (step.critical) {
          allStepsPassed = false;
          break;
        }
      }
    }

    await this.finalizeSession(allStepsPassed);
  }

  private async initializeSession(): Promise<void> {
    // Create session log directory if it doesn't exist
    const sessionDir = path.dirname(this.sessionLogPath);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    this.logToSession(`Session ${this.sessionInfo.version} Completion Workflow`);
    this.logToSession(`Started: ${this.startTime.toISOString()}`);
    this.logToSession(`Description: ${this.sessionInfo.description}`);
    this.logToSession(`Foundation Version: ${this.sessionInfo.foundationVersion}`);
    this.logToSession('='.repeat(80));

    // Audit log session start (commented out - method doesn't exist on AuditLogger)
    // await auditLogger.logSessionStart({
    //   sessionVersion: this.sessionInfo.version,
    //   description: this.sessionInfo.description,
    //   foundationVersion: this.sessionInfo.foundationVersion
    // });
  }

  private async checkGitStatus(): Promise<boolean> {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      this.logToSession(`Git status:\n${status || 'Working directory clean'}`);
      return true;
    } catch (error) {
      this.logToSession(`Git status check failed: ${error}`);
      return false;
    }
  }

  private async runTypeScriptCheck(): Promise<boolean> {
    try {
      const validationResult = await this.errorDetector.validateProject();
      const errors = validationResult.errors.filter(err => err.category === 'TypeScript');
      
      if (errors.length === 0) {
        this.logToSession('No TypeScript errors found');
        return true;
      }

      this.logToSession(`Found ${errors.length} TypeScript errors:`);
      errors.slice(0, 10).forEach(error => {
        this.logToSession(`  ${error.filePath}:${error.line}:${error.column} - ${error.message}`);
      });

      if (errors.length > 10) {
        this.logToSession(`  ... and ${errors.length - 10} more errors`);
      }

      return false;
    } catch (error) {
      this.logToSession(`TypeScript check failed: ${error}`);
      return false;
    }
  }

  private async runESLintCheck(): Promise<boolean> {
    try {
      const validationResult = await this.errorDetector.validateProject();
      const errors = validationResult.errors.filter(err => err.category === 'ESLint');
      
      if (errors.length === 0) {
        this.logToSession('No ESLint errors found');
        return true;
      }

      this.logToSession(`Found ${errors.length} ESLint errors:`);
      errors.slice(0, 10).forEach(error => {
        this.logToSession(`  ${error.filePath}:${error.line}:${error.column} - ${error.message}`);
      });

      if (errors.length > 10) {
        this.logToSession(`  ... and ${errors.length - 10} more errors`);
      }

      return false;
    } catch (error) {
      this.logToSession(`ESLint check failed: ${error}`);
      return false;
    }
  }

  private async runBuildVerification(): Promise<boolean> {
    try {
      this.logToSession('Running build verification...');
      execSync('npm run build:strict', { encoding: 'utf8', stdio: 'pipe' });
      this.logToSession('Build completed successfully');
      return true;
    } catch (error) {
      this.logToSession(`Build verification failed: ${error}`);
      return false;
    }
  }

  private async runTests(): Promise<boolean> {
    try {
      this.logToSession('Running test suite...');
      execSync('npm test', { encoding: 'utf8', stdio: 'pipe' });
      this.logToSession('All tests passed');
      return true;
    } catch (error) {
      this.logToSession(`Test suite failed: ${error}`);
      return false;
    }
  }

  private async updateFoundation(): Promise<boolean> {
    const foundationPath = path.join(process.cwd(), 'docs', 'FOUNDATION.md');
    const backupPath = path.join(
      process.cwd(), 
      'docs', 
      'foundation-versions',
      `FOUNDATION-v${this.sessionInfo.foundationVersion}-backup-${Date.now()}.md`
    );

    // Backup current Foundation
    if (fs.existsSync(foundationPath)) {
      const content = fs.readFileSync(foundationPath, 'utf8');
      fs.writeFileSync(backupPath, content);
      this.logToSession(`Backed up Foundation to: ${backupPath}`);
    }

    // Update version in Foundation
    if (fs.existsSync(foundationPath)) {
      let content = fs.readFileSync(foundationPath, 'utf8');
      content = content.replace(
        /Version: \d+\.\d+\.\d+/,
        `Version: ${this.sessionInfo.foundationVersion}`
      );
      
      // Add session completion note
      const sessionNote = `\n\n### Session ${this.sessionInfo.version} Completed\n` +
        `- Date: ${new Date().toISOString()}\n` +
        `- Description: ${this.sessionInfo.description}\n` +
        `- Workflow: Error-Fix-Then-Commit implemented\n`;
      
      content += sessionNote;
      
      fs.writeFileSync(foundationPath, content);
      this.logToSession('Foundation document updated');
    }

    return true;
  }

  private async createCommit(): Promise<boolean> {
    try {
      // Stage all changes
      execSync('git add -A', { encoding: 'utf8' });
      
      // Create commit
      const commitCommand = `git commit -m "${this.sessionInfo.commitMessage}"`;
      execSync(commitCommand, { encoding: 'utf8' });
      
      this.logToSession('Git commit created successfully');
      return true;
    } catch (error) {
      this.logToSession(`Git commit failed: ${error}`);
      return false;
    }
  }

  private async pushToGitHub(): Promise<boolean> {
    try {
      execSync('git push origin main', { encoding: 'utf8' });
      this.logToSession('Successfully pushed to GitHub');
      return true;
    } catch (error) {
      this.logToSession(`Git push failed: ${error}`);
      return false;
    }
  }

  private async attemptAutoFix(stepName: string): Promise<boolean> {
    this.logToSession(`\nAttempting automatic fixes for: ${stepName}`);
    
    switch (stepName) {
      case 'TypeScript Check':
        return await this.fixTypeScriptErrors();
      case 'ESLint Check':
        return await this.fixESLintErrors();
      default:
        this.logToSession('No automatic fix available for this step');
        return false;
    }
  }

  private async fixTypeScriptErrors(): Promise<boolean> {
    try {
      // Run TypeScript compiler with project references build
      execSync('tsc --build --force', { encoding: 'utf8', stdio: 'pipe' });
      
      // Re-check for errors
      const validationResult = await this.errorDetector.validateProject();
      const errors = validationResult.errors.filter(err => err.category === 'TypeScript');
      if (errors.length === 0) {
        this.logToSession('TypeScript errors fixed successfully');
        return true;
      }
      
      this.logToSession(`Still have ${errors.length} TypeScript errors after fix attempt`);
      return false;
    } catch (error) {
      this.logToSession(`TypeScript fix failed: ${error}`);
      return false;
    }
  }

  private async fixESLintErrors(): Promise<boolean> {
    try {
      // Run ESLint with --fix flag
      execSync('npx eslint . --fix --ext .ts,.tsx,.js,.jsx', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      // Re-check for errors
      const validationResult = await this.errorDetector.validateProject();
      const errors = validationResult.errors.filter(err => err.category === 'ESLint');
      if (errors.length === 0) {
        this.logToSession('ESLint errors fixed successfully');
        return true;
      }
      
      this.logToSession(`Still have ${errors.length} ESLint errors after fix attempt`);
      return false;
    } catch (error) {
      this.logToSession(`ESLint fix failed: ${error}`);
      return false;
    }
  }

  private async runCommand(command: string): Promise<boolean> {
    try {
      const output = execSync(command, { encoding: 'utf8' });
      this.logToSession(`Command output:\n${output}`);
      return true;
    } catch (error) {
      this.logToSession(`Command failed: ${error}`);
      return false;
    }
  }

  private logToSession(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.sessionLogPath, logMessage);
    console.log(message);
  }

  private async finalizeSession(success: boolean): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();
    
    this.logToSession('\n' + '='.repeat(80));
    this.logToSession(`Session Completion: ${success ? 'SUCCESS' : 'FAILED'}`);
    this.logToSession(`Duration: ${duration}ms`);
    this.logToSession(`End Time: ${endTime.toISOString()}`);
    
    if (!success) {
      this.logToSession('\n⚠️  IMPORTANT: Fix all errors before attempting to commit!');
      this.logToSession('Run this script again after fixing the errors.');
    }
    
    // Audit log session completion (commented out - method doesn't exist on AuditLogger)
    // await auditLogger.logSessionCompletion({
    //   sessionVersion: this.sessionInfo.version,
    //   success,
    //   duration,
    //   logPath: this.sessionLogPath
    // });
    
    // Update session tracking
    const trackingPath = path.join(process.cwd(), 'sessions', 'completed', 'history.log');
    const trackingEntry = `${this.sessionInfo.version}|${success ? 'COMPLETED' : 'FAILED'}|${endTime.toISOString()}|${this.sessionLogPath}\n`;
    fs.appendFileSync(trackingPath, trackingEntry);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.error('Usage: complete-session.ts <version> <description> <commit-message> <foundation-version>');
    console.error('Example: complete-session.ts 0.1.5 "Error-Fix-Then-Commit Workflow" "Session 0.1.5: Error-Fix-Then-Commit Workflow - Foundation v0.1.5" 0.1.5');
    process.exit(1);
  }
  
  const sessionInfo: SessionInfo = {
    version: args[0]!,
    description: args[1]!,
    commitMessage: args[2]!,
    foundationVersion: args[3]!
  };
  
  const workflow = new SessionCompletionWorkflow(sessionInfo);
  
  try {
    await workflow.run();
  } catch (error) {
    console.error('Session completion workflow failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SessionCompletionWorkflow };
export type { SessionInfo };