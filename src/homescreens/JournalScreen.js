import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Weight Tracker, Add Weight, Voice Calorie screen, etc.)
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
  chipBackground: isDark ? "#1F3A36" : "#EAF4F2",
  chipText: isDark ? "#D7ECE8" : "#476560",
  destructive: "#B94F4F",
  // Soft per-category accents, tuned to sit comfortably next to the teal primary
  highlightGreen: isDark ? "#8FD9C4" : "#1F4E4A",
  highlightGreenBg: isDark ? "rgba(143,217,196,0.16)" : "#E6F5F1",
  highlightOrange: isDark ? "#F0C177" : "#B8863A",
  highlightOrangeBg: isDark ? "rgba(240,193,119,0.16)" : "#FBF1E1",
  highlightPurple: isDark ? "#C9B8EE" : "#6E5DA6",
  highlightPurpleBg: isDark ? "rgba(201,184,238,0.16)" : "#EFEBFA",
  highlightBlue: isDark ? "#93C5DE" : "#3D6E8C",
  highlightBlueBg: isDark ? "rgba(147,197,222,0.16)" : "#E6F1F6",
  highlightRed: isDark ? "#E4A0A0" : "#B94F4F",
  highlightRedBg: isDark ? "rgba(228,160,160,0.16)" : "#FBEBEC",
  timelineIconDefaultBg: isDark ? "#233F3B" : "#E8F3F1",
  timelineIconDefaultColor: isDark ? "#9FBEB8" : "#6C8883",
});

