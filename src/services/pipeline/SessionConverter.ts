import { SessionInstruction, SessionCategory, GitHubWebhookPayload } from './types';
// import { AIEnhancementManager } from '../ai/AIEnhancementManager'; // Removed unused
import { SelfDevelopmentAuditor } from '../development/SelfDevelopmentAuditor';
import { v4 as uuidv4 } from 'uuid';
export class SessionConverter {
  // private assistant: AIEnhancementManager; // Removed unused
  private auditor: SelfDevelopmentAuditor;
  constructor() {
    // this.assistant = new AIEnhancementManager(); // Removed unused
    this.auditor = new SelfDevelopmentAuditor();
  }
  async convertIssueToSession(
    issue: GitHubWebhookPayload['issue'],
    repository: GitHubWebhookPayload['repository']
  ): Promise<SessionInstruction> {
    if (!issue || !repository) {
      throw new Error('Invalid issue or repository data');
    }
    const issueKey = `${repository.full_name}#${issue.number}`;
    try {
      // Use AI to analyze the issue
      const analysis = await this.analyzeIssue(issue);
      // Generate session instruction
      const instruction: SessionInstruction = {
        id: uuidv4(),
        sourceType: 'github-issue',
        sourceId: issueKey,
        title: `Fix: ${issue.title}`,
        objectives: analysis.objectives,
        requirements: analysis.requirements,
        priority: this.calculatePriority(issue, analysis),
        category: analysis.category,
        estimatedComplexity: analysis.complexity,
        metadata: {
          githubIssueNumber: issue.number,
          githubRepoFullName: repository.full_name,
          labels: issue.labels.map(l => l.name),
          author: issue.user.login,
        },
        createdAt: new Date(),
        status: 'pending',
      };
      await this.auditor.logEvent({
        type: 'conversion' as any,
        actor: 'system',
        action: 'issue_converted',
        target: issueKey,
        details: {
        title: instruction.title,
        },
        risk: 'low',
        context: {}
      });
      return instruction;
    } catch (error) {
      await this.auditor.logEvent({
        type: 'conversion' as any,
        actor: 'system',
        action: 'issue_conversion_failed',
        target: issueKey,
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
      throw error;
    }
  }
  async convertProductionErrorToSession(
    error: {
      message: string;
      stack?: string;
      affectedUsers?: number;
      frequency?: number;
      component?: string;
    }
  ): Promise<SessionInstruction> {
    try {
      // Analyze the error
      const analysis = await this.analyzeError(error);
      const instruction: SessionInstruction = {
        id: uuidv4(),
        sourceType: 'production-error',
        sourceId: `error-${Date.now()}`,
        title: `Production Fix: ${this.truncate((error as Error).message, 100)}`,
        objectives: analysis.objectives,
        requirements: analysis.requirements,
        priority: this.calculateErrorPriority(error),
        category: 'bug-fix',
        estimatedComplexity: analysis.complexity,
        metadata: {
          errorTrace: (error as Error).stack,
          affectedUsers: error.affectedUsers,
          frequency: error.frequency,
          component: error.component,
        },
        createdAt: new Date(),
        status: 'pending',
      };
      await this.auditor.logEvent({
        type: 'conversion' as any,
        actor: 'system',
        action: 'error_converted',
        target: instruction.sourceId,
        details: {
        message: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
      return instruction;
    } catch (err) {
      await this.auditor.logEvent({
        type: 'conversion' as any,
        actor: 'system',
        action: 'error_conversion_failed',
        target: 'unknown',
        details: {
        error: (err as Error).message,
        },
        risk: 'low',
        context: {}
      });
      throw (err as Error);
    }
  }
  private async analyzeIssue(issue: GitHubWebhookPayload['issue']): Promise<{
    objectives: string[];
    requirements: string[];
    category: SessionCategory;
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    const prompt = `Analyze this GitHub issue and extract actionable development information:
Title: ${issue!.title}
Body: ${issue!.body}
Labels: ${issue!.labels.map(l => l.name).join(', ')}
Please provide:
1. Clear objectives (what needs to be done)
2. Technical requirements (how to do it)
3. Category (bug-fix, feature, performance, security, refactor, documentation, infrastructure, ui-ux)
4. Complexity estimate (simple, moderate, complex)
Format as JSON with keys: objectives (array), requirements (array), category (string), complexity (string)`;
    const response = await this.analyzeContent(prompt);
    try {
      // Parse AI response
      const analysis = JSON.parse(response);
      // Validate and sanitize
      return {
        objectives: Array.isArray(analysis.objectives) ? analysis.objectives : ['Resolve the reported issue'],
        requirements: Array.isArray(analysis.requirements) ? analysis.requirements : ['Investigate and implement fix'],
        category: this.validateCategory(analysis.category),
        complexity: this.validateComplexity(analysis.complexity),
      };
    } catch (error) {
      // Fallback analysis
      return this.fallbackAnalysis(issue!);
    }
  }
  private async analyzeError(error: any): Promise<{
    objectives: string[];
    requirements: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }> {
    const prompt = `Analyze this production error and generate fix objectives:
Error Message: ${(error as Error).message}
Stack Trace: ${(error as Error).stack || 'Not available'}
Component: ${error.component || 'Unknown'}
Affected Users: ${error.affectedUsers || 'Unknown'}
Please provide:
1. Clear objectives for fixing this error
2. Technical requirements for the fix
3. Complexity estimate (simple, moderate, complex)
Format as JSON with keys: objectives (array), requirements (array), complexity (string)`;
    const response = await this.analyzeContent(prompt);
    try {
      const analysis = JSON.parse(response);
      return {
        objectives: Array.isArray(analysis.objectives) ? analysis.objectives : ['Fix the production error'],
        requirements: Array.isArray(analysis.requirements) ? analysis.requirements : ['Debug and resolve the error'],
        complexity: this.validateComplexity(analysis.complexity),
      };
    } catch (error) {
      // Fallback for error analysis
      return {
        objectives: [
          'Identify root cause of the error',
          'Implement fix to prevent recurrence',
          'Add error handling to prevent user impact',
        ],
        requirements: [
          'Debug the error using stack trace',
          'Write tests to reproduce the issue',
          'Deploy fix with monitoring',
        ],
        complexity: 'moderate',
      };
    }
  }
  private fallbackAnalysis(issue: GitHubWebhookPayload['issue']): {
    objectives: string[];
    requirements: string[];
    category: SessionCategory;
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    // Simple keyword-based categorization
    const title = issue!.title.toLowerCase();
    const body = (issue!.body || '').toLowerCase();
    const combined = title + ' ' + body;
    let category: SessionCategory = 'feature';
    if (combined.includes('bug') || combined.includes('error') || combined.includes('fix')) {
      category = 'bug-fix';
    } else if (combined.includes('performance') || combined.includes('slow')) {
      category = 'performance';
    } else if (combined.includes('security') || combined.includes('vulnerability')) {
      category = 'security';
    } else if (combined.includes('refactor') || combined.includes('cleanup')) {
      category = 'refactor';
    } else if (combined.includes('docs') || combined.includes('documentation')) {
      category = 'documentation';
    }
    return {
      objectives: [`Address the issue: ${issue!.title}`],
      requirements: ['Analyze the issue and implement appropriate solution'],
      category,
      complexity: 'moderate',
    };
  }
  private calculatePriority(
    issue: GitHubWebhookPayload['issue'],
    analysis: { category: SessionCategory }
  ): 'critical' | 'high' | 'medium' | 'low' {
    const labels = issue!.labels.map(l => l.name.toLowerCase());
    // Check for explicit priority labels
    if (labels.includes('critical') || labels.includes('urgent')) {
      return 'critical';
    }
    if (labels.includes('high-priority') || labels.includes('important')) {
      return 'high';
    }
    if (labels.includes('low-priority')) {
      return 'low';
    }
    // Category-based priority
    if (analysis.category === 'security') {
      return 'critical';
    }
    if (analysis.category === 'bug-fix') {
      return 'high';
    }
    return 'medium';
  }
  private calculateErrorPriority(error: any): 'critical' | 'high' | 'medium' | 'low' {
    const affectedUsers = error.affectedUsers || 0;
    const frequency = error.frequency || 0;
    if (affectedUsers > 100 || frequency > 50) {
      return 'critical';
    }
    if (affectedUsers > 10 || frequency > 10) {
      return 'high';
    }
    if (affectedUsers > 0 || frequency > 0) {
      return 'medium';
    }
    return 'low';
  }
  private validateCategory(category: string): SessionCategory {
    const validCategories: SessionCategory[] = [
      'bug-fix', 'feature', 'performance', 'security',
      'refactor', 'documentation', 'infrastructure', 'ui-ux'
    ];
    const normalized = category?.toLowerCase().replace(/[^a-z-]/g, '') as SessionCategory;
    return validCategories.includes(normalized) ? normalized : 'feature';
  }
  private validateComplexity(complexity: string): 'simple' | 'moderate' | 'complex' {
    const normalized = complexity?.toLowerCase();
    if (normalized === 'simple' || normalized === 'moderate' || normalized === 'complex') {
      return normalized;
    }
    return 'moderate';
  }
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private async analyzeContent(prompt: string): Promise<any> {
    // Simplified AI analysis simulation
    const isError = prompt.toLowerCase().includes('error');
    const isSecurity = prompt.toLowerCase().includes('security');
    // const _isPerformance = prompt.toLowerCase().includes('performance'); // Removed unused
    
    return {
      objectives: [
        isError ? "Fix the identified error" : "Implement the requested feature",
        "Ensure code quality and test coverage",
        "Update documentation"
      ],
      requirements: [
        "No breaking changes",
        "Follow coding standards",
        "Add unit tests"
      ],
      category: isSecurity ? 'security' : isError ? 'bug-fix' : 'feature',
      complexity: isSecurity ? 'complex' : 'moderate'
    };
  }
}