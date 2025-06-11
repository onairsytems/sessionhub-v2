/**
 * Enhanced Actor Status Dashboard - Real-time Two-Actor Integration Monitoring
 */
import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { ActorStatusIndicator, useActorStatus } from './ActorStatusIndicator';
interface APIStatus {
  planning: boolean;
  execution: boolean;
}
interface ViolationAlert {
  id: string;
  actorType: 'planning' | 'execution';
  violationType: 'boundary' | 'content' | 'method' | 'api';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  blocked: boolean;
}
interface ActorActivity {
  actorId: string;
  actorType: 'planning' | 'execution';
  operation: string;
  timestamp: string;
  status: 'started' | 'completed' | 'failed' | 'blocked';
  duration?: number;
}
interface ActorStatusDashboardProps {
  apiStatus: APIStatus;
  violations: ViolationAlert[];
  activities: ActorActivity[];
  onConfigureAPI: () => void;
  onClearViolations: () => void;
}
export const ActorStatusDashboard: React.FC<ActorStatusDashboardProps> = ({
  apiStatus,
  violations,
  activities,
  onConfigureAPI,
  onClearViolations
}) => {
  const actorStatus = useActorStatus();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  // Get violation counts by severity
  const violationStats = {
    critical: violations.filter(v => v.severity === 'critical').length,
    high: violations.filter(v => v.severity === 'high').length,
    medium: violations.filter(v => v.severity === 'medium').length,
    low: violations.filter(v => v.severity === 'low').length,
    total: violations.length
  };
  // Get recent activities
  const recentActivities = activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-300';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'blocked': return 'text-red-700 font-bold';
      case 'started': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };
  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  };
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  return (
    <div className="space-y-4 p-4">
      {/* Main Actor Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Two-Actor Integration Status</h2>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              apiStatus.planning && apiStatus.execution 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {apiStatus.planning && apiStatus.execution ? 'Real API Active' : 'Mock Implementation'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Planning Actor Status */}
          <div className="border rounded p-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🧠</span>
              <div>
                <h3 className="font-medium">Planning Actor</h3>
                <p className="text-sm text-gray-600">
                  {apiStatus.planning ? 'Claude Chat API Connected' : 'Mock Implementation'}
                </p>
              </div>
              <div className={`ml-auto w-3 h-3 rounded-full ${
                apiStatus.planning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
            </div>
            {actorStatus.activeActor === 'planning' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                Current: {actorStatus.currentTask || 'Active'}
              </div>
            )}
          </div>
          {/* Execution Actor Status */}
          <div className="border rounded p-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="font-medium">Execution Actor</h3>
                <p className="text-sm text-gray-600">
                  {apiStatus.execution ? 'Claude Code API Connected' : 'Mock Implementation'}
                </p>
              </div>
              <div className={`ml-auto w-3 h-3 rounded-full ${
                apiStatus.execution ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
            </div>
            {actorStatus.activeActor === 'execution' && (
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                Current: {actorStatus.currentTask || 'Active'}
              </div>
            )}
          </div>
        </div>
        {/* API Configuration */}
        {(!apiStatus.planning || !apiStatus.execution) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-yellow-800">API Configuration Required</h4>
                <p className="text-sm text-yellow-700">
                  Configure Anthropic API keys to enable real Two-Actor integration
                </p>
              </div>
              <button
                onClick={() => void onConfigureAPI()}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                Configure
              </button>
            </div>
          </div>
        )}
      </Card>
      {/* Boundary Violations */}
      {violationStats.total > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-red-500">⚠️</span>
              Boundary Violations ({violationStats.total})
            </h3>
            <button
              onClick={() => void onClearViolations()}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
          {/* Violation Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {violationStats.critical > 0 && (
              <div className="text-center p-2 bg-red-100 border border-red-300 rounded">
                <div className="text-lg font-bold text-red-600">{violationStats.critical}</div>
                <div className="text-xs text-red-700">Critical</div>
              </div>
            )}
            {violationStats.high > 0 && (
              <div className="text-center p-2 bg-orange-100 border border-orange-300 rounded">
                <div className="text-lg font-bold text-orange-600">{violationStats.high}</div>
                <div className="text-xs text-orange-700">High</div>
              </div>
            )}
            {violationStats.medium > 0 && (
              <div className="text-center p-2 bg-yellow-100 border border-yellow-300 rounded">
                <div className="text-lg font-bold text-yellow-600">{violationStats.medium}</div>
                <div className="text-xs text-yellow-700">Medium</div>
              </div>
            )}
            {violationStats.low > 0 && (
              <div className="text-center p-2 bg-blue-100 border border-blue-300 rounded">
                <div className="text-lg font-bold text-blue-600">{violationStats.low}</div>
                <div className="text-xs text-blue-700">Low</div>
              </div>
            )}
          </div>
          {/* Recent Violations */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {violations.slice(0, 5).map((violation) => (
              <div
                key={violation.id}
                className={`p-3 border rounded ${getSeverityColor(violation.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium capitalize">{violation.actorType}</span>
                      <span className="text-xs px-1 py-0.5 bg-white bg-opacity-50 rounded">
                        {violation.violationType}
                      </span>
                      {violation.blocked && (
                        <span className="text-xs px-1 py-0.5 bg-red-600 text-white rounded">
                          BLOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{violation.description}</p>
                    <p className="text-xs opacity-75 mt-1">{formatTime(violation.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {violations.length > 5 && (
            <button
              onClick={() => setExpandedSection(expandedSection === 'violations' ? null : 'violations')}
              className="w-full mt-2 text-sm text-gray-600 hover:text-gray-800"
            >
              {expandedSection === 'violations' ? 'Show Less' : `Show All ${violations.length} Violations`}
            </button>
          )}
          {expandedSection === 'violations' && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {violations.slice(5).map((violation) => (
                <div
                  key={violation.id}
                  className={`p-2 border rounded text-sm ${getSeverityColor(violation.severity)}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{violation.actorType}</span>
                    <span className="text-xs">{violation.violationType}</span>
                    <span className="text-xs">{formatTime(violation.timestamp)}</span>
                  </div>
                  <p>{violation.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {/* Recent Activities */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Actor Activities</h3>
          <span className="text-sm text-gray-600">{activities.length} total</span>
        </div>
        {recentActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent activities
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((activity, index) => (
              <div
                key={`${activity.actorId}-${activity.timestamp}-${index}`}
                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {activity.actorType === 'planning' ? '🧠' : '⚡'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{activity.operation}</div>
                    <div className="text-xs text-gray-600">
                      {activity.actorType} • {formatTime(activity.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activity.duration && (
                    <span className="text-xs text-gray-500">
                      {formatDuration(activity.duration)}
                    </span>
                  )}
                  <span className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
                    {activity.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {activities.length > 10 && (
          <button
            onClick={() => setExpandedSection(expandedSection === 'activities' ? null : 'activities')}
            className="w-full mt-2 text-sm text-gray-600 hover:text-gray-800"
          >
            {expandedSection === 'activities' ? 'Show Less' : `Show All ${activities.length} Activities`}
          </button>
        )}
        {expandedSection === 'activities' && (
          <div className="mt-4 space-y-1 max-h-64 overflow-y-auto">
            {activities.slice(10).map((activity, index) => (
              <div
                key={`${activity.actorId}-${activity.timestamp}-${index + 10}`}
                className="flex items-center justify-between p-1 text-sm border rounded"
              >
                <span>{activity.actorType}: {activity.operation}</span>
                <span className={getStatusColor(activity.status)}>{activity.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      {/* Floating Actor Status Indicator */}
      <ActorStatusIndicator
        activeActor={actorStatus.activeActor}
        currentTask={actorStatus.currentTask}
        violationCount={violationStats.critical + violationStats.high}
      />
    </div>
  );
};
// Hook for managing dashboard data
export const useActorDashboard = () => {
  const [apiStatus, setApiStatus] = useState<APIStatus>({ planning: false, execution: false });
  const [violations, setViolations] = useState<ViolationAlert[]>([]);
  const [activities, setActivities] = useState<ActorActivity[]>([]);
  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        if (window.electronAPI?.getRealAPIStatus) {
          const apiResponse = await window.electronAPI.getRealAPIStatus();
          // Convert response to our APIStatus interface
          setApiStatus({
            planning: apiResponse.operational,
            execution: apiResponse.operational
          });
        }
        // Mock violations and activities for now
        setViolations([]);
        setActivities([]);
      } catch (error) {
      }
    };
    loadData();
    // Set up listeners for updates (commented out for now)
    // TODO: Implement these when the IPC handlers are available
  }, []);
  const configureAPI = async () => {
    try {
      await window.electronAPI?.openAPIConfiguration?.();
    } catch (error) {
    }
  };
  const clearViolations = async () => {
    try {
      await window.electronAPI?.clearViolations?.();
      setViolations([]);
    } catch (error) {
    }
  };
  return {
    apiStatus,
    violations,
    activities,
    configureAPI,
    clearViolations
  };
};