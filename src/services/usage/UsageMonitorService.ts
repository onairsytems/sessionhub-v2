/**
 * Usage Monitor Service - Central service integrating all usage monitoring components
 * Provides a unified interface for API usage tracking, cost calculation, and limits management
 */

import { EventEmitter } from 'events';
import { DatabaseService } from '@/src/database/DatabaseService';
import { AnalyticsDataStore } from '@/src/services/analytics/AnalyticsDataStore';
import { APIUsageTracker, TokenUsage, UsageMetrics } from './APIUsageTracker';
import { CostCalculator, CostBreakdown } from './CostCalculator';
import { UsageLimitsManager, UsageLimit, UsageStatus } from './UsageLimitsManager';
import { UsageExportService, ExportOptions, ExportResult } from './UsageExportService';

export interface UsageMonitorConfig {
  enableRealTimeTracking: boolean;
  enableCostOptimization: boolean;
  enableUsageLimits: boolean;
  enableExportFeatures: boolean;
  defaultCurrency: string;
  dataRetentionDays: number;
  alertThresholds: {
    dailyTokenWarning: number;
    dailyCostWarning: number;
    monthlyBudgetWarning: number;
  };
}

export interface UsageSummary {
  period: 'today' | 'week' | 'month';
  metrics: UsageMetrics;
  costBreakdown: CostBreakdown;
  limitStatus: UsageStatus[];
  alerts: Array<{
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
  optimizationSuggestions: Array<{
    type: 'cost' | 'performance' | 'usage';
    title: string;
    description: string;
    potentialSavings?: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

export interface UserUsageProfile {
  userId: string;
  totalTokensUsed: number;
  totalCostSpent: number;
  averageDailyCost: number;
  preferredModels: string[];
  usagePatterns: {
    peakHours: number[];
    busyDays: string[];
    avgSessionDuration: number;
  };
  costEfficiency: {
    costPerToken: number;
    modelDistribution: Record<string, number>;
    optimizationScore: number; // 0-100
  };
  limits: UsageLimit[];
  lastActivity: Date;
}

export class UsageMonitorService extends EventEmitter {
  private config: UsageMonitorConfig;
  private usageTracker: APIUsageTracker;
  private costCalculator: CostCalculator;
  private limitsManager: UsageLimitsManager;
  private exportService: UsageExportService;
  private userProfiles: Map<string, UserUsageProfile> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    db: DatabaseService,
    analytics: AnalyticsDataStore,
    config?: Partial<UsageMonitorConfig>
  ) {
    super();
    this.config = {
      enableRealTimeTracking: true,
      enableCostOptimization: true,
      enableUsageLimits: true,
      enableExportFeatures: true,
      defaultCurrency: 'USD',
      dataRetentionDays: 90,
      alertThresholds: {
        dailyTokenWarning: 50000,
        dailyCostWarning: 10.0,
        monthlyBudgetWarning: 100.0
      },
      ...config
    };

    // Initialize components
    this.usageTracker = new APIUsageTracker(db, analytics);
    this.costCalculator = new CostCalculator(this.config.defaultCurrency);
    this.limitsManager = new UsageLimitsManager(db, this.costCalculator);
    this.exportService = new UsageExportService(this.usageTracker, this.costCalculator);

    this.setupEventHandlers();
    this.startMonitoring();
  }

  /**
   * Setup event handlers for component communication
   */
  private setupEventHandlers(): void {
    // Usage tracking events
    this.usageTracker.on('usage_tracked', (usage: TokenUsage) => {
      this.handleUsageTracked(usage);
    });

    this.usageTracker.on('usage_alert', (alert: any) => {
      this.emit('usage_alert', alert);
    });

    // Limits management events
    this.limitsManager.on('usage_blocked', (event: any) => {
      this.emit('usage_blocked', event);
    });

    this.limitsManager.on('usage_warning', (event: any) => {
      this.emit('usage_warning', event);
    });

    this.limitsManager.on('limit_created', (limit: UsageLimit) => {
      this.emit('limit_updated', { action: 'created', limit });
    });

    // Cost calculator events
    this.costCalculator.on('pricing_updated', (pricing: any) => {
      this.emit('pricing_updated', pricing);
    });
  }

  /**
   * Handle usage tracking events
   */
  private async handleUsageTracked(usage: TokenUsage): Promise<void> {
    // Update user profile
    await this.updateUserProfile(usage.userId, usage);

    // Check if this triggers any alerts
    await this.checkUsageAlerts(usage.userId);

    // Emit real-time usage update
    if (this.config.enableRealTimeTracking) {
      this.emit('real_time_usage', {
        userId: usage.userId,
        usage,
        timestamp: new Date()
      });
    }
  }

  /**
   * Track API usage (main entry point)
   */
  async trackAPIUsage(params: {
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestType: 'planning' | 'execution' | 'chat';
    userId: string;
  }): Promise<TokenUsage> {
    // Check limits before processing
    if (this.config.enableUsageLimits) {
      const limitCheck = await this.limitsManager.checkLimits(
        params.userId,
        { input: params.inputTokens, output: params.outputTokens },
        params.model
      );

      if (!limitCheck.allowed) {
        throw new Error(`Usage blocked: ${limitCheck.blockedLimits.join(', ')}`);
      }
    }

    // Track the usage
    return await this.usageTracker.trackUsage(params);
  }

  /**
   * Get comprehensive usage summary
   */
  async getUsageSummary(userId: string, period: 'today' | 'week' | 'month' = 'today'): Promise<UsageSummary> {
    const dateRange = this.getPeriodDateRange(period);
    
    // Get metrics
    const metrics = await this.usageTracker.getUsageMetrics(
      userId,
      dateRange.start,
      dateRange.end
    );

    // Calculate cost breakdown
    const costBreakdown = this.costCalculator.calculateCost(
      'claude-3-5-sonnet-20241022', // Default model for estimation
      metrics.totalInputTokens,
      metrics.totalOutputTokens,
      this.config.defaultCurrency
    );

    // Get limit status
    const limitStatus = await this.limitsManager.getUserLimitStatus(userId);

    // Generate alerts
    const alerts = await this.generateAlerts(userId, metrics, limitStatus);

    // Get optimization suggestions
    const optimizationSuggestions = await this.generateOptimizationSuggestions(userId, metrics);

    return {
      period,
      metrics,
      costBreakdown,
      limitStatus,
      alerts,
      optimizationSuggestions
    };
  }

  /**
   * Get user usage profile
   */
  async getUserProfile(userId: string): Promise<UserUsageProfile> {
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!;
    }

    // Generate profile from historical data
    const profile = await this.generateUserProfile(userId);
    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Update user usage profile
   */
  private async updateUserProfile(_userId: string, _usage: TokenUsage): Promise<void> {
    // Implementation would update user profile with usage data
    // For now, this is a placeholder
  }

  /**
   * Generate user profile from historical data
   */
  private async generateUserProfile(_userId: string): Promise<UserUsageProfile> {
    // Mock implementation - would generate actual profile from data
    return {
      userId: _userId,
      totalTokensUsed: 0,
      totalCostSpent: 0,
      averageDailyCost: 0,
      preferredModels: [],
      usagePatterns: {
        peakHours: [],
        busyDays: [],
        avgSessionDuration: 0
      },
      costEfficiency: {
        costPerToken: 0,
        modelDistribution: {},
        optimizationScore: 0
      },
      limits: [],
      lastActivity: new Date()
    };
  }

  /**
   * Calculate optimization score (0-100)
   */
  // Removed unused calculateOptimizationScore method

  /**
   * Generate usage alerts
   */
  private async generateAlerts(
    _userId: string,
    _metrics: UsageMetrics,
    _limitStatus: UsageStatus[]
  ): Promise<Array<{ type: 'info' | 'warning' | 'error'; message: string; timestamp: Date }>> {
    // Mock implementation
    return [];
  }

  /**
   * Generate optimization suggestions
   */
  private async generateOptimizationSuggestions(
    _userId: string,
    _metrics: UsageMetrics
  ): Promise<Array<{
    type: 'cost' | 'performance' | 'usage';
    title: string;
    description: string;
    potentialSavings?: number;
    difficulty: 'easy' | 'medium' | 'hard';
  }>> {
    // Mock implementation
    return [];
  }

  /**
   * Export usage data
   */
  async exportUsageData(userId: string, options: ExportOptions): Promise<ExportResult> {
    if (!this.config.enableExportFeatures) {
      throw new Error('Export features are disabled');
    }

    return await this.exportService.exportUsage(userId, options);
  }

  /**
   * Set usage limits for a user
   */
  async setUsageLimits(userId: string, limits: Partial<UsageLimit>[]): Promise<UsageLimit[]> {
    const createdLimits: UsageLimit[] = [];

    for (const limitConfig of limits) {
      const limit = await this.limitsManager.createLimit({
        userId,
        type: limitConfig.type || 'cost',
        period: limitConfig.period || 'monthly',
        limit: limitConfig.limit || 50,
        warningThreshold: limitConfig.warningThreshold || 80,
        hardLimit: limitConfig.hardLimit || false,
        currency: limitConfig.currency,
        model: limitConfig.model,
        isActive: limitConfig.isActive !== false
      });
      createdLimits.push(limit);
    }

    return createdLimits;
  }

  /**
   * Get real-time usage data
   */
  getRealtimeUsage(userId: string): TokenUsage[] {
    return this.usageTracker.getRealtimeUsage(userId);
  }

  /**
   * Start monitoring service
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Run monitoring tasks every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringTasks();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform periodic monitoring tasks
   */
  private async performMonitoringTasks(): Promise<void> {
    try {
      // Clean up old data
      await this.usageTracker.cleanupOldData(this.config.dataRetentionDays);

      // Update user profiles
      for (const [userId] of this.userProfiles) {
        await this.updateUserProfileFromHistory(userId);
      }

      this.emit('monitoring_cycle_complete', {
        timestamp: new Date(),
        profilesUpdated: this.userProfiles.size
      });
    } catch (error) {
      this.emit('monitoring_error', error);
    }
  }

  /**
   * Update user profile from historical data
   */
  private async updateUserProfileFromHistory(userId: string): Promise<void> {
    const profile = await this.generateUserProfile(userId);
    this.userProfiles.set(userId, profile);
  }

  /**
   * Check usage alerts for a user
   */
  private async checkUsageAlerts(_userId: string): Promise<void> {
    // Mock implementation - would check thresholds and emit alerts
  }

  /**
   * Get period date range
   */
  private getPeriodDateRange(period: 'today' | 'week' | 'month'): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { start, end: now };
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<UsageMonitorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config_updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): UsageMonitorConfig {
    return { ...this.config };
  }
}