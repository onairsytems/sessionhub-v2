/**
 * Manual Testing Checklist System for SessionHub
 * Provides step-by-step validation procedures for complete workflows
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface TestChecklist {
  id: string;
  name: string;
  description: string;
  category: ChecklistCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration: number; // in minutes
  prerequisites: string[];
  sections: ChecklistSection[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistSection {
  id: string;
  name: string;
  description?: string;
  steps: ChecklistStep[];
}

export interface ChecklistStep {
  id: string;
  order: number;
  description: string;
  expectedResult: string;
  type: StepType;
  validationCriteria?: string[];
  notes?: string;
  screenshots?: string[];
  automationStatus?: 'automated' | 'partial' | 'manual-only';
}

export type ChecklistCategory = 
  | 'user-journey'
  | 'feature-validation'
  | 'integration-testing'
  | 'edge-cases'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'compatibility';

export type StepType = 
  | 'action'
  | 'verification'
  | 'navigation'
  | 'data-entry'
  | 'configuration'
  | 'observation';

export interface TestExecution {
  id: string;
  checklistId: string;
  testerId: string;
  environment: TestEnvironment;
  startTime: Date;
  endTime?: Date;
  status: 'in-progress' | 'completed' | 'paused' | 'abandoned';
  stepResults: StepResult[];
  issues: ExecutionIssue[];
  notes: string;
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  actualResult?: string;
  duration: number;
  timestamp: Date;
  evidence?: StepEvidence;
  notes?: string;
}

export interface StepEvidence {
  screenshots?: string[];
  logs?: string[];
  recordings?: string[];
}

export interface ExecutionIssue {
  stepId: string;
  severity: 'blocker' | 'critical' | 'major' | 'minor';
  description: string;
  workaround?: string;
  screenshot?: string;
}

export interface TestEnvironment {
  platform: string;
  browser?: string;
  browserVersion?: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  screenResolution?: string;
}

export interface ChecklistReport {
  checklist: TestChecklist;
  executions: TestExecution[];
  summary: ExecutionSummary;
  commonIssues: CommonIssue[];
  recommendations: string[];
}

export interface ExecutionSummary {
  totalExecutions: number;
  passRate: number;
  averageDuration: number;
  failuresByStep: Map<string, number>;
  environmentCoverage: Map<string, number>;
}

export interface CommonIssue {
  description: string;
  frequency: number;
  affectedSteps: string[];
  severity: string;
}

export class ManualTestingChecklist extends EventEmitter {
  private checklists: Map<string, TestChecklist> = new Map();
  private executions: Map<string, TestExecution> = new Map();
  private storagePath: string;
  private predefinedChecklists: TestChecklist[] = [];

  constructor(options: { storagePath?: string } = {}) {
    super();
    this.storagePath = options.storagePath || path.join(process.cwd(), '.sessionhub', 'manual-tests');
    this.ensureStorageDirectory();
    this.loadChecklists();
    this.initializePredefinedChecklists();
  }

  private ensureStorageDirectory(): void {
    fs.mkdirSync(this.storagePath, { recursive: true });
    fs.mkdirSync(path.join(this.storagePath, 'checklists'), { recursive: true });
    fs.mkdirSync(path.join(this.storagePath, 'executions'), { recursive: true });
    fs.mkdirSync(path.join(this.storagePath, 'evidence'), { recursive: true });
  }

  private loadChecklists(): void {
    const checklistsDir = path.join(this.storagePath, 'checklists');
    if (fs.existsSync(checklistsDir)) {
      const files = fs.readdirSync(checklistsDir).filter(f => f.endsWith('.json'));
      files.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(checklistsDir, file), 'utf-8'));
          data.createdAt = new Date(data.createdAt);
          data.updatedAt = new Date(data.updatedAt);
          this.checklists.set(data.id, data);
        } catch (error) {
          this.emit('error', { message: `Failed to load checklist ${file}`, error });
        }
      });
    }
  }

  private initializePredefinedChecklists(): void {
    // Core User Journey Checklist
    this.predefinedChecklists.push({
      id: 'core-user-journey',
      name: 'Core User Journey Validation',
      description: 'Complete end-to-end validation of primary user workflows',
      category: 'user-journey',
      priority: 'critical',
      estimatedDuration: 30,
      prerequisites: ['Application installed', 'Test account created'],
      tags: ['core', 'e2e', 'user-flow'],
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [
        {
          id: 'onboarding',
          name: 'User Onboarding',
          description: 'Validate first-time user experience',
          steps: [
            {
              id: 'launch-app',
              order: 1,
              description: 'Launch SessionHub application',
              expectedResult: 'Application opens without errors',
              type: 'action',
              validationCriteria: [
                'No crash on startup',
                'UI elements load correctly',
                'No console errors'
              ]
            },
            {
              id: 'welcome-screen',
              order: 2,
              description: 'Verify welcome screen appears',
              expectedResult: 'Welcome screen with clear call-to-action',
              type: 'verification',
              validationCriteria: [
                'Welcome message is visible',
                'Get Started button is clickable',
                'Branding is correct'
              ]
            },
            {
              id: 'account-setup',
              order: 3,
              description: 'Complete account setup process',
              expectedResult: 'Account created successfully',
              type: 'data-entry',
              validationCriteria: [
                'Form validation works',
                'Error messages are clear',
                'Success confirmation shown'
              ]
            }
          ]
        },
        {
          id: 'session-management',
          name: 'Session Management',
          description: 'Test core session functionality',
          steps: [
            {
              id: 'create-session',
              order: 1,
              description: 'Create a new development session',
              expectedResult: 'Session created and becomes active',
              type: 'action',
              validationCriteria: [
                'Session appears in list',
                'Status shows as active',
                'Timer starts automatically'
              ]
            },
            {
              id: 'switch-session',
              order: 2,
              description: 'Switch between multiple sessions',
              expectedResult: 'Smooth transition between sessions',
              type: 'action',
              validationCriteria: [
                'Previous session pauses',
                'New session activates',
                'Context switches correctly'
              ]
            },
            {
              id: 'complete-session',
              order: 3,
              description: 'Complete and archive a session',
              expectedResult: 'Session marked as complete',
              type: 'action',
              validationCriteria: [
                'Completion dialog appears',
                'Summary is generated',
                'Session moves to archive'
              ]
            }
          ]
        }
      ]
    });

    // Integration Testing Checklist
    this.predefinedChecklists.push({
      id: 'integration-testing',
      name: 'Integration Points Validation',
      description: 'Test all external service integrations',
      category: 'integration-testing',
      priority: 'high',
      estimatedDuration: 45,
      prerequisites: ['API keys configured', 'Test accounts for services'],
      tags: ['integration', 'api', 'external-services'],
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [
        {
          id: 'github-integration',
          name: 'GitHub Integration',
          steps: [
            {
              id: 'connect-github',
              order: 1,
              description: 'Connect GitHub account',
              expectedResult: 'Successfully authenticated with GitHub',
              type: 'configuration',
              validationCriteria: [
                'OAuth flow completes',
                'User repositories load',
                'Permissions granted correctly'
              ]
            },
            {
              id: 'create-issue',
              order: 2,
              description: 'Create GitHub issue from SessionHub',
              expectedResult: 'Issue created in selected repository',
              type: 'action',
              validationCriteria: [
                'Issue appears in GitHub',
                'Metadata is correct',
                'Link back to session works'
              ]
            }
          ]
        },
        {
          id: 'ide-integration',
          name: 'IDE Integration',
          steps: [
            {
              id: 'detect-ide',
              order: 1,
              description: 'Verify IDE detection',
              expectedResult: 'Installed IDEs are detected',
              type: 'verification',
              validationCriteria: [
                'VS Code detected if installed',
                'Cursor detected if installed',
                'Correct versions shown'
              ]
            },
            {
              id: 'open-project',
              order: 2,
              description: 'Open project in IDE',
              expectedResult: 'Project opens in selected IDE',
              type: 'action',
              validationCriteria: [
                'IDE launches',
                'Correct project loaded',
                'No permission errors'
              ]
            }
          ]
        }
      ]
    });

    // Accessibility Checklist
    this.predefinedChecklists.push({
      id: 'accessibility-testing',
      name: 'Accessibility Compliance',
      description: 'Ensure application meets accessibility standards',
      category: 'accessibility',
      priority: 'high',
      estimatedDuration: 60,
      prerequisites: ['Screen reader installed', 'Keyboard navigation enabled'],
      tags: ['a11y', 'wcag', 'accessibility'],
      createdAt: new Date(),
      updatedAt: new Date(),
      sections: [
        {
          id: 'keyboard-navigation',
          name: 'Keyboard Navigation',
          steps: [
            {
              id: 'tab-navigation',
              order: 1,
              description: 'Navigate entire app using only keyboard',
              expectedResult: 'All interactive elements are accessible',
              type: 'navigation',
              validationCriteria: [
                'Tab order is logical',
                'Focus indicators visible',
                'No keyboard traps'
              ]
            },
            {
              id: 'shortcuts',
              order: 2,
              description: 'Test keyboard shortcuts',
              expectedResult: 'Shortcuts work as documented',
              type: 'action',
              validationCriteria: [
                'Cmd/Ctrl+N creates new session',
                'Cmd/Ctrl+S saves current state',
                'Escape closes modals'
              ]
            }
          ]
        },
        {
          id: 'screen-reader',
          name: 'Screen Reader Compatibility',
          steps: [
            {
              id: 'announcements',
              order: 1,
              description: 'Verify screen reader announcements',
              expectedResult: 'All content is announced correctly',
              type: 'verification',
              validationCriteria: [
                'Page structure announced',
                'Form labels read correctly',
                'Status updates announced'
              ]
            },
            {
              id: 'aria-labels',
              order: 2,
              description: 'Check ARIA labels and roles',
              expectedResult: 'Semantic information provided',
              type: 'verification',
              validationCriteria: [
                'Buttons have descriptive labels',
                'Regions have landmarks',
                'Live regions update correctly'
              ]
            }
          ]
        }
      ]
    });

    // Save predefined checklists
    this.predefinedChecklists.forEach(checklist => {
      if (!this.checklists.has(checklist.id)) {
        this.saveChecklist(checklist);
      }
    });
  }

  /**
   * Create a new checklist
   */
  public createChecklist(params: {
    name: string;
    description: string;
    category: ChecklistCategory;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    estimatedDuration?: number;
    prerequisites?: string[];
    sections: Omit<ChecklistSection, 'id'>[];
    tags?: string[];
  }): TestChecklist {
    const checklist: TestChecklist = {
      id: uuidv4(),
      name: params.name,
      description: params.description,
      category: params.category,
      priority: params.priority || 'medium',
      estimatedDuration: params.estimatedDuration || 30,
      prerequisites: params.prerequisites || [],
      sections: params.sections.map(section => ({
        ...section,
        id: uuidv4(),
        steps: section.steps.map((step, index) => ({
          ...step,
          id: uuidv4(),
          order: step.order || index + 1
        }))
      })),
      tags: params.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.saveChecklist(checklist);
    this.emit('checklist:created', checklist);
    return checklist;
  }

  /**
   * Save checklist
   */
  private saveChecklist(checklist: TestChecklist): void {
    this.checklists.set(checklist.id, checklist);
    const filepath = path.join(this.storagePath, 'checklists', `${checklist.id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(checklist, null, 2));
  }

  /**
   * Start test execution
   */
  public startExecution(checklistId: string, testerId: string, environment: TestEnvironment): TestExecution {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) {
      throw new Error(`Checklist ${checklistId} not found`);
    }

    const execution: TestExecution = {
      id: uuidv4(),
      checklistId,
      testerId,
      environment,
      startTime: new Date(),
      status: 'in-progress',
      stepResults: [],
      issues: [],
      notes: ''
    };

    this.executions.set(execution.id, execution);
    this.saveExecution(execution);
    this.emit('execution:started', execution);

    return execution;
  }

  /**
   * Record step result
   */
  public recordStepResult(
    executionId: string,
    stepId: string,
    result: Omit<StepResult, 'stepId' | 'timestamp'>
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const stepResult: StepResult = {
      ...result,
      stepId,
      timestamp: new Date()
    };

    execution.stepResults.push(stepResult);
    this.saveExecution(execution);
    this.emit('step:completed', { execution, stepResult });

    // Check if all steps are complete
    const checklist = this.checklists.get(execution.checklistId);
    if (checklist) {
      const totalSteps = checklist.sections.reduce((sum, section) => sum + section.steps.length, 0);
      if (execution.stepResults.length >= totalSteps) {
        this.completeExecution(executionId);
      }
    }
  }

  /**
   * Add evidence to step
   */
  public addStepEvidence(
    executionId: string,
    stepId: string,
    evidence: StepEvidence
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const stepResult = execution.stepResults.find(r => r.stepId === stepId);
    if (!stepResult) {
      throw new Error(`Step result for ${stepId} not found`);
    }

    // Save evidence files
    const evidencePath = path.join(this.storagePath, 'evidence', executionId, stepId);
    fs.mkdirSync(evidencePath, { recursive: true });

    const savedEvidence: StepEvidence = {};

    if (evidence.screenshots) {
      savedEvidence.screenshots = evidence.screenshots.map((screenshot, index) => {
        const filename = `screenshot-${index}.png`;
        const filepath = path.join(evidencePath, filename);
        // In real implementation, screenshot would be base64 or buffer
        fs.writeFileSync(filepath, screenshot);
        return filepath;
      });
    }

    if (evidence.logs) {
      savedEvidence.logs = evidence.logs.map((log, index) => {
        const filename = `log-${index}.txt`;
        const filepath = path.join(evidencePath, filename);
        fs.writeFileSync(filepath, log);
        return filepath;
      });
    }

    stepResult.evidence = savedEvidence;
    this.saveExecution(execution);
    this.emit('evidence:added', { execution, stepId, evidence: savedEvidence });
  }

  /**
   * Report issue during execution
   */
  public reportExecutionIssue(
    executionId: string,
    issue: ExecutionIssue
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.issues.push(issue);
    this.saveExecution(execution);
    this.emit('issue:reported', { execution, issue });
  }

  /**
   * Complete execution
   */
  public completeExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.endTime = new Date();
    execution.status = 'completed';
    this.saveExecution(execution);
    this.emit('execution:completed', execution);
  }

  /**
   * Save execution
   */
  private saveExecution(execution: TestExecution): void {
    const filepath = path.join(this.storagePath, 'executions', `${execution.id}.json`);
    fs.writeFileSync(filepath, JSON.stringify(execution, null, 2));
  }

  /**
   * Generate checklist report
   */
  public generateChecklistReport(checklistId: string): ChecklistReport {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) {
      throw new Error(`Checklist ${checklistId} not found`);
    }

    const executions = Array.from(this.executions.values())
      .filter(e => e.checklistId === checklistId);

    const summary = this.calculateExecutionSummary(checklist, executions);
    const commonIssues = this.identifyCommonIssues(executions);
    const recommendations = this.generateRecommendations(summary, commonIssues);

    return {
      checklist,
      executions,
      summary,
      commonIssues,
      recommendations
    };
  }

  /**
   * Calculate execution summary
   */
  private calculateExecutionSummary(
    checklist: TestChecklist,
    executions: TestExecution[]
  ): ExecutionSummary {
    const totalSteps = checklist.sections.reduce((sum, section) => sum + section.steps.length, 0);
    
    let totalPassed = 0;
    let totalDuration = 0;
    const failuresByStep = new Map<string, number>();
    const environmentCoverage = new Map<string, number>();

    executions.forEach(execution => {
      // Pass rate
      const passed = execution.stepResults.filter(r => r.status === 'passed').length;
      totalPassed += passed / totalSteps;

      // Duration
      if (execution.endTime) {
        totalDuration += execution.endTime.getTime() - execution.startTime.getTime();
      }

      // Failures by step
      execution.stepResults
        .filter(r => r.status === 'failed')
        .forEach(result => {
          failuresByStep.set(
            result.stepId,
            (failuresByStep.get(result.stepId) || 0) + 1
          );
        });

      // Environment coverage
      const envKey = `${execution.environment.platform}-${execution.environment.browser || 'native'}`;
      environmentCoverage.set(
        envKey,
        (environmentCoverage.get(envKey) || 0) + 1
      );
    });

    return {
      totalExecutions: executions.length,
      passRate: executions.length > 0 ? (totalPassed / executions.length) * 100 : 0,
      averageDuration: executions.length > 0 ? totalDuration / executions.length : 0,
      failuresByStep,
      environmentCoverage
    };
  }

  /**
   * Identify common issues
   */
  private identifyCommonIssues(executions: TestExecution[]): CommonIssue[] {
    const issueMap = new Map<string, CommonIssue>();

    executions.forEach(execution => {
      execution.issues.forEach(issue => {
        const key = `${issue.severity}-${issue.description}`;
        
        if (!issueMap.has(key)) {
          issueMap.set(key, {
            description: issue.description,
            frequency: 0,
            affectedSteps: [],
            severity: issue.severity
          });
        }

        const commonIssue = issueMap.get(key)!;
        commonIssue.frequency++;
        if (!commonIssue.affectedSteps.includes(issue.stepId)) {
          commonIssue.affectedSteps.push(issue.stepId);
        }
      });
    });

    return Array.from(issueMap.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    summary: ExecutionSummary,
    commonIssues: CommonIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // Pass rate recommendations
    if (summary.passRate < 90) {
      recommendations.push(`Improve pass rate from ${summary.passRate.toFixed(1)}% to at least 90%`);
    }

    // Failure patterns
    summary.failuresByStep.forEach((failures, stepId) => {
      if (failures > summary.totalExecutions * 0.3) {
        recommendations.push(`Investigate frequent failures in step ${stepId}`);
      }
    });

    // Common issues
    const blockers = commonIssues.filter(i => i.severity === 'blocker');
    if (blockers.length > 0) {
      recommendations.push(`Address ${blockers.length} blocking issues before release`);
    }

    // Environment coverage
    if (summary.environmentCoverage.size < 3) {
      recommendations.push('Increase test coverage across different environments');
    }

    // Automation opportunities
    if (summary.averageDuration > 60 * 60 * 1000) { // > 1 hour
      recommendations.push('Consider automating repetitive test steps to reduce execution time');
    }

    return recommendations;
  }

  /**
   * Export checklist to markdown
   */
  public exportChecklistToMarkdown(checklistId: string): string {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) {
      throw new Error(`Checklist ${checklistId} not found`);
    }

    const lines: string[] = [];
    
    lines.push(`# ${checklist.name}`);
    lines.push('');
    lines.push(checklist.description);
    lines.push('');
    
    lines.push('## Information');
    lines.push(`- **Category**: ${checklist.category}`);
    lines.push(`- **Priority**: ${checklist.priority}`);
    lines.push(`- **Estimated Duration**: ${checklist.estimatedDuration} minutes`);
    lines.push('');
    
    if (checklist.prerequisites.length > 0) {
      lines.push('## Prerequisites');
      checklist.prerequisites.forEach(prereq => {
        lines.push(`- ${prereq}`);
      });
      lines.push('');
    }

    lines.push('## Test Steps');
    lines.push('');

    checklist.sections.forEach(section => {
      lines.push(`### ${section.name}`);
      if (section.description) {
        lines.push(section.description);
      }
      lines.push('');

      section.steps.forEach(step => {
        lines.push(`#### Step ${step.order}: ${step.description}`);
        lines.push(`- **Type**: ${step.type}`);
        lines.push(`- **Expected Result**: ${step.expectedResult}`);
        
        if (step.validationCriteria && step.validationCriteria.length > 0) {
          lines.push('- **Validation Criteria**:');
          step.validationCriteria.forEach(criteria => {
            lines.push(`  - [ ] ${criteria}`);
          });
        }
        
        if (step.notes) {
          lines.push(`- **Notes**: ${step.notes}`);
        }
        
        lines.push('');
      });
    });

    return lines.join('\n');
  }

  /**
   * Get all checklists
   */
  public getAllChecklists(): TestChecklist[] {
    return Array.from(this.checklists.values());
  }

  /**
   * Get checklist by ID
   */
  public getChecklist(checklistId: string): TestChecklist | undefined {
    return this.checklists.get(checklistId);
  }

  /**
   * Get executions for checklist
   */
  public getChecklistExecutions(checklistId: string): TestExecution[] {
    return Array.from(this.executions.values())
      .filter(e => e.checklistId === checklistId);
  }

  /**
   * Get execution by ID
   */
  public getExecution(executionId: string): TestExecution | undefined {
    return this.executions.get(executionId);
  }
}

// Export singleton instance
let checklistInstance: ManualTestingChecklist | null = null;

export const getManualTestingChecklist = (options?: { storagePath?: string }): ManualTestingChecklist => {
  if (!checklistInstance) {
    checklistInstance = new ManualTestingChecklist(options);
  }
  return checklistInstance;
};

export const createTestChecklist = (
  params: Parameters<ManualTestingChecklist['createChecklist']>[0]
): TestChecklist => {
  const checklist = getManualTestingChecklist();
  return checklist.createChecklist(params);
};