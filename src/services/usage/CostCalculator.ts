/**
 * Cost Calculator - Advanced cost calculation with multi-currency support
 * Handles dynamic pricing, currency conversion, and cost optimization insights
 */

import { EventEmitter } from 'events';

export interface ModelPricing {
  name: string;
  inputCostPer1M: number;  // Cost per 1M input tokens
  outputCostPer1M: number; // Cost per 1M output tokens
  currency: string;
  effectiveDate: Date;
  provider: string;
}

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  exchangeRate?: number;
  originalCurrency?: string;
}

export interface BudgetAnalysis {
  totalSpent: number;
  budgetRemaining: number;
  budgetUtilization: number; // Percentage
  projectedMonthlySpend: number;
  averageDailyCost: number;
  currency: string;
  period: { start: Date; end: Date };
  recommendations: string[];
}

export interface CostOptimization {
  currentModel: string;
  currentCost: number;
  alternativeModels: Array<{
    model: string;
    estimatedCost: number;
    savings: number;
    savingsPercent: number;
    tradeoffs: string[];
  }>;
  recommendations: string[];
}

export class CostCalculator extends EventEmitter {
  private modelPricing: Map<string, ModelPricing> = new Map();
  private currencyRates: Map<string, CurrencyRate> = new Map();
  private baseCurrency: string = 'USD';
  private lastRateUpdate: Date = new Date(0);
  private readonly rateUpdateInterval = 3600000; // 1 hour

  constructor(baseCurrency: string = 'USD') {
    super();
    this.baseCurrency = baseCurrency;
    this.initializeDefaultPricing();
    this.initializeDefaultRates();
  }

  /**
   * Initialize default model pricing
   */
  private initializeDefaultPricing(): void {
    const defaultPricing: ModelPricing[] = [
      {
        name: 'claude-3-5-sonnet-20241022',
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        currency: 'USD',
        effectiveDate: new Date('2024-10-22'),
        provider: 'anthropic'
      },
      {
        name: 'claude-3-haiku-20240307',
        inputCostPer1M: 0.25,
        outputCostPer1M: 1.25,
        currency: 'USD',
        effectiveDate: new Date('2024-03-07'),
        provider: 'anthropic'
      },
      {
        name: 'claude-3-opus-20240229',
        inputCostPer1M: 15.00,
        outputCostPer1M: 75.00,
        currency: 'USD',
        effectiveDate: new Date('2024-02-29'),
        provider: 'anthropic'
      },
      {
        name: 'claude-3-sonnet-20240229',
        inputCostPer1M: 3.00,
        outputCostPer1M: 15.00,
        currency: 'USD',
        effectiveDate: new Date('2024-02-29'),
        provider: 'anthropic'
      }
    ];

    defaultPricing.forEach(pricing => {
      this.modelPricing.set(pricing.name, pricing);
    });
  }

  /**
   * Initialize default currency rates (relative to USD)
   */
  private initializeDefaultRates(): void {
    const defaultRates: CurrencyRate[] = [
      { from: 'USD', to: 'EUR', rate: 0.85, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'GBP', rate: 0.75, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'JPY', rate: 110.0, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'CAD', rate: 1.25, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'AUD', rate: 1.35, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'CHF', rate: 0.92, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'CNY', rate: 6.45, timestamp: new Date(), source: 'default' },
      { from: 'USD', to: 'INR', rate: 74.5, timestamp: new Date(), source: 'default' }
    ];

    defaultRates.forEach(rate => {
      this.currencyRates.set(`${rate.from}-${rate.to}`, rate);
      // Add reverse rate
      this.currencyRates.set(`${rate.to}-${rate.from}`, {
        from: rate.to,
        to: rate.from,
        rate: 1 / rate.rate,
        timestamp: rate.timestamp,
        source: rate.source
      });
    });
  }

