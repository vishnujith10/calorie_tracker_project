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

// ─────────────────────────────────────────────────────────────────────────────
// Core: evaluate yesterday's streak progress (lazy, called on app open)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates yesterday's calorie goal completion and updates the streak.
 * Should be called once per day, on next-day app open.
 *
 * @param {string} userId
 * @param {number} calorieGoal  - the user's daily calorie goal (calculated)
 * @param {string} goalType     - 'lose' | 'gain' | 'maintain'
 * @returns {Object|null}       - updated streak data
 */
export async function evaluateYesterdayStreak(userId, calorieGoal, goalType = 'maintain') {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return null;

    const today = todayStr();
    const yesterday = yesterdayStr();

    // Already evaluated today — skip to avoid double-processing
    if (streakData.food_goal_evaluated_date === today) {
      console.log('✅ Streak already evaluated today, skipping.');
      return streakData;
    }

    // Get yesterday's total calories
    const yesterdayCalories = await getDayCalories(userId, yesterday);

    // Determine threshold based on goal type
    const normalizedGoal = (goalType || 'maintain').toLowerCase();
    const threshold = GOAL_THRESHOLDS[normalizedGoal] ?? GOAL_THRESHOLDS.maintain;
    const goalReached = calorieGoal > 0 && yesterdayCalories >= calorieGoal * threshold;

    console.log(
      `📊 Yesterday (${yesterday}): ${Math.round(yesterdayCalories)} kcal / goal ${calorieGoal} (${Math.round(threshold * 100)}% threshold) → ${goalReached ? '✅ Hit' : '❌ Missed'}`
    );

    let newStreak = streakData.food_streak;
    let newGraceUsed = streakData.food_grace_used ?? false;
    let newLastGoalDate = streakData.food_last_goal_date;

    if (goalReached) {
      // ─── Goal was hit yesterday ───────────────────────────────────────────
      const lastGoalDate = streakData.food_last_goal_date;

      if (!lastGoalDate) {
        // No previous streak — start fresh at 1
        newStreak = 1;
      } else {
        const daysSinceLastGoal = daysBetween(lastGoalDate, yesterday);

        if (daysSinceLastGoal === 1) {
          // Perfect consecutive day
          newStreak += 1;
        } else if (daysSinceLastGoal === 2 && newGraceUsed) {
          // Grace was protecting us for the gap day — continue streak
          newStreak += 1;
        } else {
          // Gap too large or unexpected — restart
          newStreak = 1;
        }
      }

      newGraceUsed = false; // Grace resets after a successful day
      newLastGoalDate = yesterday;

    } else {
      // ─── Goal was missed yesterday ────────────────────────────────────────
      if (!newGraceUsed && newStreak > 0) {
        // First missed day — activate grace (streak holds, show ❄️)
        newGraceUsed = true;
        console.log(`❄️ Grace activated — streak ${newStreak} protected for one day.`);
      } else if (newGraceUsed || newStreak === 0) {
        // Grace was already used (second consecutive miss) — reset
        console.log(`💔 Streak broken (was ${newStreak}), resetting to 0.`);
        newStreak = 0;
        newGraceUsed = false;
        newLastGoalDate = null;
      }
    }

    const newMaxStreak = Math.max(newStreak, streakData.food_max_streak ?? 0);

    const { data: updated, error } = await supabase
      .from('streaks')
      .update({
        food_streak: newStreak,
        food_max_streak: newMaxStreak,
        food_last_goal_date: newLastGoalDate,
        food_goal_evaluated_date: today,
        food_grace_used: newGraceUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating streak after evaluation:', error);
      return null;
    }

    console.log(
      `✅ Streak updated: ${newStreak} (max: ${newMaxStreak}, grace: ${newGraceUsed})`
    );
    return updated;
  } catch (err) {
    console.error('Error in evaluateYesterdayStreak:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: get current streak info for UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an object with:
 *   streak       {number}  - current streak count
 *   maxStreak    {number}  - all-time best streak
 *   graceActive  {boolean} - true when ❄️ grace day is protecting the streak
 */
export async function getFoodStreak(userId) {
  try {
    const streakData = await getUserStreaks(userId);
    if (!streakData) return { streak: 0, maxStreak: 0, graceActive: false };

    return {
      streak: streakData.food_streak ?? 0,
      maxStreak: streakData.food_max_streak ?? 0,
      graceActive: streakData.food_grace_used ?? false,
    };
  } catch (err) {
    console.error('Error in getFoodStreak:', err);
    return { streak: 0, maxStreak: 0, graceActive: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak-at-risk warning helper (for HomeScreen)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns how many more kcal the user needs to log TODAY to keep their streak.
 * Returns 0 if goal already reached, or null if there's no active streak to protect.
 *
 * @param {number} currentCalories  - today's logged calories so far
 * @param {number} calorieGoal      - user's daily calorie goal
 * @param {string} goalType         - 'lose' | 'gain' | 'maintain'
 * @param {number} currentStreak    - current streak count
 * @param {boolean} graceActive     - whether grace day is active
 * @returns {number|null}
 */
export function getStreakRiskCalories(currentCalories, calorieGoal, goalType, currentStreak, graceActive) {
  // No streak to protect
  if (currentStreak === 0 && !graceActive) return null;

  const normalizedGoal = (goalType || 'maintain').toLowerCase();
  const threshold = GOAL_THRESHOLDS[normalizedGoal] ?? GOAL_THRESHOLDS.maintain;
  const targetCalories = Math.round(calorieGoal * threshold);
  const remaining = targetCalories - currentCalories;

  return remaining > 0 ? remaining : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy compatibility shims (used in HomeScreen on food log save/delete)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a food log is saved. In the new system, we don't update the
 * streak on every log — evaluation happens lazily on next-day app open.
 * This function is kept for backward compatibility but is now a no-op for streak.
 * It DOES trigger evaluateYesterdayStreak if today hasn't been evaluated yet,
 * which covers the case where the user first opens the app after midnight.
 *
 * Pass calorieGoal and goalType from the HomeScreen context.
 */
export async function updateFoodStreak(userId, calorieGoal, goalType) {
  // evaluateYesterdayStreak is idempotent (checks food_goal_evaluated_date)
  // so it's safe to call here — it will no-op if already done today.
  if (calorieGoal && userId) {
    return evaluateYesterdayStreak(userId, calorieGoal, goalType);
  }
  return null;
}

/**
 * Recalculate food streak from scratch by walking through all food log dates.
 * Now goal-based: checks each past day's calories against the goal.
 * Called after deleting food logs.
 */
export async function recalculateFoodStreak(userId, calorieGoal, goalType = 'maintain') {
  try {
    console.log('🔄 Recalculating goal-based food streak from database...');

    const normalizedGoal = (goalType || 'maintain').toLowerCase();
    const threshold = GOAL_THRESHOLDS[normalizedGoal] ?? GOAL_THRESHOLDS.maintain;
    const today = todayStr();
    const yesterday = yesterdayStr();

    // Fetch all food logs grouped by date (excluding today — today's not done yet)
    const { data: logs, error } = await supabase
      .from('user_food_logs')
      .select('created_at, calories')
      .eq('user_id', userId)
      .lt('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching logs for recalculation:', error);
      return null;
    }

    if (!logs || logs.length === 0) {
      await supabase.from('streaks').update({
        food_streak: 0,
        food_max_streak: 0,
        food_last_goal_date: null,
        food_goal_evaluated_date: today,
        food_grace_used: false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      console.log('✅ Streak recalculated: 0 (no logs)');
      return await getUserStreaks(userId);
    }

    // Aggregate calories per day
    const calsByDay = {};
    for (const log of logs) {
      const dateStr = log.created_at.split('T')[0];
      calsByDay[dateStr] = (calsByDay[dateStr] || 0) + (log.calories || 0);
    }

    // Walk backwards from yesterday to find current streak
    const sortedDays = Object.keys(calsByDay).sort().reverse(); // newest first
    let currentStreak = 0;
    let graceUsed = false;
    let lastGoalDate = null;
    let expectDate = yesterday;

    for (const day of sortedDays) {
      const diff = daysBetween(day, expectDate);
      const hit = calorieGoal > 0 && calsByDay[day] >= calorieGoal * threshold;

      if (diff === 0) {
        // This is the expected date
        if (hit) {
          currentStreak++;
          lastGoalDate = lastGoalDate || day;
          expectDate = new Date(new Date(day).getTime() - 86400000)
            .toISOString().split('T')[0];
        } else {
          if (!graceUsed && currentStreak > 0) {
            graceUsed = true; // use grace for this gap
            expectDate = new Date(new Date(day).getTime() - 86400000)
              .toISOString().split('T')[0];
          } else {
            break; // streak broken
          }
        }
      } else if (diff === 1 && !graceUsed) {
        // One day gap — use grace
        if (hit) {
          graceUsed = true;
          currentStreak++;
          lastGoalDate = lastGoalDate || day;
          expectDate = new Date(new Date(day).getTime() - 86400000)
            .toISOString().split('T')[0];
        } else {
          break;
        }
      } else {
        break; // gap too large
      }
    }

    const streakData = await getUserStreaks(userId);
    const newMax = Math.max(currentStreak, streakData?.food_max_streak ?? 0);

    await supabase.from('streaks').update({
      food_streak: currentStreak,
      food_max_streak: newMax,
      food_last_goal_date: lastGoalDate,
      food_goal_evaluated_date: today,
      food_grace_used: graceUsed,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    console.log(`✅ Streak recalculated: ${currentStreak} (grace: ${graceUsed})`);
    return await getUserStreaks(userId);
  } catch (err) {
    console.error('Error in recalculateFoodStreak:', err);
    return null;
  }
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
