import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";
import { clearAllGlobalCaches } from "../utils/clearAllCaches";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Global cache for AppSettingsScreen (same pattern as StepTrackerScreen)
export const globalSettingsCache = {
  lastFetchTime: 0,
  CACHE_DURATION: 300000, // 5 minutes
  cachedData: null,
};

const AppSettingsScreen = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );

  // Helper functions for default times (moved outside to prevent re-creation)
  const getDefaultMealTime = () => {
    const date = new Date();
    date.setHours(8, 0, 0, 0);
    return date;
  };

  const getDefaultWorkoutTime = () => {
    const date = new Date();
    date.setHours(17, 30, 0, 0);
    return date;
  };

  const getDefaultSleepTime = () => {
    const date = new Date();
    date.setHours(22, 0, 0, 0);
    return date;
  };

  // Initialize state from cache if valid (prevent re-render on mount)
  const getCachedOrDefault = (key, defaultValue) => {
    const now = Date.now();
    const timeSinceLastFetch = now - globalSettingsCache.lastFetchTime;
    const isCacheValid =
      timeSinceLastFetch < globalSettingsCache.CACHE_DURATION;

    if (
      isCacheValid &&
      globalSettingsCache.cachedData &&
      globalSettingsCache.cachedData[key] !== undefined
    ) {
      return globalSettingsCache.cachedData[key];
    }
    return defaultValue;
  };

  // Notifications State - Initialize from cache if available
  const [dailyReminders, setDailyReminders] = useState(() =>
    getCachedOrDefault("dailyReminders", false),
  );
  const [mealReminders, setMealReminders] = useState(() =>
    getCachedOrDefault("mealReminders", false),
  );
  const [workoutReminders, setWorkoutReminders] = useState(() =>
    getCachedOrDefault("workoutReminders", false),
  );
  const [sleepReminders, setSleepReminders] = useState(() =>
    getCachedOrDefault("sleepReminders", false),
  );

  // Time picker states - Initialize from cache or defaults
  const getCachedTime = (key, defaultFn) => {
    const cached = getCachedOrDefault(key, null);
    if (cached) {
      const date = new Date();
      const [hours, minutes] = cached.split(":");
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return date;
    }
    return defaultFn();
  };

  const [mealReminderTime, setMealReminderTime] = useState(() =>
    getCachedTime("mealReminderTime", getDefaultMealTime),
  );
  const [workoutReminderTime, setWorkoutReminderTime] = useState(() =>
    getCachedTime("workoutReminderTime", getDefaultWorkoutTime),
  );
  const [sleepReminderTime, setSleepReminderTime] = useState(() =>
    getCachedTime("sleepReminderTime", getDefaultSleepTime),
  );

  const [showMealTimePicker, setShowMealTimePicker] = useState(false);
  const [showWorkoutTimePicker, setShowWorkoutTimePicker] = useState(false);
  const [showSleepTimePicker, setShowSleepTimePicker] = useState(false);

  // Notification IDs storage
  const notificationIdsRef = useRef({
    meal: null,
    workout: null,
    sleep: null,
  });

  // Track if this is initial mount (to prevent scheduling on mount)
  const isInitialMount = useRef(true);

  // Scheduling lock to prevent concurrent scheduling of the same notification type
  const schedulingLockRef = useRef({
    meal: false,
    workout: false,
    sleep: false,
  });

  // AI Insights State - Initialize from cache
  const [aiInsights, setAiInsights] = useState(() =>
    getCachedOrDefault("aiInsights", true),
  );
  const [insightFrequency, setInsightFrequency] = useState(() =>
    getCachedOrDefault("insightFrequency", "Weekly"),
  );
  const [focusAreas, setFocusAreas] = useState(() =>
    getCachedOrDefault("focusAreas", {
      calories: true,
      sleep: true,
      workout: true,
      Hydration: false,
    }),
  );

  // Privacy & Data State - Initialize from cache
  const [anonymousDataSharing, setAnonymousDataSharing] = useState(() =>
    getCachedOrDefault("anonymousDataSharing", true),
  );

  // General State - Initialize from cache
  const [language, setLanguage] = useState(() =>
    getCachedOrDefault("language", "English"),
  );

  // Logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check cache first (prevent unnecessary re-renders)
      const now = Date.now();
      const timeSinceLastFetch = now - globalSettingsCache.lastFetchTime;
      const isCacheValid =
        timeSinceLastFetch < globalSettingsCache.CACHE_DURATION;

      if (isCacheValid && globalSettingsCache.cachedData) {
        // Cache is valid, restore from cache without fetching
        const cached = globalSettingsCache.cachedData;

        // Use functional updates to avoid dependency on current state values
        setDailyReminders((prev) =>
          prev !== cached.dailyReminders ? cached.dailyReminders : prev,
        );
        setMealReminders((prev) =>
          prev !== cached.mealReminders ? cached.mealReminders : prev,
        );
        setWorkoutReminders((prev) =>
          prev !== cached.workoutReminders ? cached.workoutReminders : prev,
        );
        setSleepReminders((prev) =>
          prev !== cached.sleepReminders ? cached.sleepReminders : prev,
        );

        if (cached.mealReminderTime) {
          const [hours, minutes] = cached.mealReminderTime.split(":");
          setMealReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== cached.mealReminderTime) {
              const mealTime = new Date();
              mealTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return mealTime;
            }
            return prev;
          });
        }
        if (cached.workoutReminderTime) {
          const [hours, minutes] = cached.workoutReminderTime.split(":");
          setWorkoutReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== cached.workoutReminderTime) {
              const workoutTime = new Date();
              workoutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return workoutTime;
            }
            return prev;
          });
        }
        if (cached.sleepReminderTime) {
          const [hours, minutes] = cached.sleepReminderTime.split(":");
          setSleepReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== cached.sleepReminderTime) {
              const sleepTime = new Date();
              sleepTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return sleepTime;
            }
            return prev;
          });
        }

        setAiInsights((prev) =>
          prev !== cached.aiInsights ? cached.aiInsights : prev,
        );
        setInsightFrequency((prev) =>
          prev !== cached.insightFrequency ? cached.insightFrequency : prev,
        );
        setFocusAreas((prev) => {
          const prevStr = JSON.stringify(prev);
          const cachedStr = JSON.stringify(cached.focusAreas);
          return prevStr !== cachedStr ? cached.focusAreas : prev;
        });
        setAnonymousDataSharing((prev) =>
          prev !== cached.anonymousDataSharing
            ? cached.anonymousDataSharing
            : prev,
        );
        setLanguage((prev) =>
          prev !== cached.language ? cached.language : prev,
        );

        return; // Skip database fetch
      }

      // Cache invalid or doesn't exist, fetch from database
      const { data, error } = await supabase
        .from("user_app_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Error loading settings:", error);
        return;
      }

      if (data) {
        // Update cache
        globalSettingsCache.cachedData = {
          dailyReminders: data.daily_reminders ?? false,
          mealReminders: data.meal_reminders ?? false,
          workoutReminders: data.workout_reminders ?? false,
          sleepReminders: data.sleep_reminders ?? false,
          mealReminderTime: data.meal_reminder_time,
          workoutReminderTime: data.workout_reminder_time,
          sleepReminderTime: data.sleep_reminder_time,
          aiInsights: data.ai_insights ?? true,
          insightFrequency: data.insight_frequency ?? "Weekly",
          focusAreas: data.focus_areas || {
            calories: true,
            sleep: true,
            workout: true,
            Hydration: false,
          },
          anonymousDataSharing: data.anonymous_data_sharing ?? true,
          language: data.language ?? "English",
        };
        globalSettingsCache.lastFetchTime = now;

        // Use functional updates to avoid dependency on current state values
        setDailyReminders((prev) =>
          prev !== globalSettingsCache.cachedData.dailyReminders
            ? globalSettingsCache.cachedData.dailyReminders
            : prev,
        );
        setMealReminders((prev) =>
          prev !== globalSettingsCache.cachedData.mealReminders
            ? globalSettingsCache.cachedData.mealReminders
            : prev,
        );
        setWorkoutReminders((prev) =>
          prev !== globalSettingsCache.cachedData.workoutReminders
            ? globalSettingsCache.cachedData.workoutReminders
            : prev,
        );
        setSleepReminders((prev) =>
          prev !== globalSettingsCache.cachedData.sleepReminders
            ? globalSettingsCache.cachedData.sleepReminders
            : prev,
        );

        // Load reminder times using functional updates
        if (data.meal_reminder_time) {
          const [hours, minutes] = data.meal_reminder_time.split(":");
          setMealReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== data.meal_reminder_time) {
              const mealTime = new Date();
              mealTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return mealTime;
            }
            return prev;
          });
        }
        if (data.workout_reminder_time) {
          const [hours, minutes] = data.workout_reminder_time.split(":");
          setWorkoutReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== data.workout_reminder_time) {
              const workoutTime = new Date();
              workoutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return workoutTime;
            }
            return prev;
          });
        }
        if (data.sleep_reminder_time) {
          const [hours, minutes] = data.sleep_reminder_time.split(":");
          setSleepReminderTime((prev) => {
            const prevTimeStr = prev.toTimeString().slice(0, 5);
            if (prevTimeStr !== data.sleep_reminder_time) {
              const sleepTime = new Date();
              sleepTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              return sleepTime;
            }
            return prev;
          });
        }

        // Load AI Insights settings using functional updates
        setAiInsights((prev) =>
          prev !== globalSettingsCache.cachedData.aiInsights
            ? globalSettingsCache.cachedData.aiInsights
            : prev,
        );
        setInsightFrequency((prev) =>
          prev !== globalSettingsCache.cachedData.insightFrequency
            ? globalSettingsCache.cachedData.insightFrequency
            : prev,
        );
        setFocusAreas((prev) => {
          const prevStr = JSON.stringify(prev);
          const cachedStr = JSON.stringify(
            globalSettingsCache.cachedData.focusAreas,
          );
          return prevStr !== cachedStr
            ? globalSettingsCache.cachedData.focusAreas
            : prev;
        });

        // Load Privacy & Data settings using functional updates
        setAnonymousDataSharing((prev) =>
          prev !== globalSettingsCache.cachedData.anonymousDataSharing
            ? globalSettingsCache.cachedData.anonymousDataSharing
            : prev,
        );

        // Load General settings using functional updates
        setLanguage((prev) =>
          prev !== globalSettingsCache.cachedData.language
            ? globalSettingsCache.cachedData.language
            : prev,
        );
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []); // Empty deps - loadSettings should only run on mount, not when state changes

  // Save settings to database
  const saveSettings = useCallback(async () => {
    // Don't save settings if user is logging out
    if (isLoggingOutRef.current) {
      console.log("⏸️ Skipping settings save - user is logging out");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const mealTimeStr = mealReminderTime.toTimeString().slice(0, 5);
      const workoutTimeStr = workoutReminderTime.toTimeString().slice(0, 5);
      const sleepTimeStr = sleepReminderTime.toTimeString().slice(0, 5);

      const settingsData = {
        user_id: user.id,
        daily_reminders: dailyReminders,
        meal_reminders: mealReminders,
        workout_reminders: workoutReminders,
        sleep_reminders: sleepReminders,
        meal_reminder_time: mealTimeStr,
        workout_reminder_time: workoutTimeStr,
        sleep_reminder_time: sleepTimeStr,
        ai_insights: aiInsights,
        insight_frequency: insightFrequency,
        focus_areas: focusAreas,
        anonymous_data_sharing: anonymousDataSharing,
        language: language,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("user_app_settings")
        .upsert(settingsData, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("Error saving settings:", error);
      } else {
        // Update cache immediately after successful save to prevent stale data
        globalSettingsCache.cachedData = {
          dailyReminders,
          mealReminders,
          workoutReminders,
          sleepReminders,
          mealReminderTime: mealTimeStr,
          workoutReminderTime: workoutTimeStr,
          sleepReminderTime: sleepTimeStr,
          aiInsights,
          insightFrequency,
          focusAreas,
          anonymousDataSharing,
          language,
        };
        globalSettingsCache.lastFetchTime = Date.now();
        console.log("✅ Cache updated with sleep time:", sleepTimeStr);
        console.log("✅ Settings saved successfully");
      }
    } catch (error) {
      // Don't log errors if user is logging out
      if (!isLoggingOutRef.current) {
        console.error("Error saving settings:", error);
      }
    }
  }, [
    dailyReminders,
    mealReminders,
    workoutReminders,
    sleepReminders,
    mealReminderTime,
    workoutReminderTime,
    sleepReminderTime,
    aiInsights,
    insightFrequency,
    focusAreas,
    anonymousDataSharing,
    language,
  ]);

  // Request notification permissions and setup Android channel
  useEffect(() => {
    const requestPermissions = async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Notification permissions not granted");
        return;
      }

      // Setup Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
          sound: "default",
        });
      }
    };

    requestPermissions();

    // Mark that initial mount is complete after a short delay
    setTimeout(() => {
      isInitialMount.current = false;
    }, 1000);
  }, []);

  // Load settings on mount (like StepTrackerScreen - no useFocusEffect)
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle hardware back button - go back normally
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.goBack();
        return true; // Prevent default back behavior
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => backHandler.remove();
    }, [navigation]),
  );

  // Notification messages
  const getNotificationMessages = (type) => {
    const messages = {
      meal: [
        "🍽️ Time to fuel your body! Log your meal when you're ready.",
        "Ready to log your meal? Your body needs nourishment! 🥗",
        "Meal time! Take a moment to log what you're eating. 🍎",
        "Don't forget to log your meal! Every bite counts towards your goals. 💪",
      ],
      workout: [
        "💪 Ready to move? Even 10 minutes of activity makes a difference!",
        "Time for some movement! Your body will thank you. 🏃‍♀️",
        "Exercise reminder: Every step counts towards your health goals! 🏋️",
        "Feel like moving today? A quick workout can boost your energy! ⚡",
      ],
      sleep: [
        "🌙 Time to wind down! Quality sleep is essential for your health.",
        "Getting ready for bed? Log your sleep to track your rest patterns. 😴",
        "Sleep reminder: A good night's rest helps you perform better tomorrow! 🌟",
        "Time to log your sleep! Rest is just as important as activity. 💤",
      ],
    };
    const options = messages[type] || ["Reminder"];
    return options[Math.floor(Math.random() * options.length)];
  };

  // Cancel notification - Cancel ALL notifications of this type, not just the one in ref
  const cancelNotification = useCallback(async (type) => {
    try {
      // Get the expected title for this notification type
      const expectedTitle =
        type === "meal"
          ? "Meal Reminder"
          : type === "workout"
            ? "Workout Reminder"
            : "Sleep Reminder";

      // Get all scheduled notifications
      const allScheduled =
        await Notifications.getAllScheduledNotificationsAsync();

      // Cancel all notifications that match this type (by title)
      const matchingNotifications = allScheduled.filter(
        (notif) => notif.content.title === expectedTitle,
      );

      // Cancel each matching notification
      for (const notif of matchingNotifications) {
        try {
          await Notifications.cancelScheduledNotificationAsync(
            notif.identifier,
          );
          console.log(
            `✅ Cancelled ${type} notification (ID: ${notif.identifier})`,
          );
        } catch (err) {
          console.error(
            `Error cancelling notification ${notif.identifier}:`,
            err,
          );
        }
      }

      // Clear the ref
      notificationIdsRef.current[type] = null;

      if (matchingNotifications.length > 0) {
        console.log(
          `✅ Cancelled ${matchingNotifications.length} ${type} notification(s)`,
        );
      }
    } catch (error) {
      console.error(`Error cancelling ${type} notification:`, error);
    }
  }, []);

  // Schedule daily recurring notification - FIXED to prevent immediate firing and duplicates
  const scheduleNotification = useCallback(
    async (type, time, enabled) => {
      // Prevent concurrent scheduling of the same notification type
      if (schedulingLockRef.current[type]) {
        console.log(
          `⏸️ ${type} notification scheduling already in progress, skipping duplicate`,
        );
        return;
      }

      schedulingLockRef.current[type] = true;

      try {
        // Cancel ALL existing notifications of this type first (prevents duplicates)
        await cancelNotification(type);

        // Small delay to ensure cancellation completes before scheduling
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!enabled) {
          schedulingLockRef.current[type] = false;
          return;
        }

        const hours = time.getHours();
        const minutes = time.getMinutes();

        // Calculate when to fire the notification
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);
        scheduledTime.setSeconds(0);
        scheduledTime.setMilliseconds(0);

        // If the time has already passed today, schedule for tomorrow
        if (scheduledTime.getTime() <= now.getTime()) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
          console.log(
            `⏰ Time ${hours}:${minutes} has passed today. Scheduling for tomorrow.`,
          );
        }

        // Calculate seconds until the scheduled time
        const secondsUntilScheduled = Math.floor(
          (scheduledTime.getTime() - now.getTime()) / 1000,
        );

        console.log(
          `⏰ Scheduling ${type} notification in ${secondsUntilScheduled} seconds (${Math.floor(secondsUntilScheduled / 60)} minutes) at ${scheduledTime.toLocaleTimeString()}`,
        );

        // Double-check: Verify no duplicate notifications exist before scheduling
        const allScheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        const expectedTitle =
          type === "meal"
            ? "Meal Reminder"
            : type === "workout"
              ? "Workout Reminder"
              : "Sleep Reminder";
        const existingCount = allScheduled.filter(
          (n) => n.content.title === expectedTitle,
        ).length;

        if (existingCount > 0) {
          console.log(
            `⚠️ Found ${existingCount} existing ${type} notification(s), cancelling before scheduling new one`,
          );
          await cancelNotification(type);
        }

        // Use specific date/time trigger (most reliable)
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: expectedTitle,
            body: getNotificationMessages(type),
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: scheduledTime, // Simple date trigger
        });

        // Store notification ID
        notificationIdsRef.current[type] = notificationId;

        console.log(
          `✅ Scheduled ${type} notification for ${scheduledTime.toLocaleString()} (ID: ${notificationId})`,
        );

        // Final verification: Check for duplicates and cancel extras
        const allScheduledAfter =
          await Notifications.getAllScheduledNotificationsAsync();
        const matchingAfter = allScheduledAfter.filter(
          (n) => n.content.title === expectedTitle,
        );
        const countAfter = matchingAfter.length;

        if (countAfter > 1) {
          console.warn(
            `⚠️ WARNING: Found ${countAfter} ${type} notifications scheduled! Cancelling duplicates...`,
          );
          // Keep the one we just scheduled, cancel the rest
          for (const notif of matchingAfter) {
            if (notif.identifier !== notificationId) {
              try {
                await Notifications.cancelScheduledNotificationAsync(
                  notif.identifier,
                );
                console.log(
                  `✅ Cancelled duplicate ${type} notification (ID: ${notif.identifier})`,
                );
              } catch (err) {
                console.error(`Error cancelling duplicate notification:`, err);
              }
            }
          }
        }

        // Debug: Final count
        if (__DEV__) {
          const finalCheck =
            await Notifications.getAllScheduledNotificationsAsync();
          const finalCount = finalCheck.filter(
            (n) => n.content.title === expectedTitle,
          ).length;
          console.log(
            `📅 Final count: ${finalCount} ${type} notification(s) scheduled`,
          );
        }
      } catch (error) {
        console.error(`Error scheduling ${type} notification:`, error);
      } finally {
        // Always release the lock, even if there's an error
        schedulingLockRef.current[type] = false;
      }
    },
    [cancelNotification],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelNotification("meal");
      cancelNotification("workout");
      cancelNotification("sleep");
    };
  }, [cancelNotification]);

  // Handle notification received (reschedule for next day) - Prevent duplicate reschedules
  const rescheduleLockRef = useRef({
    meal: false,
    workout: false,
    sleep: false,
  });

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log(
          "📬 Notification received:",
          notification.request.content.title,
        );

        // Determine which type and reschedule for tomorrow
        const title = notification.request.content.title;

        // Prevent duplicate reschedules if multiple notifications fire at once
        if (title?.includes("Meal") && mealReminders && dailyReminders) {
          if (rescheduleLockRef.current.meal) {
            console.log(
              "⏸️ Meal notification reschedule already in progress, skipping duplicate",
            );
            return;
          }
          rescheduleLockRef.current.meal = true;
          console.log("🔄 Rescheduling meal notification for tomorrow");
          await scheduleNotification("meal", mealReminderTime, true);
          // Release lock after a short delay
          setTimeout(() => {
            rescheduleLockRef.current.meal = false;
          }, 2000);
        } else if (
          title?.includes("Workout") &&
          workoutReminders &&
          dailyReminders
        ) {
          if (rescheduleLockRef.current.workout) {
            console.log(
              "⏸️ Workout notification reschedule already in progress, skipping duplicate",
            );
            return;
          }
          rescheduleLockRef.current.workout = true;
          console.log("🔄 Rescheduling workout notification for tomorrow");
          await scheduleNotification("workout", workoutReminderTime, true);
          setTimeout(() => {
            rescheduleLockRef.current.workout = false;
          }, 2000);
        } else if (
          title?.includes("Sleep") &&
          sleepReminders &&
          dailyReminders
        ) {
          if (rescheduleLockRef.current.sleep) {
            console.log(
              "⏸️ Sleep notification reschedule already in progress, skipping duplicate",
            );
            return;
          }
          rescheduleLockRef.current.sleep = true;
          console.log("🔄 Rescheduling sleep notification for tomorrow");
          await scheduleNotification("sleep", sleepReminderTime, true);
          setTimeout(() => {
            rescheduleLockRef.current.sleep = false;
          }, 2000);
        }
      },
    );

    return () => subscription.remove();
  }, [
    mealReminders,
    workoutReminders,
    sleepReminders,
    dailyReminders,
    mealReminderTime,
    workoutReminderTime,
    sleepReminderTime,
    scheduleNotification,
  ]);

  // SEPARATE useEffects for each notification type to prevent cascade updates
  // Handle meal reminders toggle
  useEffect(() => {
    if (isInitialMount.current) return; // Skip on initial mount

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && mealReminders) {
        await scheduleNotification("meal", mealReminderTime, true);
      } else {
        await cancelNotification("meal");
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mealReminders, dailyReminders, saveSettings]);

  // Handle meal time changes (only reschedule if already enabled)
  useEffect(() => {
    if (isInitialMount.current) return; // Skip on initial mount

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && mealReminders) {
        console.log("⏰ Meal time changed, rescheduling...");
        await scheduleNotification("meal", mealReminderTime, true);
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mealReminderTime, saveSettings]);

  // Handle workout reminders toggle
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && workoutReminders) {
        await scheduleNotification("workout", workoutReminderTime, true);
      } else {
        await cancelNotification("workout");
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [workoutReminders, dailyReminders, saveSettings]);

  // Handle workout time changes
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && workoutReminders) {
        console.log("⏰ Workout time changed, rescheduling...");
        await scheduleNotification("workout", workoutReminderTime, true);
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [workoutReminderTime, saveSettings]);

  // Handle sleep reminders toggle
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && sleepReminders) {
        await scheduleNotification("sleep", sleepReminderTime, true);
      } else {
        await cancelNotification("sleep");
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    sleepReminders,
    dailyReminders,
    sleepReminderTime,
    saveSettings,
    scheduleNotification,
    cancelNotification,
  ]);

  // Handle sleep time changes
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      if (dailyReminders && sleepReminders) {
        console.log("⏰ Sleep time changed, rescheduling...");
        await scheduleNotification("sleep", sleepReminderTime, true);
      }
      // Save settings to database
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    sleepReminderTime,
    dailyReminders,
    sleepReminders,
    saveSettings,
    scheduleNotification,
  ]);

  const handleFocusAreaToggle = (area) => {
    setFocusAreas((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  // Handle daily reminders toggle - save to database
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dailyReminders, saveSettings]);

  // Save settings when AI Insights, focus areas, or other preferences change
  useEffect(() => {
    if (isInitialMount.current) return;

    const timeoutId = setTimeout(async () => {
      await saveSettings();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    aiInsights,
    insightFrequency,
    focusAreas,
    anonymousDataSharing,
    language,
    saveSettings,
  ]);

  const handleDailyRemindersToggle = (value) => {
    setDailyReminders(value);
    if (!value) {
      setMealReminders(false);
      setWorkoutReminders(false);
      setSleepReminders(false);
    }
  };

  const handleMealRemindersToggle = (value) => {
    if (value && !dailyReminders) {
      return;
    }
    setMealReminders(value);
  };

  const handleWorkoutRemindersToggle = (value) => {
    if (value && !dailyReminders) {
      return;
    }
    setWorkoutReminders(value);
  };

  const handleSleepRemindersToggle = (value) => {
    if (value && !dailyReminders) {
      return;
    }
    setSleepReminders(value);
  };

  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const handleMealTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowMealTimePicker(false);
      if (event.type === "set" && selectedTime) {
        setMealReminderTime(selectedTime);
      }
    } else {
      if (selectedTime) {
        setMealReminderTime(selectedTime);
      }
    }
  };

  const handleWorkoutTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowWorkoutTimePicker(false);
      if (event.type === "set" && selectedTime) {
        setWorkoutReminderTime(selectedTime);
      }
    } else {
      if (selectedTime) {
        setWorkoutReminderTime(selectedTime);
      }
    }
  };

  const handleSleepTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowSleepTimePicker(false);
      if (event.type === "set" && selectedTime) {
        // Create a new Date object to ensure state update
        const newTime = new Date(selectedTime);
        setSleepReminderTime(newTime);
      }
    } else {
      if (selectedTime) {
        // Create a new Date object to ensure state update
        const newTime = new Date(selectedTime);
        setSleepReminderTime(newTime);
      }
    }
  };

  const handleDataExport = () => {
    console.log("Exporting data...");
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            console.log("Clearing history...");
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          // Set logging out flag to prevent settings saves
          setIsLoggingOut(true);
          isLoggingOutRef.current = true;

          try {
            // Cancel notifications in parallel (non-blocking)
            Promise.all([
              cancelNotification("meal"),
              cancelNotification("workout"),
              cancelNotification("sleep"),
            ]).catch((err) => {
              // Silently handle notification cancellation errors
              console.log(
                "Notification cancellation error (non-critical):",
                err,
              );
            });

            // Clear all caches before sign out to prevent showing previous user's data
            clearAllGlobalCaches();

            // Sign out immediately
            const { error } = await supabase.auth.signOut();

            if (error) {
              // Reset flags on error
              setIsLoggingOut(false);
              isLoggingOutRef.current = false;
              Alert.alert("Error", "Failed to logout. Please try again.");
              console.error("Logout error:", error);
            } else {
              // Navigate immediately after sign out
              navigation.reset({
                index: 0,
                routes: [{ name: "Welcome" }],
              });
            }
          } catch (error) {
            // Reset flags on error
            setIsLoggingOut(false);
            isLoggingOutRef.current = false;
            Alert.alert("Error", "An unexpected error occurred.");
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  const renderSection = (icon, eyebrow, title, children) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionIconShell}>
          <Ionicons name={icon} size={18} color={palette.primary} />
        </View>
        <View>
          <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const AnimatedToggleItem = React.memo(
    ({ label, value, onValueChange, subtitle, disabled, onLabelPress }) => {
      const scaleAnim = useRef(new Animated.Value(1)).current;
      const opacityAnim = useRef(new Animated.Value(1)).current;

      const handleToggle = (newValue) => {
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 0.95,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.7,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
        ]).start();

        onValueChange(newValue);
      };

      return (
        <Animated.View
          style={[
            styles.settingItem,
            disabled && styles.settingItemDisabled,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.settingLeft}
            onPress={onLabelPress}
            disabled={!onLabelPress || disabled}
            activeOpacity={onLabelPress ? 0.7 : 1}
          >
            <Text
              style={[
                styles.settingLabel,
                disabled && styles.settingLabelDisabled,
              ]}
            >
              {label}
            </Text>
            {subtitle && (
              <Text
                style={[
                  styles.settingSubtitle,
                  disabled && styles.settingSubtitleDisabled,
                ]}
              >
                {subtitle}
              </Text>
            )}
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Switch
              value={value}
              onValueChange={handleToggle}
              disabled={disabled}
              trackColor={{
                false: palette.switchTrackOff,
                true: palette.switchTrackOn,
              }}
              thumbColor={
                value ? palette.switchThumbOn : palette.switchThumbOff
              }
              ios_backgroundColor={palette.switchTrackOff}
            />
          </Animated.View>
        </Animated.View>
      );
    },
  );
  AnimatedToggleItem.displayName = "AnimatedToggleItem";

  const renderToggleItem = (
    label,
    value,
    onValueChange,
    subtitle = null,
    disabled = false,
    onLabelPress = null,
  ) => (
    <AnimatedToggleItem
      label={label}
      value={value}
      onValueChange={onValueChange}
      subtitle={subtitle}
      disabled={disabled}
      onLabelPress={onLabelPress}
    />
  );

  const renderPillGroup = (options, selectedValue, onSelect) => (
    <View style={styles.pillGroup}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.pillButton,
            selectedValue === option
              ? styles.pillButtonSelected
              : styles.pillButtonUnselected,
          ]}
          onPress={() => onSelect(option)}
        >
          <Text
            style={[
              styles.pillButtonText,
              selectedValue === option
                ? styles.pillButtonTextSelected
                : styles.pillButtonTextUnselected,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Sticky hero header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerEyebrow}>App Settings</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          {renderSection(
            "notifications-outline",
            "Stay on track",
            "Notifications",
            <View>
              {renderToggleItem(
                "Daily Reminders",
                dailyReminders,
                handleDailyRemindersToggle,
              )}
              {renderToggleItem(
                "Meal Reminders",
                mealReminders,
                handleMealRemindersToggle,
                formatTime(mealReminderTime),
                !dailyReminders,
                !dailyReminders ? null : () => setShowMealTimePicker(true),
              )}
              {renderToggleItem(
                "Workout Reminders",
                workoutReminders,
                handleWorkoutRemindersToggle,
                formatTime(workoutReminderTime),
                !dailyReminders,
                !dailyReminders ? null : () => setShowWorkoutTimePicker(true),
              )}
              {renderToggleItem(
                "Sleep Reminders",
                sleepReminders,
                handleSleepRemindersToggle,
                formatTime(sleepReminderTime),
                !dailyReminders,
                !dailyReminders ? null : () => setShowSleepTimePicker(true),
              )}
            </View>,
          )}

          {/* Time Picker Modals - iOS */}
          {Platform.OS === "ios" && (
            <>
              <Modal
                visible={showMealTimePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowMealTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity
                        onPress={() => setShowMealTimePicker(false)}
                      >
                        <Text style={styles.modalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>Meal Reminder Time</Text>
                      <TouchableOpacity
                        onPress={() => setShowMealTimePicker(false)}
                      >
                        <Text style={styles.modalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={mealReminderTime}
                      mode="time"
                      display="spinner"
                      onChange={handleMealTimeChange}
                      style={styles.timePicker}
                    />
                  </View>
                </View>
              </Modal>

              <Modal
                visible={showWorkoutTimePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowWorkoutTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity
                        onPress={() => setShowWorkoutTimePicker(false)}
                      >
                        <Text style={styles.modalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>
                        Workout Reminder Time
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowWorkoutTimePicker(false)}
                      >
                        <Text style={styles.modalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={workoutReminderTime}
                      mode="time"
                      display="spinner"
                      onChange={handleWorkoutTimeChange}
                      style={styles.timePicker}
                    />
                  </View>
                </View>
              </Modal>

              <Modal
                visible={showSleepTimePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSleepTimePicker(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity
                        onPress={() => setShowSleepTimePicker(false)}
                      >
                        <Text style={styles.modalCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>Sleep Reminder Time</Text>
                      <TouchableOpacity
                        onPress={() => setShowSleepTimePicker(false)}
                      >
                        <Text style={styles.modalDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={sleepReminderTime}
                      mode="time"
                      display="spinner"
                      onChange={handleSleepTimeChange}
                      style={styles.timePicker}
                    />
                  </View>
                </View>
              </Modal>
            </>
          )}

          {/* Android Time Pickers */}
          {Platform.OS === "android" && (
            <>
              {showMealTimePicker && (
                <DateTimePicker
                  value={mealReminderTime}
                  mode="time"
                  display="default"
                  onChange={handleMealTimeChange}
                />
              )}
              {showWorkoutTimePicker && (
                <DateTimePicker
                  value={workoutReminderTime}
                  mode="time"
                  display="default"
                  onChange={handleWorkoutTimeChange}
                />
              )}
              {showSleepTimePicker && (
                <DateTimePicker
                  value={sleepReminderTime}
                  mode="time"
                  display="default"
                  onChange={handleSleepTimeChange}
                />
              )}
            </>
          )}

          {renderSection(
            "sparkles-outline",
            "Smart summaries",
            "AI Insights",
            <View>
              <View style={styles.infoRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={palette.primary}
                />
                <Text style={styles.infoText}>
                  AI insights help you reflect and optimize your routine.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Insight Frequency</Text>
                {renderPillGroup(
                  ["Daily", "Weekly"],
                  insightFrequency,
                  setInsightFrequency,
                )}
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Focus Areas</Text>
                <View style={styles.pillGroup}>
                  {Object.entries(focusAreas).map(([area, isSelected]) => (
                    <TouchableOpacity
                      key={area}
                      style={[
                        styles.pillButton,
                        isSelected
                          ? styles.pillButtonSelected
                          : styles.pillButtonUnselected,
                      ]}
                      onPress={() => handleFocusAreaToggle(area)}
                    >
                      <Text
                        style={[
                          styles.pillButtonText,
                          isSelected
                            ? styles.pillButtonTextSelected
                            : styles.pillButtonTextUnselected,
                        ]}
                      >
                        {area.charAt(0).toUpperCase() + area.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>,
          )}

          {renderSection(
            "shield-checkmark-outline",
            "Your data",
            "Privacy & Data",
            <View>
              {renderToggleItem(
                "Anonymous Data Sharing",
                anonymousDataSharing,
                setAnonymousDataSharing,
              )}

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingLabel}>Data Export</Text>
                  <Text style={styles.settingSubtitle}>
                    Last export: 2 days ago
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.exportButton}
                  onPress={handleDataExport}
                >
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                  <Text style={styles.settingLabel}>Clear History</Text>
                </View>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearHistory}
                >
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>,
          )}

          {renderSection(
            "options-outline",
            "App-wide",
            "General",
            <View>
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Language</Text>
                {renderPillGroup(["English", "Español"], language, setLanguage)}
              </View>

              <TouchableOpacity
                style={[
                  styles.logoutButton,
                  isLoggingOut && styles.logoutButtonDisabled,
                ]}
                onPress={handleLogout}
                disabled={isLoggingOut}
                activeOpacity={0.85}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={palette.error} />
                ) : (
                  <Ionicons
                    name="log-out-outline"
                    size={19}
                    color={palette.error}
                  />
                )}
                <Text style={styles.logoutButtonText}>
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Text>
              </TouchableOpacity>
            </View>,
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Calora App v2.1.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Logout Loading Modal */}
      <Modal visible={isLoggingOut} transparent animationType="fade">
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <ActivityIndicator size="large" color={palette.error} />
            <Text style={styles.logoutModalText}>Logging out...</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Same teal palette used across Home / Voice Logging / Sleep Tracker /
// Weight Tracker screens, so this screen shares a consistent visual
// language with the rest of the app.
const createPalette = (themeColors, isDark) => ({
  background: isDark ? "#0F1E1C" : "#F4FBFA",
  card: isDark ? "#17302D" : "#FFFFFF",
  cardSecondary: isDark ? "#1C3935" : "#EEF7F5",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#BED9D3" : "#5B7873",
  textMuted: isDark ? "#8FAAA5" : "#7D9994",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  primary: "#1F4E4A",
  primaryMuted: "#3D6A66",
  success: "#1F8A6E",
  warning: "#D97706",
  error: "#B94F4F",
  shadow: "#102624",
  heroChip: isDark ? "#234440" : "#E9F5F2",
  heroChipBorder: isDark ? "#345A55" : "#D2E7E2",
  switchTrackOff: isDark ? "rgba(255,255,255,0.2)" : "#D5E8E3",
  switchTrackOn: "#1F4E4A",
  switchThumbOn: "#FFFFFF",
  switchThumbOff: isDark ? "#F4FBFA" : "#FFFFFF",
});

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    /* Floating hero header, matching Home / Voice / Sleep / Weight cards */
    headerContainer: {
      backgroundColor: palette.primary,
      marginHorizontal: 18,
      marginTop: 12,
      marginBottom: 16,
      borderRadius: 30,
      paddingVertical: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: isDark ? 8 : 6,
      zIndex: 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerSpacer: {
      width: 38,
    },
    headerTitleWrap: {
      alignItems: "center",
    },
    headerEyebrow: {
      fontSize: 18,
      fontFamily: "Lexend-SemiBold",
      color: "#CFE6E1",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 3,
    },
    headerTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
    },

    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    content: {
      paddingTop: 16,
      paddingHorizontal: 18,
      paddingBottom: 20,
    },

    /* Section card */
    sectionCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionIconShell: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 3,
    },
    sectionTitle: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    sectionContent: {},

    /* Toggle rows (each its own soft card) */
    settingItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 10,
    },
    settingLeft: {
      flex: 1,
      paddingRight: 10,
    },
    settingLabel: {
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    settingSubtitle: {
      fontSize: 12.5,
      fontFamily: "Manrope-Regular",
      color: palette.textMuted,
      marginTop: 3,
    },
    settingItemDisabled: {
      opacity: 0.5,
    },
    settingLabelDisabled: {
      color: palette.textMuted,
    },
    settingSubtitleDisabled: {
      color: palette.textMuted,
    },

    /* AI insights tip */
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.heroChip,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
      marginLeft: 8,
      flex: 1,
      lineHeight: 17,
    },

    subsection: {
      marginBottom: 14,
    },
    subsectionTitle: {
      fontSize: 13.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 10,
    },

    /* Pills */
    pillGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pillButton: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
    },
    pillButtonSelected: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    pillButtonUnselected: {
      backgroundColor: palette.card,
      borderColor: palette.border,
    },
    pillButtonText: {
      fontSize: 13,
      fontFamily: "Lexend-SemiBold",
    },
    pillButtonTextSelected: {
      color: "#FFFFFF",
    },
    pillButtonTextUnselected: {
      color: palette.textSecondary,
    },

    /* Export / Clear chips */
    exportButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
    },
    exportButtonText: {
      fontSize: 12.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
    },
    clearButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.error,
    },
    clearButtonText: {
      fontSize: 12.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.error,
    },

    /* Logout */
    logoutButton: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      paddingHorizontal: 10,
      backgroundColor: palette.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.error,
    },
    logoutButtonDisabled: {
      opacity: 0.6,
    },
    logoutButtonText: {
      fontSize: 15,
      fontFamily: "Lexend-Bold",
      color: palette.error,
      marginLeft: 8,
    },
    logoutModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(16, 38, 36, 0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    logoutModalContent: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 26,
      alignItems: "center",
      minWidth: 210,
      borderWidth: 1,
      borderColor: palette.border,
    },
    logoutModalText: {
      marginTop: 16,
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },

    /* Footer */
    footer: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 20,
    },
    footerText: {
      fontSize: 12.5,
      fontFamily: "Manrope-Regular",
      color: palette.textMuted,
    },

    /* iOS time picker bottom sheet */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(16, 38, 36, 0.7)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: palette.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    modalTitle: {
      fontSize: 15.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    modalCancel: {
      fontSize: 15,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
    modalDone: {
      fontSize: 15,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },
    timePicker: {
      width: "100%",
      height: 200,
    },
  });

// Wrap with React.memo to prevent unnecessary re-renders (same pattern as StepTrackerScreen)
export default React.memo(AppSettingsScreen, (prevProps, nextProps) => {
  return prevProps.navigation === nextProps.navigation;
});
