import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Modal,
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
import Svg, { Circle } from "react-native-svg";
import { DailyCheckInModal } from "../components/DailyCheckInModal";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";
import { getFoodLogs } from "../utils/api";
import {
  getMainDashboardCache,
  invalidateMainDashboardCache,
  updateMainDashboardCacheOptimistic,
} from "../utils/cacheManager";
import { getFoodStreak } from "../utils/streakService";
import useTodaySteps from "../utils/useTodaySteps";

const globalCache = getMainDashboardCache();

export const streakCache = {
  lastFetch: 0,
  cachedStreak: null,
  CACHE_DURATION: 30000,
  _listeners: new Set(),
};

export {
  invalidateMainDashboardCache,
  updateMainDashboardCacheOptimistic as updateMainDashboardCache
};

const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const RADIUS = { sm: 6, md: 12, lg: 24, xl: 32, full: 9999 };

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

const QUOTES = [
  "Discipline is remembering what you want.",
  "Small steps every day.",
  "Progress, not perfection.",
  "You are stronger than you think.",
  "Consistency is key.",
  "Your only limit is you.",
  "Stay positive, work hard, make it happen.",
  "Every day is a fresh start.",
  "Believe in yourself.",
  "Success is the sum of small efforts.",
];

const getTodaysQuote = () => {
  const day = new Date().getDate();
  return QUOTES[day % QUOTES.length];
};

const StreakBadge = React.memo(
  ({ calorieStreak }) => {
    const { colors, isDark } = useTheme();
    const streakStyles = React.useMemo(
      () => createStreakStyles(colors, isDark),
      [colors, isDark],
    );

    return (
      <View style={streakStyles.badge}>
        <Text style={streakStyles.emoji}>🔥</Text>
        <Text style={streakStyles.text}>
          {calorieStreak > 0 ? `${calorieStreak}-day streak` : "0-day streak"}
        </Text>
      </View>
    );
  },
  (prevProps, nextProps) => prevProps.calorieStreak === nextProps.calorieStreak,
);

StreakBadge.displayName = "StreakBadge";

