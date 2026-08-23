import AsyncStorage from '@react-native-async-storage/async-storage';

const FOOD_LOGS_KEY = 'kalry_food_logs';
const USER_PROFILE_KEY = 'kalry_user_profile';

// User Profile Storage
export const saveUserProfile = async (profile) => {
  try {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};

export const getUserProfile = async () => {
  try {
    const profile = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Clear all data (for logout)
export const clearAllData = async () => {
  try {
    await AsyncStorage.multiRemove([USER_PROFILE_KEY]);
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}; 