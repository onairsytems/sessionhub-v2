'use client';

import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [sessionInput, setSessionInput] = useState('');
  const [sessions, setSessions] = useState([
    { id: 1, name: 'Example Session 1.1', status: 'completed', date: '2025-06-06' },
    { id: 2, name: 'Local Build Setup', status: 'completed', date: '2025-06-06' },
  ]);

  const handleNewSession = () => {
    if (sessionInput.trim()) {
      const newSession = {
        id: sessions.length + 1,
        name: sessionInput,
        status: 'in-progress',
        date: new Date().toISOString().split('T')[0]
      };
      setSessions([newSession, ...sessions]);
      setSessionInput('');
      setActiveTab('sessions');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'sessions':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Session Management</h2>
            
            {/* New Session Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Create New Session</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value)}
                  placeholder="Enter session description (e.g., 'Add user authentication system')"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleNewSession}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Start Session
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Describe what you want to build, and SessionHub's Two-Actor Model will handle the planning and execution.
              </p>
            </div>

            {/* Session List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold">Recent Sessions</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                  <div key={session.id} className="p-6 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">{session.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {session.date} • {session.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        session.status === 'completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'two-actor':
        return (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Two-Actor Model</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <h3 className="text-xl font-semibold">Planning Actor</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Analyzes requirements and context</li>
                  <li>• Generates structured instructions</li>
                  <li>• Never writes actual code</li>
                  <li>• Focuses on strategic decisions</li>
                  <li>• Validates architectural patterns</li>
                </ul>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <h3 className="text-xl font-semibold">Execution Actor</h3>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Implements solutions precisely</li>
                  <li>• Writes all code and files</li>
                  <li>• Never makes strategic decisions</li>
                  <li>• Focuses on technical execution</li>
                  <li>• Reports results and status</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">🎯 Why This Works</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Benefits</h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Zero-error development</li>
                    <li>• Clear separation of concerns</li>
                    <li>• Faster execution cycles</li>
                    <li>• Perfect reproducibility</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Process</h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <li>• User provides requirements</li>
                    <li>• Planning Actor creates instructions</li>
                    <li>• Execution Actor implements solution</li>
                    <li>• Results validated and delivered</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Application</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Theme</label>
                      <select className="px-3 py-2 border border-gray-300 rounded-lg">
                        <option>Auto</option>
                        <option>Light</option>
                        <option>Dark</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Auto-save sessions</label>
                      <input type="checkbox" defaultChecked className="rounded" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Development</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable debug mode</label>
                      <input type="checkbox" className="rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Show developer tools</label>
                      <input type="checkbox" className="rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to SessionHub
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              AI-Powered Development Platform with Two-Actor Model
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl font-semibold mb-4">🚀 Production Ready</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                SessionHub 1.0 is now live! Experience zero-error development with the revolutionary Two-Actor Model.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">Planning Actor</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Analyzes requirements and generates clear instructions
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">Execution Actor</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Implements solutions with precision and reliability
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('sessions')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Start Your First Session
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900 dark:text-white">SessionHub</span>
            </div>
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'home'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'sessions'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                Sessions
              </button>
              <button
                onClick={() => setActiveTab('two-actor')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'two-actor'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                Two-Actor Model
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'settings'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8">
        <div className="SessionHub-container">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>© 2025 SessionHub. Built with the Two-Actor Model.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}