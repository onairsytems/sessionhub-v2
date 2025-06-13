/**
 * Usage Limits Manager - Configurable limits with real-time enforcement
 * Prevents unexpected API costs through intelligent quotas and warnings
 */

import { EventEmitter } from 'events';
import { DatabaseService } from '@/src/database/DatabaseService';
import { CostCalculator } from './CostCalculator';

export interface UsageLimit {
  id: string;
  userId: string;
  type: 'tokens' | 'cost' | 'requests';
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  limit: number;
  warningThreshold: number; // Percentage (0-100)
  hardLimit: boolean; // If true, blocks requests when exceeded
  currency?: string; // For cost limits
  model?: string; // Optional model-specific limits
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageStatus {
  limitId: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
  timeUntilReset: number; // Milliseconds
  isBlocked: boolean;
}

export interface LimitViolation {
  limitId: string;
  userId: string;
  limitType: string;
  period: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  timestamp: Date;
  actionTaken: 'warning' | 'blocked' | 'notification';
}

export interface LimitConfiguration {
  enableDailyTokenLimits: boolean;
  enableMonthlyCostLimits: boolean;
  enableRequestRateLimits: boolean;
  defaultWarningThreshold: number;
  emergencyStopThreshold: number;
  gracePeriodMinutes: number;
  notificationChannels: string[];
}

export class UsageLimitsManager extends EventEmitter {
  private db: DatabaseService;
  private costCalculator: CostCalculator;
  private config: LimitConfiguration;
  private activeLimits: Map<string, UsageLimit[]> = new Map();
  private violationHistory: Map<string, LimitViolation[]> = new Map();

  constructor(
    db: DatabaseService,
    costCalculator: CostCalculator,
    config?: Partial<LimitConfiguration>
  ) {
    super();
    this.db = db;
    this.costCalculator = costCalculator;
    this.config = {
      enableDailyTokenLimits: true,
      enableMonthlyCostLimits: true,
      enableRequestRateLimits: true,
      defaultWarningThreshold: 80,
      emergencyStopThreshold: 95,
      gracePeriodMinutes: 15,
      notificationChannels: ['email', 'ui'],
      ...config
    };

    this.initializeDatabase();
    this.loadActiveLimits();
  }

