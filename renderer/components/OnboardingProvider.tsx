'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { OnboardingWizard } from './OnboardingWizard';

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        if (typeof window !== 'undefined' && window.electron) {
          const status = await window.electron.invoke('onboarding:get-status') as { completed?: boolean } | null;
          const complete = status?.completed || false;
          setIsOnboardingComplete(complete);
          setShowOnboarding(!complete);
        }
      } catch (error) {
        // Failed to check onboarding status - default to complete
        setIsOnboardingComplete(true);
        setShowOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const handleOnboardingComplete = () => {
    setIsOnboardingComplete(true);
    setShowOnboarding(false);
  };

  if (isLoading) {
    return <>{children}</>;
  }

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        setOnboardingComplete: setIsOnboardingComplete,
        showOnboarding,
        setShowOnboarding,
      }}
    >
      {children}
      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}
    </OnboardingContext.Provider>
  );
};