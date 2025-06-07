'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Send, GitBranch, FileCode, Loader, User, Bot } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PlanningChatProps {
  sessionId: string;
  sessionName: string;
  onPlanComplete: (plan: string) => void;
}

export function PlanningChat({ sessionId, sessionName, onPlanComplete }: PlanningChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm the Planning Actor for your session "${sessionName}". Let's discuss what you want to build and create a comprehensive plan before we start execution. You can also import a GitHub repository if you'd like me to analyze an existing codebase.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await window.electronAPI.sendChatMessage(sessionId, input.trim());
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const importGitHub = async () => {
    try {
      const result = await window.electronAPI.selectGitHubRepo();
      if (result) {
        const message: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: `I'd like you to analyze this GitHub repository: ${result.url}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, message]);
        
        // Trigger analysis
        setIsLoading(true);
        const response = await window.electronAPI.analyzeRepository(sessionId, result);
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to import GitHub repository:', error);
    }
  };

  const finalizePlan = () => {
    const plan = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('\n\n');
    onPlanComplete(plan);
  };

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col m-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Planning: {sessionName}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Discuss your requirements and I'll help create a comprehensive plan
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={importGitHub}
              disabled={isLoading}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              Import GitHub Repo
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex gap-3 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`p-2 rounded-full ${
                    message.role === 'user'
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </div>
                <div
                  className={`px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-blue-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
                <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Loader className="h-4 w-4 animate-spin text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe what you want to build..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              When you're ready, finalize the plan to move to execution phase
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={finalizePlan}
              disabled={messages.length < 3}
            >
              <FileCode className="h-4 w-4 mr-2" />
              Finalize Plan
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}