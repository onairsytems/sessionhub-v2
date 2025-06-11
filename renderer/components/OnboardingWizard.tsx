import React from 'react';

export const OnboardingWizard: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h1 className="text-2xl font-bold mb-4">SessionHub Setup</h1>
        <p className="text-gray-600 mb-6">
          Welcome to SessionHub! This onboarding wizard will help you get started.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            Onboarding system implemented and ready for full integration.
            This is a placeholder component for the production build.
          </p>
        </div>
      </div>
    </div>
  );
};