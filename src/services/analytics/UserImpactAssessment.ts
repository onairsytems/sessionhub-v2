import { ErrorAnalyticsEngine } from './ErrorAnalyticsEngine';
import { SessionService } from '../SessionService';
import { EventEmitter } from 'events';

export interface UserImpactMetrics {
  userId: string;
  sessionCount: number;
  errorCount: number;
  criticalErrorCount: number;
  errorRate: number; // Errors per session
  sessionSuccessRate: number;
  averageSessionDuration: number;
  abandonmentRate: number;
  recoverySuccessRate: number;
  workflowsAffected: string[];
  lastErrorTimestamp?: Date;
}

export interface SessionImpactAnalysis {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  errorCount: number;
  errorSequence: ErrorEvent[];
  completed: boolean;
  abandoned: boolean;
  workflowStage?: string;
  impactScore: number; // 0-100
  recoveryAttempts: number;
  finalOutcome: 'success' | 'partial' | 'failure';
}

export interface WorkflowImpact {
  workflowId: string;
  workflowName: string;
  totalAttempts: number;
  successfulCompletions: number;
  failedAttempts: number;
  averageErrorsPerAttempt: number;
  commonFailurePoints: FailurePoint[];
  completionRate: number;
  averageCompletionTime: number;
}

export interface FailurePoint {
  stage: string;
  errorCount: number;
  errorTypes: string[];
  impactedUsers: number;
  suggestions: string[];
}

export interface ErrorEvent {
  timestamp: Date;
  errorType: string;
  severity: string;
  component: string;
  recovered: boolean;
  recoveryTime?: number;
  userAction?: string;
}

export interface UserSegment {
  id: string;
  name: string;
  criteria: SegmentCriteria;
  userCount: number;
  characteristics: {
    averageErrorRate: number;
    commonErrors: string[];
    peakErrorTimes: Date[];
    recoveryRate: number;
  };
}

export interface SegmentCriteria {
  errorRateRange?: { min: number; max: number };
  sessionCountRange?: { min: number; max: number };
  lastActiveRange?: { start: Date; end: Date };
  workflowUsage?: string[];
}

export class UserImpactAssessment extends EventEmitter {
  private analyticsEngine: ErrorAnalyticsEngine;
  private sessionService: SessionService;
  
  private userMetrics: Map<string, UserImpactMetrics> = new Map();
  private sessionAnalyses: Map<string, SessionImpactAnalysis> = new Map();
  private workflowImpacts: Map<string, WorkflowImpact> = new Map();
  private userSegments: Map<string, UserSegment> = new Map();
  
  private assessmentInterval: NodeJS.Timeout | null = null;
  private readonly ASSESSMENT_INTERVAL = 300000; // 5 minutes
  
  constructor(
    analyticsEngine: ErrorAnalyticsEngine,
    sessionService: SessionService
  ) {
    super();
    this.analyticsEngine = analyticsEngine;
    this.sessionService = sessionService;
    
    this.initializeAssessment();
  }
  
  private initializeAssessment(): void {
    // Start periodic assessment
    this.assessmentInterval = setInterval(() => {
      this.runComprehensiveAssessment();
    }, this.ASSESSMENT_INTERVAL);
    
    // Run initial assessment
    this.runComprehensiveAssessment();
    
    // Listen to real-time updates
    this.analyticsEngine.on('error:captured', (errorEntry) => {
      this.updateUserMetricsRealTime(errorEntry);
    });
    
    // TODO: Implement session event listeners
    // this.sessionService.on('session:ended', (session: any) => {
    //   this.analyzeCompletedSession(session);
    // });
  }
  
  private async runComprehensiveAssessment(): Promise<void> {
    try {
      await Promise.all([
        this.assessUserImpact(),
        this.analyzeSessionPatterns(),
        this.evaluateWorkflowImpact(),
        this.segmentUsers(),
        this.generateImpactInsights()
      ]);
      
      this.emit('assessment:complete', {
        userMetrics: Array.from(this.userMetrics.values()),
        sessionAnalyses: Array.from(this.sessionAnalyses.values()),
        workflowImpacts: Array.from(this.workflowImpacts.values()),
        userSegments: Array.from(this.userSegments.values())
      });
    } catch (error) {
      // console.error('Error in user impact assessment:', error);
    }
  }
  
