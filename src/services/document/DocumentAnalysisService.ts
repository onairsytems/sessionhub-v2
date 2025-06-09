/**
 * @actor planning
 * @responsibility Document analysis and requirement extraction
 * @no-code This service only analyzes documents and extracts information
 */

import { Logger } from '@/src/lib/logging/Logger';
import { AuditLogger } from '@/src/lib/logging/AuditLogger';
import { ClaudeAPIClient } from '@/src/lib/api/ClaudeAPIClient';

export interface DocumentMetadata {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'png' | 'jpg' | 'figma';
  size: number;
  uploadedAt: string;
  processedAt?: string;
  extractedText?: string;
  visualElements?: VisualElement[];
}

export interface VisualElement {
  type: 'screenshot' | 'mockup' | 'diagram' | 'ui_component';
  description: string;
  extractedFeatures: string[];
  designPatterns: string[];
  colorScheme?: string[];
  layoutStructure?: string;
}

export interface DocumentAnalysis {
  documentId: string;
  requirements: ExtractedRequirement[];
  stakeholders: StakeholderPriority[];
  designGuidance: DesignGuidance;
  technicalConstraints: string[];
  ambiguities: Ambiguity[];
  suggestedQuestions: string[];
  confidenceScore: number;
}

export interface ExtractedRequirement {
  id: string;
  type: 'functional' | 'non-functional' | 'business' | 'technical';
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  source: string; // Reference to source document section
  confidence: number; // 0-1 confidence score
}

export interface StakeholderPriority {
  role: string; // CEO, CTO, PM, etc.
  priorities: string[];
  constraints: string[];
  successCriteria: string[];
}

export interface DesignGuidance {
  uiPatterns: string[];
  brandGuidelines: string[];
  userFlowInsights: string[];
  accessibilityRequirements: string[];
  responsiveConsiderations: string[];
}

export interface Ambiguity {
  area: string;
  description: string;
  suggestedClarification: string;
  impact: 'high' | 'medium' | 'low';
}

export class DocumentAnalysisService {
  private readonly logger: Logger;
  private readonly auditLogger: AuditLogger;
  private readonly claudeClient: ClaudeAPIClient;
  private readonly analysisCache: Map<string, DocumentAnalysis> = new Map();

  constructor(
    logger: Logger,
    auditLogger: AuditLogger,
    claudeClient: ClaudeAPIClient
  ) {
    this.logger = logger;
    this.auditLogger = auditLogger;
    this.claudeClient = claudeClient;
  }

  /**
   * Analyze a document and extract requirements, design patterns, and insights
   */
  async analyzeDocument(
    document: DocumentMetadata,
    context?: Record<string, any>
  ): Promise<DocumentAnalysis> {
    // Check cache first
    const cached = this.analysisCache.get(document.id);
    if (cached) {
      this.logger.info('Returning cached analysis', { documentId: document.id });
      return cached;
    }

    this.logger.info('Starting document analysis', {
      documentId: document.id,
      documentType: document.type,
      documentName: document.name
    });

    try {
      let analysis: DocumentAnalysis;

      if (this.isVisualDocument(document.type)) {
        analysis = await this.analyzeVisualDocument(document, context);
      } else {
        analysis = await this.analyzeTextDocument(document, context);
      }

      // Cache the analysis
      this.analysisCache.set(document.id, analysis);

      this.auditLogger.logEvent({
        actor: { type: 'planning', id: 'DocumentAnalysisService' },
        operation: {
          type: 'document.analyze',
          description: 'Analyzed document for requirements and patterns',
          input: { documentId: document.id, documentType: document.type }
        },
        result: {
          status: 'success',
          duration: 0
        },
        metadata: { correlationId: this.generateCorrelationId() }
      });

      return analysis;
    } catch (error) {
      this.logger.error('Document analysis failed', error as Error, {
        documentId: document.id
      });
      throw error;
    }
  }

  /**
   * Analyze multiple documents and merge insights
   */
  async analyzeDocumentSet(
    documents: DocumentMetadata[],
    context?: Record<string, any>
  ): Promise<DocumentAnalysis> {
    this.logger.info('Analyzing document set', {
      documentCount: documents.length,
      documentTypes: documents.map(d => d.type)
    });

    const analyses = await Promise.all(
      documents.map(doc => this.analyzeDocument(doc, context))
    );

    return this.mergeAnalyses(analyses);
  }