  /**
   * Calculate cost for specific token usage
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    targetCurrency?: string
  ): CostBreakdown {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      throw new Error(`Pricing not found for model: ${model}`);
    }

    const inputCost = (inputTokens * pricing.inputCostPer1M) / 1000000;
    const outputCost = (outputTokens * pricing.outputCostPer1M) / 1000000;
    const totalCost = inputCost + outputCost;

    const result: CostBreakdown = {
      inputCost,
      outputCost,
      totalCost,
      currency: pricing.currency,
      model,
      inputTokens,
      outputTokens
    };

    // Convert currency if requested
    if (targetCurrency && targetCurrency !== pricing.currency) {
      const converted = this.convertCurrency(totalCost, pricing.currency, targetCurrency);
      result.totalCost = converted.amount;
      result.inputCost = (inputCost * converted.rate);
      result.outputCost = (outputCost * converted.rate);
      result.originalCurrency = pricing.currency;
      result.currency = targetCurrency;
      result.exchangeRate = converted.rate;
    }

    return result;
  }

  /**
   * Convert currency amount
   */
  convertCurrency(amount: number, fromCurrency: string, toCurrency: string): {
    amount: number;
    rate: number;
    timestamp: Date;
  } {
    if (fromCurrency === toCurrency) {
      return { amount, rate: 1, timestamp: new Date() };
    }

    const rateKey = `${fromCurrency}-${toCurrency}`;
    const rate = this.currencyRates.get(rateKey);

    if (!rate) {
      // Try reverse conversion
      const reverseKey = `${toCurrency}-${fromCurrency}`;
      const reverseRate = this.currencyRates.get(reverseKey);
      
      if (reverseRate) {
        const convertedRate = 1 / reverseRate.rate;
        return {
          amount: amount * convertedRate,
          rate: convertedRate,
          timestamp: reverseRate.timestamp
        };
      }

      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    return {
      amount: amount * rate.rate,
      rate: rate.rate,
      timestamp: rate.timestamp
    };
  }

  /**
   * Analyze budget and spending patterns
   */
  analyzeBudget(
    totalSpent: number,
    budget: number,
    spendingHistory: Array<{ date: Date; amount: number }>,
    currency: string = this.baseCurrency
  ): BudgetAnalysis {
    const budgetRemaining = Math.max(0, budget - totalSpent);
    const budgetUtilization = (totalSpent / budget) * 100;

    // Calculate average daily cost
    const sortedHistory = spendingHistory.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstDate = sortedHistory[0]?.date || new Date();
    const lastDate = sortedHistory[sortedHistory.length - 1]?.date || new Date();
    const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const averageDailyCost = totalSpent / daysDiff;

    // Project monthly spend
    const projectedMonthlySpend = averageDailyCost * 30;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (budgetUtilization > 90) {
      recommendations.push('Budget nearly exhausted. Consider increasing budget or reducing usage.');
    } else if (budgetUtilization > 75) {
      recommendations.push('High budget utilization. Monitor usage closely.');
    }

    if (projectedMonthlySpend > budget) {
      recommendations.push(`Projected monthly spend (${projectedMonthlySpend.toFixed(2)} ${currency}) exceeds budget.`);
    }

    if (averageDailyCost > budget * 0.1) {
      recommendations.push('Daily spend is high relative to budget. Consider usage optimization.');
    }

    return {
      totalSpent,
      budgetRemaining,
      budgetUtilization,
      projectedMonthlySpend,
      averageDailyCost,
      currency,
      period: { start: firstDate, end: lastDate },
      recommendations
    };
  }

  /**
   * Provide cost optimization recommendations
   */
  optimizeCosts(
    currentModel: string,
    avgInputTokens: number,
    avgOutputTokens: number,
    targetCurrency?: string
  ): CostOptimization {
    const currentCost = this.calculateCost(
      currentModel,
      avgInputTokens,
      avgOutputTokens,
      targetCurrency
    );

    const alternatives: Array<{
      model: string;
      estimatedCost: number;
      savings: number;
      savingsPercent: number;
      tradeoffs: string[];
    }> = [];

    // Analyze all available models
    for (const [modelName] of this.modelPricing) {
      if (modelName === currentModel) continue;

      const altCost = this.calculateCost(
        modelName,
        avgInputTokens,
        avgOutputTokens,
        targetCurrency
      );

      const savings = currentCost.totalCost - altCost.totalCost;
      const savingsPercent = (savings / currentCost.totalCost) * 100;

      const tradeoffs = this.analyzeModelTradeoffs(currentModel, modelName);

      alternatives.push({
        model: modelName,
        estimatedCost: altCost.totalCost,
        savings,
        savingsPercent,
        tradeoffs
      });
    }

    // Sort by savings (highest first)
    alternatives.sort((a, b) => b.savings - a.savings);

    // Generate general recommendations
    const recommendations: string[] = [];
    
    const bestAlternative = alternatives.find(alt => alt.savings > 0);
    if (bestAlternative) {
      recommendations.push(
        `Consider ${bestAlternative.model} for ${bestAlternative.savingsPercent.toFixed(1)}% cost savings.`
      );
    }

    if (avgOutputTokens > avgInputTokens * 2) {
      recommendations.push('High output-to-input ratio. Consider optimizing prompts to reduce output tokens.');
    }

    if (currentModel.includes('opus')) {
      recommendations.push('Using premium model. Consider Sonnet or Haiku for cost-sensitive tasks.');
    }

    return {
      currentModel,
      currentCost: currentCost.totalCost,
      alternativeModels: alternatives.slice(0, 3), // Top 3 alternatives
      recommendations
    };
  }

  /**
   * Analyze tradeoffs between models
   */
  private analyzeModelTradeoffs(_currentModel: string, _alternativeModel: string): string[] {
    // Mock implementation - would analyze model capabilities
    return ['Lower cost per request'];
  }

  /**
   * Update model pricing
   */
  updateModelPricing(newPricing: ModelPricing): void {
    this.modelPricing.set(newPricing.name, newPricing);
    this.emit('pricing_updated', newPricing);
  }

  /**
   * Update currency exchange rate
   */
  updateExchangeRate(rate: CurrencyRate): void {
    this.currencyRates.set(`${rate.from}-${rate.to}`, rate);
    this.lastRateUpdate = new Date();
    this.emit('rate_updated', rate);
  }

  /**
   * Get all available models and their pricing
   */
  getAvailableModels(currency?: string): Array<ModelPricing & { convertedPricing?: ModelPricing }> {
    const models = Array.from(this.modelPricing.values());
    
    if (!currency || currency === this.baseCurrency) {
      return models;
    }

    return models.map(model => {
      try {
        const inputConverted = this.convertCurrency(model.inputCostPer1M, model.currency, currency);
        const outputConverted = this.convertCurrency(model.outputCostPer1M, model.currency, currency);
        
        return {
          ...model,
          convertedPricing: {
            ...model,
            inputCostPer1M: inputConverted.amount,
            outputCostPer1M: outputConverted.amount,
            currency
          }
        };
      } catch {
        return model;
      }
    });
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): string[] {
    const currencies = new Set<string>();
    
    for (const rate of this.currencyRates.values()) {
      currencies.add(rate.from);
      currencies.add(rate.to);
    }
    
    return Array.from(currencies).sort();
  }

  /**
   * Calculate cost for bulk operations
   */
  calculateBulkCost(
    operations: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
    }>,
    targetCurrency?: string
  ): {
    totalCost: number;
    breakdown: CostBreakdown[];
    currency: string;
    summary: {
      totalInputTokens: number;
      totalOutputTokens: number;
      modelDistribution: Record<string, number>;
    };
  } {
    const breakdown: CostBreakdown[] = [];
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const modelDistribution: Record<string, number> = {};

    for (const op of operations) {
      const cost = this.calculateCost(op.model, op.inputTokens, op.outputTokens, targetCurrency);
      breakdown.push(cost);
      totalCost += cost.totalCost;
      totalInputTokens += op.inputTokens;
      totalOutputTokens += op.outputTokens;
      
      modelDistribution[op.model] = (modelDistribution[op.model] || 0) + 1;
    }

    return {
      totalCost,
      breakdown,
      currency: targetCurrency || this.baseCurrency,
      summary: {
        totalInputTokens,
        totalOutputTokens,
        modelDistribution
      }
    };
  }

