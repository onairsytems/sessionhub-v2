import React, { useState, useEffect } from 'react';
import { BaseProjectContext } from '@/src/models/ProjectContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ProjectContextComparisonProps {
  projectIds: string[];
  onClose?: () => void;
}

export const ProjectContextComparison: React.FC<ProjectContextComparisonProps> = ({
  projectIds,
  onClose
}) => {
  const [contexts, setContexts] = useState<Map<string, BaseProjectContext>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContexts();
  }, [projectIds]);

  const loadContexts = async () => {
    setLoading(true);
    setError(null);
    try {
      const contextMap = new Map<string, BaseProjectContext>();
      
      // Mock data for development
      setError('API not available');
      
      setContexts(contextMap);
    } catch (err) {
      setError('Failed to load contexts for comparison');
    } finally {
      setLoading(false);
    }
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
        <div className="text-red-500">{error}</div>
      </Card>
    );
  }

  const contextArray = Array.from(contexts.values());
  if (contextArray.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-gray-500">No contexts available for comparison</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Project Context Comparison</h2>
        {onClose && (
          <Button onClick={onClose} size="sm" variant="secondary">
            Close
          </Button>
        )}
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attribute
              </th>
              {contextArray.map((context) => (
                <th
                  key={context.projectId}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {context.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Basic Information */}
            <ComparisonRow
              label="Project Type"
              values={contextArray.map(c => c.projectType.replace(/_/g, ' '))}
            />
            <ComparisonRow
              label="Language"
              values={contextArray.map(c => c.language)}
            />
            <ComparisonRow
              label="Version"
              values={contextArray.map(c => c.version)}
            />
            
            {/* Frameworks */}
            <ComparisonRow
              label="Main Framework"
              values={contextArray.map(c => 
                c.frameworks && c.frameworks.length > 0 && c.frameworks[0] ? c.frameworks[0].name : 'None'
              )}
            />
            
            {/* Architecture */}
            <ComparisonRow
              label="Architecture"
              values={contextArray.map(c => 
                c.architecturePatterns && c.architecturePatterns.length > 0 && c.architecturePatterns[0]
                  ? c.architecturePatterns[0].pattern 
                  : 'Not detected'
              )}
            />
            
            {/* Testing */}
            <ComparisonRow
              label="Testing"
              values={contextArray.map(c => 
                c.testingFrameworks.length > 0 
                  ? c.testingFrameworks.map(t => t.name).join(', ')
                  : 'None'
              )}
            />
            
            {/* Metrics */}
            {contextArray.some(c => c.metrics?.testCoverage) && (
              <ComparisonRow
                label="Test Coverage"
                values={contextArray.map(c => 
                  c.metrics?.testCoverage ? `${c.metrics.testCoverage}%` : 'N/A'
                )}
                highlight="metric"
              />
            )}
            
            {contextArray.some(c => c.metrics?.performanceScore) && (
              <ComparisonRow
                label="Performance"
                values={contextArray.map(c => 
                  c.metrics?.performanceScore ? `${c.metrics.performanceScore}/100` : 'N/A'
                )}
                highlight="metric"
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Detailed Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Framework Comparison */}
        <Card className="p-4">
          <h3 className="text-lg font-medium mb-3">Frameworks & Libraries</h3>
          <FrameworkComparison contexts={contextArray} />
        </Card>

        {/* Architecture Comparison */}
        <Card className="p-4">
          <h3 className="text-lg font-medium mb-3">Architecture Patterns</h3>
          <ArchitectureComparison contexts={contextArray} />
        </Card>
      </div>

      {/* Similarity Analysis */}
      <Card className="p-4">
        <h3 className="text-lg font-medium mb-3">Similarity Analysis</h3>
        <SimilarityMatrix contexts={contextArray} />
      </Card>

      {/* Recommendations */}
      <Card className="p-4">
        <h3 className="text-lg font-medium mb-3">Cross-Project Recommendations</h3>
        <CrossProjectRecommendations contexts={contextArray} />
      </Card>
    </div>
  );
};

// Helper Components

interface ComparisonRowProps {
  label: string;
  values: string[];
  highlight?: 'metric' | 'difference';
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({ label, values, highlight }) => {
  const allSame = values.every(v => v === values[0]);
  
  return (
    <tr>
      <td className="px-4 py-2 text-sm font-medium text-gray-900">{label}</td>
      {values.map((value, idx) => (
        <td
          key={idx}
          className={`px-4 py-2 text-sm ${
            highlight === 'metric' ? getMetricColor(value) :
            highlight === 'difference' && !allSame ? 'bg-yellow-50' :
            ''
          }`}
        >
          {value}
        </td>
      ))}
    </tr>
  );
};

const getMetricColor = (value: string): string => {
  const num = parseInt(value);
  if (isNaN(num)) return 'text-gray-900';
  if (num >= 80) return 'text-green-600 font-medium';
  if (num >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const FrameworkComparison: React.FC<{ contexts: BaseProjectContext[] }> = ({ contexts }) => {
  // Collect all unique frameworks
  const allFrameworks = new Map<string, Set<string>>();
  
  contexts.forEach((context) => {
    context.frameworks.forEach(framework => {
      if (!allFrameworks.has(framework.name)) {
        allFrameworks.set(framework.name, new Set());
      }
      allFrameworks.get(framework.name)!.add(context.name);
    });
  });

  return (
    <div className="space-y-2">
      {Array.from(allFrameworks.entries()).map(([framework, projects]) => (
        <div key={framework} className="flex items-center justify-between">
          <span className="text-sm">{framework}</span>
          <div className="flex space-x-2">
            {contexts.map((context, idx) => (
              <div
                key={idx}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  projects.has(context.name)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200'
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const ArchitectureComparison: React.FC<{ contexts: BaseProjectContext[] }> = ({ contexts }) => {
  const patterns = new Map<string, number[]>();
  
  contexts.forEach((context, idx) => {
    context.architecturePatterns.forEach(pattern => {
      if (!patterns.has(pattern.pattern)) {
        patterns.set(pattern.pattern, new Array(contexts.length).fill(0));
      }
      patterns.get(pattern.pattern)![idx] = pattern.confidence;
    });
  });

  return (
    <div className="space-y-2">
      {Array.from(patterns.entries()).map(([pattern, confidences]) => (
        <div key={pattern}>
          <div className="flex justify-between mb-1">
            <span className="text-sm">{pattern}</span>
          </div>
          <div className="flex space-x-1">
            {confidences.map((confidence, idx) => (
              <div key={idx} className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const SimilarityMatrix: React.FC<{ contexts: BaseProjectContext[] }> = ({ contexts }) => {
  // Calculate similarity scores between projects
  const calculateSimilarity = (a: BaseProjectContext, b: BaseProjectContext): number => {
    let score = 0;
    let factors = 0;

    // Language similarity
    if (a.language === b.language) {
      score += 1;
    }
    factors += 1;

    // Framework similarity
    const aFrameworks = new Set(a.frameworks.map(f => f.name));
    const bFrameworks = new Set(b.frameworks.map(f => f.name));
    const frameworkIntersection = [...aFrameworks].filter(f => bFrameworks.has(f));
    const frameworkUnion = new Set([...aFrameworks, ...bFrameworks]);
    if (frameworkUnion.size > 0) {
      score += frameworkIntersection.length / frameworkUnion.size;
      factors += 1;
    }

    // Architecture similarity
    const aPatterns = new Set(a.architecturePatterns.map(p => p.pattern));
    const bPatterns = new Set(b.architecturePatterns.map(p => p.pattern));
    const patternIntersection = [...aPatterns].filter(p => bPatterns.has(p));
    const patternUnion = new Set([...aPatterns, ...bPatterns]);
    if (patternUnion.size > 0) {
      score += patternIntersection.length / patternUnion.size;
      factors += 1;
    }

    return factors > 0 ? score / factors : 0;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="p-2"></th>
            {contexts.map((context, idx) => (
              <th key={idx} className="p-2 text-xs font-medium text-gray-700">
                {context.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contexts.map((contextA, idxA) => (
            <tr key={idxA}>
              <td className="p-2 text-xs font-medium text-gray-700">{contextA.name}</td>
              {contexts.map((contextB, idxB) => {
                const similarity = idxA === idxB ? 1 : calculateSimilarity(contextA, contextB);
                const percentage = Math.round(similarity * 100);
                const bgColor = 
                  idxA === idxB ? 'bg-gray-100' :
                  similarity > 0.7 ? 'bg-green-100' :
                  similarity > 0.4 ? 'bg-yellow-100' :
                  'bg-red-100';
                
                return (
                  <td
                    key={idxB}
                    className={`p-2 text-center text-xs ${bgColor}`}
                  >
                    {percentage}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CrossProjectRecommendations: React.FC<{ contexts: BaseProjectContext[] }> = ({ contexts }) => {
  const recommendations: string[] = [];

  // Check for inconsistent testing
  const projectsWithTests = contexts.filter(c => c.testingFrameworks.length > 0);
  const projectsWithoutTests = contexts.filter(c => c.testingFrameworks.length === 0);
  
  if (projectsWithTests.length > 0 && projectsWithoutTests.length > 0) {
    const testFramework = projectsWithTests[0]?.testingFrameworks?.[0]?.name || 'testing';
    recommendations.push(
      `Consider adding ${testFramework} testing to: ${projectsWithoutTests.map(c => c.name).join(', ')}`
    );
  }

  // Check for TypeScript adoption
  const tsProjects = contexts.filter(c => 
    c.language === 'TypeScript' || c.frameworks.some(f => f.name === 'typescript')
  );
  const jsProjects = contexts.filter(c => 
    c.language === 'JavaScript' && !c.frameworks.some(f => f.name === 'typescript')
  );
  
  if (tsProjects.length > 0 && jsProjects.length > 0) {
    recommendations.push(
      `Consider migrating to TypeScript: ${jsProjects.map(c => c.name).join(', ')}`
    );
  }

  // Check for shared patterns
  const patternCounts = new Map<string, number>();
  contexts.forEach(c => {
    c.architecturePatterns.forEach(p => {
      patternCounts.set(p.pattern, (patternCounts.get(p.pattern) || 0) + 1);
    });
  });

  const commonPatterns = Array.from(patternCounts.entries())
    .filter(([_, count]) => count > contexts.length / 2)
    .map(([pattern]) => pattern);

  if (commonPatterns.length > 0) {
    const projectsWithoutPattern = contexts.filter(c => 
      !c.architecturePatterns.some(p => commonPatterns.includes(p.pattern))
    );
    
    if (projectsWithoutPattern.length > 0) {
      recommendations.push(
        `Consider implementing ${commonPatterns.join(', ')} patterns in: ${
          projectsWithoutPattern.map(c => c.name).join(', ')
        }`
      );
    }
  }

  // Check for performance improvements
  const lowPerfProjects = contexts.filter(c => 
    c.metrics?.performanceScore && c.metrics.performanceScore < 70
  );
  
  if (lowPerfProjects.length > 0) {
    recommendations.push(
      `Performance optimization needed for: ${lowPerfProjects.map(c => c.name).join(', ')}`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('All projects follow consistent patterns and best practices');
  }

  return (
    <ul className="space-y-2">
      {recommendations.map((rec, idx) => (
        <li key={idx} className="flex items-start">
          <span className="text-blue-500 mr-2">•</span>
          <span className="text-sm">{rec}</span>
        </li>
      ))}
    </ul>
  );
};