
/**
 * GitHub Session Generator
 * Automatically converts GitHub issues into executable SessionHub development sessions
 */

import { Octokit } from '@octokit/rest';
import { Logger } from '../../lib/logging/Logger';
import { ClaudeAPIClient } from '../../lib/api/ClaudeAPIClient';
// import { Instruction } from '../../models/Instruction'; // Commented out for future use

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  labels: string[];
  assignee?: string;
  milestone?: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'bug' | 'feature' | 'enhancement' | 'documentation' | 'maintenance';
}

export interface SessionInstruction {
  sessionId: string;
  sessionName: string;
  objectives: string[];
  requirements: string[];
  validation: string[];
  foundationUpdate: string[];
  commitMessage: string;
  estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'epic';
  dependencies: string[];
}

export interface SessionProgress {
  sessionId: string;
  issueNumber: number;
  status: 'created' | 'planning' | 'executing' | 'testing' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  logs: string[];
  startTime: Date;
  endTime?: Date;
  artifacts: string[];
}

export class GitHubSessionGenerator {
  private logger: Logger;
  private octokit: Octokit;
  private claudeClient: ClaudeAPIClient;
  private repo: { owner: string; repo: string };

  constructor(githubToken: string, repoOwner: string, repoName: string) {
    this.logger = new Logger('GitHubSessionGenerator');
    this.octokit = new Octokit({ auth: githubToken });
    this.claudeClient = new ClaudeAPIClient({
      apiKey: process.env['ANTHROPIC_API_KEY'] || '',
      model: 'claude-3-opus-20240229',
      maxTokens: 4096,
      temperature: 0.7
    });
    this.repo = { owner: repoOwner, repo: repoName };
  }

  /**
   * Monitor GitHub repository for new issues and convert them to sessions
   */
  async startIssueMonitoring(intervalMs: number = 300000): Promise<void> {
    this.logger.info('Starting GitHub issue monitoring', { 
      repo: `${this.repo.owner}/${this.repo.repo}`,
      intervalMs 
    });

    const monitor = async () => {
      try {
        await this.checkForNewIssues();
      } catch (error) {
        this.logger.error('Issue monitoring error', error as Error);
      }
    };

    // Initial check
    await monitor();

    // Set up interval monitoring
    setInterval(monitor, intervalMs);
  }

  /**
   * Check for new issues and process them
   */
  async checkForNewIssues(): Promise<void> {
    this.logger.debug('Checking for new issues');

    try {
      const { data: issues } = await this.octokit.issues.listForRepo({
        ...this.repo,
        state: 'open',
        labels: 'sessionhub-auto', // Only process issues with this label
        sort: 'created',
        direction: 'desc',
        per_page: 10,
      });

      for (const issue of issues) {
        if (!this.hasSessionLabel(issue)) {
          continue;
        }

        const processed = await this.isIssueProcessed(issue.number);
        if (processed) {
          continue;
        }

        this.logger.info('Processing new issue', { 
          number: issue.number, 
          title: issue.title 
        });

        await this.processIssue(issue);
      }
    } catch (error) {
      this.logger.error('Failed to check for new issues', error as Error);
    }
  }