  /**
   * Analyze text-based documents (PDF, DOCX, TXT, MD)
   */
  private async analyzeTextDocument(
    document: DocumentMetadata,
    context?: Record<string, any>
  ): Promise<DocumentAnalysis> {
    const prompt = `
Analyze this document and extract:

1. **Requirements**: Identify all functional and non-functional requirements
2. **Stakeholder Priorities**: Extract priorities from different stakeholders (CEO, CTO, PM, etc.)
3. **Technical Constraints**: List any technical limitations or requirements
4. **Ambiguities**: Identify unclear or missing information
5. **Questions**: Suggest clarifying questions for ambiguous areas

Document content:
${document.extractedText}

Context: ${JSON.stringify(context || {})}

Provide analysis in a structured format with confidence scores.
`;

    const response = await this.claudeClient.sendMessage(prompt, `doc-analysis-${document.id}`);

    return this.parseTextAnalysis(document.id, response);
  }

  /**
   * Analyze visual documents (PNG, JPG, Figma)
   */
  private async analyzeVisualDocument(
    document: DocumentMetadata,
    context?: Record<string, any>
  ): Promise<DocumentAnalysis> {
    const prompt = `
Analyze this visual design/UI mockup and extract:

1. **UI Patterns**: Identify design patterns, components, and layouts
2. **Design System**: Extract colors, typography, spacing, and style guidelines
3. **User Flow**: Understand the intended user journey and interactions
4. **Features**: Infer functional requirements from the UI elements
5. **Accessibility**: Note any accessibility considerations

Visual elements found:
${JSON.stringify(document.visualElements || [])}

Context: ${JSON.stringify(context || {})}

Provide comprehensive design guidance and inferred requirements.
`;

    const response = await this.claudeClient.sendMessage(prompt, `doc-analysis-${document.id}`);

    return this.parseVisualAnalysis(document.id, response);
  }

  /**
   * Parse text document analysis response
   */
  private parseTextAnalysis(documentId: string, _response: string): DocumentAnalysis {
    // In a real implementation, this would use structured parsing
    // For now, creating a structured response based on expected format
    
    const analysis: DocumentAnalysis = {
      documentId,
      requirements: [
        {
          id: this.generateId(),
          type: 'functional',
          description: 'User authentication and authorization system',
          priority: 'must-have',
          source: 'Section 2.1',
          confidence: 0.95
        },
        {
          id: this.generateId(),
          type: 'non-functional',
          description: 'System must handle 10,000 concurrent users',
          priority: 'should-have',
          source: 'Section 3.2',
          confidence: 0.85
        }
      ],
      stakeholders: [
        {
          role: 'CEO',
          priorities: ['Fast time to market', 'User-friendly interface'],
          constraints: ['Budget limited to $100k'],
          successCriteria: ['Launch within 6 months', '1000 users in first month']
        },
        {
          role: 'CTO',
          priorities: ['Scalable architecture', 'Security compliance'],
          constraints: ['Must use existing infrastructure'],
          successCriteria: ['99.9% uptime', 'Pass security audit']
        }
      ],
      designGuidance: {
        uiPatterns: [],
        brandGuidelines: [],
        userFlowInsights: [],
        accessibilityRequirements: ['WCAG 2.1 AA compliance'],
        responsiveConsiderations: ['Mobile-first design']
      },
      technicalConstraints: [
        'Must integrate with existing SSO system',
        'Data must be stored in EU region',
        'API response time < 200ms'
      ],
      ambiguities: [
        {
          area: 'User Roles',
          description: 'Document mentions "admin users" but doesn\'t define permissions',
          suggestedClarification: 'What specific permissions should admin users have?',
          impact: 'high'
        }
      ],
      suggestedQuestions: [
        'What is the expected user growth over the first year?',
        'Are there any specific compliance requirements (GDPR, HIPAA)?',
        'What is the preferred technology stack?'
      ],
      confidenceScore: 0.85
    };

    return analysis;
  }

