import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Activity, AlertCircle, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, Users, Zap, RefreshCw 
} from 'lucide-react';
import { ErrorAnalyticsEngine, ErrorMetrics, ErrorPattern, ErrorInsight, TimeSeriesData } from '@/services/analytics/ErrorAnalyticsEngine';
import { ErrorSeverity } from '@/core/orchestrator/EnhancedErrorHandler';
import { formatDistanceToNow } from 'date-fns';

interface ErrorMonitoringDashboardProps {
  analyticsEngine: ErrorAnalyticsEngine;
  className?: string;
}

interface DashboardState {
  metrics: ErrorMetrics;
  patterns: ErrorPattern[];
  insights: ErrorInsight[];
  timeSeries: {
    errorRate: TimeSeriesData[];
    impactedUsers: TimeSeriesData[];
    recoveryRate: TimeSeriesData[];
  };
  selectedTimeRange: '1h' | '6h' | '24h' | '7d';
  autoRefresh: boolean;
  refreshInterval: number;
}

const SEVERITY_COLORS = {
  [ErrorSeverity.LOW]: '#10b981',
  [ErrorSeverity.MEDIUM]: '#f59e0b',
  [ErrorSeverity.HIGH]: '#ef4444',
  [ErrorSeverity.CRITICAL]: '#7c3aed'
};

const INSIGHT_ICONS = {
  pattern: AlertCircle,
  anomaly: AlertTriangle,
  correlation: Zap,
  prediction: TrendingUp
};

