/**
 * @actor user
 * @responsibility Recovery wizard UI for guiding users through data restoration
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Database, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';

interface RecoveryPoint {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'checkpoint';
  description: string;
  sessionId?: string;
  projectId?: string;
  size: number;
  healthy: boolean;
  checksumValid: boolean;
}

interface CorruptionReport {
  fileCount: number;
  corruptedFiles: string[];
  repairableFiles: string[];
  unreparableFiles: string[];
  recommendedAction: 'auto-repair' | 'manual-recovery' | 'restore-previous';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface RecoveryResult {
  success: boolean;
  timestamp: Date;
  errors: string[];
  warnings: string[];
  metadata: {
    recoveryDuration: number;
    dataIntegrityScore: number;
    repairsAttempted: number;
    repairsSuccessful: number;
  };
}

type RecoveryStep = 'detection' | 'selection' | 'options' | 'recovery' | 'complete';

export const RecoveryWizard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<RecoveryStep>('detection');
  const [_isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Recovery data
  const [corruptionReport, setCorruptionReport] = useState<CorruptionReport | null>(null);
  const [recoveryPoints, setRecoveryPoints] = useState<RecoveryPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<RecoveryPoint | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null);
  
  // Recovery options
  const [skipCorrupted, setSkipCorrupted] = useState(false);
  const [attemptAutoRepair, setAttemptAutoRepair] = useState(true);
  const [mergePartialSaves, setMergePartialSaves] = useState(true);

  useEffect(() => {
    // Check for corruption on component mount
    checkForCorruption();
  }, []);

  const checkForCorruption = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const report = await window.electron.recovery.detectCorruption();
      setCorruptionReport(report);
      
      if (report.corruptedFiles.length > 0) {
        setIsOpen(true);
      }
    } catch (err) {
      setError('Failed to check for corruption');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecoveryPoints = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const points = await window.electron.recovery.getRecoveryPoints();
      setRecoveryPoints(points.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      setCurrentStep('selection');
    } catch (err) {
      setError('Failed to load recovery points');
    } finally {
      setIsLoading(false);
    }
  };

  const performRecovery = async () => {
    if (!selectedPoint) return;
    
    setIsLoading(true);
    setError(null);
    setCurrentStep('recovery');
    
    try {
      const result = await window.electron.recovery.recoverToPoint({
        targetTimestamp: selectedPoint.timestamp,
        sessionId: selectedPoint.sessionId,
        projectId: selectedPoint.projectId,
        skipCorrupted,
        attemptAutoRepair,
        mergePartialSaves
      });
      
      setRecoveryResult(result);
      setCurrentStep('complete');
    } catch (err) {
      setError('Recovery failed: ' + (err as Error).message);
      setCurrentStep('options');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const renderDetectionStep = () => {
    if (!corruptionReport) {
      return (
        <div className="text-center py-8">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Checking system integrity...</p>
        </div>
      );
    }

    const hasCorruption = corruptionReport.corruptedFiles.length > 0;

    return (
      <div className="space-y-6">
        <div className="text-center">
          {hasCorruption ? (
            <>
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Data Integrity Issues Detected</h3>
              <p className="text-gray-600">
                We've detected some issues with your backup files that need attention.
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">System Healthy</h3>
              <p className="text-gray-600">
                All backup files are intact and no corruption was detected.
              </p>
            </>
          )}
        </div>

        {hasCorruption && (
          <>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Severity:</span>
                  <Badge className={getSeverityColor(corruptionReport.severity)}>
                    {corruptionReport.severity.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Files:</span>
                  <span>{corruptionReport.fileCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Corrupted:</span>
                  <span className="text-red-600">{corruptionReport.corruptedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Repairable:</span>
                  <span className="text-yellow-600">{corruptionReport.repairableFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Unrepairable:</span>
                  <span className="text-red-600">{corruptionReport.unreparableFiles.length}</span>
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Recommended Action</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {corruptionReport.recommendedAction === 'auto-repair' && 
                      'Automatic repair can fix the detected issues.'}
                    {corruptionReport.recommendedAction === 'manual-recovery' && 
                      'Manual recovery is recommended to restore your data.'}
                    {corruptionReport.recommendedAction === 'restore-previous' && 
                      'Restore from a previous backup point is recommended.'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {hasCorruption && (
            <Button onClick={loadRecoveryPoints}>
              Continue to Recovery
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSelectionStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Recovery Point</h3>
        <p className="text-gray-600">
          Choose a backup point to restore your data from. Newer backups are shown first.
        </p>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {recoveryPoints.map((point) => (
          <div
            key={point.id}
            className={`p-4 cursor-pointer transition-all rounded-lg border ${
              selectedPoint?.id === point.id
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedPoint(point)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <Database className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{point.description}</span>
                  {!point.healthy && (
                    <Badge variant="destructive" size="sm">Corrupted</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDistanceToNow(new Date(point.timestamp), { addSuffix: true })}
                  </span>
                  <span>{(point.size / 1024).toFixed(1)} KB</span>
                  <Badge size="sm">{point.type}</Badge>
                </div>
              </div>
              <div className="ml-4">
                {point.healthy ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('detection')}>
          Back
        </Button>
        <Button 
          onClick={() => setCurrentStep('options')}
          disabled={!selectedPoint}
        >
          Configure Options
        </Button>
      </div>
    </div>
  );

  const renderOptionsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Recovery Options</h3>
        <p className="text-gray-600">
          Configure how the recovery process should handle various scenarios.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={skipCorrupted}
            onChange={(e) => setSkipCorrupted(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <div>
            <p className="font-medium">Skip Corrupted Files</p>
            <p className="text-sm text-gray-600">
              Continue recovery even if some files are corrupted
            </p>
          </div>
        </label>

        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={attemptAutoRepair}
            onChange={(e) => setAttemptAutoRepair(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <div>
            <p className="font-medium">Attempt Auto-Repair</p>
            <p className="text-sm text-gray-600">
              Try to automatically fix corrupted files before recovery
            </p>
          </div>
        </label>

        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={mergePartialSaves}
            onChange={(e) => setMergePartialSaves(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <div>
            <p className="font-medium">Merge Partial Saves</p>
            <p className="text-sm text-gray-600">
              Combine partial saves from unexpected shutdowns
            </p>
          </div>
        </label>
      </div>

      {selectedPoint && !selectedPoint.healthy && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Warning</p>
              <p className="text-sm text-yellow-700 mt-1">
                The selected recovery point has integrity issues. Enabling auto-repair is recommended.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('selection')}>
          Back
        </Button>
        <Button onClick={performRecovery}>
          Start Recovery
        </Button>
      </div>
    </div>
  );

  const renderRecoveryStep = () => (
    <div className="text-center py-8">
      <RefreshCw className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
      <h3 className="text-xl font-semibold mb-2">Recovery in Progress</h3>
      <p className="text-gray-600">
        Please wait while we restore your data. This may take a few moments.
      </p>
      <div className="mt-6">
        <LoadingSpinner size="sm" />
      </div>
    </div>
  );

  const renderCompleteStep = () => {
    if (!recoveryResult) return null;

    return (
      <div className="space-y-6">
        <div className="text-center">
          {recoveryResult.success ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Recovery Complete</h3>
              <p className="text-gray-600">
                Your data has been successfully restored.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Recovery Failed</h3>
              <p className="text-gray-600">
                We encountered issues during the recovery process.
              </p>
            </>
          )}
        </div>

        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-medium">Recovery Duration:</span>
              <span>{recoveryResult.metadata.recoveryDuration}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Data Integrity Score:</span>
              <span className={
                recoveryResult.metadata.dataIntegrityScore >= 80 
                  ? 'text-green-600' 
                  : 'text-yellow-600'
              }>
                {recoveryResult.metadata.dataIntegrityScore}%
              </span>
            </div>
            {recoveryResult.metadata.repairsAttempted > 0 && (
              <div className="flex justify-between">
                <span className="font-medium">Repairs:</span>
                <span>
                  {recoveryResult.metadata.repairsSuccessful} / {recoveryResult.metadata.repairsAttempted} successful
                </span>
              </div>
            )}
          </div>
        </Card>

        {recoveryResult.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">Warnings</h4>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              {recoveryResult.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {recoveryResult.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">Errors</h4>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {recoveryResult.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => {
            setIsOpen(false);
            window.location.reload();
          }}>
            Close and Reload
          </Button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'detection':
        return renderDetectionStep();
      case 'selection':
        return renderSelectionStep();
      case 'options':
        return renderOptionsStep();
      case 'recovery':
        return renderRecoveryStep();
      case 'complete':
        return renderCompleteStep();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Recovery Wizard</h2>
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {renderStep()}
        </div>
      </div>
    </div>
  );
};