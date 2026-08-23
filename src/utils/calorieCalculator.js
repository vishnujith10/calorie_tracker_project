// Comprehensive calorie burn calculator
// Includes: steps, workouts, and cardio sessions

import supabase from '../lib/supabase';

/**
 * Calculate calories burned from steps (personalized)
 * @param {number} steps - Number of steps
 * @param {number} weight_kg - User weight in kg
 * @param {number} height_cm - User height in cm
 * @param {number} age - User age
 * @param {string} gender - User gender ('male' or 'female')
 * @returns {number} Calories burned
 */
export function calculateStepCalories(steps, weight_kg, height_cm, age, gender) {
  // More accurate formula based on stride length and body metrics
  // Average stride length: height * 0.415 (for walking)
  const strideLengthMeters = (height_cm / 100) * 0.415;
  const distanceKm = (steps * strideLengthMeters) / 1000;
  
  // MET (Metabolic Equivalent) for walking at moderate pace: 3.5
  // Calories = MET × weight(kg) × time(hours)
  // Average walking speed: 5 km/h
  const timeHours = distanceKm / 5;
  const MET = 3.5;
  
  // Adjust for gender (men typically burn ~5% more)
  const genderMultiplier = gender === 'male' ? 1.05 : 1.0;
  
  const calories = MET * weight_kg * timeHours * genderMultiplier;
  
  return Math.round(calories);
}

/**
 * Calculate calories burned from strength training workout
 * @param {number} duration_minutes - Workout duration in minutes
 * @param {number} weight_kg - User weight in kg
 * @param {string} intensity - 'light', 'moderate', or 'vigorous'
 * @returns {number} Calories burned
 */
export function calculateStrengthCalories(duration_minutes, weight_kg, intensity = 'moderate') {
  // MET values for strength training
  const MET_VALUES = {
    light: 3.5,      // Light effort
    moderate: 5.0,   // Moderate effort
    vigorous: 6.0,   // Vigorous effort
  };
  
  const MET = MET_VALUES[intensity] || MET_VALUES.moderate;
  const timeHours = duration_minutes / 60;
  
  return Math.round(MET * weight_kg * timeHours);
}

/**
 * Calculate calories burned from cardio exercise
 * @param {string} exerciseType - Type of cardio (running, cycling, etc.)
 * @param {number} duration_minutes - Duration in minutes
 * @param {number} weight_kg - User weight in kg
 * @param {string} intensity - 'light', 'moderate', or 'vigorous'
 * @returns {number} Calories burned
 */
export function calculateCardioCalories(exerciseType, duration_minutes, weight_kg, intensity = 'moderate') {
  // MET values for common cardio exercises
  const MET_VALUES = {
    // Running
    'running': { light: 6.0, moderate: 9.8, vigorous: 12.3 },
    'jogging': { light: 6.0, moderate: 7.0, vigorous: 8.3 },
    
    // Cycling
    'cycling': { light: 4.0, moderate: 8.0, vigorous: 12.0 },
    'stationary bike': { light: 3.5, moderate: 6.8, vigorous: 10.5 },
    
    // Swimming
    'swimming': { light: 6.0, moderate: 8.0, vigorous: 11.0 },
    
    // Other cardio
    'jumping jacks': { light: 7.0, moderate: 8.0, vigorous: 10.0 },
    'burpees': { light: 8.0, moderate: 10.0, vigorous: 12.0 },
    'mountain climbers': { light: 7.0, moderate: 8.0, vigorous: 10.0 },
    'jump rope': { light: 8.0, moderate: 10.0, vigorous: 12.0 },
    'rowing': { light: 4.5, moderate: 7.0, vigorous: 12.0 },
    'elliptical': { light: 5.0, moderate: 7.0, vigorous: 9.0 },
    'stair climbing': { light: 6.0, moderate: 8.0, vigorous: 11.0 },
    'walking': { light: 3.0, moderate: 3.5, vigorous: 4.5 },
    'hiit': { light: 8.0, moderate: 10.0, vigorous: 12.5 },
    
    // Default for unknown exercises
    'default': { light: 5.0, moderate: 7.0, vigorous: 9.0 },
  };
  
  // Find matching exercise (case-insensitive, partial match)
  const exerciseLower = exerciseType.toLowerCase();
  let MET = MET_VALUES.default[intensity];
  
  for (const [key, values] of Object.entries(MET_VALUES)) {
    if (exerciseLower.includes(key) || key.includes(exerciseLower)) {
      MET = values[intensity] || values.moderate;
      break;
    }
  }
  
  const timeHours = duration_minutes / 60;
  return Math.round(MET * weight_kg * timeHours);
}

