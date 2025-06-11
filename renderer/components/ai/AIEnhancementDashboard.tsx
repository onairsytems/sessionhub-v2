/**
 * AI Enhancement Dashboard Component
 * Session 2.8 Implementation
 */
import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorBoundary } from '../../../components/ui/ErrorBoundary';

// Type guard for AI API
interface AIAPI {
  initialize: () => Promise<any>;
  getMetricsSummary: (days: number) => Promise<any>;
  generateInsights: () => Promise<any>;
  analyzeProject: (path: string) => Promise<any>;
  exportData: () => Promise<string>;
}

const hasAIAPI = (api: unknown): api is { ai: AIAPI } => {
  return Boolean(api && typeof (api as any).ai === 'object');
};
interface LearningStatus {
  patternsLearned: number;
  projectsAnalyzed: number;
  stylesIdentified: number;
  successRate: number;
  lastUpdate: Date;
}
interface MetricsSummary {
  totalSessions: number;
  successfulSessions: number;
  averageDuration: number;
  qualityGatePassRate: {
    typescript: number;
    eslint: number;
    tests: number;
    build: number;
  };
}
interface Insight {
  type: 'success' | 'warning' | 'improvement';
  title: string;
  description: string;
  recommendation?: string;
}
export const AIEnhancementDashboard: React.FC = () => {
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'insights'>('overview');
  useEffect(() => {
    void initializeAI();
  }, []);
  const initializeAI = async () => {
    try {
      setLoading(true);
      if (hasAIAPI(window.api)) {
        const aiStatus = await window.api.ai.initialize();
        setStatus(aiStatus);
      }
      // Load initial data
      await Promise.all([
        loadMetrics(),
        loadInsights()
      ]);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  const loadMetrics = async () => {
    try {
      if (hasAIAPI(window.api)) {
        const summary = await window.api.ai.getMetricsSummary(30);
        setMetrics(summary);
      }
    } catch (error) {
    }
  };
  const loadInsights = async () => {
    try {
      if (hasAIAPI(window.api)) {
        const report = await window.api.ai.generateInsights();
        if (report?.insights) {
          setInsights(report.insights);
        }
      }
    } catch (error) {
    }
  };
  const handleAnalyzeProject = async () => {
    try {
      const projectPath = await (window.api as any)?.selectDirectory?.();
      if (projectPath && hasAIAPI(window.api)) {
        setLoading(true);
        const analysis = await window.api.ai.analyzeProject(projectPath);
        // Refresh data after analysis
        await initializeAI();
        // Show analysis results
        alert(`Project analyzed: ${analysis.template.detectedType} with ${analysis.recommendations.length} recommendations`);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  const handleExportData = async () => {
    try {
      if (!hasAIAPI(window.api)) {
        throw new Error('AI API not available');
      }
      const data = await window.api.ai.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-learning-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }
  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Enhancement & Learning</h1>
          <div className="space-x-2">
            <Button onClick={() => void handleAnalyzeProject()} variant="secondary">
              Analyze Project
            </Button>
            <Button onClick={() => void handleExportData()} variant="secondary">
              Export Data
            </Button>
          </div>
        </div>
        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-4 ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('patterns')}
            className={`pb-2 px-4 ${
              activeTab === 'patterns'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600'
            }`}
          >
            Patterns & Metrics
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`pb-2 px-4 ${
              activeTab === 'insights'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600'
            }`}
          >
            Insights
          </button>
        </div>
        {/* Tab Content */}
        {activeTab === 'overview' && status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Patterns Learned</h3>
              <p className="text-2xl font-bold mt-2">{status.patternsLearned}</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Projects Analyzed</h3>
              <p className="text-2xl font-bold mt-2">{status.projectsAnalyzed}</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Styles Identified</h3>
              <p className="text-2xl font-bold mt-2">{status.stylesIdentified}</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
              <p className="text-2xl font-bold mt-2">
                {(status.successRate * 100).toFixed(1)}%
              </p>
            </Card>
          </div>
        )}
        {activeTab === 'patterns' && metrics && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Session Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Sessions</p>
                  <p className="text-xl font-semibold">{metrics.totalSessions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Successful</p>
                  <p className="text-xl font-semibold text-green-600">
                    {metrics.successfulSessions}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Duration</p>
                  <p className="text-xl font-semibold">
                    {(metrics.averageDuration / 1000 / 60).toFixed(1)} min
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Quality Gate Performance</h2>
              <div className="space-y-3">
                {Object.entries(metrics.qualityGatePassRate).map(([gate, rate]) => (
                  <div key={gate} className="flex items-center justify-between">
                    <span className="capitalize">{gate}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            rate > 0.8 ? 'bg-green-500' : rate > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${rate * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {(rate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {insights.length === 0 ? (
              <Card className="p-6 text-center text-gray-500">
                No insights available yet. Analyze more projects to generate insights.
              </Card>
            ) : (
              insights.map((insight, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        insight.type === 'success'
                          ? 'bg-green-100 text-green-600'
                          : insight.type === 'warning'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {insight.type === 'success' ? '✓' : insight.type === 'warning' ? '!' : '↑'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{insight.title}</h3>
                      <p className="text-gray-600 mt-1">{insight.description}</p>
                      {insight.recommendation && (
                        <p className="text-sm text-blue-600 mt-2">
                          💡 {insight.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};