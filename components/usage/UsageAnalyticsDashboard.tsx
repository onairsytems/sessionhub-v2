/**
 * Usage Analytics Dashboard - Historical data visualization and insights
 * Provides comprehensive analytics for usage patterns and cost optimization
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';

export interface UsageDataPoint {
  timestamp: Date;
  tokens: number;
  cost: number;
  requests: number;
  model: string;
}

export interface AnalyticsData {
  usage: UsageDataPoint[];
  trends: {
    tokensChange: number;
    costChange: number;
    requestsChange: number;
    period: string;
  };
  insights: Array<{
    type: 'info' | 'warning' | 'optimization';
    title: string;
    message: string;
    value?: number;
    suggestion?: string;
  }>;
  modelDistribution: Record<string, { usage: number; cost: number; percentage: number }>;
  costBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
}

export interface UsageAnalyticsDashboardProps {
  userId: string;
  dateRange: { start: Date; end: Date };
  currency?: string;
  onExport?: (format: 'csv' | 'json') => void;
}

export function UsageAnalyticsDashboard({
  userId: _userId,
  dateRange,
  currency = 'USD',
  onExport
}: UsageAnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d' | 'custom'>('7d');
  const [chartView, setChartView] = useState<'tokens' | 'cost' | 'requests'>('cost');

  // Mock data generation for demonstration
  const generateMockData = useCallback((): AnalyticsData => {
    const usage: UsageDataPoint[] = [];
    const days = Math.floor((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      const baseTokens = 5000 + Math.random() * 10000;
      const baseCost = baseTokens * 0.00005; // Approximate cost
      
      usage.push({
        timestamp: date,
        tokens: Math.floor(baseTokens + Math.sin(i * 0.2) * 2000),
        cost: parseFloat((baseCost + Math.random() * 2).toFixed(4)),
        requests: Math.floor(10 + Math.random() * 40),
        model: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'][Math.floor(Math.random() * 2)] as string
      });
    }

    const totalCost = usage.reduce((sum, point) => sum + point.cost, 0);

    // Calculate trends (mock data)
    const trends = {
      tokensChange: (Math.random() - 0.5) * 20,
      costChange: (Math.random() - 0.5) * 30,
      requestsChange: (Math.random() - 0.5) * 15,
      period: selectedTimeRange === '24h' ? 'vs yesterday' : selectedTimeRange === '7d' ? 'vs last week' : 'vs last month'
    };

    // Generate insights
    const insights = [
      {
        type: 'info' as const,
        title: 'Average Daily Cost',
        message: `Your average daily API cost is ${(totalCost / days).toFixed(2)} ${currency}`,
        value: totalCost / days
      },
      {
        type: 'optimization' as const,
        title: 'Model Optimization',
        message: 'Consider using Claude Haiku for simple tasks to reduce costs by up to 80%',
        suggestion: 'Switch to claude-3-haiku-20240307 for basic text processing'
      },
      {
        type: totalCost > 100 ? 'warning' as const : 'info' as const,
        title: 'Monthly Budget Projection',
        message: `At current usage rate, monthly cost will be ${(totalCost * 30 / days).toFixed(2)} ${currency}`,
        value: totalCost * 30 / days
      }
    ];

    // Model distribution
    const modelDistribution = usage.reduce((acc, point) => {
      if (!acc[point.model]) {
        acc[point.model] = { usage: 0, cost: 0, percentage: 0 };
      }
      const modelData = acc[point.model];
      if (modelData) {
        modelData.usage += point.tokens;
        modelData.cost += point.cost;
      }
      return acc;
    }, {} as Record<string, { usage: number; cost: number; percentage: number }>);

    // Calculate percentages
    Object.values(modelDistribution).forEach(model => {
      model.percentage = (model.cost / totalCost) * 100;
    });

    // Cost breakdown
    const costBreakdown = [
      { category: 'Input Tokens', amount: totalCost * 0.3, percentage: 30, color: '#3B82F6' },
      { category: 'Output Tokens', amount: totalCost * 0.7, percentage: 70, color: '#EF4444' }
    ];

    return {
      usage,
      trends,
      insights,
      modelDistribution,
      costBreakdown
    };
  }, [dateRange, currency, selectedTimeRange]);

  useEffect(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setData(generateMockData());
      setIsLoading(false);
    }, 1000);
  }, [dateRange, selectedTimeRange, generateMockData]);

  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.usage.map(point => ({
      date: point.timestamp.toLocaleDateString(),
      value: point[chartView],
      model: point.model
    }));
  }, [data, chartView]);

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(point => point.value));
  }, [chartData]);

  const formatValue = (value: number, type: string): string => {
    switch (type) {
      case 'cost':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 4
        }).format(value);
      case 'tokens':
        return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
      default:
        return value.toString();
    }
  };

  const getTrendColor = (change: number): string => {
    if (change > 0) return 'text-red-600 dark:text-red-400';
    if (change < 0) return 'text-green-600 dark:text-green-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getTrendIcon = (change: number): string => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold">Usage Analytics</h2>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['24h', '7d', '30d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedTimeRange === range
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {onExport && (
            <div className="flex items-center space-x-1">
              <Button size="sm" variant="outline" onClick={() => onExport('csv')}>
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => onExport('json')}>
                Export JSON
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tokens Used</p>
                <p className="text-2xl font-bold">
                  {formatValue(data.usage.reduce((sum, point) => sum + point.tokens, 0), 'tokens')}
                </p>
                <p className={`text-sm ${getTrendColor(data.trends.tokensChange)}`}>
                  {getTrendIcon(data.trends.tokensChange)} {Math.abs(data.trends.tokensChange).toFixed(1)}% {data.trends.period}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
                <p className="text-2xl font-bold">
                  {formatValue(data.usage.reduce((sum, point) => sum + point.cost, 0), 'cost')}
                </p>
                <p className={`text-sm ${getTrendColor(data.trends.costChange)}`}>
                  {getTrendIcon(data.trends.costChange)} {Math.abs(data.trends.costChange).toFixed(1)}% {data.trends.period}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">API Requests</p>
                <p className="text-2xl font-bold">
                  {data.usage.reduce((sum, point) => sum + point.requests, 0)}
                </p>
                <p className={`text-sm ${getTrendColor(data.trends.requestsChange)}`}>
                  {getTrendIcon(data.trends.requestsChange)} {Math.abs(data.trends.requestsChange).toFixed(1)}% {data.trends.period}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Usage Trends</CardTitle>
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['tokens', 'cost', 'requests'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                    chartView === view
                      ? 'bg-white dark:bg-gray-700 shadow-sm'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 flex items-end space-x-2">
            {chartData.map((point, index) => (
              <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                  style={{ height: `${(point.value / maxValue) * 200}px` }}
                  title={`${point.date}: ${formatValue(point.value, chartView)}`}
                />
                <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                  {point.date}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Model Distribution and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Model Usage Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Object.entries(data.modelDistribution).map(([model, stats]) => (
                <div key={model} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{model}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatValue(stats.cost, 'cost')} ({stats.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Insights & Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {data.insights.map((insight, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <Badge 
                      variant={
                        insight.type === 'warning' 
                          ? 'destructive' 
                          : insight.type === 'optimization' 
                            ? 'secondary' 
                            : 'default'
                      }
                    >
                      {insight.type}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{insight.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{insight.message}</p>
                      {insight.suggestion && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          💡 {insight.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {data.costBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatValue(item.amount, 'cost')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                  {data.costBreakdown.map((item, index) => {
                    const offset = data.costBreakdown
                      .slice(0, index)
                      .reduce((sum, prev) => sum + prev.percentage, 0);
                    const circumference = 2 * Math.PI * 40;
                    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((offset / 100) * circumference);
                    
                    return (
                      <circle
                        key={index}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="8"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}