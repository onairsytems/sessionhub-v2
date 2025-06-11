import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface AuditLogResult {
  success: boolean;
  logs?: any[];
}

interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    targetType: '',
    startDate: '',
    endDate: '',
    limit: 100
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const result = await window.electron.invoke('admin:get-audit-logs', filters) as AuditLogResult;
      if (result.success && result.logs) {
        setLogs(result.logs);
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    loadAuditLogs();
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      targetType: '',
      startDate: '',
      endDate: '',
      limit: 100
    });
  };

  const toggleLogExpansion = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('SUSPEND')) {
      return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    }
    if (action.includes('UPDATE') || action.includes('EDIT')) {
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    }
    if (action.includes('CREATE') || action.includes('ACTIVATE')) {
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    }
    if (action.includes('EMERGENCY')) {
      return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20';
    }
    return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
  };

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Admin ID', 'Action', 'Target Type', 'Target ID', 'Details', 'IP Address'].join(','),
      ...logs.map(log => [
        new Date(log.createdAt).toISOString(),
        log.adminId,
        log.action,
        log.targetType || '',
        log.targetId || '',
        JSON.stringify(log.details || {}),
        log.ipAddress || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <input
              type="text"
              placeholder="e.g., UPDATE_USER_ROLE"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Type</label>
            <select
              value={filters.targetType}
              onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="">All Types</option>
              <option value="user">User</option>
              <option value="project">Project</option>
              <option value="session">Session</option>
              <option value="system">System</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Limit</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="datetime-local"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="datetime-local"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
          <div className="flex items-end space-x-2">
            <Button onClick={() => void applyFilters()} variant="primary" className="flex-1">
              Apply Filters
            </Button>
            <Button onClick={() => void clearFilters()} variant="secondary" className="flex-1">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Export */}
      <div className="flex justify-end">
        <Button onClick={() => void exportLogs()} variant="secondary">
          Export to CSV
        </Button>
      </div>

      {/* Log Entries */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.targetType && (
                        <div>
                          <span className="font-medium">{log.targetType}</span>
                          {log.targetId && (
                            <span className="text-gray-500 ml-1">
                              ({log.targetId.substring(0, 8)}...)
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.adminId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4">
                      {log.details && Object.keys(log.details).length > 0 && (
                        <Button
                          onClick={() => toggleLogExpansion(log.id)}
                          variant="ghost"
                          size="sm"
                        >
                          {expandedLogs.has(log.id) ? 'Hide' : 'Show'}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {expandedLogs.has(log.id) && log.details && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50 dark:bg-gray-800">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                        {log.ipAddress && (
                          <div className="mt-2 text-xs text-gray-500">
                            IP: {log.ipAddress}
                          </div>
                        )}
                        {log.userAgent && (
                          <div className="text-xs text-gray-500">
                            User Agent: {log.userAgent}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing {logs.length} audit log entries
      </div>
    </div>
  );
};