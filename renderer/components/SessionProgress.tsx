/**
 * Progress tracking UI component for real-time session monitoring
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "./ui/Card";

export interface SessionProgressProps {
  sessionId: string;
}

export interface ProgressStep {
  id: string;
  name: string;
  status: "pending" | "active" | "completed" | "failed";
  startTime?: string;
  endTime?: string;
  details?: string;
  error?: string;
}

export interface SessionMetrics {
  totalDuration: number;
  planningDuration: number;
  executionDuration: number;
  queueWaitTime: number;
  retryCount: number;
}

export const SessionProgress: React.FC<SessionProgressProps> = ({
  sessionId,
}) => {
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "queue", name: "Queued", status: "completed" },
    { id: "planning", name: "Planning", status: "pending" },
    { id: "validation", name: "Validation", status: "pending" },
    { id: "execution", name: "Execution", status: "pending" },
    { id: "complete", name: "Complete", status: "pending" },
  ]);

  const [currentMessage, setCurrentMessage] = useState<string>(
    "Waiting in queue...",
  );
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStep = useCallback(
    (
      stepId: string,
      status: ProgressStep["status"],
      details?: string,
    ): void => {
      setSteps((prevSteps) =>
        prevSteps.map((step) => {
          if (step.id === stepId) {
            const updated = { ...step, status };

            if (status === "active" && !step.startTime) {
              updated.startTime = new Date().toISOString();
            }

            if (
              (status === "completed" || status === "failed") &&
              !step.endTime
            ) {
              updated.endTime = new Date().toISOString();
            }

            if (details) {
              updated.details = details;
            }

            return updated;
          }
          return step;
        }),
      );
    },
    [],
  );

  const determineFailedStep = useCallback(
    (data: {
      actor?: string;
      stage?: string;
    }): string => {
      if (data.actor === "planning") return "planning";
      if (data.actor === "execution") return "execution";
      if (data.stage === "validation") return "validation";
      return "queue";
    },
    [],
  );

  const handleProgressEvent = useCallback(
    (event: {
      type: string;
      data: {
        position?: number;
        status?: string;
        metrics?: SessionMetrics;
        error?: string;
        retryCount?: number;
        actor?: string;
        stage?: string;
      };
    }) => {
      switch (event.type) {
        case "queued":
          updateStep(
            "queue",
            "active",
            "Position in queue: " + event.data.position,
          );
          setCurrentMessage(`Queued at position ${event.data.position}`);
          break;

        case "started":
          updateStep("queue", "completed");
          updateStep("planning", "active", "Analyzing request...");
          setCurrentMessage("Planning Actor is analyzing your request...");
          break;

        case "progress":
          if (event.data.status === "planning") {
            updateStep("planning", "active", "Generating instructions...");
            setCurrentMessage("Generating detailed instructions...");
          } else if (event.data.status === "executing") {
            updateStep("planning", "completed");
            updateStep("validation", "completed");
            updateStep("execution", "active", "Implementing solution...");
            setCurrentMessage("Execution Actor is implementing the solution...");
          }
          break;

        case "completed":
          updateStep("execution", "completed");
          updateStep("complete", "completed", "Success!");
          setCurrentMessage("Session completed successfully!");

          // Update metrics if available
          if (event.data.metrics) {
            setMetrics(event.data.metrics);
          }
          break;

        case "failed":
          const failedStep = determineFailedStep(event.data);
          updateStep(failedStep, "failed", event.data.error);
          setCurrentMessage(`Failed: ${event.data.error || "Unknown error"}`);
          setError(event.data.error || null);
          break;

        case "retrying":
          setCurrentMessage(`Retrying (attempt ${event.data.retryCount})...`);
          break;
      }
    },
    [updateStep, determineFailedStep],
  );

  const updateStepsFromStatus = useCallback(
    (status: { state: string }) => {
      if (status.state === "planning") {
        updateStep("queue", "completed");
        updateStep("planning", "active");
      } else if (status.state === "executing") {
        updateStep("queue", "completed");
        updateStep("planning", "completed");
        updateStep("validation", "completed");
        updateStep("execution", "active");
      } else if (status.state === "completed") {
        steps.forEach((step) => updateStep(step.id, "completed"));
      }
    },
    [steps, updateStep],
  );

  useEffect(() => {
    // Connect to real-time progress updates
    let cleanup: (() => void) | undefined;

    const connect = async () => {
      try {
        // Subscribe to session progress events
        window.sessionhub.onSessionProgress(
          (event: any) => {
            const typedData = event.data as {
              position?: number;
              status?: string;
              metrics?: SessionMetrics;
              error?: string;
              retryCount?: number;
              actor?: string;
              stage?: string;
            };
            handleProgressEvent({ type: event.type, data: typedData });
          },
        );

        setIsConnected(true);

        // Get initial status
        const status = (await window.electronAPI.getSession(sessionId)) as {
          state: string;
        } | null;
        if (status) {
          updateStepsFromStatus(status);
        }

        cleanup = () => {
          window.sessionhub.removeSessionProgressListener((event: any) => {
            handleProgressEvent({ type: event.type, data: event.data });
          });
          setIsConnected(false);
        };
      } catch (err) {
// REMOVED: console statement
        setError("Failed to connect to progress updates");
      }
    };

    void connect();

    return () => {
      cleanup?.();
    };
  }, [sessionId, handleProgressEvent, updateStepsFromStatus]);

  const getStepIcon = (status: ProgressStep["status"]) => {
    switch (status) {
      case "completed":
        return "✅";
      case "active":
        return "⏳";
      case "failed":
        return "❌";
      default:
        return "⭕";
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const calculateStepDuration = (step: ProgressStep): string | null => {
    if (!step.startTime || !step.endTime) return null;
    const duration =
      new Date(step.endTime).getTime() - new Date(step.startTime).getTime();
    return formatDuration(duration);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Session Progress</h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Current Status Message */}
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">{currentMessage}</p>
        </div>

        {/* Progress Steps */}
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-6 top-0 h-full w-0.5 bg-gray-200" />

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step: ProgressStep) => (
              <div key={step.id} className="relative flex items-start">
                {/* Step Icon */}
                <div
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                    step.status === "completed"
                      ? "border-green-500 bg-green-50"
                      : step.status === "active"
                        ? "border-blue-500 bg-blue-50 animate-pulse"
                        : step.status === "failed"
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300 bg-white"
                  }`}
                >
                  <span className="text-lg">{getStepIcon(step.status)}</span>
                </div>

                {/* Step Content */}
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4
                      className={`font-medium ${
                        step.status === "completed"
                          ? "text-green-700"
                          : step.status === "active"
                            ? "text-blue-700"
                            : step.status === "failed"
                              ? "text-red-700"
                              : "text-gray-500"
                      }`}
                    >
                      {step.name}
                    </h4>

                    {/* Duration */}
                    {step.status === "completed" && (
                      <span className="text-sm text-gray-500">
                        {calculateStepDuration(step)}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  {step.details && (
                    <p className="mt-1 text-sm text-gray-600">{step.details}</p>
                  )}

                  {/* Error */}
                  {step.status === "failed" && step.error && (
                    <p className="mt-1 text-sm text-red-600">{step.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        {metrics && (
          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <h4 className="mb-3 font-medium text-gray-900">
              Performance Metrics
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Duration:</span>
                <span className="ml-2 font-medium">
                  {formatDuration(metrics.totalDuration)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Planning Time:</span>
                <span className="ml-2 font-medium">
                  {formatDuration(metrics.planningDuration)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Execution Time:</span>
                <span className="ml-2 font-medium">
                  {formatDuration(metrics.executionDuration)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Queue Wait:</span>
                <span className="ml-2 font-medium">
                  {formatDuration(metrics.queueWaitTime)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
