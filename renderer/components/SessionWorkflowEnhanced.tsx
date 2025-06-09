"use client";

import { useState, useEffect, useCallback } from "react";
import { ApiConfiguration } from "./ApiConfiguration";
import { PlanningChat } from "./PlanningChat";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  CheckCircle,
  Circle,
  ArrowRight,
  PlayCircle,
  MessageSquare,
  Code,
  Upload,
  FileText,
  Image,
  AlertCircle,
  Loader,
  X
} from "lucide-react";

interface SessionDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'png' | 'jpg';
  size: number;
  status: 'pending' | 'importing' | 'analyzing' | 'ready' | 'error';
  analysis?: {
    requirementCount: number;
    ambiguityCount: number;
    confidenceScore: number;
  };
  error?: string;
}

interface SessionProgress {
  phase: string;
  step: string;
  progress: number;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface Session {
  id: string;
  name: string;
  status: "configuring" | "document-import" | "planning" | "executing" | "completed";
  documents: SessionDocument[];
  plan?: string;
  results?: unknown;
  progress: SessionProgress[];
}

export default function SessionWorkflowEnhanced() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    void checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      const hasKey = await window.electronAPI.checkApiKey();
      setHasApiKey(hasKey);
    } catch (error: unknown) {
      // Error checking API key
    } finally {
      setIsCheckingApiKey(false);
    }
  };

  const createNewSession = () => {
    const session: Session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      status: "document-import",
      documents: [],
      progress: []
    };
    setCurrentSession(session);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (!currentSession) return;

    const allowedTypes = ['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg'];
    const newDocuments: SessionDocument[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (allowedTypes.includes(ext)) {
        newDocuments.push({
          id: `${Date.now()}_${Math.random()}`,
          name: file.name,
          type: ext as any,
          size: file.size,
          status: 'pending'
        });
      }
    }

    setCurrentSession({
      ...currentSession,
      documents: [...currentSession.documents, ...newDocuments]
    });

    // Simulate document processing
    setIsProcessing(true);
    for (const doc of newDocuments) {
      await processDocument(doc);
    }
    setIsProcessing(false);
  };

  const processDocument = async (doc: SessionDocument) => {
    // Simulate import
    updateDocumentStatus(doc.id, 'importing');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate analysis
    updateDocumentStatus(doc.id, 'analyzing');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Complete with mock analysis
    updateDocumentStatus(doc.id, 'ready', {
      requirementCount: Math.floor(Math.random() * 20) + 5,
      ambiguityCount: Math.floor(Math.random() * 5),
      confidenceScore: 0.8 + Math.random() * 0.15
    });
  };

  const updateDocumentStatus = (
    docId: string,
    status: SessionDocument['status'],
    analysis?: SessionDocument['analysis']
  ) => {
    if (!currentSession) return;

    setCurrentSession({
      ...currentSession,
      documents: currentSession.documents.map(doc =>
        doc.id === docId ? { ...doc, status, analysis } : doc
      )
    });
  };

  const removeDocument = (docId: string) => {
    if (!currentSession) return;

    setCurrentSession({
      ...currentSession,
      documents: currentSession.documents.filter(doc => doc.id !== docId)
    });
  };

  const proceedToPlanningWithDocuments = () => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      status: "planning"
    });
  };

  const handlePlanComplete = (plan: string) => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        status: "executing",
        plan,
      });
    }
  };

  const handleExecutionComplete = (results: unknown) => {
    if (currentSession) {
      setCurrentSession({
        ...currentSession,
        status: "completed",
        results,
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (['png', 'jpg', 'jpeg'].includes(type)) {
      return <Image className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  };

  if (isCheckingApiKey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading SessionHub...
          </p>
        </div>
      </div>
    );
  }

  if (!hasApiKey) {
    return <ApiConfiguration onComplete={() => setHasApiKey(true)} />;
  }

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">SessionHub</h1>

          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-4">
              Welcome to SessionHub
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create a new session to start planning and building your project
              with the Two-Actor Model. You can now import documents and visual references
              to guide the planning process.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-medium">1. Import Documents (Optional)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Upload requirements docs, mockups, or screenshots
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium">2. Planning Phase</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Discuss requirements with document context
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Code className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">3. Execution Phase</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    The Execution Actor implements your plan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="font-medium">4. Review Results</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    See what was built and test your application
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={createNewSession} size="lg" className="w-full">
              <PlayCircle className="h-5 w-5 mr-2" />
              Start New Session
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div
                className={`flex items-center gap-2 ${
                  currentSession.status === "document-import"
                    ? "text-blue-600"
                    : "text-green-600"
                }`}
              >
                {currentSession.status !== "document-import" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="font-medium">Documents</span>
              </div>

              <ArrowRight className="h-4 w-4 text-gray-400" />

              <div
                className={`flex items-center gap-2 ${
                  currentSession.status === "planning"
                    ? "text-blue-600"
                    : ["executing", "completed"].includes(currentSession.status)
                      ? "text-green-600"
                      : "text-gray-400"
                }`}
              >
                {["executing", "completed"].includes(currentSession.status) ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="font-medium">Planning</span>
              </div>

              <ArrowRight className="h-4 w-4 text-gray-400" />

              <div
                className={`flex items-center gap-2 ${
                  currentSession.status === "executing"
                    ? "text-blue-600"
                    : currentSession.status === "completed"
                      ? "text-green-600"
                      : "text-gray-400"
                }`}
              >
                {currentSession.status === "completed" ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="font-medium">Execution</span>
              </div>

              <ArrowRight className="h-4 w-4 text-gray-400" />

              <div
                className={`flex items-center gap-2 ${
                  currentSession.status === "completed"
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                <Circle className="h-5 w-5" />
                <span className="font-medium">Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {currentSession.status === "document-import" && (
          <div className="p-8">
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <h2 className="text-2xl font-bold mb-4">Import Documents (Optional)</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Upload any requirements documents, mockups, or screenshots to provide
                  context for your project. The Planning Actor will analyze these to better
                  understand your needs.
                </p>

                {/* Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg mb-2">
                    Drop files here or{" "}
                    <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
                      browse
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                      />
                    </label>
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports PDF, Word, Text, Markdown, PNG, and JPEG files (max 50MB)
                  </p>
                </div>

                {/* Document List */}
                {currentSession.documents.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="font-medium mb-2">Imported Documents</h3>
                    {currentSession.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getFileIcon(doc.type)}
                          <div className="flex-1">
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatFileSize(doc.size)}
                              {doc.analysis && (
                                <span className="ml-2">
                                  • {doc.analysis.requirementCount} requirements •{" "}
                                  {Math.round(doc.analysis.confidenceScore * 100)}% confidence
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.status === 'importing' && (
                            <div className="flex items-center gap-2 text-blue-600">
                              <Loader className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Importing...</span>
                            </div>
                          )}
                          {doc.status === 'analyzing' && (
                            <div className="flex items-center gap-2 text-purple-600">
                              <Loader className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Analyzing...</span>
                            </div>
                          )}
                          {doc.status === 'ready' && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {doc.status === 'error' && (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(doc.id)}
                            disabled={isProcessing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-8 flex gap-4">
                  <Button
                    onClick={proceedToPlanningWithDocuments}
                    variant="primary"
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    {currentSession.documents.length > 0
                      ? `Continue with ${currentSession.documents.length} document${
                          currentSession.documents.length > 1 ? "s" : ""
                        }`
                      : "Skip and Continue"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {currentSession.status === "planning" && (
          <PlanningChat
            sessionId={currentSession.id}
            sessionName={currentSession.name}
            onPlanComplete={handlePlanComplete}
            documentContext={{
              documents: currentSession.documents,
              analysisAvailable: currentSession.documents.some(d => d.analysis)
            }}
          />
        )}

        {currentSession.status === "executing" && (
          <div className="p-8">
            <Card className="max-w-4xl mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">Executing Plan</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The Execution Actor is now implementing your plan...
              </p>
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {currentSession.plan}
                  </pre>
                </div>
                <Button
                  onClick={(): void => {
                    handleExecutionComplete({ success: true });
                  }}
                >
                  Complete Execution (Demo)
                </Button>
              </div>
            </Card>
          </div>
        )}

        {currentSession.status === "completed" && (
          <div className="p-8">
            <Card className="max-w-4xl mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">Session Complete!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your project has been successfully built.
              </p>
              
              {currentSession.documents.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Documents Used:</strong> {currentSession.documents.length} document(s) 
                    were analyzed to guide this implementation.
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                <Button
                  onClick={() => setCurrentSession(null)}
                  variant="primary"
                >
                  Start New Session
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}