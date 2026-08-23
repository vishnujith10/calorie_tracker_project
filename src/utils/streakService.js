import supabase from '../lib/supabase';

/**
 * Get user's streak data from database
 */
export async function getUserStreaks(userId) {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle to avoid error when not found

    if (!data && !error) {
      // No streak record exists, create one
      return await createUserStreaks(userId);
    }

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('Error fetching streaks:', error);
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserStreaks:', error);
    return null;
  }
}

/**
 * Create initial streak record for user
 */
async function createUserStreaks(userId) {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .insert({
        user_id: userId,
        food_streak: 0,
        exercise_streak: 0,
        food_max_streak: 0,
        exercise_max_streak: 0,
        food_freezes_left: 3,
        exercise_buffer: 2
      })
      .select()
      .single();

    if (error) {
      // If duplicate key error, fetch existing record instead
      if (error.code === '23505') {
        console.log('Streak record already exists, fetching...');
        const { data: existingData } = await supabase
          .from('streaks')
          .select('*')
          .eq('user_id', userId)
          .single();
        return existingData;
      }
      
      console.error('Error creating streaks:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createUserStreaks:', error);
    return null;
  }
}

/**
 * Update food streak when user logs food
 */
export async function updateFoodStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return null;

    const today = new Date().toISOString().split('T')[0];
    const lastLogDate = streakData.food_last_log_date;

    let newStreak = streakData.food_streak;
    let freezesLeft = streakData.food_freezes_left;

    if (!lastLogDate) {
      // First time logging
      newStreak = 1;
    } else {
      const lastDate = new Date(lastLogDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Already logged today, no change
        return streakData;
      } else if (daysDiff === 1) {
        // Consecutive day
        newStreak += 1;
      } else if (daysDiff <= 3 && freezesLeft > 0) {
        // Missed days but have freezes
        freezesLeft -= 1;
        newStreak += 1;
      } else {
        // Streak broken
        newStreak = 1;
      }
    }

    const newMaxStreak = Math.max(newStreak, streakData.food_max_streak);

    const { data, error } = await supabase
      .from('streaks')
      .update({
        food_streak: newStreak,
        food_last_log_date: today,
        food_max_streak: newMaxStreak,
        food_freezes_left: freezesLeft
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating food streak:', error);
      return null;
    }

    console.log('✅ Food streak updated:', newStreak);
    return data;
  } catch (error) {
    console.error('Error in updateFoodStreak:', error);
    return null;
  }
}

/**
 * Update exercise streak when user completes workout
 */
export async function updateExerciseStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return null;

    const today = new Date().toISOString().split('T')[0];
    const lastLogDate = streakData.exercise_last_log_date;

    let newStreak = streakData.exercise_streak;
    let buffer = streakData.exercise_buffer;

    if (!lastLogDate) {
      // First time logging
      newStreak = 1;
    } else {
      const lastDate = new Date(lastLogDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Already logged today, no change
        return streakData;
      } else if (daysDiff === 1) {
        // Consecutive day
        newStreak += 1;
        buffer = 2; // Reset buffer
      } else if (daysDiff <= buffer + 1) {
        // Within buffer period
        newStreak += 1;
        buffer = Math.max(0, buffer - (daysDiff - 1));
      } else {
        // Streak broken - halve it (recovery bonus)
        newStreak = Math.max(1, Math.floor(newStreak / 2));
        buffer = 2;
      }
    }

    const newMaxStreak = Math.max(newStreak, streakData.exercise_max_streak);

    const { data, error } = await supabase
      .from('streaks')
      .update({
        exercise_streak: newStreak,
        exercise_last_log_date: today,
        exercise_max_streak: newMaxStreak,
        exercise_buffer: buffer
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise streak:', error);
      return null;
    }

    console.log('✅ Exercise streak updated:', newStreak);
    return data;
  } catch (error) {
    console.error('Error in updateExerciseStreak:', error);
    return null;
  }
}

/**
 * Get current food streak
 */
export async function getFoodStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return 0;

    // Check if streak is still valid
    if (!streakData.food_last_log_date) return 0;

    const lastDate = new Date(streakData.food_last_log_date);
    const today = new Date();
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    // Streak expires after 2 days (1 day grace period)
    if (daysDiff > 2) {
      return 0;
    }

    return streakData.food_streak;
  } catch (error) {
    console.error('Error in getFoodStreak:', error);
    return 0;
  }
}

