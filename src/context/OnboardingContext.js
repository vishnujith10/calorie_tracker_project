import React, { createContext, useState, useRef } from 'react';

export const OnboardingContext = createContext();

export const OnboardingProvider = ({ children }) => {
  const [onboardingData, setOnboardingData] = useState({});
  const resetOnboardingDataRef = useRef(null);
  
  // Function to reset onboarding data (for logout/login)
  const resetOnboardingData = () => {
    setOnboardingData({});
  };
  
  resetOnboardingDataRef.current = resetOnboardingData;
  
  // Expose reset function globally so it can be called from clearAllCaches
  if (typeof global !== 'undefined') {
    global.resetOnboardingData = resetOnboardingData;
  }
  
  return (
    <OnboardingContext.Provider value={{ onboardingData, setOnboardingData, resetOnboardingData }}>
      {children}
    </OnboardingContext.Provider>
  );
}; 