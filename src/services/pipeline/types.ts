/**
 * Types for the Self-Development Pipeline
 */

export interface GitHubWebhookPayload {
  action: string;
  issue?: {
    id: number;
    number: number;
    title: string;
    body: string;
    labels: Array<{
      name: string;
    }>;
    state: string;
    user: {
      login: string;
    };
    created_at: string;
    updated_at: string;
  };
  repository?: {
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
  };
}

export interface SessionInstruction {
  id: string;
  sourceType: 'github-issue' | 'production-error' | 'manual';
  sourceId: string;
  title: string;
  description?: string;
  objectives: string[];
  requirements: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: SessionCategory;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  metadata: {
    githubIssueNumber?: number;
    githubRepoFullName?: string;
    errorTrace?: string;
    affectedUsers?: number;
    [key: string]: any;
  };
  createdAt: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export type SessionCategory = 
  | 'bug-fix'
  | 'feature'
  | 'performance'
  | 'security'
  | 'refactor'
  | 'documentation'
  | 'infrastructure'
  | 'ui-ux';

export interface PipelineConfig {
  github: {
    webhookSecret: string;
    apiToken: string;
    repos: string[];
    labelFilter: string[];
  };
  production: {
    errorThreshold: number;
    monitoringInterval: number;
  };
  deployment: {
    autoDeployEnabled: boolean;
    requiresApproval: boolean;
    signatureKeyPath: string;
    updateChannels: Array<'stable' | 'beta' | 'alpha'>;
  };
  emergency: {
    recoveryEndpoint: string;
    fallbackVersion: string;
  };
}

export interface DeploymentPackage {
  version: string;
  channel: 'stable' | 'beta' | 'alpha';
  platform: 'darwin' | 'win32' | 'linux';
  architecture: 'x64' | 'arm64' | 'universal';
  signature: string;
  checksum: string;
  deltaFrom?: string;
  size: number;
  releaseNotes: string;
  criticalUpdate: boolean;
  minSystemVersion?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: string;
  targetType: 'session' | 'deployment' | 'issue' | 'error';
  targetId: string;
  details: Record<string, any>;
  result: 'success' | 'failure';
  errorMessage?: string;
}

export type AuditAction = 
  | 'session.created'
  | 'session.started'
  | 'session.completed'
  | 'session.failed'
  | 'deployment.initiated'
  | 'deployment.approved'
  | 'deployment.rejected'
  | 'deployment.completed'
  | 'issue.processed'
  | 'error.detected'
  | 'recovery.initiated';

export interface PipelineStatus {
  isRunning: boolean;
  currentSession?: SessionInstruction;
  queueLength: number;
  lastDeployment?: {
    version: string;
    timestamp: Date;
    status: 'success' | 'failure';
  };
  health: {
    github: 'connected' | 'disconnected' | 'error';
    production: 'healthy' | 'degraded' | 'critical';
    deployment: 'ready' | 'deploying' | 'blocked';
  };
}