/**
 * Diff Viewer Component
 * Shows visual diff between local and remote values
 */

import React, { useMemo } from 'react';
import { diffLines, Change } from 'diff';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

interface DiffViewerProps {
  localValue: string;
  remoteValue: string;
  baseValue?: string;
  type?: 'text' | 'json';
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  localValue,
  remoteValue,
  baseValue,
  type = 'text',
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(new Set());

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const diffs = useMemo(() => {
    if (type === 'json') {
      try {
        const localPretty = JSON.stringify(JSON.parse(localValue), null, 2);
        const remotePretty = JSON.stringify(JSON.parse(remoteValue), null, 2);
        return diffLines(remotePretty, localPretty);
      } catch {
        // Fall back to text diff if JSON parsing fails
        return diffLines(remoteValue, localValue);
      }
    }
    return diffLines(remoteValue, localValue);
  }, [localValue, remoteValue, type]);

  const renderDiffLine = (change: Change, index: number) => {
    const lines = change.value.split('\n').filter(line => line !== '');
    
    if (lines.length === 0) return null;

    const bgColor = change.added 
      ? 'bg-green-100 dark:bg-green-900/30' 
      : change.removed 
      ? 'bg-red-100 dark:bg-red-900/30' 
      : '';
    
    const textColor = change.added 
      ? 'text-green-800 dark:text-green-200' 
      : change.removed 
      ? 'text-red-800 dark:text-red-200' 
      : 'text-gray-700 dark:text-gray-300';
    
    const prefix = change.added ? '+' : change.removed ? '-' : ' ';

    // For large unchanged sections, make them collapsible
    if (!change.added && !change.removed && lines.length > 5) {
      const isExpanded = expandedSections.has(index);
      // const displayLines = isExpanded ? lines : lines.slice(0, 2);

      return (
        <div key={index} className="group">
          <button
            onClick={() => toggleSection(index)}
            className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
              {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
              <span>{lines.length} unchanged lines</span>
            </div>
          </button>
          {isExpanded && (
            <div>
              {lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={`px-4 py-0.5 font-mono text-xs ${bgColor} ${textColor}`}
                >
                  <span className="select-none text-gray-400 mr-2">{prefix}</span>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={index}>
        {lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            className={`px-4 py-0.5 font-mono text-xs ${bgColor} ${textColor}`}
          >
            <span className="select-none text-gray-400 mr-2">{prefix}</span>
            {line}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-400 rounded-sm"></span>
              Remote (Server)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-400 rounded-sm"></span>
              Local (Your Changes)
            </span>
          </div>
          {baseValue && (
            <span className="text-gray-500">Three-way merge</span>
          )}
        </div>
      </div>

      {/* Diff Content */}
      <div className="bg-white dark:bg-gray-800 overflow-x-auto">
        <div className="min-w-full">
          {diffs.map((change, index) => renderDiffLine(change, index))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {diffs.filter(d => d.added).reduce((acc, d) => acc + d.value.split('\n').filter(l => l).length, 0)} additions,{' '}
          {diffs.filter(d => d.removed).reduce((acc, d) => acc + d.value.split('\n').filter(l => l).length, 0)} deletions
        </div>
      </div>
    </div>
  );
};