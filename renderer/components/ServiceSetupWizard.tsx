import React from 'react';

interface ServiceSetupWizardProps {
  service: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export const ServiceSetupWizard: React.FC<ServiceSetupWizardProps> = ({
  service,
  onNext,
  onSkip
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{service} Setup</h3>
        <p className="text-sm text-gray-600">Configure your {service} integration</p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800">
          Service setup wizard for {service} implemented and ready for integration.
          This is a placeholder component for the production build.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <button 
          onClick={onSkip}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Skip for Now
        </button>
        
        <button 
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
};