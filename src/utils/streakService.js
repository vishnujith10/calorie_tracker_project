import supabase from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimum fraction of calorie goal that counts as "reached",
 * keyed by the user's goal_type from onboarding.
 * Over-eating (> 100%) also counts as reached (insight warns separately).
 */
const GOAL_THRESHOLDS = {
  lose: 0.80,      // ≥ 80% of goal for weight-loss users
  gain: 0.95,      // ≥ 95% of goal for muscle-gain users
  maintain: 0.90,  // ≥ 90% of goal for maintenance users
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today's date string in YYYY-MM-DD (local time). */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns yesterday's date string in YYYY-MM-DD (local time). */
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the number of whole calendar days between two YYYY-MM-DD strings.
 * Positive if b > a.
 */
function daysBetween(a, b) {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the streak row for a user, creating it if it doesn't exist. */
export async function getUserStreaks(userId) {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data && !error) return await createUserStreaks(userId);
    if (error) {
      if (error.code !== 'PGRST205') console.error('Error fetching streaks:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error in getUserStreaks:', err);
    return null;
  }
}

async function createUserStreaks(userId) {
  try {
    const { data, error } = await supabase
      .from('streaks')
      .insert({
        user_id: userId,
        food_streak: 0,
        food_max_streak: 0,
        food_last_goal_date: null,
        food_goal_evaluated_date: null,
        food_grace_used: false,
        // legacy columns kept at safe defaults
        exercise_streak: 0,
        exercise_max_streak: 0,
        food_freezes_left: 0,
        exercise_buffer: 2,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('streaks')
          .select('*')
          .eq('user_id', userId)
          .single();
        return existing;
      }
      console.error('Error creating streaks:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error in createUserStreaks:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: get yesterday's total calories from user_food_logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the total calories logged for a given date string (YYYY-MM-DD).
 */
async function getDayCalories(userId, dateStr) {
  try {
    const { data, error } = await supabase
      .from('user_food_logs')
      .select('calories')
      .eq('user_id', userId)
      .gte('created_at', `${dateStr}T00:00:00`)
      .lt('created_at', `${dateStr}T23:59:59.999`);

    if (error) {
      console.error('Error fetching day calories:', error);
      return 0;
    }
    return (data || []).reduce((sum, row) => sum + (row.calories || 0), 0);
  } catch (err) {
    console.error('Error in getDayCalories:', err);
    return 0;
  }
}

/**
 * Evaluates food streak including today's real-time progress.
 * If today's calorie goal is hit, streak increases TODAY (e.g. from 1 to 2).
 * If today's goal is not hit yet, today is in progress (doesn't break streak, streak shows count up to yesterday).
 */
export async function evaluateAndGetFoodStreak(userId, calorieGoal, goalType) {
  if (!userId) return { streak: 0, maxStreak: 0, graceActive: false };

  try {
    let effectiveGoal = calorieGoal;
    let effectiveType = goalType;

    if (!effectiveGoal || !effectiveType) {
      const { data: profile } = await supabase
        .from('user_profile')
        .select('calorie_goal, goal_focus')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        if (!effectiveGoal && profile.calorie_goal) effectiveGoal = profile.calorie_goal;
        if (!effectiveType && profile.goal_focus) effectiveType = profile.goal_focus;
      }
    }

    effectiveGoal = Number(effectiveGoal) || 2000;
    effectiveType = (effectiveType || 'maintain').toLowerCase();
    if (effectiveType.includes('lose')) effectiveType = 'lose';
    else if (effectiveType.includes('gain')) effectiveType = 'gain';
    else effectiveType = 'maintain';

    const threshold = GOAL_THRESHOLDS[effectiveType] ?? GOAL_THRESHOLDS.maintain;
    const targetCalories = effectiveGoal * threshold;

    const today = todayStr();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    const { data: foodLogs, error } = await supabase
      .from('user_food_logs')
      .select('created_at, calories, date')
      .eq('user_id', userId)
      .gte('created_at', `${startDateStr}T00:00:00`);

    if (error) {
      console.error('Error fetching food logs for streak calculation:', error);
    }

    const calsByDate = {};
    (foodLogs || []).forEach((log) => {
      let dateKey = log.date;
      if (!dateKey && log.created_at) {
        dateKey = log.created_at.split('T')[0];
      }
      if (dateKey) {
        calsByDate[dateKey] = (calsByDate[dateKey] || 0) + (log.calories || 0);
      }
    });

    const getDateOffset = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isGoalHit = (dateStr) => {
      const cals = calsByDate[dateStr] || 0;
      return targetCalories > 0 && cals >= targetCalories;
    };

    const todayDateStr = today;
    const yesterdayDateStr = getDateOffset(1);

    const todayHit = isGoalHit(todayDateStr);

    let streak = 0;
    let graceActive = false;
    let lastGoalDate = null;

    if (todayHit) {
      // ── TODAY'S GOAL IS HIT TODAY ──
      streak = 1;
      lastGoalDate = todayDateStr;
      let checkOffset = 1;
      let usedGraceInSequence = false;

      while (checkOffset <= 60) {
        const dateStr = getDateOffset(checkOffset);
        if (isGoalHit(dateStr)) {
          streak++;
          checkOffset++;
        } else {
          const prevDateStr = getDateOffset(checkOffset + 1);
          if (!usedGraceInSequence && isGoalHit(prevDateStr)) {
            usedGraceInSequence = true;
            checkOffset++;
          } else {
            break;
          }
        }
      }
    } else {
      // ── TODAY'S GOAL IS NOT HIT YET (IN PROGRESS) ──
      const yesterdayHit = isGoalHit(yesterdayDateStr);

      if (yesterdayHit) {
        streak = 1;
        lastGoalDate = yesterdayDateStr;
        let checkOffset = 2;
        let usedGraceInSequence = false;

        while (checkOffset <= 60) {
          const dateStr = getDateOffset(checkOffset);
          if (isGoalHit(dateStr)) {
            streak++;
            checkOffset++;
          } else {
            const prevDateStr = getDateOffset(checkOffset + 1);
            if (!usedGraceInSequence && isGoalHit(prevDateStr)) {
              usedGraceInSequence = true;
              checkOffset++;
            } else {
              break;
            }
          }
        }
      } else {
        const dayBeforeYesterdayStr = getDateOffset(2);
        if (isGoalHit(dayBeforeYesterdayStr)) {
          graceActive = true;
          streak = 1;
          lastGoalDate = dayBeforeYesterdayStr;
          let checkOffset = 3;

          while (checkOffset <= 60) {
            const dateStr = getDateOffset(checkOffset);
            if (isGoalHit(dateStr)) {
              streak++;
              checkOffset++;
            } else {
              break;
            }
          }
        } else {
          streak = 0;
          graceActive = false;
        }
      }
    }

    const existingStreakRecord = await getUserStreaks(userId);
    const maxStreak = Math.max(streak, existingStreakRecord?.food_max_streak ?? 0);

    await supabase
      .from('streaks')
      .update({
        food_streak: streak,
        food_max_streak: maxStreak,
        food_last_goal_date: lastGoalDate,
        food_goal_evaluated_date: today,
        food_grace_used: graceActive,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return {
      streak,
      maxStreak,
      graceActive,
    };
  } catch (err) {
    console.error('Error in evaluateAndGetFoodStreak:', err);
    return { streak: 0, maxStreak: 0, graceActive: false };
  }
}

export async function evaluateYesterdayStreak(userId, calorieGoal, goalType = 'maintain') {
  return await evaluateAndGetFoodStreak(userId, calorieGoal, goalType);
}

export async function getFoodStreak(userId, calorieGoal, goalType) {
  return await evaluateAndGetFoodStreak(userId, calorieGoal, goalType);
}

export function getStreakRiskCalories(currentCalories, calorieGoal, goalType, currentStreak, graceActive) {
  if (currentStreak === 0 && !graceActive) return null;

  const normalizedGoal = (goalType || 'maintain').toLowerCase();
  const threshold = GOAL_THRESHOLDS[normalizedGoal] ?? GOAL_THRESHOLDS.maintain;
  const targetCalories = Math.round(calorieGoal * threshold);
  const remaining = targetCalories - currentCalories;

  return remaining > 0 ? remaining : 0;
}

export async function updateFoodStreak(userId, calorieGoal, goalType) {
  return await evaluateAndGetFoodStreak(userId, calorieGoal, goalType);
}

export async function recalculateFoodStreak(userId, calorieGoal, goalType = 'maintain') {
  return await evaluateAndGetFoodStreak(userId, calorieGoal, goalType);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exercise streak (unchanged — kept for other parts of the app)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateExerciseStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return null;

    const today = todayStr();
    const lastLogDate = streakData.exercise_last_log_date;

    let newStreak = streakData.exercise_streak;
    let buffer = streakData.exercise_buffer;

    if (!lastLogDate) {
      newStreak = 1;
    } else {
      const daysDiff = daysBetween(lastLogDate, today);
      if (daysDiff === 0) return streakData;
      else if (daysDiff === 1) { newStreak += 1; buffer = 2; }
      else if (daysDiff <= buffer + 1) { newStreak += 1; buffer = Math.max(0, buffer - (daysDiff - 1)); }
      else { newStreak = Math.max(1, Math.floor(newStreak / 2)); buffer = 2; }
    }

    const newMax = Math.max(newStreak, streakData.exercise_max_streak);

    const { data, error } = await supabase
      .from('streaks')
      .update({ exercise_streak: newStreak, exercise_last_log_date: today, exercise_max_streak: newMax, exercise_buffer: buffer })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) { console.error('Error updating exercise streak:', error); return null; }
    return data;
  } catch (err) {
    console.error('Error in updateExerciseStreak:', err);
    return null;
  }
}

export async function getExerciseStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return 0;
    if (!streakData.exercise_last_log_date) return 0;

    const daysDiff = daysBetween(streakData.exercise_last_log_date, todayStr());
    if (daysDiff > streakData.exercise_buffer + 1) return 0;

    return streakData.exercise_streak;
  } catch (err) {
    console.error('Error in getExerciseStreak:', err);
    return 0;
  }
}

export async function resetMonthlyFreezes(userId) {
  // Legacy — kept for backward compat, no longer used in new streak logic
  return null;
}

export async function recalculateExerciseStreak(userId) {
  try {
    const [workoutsResult, cardioResult] = await Promise.all([
      supabase.from('workouts').select('created_at').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('saved_cardio_sessions').select('created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    ]);

    const allWorkouts = [...(workoutsResult.data || []), ...(cardioResult.data || [])];
    const today = todayStr();

    if (allWorkouts.length === 0) {
      await supabase.from('streaks').update({ exercise_streak: 0, exercise_last_log_date: null, exercise_buffer: 2 }).eq('user_id', userId);
      return await getUserStreaks(userId);
    }

    const workoutDates = new Set(allWorkouts.map(w => w.created_at.split('T')[0]));
    const sortedDates = Array.from(workoutDates).sort();
    const mostRecent = sortedDates[sortedDates.length - 1];
    const daysSinceLast = daysBetween(mostRecent, today);

    if (daysSinceLast > 3) {
      await supabase.from('streaks').update({ exercise_streak: 0, exercise_last_log_date: mostRecent, exercise_buffer: 2 }).eq('user_id', userId);
      return await getUserStreaks(userId);
    }

    let currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const diff = daysBetween(sortedDates[i], sortedDates[i + 1]);
      if (diff <= 3) currentStreak++;
      else break;
    }

    const streakData = await getUserStreaks(userId);
    const newMax = Math.max(currentStreak, streakData?.exercise_max_streak ?? 0);

    await supabase.from('streaks').update({ exercise_streak: currentStreak, exercise_last_log_date: mostRecent, exercise_max_streak: newMax, exercise_buffer: 2 }).eq('user_id', userId);
    return await getUserStreaks(userId);
  } catch (err) {
    console.error('Error in recalculateExerciseStreak:', err);
    return null;
  }
}