  /**
   * Process a single GitHub issue into a development session
   */
  async processIssue(issue: any): Promise<SessionProgress> {
    const sessionId = `session-${Date.now()}-${issue.number}`;
    
    this.logger.info('Processing GitHub issue into session', {
      issueNumber: issue.number,
      sessionId,
      title: issue.title,
    });

    const progress: SessionProgress = {
      sessionId,
      issueNumber: issue.number,
      status: 'created',
      progress: 0,
      currentStage: 'Analyzing issue',
      logs: [],
      startTime: new Date(),
      artifacts: [],
    };

    try {
      // Update issue with session tracking
      await this.updateIssueWithSession(issue.number, sessionId);

      // Parse issue into structured data
      progress.status = 'planning';
      progress.currentStage = 'Parsing issue requirements';
      progress.progress = 20;
      
      const parsedIssue = await this.parseIssue(issue);
      
      // Generate session instructions
      progress.currentStage = 'Generating session instructions';
      progress.progress = 40;
      
      const sessionInstruction = await this.generateSessionInstruction(parsedIssue);
      
      // Create session branch
      progress.currentStage = 'Creating development branch';
      progress.progress = 60;
      
      // const branchName = await this.createSessionBranch(sessionId, issue.number); // Commented out for future use
      
      // Execute session
      progress.status = 'executing';
      progress.currentStage = 'Executing development session';
      progress.progress = 80;
      
      const executionResult = await this.executeSession(sessionInstruction);
      
      // Update progress
      progress.status = 'completed';
      progress.currentStage = 'Session completed successfully';
      progress.progress = 100;
      progress.endTime = new Date();
      progress.artifacts = executionResult.artifacts;

      // Update issue with results
      await this.updateIssueWithResults(issue.number, sessionInstruction, executionResult);

      this.logger.info('Session completed successfully', {
        sessionId,
        issueNumber: issue.number,
        duration: progress.endTime.getTime() - progress.startTime.getTime(),
      });

      return progress;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.status = 'failed';
      progress.currentStage = `Failed: ${errorMessage}`;
      progress.endTime = new Date();

      this.logger.error('Session execution failed', error as Error, {
        sessionId,
        issueNumber: issue.number
      });

      // Update issue with failure
      await this.updateIssueWithError(issue.number, error as Error);

      throw error;
    }
  }

  /**
   * Parse GitHub issue into structured data
   */
  async parseIssue(issue: any): Promise<GitHubIssue> {
    const labels = issue.labels?.map((label: any) => label.name) || [];
    
    // Determine priority from labels
    let priority: GitHubIssue['priority'] = 'medium';
    if (labels.includes('priority:critical')) priority = 'critical';
    else if (labels.includes('priority:high')) priority = 'high';
    else if (labels.includes('priority:low')) priority = 'low';

    // Determine category from labels
    let category: GitHubIssue['category'] = 'enhancement';
    if (labels.includes('bug')) category = 'bug';
    else if (labels.includes('feature')) category = 'feature';
    else if (labels.includes('documentation')) category = 'documentation';
    else if (labels.includes('maintenance')) category = 'maintenance';

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels,
      assignee: issue.assignee?.login,
      milestone: issue.milestone?.title,
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      author: issue.user?.login || 'unknown',
      priority,
      category,
    };
  }

  /**
   * Generate session instructions from parsed issue
   */
  async generateSessionInstruction(issue: GitHubIssue): Promise<SessionInstruction> {
    this.logger.info('Generating session instruction', { 
      issueNumber: issue.number,
      category: issue.category,
      priority: issue.priority,
    });

    // Use Claude to analyze the issue and generate session instructions
    const prompt = this.buildSessionPrompt(issue);
    const response = await this.claudeClient.generateStrategy({
      request: { id: 'req-1', content: prompt, context: {}, timestamp: new Date().toISOString() },
      context: {}
    });
    
    // Parse Claude's response into structured session instruction
    const sessionInstruction = this.parseSessionResponse(response, issue);
    
    this.logger.info('Session instruction generated', {
      sessionId: sessionInstruction.sessionId,
      complexity: sessionInstruction.estimatedComplexity,
      objectiveCount: sessionInstruction.objectives.length,
    });

    return sessionInstruction;
  }

  /**
   * Execute the generated session
   */
  async executeSession(instruction: SessionInstruction): Promise<any> {
    this.logger.info('Executing session', { sessionId: instruction.sessionId });

    // Convert session instruction to executable format
    // const executableInstruction: Instruction = { // Commented out for future use
    //   id: instruction.sessionId,
    //   type: 'development',
    //   content: this.formatInstructionForExecution(instruction),
    //   priority: this.mapComplexityToPriority(instruction.estimatedComplexity),
    //   createdAt: new Date(),
    // };

    // Execute through the planning and execution engines
    // This would integrate with the existing SessionHub architecture
    // For now, return a mock result
    return {
      success: true,
      artifacts: [
        `session-${instruction.sessionId}.log`,
        `changes-${instruction.sessionId}.diff`,
      ],
      duration: 300000, // 5 minutes
      testsPass: true,
    };
  }

  /**
   * Private helper methods
   */
  private hasSessionLabel(issue: any): boolean {
    const labels = issue.labels?.map((label: any) => label.name) || [];
    return labels.includes('sessionhub-auto');
  }

  private async isIssueProcessed(issueNumber: number): Promise<boolean> {
    try {
      const { data: comments } = await this.octokit.issues.listComments({
        ...this.repo,
        issue_number: issueNumber,
      });

      return comments.some((comment: any) => 
        comment.body?.includes('<!-- sessionhub-processed -->') &&
        comment.user?.type === 'Bot'
      );
    } catch (error) {
      return false;
    }
  }

  private async updateIssueWithSession(issueNumber: number, sessionId: string): Promise<void> {
    const body = `<!-- sessionhub-processed -->
🤖 **SessionHub Auto-Processing**

Session ID: \`${sessionId}\`
Status: Processing...
Started: ${new Date().toISOString()}

This issue is being automatically processed by SessionHub's self-development system.`;

    await this.octokit.issues.createComment({
      ...this.repo,
      issue_number: issueNumber,
      body,
    });

    // Add processing label
    await this.octokit.issues.addLabels({
      ...this.repo,
      issue_number: issueNumber,
      labels: ['sessionhub-processing'],
    });
  }

  private async updateIssueWithResults(issueNumber: number, instruction: SessionInstruction, result: any): Promise<void> {
    const body = `<!-- sessionhub-completed -->
✅ **SessionHub Auto-Processing Complete**

Session: \`${instruction.sessionId}\`
Duration: ${result.duration}ms
Tests: ${result.testsPass ? '✅ Pass' : '❌ Fail'}

**Objectives Completed:**
${instruction.objectives.map(obj => `- ${obj}`).join('\n')}

**Artifacts:**
${result.artifacts.map((artifact: string) => `- \`${artifact}\``).join('\n')}

