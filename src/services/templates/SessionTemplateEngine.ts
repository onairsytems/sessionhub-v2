/**
 * @actor system
 * @responsibility Session template system for saving and reusing successful workflow patterns
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { Session } from '@/src/models/Session';
import { SessionTemplate } from '../persistence/EnhancedSessionPersistence';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface TemplatePattern {
  id: string;
  name: string;
  description: string;
  structure: TemplateStructure;
  variables: TemplateVariable[];
  validationRules: ValidationRule[];
  metadata: TemplateMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStructure {
  requestFormat: {
    requiredFields: string[];
    optionalFields: string[];
    fieldTypes: Record<string, string>;
    fieldConstraints: Record<string, any>;
  };
  instructionFlow: {
    phases: TemplatePhase[];
    dependencies: Record<string, string[]>;
    parallelizable: string[];
  };
  deliverables: {
    files: TemplateFile[];
    artifacts: TemplateArtifact[];
    reports: TemplateReport[];
  };
  validation: {
    preConditions: string[];
    postConditions: string[];
    qualityChecks: string[];
  };
}

export interface TemplatePhase {
  id: string;
  name: string;
  description: string;
  actor: 'planning' | 'execution' | 'validation';
  estimatedDuration: number;
  criticalPath: boolean;
  inputs: string[];
  outputs: string[];
  tools: string[];
  commands: TemplateCommand[];
}

export interface TemplateCommand {
  id: string;
  type: 'shell' | 'api' | 'file' | 'validation';
  command: string;
  parameters: Record<string, any>;
  conditions: string[];
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
    recoverableErrors: string[];
  };
}

export interface TemplateFile {
  id: string;
  name: string;
  path: string;
  type: 'source' | 'config' | 'documentation' | 'test';
  template: string;
  variables: string[];
  required: boolean;
}

export interface TemplateArtifact {
  id: string;
  name: string;
  type: 'binary' | 'package' | 'deployment' | 'report';
  outputPath: string;
  dependencies: string[];
  verification: string[];
}

export interface TemplateReport {
  id: string;
  name: string;
  format: 'markdown' | 'json' | 'html' | 'pdf';
  sections: TemplateReportSection[];
  autoGenerate: boolean;
}

export interface TemplateReportSection {
  id: string;
  title: string;
  content: string;
  dataSource: string;
  charts?: TemplateChart[];
}

export interface TemplateChart {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'table';
  dataQuery: string;
  configuration: Record<string, any>;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: any[];
  };
  scope: 'global' | 'phase' | 'command';
  dependencies?: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'syntax' | 'semantic' | 'performance' | 'security' | 'custom';
  severity: 'error' | 'warning' | 'info';
  condition: string;
  message: string;
  autoFix?: string;
}

export interface TemplateMetadata {
  category: string;
  subcategory: string;
  framework?: string;
  language?: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  estimatedTime: number;
  prerequisites: string[];
  tags: string[];
  author: string;
  version: string;
  compatibility: {
    minVersion: string;
    maxVersion?: string;
    platforms: string[];
  };
  analytics: {
    usageCount: number;
    successRate: number;
    averageDuration: number;
    lastUsed?: string;
    popularVariations: string[];
  };
}

export interface TemplateCustomization {
  templateId: string;
  name: string;
  description: string;
  variableValues: Record<string, any>;
  enabledPhases: string[];
  disabledValidations: string[];
  customCommands: TemplateCommand[];
  additionalFiles: TemplateFile[];
  metadata: Record<string, any>;
}

export interface TemplateExecution {
  id: string;
  templateId: string;
  customizationId?: string;
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  variables: Record<string, any>;
  progress: {
    currentPhase: string;
    completedPhases: string[];
    totalPhases: number;
    percentage: number;
  };
  results: {
    files: Array<{ path: string; status: 'created' | 'modified' | 'failed' }>;
    artifacts: Array<{ name: string; path: string; verified: boolean }>;
    reports: Array<{ name: string; path: string; format: string }>;
  };
  logs: TemplateExecutionLog[];
  errors: TemplateExecutionError[];
  metrics: {
    duration: number;
    linesOfCode: number;
    filesGenerated: number;
    testsRun: number;
    validationsPassed: number;
  };
}

export interface TemplateExecutionLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  phase: string;
  command?: string;
  message: string;
  data?: any;
}

export interface TemplateExecutionError {
  timestamp: string;
  phase: string;
  command?: string;
  error: string;
  stack?: string;
  recoverable: boolean;
  resolution?: string;
}

export interface TemplateLibrary {
  featured: TemplatePattern[];
  categories: Record<string, TemplatePattern[]>;
  recent: TemplatePattern[];
  personal: TemplatePattern[];
  community: TemplatePattern[];
}

export class SessionTemplateEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly templatesDir: string;
  private readonly patternsDir: string;
  private readonly executionsDir: string;
  private readonly libraryDir: string;

  private templates = new Map<string, SessionTemplate>();
  private patterns = new Map<string, TemplatePattern>();
  private executions = new Map<string, TemplateExecution>();
  private customizations = new Map<string, TemplateCustomization>();

  private readonly builtInTemplates: TemplatePattern[] = [];

  constructor(logger: Logger, auditLogger: AuditLogger) {
    super();
    this.logger = logger;
    this.auditLogger = auditLogger;
    
    // Use auditLogger for template operations
    this.auditLogger.logEvent({
      actor: { type: 'system', id: 'session-template-engine' },
      operation: { type: 'initialization', description: 'SessionTemplateEngine initialized' },
      result: { status: 'success', duration: 0 },
      metadata: { correlationId: this.generateId('init') }
    });

    const dataDir = path.join(app.getPath('userData'), 'sessionhub-v2');
    this.templatesDir = path.join(dataDir, 'templates');
    this.patternsDir = path.join(dataDir, 'template-patterns');
    this.executionsDir = path.join(dataDir, 'template-executions');
    this.libraryDir = path.join(dataDir, 'template-library');

    this.initializeTemplateEngine();
  }

  /**
   * Initialize template engine
   */
  private async initializeTemplateEngine(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.templatesDir, { recursive: true }),
      fs.mkdir(this.patternsDir, { recursive: true }),
      fs.mkdir(this.executionsDir, { recursive: true }),
      fs.mkdir(this.libraryDir, { recursive: true })
    ]);

    await this.loadBuiltInTemplates();
    await this.loadAllTemplates();
    await this.loadAllPatterns();
    await this.loadAllCustomizations();

    this.logger.info('Session template engine initialized', {
      templatesCount: this.templates.size,
      patternsCount: this.patterns.size,
      builtInCount: this.builtInTemplates.length
    });
  }

  /**
   * Create template from successful session
   */
  async createTemplateFromSession(
    session: Session,
    templateInfo: {
      name: string;
      description: string;
      category: string;
      complexity: TemplateMetadata['complexity'];
      tags: string[];
    }
  ): Promise<TemplatePattern> {
    const pattern = await this.analyzeSessionPattern(session, templateInfo);
    
    this.patterns.set(pattern.id, pattern);
    await this.persistPattern(pattern);

    this.emit('templateCreated', pattern);

    this.logger.info('Template created from session', {
      templateId: pattern.id,
      sessionId: session.id,
      name: pattern.name
    });

    return pattern;
  }

  /**
   * Create custom template pattern
   */
  async createCustomTemplate(
    name: string,
    description: string,
    structure: TemplateStructure,
    variables: TemplateVariable[],
    metadata: Partial<TemplateMetadata>
  ): Promise<TemplatePattern> {
    const pattern: TemplatePattern = {
      id: this.generateId('tpl'),
      name,
      description,
      structure,
      variables,
      validationRules: [],
      metadata: {
        category: metadata.category || 'custom',
        subcategory: metadata.subcategory || 'general',
        framework: metadata.framework,
        language: metadata.language,
        complexity: metadata.complexity || 'moderate',
        estimatedTime: metadata.estimatedTime || 3600000, // 1 hour default
        prerequisites: metadata.prerequisites || [],
        tags: metadata.tags || [],
        author: metadata.author || 'user',
        version: '1.0.0',
        compatibility: metadata.compatibility || {
          minVersion: '2.5.0',
          platforms: ['darwin', 'linux', 'win32']
        },
        analytics: {
          usageCount: 0,
          successRate: 0,
          averageDuration: 0,
          popularVariations: []
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.patterns.set(pattern.id, pattern);
    await this.persistPattern(pattern);

    this.logger.info('Custom template created', {
      templateId: pattern.id,
      name,
      category: pattern.metadata.category
    });

    return pattern;
  }

  /**
   * Get template library organized by categories
   */
  async getTemplateLibrary(): Promise<TemplateLibrary> {
    const allPatterns = Array.from(this.patterns.values());
    
    // Organize by categories
    const categories: Record<string, TemplatePattern[]> = {};
    for (const pattern of allPatterns) {
      const category = pattern.metadata.category || 'uncategorized';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category]!.push(pattern);
    }

    // Sort each category by usage and success rate
    for (const category of Object.keys(categories)) {
      categories[category]!.sort((a, b) => {
        const aScore = a.metadata.analytics.usageCount * a.metadata.analytics.successRate;
        const bScore = b.metadata.analytics.usageCount * b.metadata.analytics.successRate;
        return bScore - aScore;
      });
    }

    // Get featured templates (high usage, high success rate)
    const featured = allPatterns
      .filter(p => p.metadata.analytics.usageCount > 5 && p.metadata.analytics.successRate > 0.8)
      .sort((a, b) => b.metadata.analytics.usageCount - a.metadata.analytics.usageCount)
      .slice(0, 6);

    // Get recent templates
    const recent = allPatterns
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    return {
      featured,
      categories,
      recent,
      personal: allPatterns.filter(p => p.metadata.author === 'user'),
      community: allPatterns.filter(p => p.metadata.author !== 'user' && p.metadata.author !== 'system')
    };
  }

  /**
   * Search templates
   */
  async searchTemplates(
    query: string,
    filters: {
      category?: string;
      complexity?: TemplateMetadata['complexity'];
      framework?: string;
      language?: string;
      tags?: string[];
      minSuccessRate?: number;
    } = {}
  ): Promise<TemplatePattern[]> {
    let patterns = Array.from(this.patterns.values());

    // Text search
    if (query) {
      const queryLower = query.toLowerCase();
      patterns = patterns.filter(p =>
        p.name.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.metadata.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }

    // Apply filters
    if (filters.category) {
      patterns = patterns.filter(p => p.metadata.category === filters.category);
    }

    if (filters.complexity) {
      patterns = patterns.filter(p => p.metadata.complexity === filters.complexity);
    }

    if (filters.framework) {
      patterns = patterns.filter(p => p.metadata.framework === filters.framework);
    }

    if (filters.language) {
      patterns = patterns.filter(p => p.metadata.language === filters.language);
    }

    if (filters.tags && filters.tags.length > 0) {
      patterns = patterns.filter(p =>
        filters.tags!.some(tag => p.metadata.tags.includes(tag))
      );
    }

    if (filters.minSuccessRate) {
      patterns = patterns.filter(p => p.metadata.analytics.successRate >= filters.minSuccessRate!);
    }

    // Sort by relevance (usage count * success rate)
    patterns.sort((a, b) => {
      const aScore = a.metadata.analytics.usageCount * a.metadata.analytics.successRate;
      const bScore = b.metadata.analytics.usageCount * b.metadata.analytics.successRate;
      return bScore - aScore;
    });

    return patterns;
  }

  /**
   * Customize template for specific use case
   */
  async customizeTemplate(
    templateId: string,
    customization: Omit<TemplateCustomization, 'templateId'>
  ): Promise<TemplateCustomization> {
    const template = this.patterns.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const fullCustomization: TemplateCustomization = {
      ...customization,
      templateId
    };

    // Validate customization
    await this.validateTemplateCustomization(template, fullCustomization);

    const customizationId = this.generateId('custom');
    this.customizations.set(customizationId, fullCustomization);
    await this.persistCustomization(fullCustomization);

    this.logger.info('Template customized', {
      templateId,
      customizationId,
      name: customization.name
    });

    return fullCustomization;
  }

  /**
   * Execute template to generate session
   */
  async executeTemplate(
    templateId: string,
    variables: Record<string, any>,
    customizationId?: string
  ): Promise<TemplateExecution> {
    const template = this.patterns.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const customization = customizationId ? this.customizations.get(customizationId) : undefined;

    // Validate variables
    await this.validateTemplateVariables(template, variables);

    const execution: TemplateExecution = {
      id: this.generateId('exec'),
      templateId,
      customizationId,
      sessionId: this.generateId('sess'),
      status: 'pending',
      startedAt: new Date().toISOString(),
      variables,
      progress: {
        currentPhase: template.structure.instructionFlow.phases[0]?.id || '',
        completedPhases: [],
        totalPhases: template.structure.instructionFlow.phases.length,
        percentage: 0
      },
      results: {
        files: [],
        artifacts: [],
        reports: []
      },
      logs: [],
      errors: [],
      metrics: {
        duration: 0,
        linesOfCode: 0,
        filesGenerated: 0,
        testsRun: 0,
        validationsPassed: 0
      }
    };

    this.executions.set(execution.id, execution);
    await this.persistExecution(execution);

    // Start execution process
    this.executeTemplateAsync(execution, template, customization);

    this.emit('templateExecutionStarted', execution);

    this.logger.info('Template execution started', {
      executionId: execution.id,
      templateId,
      sessionId: execution.sessionId
    });

    return execution;
  }

  /**
   * Get template execution status
   */
  async getExecution(executionId: string): Promise<TemplateExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * Cancel template execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      await this.persistExecution(execution);

      this.emit('templateExecutionCancelled', execution);

      this.logger.info('Template execution cancelled', { executionId });
    }
  }

  /**
   * Get template pattern by ID
   */
  async getTemplate(templateId: string): Promise<TemplatePattern | null> {
    return this.patterns.get(templateId) || null;
  }

  /**
   * Update template analytics after usage
   */
  async updateTemplateAnalytics(
    templateId: string,
    execution: TemplateExecution
  ): Promise<void> {
    const template = this.patterns.get(templateId);
    if (!template) {
      return;
    }

    const wasSuccessful = execution.status === 'completed' && execution.errors.length === 0;
    
    // Update analytics
    template.metadata.analytics.usageCount++;
    template.metadata.analytics.lastUsed = new Date().toISOString();
    
    if (wasSuccessful) {
      const currentSuccessCount = template.metadata.analytics.successRate * (template.metadata.analytics.usageCount - 1);
      template.metadata.analytics.successRate = (currentSuccessCount + 1) / template.metadata.analytics.usageCount;
    } else {
      const currentSuccessCount = template.metadata.analytics.successRate * (template.metadata.analytics.usageCount - 1);
      template.metadata.analytics.successRate = currentSuccessCount / template.metadata.analytics.usageCount;
    }

    // Update average duration
    if (execution.metrics.duration > 0) {
      const currentTotalDuration = template.metadata.analytics.averageDuration * (template.metadata.analytics.usageCount - 1);
      template.metadata.analytics.averageDuration = (currentTotalDuration + execution.metrics.duration) / template.metadata.analytics.usageCount;
    }

    template.updatedAt = new Date().toISOString();
    await this.persistPattern(template);

    this.logger.info('Template analytics updated', {
      templateId,
      usageCount: template.metadata.analytics.usageCount,
      successRate: template.metadata.analytics.successRate
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const template = this.patterns.get(templateId);
    if (!template) {
      return;
    }

    // Remove from memory
    this.patterns.delete(templateId);

    // Remove file
    const templateFile = path.join(this.patternsDir, `${templateId}.json`);
    await fs.unlink(templateFile).catch(() => {});

    this.emit('templateDeleted', templateId);

    this.logger.info('Template deleted', { templateId, name: template.name });
  }

  // Private helper methods

  private async analyzeSessionPattern(
    session: Session,
    templateInfo: {
      name: string;
      description: string;
      category: string;
      complexity: TemplateMetadata['complexity'];
      tags: string[];
    }
  ): Promise<TemplatePattern> {
    // Extract pattern from session data
    const structure: TemplateStructure = {
      requestFormat: {
        requiredFields: ['content'],
        optionalFields: ['context', 'priority'],
        fieldTypes: {
          content: 'string',
          context: 'object',
          priority: 'number'
        },
        fieldConstraints: {
          content: { minLength: 10, maxLength: 10000 }
        }
      },
      instructionFlow: {
        phases: [
          {
            id: 'planning',
            name: 'Planning Phase',
            description: 'Generate execution plan',
            actor: 'planning',
            estimatedDuration: 300000, // 5 minutes
            criticalPath: true,
            inputs: ['request'],
            outputs: ['instructions'],
            tools: ['claude-chat'],
            commands: []
          },
          {
            id: 'execution',
            name: 'Execution Phase',
            description: 'Execute generated plan',
            actor: 'execution',
            estimatedDuration: 1800000, // 30 minutes
            criticalPath: true,
            inputs: ['instructions'],
            outputs: ['deliverables'],
            tools: ['claude-code'],
            commands: []
          }
        ],
        dependencies: {
          execution: ['planning']
        },
        parallelizable: []
      },
      deliverables: {
        files: [],
        artifacts: [],
        reports: [
          {
            id: 'session-report',
            name: 'Session Execution Report',
            format: 'markdown',
            sections: [
              {
                id: 'summary',
                title: 'Summary',
                content: '## Session Summary\n\n{{summary}}',
                dataSource: 'session.result'
              }
            ],
            autoGenerate: true
          }
        ]
      },
      validation: {
        preConditions: ['valid_request', 'configured_apis'],
        postConditions: ['deliverables_generated', 'no_errors'],
        qualityChecks: ['syntax_check', 'type_check']
      }
    };

    // Extract variables from session
    const variables: TemplateVariable[] = [
      {
        name: 'request_content',
        type: 'string',
        description: 'The main request content',
        required: true,
        scope: 'global'
      },
      {
        name: 'project_path',
        type: 'string',
        description: 'Path to the project directory',
        required: false,
        scope: 'global'
      }
    ];

    const pattern: TemplatePattern = {
      id: this.generateId('tpl'),
      name: templateInfo.name,
      description: templateInfo.description,
      structure,
      variables,
      validationRules: [],
      metadata: {
        category: templateInfo.category,
        subcategory: 'generated',
        complexity: templateInfo.complexity,
        estimatedTime: session.metadata.totalDuration || 3600000,
        prerequisites: [],
        tags: templateInfo.tags,
        author: 'system',
        version: '1.0.0',
        compatibility: {
          minVersion: '2.5.0',
          platforms: ['darwin', 'linux', 'win32']
        },
        analytics: {
          usageCount: 0,
          successRate: 0,
          averageDuration: 0,
          popularVariations: []
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return pattern;
  }

  private async executeTemplateAsync(
    execution: TemplateExecution,
    template: TemplatePattern,
    customization?: TemplateCustomization
  ): Promise<void> {
    try {
      execution.status = 'running';
      await this.persistExecution(execution);

      const startTime = Date.now();
      
      // Execute each phase
      for (const phase of template.structure.instructionFlow.phases) {
        if (customization?.enabledPhases && !customization.enabledPhases.includes(phase.id)) {
          continue;
        }

        execution.progress.currentPhase = phase.id;
        await this.persistExecution(execution);

        this.addExecutionLog(execution, 'info', phase.id, `Starting phase: ${phase.name}`);

        try {
          await this.executePhase(execution, phase, template, customization);
          
          execution.progress.completedPhases.push(phase.id);
          execution.progress.percentage = (execution.progress.completedPhases.length / execution.progress.totalPhases) * 100;
          
          this.addExecutionLog(execution, 'info', phase.id, `Completed phase: ${phase.name}`);
        } catch (error) {
          this.addExecutionError(execution, phase.id, error as Error);
          
          if (phase.criticalPath) {
            throw error;
          }
        }
      }

      // Generate reports
      await this.generateTemplateReports(execution, template);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.metrics.duration = Date.now() - startTime;

      this.emit('templateExecutionCompleted', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      this.addExecutionError(execution, 'system', error as Error);

      this.emit('templateExecutionFailed', execution);

      this.logger.error('Template execution failed', error as Error, {
        executionId: execution.id,
        templateId: template.id
      });
    } finally {
      await this.persistExecution(execution);
      await this.updateTemplateAnalytics(template.id, execution);
    }
  }

  private async executePhase(
    execution: TemplateExecution,
    phase: TemplatePhase,
    template: TemplatePattern,
    customization?: TemplateCustomization
  ): Promise<void> {
    // Use template and customization parameters
    void template;
    void customization;
    // This would integrate with the actual execution engines
    // For now, simulate phase execution
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work

    // Update metrics based on phase
    if (phase.actor === 'execution') {
      execution.metrics.filesGenerated += 5;
      execution.metrics.linesOfCode += 100;
    }
  }

  private async generateTemplateReports(
    execution: TemplateExecution,
    template: TemplatePattern
  ): Promise<void> {
    for (const reportDef of template.structure.deliverables.reports) {
      if (!reportDef.autoGenerate) continue;

      try {
        const reportContent = await this.generateReport(execution, reportDef);
        const reportPath = path.join(this.executionsDir, `${execution.id}-${reportDef.id}.${reportDef.format}`);
        
        await fs.writeFile(reportPath, reportContent, 'utf-8');
        
        execution.results.reports.push({
          name: reportDef.name,
          path: reportPath,
          format: reportDef.format
        });
        
        this.addExecutionLog(execution, 'info', 'reporting', `Generated report: ${reportDef.name}`);
      } catch (error) {
        this.addExecutionError(execution, 'reporting', error as Error);
      }
    }
  }

  private async generateReport(execution: TemplateExecution, reportDef: TemplateReport): Promise<string> {
    let content = '';
    
    for (const section of reportDef.sections) {
      content += `${section.content}\n\n`;
    }
    
    // Replace variables
    content = content.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return execution.variables[variable] || match;
    });
    
    return content;
  }

  private addExecutionLog(
    execution: TemplateExecution,
    level: TemplateExecutionLog['level'],
    phase: string,
    message: string,
    data?: any
  ): void {
    execution.logs.push({
      timestamp: new Date().toISOString(),
      level,
      phase,
      message,
      data
    });
  }

  private addExecutionError(
    execution: TemplateExecution,
    phase: string,
    error: Error,
    command?: string
  ): void {
    execution.errors.push({
      timestamp: new Date().toISOString(),
      phase,
      command,
      error: error.message,
      stack: error.stack,
      recoverable: true // Could be determined by error type
    });
  }

  private async validateTemplateCustomization(
    template: TemplatePattern,
    customization: TemplateCustomization
  ): Promise<void> {
    // Validate enabled phases exist
    for (const phaseId of customization.enabledPhases) {
      if (!template.structure.instructionFlow.phases.some(p => p.id === phaseId)) {
        throw new Error(`Phase ${phaseId} not found in template`);
      }
    }

    // Validate variable values
    await this.validateTemplateVariables(template, customization.variableValues);
  }

  private async validateTemplateVariables(
    template: TemplatePattern,
    variables: Record<string, any>
  ): Promise<void> {
    for (const variable of template.variables) {
      const value = variables[variable.name];
      
      // Check required variables
      if (variable.required && (value === undefined || value === null)) {
        throw new Error(`Required variable ${variable.name} is missing`);
      }
      
      // Type validation
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== variable.type) {
          throw new Error(`Variable ${variable.name} must be of type ${variable.type}, got ${actualType}`);
        }
      }
      
      // Pattern validation
      if (variable.validation?.pattern && typeof value === 'string') {
        const regex = new RegExp(variable.validation.pattern);
        if (!regex.test(value)) {
          throw new Error(`Variable ${variable.name} does not match required pattern`);
        }
      }
      
      // Range validation
      if (typeof value === 'number') {
        if (variable.validation?.min !== undefined && value < variable.validation.min) {
          throw new Error(`Variable ${variable.name} must be at least ${variable.validation.min}`);
        }
        if (variable.validation?.max !== undefined && value > variable.validation.max) {
          throw new Error(`Variable ${variable.name} must be at most ${variable.validation.max}`);
        }
      }
    }
  }

  private async loadBuiltInTemplates(): Promise<void> {
    // Load built-in template patterns
    const builtInPatterns: TemplatePattern[] = [
      {
        id: 'react-component',
        name: 'React Component',
        description: 'Create a new React component with TypeScript',
        structure: {
          requestFormat: {
            requiredFields: ['componentName', 'props'],
            optionalFields: ['styling', 'tests'],
            fieldTypes: {
              componentName: 'string',
              props: 'array',
              styling: 'string',
              tests: 'boolean'
            },
            fieldConstraints: {
              componentName: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
            }
          },
          instructionFlow: {
            phases: [
              {
                id: 'component-generation',
                name: 'Component Generation',
                description: 'Generate React component files',
                actor: 'execution',
                estimatedDuration: 300000,
                criticalPath: true,
                inputs: ['componentName', 'props'],
                outputs: ['componentFile', 'typesFile'],
                tools: ['file-generator'],
                commands: []
              }
            ],
            dependencies: {},
            parallelizable: []
          },
          deliverables: {
            files: [
              {
                id: 'component',
                name: '{{componentName}}.tsx',
                path: 'src/components/{{componentName}}.tsx',
                type: 'source',
                template: 'react-component-template',
                variables: ['componentName', 'props'],
                required: true
              }
            ],
            artifacts: [],
            reports: []
          },
          validation: {
            preConditions: ['valid_component_name'],
            postConditions: ['component_compiles'],
            qualityChecks: ['typescript_check', 'eslint_check']
          }
        },
        variables: [
          {
            name: 'componentName',
            type: 'string',
            description: 'Name of the React component',
            required: true,
            validation: {
              pattern: '^[A-Z][a-zA-Z0-9]*$'
            },
            scope: 'global'
          },
          {
            name: 'props',
            type: 'array',
            description: 'Component props definition',
            required: false,
            defaultValue: [],
            scope: 'global'
          }
        ],
        validationRules: [],
        metadata: {
          category: 'react',
          subcategory: 'component',
          framework: 'react',
          language: 'typescript',
          complexity: 'simple',
          estimatedTime: 300000,
          prerequisites: ['react', 'typescript'],
          tags: ['react', 'component', 'typescript'],
          author: 'system',
          version: '1.0.0',
          compatibility: {
            minVersion: '2.5.0',
            platforms: ['darwin', 'linux', 'win32']
          },
          analytics: {
            usageCount: 0,
            successRate: 0,
            averageDuration: 0,
            popularVariations: []
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const pattern of builtInPatterns) {
      this.patterns.set(pattern.id, pattern);
      this.builtInTemplates.push(pattern);
    }

    this.logger.info('Built-in templates loaded', { count: builtInPatterns.length });
  }

  private async loadAllTemplates(): Promise<void> {
    try {
      const files = await fs.readdir(this.templatesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.templatesDir, file), 'utf-8');
          const template = JSON.parse(content) as SessionTemplate;
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load templates', error as Error);
    }
  }

  private async loadAllPatterns(): Promise<void> {
    try {
      const files = await fs.readdir(this.patternsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.patternsDir, file), 'utf-8');
          const pattern = JSON.parse(content) as TemplatePattern;
          this.patterns.set(pattern.id, pattern);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load patterns', error as Error);
    }
  }

  private async loadAllCustomizations(): Promise<void> {
    try {
      const customFile = path.join(this.libraryDir, 'customizations.json');
      await fs.access(customFile);
      const content = await fs.readFile(customFile, 'utf-8');
      const customizations = JSON.parse(content) as TemplateCustomization[];
      customizations.forEach(custom => this.customizations.set(custom.name, custom));
    } catch {
      // File doesn't exist yet
    }
  }

  private async persistPattern(pattern: TemplatePattern): Promise<void> {
    const patternPath = path.join(this.patternsDir, `${pattern.id}.json`);
    await fs.writeFile(patternPath, JSON.stringify(pattern, null, 2), 'utf-8');
  }

  private async persistExecution(execution: TemplateExecution): Promise<void> {
    const executionPath = path.join(this.executionsDir, `${execution.id}.json`);
    await fs.writeFile(executionPath, JSON.stringify(execution, null, 2), 'utf-8');
  }

  private async persistCustomization(customization: TemplateCustomization): Promise<void> {
    void customization; // Avoid unused parameter warning
    const customFile = path.join(this.libraryDir, 'customizations.json');
    const customizations = Array.from(this.customizations.values());
    await fs.writeFile(customFile, JSON.stringify(customizations, null, 2), 'utf-8');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}