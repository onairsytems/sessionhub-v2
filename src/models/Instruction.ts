
/**
 * Core data models for the Two-Actor Architecture
 * These types define the structure of communication between actors
 */

export interface InstructionMetadata {
  id: string;
  sessionId: string;
  sessionName: string;
  timestamp: string;
  version: '1.0';
  actor: 'planning' | 'execution';
}

export interface InstructionContext {
  description: string;
  prerequisites: string[];
  relatedSessions?: string[];
  userRequest: string;
}

export interface InstructionObjective {
  id: string;
  primary: string;
  secondary?: string[];
  measurable: boolean;
}

export interface InstructionRequirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  details?: string[];
  acceptanceCriteria?: string[];
}

export interface InstructionDeliverable {
  type: 'file' | 'directory' | 'config' | 'documentation' | 'service';
  path?: string;
  description: string;
  validation?: string;
}

export interface InstructionConstraints {
  technology?: string[];
  patterns?: string[];
  dependencies?: string[];
  avoid?: string[];
  timeLimit?: number; // in milliseconds
}

export interface SuccessCriterion {
  id: string;
  criterion: string;
  validationMethod: string;
  automated: boolean;
}

export interface InstructionProtocol {
  metadata: InstructionMetadata;
  context: InstructionContext;
  objectives: InstructionObjective[];
  requirements: InstructionRequirement[];
  deliverables: InstructionDeliverable[];
  constraints: InstructionConstraints;
  successCriteria: SuccessCriterion[];
}

export interface ExecutionResult {
  instructionId: string;
  status: 'success' | 'failure' | 'partial';
  startTime: string;
  endTime: string;
  outputs: ExecutionOutput[];
  errors: ExecutionError[];
  logs: string[];
  validationResults: ValidationResult[];
}

export interface ExecutionOutput {
  type: 'file' | 'console' | 'service' | 'artifact';
  path?: string;
  content?: string;
  description: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  stack?: string;
  recoverable: boolean;
}

export interface ValidationResult {
  criterionId: string;
  passed: boolean;
  message: string;
  details?: unknown;
}