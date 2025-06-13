/**
 * Session type converter between models and Supabase
 * Handles conversion between Session (domain model) and SupabaseSessionRecord (database model)
 */

import { Session, SessionStatus, SessionMetadata } from '@/src/models/Session';
import { SupabaseSessionRecord } from '@/src/services/cloud/SupabaseService';

export class SessionConverter {
  /**
   * Convert SupabaseSessionRecord to Session domain model
   */
  static toSession(record: SupabaseSessionRecord): Session {
    const metadata = record.metadata || {};
    
    // Extract session-specific metadata
    const { 
      request,
      instructions,
      result,
      error,
      projectPath,
      environment,
      tags,
      labels,
      queuePosition,
      retryCount,
      progress,
      planningDuration,
      executionDuration,
      totalDuration,
      ...customMetadata
    } = metadata;

    const sessionMetadata: SessionMetadata = {
      projectPath,
      environment,
      tags,
      labels,
      queuePosition,
      retryCount,
      progress,
      planningDuration,
      executionDuration,
      totalDuration,
      ...customMetadata
    };

    // Map Supabase status to Session status
    const statusMap: Record<string, SessionStatus> = {
      'active': 'executing',
      'completed': 'completed',
      'paused': 'paused',
      'cancelled': 'cancelled',
      'pending': 'pending'
    };

    const session: Session = {
      id: record.id || '',
      name: record.title || 'Untitled Session',
      description: record.description || '',
      status: (statusMap[record.status || ''] || 'pending') as SessionStatus,
      createdAt: record.created_at || new Date().toISOString(),
      updatedAt: record.updated_at || new Date().toISOString(),
      completedAt: record.status === 'completed' ? record.updated_at : undefined,
      userId: record.user_id,
      projectId: record.project_id,
      request: request || {
        id: record.id || '',
        sessionId: record.id || '',
        userId: record.user_id,
        content: record.description || '',
        context: {},
        timestamp: record.created_at || new Date().toISOString()
      },
      instructions: instructions,
      result: result,
      error: error,
      metadata: sessionMetadata
    };

    return session;
  }

  /**
   * Convert Session domain model to SupabaseSessionRecord
   */
  static toSupabaseRecord(session: Session): SupabaseSessionRecord {
    // Map Session status to Supabase status
    const statusMap: Record<SessionStatus, string> = {
      'pending': 'paused',
      'planning': 'active',
      'validating': 'active',
      'executing': 'active',
      'completed': 'completed',
      'failed': 'cancelled',
      'cancelled': 'cancelled',
      'paused': 'paused'
    };

    // Combine all metadata
    const combinedMetadata = {
      ...session.metadata,
      request: session.request,
      instructions: session.instructions,
      result: session.result,
      error: session.error
    };

    const record: SupabaseSessionRecord = {
      id: session.id,
      user_id: session.userId,
      project_id: session.projectId,
      status: statusMap[session.status] as 'active' | 'completed' | 'paused' | 'cancelled',
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      metadata: combinedMetadata,
      title: session.name,
      description: session.description,
      total_duration: session.metadata.totalDuration?.toString()
    };

    return record;
  }

  /**
   * Convert array of SupabaseSessionRecords to Sessions
   */
  static toSessions(records: SupabaseSessionRecord[]): Session[] {
    return records.map(record => SessionConverter.toSession(record));
  }

  /**
   * Convert array of Sessions to SupabaseSessionRecords
   */
  static toSupabaseRecords(sessions: Session[]): SupabaseSessionRecord[] {
    return sessions.map(session => SessionConverter.toSupabaseRecord(session));
  }

  /**
   * Extract only the fields that should be updated
   */
  static toSupabaseUpdate(updates: Partial<Session>): Partial<SupabaseSessionRecord> {
    const record: Partial<SupabaseSessionRecord> = {};

    if (updates.name !== undefined) {
      record.title = updates.name;
    }

    if (updates.description !== undefined) {
      record.description = updates.description;
    }

    if (updates.status !== undefined) {
      const statusMap: Record<SessionStatus, string> = {
        'pending': 'paused',
        'planning': 'active',
        'validating': 'active',
        'executing': 'active',
        'completed': 'completed',
        'failed': 'cancelled',
        'cancelled': 'cancelled',
        'paused': 'paused'
      };
      record.status = statusMap[updates.status] as 'active' | 'completed' | 'paused' | 'cancelled';
    }

    if (updates.metadata !== undefined || updates.request || updates.instructions || updates.result || updates.error) {
      record.metadata = {
        ...(updates.metadata || {}),
        ...(updates.request && { request: updates.request }),
        ...(updates.instructions && { instructions: updates.instructions }),
        ...(updates.result && { result: updates.result }),
        ...(updates.error && { error: updates.error })
      };
    }

    // Always update the updated_at timestamp
    record.updated_at = new Date().toISOString();

    return record;
  }
}