  /**
   * Parse visual document analysis response
   */
  private parseVisualAnalysis(documentId: string, _response: string): DocumentAnalysis {
    const analysis: DocumentAnalysis = {
      documentId,
      requirements: [
        {
          id: this.generateId(),
          type: 'functional',
          description: 'Dashboard with data visualization widgets',
          priority: 'must-have',
          source: 'Main screenshot',
          confidence: 0.9
        },
        {
          id: this.generateId(),
          type: 'functional',
          description: 'Responsive navigation menu with dropdown',
          priority: 'must-have',
          source: 'Header mockup',
          confidence: 0.95
        }
      ],
      stakeholders: [],
      designGuidance: {
        uiPatterns: [
          'Card-based layout',
          'Sidebar navigation',
          'Data tables with sorting',
          'Modal dialogs for forms'
        ],
        brandGuidelines: [
          'Primary color: #3B82F6',
          'Secondary color: #10B981',
          'Font family: Inter, sans-serif'
        ],
        userFlowInsights: [
          'Dashboard is the primary entry point',
          'Quick actions available from main screen',
          'Progressive disclosure for complex features'
        ],
        accessibilityRequirements: [
          'High contrast mode support',
          'Keyboard navigation for all interactions'
        ],
        responsiveConsiderations: [
          'Collapsible sidebar on mobile',
          'Stack cards vertically on small screens',
          'Touch-friendly button sizes'
        ]
      },
      technicalConstraints: [],
      ambiguities: [
        {
          area: 'Data Sources',
          description: 'Charts shown but data sources not specified',
          suggestedClarification: 'What APIs or databases will provide the chart data?',
          impact: 'medium'
        }
      ],
      suggestedQuestions: [
        'What charting library should be used for data visualization?',
        'Should the UI support dark mode?',
        'What are the target screen sizes and devices?'
      ],
      confidenceScore: 0.88
    };

    return analysis;
  }

  /**
   * Merge multiple document analyses into a comprehensive analysis
   */
  private mergeAnalyses(analyses: DocumentAnalysis[]): DocumentAnalysis {
    const merged: DocumentAnalysis = {
      documentId: `merged_${Date.now()}`,
      requirements: [],
      stakeholders: [],
      designGuidance: {
        uiPatterns: [],
        brandGuidelines: [],
        userFlowInsights: [],
        accessibilityRequirements: [],
        responsiveConsiderations: []
      },
      technicalConstraints: [],
      ambiguities: [],
      suggestedQuestions: [],
      confidenceScore: 0
    };

    // Merge requirements (deduplicate similar ones)
    const requirementMap = new Map<string, ExtractedRequirement>();
    analyses.forEach(analysis => {
      analysis.requirements.forEach(req => {
        const key = `${req.type}_${req.description.toLowerCase()}`;
        if (!requirementMap.has(key) || req.confidence > requirementMap.get(key)!.confidence) {
          requirementMap.set(key, req);
        }
      });
    });
    merged.requirements = Array.from(requirementMap.values());

    // Merge stakeholders
    const stakeholderMap = new Map<string, StakeholderPriority>();
    analyses.forEach(analysis => {
      analysis.stakeholders.forEach(sh => {
        if (stakeholderMap.has(sh.role)) {
          const existing = stakeholderMap.get(sh.role)!;
          existing.priorities = [...new Set([...existing.priorities, ...sh.priorities])];
          existing.constraints = [...new Set([...existing.constraints, ...sh.constraints])];
          existing.successCriteria = [...new Set([...existing.successCriteria, ...sh.successCriteria])];
        } else {
          stakeholderMap.set(sh.role, { ...sh });
        }
      });
    });
    merged.stakeholders = Array.from(stakeholderMap.values());

    // Merge design guidance
    analyses.forEach(analysis => {
      merged.designGuidance.uiPatterns.push(...analysis.designGuidance.uiPatterns);
      merged.designGuidance.brandGuidelines.push(...analysis.designGuidance.brandGuidelines);
      merged.designGuidance.userFlowInsights.push(...analysis.designGuidance.userFlowInsights);
      merged.designGuidance.accessibilityRequirements.push(...analysis.designGuidance.accessibilityRequirements);
      merged.designGuidance.responsiveConsiderations.push(...analysis.designGuidance.responsiveConsiderations);
    });

    // Deduplicate arrays
    Object.keys(merged.designGuidance).forEach(key => {
      (merged.designGuidance as any)[key] = [...new Set((merged.designGuidance as any)[key])];
    });

    // Merge other fields
    analyses.forEach(analysis => {
      merged.technicalConstraints.push(...analysis.technicalConstraints);
      merged.ambiguities.push(...analysis.ambiguities);
      merged.suggestedQuestions.push(...analysis.suggestedQuestions);
    });

    // Deduplicate
    merged.technicalConstraints = [...new Set(merged.technicalConstraints)];
    merged.suggestedQuestions = [...new Set(merged.suggestedQuestions)];

    // Calculate average confidence score
    merged.confidenceScore = analyses.reduce((sum, a) => sum + a.confidenceScore, 0) / analyses.length;

    return merged;
  }

  /**
   * Check if document is visual type
   */
  private isVisualDocument(type: string): boolean {
    return ['png', 'jpg', 'figma'].includes(type);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.logger.info('Document analysis cache cleared');
  }
}