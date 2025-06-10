'use client';

import React, { useState } from 'react';
import { ZedConnectionWizard } from '../renderer/components/ide/ZedConnectionWizard';
import { ZedConnectionStatus } from '../renderer/components/ide/ZedConnectionStatus';
import { ZedProjectSwitcher } from '../renderer/components/ide/ZedProjectSwitcher';
import { ZedTwoActorSync } from '../renderer/components/ide/ZedTwoActorSync';
import { Button } from '../renderer/components/ui/Button';
import { Card } from '../renderer/components/ui/Card';

export default function ZedIntegrationPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleWizardComplete = () => {
    setShowWizard(false);
    setIsConnected(true);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Zed IDE Integration
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Lightning-fast development with SessionHub's Two-Actor Model and Zed's native performance
        </p>
      </div>

      {showWizard ? (
        <ZedConnectionWizard
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      ) : (
        <div className="space-y-6">
          {/* Connection Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Integration Overview
                  </h2>
                  {!isConnected && (
                    <Button onClick={() => setShowWizard(true)}>
                      Connect to Zed
                    </Button>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FeatureCard
                      icon="⚡"
                      title="Sub-2s Launch"
                      description="Open projects instantly with full workspace restoration"
                    />
                    <FeatureCard
                      icon="🤖"
                      title="Agent Panel Integration"
                      description="Execution Actor operates through Zed's MCP agent panel"
                    />
                    <FeatureCard
                      icon="🔄"
                      title="Real-time Sync"
                      description="Bidirectional file sync with sub-100ms latency"
                    />
                    <FeatureCard
                      icon="🛡️"
                      title="Quality Gates"
                      description="TypeScript and ESLint validation through LSP"
                    />
                  </div>
                </div>
              </Card>
            </div>
            
            <div>
              <ZedConnectionStatus />
            </div>
          </div>

          {/* Two-Actor Sync Section */}
          <ZedTwoActorSync />

          {/* Project Switcher Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ZedProjectSwitcher />
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Zed Workspace Features
              </h3>
              <ul className="space-y-3">
                <WorkspaceFeature
                  title="GPU Acceleration"
                  description="Native performance with Metal/Vulkan rendering"
                />
                <WorkspaceFeature
                  title="Collaborative Editing"
                  description="Real-time collaboration with team members"
                />
                <WorkspaceFeature
                  title="Language Servers"
                  description="Full LSP support for all major languages"
                />
                <WorkspaceFeature
                  title="Git Integration"
                  description="Native git support with visual diff tools"
                />
              </ul>
            </Card>
          </div>

          {/* Performance Metrics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance Benchmarks
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <MetricCard label="Workspace Open" value="<2s" />
              <MetricCard label="File Sync Latency" value="<100ms" />
              <MetricCard label="Memory Usage" value="<150MB" />
              <MetricCard label="CPU Usage" value="<5%" />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const FeatureCard: React.FC<{ icon: string; title: string; description: string }> = ({
  icon,
  title,
  description
}) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
    <div className="flex items-start space-x-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
  </div>
);

const WorkspaceFeature: React.FC<{ title: string; description: string }> = ({
  title,
  description
}) => (
  <li className="flex items-start">
    <svg
      className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
    <div>
      <p className="font-medium text-gray-900 dark:text-white">{title}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  </li>
);

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{value}</p>
    <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
  </div>
);