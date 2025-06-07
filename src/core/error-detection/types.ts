/**
 * Type definitions for the Error Detection System
 */

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorReport {
  filePath: string;
  line: number;
  column: number;
  severity: ErrorSeverity;
  category: string;
  code: string;
  message: string;
  suggestion?: string;
  timestamp: string;
  stackTrace?: string;
  context?: ErrorContext;
}

export interface ErrorContext {
  beforeLines: string[];
  errorLine: string;
  afterLines: string[];
  relatedFiles?: string[];
}

export interface ErrorPattern {
  pattern: RegExp;
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: string;
}

export interface ValidationResult {
  success: boolean;
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<string, number>;
  duration: number;
  timestamp: string;
  errors: ErrorReport[];
}

export interface ErrorFix {
  description: string;
  changes: FileChange[];
  confidence: 'high' | 'medium' | 'low';
}

export interface FileChange {
  filePath: string;
  line: number;
  column: number;
  oldText: string;
  newText: string;
}

export interface ErrorMetrics {
  totalDetected: number;
  totalFixed: number;
  detectionRate: number;
  fixRate: number;
  averageFixTime: number;
  commonErrors: ErrorFrequency[];
  errorTrends: ErrorTrend[];
}

export interface ErrorFrequency {
  code: string;
  count: number;
  percentage: number;
}

export interface ErrorTrend {
  date: string;
  errorCount: number;
  category: string;
}

export interface BuildValidation {
  canBuild: boolean;
  blockingErrors: ErrorReport[];
  warnings: ErrorReport[];
  timestamp: string;
}

export interface CICDIntegration {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'custom';
  enabled: boolean;
  blockOnError: boolean;
  blockOnWarning: boolean;
  reportFormat: 'json' | 'junit' | 'markdown';
}

export interface ErrorDetectionConfig {
  enableRealTime: boolean;
  enableBuildValidation: boolean;
  enableCICD: boolean;
  strictMode: boolean;
  customPatterns: ErrorPattern[];
  ignoredFiles: string[];
  ignoredRules: string[];
  maxErrors: number;
  timeout: number;
}