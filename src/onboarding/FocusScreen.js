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
const TEAL_700 = "#2A625D";
const TEAL_500 = "#668782";
const MINT = "#A8D5CE";
const MINT_SOFT = "#E4F2EF";
const SURFACE = "#F4FBFA";
const CARD = "#FFFFFF";
const BORDER = "#D5E8E3";
const TEXT_PRIMARY = "#163633";
const TEXT_SECONDARY = "#6C8883";

const options = [
  {
    label: "Lose Weight",
    icon: "activity",
    eyebrow: "Calorie deficit",
    caption: "Reduce body fat with a sustainable intake target.",
    stats: ["Fat loss", "Calorie control"],
  },
  {
    label: "Gain Muscle",
    icon: "dumbbell",
    eyebrow: "Performance build",
    caption: "Support training with enough energy and protein.",
    stats: ["Muscle gain", "Strength focus"],
  },
  {
    label: "Stay Fit",
    icon: "favorite",
    eyebrow: "Balanced routine",
    caption: "Maintain your shape and keep your habits consistent.",
    stats: ["Maintain", "Daily balance"],
  },
];

const FocusScreen = ({ navigation }) => {
  const { onboardingData, setOnboardingData } = useContext(OnboardingContext);
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);

  const handleContinue = (selectedFocus) => {
    setOnboardingData({
      ...onboardingData,
      goal_focus: selectedFocus,
    });
    navigation.navigate("WeightGoal");
  };

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: SURFACE,
        },
        glowTop: {
          position: "absolute",
          top: -10,
          right: -40,
          width: 170,
          height: 170,
          borderRadius: 85,
          backgroundColor: "rgba(168,213,206,0.34)",
        },
        glowBottom: {
          position: "absolute",
          left: -30,
          bottom: 150,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: "rgba(31,78,74,0.08)",
        },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 8,
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
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 4,
        },
        stepChip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: MINT_SOFT,
          borderWidth: 1,
          borderColor: BORDER,
        },
        stepChipText: {
          fontSize: 12,
          color: TEAL_700,
          fontFamily: "Manrope-Regular",
          fontWeight: "700",
          letterSpacing: 0.2,
        },
        scrollContent: {
          paddingBottom: 150,
        },
        contentWrapper: {
          paddingHorizontal: 24,
        },
        heroBlock: {
          marginTop: 10,
          marginBottom: 22,
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
        optionStack: {
          gap: 16,
        },
        goalCard: {
          backgroundColor: CARD,
          borderRadius: 32,
          padding: 20,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(31,78,74,0.14)",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 22,
          elevation: 4,
        },
        goalCardSelected: {
          backgroundColor: PRIMARY_TEAL,
          borderColor: PRIMARY_TEAL,
          shadowColor: "rgba(31,78,74,0.34)",
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 8,
          transform: [{ scale: 1.01 }],
        },
        goalTopRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 18,
        },
        goalTextBlock: {
          flex: 1,
          paddingRight: 16,
        },
        eyebrow: {
          fontSize: 11,
          color: TEAL_500,
          fontFamily: "Manrope-Regular",
          fontWeight: "700",
          letterSpacing: 1.1,
          marginBottom: 6,
          textTransform: "uppercase",
        },
        eyebrowSelected: {
          color: "rgba(255,255,255,0.76)",
        },
        optionTitle: {
          fontSize: 20,
          color: TEXT_PRIMARY,
          fontFamily: "Lexend-Bold",
          marginBottom: 8,
        },
        optionTitleSelected: {
          color: "#FFFFFF",
        },
        optionCaption: {
          fontSize: 14.5,
          lineHeight: 22,
          color: TEXT_SECONDARY,
          fontFamily: "Manrope-Regular",
        },
        optionCaptionSelected: {
          color: "rgba(255,255,255,0.84)",
        },
        iconShell: {
          width: 58,
          height: 58,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: MINT_SOFT,
          borderWidth: 1,
          borderColor: BORDER,
        },
        iconShellSelected: {
          backgroundColor: "rgba(255,255,255,0.16)",
          borderColor: "rgba(255,255,255,0.12)",
        },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        metaChips: {
          flexDirection: "row",
          gap: 8,
          flex: 1,
          marginRight: 10,
          flexWrap: "wrap",
        },
        metaChip: {
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: "#F0F7F5",
        },
        metaChipSelected: {
          backgroundColor: "rgba(255,255,255,0.16)",
        },
        metaChipText: {
          fontSize: 12,
          color: TEAL_700,
          fontFamily: "Manrope-Regular",
          fontWeight: "700",
        },
        metaChipTextSelected: {
          color: "#FFFFFF",
        },
        selectBadge: {
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 2,
          borderColor: "#DDEBE8",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
        },
        selectBadgeActive: {
          backgroundColor: "rgba(255,255,255,0.18)",
          borderColor: "rgba(255,255,255,0.16)",
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
    [insets.bottom, isDark]
  );

  const renderIcon = (icon, selectedState) => {
    const iconColor = selectedState ? "#FFFFFF" : TEXT_PRIMARY;

    if (icon === "activity") {
      return <Feather name="activity" size={22} color={iconColor} />;
    }
    if (icon === "dumbbell") {
      return <FontAwesome5 name="dumbbell" size={21} color={iconColor} />;
    }
    if (icon === "favorite") {
      return <MaterialIcons name="favorite" size={23} color={iconColor} />;
    }

    return null;
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar style="dark" />

      <View style={dynamicStyles.glowTop} pointerEvents="none" />
      <View style={dynamicStyles.glowBottom} pointerEvents="none" />

      <View style={dynamicStyles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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
            <Text style={dynamicStyles.subtitle}>FITNESS GOAL</Text>
            <Text style={dynamicStyles.title}>
              What outcome matters most right now?
            </Text>
          </View>

          <View style={dynamicStyles.optionStack}>
            {options.map((option, idx) => {
              const isSelected = selected === idx;

              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    dynamicStyles.goalCard,
                    isSelected && dynamicStyles.goalCardSelected,
                  ]}
                  onPress={() => setSelected(idx)}
                  activeOpacity={0.88}
                >
                  <View style={dynamicStyles.goalTopRow}>
                    <View style={dynamicStyles.goalTextBlock}>
                      <Text
                        style={[
                          dynamicStyles.eyebrow,
                          isSelected && dynamicStyles.eyebrowSelected,
                        ]}
                      >
                        {option.eyebrow}
                      </Text>

                      <Text
                        style={[
                          dynamicStyles.optionTitle,
                          isSelected && dynamicStyles.optionTitleSelected,
                        ]}
                      >
                        {option.label}
                      </Text>

                      <Text
                        style={[
                          dynamicStyles.optionCaption,
                          isSelected && dynamicStyles.optionCaptionSelected,
                        ]}
                      >
                        {option.caption}
                      </Text>
                    </View>

                    <View
                      style={[
                        dynamicStyles.iconShell,
                        isSelected && dynamicStyles.iconShellSelected,
                      ]}
                    >
                      {renderIcon(option.icon, isSelected)}
                    </View>
                  </View>

                  <View style={dynamicStyles.metaRow}>
                    <View style={dynamicStyles.metaChips}>
                      {option.stats.map((stat) => (
                        <View
                          key={stat}
                          style={[
                            dynamicStyles.metaChip,
                            isSelected && dynamicStyles.metaChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              dynamicStyles.metaChipText,
                              isSelected &&
                                dynamicStyles.metaChipTextSelected,
                            ]}
                          >
                            {stat}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View
                      style={[
                        dynamicStyles.selectBadge,
                        isSelected && dynamicStyles.selectBadgeActive,
                      ]}
                    >
                      {isSelected ? (
                        <MaterialIcons
                          name="check"
                          size={16}
                          color="#FFFFFF"
                        />
                      ) : null}
                    </View>
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
            selected === null && dynamicStyles.ctaButtonDisabled,
          ]}
          disabled={selected === null}
          onPress={() => handleContinue(options[selected].label)}
          activeOpacity={0.9}
        >
          <Text
            style={[
              dynamicStyles.buttonText,
              selected === null && dynamicStyles.buttonTextDisabled,
            ]}
          >
            {selected !== null ? "Continue" : "Choose your focus"}
          </Text>

          {selected !== null && (
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default FocusScreen;