  /**
   * Initialize database tables for usage limits
   */
  private async initializeDatabase(): Promise<void> {
    await this.db.connect();

    const createLimitsTable = `
      CREATE TABLE IF NOT EXISTS usage_limits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        period TEXT NOT NULL,
        limit_value REAL NOT NULL,
        warning_threshold INTEGER NOT NULL,
        hard_limit BOOLEAN NOT NULL,
        currency TEXT,
        model TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createViolationsTable = `
      CREATE TABLE IF NOT EXISTS limit_violations (
        id TEXT PRIMARY KEY,
        limit_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        limit_type TEXT NOT NULL,
        period TEXT NOT NULL,
        current_usage REAL NOT NULL,
        limit_value REAL NOT NULL,
        percentage REAL NOT NULL,
        action_taken TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createLimitStatusTable = `
      CREATE TABLE IF NOT EXISTS limit_status_cache (
        user_id TEXT NOT NULL,
        limit_id TEXT NOT NULL,
        period_start TEXT NOT NULL,
        current_usage REAL NOT NULL,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, limit_id, period_start)
      )
    `;

    await this.db.query(createLimitsTable);
    await this.db.query(createViolationsTable);
    await this.db.query(createLimitStatusTable);

    // Create indexes
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_limits_user ON usage_limits(user_id, is_active)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_violations_user ON limit_violations(user_id, timestamp)');
    await this.db.query('CREATE INDEX IF NOT EXISTS idx_status_cache ON limit_status_cache(user_id, period_start)');
  }

  /**
   * Load active limits from database
   */
  private async loadActiveLimits(): Promise<void> {
    const query = 'SELECT * FROM usage_limits WHERE is_active = TRUE';
    const result = await this.db.query(query);

    for (const row of result.rows) {
      const limit: UsageLimit = {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        period: row.period,
        limit: row.limit_value,
        warningThreshold: row.warning_threshold,
        hardLimit: row.hard_limit,
        currency: row.currency,
        model: row.model,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };

      if (!this.activeLimits.has(limit.userId)) {
        this.activeLimits.set(limit.userId, []);
      }
      this.activeLimits.get(limit.userId)!.push(limit);
    }
  }

  /**
   * Create a new usage limit
   */
  async createLimit(limit: Omit<UsageLimit, 'id' | 'createdAt' | 'updatedAt'>): Promise<UsageLimit> {
    const newLimit: UsageLimit = {
      ...limit,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const query = `
      INSERT INTO usage_limits (
        id, user_id, type, period, limit_value, warning_threshold,
        hard_limit, currency, model, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.query(query, [
      newLimit.id,
      newLimit.userId,
      newLimit.type,
      newLimit.period,
      newLimit.limit,
      newLimit.warningThreshold,
      newLimit.hardLimit,
      newLimit.currency || null,
      newLimit.model || null,
      newLimit.isActive
    ]);

    // Update cache
    if (!this.activeLimits.has(newLimit.userId)) {
      this.activeLimits.set(newLimit.userId, []);
    }
    this.activeLimits.get(newLimit.userId)!.push(newLimit);

    this.emit('limit_created', newLimit);
    return newLimit;
  }

  /**
   * Update an existing usage limit
   */
  async updateLimit(limitId: string, updates: Partial<UsageLimit>): Promise<UsageLimit> {
    const query = `
      UPDATE usage_limits 
      SET limit_value = ?, warning_threshold = ?, hard_limit = ?, 
          currency = ?, model = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    // Get current limit
    const currentResult = await this.db.query('SELECT * FROM usage_limits WHERE id = ?', [limitId]);
    if (currentResult.rows.length === 0) {
      throw new Error(`Limit not found: ${limitId}`);
    }

    const current = currentResult.rows[0] as any;
    const updated: UsageLimit = { 
      ...current, 
      ...updates,
      id: current.id,
      userId: current.user_id,
      type: current.type,
      period: current.period,
      limit: current.limit_value,
      warningThreshold: current.warning_threshold,
      hardLimit: current.hard_limit,
      currency: current.currency,
      model: current.model,
      isActive: current.is_active,
      createdAt: new Date(current.created_at),
      updatedAt: new Date()
    };

    await this.db.query(query, [
      updates.limit || current.limit_value,
      updates.warningThreshold || current.warning_threshold,
      updates.hardLimit !== undefined ? updates.hardLimit : current.hard_limit,
      updates.currency || current.currency,
      updates.model || current.model,
      updates.isActive !== undefined ? updates.isActive : current.is_active,
      limitId
    ]);

    // Update cache
    this.activeLimits.forEach((limits, _userId) => {
      const index = limits.findIndex(l => l.id === limitId);
      if (index !== -1) {
        limits[index] = updated;
      }
    });

    this.emit('limit_updated', { limitId, updates });
    return updated;
  }

  /**
   * Delete a usage limit
   */
  async deleteLimit(limitId: string): Promise<void> {
    await this.db.query('DELETE FROM usage_limits WHERE id = ?', [limitId]);

    // Update cache
    this.activeLimits.forEach((limits, _userId) => {
      const index = limits.findIndex(l => l.id === limitId);
      if (index !== -1) {
        limits.splice(index, 1);
      }
    });

    this.emit('limit_deleted', limitId);
  }

  /**
   * Check if usage is within limits before allowing API call
   */
  async checkLimits(
    userId: string,
    estimatedTokens: { input: number; output: number },
    model: string
  ): Promise<{
    allowed: boolean;
    violations: LimitViolation[];
    warnings: UsageStatus[];
    blockedLimits: string[];
  }> {
    const userLimits = this.activeLimits.get(userId) || [];
    const violations: LimitViolation[] = [];
    const warnings: UsageStatus[] = [];
    const blockedLimits: string[] = [];

    for (const limit of userLimits) {
      // Skip if model-specific limit doesn't match
      if (limit.model && limit.model !== model) {
        continue;
      }

      const status = await this.getLimitStatus(limit, estimatedTokens, model);

      if (status.status === 'exceeded' && limit.hardLimit) {
        blockedLimits.push(limit.id);
        
        const violation: LimitViolation = {
          limitId: limit.id,
          userId,
          limitType: limit.type,
          period: limit.period,
          currentUsage: status.currentUsage,
          limit: status.limit,
          percentage: status.percentage,
          timestamp: new Date(),
          actionTaken: 'blocked'
        };
        
        violations.push(violation);
        await this.recordViolation(violation);
      } else if (status.status === 'warning') {
        warnings.push(status);
        
        const violation: LimitViolation = {
          limitId: limit.id,
          userId,
          limitType: limit.type,
          period: limit.period,
          currentUsage: status.currentUsage,
          limit: status.limit,
          percentage: status.percentage,
          timestamp: new Date(),
          actionTaken: 'warning'
        };
        
        await this.recordViolation(violation);
      }
    }

    const allowed = blockedLimits.length === 0;

    if (!allowed) {
      this.emit('usage_blocked', { userId, blockedLimits, violations });
    } else if (warnings.length > 0) {
      this.emit('usage_warning', { userId, warnings });
    }

    return { allowed, violations, warnings, blockedLimits };
  }

  /**
   * Get current status for a specific limit
   */
  private async getLimitStatus(
    limit: UsageLimit,
    estimatedTokens: { input: number; output: number },
    model: string
  ): Promise<UsageStatus> {
    const periodStart = this.getPeriodStart(limit.period);
    const periodEnd = this.getPeriodEnd(limit.period);

    // Get current usage for this period
    let currentUsage = await this.getCurrentUsage(limit, periodStart, periodEnd);

    // Add estimated usage
    if (limit.type === 'tokens') {
      currentUsage += estimatedTokens.input + estimatedTokens.output;
    } else if (limit.type === 'cost') {
      const costEstimate = this.costCalculator.calculateCost(
        model,
        estimatedTokens.input,
        estimatedTokens.output,
        limit.currency
      );
      currentUsage += costEstimate.totalCost;
    } else if (limit.type === 'requests') {
      currentUsage += 1;
    }

    const percentage = (currentUsage / limit.limit) * 100;
    const timeUntilReset = periodEnd.getTime() - Date.now();

    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= limit.warningThreshold) {
      status = 'warning';
    }

    return {
      limitId: limit.id,
      currentUsage,
      limit: limit.limit,
      percentage,
      status,
      timeUntilReset,
      isBlocked: status === 'exceeded' && limit.hardLimit
    };
  }

  /**
   * Get current usage for a limit within the specified period
   */
  private async getCurrentUsage(
    limit: UsageLimit,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    if (limit.type === 'tokens') {
      const query = `
        SELECT SUM(total_tokens) as total
        FROM api_usage 
        WHERE user_id = ? AND timestamp BETWEEN ? AND ?
        ${limit.model ? 'AND model = ?' : ''}
      `;
      
      const params = [
        limit.userId,
        periodStart.toISOString(),
        periodEnd.toISOString()
      ];
      
      if (limit.model) {
        params.push(limit.model);
      }

      const result = await this.db.query(query, params);
      return result.rows[0]?.total || 0;
      
    } else if (limit.type === 'cost') {
      const query = `
        SELECT SUM(estimated_cost) as total
        FROM api_usage 
        WHERE user_id = ? AND timestamp BETWEEN ? AND ? AND currency = ?
        ${limit.model ? 'AND model = ?' : ''}
      `;
      
      const params = [
        limit.userId,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        limit.currency || 'USD'
      ];
      
      if (limit.model) {
        params.push(limit.model);
      }

      const result = await this.db.query(query, params);
      return result.rows[0]?.total || 0;
      
    } else if (limit.type === 'requests') {
      const query = `
        SELECT COUNT(*) as total
        FROM api_usage 
        WHERE user_id = ? AND timestamp BETWEEN ? AND ?
        ${limit.model ? 'AND model = ?' : ''}
      `;
      
      const params = [
        limit.userId,
        periodStart.toISOString(),
        periodEnd.toISOString()
      ];
      
      if (limit.model) {
        params.push(limit.model);
      }

      const result = await this.db.query(query, params);
      return result.rows[0]?.total || 0;
    }

    return 0;
  }

  /**
   * Record a limit violation
   */
  private async recordViolation(violation: LimitViolation): Promise<void> {
    const query = `
      INSERT INTO limit_violations (
        id, limit_id, user_id, limit_type, period, current_usage,
        limit_value, percentage, action_taken, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const id = this.generateId();
    await this.db.query(query, [
      id,
      violation.limitId,
      violation.userId,
      violation.limitType,
      violation.period,
      violation.currentUsage,
      violation.limit,
      violation.percentage,
      violation.actionTaken,
      violation.timestamp.toISOString()
    ]);

    // Update cache
    if (!this.violationHistory.has(violation.userId)) {
      this.violationHistory.set(violation.userId, []);
    }
    this.violationHistory.get(violation.userId)!.push(violation);

    this.emit('violation_recorded', violation);
  }

  /**
   * Get all limits for a user
   */
  async getUserLimits(userId: string): Promise<UsageLimit[]> {
    return this.activeLimits.get(userId) || [];
  }

  /**
   * Get limit status overview for a user
   */
  async getUserLimitStatus(userId: string): Promise<UsageStatus[]> {
    const userLimits = this.activeLimits.get(userId) || [];
    const statuses: UsageStatus[] = [];

    for (const limit of userLimits) {
      const status = await this.getLimitStatus(
        limit,
        { input: 0, output: 0 }, // No estimated usage for status check
        '' // No specific model for status check
      );
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get violation history for a user
   */
  async getViolationHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LimitViolation[]> {
    let query = 'SELECT * FROM limit_violations WHERE user_id = ?';
    const params: any[] = [userId];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => ({
      limitId: row.limit_id,
      userId: row.user_id,
      limitType: row.limit_type,
      period: row.period,
      currentUsage: row.current_usage,
      limit: row.limit_value,
      percentage: row.percentage,
      timestamp: new Date(row.timestamp),
      actionTaken: row.action_taken
    }));
  }

  /**
   * Set default limits for new users
   */
  async setDefaultLimits(userId: string): Promise<UsageLimit[]> {
    const defaultLimits: Omit<UsageLimit, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        userId,
        type: 'tokens',
        period: 'daily',
        limit: 100000, // 100k tokens per day
        warningThreshold: this.config.defaultWarningThreshold,
        hardLimit: false,
        isActive: this.config.enableDailyTokenLimits
      },
      {
        userId,
        type: 'cost',
        period: 'monthly',
        limit: 50, // $50 per month
        warningThreshold: this.config.defaultWarningThreshold,
        hardLimit: true,
        currency: 'USD',
        isActive: this.config.enableMonthlyCostLimits
      },
      {
        userId,
        type: 'requests',
        period: 'daily',
        limit: 1000, // 1000 requests per day
        warningThreshold: this.config.defaultWarningThreshold,
        hardLimit: false,
        isActive: this.config.enableRequestRateLimits
      }
    ];

    const createdLimits: UsageLimit[] = [];
    for (const limitConfig of defaultLimits) {
      const limit = await this.createLimit(limitConfig);
      createdLimits.push(limit);
    }

    return createdLimits;
  }

  /**
   * Utilities for period calculations
   */
  private getPeriodStart(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  private getPeriodEnd(period: string): Date {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'weekly':
        const dayOfWeek = now.getDay();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (6 - dayOfWeek));
        endOfWeek.setHours(23, 59, 59, 999);
        return endOfWeek;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      case 'yearly':
        return new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `limit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<LimitConfiguration>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): LimitConfiguration {
    return { ...this.config };
  }
}