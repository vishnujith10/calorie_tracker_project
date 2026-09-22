import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { OnboardingContext } from '../context/OnboardingContext';
import { useTheme } from '../context/ThemeContext';
import supabase from '../lib/supabase';
import { getFoodLogs } from '../utils/api';

// Safe dynamic imports for optional native libraries
let MediaLibrary = null;
let Sharing = null;
let ViewShotComponent = View;
let captureRef = null;

try {
  MediaLibrary = require('expo-media-library');
} catch (e) {}

try {
  Sharing = require('expo-sharing');
} catch (e) {}

try {
  const vs = require('react-native-view-shot');
  ViewShotComponent = vs.default || vs;
  captureRef = vs.captureRef;
} catch (e) {}

// ─── Gemini Setup ────────────────────────────────────────────────────────────
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CACHE_KEY_PREFIX = '@calora_summary_cache_';
const SCORE_RING_SIZE = 90;
const SCORE_RING_STROKE = 8;
const SCORE_RING_RADIUS = (SCORE_RING_SIZE - SCORE_RING_STROKE) / 2;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDisplay() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function parseIntervalToMinutes(interval) {
  if (!interval || typeof interval !== 'string') return 0;
  const clean = interval.trim();
  if (!clean.includes(':')) return 0;
  const [h, m] = clean.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// ─── Score Ring Component ────────────────────────────────────────────────────
const ScoreRing = ({ score, size = SCORE_RING_SIZE, strokeWidth = SCORE_RING_STROKE, palette }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const strokeDashoffset = circumference * (1 - progress);

  const getScoreColor = (s) => {
    if (s >= 80) return '#0D786A';
    if (s >= 60) return '#E8A317';
    return '#D94F3D';
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.border || '#E5F2F0'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{
          fontSize: 26,
          fontFamily: 'Lexend-Bold',
          color: palette.textPrimary,
        }}>
          {score}
        </Text>
        <Text style={{
          fontSize: 11,
          fontFamily: 'Lexend-Regular',
          color: palette.textSecondary,
          marginTop: -2,
        }}>
          /100
        </Text>
      </View>
    </View>
  );
};

