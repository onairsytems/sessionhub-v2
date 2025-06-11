/**
 * SessionHub Testing Infrastructure
 * Central export point for all testing components
 */

// Core Testing Framework
export {
  ComprehensiveTestingFramework,
  getTestingFramework,
  runComprehensiveTests
} from './ComprehensiveTestingFramework';

export type {
  TestingConfiguration,
  TestSuite,
  Test,
  TestResult,
  ComprehensiveTestReport,
  TestingSummary
} from './ComprehensiveTestingFramework';

// Advanced Testing Mode
export {
  AdvancedTestingMode,
  getTestingMode,
  enableTestingMode,
  disableTestingMode
} from './AdvancedTestingMode';

export type {
  TestingModeConfig,
  DiagnosticInfo,
  TestExecutionContext,
  TestDataManager
} from './AdvancedTestingMode';

// Safe Testing Environment
export {
  SafeTestingEnvironment,
  getSafeTestingEnvironment,
  resetSafeTestingEnvironment
} from './SafeTestingEnvironment';

export type {
  IsolationConfig,
  TestEnvironment,
  ServiceMock
} from './SafeTestingEnvironment';

// Session Inspector
export {
  SessionInspector,
  getSessionInspector,
  resetSessionInspector
} from './SessionInspector';

export type {
  SessionState,
  PlanningStep,
  ExecutionStep,
  ValidationResult,
  InspectionReport,
  SessionStatus,
  InspectionOptions
} from './SessionInspector';

// Production Readiness Validator
export {
  ProductionReadinessValidator,
  getProductionValidator,
  validateProductionReadiness
} from './ProductionReadinessValidator';

export type {
  ValidationCategory,
  ValidationCheck,
  ValidationResult as ProductionValidationResult,
  ProductionReadinessReport,
  CategoryResult
} from './ProductionReadinessValidator';

// Integration Validator
export {
  IntegrationValidator,
  getIntegrationValidator,
  validateIntegrations
} from './IntegrationValidator';

export type {
  IntegrationTest,
  IntegrationResult,
  ServiceIntegration,
  IntegrationReport,
  ServiceStatus
} from './IntegrationValidator';

// Performance Benchmark
export {
  PerformanceBenchmark,
  getPerformanceBenchmark,
  runPerformanceBenchmarks
} from './PerformanceBenchmark';

export type {
  BenchmarkConfig,
  Benchmark,
  BenchmarkResult,
  PerformanceMetrics,
  PerformanceReport,
  PerformanceViolation
} from './PerformanceBenchmark';

// Security Audit Framework
export {
  SecurityAuditFramework,
  getSecurityAudit,
  runSecurityAudit
} from './SecurityAuditFramework';

export type {
  SecurityCheck,
  SecurityCheckResult,
  SecurityVulnerability,
  SecurityAuditReport,
  SecuritySummary
} from './SecurityAuditFramework';

// Testing Issue Identifier
export {
  TestingIssueIdentifier,
  getIssueIdentifier,
  reportTestingIssue
} from './TestingIssueIdentifier';

export type {
  TestingIssue,
  IssueCategory,
  IssueSeverity,
  IssuePriority,
  IssueStatus,
  IssueReport,
  IssueStatistics
} from './TestingIssueIdentifier';

// Manual Testing Checklist
export {
  ManualTestingChecklist,
  getManualTestingChecklist,
  createTestChecklist
} from './ManualTestingChecklist';

export type {
  TestChecklist,
  ChecklistSection,
  ChecklistStep,
  TestExecution,
  StepResult,
  ChecklistReport,
  ChecklistCategory
} from './ManualTestingChecklist';