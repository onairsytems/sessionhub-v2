/**
 * Data model for execution results
 */

export interface ExecutionResult {
  sessionId: string;
  instructionId: string;
  status: 'success' | 'partial' | 'failure';
  startTime: string;
  endTime: string;
  duration: number;
  
  deliverables: ExecutionDeliverable[];
  
  tasks: ExecutionTask[];
  
  logs: string[];
  errors: string[];
  warnings: string[];
  
  metrics: ExecutionMetrics;
  
  metadata?: Record<string, any>;
}

export interface ExecutionDeliverable {
  type: 'file' | 'directory' | 'config' | 'documentation';
  path: string;
  description: string;
  status: 'created' | 'modified' | 'failed' | 'skipped';
  size?: number;
  checksum?: string;
}

export interface ExecutionTask {
  id: string;
  requirementId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  output?: any;
  error?: string;
}

export interface ExecutionMetrics {
  totalTasks: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  
  filesCreated: number;
  filesModified: number;
  
  linesAdded: number;
  linesRemoved: number;
  
  testsRun?: number;
  testsPassed?: number;
  
  memoryUsed: number;
  cpuTime: number;
}