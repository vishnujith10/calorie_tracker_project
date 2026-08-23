// Centralized cache manager for optimistic updates (Instagram pattern)

// Main Dashboard Cache
const mainDashboardCache = {
  isFetching: false,
  lastFetchTime: 0,
  lastHydrationFetch: 0,
  CACHE_DURATION: 30000, // 30 seconds (reduced for faster updates)
  STALE_TIME: 5000, // 5 seconds (reduced for faster revalidation)
  cachedData: null,
  cachedHydrationData: null,
  cacheHits: 0,
  cacheMisses: 0,
  _listeners: new Set(), // For notifying listeners of cache updates
};

// Home Screen Cache
const homeScreenCache = {
  isFetching: false,
  lastFetchTime: 0,
  CACHE_DURATION: 60000, // 60 seconds
  STALE_TIME: 10000, // 10 seconds
  cachedData: null,
  cacheHits: 0,
  cacheMisses: 0,
};

// Export cache objects
export const getMainDashboardCache = () => mainDashboardCache;
export const getHomeScreenCache = () => homeScreenCache;

// Subscribe to cache updates
export const subscribeToMainDashboardCache = (callback) => {
  mainDashboardCache._listeners.add(callback);
  return () => {
    mainDashboardCache._listeners.delete(callback);
  };
};

// Optimistic update for MainDashboard - increment values
export const updateMainDashboardCacheOptimistic = (newData) => {
  if (mainDashboardCache.cachedData) {
    // Increment existing values - create new object reference to trigger React updates
    mainDashboardCache.cachedData = {
      ...mainDashboardCache.cachedData,
      calories: (mainDashboardCache.cachedData.calories || 0) + (newData.calories || 0),
      mealsLogged: (mainDashboardCache.cachedData.mealsLogged || 0) + 1,
      recentMeals: [newData, ...(mainDashboardCache.cachedData.recentMeals || [])].slice(0, 5),
    };
    // Reset cache timestamp to make it fresh (Instagram pattern)
    mainDashboardCache.lastFetchTime = Date.now();
  } else {
    // If no cache exists, create initial cache with this data
    mainDashboardCache.cachedData = {
      calories: newData.calories || 0,
      mealsLogged: 1,
      recentMeals: [newData],
      sleepLogs: [],
      todaySleepLog: null,
      sleepGoal: 8,
      todayWorkouts: 0,
    };
    mainDashboardCache.lastFetchTime = Date.now();
  }
  
  // Notify listeners of cache update
  mainDashboardCache._listeners.forEach(listener => listener());
};

// Optimistic streak update - trigger streak refetch when food is logged
export const updateMainDashboardStreakOptimistic = () => {
  // Mark streak cache as stale to force immediate refetch
  // This will be handled by the listener in MainDashboardScreen
  if (mainDashboardCache._streakListeners) {
    mainDashboardCache._streakListeners.forEach(listener => listener());
  }
};

// Optimistic update for HomeScreen - increment values
export const updateHomeScreenCacheOptimistic = (newData) => {
  if (homeScreenCache.cachedData) {
    const currentTotals = homeScreenCache.cachedData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    
    homeScreenCache.cachedData = {
      ...homeScreenCache.cachedData,
      foodLogs: [newData, ...(homeScreenCache.cachedData.foodLogs || [])],
      totals: {
        calories: currentTotals.calories + (newData.calories || 0),
        protein: currentTotals.protein + (newData.protein || 0),
        carbs: currentTotals.carbs + (newData.carbs || 0),
        fat: currentTotals.fat + (newData.fat || 0),
        fiber: currentTotals.fiber + (newData.fiber || 0),
      },
      recentMeals: [newData, ...(homeScreenCache.cachedData.recentMeals || [])].slice(0, 5),
    };
    // Reset cache timestamp to make it fresh (Instagram pattern)
    homeScreenCache.lastFetchTime = Date.now();
  } else {
    // If no cache exists, create initial cache with this data
    homeScreenCache.cachedData = {
      foodLogs: [newData],
      totals: {
        calories: newData.calories || 0,
        protein: newData.protein || 0,
        carbs: newData.carbs || 0,
        fat: newData.fat || 0,
        fiber: newData.fiber || 0,
      },
      recentMeals: [newData],
    };
    homeScreenCache.lastFetchTime = Date.now();
  }
};

// Invalidate caches
export const invalidateMainDashboardCache = () => {
  mainDashboardCache.lastFetchTime = 0;
  mainDashboardCache.cachedData = null;
  mainDashboardCache.cacheMisses++;
};

export const invalidateHomeScreenCache = () => {
  homeScreenCache.lastFetchTime = 0;
  homeScreenCache.cachedData = null;
  homeScreenCache.cacheMisses++;
};

// Optimistic update for workout completion
export const updateMainDashboardWorkoutCache = () => {
  if (mainDashboardCache.cachedData) {
    mainDashboardCache.cachedData = {
      ...mainDashboardCache.cachedData,
      todayWorkouts: (mainDashboardCache.cachedData.todayWorkouts || 0) + 1,
    };
    // Reset cache timestamp to make it fresh
    mainDashboardCache.lastFetchTime = Date.now();
  }
};

// Optimistic update for sleep log
export const updateMainDashboardSleepCache = (sleepData) => {
  if (mainDashboardCache.cachedData) {
    const todayStr = new Date().toISOString().slice(0, 10);
    
    // Create new sleep log object
    const newSleepLog = {
      date: sleepData.date || todayStr,
      duration: sleepData.duration,
      quality: sleepData.quality,
      mood: sleepData.mood,
      sleep_goal: sleepData.sleep_goal,
    };
    
    // Update or add today's sleep log
    const existingLogs = mainDashboardCache.cachedData.sleepLogs || [];
    const todayLogIndex = existingLogs.findIndex(log => log.date?.slice(0, 10) === todayStr);
    
    if (todayLogIndex !== -1) {
      // Update existing log
      existingLogs[todayLogIndex] = newSleepLog;
    } else {
      // Add new log
      existingLogs.unshift(newSleepLog);
    }
    
    mainDashboardCache.cachedData = {
      ...mainDashboardCache.cachedData,
      sleepLogs: existingLogs,
      todaySleepLog: newSleepLog,
      sleepGoal: sleepData.sleep_goal,
    };
    
    // Reset cache timestamp to make it fresh
    mainDashboardCache.lastFetchTime = Date.now();
  }
};

// Invalidate all caches
export const invalidateAllCaches = () => {
  invalidateMainDashboardCache();
  invalidateHomeScreenCache();
};

// Clear all global caches (for logout/login)
export const clearAllGlobalCaches = () => {
  // Clear centralized caches
  invalidateAllCaches();
  
  // Clear other global caches by resetting them
  // Note: This function should be called from screens that define these caches
  // We'll export a helper that screens can use to clear their own caches
  console.log('🧹 Clearing all global caches...');
};

