import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Dimensions,
    FlatList,
    Alert as RNAlert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

// Global cache for WeightTrackerScreen (Instagram pattern)
const globalWeightCache = {
  isFetching: false,
  lastFetchTime: 0,
  CACHE_DURATION: 60000, // 60 seconds
  cachedData: null,
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Shared palette — mirrors the teal design system used across the app
// (Home dashboard, Voice Calorie screen, etc.) so every screen matches.
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
  destructiveSoft: isDark ? "#3A2426" : "#FBEBEC",
  positive: "#1F4E4A",
  positiveSoft: isDark ? "#1D403B" : "#E6F5F1",
  selectedCard: isDark ? "#1D403B" : "#E6F5F1",
  nutritionSoft: isDark ? "#1E3B37" : "#EDF7F5",
});

const WeightTrackerScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { isDark } = useTheme();
  const palette = useMemo(() => createPalette(isDark), [isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  // Initialize state with cached data (Instagram pattern)
  const [logs, setLogs] = useState(
    () => globalWeightCache.cachedData?.logs || [],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(
    () => globalWeightCache.cachedData?.userProfile || null,
  );

  // Synchronous cache restoration to prevent flickering (Instagram pattern)
  const [currentWeight, setCurrentWeight] = useState(() => {
    if (globalWeightCache.cachedData) {
      const cLogs = globalWeightCache.cachedData.logs;
      const cProfile = globalWeightCache.cachedData.userProfile;
      return cLogs?.length > 0
        ? Number(cLogs[0].weight)
        : cProfile?.weight || null;
    }
    return null;
  });
  const [goalWeight, setGoalWeight] = useState(
    () => globalWeightCache.cachedData?.userProfile?.target_weight || null,
  );
  const [realUserId, setRealUserId] = useState(null);

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) setRealUserId(user.id);
    };
    getUser();
  }, []);

  // Fetch user profile and logs with caching
  useFocusEffect(
    React.useCallback(() => {
      if (!realUserId) return;

      const load = async () => {
        const now = Date.now();
        const isFresh =
          now - globalWeightCache.lastFetchTime <
          globalWeightCache.CACHE_DURATION;

        // If cache is fresh, states are already initialized or we can refresh them from cache silently
        if (isFresh && globalWeightCache.cachedData) {
          const cProfile = globalWeightCache.cachedData.userProfile;
          const cLogs = globalWeightCache.cachedData.logs;
          setLogs(cLogs || []);
          setUserProfile(cProfile || null);
          setCurrentWeight(
            cLogs?.length > 0
              ? Number(cLogs[0].weight)
              : cProfile?.weight || null,
          );
          setGoalWeight(cProfile?.target_weight || null);
          return;
        }

        if (globalWeightCache.isFetching) return;
        globalWeightCache.isFetching = true;

        try {
          const [
            { data: profile, error: profileError },
            { data: logsData, error: logsError },
          ] = await Promise.all([
            supabase
              .from("user_profile")
              .select("weight, target_weight, weight_unit")
              .eq("id", realUserId)
              .single(),
            supabase
              .from("weight_logs")
              .select("*")
              .eq("user_id", realUserId)
              .order("date", { ascending: false }),
          ]);

          if (!profileError && profile) {
            setUserProfile(profile);
            setGoalWeight(profile.target_weight || null);
            setOnboardingData((prev) => ({
              ...prev,
              weight: profile.weight || prev.weight,
              target_weight: profile.target_weight || prev.target_weight,
              selectedWeightUnit:
                profile.weight_unit || prev.selectedWeightUnit || "kg",
            }));
          }

          if (!logsError && logsData) {
            setLogs(logsData);
          }

          // Update current weight state
          let latestWeight = 0;
          if (logsData && logsData.length > 0) {
            latestWeight = Number(logsData[0].weight);
          } else if (profile?.weight) {
            latestWeight = Number(profile.weight);
          } else if (onboardingData?.weight) {
            latestWeight = Number(onboardingData.weight);
          }

          if (latestWeight > 0) setCurrentWeight(latestWeight);

          globalWeightCache.cachedData = {
            logs: logsData || [],
            userProfile: profile || null,
          };
          globalWeightCache.lastFetchTime = Date.now();
        } catch (error) {
          console.error("WeightTracker fetch error:", error);
        } finally {
          globalWeightCache.isFetching = false;
        }
      };
      load();
    }, [realUserId, refreshing, onboardingData?.weight, setOnboardingData]),
  );

  // Refresh after adding new weight
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setRefreshing((r) => !r); // triggers data refetch
    });
    return unsubscribe;
  }, [navigation]);

  // Weight Logic matching Dashboard display
  const weightUnit =
    userProfile?.weight_unit || onboardingData?.selectedWeightUnit || "kg";

  // Display value for current weight (with unit conversion if necessary)
  const displayWeight =
    currentWeight != null
      ? weightUnit === "lbs"
        ? Number((currentWeight * 2.20462).toFixed(1))
        : currentWeight
      : null;
  // Weekly change calculation: compare current to log from ~7 days ago
  let weeklyChange = 0;
  if (currentWeight && logs.length > 1) {
    // Find log closest to 7 days ago
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    let historicalLog = logs[logs.length - 1]; // Fallback to oldest log
    let minDiff = Infinity;

    // Skip current log (index 0) to find a past weight
    for (let i = 1; i < logs.length; i++) {
      const diff = Math.abs(new Date(logs[i].date) - weekAgo);
      if (diff < minDiff) {
        minDiff = diff;
        historicalLog = logs[i];
      }
    }

    const currentVal =
      weightUnit === "lbs" ? currentWeight * 2.20462 : currentWeight;
    const pastVal =
      weightUnit === "lbs"
        ? Number(historicalLog.weight) * 2.20462
        : Number(historicalLog.weight);
    weeklyChange = Number((currentVal - pastVal).toFixed(1));
  } else if (currentWeight && onboardingData?.weight) {
    // If only 1 log, compare with original onboarding weight
    const currentVal =
      weightUnit === "lbs" ? currentWeight * 2.20462 : currentWeight;
    const pastVal =
      weightUnit === "lbs"
        ? Number(onboardingData.weight) * 2.20462
        : Number(onboardingData.weight);
    weeklyChange = Number((currentVal - pastVal).toFixed(1));
  }

  // Chart data and configuration
  const screenWidth = Dimensions.get("window").width - 32;

  // Helper function to get week number in month
  const getWeekOfMonth = (date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const weekNum = Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);
    return weekNum;
  };

  // Generate current month's weekly data
  const generateWeeklyData = () => {
    const today = new Date();
    const weeks = [];
    const dataPoints = [];

    // Use current weight as the baseline
    const baseWeight = currentWeight || 0;

    // Get current month info
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthName = today.toLocaleDateString(undefined, { month: "short" });

    // Calculate number of weeks in current month (usually 4-5 weeks)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const weeksInMonth = getWeekOfMonth(lastDayOfMonth);

    // Get current week number
    const currentWeekNum = getWeekOfMonth(today);

    // Generate data for each week in the current month
    for (let weekNum = 1; weekNum <= weeksInMonth; weekNum++) {
      // Find first day of this week in the month
      let weekDate = null;
      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(currentYear, currentMonth, day);
        if (getWeekOfMonth(date) === weekNum) {
          weekDate = date;
          break;
        }
      }

      if (weekDate) {
        // Find if there's a weight log for this week
        // Use a simpler approach: check if any log falls within this week
        const weekStart = new Date(weekDate);
        weekStart.setDate(weekDate.getDate() - weekDate.getDay()); // Start of week (Sunday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

        // Find log in this week
        const logInWeek = logs.find((log) => {
          const logDate = new Date(log.date);
          // Set time to start of day for accurate comparison
          logDate.setHours(0, 0, 0, 0);
          const weekStartCopy = new Date(weekStart);
          weekStartCopy.setHours(0, 0, 0, 0);
          const weekEndCopy = new Date(weekEnd);
          weekEndCopy.setHours(23, 59, 59, 999);

          return logDate >= weekStartCopy && logDate <= weekEndCopy;
        });

        let weightValue;
        if (logInWeek) {
          // Use the logged weight for this week
          const weight = Number(logInWeek.weight);
          weightValue =
            weightUnit === "lbs"
              ? Number((weight * 2.20462).toFixed(1))
              : weight;
        } else {
          // For weeks without data, show 0
          weightValue = 0;
        }

        // Add month name only for the first week, then just week numbers
        if (weekNum === 1) {
          weeks.push(`${monthName} W${weekNum}`);
        } else {
          weeks.push(`W${weekNum}`);
        }
        dataPoints.push(weightValue);
      }
    }

    return { weeks, dataPoints };
  };

  // Get weight entries for chart
  let chartWeightData = [];
  let chartLabels = [];

  if (logs.length > 0 || currentWeight > 0) {
    const { weeks, dataPoints } = generateWeeklyData();
    chartLabels = weeks;
    chartWeightData = dataPoints;
  } else {
    // No data at all - show empty chart
    chartWeightData = [0];
    chartLabels = [""];
  }

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        data: chartWeightData.length > 0 ? chartWeightData : [0],
        color: (opacity = 1) => `rgba(31, 78, 74, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: palette.card,
    backgroundGradientFrom: palette.card,
    backgroundGradientTo: palette.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(31, 78, 74, ${opacity})`,
    labelColor: (opacity = 1) =>
      isDark
        ? `rgba(190, 217, 211, ${opacity})`
        : `rgba(91, 120, 115, ${opacity})`,
    propsForDots: { r: "4", strokeWidth: "2", stroke: palette.primary },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: palette.border,
      strokeWidth: 1,
    },
  };

  // Delete log handler
  const handleDeleteLog = async (logId) => {
    RNAlert.alert(
      "Delete Entry",
      "Are you sure you want to delete this weight entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("weight_logs")
              .delete()
              .eq("id", logId);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              setRefreshing((r) => !r);
            }
          },
        },
      ],
    );
  };

  const changeIsPositive = weeklyChange < 0; // losing weight reads as a positive trend

  const renderHeader = () => (
    <>
      <Text style={styles.subheader}>
        See how far you&apos;ve come, at your pace.
      </Text>

      {/* Current Weight Card */}
      <View style={styles.summaryShell}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Live tracking</Text>
            <Text style={styles.cardTitle}>Current Weight</Text>
          </View>
          <View style={styles.dateChip}>
            <Ionicons name="body-outline" size={15} color={palette.primary} />
            <Text style={styles.dateChipText}>{weightUnit.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.weightDisplay}>
          <Text style={styles.weightValue}>
            {displayWeight != null ? Number(displayWeight).toFixed(1) : "--"}
          </Text>
          <Text style={styles.weightUnit}>{weightUnit}</Text>
        </View>

        <View
          style={[
            styles.changeChip,
            {
              backgroundColor:
                weeklyChange === 0
                  ? palette.cardSecondary
                  : changeIsPositive
                    ? palette.positiveSoft
                    : palette.destructiveSoft,
            },
          ]}
        >
          <Ionicons
            name={
              weeklyChange === 0
                ? "remove-outline"
                : changeIsPositive
                  ? "trending-down-outline"
                  : "trending-up-outline"
            }
            size={15}
            color={
              weeklyChange === 0
                ? palette.textSecondary
                : changeIsPositive
                  ? palette.positive
                  : palette.destructive
            }
          />
          <Text
            style={[
              styles.changeChipText,
              {
                color:
                  weeklyChange === 0
                    ? palette.textSecondary
                    : changeIsPositive
                      ? palette.positive
                      : palette.destructive,
              },
            ]}
          >
            {weeklyChange === 0
              ? "No change"
              : `${Math.abs(weeklyChange)} ${weightUnit} ${weeklyChange > 0 ? "gained" : "lost"}`}{" "}
            since last week
          </Text>
        </View>

        {goalWeight ? (
          <View style={styles.milestoneRow}>
            <View style={styles.milestoneChip}>
              <Text style={styles.milestoneValue}>
                {Number(goalWeight).toFixed(1)}
              </Text>
              <Text style={styles.milestoneLabel}>Goal {weightUnit}</Text>
            </View>
            <View style={styles.milestoneChip}>
              <Text style={styles.milestoneValue}>{logs.length}</Text>
              <Text style={styles.milestoneLabel}>Entries</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Progress Chart */}
      <View style={styles.chartCard}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Trend</Text>
            <Text style={styles.sectionTitle}>Progress</Text>
          </View>
          <View style={styles.chartFilter}>
            <Text style={styles.chartFilterText}>This Month</Text>
            <Ionicons name="chevron-down" size={16} color={palette.primary} />
          </View>
        </View>
        <View>
          <LineChart
            data={chartData}
            width={screenWidth - 64}
            height={220}
            yAxisSuffix={` ${weightUnit}`}
            chartConfig={chartConfig}
            bezier
            withInnerLines={false}
            withOuterLines={true}
            fromZero={true}
            segments={5}
            style={styles.chartInner}
          />
        </View>
      </View>

      <View style={styles.historyHeaderRow}>
        <Text style={styles.sectionEyebrow}>History</Text>
        <Text style={styles.sectionTitle}>Weight Log</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            style={styles.heroBackBtn}
            onPress={() => navigation.navigate("MainDashboard")}
          >
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Weight Tracker</Text>
          <View style={styles.heroSpacer} />
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id?.toString() || item.date}
        renderItem={({ item }) => (
          <View style={styles.historyItem}>
            <View style={styles.historyTopRow}>
              <View style={styles.historyIconShell}>
                <Text style={styles.historyEmoji}>{item.emoji || "😊"}</Text>
              </View>

              <View style={styles.historyTextWrap}>
                <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
                {item.note ? (
                  <Text style={styles.historyNote} numberOfLines={1}>
                    {item.note}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.historyWeight}>
                {Number(item.weight).toFixed(1)} {weightUnit}
              </Text>

              <TouchableOpacity
                onPress={() => handleDeleteLog(item.id)}
                style={styles.historyDeleteBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color={palette.destructive}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyStateCard}>
            <Ionicons
              name="analytics-outline"
              size={26}
              color={palette.primary}
            />
            <Text style={styles.emptyStateTitle}>No weight entries yet</Text>
            <Text style={styles.emptyStateText}>
              Tap &quot;Add New Weight&quot; below to log your first entry and
              start tracking your progress.
            </Text>
          </View>
        }
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.scrollContent}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate("AddWeightScreen")}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.addBtnText}>Add New Weight</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },

    // Header
    heroCard: {
      marginHorizontal: 18,
      marginTop: 12,
      marginBottom: 6,
      paddingVertical: 14,
      paddingHorizontal: 8,
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

    scrollContent: {
      paddingHorizontal: 18,
      paddingBottom: 120,
    },

    subheader: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginBottom: 16,
      marginTop: 2,
    },

    // Current weight card
    summaryShell: {
      backgroundColor: palette.card,
      borderRadius: 30,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 5,
    },
    summaryTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 22,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    dateChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    dateChipText: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
      fontSize: 13,
      marginLeft: 6,
    },
    weightDisplay: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: 14,
    },
    weightValue: {
      fontSize: 44,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    weightUnit: {
      fontSize: 18,
      fontFamily: "Manrope-Medium",
      color: palette.textSecondary,
      marginLeft: 6,
    },
    changeChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    changeChipText: {
      marginLeft: 6,
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
    },

    milestoneRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    milestoneChip: {
      flex: 1,
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    milestoneValue: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      marginBottom: 4,
    },
    milestoneLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    // Chart card
    chartCard: {
      backgroundColor: palette.card,
      borderRadius: 30,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 4,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },
    chartFilter: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: palette.border,
    },
    chartFilterText: {
      fontSize: 13,
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
      marginRight: 4,
    },
    chartInner: {
      alignSelf: "center",
      borderRadius: 20,
    },

    // History
    historyHeaderRow: {
      marginBottom: 12,
      marginTop: 2,
    },
    historyItem: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },
    historyTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    historyIconShell: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      marginRight: 12,
    },
    historyEmoji: { fontSize: 20 },
    historyTextWrap: {
      flex: 1,
      paddingRight: 8,
    },
    historyDate: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 2,
    },
    historyNote: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },
    historyWeight: {
      fontSize: 15,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      marginRight: 10,
    },
    historyDeleteBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },

    emptyStateCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 22,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      marginBottom: 12,
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

    // Add button
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.primary,
      borderRadius: 26,
      paddingVertical: 16,
      marginHorizontal: 18,
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 20,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    addBtnText: {
      color: "#FFFFFF",
      fontFamily: "Lexend-Bold",
      fontSize: 16,
      marginLeft: 8,
    },
  });

// Export cache for external access
export { globalWeightCache };

// Wrap with React.memo to prevent unnecessary re-renders (Instagram pattern)
export default React.memo(WeightTrackerScreen);