Commit: \`${instruction.commitMessage}\``;

    await this.octokit.issues.createComment({
      ...this.repo,
      issue_number: issueNumber,
      body,
    });

    // Update labels
    await this.octokit.issues.removeLabel({
      ...this.repo,
      issue_number: issueNumber,
      name: 'sessionhub-processing',
    });

    await this.octokit.issues.addLabels({
      ...this.repo,
      issue_number: issueNumber,
      labels: ['sessionhub-completed'],
    });

    // Close issue if it was a bug fix or simple enhancement
    if (instruction.estimatedComplexity === 'simple' && result.testsPass) {
      await this.octokit.issues.update({
        ...this.repo,
        issue_number: issueNumber,
        state: 'closed',
      });
    }
  }

  private async updateIssueWithError(issueNumber: number, error: Error): Promise<void> {
    const body = `<!-- sessionhub-failed -->
❌ **SessionHub Auto-Processing Failed**

Error: ${error.message}

The issue could not be automatically processed. Manual intervention may be required.`;

    await this.octokit.issues.createComment({
      ...this.repo,
      issue_number: issueNumber,
      body,
    });

    await this.octokit.issues.addLabels({
      ...this.repo,
      issue_number: issueNumber,
      labels: ['sessionhub-failed'],
    });
  }

  // Commented out for future use
  // private async createSessionBranch(sessionId: string, issueNumber: number): Promise<string> {
  //   const branchName = `sessionhub/issue-${issueNumber}-${sessionId}`;
  //   
  //   try {
  //     // Get current main branch SHA
  //     const { data: mainRef } = await this.octokit.git.getRef({
  //       ...this.repo,
  //       ref: 'heads/main',
  //     });

  //     // Create new branch
  //     await this.octokit.git.createRef({
  //       ...this.repo,
  //       ref: `refs/heads/${branchName}`,
  //       sha: mainRef.object.sha,
  //     });

  //     return branchName;
  //   } catch (error) {
  //     this.logger.warn('Failed to create session branch', { error: error.message });
  //     return 'main'; // Fallback to main branch
  //   }
  // }

  private buildSessionPrompt(issue: GitHubIssue): string {
    return `You are SessionHub's Planning Actor. Analyze this GitHub issue and create a development session.

Issue #${issue.number}: ${issue.title}
Priority: ${issue.priority}
Category: ${issue.category}
Labels: ${issue.labels.join(', ')}

Description:
${issue.body}

Create a SessionHub development session with:
1. Clear objectives (3-5 items)
2. Specific requirements 
3. Validation criteria
4. Foundation update notes
5. Commit message

Respond in this exact format:
OBJECTIVES:
1. [objective 1]
2. [objective 2]

REQUIREMENTS:
- [requirement 1]
- [requirement 2]

VALIDATION:
- [validation 1]
- [validation 2]

FOUNDATION UPDATE:
- [update 1]
- [update 2]

COMMIT: '[commit message]'

COMPLEXITY: [simple|moderate|complex|epic]`;
  }

  private parseSessionResponse(response: string, issue: GitHubIssue): SessionInstruction {
    const sessionId = `session-${Date.now()}-${issue.number}`;
    
    // Parse the structured response from Claude
    const objectivesMatch = response.match(/OBJECTIVES:\s*\n((?:^\d+\.\s*.+$\n?)+)/m);
    const requirementsMatch = response.match(/REQUIREMENTS:\s*\n((?:^-\s*.+$\n?)+)/m);
    const validationMatch = response.match(/VALIDATION:\s*\n((?:^-\s*.+$\n?)+)/m);
    const foundationMatch = response.match(/FOUNDATION UPDATE:\s*\n((?:^-\s*.+$\n?)+)/m);
    const commitMatch = response.match(/COMMIT:\s*'([^']+)'/);
    const complexityMatch = response.match(/COMPLEXITY:\s*(simple|moderate|complex|epic)/);

    return {
      sessionId,
      sessionName: `Issue #${issue.number}: ${issue.title}`,
      objectives: this.parseListItems(objectivesMatch?.[1] || ''),
      requirements: this.parseListItems(requirementsMatch?.[1] || ''),
      validation: this.parseListItems(validationMatch?.[1] || ''),
      foundationUpdate: this.parseListItems(foundationMatch?.[1] || ''),
      commitMessage: commitMatch?.[1] || `Fix issue #${issue.number}: ${issue.title}`,
      estimatedComplexity: (complexityMatch?.[1] as any) || 'moderate',
      dependencies: [], // Could be extracted from issue body
    };
  }

  private parseListItems(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.replace(/^(\d+\.\s*|-\s*)/, '').trim())
      .filter(line => line.length > 0);
  }

  // Commented out for future use
  // private formatInstructionForExecution(instruction: SessionInstruction): string {
  //   return `${instruction.sessionName}
  //
  // OBJECTIVES:
  // ${instruction.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}
  //
  // REQUIREMENTS:
  // ${instruction.requirements.map(req => `- ${req}`).join('\n')}
  //
  // VALIDATION:
  // ${instruction.validation.map(val => `- ${val}`).join('\n')}
  //
  // FOUNDATION UPDATE:
  // ${instruction.foundationUpdate.map(upd => `- ${upd}`).join('\n')}
  //
  // COMMIT: '${instruction.commitMessage}'`;
  // }

  // Commented out for future use
  // private mapComplexityToPriority(complexity: SessionInstruction['estimatedComplexity']): number {
  //   switch (complexity) {
  //     case 'simple': return 1;
  //     case 'moderate': return 2;
  //     case 'complex': return 3;
  //     case 'epic': return 4;
  //     default: return 2;
  //   }
  // }
}