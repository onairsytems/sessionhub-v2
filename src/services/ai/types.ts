/**
 * AI Service Types
 * Session 2.8 Implementation
 */

// Re-export all types from individual modules
export type { LearningStatus } from './AIEnhancementManager';
export type { AutocompleteSuggestion, AutocompleteContext } from './SmartAutocomplete';
export type { CodePattern, PatternSearchCriteria } from './PatternLibrary';
export type { MetricsSummary, SessionMetrics } from './SessionMetricsTracker';

// Additional common types
export interface ProjectKnowledge {
  patterns: Map<string, any>;
  dependencies: string[];
  structure: any;
  lastAnalyzed: Date;
}

export interface CodingStyle {
  naming: any;
  formatting: any;
  patterns: string[];
}

export interface StylePattern {
  pattern: string;
  frequency: number;
  examples: string[];
}

export interface ProjectInsight {
  type: string;
  description: string;
  recommendation?: string;
  confidence: number;
}

export interface NameVariation {
  original: string;
  variations: string[];
  context: string;
}

export interface AIConfiguration {
  learningEnabled: boolean;
  autocompleteEnabled: boolean;
  metricsEnabled: boolean;
  crossProjectEnabled: boolean;
  maxPatternsPerProject: number;
  minConfidenceThreshold: number;
}