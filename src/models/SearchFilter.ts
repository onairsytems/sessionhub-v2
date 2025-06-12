/**
 * Enhanced search and filter models for SessionHub
 */

import { SessionStatus } from './Session';

export interface SearchOptions {
  query: string;
  fields?: SearchableField[];
  matchType?: 'exact' | 'contains' | 'startsWith' | 'regex';
  caseSensitive?: boolean;
  highlightMatches?: boolean;
  maxResults?: number;
  offset?: number;
}

export type SearchableField = 
  | 'name'
  | 'description'
  | 'request.content'
  | 'instructions.content'
  | 'result.output'
  | 'error.message'
  | 'metadata.tags'
  | 'metadata.labels';

export interface FilterCriteria {
  status?: SessionStatus[];
  dateRange?: DateRange;
  projects?: string[];
  tags?: string[];
  folders?: string[];
  isFavorite?: boolean;
  hasError?: boolean;
  duration?: DurationFilter;
  customFields?: Record<string, any>;
}

export interface DateRange {
  from?: Date;
  to?: Date;
  preset?: DatePreset;
}

export type DatePreset = 
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days';

export interface DurationFilter {
  min?: number;
  max?: number;
  unit?: 'seconds' | 'minutes' | 'hours';
}

export interface SortOptions {
  field: SortableField;
  direction: 'asc' | 'desc';
  nullsFirst?: boolean;
}

export type SortableField = 
  | 'createdAt'
  | 'updatedAt'
  | 'completedAt'
  | 'name'
  | 'status'
  | 'duration'
  | 'projectId'
  | 'favoriteCount';

export interface SearchResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  highlights?: Map<string, string[]>;
  facets?: SearchFacets;
  performanceMetrics?: {
    searchTimeMs: number;
    indexUsed: boolean;
  };
}

export interface SearchFacets {
  status: FacetBucket<SessionStatus>[];
  projects: FacetBucket<string>[];
  tags: FacetBucket<string>[];
  dateRanges: FacetBucket<string>[];
}

export interface FacetBucket<T> {
  value: T;
  count: number;
  label?: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filter: FilterCriteria;
  search?: SearchOptions;
  sort?: SortOptions;
  isPublic: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface SessionTag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  sessionCount: number;
  createdAt: string;
  lastUsedAt: string;
}

export interface SessionFolder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  color?: string;
  icon?: string;
  sessionCount: number;
  subfolderCount: number;
  createdAt: string;
  updatedAt: string;
  path: string[]; // Full path from root
}

export interface OrganizationMetadata {
  tags: string[];
  folders: string[];
  isFavorite: boolean;
  favoriteAddedAt?: string;
  customLabels?: Record<string, string>;
  notes?: string;
}