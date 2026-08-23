// Utility to clear all global caches on logout/login
// This prevents showing previous user's data when switching accounts

import { invalidateAllCaches } from './cacheManager';

// Clear all global caches
export const clearAllGlobalCaches = () => {
  console.log('🧹 Clearing all global caches...');
  
  // Clear centralized caches
  invalidateAllCaches();
  
  // Clear other global caches by accessing them through their modules
  // We'll need to dynamically require and clear each cache
  
  try {
    // ProfileScreen cache
    const ProfileScreen = require('../profilescreen/ProfileScreen');
    if (ProfileScreen.globalProfileCache) {
      ProfileScreen.globalProfileCache.lastFetchTime = 0;
      ProfileScreen.globalProfileCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear ProfileScreen cache:', e.message);
  }
  
  try {
    // AppSettingsScreen cache
    const AppSettingsScreen = require('../profilescreen/AppSettingsScreen');
    if (AppSettingsScreen.globalSettingsCache) {
      AppSettingsScreen.globalSettingsCache.lastFetchTime = 0;
      AppSettingsScreen.globalSettingsCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear AppSettingsScreen cache:', e.message);
  }
  
  try {
    // HydrationTrackerScreen cache
    const HydrationTrackerScreen = require('../hydrationscreen/HydrationTrackerScreen');
    if (HydrationTrackerScreen.globalHydrationCache) {
      HydrationTrackerScreen.globalHydrationCache.lastFetchTime = 0;
      HydrationTrackerScreen.globalHydrationCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear HydrationTrackerScreen cache:', e.message);
  }
  
  try {
    // StepTrackerScreen cache
    const StepTrackerScreen = require('../steptrackerscreen/StepTrackerScreen');
    if (StepTrackerScreen.globalStepCache) {
      StepTrackerScreen.globalStepCache.lastFetchTime = 0;
      StepTrackerScreen.globalStepCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear StepTrackerScreen cache:', e.message);
  }
  
    // ExerciseScreen cache removed
  
    // WeightTrackerScreen cache removed
  
  try {
    // SleepTrackerScreen cache
    const SleepTrackerScreen = require('../sleepscreen/SleepTrackerScreen');
    if (SleepTrackerScreen.globalSleepCache) {
      SleepTrackerScreen.globalSleepCache.lastFetchTime = 0;
      SleepTrackerScreen.globalSleepCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear SleepTrackerScreen cache:', e.message);
  }
  
  try {
    // ProgressScreen cache
    const ProgressScreen = require('../caloriescreen/ProgressScreen');
    if (ProgressScreen.globalProgressCache) {
      ProgressScreen.globalProgressCache.lastFetchTime = 0;
      ProgressScreen.globalProgressCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear ProgressScreen cache:', e.message);
  }
  
  try {
    // SavedMealsScreen cache
    const SavedMealsScreen = require('../caloriescreen/SavedMealsScreen');
    if (SavedMealsScreen.globalSavedMealsCache) {
      SavedMealsScreen.globalSavedMealsCache.lastFetchTime = 0;
      SavedMealsScreen.globalSavedMealsCache.cachedData = null;
    }
  } catch (e) {
    console.log('Could not clear SavedMealsScreen cache:', e.message);
  }
  
  // Clear streak cache from MainDashboardScreen
  try {
    const MainDashboardScreen = require('../homescreens/MainDashboardScreen');
    if (MainDashboardScreen.streakCache) {
      MainDashboardScreen.streakCache.lastFetch = 0;
      MainDashboardScreen.streakCache.cachedStreak = null;
    }
  } catch (e) {
    console.log('Could not clear streak cache:', e.message);
  }
  
  // Clear userNameCache from HomeScreen
  try {
    const HomeScreen = require('../homescreens/HomeScreen');
    if (HomeScreen.userNameCache) {
      HomeScreen.userNameCache.lastFetch = 0;
      HomeScreen.userNameCache.cachedName = null;
    }
  } catch (e) {
    console.log('Could not clear userNameCache:', e.message);
  }
  
  // Reset OnboardingContext (clears username and other onboarding data)
  try {
    if (typeof global !== 'undefined' && global.resetOnboardingData) {
      global.resetOnboardingData();
      console.log('✅ OnboardingContext reset');
    }
  } catch (e) {
    console.log('Could not reset OnboardingContext:', e.message);
  }
  
  // Note: Other non-exported caches will naturally expire when screens check cache validity.
  
  console.log('✅ All caches cleared');
};

