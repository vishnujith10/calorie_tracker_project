import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { CalorieStreakTracker, WorkoutStreakTracker } from './streakTrackers';

const WORKOUT_STREAK_KEY = 'workout_streak_';
const CALORIE_STREAK_KEY = 'calorie_streak_';

/**
 * Load workout streak from AsyncStorage
 */
export async function loadWorkoutStreak(userId) {
  try {
    const key = `${WORKOUT_STREAK_KEY}${userId}`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return new WorkoutStreakTracker(parsed);
    }
    return new WorkoutStreakTracker();
  } catch (error) {
    console.error('Error loading workout streak:', error);
    return new WorkoutStreakTracker();
  }
}

/**
 * Save workout streak to AsyncStorage
 */
export async function saveWorkoutStreak(userId, tracker) {
  try {
    const key = `${WORKOUT_STREAK_KEY}${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(tracker.toJSON()));
  } catch (error) {
    console.error('Error saving workout streak:', error);
  }
}

/**
 * Load calorie streak from AsyncStorage
 */
export async function loadCalorieStreak(userId) {
  try {
    const key = `${CALORIE_STREAK_KEY}${userId}`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return new CalorieStreakTracker(parsed);
    }
    return new CalorieStreakTracker();
  } catch (error) {
    console.error('Error loading calorie streak:', error);
    return new CalorieStreakTracker();
  }
}

/**
 * Save calorie streak to AsyncStorage
 */
export async function saveCalorieStreak(userId, tracker) {
  try {
    const key = `${CALORIE_STREAK_KEY}${userId}`;
    await AsyncStorage.setItem(key, JSON.stringify(tracker.toJSON()));
  } catch (error) {
    console.error('Error saving calorie streak:', error);
  }
}

/**
 * Calculate workout streak from database
 */
export async function calculateWorkoutStreakFromDB(userId) {
  try {
    // Fetch all workouts and cardio sessions, ordered by date
    const { data: workouts } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: cardioSessions } = await supabase
      .from('saved_cardio_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Combine and sort all workout dates
    const allWorkouts = [
      ...(workouts || []).map(w => new Date(w.created_at)),
      ...(cardioSessions || []).map(c => new Date(c.created_at))
    ].sort((a, b) => b - a); // Sort descending (newest first)

    if (allWorkouts.length === 0) {
      return new WorkoutStreakTracker();
    }

    // Get unique dates (remove duplicates from same day)
    const uniqueDates = [];
    const seenDates = new Set();
    
    for (const date of allWorkouts) {
      const dateStr = date.toISOString().split('T')[0];
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        uniqueDates.push(date);
      }
    }

    // Calculate streak by iterating through dates
    const tracker = new WorkoutStreakTracker();
    
    // Process dates from oldest to newest to build streak
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      tracker.logWorkout(uniqueDates[i]);
    }

    return tracker;
  } catch (error) {
    console.error('Error calculating workout streak:', error);
    return new WorkoutStreakTracker();
  }
}

/**
 * Calculate calorie streak from database
 */
export async function calculateCalorieStreakFromDB(userId) {
  try {
    // Fetch all food logs, ordered by date
    const { data: foodLogs } = await supabase
      .from('food_logs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!foodLogs || foodLogs.length === 0) {
      return new CalorieStreakTracker();
    }

    // Get unique dates (one log per day counts)
    const uniqueDates = [];
    const seenDates = new Set();
    
    for (const log of foodLogs) {
      const date = new Date(log.created_at);
      const dateStr = date.toISOString().split('T')[0];
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        uniqueDates.push(date);
      }
    }

    // Calculate streak by iterating through dates
    const tracker = new CalorieStreakTracker();
    
    // Process dates from oldest to newest to build streak
    for (let i = uniqueDates.length - 1; i >= 0; i--) {
      tracker.logCalorieTracking(uniqueDates[i], true);
    }

    return tracker;
  } catch (error) {
    console.error('Error calculating calorie streak:', error);
    return new CalorieStreakTracker();
  }
}

/**
 * Get workout dates for the current week (for calendar display)
 */
export async function getWorkoutDatesForWeek(userId, weekStart, weekEnd) {
  try {
    const { data: workouts } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    const { data: cardioSessions } = await supabase
      .from('saved_cardio_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString());

    const allWorkouts = [
      ...(workouts || []).map(w => new Date(w.created_at)),
      ...(cardioSessions || []).map(c => new Date(c.created_at))
    ];

    // Get unique dates
    const workoutDates = new Set();
    for (const date of allWorkouts) {
      const dateStr = date.toISOString().split('T')[0];
      workoutDates.add(dateStr);
    }

    return Array.from(workoutDates);
  } catch (error) {
    console.error('Error fetching workout dates:', error);
    return [];
  }
}

