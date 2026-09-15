import AsyncStorage from "@react-native-async-storage/async-storage";
import { globalSettingsCache } from "../profilescreen/AppSettingsScreen";

const SETTINGS_STORAGE_KEY = "@calora_app_settings";

/**
 * Synchronously check if insights are enabled for an area using globalSettingsCache.
 * @param {'calories' | 'hydration' | 'sleep' | 'weight'} area
 * @returns {boolean}
 */
export const isInsightEnabledSync = (area) => {
  try {
    if (globalSettingsCache?.cachedData) {
      const { aiInsights, focusAreas } = globalSettingsCache.cachedData;
      if (aiInsights === false) return false;
      if (focusAreas) {
        const key = Object.keys(focusAreas).find(
          (k) => k.toLowerCase() === area.toLowerCase(),
        );
        if (key !== undefined) {
          return Boolean(focusAreas[key]);
        }
      }
    }
    return true;
  } catch {
    return true;
  }
};

/**
 * Asynchronously check if insights are enabled for an area from cache or storage.
 * @param {'calories' | 'hydration' | 'sleep' | 'weight'} area
 * @returns {Promise<boolean>}
 */
export const isInsightEnabled = async (area) => {
  try {
    // 1. Check in-memory globalSettingsCache
    if (globalSettingsCache?.cachedData) {
      const { aiInsights, focusAreas } = globalSettingsCache.cachedData;
      if (aiInsights === false) return false;
      if (focusAreas) {
        const key = Object.keys(focusAreas).find(
          (k) => k.toLowerCase() === area.toLowerCase(),
        );
        if (key !== undefined) {
          return Boolean(focusAreas[key]);
        }
      }
      return true;
    }

    // 2. Check AsyncStorage
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.ai_insights === false) return false;
      if (data.focus_areas) {
        const key = Object.keys(data.focus_areas).find(
          (k) => k.toLowerCase() === area.toLowerCase(),
        );
        if (key !== undefined) {
          return Boolean(data.focus_areas[key]);
        }
      }
    }

    return true;
  } catch (error) {
    return true;
  }
};
