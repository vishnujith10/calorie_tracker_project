import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";
import { getFoodLogs } from "../utils/api";

// Global cache for progress data
const globalProgressCache = {
  cachedData: null,
  timestamp: null,
  isStale: false,
  CACHE_DURATION: 5000, // 5 seconds
};

const screenWidth = Dimensions.get("window").width - 32;

const RANGES = [
  { key: "this_week", label: "This Week", days: 7, offsetWeeks: 0 },
  { key: "last_week", label: "Last Week", days: 7, offsetWeeks: 1 },
  { key: "one_month", label: "1 Month", days: 30 },
  { key: "ninety_days", label: "90 Days", days: 90 },
];

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Add Weight, Journal/Timeline, Daily Check-in, etc.)
const createPalette = (isDark) => ({
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
  destructive: "#B94F4F",
  positive: "#1F4E4A",
  goalAccent: isDark ? "#F0C177" : "#B8863A",
  goalAccentBg: isDark ? "rgba(240,193,119,0.16)" : "#FBF1E1",
});

// Fixed date utility functions with timezone handling
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getRangeDates(range) {
  // Use local timezone to avoid UTC conversion issues
  const now = new Date();

  // Debug: Log the current date
  console.log("getRangeDates - Current date:", now.toISOString());
  console.log("getRangeDates - Current year:", now.getFullYear());

  if (range.key === "this_week") {
    // This week: Monday to Sunday of current week
    const today = new Date(now);
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate days since Monday (handle Sunday as day 0)
    const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    // Get Monday of this week
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);

    // Get Sunday of this week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Debug logging for this week calculation
    console.log("getRangeDates - This Week Calculation:");
    console.log("  Today:", today.toISOString());
    console.log("  Current day of week:", currentDayOfWeek);
    console.log("  Days since Monday:", daysSinceMonday);
    console.log("  This week Monday:", monday.toISOString());
    console.log("  This week Sunday:", sunday.toISOString());

    return { start: monday, end: sunday };
  } else if (range.key === "last_week") {
    // Last week: Monday to Sunday of previous week
    const today = new Date(now);
    const currentDayOfWeek = today.getDay();
    const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

    // Get Monday of this week first
    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() - daysSinceMonday);
    thisWeekMonday.setHours(0, 0, 0, 0);

    // Go back 7 days to get last week's Monday
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
    lastWeekMonday.setHours(0, 0, 0, 0); // Ensure it's start of day

    // Get last week's Sunday (this week's Monday - 1 day)
    const lastWeekSunday = new Date(thisWeekMonday);
    lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);
    lastWeekSunday.setHours(23, 59, 59, 999);

    // Debug logging for last week calculation
    console.log("getRangeDates - Last Week Calculation:");
    console.log("  Today:", today.toISOString());
    console.log("  Current day of week:", currentDayOfWeek);
    console.log("  Days since Monday:", daysSinceMonday);
    console.log("  This week Monday:", thisWeekMonday.toISOString());
    console.log("  Last week Monday:", lastWeekMonday.toISOString());
    console.log("  Last week Sunday:", lastWeekSunday.toISOString());

    return { start: lastWeekMonday, end: lastWeekSunday };
  } else if (range.key === "one_month") {
    // 1 Month: Last 30 days including today
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(now.getDate() - 29); // 30 days total including today
    start.setHours(0, 0, 0, 0);

    return { start, end };
  } else if (range.key === "ninety_days") {
    // 90 Days: Last 90 days including today
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setDate(now.getDate() - 89); // 90 days total including today
    start.setHours(0, 0, 0, 0);

    return { start, end };
  }

  // Fallback
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setDate(now.getDate() - (range.days - 1));
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function groupByDay(logs, start, end, rangeKey = null) {
  console.log(`groupByDay called with rangeKey: ${rangeKey}`);
  console.log(`groupByDay - logs length: ${logs ? logs.length : "undefined"}`);
  console.log(`groupByDay - start: ${start.toISOString()}`);
  console.log(`groupByDay - end: ${end.toISOString()}`);

  // Safety check for logs
  if (!Array.isArray(logs)) {
    console.log("groupByDay: logs is not an array, returning empty days");
    return [];
  }

  // Create array of days in the range using LOCAL dates
  const days = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push({
      date: new Date(cursor),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Process each log and add to appropriate day
  console.log(`groupByDay - Processing ${logs.length} logs`);
  logs.forEach((log, index) => {
    // Safety check for log object
    if (!log || !log.created_at) {
      console.log("groupByDay: Invalid log object, skipping");
      return;
    }

    // Debug first few logs
    if (index < 3) {
      console.log(`groupByDay - Log ${index}:`, {
        date: log.created_at,
        food: log.food_name,
        calories: log.calories,
      });
    }

    const logDate = new Date(log.created_at);

    // Check if logDate is valid
    if (isNaN(logDate.getTime())) {
      console.log("groupByDay: Invalid log date, skipping");
      return;
    }

    // Convert to local date string for comparison (YYYY-MM-DD format)
    // Use LOCAL time components, not UTC
    const logDateStr =
      logDate.getFullYear() +
      "-" +
      String(logDate.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(logDate.getDate()).padStart(2, "0");

    // Use LOCAL dates for range comparison
    const startDateStr =
      start.getFullYear() +
      "-" +
      String(start.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(start.getDate()).padStart(2, "0");
    const endDateStr =
      end.getFullYear() +
      "-" +
      String(end.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(end.getDate()).padStart(2, "0");

    // Debug logging for date comparison
    if (rangeKey === "last_week" || rangeKey === "this_week") {
      console.log(`groupByDay - ${rangeKey} Debug:`);
      console.log(`  Log date: ${logDateStr}`);
      console.log(`  Start date: ${startDateStr}`);
      console.log(`  End date: ${endDateStr}`);
      console.log(
        `  In range: ${logDateStr >= startDateStr && logDateStr <= endDateStr}`,
      );
    }

    if (logDateStr >= startDateStr && logDateStr <= endDateStr) {
      // Find the matching day in our array using date string comparison with LOCAL dates
      const matchingDayIndex = days.findIndex((day) => {
        const dayDateStr =
          day.date.getFullYear() +
          "-" +
          String(day.date.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(day.date.getDate()).padStart(2, "0");
        return dayDateStr === logDateStr;
      });

      if (matchingDayIndex !== -1) {
        const calories = Number(log.calories || 0);
        const protein = Number(log.protein || 0);
        const carbs = Number(log.carbs || 0);
        const fat = Number(log.fat || 0);

        // Debug logging
        if (rangeKey === "last_week" || rangeKey === "this_week") {
          console.log(
            `groupByDay - Adding to day ${matchingDayIndex}: ${calories} calories`,
          );
        }

        days[matchingDayIndex].calories += calories;
        days[matchingDayIndex].protein += protein;
        days[matchingDayIndex].carbs += carbs;
        days[matchingDayIndex].fat += fat;
      } else {
        // Debug logging - why no match found
        if (rangeKey === "last_week" || rangeKey === "this_week") {
          console.log(
            `groupByDay - No matching day found for log date: ${logDateStr}`,
          );
          console.log(
            `groupByDay - Available days:`,
            days.map((d) => {
              const dayDateStr =
                d.date.getFullYear() +
                "-" +
                String(d.date.getMonth() + 1).padStart(2, "0") +
                "-" +
                String(d.date.getDate()).padStart(2, "0");
              return dayDateStr;
            }),
          );
        }
      }
    }
  });

  return days;
}

export default function ProgressScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  const [activeRange, setActiveRange] = useState(RANGES[0]);
  const [activeMetric, setActiveMetric] = useState("calories");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Initialize with cached data
  const [daily, setDaily] = useState(
    () => globalProgressCache.cachedData?.daily || [],
  );
  const [totals, setTotals] = useState(
    () =>
      globalProgressCache.cachedData?.totals || {
        total: 0,
        average: 0,
        best: 0,
        worst: 0,
        bestDate: null,
        worstDate: null,
        streak: 0,
      },
  );
  const [prevTotal, setPrevTotal] = useState(
    () => globalProgressCache.cachedData?.prevTotal || null,
  );
  const [userGoal, setUserGoal] = useState(
    () => globalProgressCache.cachedData?.userGoal || null,
  );
  const [logsCount, setLogsCount] = useState(
    () => globalProgressCache.cachedData?.logsCount || 0,
  );

  // Cache-first data fetching with useFocusEffect
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const now = Date.now();
        const isCacheValid =
          globalProgressCache.timestamp &&
          now - globalProgressCache.timestamp <
            globalProgressCache.CACHE_DURATION;

        // Check if cache is for the same range
        const cacheRangeKey = globalProgressCache.cachedData?.rangeKey;
        const isSameRange = cacheRangeKey === activeRange.key;

        // If cache is fresh and for the same range, use it and skip fetch
        if (isCacheValid && globalProgressCache.cachedData && isSameRange) {
          const cached = globalProgressCache.cachedData;
          setDaily(cached.daily || []);
          setTotals(
            cached.totals || {
              total: 0,
              average: 0,
              best: 0,
              worst: 0,
              bestDate: null,
              worstDate: null,
              streak: 0,
            },
          );
          setPrevTotal(cached.prevTotal || null);
          setUserGoal(cached.userGoal || null);
          setLogsCount(cached.logsCount || 0);
          return;
        }

        // If cache is stale, use it immediately but fetch fresh data
        if (globalProgressCache.cachedData && globalProgressCache.isStale) {
          const cached = globalProgressCache.cachedData;
          setDaily(cached.daily || []);
          setTotals(
            cached.totals || {
              total: 0,
              average: 0,
              best: 0,
              worst: 0,
              bestDate: null,
              worstDate: null,
              streak: 0,
            },
          );
          setPrevTotal(cached.prevTotal || null);
          setUserGoal(cached.userGoal || null);
          setLogsCount(cached.logsCount || 0);
        }

        // Fetch fresh data
        if (isFetching) return;
        setIsFetching(true);
        setLoading(true);

        try {
          // Get date range for the selected period
          const { start, end } = getRangeDates(activeRange);

          // Debug logging
          console.log(`ProgressScreen - Range: ${activeRange.key}`);
          console.log(`ProgressScreen - Start: ${start.toISOString()}`);
          console.log(`ProgressScreen - End: ${end.toISOString()}`);
          console.log(
            `ProgressScreen - Total logs fetched: ${logs ? logs.length : 0}`,
          );

          // Debug: Log sample log dates
          if (logs && logs.length > 0) {
            console.log(
              `ProgressScreen - Sample log dates:`,
              logs.slice(0, 3).map((log) => ({
                date: log.created_at,
                food: log.food_name,
                calories: log.calories,
              })),
            );

            // Debug: Log all log dates for last week
            if (activeRange.key === "last_week") {
              console.log(
                `ProgressScreen - All log dates for Last Week:`,
                logs.map((log) => ({
                  date: log.created_at,
                  food: log.food_name,
                  calories: log.calories,
                })),
              );
            }
          }

          // Fetch user's profile for adaptive goal calculation
          const { data: profile } = await supabase
            .from("user_profile")
            .select(
              "calorie_goal, weight, height, age, gender, activity_level, goal",
            )
            .eq("id", userId)
            .single();
          const userGoalValue = profile?.calorie_goal
            ? Number(profile.calorie_goal)
            : null;

          // Fetch all food logs with proper error handling
          let logs = [];
          try {
            const fetchedLogs = await getFoodLogs(userId);
            logs = Array.isArray(fetchedLogs) ? fetchedLogs : [];
          } catch (error) {
            console.log(
              "getFoodLogs failed, trying direct Supabase query:",
              error.message,
            );
            try {
              const { data: supabaseLogs, error: supabaseError } =
                await supabase
                  .from("user_food_logs")
                  .select("*")
                  .eq("user_id", userId)
                  .order("created_at", { ascending: false });

              if (supabaseError) {
                console.log("Supabase query error:", supabaseError.message);
                logs = [];
              } else {
                logs = Array.isArray(supabaseLogs) ? supabaseLogs : [];
              }
            } catch (directError) {
              console.log("Direct Supabase query failed:", directError.message);
              logs = [];
            }
          }

          // Group logs by day
          console.log(
            `ProgressScreen - About to call groupByDay with ${logs ? logs.length : 0} logs`,
          );
          console.log(`ProgressScreen - Range key: ${activeRange.key}`);
          console.log(`ProgressScreen - Start date: ${start.toISOString()}`);
          console.log(`ProgressScreen - End date: ${end.toISOString()}`);
          console.log(
            `ProgressScreen - Start date string: ${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`,
          );
          console.log(
            `ProgressScreen - End date string: ${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
          );

          const perDay = groupByDay(logs, start, end, activeRange.key);

          // Debug logging for grouped data
          console.log(
            `ProgressScreen - Days in range: ${perDay ? perDay.length : 0}`,
          );
          console.log(
            `ProgressScreen - Days with data: ${perDay ? perDay.filter((d) => d.calories > 0).length : 0}`,
          );
          console.log(
            `ProgressScreen - Total calories in range: ${perDay ? perDay.reduce((sum, d) => sum + d.calories, 0) : 0}`,
          );

          // Log the actual perDay data for debugging
          if (
            activeRange.key === "last_week" ||
            activeRange.key === "this_week"
          ) {
            console.log(
              `ProgressScreen - ${activeRange.key} perDay data:`,
              perDay,
            );
          }

          // Calculate totals for the active metric
          const metricKey = activeMetric;
          const values = perDay
            ? perDay.map((d) => Number(d[metricKey] || 0))
            : [];
          const total = values.reduce((sum, val) => sum + val, 0);
          const daysWithData = values.filter((v) => v > 0).length;
          const average = daysWithData > 0 ? total / daysWithData : 0;

          // Find best and worst days
          let best = 0,
            worst = 0,
            bestDate = null,
            worstDate = null;
          if (values.length > 0) {
            const nonZeroValues = values.filter((v) => v > 0);
            if (nonZeroValues.length > 0) {
              best = Math.max(...values);
              worst = Math.min(...nonZeroValues); // Only consider days with data for worst
              const bestIndex = values.indexOf(best);
              const worstIndex = values.indexOf(worst);
              bestDate = perDay[bestIndex]?.date || null;
              worstDate = perDay[worstIndex]?.date || null;
            }
          }

          // Calculate streak (consecutive days with logged data from the end)
          let streak = 0;
          if (perDay && perDay.length > 0) {
            for (let i = perDay.length - 1; i >= 0; i--) {
              if ((perDay[i][metricKey] || 0) > 0) {
                streak++;
              } else {
                break;
              }
            }
          }

          const totalsData = {
            total,
            average,
            best,
            worst,
            bestDate,
            worstDate,
            streak,
          };

          // Calculate previous period for comparison
          const prevRange = calculatePreviousRange(activeRange, start);
          const prevPerDay = groupByDay(
            logs,
            prevRange.start,
            prevRange.end,
            activeRange.key,
          );
          const prevTotalValue = prevPerDay
            ? prevPerDay.reduce((sum, d) => sum + Number(d[metricKey] || 0), 0)
            : 0;

          // Update cache with range key
          globalProgressCache.cachedData = {
            daily: perDay,
            totals: totalsData,
            prevTotal: prevTotalValue,
            userGoal: userGoalValue,
            logsCount: logs ? logs.length : 0,
            rangeKey: activeRange.key, // Store the range key for cache validation
          };
          globalProgressCache.timestamp = Date.now();
          globalProgressCache.isStale = false;

          // Only update state if data has changed
          const currentDataString = JSON.stringify({
            daily,
            totals,
            prevTotal,
            userGoal,
            logsCount,
          });
          const newDataString = JSON.stringify({
            daily: perDay,
            totals: totalsData,
            prevTotal: prevTotalValue,
            userGoal: userGoalValue,
            logsCount: logs ? logs.length : 0,
          });

          if (currentDataString !== newDataString) {
            setDaily(perDay);
            setTotals(totalsData);
            setPrevTotal(prevTotalValue);
            setUserGoal(userGoalValue);
            setLogsCount(logs ? logs.length : 0);
          }
        } catch (error) {
          console.error("Error loading progress data:", error);
        } finally {
          setLoading(false);
          setIsFetching(false);
        }
      };

      load();
    }, [
      activeRange,
      activeMetric,
      isFetching,
      daily,
      logsCount,
      prevTotal,
      totals,
      userGoal,
    ]),
  );

  // Helper function to calculate previous period range
  function calculatePreviousRange(currentRange, currentStart) {
    if (currentRange.key === "this_week") {
      // This week vs last week
      return getRangeDates({ key: "last_week", days: 7 });
    } else if (currentRange.key === "last_week") {
      // Last week vs the week before last week
      const now = new Date();
      const today = new Date(now);
      const currentDayOfWeek = today.getDay();
      const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

      // Get Monday of this week first
      const thisWeekMonday = new Date(today);
      thisWeekMonday.setDate(today.getDate() - daysSinceMonday);

      // Go back 14 days to get the week before last week's Monday
      const twoWeeksAgoMonday = new Date(thisWeekMonday);
      twoWeeksAgoMonday.setDate(thisWeekMonday.getDate() - 14);

      // Get the week before last week's Sunday
      const twoWeeksAgoSunday = new Date(twoWeeksAgoMonday);
      twoWeeksAgoSunday.setDate(twoWeeksAgoMonday.getDate() + 6);

      return {
        start: startOfDay(twoWeeksAgoMonday),
        end: endOfDay(twoWeeksAgoSunday),
      };
    } else {
      // For month and 90-day ranges, go back by the same number of days
      const days = currentRange.days || 30;
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (days - 1));
      return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
    }
  }

  const labels = useMemo(() => {
    if (activeRange.days <= 7) {
      // For weekly views, show day names
      return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    }

    // For longer ranges, show selected dates
    const count = daily ? daily.length : 0;
    const step = Math.max(1, Math.floor(count / 6));
    return daily
      ? daily.map((d, i) => {
          if (i % step === 0) {
            return `${d.date.getMonth() + 1}/${d.date.getDate()}`;
          }
          return "";
        })
      : [];
  }, [daily, activeRange]);

  const metricLabel = activeMetric === "calories" ? "cal" : "g";

  // Data points for chart
  const dataPoints = useMemo(() => {
    if (!daily || !Array.isArray(daily)) {
      return [];
    }

    if (activeRange.key === "this_week" || activeRange.key === "last_week") {
      // Weekly views: show daily values
      return daily.map((d) => Math.round(d[activeMetric] || 0));
    } else {
      // Monthly and 90-day views: show cumulative totals
      let cumulative = 0;
      return daily.map((d) => {
        cumulative += Number(d[activeMetric] || 0);
        return Math.round(cumulative);
      });
    }
  }, [daily, activeMetric, activeRange]);

  const deltaPct = useMemo(() => {
    if (prevTotal == null || !totals) return null;
    if (prevTotal === 0) return totals.total > 0 ? 100 : 0;
    return ((totals.total - prevTotal) / prevTotal) * 100;
  }, [prevTotal, totals]);

  // Determine what value to show in the main display
  const mainDisplayValue = useMemo(() => {
    if (activeRange.key === "this_week") {
      // This Week: Show today's value for the selected metric
      const today = new Date();
      const todayData = daily
        ? daily.find((d) => isSameDay(d.date, today))
        : null;
      return Math.round(todayData?.[activeMetric] || 0);
    } else if (activeRange.key === "last_week") {
      // Last Week: Show total
      return Math.round(totals?.total || 0);
    } else {
      // Month/90 days: Show total
      return Math.round(totals?.total || 0);
    }
  }, [activeRange, totals, daily, activeMetric]);

  const mainDisplayLabel = useMemo(() => {
    if (activeRange.key === "this_week") {
      return `Today's ${activeMetric === "calories" ? "Calories" : activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} - ${activeRange.label}`;
    } else {
      return `Total ${activeMetric === "calories" ? "Calories" : activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)} - ${activeRange.label}`;
    }
  }, [activeRange, activeMetric]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Hero header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Home")}
            style={styles.heroBackBtn}
          >
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Deep Insights</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionEyebrow}>Nutrition</Text>
        <Text style={styles.sectionTitle}>Calories & Food Rituals</Text>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => setActiveRange(r)}
              style={[
                styles.rangeBtn,
                activeRange.key === r.key && styles.rangeBtnActive,
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.rangeText,
                  activeRange.key === r.key && styles.rangeTextActive,
                ]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main value card */}
        <View style={styles.displayCard}>
          <Text style={styles.displayLabel}>{mainDisplayLabel}</Text>
          <View style={styles.displayValueRow}>
            {loading ? (
              <Text style={styles.loadingText}>Loading...</Text>
            ) : (
              <>
                <Text style={styles.displayValue}>{mainDisplayValue}</Text>
                <Text style={styles.metricLabel}>{metricLabel}</Text>
              </>
            )}
          </View>

          {/* Metric selector */}
          <View style={styles.metricRow}>
            {["calories", "protein", "carbs", "fat"].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setActiveMetric(m)}
                style={[
                  styles.metricBtn,
                  activeMetric === m && styles.metricBtnActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.metricText,
                    activeMetric === m && styles.metricTextActive,
                  ]}
                >
                  {m === "calories"
                    ? "Calories"
                    : m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chart card */}
        <View style={styles.chartCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.chartTitle}>Trend</Text>
            {userGoal &&
              activeMetric === "calories" &&
              (activeRange.key === "this_week" ||
                activeRange.key === "last_week") && (
                <View style={styles.goalChip}>
                  <View style={styles.goalDot} />
                  <Text style={styles.goalChipText}>Goal {userGoal}</Text>
                </View>
              )}
          </View>
          <LineChart
            data={{
              labels,
              datasets: [
                {
                  data: dataPoints.length ? dataPoints : [0],
                  color: (opacity = 1) => `rgba(31, 78, 74, ${opacity})`,
                },
                ...(activeMetric === "calories" &&
                userGoal &&
                (activeRange.key === "this_week" ||
                  activeRange.key === "last_week")
                  ? [
                      {
                        data: new Array(dataPoints.length || 7).fill(userGoal),
                        color: (opacity = 1) =>
                          `rgba(184, 134, 58, ${opacity})`,
                      },
                    ]
                  : []),
              ],
            }}
            width={screenWidth - 32}
            height={220}
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: palette.card,
              backgroundGradientFrom: palette.card,
              backgroundGradientTo: palette.card,
              decimalPlaces: 0,
              color: (opacity = 1) => {
                const rgb = isDark ? "244, 251, 250" : "22, 54, 51";
                return `rgba(${rgb}, ${opacity})`;
              },
              labelColor: (opacity = 1) => {
                const rgb = isDark ? "190, 217, 211" : "91, 120, 115";
                return `rgba(${rgb}, ${opacity})`;
              },
              propsForDots: {
                r: "3",
                strokeWidth: "1",
                stroke: palette.primary,
              },
              propsForBackgroundLines: {
                strokeDasharray: "",
                stroke: palette.border,
                strokeWidth: 1,
              },
            }}
            bezier
            withInnerLines={false}
            fromZero
            style={styles.chartInner}
          />
        </View>

        {/* Data Summary */}
        <View style={styles.dataSummaryCard}>
          <View style={styles.dataSummaryHeaderRow}>
            <Ionicons
              name="stats-chart-outline"
              size={16}
              color={palette.primary}
            />
            <Text style={styles.dataSummaryTitle}>Data Summary</Text>
          </View>
          <View style={styles.dataSummaryGrid}>
            <View style={styles.dataSummaryItem}>
              <Text style={styles.dataSummaryValue}>{logsCount}</Text>
              <Text style={styles.dataSummaryLabel}>Total Logs</Text>
            </View>
            <View style={styles.dataSummaryItem}>
              <Text style={styles.dataSummaryValue}>
                {activeMetric.charAt(0).toUpperCase() + activeMetric.slice(1)}
              </Text>
              <Text style={styles.dataSummaryLabel}>Metric</Text>
            </View>
            <View style={styles.dataSummaryItem}>
              <Text style={styles.dataSummaryValue}>{activeRange.label}</Text>
              <Text style={styles.dataSummaryLabel}>Period</Text>
            </View>
          </View>
          <Text style={styles.dataSummaryFootnote}>
            Chart shows{" "}
            {activeRange.key === "this_week" || activeRange.key === "last_week"
              ? "daily values"
              : "cumulative totals"}
          </Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>
              {activeRange.key === "this_week" ? "Today" : "Total"}
            </Text>
            <Text style={styles.statValue}>
              {activeRange.key === "this_week"
                ? mainDisplayValue
                : Math.round(totals.total || 0)}{" "}
              {metricLabel}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>
              {activeRange.key === "this_week"
                ? "Weekly Total"
                : "Average Daily"}
            </Text>
            <Text style={styles.statValue}>
              {activeRange.key === "this_week"
                ? Math.round(totals.total || 0)
                : Math.round(totals.average || 0)}{" "}
              {metricLabel}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Best Day</Text>
            <Text style={styles.statValue}>
              {Math.round(totals.best || 0)} {metricLabel}
            </Text>
            {totals.bestDate && (
              <Text style={styles.statDate}>
                {totals.bestDate.getMonth() +
                  1 +
                  "/" +
                  totals.bestDate.getDate()}
              </Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Worst Day</Text>
            <Text style={styles.statValue}>
              {Math.round(totals.worst || 0)} {metricLabel}
            </Text>
            {totals.worstDate && (
              <Text style={styles.statDate}>
                {totals.worstDate.getMonth() +
                  1 +
                  "/" +
                  totals.worstDate.getDate()}
              </Text>
            )}
          </View>
        </View>

        {deltaPct != null && (
          <View style={styles.deltaCard}>
            <View
              style={[
                styles.deltaIconShell,
                {
                  backgroundColor:
                    deltaPct >= 0
                      ? palette.cardSecondary
                      : "rgba(185,79,79,0.12)",
                },
              ]}
            >
              <Ionicons
                name={deltaPct >= 0 ? "trending-up" : "trending-down"}
                size={17}
                color={deltaPct >= 0 ? palette.positive : palette.destructive}
              />
            </View>
            <Text style={styles.deltaText}>
              {activeRange.label} vs previous: {deltaPct >= 0 ? "+" : ""}
              {deltaPct.toFixed(1)}%
            </Text>
          </View>
        )}

        {(!daily || daily.length === 0) && !loading ? (
          <View style={styles.noDataCard}>
            <Ionicons
              name="information-circle-outline"
              size={26}
              color={palette.primary}
            />
            <Text style={styles.noDataText}>
              No food logs found for this period
            </Text>
            <Text style={styles.noDataSubtext}>
              Start logging your meals to see your progress here
            </Text>
          </View>
        ) : (
          <Text style={styles.footerText}>
            Your calorie intake is based on your logged meals for the selected
            period.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingBottom: 32,
    },

    // Hero header
    heroCard: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 6,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    heroBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    heroSpacer: { width: 40 },

    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginTop: 10,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 14,
    },

    // Range segmented control
    rangeRow: {
      flexDirection: "row",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      padding: 4,
      borderWidth: 1,
      borderColor: palette.border,
    },
    rangeBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: "center",
    },
    rangeBtnActive: {
      backgroundColor: palette.primary,
    },
    rangeText: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: palette.textSecondary,
    },
    rangeTextActive: {
      color: "#FFFFFF",
    },

    // Main display card
    displayCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 20,
      marginTop: 14,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 16,
      elevation: 3,
    },
    displayLabel: {
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
    displayValueRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 6,
      marginBottom: 16,
    },
    displayValue: {
      fontSize: 40,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    metricLabel: {
      fontSize: 14,
      fontFamily: "Manrope-Medium",
      color: palette.textSecondary,
      marginLeft: 6,
      marginBottom: 6,
    },
    loadingText: {
      fontSize: 16,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
    },

    metricRow: {
      flexDirection: "row",
      backgroundColor: palette.cardSecondary,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: palette.border,
    },
    metricBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: "center",
    },
    metricBtnActive: { backgroundColor: palette.primary },
    metricText: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: palette.textSecondary,
    },
    metricTextActive: { color: "#FFFFFF" },

    // Chart card
    chartCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
      paddingHorizontal: 4,
    },
    chartTitle: {
      fontSize: 16,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    goalChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.goalAccentBg,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    goalDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: palette.goalAccent,
      marginRight: 6,
    },
    goalChipText: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.goalAccent,
    },
    chartInner: {
      alignSelf: "center",
      borderRadius: 16,
    },

    // Data summary card
    dataSummaryCard: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 18,
      marginTop: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },
    dataSummaryHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    dataSummaryTitle: {
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginLeft: 8,
    },
    dataSummaryGrid: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    dataSummaryItem: {
      flex: 1,
      alignItems: "center",
    },
    dataSummaryValue: {
      fontSize: 14,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      marginBottom: 2,
    },
    dataSummaryLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    dataSummaryFootnote: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      marginTop: 14,
    },

    // Stat cards
    statRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },
    statTitle: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      marginBottom: 6,
    },
    statValue: {
      fontSize: 21,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    statDate: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textMuted,
      marginTop: 4,
    },

    // Delta card
    deltaCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.card,
      borderRadius: 20,
      padding: 14,
      marginTop: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    deltaIconShell: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    deltaText: {
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },

    // Empty / footer
    noDataCard: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 22,
      marginTop: 16,
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    noDataText: {
      fontSize: 15,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginTop: 10,
      textAlign: "center",
    },
    noDataSubtext: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginTop: 4,
      textAlign: "center",
    },
    footerText: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginTop: 16,
      textAlign: "center",
      lineHeight: 18,
    },
  });
