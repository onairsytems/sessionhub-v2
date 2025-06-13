/**
 * Usage Export Service - Export usage data in various formats
 * Handles CSV, JSON, PDF, and Excel export with filtering and customization
 */

import { APIUsageTracker, TokenUsage } from './APIUsageTracker';
import { CostCalculator } from './CostCalculator';

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'excel';
  dateRange: { start: Date; end: Date };
  includeMetrics: boolean;
  includeCostBreakdown: boolean;
  includeModelDistribution: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'session' | 'model';
  currency?: string;
  fields?: string[]; // Specific fields to include
  filters?: {
    models?: string[];
    requestTypes?: ('planning' | 'execution' | 'chat')[];
    minCost?: number;
    maxCost?: number;
  };
}

export interface ExportResult {
  data: string | Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  options: ExportOptions;
  isDefault: boolean;
}

export class UsageExportService {
  private usageTracker: APIUsageTracker;
  private templates: Map<string, ExportTemplate> = new Map();

  constructor(usageTracker: APIUsageTracker, _costCalculator: CostCalculator) {
    this.usageTracker = usageTracker;
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default export templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: ExportTemplate[] = [
      {
        id: 'basic-csv',
        name: 'Basic CSV Export',
        description: 'Simple CSV export with all usage data',
        options: {
          format: 'csv',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          includeMetrics: false,
          includeCostBreakdown: false,
          includeModelDistribution: false
        },
        isDefault: true
      },
      {
        id: 'detailed-json',
        name: 'Detailed JSON Report',
        description: 'Comprehensive JSON export with metrics and analytics',
        options: {
          format: 'json',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          includeMetrics: true,
          includeCostBreakdown: true,
          includeModelDistribution: true,
          groupBy: 'day'
        },
        isDefault: false
      },
      {
        id: 'monthly-summary',
        name: 'Monthly Summary',
        description: 'Monthly usage summary with cost optimization insights',
        options: {
          format: 'json',
          dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          includeMetrics: true,
          includeCostBreakdown: true,
          includeModelDistribution: true,
          groupBy: 'month'
        },
        isDefault: false
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Export usage data with specified options
   */
  async exportUsage(userId: string, options: ExportOptions): Promise<ExportResult> {
    // Get raw usage data
    const rawData = await this.getRawUsageData(userId, options);
    
    // Apply filters
    const filteredData = this.applyFilters(rawData, options.filters);
    
    // Group data if specified
    const groupedData = options.groupBy 
      ? this.groupData(filteredData, options.groupBy)
      : filteredData;

    // Generate export based on format
    switch (options.format) {
      case 'csv':
        return await this.exportCSV(groupedData, options);
      case 'json':
        return await this.exportJSON(userId, groupedData, options);
      case 'pdf':
        return await this.exportPDF(userId, groupedData, options);
      case 'excel':
        return await this.exportExcel(userId, groupedData, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Get raw usage data from tracker
   */
  private async getRawUsageData(_userId: string, _options: ExportOptions): Promise<TokenUsage[]> {
    // This would use the database query from APIUsageTracker
    // For now, using a mock implementation

    // Mock data - in real implementation, this would come from the database
    return [];
  }

  /**
   * Apply filters to usage data
   */
  private applyFilters(data: TokenUsage[], filters?: ExportOptions['filters']): TokenUsage[] {
    if (!filters) return data;

    let filtered = data;

    if (filters.models?.length) {
      filtered = filtered.filter(item => filters.models!.includes(item.model));
    }

    if (filters.requestTypes?.length) {
      filtered = filtered.filter(item => filters.requestTypes!.includes(item.requestType));
    }

    if (filters.minCost !== undefined) {
      filtered = filtered.filter(item => item.estimatedCost >= filters.minCost!);
    }

    if (filters.maxCost !== undefined) {
      filtered = filtered.filter(item => item.estimatedCost <= filters.maxCost!);
    }

    return filtered;
  }

  /**
   * Group data by specified criteria
   */
  private groupData(data: TokenUsage[], groupBy: string): any[] {
    const grouped = new Map();

    data.forEach(item => {
      let key: string = '';

      switch (groupBy) {
        case 'day':
          key = item.timestamp.toISOString().split('T')[0] || '';
          break;
        case 'week':
          const weekStart = new Date(item.timestamp);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().split('T')[0] || '';
          break;
        case 'month':
          key = `${item.timestamp.getFullYear()}-${String(item.timestamp.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'session':
          key = item.sessionId;
          break;
        case 'model':
          key = item.model;
          break;
        default:
          key = item.id;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          items: [],
          totalTokens: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          requestCount: 0
        });
      }

      const group = grouped.get(key);
      group.items.push(item);
      group.totalTokens += item.totalTokens;
      group.totalInputTokens += item.inputTokens;
      group.totalOutputTokens += item.outputTokens;
      group.totalCost += item.estimatedCost;
      group.requestCount += 1;
    });

    return Array.from(grouped.values());
  }

  /**
   * Export data as CSV
   */
  private async exportCSV(data: any[], options: ExportOptions): Promise<ExportResult> {
    const headers = this.getCSVHeaders(options);
    const rows = data.map(item => this.formatCSVRow(item, options));
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const filename = `usage-export-${new Date().toISOString().split('T')[0] || 'unknown'}.csv`;
    
    return {
      data: csvContent,
      filename,
      mimeType: 'text/csv',
      size: Buffer.byteLength(csvContent, 'utf8')
    };
  }

  /**
   * Get CSV headers based on options
   */
  private getCSVHeaders(options: ExportOptions): string[] {
    const baseHeaders = ['Date', 'Model', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Request Type'];
    
    if (options.fields) {
      return options.fields;
    }

    if (options.groupBy) {
      return ['Period', 'Total Tokens', 'Total Cost', 'Requests', 'Avg Cost per Request'];
    }

    return baseHeaders;
  }

  /**
   * Format row for CSV export
   */
  private formatCSVRow(item: any, options: ExportOptions): string[] {
    if (options.groupBy) {
      return [
        item.key || '',
        item.totalTokens?.toString() || '0',
        item.totalCost?.toFixed(4) || '0.0000',
        item.requestCount?.toString() || '0',
        item.requestCount > 0 ? (item.totalCost / item.requestCount).toFixed(4) : '0.0000'
      ];
    }

    return [
      item.timestamp.toISOString(),
      item.model,
      item.inputTokens.toString(),
      item.outputTokens.toString(),
      item.totalTokens.toString(),
      item.estimatedCost.toFixed(4),
      item.requestType
    ];
  }

  /**
   * Export data as JSON
   */
  private async exportJSON(userId: string, data: any[], options: ExportOptions): Promise<ExportResult> {
    const exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        userId,
        dateRange: options.dateRange,
        recordCount: data.length,
        format: 'json',
        version: '1.0'
      },
      usage: data
    };

    // Add metrics if requested
    if (options.includeMetrics) {
      const metrics = await this.usageTracker.getUsageMetrics(
        userId,
        options.dateRange.start,
        options.dateRange.end
      );
      exportData.metrics = metrics;
    }

    // Add cost breakdown if requested
    if (options.includeCostBreakdown) {
      exportData.costBreakdown = this.generateCostBreakdown(data, options.currency);
    }

    // Add model distribution if requested
    if (options.includeModelDistribution) {
      exportData.modelDistribution = this.generateModelDistribution(data);
    }

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = `usage-export-${new Date().toISOString().split('T')[0] || 'unknown'}.json`;

    return {
      data: jsonContent,
      filename,
      mimeType: 'application/json',
      size: Buffer.byteLength(jsonContent, 'utf8')
    };
  }

  /**
   * Export data as PDF
   */
  private async exportPDF(userId: string, data: any[], options: ExportOptions): Promise<ExportResult> {
    // This would require a PDF generation library like jsPDF or PDFKit
    // For now, returning a mock implementation
    const pdfContent = this.generatePDFContent(userId, data, options);
    const filename = `usage-report-${new Date().toISOString().split('T')[0]}.pdf`;

    return {
      data: Buffer.from(pdfContent),
      filename,
      mimeType: 'application/pdf',
      size: Buffer.byteLength(pdfContent)
    };
  }

  /**
   * Export data as Excel
   */
  private async exportExcel(userId: string, data: any[], options: ExportOptions): Promise<ExportResult> {
    // This would require a library like ExcelJS
    // For now, returning a mock implementation
    const excelContent = this.generateExcelContent(userId, data, options);
    const filename = `usage-export-${new Date().toISOString().split('T')[0]}.xlsx`;

    return {
      data: Buffer.from(excelContent),
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: Buffer.byteLength(excelContent)
    };
  }

  /**
   * Generate cost breakdown
   */
  private generateCostBreakdown(data: any[], currency?: string): any {
    const breakdown = {
      totalCost: 0,
      inputTokenCost: 0,
      outputTokenCost: 0,
      currency: currency || 'USD',
      byModel: {} as Record<string, number>,
      byRequestType: {} as Record<string, number>
    };

    data.forEach(item => {
      if (item.items) {
        // Grouped data
        item.items.forEach((subItem: TokenUsage) => {
          this.addToCostBreakdown(breakdown, subItem);
        });
      } else {
        // Individual items
        this.addToCostBreakdown(breakdown, item);
      }
    });

    return breakdown;
  }

  /**
   * Add item to cost breakdown
   */
  private addToCostBreakdown(breakdown: any, item: TokenUsage): void {
    breakdown.totalCost += item.estimatedCost;
    
    // Estimate input/output costs (rough approximation)
    const inputCost = item.estimatedCost * 0.3; // Typically lower cost
    const outputCost = item.estimatedCost * 0.7; // Typically higher cost
    
    breakdown.inputTokenCost += inputCost;
    breakdown.outputTokenCost += outputCost;
    
    breakdown.byModel[item.model] = (breakdown.byModel[item.model] || 0) + item.estimatedCost;
    breakdown.byRequestType[item.requestType] = (breakdown.byRequestType[item.requestType] || 0) + item.estimatedCost;
  }

  /**
   * Generate model distribution
   */
  private generateModelDistribution(data: any[]): any {
    const distribution: Record<string, any> = {};

    data.forEach(item => {
      if (item.items) {
        // Grouped data
        item.items.forEach((subItem: TokenUsage) => {
          this.addToModelDistribution(distribution, subItem);
        });
      } else {
        // Individual items
        this.addToModelDistribution(distribution, item);
      }
    });

    // Calculate percentages
    const totalCost = Object.values(distribution).reduce((sum: number, model: any) => sum + model.cost, 0);
    Object.values(distribution).forEach((model: any) => {
      model.percentage = totalCost > 0 ? (model.cost / totalCost) * 100 : 0;
    });

    return distribution;
  }

  /**
   * Add item to model distribution
   */
  private addToModelDistribution(distribution: Record<string, any>, item: TokenUsage): void {
    if (!distribution[item.model]) {
      distribution[item.model] = {
        requests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        percentage: 0
      };
    }

    const model = distribution[item.model];
    model.requests += 1;
    model.totalTokens += item.totalTokens;
    model.inputTokens += item.inputTokens;
    model.outputTokens += item.outputTokens;
    model.cost += item.estimatedCost;
  }

  /**
   * Generate PDF content (mock implementation)
   */
  private generatePDFContent(userId: string, data: any[], _options: ExportOptions): string {
    // This would use a PDF generation library
    return `Mock PDF content for user ${userId} with ${data.length} records`;
  }

  /**
   * Generate Excel content (mock implementation)
   */
  private generateExcelContent(userId: string, data: any[], _options: ExportOptions): string {
    // This would use an Excel generation library
    return `Mock Excel content for user ${userId} with ${data.length} records`;
  }

  /**
   * Save export template
   */
  saveTemplate(template: ExportTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get export template
   */
  getTemplate(id: string): ExportTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  listTemplates(): ExportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Export using template
   */
  async exportWithTemplate(userId: string, templateId: string, overrides?: Partial<ExportOptions>): Promise<ExportResult> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const options = { ...template.options, ...overrides };
    return this.exportUsage(userId, options);
  }

  /**
   * Get export preview (first few rows)
   */
  async getExportPreview(userId: string, options: ExportOptions, limit: number = 10): Promise<any[]> {
    const rawData = await this.getRawUsageData(userId, options);
    const filteredData = this.applyFilters(rawData, options.filters);
    const groupedData = options.groupBy 
      ? this.groupData(filteredData, options.groupBy)
      : filteredData;

    return groupedData.slice(0, limit);
  }

  /**
   * Estimate export size
   */
  async estimateExportSize(userId: string, options: ExportOptions): Promise<{
    recordCount: number;
    estimatedSize: number;
    estimatedSizeFormatted: string;
  }> {
    const rawData = await this.getRawUsageData(userId, options);
    const filteredData = this.applyFilters(rawData, options.filters);
    const recordCount = filteredData.length;

    // Rough size estimates per record by format
    const sizePerRecord = {
      csv: 150,    // bytes per record
      json: 400,   // bytes per record (includes metadata)
      pdf: 50,     // bytes per record (compressed)
      excel: 200   // bytes per record
    };

    const baseSize = recordCount * sizePerRecord[options.format];
    const metadataOverhead = options.includeMetrics || options.includeCostBreakdown ? 5000 : 1000;
    const estimatedSize = baseSize + metadataOverhead;

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return {
      recordCount,
      estimatedSize,
      estimatedSizeFormatted: formatSize(estimatedSize)
    };
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (options.dateRange.start >= options.dateRange.end) {
      errors.push('Start date must be before end date');
    }

    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (options.dateRange.end.getTime() - options.dateRange.start.getTime() > maxRange) {
      errors.push('Date range cannot exceed 1 year');
    }

    if (options.fields && options.fields.length === 0) {
      errors.push('At least one field must be specified when using custom fields');
    }

    if (!['csv', 'json', 'pdf', 'excel'].includes(options.format)) {
      errors.push('Invalid export format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}