import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import supabase from "../lib/supabase";

const APP_THEME = {
  primary: "#1F4E4A",
  mint: "#A8D5CE",
  background: "#F4FBFA",
  white: "#FFFFFF",
  text: "#163633",
  textSoft: "#5F7C77",
  border: "#D5E8E3",
  surface: "#EEF7F5",
};

const PreferencesScreen = () => {
  const navigation = useNavigation();
  const { theme, updateTheme, colors, isDark } = useTheme();

  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightUnit, setHeightUnit] = useState("cm");

  const [breakfastReminder, setBreakfastReminder] = useState(true);
  const [lunchReminder, setLunchReminder] = useState(true);
  const [dinnerReminder, setDinnerReminder] = useState(true);

  const [workoutReminder, setWorkoutReminder] = useState(true);
  const [sleepReminder, setSleepReminder] = useState(false);

  const weightSlideAnim = useRef(new Animated.Value(0)).current;
  const heightSlideAnim = useRef(new Animated.Value(0)).current;
  const themeSlideAnim = useRef(new Animated.Value(0)).current;

  const [weightButtonWidth, setWeightButtonWidth] = useState(0);
  const [heightButtonWidth, setHeightButtonWidth] = useState(0);
  const [themeButtonWidth, setThemeButtonWidth] = useState(0);

  useEffect(() => {
    fetchUserPreferences();
  }, []);

  const convertWeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "kg" && toUnit === "lbs")
      return (value * 2.20462).toFixed(1);
    if (fromUnit === "lbs" && toUnit === "kg")
      return (value / 2.20462).toFixed(1);
    return value;
  };

  const convertHeight = (value, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return value;
    if (fromUnit === "cm" && toUnit === "ft") return (value / 30.48).toFixed(1);
    if (fromUnit === "ft" && toUnit === "cm") return (value * 30.48).toFixed(1);
    return value;
  };

  const fetchUserPreferences = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_profile")
        .select("weight_unit, height_unit")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user preferences:", error);
        return;
      }

      if (data) {
        setWeightUnit(data.weight_unit || "kg");
        setHeightUnit(data.height_unit || "cm");
      } else {
        setWeightUnit("kg");
        setHeightUnit("cm");
      }
    } catch (error) {
      console.error("Error fetching user preferences:", error);
    }
  };

  const saveUnitPreference = async (unitType, value) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const updateData = {};
      updateData[unitType] = value;

      const { error } = await supabase
        .from("user_profile")
        .update(updateData)
        .eq("id", user.id);

      if (error) {
        console.error("Error saving unit preference:", error);
        Alert.alert("Error", "Failed to save preference. Please try again.");
        return;
      }

      console.log(`${unitType} preference saved successfully`);
    } catch (error) {
      console.error("Error saving unit preference:", error);
      Alert.alert("Error", "Failed to save preference. Please try again.");
    }
  };

  const handleWeightUnitChange = async (unit) => {
    const oldUnit = weightUnit;
    console.log(`Weight unit changing from ${oldUnit} to ${unit}`);
    setWeightUnit(unit);
    saveUnitPreference("weight_unit", unit);

    await convertUserWeightValues(oldUnit, unit);
  };

  const handleHeightUnitChange = async (unit) => {
    const oldUnit = heightUnit;
    console.log(`Height unit changing from ${oldUnit} to ${unit}`);
    setHeightUnit(unit);
    saveUnitPreference("height_unit", unit);

    await convertUserHeightValues(oldUnit, unit);
  };

  const convertUserWeightValues = async (fromUnit, toUnit) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profile")
        .select("weight, target_weight")
        .eq("id", user.id)
        .single();

      if (profile) {
        const updates = {};

        if (profile.weight) {
          const convertedWeight = convertWeight(
            Number(profile.weight),
            fromUnit,
            toUnit,
          );
          console.log(
            `Converting weight: ${profile.weight} ${fromUnit} → ${convertedWeight} ${toUnit}`,
          );
          updates.weight = convertedWeight;
        }

        if (profile.target_weight) {
          const convertedTargetWeight = convertWeight(
            Number(profile.target_weight),
            fromUnit,
            toUnit,
          );
          console.log(
            `Converting target weight: ${profile.target_weight} ${fromUnit} → ${convertedTargetWeight} ${toUnit}`,
          );
          updates.target_weight = convertedTargetWeight;
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from("user_profile").update(updates).eq("id", user.id);

          console.log("Weight values converted successfully");
        }

        await convertWeightLogs(fromUnit, toUnit);
      }
    } catch (error) {
      console.error("Error converting weight values:", error);
    }
  };

  const convertUserHeightValues = async (fromUnit, toUnit) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profile")
        .select("height")
        .eq("id", user.id)
        .single();

      if (profile && profile.height) {
        const convertedHeight = convertHeight(
          Number(profile.height),
          fromUnit,
          toUnit,
        );
        console.log(
          `Converting height: ${profile.height} ${fromUnit} → ${convertedHeight} ${toUnit}`,
        );

        await supabase
          .from("user_profile")
          .update({ height: convertedHeight })
          .eq("id", user.id);

        console.log("Height value converted successfully");
      }
    } catch (error) {
      console.error("Error converting height values:", error);
    }
  };

  const convertWeightLogs = async (fromUnit, toUnit) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from("weight_logs")
        .select("id, weight")
        .eq("user_id", user.id);

      if (logs && logs.length > 0) {
        for (const log of logs) {
          if (log.weight) {
            const convertedWeight = convertWeight(
              Number(log.weight),
              fromUnit,
              toUnit,
            );
            await supabase
              .from("weight_logs")
              .update({ weight: convertedWeight })
              .eq("id", log.id);
          }
        }
        console.log("Weight logs converted successfully");
      }
    } catch (error) {
      console.error("Error converting weight logs:", error);
    }
  };

  useEffect(() => {
    const targetPosition = weightUnit === "kg" ? 0 : 1;

    Animated.spring(weightSlideAnim, {
      toValue: targetPosition,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
      velocity: 2,
    }).start();
  }, [weightUnit, weightSlideAnim]);

  useEffect(() => {
    const targetPosition = heightUnit === "cm" ? 0 : 1;

    Animated.spring(heightSlideAnim, {
      toValue: targetPosition,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
      velocity: 2,
    }).start();
  }, [heightUnit, heightSlideAnim]);

  useEffect(() => {
    const targetPosition = theme === "Light" ? 0 : 1;

    Animated.spring(themeSlideAnim, {
      toValue: targetPosition,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
      velocity: 2,
    }).start();
  }, [theme, themeSlideAnim]);

  const palette = useMemo(() => {
    if (isDark) {
      return {
        bg: "#102926",
        bgSoft: "#163431",
        surface: "#183C38",
        surfaceStrong: "#1F4E4A",
        card: "#173633",
        textPrimary: "#F4FBFA",
        textSecondary: "#B8D8D2",
        border: "rgba(168, 213, 206, 0.18)",
        track: "rgba(168, 213, 206, 0.12)",
        chip: "rgba(168, 213, 206, 0.10)",
        accent: "#A8D5CE",
        accentStrong: "#A8D5CE",
        accentTextOn: "#163633",
        iconSoft: "#CBE7E2",
        shadow: "#000000",
      };
    }

    return {
      bg: APP_THEME.background,
      bgSoft: "#ECF7F5",
      surface: "#FFFFFF",
      surfaceStrong: APP_THEME.primary,
      card: "#FFFFFF",
      textPrimary: APP_THEME.text,
      textSecondary: APP_THEME.textSoft,
      border: APP_THEME.border,
      track: "#E4F1EE",
      chip: "#EEF7F5",
      accent: APP_THEME.primary,
      accentStrong: APP_THEME.primary,
      accentTextOn: "#FFFFFF",
      iconSoft: "#5F7C77",
      shadow: "#10312D",
    };
  }, [isDark]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: palette.bg,
        },
        headerShell: {
          paddingTop: 32,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: palette.bg,
          position: "relative",
        },

        fixedBackButton: {
          position: "absolute",
          top: 40,
          left: 20,
          width: 42,
          height: 42,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.surface,
          zIndex: 10,
        },

        heroCard: {
          marginTop: 58,
          backgroundColor: palette.surfaceStrong,
          borderRadius: 28,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 20,
        },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        },
        backButton: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark
            ? "rgba(255,255,255,0.10)"
            : "rgba(255,255,255,0.14)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
        },
        heroEyebrow: {
          fontSize: 20,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "#DCEFEB",
          marginBottom: 8,
        },
        heroTitle: {
          fontSize: 30,
          fontWeight: "800",
          color: "#FFFFFF",
          marginBottom: 8,
        },
        heroSubtitle: {
          fontSize: 14,
          lineHeight: 22,
          color: "#D5ECE7",
          maxWidth: "92%",
        },
        heroMetaRow: {
          flexDirection: "row",
          marginTop: 18,
          gap: 10,
        },
        heroPill: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.10)"
            : "rgba(255,255,255,0.12)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
        },
        heroPillText: {
          marginLeft: 8,
          fontSize: 13,
          fontWeight: "600",
          color: "#F4FBFA",
        },
        scrollContent: {
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 120,
        },
        sectionBlock: {
          marginBottom: 18,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: palette.textSecondary,
          marginBottom: 10,
          paddingHorizontal: 4,
        },
        card: {
          backgroundColor: palette.card,
          borderRadius: 24,
          padding: 18,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: palette.border,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.16 : 0.06,
          shadowRadius: 18,
          elevation: 3,
        },
        cardHeaderRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
        },
        cardTitleWrap: {
          flex: 1,
          paddingRight: 12,
        },
        cardTitle: {
          fontSize: 20,
          fontWeight: "800",
          color: palette.textPrimary,
          marginBottom: 4,
        },
        cardSubtitle: {
          fontSize: 13,
          lineHeight: 20,
          color: palette.textSecondary,
        },
        iconBadge: {
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.chip,
          borderWidth: 1,
          borderColor: palette.border,
        },
        settingGroup: {
          marginBottom: 14,
        },
        settingLabel: {
          fontSize: 15,
          fontWeight: "700",
          color: palette.textPrimary,
          marginBottom: 6,
        },
        settingHint: {
          fontSize: 13,
          lineHeight: 19,
          color: palette.textSecondary,
          marginBottom: 10,
        },
        segmentedShell: {
          flexDirection: "row",
          backgroundColor: palette.track,
          borderRadius: 18,
          padding: 4,
          position: "relative",
          borderWidth: 1,
          borderColor: palette.border,
        },
        themeSelector: {
          flexDirection: "row",
          backgroundColor: palette.track,
          borderRadius: 18,
          padding: 4,
          position: "relative",
          borderWidth: 1,
          borderColor: palette.border,
        },
        segmentIndicator: {
          position: "absolute",
          left: 4,
          top: 4,
          bottom: 4,
          borderRadius: 14,
          backgroundColor: palette.accentStrong,
          shadowColor: palette.accentStrong,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.2 : 0.18,
          shadowRadius: 12,
          elevation: 4,
        },
        unitButtonText: {
          fontSize: 15,
          fontWeight: "700",
          color: palette.textSecondary,
        },
        unitButtonTextActive: {
          color: palette.accentTextOn,
        },
        themeButtonText: {
          fontSize: 15,
          fontWeight: "700",
          color: palette.textSecondary,
        },
        themeButtonTextActive: {
          color: palette.accentTextOn,
        },
        footerNote: {
          marginTop: 4,
          fontSize: 12,
          lineHeight: 18,
          color: palette.textSecondary,
        },
      }),
    [palette, isDark],
  );

  return (
    <View style={dynamicStyles.container}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <TouchableOpacity
        style={dynamicStyles.fixedBackButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
      </TouchableOpacity>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={dynamicStyles.headerShell}>
          <View style={dynamicStyles.heroCard}>
            <Text style={dynamicStyles.heroEyebrow}>
              Personal configuration
            </Text>

            <Text style={dynamicStyles.heroSubtitle}>
              Fine-tune units and appearance in one place without changing any
              of your saved progress or account data.
            </Text>
          </View>
        </View>

        <View style={dynamicStyles.scrollContent}>
          <View style={dynamicStyles.sectionBlock}>
            <Text style={dynamicStyles.sectionLabel}>Measurement</Text>

            <View style={dynamicStyles.card}>
              <View style={dynamicStyles.cardHeaderRow}>
                <View style={dynamicStyles.cardTitleWrap}>
                  <Text style={dynamicStyles.cardTitle}>Body units</Text>
                </View>
                <View style={dynamicStyles.iconBadge}>
                  <Ionicons
                    name="calculator-outline"
                    size={20}
                    color={palette.accent}
                  />
                </View>
              </View>

              <View style={dynamicStyles.settingGroup}>
                <Text style={dynamicStyles.settingLabel}>Weight unit</Text>

                <View
                  style={dynamicStyles.segmentedShell}
                  onLayout={(event) => {
                    const { width } = event.nativeEvent.layout;
                    const calculatedWidth = (width - 8) / 2;
                    setWeightButtonWidth(calculatedWidth);
                  }}
                >
                  {weightButtonWidth > 0 && (
                    <Animated.View
                      style={[
                        dynamicStyles.segmentIndicator,
                        {
                          width: weightButtonWidth,
                          transform: [
                            {
                              translateX: weightSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, weightButtonWidth + 4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => handleWeightUnitChange("kg")}
                  >
                    <Text
                      style={[
                        dynamicStyles.unitButtonText,
                        weightUnit === "kg" &&
                          dynamicStyles.unitButtonTextActive,
                      ]}
                    >
                      Kilograms
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => handleWeightUnitChange("lbs")}
                  >
                    <Text
                      style={[
                        dynamicStyles.unitButtonText,
                        weightUnit === "lbs" &&
                          dynamicStyles.unitButtonTextActive,
                      ]}
                    >
                      Pounds
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={dynamicStyles.settingGroup}>
                <Text style={dynamicStyles.settingLabel}>Height unit</Text>

                <View
                  style={dynamicStyles.segmentedShell}
                  onLayout={(event) => {
                    const { width } = event.nativeEvent.layout;
                    const calculatedWidth = (width - 8) / 2;
                    setHeightButtonWidth(calculatedWidth);
                  }}
                >
                  {heightButtonWidth > 0 && (
                    <Animated.View
                      style={[
                        dynamicStyles.segmentIndicator,
                        {
                          width: heightButtonWidth,
                          transform: [
                            {
                              translateX: heightSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, heightButtonWidth + 4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => handleHeightUnitChange("cm")}
                  >
                    <Text
                      style={[
                        dynamicStyles.unitButtonText,
                        heightUnit === "cm" &&
                          dynamicStyles.unitButtonTextActive,
                      ]}
                    >
                      Centimeters
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => handleHeightUnitChange("ft")}
                  >
                    <Text
                      style={[
                        dynamicStyles.unitButtonText,
                        heightUnit === "ft" &&
                          dynamicStyles.unitButtonTextActive,
                      ]}
                    >
                      Feet
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={dynamicStyles.sectionBlock}>
            <Text style={dynamicStyles.sectionLabel}>Appearance</Text>

            <View style={dynamicStyles.card}>
              <View style={dynamicStyles.cardHeaderRow}>
                <View style={dynamicStyles.cardTitleWrap}>
                  <Text style={dynamicStyles.cardTitle}>Theme mode</Text>
                  <Text style={dynamicStyles.cardSubtitle}>
                    Select how the app surface looks while keeping the same
                    features and navigation.
                  </Text>
                </View>
                <View style={dynamicStyles.iconBadge}>
                  <Ionicons
                    name="color-palette-outline"
                    size={20}
                    color={palette.accent}
                  />
                </View>
              </View>

              <View style={dynamicStyles.settingGroup}>
                <Text style={dynamicStyles.settingLabel}>App theme</Text>

                <View
                  style={dynamicStyles.themeSelector}
                  onLayout={(event) => {
                    const { width } = event.nativeEvent.layout;
                    const calculatedWidth = (width - 8) / 2;
                    setThemeButtonWidth(calculatedWidth);
                  }}
                >
                  {themeButtonWidth > 0 && (
                    <Animated.View
                      style={[
                        dynamicStyles.segmentIndicator,
                        {
                          width: themeButtonWidth,
                          transform: [
                            {
                              translateX: themeSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, themeButtonWidth + 4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => updateTheme("Light")}
                  >
                    <Text
                      style={[
                        dynamicStyles.themeButtonText,
                        theme === "Light" &&
                          dynamicStyles.themeButtonTextActive,
                      ]}
                    >
                      Light
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.segmentButton}
                    onPress={() => updateTheme("Dark")}
                  >
                    <Text
                      style={[
                        dynamicStyles.themeButtonText,
                        theme === "Dark" && dynamicStyles.themeButtonTextActive,
                      ]}
                    >
                      Dark
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  heroActionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroActionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#F4FBFA",
  },
  segmentButton: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});

export default PreferencesScreen;
