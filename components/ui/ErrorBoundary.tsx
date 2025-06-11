'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };
  handleReload = () => {
    window.location.reload();
  };
  handleGoHome = () => {
    window.location.href = '/';
  };
  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-full bg-destructive/20">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    An unexpected error occurred. The error has been logged and we'll look into it.
                  </p>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mb-4">
                      <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                        Error details
                      </summary>
                      <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                        {this.state.error.toString()}
                        {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={this.handleReset}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={this.handleReload}
                    >
                      Reload page
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={this.handleGoHome}
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Go home
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
// Hook for using error boundary in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);
  return setError;
}
// WithErrorBoundary HOC
export function withErrorBoundary<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}