const FooterBar = ({ navigation, activeTab }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const footerStyles = React.useMemo(
    () => createFooterStyles(colors, isDark),
    [colors, isDark],
  );

  const activeColor = "#1F4E4A";
  const inactiveColor = isDark ? "#B9D4CF" : "#6C8883";

  const tabs = [
    {
      key: "Home",
      label: "Home",
      icon: <Ionicons name="home-outline" size={22} color={activeColor} />,
      route: "MainDashboard",
    },
    {
      key: "Meals",
      label: "Meals",
      icon: (
        <Ionicons name="restaurant-outline" size={22} color={inactiveColor} />
      ),
      route: "Home",
    },
    {
      key: "Workout",
      label: "Workout",
      icon: <Ionicons name="barbell-outline" size={22} color={inactiveColor} />,
      route: "Exercise",
    },
    {
      key: "Profile",
      label: "Profile",
      icon: <Ionicons name="person-outline" size={22} color={inactiveColor} />,
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
        {tabs.map((tab) => {
          const tabColor = tab.key === activeTab ? activeColor : inactiveColor;
          return (
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
                  color: tabColor,
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
          );
        })}
      </View>
    </View>
  );
};

const MainDashboardScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const palette = React.useMemo(
    () => createPalette(colors, isDark),
    [colors, isDark],
  );
  const styles = React.useMemo(
    () => createStyles(palette, isDark),
    [palette, isDark],
  );
  const COLORS = palette;

  const userName = onboardingData?.name || "User";
  const {
    stepsToday,
    distanceKm,
    calories: stepCalories,
    isPedometerAvailable,
    reloadStepsFromDatabase,
  } = useTodaySteps();
  const stepGoal = onboardingData?.step_goal || 10000;

  const [algorithmManager, setAlgorithmManager] = useState(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [dailyPlan, setDailyPlan] = useState(null);

  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasSeenModalToday, setHasSeenModalToday] = useState(false);
  const [todaysCheckInData, setTodaysCheckInData] = useState(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [hasShownModalToday, setHasShownModalToday] = useState(false);

  const hasCheckedInTodayRef = useRef(false);
  const hasSeenModalTodayRef = useRef(false);
  const hasShownModalTodayRef = useRef(false);
  const todaysCheckInDataRef = useRef(null);

  useEffect(() => {
    hasCheckedInTodayRef.current = hasCheckedInToday;
    hasSeenModalTodayRef.current = hasSeenModalToday;
    hasShownModalTodayRef.current = hasShownModalToday;
    todaysCheckInDataRef.current = todaysCheckInData;
  }, [
    hasCheckedInToday,
    hasSeenModalToday,
    hasShownModalToday,
    todaysCheckInData,
  ]);

  const [calorieStreak, setCalorieStreak] = useState(() => {
    const now = Date.now();
    if (
      streakCache.cachedStreak !== null &&
      now - streakCache.lastFetch < streakCache.CACHE_DURATION
    ) {
      return streakCache.cachedStreak;
    }
    return 0;
  });

  const calorieStreakRef = useRef(calorieStreak);

  useEffect(() => {
    calorieStreakRef.current = calorieStreak;
  }, [calorieStreak]);

  useEffect(() => {
    let backButtonPressed = 0;
    const backAction = () => {
      if (
        navigation.getState().routes[navigation.getState().index].name ===
        "MainDashboard"
      ) {
        backButtonPressed++;
        if (backButtonPressed === 1) {
          setTimeout(() => {
            backButtonPressed = 0;
          }, 2000);
          return true;
        } else if (backButtonPressed === 2) {
          BackHandler.exitApp();
          return true;
        }
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );
    return () => backHandler.remove();
  }, [navigation]);

  const percent = React.useMemo(
    () => Math.round((stepsToday / stepGoal) * 100),
    [stepsToday, stepGoal],
  );

  const [calories, setCalories] = useState(
    () => globalCache.cachedData?.calories || 0,
  );
  const [mealsLogged, setMealsLogged] = useState(
    () => globalCache.cachedData?.mealsLogged || 0,
  );
  const [lastSleepDuration, setLastSleepDuration] = useState("--");
  const [todayWorkouts, setTodayWorkouts] = useState(
    () => globalCache.cachedData?.todayWorkouts || 0,
  );

  const caloriesRef = useRef(calories);
  const mealsLoggedRef = useRef(mealsLogged);
  const todayWorkoutsRef = useRef(todayWorkouts);

  useEffect(() => {
    caloriesRef.current = calories;
    mealsLoggedRef.current = mealsLogged;
    todayWorkoutsRef.current = todayWorkouts;
  }, [calories, mealsLogged, todayWorkouts]);

  useEffect(() => {
    const updateFromCache = () => {
      if (globalCache.cachedData) {
        setMealsLogged(globalCache.cachedData.mealsLogged || 0);
        setCalories(globalCache.cachedData.calories || 0);
        setTodayWorkouts(globalCache.cachedData.todayWorkouts || 0);
        if (globalCache.cachedData.currentWeight !== undefined)
          setCurrentWeight(globalCache.cachedData.currentWeight);
        if (globalCache.cachedData.goalWeight !== undefined)
          setGoalWeight(globalCache.cachedData.goalWeight);
        if (globalCache.cachedData.weightProgress !== undefined)
          setProgress(globalCache.cachedData.weightProgress);
      }
    };

    const { subscribeToMainDashboardCache } = require("../utils/cacheManager");
    const unsubscribe = subscribeToMainDashboardCache(updateFromCache);
    updateFromCache();
    return unsubscribe;
  }, []);

  const [currentWeight, setCurrentWeight] = useState(
    () => globalCache.cachedData?.currentWeight || null,
  );
  const [goalWeight, setGoalWeight] = useState(
    () => globalCache.cachedData?.goalWeight || null,
  );
  const [progress, setProgress] = useState(
    () => globalCache.cachedData?.weightProgress || 0,
  );
  const [goalAchieved, setGoalAchieved] = useState(
    () => globalCache.cachedData?.goalAchieved || false,
  );
  const [realUserId, setRealUserId] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setRealUserId(user?.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("user_profile")
          .select("name, weight, target_weight")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setOnboardingData((prev) => ({
            ...prev,
            name: profile.name || prev.name,
            weight: profile.weight || prev.weight,
            target_weight: profile.target_weight || prev.target_weight,
          }));
        }
      }
    };

    if (
      !onboardingData?.name ||
      !onboardingData?.weight ||
      !onboardingData?.target_weight
    ) {
      fetchUserProfile();
    }
  }, [
    onboardingData?.name,
    onboardingData?.weight,
    onboardingData?.target_weight,
    setOnboardingData,
  ]);

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

  const ritualStreak = null;
  const mood = onboardingData?.mood || null;
  const quote = getTodaysQuote();

  function parseIntervalToDisplay(interval) {
    if (!interval || typeof interval !== "string") return "--";
    const clean = interval.trim();
    if (!clean.includes(":")) return "--";
    const [h, m] = clean.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "--";
    return `${h}h ${m}m`;
  }

  function parseIntervalToMinutes(interval) {
    if (!interval || typeof interval !== "string") return 0;
    const clean = interval.trim();
    if (!clean.includes(":")) return 0;
    const [h, m] = clean.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  }

  const [sleepGoal, setSleepGoal] = useState(
    () => globalCache.cachedData?.sleepGoal || 8,
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const [todaySleepLog, setTodaySleepLog] = useState(
    () => globalCache.cachedData?.todaySleepLog || null,
  );
  const [sleepLogs, setSleepLogs] = useState(
    () => globalCache.cachedData?.sleepLogs || [],
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!realUserId) return;

      const now = Date.now();
      const timeSinceLastFetch = now - globalCache.lastFetchTime;
      const isFresh = timeSinceLastFetch < globalCache.CACHE_DURATION;

      if (globalCache.cachedData) {
        const cached = globalCache.cachedData;

        if ((cached.mealsLogged || 0) !== mealsLoggedRef.current) {
          mealsLoggedRef.current = cached.mealsLogged || 0;
          setMealsLogged(cached.mealsLogged || 0);
        }
        if ((cached.calories || 0) !== caloriesRef.current) {
          caloriesRef.current = cached.calories || 0;
          setCalories(cached.calories || 0);
        }
        if (
          JSON.stringify(cached.sleepLogs || []) !== JSON.stringify(sleepLogs)
        ) {
          setSleepLogs(cached.sleepLogs || []);
        }
        if (
          JSON.stringify(cached.todaySleepLog) !== JSON.stringify(todaySleepLog)
        ) {
          setTodaySleepLog(cached.todaySleepLog || null);
        }
        if (cached.sleepGoal && cached.sleepGoal !== sleepGoal) {
          setSleepGoal(cached.sleepGoal);
        }
        if ((cached.todayWorkouts || 0) !== todayWorkoutsRef.current) {
          todayWorkoutsRef.current = cached.todayWorkouts || 0;
          setTodayWorkouts(cached.todayWorkouts || 0);
        }

        globalCache.cacheHits++;
        if (isFresh) return;
      }

      if (globalCache.isFetching) return;
      globalCache.isFetching = true;
      globalCache.cacheMisses++;

      const fetchAllData = async () => {
        try {
          const today = new Date();
          const startOfDay = new Date(today).setHours(0, 0, 0, 0);
          const endOfDay = new Date(today).setHours(23, 59, 59, 999);
          const todayStrInner = today.toISOString().slice(0, 10);

          const [
            foodLogs,
            sleepData,
            cardioData,
            routineData,
            weightProfile,
            weightLogs,
          ] = await Promise.all([
            getFoodLogs(realUserId),
            supabase
              .from("sleep_logs")
              .select("*")
              .eq("user_id", realUserId)
              .order("date", { ascending: false })
              .limit(7),
            supabase
              .from("saved_cardio_sessions")
              .select("id")
              .eq("user_id", realUserId)
              .gte("created_at", new Date(startOfDay).toISOString())
              .lte("created_at", new Date(endOfDay).toISOString()),
            supabase
              .from("workouts")
              .select("id")
              .eq("user_id", realUserId)
              .gte("created_at", new Date(startOfDay).toISOString())
              .lte("created_at", new Date(endOfDay).toISOString()),
            supabase
              .from("user_profile")
              .select("weight, target_weight, goal_focus")
              .eq("id", realUserId)
              .single(),
            supabase
              .from("weight_logs")
              .select("weight, date")
              .eq("user_id", realUserId)
              .order("date", { ascending: true }),
          ]);

          const filteredLogs = foodLogs.filter((log) => {
            const logDate = new Date(log.created_at).getTime();
            return logDate >= startOfDay && logDate <= endOfDay;
          });

          setMealsLogged(filteredLogs.length);
          setCalories(
            filteredLogs.reduce((sum, log) => sum + (log.calories || 0), 0),
          );

          if (sleepData.data) {
            setSleepLogs(sleepData.data);
            const todayLog = sleepData.data.find(
              (l) => l.date?.slice(0, 10) === todayStrInner,
            );
            setTodaySleepLog(todayLog || null);
            if (sleepData.data[0]?.sleep_goal)
              setSleepGoal(sleepData.data[0].sleep_goal);

            if (todayLog) {
              const [sh, sm] = todayLog.start_time.split(":").map(Number);
              const [eh, em] = todayLog.end_time.split(":").map(Number);
              let mins = eh * 60 + em - (sh * 60 + sm);
              if (mins < 0) mins += 24 * 60;
              setLastSleepDuration(`${Math.floor(mins / 60)}h ${mins % 60}m`);
            }
          }

          const workoutsCount =
            (cardioData.data?.length || 0) + (routineData.data?.length || 0);
          setTodayWorkouts(workoutsCount);

          let latestWeight = 0;
          let goalNum = null;
          let prog = 0;
          let isGoalAchieved = false;

          const profile = weightProfile.data;
          const logs = weightLogs.data || [];

          if (profile) {
            goalNum =
              profile.target_weight || onboardingData?.target_weight || null;
            if (goalNum) goalNum = Number(goalNum);

            if (logs.length > 0) {
              latestWeight = Number(logs[logs.length - 1].weight);
            } else {
              latestWeight =
                Number(profile.weight) || Number(onboardingData?.weight) || 0;
            }

            let rawGoal =
              profile.goal_focus || onboardingData?.goal_focus || "maintain";
            let goalType = String(rawGoal).toLowerCase();
            if (goalType.includes("lose") || goalType.includes("loss"))
              goalType = "lose";
            else if (goalType.includes("gain") || goalType.includes("muscle"))
              goalType = "gain";
            else goalType = "maintain";

            if (goalNum && goalNum > 0 && latestWeight > 0) {
              if (goalType === "lose") {
                prog = latestWeight <= goalNum ? 1 : goalNum / latestWeight;
                isGoalAchieved = latestWeight <= goalNum;
              } else {
                prog = latestWeight >= goalNum ? 1 : latestWeight / goalNum;
                isGoalAchieved =
                  goalType === "gain"
                    ? latestWeight >= goalNum
                    : Math.abs(latestWeight - goalNum) <= 1;
              }
            }
          }

          setCurrentWeight(latestWeight > 0 ? latestWeight : null);
          setGoalWeight(goalNum);
          setProgress(prog);
          setGoalAchieved(isGoalAchieved);

          globalCache.cachedData = {
            mealsLogged: filteredLogs.length,
            calories: filteredLogs.reduce(
              (sum, log) => sum + (log.calories || 0),
              0,
            ),
            sleepLogs: sleepData.data || [],
            todaySleepLog:
              sleepData.data?.find(
                (l) => l.date?.slice(0, 10) === todayStrInner,
              ) || null,
            sleepGoal: sleepData.data?.[0]?.sleep_goal || 8,
            todayWorkouts: workoutsCount,
            currentWeight: latestWeight > 0 ? latestWeight : null,
            goalWeight: goalNum,
            weightProgress: prog,
            goalAchieved: isGoalAchieved,
          };

          globalCache.lastFetchTime = Date.now();

          if (globalCache._listeners) {
            globalCache._listeners.forEach((listener) => listener());
          }
        } catch (error) {
        } finally {
          globalCache.isFetching = false;
        }
      };

      fetchAllData();
    }, [realUserId, sleepLogs, todaySleepLog, sleepGoal, onboardingData]),
  );

  let todaySleepDuration = "--";
  let todaySleepPercent = 0;
  if (todaySleepLog && todaySleepLog.duration) {
    todaySleepDuration = parseIntervalToDisplay(todaySleepLog.duration);
    const mins = parseIntervalToMinutes(todaySleepLog.duration);
    todaySleepPercent =
      sleepGoal > 0
        ? Math.min(100, Math.round((mins / (sleepGoal * 60)) * 100))
        : 0;
  }

  const [currentIntake, setCurrentIntake] = useState(
    () => globalCache.cachedHydrationData?.currentIntake || 0,
  );
  const [dailyGoal, setDailyGoal] = useState(
    () => globalCache.cachedHydrationData?.dailyGoal || 2.5,
  );
  const [intake1, setIntake1] = useState(
    () => globalCache.cachedHydrationData?.intake1 || 250,
  );
  const [intake2, setIntake2] = useState(
    () => globalCache.cachedHydrationData?.intake2 || 500,
  );
  const [hydrationLoading, setHydrationLoading] = useState(
    () => !globalCache.cachedHydrationData,
  );
  const [hydrationRecordId, setHydrationRecordId] = useState(
    () => globalCache.cachedHydrationData?.hydrationRecordId || null,
  );

  const hydrationAnim = useRef(
    new Animated.Value(
      globalCache.cachedHydrationData
        ? Math.min(
            100,
            (globalCache.cachedHydrationData.currentIntake /
              (globalCache.cachedHydrationData.dailyGoal || 2.5)) *
              100,
          )
        : 0,
    ),
  ).current;

  useEffect(() => {
    const target = hydrationLoading
      ? 0
      : Math.min(100, (currentIntake / (dailyGoal || 2.5)) * 100);
    Animated.timing(hydrationAnim, {
      toValue: target,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [currentIntake, dailyGoal, hydrationLoading, hydrationAnim]);

  const animatedBottleFillHeight = hydrationAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  useFocusEffect(
    React.useCallback(() => {
      if (!realUserId) return;

      const now = Date.now();
      if (
        now - globalCache.lastHydrationFetch < globalCache.CACHE_DURATION &&
        globalCache.cachedHydrationData
      ) {
        setCurrentIntake(globalCache.cachedHydrationData.currentIntake);
        setDailyGoal(globalCache.cachedHydrationData.dailyGoal);
        setIntake1(globalCache.cachedHydrationData.intake1);
        setIntake2(globalCache.cachedHydrationData.intake2);
        setHydrationRecordId(globalCache.cachedHydrationData.hydrationRecordId);
        setHydrationLoading(false);
        return;
      }

      const fetchHydration = async () => {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("daily_water_intake")
          .select("*")
          .eq("user_id", realUserId)
          .eq("date", today)
          .single();

        if (data) {
          setCurrentIntake(data.current_intake_ml / 1000);
          setDailyGoal(data.daily_goal_ml / 1000);
          setIntake1(data.intake1_ml || 250);
          setIntake2(data.intake2_ml || 500);
          setHydrationRecordId(data.id);
        } else {
          await createTodayHydrationRecord(realUserId, today);
          setCurrentIntake(0);
          setDailyGoal(2.5);
          setIntake1(250);
          setIntake2(500);
        }

        setHydrationLoading(false);

        globalCache.cachedHydrationData = {
          currentIntake: data ? data.current_intake_ml / 1000 : 0,
          dailyGoal: data ? data.daily_goal_ml / 1000 : 2.5,
          intake1: data?.intake1_ml || 250,
          intake2: data?.intake2_ml || 500,
          hydrationRecordId: data?.id || null,
        };

        globalCache.lastHydrationFetch = Date.now();
      };

      fetchHydration();
    }, [realUserId]),
  );

  useEffect(() => {
    if (realUserId && onboardingData) {
    }
  }, [realUserId, onboardingData]);

  useEffect(() => {
    if (!realUserId) return;

    const updateStreakFromCache = () => {
      streakCache.lastFetch = 0;
      getFoodStreak(realUserId)
        .then((currentStreak) => {
          streakCache.cachedStreak = currentStreak;
          streakCache.lastFetch = Date.now();
          setCalorieStreak((prevStreak) => {
            if (prevStreak !== currentStreak) {
              calorieStreakRef.current = currentStreak;
              return currentStreak;
            }
            return prevStreak;
          });
        })
        .catch((error) => {
          console.error("Error fetching streak:", error);
        });
    };

    if (!globalCache._streakListeners) {
      globalCache._streakListeners = new Set();
    }
    globalCache._streakListeners.add(updateStreakFromCache);

    return () => {
      if (globalCache._streakListeners) {
        globalCache._streakListeners.delete(updateStreakFromCache);
      }
    };
  }, [realUserId]);

  useFocusEffect(
    React.useCallback(() => {
      checkDailyCheckInStatus();
    }, []),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!realUserId) return;

      const now = Date.now();
      const timeSinceLastFetch = now - streakCache.lastFetch;
      const cacheExpired =
        !streakCache.cachedStreak ||
        timeSinceLastFetch >= streakCache.CACHE_DURATION;

      if (!cacheExpired) {
        const cachedValue = streakCache.cachedStreak;
        if (cachedValue !== calorieStreakRef.current) {
          calorieStreakRef.current = cachedValue;
          setCalorieStreak(cachedValue);
        }
        return;
      }

      const loadStreak = async () => {
        try {
          const currentStreak = await getFoodStreak(realUserId);
          streakCache.cachedStreak = currentStreak;
          streakCache.lastFetch = now;
          if (currentStreak !== calorieStreakRef.current) {
            calorieStreakRef.current = currentStreak;
            setCalorieStreak(currentStreak);
          }
        } catch (error) {
          console.error("Error loading streak:", error);
        }
      };

      loadStreak();
    }, [realUserId]),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (reloadStepsFromDatabase) {
        reloadStepsFromDatabase();
      }
    }, [reloadStepsFromDatabase]),
  );

  useEffect(() => {
    const checkForNewDay = async () => {
      const today = new Date().toDateString();
      const lastCheckDate = await AsyncStorage.getItem("lastCheckDate");

      if (lastCheckDate !== today) {
        setHasCheckedInToday(false);
        setHasSeenModalToday(false);
        setHasShownModalToday(false);
        setTodaysCheckInData(null);
        await AsyncStorage.setItem("lastCheckDate", today);
      }
    };

    checkForNewDay();
  }, []);

  const checkDailyCheckInStatus = async () => {
    try {
      const today = new Date().toDateString();
      const checkInData = await AsyncStorage.getItem(`dailyCheckIn_${today}`);
      const seenModalData = await AsyncStorage.getItem(`seenModal_${today}`);
      const shownModalData = await AsyncStorage.getItem(`shownModal_${today}`);

      if (checkInData) {
        const parsedData = JSON.parse(checkInData);
        if (
          !hasCheckedInTodayRef.current ||
          JSON.stringify(todaysCheckInDataRef.current) !==
            JSON.stringify(parsedData)
        ) {
          hasCheckedInTodayRef.current = true;
          todaysCheckInDataRef.current = parsedData;
          setHasCheckedInToday(true);
          setTodaysCheckInData(parsedData);
        }
      }

      if (seenModalData && !hasSeenModalTodayRef.current) {
        hasSeenModalTodayRef.current = true;
        setHasSeenModalToday(true);
      }

      if (shownModalData && !hasShownModalTodayRef.current) {
        hasShownModalTodayRef.current = true;
        setHasShownModalToday(true);
      }

      if (!checkInData && !seenModalData && !shownModalData) {
        if (!showCheckIn) {
          setShowCheckIn(true);
        }
        if (!hasShownModalTodayRef.current) {
          hasShownModalTodayRef.current = true;
          setHasShownModalToday(true);
          await AsyncStorage.setItem(`shownModal_${today}`, "true");
        }
      }
    } catch (error) {
      console.error("Error checking daily check-in status:", error);
    }
  };

  const saveCheckInData = async (data) => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`dailyCheckIn_${today}`, JSON.stringify(data));
      setHasCheckedInToday(true);
      setTodaysCheckInData(data);
    } catch (error) {
      console.error("Error saving check-in data:", error);
    }
  };

  const markModalAsSeen = async () => {
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem(`seenModal_${today}`, "true");
      setHasSeenModalToday(true);
    } catch (error) {
      console.error("Error marking modal as seen:", error);
    }
  };

  const handleCheckInClose = async () => {
    setShowCheckIn(false);
    setHasShownModalToday(true);
    const today = new Date().toDateString();
    await AsyncStorage.setItem(`shownModal_${today}`, "true");
    markModalAsSeen();
  };

  const handleCheckInButtonPress = () => {
    if (hasCheckedInToday) {
      setShowGoalsModal(true);
    } else {
      setShowCheckIn(true);
    }
  };

  const startDailyRoutine = async (manager) => {
    try {
      const result = await manager.startDailyRoutine();

      if (result.type === "recovery") {
        Alert.alert(
          "Recovered Data",
          `Found ${result.data.length} unsaved entries. Would you like to restore them?`,
          [
            { text: "Discard", style: "cancel" },
            {
              text: "Restore",
              onPress: () => restoreRecoveredData(result.data),
            },
          ],
        );
      } else if (result.type === "checkin") {
        const today = new Date().toDateString();
        const shownModalData = await AsyncStorage.getItem(
          `shownModal_${today}`,
        );
        const checkInData = await AsyncStorage.getItem(`dailyCheckIn_${today}`);

        if (!shownModalData && !checkInData) {
          setShowCheckIn(true);
        }
      }
    } catch (error) {
      console.error("Error starting daily routine:", error);
    }
  };

  const restoreRecoveredData = async (data) => {
    for (const item of data) {
      console.log(`Restoring ${item.key} from ${item.ageMinutes} minutes ago`);
    }
  };

  const handleCheckInComplete = async (responses) => {
    try {
      console.log("Received responses from DailyCheckInModal:", responses);

      const processedResponses = {
        ...responses,
        situation: Array.isArray(responses.situation)
          ? responses.situation
          : responses.situation
            ? [responses.situation]
            : ["Normal day"],
      };

      // Mock processing since AlgorithmManager is not yet fully implemented
      const baseCalories = onboardingData?.calorie_goal || 2000;
      
      const result = {
        success: true,
        dailyGoal: {
          min: Math.round(baseCalories * 0.9),
          max: Math.round(baseCalories * 1.1),
          displayMessage: "Based on your daily check-in, we've adjusted your calorie range slightly to match your energy levels today.",
        },
        dailyPlan: [
          { type: "Hydration", label: "Water", recommended: "+500ml extra today" },
        ]
      };

      if (result.success && result.dailyGoal) {
        setDailyPlan(result.dailyPlan);

        const checkInData = {
          responses: processedResponses,
          dailyGoal: result.dailyGoal,
          dailyPlan: result.dailyPlan,
          timestamp: new Date().toISOString(),
        };

        await saveCheckInData(checkInData);
        setHasShownModalToday(true);
        const today = new Date().toDateString();
        await AsyncStorage.setItem(`shownModal_${today}`, "true");

        Alert.alert(
          "Your Personalized Plan",
          `Today's goal: ${result.dailyGoal.min}-${result.dailyGoal.max} calories\n\n${result.dailyGoal.displayMessage}`,
          [{ text: "Got it!", style: "default" }],
        );
      } else {
        console.error("Check-in failed or missing dailyGoal:", result);
        Alert.alert(
          "Error",
          "Failed to generate personalized plan. Please try again.",
        );
      }
    } catch (error) {
      console.error("Error processing check-in:", error);
      Alert.alert("Error", "Failed to process check-in. Please try again.");
    }
  };

  const createTodayHydrationRecord = async (userId, today) => {
    try {
      const { data, error } = await supabase
        .from("daily_water_intake")
        .insert({
          user_id: userId,
          date: today,
          current_intake_ml: 0,
          daily_goal_ml: 2500,
          intake1_ml: 250,
          intake2_ml: 500,
          goal_status: "not achieved",
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setHydrationRecordId(data.id);
    } catch (error) {}
  };

  const handleAddWater = async (amount) => {
    if (!hydrationRecordId) return;

    const amountInL = amount / 1000;
    const newIntake = Math.min(currentIntake + amountInL, dailyGoal);

    setCurrentIntake(newIntake);

    if (globalCache.cachedHydrationData) {
      globalCache.cachedHydrationData.currentIntake = newIntake;
      globalCache.lastHydrationFetch = Date.now();
    }

    try {
      const { error } = await supabase
        .from("daily_water_intake")
        .update({
          current_intake_ml: Math.round(newIntake * 1000),
          goal_status: newIntake >= dailyGoal ? "achieved" : "not achieved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", hydrationRecordId);

      if (error) throw error;
    } catch (error) {}
  };

  const summaryPercent = Math.max(
    0,
    Math.min(100, Math.round((calories / calorie_goal) * 100)),
  );
  const hydrationPercent = hydrationLoading
    ? 0
    : Math.min(100, Math.round((currentIntake / dailyGoal) * 100));
  const progressValue =
    progress !== undefined && !isNaN(progress) && isFinite(progress)
      ? progress
      : 0;
  const progressPercentage = Math.max(
    0,
    Math.min(100, Math.round(progressValue * 100)),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <DailyCheckInModal
        visible={showCheckIn}
        onClose={handleCheckInClose}
        onComplete={handleCheckInComplete}
        userProfile={onboardingData}
      />

      <Modal
        visible={showGoalsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGoalsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.goalsModalContainer}>
            <View style={styles.goalsModalHeader}>
              <Text style={styles.goalsModalTitle}>
                Today&apos;s Personalized Plan
              </Text>
              <TouchableOpacity
                style={styles.goalsModalCloseButton}
                onPress={() => setShowGoalsModal(false)}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={COLORS.neutralSecondary}
                />
              </TouchableOpacity>
            </View>

            {todaysCheckInData && (
              <ScrollView
                style={styles.goalsModalContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.goalSection}>
                  <Text style={styles.goalSectionTitle}>Calorie Goals</Text>
                  <View style={styles.calorieGoalCard}>
                    <Text style={styles.calorieGoalRange}>
                      {todaysCheckInData.dailyGoal.min} -{" "}
                      {todaysCheckInData.dailyGoal.max} calories
                    </Text>
                    <Text style={styles.calorieGoalTarget}>
                      Target: {todaysCheckInData.dailyGoal.target} calories
                    </Text>
                    <Text style={styles.calorieGoalMessage}>
                      {todaysCheckInData.dailyGoal.displayMessage}
                    </Text>
                  </View>
                </View>

                <View style={styles.goalSection}>
                  <Text style={styles.goalSectionTitle}>Your Check-in</Text>
                  <View style={styles.checkInSummaryCard}>
                    <Text style={styles.checkInSummaryText}>
                      Sleep: {todaysCheckInData.responses.sleep} hours
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Energy: {todaysCheckInData.responses.energy}
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Stress: {todaysCheckInData.responses.stress}
                    </Text>
                    <Text style={styles.checkInSummaryText}>
                      Mood: {todaysCheckInData.responses.mood}/10
                    </Text>
                    {todaysCheckInData.responses.situation &&
                      todaysCheckInData.responses.situation.length > 0 && (
                        <Text style={styles.checkInSummaryText}>
                          Situation:{" "}
                          {todaysCheckInData.responses.situation.join(", ")}
                        </Text>
                      )}
                  </View>
                </View>

                {todaysCheckInData.dailyGoal.reasons &&
                  todaysCheckInData.dailyGoal.reasons.length > 0 && (
                    <View style={styles.goalSection}>
                      <Text style={styles.goalSectionTitle}>Insights</Text>
                      {todaysCheckInData.dailyGoal.reasons.map(
                        (reason, index) => (
                          <View key={index} style={styles.insightCard}>
                            <Text style={styles.insightText}>
                              {reason.factor}: {reason.message}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.goalsModalButton}
              onPress={() => setShowGoalsModal(false)}
            >
              <Text style={styles.goalsModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(
              110,
              (insets.bottom >= 20 ? insets.bottom + 16 : 16) + 84,
            ),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Daily overview</Text>
              <Text style={styles.greetingCardTitle}>
                Good Morning, {userName}
              </Text>
              <Text style={styles.heroSubtitle}>
                Your calorie, recovery and activity dashboard in one place
              </Text>
            </View>
            <View style={styles.heroProgressRing}>
              <Text style={styles.heroProgressValue}>{summaryPercent}%</Text>
              <Text style={styles.heroProgressLabel}>goal</Text>
            </View>
          </View>

          <View style={styles.heroMetricsRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Consumed</Text>
              <Text style={styles.heroMetricValue}>{calories}</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Target</Text>
              <Text style={styles.heroMetricValue}>{calorie_goal}</Text>
            </View>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Meals</Text>
              <Text style={styles.heroMetricValue}>{mealsLogged}</Text>
            </View>
          </View>

          <View style={styles.checkInRow}>
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={handleCheckInButtonPress}
            >
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.checkInButtonText}>
                {hasCheckedInToday ? "View Check-in" : "Daily Check-in"}
              </Text>
            </TouchableOpacity>
            <StreakBadge calorieStreak={calorieStreak} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.timelineBanner}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("Journal")}
        >
          <View style={styles.timelineIconWrap}>
            <MaterialCommunityIcons
              name="timeline-text-outline"
              size={22}
              color={COLORS.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.timelineTitle}>
              {mood || "Timeline Journal"}
            </Text>
            <Text style={styles.timelineSub}>
              Capture your day, mood and progress notes
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.dashboardContainer}>
          <View style={styles.dualCardRow}>
            {/* ── Calorie Ring Card ── */}
            <TouchableOpacity
              style={styles.insightMetricCard}
              onPress={() => navigation.navigate("Home")}
              activeOpacity={0.85}
            >
              <View style={styles.insightMetricTop}>
                <View style={styles.insightMetricIcon}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.insightMetricTitle}>Calories</Text>
              </View>

              <View style={styles.calorieRingWrap}>
                <Svg width={110} height={110} viewBox="0 0 110 110">
                  {/* Outer Ring (Emerald Green, 75% filled) */}
                  <Circle
                    cx="55"
                    cy="55"
                    r="47"
                    stroke="transparent"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <Circle
                    cx="55"
                    cy="55"
                    r="47"
                    stroke="#3E7974"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={295.31}
                    strokeDashoffset={295.31 * 0.25}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                  />
                  {/* Inner Ring (Primary Teal/Green, 60% filled) */}
                  <Circle
                    cx="55"
                    cy="55"
                    r="37"
                    stroke="transparent"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <Circle
                    cx="55"
                    cy="55"
                    r="37"
                    stroke={COLORS.primaryLight}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={232.48}
                    strokeDashoffset={232.48 * 0.4}
                    strokeLinecap="round"
                    transform="rotate(-90 55 55)"
                  />
                </Svg>
                <View style={styles.ringCenter}>
                  <Text style={styles.ringCalValue}>{calories}</Text>
                  <Text style={styles.ringCalLabel}>kcal</Text>
                </View>
              </View>

              <Text style={styles.proteinGoalText}>
                Protein Goal: {macro_targets.protein_g}g
              </Text>
            </TouchableOpacity>

            {/* ── Daily Note Card ── */}
            <View style={styles.insightMetricCardSoft}>
              <View style={styles.insightMetricTop}>
                <View style={styles.metricIconShellSoft}>
                  <MaterialCommunityIcons
                    name="format-quote-close"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.insightMetricTitle}>Daily Note</Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 4 }}>
                <Text style={styles.quotePreview}>{quote}</Text>
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            style={styles.hydrationCardCustom}
            onPress={() => navigation.navigate("HydrationTrackerScreen")}
            activeOpacity={0.9}
          >
            <View style={styles.hydrationHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>Recovery</Text>
                <Text style={styles.hydrationTitle}>Hydration</Text>
              </View>
              <View style={styles.hydrationPercentPill}>
                <Text style={styles.hydrationPercentPillText}>
                  {hydrationPercent}%
                </Text>
              </View>
            </View>

            <View style={styles.hydrationCardContent}>
              <View style={styles.hydrationProgressContainer}>
                <View style={styles.hydrationBottleOuter}>
                  <Animated.View
                    style={[
                      styles.hydrationBottleFill,
                      {
                        height: animatedBottleFillHeight,
                        minHeight: 0,
                      },
                    ]}
                  />
                  <View style={styles.hydrationIconPercentageContainer}>
                    <MaterialCommunityIcons
                      name="water-outline"
                      size={24}
                      color={COLORS.primary}
                      style={styles.hydrationDropIcon}
                    />
                    <Text style={styles.hydrationPercentage}>
                      {hydrationLoading ? "0%" : `${hydrationPercent}%`}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.hydrationDetailsSection}>
                <Text style={styles.hydrationGoal}>
                  {hydrationLoading
                    ? "--"
                    : `${currentIntake.toFixed(1)}L / ${dailyGoal.toFixed(1)}L`}
                </Text>
                <Text style={styles.hydrationSubText}>
                  Tap quick add or open the full tracker
                </Text>

                <View style={styles.hydrationBtnsRow}>
                  <TouchableOpacity
                    style={styles.hydrationBtnPrimary}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddWater(250);
                    }}
                  >
                    <Text style={styles.hydrationBtnPrimaryText}>+250ml</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.hydrationBtnSecondary}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddWater(500);
                    }}
                  >
                    <Text style={styles.hydrationBtnSecondaryText}>+500ml</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.twoColumnInsightRow}>
            <TouchableOpacity
              style={styles.insightMetricCard}
              onPress={() => navigation.navigate("AICoachScreen")}
              activeOpacity={0.85}
            >
              <View style={styles.insightMetricTop}>
                <View style={styles.insightMetricIcon}>
                  <Ionicons
                    name="sparkles"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.insightMetricTitle}>AI Coach</Text>
              </View>
              <View style={[styles.insightBadge, { backgroundColor: isDark ? '#2D235C' : '#F0E6FF' }]}>
                <Text style={[styles.insightBadgeText, { color: isDark ? '#A78BFA' : '#7B61FF' }]}>Smart</Text>
              </View>
              <Text style={[styles.insightMetricValue, { fontSize: 22 }]}>
                Ask Calk
              </Text>
              <Text style={styles.insightMetricSub}>
                Food logging & advice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.insightMetricCard}
              onPress={() => navigation.navigate("SleepTrackerScreen")}
              activeOpacity={0.85}
            >
              <View style={styles.insightMetricTop}>
                <View style={styles.insightMetricIcon}>
                  <MaterialCommunityIcons
                    name="moon-waning-crescent"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.insightMetricTitle}>Sleep</Text>
              </View>
              <View style={styles.insightBadge}>
                <Text style={styles.insightBadgeText}>
                  {todaySleepPercent}% of {sleepGoal}h
                </Text>
              </View>
              <Text style={styles.insightMetricValue}>
                {todaySleepDuration}
              </Text>
              <Text style={styles.insightMetricSub}>Rest quality snapshot</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightJourneyCardV2}>
            <View style={styles.weightHeaderRow}>
              <View style={styles.weightHeaderLeft}>
                <View style={styles.weightIconShell}>
                  <MaterialCommunityIcons
                    name="scale-bathroom"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View>
                  <Text style={styles.sectionEyebrow}>Body metrics</Text>
                  <Text style={styles.weightJourneyLabelV2}>
                    Weight Journey
                  </Text>
                </View>
              </View>
              <Ionicons
                name="trending-up-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.weightDataRow}>
              <View style={styles.weightDataBox}>
                <Text style={styles.weightJourneySubV2}>Current</Text>
                <Text style={styles.weightJourneyCurrentV2}>
                  {currentWeight ? `${currentWeight} kg` : "--"}
                </Text>
              </View>
              <View style={styles.weightDataBoxRight}>
                <Text style={styles.weightJourneySubV2}>Goal</Text>
                <Text style={styles.weightJourneyGoalV2}>
                  {goalWeight ? `${goalWeight} kg` : "--"}
                </Text>
              </View>
            </View>

            <View style={styles.weightJourneyBarBgV2}>
              <View
                style={[
                  styles.weightJourneyBarFillV2,
                  { width: `${Math.max(2, progressPercentage)}%` },
                ]}
              />
            </View>

            {goalAchieved ? (
              <View style={styles.congratulationsContainer}>
                <Text style={styles.congratulationsText}>Goal achieved</Text>
                <Text style={styles.progressText}>
                  You&apos;ve reached your target weight of {goalWeight || "--"}{" "}
                  kg
                </Text>
              </View>
            ) : (
              <Text style={styles.progressText}>
                {progressPercentage}% towards goal
              </Text>
            )}

            <TouchableOpacity
              style={styles.weightJourneyBtnV2}
              onPress={() => navigation.navigate("WeightTrackerScreen")}
            >
              <Text style={styles.weightJourneyBtnTextV2}>View Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <FooterBar navigation={navigation} activeTab="Home" />
    </SafeAreaView>
  );
};

