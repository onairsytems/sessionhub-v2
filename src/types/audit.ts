/**
 * Audit Event Types
 */

export type AuditEventType = 
  | 'self_development'
  | 'deployment_initialized'
  | 'emergency_recovery'
  | 'security'
  | 'github'
  | 'pipeline'
  | 'conversion'
  | 'recovery'
  | 'deployment'
  | 'update_built'
  | 'update_deployed'
  | 'update_rolled_back'
  | 'code_modified'
  | 'session_failed'
  | 'self-development'
  | 'deployment-initialized'
  | 'emergency-recovery';

export interface AuditEvent {
  id?: string;
  timestamp?: Date;
  type: AuditEventType | string; // Allow string for compatibility
  actor: string;
  action: string;
  target: string;
  details: Record<string, any>;
  risk: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, any>;
  severity?: 'info' | 'warning' | 'error';
  message?: string;
  data?: any;
  integrity?: string;
}