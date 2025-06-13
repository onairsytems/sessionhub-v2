/**
 * API Usage Tracker - Real-time monitoring and tracking of API token consumption
 * Integrates with existing ClaudeAPIClient to track usage across all API calls
 */

import { EventEmitter } from 'events';
import { DatabaseService } from '@/src/database/DatabaseService';
import { AnalyticsDataStore } from '@/src/services/analytics/AnalyticsDataStore';

export interface TokenUsage {
  id: string;
  sessionId: string;
  timestamp: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  currency: string;
  requestType: 'planning' | 'execution' | 'chat';
  userId: string;
}

export interface UsageMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  costByModel: Record<string, number>;
  tokensByModel: Record<string, number>;
  timeRange: { start: Date; end: Date };
}

export interface UsageLimits {
  dailyTokenLimit?: number;
  monthlyTokenLimit?: number;
  dailyCostLimit?: number;
  monthlyCostLimit?: number;
  warningThresholdPercent?: number;
  currency: string;
}

export interface UsageAlert {
  type: 'warning' | 'limit_reached' | 'budget_exceeded';
  message: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  timestamp: Date;
}

export class APIUsageTracker extends EventEmitter {
  private db: DatabaseService;
  private analytics: AnalyticsDataStore;
  private currentLimits: UsageLimits;
  private realtimeUsage: Map<string, TokenUsage[]> = new Map();
  private modelPricing: Record<string, { input: number; output: number }>;

  constructor(db: DatabaseService, analytics: AnalyticsDataStore) {
    super();
    this.db = db;
    this.analytics = analytics;
    this.currentLimits = {
      currency: 'USD',
      warningThresholdPercent: 80
    };
    
    // Claude model pricing (per 1M tokens)
    this.modelPricing = {
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 }
    };

