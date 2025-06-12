import { Session } from '../../models/Session';
import { SessionService } from '../SessionService';
import { Logger } from '../../lib/logging/Logger';
import JSZip from 'jszip';

export interface ExportOptions {
  format: 'json' | 'csv' | 'zip' | 'markdown';
  includeInstructions?: boolean;
  includeResults?: boolean;
  includeMetadata?: boolean;
  includeContext?: boolean;
  filterSensitiveData?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  statusFilter?: string[];
}

export interface ExportResult {
  data: string | Blob;
  filename: string;
  mimeType: string;
  metadata: {
    exportedAt: string;
    totalSessions: number;
    format: string;
    options: ExportOptions;
  };
}

export interface SessionSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  planningDuration?: number;
  executionDuration?: number;
  totalSteps?: number;
  completedSteps?: number;
  successRate?: number;
  errorCode?: string;
  errorMessage?: string;
  tags?: string[];
  userId: string;
  projectId: string;
}

export class SessionExportService {
  private static instance: SessionExportService;
  private sessionService: SessionService;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('SessionExportService');
    this.sessionService = SessionService.getInstance();
  }

  static getInstance(): SessionExportService {
    if (!SessionExportService.instance) {
      SessionExportService.instance = new SessionExportService();
    }
    return SessionExportService.instance;
  }

  async exportSessions(sessionIds: string[], options: ExportOptions): Promise<ExportResult> {
    try {
      this.logger.info(`Starting export of ${sessionIds.length} sessions`, { format: options.format });

      const sessions = await this.getSessions(sessionIds);
      const filteredSessions = this.filterSessions(sessions, options);
      
      if (filteredSessions.length === 0) {
        throw new Error('No sessions match the export criteria');
      }

      let result: ExportResult;

      switch (options.format) {
        case 'json':
          result = await this.exportAsJSON(filteredSessions, options);
          break;
        case 'csv':
          result = await this.exportAsCSV(filteredSessions, options);
          break;
        case 'zip':
          result = await this.exportAsZip(filteredSessions, options);
          break;
        case 'markdown':
          result = await this.exportAsMarkdown(filteredSessions, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      this.logger.info(`Export completed successfully`, { 
        sessionCount: filteredSessions.length,
        format: options.format 
      });

      return result;
    } catch (error) {
      this.logger.error('Export failed', error as Error);
      throw error;
    }
  }

  async exportSingleSession(sessionId: string, options: ExportOptions): Promise<ExportResult> {
    return this.exportSessions([sessionId], options);
  }

  private async getSessions(sessionIds: string[]): Promise<Session[]> {
    const sessions: Session[] = [];
    
    for (const sessionId of sessionIds) {
      const session = await this.sessionService.getSession(sessionId);
      if (session) {
        sessions.push(session);
      } else {
        this.logger.warn(`Session ${sessionId} not found during export`);
      }
    }
    
    return sessions;
  }

  private filterSessions(sessions: Session[], options: ExportOptions): Session[] {
    let filtered = [...sessions];

    // Date range filter
    if (options.dateRange) {
      filtered = filtered.filter(session => {
        const createdDate = new Date(session.createdAt);
        return createdDate >= options.dateRange!.from && createdDate <= options.dateRange!.to;
      });
    }

    // Status filter
    if (options.statusFilter && options.statusFilter.length > 0) {
      filtered = filtered.filter(session => 
        options.statusFilter!.includes(session.status)
      );
    }

    return filtered;
  }

  private async exportAsJSON(sessions: Session[], options: ExportOptions): Promise<ExportResult> {
    const processedSessions = sessions.map(session => this.processSessionForExport(session, options));
    
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      totalSessions: processedSessions.length,
      exportOptions: options,
      sessions: processedSessions
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sessions-export-${timestamp}.json`;

    return {
      data: jsonString,
      filename,
      mimeType: 'application/json',
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSessions: processedSessions.length,
        format: 'json',
        options
      }
    };
  }

  private async exportAsCSV(sessions: Session[], options: ExportOptions): Promise<ExportResult> {
    const summaries = sessions.map(session => this.createSessionSummary(session, options));
    
    // Define CSV headers
    const headers = [
      'ID',
      'Name',
      'Description',
      'Status',
      'Created At',
      'Completed At',
      'Duration (ms)',
      'Planning Duration (ms)',
      'Execution Duration (ms)',
      'Total Steps',
      'Completed Steps',
      'Success Rate (%)',
      'Error Code',
      'Error Message',
      'Tags',
      'User ID',
      'Project ID'
    ];

    // Create CSV content
    const csvRows = [headers.join(',')];
    
    for (const summary of summaries) {
      const row = [
        this.escapeCsvValue(summary.id),
        this.escapeCsvValue(summary.name),
        this.escapeCsvValue(summary.description),
        this.escapeCsvValue(summary.status),
        this.escapeCsvValue(summary.createdAt),
        this.escapeCsvValue(summary.completedAt || ''),
        summary.duration?.toString() || '',
        summary.planningDuration?.toString() || '',
        summary.executionDuration?.toString() || '',
        summary.totalSteps?.toString() || '',
        summary.completedSteps?.toString() || '',
        summary.successRate?.toString() || '',
        this.escapeCsvValue(summary.errorCode || ''),
        this.escapeCsvValue(summary.errorMessage || ''),
        this.escapeCsvValue(summary.tags?.join(';') || ''),
        this.escapeCsvValue(summary.userId),
        this.escapeCsvValue(summary.projectId)
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sessions-export-${timestamp}.csv`;

    return {
      data: csvContent,
      filename,
      mimeType: 'text/csv',
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSessions: summaries.length,
        format: 'csv',
        options
      }
    };
  }

  private async exportAsZip(sessions: Session[], options: ExportOptions): Promise<ExportResult> {
    const zip = new JSZip();
    
    // Add individual session files
    for (const session of sessions) {
      const processedSession = this.processSessionForExport(session, options);
      const sessionJson = JSON.stringify(processedSession, null, 2);
      zip.file(`sessions/${session.id}.json`, sessionJson);
    }

    // Add summary CSV
    const csvResult = await this.exportAsCSV(sessions, options);
    zip.file('summary.csv', csvResult.data as string);

    // Add export metadata
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      exportOptions: options,
      version: '2.0'
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add README
    const readme = this.generateReadme(sessions, options);
    zip.file('README.md', readme);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sessions-export-${timestamp}.zip`;

    return {
      data: zipBlob,
      filename,
      mimeType: 'application/zip',
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSessions: sessions.length,
        format: 'zip',
        options
      }
    };
  }

  private async exportAsMarkdown(sessions: Session[], options: ExportOptions): Promise<ExportResult> {
    const lines: string[] = [];
    
    // Header
    lines.push('# Session Export Report');
    lines.push('');
    lines.push(`**Exported:** ${new Date().toISOString()}`);
    lines.push(`**Total Sessions:** ${sessions.length}`);
    lines.push('');

    // Summary statistics
    const stats = this.calculateExportStatistics(sessions);
    lines.push('## Summary Statistics');
    lines.push('');
    lines.push(`- **Total Sessions:** ${stats.total}`);
    lines.push(`- **Completed:** ${stats.completed} (${stats.completionRate.toFixed(1)}%)`);
    lines.push(`- **Failed:** ${stats.failed}`);
    lines.push(`- **Average Duration:** ${stats.averageDuration.toFixed(1)}ms`);
    lines.push(`- **Success Rate:** ${stats.successRate.toFixed(1)}%`);
    lines.push('');

    // Status breakdown
    lines.push('## Status Breakdown');
    lines.push('');
    for (const [status, count] of Object.entries(stats.statusBreakdown)) {
      lines.push(`- **${status}:** ${count}`);
    }
    lines.push('');

    // Individual sessions
    lines.push('## Session Details');
    lines.push('');

    for (const session of sessions) {
      lines.push(`### ${session.name}`);
      lines.push('');
      lines.push(`**ID:** ${session.id}`);
      lines.push(`**Status:** ${session.status}`);
      lines.push(`**Created:** ${session.createdAt}`);
      if (session.completedAt) {
        lines.push(`**Completed:** ${session.completedAt}`);
      }
      lines.push('');
      lines.push(`**Description:** ${session.description}`);
      lines.push('');

      if (options.includeInstructions && session.instructions) {
        lines.push('#### Instructions');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(session.instructions, null, 2));
        lines.push('```');
        lines.push('');
      }

      if (options.includeResults && session.result) {
        lines.push('#### Results');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(session.result, null, 2));
        lines.push('```');
        lines.push('');
      }

      if (session.error) {
        lines.push('#### Error');
        lines.push('');
        lines.push(`**Code:** ${session.error.code}`);
        lines.push(`**Message:** ${session.error.message}`);
        lines.push(`**Recoverable:** ${session.error.recoverable}`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    const markdownContent = lines.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `sessions-export-${timestamp}.md`;

    return {
      data: markdownContent,
      filename,
      mimeType: 'text/markdown',
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSessions: sessions.length,
        format: 'markdown',
        options
      }
    };
  }

  private processSessionForExport(session: Session, options: ExportOptions): Partial<Session> {
    const processed: Partial<Session> = {
      id: session.id,
      name: session.name,
      description: session.description,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      userId: options.filterSensitiveData ? '[FILTERED]' : session.userId,
      projectId: session.projectId,
      request: {
        ...session.request,
        userId: options.filterSensitiveData ? '[FILTERED]' : session.request.userId,
        context: options.includeContext ? (session.request.context || {}) : {}
      }
    };

    if (options.includeInstructions) {
      processed.instructions = session.instructions;
    }

    if (options.includeResults) {
      processed.result = session.result;
    }

    if (options.includeMetadata) {
      processed.metadata = options.filterSensitiveData 
        ? this.filterSensitiveMetadata(session.metadata || {})
        : session.metadata;
    }

    if (session.error) {
      processed.error = session.error;
    }

    return processed;
  }

  private createSessionSummary(session: Session, options: ExportOptions): SessionSummary {
    const progress = session.metadata?.progress;
    
    return {
      id: session.id,
      name: session.name,
      description: session.description,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      duration: session.metadata?.totalDuration,
      planningDuration: session.metadata?.planningDuration,
      executionDuration: session.metadata?.executionDuration,
      totalSteps: progress?.totalSteps,
      completedSteps: progress?.completedSteps,
      successRate: progress?.percentage,
      errorCode: session.error?.code,
      errorMessage: session.error?.message,
      tags: session.metadata?.tags as string[],
      userId: options.filterSensitiveData ? '[FILTERED]' : session.userId,
      projectId: session.projectId
    };
  }

  private filterSensitiveMetadata(metadata: Record<string, any>): Record<string, any> {
    const filtered = { ...metadata };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['apiKey', 'token', 'password', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (filtered[field]) {
        filtered[field] = '[FILTERED]';
      }
    }

    return filtered;
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private calculateExportStatistics(sessions: Session[]) {
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === 'completed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    
    const durations = sessions
      .filter(s => s.metadata?.totalDuration)
      .map(s => s.metadata!.totalDuration!);
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const statusBreakdown = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      completed,
      failed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      averageDuration,
      statusBreakdown
    };
  }

  private generateReadme(sessions: Session[], options: ExportOptions): string {
    const stats = this.calculateExportStatistics(sessions);
    
    return `# Session Export

## Export Information
- **Export Date:** ${new Date().toISOString()}
- **Format:** ${options.format}
- **Total Sessions:** ${sessions.length}

## Export Options
- **Include Instructions:** ${options.includeInstructions ? 'Yes' : 'No'}
- **Include Results:** ${options.includeResults ? 'Yes' : 'No'}
- **Include Metadata:** ${options.includeMetadata ? 'Yes' : 'No'}
- **Include Context:** ${options.includeContext ? 'Yes' : 'No'}
- **Filter Sensitive Data:** ${options.filterSensitiveData ? 'Yes' : 'No'}

## Statistics
- **Completion Rate:** ${stats.completionRate.toFixed(1)}%
- **Average Duration:** ${stats.averageDuration.toFixed(1)}ms
- **Success Rate:** ${stats.successRate.toFixed(1)}%

## File Structure
- \`sessions/\` - Individual session JSON files
- \`summary.csv\` - Summary data in CSV format
- \`metadata.json\` - Export metadata
- \`README.md\` - This file

## Usage
This export contains session data that can be imported back into SessionHub or analyzed with external tools.
`;
  }
}