const createStyles = (COLORS, isDark) => {
  const SHADOW = createShadowStyles(COLORS, isDark);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: COLORS.background,
    },

    scrollContent: {
      paddingBottom: 32,
      backgroundColor: COLORS.background,
    },

    heroCard: {
      backgroundColor: COLORS.greetingCardBg,
      marginHorizontal: 18,
      marginTop: 20,
      marginBottom: 14,
      padding: 20,
      borderRadius: 30,
      ...SHADOW.lg,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 18,
    },

    heroEyebrow: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.heroMuted,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 8,
    },

    greetingCardTitle: {
      fontSize: 28,
      fontFamily: "Lexend-Bold",
      color: COLORS.heroText,
      marginBottom: 6,
    },

    heroSubtitle: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: COLORS.heroMuted,
      lineHeight: 21,
      paddingRight: 10,
    },

    heroProgressRing: {
      width: 74,
      height: 74,
      borderRadius: 22,
      backgroundColor: COLORS.heroChip,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: COLORS.heroChipBorder,
    },

    heroProgressValue: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: COLORS.heroText,
    },

    heroProgressLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: COLORS.heroMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },

    heroMetricsRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.heroRow,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: COLORS.heroRowBorder,
    },

    heroMetric: {
      flex: 1,
      alignItems: "center",
    },

    heroMetricLabel: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: COLORS.heroMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 4,
    },

    heroMetricValue: {
      fontSize: 18,
      fontFamily: "Lexend-Bold",
      color: COLORS.heroText,
    },

    heroMetricDivider: {
      width: 1,
      height: 28,
      backgroundColor: COLORS.heroDivider,
    },

    checkInRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },

    checkInButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: COLORS.card,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.cardBorderStrong,
      alignSelf: "flex-start",
    },

    checkInButtonText: {
      fontSize: 14,
      fontFamily: "Lexend-Medium",
      color: COLORS.primary,
      marginLeft: 8,
    },

    timelineBanner: {
      marginHorizontal: 18,
      marginBottom: 16,
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      flexDirection: "row",
      alignItems: "center",
      ...SHADOW.md,
    },

    timelineIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },

    timelineTitle: {
      fontSize: 17,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
      marginBottom: 2,
    },

    timelineSub: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: COLORS.secondary,
    },

    dashboardContainer: {
      marginHorizontal: 18,
      marginBottom: 12,
    },

    featureCard: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      marginBottom: 14,
      ...SHADOW.md,
    },

    featureCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
      gap: 10,
    },

    featureTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    featureIconShell: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    featureEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: COLORS.secondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 2,
    },

    featureTitle: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
    },

    featureActionPill: {
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 14,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
    },

    featureActionText: {
      fontSize: 12,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.primary,
    },

    featureStatsRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 16,
    },

    featureValue: {
      fontSize: 36,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
    },

    featureSlash: {
      fontSize: 26,
      fontFamily: "Lexend-Regular",
      color: COLORS.muted,
      marginHorizontal: 8,
      marginBottom: 4,
    },

    featureTarget: {
      fontSize: 24,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.secondary,
      marginBottom: 4,
    },

    featureProgressTrack: {
      height: 12,
      backgroundColor: COLORS.surfaceMuted,
      borderRadius: 999,
      overflow: "hidden",
      marginBottom: 14,
    },

    featureProgressFill: {
      height: 12,
      backgroundColor: COLORS.primary,
      borderRadius: 999,
    },

    featureBottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },

    featureMeta: {
      fontSize: 13,
      fontFamily: "Manrope-Medium",
      color: COLORS.secondary,
    },

    dualCardRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },

    metricCard: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      ...SHADOW.sm,
    },

    metricCardSoft: {
      flex: 1,
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
    },

    metricCardTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },

    metricIconShell: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    metricIconShellSoft: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor:"#fff",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    metricCardLabel: {
      fontSize: 15,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.text,
    },

    metricCardValue: {
      fontSize: 32,
      fontFamily: "Lexend-Bold",
      color: COLORS.primary,
      marginBottom: 4,
    },

    metricCardSub: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: COLORS.secondary,
    },

    // ── Calorie Ring Card ──────────────────────────────────────────────────
    calorieRingWrap: {
      width: 110,
      height: 110,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginTop: -16,
    },
    ringCenter: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    ringCalValue: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
      lineHeight: 24,
      textAlign: "center",
    },
    ringCalLabel: {
      fontSize: 10,
      fontFamily: "Manrope-Medium",
      color: COLORS.secondary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
      lineHeight: 12,
      marginTop: 1,
    },
    proteinGoalText: {
      position: "absolute",
      bottom: 5,
      right: 16,
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: COLORS.secondary,
    },

    quotePreview: {
      fontSize: 15,
      fontFamily: "Manrope-Medium",
      color: COLORS.text,
      lineHeight: 22,
    },

    hydrationCardCustom: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      marginBottom: 14,
      ...SHADOW.md,
    },

    hydrationHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },

    sectionEyebrow: {
      fontSize: 11,
      fontFamily: "Manrope-SemiBold",
      color: COLORS.secondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 4,
    },

    hydrationTitle: {
      fontSize: 22,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
    },

    hydrationPercentPill: {
      backgroundColor: COLORS.primarySoft,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.primarySoftBorder,
    },

    hydrationPercentPillText: {
      fontSize: 13,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.primary,
    },

    hydrationCardContent: {
      flexDirection: "row",
      alignItems: "center",
    },

    hydrationProgressContainer: {
      marginRight: 20,
    },

    hydrationBottleOuter: {
      width: 72,
      height: 132,
      backgroundColor: COLORS.surfaceMuted,
      borderRadius: 26,
      overflow: "hidden",
      position: "relative",
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
    },

    hydrationBottleFill: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: COLORS.primaryLight,
    },

    hydrationIconPercentageContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },

    hydrationDropIcon: {
      marginBottom: 4,
    },

    hydrationPercentage: {
      fontFamily: "Lexend-Bold",
      fontSize: 14,
      color: COLORS.primary,
    },

    hydrationDetailsSection: {
      flex: 1,
    },

    hydrationGoal: {
      fontSize: 22,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
      marginBottom: 6,
    },

    hydrationSubText: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: COLORS.secondary,
      marginBottom: 16,
      lineHeight: 20,
    },

    hydrationBtnsRow: {
      flexDirection: "row",
      gap: 10,
    },

    hydrationBtnPrimary: {
      flex: 1,
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: "center",
    },

    hydrationBtnPrimaryText: {
      color: COLORS.buttonText,
      fontFamily: "Lexend-SemiBold",
      fontSize: 14,
    },

    hydrationBtnSecondary: {
      flex: 1,
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.cardBorderStrong,
    },

    hydrationBtnSecondaryText: {
      color: COLORS.primary,
      fontFamily: "Lexend-SemiBold",
      fontSize: 14,
    },

    twoColumnInsightRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },

    insightMetricCard: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      ...SHADOW.sm,
      minHeight: 185,
    },

    insightMetricCardSoft: {
      flex: 1,
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      minHeight: 185,
    },

    insightMetricTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },

    insightMetricIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },

    insightMetricTitle: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 16,
      color: COLORS.text,
    },

    insightBadge: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: COLORS.cardSecondary,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      marginBottom: 14,
    },

    insightBadgeText: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 12,
      color: COLORS.primary,
    },

    insightMetricValue: {
      fontFamily: "Lexend-Bold",
      fontSize: 28,
      color: COLORS.text,
      marginBottom: 4,
    },

    insightMetricSub: {
      fontFamily: "Manrope-Regular",
      fontSize: 13,
      color: COLORS.secondary,
      lineHeight: 19,
    },

    weightJourneyCardV2: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      ...SHADOW.md,
      marginBottom: 8,
    },

    weightHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },

    weightHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
    },

    weightIconShell: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    weightJourneyLabelV2: {
      fontFamily: "Lexend-Bold",
      fontSize: 20,
      color: COLORS.text,
    },

    weightDataRow: {
      flexDirection: "row",
      marginBottom: 16,
      gap: 12,
    },

    weightDataBox: {
      flex: 1,
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
    },

    weightDataBoxRight: {
      flex: 1,
      backgroundColor: COLORS.primarySoft,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.primarySoftBorder,
      alignItems: "flex-end",
    },

    weightJourneySubV2: {
      fontFamily: "Manrope-Medium",
      fontSize: 13,
      color: COLORS.secondary,
      marginBottom: 4,
    },

    weightJourneyCurrentV2: {
      fontFamily: "Lexend-Bold",
      fontSize: 24,
      color: COLORS.text,
    },

    weightJourneyGoalV2: {
      fontFamily: "Lexend-Bold",
      fontSize: 24,
      color: COLORS.primary,
    },

    weightJourneyBarBgV2: {
      height: 12,
      backgroundColor: COLORS.surfaceMuted,
      borderRadius: 999,
      marginBottom: 14,
      overflow: "hidden",
    },

    weightJourneyBarFillV2: {
      height: 12,
      backgroundColor: COLORS.primary,
      borderRadius: 999,
    },

    progressText: {
      fontSize: 13,
      fontFamily: "Manrope-Medium",
      color: COLORS.neutralSecondary,
      textAlign: "center",
      marginTop: 2,
      marginBottom: 12,
    },

    congratulationsContainer: {
      alignItems: "center",
      marginTop: 2,
      marginBottom: 12,
    },

    congratulationsText: {
      fontSize: 15,
      fontFamily: "Lexend-Bold",
      color: COLORS.primary,
      textAlign: "center",
      marginBottom: 4,
    },

    weightJourneyBtnV2: {
      backgroundColor: COLORS.primary,
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: "center",
    },

    weightJourneyBtnTextV2: {
      color: COLORS.buttonText,
      fontFamily: "Lexend-SemiBold",
      fontSize: 16,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(8, 24, 22, 0.32)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },

    goalsModalContainer: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      width: "100%",
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      ...SHADOW.lg,
    },

    goalsModalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    goalsModalTitle: {
      fontSize: 20,
      fontFamily: "Lexend-Bold",
      color: COLORS.text,
      flex: 1,
      paddingRight: 12,
    },

    goalsModalCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: COLORS.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },

    goalsModalContent: {
      maxHeight: 420,
      paddingHorizontal: 20,
    },

    goalSection: {
      marginVertical: 12,
    },

    goalSectionTitle: {
      fontSize: 16,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.text,
      marginBottom: 8,
    },

    calorieGoalCard: {
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.primarySoftBorder,
    },

    calorieGoalRange: {
      fontSize: 19,
      fontFamily: "Lexend-Bold",
      color: COLORS.primary,
      marginBottom: 4,
    },

    calorieGoalTarget: {
      fontSize: 14,
      fontFamily: "Manrope-Medium",
      color: COLORS.secondary,
      marginBottom: 8,
    },

    calorieGoalMessage: {
      fontSize: 14,
      fontFamily: "Manrope-Regular",
      color: COLORS.secondary,
      lineHeight: 21,
    },

    checkInSummaryCard: {
      backgroundColor: COLORS.cardSecondary,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    checkInSummaryText: {
      fontSize: 14,
      fontFamily: "Manrope-Medium",
      color: COLORS.text,
      marginBottom: 6,
    },

    insightCard: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: COLORS.primarySoftBorder,
    },

    insightText: {
      fontSize: 13,
      fontFamily: "Manrope-Regular",
      color: COLORS.secondary,
      lineHeight: 19,
    },

    goalsModalButton: {
      backgroundColor: COLORS.primary,
      marginHorizontal: 20,
      marginVertical: 20,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },

    goalsModalButtonText: {
      fontSize: 16,
      fontFamily: "Lexend-SemiBold",
      color: COLORS.buttonText,
    },
  });
};