    this.initializeDatabase();
  }

  /**
   * Initialize database tables for usage tracking
   */
  private async initializeDatabase(): Promise<void> {
    await this.db.connect();

    const createUsageTable = `
      CREATE TABLE IF NOT EXISTS api_usage (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        estimated_cost REAL NOT NULL,
        currency TEXT NOT NULL,
        request_type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createUsageLimitsTable = `
      CREATE TABLE IF NOT EXISTS usage_limits (
        user_id TEXT PRIMARY KEY,
        daily_token_limit INTEGER,
        monthly_token_limit INTEGER,
        daily_cost_limit REAL,
        monthly_cost_limit REAL,
        warning_threshold_percent INTEGER DEFAULT 80,
        currency TEXT DEFAULT 'USD',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createUsageAlertsTable = `
      CREATE TABLE IF NOT EXISTS usage_alerts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        current_usage REAL NOT NULL,
        limit_value REAL NOT NULL,
        percentage REAL NOT NULL,
        timestamp TEXT NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.query(createUsageTable);
    await this.db.query(createUsageLimitsTable);
    await this.db.query(createUsageAlertsTable);

    // Create indexes for performance
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_usage_session ON api_usage(session_id)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_usage_user ON api_usage(user_id)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON api_usage(timestamp)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_alerts_user ON usage_alerts(user_id, acknowledged)');
  }

  /**
   * Track API usage from a Claude API response
   */
  async trackUsage(params: {
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestType: 'planning' | 'execution' | 'chat';
    userId: string;
  }): Promise<TokenUsage> {
    const {
      sessionId,
      model,
      inputTokens,
      outputTokens,
      requestType,
      userId
    } = params;

    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = this.calculateCost(model, inputTokens, outputTokens);
    
    const usage: TokenUsage = {
      id: this.generateId(),
      sessionId,
      timestamp: new Date(),
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      currency: 'USD',
      requestType,
      userId
    };

    // Store in database
    await this.storeUsage(usage);

    // Update real-time tracking
    this.updateRealtimeUsage(userId, usage);

    // Check limits and emit alerts if necessary
    await this.checkLimitsAndAlert(userId);

    // Emit usage event for real-time updates
    this.emit('usage_tracked', usage);

    return usage;
  }

  /**
   * Calculate cost based on model pricing
   */
  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.modelPricing[model];
    if (!pricing) {
      // Default to Sonnet pricing if model not found
      return ((inputTokens * 3.00) + (outputTokens * 15.00)) / 1000000;
    }

    return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;
  }

  /**
   * Store usage data in database
   */
  private async storeUsage(usage: TokenUsage): Promise<void> {
    const query = `
      INSERT INTO api_usage (
        id, session_id, timestamp, model, input_tokens, output_tokens,
        total_tokens, estimated_cost, currency, request_type, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      usage.id,
      usage.sessionId,
      usage.timestamp.toISOString(),
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
      usage.totalTokens,
      usage.estimatedCost,
      usage.currency,
      usage.requestType,
      usage.userId
    ]);

    // Store in analytics for historical analysis
    await this.analytics.store({
      timestamp: usage.timestamp,
      metrics: {
        apiUsage: {
          totalTokens: usage.totalTokens,
          totalCost: usage.estimatedCost,
          requestCount: 1
        }
      } as any
    });
  }

  /**
   * Update real-time usage tracking
   */
  private updateRealtimeUsage(userId: string, usage: TokenUsage): void {
    if (!this.realtimeUsage.has(userId)) {
      this.realtimeUsage.set(userId, []);
    }

    const userUsage = this.realtimeUsage.get(userId)!;
    userUsage.push(usage);

    // Keep only last 24 hours for real-time tracking
    const oneDayAgo = new Date(Date.now() - 86400000);
    this.realtimeUsage.set(
      userId,
      userUsage.filter(u => u.timestamp > oneDayAgo)
    );
  }

  /**
   * Get usage metrics for a specific time period
   */
  async getUsageMetrics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics> {
    const query = `
      SELECT 
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        COUNT(*) as request_count,
        model,
        SUM(estimated_cost) as model_cost,
        SUM(total_tokens) as model_tokens
      FROM api_usage 
      WHERE user_id = ? AND timestamp BETWEEN ? AND ?
      GROUP BY model
    `;

    const results = await this.db.query(query, [
      userId,
      startDate.toISOString(),
      endDate.toISOString()
    ]);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let requestCount = 0;
    const costByModel: Record<string, number> = {};
    const tokensByModel: Record<string, number> = {};

    results.rows.forEach((row: any) => {
      totalInputTokens += row.total_input || 0;
      totalOutputTokens += row.total_output || 0;
      totalTokens += row.total_tokens || 0;
      totalCost += row.total_cost || 0;
      requestCount += row.request_count || 0;
      costByModel[row.model] = row.model_cost || 0;
      tokensByModel[row.model] = row.model_tokens || 0;
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      requestCount,
      averageTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0,
      averageCostPerRequest: requestCount > 0 ? totalCost / requestCount : 0,
      costByModel,
      tokensByModel,
      timeRange: { start: startDate, end: endDate }
    };
  }

  /**
   * Set usage limits for a user
   */
  async setUsageLimits(userId: string, limits: UsageLimits): Promise<void> {
    this.currentLimits = { ...this.currentLimits, ...limits };

    const query = `
      INSERT OR REPLACE INTO usage_limits (
        user_id, daily_token_limit, monthly_token_limit,
        daily_cost_limit, monthly_cost_limit, warning_threshold_percent, currency
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      userId,
      limits.dailyTokenLimit || null,
      limits.monthlyTokenLimit || null,
      limits.dailyCostLimit || null,
      limits.monthlyCostLimit || null,
      limits.warningThresholdPercent || 80,
      limits.currency || 'USD'
    ]);

    this.emit('limits_updated', { userId, limits });
  }

  /**
   * Get current usage limits for a user
   */
  async getUserLimits(userId: string): Promise<UsageLimits> {
    const query = 'SELECT * FROM usage_limits WHERE user_id = ?';
    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return this.currentLimits;
    }

    const row = result.rows[0];
    return {
      dailyTokenLimit: row.daily_token_limit,
      monthlyTokenLimit: row.monthly_token_limit,
      dailyCostLimit: row.daily_cost_limit,
      monthlyCostLimit: row.monthly_cost_limit,
      warningThresholdPercent: row.warning_threshold_percent,
      currency: row.currency
    };
  }

  /**
   * Check limits and create alerts if thresholds are exceeded
   */
  private async checkLimitsAndAlert(userId: string): Promise<void> {
    const limits = await this.getUserLimits(userId);
    const now = new Date();
    
    // Check daily limits
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyMetrics = await this.getUsageMetrics(userId, dayStart, now);

    // Check monthly limits
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyMetrics = await this.getUsageMetrics(userId, monthStart, now);

    const alerts: UsageAlert[] = [];

    // Daily token limit check
    if (limits.dailyTokenLimit && dailyMetrics.totalTokens > 0) {
      const percentage = (dailyMetrics.totalTokens / limits.dailyTokenLimit) * 100;
      if (percentage >= 100) {
        alerts.push({
          type: 'limit_reached',
          message: `Daily token limit of ${limits.dailyTokenLimit.toLocaleString()} reached`,
          currentUsage: dailyMetrics.totalTokens,
          limit: limits.dailyTokenLimit,
          percentage,
          timestamp: now
        });
      } else if (percentage >= (limits.warningThresholdPercent || 80)) {
        alerts.push({
          type: 'warning',
          message: `Daily token usage at ${percentage.toFixed(1)}% of limit`,
          currentUsage: dailyMetrics.totalTokens,
          limit: limits.dailyTokenLimit,
          percentage,
          timestamp: now
        });
      }
    }

    // Daily cost limit check
    if (limits.dailyCostLimit && dailyMetrics.totalCost > 0) {
      const percentage = (dailyMetrics.totalCost / limits.dailyCostLimit) * 100;
      if (percentage >= 100) {
        alerts.push({
          type: 'budget_exceeded',
          message: `Daily budget of $${limits.dailyCostLimit.toFixed(2)} exceeded`,
          currentUsage: dailyMetrics.totalCost,
          limit: limits.dailyCostLimit,
          percentage,
          timestamp: now
        });
      } else if (percentage >= (limits.warningThresholdPercent || 80)) {
        alerts.push({
          type: 'warning',
          message: `Daily budget at ${percentage.toFixed(1)}% of limit`,
          currentUsage: dailyMetrics.totalCost,
          limit: limits.dailyCostLimit,
          percentage,
          timestamp: now
        });
      }
    }

    // Monthly checks (similar logic)
    if (limits.monthlyTokenLimit && monthlyMetrics.totalTokens > 0) {
      const percentage = (monthlyMetrics.totalTokens / limits.monthlyTokenLimit) * 100;
      if (percentage >= 100) {
        alerts.push({
          type: 'limit_reached',
          message: `Monthly token limit of ${limits.monthlyTokenLimit.toLocaleString()} reached`,
          currentUsage: monthlyMetrics.totalTokens,
          limit: limits.monthlyTokenLimit,
          percentage,
          timestamp: now
        });
      } else if (percentage >= (limits.warningThresholdPercent || 80)) {
        alerts.push({
          type: 'warning',
          message: `Monthly token usage at ${percentage.toFixed(1)}% of limit`,
          currentUsage: monthlyMetrics.totalTokens,
          limit: limits.monthlyTokenLimit,
          percentage,
          timestamp: now
        });
      }
    }

    if (limits.monthlyCostLimit && monthlyMetrics.totalCost > 0) {
      const percentage = (monthlyMetrics.totalCost / limits.monthlyCostLimit) * 100;
      if (percentage >= 100) {
        alerts.push({
          type: 'budget_exceeded',
          message: `Monthly budget of $${limits.monthlyCostLimit.toFixed(2)} exceeded`,
          currentUsage: monthlyMetrics.totalCost,
          limit: limits.monthlyCostLimit,
          percentage,
          timestamp: now
        });
      } else if (percentage >= (limits.warningThresholdPercent || 80)) {
        alerts.push({
          type: 'warning',
          message: `Monthly budget at ${percentage.toFixed(1)}% of limit`,
          currentUsage: monthlyMetrics.totalCost,
          limit: limits.monthlyCostLimit,
          percentage,
          timestamp: now
        });
      }
    }

    // Store and emit alerts
    for (const alert of alerts) {
      await this.storeAlert(userId, alert);
      this.emit('usage_alert', { userId, alert });
    }
  }

  /**
   * Store usage alert
   */
  private async storeAlert(userId: string, alert: UsageAlert): Promise<void> {
    const query = `
      INSERT INTO usage_alerts (
        id, user_id, type, message, current_usage, limit_value, percentage, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      this.generateId(),
      userId,
      alert.type,
      alert.message,
      alert.currentUsage,
      alert.limit,
      alert.percentage,
      alert.timestamp.toISOString()
    ]);
  }

  /**
   * Get real-time usage for a user (last 24 hours)
   */
  getRealtimeUsage(userId: string): TokenUsage[] {
    return this.realtimeUsage.get(userId) || [];
  }

  /**
   * Export usage data
   */
  async exportUsageData(
    userId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const query = `
      SELECT * FROM api_usage 
      WHERE user_id = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
    `;

    const result = await this.db.query(query, [
      userId,
      startDate.toISOString(),
      endDate.toISOString()
    ]);

    if (format === 'csv') {
      const headers = [
        'ID', 'Session ID', 'Timestamp', 'Model', 'Input Tokens',
        'Output Tokens', 'Total Tokens', 'Estimated Cost', 'Currency', 'Request Type'
      ];
      
      const csvData = [
        headers.join(','),
        ...result.rows.map((row: any) => [
          row.id,
          row.session_id,
          row.timestamp,
          row.model,
          row.input_tokens,
          row.output_tokens,
          row.total_tokens,
          row.estimated_cost,
          row.currency,
          row.request_type
        ].join(','))
      ];

      return csvData.join('\n');
    }

    return JSON.stringify(result.rows, null, 2);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get model pricing information
   */
  getModelPricing(): Record<string, { input: number; output: number }> {
    return { ...this.modelPricing };
  }

  /**
   * Update model pricing
   */
  updateModelPricing(model: string, pricing: { input: number; output: number }): void {
    this.modelPricing[model] = pricing;
    this.emit('pricing_updated', { model, pricing });
  }

  /**
   * Clean up old usage data based on retention policy
   */
  async cleanupOldData(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - (retentionDays * 86400000));
    
    await this.db.query(
      'DELETE FROM api_usage WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );

    await this.db.query(
      'DELETE FROM usage_alerts WHERE timestamp < ? AND acknowledged = TRUE',
      [cutoffDate.toISOString()]
    );

    this.emit('data_cleaned', { cutoffDate, retentionDays });
  }
}