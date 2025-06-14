
'use client';

import { useState, useEffect, Suspense, lazy } from 'react';

// Lazy load the SessionWorkflow component
const SessionWorkflow = lazy(() => import('../renderer/components/SessionWorkflow'));

export default function Home() {
  const [hasElectronAPI, setHasElectronAPI] = useState(false);

  useEffect(() => {
    // Check if we're in Electron context
    if (typeof window !== 'undefined' && window.electronAPI) {
      setHasElectronAPI(true);
    }
  }, []);

  if (!hasElectronAPI) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">SessionHub</h1>
          <div className="bg-card rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-4">Session Error</h2>
            <p className="text-muted-foreground mb-4">
              The Electron API is not available. This usually means:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>The app is running in a web browser instead of Electron</li>
              <li>The preload script didn&apos;t load correctly</li>
              <li>There&apos;s an error in the IPC configuration</li>
            </ul>
            <p className="mt-6 text-sm">
              Check the console for more details. The build appears to be working, but the Electron integration needs to be fixed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If we have Electron API, load the actual workflow
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading SessionHub...</p>
        </div>
      </div>
    }>
      <SessionWorkflow />
    </Suspense>
  );
}