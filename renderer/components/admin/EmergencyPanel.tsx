import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface EmergencyLogResult {
  success: boolean;
  logs?: EmergencyLog[];
}

interface EmergencyActionResult {
  success: boolean;
  message?: string;
}

interface EmergencyLog {
  id: string;
  adminId: string;
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  affectedResources?: unknown[];
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export const EmergencyPanel: React.FC = () => {
  const [emergencyLogs, setEmergencyLogs] = useState<EmergencyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewEmergencyForm, setShowNewEmergencyForm] = useState(false);
  const [newEmergency, setNewEmergency] = useState<{
    action: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    affectedResources: string;
  }>({
    action: '',
    severity: 'high',
    reason: '',
    affectedResources: ''
  });

  useEffect(() => {
    void loadEmergencyLogs();
  }, []);

  const loadEmergencyLogs = async () => {
    try {
      setLoading(true);
      const result = await window.electron.invoke('admin:get-emergency-logs') as EmergencyLogResult;
      if (result.success && result.logs) {
        setEmergencyLogs(result.logs);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const logEmergencyAccess = async () => {
    if (!newEmergency.action || !newEmergency.reason) {
      alert('Please provide both action and reason for emergency access');
      return;
    }

    if (!confirm('Are you sure you want to log this emergency access? This action will be permanently recorded.')) {
      return;
    }

    try {
      const resources = newEmergency.affectedResources 
        ? newEmergency.affectedResources.split(',').map(r => r.trim())
        : [];

      const result = await window.electron.invoke(
        'admin:log-emergency-access',
        newEmergency.action,
        newEmergency.severity,
        newEmergency.reason,
        resources
      ) as EmergencyActionResult;

      if (result.success) {
        alert('Emergency access logged successfully');
        setShowNewEmergencyForm(false);
        setNewEmergency({
          action: '',
          severity: 'high',
          reason: '',
          affectedResources: ''
        });
        await loadEmergencyLogs();
      }
    } catch (error) {
    }
  };

  const resolveEmergency = async (logId: string) => {
    const notes = prompt('Please provide resolution notes:');
    if (!notes) return;

    try {
      const result = await window.electron.invoke('admin:resolve-emergency', logId, notes) as EmergencyActionResult;
      if (result.success) {
        await loadEmergencyLogs();
      }
    } catch (error) {
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const emergencyProcedures = [
    {
      title: 'System Outage',
      action: 'SYSTEM_RESTART',
      severity: 'critical' as const,
      steps: [
        'Check system health status',
        'Identify failing components',
        'Initiate graceful restart',
        'Monitor recovery process'
      ]
    },
    {
      title: 'Data Breach Response',
      action: 'SECURITY_LOCKDOWN',
      severity: 'critical' as const,
      steps: [
        'Isolate affected systems',
        'Revoke compromised credentials',
        'Enable enhanced monitoring',
        'Notify security team'
      ]
    },
    {
      title: 'Database Recovery',
      action: 'DATABASE_RESTORE',
      severity: 'high' as const,
      steps: [
        'Verify backup integrity',
        'Stop write operations',
        'Initiate restore process',
        'Validate data consistency'
      ]
    },
    {
      title: 'Mass User Reset',
      action: 'USER_PASSWORD_RESET',
      severity: 'medium' as const,
      steps: [
        'Identify affected users',
        'Generate temporary passwords',
        'Send reset notifications',
        'Monitor login attempts'
      ]
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 p-4">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200">Emergency Access Panel</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              All actions performed here are permanently logged and audited. Use only in genuine emergency situations.
            </p>
          </div>
        </div>
      </Card>

      {/* Emergency Procedures */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Emergency Procedures</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emergencyProcedures.map((procedure, index) => (
            <Card key={index} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold">{procedure.title}</h4>
                <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(procedure.severity)}`}>
                  {procedure.severity}
                </span>
              </div>
              <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-4">
                {procedure.steps.map((step, i) => (
                  <li key={i}>{i + 1}. {step}</li>
                ))}
              </ol>
              <Button
                onClick={() => {
                  setNewEmergency({
                    action: procedure.action,
                    severity: procedure.severity,
                    reason: '',
                    affectedResources: ''
                  });
                  setShowNewEmergencyForm(true);
                }}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                Execute Procedure
              </Button>
            </Card>
          ))}
        </div>
      </Card>

      {/* New Emergency Form */}
      {showNewEmergencyForm && (
        <Card className="p-6 border-2 border-red-500">
          <h3 className="text-lg font-semibold mb-4">Log Emergency Access</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <input
                type="text"
                value={newEmergency.action}
                onChange={(e) => setNewEmergency({ ...newEmergency, action: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                placeholder="e.g., SYSTEM_RESTART"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select
                value={newEmergency.severity}
                onChange={(e) => setNewEmergency({ ...newEmergency, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                value={newEmergency.reason}
                onChange={(e) => setNewEmergency({ ...newEmergency, reason: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                rows={3}
                placeholder="Detailed explanation of why this emergency action is necessary..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Affected Resources (comma-separated)</label>
              <input
                type="text"
                value={newEmergency.affectedResources}
                onChange={(e) => setNewEmergency({ ...newEmergency, affectedResources: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                placeholder="e.g., user-123, project-456"
              />
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => void logEmergencyAccess()} variant="primary" className="bg-red-600 hover:bg-red-700">
                Log Emergency Access
              </Button>
              <Button onClick={() => setShowNewEmergencyForm(false)} variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Emergency History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Emergency Access History</h3>
        <div className="space-y-4">
          {emergencyLogs.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No emergency access logs found</p>
          ) : (
            emergencyLogs.map(log => (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-semibold">{log.action}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                      {log.resolvedAt && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{log.reason}</p>
                    <div className="text-xs text-gray-500">
                      <div>Created: {new Date(log.createdAt).toLocaleString()}</div>
                      {log.resolvedAt && (
                        <div>Resolved: {new Date(log.resolvedAt).toLocaleString()}</div>
                      )}
                      {log.affectedResources && log.affectedResources.length > 0 && (
                        <div>Affected: {log.affectedResources.join(', ')}</div>
                      )}
                    </div>
                    {log.resolutionNotes && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <strong>Resolution:</strong> {log.resolutionNotes}
                      </div>
                    )}
                  </div>
                  {!log.resolvedAt && (
                    <Button
                      onClick={() => resolveEmergency(log.id)}
                      variant="secondary"
                      size="sm"
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};