const createShadowStyles = (COLORS, isDark) => ({
  sm: {
    shadowColor: isDark ? "#000" : "#163D39",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.22 : 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  md: {
    shadowColor: isDark ? "#000" : "#163D39",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.28 : 0.1,
    shadowRadius: 22,
    elevation: 5,
  },
  lg: {
    shadowColor: isDark ? "#000" : "#163D39",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: isDark ? 0.34 : 0.13,
    shadowRadius: 28,
    elevation: 8,
  },
});

const createFooterStyles = (colors, isDark) =>
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
      backgroundColor: isDark
        ? "rgba(27, 57, 54, 0.96)"
        : "rgba(244, 251, 250, 0.98)",
      borderRadius: 28,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(168, 213, 206, 0.18)" : "#D7EAE6",
      shadowColor: isDark ? "#000" : "#1F4E4A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.28 : 0.12,
      shadowRadius: 20,
      elevation: 12,
      ...(Platform.OS === "ios" && {
        backgroundColor: isDark
          ? "rgba(27, 57, 54, 0.92)"
          : "rgba(244, 251, 250, 0.92)",
      }),
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
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
      backgroundColor: isDark ? "rgba(168, 213, 206, 0.12)" : "#E6F3F1",
    },
    label: {
      fontSize: 11,
      marginTop: 4,
      color: isDark ? "#B9D4CF" : "#6C8883",
      fontFamily: "Manrope-SemiBold",
    },
    activeLabel: {
      color: "#1F4E4A",
      fontFamily: "Lexend-SemiBold",
    },
  });

