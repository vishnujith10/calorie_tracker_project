import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
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
    BackHandler,
    Dimensions,
    Image,
    Platform,
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
import { createFoodLog, deleteFoodLog, getFoodLogs } from "../utils/api";
import {
    getHomeScreenCache,
    invalidateHomeScreenCache,
    updateHomeScreenCacheOptimistic,
} from "../utils/cacheManager";
import { getTodayCaloriesBurned } from "../utils/calorieCalculator";
import {
    evaluateYesterdayStreak,
    getFoodStreak,
    getStreakRiskCalories,
    recalculateFoodStreak,
    updateFoodStreak,
} from "../utils/streakService";
import useTodaySteps from "../utils/useTodaySteps";
import { isInsightEnabled, isInsightEnabledSync } from "../utils/settingsHelper";

const screenWidth = Dimensions.get("window").width;
const globalHomeCache = getHomeScreenCache();

let streakCache;
try {
  const mainDashboardModule = require("./MainDashboardScreen");
  streakCache = mainDashboardModule.streakCache || {
    lastFetch: 0,
    cachedStreak: null,
    CACHE_DURATION: 30000,
  };
} catch {
  streakCache = {
    lastFetch: 0,
    cachedStreak: null,
    CACHE_DURATION: 30000,
  };
}

export const userNameCache = {
  lastFetch: 0,
  cachedName: null,
  CACHE_DURATION: 300000,
};

export {
    invalidateHomeScreenCache,
    updateHomeScreenCacheOptimistic as updateHomeScreenCache
};

