"use client";

import React from 'react';
import { MCPMarketplaceUI } from '../renderer/components/mcp/MCPMarketplace';

export default function MCPMarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <MCPMarketplaceUI />
      </div>
    </div>
  );
}