/**
 * Calculate total workout calories (for compatibility with WorkoutStartScreen)
 * Supports both object parameter and positional parameters for exercises array
 * @param {Object|Array} params - Parameters object OR exercises array
 * @param {number} weight - User weight (when first param is array)
 * @param {number|string} intensity - Intensity level (when first param is array)
 * @param {number} maxRounds - Max rounds (when first param is array)
 * @param {number} restBetweenRounds - Rest between rounds (when first param is array)
 * @returns {number|Object} Calories burned (number) or { totalCalories } (object)
 */
export function calculateTotalWorkoutCalories(params, weight, intensity, maxRounds, restBetweenRounds) {
  // Check if first parameter is an array (exercises array)
  if (Array.isArray(params)) {
    const exercises = params;
    
    if (!exercises || exercises.length === 0) {
      return { totalCalories: 0 };
    }

    const intensityMap = {
      low: 'light',
      medium: 'moderate',
      high: 'vigorous',
    };
    
    // Handle both string and numeric intensity values
    let intensityKey = intensity;
    if (typeof intensity === 'number') {
      if (intensity <= 33) intensityKey = 'low';
      else if (intensity <= 66) intensityKey = 'medium';
      else intensityKey = 'high';
    } else if (typeof intensity === 'string') {
      intensityKey = intensity.toLowerCase();
    }
    
    const mappedIntensity = intensityMap[intensityKey] || 'moderate';
    
    // Calculate total calories for all exercises
    let totalCalories = 0;
    
    exercises.forEach(exercise => {
      const duration = parseInt(exercise.duration) || 45; // in seconds
      const rounds = exercise.rounds || 1;
      const durationMinutes = (duration * rounds) / 60;
      const exerciseName = ((exercise.name || exercise.exerciseName) || 'cardio').toLowerCase();
      
      const calories = calculateCardioCalories(exerciseName, durationMinutes, weight, mappedIntensity);
      totalCalories += calories;
    });
    
    return { totalCalories: Math.round(totalCalories) };
  }
  
  // Original object-based call (for WorkoutStartScreen compatibility)
  const { duration, weight: w, exerciseName, intensity: i, rounds = 1 } = params;
  
  const intensityMap = {
    low: 'light',
    medium: 'moderate',
    high: 'vigorous',
  };
  
  // Handle both string and numeric intensity values
  let intensityKey = i;
  if (typeof i === 'number') {
    if (i <= 33) intensityKey = 'low';
    else if (i <= 66) intensityKey = 'medium';
    else intensityKey = 'high';
  } else if (typeof i === 'string') {
    intensityKey = i.toLowerCase();
  }
  
  const mappedIntensity = intensityMap[intensityKey] || 'moderate';
  const totalDuration = duration * rounds;
  
  return calculateCardioCalories(exerciseName || 'cardio', totalDuration, w, mappedIntensity);
}

/**
 * Fetch today's total calories burned from all sources
 * @param {string} userId - User ID
 * @param {Object} userProfile - User profile data (weight, height, age, gender)
 * @param {Date} date - Date to fetch calories for (defaults to today)
 * @returns {Promise<Object>} { total, steps, workouts, cardio, breakdown }
 */
export async function getTodayCaloriesBurned(userId, userProfile, date = new Date()) {
  const dateString = date.toISOString().split('T')[0];
  
  let totalCalories = 0;
  let stepCalories = 0;
  let workoutCalories = 0;
  let cardioCalories = 0;
  const breakdown = [];
  
  try {
    // 1. Get step calories from steps table (handle duplicates by getting most recent)
    const { data: stepsRecords } = await supabase
      .from('steps')
      .select('steps, calories')
      .eq('user_id', userId)
      .eq('date', dateString)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const stepsData = stepsRecords;
    
    if (stepsData && stepsData.steps > 0) {
      // Recalculate with personalized formula if profile available
      if (userProfile?.weight && userProfile?.height) {
        stepCalories = calculateStepCalories(
          stepsData.steps,
          userProfile.weight,
          userProfile.height,
          userProfile.age || 30,
          userProfile.gender || 'female'
        );
      } else {
        // Fallback to stored value
        stepCalories = stepsData.calories || 0;
      }
      
      breakdown.push({
        type: 'steps',
        name: `${stepsData.steps} steps`,
        calories: stepCalories,
      });
    }
    
    // 2. Get workout calories from workouts table
    const { data: workoutsData } = await supabase
      .from('workouts')
      .select('id, duration, total_kcal')
      .eq('user_id', userId)
      .eq('date', dateString);
    
    if (workoutsData && workoutsData.length > 0) {
      for (const workout of workoutsData) {
        let calories = workout.total_kcal || 0;
        
        // If no calories stored, estimate based on duration
        if (!calories && workout.duration && userProfile?.weight) {
          const durationMinutes = workout.duration / 60;
          calories = calculateStrengthCalories(durationMinutes, userProfile.weight, 'moderate');
        }
        
        workoutCalories += calories;
        breakdown.push({
          type: 'workout',
          name: `Strength Training`,
          duration: workout.duration,
          calories: calories,
        });
      }
    }
    
    // 3. Get cardio calories from saved_cardio_sessions table
    const { data: cardioData } = await supabase
      .from('saved_cardio_sessions')
      .select('id, name, estimated_time, estimated_calories, created_at')
      .eq('user_id', userId)
      .gte('created_at', `${dateString}T00:00:00`)
      .lte('created_at', `${dateString}T23:59:59`);
    
    if (cardioData && cardioData.length > 0) {
      for (const session of cardioData) {
        let calories = session.estimated_calories || 0;
        
        // If no calories stored, estimate based on duration
        if (!calories && session.estimated_time && userProfile?.weight) {
          const durationMinutes = session.estimated_time / 60;
          calories = calculateCardioCalories(session.name, durationMinutes, userProfile.weight, 'moderate');
        }
        
        cardioCalories += calories;
        breakdown.push({
          type: 'cardio',
          name: session.name,
          duration: session.estimated_time,
          calories: calories,
        });
      }
    }
    
    totalCalories = stepCalories + workoutCalories + cardioCalories;
    
    return {
      total: Math.round(totalCalories),
      steps: Math.round(stepCalories),
      workouts: Math.round(workoutCalories),
      cardio: Math.round(cardioCalories),
      breakdown,
    };
    
  } catch (error) {
    console.error('Error calculating calories burned:', error);
    return {
      total: 0,
      steps: 0,
      workouts: 0,
      cardio: 0,
      breakdown: [],
    };
  }
}

