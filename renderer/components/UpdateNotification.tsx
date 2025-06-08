/**
 * Update Notification Component
 * Shows auto-update status and download progress
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates();

    // Listen for update events
    (window.sessionhub as any).onUpdateAvailable?.((info: any) => {
      setUpdateInfo(info);
      setUpdateAvailable(true);
      setShowNotification(true);
    });

    (window.sessionhub as any).onDownloadProgress?.((progress: any) => {
      setDownloadProgress(progress);
    });

    (window.sessionhub as any).onUpdateDownloaded?.(() => {
      setDownloading(false);
      setUpdateReady(true);
      setShowNotification(true);
    });

    return () => {
      window.sessionhub.removeAllListeners('update-available');
      window.sessionhub.removeAllListeners('download-progress');
      window.sessionhub.removeAllListeners('update-downloaded');
    };
  }, []);

  const checkForUpdates = async () => {
    try {
      const status = await (window.sessionhub as any).checkForUpdates?.();
      if (status.available && status.updateInfo) {
        setUpdateInfo(status.updateInfo);
        setUpdateAvailable(true);
        setShowNotification(true);
      }
      if (status.downloaded) {
        setUpdateReady(true);
        setShowNotification(true);
      }
    } catch (error) {
      // console.error('Failed to check for updates:', error);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setShowNotification(false);
    try {
      await (window.sessionhub as any).downloadUpdate?.();
    } catch (error) {
      // console.error('Failed to download update:', error);
      setDownloading(false);
    }
  };

  const handleInstall = () => {
    (window.sessionhub as any).installUpdate?.();
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  if (!showNotification && !downloading) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="p-4 shadow-lg">
        {updateAvailable && !downloading && !updateReady && (
          <>
            <h3 className="text-lg font-semibold mb-2">
              Update Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Version {updateInfo?.version} is now available
            </p>
            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="primary">
                Download Update
              </Button>
              <Button onClick={() => setShowNotification(false)} variant="ghost">
                Later
              </Button>
            </div>
          </>
        )}

        {downloading && downloadProgress && (
          <>
            <h3 className="text-lg font-semibold mb-2">
              Downloading Update
            </h3>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>{Math.round(downloadProgress.percent)}%</span>
                <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
              </div>
            </div>
          </>
        )}

        {updateReady && (
          <>
            <h3 className="text-lg font-semibold mb-2">
              Update Ready to Install
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              The update has been downloaded and is ready to install. 
              SessionHub will restart to apply the update.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleInstall} variant="primary">
                Restart & Install
              </Button>
              <Button onClick={() => setShowNotification(false)} variant="ghost">
                Install Later
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}