  private async assessUserImpact(): Promise<void> {
    const sessions = await this.sessionService.getRecentSessions(86400000); // Last 24 hours
    // const _errorMetrics = this.analyticsEngine.getMetrics();
    
    // Group sessions by user
    const userSessions = new Map<string, any[]>();
    sessions.forEach((session: any) => {
      const userId = session.userId || 'anonymous';
      if (!userSessions.has(userId)) {
        userSessions.set(userId, []);
      }
      userSessions.get(userId)!.push(session);
    });
    
    // Calculate metrics for each user
    for (const [userId, userSessionList] of userSessions) {
      const metrics = this.calculateUserMetrics(userId, userSessionList);
      this.userMetrics.set(userId, metrics);
    }
  }
  
  private calculateUserMetrics(userId: string, sessions: any[]): UserImpactMetrics {
    let totalErrors = 0;
    let criticalErrors = 0;
    let totalDuration = 0;
    let abandonedSessions = 0;
    let recoveredErrors = 0;
    let totalRecoveryAttempts = 0;
    const workflowsSet = new Set<string>();
    let lastErrorTime: Date | undefined;
    
    sessions.forEach(session => {
      if (session.errors) {
        totalErrors += session.errors.length;
        criticalErrors += session.errors.filter((e: any) => e.severity === 'critical').length;
        
        session.errors.forEach((error: any) => {
          if (error.recovered) {
            recoveredErrors++;
          }
          if (error.timestamp && (!lastErrorTime || error.timestamp > lastErrorTime)) {
            lastErrorTime = new Date(error.timestamp);
          }
        });
      }
      
      if (session.duration) {
        totalDuration += session.duration;
      }
      
      if (session.abandoned || session.status === 'abandoned') {
        abandonedSessions++;
      }
      
      if (session.workflow) {
        workflowsSet.add(session.workflow);
      }
      
      if (session.recoveryAttempts) {
        totalRecoveryAttempts += session.recoveryAttempts;
      }
    });
    
    const successfulSessions = sessions.filter(s => 
      s.status === 'completed' || (!s.abandoned && !s.errors?.length)
    ).length;
    
    return {
      userId,
      sessionCount: sessions.length,
      errorCount: totalErrors,
      criticalErrorCount: criticalErrors,
      errorRate: sessions.length > 0 ? totalErrors / sessions.length : 0,
      sessionSuccessRate: sessions.length > 0 ? successfulSessions / sessions.length : 0,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      abandonmentRate: sessions.length > 0 ? abandonedSessions / sessions.length : 0,
      recoverySuccessRate: totalRecoveryAttempts > 0 ? recoveredErrors / totalRecoveryAttempts : 0,
      workflowsAffected: Array.from(workflowsSet),
      lastErrorTimestamp: lastErrorTime
    };
  }
  
  private updateUserMetricsRealTime(errorEntry: any): void {
    const userId = errorEntry.context?.userId || 'anonymous';
    const metrics = this.userMetrics.get(userId) || this.createEmptyUserMetrics(userId);
    
    metrics.errorCount++;
    if (errorEntry.context?.severity === 'critical') {
      metrics.criticalErrorCount++;
    }
    metrics.lastErrorTimestamp = errorEntry.timestamp;
    
    this.userMetrics.set(userId, metrics);
    this.emit('user:impacted', { userId, error: errorEntry });
  }
  
  private createEmptyUserMetrics(userId: string): UserImpactMetrics {
    return {
      userId,
      sessionCount: 0,
      errorCount: 0,
      criticalErrorCount: 0,
      errorRate: 0,
      sessionSuccessRate: 0,
      averageSessionDuration: 0,
      abandonmentRate: 0,
      recoverySuccessRate: 0,
      workflowsAffected: []
    };
  }
  
