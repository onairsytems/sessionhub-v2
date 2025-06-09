import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface FigmaIntegrationPanelProps {
  mode: 'self-improvement' | 'project-enhancement';
  projectId?: string;
}

interface UIUpdateStatus {
  sessionId?: string;
  status: string;
  changes?: any;
  previewUrl?: string;
  error?: string;
}

export const FigmaIntegrationPanel: React.FC<FigmaIntegrationPanelProps> = ({ mode, projectId }) => {
  const [figmaFileKey, setFigmaFileKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UIUpdateStatus>({
    status: 'idle'
  });
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    checkFigmaConnection();
  }, []);

  const checkFigmaConnection = async () => {
    try {
      const connected = await window.electron.figma.checkConnection();
      setIsConnected(connected);
    } catch (error) {
      // Failed to check Figma connection
    }
  };

  const connectFigma = async () => {
    try {
      const apiKey = await window.electron.figma.getApiKey();
      if (apiKey) {
        await window.electron.figma.initialize(apiKey);
        setIsConnected(true);
      }
    } catch (error) {
      // Failed to connect Figma
    }
  };

  const startUIUpdate = async () => {
    if (!figmaFileKey) {
      alert('Please enter a Figma file key');
      return;
    }

    setUpdateStatus({ status: 'starting' });

    try {
      if (mode === 'self-improvement') {
        const sessionId = await window.electron.figma.startSessionHubUIUpdate(figmaFileKey);
        setUpdateStatus({ sessionId, status: 'running' });
        
        // Poll for status
        pollUpdateStatus(sessionId);
      } else if (mode === 'project-enhancement' && projectId) {
        const sessionId = await window.electron.figma.startProjectUIUpdate(projectId, figmaFileKey);
        setUpdateStatus({ sessionId, status: 'running' });
        
        // Poll for status
        pollEnhancementStatus(sessionId);
      }
    } catch (error) {
      setUpdateStatus({ 
        status: 'failed', 
        error: (error as Error).message 
      });
    }
  };

  const pollUpdateStatus = async (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await window.electron.figma.getUpdateStatus(sessionId);
        
        setUpdateStatus({
          sessionId,
          status: status.status,
          changes: status.changes,
          error: status.error
        });

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        clearInterval(interval);
        // Failed to poll status
      }
    }, 2000);
  };

  const pollEnhancementStatus = async (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await window.electron.figma.getEnhancementStatus(sessionId);
        
        setUpdateStatus({
          sessionId,
          status: status.status,
          changes: status.changes,
          previewUrl: status.deploymentUrl,
          error: status.error
        });

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        clearInterval(interval);
        // Failed to poll status
      }
    }, 2000);
  };

  const previewChanges = async () => {
    if (!figmaFileKey) return;

    try {
      const previewData = await window.electron.figma.previewUIChanges(figmaFileKey);
      setPreview(previewData);
    } catch (error) {
      // Failed to preview changes
    }
  };

  const applyChanges = async () => {
    if (!updateStatus.sessionId) return;

    try {
      await window.electron.figma.applyUIChanges(updateStatus.sessionId);
      alert('UI changes applied successfully!');
    } catch (error) {
      alert('Failed to apply changes: ' + (error as Error).message);
    }
  };

  const createPullRequest = async () => {
    if (!figmaFileKey) return;

    try {
      const prUrl = await window.electron.figma.createUIPullRequest(
        figmaFileKey,
        'UI updates from Figma design'
      );
      window.open(prUrl, '_blank');
    } catch (error) {
      alert('Failed to create PR: ' + (error as Error).message);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Figma MCP Integration - {mode === 'self-improvement' ? 'SessionHub UI' : 'Project UI'}
      </h2>

      {!isConnected ? (
        <div className="mb-6">
          <p className="text-gray-600 mb-4">Connect to Figma to start syncing designs</p>
          <Button onClick={connectFigma}>Connect Figma</Button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Figma File Key
            </label>
            <input
              type="text"
              value={figmaFileKey}
              onChange={(e) => setFigmaFileKey(e.target.value)}
              placeholder="Enter Figma file key or URL"
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-500 mt-1">
              You can find this in your Figma file URL
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button 
              onClick={startUIUpdate}
              disabled={!figmaFileKey || updateStatus.status === 'running'}
            >
              {updateStatus.status === 'running' ? 'Updating...' : 'Start UI Update'}
            </Button>
            
            <Button 
              onClick={previewChanges}
              variant="secondary"
              disabled={!figmaFileKey}
            >
              Preview Changes
            </Button>

            {mode === 'self-improvement' && (
              <Button 
                onClick={createPullRequest}
                variant="secondary"
                disabled={!figmaFileKey}
              >
                Create PR
              </Button>
            )}
          </div>

          {/* Status Display */}
          {updateStatus.status !== 'idle' && (
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Update Status</h3>
              <p className="text-sm">
                Status: <span className="font-medium">{updateStatus.status}</span>
              </p>
              {updateStatus.sessionId && (
                <p className="text-sm">
                  Session: <span className="font-mono text-xs">{updateStatus.sessionId}</span>
                </p>
              )}
              {updateStatus.previewUrl && (
                <p className="text-sm">
                  Preview: <a href={updateStatus.previewUrl} target="_blank" className="text-blue-600 hover:underline">
                    {updateStatus.previewUrl}
                  </a>
                </p>
              )}
              {updateStatus.error && (
                <p className="text-sm text-red-600">
                  Error: {updateStatus.error}
                </p>
              )}
            </div>
          )}

          {/* Preview Display */}
          {preview && (
            <div className="mb-6 p-4 bg-blue-50 rounded">
              <h3 className="font-semibold mb-2">Preview</h3>
              <p className="text-sm mb-2">{preview.summary}</p>
              <p className="text-sm">Files affected: {preview.filesAffected}</p>
              <div className="mt-2">
                <h4 className="text-sm font-medium">Components:</h4>
                <ul className="text-sm list-disc list-inside">
                  {preview.components.map((comp: any, idx: number) => (
                    <li key={idx}>
                      {comp.path} ({comp.action})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Apply Changes Button */}
          {updateStatus.status === 'completed' && updateStatus.changes && (
            <div className="mt-4">
              <Button 
                onClick={applyChanges}
                variant="primary"
              >
                Apply Changes to {mode === 'self-improvement' ? 'SessionHub' : 'Project'}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
};