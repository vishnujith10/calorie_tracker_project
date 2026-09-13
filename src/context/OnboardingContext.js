import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OnboardingContext = createContext();

export const ONBOARDING_STORAGE_KEY = 'calora_onboarding_data';

export const OnboardingProvider = ({ children }) => {
  const [onboardingData, setOnboardingDataState] = useState({});
  const onboardingDataRef = useRef({});

  useEffect(() => {
    onboardingDataRef.current = onboardingData;
  }, [onboardingData]);

  // Restore onboarding data from AsyncStorage on app launch
  useEffect(() => {
    const restoreData = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            console.log('📦 Restored onboarding data from AsyncStorage:', Object.keys(parsed));
            setOnboardingDataState(prev => ({ ...parsed, ...prev }));
          }
        }
      } catch (err) {
        console.warn('Error restoring onboarding data from storage:', err);
      }
    };
    restoreData();
  }, []);

  // Safe updater that always merges with prev state and persists to AsyncStorage
  const setOnboardingData = useCallback((updater) => {
    setOnboardingDataState((prev) => {
      const incoming = typeof updater === 'function' ? updater(prev) : updater;
      const next = { ...prev, ...incoming };
      onboardingDataRef.current = next;

      AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next)).catch((err) => {
        console.warn('Failed to persist onboardingData to storage:', err);
      });

      return next;
    });
  }, []);

  // Function to reset onboarding data (for logout)
  const resetOnboardingData = useCallback(async () => {
    setOnboardingDataState({});
    onboardingDataRef.current = {};
    try {
      await AsyncStorage.multiRemove([
        ONBOARDING_STORAGE_KEY,
        'onboardingData',
        'calora_onboarding_weight',
        'calora_onboarding_height',
        'calora_onboarding_unit',
      ]);
    } catch (err) {
      console.warn('Failed to clear onboarding storage:', err);
    }
  }, []);

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