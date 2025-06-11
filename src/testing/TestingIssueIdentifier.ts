/**
 * Testing Issue Identification System for SessionHub
 * Captures and categorizes problems discovered during testing for resolution
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface TestingIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  priority: IssuePriority;
  status: IssueStatus;
  source: IssueSource;
  location?: IssueLocation;
  stackTrace?: string;
  reproducible: boolean;
  reproductionSteps?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  affectedComponents: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: IssueResolution;
  relatedIssues: string[];
  attachments: IssueAttachment[];
}

export type IssueCategory = 
  | 'functional'
  | 'performance'
  | 'security'
  | 'compatibility'
  | 'integration'
  | 'ui-ux'
  | 'data-integrity'
  | 'configuration'
  | 'documentation';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssuePriority = 'urgent' | 'high' | 'medium' | 'low';
export type IssueStatus = 'new' | 'triaged' | 'in-progress' | 'resolved' | 'closed' | 'deferred';

export interface IssueSource {
  type: 'automated-test' | 'manual-test' | 'user-report' | 'monitoring' | 'code-analysis';
  testId?: string;
  testName?: string;
  reporter?: string;
  tool?: string;
}

export interface IssueLocation {
  file?: string;
  line?: number;
  column?: number;
  method?: string;
  component?: string;
}

export interface IssueResolution {
  type: 'fixed' | 'wont-fix' | 'duplicate' | 'cannot-reproduce' | 'by-design';
  fixedIn?: string;
  fixCommit?: string;
  workaround?: string;
  notes?: string;
}

export interface IssueAttachment {
  id: string;
  type: 'screenshot' | 'log' | 'config' | 'dump' | 'other';
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

export interface IssuePattern {
  pattern: string;
  category: IssueCategory;
  severity: IssueSeverity;
  tags: string[];
}

export interface IssueStatistics {
  total: number;
  byCategory: Map<IssueCategory, number>;
  bySeverity: Map<IssueSeverity, number>;
  byStatus: Map<IssueStatus, number>;
  averageResolutionTime?: number;
  trendsOverTime: TrendData[];
}

export interface TrendData {
  timestamp: Date;
  newIssues: number;
  resolvedIssues: number;
  openIssues: number;
}

export interface IssueReport {
  generatedAt: Date;
  statistics: IssueStatistics;
  criticalIssues: TestingIssue[];
  unresolvedIssues: TestingIssue[];
  recentlyResolved: TestingIssue[];
  issuesByComponent: Map<string, TestingIssue[]>;
  recommendations: string[];
}

export class TestingIssueIdentifier extends EventEmitter {
  private issues: Map<string, TestingIssue> = new Map();
  private patterns: IssuePattern[] = [];
  private issueStorePath: string;
  private autoClassify: boolean;

  constructor(options: {
    storagePath?: string;
    autoClassify?: boolean;
  } = {}) {
    super();
    this.issueStorePath = options.storagePath || path.join(process.cwd(), '.sessionhub', 'testing-issues');
    this.autoClassify = options.autoClassify !== false;
    
    this.initializePatterns();
    this.ensureStorageDirectory();
    this.loadExistingIssues();
  }

  private initializePatterns(): void {
    // Common error patterns for auto-classification
    this.patterns = [
      // Performance patterns
      {
        pattern: 'timeout|timed out|slow|performance',
        category: 'performance',
        severity: 'high',
        tags: ['performance', 'timeout']
      },
      {
        pattern: 'memory leak|heap|out of memory',
        category: 'performance',
        severity: 'critical',
        tags: ['memory', 'leak']
      },
      
      // Security patterns
      {
        pattern: 'unauthorized|forbidden|401|403',
        category: 'security',
        severity: 'high',
        tags: ['auth', 'security']
      },
      {
        pattern: 'csrf|xss|injection|vulnerability',
        category: 'security',
        severity: 'critical',
        tags: ['security', 'vulnerability']
      },
      
      // Integration patterns
      {
        pattern: 'connection refused|ECONNREFUSED|network error',
        category: 'integration',
        severity: 'high',
        tags: ['network', 'connection']
      },
      {
        pattern: 'api error|endpoint not found|404',
        category: 'integration',
        severity: 'medium',
        tags: ['api', 'integration']
      },
      
      // Data integrity patterns
      {
        pattern: 'corrupt|integrity|inconsistent|mismatch',
        category: 'data-integrity',
        severity: 'critical',
        tags: ['data', 'integrity']
      },
      
      // UI/UX patterns
      {
        pattern: 'render|display|layout|css|style',
        category: 'ui-ux',
        severity: 'medium',
        tags: ['ui', 'display']
      }
    ];
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.issueStorePath)) {
      fs.mkdirSync(this.issueStorePath, { recursive: true });
    }
  }

  private loadExistingIssues(): void {
    const issuesFile = path.join(this.issueStorePath, 'issues.json');
    if (fs.existsSync(issuesFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(issuesFile, 'utf-8'));
        data.forEach((issue: any) => {
          issue.createdAt = new Date(issue.createdAt);
          issue.updatedAt = new Date(issue.updatedAt);
          if (issue.resolvedAt) {
            issue.resolvedAt = new Date(issue.resolvedAt);
          }
          this.issues.set(issue.id, issue);
        });
      } catch (error) {
        this.emit('error', { message: 'Failed to load existing issues', error });
      }
    }
  }

  private saveIssues(): void {
    const issuesFile = path.join(this.issueStorePath, 'issues.json');
    const data = Array.from(this.issues.values());
    fs.writeFileSync(issuesFile, JSON.stringify(data, null, 2));
  }

  /**
   * Create a new testing issue
   */
  public createIssue(params: {
    title: string;
    description: string;
    source: IssueSource;
    category?: IssueCategory;
    severity?: IssueSeverity;
    location?: IssueLocation;
    stackTrace?: string;
    reproducible?: boolean;
    reproductionSteps?: string[];
    expectedBehavior?: string;
    actualBehavior?: string;
    affectedComponents?: string[];
    tags?: string[];
  }): TestingIssue {
    // Auto-classify if enabled and category/severity not provided
    let category = params.category;
    let severity = params.severity;
    let autoTags: string[] = [];

    if (this.autoClassify && (!category || !severity)) {
      const classification = this.autoClassifyIssue(params.title + ' ' + params.description);
      if (!category) category = classification.category;
      if (!severity) severity = classification.severity;
      autoTags = classification.tags;
    }

    const issue: TestingIssue = {
      id: uuidv4(),
      title: params.title,
      description: params.description,
      category: category || 'functional',
      severity: severity || 'medium',
      priority: this.calculatePriority(severity || 'medium'),
      status: 'new',
      source: params.source,
      location: params.location,
      stackTrace: params.stackTrace,
      reproducible: params.reproducible !== false,
      reproductionSteps: params.reproductionSteps,
      expectedBehavior: params.expectedBehavior,
      actualBehavior: params.actualBehavior,
      affectedComponents: params.affectedComponents || [],
      tags: [...(params.tags || []), ...autoTags],
      createdAt: new Date(),
      updatedAt: new Date(),
      relatedIssues: [],
      attachments: []
    };

    // Check for duplicates
    const duplicate = this.findDuplicateIssue(issue);
    if (duplicate) {
      duplicate.relatedIssues.push(issue.id);
      this.emit('duplicate:found', { original: duplicate, new: issue });
      return duplicate;
    }

    this.issues.set(issue.id, issue);
    this.saveIssues();
    this.emit('issue:created', issue);

    return issue;
  }

  /**
   * Auto-classify issue based on patterns
   */
  private autoClassifyIssue(text: string): {
    category: IssueCategory;
    severity: IssueSeverity;
    tags: string[];
  } {
    const lowerText = text.toLowerCase();
    
    for (const pattern of this.patterns) {
      if (new RegExp(pattern.pattern, 'i').test(lowerText)) {
        return {
          category: pattern.category,
          severity: pattern.severity,
          tags: pattern.tags
        };
      }
    }

    // Default classification
    return {
      category: 'functional',
      severity: 'medium',
      tags: []
    };
  }

  /**
   * Calculate priority based on severity
   */
  private calculatePriority(severity: IssueSeverity): IssuePriority {
    switch (severity) {
      case 'critical':
        return 'urgent';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Find duplicate issues
   */
  private findDuplicateIssue(newIssue: TestingIssue): TestingIssue | undefined {
    // Simple duplicate detection based on similarity
    const threshold = 0.8;
    
    for (const existing of this.issues.values()) {
      if (existing.status === 'resolved' || existing.status === 'closed') {
        continue;
      }

      const similarity = this.calculateSimilarity(
        newIssue.title + ' ' + newIssue.description,
        existing.title + ' ' + existing.description
      );

      if (similarity > threshold) {
        return existing;
      }
    }

    return undefined;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Update issue status
   */
  public updateIssueStatus(issueId: string, status: IssueStatus): void {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    issue.status = status;
    issue.updatedAt = new Date();

    if (status === 'resolved' || status === 'closed') {
      issue.resolvedAt = new Date();
    }

    this.saveIssues();
    this.emit('issue:updated', issue);
  }

  /**
   * Add issue resolution
   */
  public resolveIssue(issueId: string, resolution: IssueResolution): void {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    issue.resolution = resolution;
    issue.status = 'resolved';
    issue.resolvedAt = new Date();
    issue.updatedAt = new Date();

    this.saveIssues();
    this.emit('issue:resolved', issue);
  }

  /**
   * Add attachment to issue
   */
  public addAttachment(issueId: string, attachment: {
    type: IssueAttachment['type'];
    filename: string;
    content: Buffer | string;
  }): void {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const attachmentId = uuidv4();
    const attachmentPath = path.join(this.issueStorePath, 'attachments', issueId);
    fs.mkdirSync(attachmentPath, { recursive: true });

    const filePath = path.join(attachmentPath, `${attachmentId}-${attachment.filename}`);
    
    if (Buffer.isBuffer(attachment.content)) {
      fs.writeFileSync(filePath, attachment.content);
    } else {
      fs.writeFileSync(filePath, attachment.content, 'utf-8');
    }

    const attachmentRecord: IssueAttachment = {
      id: attachmentId,
      type: attachment.type,
      filename: attachment.filename,
      path: filePath,
      size: fs.statSync(filePath).size,
      createdAt: new Date()
    };

    issue.attachments.push(attachmentRecord);
    issue.updatedAt = new Date();

    this.saveIssues();
    this.emit('attachment:added', { issue, attachment: attachmentRecord });
  }

  /**
   * Link related issues
   */
  public linkIssues(issueId1: string, issueId2: string): void {
    const issue1 = this.issues.get(issueId1);
    const issue2 = this.issues.get(issueId2);

    if (!issue1 || !issue2) {
      throw new Error('One or both issues not found');
    }

    if (!issue1.relatedIssues.includes(issueId2)) {
      issue1.relatedIssues.push(issueId2);
    }

    if (!issue2.relatedIssues.includes(issueId1)) {
      issue2.relatedIssues.push(issueId1);
    }

    this.saveIssues();
    this.emit('issues:linked', { issue1, issue2 });
  }

  /**
   * Search issues
   */
  public searchIssues(criteria: {
    text?: string;
    category?: IssueCategory;
    severity?: IssueSeverity;
    status?: IssueStatus;
    component?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
  }): TestingIssue[] {
    let results = Array.from(this.issues.values());

    if (criteria.text) {
      const searchText = criteria.text.toLowerCase();
      results = results.filter(issue => 
        issue.title.toLowerCase().includes(searchText) ||
        issue.description.toLowerCase().includes(searchText)
      );
    }

    if (criteria.category) {
      results = results.filter(issue => issue.category === criteria.category);
    }

    if (criteria.severity) {
      results = results.filter(issue => issue.severity === criteria.severity);
    }

    if (criteria.status) {
      results = results.filter(issue => issue.status === criteria.status);
    }

    if (criteria.component) {
      const component = criteria.component;
      results = results.filter(issue => 
        issue.affectedComponents.includes(component)
      );
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(issue => 
        criteria.tags!.some(tag => issue.tags.includes(tag))
      );
    }

    if (criteria.dateRange) {
      results = results.filter(issue => 
        issue.createdAt >= criteria.dateRange!.start &&
        issue.createdAt <= criteria.dateRange!.end
      );
    }

    return results;
  }

  /**
   * Get issue statistics
   */
  public getStatistics(): IssueStatistics {
    const issues = Array.from(this.issues.values());
    
    const byCategory = new Map<IssueCategory, number>();
    const bySeverity = new Map<IssueSeverity, number>();
    const byStatus = new Map<IssueStatus, number>();

    issues.forEach(issue => {
      byCategory.set(issue.category, (byCategory.get(issue.category) || 0) + 1);
      bySeverity.set(issue.severity, (bySeverity.get(issue.severity) || 0) + 1);
      byStatus.set(issue.status, (byStatus.get(issue.status) || 0) + 1);
    });

    // Calculate average resolution time
    const resolvedIssues = issues.filter(i => i.resolvedAt);
    let averageResolutionTime: number | undefined;
    
    if (resolvedIssues.length > 0) {
      const totalTime = resolvedIssues.reduce((sum, issue) => {
        return sum + (issue.resolvedAt!.getTime() - issue.createdAt.getTime());
      }, 0);
      averageResolutionTime = totalTime / resolvedIssues.length;
    }

    // Generate trend data (last 30 days)
    const trendsOverTime = this.generateTrendData(30);

    return {
      total: issues.length,
      byCategory,
      bySeverity,
      byStatus,
      averageResolutionTime,
      trendsOverTime
    };
  }

  /**
   * Generate trend data
   */
  private generateTrendData(days: number): TrendData[] {
    const trends: TrendData[] = [];
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const newIssues = Array.from(this.issues.values()).filter(issue => 
        issue.createdAt >= date && issue.createdAt < nextDate
      ).length;

      const resolvedIssues = Array.from(this.issues.values()).filter(issue => 
        issue.resolvedAt && issue.resolvedAt >= date && issue.resolvedAt < nextDate
      ).length;

      const openIssues = Array.from(this.issues.values()).filter(issue => 
        issue.createdAt <= date && 
        (!issue.resolvedAt || issue.resolvedAt > date) &&
        issue.status !== 'closed'
      ).length;

      trends.push({
        timestamp: date,
        newIssues,
        resolvedIssues,
        openIssues
      });
    }

    return trends;
  }

  /**
   * Generate issue report
   */
  public generateReport(): IssueReport {
    const statistics = this.getStatistics();
    const allIssues = Array.from(this.issues.values());

    const criticalIssues = allIssues.filter(i => 
      i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'closed'
    );

    const unresolvedIssues = allIssues.filter(i => 
      i.status !== 'resolved' && i.status !== 'closed'
    );

    const recentlyResolved = allIssues
      .filter(i => i.resolvedAt)
      .sort((a, b) => b.resolvedAt!.getTime() - a.resolvedAt!.getTime())
      .slice(0, 10);

    // Group by component
    const issuesByComponent = new Map<string, TestingIssue[]>();
    allIssues.forEach(issue => {
      issue.affectedComponents.forEach(component => {
        if (!issuesByComponent.has(component)) {
          issuesByComponent.set(component, []);
        }
        issuesByComponent.get(component)!.push(issue);
      });
    });

    const recommendations = this.generateRecommendations(statistics, allIssues);

    return {
      generatedAt: new Date(),
      statistics,
      criticalIssues,
      unresolvedIssues,
      recentlyResolved,
      issuesByComponent,
      recommendations
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(stats: IssueStatistics, issues: TestingIssue[]): string[] {
    const recommendations: string[] = [];

    // Critical issues
    const criticalCount = stats.bySeverity.get('critical') || 0;
    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical issues immediately`);
    }

    // Performance issues
    const perfIssues = issues.filter(i => i.category === 'performance').length;
    if (perfIssues > 5) {
      recommendations.push('High number of performance issues - consider performance optimization sprint');
    }

    // Security issues
    const securityIssues = issues.filter(i => i.category === 'security').length;
    if (securityIssues > 0) {
      recommendations.push('Security issues detected - prioritize security review and fixes');
    }

    // Component-specific recommendations
    const componentIssues = new Map<string, number>();
    issues.forEach(issue => {
      issue.affectedComponents.forEach(component => {
        componentIssues.set(component, (componentIssues.get(component) || 0) + 1);
      });
    });

    componentIssues.forEach((count, component) => {
      if (count > 10) {
        recommendations.push(`Component "${component}" has ${count} issues - consider refactoring`);
      }
    });

    // Resolution time
    if (stats.averageResolutionTime && stats.averageResolutionTime > 7 * 24 * 60 * 60 * 1000) {
      recommendations.push('Average resolution time exceeds 7 days - improve issue triage process');
    }

    return recommendations;
  }

  /**
   * Export issues to various formats
   */
  public exportIssues(format: 'json' | 'csv' | 'markdown', filter?: (issue: TestingIssue) => boolean): string {
    let issues = Array.from(this.issues.values());
    
    if (filter) {
      issues = issues.filter(filter);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(issues, null, 2);
      
      case 'csv':
        return this.exportToCSV(issues);
      
      case 'markdown':
        return this.exportToMarkdown(issues);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportToCSV(issues: TestingIssue[]): string {
    const headers = [
      'ID', 'Title', 'Category', 'Severity', 'Priority', 'Status',
      'Created At', 'Resolved At', 'Affected Components', 'Tags'
    ];

    const rows = issues.map(issue => [
      issue.id,
      `"${issue.title.replace(/"/g, '""')}"`,
      issue.category,
      issue.severity,
      issue.priority,
      issue.status,
      issue.createdAt.toISOString(),
      issue.resolvedAt?.toISOString() || '',
      `"${issue.affectedComponents.join(', ')}"`,
      `"${issue.tags.join(', ')}"`
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private exportToMarkdown(issues: TestingIssue[]): string {
    const lines: string[] = ['# Testing Issues Report', ''];
    
    const byCategory = new Map<IssueCategory, TestingIssue[]>();
    issues.forEach(issue => {
      if (!byCategory.has(issue.category)) {
        byCategory.set(issue.category, []);
      }
      byCategory.get(issue.category)!.push(issue);
    });

    byCategory.forEach((categoryIssues, category) => {
      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      lines.push('');
      
      categoryIssues.forEach(issue => {
        lines.push(`### ${issue.title}`);
        lines.push(`- **ID**: ${issue.id}`);
        lines.push(`- **Severity**: ${issue.severity}`);
        lines.push(`- **Status**: ${issue.status}`);
        lines.push(`- **Description**: ${issue.description}`);
        
        if (issue.affectedComponents.length > 0) {
          lines.push(`- **Components**: ${issue.affectedComponents.join(', ')}`);
        }
        
        if (issue.resolution) {
          lines.push(`- **Resolution**: ${issue.resolution.type}`);
          if (issue.resolution.notes) {
            lines.push(`  - ${issue.resolution.notes}`);
          }
        }
        
        lines.push('');
      });
    });

    return lines.join('\n');
  }

  /**
   * Get all issues
   */
  public getAllIssues(): TestingIssue[] {
    return Array.from(this.issues.values());
  }

  /**
   * Get issue by ID
   */
  public getIssue(issueId: string): TestingIssue | undefined {
    return this.issues.get(issueId);
  }

  /**
   * Clear all resolved issues
   */
  public clearResolvedIssues(): void {
    const resolved = Array.from(this.issues.values()).filter(i => 
      i.status === 'resolved' || i.status === 'closed'
    );

    resolved.forEach(issue => {
      this.issues.delete(issue.id);
    });

    this.saveIssues();
    this.emit('issues:cleared', { count: resolved.length });
  }
}

// Export singleton instance
let identifierInstance: TestingIssueIdentifier | null = null;

export const getIssueIdentifier = (options?: {
  storagePath?: string;
  autoClassify?: boolean;
}): TestingIssueIdentifier => {
  if (!identifierInstance) {
    identifierInstance = new TestingIssueIdentifier(options);
  }
  return identifierInstance;
};

export const reportTestingIssue = (params: Parameters<TestingIssueIdentifier['createIssue']>[0]): TestingIssue => {
  const identifier = getIssueIdentifier();
  return identifier.createIssue(params);
};