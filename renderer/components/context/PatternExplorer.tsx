import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface Pattern {
  id: string;
  type: 'success' | 'error' | 'workflow' | 'optimization';
  name: string;
  description: string;
  examples: string[];
  frequency: number;
  projects: string[];
  confidence: number;
}

interface PatternExplorerProps {
  projectId?: string;
  onPatternSelect?: (pattern: Pattern) => void;
}

export const PatternExplorer: React.FC<PatternExplorerProps> = ({
  projectId,
  onPatternSelect
}) => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [filteredPatterns, setFilteredPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'confidence' | 'name'>('frequency');

  useEffect(() => {
    loadPatterns();
  }, [projectId]);

  useEffect(() => {
    filterAndSortPatterns();
  }, [patterns, selectedType, searchTerm, sortBy]);

  const loadPatterns = async () => {
    setLoading(true);
    try {
      // Mock data for development
      setPatterns([]);
    } catch (err) {
// REMOVED: console statement
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPatterns = () => {
    let filtered = [...patterns];

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(p => p.type === selectedType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.examples.some(e => e.toLowerCase().includes(term))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'frequency':
          return b.frequency - a.frequency;
        case 'confidence':
          return b.confidence - a.confidence;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredPatterns(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Pattern Explorer</h2>
        <Button onClick={loadPatterns} size="sm" variant="secondary">
          Refresh
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patterns..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pattern Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="success">Success Patterns</option>
              <option value="error">Error Patterns</option>
              <option value="workflow">Workflow Patterns</option>
              <option value="optimization">Optimization Patterns</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="frequency">Frequency</option>
              <option value="confidence">Confidence</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Pattern Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PatternStat
          label="Total Patterns"
          value={patterns.length}
          color="blue"
        />
        <PatternStat
          label="Success Patterns"
          value={patterns.filter(p => p.type === 'success').length}
          color="green"
        />
        <PatternStat
          label="Error Patterns"
          value={patterns.filter(p => p.type === 'error').length}
          color="red"
        />
        <PatternStat
          label="Avg Confidence"
          value={`${Math.round(
            patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length * 100
          )}%`}
          color="purple"
        />
      </div>

      {/* Pattern List */}
      <div className="space-y-4">
        {filteredPatterns.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No patterns found matching your criteria
          </Card>
        ) : (
          filteredPatterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              onSelect={() => onPatternSelect?.(pattern)}
            />
          ))
        )}
      </div>

      {/* Pattern Insights */}
      {patterns.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-medium mb-3">Pattern Insights</h3>
          <PatternInsights patterns={patterns} />
        </Card>
      )}
    </div>
  );
};

// Helper Components

interface PatternStatProps {
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'purple';
}

const PatternStat: React.FC<PatternStatProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700'
  };

  return (
    <Card className={`p-4 ${colorClasses[color]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
};

interface PatternCardProps {
  pattern: Pattern;
  onSelect: () => void;
}

const PatternCard: React.FC<PatternCardProps> = ({ pattern, onSelect }) => {
  const [expanded, setExpanded] = useState(false);

  const typeColors = {
    success: 'border-green-500 bg-green-50',
    error: 'border-red-500 bg-red-50',
    workflow: 'border-blue-500 bg-blue-50',
    optimization: 'border-purple-500 bg-purple-50'
  };

  const typeIcons = {
    success: '✓',
    error: '✗',
    workflow: '↻',
    optimization: '⚡'
  };

  return (
    <Card className={`p-4 border-l-4 ${typeColors[pattern.type]} hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-2xl">{typeIcons[pattern.type]}</span>
            <h3 className="text-lg font-medium">{pattern.name}</h3>
            <span className="text-sm text-gray-500">
              ({pattern.frequency} occurrences)
            </span>
          </div>
          
          <p className="text-gray-700 mb-3">{pattern.description}</p>
          
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">Confidence:</span>
              <span className="font-medium">{Math.round(pattern.confidence * 100)}%</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">Projects:</span>
              <span className="font-medium">{pattern.projects.length}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setExpanded(!expanded)}
            size="sm"
            variant="secondary"
          >
            {expanded ? 'Hide' : 'Show'} Examples
          </Button>
          <Button
            onClick={onSelect}
            size="sm"
          >
            Use Pattern
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Examples:</h4>
          <div className="space-y-2">
            {pattern.examples.map((example, idx) => (
              <div key={idx} className="bg-white p-2 rounded border border-gray-200">
                <code className="text-sm">{example}</code>
              </div>
            ))}
          </div>
          
          {pattern.projects.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Used in:</h4>
              <div className="flex flex-wrap gap-1">
                {pattern.projects.map((project, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                  >
                    {project}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const PatternInsights: React.FC<{ patterns: Pattern[] }> = ({ patterns }) => {
  // Calculate insights
  // const totalOccurrences = patterns.reduce((sum, p) => sum + p.frequency, 0);
  const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  
  const typeDistribution = patterns.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostFrequent = patterns.sort((a, b) => b.frequency - a.frequency)[0];
  const mostConfident = patterns.sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <div className="space-y-4">
      {/* Distribution Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Pattern Distribution</h4>
        <div className="flex space-x-2">
          {Object.entries(typeDistribution).map(([type, count]) => {
            const percentage = (count / patterns.length) * 100;
            return (
              <div key={type} className="flex-1">
                <div className="text-xs text-gray-600 mb-1">{type}</div>
                <div className="h-20 bg-gray-200 rounded relative">
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded transition-all ${
                      type === 'success' ? 'bg-green-500' :
                      type === 'error' ? 'bg-red-500' :
                      type === 'workflow' ? 'bg-blue-500' :
                      'bg-purple-500'
                    }`}
                    style={{ height: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-center mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Most Frequent Pattern</h4>
          <p className="text-sm">
            <span className="font-medium">{mostFrequent?.name || 'N/A'}</span>
            <span className="text-gray-500 ml-2">({mostFrequent?.frequency || 0} times)</span>
          </p>
        </div>
        
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Highest Confidence Pattern</h4>
          <p className="text-sm">
            <span className="font-medium">{mostConfident?.name || 'N/A'}</span>
            <span className="text-gray-500 ml-2">({mostConfident ? Math.round(mostConfident.confidence * 100) : 0}%)</span>
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
        <ul className="space-y-1 text-sm">
          {avgConfidence < 0.7 && (
            <li className="flex items-start">
              <span className="text-yellow-500 mr-2">⚠</span>
              <span>Pattern confidence is below 70%. Consider refining pattern detection.</span>
            </li>
          )}
          {patterns.filter(p => p.type === 'error').length > patterns.length * 0.3 && (
            <li className="flex items-start">
              <span className="text-red-500 mr-2">⚠</span>
              <span>High number of error patterns detected. Review code quality practices.</span>
            </li>
          )}
          {patterns.filter(p => p.type === 'optimization').length < 3 && (
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">💡</span>
              <span>Few optimization patterns found. Consider performance analysis.</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};