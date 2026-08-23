import AsyncStorage from '@react-native-async-storage/async-storage';

const GOAL_STORAGE_KEY = 'step_goal_';

export async function getDailyGoal(userId) {
  try {
    const goalKey = `${GOAL_STORAGE_KEY}${userId}`;
    const savedGoal = await AsyncStorage.getItem(goalKey);
    
    if (savedGoal) {
      return parseInt(savedGoal, 10);
    }
    
    return 10000; // Default goal
  } catch (error) {
    console.log('Error getting daily goal:', error);
    return 10000;
  }
}

export async function setDailyGoal(userId, goal) {
  try {
    const goalKey = `${GOAL_STORAGE_KEY}${userId}`;
    await AsyncStorage.setItem(goalKey, goal.toString());
    console.log('✅ Goal saved to AsyncStorage:', goal);
    return true;
  } catch (error) {
    console.log('Error setting daily goal:', error);
    return false;
  }
}