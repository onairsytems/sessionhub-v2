import React, { useState, useEffect } from 'react';
import { BaseProjectContext, WebAppContext, APIContext, ElectronContext, MLContext } from '@/src/models/ProjectContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ProjectContextViewerProps {
  projectId: string;
  context?: BaseProjectContext;
  onRefresh?: () => void;
}

export const ProjectContextViewer: React.FC<ProjectContextViewerProps> = ({ 
  projectId, 
  context: initialContext,
  onRefresh 
}) => {
  const [context, setContext] = useState<BaseProjectContext | null>(initialContext || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  useEffect(() => {
    if (!initialContext && projectId) {
      loadContext();
    }
  }, [projectId]);

  const loadContext = async () => {
    setLoading(true);
    setError(null);
    try {
      // Mock data for now
      const result: { success: boolean; error?: string; data?: any } = { success: false, error: 'API not available' };
      if (result.success && result.data) {
        setContext(result.data);
      } else {
        setError(result.error || 'Failed to load context');
      }
    } catch (err) {
      setError('Error loading project context');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Mock API call
      // await window.api.analyzeProjectContext(projectId);
      await loadContext();
      onRefresh?.();
    } catch (err) {
      setError('Error refreshing context');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={loadContext} size="sm">Retry</Button>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="p-4">
        <p className="text-gray-500 mb-4">No context available</p>
        <Button onClick={handleRefresh} size="sm">Analyze Project</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Project Context</h2>
        <Button onClick={handleRefresh} size="sm" variant="secondary" disabled={loading}>
          Refresh Context
        </Button>
      </div>

      {/* Overview Section */}
      <ContextSection
        title="Overview"
        id="overview"
        expanded={expandedSections.has('overview')}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Project Type</label>
            <p className="font-medium">{context.projectType.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Primary Language</label>
            <p className="font-medium">{context.language}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Last Analyzed</label>
            <p className="font-medium">{new Date(context.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Version</label>
            <p className="font-medium">{context.version}</p>
          </div>
        </div>
        {context.summary && (
          <div className="mt-4">
            <label className="text-sm text-gray-500">Summary</label>
            <p className="mt-1">{context.summary}</p>
          </div>
        )}
      </ContextSection>

      {/* Frameworks Section */}
      <ContextSection
        title="Frameworks & Libraries"
        id="frameworks"
        expanded={expandedSections.has('frameworks')}
        onToggle={() => toggleSection('frameworks')}
      >
        <div className="space-y-4">
          {context.frameworks.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Frameworks</h4>
              <div className="space-y-2">
                {context.frameworks.map((framework, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{framework.name}</span>
                      {framework.version && (
                        <span className="ml-2 text-sm text-gray-500">v{framework.version}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{framework.category}</span>
                      <ConfidenceIndicator confidence={framework.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {context.libraries.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Key Libraries</h4>
              <div className="flex flex-wrap gap-2">
                {context.libraries.slice(0, 10).map((lib, idx) => (
                  <div key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                    {lib.name}
                  </div>
                ))}
                {context.libraries.length > 10 && (
                  <div className="px-2 py-1 text-gray-500 text-sm">
                    +{context.libraries.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ContextSection>

      {/* Architecture Section */}
      <ContextSection
        title="Architecture"
        id="architecture"
        expanded={expandedSections.has('architecture')}
        onToggle={() => toggleSection('architecture')}
      >
        <div className="space-y-3">
          {context.architecturePatterns.map((pattern, idx) => (
            <div key={idx} className="border-l-4 border-blue-500 pl-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{pattern.pattern}</h4>
                  {pattern.description && (
                    <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
                  )}
                </div>
                <ConfidenceIndicator confidence={pattern.confidence} />
              </div>
              {pattern.locations && pattern.locations.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Found in:</p>
                  <div className="text-xs text-gray-700 mt-1">
                    {pattern.locations.slice(0, 3).join(', ')}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ContextSection>

      {/* Project-specific sections */}
      {renderProjectSpecificSections(context, expandedSections, toggleSection)}

      {/* Quality Metrics Section */}
      {context.metrics && (
        <ContextSection
          title="Quality Metrics"
          id="metrics"
          expanded={expandedSections.has('metrics')}
          onToggle={() => toggleSection('metrics')}
        >
          <div className="grid grid-cols-2 gap-4">
            {context.metrics.codeComplexity && (
              <MetricCard
                label="Code Complexity"
                value={context.metrics.codeComplexity}
                type="number"
              />
            )}
            {context.metrics.testCoverage && (
              <MetricCard
                label="Test Coverage"
                value={`${context.metrics.testCoverage}%`}
                type="percentage"
              />
            )}
            {(context.metrics as any).technicalDebt && (
              <MetricCard
                label="Technical Debt"
                value={(context.metrics as any).technicalDebt}
                type="rating"
              />
            )}
            {context.metrics.performanceScore && (
              <MetricCard
                label="Performance Score"
                value={context.metrics.performanceScore}
                type="score"
              />
            )}
          </div>
        </ContextSection>
      )}
    </div>
  );
};

// Helper Components

interface ContextSectionProps {
  title: string;
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const ContextSection: React.FC<ContextSectionProps> = ({
  title,
  // id,
  expanded,
  onToggle,
  children
}) => {
  return (
    <Card className="p-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={onToggle}
      >
        <h3 className="text-lg font-medium">{title}</h3>
        <svg
          className={`w-5 h-5 transform transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
      {expanded && <div className="mt-4">{children}</div>}
    </Card>
  );
};

const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  const color = confidence > 0.8 ? 'green' : confidence > 0.5 ? 'yellow' : 'red';
  
  return (
    <div className="flex items-center space-x-1">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string | number;
  type: 'number' | 'percentage' | 'rating' | 'score';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, type }) => {
  const getColor = () => {
    if (type === 'percentage' || type === 'score') {
      const num = typeof value === 'string' ? parseInt(value) : value;
      if (num >= 80) return 'text-green-600';
      if (num >= 60) return 'text-yellow-600';
      return 'text-red-600';
    }
    if (type === 'rating') {
      if (value === 'low') return 'text-green-600';
      if (value === 'medium') return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-gray-900';
  };

  return (
    <div className="bg-gray-50 p-3 rounded">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${getColor()}`}>{value}</p>
    </div>
  );
};

// Render project-specific sections based on type
function renderProjectSpecificSections(
  context: BaseProjectContext,
  expandedSections: Set<string>,
  toggleSection: (section: string) => void
) {
  switch (context.projectType) {
    case 'web_app':
    case 'nextjs':
    case 'react':
      return renderWebAppSections(context as WebAppContext, expandedSections, toggleSection);
    case 'api':
    case 'microservice':
      return renderAPISections(context as APIContext, expandedSections, toggleSection);
    case 'electron':
      return renderElectronSections(context as ElectronContext, expandedSections, toggleSection);
    case 'machine_learning':
      return renderMLSections(context as MLContext, expandedSections, toggleSection);
    default:
      return null;
  }
}

function renderWebAppSections(
  context: WebAppContext,
  expandedSections: Set<string>,
  toggleSection: (section: string) => void
) {
  return (
    <ContextSection
      title="Web Application Details"
      id="webapp"
      expanded={expandedSections.has('webapp')}
      onToggle={() => toggleSection('webapp')}
    >
      <div className="space-y-3">
        {context.webFramework && (
          <div>
            <label className="text-sm text-gray-500">Web Framework</label>
            <p className="font-medium">{context.webFramework}</p>
          </div>
        )}
        {context.cssFramework && (
          <div>
            <label className="text-sm text-gray-500">CSS Framework</label>
            <p className="font-medium">{context.cssFramework}</p>
          </div>
        )}
        {context.stateManagement && (
          <div>
            <label className="text-sm text-gray-500">State Management</label>
            <p className="font-medium">{context.stateManagement}</p>
          </div>
        )}
        {context.apiIntegration && (
          <div>
            <label className="text-sm text-gray-500">API Integration</label>
            <p className="font-medium">
              {context.apiIntegration.type}
              {context.apiIntegration.client && ` (${context.apiIntegration.client})`}
            </p>
          </div>
        )}
      </div>
    </ContextSection>
  );
}

function renderAPISections(
  context: APIContext,
  expandedSections: Set<string>,
  toggleSection: (section: string) => void
) {
  return (
    <ContextSection
      title="API Details"
      id="api"
      expanded={expandedSections.has('api')}
      onToggle={() => toggleSection('api')}
    >
      <div className="space-y-3">
        {context.apiFramework && (
          <div>
            <label className="text-sm text-gray-500">API Framework</label>
            <p className="font-medium">{context.apiFramework}</p>
          </div>
        )}
        {context.apiProtocol && (
          <div>
            <label className="text-sm text-gray-500">Protocol</label>
            <p className="font-medium">{context.apiProtocol.toUpperCase()}</p>
          </div>
        )}
        {context.databases && context.databases.length > 0 && (
          <div>
            <label className="text-sm text-gray-500">Databases</label>
            <div className="mt-1 space-y-1">
              {context.databases.map((db, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium">{db.type}</span>
                  {db.orm && <span className="text-gray-500"> (ORM: {db.orm})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {context.authentication && (
          <div>
            <label className="text-sm text-gray-500">Authentication</label>
            <p className="font-medium">
              {context.authentication.type}
              {context.authentication.provider && ` (${context.authentication.provider})`}
            </p>
          </div>
        )}
      </div>
    </ContextSection>
  );
}

function renderElectronSections(
  context: ElectronContext,
  expandedSections: Set<string>,
  toggleSection: (section: string) => void
) {
  return (
    <ContextSection
      title="Electron Details"
      id="electron"
      expanded={expandedSections.has('electron')}
      onToggle={() => toggleSection('electron')}
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-500">Electron Version</label>
          <p className="font-medium">{context.electronVersion}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500">Security</label>
          <div className="mt-1 space-y-1 text-sm">
            <p>
              Node Integration: {' '}
              <span className={context.nodeIntegration ? 'text-red-600' : 'text-green-600'}>
                {context.nodeIntegration ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p>
              Context Isolation: {' '}
              <span className={context.contextIsolation ? 'text-green-600' : 'text-red-600'}>
                {context.contextIsolation ? 'Enabled' : 'Disabled'}
              </span>
            </p>
          </div>
        </div>
        {context.platformFeatures && (
          <div>
            <label className="text-sm text-gray-500">Platform Features</label>
            <div className="mt-1 space-y-1 text-sm">
              <p>Auto Updater: {context.platformFeatures.autoUpdater ? 'Yes' : 'No'}</p>
              {context.platformFeatures.nativeModules.length > 0 && (
                <p>Native Modules: {context.platformFeatures.nativeModules.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </ContextSection>
  );
}

function renderMLSections(
  context: MLContext,
  expandedSections: Set<string>,
  toggleSection: (section: string) => void
) {
  return (
    <ContextSection
      title="Machine Learning Details"
      id="ml"
      expanded={expandedSections.has('ml')}
      onToggle={() => toggleSection('ml')}
    >
      <div className="space-y-3">
        {context.mlFramework && (
          <div>
            <label className="text-sm text-gray-500">ML Framework</label>
            <p className="font-medium">{context.mlFramework}</p>
          </div>
        )}
        {context.mlType && (
          <div>
            <label className="text-sm text-gray-500">ML Type</label>
            <p className="font-medium">{context.mlType}</p>
          </div>
        )}
        {context.models && context.models.length > 0 && (
          <div>
            <label className="text-sm text-gray-500">Models</label>
            <div className="mt-1 space-y-1">
              {context.models.map((model, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-medium">{model.name}</span>
                  <span className="text-gray-500"> ({model.format})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ContextSection>
  );
}