const createStreakStyles = (colors, isDark) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(168, 213, 206, 0.12)" : "#E4F3F0",
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "rgba(168, 213, 206, 0.18)" : "#CFE7E2",
    },
    emoji: {
      fontSize: 14,
      marginRight: 5,
    },
    text: {
      fontFamily: "Lexend-SemiBold",
      fontSize: 12,
      color: isDark ? "#EAF7F5" : "#1F4E4A",
    },
  });

const createPalette = (colors, isDark) => ({
  primary: "#1F4E4A",
  primaryLight: isDark ? "#4F8E88" : "#A8D5CE",
  primarySoft: isDark ? "rgba(168, 213, 206, 0.10)" : "#E4F3F0",
  primarySoftBorder: isDark ? "rgba(168, 213, 206, 0.18)" : "#CFE7E2",
  background: isDark ? "#102725" : "#F4FBFA",
  card: isDark ? "#173330" : "#FFFFFF",
  cardSecondary: isDark ? "#1B3B38" : "#EEF7F5",
  cardBorder: isDark ? "rgba(168, 213, 206, 0.12)" : "#D5E8E3",
  cardBorderStrong: isDark ? "rgba(168, 213, 206, 0.22)" : "#C5E0DA",
  surfaceMuted: isDark ? "#214542" : "#DCEEEA",
  border: isDark ? "#2A5551" : "#D5E8E3",
  text: isDark ? "#EAF7F5" : "#163633",
  secondary: isDark ? "#B4D1CB" : "#5B7873",
  muted: isDark ? "#8FB2AC" : "#7D9994",
  neutralSecondary: isDark ? "#B4D1CB" : "#6C8883",
  neutralIcon: isDark ? "#C7E0DB" : "#6C8883",
  greetingCardBg: isDark ? "#163532" : "#1F4E4A",
  heroText: "#F4FBFA",
  heroMuted: "rgba(244, 251, 250, 0.78)",
  heroChip: "rgba(244, 251, 250, 0.08)",
  heroChipBorder: "rgba(244, 251, 250, 0.14)",
  heroRow: "rgba(244, 251, 250, 0.06)",
  heroRowBorder: "rgba(244, 251, 250, 0.10)",
  heroDivider: "rgba(244, 251, 250, 0.12)",
  buttonText: "#F4FBFA",
});

export default React.memo(MainDashboardScreen);
