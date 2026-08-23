import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

const SLEEP_QUALITIES = ["Excellent", "Good", "Fair", "Poor"];
const MOODS = ["Relaxed", "Neutral", "Tired", "Stressed"];

// Get screen dimensions
const { height: screenHeight } = Dimensions.get("window");

// Global cache for sleep logs and UI state
const globalSleepCache = {
  cachedData: null,
  timestamp: null,
  isStale: false,
  CACHE_DURATION: 5000, // 5 seconds
  // Cache button states to prevent flickering
  buttonStates: null,
  todayHasSleepLog: false,
};

const SleepTrackerScreen = () => {
  const navigation = useNavigation();
  const { onboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  const insets = useSafeAreaInsets();

  // State management
  const [sleepLogs, setSleepLogs] = useState(
    () => globalSleepCache.cachedData || [],
  );
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Schedule state
  const [scheduledBedtime, setScheduledBedtime] = useState("22:00");
  const [scheduledWakeup, setScheduledWakeup] = useState("07:30");
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [todayHasSleepLog, setTodayHasSleepLog] = useState(
    () => globalSleepCache.todayHasSleepLog || false,
  );

  const [showLogModal, setShowLogModal] = useState(false);
  const [quality, setQuality] = useState("Good");
  const [mood, setMood] = useState("Relaxed");
  const [showBedtimePicker, setShowBedtimePicker] = useState(false);
  const [showWakeupPicker, setShowWakeupPicker] = useState(false);

  // Sleep goal
  const [sleepGoal, setSleepGoal] = useState(8);
  const [showSleepGoalModal, setShowSleepGoalModal] = useState(false);
  const [tempSleepGoal, setTempSleepGoal] = useState(8);

  // History view
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // AI insights and recommendations
  const [sleepInsights, setSleepInsights] = useState([]);
  const [sleepRecommendations, setSleepRecommendations] = useState([]);

  // User ID resolution
  const [realUserId, setRealUserId] = useState(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => setRealUserId(user?.id));
  }, []);

  // Helper functions
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  };

  const getDateOnly = (str) => {
    return str ? str.slice(0, 10) : "";
  };

  const parseIntervalToDisplay = (interval) => {
    if (!interval || typeof interval !== "string") return "--";
    const clean = interval.trim();
    if (!clean.includes(":")) return "--";
    const parts = clean.split(":");
    if (parts.length < 2) return "--";
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    if (h === 0 && m === 0) return "--";
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "--";
  };

  const parseIntervalToMinutes = (interval) => {
    if (!interval || typeof interval !== "string") return 0;
    const clean = interval.trim();
    if (!clean.includes(":")) return 0;
    const parts = clean.split(":");
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  };

  const formatTime12h = (time) => {
    if (!time) return "";
    let [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const calculateDuration = (start, end) => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
  };

  // FIXED: Memoized button states to prevent infinite re-renders and flickering
  const buttonStates = useMemo(() => {
    // Use cached button states if available and data hasn't changed
    if (
      globalSleepCache.buttonStates &&
      globalSleepCache.cachedData === sleepLogs &&
      !isEditingSchedule
    ) {
      return globalSleepCache.buttonStates;
    }

    const todayStr = getTodayString();
    const todayLog = sleepLogs.find(
      (l) => getDateOnly(l.date) === todayStr && l.user_id === realUserId,
    );

    let newButtonStates;

    if (!todayLog) {
      // State 1: Before logging (no log today)
      newButtonStates = {
        canClickBedtime: true, // Always clickable
        canClickWakeup: true, // Always clickable
        canClickLog: scheduledBedtime && scheduledWakeup, // Only when both times set
        logButtonEnabled: scheduledBedtime && scheduledWakeup,
        hasLog: false,
      };
    } else {
      // State 2: After logging (log exists today)
      if (!isEditingSchedule) {
        newButtonStates = {
          canClickBedtime: false, // Non-clickable
          canClickWakeup: false, // Non-clickable
          canClickLog: false, // Non-clickable
          logButtonEnabled: false,
          hasLog: true,
        };
      } else {
        // State 3: Editing existing log
        newButtonStates = {
          canClickBedtime: true, // Clickable when editing
          canClickWakeup: true, // Clickable when editing
          canClickLog: true, // Clickable for update
          logButtonEnabled: true,
          hasLog: true,
        };
      }
    }

    // Cache the button states
    globalSleepCache.buttonStates = newButtonStates;
    globalSleepCache.todayHasSleepLog = newButtonStates.hasLog;

    return newButtonStates;
  }, [
    sleepLogs,
    realUserId,
    scheduledBedtime,
    scheduledWakeup,
    isEditingSchedule,
  ]);

  // FIXED: Update todayHasSleepLog based on button states
  useEffect(() => {
    setTodayHasSleepLog(buttonStates.hasLog);
    // Update cache
    globalSleepCache.todayHasSleepLog = buttonStates.hasLog;
  }, [buttonStates.hasLog]);

  const groupLogsByMonth = (logs) => {
    const grouped = {};

    logs.forEach((log) => {
      const date = new Date(log.date);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}`;
      const monthName = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName,
          logs: [],
          isCurrentMonth: false,
        };
      }
      grouped[monthKey].logs.push(log);
    });

    const sortedMonths = Object.values(grouped).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey),
    );

    const currentMonth = new Date().toISOString().slice(0, 7);
    sortedMonths.forEach((month) => {
      month.isCurrentMonth = month.monthKey === currentMonth;
    });

    return sortedMonths;
  };

  const toggleMonthExpansion = (monthKey) => {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Data fetching
  useFocusEffect(
    useCallback(() => {
      if (!realUserId) return;

      const now = Date.now();
      const isCacheValid =
        globalSleepCache.timestamp &&
        now - globalSleepCache.timestamp < globalSleepCache.CACHE_DURATION;

      if (isCacheValid && globalSleepCache.cachedData) {
        setSleepLogs(globalSleepCache.cachedData);
        return;
      }

      if (globalSleepCache.cachedData && globalSleepCache.isStale) {
        setSleepLogs(globalSleepCache.cachedData);
      }

      fetchSleepLogs();
      fetchSleepGoal();
    }, [realUserId]),
  );

  const fetchSleepLogs = useCallback(async () => {
    if (!realUserId || isFetching) return;

    setIsFetching(true);
    try {
      console.log("🔍 Fetching sleep logs for user:", realUserId);

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", realUserId)
        .order("date", { ascending: false });

      if (error) {
        console.log("❌ Error fetching sleep logs:", error);
        return;
      }

      console.log("✅ Raw data received:", data?.length || 0, "logs");

      const validData = (data || []).filter((log) => {
        if (!log || !log.duration) return false;
        const mins = parseIntervalToMinutes(log.duration);
        return mins > 0;
      });

      console.log("✅ Valid logs after filtering:", validData.length);

      globalSleepCache.cachedData = validData;
      globalSleepCache.timestamp = Date.now();
      globalSleepCache.isStale = false;

      setSleepLogs(validData);

      const insights = generateSleepInsights(validData);
      setSleepInsights(insights);

      const recommendations = generateSleepRecommendations(
        validData,
        sleepGoal,
      );
      setSleepRecommendations(recommendations);
    } catch (err) {
      console.log("❌ Error fetching sleep logs:", err);
    } finally {
      setIsFetching(false);
    }
  }, [realUserId, isFetching, sleepGoal]);

  const fetchSleepGoal = useCallback(async () => {
    if (!realUserId) return;
    try {
      const { data: recentLog, error: recentError } = await supabase
        .from("sleep_logs")
        .select("sleep_goal")
        .eq("user_id", realUserId)
        .not("sleep_goal", "is", null)
        .order("date", { ascending: false })
        .limit(1);

      if (recentError) {
        console.log("Error fetching recent sleep goal:", recentError);
        return;
      }

      if (recentLog && recentLog.length > 0 && recentLog[0].sleep_goal) {
        setSleepGoal(recentLog[0].sleep_goal);
      } else {
        setSleepGoal(8);
      }
    } catch (err) {
      console.log("Error fetching sleep goal:", err);
    }
  }, [realUserId]);

  // Generate insights and recommendations
  const generateSleepInsights = useCallback((sleepLogs) => {
    if (!sleepLogs || sleepLogs.length === 0) return [];

    const insights = [];
    const recentLogs = sleepLogs.slice(0, 7);

    const avgDuration =
      recentLogs.reduce((sum, log) => {
        const minutes = parseIntervalToMinutes(log.duration);
        return sum + minutes;
      }, 0) / recentLogs.length;

    const avgHours = avgDuration / 60;

    if (avgHours < 7) {
      insights.push({
        type: "duration",
        priority: "high",
        title: "Sleep Duration Alert",
        message: `You're averaging ${avgHours.toFixed(1)} hours of sleep. Research shows 7-9 hours is optimal for health.`,
        icon: "😴",
        action: "Try going to bed 30 minutes earlier",
      });
    } else if (avgHours > 9) {
      insights.push({
        type: "duration",
        priority: "medium",
        title: "Oversleeping Pattern",
        message: `You're averaging ${avgHours.toFixed(1)} hours of sleep. Too much sleep can also affect energy levels.`,
        icon: "😴",
        action: "Consider setting a consistent wake time",
      });
    } else {
      insights.push({
        type: "duration",
        priority: "low",
        title: "Great Sleep Duration!",
        message: `You're averaging ${avgHours.toFixed(1)} hours of sleep. This is in the optimal range!`,
        icon: "✅",
        action: "Keep up the great work!",
      });
    }

    return insights;
  }, []);

  const generateSleepRecommendations = useCallback((sleepLogs, goal) => {
    const recommendations = [];

    if (!sleepLogs || sleepLogs.length === 0) {
      recommendations.push({
        type: "general",
        message:
          "Start tracking your sleep to get personalized recommendations!",
        action: "Set your schedule and log your first sleep session",
      });
      return recommendations;
    }

    const recentLogs = sleepLogs.slice(0, 3);
    const avgDuration =
      recentLogs.reduce((sum, log) => {
        const minutes = parseIntervalToMinutes(log.duration);
        return sum + minutes;
      }, 0) / recentLogs.length;

    const avgHours = avgDuration / 60;

    if (avgHours < goal - 0.5) {
      recommendations.push({
        type: "duration",
        message: `You're averaging ${avgHours.toFixed(1)} hours, but your goal is ${goal} hours.`,
        action: "Try going to bed 30 minutes earlier tonight",
      });
    }

    return recommendations;
  }, []);

  // Sleep logging workflow
  const handleLogSleep = useCallback(async () => {
    if (!realUserId || !buttonStates.logButtonEnabled) {
      Alert.alert(
        "Cannot Log Sleep",
        "Please set your bedtime and wake up time first.",
      );
      return;
    }

    const duration = calculateDuration(scheduledBedtime, scheduledWakeup);
    let logDate = new Date();

    const [sh, sm] = scheduledBedtime.split(":").map(Number);
    const [eh, em] = scheduledWakeup.split(":").map(Number);

    if (sh > eh || (sh === eh && sm > em)) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour < eh || (currentHour === eh && currentMinute < em)) {
        logDate.setDate(logDate.getDate() - 1);
      }
    }

    const dateStr = logDate.toISOString().slice(0, 10);

    try {
      let error;
      if (todayHasSleepLog) {
        // Update existing log
        const existingLog = sleepLogs.find(
          (l) => getDateOnly(l.date) === dateStr && l.user_id === realUserId,
        );

        ({ error } = await supabase
          .from("sleep_logs")
          .update({
            start_time: scheduledBedtime,
            end_time: scheduledWakeup,
            duration,
            quality,
            mood,
            sleep_goal: sleepGoal,
          })
          .eq("id", existingLog.id));
      } else {
        // Create new log
        ({ error } = await supabase.from("sleep_logs").insert([
          {
            user_id: realUserId,
            date: dateStr,
            start_time: scheduledBedtime,
            end_time: scheduledWakeup,
            duration,
            quality,
            mood,
            sleep_goal: sleepGoal,
          },
        ]));
      }

      if (error) throw error;

      // Update cache optimistically
      const newLog = {
        id: `temp_${Date.now()}`,
        user_id: realUserId,
        date: dateStr,
        start_time: scheduledBedtime,
        end_time: scheduledWakeup,
        duration,
        quality,
        mood,
        sleep_goal: sleepGoal,
      };

      if (todayHasSleepLog) {
        const updatedLogs =
          globalSleepCache.cachedData?.map((log) =>
            getDateOnly(log.date) === dateStr && log.user_id === realUserId
              ? { ...log, ...newLog }
              : log,
          ) || [];
        globalSleepCache.cachedData = updatedLogs;
      } else {
        const updatedLogs = [newLog, ...(globalSleepCache.cachedData || [])];
        globalSleepCache.cachedData = updatedLogs;
      }

      setSleepLogs(globalSleepCache.cachedData);

      // Update MainDashboard cache immediately
      try {
        const {
          updateMainDashboardSleepCache,
          invalidateMainDashboardCache,
        } = require("../utils/cacheManager");
        updateMainDashboardSleepCache({
          date: dateStr,
          duration,
          quality,
          mood,
          sleep_goal: sleepGoal,
        });
        // Also invalidate to force refetch on next focus
        invalidateMainDashboardCache();
      } catch (cacheError) {
        console.log("Could not update MainDashboard cache:", cacheError);
      }

      Alert.alert(
        "Success! 🌟",
        todayHasSleepLog ? "Sleep log updated!" : "Sleep logged successfully!",
      );

      // Reset editing state after successful logging
      setIsEditingSchedule(false);

      globalSleepCache.isStale = true;
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  }, [
    realUserId,
    buttonStates.logButtonEnabled,
    scheduledBedtime,
    scheduledWakeup,
    todayHasSleepLog,
    sleepLogs,
    quality,
    mood,
    sleepGoal,
  ]);

  const handleSaveSleepGoal = useCallback(async () => {
    if (!realUserId) return;

    try {
      const { error } = await supabase.from("user_preferences").upsert([
        {
          user_id: realUserId,
          sleep_goal: tempSleepGoal,
        },
      ]);

      if (error) throw error;

      setSleepGoal(tempSleepGoal);
      setShowSleepGoalModal(false);
      Alert.alert("Success", "Sleep goal updated successfully!");
    } catch (error) {
      console.error("Error saving sleep goal:", error);
      Alert.alert("Error", "Failed to save sleep goal. Please try again.");
    }
  }, [realUserId, tempSleepGoal]);

  // Handle schedule button clicks
  const handleBedtimeClick = useCallback(() => {
    console.log(
      "🛏️ Bedtime clicked, canClickBedtime:",
      buttonStates.canClickBedtime,
    );
    if (buttonStates.canClickBedtime) {
      setShowBedtimePicker(true);
    }
  }, [buttonStates.canClickBedtime]);

  const handleWakeupClick = useCallback(() => {
    console.log(
      "☀️ Wakeup clicked, canClickWakeup:",
      buttonStates.canClickWakeup,
    );
    if (buttonStates.canClickWakeup) {
      setShowWakeupPicker(true);
    }
  }, [buttonStates.canClickWakeup]);

  // Handle edit button click
  const handleEditSchedule = useCallback(() => {
    console.log("✏️ Edit button clicked, current state:", isEditingSchedule);

    if (todayHasSleepLog && !isEditingSchedule) {
      // Load existing log data for editing
      const todayStr = getTodayString();
      const todayLog = sleepLogs.find(
        (l) => getDateOnly(l.date) === todayStr && l.user_id === realUserId,
      );

      if (todayLog) {
        setScheduledBedtime(todayLog.start_time);
        setScheduledWakeup(todayLog.end_time);
        setQuality(todayLog.quality || "Good");
        setMood(todayLog.mood || "Relaxed");
      }
    }

    setIsEditingSchedule(!isEditingSchedule);
  }, [isEditingSchedule, todayHasSleepLog, sleepLogs, realUserId]);

  // Calculations
  const todayStr = getTodayString();
  const todayLog = sleepLogs.find(
    (l) => getDateOnly(l.date) === todayStr && l.user_id === realUserId,
  );

  const todayDuration = todayLog?.duration
    ? parseIntervalToDisplay(todayLog.duration)
    : "No data";

  const todayPercent = todayLog?.duration
    ? Math.round(
        (parseIntervalToMinutes(todayLog.duration) / (sleepGoal * 60)) * 100,
      )
    : 0;

  // Weekly calculations
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDateObjs = [];
  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysToSubtract);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDateObjs.push(d);
  }

  const weekLogMap = {};
  sleepLogs.forEach((log) => {
    weekLogMap[getDateOnly(log.date)] = log;
  });

  const weekTotalMins = weekDateObjs.reduce((sum, d) => {
    const key = d.toISOString().slice(0, 10);
    const log = weekLogMap[key];
    const mins = log && log.duration ? parseIntervalToMinutes(log.duration) : 0;
    return sum + mins;
  }, 0);

  // Calculate average sleep
  const getAverageSleepDuration = useCallback((logs) => {
    if (!logs || logs.length === 0) {
      return "No data";
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const recentValidLogs = logs.filter((log) => {
      if (!log || !log.duration) {
        return false;
      }

      const logDate = new Date(log.date);
      const isToday = logDate.toDateString() === today.toDateString();
      const isYesterday = logDate.toDateString() === yesterday.toDateString();
      const isRecent = isToday || isYesterday;

      if (!isRecent) {
        return false;
      }

      const mins = parseIntervalToMinutes(log.duration);
      return mins > 0;
    });

    if (recentValidLogs.length === 0) {
      return "No data";
    }

    let totalMinutes = 0;
    recentValidLogs.forEach((log) => {
      const mins = parseIntervalToMinutes(log.duration);
      totalMinutes += mins;
    });

    const avg = Math.round(totalMinutes / recentValidLogs.length);
    const avgH = Math.floor(avg / 60);
    const avgM = avg % 60;

    let result;
    if (avgH > 0 && avgM > 0) result = `${avgH}h ${avgM}m`;
    else if (avgH > 0) result = `${avgH}h`;
    else if (avgM > 0) result = `${avgM}m`;
    else result = "No data";

    return result;
  }, []);

  const averageSleep = getAverageSleepDuration(sleepLogs);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scrollViewStyle}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEventThrottle={16}
        >
          {/* Hero header */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                style={styles.heroBackBtn}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.heroTitleWrap}>
                <Text style={styles.heroEyebrow}>Rest & recovery</Text>
                <Text style={styles.heroTitle}>Sleep Tracker</Text>
              </View>
              <View style={styles.heroBackBtnGhost} />
            </View>
            <View style={styles.heroStatChip}>
              <Ionicons name="moon" size={13} color="#FFFFFF" />
              <Text style={styles.heroStatChipText}>
                {averageSleep !== "No data"
                  ? `${averageSleep} avg recently`
                  : "No recent data yet"}
              </Text>
            </View>
          </View>

          {/* Last Night's Sleep Card */}
          <View style={styles.lastNightCard}>
            <View style={styles.lastNightIconShell}>
              <Ionicons name="moon-outline" size={26} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.lastNightLabel}>Last Night&apos;s Sleep</Text>
              <Text style={styles.lastNightDuration}>{todayDuration}</Text>
              <Text style={styles.lastNightComparison}>
                {(() => {
                  if (!todayLog || !todayLog.duration) return "No data";

                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yesterdayStr = yesterday.toISOString().slice(0, 10);
                  const yesterdayLog = sleepLogs.find(
                    (l) =>
                      getDateOnly(l.date) === yesterdayStr &&
                      l.user_id === realUserId,
                  );

                  if (!yesterdayLog || !yesterdayLog.duration)
                    return "No data logged yesterday";

                  const todayMins = parseIntervalToMinutes(todayLog.duration);
                  const yesterdayMins = parseIntervalToMinutes(
                    yesterdayLog.duration,
                  );

                  if (yesterdayMins === 0) return "No yesterday data";

                  const percentage = Math.round(
                    ((todayMins - yesterdayMins) / yesterdayMins) * 100,
                  );
                  const sign = percentage >= 0 ? "+" : "";

                  return `${sign}${percentage}% vs yesterday`;
                })()}
              </Text>
            </View>
            {todayLog?.duration && (
              <View style={styles.lastNightPercentChip}>
                <Text style={styles.lastNightPercentChipText}>
                  {todayPercent}%
                </Text>
                <Text style={styles.lastNightPercentChipLabel}>of goal</Text>
              </View>
            )}
          </View>

          {/* Weekly Chart */}
          <View style={styles.weeklyCard}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>This week</Text>
                <Text style={styles.sectionTitle}>Sleep Trend</Text>
              </View>
            </View>
            <View style={styles.chartContainer}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => {
                const dayDate = weekDateObjs[idx];
                const key = dayDate.toISOString().slice(0, 10);
                const log = weekLogMap[key];
                const mins =
                  log && log.duration
                    ? parseIntervalToMinutes(log.duration)
                    : 0;
                const progress =
                  sleepGoal > 0 ? Math.min(1, mins / (sleepGoal * 60)) : 0;

                // Show minimum 1% height for visual consistency
                const minHeight = 1.4; // 1% of 140px
                const filled =
                  progress > 0
                    ? Math.max(minHeight, 140 * progress)
                    : minHeight;
                const isToday =
                  dayDate.toDateString() === new Date().toDateString();

                return (
                  <View key={key} style={styles.barContainer}>
                    <View style={styles.barTrack}>
                      <View style={[styles.filledBar, { height: filled }]} />
                    </View>
                    <Text
                      style={[
                        styles.dayLabel,
                        isToday && styles.dayLabelActive,
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                );
              })}
            </View>
            {weekTotalMins === 0 && (
              <View style={styles.tipRow}>
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={palette.primary}
                />
                <Text style={styles.tipText}>
                  No sleep data for this week yet. Set your schedule and log
                  your sleep!
                </Text>
              </View>
            )}
          </View>

          {/* Sleep Goal Card */}
          <View style={styles.sleepGoalMainCard}>
            <TouchableOpacity
              onPress={() => {
                setTempSleepGoal(sleepGoal);
                setShowSleepGoalModal(true);
              }}
              style={styles.goalSection}
              activeOpacity={0.7}
            >
              <View style={styles.goalHeader}>
                <LinearGradient
                  colors={[palette.primary, palette.primaryMuted]}
                  style={styles.goalIcon}
                >
                  <Text style={styles.goalEmoji}>💤</Text>
                </LinearGradient>
                <View>
                  <Text style={styles.goalTitle}>Set Sleep Goal</Text>
                  <Text style={styles.goalSubtitle}>
                    Personalize your target
                  </Text>
                </View>
              </View>
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>
                  {todayPercent}% of {sleepGoal}h
                </Text>
              </View>
            </TouchableOpacity>

            {/* Schedule Section */}
            <View style={styles.scheduleSection}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleTitle}>Set your schedule</Text>
                {todayHasSleepLog && (
                  <TouchableOpacity
                    onPress={handleEditSchedule}
                    style={styles.editButton}
                  >
                    <Text style={styles.editButtonText}>
                      {isEditingSchedule ? "Done" : "Edit"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.scheduleContainer}>
                {/* Bedtime Button */}
                <TouchableOpacity
                  onPress={handleBedtimeClick}
                  style={[
                    styles.scheduleButton,
                    styles.bedtimeButton,
                    !buttonStates.canClickBedtime &&
                      styles.scheduleButtonDisabled,
                  ]}
                  activeOpacity={buttonStates.canClickBedtime ? 0.7 : 1}
                >
                  <View style={styles.scheduleButtonHeader}>
                    <Ionicons
                      name="bed"
                      size={16}
                      color="white"
                      style={styles.scheduleButtonIcon}
                    />
                    <Text style={styles.scheduleButtonLabel}>Bedtime</Text>
                  </View>
                  <Text style={styles.scheduleButtonTime}>
                    {formatTime12h(scheduledBedtime)}
                  </Text>
                </TouchableOpacity>

                {/* Wake up Button */}
                <TouchableOpacity
                  onPress={handleWakeupClick}
                  style={[
                    styles.scheduleButton,
                    styles.wakeupButton,
                    !buttonStates.canClickWakeup &&
                      styles.scheduleButtonDisabled,
                  ]}
                  activeOpacity={buttonStates.canClickWakeup ? 0.7 : 1}
                >
                  <View style={styles.scheduleButtonHeader}>
                    <Ionicons
                      name="alarm"
                      size={16}
                      color="white"
                      style={styles.scheduleButtonIcon}
                    />
                    <Text style={styles.scheduleButtonLabel}>Wake up</Text>
                  </View>
                  <Text style={styles.scheduleButtonTime}>
                    {formatTime12h(scheduledWakeup)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Log Sleep Button */}
          <TouchableOpacity
            style={[
              styles.logSleepButton,
              !buttonStates.logButtonEnabled && styles.logSleepButtonDisabled,
              buttonStates.logButtonEnabled && styles.logSleepButtonEnabled,
            ]}
            onPress={handleLogSleep}
            disabled={!buttonStates.canClickLog}
          >
            <Text
              style={[
                styles.logSleepButtonText,
                !buttonStates.logButtonEnabled &&
                  styles.logSleepButtonTextDisabled,
                buttonStates.logButtonEnabled &&
                  styles.logSleepButtonTextEnabled,
              ]}
            >
              {todayHasSleepLog && isEditingSchedule
                ? "Update Sleep Log"
                : "Log Your Sleep"}
            </Text>
          </TouchableOpacity>

          {/* Status Message */}
          <View style={styles.statusMessage}>
            <Text style={styles.statusText}>
              {(() => {
                if (!scheduledBedtime || !scheduledWakeup) {
                  return "Set your bedtime and wake up time above to enable sleep logging";
                } else if (todayHasSleepLog && !isEditingSchedule) {
                  return "Sleep already logged for today. Tap 'Edit' to make changes.";
                } else if (buttonStates.logButtonEnabled) {
                  return "Ready to log! Tap the button above.";
                } else {
                  return "Set both bedtime and wake up time to enable logging";
                }
              })()}
            </Text>
          </View>

          {/* Tip card */}
          {/* <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              You slept <Text style={styles.tipHighlight}>{averageSleep}</Text>{" "}
              on average this week. Try keeping your bedtime consistent for better
              results.
            </Text>
          </View> */}

          {/* Sleep Insights Section */}
          {sleepInsights.length > 0 && (
            <View style={styles.insightsCard}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>Analysis</Text>
                  <Text style={styles.sectionTitle}>Sleep Insights</Text>
                </View>
              </View>
              {sleepInsights.map((insight, index) => (
                <View
                  key={index}
                  style={[
                    styles.insightItem,
                    insight.priority === "high" && styles.highPriorityInsight,
                  ]}
                >
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightMessage}>{insight.message}</Text>
                    <Text style={styles.insightAction}>{insight.action}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Sleep Recommendations Section */}
          {sleepRecommendations.length > 0 && (
            <View style={styles.recommendationsCard}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>For you</Text>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                </View>
              </View>
              {sleepRecommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Text style={styles.recommendationMessage}>
                    {rec.message}
                  </Text>
                  <Text style={styles.recommendationAction}>{rec.action}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sleep History Section */}
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Log book</Text>
              <Text style={styles.sectionTitle}>Sleep History</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAllLogs(!showAllLogs)}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllButtonText}>
                {showAllLogs ? "Show recent" : "View all"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* FIXED: Sleep Log cards with memoized rendering */}
          {useMemo(() => {
            const moodToEmoji = (m) => {
              if (!m) return "😴";
              const map = {
                Relaxed: "😌",
                Neutral: "🙂",
                Tired: "🥱",
                Stressed: "😫",
              };
              return map[m] || "😴";
            };

            const formatDateLabel = (dateStr) => {
              const date = new Date(dateStr);
              const today = new Date();

              if (date.toDateString() === today.toDateString()) {
                return "Today";
              } else {
                return date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
              }
            };

            const LogItem = ({ log }) => {
              return (
                <TouchableOpacity
                  style={styles.logCard}
                  onPress={() => {
                    setScheduledBedtime(log.start_time);
                    setScheduledWakeup(log.end_time);
                    setQuality(log.quality || "Good");
                    setMood(log.mood || "Relaxed");
                    setIsEditingSchedule(true);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.logCardIconShell}>
                    <Text style={styles.logCardEmoji}>
                      {moodToEmoji(log.mood)}
                    </Text>
                  </View>
                  <View style={styles.logCardContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logDate}>
                        {formatDateLabel(log.date)}
                      </Text>
                      <Text style={styles.logTime}>
                        {`${formatTime12h(log.start_time)} - ${formatTime12h(
                          log.end_time,
                        )}`}
                      </Text>
                    </View>
                    <Text style={styles.logDuration}>
                      {parseIntervalToDisplay(log.duration)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            };

            // FIXED: Remove console.log to prevent re-render loop

            if (sleepLogs.length === 0) {
              return (
                <View style={styles.noLogsMessage}>
                  <Ionicons
                    name="moon-outline"
                    size={24}
                    color={palette.primary}
                  />
                  <Text style={styles.noLogsText}>
                    No sleep logs found. Set your schedule and log your first
                    sleep session above!
                  </Text>
                </View>
              );
            }

            if (!showAllLogs) {
              const recentLogs = sleepLogs.slice(0, 3);
              return (
                <View style={styles.logCardList}>
                  {recentLogs.map((log, idx) => (
                    <LogItem key={log.id} log={log} />
                  ))}
                </View>
              );
            } else {
              const groupedMonths = groupLogsByMonth(sleepLogs);

              return (
                <>
                  {groupedMonths.map((month, monthIndex) => {
                    const isExpanded = expandedMonths.has(month.monthKey);

                    return (
                      <View key={month.monthKey}>
                        {month.isCurrentMonth && (
                          <>
                            <Text style={styles.monthTitle}>
                              {month.monthName}
                            </Text>
                            <View style={styles.logCardList}>
                              {month.logs.map((log) => (
                                <LogItem key={log.id} log={log} />
                              ))}
                            </View>
                          </>
                        )}

                        {!month.isCurrentMonth && (
                          <>
                            <TouchableOpacity
                              onPress={() =>
                                toggleMonthExpansion(month.monthKey)
                              }
                              style={styles.monthHeader}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.monthHeaderText}>
                                {month.monthName}
                              </Text>
                              <View style={styles.monthHeaderRight}>
                                <Text style={styles.monthLogCount}>
                                  {month.logs.length} log
                                  {month.logs.length !== 1 ? "s" : ""}
                                </Text>
                                <Text
                                  style={[
                                    styles.expandIcon,
                                    {
                                      transform: [
                                        {
                                          rotate: isExpanded
                                            ? "180deg"
                                            : "0deg",
                                        },
                                      ],
                                    },
                                  ]}
                                >
                                  ⌄
                                </Text>
                              </View>
                            </TouchableOpacity>

                            {isExpanded && (
                              <View style={styles.logCardList}>
                                {month.logs.map((log) => (
                                  <LogItem key={log.id} log={log} />
                                ))}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    );
                  })}
                </>
              );
            }
          }, [sleepLogs, showAllLogs, expandedMonths])}
        </ScrollView>
      </SafeAreaView>

      {/* Time Pickers */}
      {showBedtimePicker && (
        <DateTimePicker
          value={
            scheduledBedtime
              ? new Date(`1970-01-01T${scheduledBedtime}:00`)
              : new Date()
          }
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, date) => {
            setShowBedtimePicker(false);
            if (date) {
              const h = date.getHours().toString().padStart(2, "0");
              const m = date.getMinutes().toString().padStart(2, "0");
              setScheduledBedtime(`${h}:${m}`);
              console.log("🛏️ Bedtime set to:", `${h}:${m}`);
            }
          }}
        />
      )}

      {showWakeupPicker && (
        <DateTimePicker
          value={
            scheduledWakeup
              ? new Date(`1970-01-01T${scheduledWakeup}:00`)
              : new Date()
          }
          mode="time"
          is24Hour={false}
          display="default"
          onChange={(event, date) => {
            setShowWakeupPicker(false);
            if (date) {
              const h = date.getHours().toString().padStart(2, "0");
              const m = date.getMinutes().toString().padStart(2, "0");
              setScheduledWakeup(`${h}:${m}`);
              console.log("☀️ Wakeup set to:", `${h}:${m}`);
            }
          }}
        />
      )}

      {/* Sleep Goal Modal */}
      <Modal visible={showSleepGoalModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Sleep Goal</Text>
            <Text style={styles.modalMessage}>
              How many hours of sleep do you want to aim for each night?
            </Text>

            <View style={styles.goalOptions}>
              {[6, 7, 8, 9, 10].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  style={[
                    styles.goalOption,
                    tempSleepGoal === hours && styles.selectedGoalOption,
                  ]}
                  onPress={() => setTempSleepGoal(hours)}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      tempSleepGoal === hours && styles.selectedGoalOptionText,
                    ]}
                  >
                    {hours}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSleepGoalModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveSleepGoal}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Same teal palette used across Home / Voice Logging screens, so this
// screen shares a consistent visual language with the rest of the app.
const createPalette = (colors, isDark) => ({
  primary: "#1F4E4A",
  primaryMuted: "#3D6A66",
  primaryLight: "#A8D5CE",
  background: isDark ? "#0F1E1C" : "#F4FBFA",
  card: isDark ? "#17302D" : "#FFFFFF",
  cardSecondary: isDark ? "#1C3935" : "#EEF7F5",
  cardTertiary: isDark ? "#21413D" : "#E8F3F1",
  textPrimary: isDark ? "#F4FBFA" : "#163633",
  textSecondary: isDark ? "#BED9D3" : "#5B7873",
  textMuted: isDark ? "#8FAAA5" : "#7D9994",
  border: isDark ? "#2C4A46" : "#D5E8E3",
  borderStrong: isDark ? "#466963" : "#BFD8D3",
  shadow: "#102624",
  chipBackground: isDark ? "#1F3A36" : "#EAF4F2",
  chipText: isDark ? "#D7ECE8" : "#476560",
  highlight: isDark ? "#1A3532" : "#EEF8F6",
  destructive: "#B94F4F",
  nutritionSoft: isDark ? "#1E3B37" : "#EDF7F5",
  heroChip: isDark ? "#234440" : "#E9F5F2",
  heroChipBorder: isDark ? "#345A55" : "#D2E7E2",
  selectedCard: isDark ? "#1D403B" : "#E6F5F1",
  warningBackground: isDark ? "rgba(217, 119, 6, 0.18)" : "#FDF3E7",
  warningBorder: "#D97706",
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

    scrollViewStyle: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
      flexGrow: 1,
    },

    /* Hero header */
    heroCard: {
      marginHorizontal: 18,
      marginTop: 12,
      marginBottom: 16,
      padding: 20,
      borderRadius: 30,
      backgroundColor: palette.primary,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: 8,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroBackBtn: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroBackBtnGhost: {
      width: 38,
      height: 38,
    },
    heroTitleWrap: {
      alignItems: "center",
    },
    heroEyebrow: {
      fontSize: 11,
      fontFamily: "Lexend-SemiBold",
      color: "#CFE6E1",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 4,
    },
    heroTitle: {
      fontSize: 21,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
    },
    heroStatChip: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: 14,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.22)",
    },
    heroStatChipText: {
      marginLeft: 6,
      fontSize: 12.5,
      fontFamily: "Lexend-SemiBold",
      color: "#FFFFFF",
    },

    /* Last Night's Sleep Card */
    lastNightCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 18,
      marginHorizontal: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    lastNightIconShell: {
      width: 56,
      height: 56,
      borderRadius: 20,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    lastNightLabel: {
      color: palette.textSecondary,
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    lastNightDuration: {
      fontFamily: "Lexend-Bold",
      fontSize: 26,
      color: palette.textPrimary,
      marginBottom: 2,
    },
    lastNightComparison: {
      color: palette.textMuted,
      fontSize: 13,
      fontFamily: "Manrope-Medium",
    },
    lastNightPercentChip: {
      backgroundColor: palette.heroChip,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
      marginLeft: 8,
    },
    lastNightPercentChipText: {
      fontFamily: "Lexend-Bold",
      fontSize: 15,
      color: palette.primary,
    },
    lastNightPercentChipLabel: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 10,
      color: palette.primary,
      marginTop: 1,
    },

    /* Section headers (shared) */
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },

    /* Weekly Chart */
    weeklyCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 20,
      marginHorizontal: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
      borderWidth: 1,
      borderColor: palette.border,
    },
    chartContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "flex-end",
      height: 160,
      paddingHorizontal: 4,
    },
    barContainer: {
      alignItems: "center",
      flex: 1,
      maxWidth: 40,
    },
    barTrack: {
      width: 26,
      height: 140,
      borderRadius: 10,
      overflow: "hidden",
      justifyContent: "flex-end",
      position: "relative",
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },
    filledBar: {
      width: "100%",
      backgroundColor: palette.primary,
      borderRadius: 10,
    },
    dayLabel: {
      color: palette.textMuted,
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      marginTop: 10,
    },
    dayLabelActive: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
    },
    tipRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
      backgroundColor: palette.heroChip,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
    },
    tipText: {
      marginLeft: 8,
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
      flexShrink: 1,
      lineHeight: 17,
    },

    /* Sleep Goal Card */
    sleepGoalMainCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 18,
      marginHorizontal: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      borderWidth: 1,
      borderColor: palette.border,
    },
    goalSection: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 16,
    },
    goalHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    goalIcon: {
      width: 40,
      height: 40,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    goalEmoji: {
      fontSize: 18,
    },
    goalTitle: {
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 2,
    },
    goalSubtitle: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },
    goalBadge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: palette.heroChip,
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
    },
    goalBadgeText: {
      fontSize: 13,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },

    /* Schedule Section */
    scheduleSection: {
      marginTop: 4,
    },
    scheduleHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    scheduleTitle: {
      fontSize: 15.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    editButton: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: palette.border,
    },
    editButtonText: {
      fontSize: 12.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
    },
    scheduleContainer: {
      flexDirection: "row",
      gap: 12,
    },
    scheduleButton: {
      flex: 1,
      borderRadius: 20,
      padding: 14,
      minHeight: 76,
    },
    scheduleButtonDisabled: {
      opacity: 0.5,
    },
    bedtimeButton: {
      backgroundColor: palette.primary,
    },
    wakeupButton: {
      backgroundColor: palette.primaryMuted,
    },
    scheduleButtonHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    scheduleButtonIcon: {
      marginRight: 6,
    },
    scheduleButtonLabel: {
      color: "rgba(255,255,255,0.9)",
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
    },
    scheduleButtonTime: {
      color: "white",
      fontSize: 19,
      fontFamily: "Lexend-Bold",
    },

    /* Log Sleep Button */
    logSleepButton: {
      borderRadius: 22,
      paddingVertical: 17,
      alignItems: "center",
      marginHorizontal: 18,
      marginBottom: 12,
    },
    logSleepButtonDisabled: {
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
      shadowOpacity: 0,
      elevation: 0,
    },
    logSleepButtonEnabled: {
      backgroundColor: palette.primary,
      shadowColor: palette.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    logSleepButtonText: {
      fontFamily: "Lexend-Bold",
      fontSize: 15.5,
    },
    logSleepButtonTextDisabled: {
      color: palette.textMuted,
    },
    logSleepButtonTextEnabled: {
      color: "#fff",
    },

    /* Status Message */
    statusMessage: {
      backgroundColor: palette.heroChip,
      borderRadius: 16,
      padding: 13,
      marginHorizontal: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
    },
    statusText: {
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
      textAlign: "center",
    },

    /* Tip Card (legacy, unused but kept for parity) */
    tipCard: {
      backgroundColor: palette.highlight,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 18,
      marginBottom: 20,
    },
    tipHighlight: {
      fontFamily: "Lexend-Bold",
    },

    /* Insights and Recommendations */
    insightsCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 20,
      marginHorizontal: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 12,
      elevation: 3,
      borderWidth: 1,
      borderColor: palette.border,
    },
    insightItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: palette.nutritionSoft,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    highPriorityInsight: {
      backgroundColor: palette.warningBackground,
      borderColor: palette.warningBorder,
    },
    insightIcon: {
      fontSize: 22,
      marginRight: 12,
      marginTop: 2,
    },
    insightContent: {
      flex: 1,
    },
    insightTitle: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 4,
    },
    insightMessage: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginBottom: 6,
      lineHeight: 19,
    },
    insightAction: {
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
    },

    recommendationsCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 20,
      marginHorizontal: 18,
      marginBottom: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.25 : 0.08,
      shadowRadius: 12,
      elevation: 3,
      borderWidth: 1,
      borderColor: palette.border,
    },
    recommendationItem: {
      backgroundColor: palette.highlight,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: palette.border,
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

    /* Sleep History */
    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: 18,
      marginBottom: 14,
      marginTop: 4,
    },
    viewAllButton: {
      backgroundColor: palette.cardSecondary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    viewAllButtonText: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
      fontSize: 12.5,
    },

    noLogsMessage: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 22,
      marginHorizontal: 18,
      marginBottom: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    noLogsText: {
      fontSize: 13.5,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 19,
    },

    /* Log Cards */
    logCardList: {
      gap: 10,
      marginHorizontal: 18,
      marginBottom: 8,
    },
    logCard: {
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.2 : 0.05,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: palette.border,
    },
    logCardIconShell: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    logCardEmoji: {
      fontSize: 20,
    },
    logCardContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logDate: {
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      fontSize: 15,
      marginBottom: 2,
    },
    logTime: {
      color: palette.textSecondary,
      fontFamily: "Manrope-Regular",
      fontSize: 12.5,
    },
    logDuration: {
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      fontSize: 15,
    },

    /* Month Headers */
    monthTitle: {
      fontFamily: "Lexend-Bold",
      fontSize: 17,
      color: palette.textPrimary,
      marginHorizontal: 18,
      marginBottom: 10,
      marginTop: 6,
    },
    monthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: palette.cardSecondary,
      borderRadius: 16,
      padding: 13,
      marginHorizontal: 18,
      marginBottom: 8,
      marginTop: 8,
      borderWidth: 1,
      borderColor: palette.border,
    },
    monthHeaderText: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 15,
      color: palette.textPrimary,
    },
    monthHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
    },
    monthLogCount: {
      color: palette.textSecondary,
      fontFamily: "Manrope-Regular",
      fontSize: 13,
      marginRight: 8,
    },
    expandIcon: {
      fontSize: 17,
      color: palette.textSecondary,
    },

    /* Modal Styles */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(16, 38, 36, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 22,
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 10,
    },
    modalTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      textAlign: "center",
      marginBottom: 10,
    },
    modalMessage: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 20,
    },

    /* Goal Options */
    goalOptions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
      gap: 8,
    },
    goalOption: {
      flex: 1,
      backgroundColor: palette.cardSecondary,
      borderRadius: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },
    selectedGoalOption: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },
    goalOptionText: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    selectedGoalOptionText: {
      color: "white",
    },

    /* Modal Actions */
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },
    cancelButtonText: {
      color: palette.textPrimary,
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
    },
    saveButton: {
      backgroundColor: palette.primary,
    },
    saveButtonText: {
      color: "white",
      fontSize: 14.5,
      fontFamily: "Lexend-Bold",
    },
  });

export default SleepTrackerScreen;
