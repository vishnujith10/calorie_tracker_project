import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useMemo } from "react";
import {
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

const GoalSummaryScreen = ({ navigation }) => {
  const { onboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    goal_focus = "Lose",
    target_weight = 0,
    weight = 0,
    selectedWeightUnit = "kg",
    weekly_target = 0.5,
    total_days_per_week = "N/A",
  } = onboardingData;

  const currentWeight = Number(weight);
  const targetWeight = Number(target_weight);
  const weeklyTarget = Number(weekly_target);
  const isLbs = selectedWeightUnit === "lbs";

  const weightDiff = Math.abs(targetWeight - currentWeight);
  const convertedWeeklyTarget = isLbs ? weeklyTarget * 2.20462 : weeklyTarget;

  const displayWeightDiff = isLbs
    ? (weightDiff * 2.20462).toFixed(1)
    : weightDiff.toFixed(1);

  let goalAction = "Maintain";
  if (goal_focus?.toLowerCase().includes("gain")) {
    goalAction = "Gain";
  } else if (goal_focus?.toLowerCase().includes("lose")) {
    goalAction = "Lose";
  }

  const goalText =
    goalAction === "Maintain"
      ? "Maintain current weight"
      : `${goalAction} ${displayWeightDiff} ${selectedWeightUnit}`;

  const estimatedWeeks =
    weeklyTarget > 0 && weightDiff > 0
      ? Math.ceil(weightDiff / weeklyTarget)
      : "N/A";

  const estimatedTime =
    estimatedWeeks !== "N/A" ? `${estimatedWeeks} weeks` : "N/A";

  const goalProgress = 0;

  const handleFinishOnboarding = () => {
    navigation.replace("Signup");
  };

  const palette = useMemo(
    () => ({
      background: "#F4FBFA",
      card: "#FFFFFF",
      textPrimary: "#173A37",
      textSecondary: "#5E7D78",
      textMuted: "#7F9B96",
      border: "#D7EAE6",
      primary: "#1F4E4A",
      shadow: "rgba(31, 78, 74, 0.12)",
      softPrimary: isDark ? "rgba(31, 78, 74, 0.25)" : "#DCEFEB",
      softerPrimary: isDark ? "rgba(31, 78, 74, 0.15)" : "#EEF7F5",
      successTint: isDark ? "rgba(46, 107, 101, 0.25)" : "#E4F3F0",
      infoTint: isDark ? "rgba(31, 78, 74, 0.20)" : "#DCEFEB",
      warningTint: isDark ? "rgba(122, 92, 27, 0.20)" : "#F5F0E1",
      chipBg: isDark ? "rgba(255,255,255,0.06)" : "#EEF7F5",
      progressTrack: isDark ? "rgba(255,255,255,0.08)" : "#D7EAE6",
      heroSurface: isDark ? "rgba(31, 78, 74, 0.20)" : "#EEF7F5",
      overlay1: isDark ? "rgba(168, 213, 206, 0.15)" : "rgba(168, 213, 206, 0.25)",
      overlay2: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.75)",
    }),
    [isDark]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: palette.background,
        },

        absoluteGlowTop: {
          position: "absolute",
          top: -30,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: palette.overlay1,
        },

        absoluteGlowBottom: {
          position: "absolute",
          left: -40,
          bottom: 140,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: palette.softerPrimary,
        },

        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 10,
        },

        backButton: {
          zIndex: 10,
        },

        backButtonCircle: {
          width: 44,
          height: 44,
          borderRadius: 16,
          backgroundColor: palette.card,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.24 : 0.08,
          shadowRadius: 10,
          elevation: 3,
        },

        headerBadge: {
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: palette.softPrimary,
          borderWidth: 1,
          borderColor: palette.softPrimary,
        },

        headerBadgeText: {
          color: palette.primary,
          fontSize: 12,
          fontFamily: "Manrope-Bold",
        },

        scrollContent: {
          paddingHorizontal: 20,
          paddingBottom: 140,
        },

        heroCard: {
          backgroundColor: palette.card,
          borderRadius: 28,
          padding: 20,
          marginTop: 6,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: palette.border,
          overflow: "hidden",
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.22 : 0.06,
          shadowRadius: 16,
          elevation: 4,
        },

        heroTopRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        },

        heroTextWrap: {
          flex: 1,
          paddingRight: 12,
        },

        eyebrow: {
          fontSize: 12,
          color: palette.primary,
          fontFamily: "Manrope-Bold",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 8,
        },

        heroTitle: {
          fontSize: 28,
          lineHeight: 34,
          color: palette.textPrimary,
          fontFamily: "Lexend-Bold",
          marginBottom: 10,
        },

        heroDescription: {
          fontSize: 14.5,
          lineHeight: 22,
          color: palette.textSecondary,
          fontFamily: "Manrope-Regular",
        },

        heroIconWrap: {
          width: 58,
          height: 58,
          borderRadius: 18,
          backgroundColor: palette.softPrimary,
          alignItems: "center",
          justifyContent: "center",
        },

        weightStrip: {
          backgroundColor: palette.heroSurface,
          borderRadius: 20,
          padding: 16,
          marginBottom: 16,
        },

        weightStripLabel: {
          fontSize: 12,
          color: palette.textSecondary,
          fontFamily: "Manrope-Bold",
          marginBottom: 6,
        },

        weightStripValue: {
          fontSize: 24,
          color: palette.textPrimary,
          fontFamily: "Lexend-Bold",
          marginBottom: 6,
        },

        weightStripHint: {
          fontSize: 13.5,
          color: palette.textSecondary,
          lineHeight: 20,
          fontFamily: "Manrope-Regular",
        },

        progressBlock: {
          marginBottom: 8,
        },

        progressTop: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        },

        progressLabel: {
          fontSize: 13,
          color: palette.textSecondary,
          fontFamily: "Manrope-Bold",
        },

        progressValue: {
          fontSize: 13,
          color: palette.textPrimary,
          fontFamily: "Manrope-Bold",
        },

        progressTrack: {
          height: 10,
          width: "100%",
          borderRadius: 999,
          backgroundColor: palette.progressTrack,
          overflow: "hidden",
        },

        progressBar: {
          height: "100%",
          borderRadius: 999,
          backgroundColor: palette.primary,
        },

        sectionTitle: {
          fontSize: 17,
          color: palette.textPrimary,
          fontFamily: "Lexend-Bold",
          marginBottom: 12,
        },

        statsGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginBottom: 16,
        },

        statCard: {
          width: "48.2%",
          backgroundColor: palette.card,
          borderRadius: 20,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.20 : 0.05,
          shadowRadius: 12,
          elevation: 3,
        },

        statIconWrap: {
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        },

        statLabel: {
          fontSize: 12,
          color: palette.textSecondary,
          fontFamily: "Manrope-Bold",
          marginBottom: 5,
        },

        statValue: {
          fontSize: 19,
          color: palette.textPrimary,
          fontFamily: "Lexend-Bold",
          marginBottom: 4,
        },

        statSubtext: {
          fontSize: 12.5,
          color: palette.textSecondary,
          fontFamily: "Manrope-Regular",
          lineHeight: 18,
        },

        planCard: {
          backgroundColor: palette.card,
          borderRadius: 22,
          padding: 18,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.20 : 0.05,
          shadowRadius: 12,
          elevation: 3,
        },

        planRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
        },

        planDivider: {
          height: 1,
          backgroundColor: palette.border,
          marginLeft: 52,
        },

        planIconWrap: {
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: palette.chipBg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        },

        planRowTextWrap: {
          flex: 1,
        },

        planRowLabel: {
          fontSize: 12,
          color: palette.textSecondary,
          fontFamily: "Manrope-Bold",
          marginBottom: 3,
        },

        planRowValue: {
          fontSize: 15.5,
          color: palette.textPrimary,
          fontFamily: "Lexend-SemiBold",
        },

        tipCard: {
          backgroundColor: palette.card,
          borderRadius: 22,
          padding: 18,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.20 : 0.05,
          shadowRadius: 12,
          elevation: 3,
        },

        tipTopRow: {
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        },

        tipIcon: {
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: palette.softPrimary,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        },

        tipTitle: {
          flex: 1,
          fontSize: 15.5,
          color: palette.textPrimary,
          fontFamily: "Lexend-Bold",
        },

        tipText: {
          fontSize: 14,
          lineHeight: 22,
          color: palette.textSecondary,
          fontFamily: "Manrope-Regular",
        },

        footerCaption: {
          textAlign: "center",
          fontSize: 12,
          color: palette.textSecondary,
          fontFamily: "Manrope-Bold",
          letterSpacing: 1.8,
          marginBottom: 8,
        },

        bottomBar: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: palette.background,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 14),
        },

        ctaButton: {
          minHeight: 56,
          borderRadius: 18,
          backgroundColor: palette.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: palette.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
          elevation: 6,
        },

        ctaButtonText: {
          color: "#FFFFFF",
          fontSize: 16,
          fontFamily: "Lexend-Bold",
          marginRight: 8,
        },
      }),
    [palette, isDark, insets.bottom]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View pointerEvents="none" style={styles.absoluteGlowTop} />
      <View pointerEvents="none" style={styles.absoluteGlowBottom} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <View style={styles.backButtonCircle}>
            <Ionicons
              name="chevron-back"
              size={22}
              color={palette.textPrimary}
            />
          </View>
        </TouchableOpacity>

        
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.eyebrow}>Goal summary</Text>
              <Text style={styles.heroTitle}>Your plan is ready</Text>
              <Text style={styles.heroDescription}>
                We’ve organized your target into a simple starting roadmap so
                the next step feels clear from day one.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons
                name="flag-checkered"
                size={28}
                color={palette.primary}
              />
            </View>
          </View>

          <View style={styles.weightStrip}>
            <Text style={styles.weightStripLabel}>Main focus</Text>
            <Text style={styles.weightStripValue}>{goalText}</Text>
            <Text style={styles.weightStripHint}>
              Built from your current weight, target weight, and weekly pace.
            </Text>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Progress at start</Text>
              <Text style={styles.progressValue}>{Math.round(goalProgress * 100)}%</Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${goalProgress * 100}%` },
                ]}
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Key numbers</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: palette.infoTint },
              ]}
            >
              <MaterialCommunityIcons
                name="scale-bathroom"
                size={22}
                color={palette.primary}
              />
            </View>
            <Text style={styles.statLabel}>Change needed</Text>
            <Text style={styles.statValue}>
              {displayWeightDiff} {selectedWeightUnit}
            </Text>
            <Text style={styles.statSubtext}>
              Total difference between current and target weight.
            </Text>
          </View>

          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: palette.successTint },
              ]}
            >
              <MaterialIcons
                name="schedule"
                size={22}
                color={palette.primary}
              />
            </View>
            <Text style={styles.statLabel}>Estimated time</Text>
            <Text style={styles.statValue}>{estimatedTime}</Text>
            <Text style={styles.statSubtext}>
              Based on the pace you selected during onboarding.
            </Text>
          </View>

          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: palette.warningTint },
              ]}
            >
              <MaterialIcons
                name="timeline"
                size={22}
                color={palette.primary}
              />
            </View>
            <Text style={styles.statLabel}>Weekly target</Text>
            <Text style={styles.statValue}>
              {convertedWeeklyTarget.toFixed(1)} {selectedWeightUnit}
            </Text>
            <Text style={styles.statSubtext}>
              Your expected weekly direction for steady progress.
            </Text>
          </View>

          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconWrap,
                { backgroundColor: palette.softPrimary },
              ]}
            >
              <MaterialCommunityIcons
                name="dumbbell"
                size={22}
                color={palette.primary}
              />
            </View>
            <Text style={styles.statLabel}>Workout days</Text>
            <Text style={styles.statValue}>{total_days_per_week}/week</Text>
            <Text style={styles.statSubtext}>
              Used to shape your starting activity rhythm.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your roadmap</Text>

        <View style={styles.planCard}>
          <View style={styles.planRow}>
            <View style={styles.planIconWrap}>
              <Ionicons name="flag-outline" size={18} color={palette.primary} />
            </View>
            <View style={styles.planRowTextWrap}>
              <Text style={styles.planRowLabel}>Goal focus</Text>
              <Text style={styles.planRowValue}>{goal_focus}</Text>
            </View>
          </View>

          <View style={styles.planDivider} />

          <View style={styles.planRow}>
            <View style={styles.planIconWrap}>
              <Ionicons name="trending-down-outline" size={18} color={palette.primary} />
            </View>
            <View style={styles.planRowTextWrap}>
              <Text style={styles.planRowLabel}>Current to target</Text>
              <Text style={styles.planRowValue}>
                {currentWeight || 0} {selectedWeightUnit} → {targetWeight || 0} {selectedWeightUnit}
              </Text>
            </View>
          </View>

          <View style={styles.planDivider} />

          <View style={styles.planRow}>
            <View style={styles.planIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={palette.primary} />
            </View>
            <View style={styles.planRowTextWrap}>
              <Text style={styles.planRowLabel}>Consistency pattern</Text>
              <Text style={styles.planRowValue}>
                {total_days_per_week} training days each week
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipTopRow}>
            <View style={styles.tipIcon}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={20}
                color={palette.primary}
              />
            </View>
            <Text style={styles.tipTitle}>Smart reminder</Text>
          </View>

          <Text style={styles.tipText}>
            Consistency beats intensity. A plan you can repeat every week is
            usually stronger than a perfect routine you can’t maintain.
          </Text>
        </View>

        <Text style={styles.footerCaption}>TRACK • BUILD • TRANSFORM</Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleFinishOnboarding}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaButtonText}>Start Your Journey</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default GoalSummaryScreen;