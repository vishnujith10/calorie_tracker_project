import {
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OnboardingContext } from "../context/OnboardingContext";
import { useTheme } from "../context/ThemeContext";

// Cohesive teal design system
const DEEP_TEAL = "#1F4E4A";
const TEAL_700 = "#285F5A";
const TEAL_500 = "#4F7E79";
const MINT = "#A8D5CE";
const MINT_SOFT = "#DCEFEB";
const NEAR_WHITE = "#F4FBFA";
const WHITE = "#FFFFFF";
const TEXT_PRIMARY = "#163633";
const TEXT_SECONDARY = "#64807A";
const BORDER = "#D5E8E3";
const BORDER_STRONG = "#B9D8D2";

const options = [
  { label: "10–20 mins", icon: "timer", gradient: ["#EEF7F5", "#DCEFEB"] },
  { label: "20–40 mins", icon: "schedule", gradient: ["#E8F5F2", "#D2ECE6"] },
  {
    label: "40–60 mins",
    icon: "access-time",
    gradient: ["#E3F2EF", "#CDE8E2"],
  },
  { label: "60+ mins", icon: "timer", gradient: ["#EDF8F6", "#D8F0EB"] },
  { label: "It varies", icon: "shuffle", gradient: ["#F1FAF8", "#DDEFEA"] },
];

const TimePerDayScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { colors, isDark } = useTheme();
  const [selected, setSelected] = useState(null);

  const handleNext = (spendingTime) => {
    setOnboardingData({
      ...onboardingData,
      spending_time: spendingTime,
    });
    navigation.navigate("WorkoutPreferences");
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: NEAR_WHITE,
    },
    subtitle: {
      fontSize: 11,
      color: TEAL_500,
      fontFamily: "Manrope-Regular",
      letterSpacing: 2.2,
      fontWeight: "700",
      marginBottom: 10,
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
      color: TEXT_SECONDARY,
      fontFamily: "Manrope-Regular",
      lineHeight: 23,
      marginBottom: 0,
      maxWidth: "92%",
    },
    optionCard: {
      backgroundColor: WHITE,
      borderRadius: 24,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: BORDER,
      shadowColor: DEEP_TEAL,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.18 : 0.07,
      shadowRadius: 18,
      elevation: 3,
      overflow: "hidden",
    },
    optionText: {
      fontSize: 16,
      fontWeight: "700",
      color: TEXT_PRIMARY,
      fontFamily: "Manrope-Regular",
      flex: 1,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
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
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <MaterialCommunityIcons
                  name="leaf-circle-outline"
                  size={16}
                  color={WHITE}
                />
                <Text style={styles.heroBadgeText}>Daily commitment</Text>
              </View>
            </View>

            <Text style={dynamicStyles.title}>
              How much time can you give each day?
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.subtitle}>Select one option</Text>
          </View>

          <View style={styles.optionsWrapper}>
            {options.map((option, idx) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  dynamicStyles.optionCard,
                  selected === idx && styles.optionCardSelected,
                ]}
                onPress={() => setSelected(idx)}
                activeOpacity={0.82}
              >
                <View style={styles.optionContent}>
                  <LinearGradient
                    colors={option.gradient}
                    style={[
                      styles.iconWrapperGradient,
                      selected === idx && styles.iconWrapperGradientSelected,
                    ]}
                  >
                    <MaterialIcons
                      name={option.icon}
                      size={22}
                      color={DEEP_TEAL}
                    />
                  </LinearGradient>

                  <View style={styles.optionTextWrap}>
                    <Text style={dynamicStyles.optionText}>{option.label}</Text>
                    <Text style={styles.optionSubtext}>
                      {idx === 0 && "Best for getting started gently"}
                      {idx === 1 && "A balanced routine for most days"}
                      {idx === 2 && "Good for deeper training sessions"}
                      {idx === 3 && "For high-commitment schedules"}
                      {idx === 4 && "Choose this if your days change often"}
                    </Text>
                  </View>

                  {selected === idx ? (
                    <View style={styles.checkCircle}>
                      <MaterialIcons name="check" size={16} color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.emptyCircle} />
                  )}
                </View>

                {selected === idx && <View style={styles.selectedAccentBar} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIconWrap}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={18}
                color={DEEP_TEAL}
              />
            </View>
            <Text style={styles.infoText}>
              Consistency matters more than duration. A realistic plan beats an
              extreme one.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.ctaButton,
            selected === null && styles.ctaButtonDisabled,
          ]}
          disabled={selected === null}
          onPress={() => handleNext(options[selected].label)}
          activeOpacity={0.88}
        >
          {selected !== null ? (
            <View style={styles.buttonActive}>
              <Text style={styles.buttonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.buttonDisabled}>
              <Text style={styles.buttonTextDisabled}>
                Select your time commitment
              </Text>
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
    backgroundColor: NEAR_WHITE,
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
    paddingBottom: 118,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontFamily: "Manrope-Regular",
    letterSpacing: 2,
    fontWeight: "600",
    marginBottom: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    fontFamily: "Lexend-Bold",
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 38,
  },
  description: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: "Manrope-Regular",
    lineHeight: 24,
  },
  heroCard: {
    backgroundColor: DEEP_TEAL,
    borderRadius: 30,
    padding: 22,
    marginBottom: 24,
    shadowColor: DEEP_TEAL,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
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
  },
  heroBadgeText: {
    color: WHITE,
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  heroMiniStats: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  miniStat: {
    flex: 1,
  },
  miniStatValue: {
    color: WHITE,
    fontSize: 16,
    fontFamily: "Lexend-Bold",
    marginBottom: 4,
  },
  miniStatLabel: {
    color: "#D6EEEA",
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    fontWeight: "600",
  },
  miniDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: 14,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  optionsWrapper: {
    marginBottom: 18,
  },
  optionCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: DEEP_TEAL,
    shadowColor: DEEP_TEAL,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
    transform: [{ scale: 1.01 }],
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  optionTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  optionSubtext: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    fontFamily: "Manrope-Regular",
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperGradient: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  iconWrapperGradientSelected: {
    borderColor: BORDER_STRONG,
    backgroundColor: MINT_SOFT,
  },
  optionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    fontFamily: "Manrope-Regular",
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DEEP_TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#D6E5E1",
    backgroundColor: "#F8FCFB",
  },
  selectedAccentBar: {
    height: 4,
    backgroundColor: DEEP_TEAL,
    width: "100%",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECF7F4",
    borderRadius: 22,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 6,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEFEB",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_PRIMARY,
    fontFamily: "Manrope-Regular",
    fontWeight: "600",
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
  ctaButtonDisabled: {
    opacity: 1,
  },
  buttonDisabled: {
    backgroundColor: "#E2EEEB",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  buttonTextDisabled: {
    fontSize: 16,
    fontWeight: "700",
    color: TEAL_500,
    fontFamily: "Manrope-Regular",
  },
});

export default TimePerDayScreen;