// ─── Pace Bar Component ──────────────────────────────────────────────────────
const PaceBar = ({ pace, palette }) => {
  const paces = ['Slow', 'Optimal', 'Too Fast'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {paces.map((p) => {
        const isActive = p.toLowerCase() === (pace || 'optimal').toLowerCase();
        return (
          <TouchableOpacity
            key={p}
            activeOpacity={1}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? palette.primary : (palette.cardAlt || '#F4FAF9'),
              alignItems: 'center',
              borderWidth: isActive ? 0 : 1,
              borderColor: palette.border || '#E5F2F0',
            }}
          >
            <Text style={{
              fontSize: 13,
              fontFamily: isActive ? 'Lexend-SemiBold' : 'Lexend-Regular',
              color: isActive ? '#FFFFFF' : palette.textSecondary,
            }}>
              {p}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Tip Icon Mapper ─────────────────────────────────────────────────────────
const getTipIcon = (category) => {
  const map = {
    hydration: 'water-outline',
    water: 'water-outline',
    sleep: 'moon-outline',
    protein: 'fitness-outline',
    workout: 'barbell-outline',
    exercise: 'barbell-outline',
    calories: 'flame-outline',
    food: 'restaurant-outline',
    meal: 'restaurant-outline',
    snack: 'cafe-outline',
    fasting: 'time-outline',
    weight: 'scale-outline',
    stress: 'leaf-outline',
    mindfulness: 'leaf-outline',
    consistency: 'trophy-outline',
    streak: 'flame-outline',
  };

  if (!category) return 'bulb-outline';
  const lower = category.toLowerCase();
  for (const [key, icon] of Object.entries(map)) {
    if (lower.includes(key)) return icon;
  }
  return 'bulb-outline';
};

// ─── Build AI Prompt ─────────────────────────────────────────────────────────
function buildPrompt(data) {
  return `You are Calora AI, a health and nutrition assistant. Analyze the user's YESTERDAY data and produce a JSON summary.

USER PROFILE:
- Name: ${data.profile.name || 'User'}
- Age: ${data.profile.age || 'Unknown'}
- Gender: ${data.profile.gender || 'Unknown'}
- Weight: ${data.profile.weight || 'Unknown'} kg
- Target Weight: ${data.profile.target_weight || 'Unknown'} kg
- Goal: ${data.profile.goal_focus || 'maintain'}
- Activity Level: ${data.profile.daily_activity_level || 'moderate'}
- Calorie Goal: ${data.calorieGoal || 'Unknown'} kcal

YESTERDAY'S DATA (${data.date}):
- Calories consumed: ${data.calories} kcal (${data.mealsLogged} meals logged)
- Macros: Protein ${data.protein}g, Carbs ${data.carbs}g, Fat ${data.fat}g
- Hydration: ${data.hydration}L / ${data.hydrationGoal}L target
- Sleep: ${data.sleepMinutes > 0 ? `${Math.floor(data.sleepMinutes / 60)}h ${data.sleepMinutes % 60}m` : 'Not logged'}${data.sleepQuality ? `, Quality: ${data.sleepQuality}` : ''}
- Current Streak: ${data.streak} days
- Weight trend: ${data.weightTrend || 'No recent data'}

Respond ONLY with valid JSON (no markdown, no backticks) in this exact format:
{
  "overallScore": <number 0-100>,
  "scoreLabel": "<Excellent Day|Good Day|Average Day|Needs Improvement>",
  "statusBadge": "<Optimal Pace 🚀|On Track 💪|Needs Attention ⚠️|Slow Progress 🐢>",
  "executiveSummary": "<2-3 sentence warm, encouraging summary of yesterday>",
  "paceAssessment": {
    "pace": "<Slow|Optimal|Too Fast>",
    "explanation": "<2-3 sentence explanation of weight loss/gain pace and safety>"
  },
  "tips": [
    {
      "category": "<hydration|sleep|protein|calories|fasting|consistency|exercise|meal|snack|stress|weight>",
      "title": "<short title>",
      "description": "<1-2 sentence actionable tip>"
    }
  ]
}

Generate 3-6 tips depending on how many areas need improvement. Focus on:
- Areas where the user fell short yesterday
- Positive reinforcement for good habits
- Specific, actionable advice based on their actual numbers
- Their goal type (${data.profile.goal_focus || 'maintain'}) and progress pace`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
const SummaryScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { onboardingData } = useContext(OnboardingContext);

  const palette = useMemo(() => ({
    primary: isDark ? '#34C6B3' : '#0D786A',
    primaryLight: isDark ? '#1A3D3A' : '#EAF8F6',
    background: isDark ? '#0D1B19' : '#FAFCFC',
    card: isDark ? '#152422' : '#FFFFFF',
    cardAlt: isDark ? '#1A2E2A' : '#F4FAF9',
    border: isDark ? '#243634' : '#E5F2F0',
    textPrimary: isDark ? '#E8F5F3' : '#0D1F1C',
    textSecondary: isDark ? '#8CB5AD' : '#4A6662',
    textTertiary: isDark ? '#5A857D' : '#8CA39F',
    shadow: isDark ? '#000000' : '#0D786A',
  }), [isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const viewShotRef = React.useRef(null);
  const [aiData, setAiData] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [error, setError] = useState(null);
  const [noData, setNoData] = useState(false);

  const yesterdayDate = useMemo(() => getYesterdayStr(), []);
  const yesterdayDisplay = useMemo(() => getYesterdayDisplay(), []);

  // ── Fetch yesterday's data from Supabase ──
  const fetchYesterdayData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const userId = user.id;
      const yesterdayStart = new Date(yesterdayDate + 'T00:00:00');
      const yesterdayEnd = new Date(yesterdayDate + 'T23:59:59.999');

      const [foodLogs, hydrationData, sleepData, weightData, streakData, profileData] = await Promise.all([
        getFoodLogs(userId),
        supabase
          .from('daily_water_intake')
          .select('*')
          .eq('user_id', userId)
          .eq('date', yesterdayDate)
          .maybeSingle(),
        supabase
          .from('sleep_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('date', yesterdayDate)
          .maybeSingle(),
        supabase
          .from('weight_logs')
          .select('weight, date')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(5),
        supabase
          .from('streaks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_profile')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
      ]);

      // Filter food logs for yesterday
      const yesterdayLogs = (foodLogs || []).filter((log) => {
        const logDate = new Date(log.created_at).toISOString().slice(0, 10);
        return logDate === yesterdayDate;
      });

      const totalCalories = yesterdayLogs.reduce((sum, l) => sum + (l.calories || 0), 0);
      const totalProtein = yesterdayLogs.reduce((sum, l) => sum + (l.protein || 0), 0);
      const totalCarbs = yesterdayLogs.reduce((sum, l) => sum + (l.carbs || 0), 0);
      const totalFat = yesterdayLogs.reduce((sum, l) => sum + (l.fat || 0), 0);

      // Check if there's any data at all
      if (yesterdayLogs.length === 0 && !hydrationData.data && !sleepData.data) {
        setNoData(true);
        setLoading(false);
        return null;
      }

      // Hydration
      const hydrationLiters = hydrationData.data
        ? (hydrationData.data.current_intake_ml || 0) / 1000
        : 0;
      const hydrationGoalLiters = hydrationData.data
        ? (hydrationData.data.daily_goal_ml || 2500) / 1000
        : 2.5;

      // Sleep
      let sleepMinutes = 0;
      let sleepQuality = '';
      if (sleepData.data) {
        if (sleepData.data.duration) {
          sleepMinutes = parseIntervalToMinutes(sleepData.data.duration);
        } else if (sleepData.data.start_time && sleepData.data.end_time) {
          const [sh, sm] = sleepData.data.start_time.split(':').map(Number);
          const [eh, em] = sleepData.data.end_time.split(':').map(Number);
          let mins = eh * 60 + em - (sh * 60 + sm);
          if (mins < 0) mins += 24 * 60;
          sleepMinutes = mins;
        }
        sleepQuality = sleepData.data.quality || '';
      }

      // Weight trend
      const weightLogs = weightData.data || [];
      let weightTrend = 'No recent data';
      if (weightLogs.length >= 2) {
        const latest = Number(weightLogs[0].weight);
        const prev = Number(weightLogs[1].weight);
        const diff = (latest - prev).toFixed(1);
        weightTrend = diff > 0 ? `+${diff} kg recently` : `${diff} kg recently`;
      } else if (weightLogs.length === 1) {
        weightTrend = `Current: ${weightLogs[0].weight} kg`;
      }

      // Streak
      const streak = streakData.data?.streak || 0;

      // Profile
      const profile = profileData.data || onboardingData || {};

      // Calorie goal calculation
      let calorieGoal = profile.calorie_goal || onboardingData?.calorie_goal;
      if (!calorieGoal) {
        const w = Number(profile.weight) || 60;
        const h = Number(profile.height) || 165;
        const a = Number(profile.age) || 25;
        const g = (profile.gender || 'female').toLowerCase();
        const bmr = g === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
        const actMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 };
        const tdee = bmr * (actMult[(profile.daily_activity_level || 'moderate').toLowerCase()] || 1.55);
        let gt = (profile.goal_focus || 'maintain').toLowerCase();
        if (gt.includes('lose')) calorieGoal = Math.round(tdee * 0.85);
        else if (gt.includes('gain')) calorieGoal = Math.round(tdee * 1.1);
        else calorieGoal = Math.round(tdee);
      }

      const result = {
        date: yesterdayDate,
        calories: totalCalories,
        mealsLogged: yesterdayLogs.length,
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        calorieGoal: Math.round(calorieGoal),
        hydration: Math.round(hydrationLiters * 10) / 10,
        hydrationGoal: Math.round(hydrationGoalLiters * 10) / 10,
        sleepMinutes,
        sleepQuality,
        streak,
        weightTrend,
        profile: {
          name: profile.name || onboardingData?.name || 'User',
          age: profile.age || onboardingData?.age,
          gender: profile.gender || onboardingData?.gender,
          weight: profile.weight || onboardingData?.weight,
          target_weight: profile.target_weight || onboardingData?.target_weight,
          goal_focus: profile.goal_focus || onboardingData?.goal_focus,
          daily_activity_level: profile.daily_activity_level || onboardingData?.daily_activity_level,
        },
      };

      setRawData(result);
      return result;
    } catch (err) {
      console.error('Error fetching yesterday data:', err);
      throw err;
    }
  }, [yesterdayDate, onboardingData]);

  // ── Generate AI Summary ──
  const generateAISummary = useCallback(async (data) => {
    if (!genAI) throw new Error('Gemini API not configured');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = buildPrompt(data);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // Clean potential markdown code fences
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(text);
    return parsed;
  }, []);

  // ── Load data with caching ──
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setNoData(false);

      // Check cache first
      const cacheKey = CACHE_KEY_PREFIX + yesterdayDate;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setAiData(parsed.aiData);
        setRawData(parsed.rawData);
        setLoading(false);
        return;
      }

      // Fetch fresh data
      const data = await fetchYesterdayData();
      if (!data) return; // noData state already set

      // Generate AI summary
      const aiResult = await generateAISummary(data);
      setAiData(aiResult);

      // Cache for the day
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        aiData: aiResult,
        rawData: data,
        timestamp: Date.now(),
      }));

      setLoading(false);
    } catch (err) {
      console.error('Error loading summary:', err);
      setError(err.message || 'Failed to generate summary');
      setLoading(false);
    }
  }, [yesterdayDate, fetchYesterdayData, generateAISummary]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  // ── Download Image Snapshot Handler ──
  const handleDownload = async () => {
    if (!viewShotRef.current) return;
    try {
      setIsDownloading(true);
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 0.95,
        result: 'tmpfile',
      });

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.createAssetAsync(uri);
        Alert.alert(
          'Summary Saved! 📸',
          "Yesterday's Summary image has been saved to your Photos / Gallery."
        );
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert(
            'Permission Required',
            'Storage permission is required to save the image directly to your gallery.'
          );
        }
      }
    } catch (error) {
      console.error('Download summary error:', error);
      Alert.alert('Download Error', 'Could not save summary image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Styles ──
  const styles = useMemo(() => createStyles(palette, isDark, insets), [palette, isDark, insets]);

  // ── Render loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Yesterday's Summary</Text>
            <Text style={styles.headerSubtitle}>{yesterdayDisplay}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={styles.loadingText}>Analyzing yesterday's data...</Text>
          <Text style={styles.loadingSubtext}>Calora AI is generating your summary</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render no data ──
  if (noData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Yesterday's Summary</Text>
            <Text style={styles.headerSubtitle}>{yesterdayDisplay}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <Ionicons name="calendar-outline" size={56} color={palette.textTertiary} />
          <Text style={[styles.loadingText, { marginTop: 16 }]}>No Data Logged Yesterday</Text>
          <Text style={styles.loadingSubtext}>
            Start logging your meals, water, and sleep to get your daily AI summary!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render error ──
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={palette.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Yesterday's Summary</Text>
            <Text style={styles.headerSubtitle}>{yesterdayDisplay}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingWrap}>
          <Ionicons name="warning-outline" size={56} color="#D94F3D" />
          <Text style={[styles.loadingText, { marginTop: 16 }]}>Something went wrong</Text>
          <Text style={styles.loadingSubtext}>{error}</Text>
          <TouchableOpacity
            style={[styles.ctaButton, { marginTop: 20, width: 'auto', paddingHorizontal: 32 }]}
            onPress={loadSummary}
          >
            <Text style={styles.ctaText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Computed values ──
  const calPercent = rawData?.calorieGoal > 0
    ? Math.min(100, Math.round((rawData.calories / rawData.calorieGoal) * 100))
    : 0;
  const hydPercent = rawData?.hydrationGoal > 0
    ? Math.min(100, Math.round((rawData.hydration / rawData.hydrationGoal) * 100))
    : 0;
  const sleepHours = rawData?.sleepMinutes ? formatDuration(rawData.sleepMinutes) : '--';
  const hydGap = rawData?.hydrationGoal > rawData?.hydration
    ? Math.round((rawData.hydrationGoal - rawData.hydration) * 1000)
    : 0;

  // ── Main Render ──
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={palette.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Yesterday's Summary</Text>
          <Text style={styles.headerSubtitle}>{yesterdayDisplay} • Calora Mindful Diary</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Ionicons name="download-outline" size={22} color={palette.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <ViewShotComponent ref={viewShotRef} collapsable={false} options={{ format: 'png', quality: 0.95 }} style={{ backgroundColor: palette.background, paddingBottom: 16 }}>
        {/* ── Hero Score Card ── */}
        <View style={styles.heroCard}>
          {/* Status badges */}
          <View style={styles.heroBadgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{aiData?.statusBadge || 'On Track 💪'}</Text>
            </View>
            <View style={[styles.statusBadge, styles.aiBadge]}>
              <Ionicons name="sparkles" size={12} color={palette.primary} />
              <Text style={[styles.statusBadgeText, styles.aiBadgeText]}>Calora AI</Text>
            </View>
          </View>

          {/* Score + label */}
          <View style={styles.heroScoreRow}>
            <ScoreRing score={aiData?.overallScore || 0} palette={palette} />
            <View style={styles.heroScoreInfo}>
              <View style={styles.heroScoreLabelRow}>
                <Ionicons
                  name={(aiData?.overallScore || 0) >= 80 ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={(aiData?.overallScore || 0) >= 80 ? palette.primary : '#E8A317'}
                />
                <Text style={styles.heroScoreLabel}>{aiData?.scoreLabel || 'Good Day'}</Text>
              </View>
              <Text style={styles.heroScoreDesc} numberOfLines={3}>
                {aiData?.executiveSummary?.split('.').slice(0, 2).join('.') + '.' || 'Loading summary...'}
              </Text>
            </View>
          </View>

          {/* AI Synthesis */}
          <View style={styles.synthesisBubble}>
            <View style={styles.synthesisHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.primary} />
              <Text style={styles.synthesisLabel}>Calora Synthesis</Text>
            </View>
            <Text style={styles.synthesisText}>{aiData?.executiveSummary || ''}</Text>
          </View>
        </View>

        {/* ── Pillars Breakdown ── */}
        <Text style={styles.sectionTitle}>Pillars Breakdown</Text>

        <View style={styles.pillarsGrid}>
          {/* Intake Card */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="flame-outline" size={16} color={palette.primary} />
              <Text style={styles.pillarPercent}>{calPercent}%</Text>
            </View>
            <Text style={styles.pillarLabel}>Intake</Text>
            <Text style={styles.pillarValue}>
              {rawData?.calories?.toLocaleString() || '0'}
              <Text style={styles.pillarUnit}> / {rawData?.calorieGoal?.toLocaleString() || '0'}</Text>
            </Text>
            <View style={styles.pillarProgressBg}>
              <View style={[styles.pillarProgressFill, { width: `${Math.min(100, calPercent)}%` }]} />
            </View>
            <View style={styles.macroRow}>
              <Text style={styles.macroText}>P:{rawData?.protein || 0}g</Text>
              <Text style={styles.macroText}>C:{rawData?.carbs || 0}g</Text>
              <Text style={styles.macroText}>F:{rawData?.fat || 0}g</Text>
            </View>
          </View>

          {/* Hydration Card */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="water-outline" size={16} color="#3BA5E0" />
              <Text style={[styles.pillarPercent, { color: '#3BA5E0' }]}>{hydPercent}%</Text>
            </View>
            <Text style={styles.pillarLabel}>Hydration</Text>
            <Text style={styles.pillarValue}>
              {rawData?.hydration || '0'}L
              <Text style={styles.pillarUnit}> / {rawData?.hydrationGoal || '2.5'}L Target</Text>
            </Text>
            <View style={[styles.pillarProgressBg, { backgroundColor: isDark ? '#1A2E3A' : '#E3F0FA' }]}>
              <View style={[styles.pillarProgressFill, {
                width: `${Math.min(100, hydPercent)}%`,
                backgroundColor: '#3BA5E0',
              }]} />
            </View>
            {hydGap > 0 && (
              <Text style={[styles.macroText, { color: '#3BA5E0', marginTop: 4 }]}>
                ⓘ {hydGap}ml gap
              </Text>
            )}
          </View>

          {/* Sleep Card */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="moon-outline" size={16} color="#7C6DD8" />
              <Text style={[styles.pillarPercent, { color: '#7C6DD8' }]}>
                {rawData?.sleepMinutes > 0 ? `${Math.round((rawData.sleepMinutes / 480) * 100)}` : '0'} score
              </Text>
            </View>
            <Text style={styles.pillarLabel}>Sleep Log</Text>
            <Text style={styles.pillarValue}>{sleepHours}</Text>
            <View style={[styles.pillarProgressBg, { backgroundColor: isDark ? '#1E1A2E' : '#EDE8FA' }]}>
              <View style={[styles.pillarProgressFill, {
                width: `${Math.min(100, rawData?.sleepMinutes > 0 ? Math.round((rawData.sleepMinutes / 480) * 100) : 0)}%`,
                backgroundColor: '#7C6DD8',
              }]} />
            </View>
            {rawData?.sleepQuality ? (
              <Text style={[styles.macroText, { color: '#7C6DD8', marginTop: 4 }]}>
                {rawData.sleepQuality === 'Excellent' ? '😊' : rawData.sleepQuality === 'Good' ? '😌' : '😴'} {rawData.sleepQuality} Quality
              </Text>
            ) : null}
          </View>

          {/* Streak Card */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarHeader}>
              <Ionicons name="flame" size={16} color="#E8772E" />
              <View style={styles.streakBadge}>
                <Text style={styles.streakBadgeText}>Day {rawData?.streak || 0}</Text>
              </View>
            </View>
            <Text style={styles.pillarLabel}>Consistency</Text>
            <Text style={styles.pillarValue}>
              {rawData?.streak || 0}-Day Streak
            </Text>
            <Text style={[styles.macroText, { color: '#E8772E', marginTop: 6 }]}>
              ↕ {rawData?.weightTrend || 'No data'}
            </Text>
          </View>
        </View>

        {/* ── Pace & Behavioral Assessment ── */}
        <View style={styles.paceSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pulse-outline" size={18} color={palette.textPrimary} />
            <Text style={styles.sectionTitle}>Pace & Behavioral Assessment</Text>
          </View>

          <View style={styles.paceCard}>
            <PaceBar pace={aiData?.paceAssessment?.pace} palette={palette} />

            <View style={styles.validationCard}>
              <View style={styles.validationHeader}>
                <Ionicons name="shield-checkmark-outline" size={14} color={palette.primary} />
                <Text style={styles.validationLabel}>AI Health Validation</Text>
                <Text style={styles.validationDate}>Updated yesterday</Text>
              </View>
              <Text style={styles.validationText}>
                {aiData?.paceAssessment?.explanation || 'Assessment loading...'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Tips Section ── */}
        <View style={styles.tipsSection}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="bulb-outline" size={18} color={palette.textPrimary} />
            <Text style={styles.sectionTitle}>Tips for Today & Focus</Text>
            <View style={styles.tipCountBadge}>
              <Text style={styles.tipCountText}>
                {aiData?.tips?.length || 0} Action Items
              </Text>
            </View>
          </View>

          {(aiData?.tips || []).map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipIconWrap}>
                <Ionicons
                  name={getTipIcon(tip.category)}
                  size={20}
                  color={palette.primary}
                />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDesc}>{tip.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── CTA Button ── */}
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('MainDashboard')}
        >
          <Text style={styles.ctaText}>Apply Insights for Today</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 32 }} />
        </ViewShotComponent>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (palette, isDark, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 4 : 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: 'Lexend-Bold',
      color: palette.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: 'Lexend-Regular',
      color: palette.textTertiary,
      marginTop: 1,
    },
    headerRight: {
      width: 40,
    },
    shareBtn: {
      width: 40,
      height: 40,
      borderRadius: 16,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Loading
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    loadingText: {
      fontSize: 17,
      fontFamily: 'Lexend-SemiBold',
      color: palette.textPrimary,
      marginTop: 20,
      textAlign: 'center',
    },
    loadingSubtext: {
      fontSize: 14,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Scroll
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },

    // Hero Card
    heroCard: {
      backgroundColor: palette.primaryLight,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.border,
      marginBottom: 24,
    },
    heroBadgeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: palette.primary,
      gap: 4,
    },
    statusBadgeText: {
      fontSize: 12,
      fontFamily: 'Lexend-Medium',
      color: '#FFFFFF',
    },
    aiBadge: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
    },
    aiBadgeText: {
      color: palette.primary,
    },
    heroScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 16,
    },
    heroScoreInfo: {
      flex: 1,
    },
    heroScoreLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    heroScoreLabel: {
      fontSize: 18,
      fontFamily: 'Lexend-Bold',
      color: palette.textPrimary,
    },
    heroScoreDesc: {
      fontSize: 13,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      lineHeight: 19,
    },
    synthesisBubble: {
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    synthesisHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    synthesisLabel: {
      fontSize: 13,
      fontFamily: 'Lexend-SemiBold',
      color: palette.primary,
    },
    synthesisText: {
      fontSize: 13,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      lineHeight: 20,
    },

    // Sections
    sectionTitle: {
      fontSize: 17,
      fontFamily: 'Lexend-Bold',
      color: palette.textPrimary,
      marginBottom: 12,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },

    // Pillars Grid
    pillarsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
    },
    pillarCard: {
      width: (SCREEN_WIDTH - 44) / 2,
      backgroundColor: palette.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    pillarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    pillarPercent: {
      fontSize: 13,
      fontFamily: 'Lexend-SemiBold',
      color: palette.primary,
    },
    pillarLabel: {
      fontSize: 13,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      marginBottom: 2,
    },
    pillarValue: {
      fontSize: 16,
      fontFamily: 'Lexend-Bold',
      color: palette.textPrimary,
      marginBottom: 8,
    },
    pillarUnit: {
      fontSize: 12,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
    },
    pillarProgressBg: {
      height: 5,
      borderRadius: 3,
      backgroundColor: isDark ? '#1A2E2A' : '#E5F2F0',
      overflow: 'hidden',
    },
    pillarProgressFill: {
      height: 5,
      borderRadius: 3,
      backgroundColor: palette.primary,
    },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    macroText: {
      fontSize: 11,
      fontFamily: 'Lexend-Regular',
      color: palette.textTertiary,
    },
    streakBadge: {
      backgroundColor: isDark ? '#3A2410' : '#FEF0E1',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    streakBadgeText: {
      fontSize: 11,
      fontFamily: 'Lexend-SemiBold',
      color: '#E8772E',
    },

    // Pace Section
    paceSection: {
      marginBottom: 24,
    },
    paceCard: {
      backgroundColor: palette.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 14,
    },
    validationCard: {
      backgroundColor: palette.cardAlt,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    validationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    validationLabel: {
      fontSize: 13,
      fontFamily: 'Lexend-SemiBold',
      color: palette.primary,
      flex: 1,
    },
    validationDate: {
      fontSize: 11,
      fontFamily: 'Lexend-Regular',
      color: palette.textTertiary,
    },
    validationText: {
      fontSize: 13,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      lineHeight: 20,
    },

    // Tips Section
    tipsSection: {
      marginBottom: 24,
    },
    tipCountBadge: {
      backgroundColor: palette.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 3,
      marginLeft: 'auto',
    },
    tipCountText: {
      fontSize: 11,
      fontFamily: 'Lexend-SemiBold',
      color: palette.primary,
    },
    tipCard: {
      flexDirection: 'row',
      backgroundColor: palette.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: palette.border,
      gap: 12,
    },
    tipIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: palette.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipContent: {
      flex: 1,
    },
    tipTitle: {
      fontSize: 14,
      fontFamily: 'Lexend-SemiBold',
      color: palette.textPrimary,
      marginBottom: 4,
    },
    tipDesc: {
      fontSize: 13,
      fontFamily: 'Lexend-Regular',
      color: palette.textSecondary,
      lineHeight: 19,
    },

    // CTA Button
    ctaButton: {
      width: '100%',
      height: 54,
      borderRadius: 27,
      backgroundColor: palette.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: palette.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
    ctaText: {
      fontSize: 16,
      fontFamily: 'Lexend-SemiBold',
      color: '#FFFFFF',
    },
  });

export default SummaryScreen;