/**
 * Get current exercise streak
 */
export async function getExerciseStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return 0;

    // Check if streak is still valid
    if (!streakData.exercise_last_log_date) return 0;

    const lastDate = new Date(streakData.exercise_last_log_date);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    // Streak expires after buffer + 1 days
    if (daysDiff > streakData.exercise_buffer + 1) {
      return 0;
    }

    // Check if there's actually a workout TODAY
    // This ensures we don't count today if user hasn't worked out today
    const [workoutsResult, cardioResult] = await Promise.all([
      supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${todayStr}T23:59:59`)
        .limit(1),
      supabase
        .from('saved_cardio_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${todayStr}T00:00:00`)
        .lt('created_at', `${todayStr}T23:59:59`)
        .limit(1)
    ]);

    const hasWorkoutToday = (workoutsResult.data && workoutsResult.data.length > 0) ||
                           (cardioResult.data && cardioResult.data.length > 0);

    // If last log date is today, verify there's actually a workout today
    if (daysDiff === 0) {
      if (hasWorkoutToday) {
        // Valid: last log is today and there's a workout today
        return streakData.exercise_streak;
      } else {
        // Invalid: last log says today but no workout found - recalculate
        console.log('⚠️ Last log date is today but no workout found, recalculating...');
        const recalculated = await recalculateExerciseStreak(userId);
        return recalculated?.exercise_streak || 0;
      }
    }

    // If last log was yesterday or earlier (daysDiff >= 1)
    if (hasWorkoutToday) {
      // User worked out today, so update streak
      await updateExerciseStreak(userId);
      const updatedData = await getUserStreaks(userId);
      return updatedData?.exercise_streak || streakData.exercise_streak;
    } else {
      // No workout today - don't count today in streak
      // Recalculate based on actual workout dates (excludes today)
      console.log('⚠️ No workout today, recalculating streak from actual workout dates...');
      const recalculated = await recalculateExerciseStreak(userId);
      return recalculated?.exercise_streak || 0;
    }
  } catch (error) {
    console.error('Error in getExerciseStreak:', error);
    return 0;
  }
}

/**
 * Reset monthly freezes (call this at the start of each month)
 */
export async function resetMonthlyFreezes(userId) {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .update({ food_freezes_left: 3 })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error resetting freezes:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in resetMonthlyFreezes:', error);
    return null;
  }
}

/**
 * Recalculate food streak from scratch based on all food logs in database
 * Call this after deleting food logs to ensure streak accuracy
 */
