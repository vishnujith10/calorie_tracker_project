import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

const DEEP_TEAL = "#1F4E4A";
const TEAL_700 = "#285F5A";
const TEAL_500 = "#5F817B";
const MINT = "#A8D5CE";
const MINT_SOFT = "#DCEFEB";
const SURFACE = "#ECF7F4";
const LIGHT_BG = "#F4FBFA";
const CARD_BG = "#FFFFFF";
const SUCCESS_TEAL = "#2E6B65";
const WARM_TEAL = "#4F8A83";
const TEXT_PRIMARY = "#163633";
const TEXT_SECONDARY = "#6E8883";
const BORDER = "#D5E8E3";
const BORDER_STRONG = "#BADDD6";

const paceOptions = [0.5, 0.75, 1, 1.5];

const WeightGoalScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const [weightUnit, setWeightUnit] = useState(
    onboardingData.selectedWeightUnit || "kg",
  );
  const [currentWeight, setCurrentWeight] = useState(() => {
    const storedWeight = Number(onboardingData.weight) || 0;
    if (weightUnit === "lbs") return Math.round(storedWeight * 2.20462);
    return Math.round(storedWeight);
  });
  const [height, setHeight] = useState(
    onboardingData.height ? String(onboardingData.height) : "",
  );
  const [targetWeight, setTargetWeight] = useState("");
  const [healthyRange, setHealthyRange] = useState("");
  const [pace, setPace] = useState(1);
  const [weeks, setWeeks] = useState(0);
  const [estDate, setEstDate] = useState("");

  useEffect(() => {
    const getLocalOnboarding = async () => {
      if (!onboardingData.weight || !onboardingData.height) {
        try {
          const w = await AsyncStorage.getItem("calora_onboarding_weight");
          const h = await AsyncStorage.getItem("calora_onboarding_height");
          const u = await AsyncStorage.getItem("calora_onboarding_unit");
          if (w && h && u) {
            setOnboardingData((prev) => ({
              ...prev,
              weight: w,
              height: h,
              selectedWeightUnit: u,
            }));
            setCurrentWeight(
              u === "lbs" ? Math.round(Number(w)) : Math.round(Number(w)),
            );
            setHeight(String(h));
            setWeightUnit(u);
          }
        } catch (e) {
          console.warn(
            "Failed to load onboarding weight/height from storage",
            e,
          );
        }
      }
    };
    getLocalOnboarding();
  }, [onboardingData.weight, onboardingData.height, setOnboardingData]);

  useEffect(() => {
    if (!onboardingData.weight || !onboardingData.height) {
      const fetchProfile = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("user_profile")
            .select("weight, height")
            .eq("id", session.user.id)
            .single();
          if (profile) {
            if (profile.weight) {
              setOnboardingData((prev) => ({
                ...prev,
                weight: profile.weight,
              }));
              setCurrentWeight(
                weightUnit === "lbs"
                  ? Math.round(Number(profile.weight) * 2.20462)
                  : Math.round(Number(profile.weight)),
              );
            }
            if (profile.height) {
              setOnboardingData((prev) => ({
                ...prev,
                height: profile.height,
              }));
              setHeight(String(profile.height));
            }
          }
        }
      };
      fetchProfile();
    }
  }, [
    onboardingData.weight,
    onboardingData.height,
    setOnboardingData,
    weightUnit,
  ]);

  useEffect(() => {
    if (height) {
      const heightInMeters = parseFloat(height) / 100;
      let minHealthy = 18.5 * heightInMeters * heightInMeters;
      let maxHealthy = 24.9 * heightInMeters * heightInMeters;
      if (weightUnit === "lbs") {
        minHealthy = Math.round(minHealthy * 2.20462);
        maxHealthy = Math.round(maxHealthy * 2.20462);
        setHealthyRange(`${minHealthy} - ${maxHealthy} lbs`);
      } else {
        setHealthyRange(
          `${Math.round(minHealthy)} - ${Math.round(maxHealthy)} kg`,
        );
      }
    }
  }, [height, weightUnit]);

  useEffect(() => {
    let diff = Math.abs(Number(targetWeight) - Number(currentWeight));
    let paceVal = pace;
    if (weightUnit === "lbs") {
      diff = diff / 2.20462;
      paceVal = pace / 2.20462;
    }
    const wks = paceVal > 0 ? Math.ceil(diff / paceVal) : 0;
    setWeeks(wks);
    if (wks > 0) {
      const now = new Date();
      now.setDate(now.getDate() + wks * 7);
      setEstDate(
        now.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
    } else {
      setEstDate("");
    }
  }, [targetWeight, pace, weightUnit, currentWeight]);

  const handleContinue = async () => {
    let targetWeightInKg = targetWeight;
    let weeklyTargetInKg = pace;
    if (weightUnit === "lbs") {
      targetWeightInKg = (Number(targetWeight) / 2.20462).toFixed(1);
      weeklyTargetInKg = (pace / 2.20462).toFixed(2);
    }
    setOnboardingData({
      ...onboardingData,
      target_weight: targetWeightInKg,
      target_weight_unit: "kg",
      weekly_target: weeklyTargetInKg,
    });
    navigation.navigate("TimePerDay");
  };

  const weightDiff = Math.round(Number(currentWeight) - Number(targetWeight));
  let diffColor =
    weightDiff > 0 ? SUCCESS_TEAL : weightDiff < 0 ? WARM_TEAL : TEXT_SECONDARY;
  let diffText = "";
  if (weightDiff > 0) diffText = `-${Math.abs(weightDiff)} ${weightUnit}`;
  else if (weightDiff < 0) diffText = `+${Math.abs(weightDiff)} ${weightUnit}`;
  else diffText = `0 ${weightUnit}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: LIGHT_BG }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.75}
        >
          <View style={styles.backButtonCircle}>
            <Ionicons name="chevron-back" size={22} color={DEEP_TEAL} />
          </View>
        </TouchableOpacity>

        
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          <View style={styles.heroCard}>
           

            <Text style={styles.title}>Set your target weight</Text>
          </View>

          <View style={styles.sectionLabelWrap}>
            <Text style={styles.subtitle}>Weight overview</Text>
          </View>

          <View style={styles.goalPanel}>
            <View style={styles.weightCardRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Current</Text>
                <Text style={styles.metricValue}>
                  {currentWeight}{" "}
                  <Text style={styles.metricUnit}>{weightUnit}</Text>
                </Text>
              </View>

              <View style={styles.arrowBridge}>
                <MaterialIcons
                  name="arrow-forward"
                  size={22}
                  color={DEEP_TEAL}
                />
              </View>

              <View style={styles.metricCardTarget}>
                <Text style={styles.metricLabel}>Target</Text>
                <View style={styles.targetInputRow}>
                  <TextInput
                    style={styles.targetInput}
                    value={targetWeight !== "" && Number(targetWeight) !== 0 ? String(Math.round(Number(targetWeight))) : targetWeight}
                    onChangeText={(text) => {
                      let val = text.replace(/[^0-9]/g, "");
                      setTargetWeight(val);
                    }}
                    keyboardType="numeric"
                    textAlign="right"
                    maxLength={5}
                  />
                  <Text style={styles.inputUnitInline}>{weightUnit}</Text>
                </View>
              </View>
            </View>

            <View style={styles.badgeRowModern}>
              <View
                style={[
                  styles.diffBadgeModern,
                  {
                    backgroundColor: diffColor + "18",
                    borderColor: diffColor + "40",
                  },
                ]}
              >
                <Text
                  style={[styles.diffBadgeTextModern, { color: diffColor }]}
                >
                  {diffText}
                </Text>
              </View>

              {healthyRange ? (
                <View style={styles.healthyRangePill}>
                  <Text style={styles.healthyRangePillText}>
                    {healthyRange}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.infoTextSmall}>
              This app does not recommend a target. It only helps you track one.
            </Text>
          </View>

          <View style={styles.paceSection}>
            <View style={styles.sectionHeadRow}>
              <Text style={styles.choosePace}>Choose your weekly pace</Text>
              <View style={styles.safePacePill}>
                <MaterialIcons
                  name="favorite"
                  size={14}
                  color={DEEP_TEAL}
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.safePaceText}>Sustainable</Text>
              </View>
            </View>

            <View style={styles.paceGrid}>
              {paceOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.paceBtn, pace === opt && styles.paceBtnActive]}
                  onPress={() => setPace(opt)}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      styles.paceBtnText,
                      pace === opt && styles.paceBtnTextActive,
                    ]}
                  >
                    {opt} {weightUnit}/week
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.estimateStack}>
            <View style={styles.estimateCardPrimary}>
              <View style={styles.estimateIconWrapPrimary}>
                <MaterialIcons
                  name="calendar-today"
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.estimateTextCol}>
                <Text style={styles.estimateLabelLight}>Estimated time</Text>
                <Text style={styles.estimateValueLight}>
                  {weeks > 0 ? `${weeks} weeks` : "--"}
                </Text>
              </View>
            </View>

            <View style={styles.estimateCardSecondary}>
              <View style={styles.estimateIconWrap}>
                <MaterialIcons
                  name="event-available"
                  size={20}
                  color={DEEP_TEAL}
                />
              </View>
              <View style={styles.estimateTextCol}>
                <Text style={styles.estimateLabel}>Estimated date</Text>
                <Text style={styles.estimateValue}>{estDate || "--"}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.ctaButton,
            (!targetWeight || Number(targetWeight) === 0) && styles.ctaButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!targetWeight || Number(targetWeight) === 0}
          activeOpacity={0.88}
        >
          {(!targetWeight || Number(targetWeight) === 0) ? (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>Enter a target weight</Text>
            </View>
          ) : (
            <View style={styles.buttonActive}>
              <Text style={styles.buttonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BG,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 10,
  },
  backButton: {
    zIndex: 10,
  },
  backButtonCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EAF4F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerPill: {
    backgroundColor: "#EAF4F2",
    borderColor: BORDER,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  headerPillText: {
    color: DEEP_TEAL,
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heading: {
    fontSize: 20,
    fontFamily: "Lexend-Bold",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  heroCard: {
    width: "100%",
    backgroundColor: DEEP_TEAL,
    borderRadius: 30,
    padding: 22,
    marginBottom: 22,
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 8,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11,
    color: TEAL_500,
    fontFamily: "Manrope-Regular",
    letterSpacing: 2.2,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    fontFamily: "Lexend-Bold",
    letterSpacing: -0.8,
    marginBottom: 10,
    lineHeight: 36,
  },
  description: {
    fontSize: 15,
    color: "#D6EEEA",
    fontFamily: "Manrope-Regular",
    lineHeight: 23,
    maxWidth: "94%",
  },
  heroInsightRow: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  heroInsightBlock: {
    flex: 1,
  },
  heroInsightValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Lexend-Bold",
    marginBottom: 4,
  },
  heroInsightLabel: {
    color: "#D6EEEA",
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    fontWeight: "600",
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: 14,
  },
  sectionLabelWrap: {
    width: "100%",
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  goalPanel: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 18,
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  weightCardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 2,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#F7FCFB",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 118,
    justifyContent: "center",
  },
  metricCardTarget: {
    flex: 1,
    backgroundColor: "#EEF7F5",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER_STRONG,
    minHeight: 118,
    justifyContent: "center",
  },
  arrowBridge: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: "Manrope-Regular",
    marginBottom: 8,
    fontWeight: "700",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_PRIMARY,
    fontFamily: "Lexend-Bold",
  },
  metricUnit: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    fontFamily: "Manrope-Regular",
  },
  targetInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  targetInput: {
    fontSize: 34,
    color: TEXT_PRIMARY,
    fontWeight: "bold",
    backgroundColor: "transparent",
    borderWidth: 0,
    width: 88,
    height: 56,
    textAlign: "right",
    fontFamily: "Lexend-Bold",
    marginRight: 4,
  },
  inputUnitInline: {
    fontSize: 18,
    color: TEXT_SECONDARY,
    fontWeight: "bold",
    fontFamily: "Manrope-Regular",
    marginBottom: 7,
  },
  badgeRowModern: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  diffBadgeModern: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  diffBadgeTextModern: {
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: "Lexend-Bold",
    letterSpacing: 0.2,
  },
  healthyRangePill: {
    borderRadius: 16,
    backgroundColor: MINT_SOFT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  healthyRangePillText: {
    fontSize: 15,
    fontWeight: "bold",
    color: DEEP_TEAL,
    fontFamily: "Lexend-Bold",
    textAlign: "center",
  },
  infoTextSmall: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Manrope-Regular",
  },
  paceSection: {
    width: "100%",
    marginBottom: 18,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  choosePace: {
    fontSize: 17,
    color: TEXT_PRIMARY,
    fontWeight: "bold",
    fontFamily: "Lexend-Bold",
  },
  safePacePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF4F2",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  safePaceText: {
    color: DEEP_TEAL,
    fontWeight: "700",
    fontSize: 12,
    fontFamily: "Manrope-Regular",
  },
  paceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  paceBtn: {
    width: "48%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 10,
    backgroundColor: CARD_BG,
    alignItems: "center",
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  paceBtnActive: {
    backgroundColor: DEEP_TEAL,
    borderColor: DEEP_TEAL,
    transform: [{ scale: 1.01 }],
  },
  paceBtnText: {
    color: TEXT_PRIMARY,
    fontWeight: "bold",
    fontSize: 15,
    fontFamily: "Manrope-Regular",
  },
  paceBtnTextActive: {
    color: "#fff",
  },
  estimateStack: {
    width: "100%",
    marginTop: 2,
    marginBottom: 12,
    gap: 12,
  },
  estimateCardPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEEP_TEAL,
    borderRadius: 24,
    padding: 18,
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  estimateCardSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  estimateTextCol: {
    flexDirection: "column",
    justifyContent: "center",
    flex: 1,
  },
  estimateIconWrapPrimary: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 10,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    width: 44,
  },
  estimateIconWrap: {
    backgroundColor: "#EAF4F2",
    borderRadius: 16,
    padding: 10,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    width: 44,
    borderWidth: 1,
    borderColor: BORDER,
  },
  estimateLabelLight: {
    color: "#D6EEEA",
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    marginBottom: 4,
  },
  estimateValueLight: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 20,
    fontFamily: "Lexend-Bold",
  },
  estimateLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    marginBottom: 4,
  },
  estimateValue: {
    color: TEXT_PRIMARY,
    fontWeight: "bold",
    fontSize: 18,
    fontFamily: "Lexend-Bold",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(244, 251, 250, 0.98)",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  ctaButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  buttonActive: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
    backgroundColor: DEEP_TEAL,
    borderRadius: 20,
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Lexend-Bold",
    letterSpacing: 0.3,
  },
  weightCardWithBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  ctaButtonDisabled: {
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: "#DCE8E5",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 20,
  },
  buttonTextDisabled: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6F8C87",
    fontFamily: "Manrope-Regular",
  },
});

export default WeightGoalScreen;
