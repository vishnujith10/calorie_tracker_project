import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useContext, useMemo, useState } from "react";
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

const PRIMARY_TEAL = "#1F4E4A";
const TEAL_700 = "#2B6661";
const TEAL_500 = "#5E8782";
const MINT = "#A8D5CE";
const MINT_SOFT = "#E4F3F0";
const SURFACE = "#F4FBFA";
const CARD = "#FFFFFF";
const BORDER = "#D5E8E3";
const TEXT_PRIMARY = "#163633";
const TEXT_SECONDARY = "#6C8883";

const activityLevels = [
  {
    label: "Sedentary",
    desc: "Little to no exercise, desk job",
    icon: "weekend",
    progress: [1, 0, 0, 0, 0],
    tag: "Low demand",
  },
  {
    label: "Lightly Active",
    desc: "Light exercise 1-3 days/week",
    icon: "walking",
    progress: [1, 1, 0, 0, 0],
    tag: "Light routine",
  },
  {
    label: "Moderately Active",
    desc: "Moderate exercise 3-5 days/week",
    icon: "activity",
    progress: [1, 1, 1, 0, 0],
    tag: "Balanced output",
  },
  {
    label: "Very Active",
    desc: "Hard exercise 6-7 days/week",
    icon: "running",
    progress: [1, 1, 1, 1, 0],
    tag: "High output",
  },
  {
    label: "Extra Active",
    desc: "Professional athlete level",
    icon: "sports-handball",
    progress: [1, 1, 1, 1, 1],
    tag: "Athlete level",
  },
];

const ActivityLevelScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);

  const handleContinue = (selectedLevel) => {
    setOnboardingData({
      ...onboardingData,
      daily_activity_level: selectedLevel,
    });
    navigation.navigate("Focus");
  };

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: SURFACE,
        },
        screenGlowTop: {
          position: "absolute",
          top: -30,
          right: -30,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: "rgba(168,213,206,0.35)",
        },
        screenGlowBottom: {
          position: "absolute",
          bottom: 120,
          left: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "rgba(31,78,74,0.08)",
        },
        topShell: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 10,
        },
        backButton: {
          zIndex: 5,
        },
        backButtonCircle: {
          width: 46,
          height: 46,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: CARD,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(31,78,74,0.18)",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 4,
        },
        progressPill: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: MINT_SOFT,
          borderWidth: 1,
          borderColor: BORDER,
        },
        progressPillText: {
          fontSize: 12,
          color: TEAL_700,
          fontFamily: "Manrope-Regular",
          fontWeight: "700",
          letterSpacing: 0.2,
        },
        scrollContent: {
          paddingBottom: 140,
        },
        contentWrapper: {
          paddingHorizontal: 24,
        },
        heroBlock: {
          marginTop: 8,
          marginBottom: 18,
        },
        subtitle: {
          fontSize: 11,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
          letterSpacing: 2,
          fontWeight: "700",
          marginBottom: 10,
        },
        title: {
          fontSize: 31,
          color: TEXT_PRIMARY,
          fontFamily: "Lexend-Bold",
          letterSpacing: -0.8,
          lineHeight: 38,
          marginBottom: 10,
        },
        description: {
          fontSize: 15.5,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
          lineHeight: 24,
          maxWidth: "96%",
        },
        summaryCard: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 14,
          backgroundColor: CARD,
          borderRadius: 28,
          padding: 18,
          marginBottom: 22,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(31,78,74,0.16)",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 4,
        },
        summaryIconWrap: {
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PRIMARY_TEAL,
          marginTop: 1,
        },
        summaryTitle: {
          fontSize: 15,
          color: TEXT_PRIMARY,
          fontFamily: "Lexend-Bold",
          marginBottom: 4,
        },
        summaryText: {
          fontSize: 13.5,
          lineHeight: 21,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
        },
        selectionStack: {
          gap: 14,
        },
        tierCard: {
          backgroundColor: CARD,
          borderRadius: 28,
          padding: 18,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(31,78,74,0.14)",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.07,
          shadowRadius: 18,
          elevation: 3,
        },
        tierCardSelected: {
          backgroundColor: PRIMARY_TEAL,
          borderColor: PRIMARY_TEAL,
          shadowColor: "rgba(31,78,74,0.4)",
          shadowOpacity: 0.22,
          shadowRadius: 22,
          elevation: 8,
          transform: [{ scale: 1.01 }],
        },
        tierHeader: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
        },
        tierTextBlock: {
          flex: 1,
          paddingRight: 14,
        },
        tierTitle: {
          fontSize: 17,
          color: TEXT_PRIMARY,
          fontFamily: "Lexend-Bold",
          marginBottom: 6,
        },
        tierTitleSelected: {
          color: "#FFFFFF",
        },
        tierDesc: {
          fontSize: 14,
          lineHeight: 21,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
        },
        tierDescSelected: {
          color: "rgba(255,255,255,0.84)",
        },
        tierIconShell: {
          width: 52,
          height: 52,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: MINT_SOFT,
          borderWidth: 1,
          borderColor: BORDER,
        },
        tierIconShellSelected: {
          backgroundColor: "rgba(255,255,255,0.16)",
          borderColor: "rgba(255,255,255,0.14)",
        },

        intensityBarActive: {
          backgroundColor: PRIMARY_TEAL,
        },

        tierFooter: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        tierTag: {
          fontSize: 12,
          fontFamily: "Manrope-Regular",
          fontWeight: "700",
          color: TEAL_500,
          letterSpacing: 0.2,
        },
        tierTagSelected: {
          color: "rgba(255,255,255,0.88)",
        },
        selectedPill: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.18)",
        },
        selectedPillText: {
          fontSize: 12,
          fontWeight: "700",
          color: "#FFFFFF",
          fontFamily: "Manrope-Regular",
        },
        tapHint: {
          fontSize: 12,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
        },
        bottomTray: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 24,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 14),
          borderTopWidth: 1,
          borderTopColor: BORDER,
          backgroundColor: SURFACE,
        },
        ctaButton: {
          minHeight: 58,
          borderRadius: 18,
          backgroundColor: PRIMARY_TEAL,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          shadowColor: "rgba(31,78,74,0.35)",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.18,
          shadowRadius: 18,
          elevation: 6,
        },
        ctaButtonDisabled: {
          backgroundColor: "#DDEBE8",
          shadowOpacity: 0,
          elevation: 0,
        },
        buttonText: {
          fontSize: 16.5,
          fontWeight: "700",
          color: "#FFFFFF",
          fontFamily: "Lexend-Bold",
          letterSpacing: 0.2,
        },
        buttonTextDisabled: {
          color: TEXT_SECONDARY,
        },
      }),
    [insets.bottom, isDark],
  );

  const renderIcon = (icon, selectedState) => {
    const iconColor = selectedState ? "#FFFFFF" : TEXT_PRIMARY;

    if (icon === "weekend") {
      return <MaterialIcons name="weekend" size={22} color={iconColor} />;
    }
    if (icon === "walking") {
      return <FontAwesome5 name="walking" size={20} color={iconColor} />;
    }
    if (icon === "activity") {
      return <Feather name="activity" size={20} color={iconColor} />;
    }
    if (icon === "running") {
      return <FontAwesome5 name="running" size={20} color={iconColor} />;
    }
    if (icon === "sports-handball") {
      return (
        <MaterialIcons name="sports-handball" size={22} color={iconColor} />
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar style="dark" />

      <View style={dynamicStyles.screenGlowTop} pointerEvents="none" />
      <View style={dynamicStyles.screenGlowBottom} pointerEvents="none" />

      <View style={dynamicStyles.topShell}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={dynamicStyles.backButton}
          activeOpacity={0.8}
        >
          <View style={dynamicStyles.backButtonCircle}>
            <Ionicons name="chevron-back" size={22} color={TEXT_PRIMARY} />
          </View>
        </TouchableOpacity>

        
      </View>

      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.contentWrapper}>
          <View style={dynamicStyles.heroBlock}>
            <Text style={dynamicStyles.subtitle}>DAILY MOVEMENT</Text>
            <Text style={dynamicStyles.title}>
              Choose the pace that feels most like your week
            </Text>
            <Text style={dynamicStyles.description}>
              Pick the option that reflects your usual routine so your calorie
              estimate stays realistic.
            </Text>
          </View>

          <View style={dynamicStyles.selectionStack}>
            {activityLevels.map((option, idx) => {
              const isSelected = selected === idx;

              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    dynamicStyles.tierCard,
                    isSelected && dynamicStyles.tierCardSelected,
                  ]}
                  onPress={() => setSelected(idx)}
                  activeOpacity={0.88}
                >
                  <View style={dynamicStyles.tierHeader}>
                    <View style={dynamicStyles.tierTextBlock}>
                      <Text
                        style={[
                          dynamicStyles.tierTitle,
                          isSelected && dynamicStyles.tierTitleSelected,
                        ]}
                      >
                        {option.label}
                      </Text>

                      <Text
                        style={[
                          dynamicStyles.tierDesc,
                          isSelected && dynamicStyles.tierDescSelected,
                        ]}
                      >
                        {option.desc}
                      </Text>
                    </View>

                    <View
                      style={[
                        dynamicStyles.tierIconShell,
                        isSelected && dynamicStyles.tierIconShellSelected,
                      ]}
                    >
                      {renderIcon(option.icon, isSelected)}
                    </View>
                  </View>

                  <View style={dynamicStyles.tierFooter}>
                    <Text
                      style={[
                        dynamicStyles.tierTag,
                        isSelected && dynamicStyles.tierTagSelected,
                      ]}
                    >
                      {option.tag}
                    </Text>

                    {isSelected ? (
                      <View style={dynamicStyles.selectedPill}>
                        <MaterialIcons name="check" size={14} color="#FFFFFF" />
                        <Text style={dynamicStyles.selectedPillText}>
                          Selected
                        </Text>
                      </View>
                    ) : (
                      <Text style={dynamicStyles.tapHint}>Tap to choose</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={dynamicStyles.bottomTray}>
        <TouchableOpacity
          style={[
            dynamicStyles.ctaButton,
            !Number.isInteger(selected) && dynamicStyles.ctaButtonDisabled,
          ]}
          disabled={!Number.isInteger(selected)}
          onPress={() => handleContinue(activityLevels[selected].label)}
          activeOpacity={0.9}
        >
          <Text
            style={[
              dynamicStyles.buttonText,
              !Number.isInteger(selected) && dynamicStyles.buttonTextDisabled,
            ]}
          >
            {Number.isInteger(selected)
              ? "Continue"
              : "Choose your activity level"}
          </Text>

          {Number.isInteger(selected) && (
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ActivityLevelScreen;