export const ErrorMonitoringDashboard: React.FC<ErrorMonitoringDashboardProps> = ({
  analyticsEngine,
  className = ''
}) => {
  const [state, setState] = useState<DashboardState>({
    metrics: analyticsEngine.getMetrics(),
    patterns: analyticsEngine.getPatterns(),
    insights: analyticsEngine.getInsights(),
    timeSeries: {
      errorRate: [],
      impactedUsers: [],
      recoveryRate: []
    },
    selectedTimeRange: '1h',
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  });

  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const timeRangeDurations = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000
  };

  const fetchData = useCallback(() => {
    const duration = timeRangeDurations[state.selectedTimeRange];
    
    setState(prev => ({
      ...prev,
      metrics: analyticsEngine.getMetrics(),
      patterns: analyticsEngine.getPatterns(),
      insights: analyticsEngine.getInsights(),
      timeSeries: {
        errorRate: analyticsEngine.getTimeSeriesData('errorRate', String(duration)),
        impactedUsers: analyticsEngine.getTimeSeriesData('impactedUsers', String(duration)),
        recoveryRate: analyticsEngine.getTimeSeriesData('recoveryRate', String(duration))
      }
    }));
    
    setLastUpdate(new Date());
  }, [analyticsEngine, state.selectedTimeRange]);

  useEffect(() => {
    fetchData();
    
    let interval: NodeJS.Timeout | null = null;
    if (state.autoRefresh) {
      interval = setInterval(fetchData, state.refreshInterval);
    }
    
    const handleMetricsUpdate = () => {
      if (state.autoRefresh) {
        fetchData();
      }
    };
    
    analyticsEngine.on('metrics:updated', handleMetricsUpdate);
    analyticsEngine.on('analysis:complete', handleMetricsUpdate);
    
    return () => {
      if (interval) clearInterval(interval);
      analyticsEngine.off('metrics:updated', handleMetricsUpdate);
      analyticsEngine.off('analysis:complete', handleMetricsUpdate);
    };
  }, [analyticsEngine, state.autoRefresh, state.refreshInterval, fetchData]);

  const formatTimeSeriesData = (data: TimeSeriesData[]) => {
    return data.map(point => ({
      time: point.timestamp.toLocaleTimeString(),
      value: point.value,
      ...(point as any).metadata
    }));
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  const severityData = useMemo(() => {
    return Object.entries(state.metrics.errorsBySeverity).map(([severity, count]) => ({
      name: severity,
      value: count,
      color: SEVERITY_COLORS[severity as ErrorSeverity]
    }));
  }, [state.metrics.errorsBySeverity]);

  const topErrorTypes = useMemo(() => {
    return Object.entries(state.metrics.errorsByType)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }, [state.metrics.errorsByType]);

  return (
    <div className={`error-monitoring-dashboard ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Error Analytics & Monitoring</h2>
          <p className="text-muted-foreground">
            Last updated: {formatDistanceToNow(lastUpdate, { addSuffix: true })}
          </p>
        </div>
        
        <div className="flex gap-4 items-center">
          <Select 
            value={state.selectedTimeRange}
            onChange={(e) => setState(prev => ({ ...prev, selectedTimeRange: e.target.value as '1h' | '6h' | '24h' | '7d' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={state.autoRefresh ? "primary" : "secondary"}
            size="sm"
            onClick={() => setState(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${state.autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button variant="ghost" size="sm" onClick={fetchData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{state.metrics.totalErrors}</span>
              {state.metrics.errorTrends && state.metrics.errorTrends[0] && getTrendIcon(state.metrics.errorTrends[0].rate > 0 ? 'increasing' : state.metrics.errorTrends[0].rate < 0 ? 'decreasing' : 'stable')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {state.metrics.errorRate} errors/min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Impacted Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{state.metrics.impactedUsers}</span>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {state.metrics.impactedSessions} sessions affected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {(state.metrics.recoveryRate * 100).toFixed(1)}%
              </span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              MTTR: {(state.metrics.meanTimeToRecovery / 1000).toFixed(1)}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {state.metrics.errorsBySeverity[ErrorSeverity.CRITICAL]}
              </span>
              <AlertTriangle className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {state.insights.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Active Insights</h3>
          <div className="space-y-3">
            {state.insights.slice(0, 3).map(insight => {
              const Icon = INSIGHT_ICONS[insight.type as keyof typeof INSIGHT_ICONS];
              return (
                <Alert key={insight.id} variant={insight.severity === 'critical' ? 'destructive' : 'default'}>
                  <Icon className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <strong>{insight.title}</strong>
                        <p className="text-sm mt-1">{insight.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Recommendation: {insight.recommendation}
                        </p>
                      </div>
                      <Badge variant={insight.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {insight.severity}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs value="trends" onValueChange={() => {}} className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="impact">User Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={formatTimeSeriesData(state.timeSeries.errorRate)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#ef4444" 
                    name="Errors/min"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recovery Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={formatTimeSeriesData(state.timeSeries.recoveryRate)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis tickFormatter={(value: any) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(1)}%`} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3}
                      name="Recovery Rate"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impacted Users</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={formatTimeSeriesData(state.timeSeries.impactedUsers)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                      name="Users"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Error Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topErrorTypes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Error Patterns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {state.patterns.length === 0 ? (
                  <p className="text-muted-foreground">No recurring patterns detected</p>
                ) : (
                  state.patterns.slice(0, 10).map((pattern, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {pattern.pattern.split(':')[1] || pattern.pattern}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Last seen: {formatDistanceToNow(pattern.lastSeen, { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{pattern.frequency} times</Badge>
                          <Badge variant={pattern.severity === 'critical' ? 'destructive' : 'outline'}>
                            {pattern.severity}
                          </Badge>
                        </div>
                      </div>
                      {(pattern as any).suggestedFix && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <strong>Suggested Fix:</strong> {(pattern as any).suggestedFix}
                        </div>
                      )}
                      {(pattern as any).affectedComponents?.length > 0 && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Affected components: </span>
                          {(pattern as any).affectedComponents.slice(0, 3).map((comp: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs mr-1">
                              {comp}
                            </Badge>
                          ))}
                          {(pattern as any).affectedComponents.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{(pattern as any).affectedComponents.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Impact Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Sessions</span>
                    <span className="font-medium">{state.metrics.impactedSessions}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Success Rate</span>
                    <span className="font-medium">
                      {((1 - state.metrics.impactedSessions / Math.max(state.metrics.impactedUsers * 2, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Errors per Session</span>
                    <span className="font-medium">
                      {state.metrics.impactedSessions > 0 
                        ? (state.metrics.totalErrors / state.metrics.impactedSessions).toFixed(1)
                        : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recovery Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Auto-Recovery Rate</span>
                    <span className="font-medium">{(state.metrics.recoveryRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Mean Time to Recovery</span>
                    <span className="font-medium">
                      {(state.metrics.meanTimeToRecovery / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Failed Recoveries</span>
                    <span className="font-medium">
                      {Math.round(state.metrics.totalErrors * (1 - state.metrics.recoveryRate))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Experience Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{state.metrics.impactedUsers}</strong> users experienced errors in the selected time range.
                    {state.metrics.recoveryRate > 0.8 && (
                      <span className="text-green-600 ml-2">
                        Most errors were automatically recovered.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
                
                {(state.metrics.errorsBySeverity['critical'] || 0) > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{state.metrics.errorsBySeverity['critical'] || 0}</strong> critical errors 
                      may have caused significant disruption to user workflows.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};