"use client";

import { FigmaIntegrationPanel } from "../renderer/components/figma/FigmaIntegrationPanel";

export default function FigmaPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Figma MCP Integration
        </h1>
        
        <div className="space-y-8">
          {/* Self-Improvement Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              SessionHub UI Self-Improvement
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Allow SessionHub to update its own UI by syncing with Figma designs
            </p>
            <FigmaIntegrationPanel mode="self-improvement" />
          </div>

          {/* Project Enhancement Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              Project UI Enhancement
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Enhance the UI/UX of projects managed by SessionHub
            </p>
            <FigmaIntegrationPanel mode="project-enhancement" projectId="example-project" />
          </div>
        </div>
      </div>
    </div>
  );
}