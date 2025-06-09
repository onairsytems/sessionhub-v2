'use client';

import React, { useState } from 'react';
import { AdminDashboard } from '../renderer/components/admin/AdminDashboard';

export default function AdminPage() {
  const [showDashboard, setShowDashboard] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {showDashboard && (
        <AdminDashboard onClose={() => setShowDashboard(false)} />
      )}
      {!showDashboard && (
        <div className="flex items-center justify-center min-h-screen">
          <button
            onClick={() => setShowDashboard(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Open Admin Dashboard
          </button>
        </div>
      )}
    </div>
  );
}