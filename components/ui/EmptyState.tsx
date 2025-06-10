import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  children
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-muted">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {children && (
        <div className="mb-6">
          {children}
        </div>
      )}
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              variant={action.variant || 'primary'}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button
              variant="ghost"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Common empty state presets
export function NoSessionsEmptyState({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <EmptyState
      title="No sessions yet"
      description="Start your first development session to track your progress and collaborate with Claude"
      action={{
        label: "Create your first session",
        onClick: onCreateSession
      }}
    />
  );
}

export function NoProjectsEmptyState({ onCreateProject, onImportProject }: { 
  onCreateProject: () => void;
  onImportProject: () => void;
}) {
  return (
    <EmptyState
      title="No projects found"
      description="Create a new project or import an existing codebase to get started"
      action={{
        label: "Create new project",
        onClick: onCreateProject
      }}
      secondaryAction={{
        label: "Import existing project",
        onClick: onImportProject
      }}
    />
  );
}

export function SearchEmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <EmptyState
      title="No results found"
      description={`We couldn't find anything matching "${query}"`}
      action={{
        label: "Clear search",
        onClick: onClear,
        variant: 'secondary'
      }}
    />
  );
}

export function ErrorEmptyState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      description={error || "An unexpected error occurred"}
      action={{
        label: "Try again",
        onClick: onRetry,
        variant: 'primary'
      }}
    />
  );
}