/**
 * Calculate complete calorie profile (BMR, TDEE, calorie goal, and macro targets)
 * @param {Object} params - User parameters
 * @param {number} params.age - User age
 * @param {string} params.gender - User gender ('male' or 'female')
 * @param {number} params.weight_kg - User weight in kg
 * @param {number} params.height_cm - User height in cm
 * @param {string} params.activity_level - Activity level ('sedentary', 'light', 'moderate', 'very', 'extra')
 * @param {string} params.goal_type - Goal type ('lose', 'gain', 'maintain')
 * @returns {Object} { bmr, tdee, calorie_goal, macro_targets: { protein_g, fat_g, carbs_g } }
 */
export function calculateCalorieProfile({ age, gender, weight_kg, height_cm, activity_level, goal_type }) {
  // Calculate BMR (Basal Metabolic Rate) using Mifflin-St Jeor Equation
  const bmr = gender === 'male'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  
  // Calculate TDEE (Total Daily Energy Expenditure) based on activity level
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
    extra: 1.9,
  };
  
  const multiplier = activityMultipliers[activity_level] || 1.2;
  const tdee = bmr * multiplier;
  
  // Adjust calorie goal based on goal type
  let calorie_goal;
  switch (goal_type) {
    case 'lose':
      calorie_goal = tdee * 0.85; // 15% deficit
      break;
    case 'gain':
      calorie_goal = tdee * 1.1; // 10% surplus
      break;
    default: // maintain
      calorie_goal = tdee;
  }
  
  // Ensure minimum calories (safety)
  const minCalories = gender === 'male' ? 1500 : 1200;
  calorie_goal = Math.max(calorie_goal, minCalories);
  
  // Calculate macro targets (30% protein, 30% fat, 40% carbs)
  const macro_targets = {
    protein_g: Math.round((calorie_goal * 0.3) / 4),
    fat_g: Math.round((calorie_goal * 0.3) / 9),
    carbs_g: Math.round((calorie_goal * 0.4) / 4),
  };
  
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_goal: Math.round(calorie_goal),
    macro_targets,
  };
}

// Export as default for backward compatibility
export default calculateCalorieProfile;

/**
 * Update step calories in database with personalized calculation
 * @param {string} userId - User ID
 * @param {number} steps - Number of steps
 * @param {Object} userProfile - User profile data
 */
export async function updateStepCaloriesInDatabase(userId, steps, userProfile) {
  if (!userProfile?.weight || !userProfile?.height) {
    return; // Can't calculate without profile data
  }
  
  const calories = calculateStepCalories(
    steps,
    userProfile.weight,
    userProfile.height,
    userProfile.age || 30,
    userProfile.gender || 'female'
  );
  
  const dateString = new Date().toISOString().split('T')[0];
  
  try {
    // Update all records for today (in case of duplicates, then clean up)
    await supabase
      .from('steps')
      .update({ calories })
      .eq('user_id', userId)
      .eq('date', dateString);
    
    // Clean up duplicates if any exist (keep only the most recent)
    const { data: allRecords } = await supabase
      .from('steps')
      .select('id')
      .eq('user_id', userId)
      .eq('date', dateString)
      .order('updated_at', { ascending: false });
    
    if (allRecords && allRecords.length > 1) {
      const idsToDelete = allRecords.slice(1).map(r => r.id);
      await supabase
        .from('steps')
        .delete()
        .in('id', idsToDelete);
    }
  } catch (error) {
    console.error('Error updating step calories:', error);
  }
}