const HomeHeader = React.memo(
  ({ userName, selectedDate, navigation, styles, palette, themeKey }) => {
    return (
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Meals dashboard</Text>
            <Text style={styles.greeting}>Hello, {userName}</Text>
            <Text style={styles.date}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={() => navigation.navigate("ProgressScreen")}
            >
              <Ionicons
                name="stats-chart-outline"
                size={20}
                color={palette.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={() => navigation.navigate("Exercise")}
            >
              <Ionicons
                name="barbell-outline"
                size={20}
                color={palette.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.userName === nextProps.userName &&
      prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime() &&
      prevProps.themeKey === nextProps.themeKey
    );
  },
);
HomeHeader.displayName = "HomeHeader";

const StreakBadge = React.memo(
  ({ calorieStreak, graceActive, maxStreak, styles, themeKey }) => {
    const emoji = graceActive ? '❄️' : '🔥';
    const label =
      calorieStreak > 0
        ? `${calorieStreak}-day streak`
        : 'Start your streak!';
    return (
      <View style={[
        styles.streakBadge,
        graceActive && styles.streakBadgeGrace,
      ]}>
        <Text style={styles.streakEmoji}>{emoji}</Text>
        <Text style={styles.streakText}>{label}</Text>
        {maxStreak > 0 && (
          <Text style={styles.streakMaxText}> · Best {maxStreak}</Text>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => (
    prevProps.calorieStreak === nextProps.calorieStreak &&
    prevProps.graceActive === nextProps.graceActive &&
    prevProps.maxStreak === nextProps.maxStreak &&
    prevProps.themeKey === nextProps.themeKey
  ),
);
StreakBadge.displayName = 'StreakBadge';

const FooterBar = ({
  navigation,
  activeTab,
  footerStyles,
  palette,
  themeKey,
}) => {
  const insets = useSafeAreaInsets();
  const tabs = [
    {
      key: "Home",
      label: "Home",
      icon: (
        <Ionicons
          name="home-outline"
          size={22}
          color={activeTab === "Home" ? palette.primary : palette.navInactive}
        />
      ),
      route: "MainDashboard",
    },
    {
      key: "Meals",
      label: "Meals",
      icon: (
        <Ionicons
          name="restaurant-outline"
          size={22}
          color={activeTab === "Meals" ? palette.primary : palette.navInactive}
        />
      ),
      route: "Home",
    },
    {
      key: "Workout",
      label: "Saved",
      icon: (
        <Ionicons
          name="fast-food-outline"
          size={22}
          color={
            activeTab === "Workout" ? palette.primary : palette.navInactive
          }
        />
      ),
      route: "SavedMealsScreen",
    },
    {
      key: "Profile",
      label: "Profile",
      icon: (
        <Ionicons
          name="person-outline"
          size={22}
          color={
            activeTab === "Profile" ? palette.primary : palette.navInactive
          }
        />
      ),
      route: "Profile",
    },
  ];

  return (
    <View
      style={[
        footerStyles.container,
        { bottom: insets.bottom >= 20 ? insets.bottom + 12 : 14 },
      ]}
    >
      <View style={footerStyles.ovalFooter}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              footerStyles.tab,
              tab.key === activeTab && footerStyles.activeTab,
            ]}
            onPress={() => {
              if (tab.key === activeTab) return;
              navigation.navigate(tab.route);
            }}
            activeOpacity={0.8}
          >
            <View
              style={
                tab.key === activeTab
                  ? footerStyles.activeIconShell
                  : footerStyles.iconShell
              }
            >
              {React.cloneElement(tab.icon, {
                color:
                  tab.key === activeTab ? palette.primary : palette.navInactive,
              })}
            </View>
            <Text
              style={[
                footerStyles.label,
                tab.key === activeTab && footerStyles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

function getCurrentWeekDates() {
  const today = new Date();
  const week = [];
  const monday = new Date(today);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysToMonday);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push({
      date: d,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: d.getDate(),
      isToday:
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear(),
    });
  }
  return week;
}

// Generate context-aware, supportive AI calorie insights for the bottom of HomeScreen
function generateCalorieInsights({
  foodLogs = [],
  todayLogs = [],
  calorie_goal = 2000,
  currentCalories = 0,
  macro_targets = { protein_g: 150 },
}) {
  const insights = [];
  const target = calorie_goal > 0 ? calorie_goal : 2000;
  const currentHour = new Date().getHours();
  const todayProgress = currentCalories / target;

  // 1. Group past food logs by calendar date (YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);
  const pastDayTotals = {};

  foodLogs.forEach((log) => {
    if (!log.created_at) return;
    const dateKey = new Date(log.created_at).toISOString().slice(0, 10);
    if (dateKey === todayStr) return; // skip today
    pastDayTotals[dateKey] =
      (pastDayTotals[dateKey] || 0) + (Number(log.calories) || 0);
  });

  // Get past days in reverse chronological order
  const todayDate = new Date();
  const pastDays = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    if (pastDayTotals[dStr] !== undefined) {
      pastDays.push({ date: dStr, calories: pastDayTotals[dStr] });
    }
  }

  // 2. Multi-day consistency & goal deviation checks
  if (pastDays.length >= 2) {
    let consecutiveNear = 0;
    let consecutiveUnder = 0;
    let consecutiveOver = 0;

    for (const day of pastDays) {
      const ratio = day.calories / target;
      if (ratio >= 0.88 && ratio <= 1.12) consecutiveNear++;
      else break;
    }

    for (const day of pastDays) {
      const ratio = day.calories / target;
      if (ratio < 0.72) consecutiveUnder++;
      else break;
    }

    for (const day of pastDays) {
      const ratio = day.calories / target;
      if (ratio > 1.18) consecutiveOver++;
      else break;
    }

    if (consecutiveNear >= 2) {
      insights.push({
        title: "Consistency Champion",
        icon: "🎯",
        message: `You've landed inside your target calorie zone for ${consecutiveNear} logged days in a row! Maintaining this level of nutritional consistency is the single most effective driver of long-term body recomposition.`,
        action: "Keep riding this fantastic daily rhythm!",
        priority: "low",
      });
    } else if (consecutiveUnder >= 2) {
      insights.push({
        title: "Fueling Check-in",
        icon: "⚡",
        message: `Your intake has landed well below your ${target} kcal target for ${consecutiveUnder} logged days. Consistently under-fueling can slow your metabolic rate and sap your daily energy.`,
        action:
          "Add wholesome calorie-dense foods (nuts, avocado, or a shake) to meet your minimum fuel needs.",
        priority: "medium",
      });
    } else if (consecutiveOver >= 2) {
      insights.push({
        title: "Mindful Reset",
        icon: "🧭",
        message: `Calories have landed slightly above target over recent days. Fitness progress is built on multi-week trends, not single days. Small mindful swaps make staying on track feel effortless.`,
        action:
          "Focus on high-volume greens, lean protein, and drinking water before meals today.",
        priority: "medium",
      });
    }
  }

  // 3. Today's pacing: Slow Intake vs. Fast Intake vs. Heavy Single Spike
  if (currentHour >= 16 && todayProgress < 0.3 && todayLogs.length > 0) {
    // Slow intake / backloading
    insights.push({
      title: "Slow Intake Notice",
      icon: "⏳",
      message: `You've only consumed ${Math.round(todayProgress * 100)}% of your calories (${currentCalories} kcal) by late afternoon. Backloading most calories into a late dinner often leads to digestive discomfort and sleep disruption.`,
      action:
        "Have a balanced snack now with protein and complex carbs to stabilize energy.",
      priority: "medium",
    });
  } else if (currentHour <= 14 && todayProgress >= 0.75) {
    // Irregular fast intake / early frontloading
    insights.push({
      title: "Pacing Your Energy",
      icon: "📈",
      message: `You've used ${Math.round(todayProgress * 100)}% of your daily calorie budget (${currentCalories} kcal) early today. Don't worry—you can still enjoy a satisfying evening without going over.`,
      action:
        "Focus on high-volume, lower-calorie choices like leafy greens, roasted veggies, and lean protein for dinner.",
      priority: "medium",
    });
  } else if (
    todayLogs.length >= 2 &&
    todayLogs.some((m) => Number(m.calories) >= target * 0.65)
  ) {
    // Irregular fast spike in a single meal
    insights.push({
      title: "Meal Concentration",
      icon: "⚖️",
      message:
        "A major portion of today's calories was concentrated in one dense meal. Distributing your calories more evenly across 3–4 meals maintains steady blood glucose and prevents energy crashes.",
      action: "Keep your remaining meals light, hydrating, and fiber-rich.",
      priority: "low",
    });
  }

  // 4. Macro balance: Protein priority
  const totalProtein = todayLogs.reduce(
    (sum, l) => sum + (Number(l.protein) || 0),
    0,
  );
  const proteinTarget =
    macro_targets?.protein_g || Math.round((target * 0.3) / 4);
  const proteinRatio = totalProtein / (proteinTarget || 1);

  if (proteinRatio >= 0.85) {
    insights.push({
      title: "Optimal Protein Intake",
      icon: "💪",
      message: `Outstanding protein tracking today (${Math.round(totalProtein)}g)! Prioritizing protein maintains lean muscle mass, elevates your metabolic rate, and keeps cravings at bay.`,
      action: "Keep up this high-quality macronutrient balance!",
      priority: "low",
    });
  } else if (currentHour >= 18 && proteinRatio < 0.45 && todayLogs.length > 0) {
    insights.push({
      title: "Protein Boost Window",
      icon: "🥩",
      message: `Your protein intake is currently light at ${Math.round(totalProtein)}g out of your ${proteinTarget}g target. Hitting your protein threshold tonight will accelerate overnight muscular repair.`,
      action:
        "Include a quality protein source in your dinner (eggs, chicken, fish, tofu, or lentils).",
      priority: "low",
    });
  }

  // 5. Daily balanced pacing / motivational mindset fallback
  if (todayProgress >= 0.5 && todayProgress <= 0.9) {
    const remaining = Math.max(0, target - currentCalories);
    insights.push({
      title: "Balanced Daily Pacing",
      icon: "✨",
      message: `You are tracking smoothly at ${currentCalories} of ${target} kcal (${Math.round(todayProgress * 100)}%). You have a comfortable ${remaining} kcal buffer for a mindful, delicious evening.`,
      action: "Savor your remaining meal and stay well hydrated!",
      priority: "low",
    });
  }

  // Guaranteed fallback
  insights.push({
    title: "Nutritional Mindset",
    icon: "🌱",
    message:
      "Energy balance is about consistent daily averages, not robotic perfection. Every wholesome food choice compounds into permanent vitality.",
    action: "Focus on nourishment, listen to your hunger cues, and stay consistent.",
    priority: "low",
  });

  return insights;
}

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const themeKey = isDark ? "dark" : "light";
  const styles = useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  const footerStyles = useMemo(
    () => createFooterStyles(palette, isDark),
    [palette, isDark],
  );
  const quickAddStyles = useMemo(
    () => createQuickAddStyles(palette, isDark),
    [palette, isDark],
  );
  const accentIconColor = palette.secondaryText;
  const selectionBackground = palette.selectedCard;
  const mealImageBackground = palette.cardSecondary;
  const nutritionBackgrounds = {
    protein: palette.nutritionSoft,
    carbs: palette.nutritionSoft,
    fat: palette.nutritionSoft,
    fiber: palette.nutritionSoft,
  };

  const [weekDates, setWeekDates] = useState(getCurrentWeekDates());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [user, setUser] = useState({ id: null });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [foodLogs, setFoodLogs] = useState(
    () => globalHomeCache.cachedData?.foodLogs || [],
  );
  const [totals, setTotals] = useState(
    () =>
      globalHomeCache.cachedData?.totals || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      },
  );
  const [userName, setUserName] = useState("User");
  const [recentMeals, setRecentMeals] = useState(
    () => globalHomeCache.cachedData?.recentMeals || [],
  );
  const [calorieInsights, setCalorieInsights] = useState(
    () => globalHomeCache.cachedData?.calorieInsights || [],
  );
  const [activeCalorieInsightIndex, setActiveCalorieInsightIndex] = useState(0);
  const [calorieInsightsEnabled, setCalorieInsightsEnabled] = useState(() =>
    isInsightEnabledSync("calories"),
  );
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [selectedMeals, setSelectedMeals] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [calorieStreak, setCalorieStreak] = useState(() => {
    const now = Date.now();
    if (
      streakCache.cachedStreak !== null &&
      now - streakCache.lastFetch < streakCache.CACHE_DURATION
    ) {
      return streakCache.cachedStreak?.streak ?? streakCache.cachedStreak ?? 0;
    }
    return 0;
  });
  const [graceActive, setGraceActive] = useState(false);
  const [maxStreak, setMaxStreak] = useState(0);

  const calorieStreakRef = React.useRef(calorieStreak);
  React.useEffect(() => {
    calorieStreakRef.current = calorieStreak;
  }, [calorieStreak]);

  // Helper: update streak state from a getFoodStreak result object
  const applyStreakResult = React.useCallback((result) => {
    if (!result) return;
    // result can be { streak, maxStreak, graceActive } or a plain number (legacy)
    const streakVal = typeof result === 'object' ? (result.streak ?? 0) : result;
    const maxVal = typeof result === 'object' ? (result.maxStreak ?? 0) : 0;
    const grace = typeof result === 'object' ? (result.graceActive ?? false) : false;
    streakCache.cachedStreak = result;
    streakCache.lastFetch = Date.now();
    if (streakVal !== calorieStreakRef.current) {
      calorieStreakRef.current = streakVal;
      setCalorieStreak(streakVal);
    }
    setGraceActive(grace);
    setMaxStreak(maxVal);
  }, []);

  const [totalCaloriesBurned, setTotalCaloriesBurned] = useState(0);
  const [calorieBreakdown, setCalorieBreakdown] = useState({
    steps: 0,
    workouts: 0,
    cardio: 0,
  });
  const { stepsToday, calories: stepCalories } = useTodaySteps();
  const { onboardingData } = useContext(OnboardingContext);

  function calculateBMR(gender, weight_kg, height_cm, age) {
    return gender === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
  }
  function calculateTDEE(bmr, activity_level) {
    const multiplier = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
      extra: 1.9,
    };
    return bmr * (multiplier[activity_level] || 1.2);
  }
  function adjustForGoal(tdee, goal) {
    switch (goal) {
      case "lose":
        return tdee * 0.85;
      case "gain":
        return tdee * 1.1;
      default:
        return tdee;
    }
  }
  function getMacroTargets(calories) {
    return {
      protein_g: Math.round((calories * 0.3) / 4),
      fat_g: Math.round((calories * 0.3) / 9),
      carbs_g: Math.round((calories * 0.4) / 4),
    };
  }
  function getMinCalories(gender) {
    return gender === "male" ? 1500 : 1200;
  }

  const age = Number(onboardingData?.age) || 25;
  const gender = (onboardingData?.gender || "female").toLowerCase();
  const weight_kg = Number(onboardingData?.weight) || 60;
  const height_cm = Number(onboardingData?.height) || 165;
  const activity_level = (
    onboardingData?.daily_activity_level || "moderate"
  ).toLowerCase();
  let goal_type = (onboardingData?.goal_focus || "maintain").toLowerCase();
  if (goal_type.includes("lose")) goal_type = "lose";
  else if (goal_type.includes("gain")) goal_type = "gain";
  else goal_type = "maintain";

  const bmr = calculateBMR(gender, weight_kg, height_cm, age);
  const tdee = calculateTDEE(bmr, activity_level);
  let calorie_goal = adjustForGoal(tdee, goal_type);
  const minCalories = getMinCalories(gender);
  if (calorie_goal < minCalories) calorie_goal = minCalories;
  calorie_goal = Math.round(calorie_goal);
  const macro_targets = getMacroTargets(calorie_goal);
  const dailyGoal = calorie_goal;

  useEffect(() => {
    const fetchUserAndGoal = async () => {
      if (onboardingData.daily_calorie_goal) {
        calorie_goal = onboardingData.daily_calorie_goal;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUser({ id: session.user.id });

        const now = Date.now();
        const timeSinceLastFetch = now - userNameCache.lastFetch;

        if (
          userNameCache.cachedName &&
          timeSinceLastFetch < userNameCache.CACHE_DURATION
        ) {
          setUserName(userNameCache.cachedName);
        } else {
          const { data: profileData } = await supabase
            .from("user_profile")
            .select("name")
            .eq("id", session.user.id)
            .single();

          if (profileData?.name) {
            userNameCache.cachedName = profileData.name;
            userNameCache.lastFetch = now;
            setUserName(profileData.name);
          }
        }
      }
    };
    fetchUserAndGoal();
  }, [onboardingData]);

  useEffect(() => {
    setWeekDates(getCurrentWeekDates());
  }, []);

  useEffect(() => {
    if (!user?.id || !selectedDate) return;

    const dateKey = selectedDate.toISOString().split("T")[0];
    const now = Date.now();
    const timeSinceLastFetch = now - globalHomeCache.lastFetchTime;
    const isFresh = timeSinceLastFetch < globalHomeCache.CACHE_DURATION;
    const cachedDataForDate =
      globalHomeCache.cachedData &&
      globalHomeCache.cachedData.dateKey === dateKey;

    if (cachedDataForDate && isFresh) {
      setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
      setTotals(
        globalHomeCache.cachedData.totals || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
      );
      setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
      if (globalHomeCache.cachedData.calorieInsights) {
        setCalorieInsights(globalHomeCache.cachedData.calorieInsights);
      }
      return;
    }

    if (
      globalHomeCache.cachedData &&
      globalHomeCache.cachedData.dateKey !== dateKey
    ) {
      globalHomeCache.cachedData = null;
      globalHomeCache.lastFetchTime = 0;
    }

    fetchFoodLogs(selectedDate);
  }, [selectedDate, user?.id]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("MainDashboard");
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => backHandler.remove();
    }, [navigation]),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id || !selectedDate) return;

      const dateKey = selectedDate.toISOString().split("T")[0];
      const now = Date.now();
      const timeSinceLastFetch = now - globalHomeCache.lastFetchTime;
      const isStale = timeSinceLastFetch > globalHomeCache.STALE_TIME;
      const isFresh = timeSinceLastFetch < globalHomeCache.CACHE_DURATION;
      const cachedDataForDate =
        globalHomeCache.cachedData &&
        globalHomeCache.cachedData.dateKey === dateKey;

      if (
        globalHomeCache.cachedData &&
        globalHomeCache.cachedData.dateKey !== dateKey
      ) {
        globalHomeCache.cachedData = null;
        globalHomeCache.lastFetchTime = 0;
      }

      if (cachedDataForDate && isFresh) {
        setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
        setTotals(
          globalHomeCache.cachedData.totals || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          },
        );
        setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
        if (globalHomeCache.cachedData.calorieInsights) {
          setCalorieInsights(globalHomeCache.cachedData.calorieInsights);
        }
        globalHomeCache.cacheHits++;

        fetchCaloriesBurned();
        const loadStreak = async () => {
          try {
            const streakNow = Date.now();
            const streakTimeSinceLastFetch = streakNow - streakCache.lastFetch;

            if (
              streakCache.cachedStreak !== null &&
              streakTimeSinceLastFetch < streakCache.CACHE_DURATION
            ) {
              applyStreakResult(streakCache.cachedStreak);
              return;
            }

            // Evaluate yesterday lazily (idempotent — skips if already done today)
            await evaluateYesterdayStreak(user.id, dailyGoal, goal_type);
            const result = await getFoodStreak(user.id);
            applyStreakResult(result);
          } catch (error) {
            console.error('Error loading streak:', error);
          }
        };
        loadStreak();
        return;
      }

      if (cachedDataForDate && isStale && !isFresh) {
        setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
        setTotals(
          globalHomeCache.cachedData.totals || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          },
        );
        setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
        if (globalHomeCache.cachedData.calorieInsights) {
          setCalorieInsights(globalHomeCache.cachedData.calorieInsights);
        }
        globalHomeCache.cacheHits++;
      }

      if (globalHomeCache.isFetching) return;

      fetchFoodLogs(selectedDate);
      fetchCaloriesBurned();

      const loadStreak = async () => {
        try {
          const streakNow = Date.now();
          const streakTimeSinceLastFetch = streakNow - streakCache.lastFetch;

          if (
            streakCache.cachedStreak !== null &&
            streakTimeSinceLastFetch < streakCache.CACHE_DURATION
          ) {
            applyStreakResult(streakCache.cachedStreak);
            return;
          }

          // Evaluate yesterday lazily (idempotent — skips if already done today)
          await evaluateYesterdayStreak(user.id, dailyGoal, goal_type);
          const result = await getFoodStreak(user.id);
          applyStreakResult(result);
        } catch (error) {
          console.error('Error loading streak:', error);
        }
      };
      loadStreak();

      isInsightEnabled("calories").then((enabled) => {
        setCalorieInsightsEnabled(enabled);
      });
    }, [user?.id, selectedDate]),
  );

  const fetchCaloriesBurned = async () => {
    if (!user?.id) return;

    try {
      const userProfile = {
        weight: weight_kg,
        height: height_cm,
        age: age,
        gender: gender,
      };

      const caloriesData = await getTodayCaloriesBurned(
        user.id,
        userProfile,
        selectedDate,
      );
      setTotalCaloriesBurned(caloriesData.total);
      setCalorieBreakdown({
        steps: caloriesData.steps,
        workouts: caloriesData.workouts,
        cardio: caloriesData.cardio,
      });
    } catch (error) {
      console.error("Error fetching calories burned:", error);
    }
  };

  const fetchFoodLogs = async (date) => {
    const dateKey = date.toISOString().split("T")[0];

    if (
      globalHomeCache.cachedData &&
      globalHomeCache.cachedData.dateKey !== dateKey
    ) {
      globalHomeCache.cachedData = null;
      globalHomeCache.lastFetchTime = 0;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - globalHomeCache.lastFetchTime;
    const isStale = timeSinceLastFetch > globalHomeCache.STALE_TIME;
    const isFresh = timeSinceLastFetch < globalHomeCache.CACHE_DURATION;
    const cachedDataForDate =
      globalHomeCache.cachedData &&
      globalHomeCache.cachedData.dateKey === dateKey;

    if (cachedDataForDate && isFresh) {
      setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
      setTotals(
        globalHomeCache.cachedData.totals || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
      );
      setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
      if (globalHomeCache.cachedData.calorieInsights) {
        setCalorieInsights(globalHomeCache.cachedData.calorieInsights);
      }
      globalHomeCache.cacheHits++;
      return;
    }

    if (cachedDataForDate && isStale && !isFresh) {
      setFoodLogs(globalHomeCache.cachedData.foodLogs || []);
      setTotals(
        globalHomeCache.cachedData.totals || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        },
      );
      setRecentMeals(globalHomeCache.cachedData.recentMeals || []);
      if (globalHomeCache.cachedData.calorieInsights) {
        setCalorieInsights(globalHomeCache.cachedData.calorieInsights);
      }
      globalHomeCache.cacheHits++;
    }

    if (globalHomeCache.isFetching) return;

    globalHomeCache.isFetching = true;
    globalHomeCache.cacheMisses++;

    try {
      const logs = await getFoodLogs(user.id);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const filteredLogs = logs.filter((log) => {
        const logDate = new Date(log.created_at);
        return logDate >= startOfDay && logDate <= endOfDay;
      });

      setFoodLogs(filteredLogs);

      const newTotals = filteredLogs.reduce(
        (acc, log) => {
          acc.calories += log.calories || 0;
          acc.protein += log.protein || 0;
          acc.carbs += log.carbs || 0;
          acc.fat += log.fat || 0;
          acc.fiber += log.fiber || 0;
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      );
      setTotals(newTotals);

      const recent = filteredLogs.slice(-5).reverse();
      const withUrls = await Promise.all(
        recent.map(async (meal) => {
          if (meal.photo_url && !meal.photo_url.startsWith("http") && !meal.photo_url.startsWith("file://")) {
            try {
              const { data } = await supabase.storage
                .from("food-photos")
                .createSignedUrl(meal.photo_url, 60 * 60);
              return { ...meal, photo_url: data?.signedUrl || meal.photo_url };
            } catch {
              return meal;
            }
          }
          return meal;
        }),
      );
      setRecentMeals(withUrls);

      const generatedInsights = generateCalorieInsights({
        foodLogs: logs || [],
        todayLogs: filteredLogs || [],
        calorie_goal: onboardingData?.daily_calorie_goal || dailyGoal || 2000,
        currentCalories: newTotals.calories,
        macro_targets,
      });
      setCalorieInsights(generatedInsights);

      globalHomeCache.cachedData = {
        foodLogs: filteredLogs,
        totals: newTotals,
        recentMeals: withUrls,
        calorieInsights: generatedInsights,
        dateKey: dateKey,
      };

      globalHomeCache.lastFetchTime = Date.now();

      if (user.id && filteredLogs.length > 0) {
        await updateFoodStreak(user.id, dailyGoal, goal_type);
        const result = await getFoodStreak(user.id);
        applyStreakResult(result);
      } else if (user.id) {
        const result = await getFoodStreak(user.id);
        applyStreakResult(result);
      }
    } catch (error) {
      console.error("Error fetching food logs:", error);
    } finally {
      globalHomeCache.isFetching = false;
    }
  };

  const calculateTotals = (logs) => {
    const newTotals = logs.reduce(
      (acc, log) => {
        acc.calories += log.calories || 0;
        acc.protein += log.protein || 0;
        acc.carbs += log.carbs || 0;
        acc.fat += log.fat || 0;
        acc.fiber += log.fiber || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
    setTotals(newTotals);
  };

  const launchImagePicker = async (pickerFunction, mealType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required.");
      return;
    }
    const result = await pickerFunction({
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      navigation.navigate("PhotoCalorieScreen", {
        photoUri: result.assets[0].uri,
        mealType,
      });
    }
  };

  const showImagePickerOptions = (mealType) => {
    Alert.alert(
      "Log Food with Photo",
      "Choose an option",
      [
        {
          text: "Take a photo",
          onPress: () =>
            launchImagePicker(ImagePicker.launchCameraAsync, mealType),
        },
        {
          text: "Choose from Library",
          onPress: () =>
            launchImagePicker(ImagePicker.launchImageLibraryAsync, mealType),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  };

  const handleLogFood = async (mealType, nutritionData) => {
    if (!nutritionData) return;
    try {
      const logData = {
        meal_type: mealType,
        food_name: nutritionData.food_name,
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat,
        user_id: user.id,
      };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      logData.user_id = session?.user?.id;
      if (!logData.user_id) {
        Alert.alert("You must be logged in to log food.");
        return;
      }
      await createFoodLog(logData);
      fetchFoodLogs(selectedDate);

      Alert.alert(
        "Food Logged! 🍽️",
        "Your meal has been successfully logged.",
        [{ text: "Great!", style: "default" }],
      );
    } catch (error) {
      console.error("Error logging food:", error);
      Alert.alert("Error", "Failed to log food.");
    }
  };

  const openVoiceModal = (mealType) => {
    navigation.navigate("VoiceCalorieScreen", { mealType, selectedDate });
  };

  const toggleMealSelection = (mealId) => {
    if (!mealId) return;
    setSelectedMeals((prevSelected) => {
      const next = new Set(prevSelected);
      if (next.has(mealId)) {
        next.delete(mealId);
      } else {
        next.add(mealId);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      return next;
    });
  };

  const handleMealLongPress = (mealId) => {
    if (!mealId) return;
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMeals(new Set([mealId]));
    } else {
      toggleMealSelection(mealId);
    }
  };

  const handleMealPress = (mealId, index) => {
    if (!mealId) return;
    if (isSelectionMode) {
      toggleMealSelection(mealId);
    } else {
      setExpandedMeal(expandedMeal === index ? null : index);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const selectedIds = Array.from(selectedMeals).filter(
        (id) => typeof id === "string" && !id.startsWith("meal-")
      );
      if (selectedIds.length === 0) {
        setSelectedMeals(new Set());
        setIsSelectionMode(false);
        return;
      }
      await Promise.all(selectedIds.map((id) => deleteFoodLog(id)));

      globalHomeCache.cachedData = null;
      globalHomeCache.lastFetchTime = 0;
      invalidateHomeScreenCache();
      await fetchFoodLogs(selectedDate);

      await recalculateFoodStreak(user.id, dailyGoal, goal_type);
      const updatedResult = await getFoodStreak(user.id);
      applyStreakResult(updatedResult);

      setSelectedMeals(new Set());
      setIsSelectionMode(false);

      Alert.alert("Success", "Selected meals deleted successfully.");
    } catch (e) {
      console.error("Error in handleDeleteSelected:", e);
      Alert.alert("Error", "Failed to delete selected meals.");
    }
  };

  const calorieProgress = dailyGoal > 0 ? totals.calories / dailyGoal : 0;
  const progressChartData = {
    data: [calorieProgress > 1 ? 1 : calorieProgress],
  };

  const calorieBalance = Math.max(0, dailyGoal - totals.calories);
  const balanceSign = calorieBalance > 0 ? "+" : "";
  const balanceDisplay = `${balanceSign}${calorieBalance}`;
  const caloriesBurned = totalCaloriesBurned || 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Math.max(
            110,
            (insets.bottom >= 20 ? insets.bottom + 18 : 18) + 92,
          ),
        }}
      >
        <HomeHeader
          userName={userName}
          selectedDate={selectedDate}
          navigation={navigation}
          styles={styles}
          palette={palette}
          themeKey={themeKey}
        />

        <View style={styles.weekStrip}>
          {weekDates.map((d, i) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateToCheck = new Date(d.date);
            dateToCheck.setHours(0, 0, 0, 0);
            const isFutureDate = dateToCheck > today;

            const isSelected =
              selectedDate.getDate() === d.date.getDate() &&
              selectedDate.getMonth() === d.date.getMonth() &&
              selectedDate.getFullYear() === d.date.getFullYear();

            return (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  if (!isFutureDate) {
                    setSelectedDate(d.date);
                  }
                }}
                style={styles.weekDayWrap}
                disabled={isFutureDate}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.weekDayCard,
                    isSelected && styles.weekDayCardActive,
                    isFutureDate && styles.weekDayCardDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayLabel,
                      isSelected && styles.weekDayLabelActive,
                      isFutureDate && styles.weekDayLabelDisabled,
                    ]}
                  >
                    {d.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.weekDayNumber,
                      isSelected && styles.weekDayNumberActive,
                      isFutureDate && styles.weekDayNumberDisabled,
                    ]}
                  >
                    {d.dayNumber}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryShell}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Daily intake</Text>
              <Text style={styles.cardTitle}>Nutrition Summary</Text>
            </View>

            <View style={styles.dateChip}>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={palette.primary}
              />
              <Text style={styles.dateChipText}>
                {selectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </View>

          <View style={styles.summaryMain}>
            <View style={styles.summaryLeftFull}>
              <Text style={styles.caloriesCount}>
                {totals.calories.toFixed(0)}
              </Text>
              <Text style={styles.caloriesUnit}>
                kcal of {dailyGoal.toFixed(0)}
              </Text>

              <View style={styles.intakeBarWrap}>
                <View style={styles.intakeBarTrack}>
                  <View
                    style={[
                      styles.intakeBarFill,
                      { width: `${Math.min(calorieProgress * 100, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.intakePercentText}>
                  {(calorieProgress * 100).toFixed(0)}% completed
                </Text>
              </View>

              <View style={styles.milestoneRow}>
                <View style={styles.milestoneChip}>
                  <Text style={styles.milestoneValue}>{foodLogs.length}</Text>
                  <Text style={styles.milestoneLabel}>Logs Today</Text>
                </View>

                <View style={styles.milestoneChip}>
                  <Text style={styles.milestoneValue}>{balanceDisplay}</Text>
                  <Text style={styles.milestoneLabel}>Balance</Text>
                </View>

                <View style={styles.milestoneChip}>
                  <Text style={styles.milestoneValue}>{foodLogs.length}</Text>
                  <Text style={styles.milestoneLabel}>Entries</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.summaryBottomRow}>
            <View style={quickAddStyles.quickAddContainer}>
              {showQuickAdd && (
                <View style={quickAddStyles.quickAddPopup}>
                  <TouchableOpacity
                    style={quickAddStyles.quickAddIcon}
                    onPress={() => {
                      navigation.navigate("CustomCameraScreen");
                      setShowQuickAdd(false);
                    }}
                  >
                    <Ionicons name="camera" size={18} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={quickAddStyles.quickAddIcon}
                    onPress={() => {
                      navigation.navigate("VoiceCalorieScreen", {
                        mealType: "Quick Log",
                      });
                      setShowQuickAdd(false);
                    }}
                  >
                    <Ionicons name="mic" size={18} color="#fff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={quickAddStyles.quickAddIcon}
                    onPress={() => {
                      navigation.navigate("QuickLogScreen", {
                        mealType: "Quick Log",
                      });
                      setShowQuickAdd(false);
                    }}
                  >
                    <Ionicons name="create" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={quickAddStyles.plusButton}
                onPress={() => setShowQuickAdd(!showQuickAdd)}
              >
                <Ionicons
                  name={showQuickAdd ? "close" : "add"}
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            <StreakBadge
              calorieStreak={calorieStreak}
              graceActive={graceActive}
              maxStreak={maxStreak}
              styles={styles}
              themeKey={themeKey}
            />
            {/* Streak-at-risk warning — shown from midday if today's goal not yet met */}
            {(() => {
              const hour = new Date().getHours();
              const riskCals = getStreakRiskCalories(
                totals.calories,
                dailyGoal,
                goal_type,
                calorieStreak,
                graceActive,
              );
              if (hour >= 12 && riskCals !== null && riskCals > 0) {
                return (
                  <View style={styles.streakRiskBanner}>
                    <Text style={styles.streakRiskText}>
                      ⚡ Log {Math.round(riskCals)} more kcal to keep your streak!
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
        </View>

        <View style={styles.macroSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Targets</Text>
              <Text style={styles.sectionTitle}>Macro Breakdown</Text>
            </View>
          </View>

          <View style={styles.macroGrid}>
            <View style={styles.macroWideCard}>
              <View style={styles.macroWideTop}>
                <View style={styles.macroIconShell}>
                  <Ionicons
                    name="barbell-outline"
                    size={18}
                    color={palette.primary}
                  />
                </View>
                <Text style={styles.macroTitle}>Protein</Text>
              </View>
              <Text style={styles.macroValueLarge}>
                {totals.protein?.toFixed(0) || 0}g
              </Text>
              <Text style={styles.macroGoalSmall}>
                Goal {macro_targets.protein_g}g
              </Text>
            </View>

            <View style={styles.macroSmallColumn}>
              <View style={styles.macroMiniCard}>
                <View style={styles.macroMiniTop}>
                  <Ionicons
                    name="nutrition-outline"
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.macroMiniTitle}>Carbs</Text>
                </View>
                <Text style={styles.macroMiniValue}>
                  {totals.carbs?.toFixed(0) || 0}g
                </Text>
                <Text style={styles.macroMiniGoal}>
                  Goal {macro_targets.carbs_g}g
                </Text>
              </View>

              <View style={styles.macroMiniCard}>
                <View style={styles.macroMiniTop}>
                  <Ionicons
                    name="leaf-outline"
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.macroMiniTitle}>Fat</Text>
                </View>
                <Text style={styles.macroMiniValue}>
                  {totals.fat?.toFixed(0) || 0}g
                </Text>
                <Text style={styles.macroMiniGoal}>
                  Goal {macro_targets.fat_g}g
                </Text>
              </View>
            </View>

            <View style={styles.macroFiberCard}>
              <View style={styles.macroFiberTop}>
                <View style={styles.macroIconShell}>
                  <Ionicons
                    name="restaurant-outline"
                    size={18}
                    color={palette.primary}
                  />
                </View>
                <Text style={styles.macroTitle}>Fiber</Text>
              </View>
              <Text style={styles.macroFiberValue}>
                {Math.round(totals.fiber)}g
              </Text>
              <Text style={styles.macroGoalSmall}>Goal 30g</Text>
            </View>
          </View>
        </View>

        <View style={styles.recentMealsSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>History</Text>
              <Text style={styles.sectionTitle}>Recent Meals</Text>
            </View>

            {isSelectionMode && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedMeals(new Set());
                    setIsSelectionMode(false);
                  }}
                  style={styles.cancelSelectionBtn}
                >
                  <Text style={styles.cancelSelectionText}>Cancel</Text>
                </TouchableOpacity>
                {selectedMeals.size > 0 && (
                  <TouchableOpacity
                    onPress={handleDeleteSelected}
                    style={styles.deleteActionBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.deleteActionText}>
                      Delete ({selectedMeals.size})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {recentMeals.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons
                name="restaurant-outline"
                size={26}
                color={palette.primary}
              />
              <Text style={styles.emptyStateTitle}>No meals logged yet</Text>
              <Text style={styles.emptyStateText}>
                Use the quick actions or floating buttons to add your first meal
                for today.
              </Text>
            </View>
          ) : (
            <View style={styles.mealCardList}>
              {recentMeals.map((meal, i) => {
                const mealId = meal.id || meal._id || `meal-${i}`;
                const isSelected = !!mealId && selectedMeals.has(mealId);

                return (
                  <TouchableOpacity
                    key={mealId}
                    onPress={() => handleMealPress(mealId, i)}
                    onLongPress={() => handleMealLongPress(mealId)}
                    style={[
                      styles.mealLogCard,
                      isSelected && styles.mealLogCardSelected,
                      expandedMeal === i && styles.mealLogCardExpanded,
                    ]}
                    activeOpacity={0.88}
                  >
                    <View style={styles.mealLogTopRow}>
                      {meal.photo_url && (meal.photo_url.startsWith("http") || meal.photo_url.startsWith("file://")) ? (
                        <Image
                          source={{ uri: meal.photo_url }}
                          style={styles.mealLogImage}
                        />
                      ) : (
                        <Image
                          source={{
                            uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
                          }}
                          style={styles.mealLogImage}
                          defaultSource={{
                            uri: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
                          }}
                        />
                      )}

                      <View style={styles.mealLogContent}>
                        <View style={styles.mealLogTextWrap}>
                          <Text
                            style={styles.mealLogTitle}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {meal.food_name || meal.meal_type || "Meal"}
                          </Text>
                          <Text style={styles.mealLogSub}>
                            {meal.meal_type || "Logged meal"}
                          </Text>
                        </View>

                        <View style={styles.mealLogRight}>
                          <Text style={styles.mealLogCalories}>
                            {meal.calories ? `${meal.calories} kcal` : "-- kcal"}
                          </Text>
                          {isSelectionMode && (
                            <Ionicons
                              name={
                                isSelected
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={22}
                              color={
                                isSelected
                                  ? palette.primary
                                  : palette.borderStrong
                              }
                            />
                          )}
                        </View>
                      </View>
                    </View>

                  {expandedMeal === i && (
                    <View style={styles.expandedSection}>
                      <Text style={styles.expandedTitle}>
                        Nutrition Details
                      </Text>
                      <View style={styles.expandedGrid}>
                        <View style={styles.expandedMetricCard}>
                          <Text style={styles.expandedMetricLabel}>
                            Protein
                          </Text>
                          <Text style={styles.expandedMetricValue}>
                            {meal.protein || 0}g
                          </Text>
                        </View>

                        <View style={styles.expandedMetricCard}>
                          <Text style={styles.expandedMetricLabel}>Carbs</Text>
                          <Text style={styles.expandedMetricValue}>
                            {meal.carbs || 0}g
                          </Text>
                        </View>

                        <View style={styles.expandedMetricCard}>
                          <Text style={styles.expandedMetricLabel}>Fat</Text>
                          <Text style={styles.expandedMetricValue}>
                            {meal.fat || 0}g
                          </Text>
                        </View>

                        <View style={styles.expandedMetricCard}>
                          <Text style={styles.expandedMetricLabel}>Fiber</Text>
                          <Text style={styles.expandedMetricValue}>
                            {meal.fiber || 0}g
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            </View>
          )}
        </View>

        {/* Calorie Insight Card - Bottom-most part of HomeScreen (Single Insight View) */}
        {calorieInsightsEnabled && calorieInsights.length > 0 && (
          <View style={styles.calorieInsightCard}>
            <View style={styles.calorieInsightHeader}>
              <View style={styles.calorieInsightHeaderLeft}>
                <View style={styles.calorieInsightIconShell}>
                  <Ionicons
                    name="bulb-outline"
                    size={18}
                    color={palette.primary}
                  />
                </View>
                <View>
                  <Text style={styles.calorieInsightEyebrow}>Nutrition Support</Text>
                  <Text style={styles.calorieInsightTitle}>Calorie Insight</Text>
                </View>
              </View>

              {calorieInsights.length > 1 && (
                <View style={styles.insightNavRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setActiveCalorieInsightIndex((prev) =>
                        prev === 0 ? calorieInsights.length - 1 : prev - 1,
                      )
                    }
                    style={styles.insightNavBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={palette.primary}
                    />
                  </TouchableOpacity>
                  <Text style={styles.insightNavCount}>
                    {(activeCalorieInsightIndex % calorieInsights.length) + 1}/
                    {calorieInsights.length}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setActiveCalorieInsightIndex(
                        (prev) => (prev + 1) % calorieInsights.length,
                      )
                    }
                    style={styles.insightNavBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={palette.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {(() => {
              const insight =
                calorieInsights[
                  activeCalorieInsightIndex % calorieInsights.length
                ];
              if (!insight) return null;
              return (
                <View
                  style={[
                    styles.calorieInsightItem,
                    insight.priority === "high" &&
                      styles.calorieInsightItemHigh,
                  ]}
                >
                  <Text style={styles.calorieInsightEmoji}>{insight.icon}</Text>
                  <View style={styles.calorieInsightContent}>
                    <Text style={styles.calorieInsightHeading}>
                      {insight.title}
                    </Text>
                    <Text style={styles.calorieInsightMessage}>
                      {insight.message}
                    </Text>
                    {insight.action ? (
                      <Text style={styles.calorieInsightAction}>
                        {insight.action}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>

      <FooterBar
        navigation={navigation}
        activeTab="Meals"
        footerStyles={footerStyles}
        palette={palette}
        themeKey={themeKey}
      />
    </SafeAreaView>
  );
};

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
  navInactive: isDark ? "#A6C4BF" : "#6C8883",
  chipBackground: isDark ? "#1F3A36" : "#EAF4F2",
  chipText: isDark ? "#D7ECE8" : "#476560",
  highlight: isDark ? "#1A3532" : "#EEF8F6",
  mutedCard: isDark ? "#17312E" : "#F6FBFA",
  destructive: "#B94F4F",
  warning: "#1F4E4A",
  success: "#1F4E4A",
  balance: "#1F4E4A",
  navBackground: isDark
    ? "rgba(18, 39, 36, 0.95)"
    : "rgba(255, 255, 255, 0.92)",
  navBackgroundIOS: isDark
    ? "rgba(18, 39, 36, 0.82)"
    : "rgba(255, 255, 255, 0.82)",
  pillTrack: isDark ? "#22423E" : "#DCEEEA",
  pillBurned: isDark ? "#21403C" : "#E8F5F2",
  pillBalance: isDark ? "#21403C" : "#E8F5F2",
  chartBackground: isDark ? "#17302D" : "#FFFFFF",
  disabledText: isDark ? "#67827D" : "#99B0AB",
  selectedCard: isDark ? "#1D403B" : "#E6F5F1",
  nutritionSoft: isDark ? "#1E3B37" : "#EDF7F5",
  heroChip: isDark ? "#234440" : "#E9F5F2",
  heroChipBorder: isDark ? "#345A55" : "#D2E7E2",
});

const createStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    summaryLeftFull: {
      width: "100%",
    },

    intakeBarWrap: {
      marginTop: 18,
      marginBottom: 18,
    },

    intakeBarTrack: {
      width: "100%",
      height: 16,
      borderRadius: 999,
      backgroundColor: palette.cardSecondary,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: palette.border,
    },

    intakeBarFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: palette.primary,
    },

    intakePercentText: {
      marginTop: 10,
      fontSize: 13,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },

    milestoneRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
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
    heroCard: {
      marginHorizontal: 18,
      marginTop: 18,
      marginBottom: 14,
      padding: 20,
      borderRadius: 30,
      backgroundColor: palette.primary,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 22,
      elevation: 8,
    },

    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    heroEyebrow: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: "#CFE6E1",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 8,
    },

    greeting: {
      fontSize: 28,
      fontFamily: "Lexend-Bold",
      color: "#FFFFFF",
      marginBottom: 6,
    },

    date: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: "#D9ECE8",
      lineHeight: 20,
    },

    heroActions: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 12,
    },

    heroActionBtn: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: "#F4FBFA",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 10,
    },

    weekStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      marginBottom: 12,
    },

    weekDayWrap: {
      flex: 1,
      alignItems: "center",
    },

    weekDayCard: {
      width: 44,
      borderRadius: 18,
      paddingVertical: 10,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },

    weekDayCardActive: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
    },

    weekDayCardDisabled: {
      opacity: 0.48,
    },

    weekDayLabel: {
      fontSize: 11,
      fontFamily: "Lexend-SemiBold",
      color: palette.textSecondary,
      marginBottom: 4,
    },

    weekDayLabelActive: {
      color: "#FFFFFF",
    },

    weekDayLabelDisabled: {
      color: palette.disabledText,
    },

    weekDayNumber: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },

    weekDayNumberActive: {
      color: "#FFFFFF",
    },

    weekDayNumberDisabled: {
      color: palette.disabledText,
    },

    summaryShell: {
      marginHorizontal: 18,
      marginBottom: 16,
      backgroundColor: palette.card,
      borderRadius: 30,
      padding: 20,
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
      marginBottom: 18,
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

    summaryMain: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    summaryLeft: {
      flex: 1,
      paddingRight: 8,
    },

    caloriesCount: {
      fontSize: 42,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 2,
    },

    caloriesUnit: {
      fontSize: 15,
      fontFamily: "Manrope-Medium",
      color: palette.textSecondary,
      marginBottom: 16,
    },

    metricPillsColumn: {
      gap: 10,
    },

    metricPill: {
      alignSelf: "flex-start",
      backgroundColor: palette.cardSecondary,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.border,
      minWidth: 120,
    },

    metricPillLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 2,
    },

    metricPillValue: {
      fontSize: 16,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },

    progressChartWrap: {
      width: 130,
      height: 130,
      justifyContent: "center",
      alignItems: "center",
    },

    progressText: {
      position: "absolute",
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
    },

    summaryBottomRow: {
      marginTop: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.cardSecondary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },

    streakBadgeGrace: {
      borderColor: '#4FC3F7',
      backgroundColor: isDark ? 'rgba(79,195,247,0.10)' : 'rgba(79,195,247,0.12)',
    },

    streakEmoji: {
      fontSize: 14,
      marginRight: 6,
    },

    streakText: {
      fontFamily: 'Lexend-SemiBold',
      fontSize: 12,
      color: palette.textPrimary,
    },

    streakMaxText: {
      fontFamily: 'Lexend-Regular',
      fontSize: 11,
      color: palette.textSecondary,
    },

    streakRiskBanner: {
      marginTop: 8,
      backgroundColor: isDark ? 'rgba(255,165,0,0.12)' : 'rgba(255,140,0,0.10)',
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,165,0,0.35)' : 'rgba(255,140,0,0.30)',
    },

    streakRiskText: {
      fontFamily: 'Lexend-SemiBold',
      fontSize: 12,
      color: isDark ? '#FFB74D' : '#E65100',
    },

    summaryHintChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.heroChip,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: palette.heroChipBorder,
    },

    summaryHintText: {
      marginLeft: 6,
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
    },

    quickActionsGrid: {
      marginHorizontal: 18,
      marginBottom: 16,
      gap: 12,
    },

    mealSection: {
      backgroundColor: palette.card,
      padding: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },

    mealSectionLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      paddingRight: 10,
    },

    mealIconContainer: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: palette.cardSecondary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },

    mealTitle: {
      fontSize: 16,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 2,
    },

    mealTime: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },

    mealActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    mealActionSoft: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },

    mealActionPrimary: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: palette.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    macroSection: {
      marginHorizontal: 18,
      marginBottom: 16,
    },

    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 22,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
    },

    macroGrid: {
      gap: 12,
    },

    macroWideCard: {
      backgroundColor: palette.card,
      borderRadius: 28,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },

    macroWideTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },

    macroSmallColumn: {
      flexDirection: "row",
      gap: 12,
    },

    macroMiniCard: {
      flex: 1,
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },

    macroMiniTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },

    macroMiniTitle: {
      marginLeft: 8,
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },

    macroMiniValue: {
      fontSize: 24,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 2,
    },

    macroMiniGoal: {
      fontSize: 12,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },

    macroFiberCard: {
      backgroundColor: palette.cardSecondary,
      borderRadius: 28,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.border,
    },

    macroFiberTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },

    macroIconShell: {
      width: 36,
      height: 36,
      borderRadius: 14,
      backgroundColor: palette.background,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
      marginRight: 10,
    },

    macroTitle: {
      fontSize: 16,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },

    macroValueLarge: {
      fontSize: 34,
      fontFamily: "Lexend-Bold",
      color: palette.primary,
      marginBottom: 4,
    },

    macroFiberValue: {
      fontSize: 30,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginBottom: 4,
    },

    macroGoalSmall: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
    },

    recentMealsSection: {
      marginHorizontal: 18,
      marginBottom: 10,
    },

    cancelSelectionBtn: {
      backgroundColor: palette.card,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },

    cancelSelectionText: {
      color: palette.textSecondary,
      fontFamily: "Lexend-Medium",
      fontSize: 13,
    },

    deleteActionBtn: {
      backgroundColor: palette.destructive,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    deleteActionText: {
      color: "#fff",
      marginLeft: 6,
      fontFamily: "Lexend-SemiBold",
      fontSize: 13,
    },

    emptyStateCard: {
      backgroundColor: palette.card,
      borderRadius: 26,
      padding: 22,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },

    emptyStateTitle: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginTop: 10,
      marginBottom: 6,
    },

    emptyStateText: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      textAlign: "center",
      lineHeight: 21,
    },

    mealCardList: {
      gap: 12,
    },

    mealLogCard: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 3,
    },

    mealLogCardSelected: {
      backgroundColor: palette.selectedCard,
      borderColor: palette.primary,
      borderWidth: 1.5,
    },

    mealLogCardExpanded: {
      transform: [{ scale: 1.01 }],
    },

    mealLogTopRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    mealLogImage: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: palette.cardSecondary,
    },

    mealLogContent: {
      flex: 1,
      marginLeft: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    mealLogTextWrap: {
      flex: 1,
      paddingRight: 10,
    },

    mealLogTitle: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 16,
      color: palette.textPrimary,
      marginBottom: 4,
    },

    mealLogSub: {
      fontFamily: "Manrope-Regular",
      fontSize: 13,
      color: palette.textSecondary,
    },

    mealLogRight: {
      alignItems: "flex-end",
      justifyContent: "center",
      minWidth: 70,
    },

    mealLogCalories: {
      fontFamily: "Lexend-Bold",
      fontSize: 14,
      color: palette.primary,
      marginBottom: isDark ? 6 : 6,
    },

    expandedSection: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },

    expandedTitle: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 14,
      color: palette.textPrimary,
      marginBottom: 10,
    },

    expandedGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },

    expandedMetricCard: {
      width: "47%",
      backgroundColor: palette.nutritionSoft,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
    },

    expandedMetricLabel: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 12,
      color: palette.textSecondary,
      marginBottom: 4,
    },

    expandedMetricValue: {
      fontFamily: "Lexend-Bold",
      fontSize: 16,
      color: palette.primary,
    },

    /* Calorie Insights Card (Bottom of HomeScreen) */
    calorieInsightCard: {
      backgroundColor: palette.card,
      borderRadius: 24,
      padding: 16,
      marginHorizontal: 18,
      marginTop: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    calorieInsightHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    calorieInsightHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    calorieInsightIconShell: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: palette.highlight,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },
    calorieInsightEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: palette.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 1,
    },
    sectionEyebrow: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    calorieInsightTitle: {
      fontSize: 16.5,
      fontFamily: "Lexend-Bold",
      color: palette.textPrimary,
      marginTop: 1,
    },
    calorieInsightItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: palette.cardSecondary,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    calorieInsightItemHigh: {
      backgroundColor: isDark ? "rgba(217,119,6,0.18)" : "#FDF3E7",
      borderColor: "#D97706",
    },
    calorieInsightEmoji: {
      fontSize: 22,
      marginRight: 12,
      marginTop: 2,
    },
    calorieInsightContent: {
      flex: 1,
    },
    calorieInsightHeading: {
      fontSize: 14.5,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
      marginBottom: 3,
    },
    calorieInsightMessage: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: palette.textSecondary,
      marginBottom: 6,
      lineHeight: 19,
    },
    calorieInsightAction: {
      fontSize: 12.5,
      fontFamily: "Manrope-SemiBold",
      color: palette.primary,
    },
    insightNavRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      borderRadius: 14,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 6,
    },
    insightNavBtn: {
      padding: 2,
    },
    insightNavCount: {
      fontSize: 12,
      fontFamily: "Manrope-SemiBold",
      color: palette.textSecondary,
    },
  });

const createFooterStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 16,
      right: 16,
      backgroundColor: "transparent",
      alignItems: "center",
      zIndex: 100,
    },

    ovalFooter: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      width: "100%",
      backgroundColor: palette.navBackground,
      borderRadius: 34,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: palette.border,
      ...(Platform.OS === "ios" && {
        backgroundColor: palette.navBackgroundIOS,
      }),
    },

    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },

    activeTab: {},

    iconShell: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },

    activeIconShell: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.cardSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },

    label: {
      fontSize: 12,
      marginTop: 4,
      color: palette.navInactive,
      fontFamily: "Manrope-Medium",
    },

    activeLabel: {
      color: palette.primary,
      fontFamily: "Lexend-SemiBold",
    },
  });

const createQuickAddStyles = (palette, isDark) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 18,
      right: 18,
      zIndex: 200,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    actionButton: {
      flex: 1,
      height: 56,
      borderRadius: 20,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5,
    },

    primaryButton: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
      flex: 1.15,
    },

    actionText: {
      marginLeft: 8,
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: palette.primary,
    },

    primaryText: {
      marginLeft: 8,
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
      color: "#FFFFFF",
    },
    quickAddPopup: {
      position: "absolute",
      left: 58,
      top: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      zIndex: 30,
    },
    quickAddIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.primary,
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
    },
    quickAddContainer: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      zIndex: 20,
    },
    plusButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: palette.primary,
      justifyContent: "center",
      alignItems: "center",
      elevation: 6,
    },
    quickAddItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
    },

    quickAddText: {
      marginLeft: 10,
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: palette.textPrimary,
    },

    addMealButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 18,
    },

    addMealText: {
      color: "#fff",
      marginLeft: 6,
      fontSize: 14,
      fontFamily: "Lexend-SemiBold",
    },
  });

export default React.memo(HomeScreen);
