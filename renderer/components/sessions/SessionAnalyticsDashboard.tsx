import React, { useState, useEffect } from 'react';
import { SessionAnalytics } from '@/src/services/SessionService';
import { SessionStatus } from '@/src/models/Session';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SessionAnalyticsDashboardProps {
  userId?: string;
  projectId?: string;
  dateRange?: { from: Date; to: Date };
}

export const SessionAnalyticsDashboard: React.FC<SessionAnalyticsDashboardProps> = ({
  userId,
  projectId,
  dateRange
}) => {
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [userId, projectId, selectedPeriod, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const period = getPeriodDateRange(selectedPeriod);
      const result = await window.electron.invoke('session:analytics', {
        userId,
        projectId,
        dateRange: dateRange || period
      });
      setAnalytics(result);
    } catch (error) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const getPeriodDateRange = (period: string) => {
    const to = new Date();
    const from = new Date();
    
    switch (period) {
      case '7d':
        from.setDate(from.getDate() - 7);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      case '90d':
        from.setDate(from.getDate() - 90);
        break;
      case 'all':
        from.setFullYear(from.getFullYear() - 10);
        break;
    }
    
    return { from, to };
  };

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'pending': return '#6b7280';
      case 'planning': return '#3b82f6';
      case 'executing': return '#8b5cf6';
      case 'cancelled': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 1000 / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="p-6">
        <p className="text-gray-500 dark:text-gray-400">No analytics data available.</p>
      </Card>
    );
  }

  // Calculate max value for bar chart scaling
  const maxDailyCount = Math.max(...analytics.sessionsByDay.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Session Analytics
        </h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map(period => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period === 'all' ? 'All Time' : `Last ${period}`}
            </Button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {analytics.totalSessions}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {analytics.successRate.toFixed(1)}%
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Duration</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatDuration(analytics.averageDuration)}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Now</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {analytics.sessionsByStatus.executing || 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions by status */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Sessions by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.sessionsByStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getStatusColor(status as SessionStatus) }}
                    />
                    <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(count / analytics.totalSessions) * 100}%`,
                          backgroundColor: getStatusColor(status as SessionStatus)
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-10 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Performance metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Performance Metrics
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Planning Time
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDuration(analytics.performanceMetrics.avgPlanningTime)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{
                    width: `${(analytics.performanceMetrics.avgPlanningTime / analytics.performanceMetrics.avgTotalTime) * 100}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Execution Time
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDuration(analytics.performanceMetrics.avgExecutionTime)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{
                    width: `${(analytics.performanceMetrics.avgExecutionTime / analytics.performanceMetrics.avgTotalTime) * 100}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Average Time
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(analytics.performanceMetrics.avgTotalTime)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Sessions over time */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Sessions Over Time
        </h3>
        <div className="h-64 flex items-end justify-between gap-1">
          {analytics.sessionsByDay.map((day) => (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center justify-end group"
            >
              <div className="relative w-full">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all group-hover:bg-blue-600"
                  style={{
                    height: `${(day.count / maxDailyCount) * 200}px`,
                    minHeight: day.count > 0 ? '4px' : '0'
                  }}
                />
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {day.count} sessions
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 rotate-45 origin-left">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Common errors */}
      {analytics.commonErrors.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Common Errors
          </h3>
          <div className="space-y-2">
            {analytics.commonErrors.slice(0, 5).map((error, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
              >
                <span className="text-sm text-red-700 dark:text-red-300 flex-1 mr-4">
                  {error.error}
                </span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {error.count} occurrence{error.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};