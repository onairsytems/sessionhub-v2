import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { QueueMetrics } from '@/src/services/queue/SessionQueueManager';
import { 
  Clock, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Activity,
  Timer,
  Gauge
} from 'lucide-react';

interface QueueMetricsPanelProps {
  metrics: QueueMetrics;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  description?: string;
}

function MetricCard({ title, value, icon, trend, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function QueueMetricsPanel({ metrics }: QueueMetricsPanelProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Queue Depth"
        value={metrics.totalQueued}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        description={`${metrics.activeCount} active, ${metrics.pausedCount} paused`}
      />
      
      <MetricCard
        title="Average Wait Time"
        value={formatTime(metrics.averageWaitTime)}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        description="Time in queue before processing"
      />
      
      <MetricCard
        title="Processing Time"
        value={formatTime(metrics.averageProcessingTime)}
        icon={<Timer className="h-4 w-4 text-muted-foreground" />}
        description="Average per session"
      />
      
      <MetricCard
        title="Throughput"
        value={`${metrics.throughputPerHour}/hr`}
        icon={<Gauge className="h-4 w-4 text-muted-foreground" />}
        description="Sessions completed per hour"
      />
      
      <MetricCard
        title="Completed Today"
        value={metrics.completedToday}
        icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
        trend={metrics.completedToday > 0 ? `${Math.round((metrics.completedToday / (metrics.completedToday + metrics.failedToday)) * 100)}% success rate` : undefined}
      />
      
      <MetricCard
        title="Failed Today"
        value={metrics.failedToday}
        icon={<AlertCircle className="h-4 w-4 text-red-600" />}
        description={metrics.failedToday > 0 ? "Review failed sessions" : "No failures"}
      />
      
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Queue Time</span>
                <span className="text-sm font-medium">
                  {metrics.totalQueued > 0 
                    ? formatTime(Math.ceil(metrics.totalQueued / Math.max(metrics.activeCount, 1)) * metrics.averageProcessingTime)
                    : 'Queue empty'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sessions per Hour</span>
                <span className="text-sm font-medium">{metrics.throughputPerHour}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Workers</span>
                <span className="text-sm font-medium">{metrics.activeCount} / 5</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}