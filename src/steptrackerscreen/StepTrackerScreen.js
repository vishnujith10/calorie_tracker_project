// StepTrackerScreen.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';
import useTodaySteps from '../utils/useTodaySteps';

// Global cache for StepTrackerScreen (Instagram pattern - like HydrationTrackerScreen)
const globalStepCache = {
  lastFetchTime: 0,
  CACHE_DURATION: 60000, // 60 seconds (same as HydrationTrackerScreen)
  cachedData: null,
};

const StepTrackerScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const palette = useMemo(() => createPalette(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(palette, isDark), [palette, isDark]);
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(10000);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10000);
  const [showManualStepModal, setShowManualStepModal] = useState(false);
  const [manualSteps, setManualSteps] = useState('');
  // Initialize state with cached data (Instagram pattern - like HydrationTrackerScreen)
  const [weeklyStepsData, setWeeklyStepsData] = useState(() => globalStepCache.cachedData?.weeklyStepsData || {});
  const [weeklyGoalsData, setWeeklyGoalsData] = useState(() => globalStepCache.cachedData?.weeklyGoalsData || {});
  const [lastWeekAverage, setLastWeekAverage] = useState(() => globalStepCache.cachedData?.lastWeekAverage || 0);
  const [thisWeekAverage, setThisWeekAverage] = useState(() => globalStepCache.cachedData?.thisWeekAverage || 0);
  const [goalConsistency, setGoalConsistency] = useState(() => globalStepCache.cachedData?.goalConsistency || 0);
  const [isFetching, setIsFetching] = useState(false);
  
  // Refs to track previous values and prevent unnecessary re-renders
  const prevStepsTodayRef = React.useRef(0);
  const prevDistanceKmRef = React.useRef(0);
  const prevCaloriesRef = React.useRef(0);
  
  // State for display values (only updates when values change significantly)
  const [displayStepsToday, setDisplayStepsToday] = useState(() => globalStepCache.cachedData?.displayStepsToday || 0);
  const [displayDistanceKm, setDisplayDistanceKm] = useState(() => globalStepCache.cachedData?.displayDistanceKm || 0);
  const [displayCalories, setDisplayCalories] = useState(() => globalStepCache.cachedData?.displayCalories || 0);
  
  // Step counter hook
  const { 
    stepsToday, 
    distanceKm, 
    calories, 
    saveGoalToDatabase,
    loadGoalFromDatabase,
    resetSteps,
    addTestSteps
  } = useTodaySteps();
  
  // Only update display state when values change significantly (prevent unnecessary re-renders)
  useEffect(() => {
    // Steps: only update if change >= 1 step
    if (Math.abs(stepsToday - prevStepsTodayRef.current) >= 1) {
      prevStepsTodayRef.current = stepsToday;
      setDisplayStepsToday(stepsToday);
      // Update cache
      if (globalStepCache.cachedData) {
        globalStepCache.cachedData.displayStepsToday = stepsToday;
      }
    }
  }, [stepsToday]);
  
  useEffect(() => {
    // Distance: only update if change >= 0.01 km
    if (Math.abs(distanceKm - prevDistanceKmRef.current) >= 0.01) {
      prevDistanceKmRef.current = distanceKm;
      setDisplayDistanceKm(distanceKm);
      // Update cache
      if (globalStepCache.cachedData) {
        globalStepCache.cachedData.displayDistanceKm = distanceKm;
      }
    }
  }, [distanceKm]);
  
  useEffect(() => {
    // Calories: only update if change >= 1 kcal
    if (Math.abs(calories - prevCaloriesRef.current) >= 1) {
      prevCaloriesRef.current = calories;
      setDisplayCalories(calories);
      // Update cache
      if (globalStepCache.cachedData) {
        globalStepCache.cachedData.displayCalories = calories;
      }
    }
  }, [calories]);
  
  // Use display state values (prevents re-renders when hook updates frequently)
  const memoizedStepsToday = displayStepsToday;
  const memoizedDistanceKm = displayDistanceKm;
  const memoizedCalories = displayCalories;

  // Helper functions for week management
  const getTodayIndex = () => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to index 6, others to index-1
  };

  const getWeekStartDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const getCurrentWeekDates = () => {
    const weekStart = new Date(getWeekStartDate());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const todayIndex = getTodayIndex();

  // Get user ID
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id || null);
      } catch (error) {
        console.error('Error getting user ID:', error);
      }
    };
    getUserId();
  }, []);

  // Get last week dates
  const getLastWeekDates = () => {
    const weekStart = new Date(getWeekStartDate());
    weekStart.setDate(weekStart.getDate() - 7); // Go back 7 days
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  // Load weekly data from database with caching
  const loadWeeklyData = useCallback(async (userId) => {
    if (!userId || isFetching) return;
    
    setIsFetching(true);
    
    try {
      const thisWeekDates = getCurrentWeekDates();
      const lastWeekDates = getLastWeekDates();
      
      // Fetch both this week and last week data
      const { data: allRecords, error } = await supabase
        .from('steps')
        .select('id, date, steps, goal')
        .eq('user_id', userId)
        .or(`date.in.(${[...thisWeekDates, ...lastWeekDates].join(',')})`)
        .order('date', { ascending: false });

      if (error) throw error;

      // Remove duplicates: keep only the most recent record per date
      const uniqueRecords = [];
      const seenDates = new Set();
      
      if (allRecords) {
        for (const record of allRecords) {
          if (!seenDates.has(record.date)) {
            seenDates.add(record.date);
            uniqueRecords.push(record);
          }
        }
      }

      // Convert data to our weekly format
      const weeklySteps = {};
      const weeklyGoals = {};
      const lastWeekSteps = [];
      const thisWeekSteps = [];
      let daysMetGoal = 0;
      let totalDaysWithData = 0;
      
      uniqueRecords.forEach(record => {
        // This week data
        const thisWeekIndex = thisWeekDates.indexOf(record.date);
        if (thisWeekIndex !== -1) {
          weeklySteps[thisWeekIndex] = record.steps || 0;
          weeklyGoals[thisWeekIndex] = record.goal || 10000;
          thisWeekSteps.push(record.steps || 0);
          
          // Check if goal was met
          if ((record.steps || 0) >= (record.goal || 10000)) {
            daysMetGoal++;
          }
          if (record.steps > 0 || record.goal) {
            totalDaysWithData++;
          }
        }
        
        // Last week data
        const lastWeekIndex = lastWeekDates.indexOf(record.date);
        if (lastWeekIndex !== -1) {
          lastWeekSteps.push(record.steps || 0);
        }
      });

      // Calculate averages
      const thisWeekSum = thisWeekSteps.reduce((sum, steps) => sum + steps, 0);
      const lastWeekSum = lastWeekSteps.reduce((sum, steps) => sum + steps, 0);
      
      const thisWeekAvg = thisWeekSteps.length > 0 ? Math.round(thisWeekSum / Math.max(thisWeekSteps.length, 1)) : 0;
      const lastWeekAvg = lastWeekSteps.length > 0 ? Math.round(lastWeekSum / Math.max(lastWeekSteps.length, 1)) : 0;
      
      // Calculate goal consistency (percentage of days goal was met)
      const consistency = totalDaysWithData > 0 ? Math.round((daysMetGoal / totalDaysWithData) * 100) : 0;

      // Update cache immediately (like HydrationTrackerScreen)
      globalStepCache.cachedData = {
        ...globalStepCache.cachedData,
        weeklyStepsData: weeklySteps,
        weeklyGoalsData: weeklyGoals,
        lastWeekAverage: lastWeekAvg,
        thisWeekAverage: thisWeekAvg,
        goalConsistency: consistency,
      };
      globalStepCache.lastFetchTime = Date.now();

      setWeeklyStepsData(weeklySteps);
      setWeeklyGoalsData(weeklyGoals);
      setLastWeekAverage(lastWeekAvg);
      setThisWeekAverage(thisWeekAvg);
      setGoalConsistency(consistency);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    } finally {
      setIsFetching(false);
    }
    // getCurrentWeekDates and getLastWeekDates are stable functions defined outside component
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching]);

  // Load data on mount and when userId changes (like HydrationTrackerScreen - no useFocusEffect)
  useEffect(() => {
    if (!userId) return;
    
    const now = Date.now();
    const timeSinceLastFetch = now - globalStepCache.lastFetchTime;
    const isCacheValid = timeSinceLastFetch < globalStepCache.CACHE_DURATION;

    // If cache is valid, restore from cache and skip fetch (like HydrationTrackerScreen)
    if (isCacheValid && globalStepCache.cachedData) {
      const cached = globalStepCache.cachedData;
      
      // Only update state if values actually changed (prevent unnecessary re-renders)
      setWeeklyStepsData(prev => {
        let needsUpdate = false;
        for (let i = 0; i < 7; i++) {
          if ((prev[i] || 0) !== (cached.weeklyStepsData?.[i] || 0)) {
            needsUpdate = true;
            break;
          }
        }
        return needsUpdate ? (cached.weeklyStepsData || {}) : prev;
      });
      
      setWeeklyGoalsData(prev => {
        let needsUpdate = false;
        for (let i = 0; i < 7; i++) {
          if ((prev[i] || 10000) !== (cached.weeklyGoalsData?.[i] || 10000)) {
            needsUpdate = true;
            break;
          }
        }
        return needsUpdate ? (cached.weeklyGoalsData || {}) : prev;
      });
      
      if (lastWeekAverage !== cached.lastWeekAverage) {
        setLastWeekAverage(cached.lastWeekAverage || 0);
      }
      if (thisWeekAverage !== cached.thisWeekAverage) {
        setThisWeekAverage(cached.thisWeekAverage || 0);
      }
      if (goalConsistency !== cached.goalConsistency) {
        setGoalConsistency(cached.goalConsistency || 0);
      }
      
      // Restore display values from cache (prevent re-renders from hook updates)
      if (cached.displayStepsToday !== undefined && cached.displayStepsToday !== displayStepsToday) {
        setDisplayStepsToday(cached.displayStepsToday);
        prevStepsTodayRef.current = cached.displayStepsToday;
      }
      if (cached.displayDistanceKm !== undefined && cached.displayDistanceKm !== displayDistanceKm) {
        setDisplayDistanceKm(cached.displayDistanceKm);
        prevDistanceKmRef.current = cached.displayDistanceKm;
      }
      if (cached.displayCalories !== undefined && cached.displayCalories !== displayCalories) {
        setDisplayCalories(cached.displayCalories);
        prevCaloriesRef.current = cached.displayCalories;
      }
      
      // Load goal only if needed (don't cause re-render if same)
      loadGoalFromDatabase().then(dbGoal => {
        if (dbGoal && dbGoal !== goal) {
          setGoal(dbGoal);
        } else if (!dbGoal && goal !== 10000) {
          setGoal(10000);
        }
      });
      
      return; // Skip fetch if cache is valid
    }

    // Cache is invalid or doesn't exist - load fresh data
    const loadData = async () => {
      try {
        // Load goal from database (step_goals table) - persists across days
        const dbGoal = await loadGoalFromDatabase();
        if (dbGoal && dbGoal !== goal) {
          setGoal(dbGoal);
        } else if (!dbGoal && goal !== 10000) {
          setGoal(10000);
        }
        
        // Load weekly data
        await loadWeeklyData(userId);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSaveGoal = useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'No user ID found');
      return;
    }
    
    // Save to database (step_goals table) - this persists across days
    try {
      const dbSuccess = await saveGoalToDatabase(newGoal);
      
      if (dbSuccess) {
        // Update UI state
        setGoal(newGoal);
        
        // Invalidate cache by resetting lastFetchTime (like HydrationTrackerScreen)
        globalStepCache.lastFetchTime = 0;
        
        // Close modal and show success
        setTimeout(() => {
          setShowGoalModal(false);
          Alert.alert('Success', `Goal updated to ${newGoal.toLocaleString()} steps!`);
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to save goal to database. Please try again.');
        return;
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      Alert.alert('Error', 'Failed to save goal. Please try again.');
      return;
    }
  }, [userId, newGoal, saveGoalToDatabase]);

  const openGoalModal = useCallback(() => {
    setNewGoal(goal);
    setShowGoalModal(true);
  }, [goal]);

  const handleAddManualSteps = useCallback(async () => {
    const stepsToAdd = parseInt(manualSteps, 10);
    if (isNaN(stepsToAdd) || stepsToAdd <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of steps');
      return;
    }
    
    // Close modal and reset input first
    setShowManualStepModal(false);
    setManualSteps('');
    
    // Calculate new total before adding
    const newTotalSteps = memoizedStepsToday + stepsToAdd;
    
    // Update weekly data optimistically (update today's bar immediately)
    setWeeklyStepsData(prev => {
      const updated = { ...prev };
      updated[todayIndex] = newTotalSteps;
      
      // Recalculate this week's average immediately with updated data
      const thisWeekSteps = [];
      for (let i = 0; i < 7; i++) {
        if (i === todayIndex) {
          thisWeekSteps.push(newTotalSteps);
        } else {
          thisWeekSteps.push(prev[i] || 0);
        }
      }
      const thisWeekSum = thisWeekSteps.reduce((sum, s) => sum + s, 0);
      const thisWeekAvg = thisWeekSteps.length > 0 ? Math.round(thisWeekSum / Math.max(thisWeekSteps.length, 1)) : 0;
      setThisWeekAverage(thisWeekAvg);
      
      return updated;
    });
    
    // Add steps using the addTestSteps function (this saves to DB immediately)
    await addTestSteps(stepsToAdd);
    
    // Invalidate cache by resetting lastFetchTime (like HydrationTrackerScreen)
    globalStepCache.lastFetchTime = 0;
    
    // Reload weekly data from database after a short delay to ensure it's saved
    if (userId) {
      setTimeout(() => {
        loadWeeklyData(userId);
      }, 500);
    }
    
    Alert.alert('Success', `Added ${stepsToAdd.toLocaleString()} steps!`);
  }, [manualSteps, addTestSteps, memoizedStepsToday, todayIndex, userId, loadWeeklyData]);

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Delete today's data and refresh
  const handleDeleteTodayData = useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'No user ID found');
      return;
    }

    Alert.alert(
      'Delete Today\'s Data',
      'Are you sure you want to refresh today\'s step data?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const todayDate = getCurrentDate();
              
              console.log('🗑️ Attempting to delete:', { 
                userId, 
                todayDate,
                todayDateType: typeof todayDate,
                userIdType: typeof userId
              });
              
              // First, check if the record exists
              const { data: existingRecords, error: checkError } = await supabase
                .from('steps')
                .select('*')
                .eq('user_id', userId)
                .eq('date', todayDate);
              
              console.log('📋 Existing records:', existingRecords);
              console.log('Check error:', checkError);
              
              if (!existingRecords || existingRecords.length === 0) {
                console.log('⚠️ No records found for today');
                Alert.alert('Info', 'No step data found for today');
                return;
              }
              
              // Delete from database
              const { data: deletedData, error: deleteError } = await supabase
                .from('steps')
                .delete()
                .eq('user_id', userId)
                .eq('date', todayDate)
                .select(); // Return deleted rows

              if (deleteError) {
                console.error('❌ Delete error:', deleteError);
                throw deleteError;
              }

              console.log('✅ Deleted successfully:', deletedData);
              console.log('Number of rows deleted:', deletedData?.length || 0);

              // Clear AsyncStorage for today's steps
              try {
                const todayKey = `steps_${todayDate}`;
                await AsyncStorage.removeItem(todayKey);
                console.log('🗑️ Cleared AsyncStorage:', todayKey);
              } catch (storageError) {
                console.log('⚠️ Failed to clear AsyncStorage:', storageError);
              }

              // Reset step counter to 0 immediately
              resetSteps();
              console.log('🔄 Step counter reset to 0');

              // Clear cache to force refresh (like HydrationTrackerScreen)
              globalStepCache.cachedData = null;
              globalStepCache.lastFetchTime = 0;

              // Reload data
              await loadWeeklyData(userId);
            } catch (error) {
              console.error('💥 Error deleting today\'s data:', error);
              Alert.alert('Error', `Failed to delete: ${error.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  }, [userId, loadWeeklyData, resetSteps]);

  // Memoize percent calculation to prevent unnecessary re-renders
  const percent = useMemo(() => {
    if (!goal || goal === 0) return 0;
    return Math.min(Math.round((memoizedStepsToday / goal) * 100), 100);
  }, [memoizedStepsToday, goal]);

  // Weekly data with dynamic today's progress - Memoized to prevent re-renders
  const weeklyData = useMemo(() => [
    { 
      day: 'M', 
      steps: todayIndex === 0 ? memoizedStepsToday : (weeklyStepsData[0] || 0), 
      isToday: todayIndex === 0,
      goalAchieved: todayIndex === 0 ? memoizedStepsToday >= goal : (weeklyStepsData[0] || 0) >= (weeklyGoalsData[0] || goal),
      dayGoal: todayIndex === 0 ? goal : (weeklyGoalsData[0] || goal)
    },
    { 
      day: 'T', 
      steps: todayIndex === 1 ? memoizedStepsToday : (weeklyStepsData[1] || 0), 
      isToday: todayIndex === 1,
      goalAchieved: todayIndex === 1 ? memoizedStepsToday >= goal : (weeklyStepsData[1] || 0) >= (weeklyGoalsData[1] || goal),
      dayGoal: todayIndex === 1 ? goal : (weeklyGoalsData[1] || goal)
    },
    { 
      day: 'W', 
      steps: todayIndex === 2 ? memoizedStepsToday : (weeklyStepsData[2] || 0), 
      isToday: todayIndex === 2,
      goalAchieved: todayIndex === 2 ? memoizedStepsToday >= goal : (weeklyStepsData[2] || 0) >= (weeklyGoalsData[2] || goal),
      dayGoal: todayIndex === 2 ? goal : (weeklyGoalsData[2] || goal)
    },
    { 
      day: 'T', 
      steps: todayIndex === 3 ? memoizedStepsToday : (weeklyStepsData[3] || 0), 
      isToday: todayIndex === 3,
      goalAchieved: todayIndex === 3 ? memoizedStepsToday >= goal : (weeklyStepsData[3] || 0) >= (weeklyGoalsData[3] || goal),
      dayGoal: todayIndex === 3 ? goal : (weeklyGoalsData[3] || goal)
    },
    { 
      day: 'F', 
      steps: todayIndex === 4 ? memoizedStepsToday : (weeklyStepsData[4] || 0), 
      isToday: todayIndex === 4,
      goalAchieved: todayIndex === 4 ? memoizedStepsToday >= goal : (weeklyStepsData[4] || 0) >= (weeklyGoalsData[4] || goal),
      dayGoal: todayIndex === 4 ? goal : (weeklyGoalsData[4] || goal)
    },
    { 
      day: 'S', 
      steps: todayIndex === 5 ? memoizedStepsToday : (weeklyStepsData[5] || 0), 
      isToday: todayIndex === 5,
      goalAchieved: todayIndex === 5 ? memoizedStepsToday >= goal : (weeklyStepsData[5] || 0) >= (weeklyGoalsData[5] || goal),
      dayGoal: todayIndex === 5 ? goal : (weeklyGoalsData[5] || goal)
    },
    { 
      day: 'S', 
      steps: todayIndex === 6 ? memoizedStepsToday : (weeklyStepsData[6] || 0), 
      isToday: todayIndex === 6,
      goalAchieved: todayIndex === 6 ? memoizedStepsToday >= goal : (weeklyStepsData[6] || 0) >= (weeklyGoalsData[6] || goal),
      dayGoal: todayIndex === 6 ? goal : (weeklyGoalsData[6] || goal)
    }
  ], [todayIndex, memoizedStepsToday, weeklyStepsData, weeklyGoalsData, goal]);

  const getBarHeight = useCallback((steps, dayGoal) => {
    const maxHeight = 120;
    const minHeight = 4; // Very small minimum
    
    if (steps === 0) {
      return minHeight;
    }
    
    const percentage = Math.min((steps / dayGoal) * 100, 100);
    // Add a multiplier to make small progress more visible
    const baseHeight = (percentage / 100) * maxHeight;
    // For small percentages, add extra height to make progress visible
    const boostedHeight = baseHeight < 20 ? baseHeight + (steps / dayGoal) * 30 : baseHeight;
    const calculatedHeight = Math.max(boostedHeight, minHeight);
    
    return calculatedHeight;
  }, []);

  // Animated Bar Component - Memoized for performance
  const AnimatedBar = React.memo(({ data }) => {
    const targetHeight = getBarHeight(data.steps, data.dayGoal);
    const targetColor = data.steps === 0 ? 0 : (data.goalAchieved ? 2 : 1);
    
    const [animatedHeight] = useState(new Animated.Value(targetHeight));
    const [animatedColor] = useState(new Animated.Value(targetColor));

    useEffect(() => {
      // Always animate to the target values
      Animated.timing(animatedHeight, {
        toValue: targetHeight,
        duration: 300,
        useNativeDriver: false,
      }).start();

      Animated.timing(animatedColor, {
        toValue: targetColor,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [data.steps, data.goalAchieved, data.dayGoal, targetHeight, targetColor, animatedHeight, animatedColor]);

    const backgroundColor = animatedColor.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [
        palette.progressBarBackground, 
        palette.primary, 
        palette.success
      ]
    });

    return (
      <View style={styles.barColumn}>
        <Animated.View
          style={[
            styles.bar,
            {
              height: animatedHeight,
              backgroundColor: backgroundColor,
              borderRadius: 4,
            }
          ]}
        />
        <Text style={[
          styles.dayLabel, 
          { 
            fontWeight: data.isToday ? 'bold' : 'normal',
            color: data.isToday ? palette.primary : palette.textMuted
          }
        ]}>
          {data.day}
        </Text>
      </View>
    );
  });
  
  AnimatedBar.displayName = 'AnimatedBar';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* Header - FIXED ICON NAME */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Step Counter</Text>
          <TouchableOpacity onPress={handleDeleteTodayData}>
            <Ionicons name="refresh" size={24} color={palette.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom >= 20 ? (40 + insets.bottom) : 40 }]}>

          {/* STEP COUNTER DISPLAY */}
          <View style={styles.overviewCard}>
            <TouchableOpacity 
              style={styles.addStepsButton}
              onPress={() => setShowManualStepModal(true)}
            >
              <Ionicons name="add" size={24} color={palette.primary} />
            </TouchableOpacity>
            <View style={styles.progressSection}>
              <View style={styles.circularProgress}>
                <View style={styles.progressRing}>
                  <View 
                    style={[
                      styles.progressArc, 
                      { 
                        transform: [{ rotate: `${-90 + (percent / 100) * 270}deg` }],
                        opacity: percent > 0 ? 1 : 0 
                      }
                    ]} 
                  />
                </View>
                <View style={styles.progressContent}>
                  <Text style={styles.stepsNumber}>
                    {memoizedStepsToday.toLocaleString()}
                  </Text>
                  <Text style={styles.stepsLabel}>steps</Text>
                </View>
              </View>
              
              <View style={styles.overviewText}>
                <Text style={styles.overviewTitle}>Today&apos;s Steps</Text>
                <Text style={styles.progressText}>
                  Progress: {percent}% of goal
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${percent}%` }]} />
                </View>
              </View>
            </View>

            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{memoizedDistanceKm.toFixed(2)} km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{memoizedCalories.toFixed(0)} kcal</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{goal.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Goal</Text>
              </View>
            </View>
          </View>

          {/* WEEKLY PROGRESS */}
          <View style={styles.weeklyCard}>
            <Text style={styles.weekTitle}>Weekly Progress</Text>
            <View style={styles.barChart}>
              {weeklyData.map((data, index) => (
                <AnimatedBar key={index} data={data} index={index} />
              ))}
            </View>
          </View>

          {/* HISTORY & COMPARISON */}
          <View style={styles.historyCard}>
            <Text style={styles.cardTitle}>History &amp; Comparison</Text>
            
            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>Last Week Average</Text>
              <Text style={styles.historyValue}>
                {lastWeekAverage.toLocaleString()} steps
              </Text>
            </View>

            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>This Week Average</Text>
              <Text style={styles.historyValue}>
                {thisWeekAverage.toLocaleString()} steps
                  </Text>
                </View>
            
            <View style={styles.historyRow}>
              <Text style={styles.historyLabel}>Goal Consistency</Text>
              <Text style={[styles.historyValue, styles.consistencyValue]}>
                {goalConsistency}%
                  </Text>
            </View>
          </View>

          {/* GOAL SETTING */}
          <View style={styles.goalCard}>
            <Text style={styles.cardTitle}>Set Your Daily Goal</Text>
            <Text style={styles.goalCurrentText}>Current Goal: {goal.toLocaleString()} steps</Text>
            
            <TouchableOpacity style={styles.setGoalButton} onPress={openGoalModal}>
              <Text style={styles.setGoalButtonText}>Set New Goal</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* Manual Step Logging Modal */}
        <Modal visible={showManualStepModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log Steps Manually</Text>
              
              <TextInput
                style={styles.customGoalInput}
                keyboardType="numeric"
                value={manualSteps}
                onChangeText={setManualSteps}
                placeholder="Enter number of steps"
                autoFocus
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => {
                    setShowManualStepModal(false);
                    setManualSteps('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]} 
                  onPress={handleAddManualSteps}
                >
                  <Text style={styles.saveButtonText}>Add Steps</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Goal Modal */}
        <Modal visible={showGoalModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
              
              <View style={styles.goalOptions}>
                {[5000, 7500, 10000, 13000, 15000].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setNewGoal(opt)}
                    style={[
                      styles.goalOption,
                      newGoal === opt && styles.goalOptionSelected
                    ]}
                  >
                    <Text style={[
                      styles.goalOptionText,
                      newGoal === opt && styles.goalOptionTextSelected
                    ]}>
                      {(opt / 1000).toFixed(0)}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.customGoalInput}
                keyboardType="numeric"
                value={String(newGoal)}
                onChangeText={text => {
                  const num = Number(text.replace(/[^0-9]/g, ''));
                  if (num >= 0 && num <= 50000) {
                    setNewGoal(num);
                  }
                }}
                placeholder="Enter custom goal"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => setShowGoalModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton]} 
                  onPress={handleSaveGoal}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const createPalette = (themeColors, isDark) => ({
  primary: themeColors.primary,
  background: themeColors.background,
  cardBackground: themeColors.cardBackground,
  textPrimary: themeColors.textPrimary,
  textSecondary: themeColors.textSecondary,
  textMuted: themeColors.textMuted,
  border: themeColors.border,
  shadow: themeColors.shadow || '#000',
  success: '#10b981',
  iconBackground: isDark ? '#2A2A3E' : '#F3F4F6',
  progressBarBackground: isDark ? '#2A2A3E' : '#E5E7EB',
});

const createStyles = (palette, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: palette.background,
    borderBottomWidth: isDark ? 1 : 0,
    borderBottomColor: palette.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // Will be adjusted dynamically via insets
  },
  overviewCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  addStepsButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.iconBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    zIndex: 10,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  circularProgress: {
    position: 'relative',
    width: 100,
    height: 100,
    marginRight: 24,
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: palette.primary,
    position: 'relative',
  },
  progressArc: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: 'transparent',
    borderTopColor: palette.primary,
    borderRightColor: palette.primary,
    borderBottomColor: palette.primary,
  },
  progressContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Bold',
    textAlign: 'center',
  },
  stepsLabel: {
    fontSize: 12,
    color: palette.textMuted,
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },
  overviewText: {
    flex: 1,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 8,
    fontFamily: 'Lexend-Bold',
  },
  progressText: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 12,
    fontFamily: 'Manrope-Regular',
  },
  progressBar: {
    height: 8,
    backgroundColor: palette.progressBarBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 4,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
    fontFamily: 'Manrope-Regular',
  },
  goalCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 16,
    padding: 20,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 12,
    fontFamily: 'Lexend-Bold',
  },
  goalCurrentText: {
    fontSize: 14,
    color: palette.textSecondary,
    marginBottom: 20,
    fontFamily: 'Manrope-Regular',
  },
  setGoalButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  setGoalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lexend-SemiBold',
  },
  // ... (keep existing modal styles)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: palette.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Bold',
  },
  goalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  goalOption: {
    backgroundColor: isDark ? '#2A2A3E' : '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 2,
    marginVertical: 4,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  goalOptionSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  goalOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.textPrimary,
    fontFamily: 'Lexend-Medium',
  },
  goalOptionTextSelected: {
    color: 'white',
  },
  customGoalInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    fontFamily: 'Manrope-Regular',
    color: palette.textPrimary,
    backgroundColor: isDark ? '#1E1F2C' : '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: isDark ? '#2A2A3E' : '#F3F4F6',
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  saveButton: {
    backgroundColor: palette.primary,
  },
  cancelButtonText: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Lexend-Medium',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Lexend-Medium',
  },
  weeklyCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 12,
    fontFamily: 'Lexend-Bold',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  bar: {
    width: '100%',
    maxWidth: 36,
    marginBottom: 8,
    minHeight: 4, // Ensure minimum visibility
  },
  dayLabel: {
    fontSize: 12,
    color: palette.textMuted,
    fontFamily: 'Manrope-Regular',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: palette.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: isDark ? 1 : 0,
    borderColor: palette.border,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  historyLabel: {
    fontSize: 14,
    color: palette.textSecondary,
    fontFamily: 'Manrope-Regular',
  },
  historyValue: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
    fontFamily: 'Lexend-SemiBold',
  },
  consistencyValue: {
    color: palette.success,
  },
});

// Wrap with React.memo to prevent unnecessary re-renders (Instagram pattern)
export default React.memo(StepTrackerScreen, (prevProps, nextProps) => {
  return prevProps.navigation === nextProps.navigation;
});