  private async analyzeSessionPatterns(): Promise<void> {
    const recentSessions = await this.sessionService.getRecentSessions(3600000); // Last hour
    
    for (const session of recentSessions) {
      const analysis = this.analyzeSession(session);
      this.sessionAnalyses.set(session.id, analysis);
    }
  }
  
  private analyzeSession(session: any): SessionImpactAnalysis {
    const errorSequence: ErrorEvent[] = (session.errors || []).map((error: any) => ({
      timestamp: new Date(error.timestamp),
      errorType: error.type || error.name,
      severity: error.severity,
      component: error.component,
      recovered: error.recovered || false,
      recoveryTime: error.recoveryTime,
      userAction: error.userAction
    }));
    
    const impactScore = this.calculateSessionImpactScore(session, errorSequence);
    
    return {
      sessionId: session.id,
      userId: session.userId || 'anonymous',
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      duration: session.duration || 0,
      errorCount: errorSequence.length,
      errorSequence,
      completed: session.status === 'completed',
      abandoned: session.status === 'abandoned' || session.abandoned || false,
      workflowStage: session.currentStage,
      impactScore,
      recoveryAttempts: session.recoveryAttempts || 0,
      finalOutcome: this.determineSessionOutcome(session, errorSequence)
    };
  }
  
  private calculateSessionImpactScore(session: any, errors: ErrorEvent[]): number {
    let score = 100;
    
    // Deduct points for errors
    errors.forEach(error => {
      switch (error.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
      
      // Add points back for successful recovery
      if (error.recovered) {
        score += 10;
      }
    });
    
    // Deduct for abandonment
    if (session.abandoned) {
      score -= 30;
    }
    
    // Deduct for excessive duration
    const expectedDuration = 300000; // 5 minutes
    if (session.duration > expectedDuration * 2) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  private determineSessionOutcome(
    session: any, 
    errors: ErrorEvent[]
  ): 'success' | 'partial' | 'failure' {
    if (session.abandoned || errors.some(e => e.severity === 'critical' && !e.recovered)) {
      return 'failure';
    }
    
    if (session.status === 'completed' && errors.length === 0) {
      return 'success';
    }
    
    if (session.status === 'completed' && errors.every(e => e.recovered)) {
      return 'success';
    }
    
    return 'partial';
  }
  
  /* private async _analyzeCompletedSession(session: any): Promise<void> {
    const analysis = this.analyzeSession(session);
    this.sessionAnalyses.set(session.id, analysis);
    
    // Update workflow impact
    if (session.workflow) {
      this.updateWorkflowImpact(session.workflow, analysis);
    }
    
    // Update user metrics
    const userId = session.userId || 'anonymous';
    const userSessions = await this.sessionService.getUserSessions(userId);
    const metrics = this.calculateUserMetrics(userId, userSessions);
    this.userMetrics.set(userId, metrics);
    
    this.emit('session:analyzed', analysis);
  } */
  
  private async evaluateWorkflowImpact(): Promise<void> {
    const sessions = Array.from(this.sessionAnalyses.values());
    const workflowGroups = new Map<string, SessionImpactAnalysis[]>();
    
    // Group sessions by workflow
    sessions.forEach((session: any) => {
      if (session.workflowStage) {
        const workflow = session.workflowStage.split(':')[0];
        if (!workflowGroups.has(workflow)) {
          workflowGroups.set(workflow, []);
        }
        workflowGroups.get(workflow)!.push(session);
      }
    });
    
    // Analyze each workflow
    for (const [workflowId, workflowSessions] of workflowGroups) {
      const impact = this.calculateWorkflowImpact(workflowId, workflowSessions);
      this.workflowImpacts.set(workflowId, impact);
    }
  }
  
  private calculateWorkflowImpact(
    workflowId: string, 
    sessions: SessionImpactAnalysis[]
  ): WorkflowImpact {
    const totalAttempts = sessions.length;
    const successfulCompletions = sessions.filter(s => s.finalOutcome === 'success').length;
    const failedAttempts = sessions.filter(s => s.finalOutcome === 'failure').length;
    
    // Calculate error statistics
    let totalErrors = 0;
    const errorsByStage = new Map<string, number>();
    const errorTypesByStage = new Map<string, Set<string>>();
    const usersImpactedByStage = new Map<string, Set<string>>();
    
    sessions.forEach(session => {
      totalErrors += session.errorCount;
      
      session.errorSequence.forEach(error => {
        const stage = session.workflowStage || 'unknown';
        errorsByStage.set(stage, (errorsByStage.get(stage) || 0) + 1);
        
        if (!errorTypesByStage.has(stage)) {
          errorTypesByStage.set(stage, new Set());
        }
        errorTypesByStage.get(stage)!.add(error.errorType);
        
        if (!usersImpactedByStage.has(stage)) {
          usersImpactedByStage.set(stage, new Set());
        }
        usersImpactedByStage.get(stage)!.add(session.userId);
      });
    });
    
    // Identify failure points
    const failurePoints: FailurePoint[] = [];
    for (const [stage, errorCount] of errorsByStage) {
      if (errorCount > totalAttempts * 0.1) { // More than 10% of attempts have errors
        failurePoints.push({
          stage,
          errorCount,
          errorTypes: Array.from(errorTypesByStage.get(stage) || []),
          impactedUsers: usersImpactedByStage.get(stage)?.size || 0,
          suggestions: this.generateStageImprovementSuggestions(stage, errorTypesByStage.get(stage))
        });
      }
    }
    
    // Calculate completion time
    const completedSessions = sessions.filter(s => s.completed);
    const averageCompletionTime = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + s.duration, 0) / completedSessions.length
      : 0;
    
    return {
      workflowId,
      workflowName: this.getWorkflowName(workflowId),
      totalAttempts,
      successfulCompletions,
      failedAttempts,
      averageErrorsPerAttempt: totalAttempts > 0 ? totalErrors / totalAttempts : 0,
      commonFailurePoints: failurePoints.sort((a, b) => b.errorCount - a.errorCount),
      completionRate: totalAttempts > 0 ? successfulCompletions / totalAttempts : 0,
      averageCompletionTime
    };
  }
  
  private getWorkflowName(workflowId: string): string {
    // Map workflow IDs to friendly names
    const workflowNames: Record<string, string> = {
      'session_creation': 'Session Creation',
      'actor_management': 'Actor Management',
      'file_operations': 'File Operations',
      'search': 'Search Workflow',
      'collaboration': 'Collaboration',
      'export': 'Export Process'
    };
    
    return workflowNames[workflowId] || workflowId;
  }
  
  private generateStageImprovementSuggestions(stage: string, errorTypes?: Set<string>): string[] {
    const suggestions: string[] = [];
    
    if (errorTypes) {
      if (errorTypes.has('NetworkError')) {
        suggestions.push('Implement retry logic with exponential backoff');
        suggestions.push('Add offline mode support');
      }
      if (errorTypes.has('ValidationError')) {
        suggestions.push('Improve input validation and user feedback');
        suggestions.push('Add client-side validation');
      }
      if (errorTypes.has('TimeoutError')) {
        suggestions.push('Optimize performance for this stage');
        suggestions.push('Implement progressive loading');
      }
      if (errorTypes.has('PermissionError')) {
        suggestions.push('Review permission requirements');
        suggestions.push('Improve permission error messaging');
      }
    }
    
    // General suggestions
    suggestions.push(`Add better error handling for ${stage} stage`);
    suggestions.push('Consider implementing a fallback mechanism');
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }
  
  /* private updateWorkflowImpact(workflowId: string, session: SessionImpactAnalysis): void {
    const existing = this.workflowImpacts.get(workflowId);
    if (existing) {
      // Update metrics incrementally
      existing.totalAttempts++;
      if (session.finalOutcome === 'success') {
        existing.successfulCompletions++;
      } else if (session.finalOutcome === 'failure') {
        existing.failedAttempts++;
      }
      
      // Update averages
      const totalErrors = existing.averageErrorsPerAttempt * (existing.totalAttempts - 1) + session.errorCount;
      existing.averageErrorsPerAttempt = totalErrors / existing.totalAttempts;
      
      existing.completionRate = existing.successfulCompletions / existing.totalAttempts;
    }
  } */
  
  private async segmentUsers(): Promise<void> {
    const users = Array.from(this.userMetrics.values());
    
    // Define segments
    const segments: UserSegment[] = [
      this.createHighImpactSegment(users),
      this.createRecoveringUsersSegment(users),
      this.createNewUsersSegment(users),
      this.createPowerUsersSegment(users),
      this.createStrugglingUsersSegment(users)
    ];
    
    // Store segments
    segments.forEach(segment => {
      this.userSegments.set(segment.id, segment);
    });
  }
  
  private createHighImpactSegment(users: UserImpactMetrics[]): UserSegment {
    const highImpactUsers = users.filter(u => u.errorCount > 10 || u.criticalErrorCount > 0);
    
    return {
      id: 'high-impact',
      name: 'High Impact Users',
      criteria: {
        errorRateRange: { min: 10, max: Infinity }
      },
      userCount: highImpactUsers.length,
      characteristics: this.calculateSegmentCharacteristics(highImpactUsers)
    };
  }
  
  private createRecoveringUsersSegment(users: UserImpactMetrics[]): UserSegment {
    const recoveringUsers = users.filter(u => u.recoverySuccessRate > 0.8 && u.errorCount > 5);
    
    return {
      id: 'recovering',
      name: 'Successfully Recovering Users',
      criteria: {
        errorRateRange: { min: 5, max: Infinity }
      },
      userCount: recoveringUsers.length,
      characteristics: this.calculateSegmentCharacteristics(recoveringUsers)
    };
  }
  
  private createNewUsersSegment(users: UserImpactMetrics[]): UserSegment {
    const newUsers = users.filter(u => u.sessionCount <= 5);
    
    return {
      id: 'new-users',
      name: 'New Users',
      criteria: {
        sessionCountRange: { min: 0, max: 5 }
      },
      userCount: newUsers.length,
      characteristics: this.calculateSegmentCharacteristics(newUsers)
    };
  }
  
  private createPowerUsersSegment(users: UserImpactMetrics[]): UserSegment {
    const powerUsers = users.filter(u => u.sessionCount > 20 && u.sessionSuccessRate > 0.8);
    
    return {
      id: 'power-users',
      name: 'Power Users',
      criteria: {
        sessionCountRange: { min: 20, max: Infinity }
      },
      userCount: powerUsers.length,
      characteristics: this.calculateSegmentCharacteristics(powerUsers)
    };
  }
  
  private createStrugglingUsersSegment(users: UserImpactMetrics[]): UserSegment {
    const strugglingUsers = users.filter(u => u.abandonmentRate > 0.5 || u.sessionSuccessRate < 0.3);
    
    return {
      id: 'struggling',
      name: 'Struggling Users',
      criteria: {
        errorRateRange: { min: 0, max: Infinity }
      },
      userCount: strugglingUsers.length,
      characteristics: this.calculateSegmentCharacteristics(strugglingUsers)
    };
  }
  
  private calculateSegmentCharacteristics(users: UserImpactMetrics[]): UserSegment['characteristics'] {
    if (users.length === 0) {
      return {
        averageErrorRate: 0,
        commonErrors: [],
        peakErrorTimes: [],
        recoveryRate: 0
      };
    }
    
    const totalErrorRate = users.reduce((sum, u) => sum + u.errorRate, 0);
    const totalRecoveryRate = users.reduce((sum, u) => sum + u.recoverySuccessRate, 0);
    
    // This would need more detailed error tracking to be fully accurate
    return {
      averageErrorRate: totalErrorRate / users.length,
      commonErrors: [], // Would need to aggregate from actual error data
      peakErrorTimes: [], // Would need time-based analysis
      recoveryRate: totalRecoveryRate / users.length
    };
  }
  
  private async generateImpactInsights(): Promise<void> {
    const insights: string[] = [];
    
    // High-level insights
    const totalUsers = this.userMetrics.size;
    const impactedUsers = Array.from(this.userMetrics.values()).filter(u => u.errorCount > 0).length;
    const impactPercentage = totalUsers > 0 ? (impactedUsers / totalUsers) * 100 : 0;
    
    if (impactPercentage > 50) {
      insights.push(`${impactPercentage.toFixed(1)}% of users experienced errors - widespread issue detected`);
    }
    
    // Workflow insights
    const problematicWorkflows = Array.from(this.workflowImpacts.values())
      .filter(w => w.completionRate < 0.7)
      .sort((a, b) => a.completionRate - b.completionRate);
    
    if (problematicWorkflows.length > 0) {
      insights.push(`${problematicWorkflows[0]!.workflowName} has only ${(problematicWorkflows[0]!.completionRate * 100).toFixed(1)}% completion rate`);
    }
    
    // Segment insights
    const strugglingSegment = this.userSegments.get('struggling');
    if (strugglingSegment && strugglingSegment.userCount > totalUsers * 0.2) {
      insights.push(`${strugglingSegment.userCount} users are struggling with high abandonment rates`);
    }
    
    this.emit('insights:generated', insights);
  }
  
  // Public API methods
  
  public getUserMetrics(userId: string): UserImpactMetrics | undefined {
    return this.userMetrics.get(userId);
  }
  
  public getAllUserMetrics(): UserImpactMetrics[] {
    return Array.from(this.userMetrics.values());
  }
  
  public getSessionAnalysis(sessionId: string): SessionImpactAnalysis | undefined {
    return this.sessionAnalyses.get(sessionId);
  }
  
  public getWorkflowImpact(workflowId: string): WorkflowImpact | undefined {
    return this.workflowImpacts.get(workflowId);
  }
  
  public getAllWorkflowImpacts(): WorkflowImpact[] {
    return Array.from(this.workflowImpacts.values());
  }
  
  public getUserSegments(): UserSegment[] {
    return Array.from(this.userSegments.values());
  }
  
  public getMostImpactedUsers(limit: number = 10): UserImpactMetrics[] {
    return Array.from(this.userMetrics.values())
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, limit);
  }
  
