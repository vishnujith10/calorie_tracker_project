// HydrationTrackerScreen.js

import { Feather as Icon, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

// Global cache for HydrationTrackerScreen (Instagram pattern)
const globalHydrationCache = {
  lastFetchTime: 0,
  CACHE_DURATION: 60000, // 60 seconds
  cachedData: null,
};

// Circular water gauge dimensions
const CIRCLE_SIZE = 226;
const RING_STROKE = 12;
const RING_GAP = 10;
const RING_SIZE = CIRCLE_SIZE + RING_GAP * 2 + RING_STROKE;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HydrationTrackerScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  // Initialize state with cached data (Instagram pattern)
  const [currentIntake, setCurrentIntake] = useState(
    () => globalHydrationCache.cachedData?.currentIntake || 0,
  );
  const [dailyGoal, setDailyGoal] = useState(
    () => globalHydrationCache.cachedData?.dailyGoal || 2.5,
  );
  const [defaultGoal, setDefaultGoal] = useState(
    () => globalHydrationCache.cachedData?.defaultGoal || 2.5,
  ); // Persistent default goal
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState("2.5");
  // New state for intake values and modal
  const [intake1, setIntake1] = useState(
    () => globalHydrationCache.cachedData?.intake1 || 250,
  );
  const [intake2, setIntake2] = useState(
    () => globalHydrationCache.cachedData?.intake2 || 500,
  );
  const [intakeModalVisible, setIntakeModalVisible] = useState(false);
  const [intakeInput1, setIntakeInput1] = useState("250");
  const [intakeInput2, setIntakeInput2] = useState("500");
  const [userId, setUserId] = useState(null);
  const [recordId, setRecordId] = useState(
    () => globalHydrationCache.cachedData?.recordId || null,
  );
  // Weekly data state
  const [weeklyIntakeData, setWeeklyIntakeData] = useState(
    () => globalHydrationCache.cachedData?.weeklyIntakeData || {},
  );
  // New state for tracking intake values per day
  const [weeklyIntakeValues, setWeeklyIntakeValues] = useState(
    () => globalHydrationCache.cachedData?.weeklyIntakeValues || {},
  );
  // New state for tracking goals per day
  const [weeklyGoals, setWeeklyGoals] = useState(
    () => globalHydrationCache.cachedData?.weeklyGoals || {},
  );
  const [historicalGoals, setHistoricalGoals] = useState(
    () => globalHydrationCache.cachedData?.historicalGoals || {},
  );
  // Animated value for bar height
  const [barAnimation] = useState(new Animated.Value(0));

  // Context-aware personalization
  const [personalizationEngine, setPersonalizationEngine] = useState(null);
  const [contextualRecommendations, setContextualRecommendations] = useState(
    [],
  );
  const [dailyContext, setDailyContext] = useState(null);

  const progress = (currentIntake / dailyGoal) * 100;
  const isGoalAchieved = currentIntake >= dailyGoal;

  // Animated water level (0–100 representing % fill)
  const waterAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    const targetProgress = Math.min((currentIntake / dailyGoal) * 100, 100);
    Animated.timing(waterAnim, {
      toValue: targetProgress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [currentIntake, dailyGoal]);

  // Interpolate animated value to a percentage string for height/bottom
  const animatedHeightStyle = waterAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  // Ring progress: same percentage drives the circular border fill
  const ringStrokeDashoffset = waterAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [RING_CIRCUMFERENCE, 0],
    extrapolate: "clamp",
  });

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Get current day of week (0 = Sunday, 1 = Monday, etc.)
  const getCurrentDay = () => {
    const today = new Date();
    return today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  };

  // Convert to our array index (Monday = 0, Tuesday = 1, etc.)
  const getTodayIndex = () => {
    const day = getCurrentDay();
    return day === 0 ? 6 : day - 1; // Convert Sunday (0) to index 6, others to index-1
  };

  // Get start of current week (Monday)
  const getWeekStartDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split("T")[0];
  };

  // Get all dates for current week
  const getCurrentWeekDates = () => {
    const weekStart = new Date(getWeekStartDate());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  const todayIndex = getTodayIndex();

  // Initialize user and load today's data
  useEffect(() => {
    initializeUser();
  }, []);

  // Auto-save goal achievement status at midnight or when app closes
  useEffect(() => {
    const checkAndUpdateGoalStatus = async () => {
      if (recordId && userId) {
        const goalStatus =
          currentIntake >= dailyGoal ? "achieved" : "not achieved";
        await updateGoalStatus(goalStatus);
      }
    };

    // Set up interval to check every minute if it's past midnight
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        checkAndUpdateGoalStatus();
        // Load new week data if it's Monday
        if (now.getDay() === 1) {
          loadWeeklyData(userId);
        }
        // Update intake values for new day
        updateIntakeValuesForNewDay();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [recordId, userId, currentIntake, dailyGoal]);

  // Monitor changes in currentIntake and dailyGoal to automatically update goal status
  useEffect(() => {
    if (recordId && userId) {
      checkAndUpdateGoalStatus();
    }
  }, [currentIntake, dailyGoal, recordId, userId]);

  // Function to update intake values for new day
  const updateIntakeValuesForNewDay = () => {
    const updatedWeeklyIntakeValues = { ...weeklyIntakeValues };
    updatedWeeklyIntakeValues[todayIndex] = {
      intake1: intake1,
      intake2: intake2,
    };
    setWeeklyIntakeValues(updatedWeeklyIntakeValues);
  };

  // Generate context-aware hydration recommendations
  const generateHydrationRecommendations = (context, currentIntake, goal) => {
    const recommendations = [];
    const progress = (currentIntake / goal) * 100;

    // High stress = need more hydration
    if (
      context.responses.stress === "High" ||
      context.responses.stress === "Very High"
    ) {
      recommendations.push({
        type: "stress",
        priority: "high",
        message: "High stress increases cortisol and dehydration risk.",
        action: "Add an extra glass of water",
        icon: "🧘‍♀️",
      });
    }

    // Low sleep = need more hydration
    if (context.responses.sleep < 7) {
      recommendations.push({
        type: "sleep",
        priority: "high",
        message:
          "Poor sleep affects hydration. Your body needs extra water to recover.",
        action: "Drink water first thing in the morning",
        icon: "😴",
      });
    }

    // Low energy = might be dehydration
    if (
      context.responses.energy === "Low" ||
      context.responses.energy === "Very Low"
    ) {
      recommendations.push({
        type: "energy",
        priority: "medium",
        message: "Low energy can be a sign of dehydration.",
        action: "Try drinking a glass of water",
        icon: "⚡",
      });
    }

    // Travel situation = need more hydration
    if (
      context.responses.situation &&
      context.responses.situation.includes("Traveling")
    ) {
      recommendations.push({
        type: "travel",
        priority: "high",
        message: "Traveling increases dehydration risk, especially on flights.",
        action: "Drink extra water and avoid alcohol",
        icon: "✈️",
      });
    }

    // High activity = need more hydration
    if (
      context.responses.situation &&
      context.responses.situation.includes("Extra active day")
    ) {
      recommendations.push({
        type: "activity",
        priority: "high",
        message: "Extra active day! Your body needs more hydration.",
        action: "Add 500ml extra water",
        icon: "🏃‍♀️",
      });
    }

    // Progress-based recommendations
    if (progress < 50) {
      recommendations.push({
        type: "progress",
        priority: "medium",
        message: "You're at " + Math.round(progress) + "% of your goal.",
        action: "Keep going! You're doing great",
        icon: "💧",
      });
    } else if (progress >= 100) {
      recommendations.push({
        type: "celebration",
        priority: "low",
        message: "Amazing! You've hit your hydration goal! 🎉",
        action: "Keep up the great work",
        icon: "🎉",
      });
    }

    return recommendations;
  };

  const initializeUser = async () => {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "Please login first");
        return;
      }

      setUserId(user.id);

      // Load the most recent goal from database to use as default
      await loadMostRecentGoal(user.id);

      // Generate context-aware recommendations removed

      // Clean up any existing duplicates first
      await cleanupDuplicateRecords(user.id, getCurrentDate());
      await loadTodayData(user.id);
      await loadWeeklyData(user.id);
      // Initialize intake values for today if not already set
      if (!weeklyIntakeValues[todayIndex]) {
        updateIntakeValuesForNewDay();
      }
    } catch (error) {
      console.error("Error initializing user:", error);
      Alert.alert("Error", "Failed to initialize user data");
    }
  };

  const loadMostRecentGoal = async (userId) => {
    try {
      // Get the most recent goal from any previous day
      const { data, error } = await supabase
        .from("daily_water_intake")
        .select("daily_goal_ml")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        const recentGoal = data.daily_goal_ml / 1000; // Convert ml to L
        console.log("📊 Loaded most recent goal:", recentGoal, "L");
        setDefaultGoal(recentGoal);

        // Update cache
        globalHydrationCache.cachedData = {
          ...globalHydrationCache.cachedData,
          defaultGoal: recentGoal,
        };
      } else {
        // No previous records, use default 2.5L
        console.log("📊 No previous goal found, using default 2.5L");
        setDefaultGoal(2.5);
      }
    } catch (error) {
      console.error("Error loading most recent goal:", error);
      // Fallback to default
      setDefaultGoal(2.5);
    }
  };

  const loadWeeklyData = async (userId) => {
    try {
      const weekDates = getCurrentWeekDates();

      const { data, error } = await supabase
        .from("daily_water_intake")
        .select(
          "date, current_intake_ml, intake1_ml, intake2_ml, daily_goal_ml",
        )
        .eq("user_id", userId)
        .in("date", weekDates);

      if (error) throw error;

      // Convert data to our weekly format
      const weeklyData = {};
      const weeklyIntakeValuesData = {};
      const weeklyGoalsData = {};
      data?.forEach((record) => {
        const dayIndex = weekDates.indexOf(record.date);
        if (dayIndex !== -1) {
          weeklyData[dayIndex] = record.current_intake_ml / 1000; // Convert ml to L
          weeklyIntakeValuesData[dayIndex] = {
            intake1: record.intake1_ml || 250,
            intake2: record.intake2_ml || 500,
          };
          // Store each day's goal separately
          weeklyGoalsData[dayIndex] = record.daily_goal_ml / 1000; // Convert ml to L
        }
      });

      setWeeklyIntakeData(weeklyData);
      setWeeklyIntakeValues(weeklyIntakeValuesData);
      // Store weekly goals separately
      setWeeklyGoals(weeklyGoalsData);
      // Store historical goals (don't update when today's goal changes)
      setHistoricalGoals(weeklyGoalsData);

      // Update cache
      globalHydrationCache.cachedData = {
        ...globalHydrationCache.cachedData,
        weeklyIntakeData: weeklyData,
        weeklyIntakeValues: weeklyIntakeValuesData,
        weeklyGoals: weeklyGoalsData,
        historicalGoals: weeklyGoalsData,
      };
    } catch (error) {
      console.error("Error loading weekly data:", error);
    }
  };

  const loadTodayData = async (userId) => {
    try {
      const today = getCurrentDate();

      // Check if record exists for today - get the most recent one if multiple exist
      const { data, error } = await supabase
        .from("daily_water_intake")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error
        throw error;
      }

      if (data) {
        // Record exists, load the data
        const intakeValue = data.current_intake_ml / 1000;
        const goalValue = data.daily_goal_ml / 1000;
        const intake1Value = data.intake1_ml || 250;
        const intake2Value = data.intake2_ml || 500;

        setCurrentIntake(intakeValue);
        setDailyGoal(goalValue);
        setDefaultGoal(goalValue); // Set default goal to today's goal
        setRecordId(data.id);
        setIntake1(intake1Value);
        setIntake2(intake2Value);

        // Update cache
        globalHydrationCache.cachedData = {
          ...globalHydrationCache.cachedData,
          currentIntake: intakeValue,
          dailyGoal: goalValue,
          defaultGoal: goalValue, // Cache the default goal
          intake1: intake1Value,
          intake2: intake2Value,
          recordId: data.id,
        };
        globalHydrationCache.lastFetchTime = Date.now();

        // Check and update goal status if needed
        if (data.goal_status) {
          const currentStatus = data.goal_status;
          const shouldBeStatus =
            intakeValue >= goalValue ? "achieved" : "not achieved";
          if (currentStatus !== shouldBeStatus) {
            await updateGoalStatus(shouldBeStatus);
          }
        }
      } else {
        // No record for today, create new one
        await createTodayRecord(userId);
      }
    } catch (error) {
      console.error("Error loading today data:", error);
      Alert.alert("Error", "Failed to load today's data");
    }
  };

  const createTodayRecord = async (userId) => {
    try {
      const today = getCurrentDate();

      // First, clean up any existing duplicate records for today
      await cleanupDuplicateRecords(userId, today);

      // Use upsert to prevent duplicates - this will insert if not exists, update if exists
      const { data, error } = await supabase
        .from("daily_water_intake")
        .upsert(
          {
            user_id: userId,
            date: today,
            current_intake_ml: 0,
            daily_goal_ml: defaultGoal * 1000, // Use persistent default goal instead of dailyGoal
            intake1_ml: intake1,
            intake2_ml: intake2,
            goal_status: "not achieved",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,date", // This will prevent duplicates
          },
        )
        .select()
        .single();

      if (error) throw error;

      setRecordId(data.id);
      setCurrentIntake(0);
      setDailyGoal(defaultGoal); // Set today's goal to the default goal
    } catch (error) {
      console.error("Error creating today record:", error);
      Alert.alert("Error", "Failed to create today's record");
    }
  };

  const cleanupDuplicateRecords = async (userId, date) => {
    try {
      // Get all records for this user and date
      const { data: records, error } = await supabase
        .from("daily_water_intake")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (records && records.length > 1) {
        // Keep the most recent record, delete the rest
        const recordsToDelete = records.slice(1);
        const idsToDelete = recordsToDelete.map((record) => record.id);

        const { error: deleteError } = await supabase
          .from("daily_water_intake")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) throw deleteError;
      }
    } catch (error) {
      console.error("Error cleaning up duplicate records:", error);
    }
  };

  const updateWaterIntake = async (newIntakeL) => {
    if (!recordId || !userId) return;

    try {
      const newIntakeMl = Math.round(newIntakeL * 1000); // Convert L to ml

      const { error } = await supabase
        .from("daily_water_intake")
        .update({
          current_intake_ml: newIntakeMl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (error) throw error;

      // Update weekly data for today
      const updatedWeeklyData = { ...weeklyIntakeData };
      updatedWeeklyData[todayIndex] = newIntakeL;
      setWeeklyIntakeData(updatedWeeklyData);
    } catch (error) {
      console.error("Error updating water intake:", error);
      Alert.alert("Error", "Failed to update water intake");
    }
  };

  const updateGoalStatus = async (status) => {
    if (!recordId) return;

    try {
      const { error } = await supabase
        .from("daily_water_intake")
        .update({
          goal_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating goal status:", error);
    }
  };

  // Function to automatically check and update goal status
  const checkAndUpdateGoalStatus = async () => {
    if (!recordId) return;

    const newStatus = currentIntake >= dailyGoal ? "achieved" : "not achieved";
    await updateGoalStatus(newStatus);
  };

  const updateDailyGoal = async (newGoalL) => {
    if (!recordId) return;

    try {
      const newGoalMl = Math.round(newGoalL * 1000); // Convert L to ml

      const { error } = await supabase
        .from("daily_water_intake")
        .update({
          daily_goal_ml: newGoalMl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId);

      if (error) throw error;

      // Update the weeklyGoals state for today's index
      setWeeklyGoals((prev) => ({
        ...prev,
        [todayIndex]: newGoalL,
      }));
    } catch (error) {
      console.error("Error updating daily goal:", error);
      Alert.alert("Error", "Failed to update daily goal");
    }
  };

  // Get best day of the week
  const getBestDay = () => {
    const dayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    let bestDayIndex = -1;
    let bestIntake = 0;

    // Find the day with highest intake
    Object.keys(weeklyIntakeData).forEach((dayIndex) => {
      const intake = weeklyIntakeData[dayIndex];
      if (intake > bestIntake) {
        bestIntake = intake;
        bestDayIndex = parseInt(dayIndex);
      }
    });

    // If no data exists or all are 0, check if today has any intake
    if (bestIntake === 0 && currentIntake > 0) {
      return {
        day: dayNames[todayIndex],
        intake: currentIntake,
        isToday: true,
      };
    }

    // If still no best day found, return null
    if (bestDayIndex === -1 || bestIntake === 0) {
      return null;
    }

    return {
      day: dayNames[bestDayIndex],
      intake: bestIntake,
      isToday: bestDayIndex === todayIndex,
    };
  };

  const bestDay = getBestDay();

  const barColorRange = useMemo(
    () => [palette.barEmpty, palette.barProgress, palette.barSuccess],
    [palette],
  );

  // Updated weekly data with dynamic today's progress and database data
  const weeklyData = useMemo(
    () => [
      {
        day: "Mon",
        label: "Mon",
        intake: todayIndex === 0 ? currentIntake : weeklyIntakeData[0] || 0,
        isToday: todayIndex === 0,
        goalAchieved:
          todayIndex === 0
            ? isGoalAchieved
            : (weeklyIntakeData[0] || 0) >= (weeklyGoals[0] || defaultGoal),
        intake1:
          todayIndex === 0 ? intake1 : weeklyIntakeValues[0]?.intake1 || 250,
        intake2:
          todayIndex === 0 ? intake2 : weeklyIntakeValues[0]?.intake2 || 500,
        dayGoal: todayIndex === 0 ? dailyGoal : weeklyGoals[0] || defaultGoal,
      },
      {
        day: "Tue",
        label: "Tue",
        intake: todayIndex === 1 ? currentIntake : weeklyIntakeData[1] || 0,
        isToday: todayIndex === 1,
        goalAchieved:
          todayIndex === 1
            ? isGoalAchieved
            : (weeklyIntakeData[1] || 0) >= (weeklyGoals[1] || defaultGoal),
        intake1:
          todayIndex === 1 ? intake1 : weeklyIntakeValues[1]?.intake1 || 250,
        intake2:
          todayIndex === 1 ? intake2 : weeklyIntakeValues[1]?.intake2 || 500,
        dayGoal: todayIndex === 1 ? dailyGoal : weeklyGoals[1] || defaultGoal,
      },
      {
        day: "Wed",
        label: "Wed",
        intake: todayIndex === 2 ? currentIntake : weeklyIntakeData[2] || 0,
        isToday: todayIndex === 2,
        goalAchieved:
          todayIndex === 2
            ? isGoalAchieved
            : (weeklyIntakeData[2] || 0) >= (weeklyGoals[2] || defaultGoal),
        intake1:
          todayIndex === 2 ? intake1 : weeklyIntakeValues[2]?.intake1 || 250,
        intake2:
          todayIndex === 2 ? intake2 : weeklyIntakeValues[2]?.intake2 || 500,
        dayGoal: todayIndex === 2 ? dailyGoal : weeklyGoals[2] || defaultGoal,
      },
      {
        day: "Thu",
        label: "Thu",
        intake: todayIndex === 3 ? currentIntake : weeklyIntakeData[3] || 0,
        isToday: todayIndex === 3,
        goalAchieved:
          todayIndex === 3
            ? isGoalAchieved
            : (weeklyIntakeData[3] || 0) >= (weeklyGoals[3] || defaultGoal),
        intake1:
          todayIndex === 3 ? intake1 : weeklyIntakeValues[3]?.intake1 || 250,
        intake2:
          todayIndex === 3 ? intake2 : weeklyIntakeValues[3]?.intake2 || 500,
        dayGoal: todayIndex === 3 ? dailyGoal : weeklyGoals[3] || defaultGoal,
      },
      {
        day: "Fri",
        label: "Fri",
        intake: todayIndex === 4 ? currentIntake : weeklyIntakeData[4] || 0,
        isToday: todayIndex === 4,
        goalAchieved:
          todayIndex === 4
            ? isGoalAchieved
            : (weeklyIntakeData[4] || 0) >= (weeklyGoals[4] || defaultGoal),
        intake1:
          todayIndex === 4 ? intake1 : weeklyIntakeValues[4]?.intake1 || 250,
        intake2:
          todayIndex === 4 ? intake2 : weeklyIntakeValues[4]?.intake2 || 500,
        dayGoal: todayIndex === 4 ? dailyGoal : weeklyGoals[4] || defaultGoal,
      },
      {
        day: "Sat",
        label: "Sat",
        intake: todayIndex === 5 ? currentIntake : weeklyIntakeData[5] || 0,
        isToday: todayIndex === 5,
        goalAchieved:
          todayIndex === 5
            ? isGoalAchieved
            : (weeklyIntakeData[5] || 0) >= (weeklyGoals[5] || defaultGoal),
        intake1:
          todayIndex === 5 ? intake1 : weeklyIntakeValues[5]?.intake1 || 250,
        intake2:
          todayIndex === 5 ? intake2 : weeklyIntakeValues[5]?.intake2 || 500,
        dayGoal: todayIndex === 5 ? dailyGoal : weeklyGoals[5] || defaultGoal,
      },
      {
        day: "Sun",
        label: "Sun",
        intake: todayIndex === 6 ? currentIntake : weeklyIntakeData[6] || 0,
        isToday: todayIndex === 6,
        goalAchieved:
          todayIndex === 6
            ? isGoalAchieved
            : (weeklyIntakeData[6] || 0) >= (weeklyGoals[6] || defaultGoal),
        intake1:
          todayIndex === 6 ? intake1 : weeklyIntakeValues[6]?.intake1 || 250,
        intake2:
          todayIndex === 6 ? intake2 : weeklyIntakeValues[6]?.intake2 || 500,
        dayGoal: todayIndex === 6 ? dailyGoal : weeklyGoals[6] || defaultGoal,
      },
    ],
    [
      todayIndex,
      currentIntake,
      weeklyIntakeData,
      weeklyGoals,
      isGoalAchieved,
      intake1,
      intake2,
      weeklyIntakeValues,
      defaultGoal,
    ],
  );

  const addWater = async (amount) => {
    const newIntake = Math.min(currentIntake + amount, dailyGoal);

    // Optimistic update - update UI immediately
    setCurrentIntake(newIntake);

    // Update HydrationTrackerScreen cache immediately
    if (globalHydrationCache.cachedData) {
      globalHydrationCache.cachedData.currentIntake = newIntake;
      globalHydrationCache.lastFetchTime = Date.now();
    }

    // Also update MainDashboard's hydration cache for sync
    try {
      const { getMainDashboardCache } = require("../utils/cacheManager");
      const mainCache = getMainDashboardCache();
      if (mainCache.cachedHydrationData) {
        mainCache.cachedHydrationData.currentIntake = newIntake;
        mainCache.lastHydrationFetch = Date.now();
      }
    } catch (error) {
      // Silent - cacheManager might not exist yet
    }

    await updateWaterIntake(newIntake);

    // Check if goal is achieved and update goal status
    if (newIntake >= dailyGoal) {
      await updateGoalStatus("achieved");
    }
  };

  const getBarHeight = (intake, isToday, dayGoal) => {
    const maxHeight = 120;
    const minHeight = 20; // Minimum height for circle appearance

    if (intake === 0) {
      return minHeight; // Show as circle when no intake
    }

    // Use the specific day's goal instead of today's goal
    const goalToUse = dayGoal || dailyGoal;
    const percentage = Math.min((intake / goalToUse) * 100, 100);
    const calculatedHeight = Math.max(
      (percentage / 100) * maxHeight,
      minHeight,
    );

    return calculatedHeight;
  };

  const handleGoalChange = async () => {
    const newGoal = parseFloat(goalInput);
    if (!isNaN(newGoal) && newGoal > 0) {
      const oldGoal = dailyGoal;
      setDailyGoal(newGoal);
      setDefaultGoal(newGoal); // Update the persistent default goal
      const adjustedIntake = Math.min(currentIntake, newGoal);
      setCurrentIntake(adjustedIntake);
      await updateDailyGoal(newGoal);

      // Update the water intake in database with adjusted value
      await updateWaterIntake(adjustedIntake);

      // Check and update goal status based on new goal and current intake
      if (adjustedIntake >= newGoal) {
        await updateGoalStatus("achieved");
      } else {
        await updateGoalStatus("not achieved");
      }

      // Update cache with new default goal
      globalHydrationCache.cachedData = {
        ...globalHydrationCache.cachedData,
        dailyGoal: newGoal,
        defaultGoal: newGoal,
      };

      setModalVisible(false);
    }
  };

  const handleIntakeChange = async () => {
    const val1 = parseInt(intakeInput1);
    const val2 = parseInt(intakeInput2);
    if (!isNaN(val1) && val1 > 0 && !isNaN(val2) && val2 > 0) {
      setIntake1(val1);
      setIntake2(val2);

      // Update the database with new intake values
      if (recordId) {
        try {
          const { error } = await supabase
            .from("daily_water_intake")
            .update({
              intake1_ml: val1,
              intake2_ml: val2,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recordId);

          if (error) throw error;
        } catch (error) {
          console.error("Error updating intake values:", error);
          Alert.alert("Error", "Failed to update intake values");
        }
      }

      // Update weekly intake values for today
      const updatedWeeklyIntakeValues = { ...weeklyIntakeValues };
      updatedWeeklyIntakeValues[todayIndex] = {
        intake1: val1,
        intake2: val2,
      };
      setWeeklyIntakeValues(updatedWeeklyIntakeValues);

      setIntakeModalVisible(false);
    }
  };

  // Animated Bar Component - Memoized to prevent re-renders (Instagram pattern)
  const AnimatedBar = React.memo(
    ({ data, index }) => {
      // Initialize with final values (no animation on mount) - Instagram pattern
      const initialHeight = getBarHeight(
        data.intake,
        data.isToday,
        data.dayGoal,
      );
      const initialColor = data.intake === 0 ? 0 : data.goalAchieved ? 2 : 1;

      const [animatedHeight] = useState(new Animated.Value(initialHeight));
      const [animatedColor] = useState(new Animated.Value(initialColor));
      const [hasAnimated, setHasAnimated] = useState(false);

      useEffect(() => {
        // Only animate on subsequent changes, not on mount
        if (!hasAnimated) {
          setHasAnimated(true);
          return;
        }

        const targetHeight = getBarHeight(
          data.intake,
          data.isToday,
          data.dayGoal,
        );
        const targetColor = data.intake === 0 ? 0 : data.goalAchieved ? 2 : 1;

        // Animate height
        Animated.timing(animatedHeight, {
          toValue: targetHeight,
          duration: 300, // Faster animation
          useNativeDriver: false,
        }).start();

        // Animate color
        Animated.timing(animatedColor, {
          toValue: targetColor,
          duration: 200, // Faster animation
          useNativeDriver: false,
        }).start();
      }, [data.intake, data.goalAchieved]);

      const backgroundColor = animatedColor.interpolate({
        inputRange: [0, 1, 2],
        outputRange: barColorRange,
      });

      return (
        <View style={styles.barColumn}>
          <Animated.View
            style={[
              styles.bar,
              {
                height: animatedHeight,
                backgroundColor: backgroundColor,
                borderRadius: 4, // Always rounded for circle effect
              },
            ]}
          />
          <Text
            style={[
              styles.barDayLabel,
              {
                fontWeight: data.isToday ? "bold" : "normal",
                color: data.isToday
                  ? palette.barLabelToday
                  : palette.barLabelDefault,
              },
            ]}
          >
            {data.day}
          </Text>
        </View>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison function - only re-render if these values change
      return (
        prevProps.data.intake === nextProps.data.intake &&
        prevProps.data.goalAchieved === nextProps.data.goalAchieved &&
        prevProps.data.isToday === nextProps.data.isToday &&
        prevProps.data.day === nextProps.data.day
      );
    },
  );

  // Set display name for debugging
  AnimatedBar.displayName = "AnimatedBar";

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={{
            paddingBottom: insets.bottom >= 20 ? insets.bottom + 20 : 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Plain header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={palette.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Hydration</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.innerContainer}>
            {/* Circular water gauge */}
            <View style={styles.gaugeWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
                {/* Track */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={palette.ringTrack}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {/* Progress — same % as the water fill */}
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={palette.primary}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeDasharray={`${RING_CIRCUMFERENCE}, ${RING_CIRCUMFERENCE}`}
                  strokeDashoffset={ringStrokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                />
              </Svg>

              <View style={styles.waterCircle}>
                {/* Empty (air) backdrop */}
                <View style={styles.waterCircleBackdrop} />

                {/* Solid water body — flat fill, no wave motion */}
                <Animated.View
                  style={[styles.waterFill, { height: animatedHeightStyle }]}
                />

                {/* Content overlay — plain text directly on the fill, no boxed backdrop */}
                <View
                  style={styles.waterTextContainer}
                  pointerEvents="box-none"
                >
                  <Text style={styles.waterAmount}>
                    {currentIntake.toFixed(2)}L
                  </Text>
                  <Text style={styles.waterGoal}>of {dailyGoal}L</Text>
                  <Text style={styles.hydrated}>
                    {Math.round(progress)}% Hydrated
                  </Text>
                  {isGoalAchieved && (
                    <Text style={styles.goalAchieved}>🎉 Goal Achieved!</Text>
                  )}
                  <View
                    style={styles.buttonRowInsideFill}
                    pointerEvents="box-none"
                  >
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addWater(intake1 / 1000)}
                      pointerEvents="auto"
                    >
                      <Text
                        style={styles.addButtonText}
                      >{`+${intake1}ml`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => addWater(intake2 / 1000)}
                      pointerEvents="auto"
                    >
                      <Text
                        style={styles.addButtonText}
                      >{`+${intake2}ml`}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Combined Settings Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconShell}>
                  <Icon name="sliders" size={16} color={palette.primary} />
                </View>
                <View>
                  <Text style={styles.sectionEyebrow}>Preferences</Text>
                  <Text style={styles.sectionTitle}>Goal & Intakes</Text>
                </View>
              </View>

              {/* Daily Goal Row */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={() => {
                  setGoalInput(dailyGoal.toString());
                  setModalVisible(true);
                }}
              >
                <View style={styles.iconCircle}>
                  <Icon name="droplet" size={17} color={palette.primary} />
                </View>
                <Text style={styles.cardText}>Daily Goal: {dailyGoal}L</Text>
                <Icon
                  name="chevron-right"
                  size={18}
                  color={palette.textMuted}
                />
              </TouchableOpacity>
              {/* Change Daily Intakes Row */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={() => {
                  setIntakeInput1(intake1.toString());
                  setIntakeInput2(intake2.toString());
                  setIntakeModalVisible(true);
                }}
              >
                <View style={styles.iconCircle}>
                  <Icon name="edit-2" size={16} color={palette.primary} />
                </View>
                <Text style={styles.cardText}>Change daily intakes</Text>
                <Icon
                  name="chevron-right"
                  size={18}
                  color={palette.textMuted}
                />
              </TouchableOpacity>
              {/* Reminders Row */}
              {/* <View style={styles.cardRow}>
                <View style={styles.iconCircle}>
                  <Icon name="bell" size={18} color="#9333ea" />
                </View>
                <Text style={styles.cardText}>Reminders: Every 2 hours</Text>
                <TouchableOpacity
                  onPress={() => setRemindersEnabled(!remindersEnabled)}
                  style={[styles.toggle, { backgroundColor: remindersEnabled ? '#9333ea' : '#ccc' }]}
                >
                  <View
                    style={[styles.toggleKnob, { transform: [{ translateX: remindersEnabled ? 22 : 2 }] }]}
                  />
                </TouchableOpacity>
              </View> */}
            </View>

            {/* Weekly Progress */}
            <View style={styles.weeklyCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconShell}>
                  <Icon name="bar-chart-2" size={16} color={palette.primary} />
                </View>
                <View>
                  <Text style={styles.sectionEyebrow}>This week</Text>
                  <Text style={styles.sectionTitle}>Weekly Progress</Text>
                </View>
              </View>
              <View style={styles.barChart}>
                {weeklyData.map((data, index) => (
                  <AnimatedBar key={index} data={data} index={index} />
                ))}
              </View>
            </View>

            {/* Context-Aware Recommendations */}
            {contextualRecommendations.length > 0 && (
              <View style={styles.recommendationsCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionIconShell}>
                    <Text style={{ fontSize: 16 }}>💡</Text>
                  </View>
                  <View>
                    <Text style={styles.sectionEyebrow}>For you</Text>
                    <Text style={styles.sectionTitle}>Personalized Tips</Text>
                  </View>
                </View>
                {contextualRecommendations.map((rec, index) => (
                  <View
                    key={index}
                    style={[
                      styles.recommendationItem,
                      rec.priority === "high" &&
                        styles.highPriorityRecommendation,
                    ]}
                  >
                    <Text style={styles.recommendationIcon}>{rec.icon}</Text>
                    <View style={styles.recommendationContent}>
                      <Text style={styles.recommendationMessage}>
                        {rec.message}
                      </Text>
                      <Text style={styles.recommendationAction}>
                        {rec.action}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Best Day Card */}
            <View style={styles.card}>
              <View style={styles.cardRow1}>
                <View style={[styles.iconCircle, styles.bestDayIcon]}>
                  <Icon name="droplet" size={20} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bestDayTitle}>Best Day</Text>
                  <Text style={styles.bestDayText}>
                    {bestDay
                      ? `${bestDay.isToday ? "Today" : bestDay.day}: ${bestDay.intake.toFixed(1)}L`
                      : "Keep going!"}
                  </Text>
                  <Text style={styles.quote}>
                    &quot;Consistent hydration improves skin &amp; mood&quot;
                  </Text>
                </View>
              </View>
            </View>

            {/* Modal for changing daily goal */}
            <Modal
              visible={modalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Change Daily Goal</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={goalInput}
                    onChangeText={setGoalInput}
                    keyboardType="decimal-pad"
                    placeholder="Enter new goal (L)"
                    placeholderTextColor={palette.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleGoalChange}
                  >
                    <Text style={styles.modalButtonText}>Change your goal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            {/* Modal for changing daily intakes */}
            <Modal
              visible={intakeModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setIntakeModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Change Daily Intakes</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={intakeInput1}
                    onChangeText={setIntakeInput1}
                    keyboardType="numeric"
                    placeholder="First intake (ml)"
                    placeholderTextColor={palette.textMuted}
                  />
                  <TextInput
                    style={styles.modalInput}
                    value={intakeInput2}
                    onChangeText={setIntakeInput2}
                    keyboardType="numeric"
                    placeholder="Second intake (ml)"
                    placeholderTextColor={palette.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleIntakeChange}
                  >
                    <Text style={styles.modalButtonText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIntakeModalVisible(false)}
                  >
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// Same teal palette used across Home / Voice Logging / Sleep Tracker /
// Weight Tracker / Settings / Personal Info screens.
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
  shadow: "#102624",
  heroChip: isDark ? "#234440" : "#E9F5F2",
  heroChipBorder: isDark ? "#345A55" : "#D2E7E2",

  // Water gauge specific
  ringTrack: isDark ? "#234440" : "#DCEEEA",
  waterCircleBg: isDark ? "#163B38" : "#EAF6F4",
  waterCircleBorder: isDark ? "#2C4A46" : "#CFE6E1",
  waveDeep: "#1F4E4A",

  addButtonBg: "#FFFFFF",
  addButtonBorder: isDark ? "#0F1E1C" : "#FFFFFF",
  addButtonText: "#1F4E4A",

  barEmpty: isDark ? "rgba(255,255,255,0.16)" : "#E3EFEC",
  barProgress: "#3D6A66",
  barSuccess: "#1F8A6E",
  barLabelToday: "#1F4E4A",
  barLabelDefault: isDark ? "#8FAAA5" : "#7D9994",

  recommendationItemBg: isDark ? "rgba(31,78,74,0.22)" : "#EEF7F5",
  recommendationBorder: isDark ? "#2C4A46" : "#D5E8E3",
  highPriorityBg: isDark ? "rgba(217,119,6,0.18)" : "#FDF3E7",
  highPriorityBorder: "#D97706",

  modalOverlayBg: "rgba(16, 38, 36, 0.7)",
});

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    safeArea: {
      flex: 1,
    },
    scrollContainer: {
      flex: 1,
    },
    innerContainer: {
      paddingHorizontal: 18,
    },

    /* Plain header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      marginBottom: 8,
    },
    backButton: {
      padding: 5,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    placeholder: {
      width: 34,
    },

    /* Circular water gauge */
    gaugeWrap: {
      width: RING_SIZE,
      height: RING_SIZE,
      alignSelf: "center",
      marginBottom: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    ringSvg: {
      position: "absolute",
    },
    waterCircle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: palette.waterCircleBorder,
      backgroundColor: palette.waterCircleBg,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 6,
    },
    waterCircleBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    waterFill: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: palette.waveDeep,
    },
    waterTextContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 10,
      zIndex: 3,
    },
    waterAmount: {
      fontSize: 26,
      fontFamily: "Lexend-Bold",
      color: "#ffffff",
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    waterGoal: {
      fontSize: 14,
      fontFamily: "Manrope-Medium",
      color: "#ffffff",
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
      marginBottom: 2,
    },
    hydrated: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: "#ffffff",
      marginVertical: 4,
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    goalAchieved: {
      fontSize: 13,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
      marginTop: 2,
      textShadowColor: "rgba(0, 0, 0, 0.35)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    buttonRowInsideFill: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      marginTop: 12,
    },
    addButton: {
      paddingVertical: 9,
      paddingHorizontal: 15,
      backgroundColor: palette.addButtonBg,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: palette.addButtonBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
    addButtonText: {
      color: palette.addButtonText,
      fontFamily: "Lexend-Bold",
      fontSize: 13,
    },

    /* Cards */
    card: {
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
      width: 36,
      height: 36,
      borderRadius: 13,
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
      fontSize: 16.5,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 10,
    },
    cardText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    iconCircle: {
      width: 34,
      height: 34,
      borderRadius: 13,
      backgroundColor: palette.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    bestDayIcon: {
      backgroundColor: palette.cardSecondary,
    },
    weeklyCard: {
      backgroundColor: palette.card,
      padding: 18,
      borderRadius: 26,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    barChart: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      height: 140,
    },
    barColumn: {
      alignItems: "center",
    },
    bar: {
      width: 26,
      borderRadius: 13,
    },
    barDayLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      marginTop: 8,
    },
    cardRow1: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    bestDayTitle: {
      fontFamily: "Lexend-Bold",
      fontSize: 17,
      color: palette.textPrimary,
      marginBottom: 2,
    },
    bestDayText: {
      fontSize: 14.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
    },
    quote: {
      fontSize: 12.5,
      fontFamily: "Manrope-Regular",
      color: palette.textMuted,
      marginTop: 4,
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: palette.modalOverlayBg,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 24,
      width: 300,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      marginBottom: 16,
      color: palette.textPrimary,
    },
    modalInput: {
      width: "100%",
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 14,
      padding: 12,
      fontSize: 15,
      marginBottom: 14,
      textAlign: "center",
      fontFamily: "Manrope-SemiBold",
      color: palette.textPrimary,
      backgroundColor: palette.cardSecondary,
    },
    modalButton: {
      backgroundColor: palette.primary,
      borderRadius: 16,
      paddingVertical: 13,
      paddingHorizontal: 24,
      marginBottom: 10,
      width: "100%",
      alignItems: "center",
    },
    modalButtonText: {
      color: "#fff",
      fontFamily: "Lexend-Bold",
      fontSize: 15,
    },
    modalCancel: {
      color: palette.textSecondary,
      marginTop: 4,
      fontSize: 14,
      fontFamily: "Manrope-SemiBold",
    },

    recommendationsCard: {
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
    recommendationItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: palette.recommendationItemBg,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: palette.recommendationBorder,
    },
    highPriorityRecommendation: {
      backgroundColor: palette.highPriorityBg,
      borderColor: palette.highPriorityBorder,
    },
    recommendationIcon: {
      fontSize: 22,
      marginRight: 12,
      marginTop: 2,
    },
    recommendationContent: {
      flex: 1,
    },
    recommendationMessage: {
      fontSize: 13.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 4,
      lineHeight: 19,
    },
    recommendationAction: {
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
    },
  });

// Wrap with React.memo to prevent unnecessary re-renders (Instagram pattern)
export default React.memo(HydrationTrackerScreen);