export async function recalculateFoodStreak(userId) {
  try {
    console.log('🔄 Recalculating food streak from database...');
    
    // Get all food logs for this user, ordered by date
    const { data: foodLogs, error: logsError } = await supabase
      .from('user_food_logs')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('Error fetching food logs:', logsError);
      return null;
    }

    if (!foodLogs || foodLogs.length === 0) {
      // No logs at all - reset streak to 0
      const { data, error } = await supabase
        .from('streaks')
        .update({
          food_streak: 0,
          food_last_log_date: null,
          food_freezes_left: 3
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error resetting streak:', error);
        return null;
      }

      console.log('✅ Streak reset to 0 (no logs found)');
      return data;
    }

    // Get unique dates when user logged food
    const logDates = new Set();
    foodLogs.forEach(log => {
      const dateStr = new Date(log.created_at).toISOString().split('T')[0];
      logDates.add(dateStr);
    });

    const sortedDates = Array.from(logDates).sort();
    
    // Calculate current streak by working backwards from most recent date
    const mostRecentDate = sortedDates[sortedDates.length - 1];
    const today = new Date().toISOString().split('T')[0];
    
    // Check if most recent log is today or yesterday
    const lastDate = new Date(mostRecentDate);
    const todayDate = new Date(today);
    const daysSinceLastLog = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastLog > 2) {
      // Streak expired (more than 2 days since last log)
      const { data, error } = await supabase
        .from('streaks')
        .update({
          food_streak: 0,
          food_last_log_date: mostRecentDate,
          food_freezes_left: 3
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating streak:', error);
        return null;
      }

      console.log('✅ Streak expired, reset to 0');
      return data;
    }

    // Calculate streak by counting consecutive days backwards
    let currentStreak = 1;
    let maxStreak = 1;
    let freezesUsed = 0;
    const maxFreezes = 3;

    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currentDate = new Date(sortedDates[i + 1]);
      const previousDate = new Date(sortedDates[i]);
      const daysDiff = Math.floor((currentDate - previousDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (daysDiff <= 3 && freezesUsed < maxFreezes) {
        // Gap within freeze allowance
        freezesUsed++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        // Streak broken
        break;
      }
    }

    // Get current streak data to preserve max_streak
    const streakData = await getUserStreaks(userId);
    const newMaxStreak = Math.max(currentStreak, streakData?.food_max_streak || 0);

    // Update database with recalculated streak
    const { data, error } = await supabase
      .from('streaks')
      .update({
        food_streak: currentStreak,
        food_last_log_date: mostRecentDate,
        food_max_streak: newMaxStreak,
        food_freezes_left: maxFreezes - freezesUsed
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating recalculated streak:', error);
      return null;
    }

    console.log(`✅ Streak recalculated: ${currentStreak} days (${freezesUsed} freezes used)`);
    return data;
  } catch (error) {
    console.error('Error in recalculateFoodStreak:', error);
    return null;
  }
}

/**
 * Recalculate exercise streak from scratch based on all workouts in database
 * Call this after deleting workouts to ensure streak accuracy
 */
export async function recalculateExerciseStreak(userId) {
  try {
    console.log('🔄 Recalculating exercise streak from database...');
    
    // Get all workouts and cardio sessions for this user
    const [workoutsResult, cardioResult] = await Promise.all([
      supabase
        .from('workouts')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('saved_cardio_sessions')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
    ]);

    if (workoutsResult.error || cardioResult.error) {
      console.error('Error fetching workouts:', workoutsResult.error || cardioResult.error);
      return null;
    }

    const allWorkouts = [
      ...(workoutsResult.data || []),
      ...(cardioResult.data || [])
    ];

    if (allWorkouts.length === 0) {
      // No workouts at all - reset streak to 0
      const { data, error } = await supabase
        .from('streaks')
        .update({
          exercise_streak: 0,
          exercise_last_log_date: null,
          exercise_buffer: 2
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error resetting exercise streak:', error);
        return null;
      }

      console.log('✅ Exercise streak reset to 0 (no workouts found)');
      return data;
    }

    // Get unique dates when user worked out
    const workoutDates = new Set();
    allWorkouts.forEach(workout => {
      const dateStr = new Date(workout.created_at).toISOString().split('T')[0];
      workoutDates.add(dateStr);
    });

    const sortedDates = Array.from(workoutDates).sort();
    
    // Calculate current streak
    const mostRecentDate = sortedDates[sortedDates.length - 1];
    const today = new Date().toISOString().split('T')[0];
    
    const lastDate = new Date(mostRecentDate);
    const todayDate = new Date(today);
    const daysSinceLastWorkout = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    const buffer = 2;
    if (daysSinceLastWorkout > buffer + 1) {
      // Streak expired
      const { data, error } = await supabase
        .from('streaks')
        .update({
          exercise_streak: 0,
          exercise_last_log_date: mostRecentDate,
          exercise_buffer: buffer
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating exercise streak:', error);
        return null;
      }

      console.log('✅ Exercise streak expired, reset to 0');
      return data;
    }

    // Calculate streak by counting consecutive days (with buffer)
    let currentStreak = 1;
    let maxStreak = 1;

    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currentDate = new Date(sortedDates[i + 1]);
      const previousDate = new Date(sortedDates[i]);
      const daysDiff = Math.floor((currentDate - previousDate) / (1000 * 60 * 60 * 24));

      if (daysDiff <= buffer + 1) {
        // Within buffer period
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        // Streak broken
        break;
      }
    }

    // Get current streak data to preserve max_streak
    const streakData = await getUserStreaks(userId);
    const newMaxStreak = Math.max(currentStreak, streakData?.exercise_max_streak || 0);

    // Update database with recalculated streak
    const { data, error } = await supabase
      .from('streaks')
      .update({
        exercise_streak: currentStreak,
        exercise_last_log_date: mostRecentDate,
        exercise_max_streak: newMaxStreak,
        exercise_buffer: buffer
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating recalculated exercise streak:', error);
      return null;
    }

    console.log(`✅ Exercise streak recalculated: ${currentStreak} days`);
    return data;
  } catch (error) {
    console.error('Error in recalculateExerciseStreak:', error);
    return null;
  }
}

