/**
 * Wrapper for ActorStatusDashboard to handle API mismatches
 */

import React, { useState, useEffect } from 'react';
import { ActorStatusDashboard } from './ActorStatusDashboard';

// interface APIStatusResponse {
//   operational: boolean;
//   message: string;
//   lastCheck: string;
// }

interface ViolationResponse {
  id: string;
  type: string;
  severity: 'critical' | 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
  actor: string;
}

interface ActivityResponse {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  details?: any;
}

export const ActorStatusDashboardWrapper: React.FC = () => {
  const [apiStatus, setApiStatus] = useState({ planning: false, execution: false });
  const [violations, setViolations] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load API status
        const statusResponse = await window.electronAPI?.getRealAPIStatus?.();
        if (statusResponse) {
          // Convert from operational status to planning/execution status
          setApiStatus({
            planning: statusResponse.operational,
            execution: statusResponse.operational
          });
        }

        // Load violations
        const violationsResponse = await window.electronAPI?.getViolations?.();
        if (violationsResponse) {
          // Convert violations to expected format
          const convertedViolations = violationsResponse.map((v: ViolationResponse) => ({
            id: v.id,
            actorType: v.actor === 'planning' ? 'planning' : 'execution',
            violationType: v.type as any,
            description: v.message,
            severity: v.severity,
            timestamp: v.timestamp,
            blocked: false
          }));
          setViolations(convertedViolations);
        }

        // Load activities
        const activitiesResponse = await window.electronAPI?.getActivities?.();
        if (activitiesResponse) {
          // Convert activities to expected format
          const convertedActivities = activitiesResponse.map((a: ActivityResponse) => ({
            actorId: a.id,
            actorType: a.actor === 'planning' ? 'planning' : 'execution',
            operation: a.action,
            timestamp: a.timestamp,
            status: 'completed' as const
          }));
          setActivities(convertedActivities);
        }
      } catch (error) {
// REMOVED: console statement
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleConfigureAPI = async () => {
    await window.electronAPI?.openAPIConfiguration?.();
  };

  const handleClearViolations = async () => {
    await window.electronAPI?.clearViolations?.();
    setViolations([]);
  };

  return (
    <ActorStatusDashboard
      apiStatus={apiStatus}
      violations={violations}
      activities={activities}
      onConfigureAPI={handleConfigureAPI}
      onClearViolations={handleClearViolations}
    />
  );
};