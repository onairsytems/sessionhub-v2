
/**
 * Data model for sessions
 */

import { InstructionProtocol } from './Instruction';
import { ExecutionResult } from './ExecutionResult';

export interface Session {
  id: string;
  name: string;
  description: string;
  objective?: string;
  
  status: SessionStatus;
  
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  userId: string;
  projectId: string;
  
  request: SessionRequest;
  instructions?: InstructionProtocol;
  result?: ExecutionResult;
  
  error?: SessionError;
  
  metadata: SessionMetadata;
}

export type SessionStatus = 
  | 'pending'      // In queue
  | 'planning'     // Generating instructions
  | 'validating'   // Validating instructions
  | 'executing'    // Running execution
  | 'completed'    // Successfully completed
  | 'failed'       // Failed with error
  | 'cancelled'    // Cancelled by user or system
  | 'paused';      // Temporarily paused

export type SessionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SessionRequest {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  context: Record<string, any>;
  timestamp: string;
  priority?: number;
}

export interface SessionError {
  code: string;
  message: string;
  actor?: 'planning' | 'execution' | 'system';
  phase?: string;
  stack?: string;
  recoverable: boolean;
}

export interface SessionMetadata {
  projectPath?: string;
  environment?: string;
  tags?: string[];
  labels?: Record<string, string>;
  
  // Runtime metadata
  queuePosition?: number;
  retryCount?: number;
  priority?: SessionPriority;
  executionTime?: number;
  progress?: {
    completedSteps: number;
    totalSteps: number;
    percentage: number;
    currentStep?: string;
  };
  
  // Performance metadata
  planningDuration?: number;
  executionDuration?: number;
  totalDuration?: number;
  
  // Custom metadata
  [key: string]: unknown;
}