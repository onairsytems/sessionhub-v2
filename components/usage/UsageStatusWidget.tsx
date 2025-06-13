/**
 * Usage Status Widget - Real-time display of API usage in status bar
 * Shows current token usage, costs, and limits with visual indicators
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export interface UsageData {
  tokens: {
    current: number;
    limit?: number;
    percentage: number;
  };
  cost: {
    current: number;
    limit?: number;
    percentage: number;
    currency: string;
  };
  requests: {
    current: number;
    limit?: number;
    percentage: number;
  };
  period: string;
  timeUntilReset: number;
}

export interface UsageStatusWidgetProps {
  usage?: UsageData;
  isLoading?: boolean;
  onViewDetails?: () => void;
  onRefresh?: () => void;
  compact?: boolean;
  showAlerts?: boolean;
}

export function UsageStatusWidget({
  usage,
  isLoading = false,
  onViewDetails,
  onRefresh,
  compact = true,
  showAlerts = true
}: UsageStatusWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ type: 'warning' | 'error'; message: string }>>([]);

  useEffect(() => {
    if (!usage || !showAlerts) return;

    const newAlerts: Array<{ type: 'warning' | 'error'; message: string }> = [];

    // Check for usage warnings
    if (usage.tokens.percentage >= 90) {
      newAlerts.push({
        type: 'error',
        message: `Token usage at ${usage.tokens.percentage.toFixed(1)}%`
      });
    } else if (usage.tokens.percentage >= 75) {
      newAlerts.push({
        type: 'warning',
        message: `Token usage at ${usage.tokens.percentage.toFixed(1)}%`
      });
    }

    if (usage.cost.percentage >= 90) {
      newAlerts.push({
        type: 'error',
        message: `Cost at ${usage.cost.percentage.toFixed(1)}% of budget`
      });
    } else if (usage.cost.percentage >= 75) {
      newAlerts.push({
        type: 'warning',
        message: `Cost at ${usage.cost.percentage.toFixed(1)}% of budget`
      });
    }

    setAlerts(newAlerts);
  }, [usage, showAlerts]);

  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Loading usage...</span>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <span className="text-sm text-gray-500 dark:text-gray-400">No usage data</span>
        {onRefresh && (
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      </div>
    );
  }

  if (compact && !expanded) {
    return (
      <div className="flex items-center space-x-2">
        {/* Compact Status Indicators */}
        <div 
          className="flex items-center space-x-3 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          onClick={() => setExpanded(true)}
        >
          {/* Token Usage */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">T:</span>
            <span className={`text-xs font-medium ${getStatusColor(usage.tokens.percentage)}`}>
              {formatNumber(usage.tokens.current)}
            </span>
            {usage.tokens.limit && (
              <span className="text-xs text-gray-400">/{formatNumber(usage.tokens.limit)}</span>
            )}
          </div>

          {/* Cost */}
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">$:</span>
            <span className={`text-xs font-medium ${getStatusColor(usage.cost.percentage)}`}>
              {formatCurrency(usage.cost.current, usage.cost.currency)}
            </span>
          </div>

          {/* Alert Indicator */}
          {alerts.length > 0 && (
            <Badge variant={alerts.some(a => a.type === 'error') ? 'destructive' : 'secondary'}>
              {alerts.length}
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-1">
          {onRefresh && (
            <Button size="sm" variant="ghost" onClick={onRefresh} className="w-8 h-8 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          )}
          {onViewDetails && (
            <Button size="sm" variant="ghost" onClick={onViewDetails} className="w-8 h-8 p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="w-80">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">API Usage - {usage.period}</h3>
            <div className="flex items-center space-x-1">
              {compact && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setExpanded(false)}
                  className="w-6 h-6 p-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              )}
              {onRefresh && (
                <Button size="sm" variant="ghost" onClick={onRefresh} className="w-6 h-6 p-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              )}
            </div>
          </div>

          {/* Token Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tokens</span>
              <span className={`text-sm font-medium ${getStatusColor(usage.tokens.percentage)}`}>
                {formatNumber(usage.tokens.current)}
                {usage.tokens.limit && ` / ${formatNumber(usage.tokens.limit)}`}
              </span>
            </div>
            {usage.tokens.limit && (
              <div className="space-y-1">
                <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(usage.tokens.percentage)}`}
                    style={{ width: `${Math.min(usage.tokens.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{usage.tokens.percentage.toFixed(1)}% used</span>
              </div>
            )}
          </div>

          {/* Cost Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cost</span>
              <span className={`text-sm font-medium ${getStatusColor(usage.cost.percentage)}`}>
                {formatCurrency(usage.cost.current, usage.cost.currency)}
                {usage.cost.limit && ` / ${formatCurrency(usage.cost.limit, usage.cost.currency)}`}
              </span>
            </div>
            {usage.cost.limit && (
              <div className="space-y-1">
                <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(usage.cost.percentage)}`}
                    style={{ width: `${Math.min(usage.cost.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{usage.cost.percentage.toFixed(1)}% of budget</span>
              </div>
            )}
          </div>

          {/* Requests */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Requests</span>
              <span className={`text-sm font-medium ${getStatusColor(usage.requests.percentage)}`}>
                {usage.requests.current}
                {usage.requests.limit && ` / ${usage.requests.limit}`}
              </span>
            </div>
            {usage.requests.limit && (
              <div className="space-y-1">
                <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2`}>
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(usage.requests.percentage)}`}
                    style={{ width: `${Math.min(usage.requests.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{usage.requests.percentage.toFixed(1)}% used</span>
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Alerts</span>
              <div className="space-y-1">
                {alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`text-xs px-2 py-1 rounded ${
                      alert.type === 'error'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset Timer */}
          {usage.timeUntilReset > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Resets in {formatTime(usage.timeUntilReset)}
            </div>
          )}

          {/* Actions */}
          {onViewDetails && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onViewDetails}
              className="w-full"
            >
              View Detailed Analytics
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for real-time usage data
export function useUsageData(userId?: string, refreshInterval: number = 30000) {
  const [usage, setUsage] = useState<UsageData | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refreshUsage = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      // This would be replaced with actual API call
      const response = await fetch(`/api/usage/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch usage data');
      
      const data = await response.json() as UsageData;
      setUsage(data);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshUsage();

    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        void refreshUsage();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [userId, refreshInterval, refreshUsage]);

  return {
    usage,
    isLoading,
    error,
    refreshUsage
  };
}