  /**
   * Set base currency
   */
  setBaseCurrency(currency: string): void {
    this.baseCurrency = currency;
    this.emit('base_currency_changed', currency);
  }

  /**
   * Get current base currency
   */
  getBaseCurrency(): string {
    return this.baseCurrency;
  }

  /**
   * Check if exchange rates need updating
   */
  needsRateUpdate(): boolean {
    return Date.now() - this.lastRateUpdate.getTime() > this.rateUpdateInterval;
  }

  /**
   * Format currency amount for display
   */
  formatCurrency(amount: number, currency: string, decimals: number = 4): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    
    return formatter.format(amount);
  }

  /**
   * Estimate costs for projected usage
   */
  estimateProjectedCosts(
    model: string,
    dailyRequests: number,
    avgInputTokensPerRequest: number,
    avgOutputTokensPerRequest: number,
    projectionDays: number = 30,
    targetCurrency?: string
  ): {
    dailyCost: number;
    weeklyCost: number;
    monthlyCost: number;
    totalProjectedCost: number;
    currency: string;
  } {
    const singleRequestCost = this.calculateCost(
      model,
      avgInputTokensPerRequest,
      avgOutputTokensPerRequest,
      targetCurrency
    );

    const dailyCost = singleRequestCost.totalCost * dailyRequests;
    const weeklyCost = dailyCost * 7;
    const monthlyCost = dailyCost * 30;
    const totalProjectedCost = dailyCost * projectionDays;

    return {
      dailyCost,
      weeklyCost,
      monthlyCost,
      totalProjectedCost,
      currency: targetCurrency || this.baseCurrency
    };
  }
}