  public getMostProblematicWorkflows(limit: number = 5): WorkflowImpact[] {
    return Array.from(this.workflowImpacts.values())
      .sort((a, b) => b.averageErrorsPerAttempt - a.averageErrorsPerAttempt)
      .slice(0, limit);
  }
  
  public async generateUserReport(userId: string): Promise<any> {
    const metrics = this.userMetrics.get(userId);
    if (!metrics) return null;
    
    const sessions = Array.from(this.sessionAnalyses.values())
      .filter(s => s.userId === userId);
    
    return {
      userId,
      metrics,
      recentSessions: sessions.slice(-10),
      workflowUsage: metrics.workflowsAffected,
      recommendations: this.generateUserRecommendations(metrics, sessions)
    };
  }
  
  private generateUserRecommendations(
    metrics: UserImpactMetrics, 
    _sessions: SessionImpactAnalysis[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (metrics.abandonmentRate > 0.3) {
      recommendations.push('Consider simplifying complex workflows');
    }
    
    if (metrics.criticalErrorCount > 0) {
      recommendations.push('Address critical errors affecting this user');
    }
    
    if (metrics.recoverySuccessRate < 0.5) {
      recommendations.push('Improve error recovery mechanisms');
    }
    
    if (metrics.averageSessionDuration > 600000) { // 10 minutes
      recommendations.push('Optimize performance for long-running sessions');
    }
    
    return recommendations;
  }
  
  public destroy(): void {
    if (this.assessmentInterval) {
      clearInterval(this.assessmentInterval);
      this.assessmentInterval = null;
    }
    
    this.removeAllListeners();
    this.userMetrics.clear();
    this.sessionAnalyses.clear();
    this.workflowImpacts.clear();
    this.userSegments.clear();
  }
}