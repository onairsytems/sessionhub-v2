import React, { useState, useEffect } from 'react';
import { 
  SearchOptions, 
  FilterCriteria, 
  SortOptions, 
  DatePreset,
  SavedFilter,
  SessionTag,
  SessionFolder
} from '@/src/models/SearchFilter';
import { SessionStatus } from '@/src/models/Session';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AdvancedSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (search: SearchOptions, filter: FilterCriteria, sort: SortOptions) => void;
  onSaveFilter?: (filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
}

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  isOpen,
  onClose,
  onSearch,
  onSaveFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFields, setSearchFields] = useState<string[]>(['name', 'description', 'request.content']);
  const [matchType, setMatchType] = useState<'contains' | 'exact' | 'startsWith' | 'regex'>('contains');
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<SessionStatus[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset | ''>('');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [folderFilter, setFolderFilter] = useState<string[]>([]);
  const [isFavoriteFilter, setIsFavoriteFilter] = useState<boolean | undefined>(undefined);
  const [hasErrorFilter, setHasErrorFilter] = useState<boolean | undefined>(undefined);
  const [durationMin, setDurationMin] = useState('');
  const [durationMax, setDurationMax] = useState('');
  const [durationUnit, setDurationUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');
  
  // Sort states
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Data
  const [tags, setTags] = useState<SessionTag[]>([]);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [, setProjects] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [tagsResult, foldersResult, filtersResult] = await Promise.all([
        window.electron.invoke('session:getTags'),
        window.electron.invoke('session:getFolders'),
        window.electron.invoke('session:getSavedFilters')
      ]);
      
      setTags(tagsResult as SessionTag[]);
      setFolders(foldersResult as SessionFolder[]);
      setSavedFilters(filtersResult as SavedFilter[]);
      
      // TODO: Load projects from session service
      setProjects(['default', 'project-1', 'project-2']); // Placeholder
    } catch (error) {
// REMOVED: console statement
    }
  };

  const handleSearch = () => {
    const searchOptions: SearchOptions = {
      query: searchQuery,
      fields: searchFields as any[],
      matchType,
      caseSensitive: false,
      highlightMatches: true
    };

    const filterCriteria: FilterCriteria = {
      status: statusFilter.length > 0 ? statusFilter : undefined,
      projects: projectFilter.length > 0 ? projectFilter : undefined,
      tags: tagFilter.length > 0 ? tagFilter : undefined,
      folders: folderFilter.length > 0 ? folderFilter : undefined,
      isFavorite: isFavoriteFilter,
      hasError: hasErrorFilter,
      dateRange: getDateRange(),
      duration: getDurationFilter()
    };

    const sortOptions: SortOptions = {
      field: sortField as any,
      direction: sortDirection
    };

    onSearch(searchOptions, filterCriteria, sortOptions);
  };

  const getDateRange = () => {
    if (datePreset) {
      return { preset: datePreset };
    }
    
    const range: any = {};
    if (customDateFrom) range.from = new Date(customDateFrom);
    if (customDateTo) range.to = new Date(customDateTo);
    
    return Object.keys(range).length > 0 ? range : undefined;
  };

  const getDurationFilter = () => {
    if (!durationMin && !durationMax) return undefined;
    
    return {
      min: durationMin ? Number(durationMin) : undefined,
      max: durationMax ? Number(durationMax) : undefined,
      unit: durationUnit
    };
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setSearchFields(['name', 'description', 'request.content']);
    setMatchType('contains');
    setStatusFilter([]);
    setDatePreset('');
    setCustomDateFrom('');
    setCustomDateTo('');
    setProjectFilter([]);
    setTagFilter([]);
    setFolderFilter([]);
    setIsFavoriteFilter(undefined);
    setHasErrorFilter(undefined);
    setDurationMin('');
    setDurationMax('');
    setDurationUnit('minutes');
    setSortField('createdAt');
    setSortDirection('desc');
  };

  const handleSaveFilter = () => {
    if (!onSaveFilter) return;
    
    const name = prompt('Enter a name for this filter:');
    if (!name) return;

    const filter: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
      name,
      description: '',
      filter: {
        status: statusFilter.length > 0 ? statusFilter : undefined,
        projects: projectFilter.length > 0 ? projectFilter : undefined,
        tags: tagFilter.length > 0 ? tagFilter : undefined,
        folders: folderFilter.length > 0 ? folderFilter : undefined,
        isFavorite: isFavoriteFilter,
        hasError: hasErrorFilter,
        dateRange: getDateRange(),
        duration: getDurationFilter()
      },
      search: {
        query: searchQuery,
        fields: searchFields as any[],
        matchType,
        caseSensitive: false,
        highlightMatches: true
      },
      sort: {
        field: sortField as any,
        direction: sortDirection
      },
      isPublic: false,
      isPinned: false
    };

    onSaveFilter(filter);
  };

  const loadSavedFilter = (filter: SavedFilter) => {
    if (filter.search) {
      setSearchQuery(filter.search.query || '');
      setSearchFields(filter.search.fields || ['name', 'description', 'request.content']);
      setMatchType(filter.search.matchType || 'contains');
    }

    const criteria = filter.filter;
    setStatusFilter(criteria.status || []);
    setProjectFilter(criteria.projects || []);
    setTagFilter(criteria.tags || []);
    setFolderFilter(criteria.folders || []);
    setIsFavoriteFilter(criteria.isFavorite);
    setHasErrorFilter(criteria.hasError);

    if (criteria.dateRange?.preset) {
      setDatePreset(criteria.dateRange.preset);
      setCustomDateFrom('');
      setCustomDateTo('');
    } else if (criteria.dateRange) {
      setDatePreset('');
      setCustomDateFrom(criteria.dateRange.from?.toISOString().split('T')[0] || '');
      setCustomDateTo(criteria.dateRange.to?.toISOString().split('T')[0] || '');
    }

    if (criteria.duration) {
      setDurationMin(criteria.duration.min?.toString() || '');
      setDurationMax(criteria.duration.max?.toString() || '');
      setDurationUnit(criteria.duration.unit || 'minutes');
    }

    if (filter.sort) {
      setSortField(filter.sort.field);
      setSortDirection(filter.sort.direction);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-10">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Advanced Search & Filters
            </h2>
            <Button variant="ghost" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Saved Filters
              </h3>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map(filter => (
                  <Button
                    key={filter.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => loadSavedFilter(filter)}
                    className="text-sm"
                  >
                    {filter.isPinned && '📌 '}{filter.name}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Search Options */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Search Query
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter search query..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
              />
              
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Search in:</label>
                <div className="mt-2 space-y-2">
                  {[
                    { value: 'name', label: 'Session Name' },
                    { value: 'description', label: 'Description' },
                    { value: 'request.content', label: 'Request Content' },
                    { value: 'instructions.content', label: 'Instructions' },
                    { value: 'result.output', label: 'Results' },
                    { value: 'error.message', label: 'Error Messages' },
                    { value: 'metadata.tags', label: 'Tags' }
                  ].map(field => (
                    <label key={field.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={searchFields.includes(field.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSearchFields([...searchFields, field.value]);
                          } else {
                            setSearchFields(searchFields.filter(f => f !== field.value));
                          }
                        }}
                        className="mr-2"
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Match Type:</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact Match</option>
                  <option value="startsWith">Starts With</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Status Filter */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Status
            </h3>
            <div className="flex flex-wrap gap-2">
              {(['pending', 'planning', 'executing', 'completed', 'failed', 'cancelled'] as SessionStatus[])
                .map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(prev =>
                        prev.includes(status)
                          ? prev.filter(s => s !== status)
                          : [...prev, status]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter.includes(status)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {status}
                  </button>
                ))}
            </div>
          </Card>

          {/* Date Range Filter */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Date Range
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Quick Presets:</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'yesterday', label: 'Yesterday' },
                    { value: 'thisWeek', label: 'This Week' },
                    { value: 'lastWeek', label: 'Last Week' },
                    { value: 'thisMonth', label: 'This Month' },
                    { value: 'lastMonth', label: 'Last Month' },
                    { value: 'last7Days', label: 'Last 7 Days' },
                    { value: 'last30Days', label: 'Last 30 Days' },
                    { value: 'last90Days', label: 'Last 90 Days' }
                  ].map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setDatePreset(datePreset === preset.value ? '' : preset.value as DatePreset);
                        setCustomDateFrom('');
                        setCustomDateTo('');
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        datePreset === preset.value
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300">From:</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => {
                      setCustomDateFrom(e.target.value);
                      setDatePreset('');
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300">To:</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => {
                      setCustomDateTo(e.target.value);
                      setDatePreset('');
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Tags Filter */}
          {tags.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setTagFilter(prev =>
                        prev.includes(tag.name)
                          ? prev.filter(t => t !== tag.name)
                          : [...prev, tag.name]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      tagFilter.includes(tag.name)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                    style={{ backgroundColor: tagFilter.includes(tag.name) ? tag.color : undefined }}
                  >
                    {tag.name} ({tag.sessionCount})
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Folders Filter */}
          {folders.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Folders
              </h3>
              <div className="space-y-2">
                {folders.map(folder => (
                  <label key={folder.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={folderFilter.includes(folder.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFolderFilter([...folderFilter, folder.id]);
                        } else {
                          setFolderFilter(folderFilter.filter(f => f !== folder.id));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {folder.icon} {folder.path.join(' / ')} ({folder.sessionCount})
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* Additional Filters */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Additional Filters
            </h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="favorite"
                    checked={isFavoriteFilter === true}
                    onChange={() => setIsFavoriteFilter(true)}
                    className="mr-2"
                  />
                  Favorites only
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="favorite"
                    checked={isFavoriteFilter === false}
                    onChange={() => setIsFavoriteFilter(false)}
                    className="mr-2"
                  />
                  Non-favorites only
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="favorite"
                    checked={isFavoriteFilter === undefined}
                    onChange={() => setIsFavoriteFilter(undefined)}
                    className="mr-2"
                  />
                  All
                </label>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="error"
                    checked={hasErrorFilter === true}
                    onChange={() => setHasErrorFilter(true)}
                    className="mr-2"
                  />
                  With errors
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="error"
                    checked={hasErrorFilter === false}
                    onChange={() => setHasErrorFilter(false)}
                    className="mr-2"
                  />
                  Without errors
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="error"
                    checked={hasErrorFilter === undefined}
                    onChange={() => setHasErrorFilter(undefined)}
                    className="mr-2"
                  />
                  All
                </label>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Duration:</label>
                <div className="mt-2 flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={durationMax}
                    onChange={(e) => setDurationMax(e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as any)}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    <option value="seconds">seconds</option>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Sort Options */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Sort Results
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Sort by:</label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                >
                  <option value="createdAt">Created Date</option>
                  <option value="updatedAt">Updated Date</option>
                  <option value="completedAt">Completed Date</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="duration">Duration</option>
                  <option value="favoriteCount">Favorite Count</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300">Direction:</label>
                <select
                  value={sortDirection}
                  onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={handleClearAll}>
                Clear All
              </Button>
              {onSaveFilter && (
                <Button variant="ghost" onClick={handleSaveFilter}>
                  Save Filter
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSearch}>
                Apply Search
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};