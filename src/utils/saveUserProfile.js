import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import calculateCalorieProfile from './calorieCalculator';

export const saveUserProfile = async (userId, userEmail, defaultName, memoryData = {}) => {
  console.log('🔄 Starting saveUserProfile for user:', userId, userEmail);

  // 1. Gather all data: memory data + AsyncStorage
  let effective = { ...(memoryData || {}) };
  try {
    const stored = await AsyncStorage.getItem('calora_onboarding_data');
    if (stored) {
      const parsed = JSON.parse(stored);
      effective = { ...parsed, ...effective };
    }
    const legacyStored = await AsyncStorage.getItem('onboardingData');
    if (legacyStored) {
      const parsed = JSON.parse(legacyStored);
      effective = { ...parsed, ...effective };
    }
    const storedW = await AsyncStorage.getItem('calora_onboarding_weight');
    const storedH = await AsyncStorage.getItem('calora_onboarding_height');
    const storedU = await AsyncStorage.getItem('calora_onboarding_unit');
    if (storedW && !effective.weightKg && !effective.weight) effective.weightKg = storedW;
    if (storedH && !effective.heightCm && !effective.height) effective.heightCm = storedH;
    if (storedU && !effective.selectedWeightUnit) effective.selectedWeightUnit = storedU;
  } catch (err) {
    console.warn('⚠️ Error reading storage in saveUserProfile:', err);
  }

  console.log('📋 Effective onboarding data gathered:', Object.keys(effective));

  // 2. Parse and normalize numbers
  const rawWeight = effective.weightKg || effective.weight || effective.currentWeight || 0;
  const rawHeight = effective.heightCm || effective.height || 0;
  let parsedWeight = parseFloat(rawWeight) || 0;
  let parsedHeight = parseFloat(rawHeight) || 0;

  // Convert lbs to kg if needed
  if (effective.selectedWeightUnit === 'lbs' && parsedWeight > 0) {
    parsedWeight = parseFloat((parsedWeight / 2.20462).toFixed(1));
  }
  if (effective.selectedHeightUnit === 'ft' && parsedHeight > 0 && parsedHeight < 10) {
    parsedHeight = parseFloat((parsedHeight * 30.48).toFixed(1));
  }

  const parsedAge = parseInt(effective.age || 0, 10);
  const parsedGender = effective.gender || 'Male';
  const displayName = effective.name || defaultName || userEmail?.split('@')[0] || 'User';

  let targetWeight = effective.target_weight ? parseFloat(effective.target_weight) : null;
  if (targetWeight && effective.target_weight_unit === 'lbs') {
    targetWeight = parseFloat((targetWeight / 2.20462).toFixed(1));
  }

  // 3. Calculate calorie profile if metrics available
  let bmr = null;
  let tdee = null;
  let calorieGoal = null;
  let proteinG = null;
  let fatG = null;
  let carbsG = null;

  const validAge = parsedAge > 0 ? parsedAge : 25;
  const validWeight = parsedWeight > 0 ? parsedWeight : 65;
  const validHeight = parsedHeight > 0 ? parsedHeight : 170;
  const validGender = (parsedGender || 'male').toLowerCase();
  const activityLevel = (effective.daily_activity_level || 'moderate').toLowerCase();
  const goalFocus = (effective.goal_focus || 'maintain').toLowerCase();

  try {
    const calorieData = calculateCalorieProfile({
      age: validAge,
      gender: validGender,
      weight_kg: validWeight,
      height_cm: validHeight,
      activity_level: activityLevel,
      goal_type: goalFocus.includes('lose') ? 'lose' : goalFocus.includes('gain') ? 'gain' : 'maintain',
    });

    bmr = calorieData.bmr;
    tdee = calorieData.tdee;
    calorieGoal = calorieData.calorie_goal;
    proteinG = calorieData.macro_targets?.protein_g;
    fatG = calorieData.macro_targets?.fat_g;
    carbsG = calorieData.macro_targets?.carbs_g;
  } catch (cErr) {
    console.warn('⚠️ Calorie calculation notice:', cErr);
  }

  // 4. Construct complete profile payload
  const userProfilePayload = {
    id: userId,
    email: userEmail,
    name: displayName,
    age: parsedAge > 0 ? parsedAge : null,
    gender: parsedGender,
    height: parsedHeight > 0 ? parsedHeight : null,
    weight: parsedWeight > 0 ? parsedWeight : null,
    social_refference: effective.social_refference || null,
    daily_activity_level: effective.daily_activity_level || 'moderate',
    goal_focus: effective.goal_focus || 'general_fitness',
    target_weight: targetWeight,
    weekly_target: effective.weekly_target ? String(effective.weekly_target) : null,
    spending_time: effective.spending_time || null,
    prefered_workout: effective.prefered_workout
      ? Array.isArray(effective.prefered_workout)
        ? JSON.stringify(effective.prefered_workout)
        : String(effective.prefered_workout)
      : null,
    total_days_per_week: effective.total_days_per_week ? Number(effective.total_days_per_week) : 3,
    prefered_time: effective.prefered_time
      ? Array.isArray(effective.prefered_time)
        ? JSON.stringify(effective.prefered_time)
        : String(effective.prefered_time)
      : null,
    weight_unit: effective.selectedWeightUnit || 'kg',
    height_unit: effective.selectedHeightUnit || 'cm',
    bmr,
    tdee,
    calorie_goal: calorieGoal,
    protein_g: proteinG,
    fat_g: fatG,
    carbs_g: carbsG,
  };

  console.log('💾 Upserting full profile to Supabase user_profile:', userProfilePayload);

  const { data: savedProfile, error: profileError } = await supabase
    .from('user_profile')
    .upsert(userProfilePayload)
    .select()
    .single();

  if (profileError) {
    console.error('❌ Supabase profile upsert error:', profileError);
    // Try standard update fallback in case upsert conflict policy is restricted
    const { data: updateData, error: updateError } = await supabase
      .from('user_profile')
      .update(userProfilePayload)
      .eq('id', userId)
      .select()
      .single();
    if (updateError) {
      console.error('❌ Supabase profile update fallback error:', updateError);
    } else {
      console.log('✅ Fallback update succeeded:', updateData?.id);
    }
  } else {
    console.log('✅ Supabase profile saved successfully:', savedProfile?.id);
  }

  // 5. Save initial weight log so Weight Tracker has immediate entry
  if (parsedWeight > 0) {
    try {
      // Check if log exists for today
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: existingLogs } = await supabase
        .from('weight_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('date', `${todayStr}T00:00:00.000Z`)
        .lte('date', `${todayStr}T23:59:59.999Z`);

      if (!existingLogs || existingLogs.length === 0) {
        await supabase.from('weight_logs').insert({
          user_id: userId,
          weight: parsedWeight,
          date: new Date().toISOString(),
        });
        console.log('✅ Initial weight log saved for weight tracker');
      }
    } catch (wErr) {
      console.warn('⚠️ Weight log save notice:', wErr);
    }
  }

  // 6. Mark onboarded in AsyncStorage
  try {
    await AsyncStorage.setItem('onboarded', 'true');
  } catch (err) {
    console.warn('⚠️ Failed to set onboarded flag:', err);
  }

  return userProfilePayload;
};

export default saveUserProfile;