const JournalScreen = () => {
  const navigation = useNavigation();
  const { isDark } = useTheme();

  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );

  const [selectedFilter, setSelectedFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [journalData, setJournalData] = useState({
    today: { meals: [], workouts: [], sleep: [], hydration: [], weight: [] },
    yesterday: {
      meals: [],
      workouts: [],
      sleep: [],
      hydration: [],
      weight: [],
    },
  });
  const [timelineDays, setTimelineDays] = useState([]); // [{dateLabel, entries:{meals,workouts,sleep,hydration,weight}}]
  const [rangeFilter, setRangeFilter] = useState("today"); // 'today' | '7days' | '1month'

  const filters = ["All", "Meals", "Workouts", "Sleep", "Hydration", "Weight"];

  const categoryConfigs = useMemo(
    () => [
      { key: "meal", dataKey: "meals", label: "Meals" },
      { key: "workout", dataKey: "workouts", label: "Workouts" },
      { key: "sleep", dataKey: "sleep", label: "Sleep" },
      { key: "hydration", dataKey: "hydration", label: "Hydration" },
      { key: "weight", dataKey: "weight", label: "Weight" },
    ],
    [],
  );

  const iconMap = useMemo(
    () => ({
      meal: {
        icon: "restaurant",
        color: palette.highlightGreen,
        bgColor: palette.highlightGreenBg,
      },
      workout: {
        icon: "fitness",
        color: palette.highlightOrange,
        bgColor: palette.highlightOrangeBg,
      },
      sleep: {
        icon: "moon",
        color: palette.highlightPurple,
        bgColor: palette.highlightPurpleBg,
      },
      hydration: {
        icon: "water",
        color: palette.highlightBlue,
        bgColor: palette.highlightBlueBg,
      },
      weight: {
        icon: "body",
        color: palette.highlightRed,
        bgColor: palette.highlightRedBg,
      },
      default: {
        icon: "ellipse",
        color: palette.timelineIconDefaultColor,
        bgColor: palette.timelineIconDefaultBg,
      },
    }),
    [palette],
  );

  useEffect(() => {
    fetchJournalData();
  }, [rangeFilter]);

  // Helpers for local day handling
  const getLocalDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const getLocalDayBoundsISO = (date) => {
    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    ).toISOString();
    const end = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    ).toISOString();
    return { start, end };
  };

  // Format a duration value (assumed seconds) to human-friendly string
  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    if (sec < 90) return `${Math.max(1, Math.round(sec))}s`;
    const mins = Math.round(sec / 60);
    return `${Math.max(1, mins)}m`;
  };

  // Presentational-only helper: turns a raw yyyy-mm-dd dateLabel into a friendly heading.
  // Does not affect the underlying data or grouping logic.
  const formatDayHeading = (dateStr) => {
    const todayStr = getLocalDateString(new Date());
    const yesterdayStr = getLocalDateString(new Date(Date.now() - 86400000));
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const fetchJournalData = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const todayDate = new Date();
      const yesterdayDate = new Date(Date.now() - 86400000);
      const today = getLocalDateString(todayDate);
      const yesterday = getLocalDateString(yesterdayDate);
      const { start: todayStart, end: todayEnd } =
        getLocalDayBoundsISO(todayDate);
      const { start: yStart, end: yEnd } = getLocalDayBoundsISO(yesterdayDate);

      // Decide range for "today" section
      let rangeStartISO = todayStart;
      let rangeEndISO = todayEnd;
      let rangeStartDateStr = today; // for date-based tables
      let rangeEndDateStr = today;
      if (rangeFilter === "7days") {
        const start = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          todayDate.getDate() - 6,
        );
        rangeStartISO = new Date(start).toISOString();
        rangeEndISO = todayEnd;
        rangeStartDateStr = getLocalDateString(start);
        rangeEndDateStr = today;
      } else if (rangeFilter === "1month") {
        const start = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          1,
        );
        rangeStartISO = new Date(start).toISOString();
        rangeEndISO = todayEnd;
        rangeStartDateStr = getLocalDateString(start);
        rangeEndDateStr = today;
      }

      // Fetch all data for selected range
      const [
        mealsRange,
        cardioRange,
        routineRange,
        waterRange,
        sleepRange,
        weightRange,
      ] = await Promise.all([
        fetchMealsRange(
          userId,
          rangeStartISO,
          rangeEndISO,
          rangeStartDateStr,
          rangeEndDateStr,
        ),
        fetchCardio(userId, rangeStartISO, rangeEndISO),
        fetchRoutineExercisesRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchWaterRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchSleepRange(userId, rangeStartDateStr, rangeEndDateStr),
        fetchWeightRange(userId, rangeStartDateStr, rangeEndDateStr),
      ]);

      // Group by date label
      const byDate = new Map();
      const ensureBucket = (dateStr) => {
        if (!byDate.has(dateStr))
          byDate.set(dateStr, {
            meals: [],
            workouts: [],
            sleep: [],
            hydration: [],
            weight: [],
          });
        return byDate.get(dateStr);
      };
      (mealsRange || []).forEach((m) => {
        const b = ensureBucket(m._date);
        b.meals.push(m);
      });
      (cardioRange || []).forEach((c) => {
        const b = ensureBucket(c._date);
        b.workouts.push(c);
      });
      (routineRange || []).forEach((r) => {
        const b = ensureBucket(r._date);
        b.workouts.push(r);
      });
      (waterRange || []).forEach((w) => {
        const b = ensureBucket(w._date);
        b.hydration.push(w);
      });
      (sleepRange || []).forEach((s) => {
        const b = ensureBucket(s._date);
        b.sleep.push(s);
      });
      (weightRange || []).forEach((w) => {
        const b = ensureBucket(w._date);
        b.weight.push(w);
      });

      // Deduplicate any accidental duplicate keys and sort desc
      const sortedDates = Array.from(new Set(byDate.keys())).sort((a, b) =>
        a < b ? 1 : -1,
      );
      setTimelineDays(
        sortedDates.map((d) => ({ dateLabel: d, entries: byDate.get(d) })),
      );

      setLoading(false);
    } catch (error) {
      console.error("Error fetching journal data:", error);
      setLoading(false);
    }
  };

  const fetchMeals = async (userId, dateStr, startISO, endISO) => {
    try {
      const { data, error } = await supabase
        .from("user_food_logs")
        .select("id, food_name, meal_type, calories, created_at, date_time")
        .eq("user_id", userId)
        .or(
          `date_time.eq.${dateStr},and(created_at.gte.${startISO},created_at.lte.${endISO})`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((meal) => {
        const timeStr = meal.created_at
          ? new Date(meal.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return {
          id: `meal-${meal.id}`,
          title: meal.food_name || "Meal",
          description: `${meal.meal_type || "Meal"} - ${meal.calories || 0} calories`,
          type: "meal",
          _time: timeStr,
        };
      });
    } catch (error) {
      console.error("Error fetching meals:", error);
      return [];
    }
  };

  const fetchMealsRange = async (
    userId,
    startISO,
    endISO,
    startDateStr,
    endDateStr,
  ) => {
    try {
      const { data, error } = await supabase
        .from("user_food_logs")
        .select("id, food_name, meal_type, calories, created_at, date_time")
        .eq("user_id", userId)
        .or(
          `and(date_time.gte.${startDateStr},date_time.lte.${endDateStr}),and(created_at.gte.${startISO},created_at.lte.${endISO})`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((meal) => {
        const dateOnly = meal?.date_time
          ? String(meal.date_time).slice(0, 10)
          : meal.created_at
            ? meal.created_at.split("T")[0]
            : startDateStr;
        const timeStr = meal.created_at
          ? new Date(meal.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return {
          id: `meal-${meal.id}`,
          title: meal.food_name || "Meal",
          description: `${meal.meal_type || "Meal"} - ${meal.calories || 0} calories`,
          type: "meal",
          _date: dateOnly,
          _time: timeStr,
        };
      });
    } catch (error) {
      console.error("Error fetching meals (range):", error);
      return [];
    }
  };

  const fetchCardio = async (userId, startISO, endISO) => {
    try {
      // Primary: saved_cardio_sessions (has user_id)
      const { data: sessions, error: sErr } = await supabase
        .from("saved_cardio_sessions")
        .select("id, name, total_rounds, estimated_time, created_at")
        .eq("user_id", userId)
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false });

      if (sErr) {
        console.error("Error fetching cardio sessions:", sErr);
        return [];
      }

      if (sessions && sessions.length) {
        return sessions.map((s) => ({
          id: `cardio-${s.id}`,
          title: s.name || "Cardio",
          description: `Rounds: ${s.total_rounds ?? 1}   ${formatDuration(s.estimated_time || 0)}`,
          type: "workout",
          _date: s.created_at ? s.created_at.split("T")[0] : "",
          _time: s.created_at
            ? new Date(s.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
        }));
      }

      return [];
    } catch (error) {
      console.error("Error fetching cardio:", error);
      return [];
    }
  };

  const fetchRoutineExercises = async (userId, dateStr) => {
    try {
      // 1) Get workouts for the local date
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .select("id, created_at")
        .eq("date", dateStr);
      if (wErr) throw wErr;
      const ids = (workouts || []).map((w) => w.id);
      const idToTime = new Map(
        (workouts || []).map((w) => [w.id, w.created_at]),
      );
      if (!ids.length) return [];
      // 2) Get routine exercises for those workouts
      const { data, error } = await supabase
        .from("daily_routine_exercises")
        .select("id, exercise_name, total_sets, total_reps, workout_id")
        .in("workout_id", ids)
        .order("exercise_name");
      if (error) throw error;
      return (data || []).map((exercise) => {
        const ts = idToTime.get(exercise.workout_id);
        const timeStr = ts
          ? new Date(ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return {
          id: `routine-${exercise.id}`,
          title: exercise.exercise_name || "Exercise",
          description: `${exercise.total_sets || 0} sets × ${exercise.total_reps || 0} reps`,
          type: "workout",
          _date: ts ? ts.split("T")[0] : dateStr,
          _time: timeStr,
        };
      });
    } catch (error) {
      console.error("Error fetching routine exercises:", error);
      return [];
    }
  };

  const fetchRoutineExercisesRange = async (
    userId,
    startDateStr,
    endDateStr,
  ) => {
    try {
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .select("id, date, created_at")
        .gte("date", startDateStr)
        .lte("date", endDateStr);
      if (wErr) throw wErr;
      const ids = (workouts || []).map((w) => w.id);
      const idToDate = new Map((workouts || []).map((w) => [w.id, w.date]));
      const idToTime = new Map(
        (workouts || []).map((w) => [w.id, w.created_at]),
      );
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("daily_routine_exercises")
        .select("id, exercise_name, total_sets, total_reps, workout_id")
        .in("workout_id", ids)
        .order("exercise_name");
      if (error) throw error;
      return (data || []).map((exercise) => {
        const ts = idToTime.get(exercise.workout_id);
        const timeStr = ts
          ? new Date(ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return {
          id: `routine-${exercise.id}`,
          title: exercise.exercise_name || "Exercise",
          description: `${exercise.total_sets || 0} sets × ${exercise.total_reps || 0} reps`,
          type: "workout",
          _date: idToDate.get(exercise.workout_id) || startDateStr,
          _time: timeStr,
        };
      });
    } catch (error) {
      console.error("Error fetching routine exercises (range):", error);
      return [];
    }
  };

  const fetchWater = async (userId, dateStr) => {
    try {
      const { data, error } = await supabase
        .from("daily_water_intake")
        .select("id, current_intake_ml")
        .eq("user_id", userId)
        .eq("date", dateStr)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error; // allow no rows
      if (!data) return [];
      return [
        {
          id: `water-${data.id}`,
          title: "Hydration Logged",
          description: `${data.current_intake_ml || 0}ml`,
          type: "hydration",
        },
      ];
    } catch (error) {
      console.error("Error fetching water:", error);
      return [];
    }
  };

  const fetchWaterRange = async (userId, startDateStr, endDateStr) => {
    try {
      const { data, error } = await supabase
        .from("daily_water_intake")
        .select("id, current_intake_ml, date")
        .eq("user_id", userId)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });
      if (error) throw error;
      // Only return entries where user actually added water (current_intake_ml > 0)
      return (data || [])
        .filter((w) => w.current_intake_ml && w.current_intake_ml > 0)
        .map((w) => ({
          id: `water-${w.id}`,
          title: "Hydration Logged",
          description: `${w.current_intake_ml}ml`,
          type: "hydration",
          _date: w.date,
        }));
    } catch (error) {
      console.error("Error fetching water (range):", error);
      return [];
    }
  };

  const fetchSleep = async (userId, dateStr) => {
    try {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("id, duration, quality")
        .eq("user_id", userId)
        .eq("date", dateStr)
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return [];
      return [
        {
          id: `sleep-${data.id}`,
          title: "Sleep Logged",
          description: `${data.duration || ""} - Quality: ${data.quality || "N/A"}`,
          type: "sleep",
        },
      ];
    } catch (error) {
      console.error("Error fetching sleep:", error);
      return [];
    }
  };

  const fetchSleepRange = async (userId, startDateStr, endDateStr) => {
    try {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("id, duration, quality, date")
        .eq("user_id", userId)
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []).map((s) => ({
        id: `sleep-${s.id}`,
        title: "Sleep Logged",
        description: `${s.duration || ""} - Quality: ${s.quality || "N/A"}`,
        type: "sleep",
        _date: s.date,
      }));
    } catch (error) {
      console.error("Error fetching sleep (range):", error);
      return [];
    }
  };

  const fetchWeightRange = async (userId, startDateStr, endDateStr) => {
    try {
      console.log(
        "📊 Fetching weight logs for range:",
        startDateStr,
        "to",
        endDateStr,
      );

      // 1. Get ALL weight logs for this user (we need historical data)
      const { data: allLogs, error } = await supabase
        .from("weight_logs")
        .select("id, weight, date, note, emoji")
        .eq("user_id", userId)
        .order("date", { ascending: true }); // Oldest first for processing

      if (error) throw error;

      if (!allLogs || allLogs.length === 0) {
        console.log("⚠️ No weight logs found for user");
        return [];
      }

      console.log("✅ Found", allLogs.length, "weight logs");

      // 2. Create a map of date -> weight (only actual logged dates)
      const weightByDate = new Map();
      allLogs.forEach((log) => {
        weightByDate.set(log.date, {
          id: log.id,
          weight: log.weight,
          note: log.note,
          emoji: log.emoji,
          date: log.date,
        });
      });

      // 3. Generate all dates in the range
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const datesInRange = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesInRange.push(getLocalDateString(d));
      }

      // 4. Only return weight entries where user actually logged weight on that specific date
      // Don't carry forward weight - only show actual logged entries
      const result = [];

      for (const dateStr of datesInRange) {
        // Find weight log that was actually logged on this specific date (not carried forward)
        const actualLog = allLogs.find((log) => log.date === dateStr);

        if (actualLog) {
          result.push({
            id: `weight-${actualLog.id}`,
            title: "Weight Logged",
            description: `${actualLog.weight} kg${actualLog.note ? " - " + actualLog.note : ""}`,
            type: "weight",
            _date: dateStr,
            _isActualLog: true,
          });
        }
      }

      console.log(
        "✅ Processed weight data for",
        result.length,
        "days (only actual logs)",
      );
      return result;
    } catch (error) {
      console.error("❌ Error fetching weight (range):", error);
      return [];
    }
  };

  const getIconForType = (type) => iconMap[type] || iconMap.default;

  // Renders one category block as a timeline "stop": an icon bead sitting on
  // the connecting line, with its label/count and entries to the right.
  const renderCategoryBlock = (config, entries, isLast) => {
    if (!entries || entries.length === 0) return null;
    const iconData = getIconForType(config.key);

    return (
      <View
        key={config.key}
        style={[styles.categoryBlockRow, isLast && styles.categoryBlockRowLast]}
      >
        <View style={styles.categoryIconColumn}>
          <View
            style={[
              styles.categoryIconShell,
              { backgroundColor: iconData.bgColor },
            ]}
          >
            <Ionicons name={iconData.icon} size={15} color={iconData.color} />
          </View>
        </View>

        <View style={styles.categoryContent}>
          <View style={styles.categoryHeaderRow}>
            <Text style={styles.categoryLabel}>{config.label}</Text>
            <View style={styles.categoryCountChip}>
              <Text style={styles.categoryCountText}>{entries.length}</Text>
            </View>
          </View>

          <View style={styles.categoryEntries}>
            {entries.map((entry, idx) => (
              <View
                key={entry.id}
                style={[styles.entryRow, idx !== 0 && styles.entryRowDivider]}
              >
                <View style={styles.entryTextWrap}>
                  <Text style={styles.entryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  {entry.description ? (
                    <Text style={styles.entryDescription} numberOfLines={1}>
                      {entry.description}
                    </Text>
                  ) : null}
                </View>
                {entry._time ? (
                  <Text style={styles.entryTime}>{entry._time}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderDayCard = (day) => {
    const activeConfigs = categoryConfigs.filter(
      (cfg) => selectedFilter === "All" || selectedFilter === cfg.label,
    );
    const blocks = activeConfigs
      .map((cfg, idx) => ({ cfg, entries: day.entries[cfg.dataKey] }))
      .filter(({ entries }) => entries && entries.length > 0);

    if (blocks.length === 0) return null;

    const totalCount = categoryConfigs.reduce(
      (sum, cfg) => sum + (day.entries[cfg.dataKey]?.length || 0),
      0,
    );

    return (
      <View key={day.dateLabel} style={styles.dayCard}>
        <View style={styles.dayCardHeader}>
          <Text style={styles.dayCardDate}>
            {formatDayHeading(day.dateLabel)}
          </Text>
          <View style={styles.dayCardCountChip}>
            <Text style={styles.dayCardCountText}>
              {totalCount} {totalCount === 1 ? "entry" : "entries"}
            </Text>
          </View>
        </View>

        <View style={styles.timelineWrap}>
          <View style={styles.timelineLine} />
          <View style={styles.timelineEntries}>
            {blocks.map(({ cfg, entries }, idx) =>
              renderCategoryBlock(cfg, entries, idx === blocks.length - 1),
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Loading timeline...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Hero header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            style={styles.heroBackBtn}
            onPress={() => navigation.navigate("MainDashboard")}
          >
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Timeline</Text>
          <View style={styles.heroSpacer} />
        </View>
        <Text style={styles.heroSubtitle}>
          Meals, workouts, sleep and more — all in one place.
        </Text>
      </View>

      {/* Range segmented control */}
      <View style={styles.rangeTabsRow}>
        {[
          { key: "today", label: "Today" },
          { key: "7days", label: "7 Days" },
          { key: "1month", label: "Month" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.rangeTab,
              rangeFilter === opt.key && styles.rangeTabActive,
            ]}
            onPress={() => setRangeFilter(opt.key)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.rangeTabText,
                rangeFilter === opt.key && styles.rangeTabTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeChipsRow}
        contentContainerStyle={styles.typeChipsContent}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.typeChip,
              selectedFilter === f && styles.typeChipActive,
            ]}
            onPress={() => setSelectedFilter(f)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.typeChipText,
                selectedFilter === f && styles.typeChipTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Timeline content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.timelineContainer}>
          {timelineDays.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons
                name="calendar-outline"
                size={26}
                color={palette.primary}
              />
              <Text style={styles.emptyStateTitle}>Nothing logged yet</Text>
              <Text style={styles.emptyStateText}>
                Entries you log for meals, workouts, sleep, hydration and weight
                will show up here.
              </Text>
            </View>
          ) : (
            timelineDays.map(renderDayCard)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 15,
      color: palette.textSecondary,
      fontFamily: "Manrope-Regular",
    },

    // Hero header
    heroCard: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 4,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
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
    heroSubtitle: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginBottom: 4,
    },

    // Range segmented control
    rangeTabsRow: {
      flexDirection: "row",
      marginHorizontal: 18,
      marginTop: 10,
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      padding: 4,
      borderWidth: 1,
      borderColor: palette.border,
    },
    rangeTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: "center",
    },
    rangeTabActive: {
      backgroundColor: palette.primary,
    },
    rangeTabText: {
      fontSize: 13,
      fontFamily: "Lexend-SemiBold",
      color: palette.textSecondary,
    },
    rangeTabTextActive: {
      color: "#FFFFFF",
    },

    // Type filter chips
    typeChipsRow: {
      marginTop: 12,
      maxHeight: 44,
    },
    typeChipsContent: {
      paddingHorizontal: 18,
      gap: 8,
    },
    typeChip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      marginRight: 8,
    },
    typeChipActive: {
      backgroundColor: palette.cardSecondary,
      borderColor: palette.primary,
    },
    typeChipText: {
      fontSize: 13,
      fontFamily: "Lexend-SemiBold",
      color: palette.textSecondary,
    },
    typeChipTextActive: {
      color: palette.primary,
    },

    scrollView: {
      flex: 1,
      backgroundColor: palette.background,
    },
    timelineContainer: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 40,
    },

    // Day card
    dayCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    dayCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    dayCardDate: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    dayCardCountChip: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: palette.border,
    },
    dayCardCountText: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },

    // Timeline (the connecting "journey" line down the left of each day card)
    timelineWrap: {
      position: "relative",
    },
    timelineLine: {
      position: "absolute",
      left: 17,
      top: 4,
      bottom: 22,
      width: 2,
      backgroundColor: palette.border,
    },
    timelineEntries: {
      paddingLeft: 0,
    },

    // Category block — one "stop" on the timeline
    categoryBlockRow: {
      flexDirection: "row",
      marginBottom: 18,
    },
    categoryBlockRowLast: {
      marginBottom: 0,
    },
    categoryIconColumn: {
      width: 36,
      alignItems: "center",
    },
    categoryIconShell: {
      width: 36,
      height: 36,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: palette.card,
    },
    categoryContent: {
      flex: 1,
      marginLeft: 12,
    },
    categoryHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    categoryLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },
    categoryCountChip: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    categoryCountText: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
    },
    categoryEntries: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 16,
      paddingHorizontal: 12,
    },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 11,
    },
    entryRowDivider: {
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },
    entryTextWrap: {
      flex: 1,
      paddingRight: 10,
    },
    entryTitle: {
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 2,
    },
    entryDescription: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },
    entryTime: {
      fontSize: 11,
      fontFamily: "Manrope-Regular",
      color: palette.textMuted,
    },

    // Empty state
    emptyStateCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 26,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      marginTop: 20,
    },
    emptyStateTitle: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginTop: 10,
      marginBottom: 6,
    },
    emptyStateText: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
  });

export default JournalScreen;
