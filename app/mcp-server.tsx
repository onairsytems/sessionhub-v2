"use client";

import React from 'react';
import { MCPIntegrationManager } from '../renderer/components/mcp/MCPIntegrationManager';

export default function MCPServerPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <MCPIntegrationManager />
      </div>
    </div>
  );
}